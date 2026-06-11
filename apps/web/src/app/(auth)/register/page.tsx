'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useRegister } from '@/hooks/use-auth';

type FieldError = string | null;

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs text-red-500">{error}</p>;
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
    if (!agreed) {
      setServerError('请先同意用户协议和隐私政策');
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
    <div className="flex flex-1 flex-col px-6 pb-8 pt-16">
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary">
          PM
        </div>
        <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
        <p className="text-sm text-muted-foreground">加入 PrepMind AI，开始高效备考</p>
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
              placeholder="邮箱地址"
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
          <div className={inputClass(errors.username)}>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrors((prev) => ({ ...prev, username: null }));
              }}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FieldHint error={errors.username} />
        </div>

        <div>
          <div className={inputClass(errors.password)}>
            <input
              type="password"
              placeholder="设置密码，至少 8 位"
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

        <div>
          <div className={inputClass(errors.confirm)}>
            <input
              type="password"
              placeholder="确认密码"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setErrors((prev) => ({ ...prev, confirm: null }));
              }}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <FieldHint error={errors.confirm} />
        </div>

        <label className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span>
            注册即表示同意 <span className="text-primary">《用户协议》</span> 和{' '}
            <span className="text-primary">《隐私政策》</span>
          </span>
        </label>

        <button
          type="submit"
          disabled={!agreed || submitting}
          className="tap-target mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-white transition-all hover:bg-primary-dark active:scale-[0.98] disabled:bg-primary/40 disabled:text-white/70 disabled:active:scale-100"
        >
          {submitting ? '注册中...' : '注册'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-muted-foreground">已有账号？</span>
        <Link href="/login" className="tap-target ml-1 text-sm font-medium text-primary">
          去登录
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
