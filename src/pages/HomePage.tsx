import {
  ArrowRight,
  Bell,
  Check,
  Clock3,
  LockKeyhole,
  Plus,
  Timer,
} from "lucide-react";
import { MODULE_META } from "../constants";
import {
  formatDateLong,
  formatDuration,
  nextOccurrence,
  plansForDate,
} from "../lib/date";
import { planSecondaryText } from "../lib/plan";
import { isMobileMode } from "../lib/api";
import type { ModuleKey, PageKey, Plan } from "../types";
import type { PageProps } from "./page-types";
import { EmptyState } from "../components/EmptyState";
import { PlanCard } from "../components/PlanCard";

interface HomePageProps extends PageProps {
  now: Date;
  memoStatus: "saved" | "saving" | "error";
  onMemoChange: (value: string) => void;
  onMemoBlur: (value: string) => void;
  onNavigate: (page: PageKey) => void;
}

const MODULE_ORDER: ModuleKey[] = [
  "learning",
  "fitness",
  "diet",
  "gaming",
];

export function HomePage({
  state,
  status,
  onCreate,
  onEdit,
  now,
  memoStatus,
  onMemoChange,
  onMemoBlur,
  onNavigate,
}: HomePageProps) {
  const todayPlans = plansForDate(state.plans, now);
  const totalMinutes = todayPlans.reduce(
    (sum, plan) => sum + plan.durationMinutes,
    0,
  );
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes(),
  ).padStart(2, "0")}`;
  const nextPlan =
    todayPlans.find((plan) => plan.startTime >= nowTime) || todayPlans[0];

  return (
    <div className="home-page">
      <section className="todo-hero">
        <div>
          <p className="eyebrow">{formatDateLong(now)}</p>
          <h2>今天</h2>
          <p className="intro-copy">
            {todayPlans.length
              ? `已经安排 ${todayPlans.length} 项内容，计划用时 ${formatDuration(
                  totalMinutes,
                )}。`
              : "今天还没有安排，可以从一个清晰的计划开始。"}
          </p>
        </div>
        <div className="todo-hero-stats">
          <div>
            <span>
              <Clock3 size={15} />
              下一项
            </span>
            <strong>{nextPlan ? nextPlan.startTime : "--:--"}</strong>
            <small>{nextPlan ? nextPlan.title : "暂时空着"}</small>
          </div>
          <div>
            <span>
              <Timer size={15} />
              计划投入
            </span>
            <strong>{formatDuration(totalMinutes)}</strong>
            <small>{todayPlans.length} 项安排</small>
          </div>
          <div className="hero-local-status">
            <span>
              <Bell size={15} />
              本地提醒
            </span>
            <strong>{status?.reminders.running ? "运行中" : "未连接"}</strong>
            <small>
              {isMobileMode() ? "Android 系统调度" : "后台持续运行"}
            </small>
          </div>
        </div>
      </section>

      <div className="home-main-grid">
        <section className="timeline-surface is-todo-surface">
          <header className="section-header">
            <div>
              <p className="eyebrow">今日清单</p>
              <h3>按时间排好的安排</h3>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate("today")}
            >
              查看全部
              <ArrowRight size={15} />
            </button>
          </header>

          {todayPlans.length > 0 ? (
            <div className="timeline-list">
              {todayPlans.map((plan, index) => (
                <div className="timeline-entry" key={plan.id}>
                  <div className="timeline-time">
                    <strong>{plan.startTime}</strong>
                    <span>{plan.durationMinutes || 0} 分</span>
                  </div>
                  <div className="timeline-rail">
                    <span
                      className={`timeline-dot tone-${MODULE_META[plan.module].tone}`}
                    />
                    {index < todayPlans.length - 1 && <i />}
                  </div>
                  <PlanCard
                    plan={plan}
                    onEdit={onEdit}
                    compact
                    showTime={false}
                    flat
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Clock3}
              title="今天还没有计划"
              description="从学习、健身、饮食或娱乐模块添加第一项安排。"
              actionLabel="添加计划"
              onAction={() => onCreate("learning")}
            />
          )}
        </section>

        <aside className="todo-side-rail">
        <section className="memo-surface is-todo-memo">
          <header className="section-header">
            <div>
              <p className="eyebrow">快速备忘</p>
              <h3>先记下来</h3>
            </div>
            <span className={`save-state save-${memoStatus}`}>
              {memoStatus === "saved" ? (
                <>
                  <Check size={13} /> 已保存
                </>
              ) : memoStatus === "saving" ? (
                "保存中..."
              ) : (
                "保存失败"
              )}
            </span>
          </header>
          <textarea
            className="memo-editor"
            value={state.quickMemo}
            onChange={(event) => onMemoChange(event.target.value)}
            onBlur={(event) => onMemoBlur(event.target.value)}
            placeholder={"临时想法、要买的东西、下班前要处理的事……\n\n这里的内容会自动保存在本机。"}
            aria-label="快速备忘"
          />
          <footer className="memo-footer">
            <LockKeyhole size={13} />
            仅保存在本机
          </footer>
        </section>
          <section className="quick-module-panel">
            <header>
              <span className="eyebrow">快速添加</span>
            </header>
            <div className="quick-module-grid">
              {MODULE_ORDER.map((module) => {
                const meta = MODULE_META[module];
                const Icon = meta.icon;
                return (
                  <button
                    type="button"
                    key={module}
                    className={`tone-${meta.tone}`}
                    onClick={() => onCreate(module)}
                  >
                    <Icon size={15} />
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <section className="summary-section">
        <header className="section-header summary-header">
          <div>
            <p className="eyebrow">模块摘要</p>
            <h3>一周里的重要安排</h3>
          </div>
        </header>
        <div className="module-summary-grid">
          {MODULE_ORDER.map((module) => {
            const meta = MODULE_META[module];
            const Icon = meta.icon;
            const moduleToday = todayPlans.filter(
              (plan) => plan.module === module,
            );
            const upcoming = state.plans
              .filter((plan) => plan.module === module)
              .map((plan) => ({
                plan,
                date: nextOccurrence(plan, now),
              }))
              .filter(
                (entry): entry is { plan: Plan; date: Date } =>
                  entry.date !== null,
              )
              .sort(
                (a, b) =>
                  a.date.getTime() - b.date.getTime() ||
                  a.plan.startTime.localeCompare(b.plan.startTime),
              )[0];

            return (
              <article
                className={`summary-card tone-${meta.tone}`}
                key={module}
              >
                <header>
                  <span className="summary-icon">
                    <Icon size={19} />
                  </span>
                  <div>
                    <strong>{meta.label}</strong>
                    <small>
                      今天 {moduleToday.length} 项 · 共 {state.plans.filter(
                        (plan) => plan.module === module,
                      ).length}{" "}
                      项
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button icon-button-small"
                    onClick={() => onCreate(module)}
                    title={`添加${meta.label}`}
                    aria-label={`添加${meta.label}`}
                  >
                    <Plus size={16} />
                  </button>
                </header>

                {moduleToday.length > 0 ? (
                  <div className="summary-current">
                    <span>{moduleToday[0].startTime}</span>
                    <strong>{moduleToday[0].title}</strong>
                    <small>{planSecondaryText(moduleToday[0])}</small>
                  </div>
                ) : upcoming ? (
                  <div className="summary-current is-future">
                    <span>
                      {upcoming.date.getMonth() + 1}/
                      {upcoming.date.getDate()} · {upcoming.plan.startTime}
                    </span>
                    <strong>{upcoming.plan.title}</strong>
                    <small>{planSecondaryText(upcoming.plan)}</small>
                  </div>
                ) : (
                  <div className="summary-current is-empty">
                    <strong>暂时没有安排</strong>
                    <small>{meta.description}</small>
                  </div>
                )}

                <button
                  type="button"
                  className="summary-link"
                  onClick={() => onNavigate(meta.page)}
                >
                  打开{meta.shortLabel}
                  <ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
