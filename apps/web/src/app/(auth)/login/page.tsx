'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLogin } from '@/hooks/use-auth';
import {
  getAuthAgreementError,
  isAuthSubmitDisabled,
} from '@/lib/auth-submit-state';

type FieldError = string | null | undefined;

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>;
}

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ email?: FieldError; password?: FieldError }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const nextErrors = {
      email: validateEmail(email),
      password: validateLoginPassword(password),
    };
    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) return;
    const agreementError = getAuthAgreementError(agreed);
    if (agreementError) {
      setServerError(agreementError);
      return;
    }

    try {
      await login.mutateAsync({
        email: email.trim(),
        password,
      });
      router.replace('/chat');
    } catch (error) {
      setServerError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    }
  }

  const submitting = login.isPending;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6 sm:flex-none">
      <div className="pm-enter mb-6 text-center">
        <div className="pm-mascot-float mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#fff7d6] text-xl font-black text-[#247269] shadow-sm ring-1 ring-[#f3e6a8]">
          PM
        </div>
        <p className="mt-4 text-xs font-semibold text-[var(--pm-muted)]">PrepMind AI</p>
        <h1 className="mt-1 text-3xl font-black leading-tight text-[var(--pm-ink)]">
          回到你的学习流
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--pm-muted)]">
          继续拍照识题、追问思路和整理错题卡。
        </p>
      </div>

      <section className="pm-glass-card pm-enter rounded-[1.7rem] p-4">
        <div className="mb-4 rounded-[1.25rem] bg-white/68 p-1 ring-1 ring-[var(--pm-line)]">
          <div className="rounded-[1rem] bg-[#eafff9] py-2.5 text-center text-sm font-semibold text-[#247269] ring-1 ring-[#bdeee5]">
            邮箱登录
          </div>
        </div>

        <div className="mb-4 rounded-[1.25rem] border border-[#bdeee5] bg-[#eafff9]/72 px-4 py-3 text-xs leading-5 text-[#4f6f68]">
          手机验证码登录暂未开放，请先使用邮箱登录。
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
                placeholder="请输入邮箱"
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
            <div className={inputClass(errors.password)}>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
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

          <label className="mt-1 flex items-start gap-2 text-xs leading-5 text-[var(--pm-muted)]">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--pm-line)] accent-[#6fcbbf]"
            />
            <span>
              登录即表示同意
              <span className="font-semibold text-[#247269]">《用户协议》</span> 和{' '}
              <span className="font-semibold text-[#247269]">《隐私政策》</span>
            </span>
          </label>

          <button
            type="submit"
            disabled={isAuthSubmitDisabled({ submitting })}
            className="tap-target mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[#86dccf] text-sm font-semibold text-[#173b37] shadow-sm transition-all hover:bg-[#70cfc1] active:scale-[0.98] disabled:bg-white/70 disabled:text-[var(--pm-muted)] disabled:ring-1 disabled:ring-[var(--pm-line)] disabled:active:scale-100"
          >
            {submitting ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <span className="text-sm text-[var(--pm-muted)]">没有账号？</span>
          <Link href="/register" className="tap-target ml-1 text-sm font-semibold text-[#247269]">
            立即注册
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

function validateLoginPassword(value: string): FieldError {
  if (!value) return '请输入密码';
  return null;
}
