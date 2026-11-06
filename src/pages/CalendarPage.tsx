import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { MODULE_META } from "../constants";
import {
  dateKey,
  formatDateWithYear,
  formatMonthTitle,
  getMonthGrid,
  isSameMonth,
  plansForDate,
  startOfMonth,
} from "../lib/date";
import { PlanCard } from "../components/PlanCard";
import type { PageProps } from "./page-types";

interface CalendarPageProps extends PageProps {
  now: Date;
}

const WEEK_HEADERS = [
  { label: "周一", weekend: false },
  { label: "周二", weekend: false },
  { label: "周三", weekend: false },
  { label: "周四", weekend: false },
  { label: "周五", weekend: false },
  { label: "周六", weekend: true },
  { label: "周日", weekend: true },
];

export function CalendarPage({
  state,
  onCreate,
  onEdit,
  now,
}: CalendarPageProps) {
  const [month, setMonth] = useState(() => startOfMonth(now));
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const days = getMonthGrid(month);
  const selectedPlans = plansForDate(state.plans, selectedDate);
  const today = dateKey(now);

  function shiftMonth(amount: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(next);
    setSelectedDate(next);
  }

  function goToday() {
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    setMonth(startOfMonth(current));
    setSelectedDate(current);
  }

  function selectDay(date: Date) {
    setSelectedDate(date);
    if (!isSameMonth(date, month)) {
      setMonth(startOfMonth(date));
    }
  }

  return (
    <div className="calendar-page">
      <section className="calendar-toolbar">
        <div>
          <p className="eyebrow">月历</p>
          <h2>{formatMonthTitle(month)}</h2>
        </div>
        <div className="calendar-toolbar-actions">
          <div className="month-stepper">
            <button
              type="button"
              className="icon-button"
              title="上个月"
              aria-label="上个月"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={goToday}
            >
              今天
            </button>
            <button
              type="button"
              className="icon-button"
              title="下个月"
              aria-label="下个月"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
          <button
            type="button"
            className="button button-primary button-small calendar-add"
            onClick={() =>
              onCreate("learning", { date: dateKey(selectedDate) })
            }
          >
            <Plus size={15} />
            添加计划
          </button>
        </div>
      </section>

      <div className="calendar-layout">
        <section className="calendar-board surface">
          <div className="calendar-weekdays">
            {WEEK_HEADERS.map((day) => (
              <span
                key={day.label}
                className={day.weekend ? "is-weekend" : ""}
              >
                {day.label}
              </span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((date) => {
              const plans = plansForDate(state.plans, date);
              const currentMonth = isSameMonth(date, month);
              const selected = dateKey(date) === dateKey(selectedDate);
              const isToday = dateKey(date) === today;
              return (
                <article
                  className={`calendar-cell ${
                    currentMonth ? "" : "is-outside"
                  } ${selected ? "is-selected" : ""} ${
                    isToday ? "is-today" : ""
                  }`}
                  key={dateKey(date)}
                >
                  <header>
                    <button
                      type="button"
                      className="calendar-day-number"
                      onClick={() => selectDay(date)}
                      aria-label={`查看 ${formatDateWithYear(date)} 的安排`}
                      aria-current={isToday ? "date" : undefined}
                    >
                      {date.getDate()}
                    </button>
                    {plans.length > 0 && (
                      <span className="calendar-count">{plans.length}</span>
                    )}
                  </header>
                  <div className="calendar-events">
                    {plans.slice(0, 3).map((plan) => {
                      const meta = MODULE_META[plan.module];
                      return (
                        <button
                          type="button"
                          className={`calendar-event tone-${meta.tone}`}
                          key={plan.id}
                          title={`${plan.startTime} ${plan.title}`}
                          onClick={() => onEdit(plan)}
                        >
                          <i />
                          <time>{plan.startTime}</time>
                          <span>{plan.title}</span>
                        </button>
                      );
                    })}
                    {plans.length > 3 && (
                      <button
                        type="button"
                        className="calendar-more"
                        onClick={() => selectDay(date)}
                      >
                        还有 {plans.length - 3} 项
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="calendar-agenda">
          <header>
            <div>
              <p className="eyebrow">当日安排</p>
              <h3>{formatDateWithYear(selectedDate)}</h3>
            </div>
            <CalendarDays size={18} />
          </header>
          <div className="calendar-agenda-list">
            {selectedPlans.length ? (
              selectedPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={onEdit}
                  compact
                />
              ))
            ) : (
              <div className="calendar-agenda-empty">
                <CalendarDays size={22} />
                <strong>这一天还没有安排</strong>
                <p>把需要做的事情放进这一天。</p>
              </div>
            )}
          </div>
          <button
            type="button"
            className="button button-secondary calendar-agenda-add"
            onClick={() =>
              onCreate("learning", { date: dateKey(selectedDate) })
            }
          >
            <Plus size={16} />
            在这一天添加计划
          </button>
        </aside>
      </div>
    </div>
  );
}
