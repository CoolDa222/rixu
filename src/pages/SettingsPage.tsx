import { useRef, useState, type ChangeEvent } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Download,
  HardDrive,
  Info,
  LogOut,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  exportBackup,
  exitWebGuestMode,
  importBackup,
  isMobileMode,
  isCloudMode,
  isDesktopMode,
  isWebGuestMode,
  loadStatus,
  resetData,
  saveSettings,
  testNotification,
} from "../lib/api";
import type { AppState, AppStatus, AuthUser } from "../types";
import type { ToastState } from "../components/Toast";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Toggle } from "../components/Toggle";
import { CloudAccountPanel } from "../components/CloudAccountPanel";

interface SettingsPageProps {
  state: AppState;
  status: AppStatus | null;
  user: AuthUser | null;
  onLogout: () => void;
  onStateChange: (state: AppState) => void;
  onStatusChange: (status: AppStatus) => void;
  onNotify: (toast: ToastState) => void;
}

export function SettingsPage({
  state,
  status,
  user,
  onLogout,
  onStateChange,
  onStatusChange,
  onNotify,
}: SettingsPageProps) {
  const [busy, setBusy] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const mobile = isMobileMode();
  const cloudMode = isCloudMode();
  const desktopMode = isDesktopMode();
  const guestMode = isWebGuestMode();

  async function updateSettings(patch: {
    notificationsEnabled?: boolean;
    autoStart?: boolean;
  }) {
    setBusy(patch.autoStart !== undefined ? "autoStart" : "notifications");
    try {
      const result = await saveSettings(patch);
      onStateChange(result.state);
      onStatusChange(result.status);
      onNotify({ message: "设置已更新", tone: "success" });
    } catch (error) {
      onNotify({
        message: error instanceof Error ? error.message : "设置更新失败",
        tone: "error",
      });
    } finally {
      setBusy("");
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      await testNotification();
      onNotify({ message: "测试通知已发送", tone: "success" });
    } catch (error) {
      onNotify({
        message: error instanceof Error ? error.message : "通知发送失败",
        tone: "error",
      });
    } finally {
      setBusy("");
    }
  }

  async function handleExport() {
    setBusy("export");
    try {
      await exportBackup();
      onNotify({ message: "备份文件已导出", tone: "success" });
    } catch (error) {
      onNotify({
        message: error instanceof Error ? error.message : "导出备份失败",
        tone: "error",
      });
    } finally {
      setBusy("");
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importBackup(parsed);
      onStateChange(result.state);
      try {
        onStatusChange(await loadStatus());
      } catch {
        // Import succeeded even if status refresh is temporarily unavailable.
      }
      onNotify({ message: "备份已导入", tone: "success" });
    } catch (error) {
      onNotify({
        message: error instanceof Error ? error.message : "备份导入失败",
        tone: "error",
      });
    } finally {
      setBusy("");
      event.target.value = "";
    }
  }

  async function handleReset() {
    setBusy("reset");
    try {
      const result = await resetData();
      onStateChange(result.state);
      try {
        onStatusChange(await loadStatus());
      } catch {
        // Reset succeeded even if status refresh is temporarily unavailable.
      }
      setConfirmReset(false);
      onNotify({ message: "本地数据已清空", tone: "success" });
    } catch (error) {
      onNotify({
        message: error instanceof Error ? error.message : "清空数据失败",
        tone: "error",
      });
    } finally {
      setBusy("");
    }
  }

  async function copyDataPath() {
    if (!status?.dataFile) return;
    try {
      await navigator.clipboard.writeText(status.dataFile);
      onNotify({ message: "数据路径已复制", tone: "success" });
    } catch {
      onNotify({ message: "复制失败，请手动选择路径", tone: "error" });
    }
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      onNotify({ message, tone: "success" });
    } catch {
      onNotify({ message: "复制失败，请手动选择", tone: "error" });
    }
  }

  const lastCheck = status?.reminders.lastCheckAt
    ? new Date(status.reminders.lastCheckAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "等待首次检查";

  return (
    <div className="settings-page">
      <section className="settings-status-band">
        <div className="status-beacon">
          <span
            className={`${status?.reminders.running ? "is-running" : ""} ${
              guestMode ? "is-guest" : ""
            }`}
          >
            {guestMode ? (
              <ShieldCheck size={24} />
            ) : status?.reminders.running ? (
              <CheckCircle2 size={24} />
            ) : (
              <XCircle size={24} />
            )}
          </span>
        </div>
        <div>
          <p className="eyebrow">{guestMode ? "游客模式" : "本地后台"}</p>
          <h2>
            {guestMode
              ? "浏览器游客模式"
              : cloudMode
              ? "云端账号已连接"
              : mobile
              ? status?.reminders.running
                ? "Android 本地提醒已启用"
                : "需要通知权限"
              : status?.reminders.running
                ? "提醒服务运行中"
                : "提醒服务未连接"}
          </h2>
          <p>
            {guestMode
              ? "无需账号即可使用，数据只保存在当前浏览器；清除浏览器数据会删除全部内容。"
              : cloudMode
              ? "你的计划与备忘保存在云端数据库，并按账号完全隔离。"
              : mobile
              ? "提醒由 Android 系统调度，即使完全关闭日序，也会按时通知。"
              : "关闭浏览器后，后台进程仍会检查计划并发送 Windows 系统通知。"}
          </p>
        </div>
        <dl className="status-facts">
          <div>
            <dt>
              <Power size={14} />
              {guestMode
                ? "存储方式"
                : cloudMode
                  ? "运行方式"
                  : mobile
                    ? "运行方式"
                    : "开机启动"}
            </dt>
            <dd>
              {guestMode
                ? "浏览器本地"
                : cloudMode
                ? "Cloudflare 云端"
                : mobile
                ? "离线 + 系统通知"
                : status?.autoStartSupported
                  ? status.autoStart
                    ? "已启用"
                    : "未启用"
                  : "当前系统不支持"}
            </dd>
          </div>
          <div>
            <dt>
              <Clock3 size={14} />
              {guestMode
                ? "数据范围"
                : cloudMode
                  ? "保存方式"
                  : mobile
                    ? "同步时间"
                    : "最近检查"}
            </dt>
            <dd>
              {guestMode
                ? "当前设备"
                : cloudMode
                ? "自动保存"
                : mobile
                ? status?.sync.lastSyncAt
                  ? new Date(status.sync.lastSyncAt).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "尚未同步"
                : lastCheck}
            </dd>
          </div>
          <div>
            <dt>
              <Database size={14} />
              {guestMode
                ? "账号"
                : cloudMode
                  ? "账号"
                  : mobile
                    ? "数据位置"
                    : "本地接口"}
            </dt>
            <dd>
              {guestMode
                ? "游客"
                : cloudMode
                ? user?.email || "当前账号"
                : mobile
                  ? "手机应用内"
                  : `127.0.0.1:${status?.port || 4318}`}
            </dd>
          </div>
        </dl>
      </section>

      <div className="settings-grid">
        {desktopMode && (
          <CloudAccountPanel
            onStateChange={onStateChange}
            onStatusChange={onStatusChange}
            onNotify={onNotify}
          />
        )}
        <section className="surface settings-section">
          <header className="section-header">
            <div>
              <p className="eyebrow">提醒</p>
              <h3>系统通知</h3>
            </div>
            <Bell size={20} />
          </header>
          {cloudMode ? (
            <div className="info-strip">
              <Info size={15} />
              <span>
                网页版第一版暂不提供关闭浏览器后的提醒，Web Push 会在下一阶段接入。
              </span>
            </div>
          ) : guestMode ? (
            <div className="info-strip">
              <Info size={15} />
              <span>
                游客模式只保存在当前浏览器。系统通知仅在页面打开且授权后可用。
              </span>
            </div>
          ) : (
            <>
              <div className="setting-row">
                <div>
                  <strong>启用计划提醒</strong>
                  <p>
                    {mobile
                      ? "由 Android 系统本地调度，不依赖日序保持打开。"
                      : "到达计划开始时间时发送系统通知。"}
                  </p>
                </div>
                <Toggle
                  checked={state.settings.notificationsEnabled}
                  disabled={busy === "notifications"}
                  onChange={(checked) =>
                    void updateSettings({ notificationsEnabled: checked })
                  }
                  label="启用计划提醒"
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>发送测试通知</strong>
                  <p>
                    {mobile
                      ? "确认 Android 通知权限和通知渠道工作正常。"
                      : "确认 Windows 通知没有被系统设置关闭。"}
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-small"
                  disabled={busy === "test"}
                  onClick={() => void sendTest()}
                >
                  {busy === "test" ? "发送中..." : "测试通知"}
                </button>
              </div>
              <div className="info-strip">
                <Info size={15} />
                <span>
                  {mobile
                    ? "如果 Android 系统关闭了日序通知权限，到点提醒不会显示。"
                    : "电脑关机期间无法提醒，开机后不会补发已错过的通知。"}
                </span>
              </div>
            </>
          )}
        </section>

        {cloudMode ? (
          <section className="surface settings-section account-settings">
            <header className="section-header">
              <div>
                <p className="eyebrow">账号</p>
                <h3>当前登录</h3>
              </div>
              <ShieldCheck size={20} />
            </header>
            <div className="account-summary">
              <strong>{user?.email}</strong>
              <p>账号数据独立保存，其他用户无法访问。</p>
            </div>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={onLogout}
            >
              <LogOut size={15} />
              退出登录
            </button>
          </section>
        ) : mobile ? (
          <CloudAccountPanel
            onStateChange={onStateChange}
            onStatusChange={onStatusChange}
            onNotify={onNotify}
          />
        ) : guestMode ? (
          <section className="surface settings-section account-settings">
            <header className="section-header">
              <div>
                <p className="eyebrow">游客模式</p>
                <h3>当前设备本地使用</h3>
              </div>
              <ShieldCheck size={20} />
            </header>
            <div className="account-summary">
              <strong>无需账号</strong>
              <p>计划与备忘只保存在当前浏览器，不会上传到云端。</p>
            </div>
            <div className="info-strip">
              <Info size={15} />
              <span>
                如需登录账号，请先导出游客数据；登录后可再导入账号。
              </span>
            </div>
            <button
              type="button"
              className="button button-primary button-small"
              onClick={() => {
                exitWebGuestMode();
                window.location.reload();
              }}
            >
              <LogOut size={15} />
              退出游客模式并登录
            </button>
          </section>
        ) : (
          <>
            <section className="surface settings-section">
              <header className="section-header">
                <div>
                  <p className="eyebrow">启动</p>
                  <h3>开机自动运行</h3>
                </div>
                <Power size={20} />
              </header>
              <div className="setting-row">
                <div>
                  <strong>随 Windows 启动后台服务</strong>
                  <p>
                    登录当前电脑后自动启动提醒服务，不会主动打开浏览器。
                  </p>
                </div>
                <Toggle
                  checked={status?.autoStart || false}
                  disabled={
                    busy === "autoStart" || !status?.autoStartSupported
                  }
                  onChange={(checked) =>
                    void updateSettings({ autoStart: checked })
                  }
                  label="开机自动运行"
                />
              </div>
              <div className="info-strip">
                <Info size={15} />
                <span>
                  该设置写入当前 Windows 用户的自启动项，不需要管理员权限。
                </span>
              </div>
            </section>
            <section className="surface settings-section sync-settings">
              <header className="section-header">
                <div>
                  <p className="eyebrow">局域网同步</p>
                  <h3>手机连接信息</h3>
                </div>
                <RefreshCw size={20} />
              </header>
              <div className="pairing-card">
                <span>同步地址</span>
                <strong>
                  {status?.sync.serverUrl || "未检测到局域网地址"}
                </strong>
                {status?.sync.serverUrl && (
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    title="复制同步地址"
                    aria-label="复制同步地址"
                    onClick={() =>
                      void copyText(status.sync.serverUrl, "同步地址已复制")
                    }
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
              <div className="pairing-card">
                <span>配对码</span>
                <strong className="pairing-token">
                  {status?.sync.token || "------"}
                </strong>
                {status?.sync.token && (
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    title="复制配对码"
                    aria-label="复制配对码"
                    onClick={() =>
                      void copyText(status.sync.token, "配对码已复制")
                    }
                  >
                    <Copy size={14} />
                  </button>
                )}
              </div>
              <div className="info-strip">
                <Info size={15} />
                <span>
                  手机与电脑需在同一 Wi‑Fi。只允许持有配对码的设备读取同步数据。
                </span>
              </div>
            </section>
          </>
        )}

        <section className="surface settings-section settings-storage">
          <header className="section-header">
            <div>
              <p className="eyebrow">本地数据</p>
              <h3>备份与恢复</h3>
            </div>
            <HardDrive size={20} />
          </header>
          <dl className="data-facts">
            <div>
              <dt>计划数量</dt>
              <dd>{state.plans.length} 项</dd>
            </div>
            <div>
              <dt>快速备忘</dt>
              <dd>{state.quickMemo.length} 字</dd>
            </div>
            <div>
              <dt>最后保存</dt>
              <dd>
                {new Date(state.updatedAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </dd>
            </div>
          </dl>
          <div className="data-path">
            <span>{status?.dataFile || "正在读取数据路径..."}</span>
            {!mobile && !cloudMode && (
              <button
                type="button"
                className="icon-button icon-button-small"
                title="复制数据路径"
                aria-label="复制数据路径"
                onClick={() => void copyDataPath()}
              >
                <Copy size={14} />
              </button>
            )}
          </div>
          <div className="data-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={busy === "export"}
              onClick={() => void handleExport()}
            >
              <Download size={15} />
              {busy === "export" ? "导出中..." : "导出备份"}
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={busy === "import"}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={15} />
              {busy === "import" ? "导入中..." : "导入备份"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => void handleImport(event)}
            />
          </div>
        </section>

        <section className="surface settings-section settings-danger">
          <header className="section-header">
            <div>
              <p className="eyebrow">危险操作</p>
              <h3>清空本机数据</h3>
            </div>
            <RotateCcw size={20} />
          </header>
          <p>
            删除所有计划、快速备忘、通知记录和设置。执行前建议先导出一份备份。
          </p>
          <button
            type="button"
            className="button button-danger-ghost"
            onClick={() => setConfirmReset(true)}
          >
            <RefreshCw size={15} />
            清空全部数据
          </button>
        </section>
      </div>

      <section className="privacy-footer">
        <ShieldCheck size={18} />
        <div>
          <strong>不联网、不登录、不上传</strong>
          <p>
            {mobile
              ? "手机数据始终保持在本机。只有点击同步时，才会通过同一 Wi‑Fi 与电脑交换数据。"
              : "日序使用本机回环地址连接浏览器与后台服务；手机同步仅在同一 Wi‑Fi 内进行。"}
          </p>
        </div>
      </section>

      {confirmReset && (
        <ConfirmDialog
          title="清空全部本地数据？"
          description="所有计划、快速备忘和提醒记录都会被永久删除，同时会关闭开机自启动。该操作不能撤销。"
          confirmLabel="确认清空"
          danger
          busy={busy === "reset"}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => void handleReset()}
        />
      )}
    </div>
  );
}
