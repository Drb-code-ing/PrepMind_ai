'use client';

import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLogin } from '@/hooks/use-auth';
import type { FieldError } from '@/lib/auth-form-validation';
import {
  getAuthFieldChangeError,
  validateAuthEmail,
  validateLoginPassword,
} from '@/lib/auth-form-validation';
import { getAuthAgreementError, isAuthSubmitDisabled } from '@/lib/auth-submit-state';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<{ email?: FieldError; password?: FieldError }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [submitted, setSubmitted] = useState(false);
  const [agreementError, setAgreementError] = useState<FieldError>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setServerError(null);

    const nextErrors = {
      email: validateAuthEmail(email),
      password: validateLoginPassword(password),
    };
    const nextAgreementError = getAuthAgreementError(agreed);
    setErrors(nextErrors);
    setAgreementError(nextAgreementError);

    if (nextErrors.email || nextErrors.password || nextAgreementError) return;

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
    <main className="mx-auto flex h-full w-full max-w-[27rem] flex-col justify-center">
      <AuthHeader title="回到学习流" subtitle="继续聊天、识题和复盘错题。" />

      <section className="pm-auth-panel pm-enter rounded-[1.35rem] p-[clamp(0.8rem,2dvh,1rem)]">
        <div className="mb-3 flex items-center justify-between border-b border-[#232323]/10 pb-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#1d6e65]">
              EMAIL ACCESS
            </p>
            <p className="mt-0.5 text-xs text-[#6e6678]">手机号登录暂未开放，请使用邮箱。</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-[#1d6e65]" aria-hidden="true" />
        </div>

        <ErrorBanner message={serverError} />

        <form className="flex flex-col gap-2" noValidate onSubmit={handleSubmit}>
          <AuthField
            id="login-email"
            error={errors.email}
            icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            inputProps={{
              type: 'email',
              inputMode: 'email',
              autoComplete: 'email',
              placeholder: '邮箱地址',
              value: email,
              onChange: (e) => {
                const nextValue = e.target.value;
                setEmail(nextValue);
                setErrors((prev) => ({
                  ...prev,
                  email: getAuthFieldChangeError({
                    feedbackActive: submitted || !!touched.email,
                    value: nextValue,
                    validate: validateAuthEmail,
                  }),
                }));
              },
              onBlur: () => {
                setTouched((prev) => ({ ...prev, email: true }));
                setErrors((prev) => ({ ...prev, email: validateAuthEmail(email) }));
              },
            }}
          />

          <AuthField
            id="login-password"
            error={errors.password}
            icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            inputProps={{
              type: 'password',
              autoComplete: 'current-password',
              placeholder: '密码',
              value: password,
              onChange: (e) => {
                const nextValue = e.target.value;
                setPassword(nextValue);
                setErrors((prev) => ({
                  ...prev,
                  password: getAuthFieldChangeError({
                    feedbackActive: submitted || !!touched.password,
                    value: nextValue,
                    validate: validateLoginPassword,
                  }),
                }));
              },
              onBlur: () => {
                setTouched((prev) => ({ ...prev, password: true }));
                setErrors((prev) => ({ ...prev, password: validateLoginPassword(password) }));
              },
            }}
          />

          <AgreementRow
            checked={agreed}
            error={agreementError}
            actionText="登录"
            onChange={(checked) => {
              setAgreed(checked);
              setAgreementError(checked || !submitted ? null : getAuthAgreementError(false));
            }}
          />

          <SubmitButton submitting={submitting} text="登录" loadingText="登录中..." />
        </form>

        <div className="mt-1.5 flex min-h-9 items-center justify-center text-sm">
          <span className="text-[#756d82]">没有账号？</span>
          <Link
            href="/register"
            className="ml-1 inline-flex items-center py-2 font-semibold text-[#165f58]"
          >
            立即注册
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pm-enter mb-[clamp(0.65rem,1.8dvh,1rem)] text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[#161616]/10 bg-[#fff4bc] text-base font-black text-[#165f58] shadow-[0_10px_28px_rgba(28,89,81,0.12)]">
        PM
      </div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#756d82]">
        PrepMind AI
      </p>
      <h1 className="mt-0.5 text-[clamp(1.55rem,6vw,2rem)] font-black leading-tight text-[#23192f]">
        {title}
      </h1>
      <p className="mt-1 text-sm leading-5 text-[#756d82]">{subtitle}</p>
    </div>
  );
}

function AuthField({
  id,
  error,
  icon,
  inputProps,
}: {
  id: string;
  error: FieldError | undefined;
  icon: React.ReactNode;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  const hintId = `${id}-hint`;

  return (
    <div>
      <div className={inputClass(error)}>
        <span className={error ? 'text-red-500' : 'text-[#1d6e65]'}>{icon}</span>
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={hintId}
          {...inputProps}
          className="tap-target h-11 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#251b30] outline-none placeholder:text-[#8a8095]"
        />
      </div>
      <FieldHint id={hintId} error={error} />
    </div>
  );
}

function AgreementRow({
  checked,
  error,
  actionText,
  onChange,
}: {
  checked: boolean;
  error: FieldError;
  actionText: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div>
      <label
        className={`flex min-h-8 items-start gap-2 text-xs leading-5 ${
          error ? 'text-[#c43d3d]' : 'text-[#756d82]'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#232323]/20 accent-[#17766b]"
        />
        <span>
          {actionText}即表示同意
          <span className="font-semibold text-[#165f58]">《用户协议》</span> 和{' '}
          <span className="font-semibold text-[#165f58]">《隐私政策》</span>
        </span>
      </label>
      <FieldHint id="login-agreement-hint" error={error} />
    </div>
  );
}

function SubmitButton({
  submitting,
  text,
  loadingText,
}: {
  submitting: boolean;
  text: string;
  loadingText: string;
}) {
  return (
    <button
      type="submit"
      disabled={isAuthSubmitDisabled({ submitting })}
      className="tap-target mt-1 flex h-11 w-full items-center justify-center rounded-[1rem] bg-[#151515] text-sm font-bold text-white shadow-[0_14px_30px_rgba(21,21,21,0.16)] transition-all hover:bg-[#272727] active:translate-y-px disabled:bg-[#d7d2dc] disabled:text-[#756d82] disabled:shadow-none disabled:active:translate-y-0"
    >
      {submitting ? loadingText : text}
    </button>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="mb-3 rounded-[1rem] border border-red-100 bg-red-50/80 px-3 py-2 text-xs font-medium leading-5 text-[#b53a3a]">
      {message}
    </div>
  );
}

function FieldHint({ id, error }: { id: string; error: FieldError | undefined }) {
  return (
    <p id={id} className="min-h-[1rem] pt-1 text-[11px] font-medium leading-none text-[#d34a4a]">
      {error ?? ''}
    </p>
  );
}

function inputClass(error: FieldError | undefined) {
  return `flex h-11 items-center gap-2 rounded-[1rem] border bg-white/88 px-3 transition-all ${
    error
      ? 'border-[#f0a5a5] ring-2 ring-[#fff1f1]'
      : 'border-[#232323]/12 focus-within:border-[#17766b] focus-within:ring-2 focus-within:ring-[#d8f8f0]'
  }`;
}
