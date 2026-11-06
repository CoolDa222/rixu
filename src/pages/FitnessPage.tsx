import { Coffee, Dumbbell, Flame, Plus, Timer } from "lucide-react";
import { useState } from "react";
import {
  dateKey,
  formatDuration,
  formatShortDate,
  getWeekDates,
  plansForDate,
} from "../lib/date";
import type { FitnessDetails } from "../types";
import { WeekToolbar } from "../components/WeekToolbar";
import type { PageProps } from "./page-types";

export function FitnessPage({ state, onCreate, onEdit }: PageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchor);
  const weeklyPlans = weekDates.flatMap((day) =>
    plansForDate(state.plans, day.date).filter(
      (plan) => plan.module === "fitness",
    ),
  );
  const totalExercises = weeklyPlans.reduce((sum, plan) => {
    const details = plan.details as FitnessDetails;
    return sum + (details.exercises?.length || 0);
  }, 0);
  const totalMinutes = weeklyPlans.reduce(
    (sum, plan) => sum + plan.durationMinutes,
    0,
  );

  return (
    <div className="module-page fitness-page">
      <section className="module-lead tone-coral">
        <div className="module-lead-icon">
          <Dumbbell size={25} />
        </div>
        <div>
          <p className="eyebrow">训练分部</p>
          <h2>先把训练排进日程，再开始练</h2>
          <p>
            本周安排 {weeklyPlans.length} 个训练日、{totalExercises} 个动作，
            预计 {formatDuration(totalMinutes)}。
          </p>
        </div>
        <div className="module-lead-stats">
          <span>
            <Flame size={15} />
            {weeklyPlans.length} 个训练日
          </span>
          <span>
            <Timer size={15} />
            {formatDuration(totalMinutes)}
          </span>
        </div>
      </section>

      <WeekToolbar weekOffset={weekOffset} onChange={setWeekOffset} />

      <section className="fitness-week">
        {weekDates.map((day) => {
          const plans = plansForDate(state.plans, day.date).filter(
            (plan) => plan.module === "fitness",
          );
          const isToday = dateKey(day.date) === dateKey();
          return (
            <article
              className={`fitness-day ${isToday ? "is-today" : ""} ${
                plans.length ? "has-training" : "is-rest"
              }`}
              key={dateKey(day.date)}
            >
              <header>
                <div>
                  <span>{day.label}</span>
                  <strong>{day.date.getDate()}</strong>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button-small"
                  title={`${day.label}添加训练`}
                  aria-label={`${day.label}添加训练`}
                  onClick={() =>
                    onCreate("fitness", { date: dateKey(day.date) })
                  }
                >
                  <Plus size={15} />
                </button>
              </header>

              {plans.length ? (
                <div className="fitness-sessions">
                  {plans.map((plan) => {
                    const details = plan.details as FitnessDetails;
                    return (
                      <button
                        type="button"
                        className="fitness-session"
                        key={plan.id}
                        onClick={() => onEdit(plan)}
                        title={`编辑：${plan.title}`}
                      >
                        <span className="fitness-session-time">
                          {plan.startTime}
                          <small>{formatDuration(plan.durationMinutes)}</small>
                        </span>
                        <strong>{plan.title}</strong>
                        {details.focus && <em>{details.focus}</em>}
                        <div className="exercise-chips">
                          {details.exercises.slice(0, 4).map((exercise) => (
                            <span key={exercise.id}>{exercise.name}</span>
                          ))}
                          {details.exercises.length > 4 && (
                            <span>+{details.exercises.length - 4}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  className="rest-day"
                  onClick={() =>
                    onCreate("fitness", { date: dateKey(day.date) })
                  }
                >
                  <Coffee size={19} />
                  <strong>恢复日</strong>
                  <span>点击安排训练</span>
                </button>
              )}
              <footer>{formatShortDate(day.date)}</footer>
            </article>
          );
        })}
      </section>

      <p className="page-note">
        这里是计划视图：记录准备练什么，不追踪实际完成组数或打卡。
      </p>
    </div>
  );
}
