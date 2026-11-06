import { useState } from "react";
import {
  Cloud,
  Info,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
} from "lucide-react";
import {
  getMobileCloudAccount,
  isDesktopMode,
  loadStatus,
  loginMobileCloud,
  logoutMobileCloud,
  registerMobileCloud,
  syncNow,
} from "../lib/api";
import type { AppState, AppStatus } from "../types";
import type { ToastState } from "./Toast";

interface CloudAccountPanelProps {
  onStateChange: (state: AppState) => void;
  onStatusChange: (status: AppStatus) => void;
  onNotify: (toast: ToastState) => void;
}

export function CloudAccountPanel({
  onStateChange,
  onStatusChange,
  onNotify,
}: CloudAccountPanelProps) {
  const [account, setAccount] = useState(getMobileCloudAccount);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(account.email);
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const desktopRuntime = isDesktopMode();

  async function syncAccount(message = "手机与云端已同步") {
    const result = await syncNow();
    onStateChange(result.state);
    onStatusChange(result.status);
    setAccount(getMobileCloudAccount());
    onNotify({
      message: result.conflictCount
        ? `${message}，保留 ${result.conflictCount} 个冲突副本`
        : message,
      tone: "success",
    });
  }

  async function authenticate() {
    if (mode === "register" && !acceptedTerms) {
      setError("请先同意隐私政策和使用条款");
      return;
    }
    setBusy("auth");
    setError("");
    try {
      if (mode === "login") {
        await loginMobileCloud(email, password);
      } else {
        await registerMobileCloud(email, password, acceptedTerms);
      }
      setPassword("");
      await syncAccount("云端账号已连接并完成同步");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setBusy("");
    }
  }

  async function manualSync() {
    setBusy("sync");
    setError("");
    try {
      await syncAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "同步失败");
    } finally {
      setBusy("");
    }
  }

  async function signOut() {
    setBusy("logout");
    try {
      await logoutMobileCloud();
      setAccount(getMobileCloudAccount());
      onStatusChange(await loadStatus());
      onNotify({ message: "已退出云端账号，手机数据仍保留", tone: "success" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "退出失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="surface settings-section cloud-account-settings">
      <header className="section-header">
        <div>
          <p className="eyebrow">
            {account.signedIn
              ? "云端账号"
              : desktopRuntime
                ? "本机本地模式"
                : "本机游客模式"}
          </p>
          <h3>
            {account.signedIn
              ? desktopRuntime
                ? "电脑与网站同步"
                : "手机与网站同步"
              : "登录网站账号"}
          </h3>
        </div>
        <Cloud size={20} />
      </header>

      {account.signedIn ? (
        <>
          <div className="account-summary">
            <strong>{account.email}</strong>
            <p>
              {account.lastSyncAt
                ? `上次同步：${new Date(account.lastSyncAt).toLocaleString("zh-CN")}`
                : "尚未完成首次同步"}
            </p>
          </div>
          <div className="cloud-account-actions">
            <button
              type="button"
              className="button button-primary button-small"
              disabled={Boolean(busy)}
              onClick={() => void manualSync()}
            >
              <RefreshCw size={15} />
              {busy === "sync" ? "同步中..." : "立即同步"}
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={Boolean(busy)}
              onClick={() => void signOut()}
            >
              <LogOut size={15} />
              退出账号
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="guest-mode-note">
            {desktopRuntime
              ? "当前数据只保存在这台电脑。登录网站账号后可跨设备同步。"
              : "当前数据只保存在手机本地。登录网站账号后可跨设备同步。"}
          </div>
          <div className="cloud-switcher">
            <button
              type="button"
              className={mode === "login" ? "is-active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === "register" ? "is-active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              注册
            </button>
          </div>
          <div className="sync-form">
            <label className="field">
              <span>邮箱</span>
              <div className="auth-input">
                <Mail size={15} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
            </label>
            <label className="field">
              <span>密码</span>
              <div className="auth-input">
                <KeyRound size={15} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
            </label>
            {mode === "register" && (
              <label className="auth-terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  我已阅读并同意
                  <a href="https://rixu-app.pages.dev/terms.html" target="_blank">
                    使用条款
                  </a>
                  和
                  <a href="https://rixu-app.pages.dev/privacy.html" target="_blank">
                    隐私政策
                  </a>
                </span>
              </label>
            )}
            {error && <p className="form-error">{error}</p>}
            <button
              type="button"
              className="button button-primary"
              disabled={Boolean(busy)}
              onClick={() => void authenticate()}
            >
              <LogIn size={16} />
              {busy === "auth"
                ? "连接中..."
                : mode === "login"
                  ? "登录并同步"
                  : "注册并同步"}
            </button>
          </div>
        </>
      )}

      <div className="info-strip">
        <Info size={15} />
        <span>
          {desktopRuntime
            ? "桌面本地数据会保留。连接云端后，计划与备忘会双向合并。"
            : "手机离线数据会保留。连接云端后，计划与备忘会双向合并。"}
        </span>
      </div>
    </section>
  );
}
