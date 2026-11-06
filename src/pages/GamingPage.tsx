import { Clock3, Gamepad2, Plus, Sparkles, Timer } from "lucide-react";
import { useState } from "react";
import {
  dateKey,
  formatDuration,
  formatShortDate,
  getWeekDates,
  plansForDate,
} from "../lib/date";
import type { GamingDetails } from "../types";
import { WeekToolbar } from "../components/WeekToolbar";
import type { PageProps } from "./page-types";

export function GamingPage({ state, onCreate, onEdit }: PageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchor);
  const weekSessions = weekDates.flatMap((day) =>
    plansForDate(state.plans, day.date)
      .filter((plan) => plan.module === "gaming")
      .map((plan) => ({ plan, date: day.date, day: day.label })),
  );
  const totalMinutes = weekSessions.reduce(
    (sum, session) => sum + session.plan.durationMinutes,
    0,
  );

  return (
    <div className="module-page gaming-page">
      <section className="module-lead tone-amber">
        <div className="module-lead-icon">
          <Gamepad2 size={25} />
        </div>
        <div>
          <p className="eyebrow">娱乐时段</p>
          <h2>认真安排，也认真放松</h2>
          <p>
            {weekSessions.length
              ? `本周计划娱乐 ${weekSessions.length} 次，预计 ${formatDuration(
                  totalMinutes,
                )}。`
              : "本周还没有娱乐安排，给休息留一个明确的时间。"}
          </p>
        </div>
        <div className="module-lead-stats">
          <span>
            <Sparkles size={15} />
            {weekSessions.length} 次娱乐
          </span>
          <span>
            <Timer size={15} />
            {formatDuration(totalMinutes)}
          </span>
        </div>
      </section>

      <WeekToolbar weekOffset={weekOffset} onChange={setWeekOffset} />

      <section className="gaming-week">
        {weekDates.map((day) => {
          const plans = plansForDate(state.plans, day.date).filter(
            (plan) => plan.module === "gaming",
          );
          const isToday = dateKey(day.date) === dateKey();
          return (
            <article
              className={`gaming-day ${isToday ? "is-today" : ""} ${
                plans.length ? "has-plan" : ""
              }`}
              key={dateKey(day.date)}
            >
              <header>
                <span>{day.label}</span>
                <strong>{day.date.getDate()}</strong>
              </header>
              {plans.length ? (
                plans.map((plan) => {
                  const details = plan.details as GamingDetails;
                  return (
                    <button
                      type="button"
                      className="gaming-tile"
                      key={plan.id}
                      onClick={() => onEdit(plan)}
                    >
                      <Gamepad2 size={18} />
                      <strong>{plan.title}</strong>
                      <span>{plan.startTime}</span>
                      {details.objective && <small>{details.objective}</small>}
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  className="gaming-empty"
                  onClick={() =>
                    onCreate("gaming", { date: dateKey(day.date) })
                  }
                >
                  <Plus size={16} />
                  留白
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="gaming-list-section">
        <header className="section-header">
          <div>
            <p className="eyebrow">本周清单</p>
            <h3>准备放松的时刻</h3>
          </div>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => onCreate("gaming")}
          >
            <Plus size={15} />
            添加娱乐
          </button>
        </header>

        {weekSessions.length ? (
          <div className="gaming-list">
            {weekSessions.map(({ plan, date, day }, index) => {
              const details = plan.details as GamingDetails;
              return (
                <button
                  type="button"
                  className="gaming-list-item"
                  key={`${plan.id}-${dateKey(date)}`}
                  onClick={() => onEdit(plan)}
                >
                  <span className="gaming-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="gaming-list-date">
                    <strong>{day}</strong>
                    <small>{formatShortDate(date)}</small>
                  </span>
                  <span className="gaming-list-main">
                    <strong>{plan.title}</strong>
                    <small>{details.game || details.objective}</small>
                  </span>
                  <span className="gaming-list-time">
                    <Clock3 size={14} />
                    {plan.startTime} · {formatDuration(plan.durationMinutes)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="simple-empty">
            <Gamepad2 size={24} />
            <div>
              <strong>本周还没有娱乐计划</strong>
              <p>为一段游戏时间命名，也是一种休息边界。</p>
            </div>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => onCreate("gaming")}
            >
              安排一次
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
