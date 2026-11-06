import type { Plan } from "../types";
import { WEEKDAYS } from "../constants";

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date = new Date()) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(current, offset);
}

export function getWeekDates(anchor = new Date()) {
  const monday = startOfWeek(anchor);
  return WEEKDAYS.map((weekday, index) => ({
    ...weekday,
    date: addDays(monday, index),
  }));
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getMonthGrid(anchor = new Date()) {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function isSameMonth(date: Date, anchor: Date) {
  return (
    date.getFullYear() === anchor.getFullYear() &&
    date.getMonth() === anchor.getMonth()
  );
}

export function formatMonthTitle(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export function occursOnDate(plan: Plan, date: Date) {
  const key = dateKey(date);
  if (plan.repeatEnabled) {
    return plan.repeatWeekdays.includes(date.getDay()) && plan.date <= key;
  }
  return plan.date === key;
}

export function nextOccurrence(plan: Plan, from = new Date()) {
  const start = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
  );

  for (let offset = 0; offset < 370; offset += 1) {
    const candidate = addDays(start, offset);
    if (occursOnDate(plan, candidate)) {
      return candidate;
    }
  }
  return null;
}

export function plansForDate(plans: Plan[], date: Date) {
  return plans
    .filter((plan) => occursOnDate(plan, date))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function formatDateLong(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatDateWithYear(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

export function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatWeekRange(dates: ReturnType<typeof getWeekDates>) {
  const start = dates[0].date;
  const end = dates[6].date;
  if (start.getMonth() === end.getMonth()) {
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getDate()}日`;
  }
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

export function weekdayLabel(day: number) {
  return WEEKDAYS.find((item) => item.value === day)?.label || "";
}

export function formatDuration(minutes: number) {
  if (!minutes) {
    return "未设时长";
  }
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export function getPeriodLabel(time: string) {
  const hour = Number(time.split(":")[0]);
  if (hour < 12) return "上午";
  if (hour < 18) return "下午";
  return "晚上";
}
