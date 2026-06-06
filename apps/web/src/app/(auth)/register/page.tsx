"use client";

import Link from "next/link";
import { useState } from "react";
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validateConfirmPassword,
  type FieldError,
} from "@/lib/validators";

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs text-red-500">{error}</p>;
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<string, FieldError>>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  function setFieldError(field: string, error: FieldError) {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  function handleBlur(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "email") setFieldError("email", validateEmail(email));
    if (field === "username") setFieldError("username", validateUsername(username));
    if (field === "password") setFieldError("password", validatePassword(password));
    if (field === "confirm") setFieldError("confirm", validateConfirmPassword(confirm, password));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const allTouched = { email: true, username: true, password: true, confirm: true };
    setTouched(allTouched);

    const errs = {
      email: validateEmail(email),
      username: validateUsername(username),
      password: validatePassword(password),
      confirm: validateConfirmPassword(confirm, password),
    };
    setErrors(errs);

    if (Object.values(errs).some(Boolean)) return;
    if (!agreed) return;

    // TODO: 注册提交逻辑
  }

  const inputClass = (field: string) =>
    `flex items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
      errors[field] && touched[field]
        ? "border-red-500"
        : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
    }`;

  return (
    <div className="flex flex-1 flex-col px-6 pt-16 pb-8">
      {/* Logo + 标语 */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-3xl">🧠</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
        <p className="text-sm text-muted-foreground">加入 PrepMind AI，开始高效备考</p>
      </div>

      {/* 表单 */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {/* 邮箱 */}
        <div>
          <div className={inputClass("email")}>
            <input
              type="email"
              inputMode="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (touched.email) setFieldError("email", null); }}
              onBlur={() => handleBlur("email")}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {touched.email && <FieldHint error={errors.email} />}
        </div>

        {/* 用户名 */}
        <div>
          <div className={inputClass("username")}>
            <input
              type="text"
              placeholder="用户名（2-20 个字符）"
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (touched.username) setFieldError("username", null); }}
              onBlur={() => handleBlur("username")}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {touched.username && <FieldHint error={errors.username} />}
        </div>

        {/* 密码 */}
        <div>
          <div className={inputClass("password")}>
            <input
              type="password"
              placeholder="设置密码（6-20 位，含字母+数字）"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (touched.password) setFieldError("password", null); }}
              onBlur={() => handleBlur("password")}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {touched.password && <FieldHint error={errors.password} />}
        </div>

        {/* 确认密码 */}
        <div>
          <div className={inputClass("confirm")}>
            <input
              type="password"
              placeholder="确认密码"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); if (touched.confirm) setFieldError("confirm", null); }}
              onBlur={() => handleBlur("confirm")}
              className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          {touched.confirm && <FieldHint error={errors.confirm} />}
        </div>

        {/* 注册按钮 */}
        <button
          type="submit"
          disabled={!agreed}
          className={`tap-target mt-2 flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium transition-all ${
            agreed
              ? "bg-primary text-white hover:bg-primary-dark active:scale-[0.98]"
              : "bg-primary/40 text-white/70 cursor-not-allowed"
          }`}
        >
          注册
        </button>
      </form>

      {/* 协议勾选 */}
      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
        />
        <span>
          注册即表示同意 <span className="text-primary">《用户协议》</span> 和{" "}
          <span className="text-primary">《隐私政策》</span>
        </span>
      </div>

      {/* 登录链接 */}
      <div className="mt-6 text-center">
        <span className="text-sm text-muted-foreground">已有账号？</span>
        <Link href="/login" className="tap-target text-sm font-medium text-primary ml-1">
          去登录
        </Link>
      </div>

      <div className="mt-auto" />
    </div>
  );
}
