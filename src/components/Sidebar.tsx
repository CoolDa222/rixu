import { Check, CloudOff } from "lucide-react";
import { NAV_ITEMS } from "../constants";
import { isCloudMode, isMobileMode, isWebGuestMode } from "../lib/api";
import type { AppStatus, PageKey } from "../types";

interface SidebarProps {
  activePage: PageKey;
  status: AppStatus | null;
  onNavigate: (page: PageKey) => void;
}

export function Sidebar({ activePage, status, onNavigate }: SidebarProps) {
  const cloudMode = isCloudMode();
  const mobileMode = isMobileMode();
  const guestMode = isWebGuestMode();
  const stateTitle = guestMode
    ? "游客数据保存在本机"
    : cloudMode
      ? "云端账号已连接"
      : mobileMode
        ? "本机数据运行中"
        : "本地服务运行中";
  const stateDetail = guestMode
    ? "仅当前浏览器可见"
    : cloudMode
      ? "数据按账号隔离"
      : status
        ? status.reminders.running
          ? "提醒调度已启用"
          : "提醒调度未运行"
        : "正在连接";
  const stateFooter = cloudMode
    ? "数据保存在云端账号"
    : guestMode
      ? "数据只保存在当前浏览器"
      : "数据只保存在这台电脑";
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="brand"
        onClick={() => onNavigate("home")}
        title="回到首页"
      >
        <span className="brand-mark">
          <img src="/app-icon.png" alt="" />
        </span>
        <span>
          <strong>日序</strong>
          <small>WORK / LIFE</small>
        </span>
      </button>

      <nav className="sidebar-nav" aria-label="主导航">
        <span className="nav-caption">工作台</span>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.key}
              className={`nav-item ${
                activePage === item.key ? "is-active" : ""
              }`}
              onClick={() => onNavigate(item.key)}
              title={item.label}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="nav-label-desktop">{item.label}</span>
              <span className="nav-label-mobile">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="local-state">
          <span className="local-state-icon">
            {status ? <Check size={15} /> : <CloudOff size={15} />}
          </span>
          <div>
            <strong>{status ? stateTitle : "正在连接"}</strong>
            <small>{status ? stateDetail : "请稍候"}</small>
          </div>
        </div>
        <p>{stateFooter}</p>
      </div>
    </aside>
  );
}
