"use client";

import { FormEvent, useMemo, useState } from "react";
import { t } from "@/lib/i18n";

type Mode = "login" | "signup" | "reset";
type Props = { onSuccess: () => void };

function authLocale() {
  if (typeof document === "undefined") return "uz";
  const lang = document.documentElement.lang || "uz";
  return lang === "ru" || lang === "en" ? lang : "uz";
}

export function AuthForm({ onSuccess }: Props) {
  const locale = useMemo(() => authLocale(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      if (mode === "reset") {
        if (password !== confirmPassword) {
          setError(t(locale, "auth.mismatch"));
          return;
        }
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, confirmPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || t(locale, "auth.error"));
          return;
        }
        setInfo(data.message || t(locale, "auth.resetOk"));
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        return;
      }

      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t(locale, "auth.error"));
        return;
      }
      onSuccess();
    } catch {
      setError(t(locale, "auth.network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <h1>Discipline</h1>
        <p className="muted">{t(locale, "auth.tagline")}</p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" ? (
            <label>
              {t(locale, "auth.name")}
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Bobur"
              />
            </label>
          ) : null}
          <label>
            {t(locale, "auth.email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@misol.uz"
              autoComplete="email"
            />
          </label>
          <label>
            {mode === "reset" ? t(locale, "auth.newPassword") : t(locale, "auth.password")}
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t(locale, "auth.passwordHint")}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {mode === "reset" ? (
            <label>
              {t(locale, "auth.confirmPassword")}
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t(locale, "auth.passwordHint")}
                autoComplete="new-password"
              />
            </label>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          {info ? <p className="success-text">{info}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading
              ? t(locale, "auth.waiting")
              : mode === "login"
                ? t(locale, "auth.login")
                : mode === "signup"
                  ? t(locale, "auth.signup")
                  : t(locale, "auth.resetSubmit")}
          </button>
        </form>
        {mode === "login" ? (
          <div className="auth-switch">
            <button className="btn btn-ghost" type="button" onClick={() => switchMode("reset")}>
              {t(locale, "auth.forgot")}
            </button>
          </div>
        ) : null}
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              <span>{t(locale, "auth.noAccount")}</span>
              <button className="btn btn-ghost" type="button" onClick={() => switchMode("signup")}>
                {t(locale, "auth.signup")}
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              <span>{t(locale, "auth.hasAccount")}</span>
              <button className="btn btn-ghost" type="button" onClick={() => switchMode("login")}>
                {t(locale, "auth.login")}
              </button>
            </>
          ) : (
            <>
              <span>{t(locale, "auth.remembered")}</span>
              <button className="btn btn-ghost" type="button" onClick={() => switchMode("login")}>
                {t(locale, "auth.backToLogin")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
