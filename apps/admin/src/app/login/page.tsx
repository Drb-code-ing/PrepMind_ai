'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  validateAdminEmail,
  validateAdminPassword,
} from '@/lib/admin-auth-view';
import { ApiClientError } from '@/lib/api-client';
import { authApi } from '@/lib/auth-api';
import { useAdminSessionStore } from '@/stores/admin-session-store';

export default function AdminLoginPage() {
  const router = useRouter();
  const setSession = useAdminSessionStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = submitted ? validateAdminEmail(email) : null;
  const passwordError = submitted ? validateAdminPassword(password) : null;

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    const nextEmailError = validateAdminEmail(email);
    const nextPasswordError = validateAdminPassword(password);
    if (nextEmailError || nextPasswordError) return;

    setPending(true);
    try {
      const session = await authApi.login({
        email: email.trim(),
        password,
      });
      setSession(session);

      if (session.user.role !== 'ADMIN') {
        setError('当前账号不是管理员，不能进入后台管理。');
        return;
      }

      router.replace('/');
    } catch (loginError) {
      setError(loginError instanceof ApiClientError ? loginError.message : '登录失败，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh grid-cols-[minmax(26rem,34rem)_1fr] bg-[#101828] text-white">
      <section className="flex flex-col justify-between border-r border-white/10 bg-[#111827] p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ecdc7]">
            PrepMind Admin
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight">管理员后台</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
            用于 Outbox Ops、操作审计和 worker readiness，不面向普通学习账号。
          </p>
        </div>
        <p className="text-xs leading-5 text-slate-400">
          需要后端 API 正在运行，并且账号角色为 ADMIN。
        </p>
      </section>

      <section className="flex items-center justify-center bg-[#f6f7f9] px-10 text-[var(--admin-ink)]">
        <form
          onSubmit={submitLogin}
          className="w-full max-w-md rounded-lg border border-[var(--admin-line)] bg-white p-8 shadow-sm"
        >
          <h2 className="text-2xl font-semibold">登录后台</h2>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            使用已有管理员账号登录，登录态由后端 session 和 access token 控制。
          </p>

          <label className="mt-6 block">
            <span className="text-sm font-semibold">邮箱</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[var(--admin-line)] px-3 text-sm outline-none focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[#d9f2ef]"
              placeholder="admin@example.com"
            />
            {emailError ? <span className="mt-1 block text-xs text-red-600">{emailError}</span> : null}
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[var(--admin-line)] px-3 text-sm outline-none focus:border-[var(--admin-accent)] focus:ring-4 focus:ring-[#d9f2ef]"
              placeholder="至少 8 位"
            />
            {passwordError ? (
              <span className="mt-1 block text-xs text-red-600">{passwordError}</span>
            ) : null}
          </label>

          {error ? (
            <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 min-h-11 w-full rounded-md bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white transition hover:bg-[#0b6761] disabled:opacity-60"
          >
            {pending ? '登录中...' : '进入后台'}
          </button>
        </form>
      </section>
    </main>
  );
}
