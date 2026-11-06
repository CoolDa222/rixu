import { useState } from "react";
import { ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { login, register } from "../lib/api";
import type { AppState, AuthUser } from "../types";

interface AuthPageProps {
  onAuthenticated: (user: AuthUser, state: AppState) => void;
  onGuest: () => void;
}

export function AuthPage({ onAuthenticated, onGuest }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await login(email, password)
          : await register(email, password, acceptedTerms);
      onAuthenticated(result.user, result.state);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <img src="/app-icon.png" alt="日序" />
          <div>
            <strong>日序</strong>
            <span>LOCAL-LIKE · PRIVATE · SIMPLE</span>
          </div>
        </div>
        <div className="auth-statement">
          <p className="eyebrow">工作与生活，各得其所</p>
          <h1>把每天的事情，<br />安放有序。</h1>
          <p>计划、日历、学习、健身、饮食和娱乐，都在一个安静的空间里。</p>
        </div>
        <div className="auth-privacy">
          <ShieldCheck size={18} />
          <span>每个账号的数据独立保存，不会向其他用户公开。</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建账号"}</p>
          <h2>{mode === "login" ? "登录日序" : "开始使用日序"}</h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "使用邮箱和密码进入你的私人空间。"
              : "第一版使用邮箱和密码，不需要手机号。"}
          </p>

          <form onSubmit={(event) => void submit(event)}>
            <label className="field">
              <span>邮箱</span>
              <div className="auth-input">
                <Mail size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>
            <label className="field">
              <span>密码</span>
              <div className="auth-input">
                <KeyRound size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>
            </label>

            {mode === "register" && (
              <label className="auth-terms">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  我已阅读并同意
                  <a href="/terms.html" target="_blank">使用条款</a>
                  和
                  <a href="/privacy.html" target="_blank">隐私政策</a>
                </span>
              </label>
            )}

            {error && <p className="form-error">{error}</p>}

            <button
              type="submit"
              className="button button-primary auth-submit"
              disabled={busy}
            >
              {busy ? "处理中..." : mode === "login" ? "登录" : "创建账号"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "还没有账号？创建账号" : "已有账号？返回登录"}
          </button>

          <p className="auth-note">
            第一版暂不提供邮箱验证码和自助找回密码。请妥善保存密码。
          </p>
          <button
            type="button"
            className="auth-guest-button"
            onClick={onGuest}
          >
            不登录，先以游客模式使用
          </button>
        </div>
      </section>
    </main>
  );
}
