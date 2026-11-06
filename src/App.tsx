import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { PAGE_TITLES } from "./constants";
import {
  ApiError,
  createPlan,
  enterWebGuestMode,
  getSession,
  getMobileCloudAccount,
  getSyncSettings,
  isCloudMode,
  isDesktopMode,
  isMobileMode,
  loadState,
  loadStatus,
  logout,
  removePlan,
  saveMemo,
  syncNow,
  updatePlan,
} from "./lib/api";
import type {
  AppState,
  AppStatus,
  AuthUser,
  ModuleKey,
  PageKey,
  Plan,
  PlanDraft,
  PlanPreset,
} from "./types";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { PlanForm } from "./components/PlanForm";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Toast, type ToastState } from "./components/Toast";
import { HomePage } from "./pages/HomePage";
import { TodayPage } from "./pages/TodayPage";
import { CalendarPage } from "./pages/CalendarPage";
import { LearningPage } from "./pages/LearningPage";
import { FitnessPage } from "./pages/FitnessPage";
import { DietPage } from "./pages/DietPage";
import { GamingPage } from "./pages/GamingPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AuthPage } from "./pages/AuthPage";

type PlanFormState =
  | {
      mode: "create";
      module: ModuleKey;
      preset?: PlanPreset;
    }
  | {
      mode: "edit";
      plan: Plan;
    };

function readPage(): PageKey {
  const hash = window.location.hash.replace("#/", "").replace("#", "");
  const valid: PageKey[] = [
    "home",
    "today",
    "calendar",
    "learning",
    "fitness",
    "diet",
    "gaming",
    "feedback",
    "settings",
  ];
  return valid.includes(hash as PageKey) ? (hash as PageKey) : "home";
}

export default function App() {
  const [page, setPage] = useState<PageKey>(readPage);
  const [state, setState] = useState<AppState | null>(null);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(new Date());
  const [planForm, setPlanForm] = useState<PlanFormState | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [memoStatus, setMemoStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const memoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoDirtyRef = useRef(false);
  const memoValueRef = useRef("");
  const memoVersionRef = useRef(0);

  async function refreshAll(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    }
    setLoadError("");
    try {
      if (isCloudMode()) {
        try {
          const session = await getSession();
          setUser(session.user);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            setUser(null);
            setState(null);
            setLoading(false);
            return;
          }
          throw error;
        }
      }
      const [stateResult, statusResult] = await Promise.all([
        loadState(),
        loadStatus(),
      ]);
      setState(stateResult.state);
      setStatus(statusResult);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "本地服务连接失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setState(null);
      setStatus(null);
      setPlanForm(null);
      setPage("home");
      window.location.hash = "/home";
    }
  }

  useEffect(() => {
    void refreshAll(true);
    const clock = setInterval(() => setNow(new Date()), 1000);
    const statusTimer = setInterval(async () => {
      try {
        setStatus(await loadStatus());
        if (!isMobileMode()) {
          const latest = await loadState();
          setState((current) =>
            memoDirtyRef.current && current
              ? { ...latest.state, quickMemo: current.quickMemo }
              : latest.state,
          );
        }
      } catch {
        setStatus(null);
      }
    }, 30_000);
    return () => {
      clearInterval(clock);
      clearInterval(statusTimer);
      if (memoTimer.current) {
        clearTimeout(memoTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const mobileRuntime = isMobileMode();
    if (!mobileRuntime && !isDesktopMode()) return;
    let disposed = false;
    let removeListener: (() => Promise<void>) | undefined;
    let autoSyncTimer: ReturnType<typeof setTimeout> | undefined;

    const autoSync = () => {
      const sync = getSyncSettings();
      if (!sync.cloudToken && (!sync.serverUrl || !sync.token)) {
        return;
      }
      void syncNow()
        .then((result) => {
          if (!disposed) {
            setState(result.state);
            setStatus(result.status);
            if (result.conflictCount) {
              setToast({
                message: `已同步，产生 ${result.conflictCount} 个冲突副本`,
                tone: "success",
              });
            }
          }
        })
        .catch(() => {
          // The phone remains fully usable with its offline copy.
        });
    };

    if (mobileRuntime) {
      void import("@capacitor/app")
        .then(async ({ App }) => {
          const listener = await App.addListener(
            "appStateChange",
            ({ isActive }) => {
              if (!isActive || disposed) return;
              void refreshAll(false);
              autoSync();
            },
          );
          if (disposed) {
            await listener.remove();
          } else {
            removeListener = () => listener.remove();
          }
        })
        .catch(() => {});
    }

    autoSyncTimer = setTimeout(autoSync, 1200);

    return () => {
      disposed = true;
      if (autoSyncTimer) clearTimeout(autoSyncTimer);
      void removeListener?.();
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => setPage(readPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    memoValueRef.current = state?.quickMemo || "";
  }, [state?.quickMemo]);

  useEffect(() => {
    const flushMemo = () => {
      if (!memoDirtyRef.current) {
        return;
      }
      void fetch("/api/memo", {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickMemo: memoValueRef.current }),
      });
    };
    window.addEventListener("beforeunload", flushMemo);
    return () => window.removeEventListener("beforeunload", flushMemo);
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(nextPage: PageKey) {
    window.location.hash = `/${nextPage}`;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCreate(module: ModuleKey = "learning", preset?: PlanPreset) {
    setPlanForm({ mode: "create", module, preset });
  }

  function openEdit(plan: Plan) {
    setPlanForm({ mode: "edit", plan });
  }

  async function handleSavePlan(draft: PlanDraft) {
    setSavingPlan(true);
    try {
      const result =
        planForm?.mode === "edit"
          ? await updatePlan(planForm.plan.id, draft)
          : await createPlan(draft);
      setState((current) =>
        memoDirtyRef.current && current
          ? { ...result.state, quickMemo: current.quickMemo }
          : result.state,
      );
      setPlanForm(null);
      setToast({
        message: planForm?.mode === "edit" ? "计划已更新" : "计划已创建",
        tone: "success",
      });
      try {
        setStatus(await loadStatus());
      } catch {
        // The saved data is still valid when the status refresh fails.
      }
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "保存计划失败",
        tone: "error",
      });
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeletePlan() {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      const result = await removePlan(deleteTarget.id);
      setState((current) =>
        memoDirtyRef.current && current
          ? { ...result.state, quickMemo: current.quickMemo }
          : result.state,
      );
      setDeleteTarget(null);
      setPlanForm(null);
      setToast({ message: "计划已删除", tone: "success" });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "删除计划失败",
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  function handleMemoChange(value: string) {
    const version = ++memoVersionRef.current;
    memoValueRef.current = value;
    memoDirtyRef.current = true;
    setState((current) =>
      current ? { ...current, quickMemo: value } : current,
    );
    setMemoStatus("saving");
    if (memoTimer.current) {
      clearTimeout(memoTimer.current);
    }
    memoTimer.current = setTimeout(async () => {
      try {
        await saveMemo(value);
        if (memoVersionRef.current === version) {
          memoDirtyRef.current = false;
          setMemoStatus("saved");
        }
      } catch {
        if (memoVersionRef.current === version) {
          setMemoStatus("error");
        }
      }
    }, 650);
  }

  async function handleMemoBlur(value: string) {
    if (!memoDirtyRef.current) {
      return;
    }
    const version = ++memoVersionRef.current;
    memoValueRef.current = value;
    if (memoTimer.current) {
      clearTimeout(memoTimer.current);
    }
    setMemoStatus("saving");
    try {
      await saveMemo(value);
      if (memoVersionRef.current === version) {
        memoDirtyRef.current = false;
        setMemoStatus("saved");
      }
    } catch {
      if (memoVersionRef.current === version) {
        setMemoStatus("error");
      }
    }
  }

  if (loading) {
    return (
      <div className="app-loading">
        <span className="loading-mark">
          <img src="/app-icon.png" alt="" />
        </span>
        <div>
          <strong>正在打开日序</strong>
          <p>连接本地数据与提醒服务...</p>
        </div>
      </div>
    );
  }

  if (isCloudMode() && !user) {
    return (
      <AuthPage
        onGuest={() => {
          enterWebGuestMode();
          window.location.reload();
        }}
        onAuthenticated={(authenticatedUser, authenticatedState) => {
          setUser(authenticatedUser);
          setState(authenticatedState);
          setLoading(false);
          void refreshAll(false);
        }}
      />
    );
  }

  if (loadError || !state) {
    return (
      <div className="app-error">
        <span>
          <AlertCircle size={28} />
        </span>
        <h1>无法连接本地服务</h1>
        <p>{loadError || "请确认本地后台已经启动。"}</p>
        <code>npm start</code>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void refreshAll(true)}
        >
          <RefreshCw size={16} />
          重新连接
        </button>
      </div>
    );
  }

  const commonPageProps = {
    state,
    status,
    onCreate: openCreate,
    onEdit: openEdit,
  };

  return (
    <div className="app-shell">
      <Sidebar activePage={page} status={status} onNavigate={navigate} />
      <main className="main-area">
        <Topbar
          page={page}
          now={now}
          status={status}
          onAdd={() => openCreate("learning")}
        />
        <div className="page-content" key={page}>
          {page === "home" && (
            <HomePage
              {...commonPageProps}
              now={now}
              memoStatus={memoStatus}
              onMemoChange={handleMemoChange}
              onMemoBlur={(value) => void handleMemoBlur(value)}
              onNavigate={navigate}
            />
          )}
          {page === "today" && <TodayPage {...commonPageProps} now={now} />}
          {page === "calendar" && (
            <CalendarPage {...commonPageProps} now={now} />
          )}
          {page === "learning" && <LearningPage {...commonPageProps} />}
          {page === "fitness" && <FitnessPage {...commonPageProps} />}
          {page === "diet" && <DietPage {...commonPageProps} />}
          {page === "gaming" && <GamingPage {...commonPageProps} />}
          {page === "feedback" && (
            <FeedbackPage
              userEmail={
                user?.email ||
                (isMobileMode() ? getMobileCloudAccount().email : null)
              }
            />
          )}
          {page === "settings" && (
            <SettingsPage
              state={state}
              status={status}
              user={user}
              onLogout={() => void handleLogout()}
              onStateChange={setState}
              onStatusChange={setStatus}
              onNotify={setToast}
            />
          )}
        </div>
        <footer className="app-footer">
          <span>{PAGE_TITLES[page].title}</span>
          <span>日序 · 本地模式</span>
        </footer>
      </main>

      {planForm && (
        <PlanForm
          initial={planForm.mode === "edit" ? planForm.plan : null}
          initialModule={
            planForm.mode === "create" ? planForm.module : undefined
          }
          preset={planForm.mode === "create" ? planForm.preset : undefined}
          saving={savingPlan}
          onClose={() => {
            if (!savingPlan) setPlanForm(null);
          }}
          onSave={(draft) => void handleSavePlan(draft)}
          onDelete={(plan) => {
            setPlanForm(null);
            setDeleteTarget(plan);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除这项计划？"
          description={`“${deleteTarget.title}”将从计划表和相关提醒中移除，此操作不能撤销。`}
          confirmLabel="确认删除"
          danger
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeletePlan()}
        />
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
