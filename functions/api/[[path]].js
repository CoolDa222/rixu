const SESSION_COOKIE = "rixu_session";
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 100000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "600",
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value) {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}

async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(signature));
}

async function hashPassword(password, saltText) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltText),
      iterations: PASSWORD_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

function parseCookies(request) {
  const cookies = {};
  for (const pair of (request.headers.get("Cookie") || "").split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name] = rest.join("=");
  }
  return cookies;
}

async function createSession(request, env, userId) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, userId, expiresAt, new Date().toISOString())
    .run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_DAYS * 86400
  }${secure}`;
}

async function createMobileToken(env, userId) {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(tokenHash, userId, expiresAt, new Date().toISOString())
    .run();
  return token;
}

async function authenticate(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, sessions.expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
  )
    .bind(tokenHash)
    .first();
  if (!row || row.expires_at < Date.now()) {
    if (row) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(tokenHash)
        .run();
    }
    return null;
  }
  return { id: row.id, email: row.email };
}

async function authenticateBearer(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const tokenHash = await sha256(authorization.slice(7));
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, sessions.expires_at
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = ?`,
  )
    .bind(tokenHash)
    .first();
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, email: row.email, tokenHash };
}

async function rateLimit(env, request, action, max, windowMs) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const salt = env.RATE_LIMIT_SALT || "rixu-local-rate-limit-v1";
  const fingerprint = (await hmacSha256(salt, ip)).slice(0, 32);
  const key = `${action}:${fingerprint}`;
  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT count, reset_at FROM rate_limits WHERE key = ?",
  )
    .bind(key)
    .first();
  if (!row || row.reset_at < now) {
    await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
    )
      .bind(key, now + windowMs)
      .run();
    return true;
  }
  if (row.count >= max) return false;
  await env.DB.prepare(
    "UPDATE rate_limits SET count = count + 1 WHERE key = ?",
  )
    .bind(key)
    .run();
  return true;
}

function cleanText(value, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePlan(input, previous = {}) {
  const modules = ["learning", "fitness", "diet", "gaming"];
  const module = modules.includes(input.module)
    ? input.module
    : previous.module || "learning";
  const now = new Date().toISOString();
  const repeatEnabled = Boolean(input.repeatEnabled);
  const days = repeatEnabled
    ? [...new Set((input.repeatWeekdays || []).map(Number))].filter(
        (day) => day >= 0 && day <= 6,
      )
    : [];
  if (repeatEnabled && !days.length) days.push(new Date().getDay());
  const validTime = /^\d{2}:\d{2}$/.test(input.startTime || "");
  return {
    id: previous.id || cleanText(input.id, 80) || crypto.randomUUID(),
    module,
    title: cleanText(input.title, 160) || "未命名计划",
    date:
      typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : new Date().toISOString().slice(0, 10),
    repeatEnabled,
    repeatWeekdays: days,
    startTime: validTime ? input.startTime : "09:00",
    durationMinutes: Math.max(
      0,
      Math.min(1440, Number(input.durationMinutes) || 0),
    ),
    reminderEnabled: Boolean(input.reminderEnabled),
    notes: cleanText(input.notes, 1000),
    details: input.details && typeof input.details === "object" ? input.details : {},
    createdAt: previous.createdAt || now,
    updatedAt: now,
  };
}

function initialState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    plans: [],
    deletedPlans: [],
    quickMemo: "",
    quickMemoUpdatedAt: now,
    settings: { notificationsEnabled: false, autoStart: false },
    notificationLog: [],
    syncToken: "CLOUD",
    lastSyncAt: "",
    updatedAt: now,
  };
}

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function planFingerprint(plan) {
  return JSON.stringify({
    module: plan.module,
    title: plan.title,
    date: plan.date,
    repeatEnabled: plan.repeatEnabled,
    repeatWeekdays: plan.repeatWeekdays,
    startTime: plan.startTime,
    durationMinutes: plan.durationMinutes,
    reminderEnabled: plan.reminderEnabled,
    notes: plan.notes,
    details: plan.details,
  });
}

function mergeCloudState(current, incoming, lastSyncAt) {
  const now = new Date().toISOString();
  const lastSync = timestamp(lastSyncAt);
  const currentPlans = new Map(current.plans.map((plan) => [plan.id, plan]));
  const incomingPlans = new Map(incoming.plans.map((plan) => [plan.id, plan]));
  const currentTombs = new Map(
    (current.deletedPlans || []).map((entry) => [entry.id, entry]),
  );
  const incomingTombs = new Map(
    (incoming.deletedPlans || []).map((entry) => [entry.id, entry]),
  );
  const allIds = new Set([
    ...currentPlans.keys(),
    ...incomingPlans.keys(),
    ...currentTombs.keys(),
    ...incomingTombs.keys(),
  ]);
  const plans = new Map();
  const tombstones = new Map();
  let conflicts = 0;

  for (const id of allIds) {
    const left = currentPlans.get(id);
    const right = incomingPlans.get(id);
    let selected = left || right || null;
    if (left && right) {
      const bothChanged =
        timestamp(left.updatedAt) > lastSync &&
        timestamp(right.updatedAt) > lastSync;
      if (bothChanged && planFingerprint(left) !== planFingerprint(right)) {
        selected = left;
        const copy = normalizePlan({
          ...right,
          id: crypto.randomUUID(),
          title: `${right.title}（手机冲突副本）`,
        });
        plans.set(copy.id, copy);
        conflicts += 1;
      } else if (timestamp(right.updatedAt) > timestamp(left.updatedAt)) {
        selected = right;
      }
    }
    if (selected) plans.set(id, selected);

    const currentTomb = currentTombs.get(id);
    const incomingTomb = incomingTombs.get(id);
    const tomb =
      currentTomb && incomingTomb
        ? timestamp(incomingTomb.updatedAt) > timestamp(currentTomb.updatedAt)
          ? incomingTomb
          : currentTomb
        : currentTomb || incomingTomb;
    if (tomb) {
      const plan = plans.get(id);
      if (!plan || timestamp(tomb.updatedAt) > timestamp(plan.updatedAt)) {
        plans.delete(id);
        tombstones.set(id, tomb);
      }
    }
  }

  let quickMemo = current.quickMemo || "";
  let quickMemoUpdatedAt =
    current.quickMemoUpdatedAt || current.updatedAt || now;
  const bothMemosChanged =
    timestamp(current.quickMemoUpdatedAt) > lastSync &&
    timestamp(incoming.quickMemoUpdatedAt) > lastSync;
  if (
    bothMemosChanged &&
    current.quickMemo.trim() &&
    incoming.quickMemo.trim() &&
    current.quickMemo !== incoming.quickMemo
  ) {
    quickMemo = `${current.quickMemo}\n\n--- 手机离线修改 ---\n${incoming.quickMemo}`;
    quickMemoUpdatedAt = now;
    conflicts += 1;
  } else if (
    !current.quickMemo.trim() ||
    timestamp(incoming.quickMemoUpdatedAt) >
      timestamp(current.quickMemoUpdatedAt)
  ) {
    quickMemo = incoming.quickMemo;
    quickMemoUpdatedAt = incoming.quickMemoUpdatedAt;
  }

  return {
    state: {
      ...current,
      plans: [...plans.values()],
      deletedPlans: [...tombstones.values()],
      quickMemo,
      quickMemoUpdatedAt,
      lastSyncAt: now,
      updatedAt: now,
    },
    conflicts,
    syncedAt: now,
  };
}

function normalizeState(value) {
  const initial = initialState();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...initial,
    plans: Array.isArray(source.plans)
      ? source.plans
          .filter((plan) => ["learning", "fitness", "diet", "gaming"].includes(plan?.module))
          .map((plan) => normalizePlan(plan, plan))
      : [],
    deletedPlans: Array.isArray(source.deletedPlans) ? source.deletedPlans : [],
    quickMemo: cleanText(source.quickMemo, 5000),
    quickMemoUpdatedAt: source.quickMemoUpdatedAt || initial.quickMemoUpdatedAt,
    settings: {
      notificationsEnabled: false,
      autoStart: false,
    },
    syncToken: "CLOUD",
    lastSyncAt: "",
    updatedAt: source.updatedAt || initial.updatedAt,
  };
}

async function getState(env, userId) {
  const row = await env.DB.prepare(
    "SELECT state_json FROM user_data WHERE user_id = ?",
  )
    .bind(userId)
    .first();
  if (!row) {
    const state = initialState();
    await env.DB.prepare(
      "INSERT INTO user_data (user_id, state_json, updated_at) VALUES (?, ?, ?)",
    )
      .bind(userId, JSON.stringify(state), state.updatedAt)
      .run();
    return state;
  }
  return normalizeState(JSON.parse(row.state_json));
}

async function saveState(env, userId, state) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await env.DB.prepare(
    "UPDATE user_data SET state_json = ?, updated_at = ? WHERE user_id = ?",
  )
    .bind(JSON.stringify(next), next.updatedAt, userId)
    .run();
  return next;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function subjectFrom(webUser, mobileUser) {
  return webUser || mobileUser || null;
}

function isAdmin(subject, env) {
  const configuredEmail =
    typeof env.ADMIN_EMAIL === "string"
      ? env.ADMIN_EMAIL.trim().toLowerCase()
      : "";
  return Boolean(
    configuredEmail &&
      subject?.email?.toLowerCase() === configuredEmail,
  );
}

async function handleFeedback(request, env, path, method, subject) {
  if (path === "feedback" && method === "POST") {
    if (!(await rateLimit(env, request, "feedback", 8, 60 * 60 * 1000))) {
      return fail("提交过于频繁，请稍后再试", 429);
    }
    const body = await readJson(request);
    const content = cleanText(body.content, 3000);
    if (content.length < 5) return fail("请至少填写 5 个字");
    const category = ["feature", "bug", "design", "other"].includes(
      body.category,
    )
      ? body.category
      : "other";
    const contact = cleanText(body.contact, 200);
    const pagePath = cleanText(body.pagePath, 200);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO feedback
       (id, user_id, email, category, content, contact, page_path, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    )
      .bind(
        id,
        subject?.id || null,
        subject?.email || null,
        category,
        content,
        contact,
        pagePath,
        now,
        now,
      )
      .run();
    return json({ ok: true, id }, 201);
  }

  if (path === "feedback/admin" && method === "GET") {
    if (!isAdmin(subject, env)) return fail("没有意见箱管理权限", 403);
    const rows = await env.DB.prepare(
      `SELECT id, user_id, email, category, content, contact, page_path,
              status, created_at, updated_at
       FROM feedback ORDER BY created_at DESC LIMIT 300`,
    ).all();
    return json({ ok: true, feedback: rows.results || [] });
  }

  const statusMatch = path.match(/^feedback\/([^/]+)\/status$/);
  if (statusMatch && method === "PUT") {
    if (!isAdmin(subject, env)) return fail("没有意见箱管理权限", 403);
    const body = await readJson(request);
    const status = ["new", "read", "resolved"].includes(body.status)
      ? body.status
      : "read";
    await env.DB.prepare(
      "UPDATE feedback SET status = ?, updated_at = ? WHERE id = ?",
    )
      .bind(status, new Date().toISOString(), decodeURIComponent(statusMatch[1]))
      .run();
    return json({ ok: true });
  }

  const deleteMatch = path.match(/^feedback\/([^/]+)$/);
  if (deleteMatch && method === "DELETE") {
    if (!isAdmin(subject, env)) return fail("没有意见箱管理权限", 403);
    await env.DB.prepare("DELETE FROM feedback WHERE id = ?")
      .bind(decodeURIComponent(deleteMatch[1]))
      .run();
    return json({ ok: true });
  }

  return null;
}

async function handleAuth(request, env, path, method) {
  if (path === "auth/session" && method === "GET") {
    const user = await authenticate(request, env);
    return user ? json({ ok: true, user }) : fail("未登录", 401);
  }

  if (path === "auth/register" && method === "POST") {
    if (!(await rateLimit(env, request, "register", 5, 60 * 60 * 1000))) {
      return fail("注册请求过于频繁，请稍后再试", 429);
    }
    const body = await readJson(request);
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("请输入有效邮箱");
    }
    if (password.length < 8 || password.length > 128) {
      return fail("密码长度需要为 8–128 位");
    }
    if (body.acceptedTerms !== true) {
      return fail("请先同意隐私政策和使用条款");
    }
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (existing) return fail("该邮箱已经注册", 409);
    const userId = crypto.randomUUID();
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users
         (id, email, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(userId, email, passwordHash, salt, now),
      env.DB.prepare(
        "INSERT INTO user_data (user_id, state_json, updated_at) VALUES (?, ?, ?)",
      ).bind(userId, JSON.stringify(initialState()), now),
    ]);
    const cookie = await createSession(request, env, userId);
    return json(
      { ok: true, user: { id: userId, email }, state: initialState() },
      201,
      { "Set-Cookie": cookie },
    );
  }

  if (path === "auth/login" && method === "POST") {
    if (!(await rateLimit(env, request, "login", 12, 60 * 60 * 1000))) {
      return fail("登录尝试过于频繁，请稍后再试", 429);
    }
    const body = await readJson(request);
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const user = await env.DB.prepare(
      "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?",
    )
      .bind(email)
      .first();
    if (!user) return fail("邮箱或密码不正确", 401);
    const hash = await hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) return fail("邮箱或密码不正确", 401);
    const cookie = await createSession(request, env, user.id);
    return json(
      {
        ok: true,
        user: { id: user.id, email: user.email },
        state: await getState(env, user.id),
      },
      200,
      { "Set-Cookie": cookie },
    );
  }

  if (path === "auth/logout" && method === "POST") {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(await sha256(token))
        .run();
    }
    return json(
      { ok: true },
      200,
      { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
    );
  }

  return null;
}

async function handleMobileAuth(request, env, path, method) {
  if (path === "mobile/register" && method === "POST") {
    if (!(await rateLimit(env, request, "mobile-register", 5, 60 * 60 * 1000))) {
      return fail("注册请求过于频繁，请稍后再试", 429);
    }
    const body = await readJson(request);
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail("请输入有效邮箱");
    }
    if (password.length < 8 || password.length > 128) {
      return fail("密码长度需要为 8–128 位");
    }
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (existing) return fail("该邮箱已经注册", 409);

    const userId = crypto.randomUUID();
    const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash = await hashPassword(password, salt);
    const now = new Date().toISOString();
    const state = initialState();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO users
         (id, email, password_hash, password_salt, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(userId, email, passwordHash, salt, now),
      env.DB.prepare(
        "INSERT INTO user_data (user_id, state_json, updated_at) VALUES (?, ?, ?)",
      ).bind(userId, JSON.stringify(state), now),
    ]);
    const token = await createMobileToken(env, userId);
    return json({ ok: true, token, user: { id: userId, email }, state }, 201);
  }

  if (path === "mobile/login" && method === "POST") {
    if (!(await rateLimit(env, request, "mobile-login", 12, 60 * 60 * 1000))) {
      return fail("登录尝试过于频繁，请稍后再试", 429);
    }
    const body = await readJson(request);
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const user = await env.DB.prepare(
      "SELECT id, email, password_hash, password_salt FROM users WHERE email = ?",
    )
      .bind(email)
      .first();
    if (!user) return fail("邮箱或密码不正确", 401);
    const hash = await hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) return fail("邮箱或密码不正确", 401);
    const token = await createMobileToken(env, user.id);
    return json({
      ok: true,
      token,
      user: { id: user.id, email: user.email },
      state: await getState(env, user.id),
    });
  }

  if (path === "mobile/logout" && method === "POST") {
    const user = await authenticateBearer(request, env);
    if (user) {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(user.tokenHash)
        .run();
    }
    return json({ ok: true });
  }

  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method.toUpperCase();

  try {
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const mobileAuth = await handleMobileAuth(request, env, path, method);
    if (mobileAuth) return mobileAuth;

    const mobileUser = await authenticateBearer(request, env);
    if (path.startsWith("mobile/") && mobileUser) {
      if (path === "mobile/session" && method === "GET") {
        return json({ ok: true, user: { id: mobileUser.id, email: mobileUser.email } });
      }
      if (path === "mobile/state" && method === "GET") {
        return json({ ok: true, state: await getState(env, mobileUser.id) });
      }
      if (path === "mobile/sync" && method === "POST") {
        const body = await readJson(request);
        const current = await getState(env, mobileUser.id);
        const incoming = normalizeState(body.state || {});
        const merged = mergeCloudState(current, incoming, body.lastSyncAt);
        const state = await saveState(env, mobileUser.id, merged.state);
        return json({
          ok: true,
          state,
          syncedAt: merged.syncedAt,
          conflictCount: merged.conflicts,
        });
      }
    }

    const authResponse = await handleAuth(request, env, path, method);
    if (authResponse) return authResponse;

    const webUser = await authenticate(request, env);
    const subject = subjectFrom(webUser, mobileUser);
    const feedbackResponse = await handleFeedback(
      request,
      env,
      path,
      method,
      subject,
    );
    if (feedbackResponse) return feedbackResponse;

    const user = webUser;
    if (!user) return fail("未登录或会话已过期", 401);

    if (path === "status" && method === "GET") {
      return json({
        ok: true,
        app: "日序",
        startedAt: new Date().toISOString(),
        uptimeSeconds: 0,
        port: 443,
        platform: "cloudflare",
        dataFile: `账号 ${user.email} 的云端数据`,
        autoStart: false,
        autoStartSupported: false,
        mobile: false,
        reminders: { running: false, lastCheckAt: null, intervalMs: 0 },
        sync: { serverUrl: "", token: "", lastSyncAt: "", lanAddresses: [] },
      });
    }

    if (path === "state" && method === "GET") {
      return json({ ok: true, state: await getState(env, user.id) });
    }

    if (path === "memo" && method === "PUT") {
      const body = await readJson(request);
      const state = await getState(env, user.id);
      state.quickMemo = cleanText(body.quickMemo, 5000);
      state.quickMemoUpdatedAt = new Date().toISOString();
      return json({ ok: true, state: await saveState(env, user.id, state) });
    }

    if (path === "plans" && method === "POST") {
      const state = await getState(env, user.id);
      const plan = normalizePlan(await readJson(request));
      state.plans.push(plan);
      return json(
        { ok: true, plan, state: await saveState(env, user.id, state) },
        201,
      );
    }

    const planMatch = path.match(/^plans\/([^/]+)$/);
    if (planMatch && method === "PUT") {
      const state = await getState(env, user.id);
      const id = decodeURIComponent(planMatch[1]);
      const existing = state.plans.find((plan) => plan.id === id);
      if (!existing) return fail("计划不存在", 404);
      const plan = normalizePlan({ ...(await readJson(request)), id }, existing);
      state.plans = state.plans.map((item) => (item.id === id ? plan : item));
      return json({ ok: true, plan, state: await saveState(env, user.id, state) });
    }

    if (planMatch && method === "DELETE") {
      const state = await getState(env, user.id);
      const id = decodeURIComponent(planMatch[1]);
      state.plans = state.plans.filter((plan) => plan.id !== id);
      state.deletedPlans.push({ id, updatedAt: new Date().toISOString() });
      return json({ ok: true, state: await saveState(env, user.id, state) });
    }

    if (path === "settings" && method === "PUT") {
      const body = await readJson(request);
      const state = await getState(env, user.id);
      if (typeof body.notificationsEnabled === "boolean") {
        state.settings.notificationsEnabled = false;
      }
      return json({
        ok: true,
        state: await saveState(env, user.id, state),
        status: {
          ok: true,
          autoStart: false,
          autoStartSupported: false,
          mobile: false,
          reminders: { running: false, lastCheckAt: null, intervalMs: 0 },
          sync: { serverUrl: "", token: "", lastSyncAt: "", lanAddresses: [] },
        },
      });
    }

    if (path === "notifications/test" && method === "POST") {
      return fail("网页系统通知将在下一阶段接入 Web Push", 501);
    }

    if (path === "backup/export" && method === "GET") {
      const state = await getState(env, user.id);
      return new Response(JSON.stringify(state, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="rixu-backup.json"',
        },
      });
    }

    if (path === "backup/import" && method === "POST") {
      const body = await readJson(request);
      if (!Array.isArray(body.state?.plans)) return fail("备份格式不正确");
      return json({
        ok: true,
        state: await saveState(env, user.id, normalizeState(body.state)),
      });
    }

    if (path === "reset" && method === "POST") {
      const state = initialState();
      return json({ ok: true, state: await saveState(env, user.id, state) });
    }

    return fail("接口不存在", 404);
  } catch (error) {
    console.error(error);
    return fail("服务器内部错误", 500);
  }
}
