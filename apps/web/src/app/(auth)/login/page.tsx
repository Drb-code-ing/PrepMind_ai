'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLogin } from '@/hooks/use-auth';

type FieldError = string | null;

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs text-red-500">{error}</p>;
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
    if (!agreed) {
      setServerError('请先同意用户协议和隐私政策');
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
    <div className="flex flex-1 flex-col px-6 pb-8 pt-16">
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          PM
        </div>
        <h1 className="text-2xl font-bold tracking-tight">PrepMind AI</h1>
        <p className="text-sm text-muted-foreground">智能备考，高效复习</p>
      </div>

      <div className="mb-6 rounded-xl bg-muted p-1">
        <div className="rounded-lg bg-white py-2.5 text-center text-sm font-medium shadow-sm">
          邮箱登录
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        手机号验证码登录暂未开放，请先使用邮箱登录。
      </div>

      {serverError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div>
          <div className={inputClass(errors.email)}>
            <input
              type="email"
              inputMode="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: null }));
              }}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FieldHint error={errors.email} />
        </div>

        <div>
          <div className={inputClass(errors.password)}>
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: null }));
              }}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FieldHint error={errors.password} />
        </div>

        <label className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span>
            登录即表示同意 <span className="text-primary">《用户协议》</span> 和{' '}
            <span className="text-primary">《隐私政策》</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={!agreed || submitting}
          className="tap-target mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:bg-primary/40 disabled:text-white/70 disabled:active:scale-100"
        >
          {submitting ? '登录中...' : '登录'}
        </button>
      </form>

      <div className="mt-5 text-center">
        <span className="text-sm text-muted-foreground">没有账号？</span>
        <Link href="/register" className="tap-target ml-1 text-sm font-medium text-primary">
          立即注册
        </Link>
      </div>
    </div>
  );
}

function inputClass(error: FieldError) {
  return `flex items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
    error
      ? 'border-red-500'
      : 'border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary'
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
