import { Capacitor } from "@capacitor/core";
import type {
  AppState,
  AppStatus,
  AuthUser,
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
  Plan,
  PlanDraft,
  SyncResult,
} from "../types";
import {
  createNativePlan,
  getCloudAccount as getNativeCloudAccount,
  getSyncConfig,
  importNativeState,
  loginCloudAccount,
  loadNativeState,
  loadNativeStatus,
  removeNativePlan,
  resetNativeState,
  logoutCloudAccount,
  registerCloudAccount,
  saveNativeMemo,
  saveNativeSettings,
  saveSyncConfig,
  syncNativeState,
  testNativeNotification,
  updateNativePlan,
  type SyncConfig,
} from "./nativeStore";

interface ApiResponse<T> {
  ok: boolean;
  error?: string;
  state?: AppState;
  status?: AppStatus;
  plan?: Plan;
  autoStartResult?: unknown;
  [key: string]: T | unknown;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`请求失败（${response.status}）`);
  }

  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload.error || `请求失败（${response.status}）`, response.status);
  }
  return payload as T;
}

const GUEST_KEY = "rixu.guest-mode";

export function isMobileMode() {
  if (typeof window === "undefined") return false;
  const preview = new URLSearchParams(window.location.search).get("mobile");
  return preview === "1" || Capacitor.isNativePlatform();
}

export function isDesktopMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("desktop") === "1";
}

export function isWebGuestMode() {
  if (typeof window === "undefined" || isMobileMode()) return false;
  return localStorage.getItem(GUEST_KEY) === "1";
}

export function enterWebGuestMode() {
  localStorage.setItem(GUEST_KEY, "1");
}

export function exitWebGuestMode() {
  localStorage.removeItem(GUEST_KEY);
}

function usesLocalData() {
  return isMobileMode() || isWebGuestMode();
}

export function isCloudMode() {
  if (typeof window === "undefined" || isMobileMode()) return false;
  return (
    new URLSearchParams(window.location.search).get("cloud") === "1" ||
    (!isWebGuestMode() &&
      !["127.0.0.1", "localhost", "::1"].includes(window.location.hostname))
  );
}

export async function getSession() {
  return request<{ ok: true; user: AuthUser }>("/api/auth/session");
}

export async function login(email: string, password: string) {
  return request<{ ok: true; user: AuthUser; state: AppState }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function register(
  email: string,
  password: string,
  acceptedTerms: boolean,
) {
  return request<{ ok: true; user: AuthUser; state: AppState }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email, password, acceptedTerms }),
    },
  );
}

export async function logout() {
  return request<{ ok: true }>("/api/auth/logout", {
    method: "POST",
    body: "{}",
  });
}

export async function loadState() {
  if (usesLocalData()) {
    return { ok: true as const, state: await loadNativeState() };
  }
  return request<{ ok: true; state: AppState }>("/api/state");
}

export async function loadStatus() {
  if (usesLocalData()) {
    return loadNativeStatus(isWebGuestMode());
  }
  return request<AppStatus>("/api/status");
}

export async function saveMemo(quickMemo: string) {
  if (usesLocalData()) {
    return { ok: true as const, state: await saveNativeMemo(quickMemo) };
  }
  return request<{ ok: true; state: AppState }>("/api/memo", {
    method: "PUT",
    body: JSON.stringify({ quickMemo }),
  });
}

export async function createPlan(draft: PlanDraft) {
  if (usesLocalData()) {
    const state = await createNativePlan(draft);
    const plan = state.plans[state.plans.length - 1];
    return { ok: true as const, plan, state };
  }
  return request<{ ok: true; plan: Plan; state: AppState }>("/api/plans", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function updatePlan(id: string, draft: PlanDraft) {
  if (usesLocalData()) {
    const state = await updateNativePlan(id, draft);
    const plan = state.plans.find((item) => item.id === id);
    if (!plan) throw new Error("计划不存在");
    return { ok: true as const, plan, state };
  }
  return request<{ ok: true; plan: Plan; state: AppState }>(
    `/api/plans/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: JSON.stringify(draft),
    },
  );
}

export async function removePlan(id: string) {
  if (usesLocalData()) {
    return { ok: true as const, state: await removeNativePlan(id) };
  }
  return request<{ ok: true; state: AppState }>(
    `/api/plans/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function saveSettings(settings: {
  notificationsEnabled?: boolean;
  autoStart?: boolean;
}) {
  if (usesLocalData()) {
    const state = await saveNativeSettings({
      notificationsEnabled: settings.notificationsEnabled,
    });
    return {
      ok: true as const,
      state,
      status: await loadNativeStatus(isWebGuestMode()),
    };
  }
  return request<{ ok: true; state: AppState; status: AppStatus }>(
    "/api/settings",
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
  );
}

export async function testNotification() {
  if (usesLocalData()) {
    await testNativeNotification();
    return { ok: true as const };
  }
  return request<{ ok: true }>("/api/notifications/test", {
    method: "POST",
    body: "{}",
  });
}

export async function importBackup(state: unknown) {
  if (usesLocalData()) {
    return { ok: true as const, state: await importNativeState(state) };
  }
  return request<{ ok: true; state: AppState }>("/api/backup/import", {
    method: "POST",
    body: JSON.stringify({ state }),
  });
}

export async function resetData() {
  if (usesLocalData()) {
    return { ok: true as const, state: await resetNativeState() };
  }
  return request<{ ok: true; state: AppState }>("/api/reset", {
    method: "POST",
    body: "{}",
  });
}

export function getSyncSettings(): SyncConfig {
  return getSyncConfig();
}

export function saveSyncSettings(config: Partial<SyncConfig>) {
  return saveSyncConfig(config);
}

export async function syncNow(): Promise<SyncResult> {
  if (isDesktopMode()) {
    return syncDesktopCloudState();
  }
  if (!isMobileMode()) {
    throw new Error("当前环境不支持账号同步");
  }
  return syncNativeState();
}

export async function exportBackup() {
  const state = usesLocalData()
    ? (await loadState()).state
    : (await request<{ ok: true; state: AppState }>("/api/state")).state;
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `work-life-backup-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export { loadSyncConfig } from "./nativeStore";

export function getMobileCloudAccount() {
  return getNativeCloudAccount();
}

export async function loginMobileCloud(email: string, password: string) {
  if (isDesktopMode()) {
    return desktopCloudCredentials("login", email, password);
  }
  return loginCloudAccount(email, password);
}

export async function registerMobileCloud(
  email: string,
  password: string,
  acceptedTerms: boolean,
) {
  if (isDesktopMode()) {
    return desktopCloudCredentials(
      "register",
      email,
      password,
      acceptedTerms,
    );
  }
  return registerCloudAccount(email, password, acceptedTerms);
}

export async function logoutMobileCloud() {
  if (isDesktopMode()) {
    const token = getSyncConfig().cloudToken;
    if (token) {
      await fetch(`${PUBLIC_CLOUD_URL}/api/mobile/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
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
    return;
  }
  return logoutCloudAccount();
}

const PUBLIC_CLOUD_URL = "https://rixu-app.pages.dev";

async function desktopCloudCredentials(
  mode: "login" | "register",
  email: string,
  password: string,
  acceptedTerms = true,
) {
  const response = await fetch(`${PUBLIC_CLOUD_URL}/api/mobile/${mode}`, {
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
  return payload.user as AuthUser;
}

async function syncDesktopCloudState(): Promise<SyncResult> {
  const config = getSyncConfig();
  if (!config.cloudToken) throw new Error("请先登录云端账号");
  const local = await request<{ ok: true; state: AppState }>("/api/state");
  const response = await fetch(`${PUBLIC_CLOUD_URL}/api/mobile/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.cloudToken}`,
    },
    body: JSON.stringify({
      state: local.state,
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
  const merged = {
    ...payload.state,
    settings: local.state.settings,
    notificationLog: local.state.notificationLog,
  };
  const imported = await request<{ ok: true; state: AppState }>(
    "/api/backup/import",
    {
      method: "POST",
      body: JSON.stringify({ state: merged }),
    },
  );
  saveSyncConfig({ cloudLastSyncAt: payload.syncedAt });
  return {
    ok: true,
    state: imported.state,
    status: await loadStatus(),
    syncedAt: payload.syncedAt,
    conflictCount: Number(payload.conflictCount) || 0,
  };
}

function feedbackBaseUrl() {
  return isCloudMode() ? "" : PUBLIC_CLOUD_URL;
}

function mobileFeedbackHeaders(): Record<string, string> {
  if (!isMobileMode() && !isDesktopMode()) return {};
  const token = getSyncConfig().cloudToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function submitFeedback(input: {
  category: FeedbackCategory;
  content: string;
  contact: string;
  pagePath: string;
}) {
  return request<{ ok: true; id: string }>(
    `${feedbackBaseUrl()}/api/feedback`,
    {
      method: "POST",
      headers: mobileFeedbackHeaders(),
      body: JSON.stringify(input),
    },
  );
}

export async function getAdminFeedback() {
  return request<{ ok: true; feedback: FeedbackItem[] }>(
    `${feedbackBaseUrl()}/api/feedback/admin`,
    { headers: mobileFeedbackHeaders() },
  );
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
) {
  return request<{ ok: true }>(
    `${feedbackBaseUrl()}/api/feedback/${encodeURIComponent(id)}/status`,
    {
      method: "PUT",
      headers: mobileFeedbackHeaders(),
      body: JSON.stringify({ status }),
    },
  );
}

export async function deleteFeedback(id: string) {
  return request<{ ok: true }>(
    `${feedbackBaseUrl()}/api/feedback/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: mobileFeedbackHeaders(),
    },
  );
}
