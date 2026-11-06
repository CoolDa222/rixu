import { Bell, BellOff, Plus } from "lucide-react";
import { PAGE_TITLES } from "../constants";
import { formatDateWithYear } from "../lib/date";
import type { AppStatus, PageKey } from "../types";

interface TopbarProps {
  page: PageKey;
  now: Date;
  status: AppStatus | null;
  onAdd: () => void;
}

export function Topbar({ page, now, status, onAdd }: TopbarProps) {
  const pageMeta = PAGE_TITLES[page];
  const time = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <header className="topbar">
      <div className="topbar-title">
        <p>{pageMeta.subtitle}</p>
        <h1>{pageMeta.title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="live-status" title="本地后台状态">
          {status?.reminders.running ? (
            <Bell size={15} />
          ) : (
            <BellOff size={15} />
          )}
          <span>{status?.reminders.running ? "提醒运行中" : "提醒未连接"}</span>
        </div>
        <div className="topbar-clock">
          <strong>{time}</strong>
          <span>{formatDateWithYear(now)}</span>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={onAdd}
          aria-label="新建计划"
        >
          <Plus size={17} />
          <span>新建计划</span>
        </button>
      </div>
    </header>
  );
}
