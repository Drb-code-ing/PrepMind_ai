"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { validatePhone, validateSmsCode, validateEmail, validatePassword, type FieldError } from "@/lib/validators";
import { useUserStore, FIXED_SMS_CODE } from "@/stores/userStore";

type TabType = "phone" | "email";

function FieldHint({ error }: { error: FieldError }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs text-red-500">{error}</p>;
}

export default function LoginPage() {
  const router = useRouter();
  const loginByPhone = useUserStore((s) => s.loginByPhone);
  const loginByEmail = useUserStore((s) => s.loginByEmail);

  const [activeTab, setActiveTab] = useState<TabType>("phone");

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errors, setErrors] = useState<Partial<Record<string, FieldError>>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function setFieldError(field: string, error: FieldError) {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  function handleBlur(field: string, value: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "phone") setFieldError("phone", validatePhone(value));
    if (field === "smsCode") setFieldError("smsCode", validateSmsCode(value));
    if (field === "email") setFieldError("email", validateEmail(value));
    if (field === "password") setFieldError("password", validatePassword(value));
  }

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    setErrors({});
    setTouched({});
    setServerError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (activeTab === "phone") {
      setTouched({ phone: true, smsCode: true });
      const phoneErr = validatePhone(phone);
      const codeErr = validateSmsCode(smsCode);
      setErrors({ phone: phoneErr, smsCode: codeErr });
      if (phoneErr || codeErr) return;

      const result = loginByPhone(phone, smsCode);
      if (!result.ok) {
        setServerError(result.error!);
        return;
      }
    } else {
      setTouched({ email: true, password: true });
      const emailErr = validateEmail(email);
      const passErr = validatePassword(password);
      setErrors({ email: emailErr, password: passErr });
      if (emailErr || passErr) return;

      const result = loginByEmail(email, password);
      if (!result.ok) {
        setServerError(result.error!);
        return;
      }
    }

    // 登录成功 → 跳转 chat 页面
    router.push("/chat");
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-16 pb-8">
      {/* Logo + 标语 */}
      <div className="flex flex-col items-center gap-2 mb-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-3xl">🧠</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">PrepMind AI</h1>
        <p className="text-sm text-muted-foreground">智能备考，高效复习</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex rounded-xl bg-muted p-1 mb-6">
        <button
          type="button"
          onClick={() => switchTab("phone")}
          className={`tap-target flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === "phone" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          手机号登录
        </button>
        <button
          type="button"
          onClick={() => switchTab("email")}
          className={`tap-target flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
            activeTab === "email" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          邮箱登录
        </button>
      </div>

      {/* 服务端错误 */}
      {serverError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      {/* 表单 */}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {activeTab === "phone" ? (
          <>
            {/* 手机号 */}
            <div>
              <div className={`flex items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
                errors.phone && touched.phone ? "border-red-500" : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
              }`}>
                <span className="mr-2 text-sm text-muted-foreground">+86</span>
                <span className="mr-2 text-border">|</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="请输入手机号"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (touched.phone) setFieldError("phone", null); }}
                  onBlur={() => handleBlur("phone", phone)}
                  className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {touched.phone && <FieldHint error={errors.phone} />}
            </div>

            {/* 验证码 */}
            <div>
              <div className="flex gap-3">
                <div className={`flex flex-1 items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
                  errors.smsCode && touched.smsCode ? "border-red-500" : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
                }`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={`验证码（测试: ${FIXED_SMS_CODE}）`}
                    value={smsCode}
                    onChange={(e) => { setSmsCode(e.target.value); if (touched.smsCode) setFieldError("smsCode", null); }}
                    onBlur={() => handleBlur("smsCode", smsCode)}
                    className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (validatePhone(phone)) {
                      setTouched((p) => ({ ...p, phone: true }));
                      setFieldError("phone", validatePhone(phone));
                    }
                  }}
                  className="tap-target shrink-0 rounded-xl border border-primary bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 active:scale-[0.98]"
                >
                  获取验证码
                </button>
              </div>
              {touched.smsCode && <FieldHint error={errors.smsCode} />}
            </div>
          </>
        ) : (
          <>
            {/* 邮箱 */}
            <div>
              <div className={`flex items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
                errors.email && touched.email ? "border-red-500" : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
              }`}>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (touched.email) setFieldError("email", null); }}
                  onBlur={() => handleBlur("email", email)}
                  className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {touched.email && <FieldHint error={errors.email} />}
            </div>

            {/* 密码 */}
            <div>
              <div className={`flex items-center rounded-xl border bg-muted/50 px-4 py-3 transition-all ${
                errors.password && touched.password ? "border-red-500" : "border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
              }`}>
                <input
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (touched.password) setFieldError("password", null); }}
                  onBlur={() => handleBlur("password", password)}
                  className="tap-target flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              {touched.password && <FieldHint error={errors.password} />}
            </div>

            {/* 忘记密码 */}
            <div className="text-right">
              <button type="button" className="tap-target text-xs text-primary">
                忘记密码？
              </button>
            </div>
          </>
        )}

        {/* 主按钮 */}
        <button
          type="submit"
          className="tap-target mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-white text-sm font-medium transition-all hover:bg-primary-dark active:scale-[0.98]"
        >
          登录
        </button>
      </form>

      {/* 注册链接 */}
      <div className="mt-4 text-center">
        <span className="text-sm text-muted-foreground">没有账号？</span>
        <Link href="/register" className="tap-target text-sm font-medium text-primary ml-1">
          立即注册
        </Link>
      </div>

      {/* 协议勾选 */}
      <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary" />
        <span>
          登录即表示同意 <span className="text-primary">《用户协议》</span> 和{" "}
          <span className="text-primary">《隐私政策》</span>
        </span>
      </div>

      {/* 分割线 */}
      <div className="mt-auto flex items-center gap-4 pt-8">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">其他登录方式</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* 快捷登录提示 */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <div className="tap-target flex h-12 w-12 items-center justify-center rounded-full bg-[#07C160]/10">
            <WechatIcon className="h-6 w-6 text-[#07C160]" />
          </div>
          <span className="text-[11px] text-muted-foreground">微信</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="tap-target flex h-12 w-12 items-center justify-center rounded-full bg-[#1677FF]/10">
            <AlipayIcon className="h-6 w-6 text-[#1677FF]" />
          </div>
          <span className="text-[11px] text-muted-foreground">支付宝</span>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        微信 / 支付宝快捷登录即将上线
      </p>
    </div>
  );
}

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zM14.59 13.2c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.983a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z" />
    </svg>
  );
}

function AlipayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.422 15.358c-3.32-1.326-6.034-2.97-6.034-2.97s1.285-2.847 1.643-4.454h-4.03v-1.19h4.536V5.74h-4.536V3h-2.4v2.74H8.563v1.004h4.536v1.19H9.09v1.014h6.367c-.263 1.078-1.143 2.58-2.367 3.72a21.69 21.69 0 0 1 2.563 1.68c1.628-.894 3.62-1.63 5.769-1.63 1.876 0 3.52.533 4.626 1.344l-2.626 1.1c-.218-.374-.842-.66-1.596-.66-1.2 0-2.636.576-4.01 1.26l-.022.006c1.127 1.397 1.774 2.883 1.774 2.883s-2.507.46-4.76.46c-3.222 0-6.082-1.323-7.488-3.392-.253.628-.39 1.32-.39 2.048C.576 19.944 4.746 24 9.924 24c5.178 0 9.348-4.056 9.348-9.032 0-.518-.06-1.024-.168-1.52a8.39 8.39 0 0 0 2.318 1.91zm-13.522 4.54c-2.37 0-4.596-1.083-6.11-2.795.275-.376.766-.86 1.564-1.332 1.518 1.59 3.81 2.527 6.246 2.527.794 0 1.556-.1 2.276-.292a9.26 9.26 0 0 1-3.976 1.892zm-6.33-4.077c-1.308-1.435-2.124-3.132-2.124-4.99 0-.324.04-.64.108-.95a7.94 7.94 0 0 0 1.86 2.153c-.288.774-.462 1.626-.462 2.514 0 .624.084 1.23.24 1.806a7.53 7.53 0 0 1 .378-.533z" />
    </svg>
  );
}
