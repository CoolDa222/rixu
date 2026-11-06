import { ChefHat, Plus, Utensils } from "lucide-react";
import { useState } from "react";
import { MEAL_META } from "../constants";
import {
  dateKey,
  formatShortDate,
  getWeekDates,
  plansForDate,
} from "../lib/date";
import type { DietDetails, MealType } from "../types";
import { WeekToolbar } from "../components/WeekToolbar";
import type { PageProps } from "./page-types";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function DietPage({ state, onCreate, onEdit }: PageProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const anchor = new Date();
  anchor.setDate(anchor.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(anchor);
  const weeklyDietPlans = weekDates.flatMap((day) =>
    plansForDate(state.plans, day.date).filter(
      (plan) => plan.module === "diet",
    ),
  );

  return (
    <div className="module-page diet-page">
      <section className="module-lead tone-green">
        <div className="module-lead-icon">
          <Utensils size={25} />
        </div>
        <div>
          <p className="eyebrow">每周菜单</p>
          <h2>把“今天吃什么”提前决定好</h2>
          <p>
            本周已经安排 {weeklyDietPlans.length} 餐。点击任意格子即可添加或修改。
          </p>
        </div>
        <div className="module-lead-stats">
          <span>
            <ChefHat size={15} />
            {weeklyDietPlans.length} 餐已计划
          </span>
        </div>
      </section>

      <WeekToolbar weekOffset={weekOffset} onChange={setWeekOffset} />

      <section className="meal-table-wrap surface">
        <div className="meal-grid">
          <div className="meal-grid-corner">星期</div>
          {MEAL_ORDER.map((meal) => (
            <div className="meal-column-title" key={meal}>
              <span>{MEAL_META[meal].label}</span>
              <small>{MEAL_META[meal].time}</small>
            </div>
          ))}

          {weekDates.map((day) => {
            const dayPlans = plansForDate(state.plans, day.date).filter(
              (plan) => plan.module === "diet",
            );
            const isToday = dateKey(day.date) === dateKey();
            return (
              <div className="meal-row-group" key={dateKey(day.date)}>
                <div className={`meal-day-label ${isToday ? "is-today" : ""}`}>
                  <strong>{day.label}</strong>
                  <span>{formatShortDate(day.date)}</span>
                </div>
                {MEAL_ORDER.map((meal) => {
                  const meals = dayPlans.filter(
                    (plan) =>
                      (plan.details as DietDetails).mealType === meal,
                  );
                  return (
                    <div
                      className={`meal-cell ${isToday ? "is-today" : ""}`}
                      key={`${dateKey(day.date)}-${meal}`}
                    >
                      {meals.map((plan) => {
                        const details = plan.details as DietDetails;
                        return (
                          <button
                            type="button"
                            className="meal-entry"
                            key={plan.id}
                            onClick={() => onEdit(plan)}
                            title={`编辑：${plan.title}`}
                          >
                            <strong>{plan.title}</strong>
                            <span>
                              {plan.startTime}
                              {details.portion ? ` · ${details.portion}` : ""}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="meal-add"
                        title={`添加${day.label}${MEAL_META[meal].label}`}
                        aria-label={`添加${day.label}${MEAL_META[meal].label}`}
                        onClick={() =>
                          onCreate("diet", {
                            date: dateKey(day.date),
                            mealType: meal,
                            startTime: MEAL_META[meal].time,
                          })
                        }
                      >
                        <Plus size={14} />
                        {meals.length ? "" : "添加"}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>
      <p className="page-note">
        菜单只记录计划内容，不计算热量，也不记录实际吃了多少。
      </p>
    </div>
  );
}
