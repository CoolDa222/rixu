import { useEffect, useState } from "react";
import {
  Check,
  Inbox,
  Mail,
  MessageSquareText,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import {
  deleteFeedback,
  getAdminFeedback,
  submitFeedback,
  updateFeedbackStatus,
} from "../lib/api";
import type {
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
} from "../types";

interface FeedbackPageProps {
  userEmail: string | null;
}

const CATEGORIES: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "feature", label: "功能建议" },
  { value: "bug", label: "问题反馈" },
  { value: "design", label: "界面体验" },
  { value: "other", label: "其他想法" },
];

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "新建议",
  read: "已查看",
  resolved: "已处理",
};

export function FeedbackPage({ userEmail }: FeedbackPageProps) {
  const [view, setView] = useState<"submit" | "admin">("submit");
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState(userEmail || "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adminItems, setAdminItems] = useState<FeedbackItem[]>([]);
  const [adminAccess, setAdminAccess] = useState(false);
  const [adminFilter, setAdminFilter] = useState<FeedbackStatus | "all">("all");

  async function loadAdmin(silent = false) {
    if (!silent) setBusy("refresh");
    try {
      const result = await getAdminFeedback();
      setAdminItems(result.feedback);
      setAdminAccess(true);
    } catch {
      setAdminAccess(false);
    } finally {
      if (!silent) setBusy("");
    }
  }

  useEffect(() => {
    setContact(userEmail || "");
    if (userEmail) {
      void loadAdmin(true);
    }
  }, [userEmail]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (content.trim().length < 5) {
      setError("请至少填写 5 个字。");
      return;
    }
    setBusy("submit");
    try {
      await submitFeedback({
        category,
        content: content.trim(),
        contact: contact.trim(),
        pagePath: window.location.hash || "#/feedback",
      });
      setContent("");
      setMessage("建议已送达，谢谢你的反馈。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus(id: string, status: FeedbackStatus) {
    await updateFeedbackStatus(id, status);
    setAdminItems((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  async function remove(id: string) {
    await deleteFeedback(id);
    setAdminItems((items) => items.filter((item) => item.id !== id));
  }

  const visibleItems =
    adminFilter === "all"
      ? adminItems
      : adminItems.filter((item) => item.status === adminFilter);
  const newCount = adminItems.filter((item) => item.status === "new").length;

  return (
    <div className="feedback-page">
      <section className="feedback-hero">
        <div>
          <p className="eyebrow">意见箱</p>
          <h2>你的想法，会让日序变得更好。</h2>
          <p>
            可以提交功能建议、使用问题或界面想法。游客也可以匿名提交。
          </p>
        </div>
        <div className="feedback-hero-mark">
          <MessageSquareText size={30} />
        </div>
      </section>

      {adminAccess && (
        <div className="cloud-switcher feedback-switcher">
          <button
            type="button"
            className={view === "submit" ? "is-active" : ""}
            onClick={() => setView("submit")}
          >
            提交建议
          </button>
          <button
            type="button"
            className={view === "admin" ? "is-active" : ""}
            onClick={() => {
              setView("admin");
              void loadAdmin();
            }}
          >
            查看建议 {newCount > 0 ? `(${newCount})` : ""}
          </button>
        </div>
      )}

      {view === "submit" || !adminAccess ? (
        <div className="feedback-layout">
          <form className="surface feedback-form" onSubmit={(event) => void submit(event)}>
            <header className="section-header">
              <div>
                <p className="eyebrow">写下你的建议</p>
                <h3>{userEmail ? `以 ${userEmail} 提交` : "游客提交"}</h3>
              </div>
              <Send size={19} />
            </header>

            <div className="feedback-categories" role="group" aria-label="建议类型">
              {CATEGORIES.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={category === item.value ? "is-active" : ""}
                  onClick={() => setCategory(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="field">
              <span>建议内容</span>
              <textarea
                rows={7}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="请描述你希望增加的功能、遇到的问题，或觉得可以改进的地方。"
                maxLength={3000}
              />
              <small className="field-counter">{content.length} / 3000</small>
            </label>

            <label className="field">
              <span>联系方式（选填）</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="邮箱或其他联系方式"
                maxLength={200}
              />
            </label>

            {error && <p className="form-error">{error}</p>}
            {message && (
              <p className="form-success">
                <Check size={15} />
                {message}
              </p>
            )}

            <button
              type="submit"
              className="button button-primary feedback-submit"
              disabled={busy === "submit"}
            >
              <Send size={16} />
              {busy === "submit" ? "发送中..." : "发送建议"}
            </button>
          </form>

          <aside className="feedback-side">
            <section>
              <Mail size={20} />
              <h3>邮箱提交</h3>
              <p>
                暂时不接入邮件服务，建议会安全保存在云端意见箱中，不会公开显示。
              </p>
            </section>
            <section>
              <Inbox size={20} />
              <h3>谁会看到</h3>
              <p>
                只有管理员账号可以查看建议。登录用户会附带账号邮箱；游客提交保持匿名。
              </p>
            </section>
          </aside>
        </div>
      ) : (
        <section className="feedback-admin">
          <header className="feedback-admin-head">
            <div>
              <p className="eyebrow">管理员</p>
              <h3>收到的建议</h3>
            </div>
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={busy === "refresh"}
              onClick={() => void loadAdmin()}
            >
              <RefreshCw size={15} />
              刷新
            </button>
          </header>

          <div className="filters feedback-filters">
            {(["all", "new", "read", "resolved"] as const).map((status) => (
              <button
                type="button"
                key={status}
                className={`filter-chip ${adminFilter === status ? "is-active" : ""}`}
                onClick={() => setAdminFilter(status)}
              >
                {status === "all" ? "全部" : STATUS_LABELS[status]}
                <span>
                  {status === "all"
                    ? adminItems.length
                    : adminItems.filter((item) => item.status === status).length}
                </span>
              </button>
            ))}
          </div>

          {visibleItems.length ? (
            <div className="feedback-list">
              {visibleItems.map((item) => (
                <article className="feedback-card" key={item.id}>
                  <header>
                    <span className={`feedback-category category-${item.category}`}>
                      {CATEGORIES.find((categoryItem) => categoryItem.value === item.category)?.label}
                    </span>
                    <span className={`feedback-status status-${item.status}`}>
                      {STATUS_LABELS[item.status]}
                    </span>
                    <time>
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </time>
                  </header>
                  <p>{item.content}</p>
                  <footer>
                    <span>{item.email || item.contact || "游客匿名提交"}</span>
                    <div>
                      {item.status !== "read" && (
                        <button
                          type="button"
                          className="button button-quiet button-small"
                          onClick={() => void changeStatus(item.id, "read")}
                        >
                          标为已查看
                        </button>
                      )}
                      {item.status !== "resolved" && (
                        <button
                          type="button"
                          className="button button-quiet button-small"
                          onClick={() => void changeStatus(item.id, "resolved")}
                        >
                          标为已处理
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-button icon-button-small"
                        title="删除建议"
                        aria-label="删除建议"
                        onClick={() => void remove(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="simple-empty">
              <Inbox size={24} />
              <div>
                <strong>暂时没有建议</strong>
                <p>新的建议会显示在这里。</p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
