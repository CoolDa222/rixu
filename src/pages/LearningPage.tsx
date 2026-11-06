import { BookOpen, CalendarDays, Clock3, Plus } from "lucide-react";
import { useState } from "react";
import { MODULE_META } from "../constants";
import {
  dateKey,
  formatDuration,
  formatShortDate,
  getWeekDates,
  plansForDate,
} from "../lib/date";
import { planSecondaryText } from "../lib/plan";
import { MiniPlan } from "../components/PlanCard";
import { WeekToolbar } from "../components/WeekToolbar";
import type { PageProps } from "./page-types";

export function LearningPage({ state, onCreate, onEdit }: PageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchor);
  const weeklyPlans = weekDates.flatMap((day) =>
    plansForDate(state.plans, day.date).filter(
      (plan) => plan.module === "learning",
    ),
  );
  const totalMinutes = weeklyPlans.reduce(
    (sum, plan) => sum + plan.durationMinutes,
    0,
  );
  const courses = new Set(
    weeklyPlans
      .map((plan) => {
        const details = plan.details as { course?: string };
        return details.course;
      })
      .filter(Boolean),
  );

  return (
    <div className="module-page learning-page">
      <section className="module-lead tone-blue">
        <div className="module-lead-icon">
          <BookOpen size={25} />
        </div>
        <div>
          <p className="eyebrow">学习节奏</p>
          <h2>本周把时间留给真正要学的内容</h2>
          <p>
            {weeklyPlans.length
              ? `${courses.size || 1} 个课程或领域，共 ${weeklyPlans.length} 次学习安排。`
              : "本周还没有学习安排，可以先放一门课程或一个主题。"}
          </p>
        </div>
        <div className="module-lead-stats">
          <span>
            <CalendarDays size={15} />
            {weeklyPlans.length} 次
          </span>
          <span>
            <Clock3 size={15} />
            {formatDuration(totalMinutes)}
          </span>
        </div>
      </section>

      <WeekToolbar weekOffset={weekOffset} onChange={setWeekOffset} />

      <section className="learning-board">
        {weekDates.map((day) => {
          const plans = plansForDate(state.plans, day.date).filter(
            (plan) => plan.module === "learning",
          );
          const isToday = dateKey(day.date) === dateKey();
          return (
            <article
              className={`learning-day ${isToday ? "is-today" : ""}`}
              key={dateKey(day.date)}
            >
              <header>
                <div>
                  <span>{day.label}</span>
                  <strong>{formatShortDate(day.date)}</strong>
                </div>
                <button
                  type="button"
                  className="icon-button icon-button-small"
                  title={`在${day.label}添加学习计划`}
                  aria-label={`在${day.label}添加学习计划`}
                  onClick={() =>
                    onCreate("learning", { date: dateKey(day.date) })
                  }
                >
                  <Plus size={15} />
                </button>
              </header>
              <div className="learning-day-content">
                {plans.length ? (
                  plans.map((plan) => (
                    <MiniPlan key={plan.id} plan={plan} onEdit={onEdit} />
                  ))
                ) : (
                  <button
                    type="button"
                    className="day-placeholder"
                    onClick={() =>
                      onCreate("learning", { date: dateKey(day.date) })
                    }
                  >
                    <Plus size={15} />
                    安排学习
                  </button>
                )}
              </div>
              {plans.length > 0 && (
                <footer>
                  {planSecondaryText(plans[0]) || MODULE_META.learning.description}
                </footer>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
