'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useRegister } from '@/hooks/use-auth';
import {
  getAuthAgreementError,
  isAuthSubmitDisabled,
} from '@/lib/auth-submit-state';

type FieldError = string | null | undefined;

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>;
}

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, FieldError>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const nextErrors = {
      email: validateEmail(email),
      username: validateUsername(username),
      password: validateRegisterPassword(password),
      confirm: validateConfirmPassword(confirm, password),
    };
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) return;
    const agreementError = getAuthAgreementError(agreed);
    if (agreementError) {
      setServerError(agreementError);
      return;
    }

    try {
      await register.mutateAsync({
        email: email.trim(),
        password,
        name: username.trim(),
      });
      router.replace('/chat');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : '注册失败，请稍后重试');
    }
  }

  const submitting = register.isPending;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 sm:flex-none">
      <div className="pm-enter mb-6 text-center">
        <div className="pm-mascot-float mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#fff7d6] text-xl font-black text-[#247269] shadow-sm ring-1 ring-[#f3e6a8]">
          PM
        </div>
        <p className="mt-4 text-xs font-semibold text-[var(--pm-muted)]">PrepMind AI</p>
        <h1 className="mt-1 text-3xl font-black leading-tight text-[var(--pm-ink)]">
          创建学习账号
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--pm-muted)]">
          用一个账号保存聊天、OCR 记录和错题复盘。
        </p>
      </div>

      <section className="pm-glass-card pm-enter rounded-[1.7rem] p-4">
        <div className="mb-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[1.25rem] border border-[#f3e6a8] bg-[#fff7d6]/72 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#247269]">先建档，再开始备考</p>
            <p className="mt-1 text-xs leading-5 text-[#6f6750]">
              注册后会直接进入学习流，聊天、OCR 和错题记录会按账号保存。
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/78 text-sm font-black text-[#247269] ring-1 ring-[#f3e6a8]">
            学
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-[1.25rem] border border-red-100 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-600">
            {serverError}
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <div className={inputClass(errors.email)}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: null }));
                }}
                className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--pm-muted)]"
              />
            </div>
            <FieldHint error={errors.email} />
          </div>

          <div>
            <div className={inputClass(errors.username)}>
              <input
                type="text"
                autoComplete="username"
                placeholder="用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrors((prev) => ({ ...prev, username: null }));
                }}
                className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--pm-muted)]"
              />
            </div>
            <FieldHint error={errors.username} />
          </div>

          <div>
            <div className={inputClass(errors.password)}>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="设置密码，至少 8 位"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: null }));
                }}
                className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--pm-muted)]"
              />
            </div>
            <FieldHint error={errors.password} />
          </div>

          <div>
            <div className={inputClass(errors.confirm)}>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="确认密码"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setErrors((prev) => ({ ...prev, confirm: null }));
                }}
                className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--pm-muted)]"
              />
            </div>
            <FieldHint error={errors.confirm} />
          </div>

          <label className="mt-1 flex items-start gap-2 text-xs leading-5 text-[var(--pm-muted)]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--pm-line)] accent-[#6fcbbf]"
            />
            <span>
              注册即表示同意
              <span className="font-semibold text-[#247269]">《用户协议》</span> 和{' '}
              <span className="font-semibold text-[#247269]">《隐私政策》</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={isAuthSubmitDisabled({ submitting })}
            className="tap-target mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[#86dccf] text-sm font-semibold text-[#173b37] shadow-sm transition-all hover:bg-[#70cfc1] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)] disabled:active:scale-100"
          >
            {submitting ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-[var(--pm-muted)]">已有账号？</span>
          <Link href="/login" className="tap-target ml-1 text-sm font-semibold text-[#247269]">
            去登录
          </Link>
        </div>
      </section>
    </main>
  );
}

function inputClass(error: FieldError) {
  return `flex items-center rounded-2xl border bg-white/80 px-4 py-3 transition-all ${
    error
      ? 'border-red-300 ring-4 ring-red-50'
      : 'border-[var(--pm-line)] focus-within:border-[#6fcbbf] focus-within:ring-4 focus-within:ring-[#d8f8f0]'
  }`;
}

function validateEmail(value: string): FieldError {
  if (!value.trim()) return '请输入邮箱';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '请输入正确的邮箱格式';
  return null;
}

function validateUsername(value: string): FieldError {
  if (!value.trim()) return '请输入用户名';
  if (value.trim().length > 50) return '用户名最多 50 个字符';
  return null;
}

function validateRegisterPassword(value: string): FieldError {
  if (!value) return '请输入密码';
  if (value.length < 8) return '密码至少 8 位';
  if (value.length > 128) return '密码最多 128 位';
  return null;
}

function validateConfirmPassword(value: string, password: string): FieldError {
  if (!value) return '请确认密码';
  if (value !== password) return '两次密码不一致';
  return null;
}
