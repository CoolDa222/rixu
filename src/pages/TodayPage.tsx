import { CalendarDays, Clock3, ListFilter } from "lucide-react";
import { useState } from "react";
import { MODULE_META } from "../constants";
import {
  formatDateLong,
  formatDuration,
  getPeriodLabel,
  plansForDate,
} from "../lib/date";
import type { ModuleKey } from "../types";
import { EmptyState } from "../components/EmptyState";
import { PlanCard } from "../components/PlanCard";
import type { PageProps } from "./page-types";

interface TodayPageProps extends PageProps {
  now: Date;
}

const MODULE_ORDER: ModuleKey[] = [
  "learning",
  "fitness",
  "diet",
  "gaming",
];

export function TodayPage({ state, onCreate, onEdit, now }: TodayPageProps) {
  const [filter, setFilter] = useState<ModuleKey | "all">("all");
  const allPlans = plansForDate(state.plans, now);
  const plans =
    filter === "all"
      ? allPlans
      : allPlans.filter((plan) => plan.module === filter);
  const totalMinutes = plans.reduce(
    (sum, plan) => sum + plan.durationMinutes,
    0,
  );
  const periods = ["上午", "下午", "晚上"];

  return (
    <div className="today-page">
      <section className="page-lead">
        <div>
          <p className="eyebrow">{formatDateLong(now)}</p>
          <h2>今天的总安排</h2>
          <p>
            {allPlans.length
              ? `共 ${allPlans.length} 项，计划用时 ${formatDuration(totalMinutes)}。`
              : "四个模块今天都没有安排。"}
          </p>
        </div>
        <div className="lead-metric">
          <CalendarDays size={20} />
          <span>自动汇总</span>
          <strong>{allPlans.length}</strong>
          <small>项计划</small>
        </div>
      </section>

      <div className="filter-row">
        <span className="filter-label">
          <ListFilter size={15} />
          筛选
        </span>
        <button
          type="button"
          className={`filter-chip ${filter === "all" ? "is-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          全部
          <span>{allPlans.length}</span>
        </button>
        {MODULE_ORDER.map((module) => {
          const meta = MODULE_META[module];
          const count = allPlans.filter(
            (plan) => plan.module === module,
          ).length;
          return (
            <button
              type="button"
              key={module}
              className={`filter-chip tone-${meta.tone} ${
                filter === module ? "is-active" : ""
              }`}
              onClick={() => setFilter(module)}
            >
              <i />
              {meta.shortLabel}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="today-layout">
        <section className="surface today-timeline">
          {plans.length ? (
            periods.map((period) => {
              const periodPlans = plans.filter(
                (plan) => getPeriodLabel(plan.startTime) === period,
              );
              if (!periodPlans.length) return null;
              return (
                <div className="period-group" key={period}>
                  <header>
                    <span>{period}</span>
                    <small>{periodPlans.length} 项</small>
                  </header>
                  <div className="period-plans">
                    {periodPlans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        onEdit={onEdit}
                        showModule
                      />
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={Clock3}
              title={filter === "all" ? "今天还没有安排" : "这个模块今天没有安排"}
              description="添加计划后，会自动出现在今日计划和首页。"
              actionLabel="添加计划"
              onAction={() =>
                onCreate(filter === "all" ? "learning" : filter)
              }
            />
          )}
        </section>

        <aside className="today-side">
          <section className="surface composition-panel">
            <p className="eyebrow">今日构成</p>
            <h3>{formatDuration(totalMinutes)}</h3>
            <p className="muted-copy">预计投入时间</p>
            <div className="composition-list">
              {MODULE_ORDER.map((module) => {
                const meta = MODULE_META[module];
                const modulePlans = allPlans.filter(
                  (plan) => plan.module === module,
                );
                const minutes = modulePlans.reduce(
                  (sum, plan) => sum + plan.durationMinutes,
                  0,
                );
                const width = totalMinutes
                  ? Math.max(5, (minutes / totalMinutes) * 100)
                  : 0;
                return (
                  <div key={module}>
                    <span>
                      <i className={`tone-dot tone-${meta.tone}`} />
                      {meta.shortLabel}
                    </span>
                    <strong>{minutes ? `${minutes} 分` : "未安排"}</strong>
                    <div className="composition-track">
                      <i
                        className={`tone-fill tone-${meta.tone}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="local-note">
            <strong>今日计划只做汇总</strong>
            <p>
              这里不会产生额外任务。修改任一计划后，各模块、首页和提醒会同步更新。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
