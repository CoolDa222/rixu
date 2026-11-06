import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  LocalStore,
  getDataDir,
  getDataFile,
  normalizePlan,
  normalizeState,
} from "./store.js";
import {
  createReminderService,
  showSystemNotification,
} from "./reminders.js";
import { isAutoStartEnabled, setAutoStart } from "./windows.js";
import { mergeSyncState } from "./sync.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const publicDir = path.join(appRoot, "dist");
const port = Number(process.env.WORKLIFE_PORT) || 4318;
const host = "127.0.0.1";
const startedAt = new Date();
const shouldOpen = process.argv.includes("--open");
const store = new LocalStore(getDataFile());
const reminders = createReminderService(store);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, status, message) {
  sendJson(response, status, { ok: false, error: message });
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-WorkLife-Token",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  response.setHeader("Access-Control-Max-Age", "600");
}

function isLoopback(request) {
  const address = request.socket.remoteAddress || "";
  return (
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1"
  );
}

function getLanAddresses() {
  const candidates = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        !entry.address.startsWith("169.254.")
      ) {
        const lowerName = name.toLowerCase();
        const isVirtual =
          /wintun|vpn|tailscale|wireguard|zerotier|hyper-v|vethernet|vmware|virtualbox|mumu|emulator|clash|tun\b|tap\b/.test(
            lowerName,
          );
        const isPhysical =
          /wlan|wi-?fi|ethernet|以太网|无线|本地连接/.test(lowerName);
        const isPrivate =
          entry.address.startsWith("10.") ||
          entry.address.startsWith("192.168.") ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address);
        const score =
          (isPhysical ? 100 : 0) +
          (isPrivate ? 10 : 0) +
          (isVirtual ? -100 : 0);
        candidates.push({
          address: entry.address,
          name,
          score,
        });
      }
    }
  }
  return [
    ...new Map(
      candidates
        .sort((a, b) => b.score - a.score)
        .map((item) => [item.address, item.address]),
    ).values(),
  ];
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5 * 1024 * 1024) {
      throw new Error("请求内容过大");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("请求内容不是有效 JSON");
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function serveStatic(request, response, pathname) {
  const requested =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const safePath = path.resolve(publicDir, requested);

  if (!safePath.startsWith(publicDir)) {
    sendError(response, 403, "禁止访问该路径");
    return;
  }

  let filePath = safePath;
  if (!(await fileExists(filePath)) || path.extname(filePath) === "") {
    filePath = path.join(publicDir, "index.html");
  }

  if (!(await fileExists(filePath))) {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      "<!doctype html><html><body style=\"font-family:sans-serif;padding:40px\"><h1>日序尚未构建</h1><p>请运行 <code>npm run build</code> 后重新启动。</p></body></html>",
    );
    return;
  }

  response.writeHead(200, {
    "Content-Type":
      MIME_TYPES[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream",
    "Cache-Control":
      path.basename(filePath) === "index.html"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
  });
  createReadStream(filePath).pipe(response);
}

async function getStatus(request) {
  const local = !request || isLoopback(request);
  const addresses = getLanAddresses();
  return {
    ok: true,
    app: "日序",
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    port,
    platform: process.platform,
    dataFile: getDataFile(),
    autoStart: isAutoStartEnabled(),
    autoStartSupported: process.platform === "win32",
    mobile: false,
    reminders: reminders.status(),
    sync: {
      serverUrl: addresses[0] ? `http://${addresses[0]}:${port}` : "",
      token: local ? store.getState().syncToken : "",
      lastSyncAt: store.getState().lastSyncAt || "",
      lanAddresses: addresses.map((address) => `http://${address}:${port}`),
    },
  };
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/status") {
    sendJson(response, 200, await getStatus(request));
    return true;
  }

  if (request.method === "GET" && pathname === "/api/state") {
    sendJson(response, 200, { ok: true, state: store.getState() });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/memo") {
    const body = await readJson(request);
    const state = await store.update((draft) => {
      draft.quickMemo =
        typeof body.quickMemo === "string"
          ? body.quickMemo.slice(0, 5000)
          : "";
      draft.quickMemoUpdatedAt = new Date().toISOString();
    });
    sendJson(response, 200, { ok: true, state });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/plans") {
    const body = await readJson(request);
    const plan = normalizePlan(body);
    const state = await store.update((draft) => {
      draft.plans.push(plan);
    });
    sendJson(response, 201, { ok: true, plan, state });
    return true;
  }

  const planMatch = pathname.match(/^\/api\/plans\/([^/]+)$/);
  if (planMatch && request.method === "PUT") {
    const body = await readJson(request);
    const id = decodeURIComponent(planMatch[1]);
    const existing = store.getState().plans.find((plan) => plan.id === id);
    if (!existing) {
      sendError(response, 404, "计划不存在");
      return true;
    }
    const plan = normalizePlan({ ...body, module: body.module || existing.module }, existing);
    const state = await store.update((draft) => {
      draft.plans = draft.plans.map((item) => (item.id === id ? plan : item));
    });
    sendJson(response, 200, { ok: true, plan, state });
    return true;
  }

  if (planMatch && request.method === "DELETE") {
    const id = decodeURIComponent(planMatch[1]);
    const state = await store.update((draft) => {
      draft.plans = draft.plans.filter((plan) => plan.id !== id);
      draft.deletedPlans = draft.deletedPlans.filter(
        (entry) => entry.id !== id,
      );
      draft.deletedPlans.push({
        id,
        updatedAt: new Date().toISOString(),
      });
    });
    sendJson(response, 200, { ok: true, state });
    return true;
  }

  if (request.method === "PUT" && pathname === "/api/settings") {
    const body = await readJson(request);
    let autoStartResult = null;

    if (
      typeof body.autoStart === "boolean" &&
      body.autoStart !== isAutoStartEnabled()
    ) {
      autoStartResult = await setAutoStart(body.autoStart, getDataDir());
    }

    const state = await store.update((draft) => {
      if (typeof body.notificationsEnabled === "boolean") {
        draft.settings.notificationsEnabled = body.notificationsEnabled;
      }
      draft.settings.autoStart = isAutoStartEnabled();
    });
    sendJson(response, 200, {
      ok: true,
      state,
      autoStartResult,
      status: await getStatus(request),
    });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/notifications/test") {
    await showSystemNotification({
      title: "日序提醒测试",
      message: "系统通知工作正常。关闭浏览器后仍会继续提醒。",
      test: true,
    });
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/sync") {
    const body = await readJson(request);
    const current = store.getState();
    const incoming = normalizeState({
      plans: body.plans || [],
      deletedPlans: body.deletedPlans || [],
      quickMemo: body.quickMemo || "",
      quickMemoUpdatedAt: body.quickMemoUpdatedAt || body.updatedAt,
      settings: current.settings,
      notificationLog: [],
      syncToken: current.syncToken,
      updatedAt: body.updatedAt,
    });
    const merged = mergeSyncState({
      current,
      incoming,
      lastSyncAt: body.lastSyncAt,
    });
    const state = await store.replace(merged.state);
    sendJson(response, 200, {
      ok: true,
      state,
      syncedAt: merged.syncedAt,
      conflictCount: merged.conflicts.length,
      conflicts: merged.conflicts,
    });
    return true;
  }

  if (request.method === "GET" && pathname === "/api/backup/export") {
    const fileName = `work-life-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(store.getState(), null, 2));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/backup/import") {
    const body = await readJson(request);
    if (!body.state || !Array.isArray(body.state.plans)) {
      sendError(response, 400, "备份文件格式不正确");
      return true;
    }
    const state = await store.replace(body.state);
    sendJson(response, 200, { ok: true, state });
    return true;
  }

  if (request.method === "POST" && pathname === "/api/reset") {
    if (isAutoStartEnabled()) {
      await setAutoStart(false, getDataDir());
    }
    const state = await store.replace({
      version: 1,
      plans: [],
      quickMemo: "",
      settings: {
        notificationsEnabled: true,
        autoStart: false,
      },
      notificationLog: [],
    });
    sendJson(response, 200, { ok: true, state });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    const pathname = url.pathname;

    if (pathname.startsWith("/api/")) {
      setCorsHeaders(response);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (!isLoopback(request)) {
        const token = request.headers["x-worklife-token"];
        if (token !== store.getState().syncToken) {
          sendError(response, 401, "同步配对码不正确");
          return;
        }
      }
      const handled = await handleApi(request, response, pathname);
      if (!handled) {
        sendError(response, 404, "接口不存在");
      }
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendError(response, 405, "不支持的请求方法");
      return;
    }

    await serveStatic(request, response, pathname);
  } catch (error) {
    console.error("[server]", error);
    sendError(response, 500, error.message || "服务器内部错误");
  }
});

function openBrowser() {
  const url = `http://${host}:${port}`;
  if (process.platform === "win32") {
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [url], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`日序已经在 http://${host}:${port} 运行。`);
    process.exit(0);
  }
  console.error(error);
  process.exit(1);
});

await store.load();
const startupAutoStart = isAutoStartEnabled();
if (store.getState().settings.autoStart !== startupAutoStart) {
  await store.update((draft) => {
    draft.settings.autoStart = startupAutoStart;
  });
}
reminders.start();

server.listen(port, "0.0.0.0", () => {
  console.log(`日序已启动：http://${host}:${port}`);
  const lanAddresses = getLanAddresses();
  if (lanAddresses.length) {
    console.log(`手机同步地址：http://${lanAddresses[0]}:${port}`);
  }
  console.log(`本地数据：${getDataFile()}`);
  if (shouldOpen) {
    openBrowser();
  }
});

function shutdown() {
  reminders.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
