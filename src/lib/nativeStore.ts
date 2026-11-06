import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { MODULE_META } from "../constants";
import type {
  AppSettings,
  AppState,
  AppStatus,
  Exercise,
  MealType,
  ModuleKey,
  Plan,
  PlanDraft,
  SyncResult,
} from "../types";
import { addDays, dateKey } from "./date";

const STATE_KEY = "worklife.android.state.v1";
const SYNC_KEY = "worklife.android.sync.v1";
const CHANNEL_ID = "worklife-plans";
const MAX_SCHEDULED_NOTIFICATIONS = 400;
const NOTIFICATION_HORIZON_DAYS = 120;
const CLOUD_URL = "https://rixu-app.pages.dev";

export interface SyncConfig {
  serverUrl: string;
  token: string;
  lastSyncAt: string;
  deviceId: string;
  cloudToken: string;
  cloudEmail: string;
  cloudLastSyncAt: string;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createInitialState(): AppState {
  const now = new Date().toISOString();
  return {
    version: 1,
    plans: [],
    deletedPlans: [],
    quickMemo: "",
    quickMemoUpdatedAt: now,
    settings: {
      notificationsEnabled: true,
      autoStart: false,
    },
    notificationLog: [],
    syncToken: "ANDROID",
    lastSyncAt: "",
    updatedAt: now,
  };
}

function cleanText(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanExercises(value: unknown): Exercise[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 30)
    .map((exercise) => ({
      id: cleanText(exercise?.id, 80) || createId(),
      name: cleanText(exercise?.name, 120),
      sets: cleanText(exercise?.sets, 20),
      reps: cleanText(exercise?.reps, 20),
      duration: cleanText(exercise?.duration, 40),
    }))
    .filter((exercise) => exercise.name);
}

function normalizePlan(input: Partial<Plan>, previous?: Plan): Plan {
  const module: ModuleKey = ["learning", "fitness", "diet", "gaming"].includes(
    input.module || "",
  )
    ? (input.module as ModuleKey)
    : previous?.module || "learning";
  const now = new Date().toISOString();
  const repeatEnabled = Boolean(input.repeatEnabled);
  const repeatWeekdays = repeatEnabled
    ? [...new Set((input.repeatWeekdays || []).map(Number))]
        .filter((day) => day >= 0 && day <= 6)
        .sort((a, b) => a - b)
    : [];
  if (repeatEnabled && repeatWeekdays.length === 0) {
    repeatWeekdays.push(new Date().getDay());
  }

  let details = input.details as Record<string, unknown> | undefined;
  if (!details) {
    details = previous?.details as Record<string, unknown> | undefined;
  }
  details ||= {};

  const normalizedDetails =
    module === "learning"
      ? {
          course: cleanText(details.course, 160),
          content: cleanText(details.content, 500),
        }
      : module === "fitness"
        ? {
            focus: cleanText(details.focus, 120),
            exercises: cleanExercises(details.exercises),
          }
        : module === "diet"
          ? {
              mealType: (["breakfast", "lunch", "dinner", "snack"].includes(
                String(details.mealType),
              )
                ? details.mealType
                : "lunch") as MealType,
              menu: cleanText(details.menu, 500),
              portion: cleanText(details.portion, 160),
            }
          : {
              game: cleanText(details.game, 160),
              objective: cleanText(details.objective, 500),
            };

  return {
    id: previous?.id || cleanText(input.id, 80) || createId(),
    module,
    title: cleanText(input.title, 160) || "未命名计划",
    date:
      typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date)
        ? input.date
        : dateKey(),
    repeatEnabled,
    repeatWeekdays,
    startTime:
      typeof input.startTime === "string" &&
      /^\d{2}:\d{2}$/.test(input.startTime)
        ? input.startTime
        : "09:00",
    durationMinutes: Math.max(
      0,
      Math.min(1440, Number(input.durationMinutes) || 0),
    ),
    reminderEnabled: Boolean(input.reminderEnabled),
    notes: cleanText(input.notes, 1000),
    details: normalizedDetails,
    createdAt: previous?.createdAt || input.createdAt || now,
    updatedAt: now,
  } as Plan;
}

function normalizeState(input: unknown): AppState {
  const initial = createInitialState();
  const source = input && typeof input === "object" ? (input as AppState) : null;
  if (!source) return initial;
  return {
    ...initial,
    plans: Array.isArray(source.plans)
      ? source.plans
          .filter((plan) =>
            ["learning", "fitness", "diet", "gaming"].includes(plan?.module),
          )
          .map((plan) => normalizePlan(plan, plan))
      : [],
    deletedPlans: Array.isArray(source.deletedPlans)
      ? source.deletedPlans.filter(
          (entry) => entry?.id && entry?.updatedAt,
        )
      : [],
    quickMemo:
      typeof source.quickMemo === "string"
        ? source.quickMemo.slice(0, 5000)
        : "",
    quickMemoUpdatedAt:
      source.quickMemoUpdatedAt || source.updatedAt || initial.updatedAt,
    settings: {
      notificationsEnabled:
        source.settings?.notificationsEnabled === undefined
          ? true
          : Boolean(source.settings.notificationsEnabled),
      autoStart: false,
    },
    notificationLog: [],
    syncToken: "ANDROID",
    lastSyncAt: source.lastSyncAt || initial.lastSyncAt,
    updatedAt: source.updatedAt || initial.updatedAt,
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

function writeState(state: AppState) {
  const next = {
    ...state,
    settings: { ...state.settings, autoStart: false },
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  void schedulePlanNotifications(next);
  return next;
}

function defaultSyncConfig(): SyncConfig {
  const existingDeviceId = localStorage.getItem("worklife.android.deviceId");
  const deviceId = existingDeviceId || createId();
  if (!existingDeviceId) {
    localStorage.setItem("worklife.android.deviceId", deviceId);
  }
  return {
    serverUrl: "",
    token: "",
    lastSyncAt: "",
    deviceId,
    cloudToken: "",
    cloudEmail: "",
    cloudLastSyncAt: "",
  };
}

export function getSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    return raw
      ? { ...defaultSyncConfig(), ...JSON.parse(raw) }
      : defaultSyncConfig();
  } catch {
    return defaultSyncConfig();
  }
}

export const loadSyncConfig = getSyncConfig;

export function saveSyncConfig(config: Partial<SyncConfig>) {
  const next = { ...getSyncConfig(), ...config };
  localStorage.setItem(SYNC_KEY, JSON.stringify(next));
  return next;
}

function occursOnDate(plan: Plan, date: Date) {
  if (plan.repeatEnabled) {
    return (
      plan.repeatWeekdays.includes(date.getDay()) && plan.date <= dateKey(date)
    );
  }
  return plan.date === dateKey(date);
}

function notificationId(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0) || 1;
}

let notificationSync = Promise.resolve();

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

async function ensureNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    permission = await LocalNotifications.requestPermissions();
  }
  return permission.display === "granted";
}

async function schedulePlanNotifications(state: AppState) {
  if (!Capacitor.isNativePlatform()) return;
  notificationSync = notificationSync
    .catch(() => {})
    .then(async () => {
      const pending = await withTimeout(
        LocalNotifications.getPending(),
        2000,
        { notifications: [] },
      );
      if (pending.notifications.length) {
        await withTimeout(
          LocalNotifications.cancel({
            notifications: pending.notifications.map((notification) => ({
              id: notification.id,
            })),
          }),
          2000,
          undefined,
        );
      }
      if (!state.settings.notificationsEnabled) return;
      if (!(await ensureNotificationPermission())) return;

      if (Capacitor.getPlatform() === "android") {
        await withTimeout(
          LocalNotifications.createChannel({
            id: CHANNEL_ID,
            name: "计划提醒",
            description: "到达计划开始时间时提醒",
            importance: 5,
            visibility: 1,
            vibration: true,
          }).catch(() => {}),
          2000,
          undefined,
        );
      }

      const now = new Date();
      const notifications = [];
      for (
        let offset = 0;
        offset < NOTIFICATION_HORIZON_DAYS &&
        notifications.length < MAX_SCHEDULED_NOTIFICATIONS;
        offset += 1
      ) {
        const day = addDays(now, offset);
        for (const plan of state.plans) {
          if (!plan.reminderEnabled || !occursOnDate(plan, day)) continue;
          const [hours, minutes] = plan.startTime.split(":").map(Number);
          const at = new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            hours,
            minutes,
            0,
            0,
          );
          if (at.getTime() <= now.getTime() + 5000) continue;
          notifications.push({
            id: notificationId(`${plan.id}:${dateKey(day)}`),
            title: plan.title,
            body: `${plan.startTime} · ${MODULE_META[plan.module].label}`,
            largeBody: plan.notes || undefined,
            channelId: CHANNEL_ID,
            schedule: {
              at,
              allowWhileIdle: true,
            },
            extra: {
              planId: plan.id,
            },
          });
          if (notifications.length >= MAX_SCHEDULED_NOTIFICATIONS) break;
        }
      }

      if (notifications.length) {
        await withTimeout(
          LocalNotifications.schedule({ notifications }),
          3000,
          undefined,
        );
      }
    });
  return notificationSync;
}

export async function loadNativeState() {
  const state = readState();
  await schedulePlanNotifications(state);
  return state;
}

export async function saveNativeMemo(quickMemo: string) {
  const state = readState();
  return writeState({
    ...state,
    quickMemo: quickMemo.slice(0, 5000),
    quickMemoUpdatedAt: new Date().toISOString(),
  });
}

export async function createNativePlan(draft: PlanDraft) {
  const state = readState();
  const plan = normalizePlan(draft);
  return writeState({ ...state, plans: [...state.plans, plan] });
}

export async function updateNativePlan(id: string, draft: PlanDraft) {
  const state = readState();
  const existing = state.plans.find((plan) => plan.id === id);
  if (!existing) throw new Error("计划不存在");
  const plan = normalizePlan({ ...draft, id }, existing);
  return writeState({
    ...state,
    plans: state.plans.map((item) => (item.id === id ? plan : item)),
  });
}

export async function removeNativePlan(id: string) {
  const state = readState();
  return writeState({
    ...state,
    plans: state.plans.filter((plan) => plan.id !== id),
    deletedPlans: [
      ...state.deletedPlans.filter((entry) => entry.id !== id),
      { id, updatedAt: new Date().toISOString() },
    ],
  });
}

export async function saveNativeSettings(
  patch: Partial<AppSettings>,
) {
  const state = readState();
  return writeState({
    ...state,
    settings: {
      ...state.settings,
      ...patch,
      autoStart: false,
    },
  });
}

export async function resetNativeState() {
  const next = createInitialState();
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  await schedulePlanNotifications(next);
  return next;
}

export async function importNativeState(input: unknown) {
  const next = normalizeState(input);
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  await schedulePlanNotifications(next);
  return next;
}

export async function testNativeNotification() {
  if (!Capacitor.isNativePlatform()) {
    if (!("Notification" in window)) {
      throw new Error("当前浏览器不支持系统通知");
    }
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      throw new Error("系统通知权限未开启");
    }
    new Notification("日序提醒测试", {
      body: "Android 版本会使用系统本地通知。",
    });
    return;
  }

  if (!(await ensureNotificationPermission())) {
    throw new Error("请允许日序发送系统通知");
  }
  await withTimeout(
    LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() / 1000) % 2147483647,
          title: "日序提醒测试",
          body: "Android 本地通知工作正常。",
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
        },
      ],
    }),
    3000,
    undefined,
  );
}

export async function loadNativeStatus(webGuest = false): Promise<AppStatus> {
  let displayPermission = "unknown";
  if (Capacitor.isNativePlatform()) {
    try {
      displayPermission = (
        await LocalNotifications.checkPermissions()
      ).display;
    } catch {
      displayPermission = "unknown";
    }
  }
  const sync = getSyncConfig();
  return {
    ok: true,
    app: "日序",
    startedAt: new Date().toISOString(),
    uptimeSeconds: 0,
    port: 0,
    platform: webGuest ? "web-guest" : "android",
    dataFile: webGuest ? "当前浏览器本地存储（游客模式）" : "Android 应用本地存储",
    autoStart: false,
    autoStartSupported: false,
    mobile: !webGuest,
    reminders: {
      running: webGuest ? false : displayPermission === "granted",
      lastCheckAt: null,
      intervalMs: 0,
    },
    sync: {
      serverUrl: sync.cloudToken ? CLOUD_URL : sync.serverUrl,
      token: sync.cloudToken ? "云端账号" : sync.token,
      lastSyncAt: sync.cloudLastSyncAt || sync.lastSyncAt,
      lanAddresses: [],
    },
  };
}

export async function syncNativeState(): Promise<SyncResult> {
  const config = getSyncConfig();
  if (config.cloudToken) {
    const state = readState();
    const response = await fetch(`${CLOUD_URL}/api/mobile/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.cloudToken}`,
      },
      body: JSON.stringify({
        state,
        lastSyncAt: config.cloudLastSyncAt,
      }),
    });
    const payload = await response.json();
    if (response.status === 401) {
      saveSyncConfig({ cloudToken: "", cloudEmail: "" });
      throw new Error("云端登录已过期，请重新登录");
    }
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "云端同步失败");
    }
    const merged = normalizeState({
      ...payload.state,
      settings: state.settings,
      notificationLog: state.notificationLog,
    });
    localStorage.setItem(STATE_KEY, JSON.stringify(merged));
    saveSyncConfig({ cloudLastSyncAt: payload.syncedAt });
    await schedulePlanNotifications(merged);
    return {
      ok: true,
      state: merged,
      status: await loadNativeStatus(),
      syncedAt: payload.syncedAt,
      conflictCount: Number(payload.conflictCount) || 0,
    };
  }

  if (!config.serverUrl.trim() || !config.token.trim()) {
    throw new Error("请先登录云端账号或填写电脑同步地址");
  }
  const state = readState();
  const response = await fetch(
    `${config.serverUrl.trim().replace(/\/+$/, "")}/api/sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WorkLife-Token": config.token.trim().toUpperCase(),
      },
      body: JSON.stringify({
        plans: state.plans,
        deletedPlans: state.deletedPlans,
        quickMemo: state.quickMemo,
        quickMemoUpdatedAt: state.quickMemoUpdatedAt,
        updatedAt: state.updatedAt,
        lastSyncAt: config.lastSyncAt,
        deviceId: config.deviceId,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "同步失败");
  }

  const merged = normalizeState({
    ...state,
    plans: payload.state.plans,
    deletedPlans: payload.state.deletedPlans,
    quickMemo: payload.state.quickMemo,
    quickMemoUpdatedAt: payload.state.quickMemoUpdatedAt,
    updatedAt: payload.syncedAt,
  });
  localStorage.setItem(STATE_KEY, JSON.stringify(merged));
  saveSyncConfig({ lastSyncAt: payload.syncedAt });
  await schedulePlanNotifications(merged);

  return {
    ok: true,
    state: merged,
    status: await loadNativeStatus(),
    syncedAt: payload.syncedAt,
    conflictCount: Number(payload.conflictCount) || 0,
  };
}

export function getCloudAccount() {
  const config = getSyncConfig();
  return {
    email: config.cloudEmail,
    signedIn: Boolean(config.cloudToken),
    lastSyncAt: config.cloudLastSyncAt,
  };
}

async function cloudCredentials(
  mode: "login" | "register",
  email: string,
  password: string,
  acceptedTerms = true,
) {
  const response = await fetch(`${CLOUD_URL}/api/mobile/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, acceptedTerms }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || (mode === "login" ? "登录失败" : "注册失败"));
  }
  saveSyncConfig({
    cloudToken: payload.token,
    cloudEmail: payload.user.email,
    cloudLastSyncAt: "",
  });
  return payload.user as { id: string; email: string };
}

export function loginCloudAccount(email: string, password: string) {
  return cloudCredentials("login", email, password);
}

export function registerCloudAccount(
  email: string,
  password: string,
  acceptedTerms: boolean,
) {
  return cloudCredentials("register", email, password, acceptedTerms);
}

export async function logoutCloudAccount() {
  const config = getSyncConfig();
  if (config.cloudToken) {
    await fetch(`${CLOUD_URL}/api/mobile/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cloudToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch(() => {});
  }
  saveSyncConfig({
    cloudToken: "",
    cloudEmail: "",
    cloudLastSyncAt: "",
  });
}

export { normalizeState as normalizeNativeState };
