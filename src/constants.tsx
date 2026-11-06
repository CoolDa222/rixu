import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  Database,
  Dumbbell,
  Gamepad2,
  Inbox,
  LayoutDashboard,
  Utensils,
} from "lucide-react";
import type { MealType, ModuleKey, PageKey } from "./types";

export interface ModuleMeta {
  key: ModuleKey;
  page: PageKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}

export const MODULE_META: Record<ModuleKey, ModuleMeta> = {
  learning: {
    key: "learning",
    page: "learning",
    label: "学习计划",
    shortLabel: "学习",
    description: "课程、主题与每周学习时段",
    icon: BookOpen,
    tone: "blue",
  },
  fitness: {
    key: "fitness",
    page: "fitness",
    label: "健身计划",
    shortLabel: "健身",
    description: "训练分部、动作与每周安排",
    icon: Dumbbell,
    tone: "coral",
  },
  diet: {
    key: "diet",
    page: "diet",
    label: "饮食计划",
    shortLabel: "饮食",
    description: "每日餐次与每周菜单",
    icon: Utensils,
    tone: "green",
  },
  gaming: {
    key: "gaming",
    page: "gaming",
    label: "游戏娱乐",
    shortLabel: "娱乐",
    description: "想玩的游戏与放松时段",
    icon: Gamepad2,
    tone: "amber",
  },
};

export const PAGE_TITLES: Record<PageKey, { title: string; subtitle: string }> = {
  home: { title: "首页总览", subtitle: "今天的方向，一眼看清" },
  today: { title: "今日计划", subtitle: "所有模块的今日安排自动汇总" },
  calendar: { title: "日历", subtitle: "按月份查看每天的计划安排" },
  learning: { title: "学习计划", subtitle: "把要学的内容放进真实时间里" },
  fitness: { title: "健身计划", subtitle: "按周安排训练，不记录实际完成" },
  diet: { title: "饮食计划", subtitle: "提前决定每天吃什么" },
  gaming: { title: "游戏娱乐", subtitle: "给放松留出明确的时间" },
  feedback: { title: "意见箱", subtitle: "提交建议或查看收到的反馈" },
  settings: { title: "数据与设置", subtitle: "提醒、自启动与本地数据" },
};

export const NAV_ITEMS = [
  {
    key: "home" as PageKey,
    label: "首页总览",
    mobileLabel: "首页",
    icon: LayoutDashboard,
  },
  {
    key: "today" as PageKey,
    label: "今日计划",
    mobileLabel: "今日",
    icon: CalendarDays,
  },
  {
    key: "calendar" as PageKey,
    label: "日历",
    mobileLabel: "日历",
    icon: CalendarRange,
  },
  {
    key: "learning" as PageKey,
    label: "学习计划",
    mobileLabel: "学习",
    icon: BookOpen,
  },
  {
    key: "fitness" as PageKey,
    label: "健身计划",
    mobileLabel: "健身",
    icon: Dumbbell,
  },
  {
    key: "diet" as PageKey,
    label: "饮食计划",
    mobileLabel: "饮食",
    icon: Utensils,
  },
  {
    key: "gaming" as PageKey,
    label: "游戏娱乐",
    mobileLabel: "娱乐",
    icon: Gamepad2,
  },
  {
    key: "feedback" as PageKey,
    label: "意见箱",
    mobileLabel: "意见",
    icon: Inbox,
  },
  {
    key: "settings" as PageKey,
    label: "数据与设置",
    mobileLabel: "设置",
    icon: Database,
  },
];

export const WEEKDAYS = [
  { value: 1, label: "周一", short: "一" },
  { value: 2, label: "周二", short: "二" },
  { value: 3, label: "周三", short: "三" },
  { value: 4, label: "周四", short: "四" },
  { value: 5, label: "周五", short: "五" },
  { value: 6, label: "周六", short: "六" },
  { value: 0, label: "周日", short: "日" },
];

export const MEAL_META: Record<
  MealType,
  { label: string; shortLabel: string; time: string }
> = {
  breakfast: { label: "早餐", shortLabel: "早", time: "08:00" },
  lunch: { label: "午餐", shortLabel: "午", time: "12:00" },
  dinner: { label: "晚餐", shortLabel: "晚", time: "18:30" },
  snack: { label: "加餐", shortLabel: "加", time: "15:30" },
};
