// 表单验证正则和工具函数

export const VALIDATORS = {
  /** 手机号：1 开头，11 位数字 */
  phone: /^1[3-9]\d{9}$/,
  /** 邮箱：标准邮箱格式 */
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  /** 验证码：6 位纯数字 */
  smsCode: /^\d{6}$/,
  /** 密码：6-20 位，至少包含字母和数字 */
  password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,20}$/,
  /** 用户名：2-20 位，中英文、数字、下划线 */
  username: /^[一-龥a-zA-Z0-9_]{2,20}$/,
};

export type FieldError = string | null | undefined;

/** 验证手机号 */
export function validatePhone(value: string): FieldError {
  if (!value.trim()) return "请输入手机号";
  if (!VALIDATORS.phone.test(value)) return "请输入正确的手机号";
  return null;
}

/** 验证邮箱 */
export function validateEmail(value: string): FieldError {
  if (!value.trim()) return "请输入邮箱";
  if (!VALIDATORS.email.test(value)) return "请输入正确的邮箱格式";
  return null;
}

/** 验证短信验证码 */
export function validateSmsCode(value: string): FieldError {
  if (!value.trim()) return "请输入验证码";
  if (!VALIDATORS.smsCode.test(value)) return "验证码为 6 位数字";
  return null;
}

/** 验证密码 */
export function validatePassword(value: string): FieldError {
  if (!value.trim()) return "请输入密码";
  if (value.length < 6) return "密码至少 6 位";
  if (value.length > 20) return "密码最多 20 位";
  if (!VALIDATORS.password.test(value)) return "密码需包含字母和数字";
  return null;
}

/** 验证确认密码 */
export function validateConfirmPassword(value: string, password: string): FieldError {
  if (!value.trim()) return "请确认密码";
  if (value !== password) return "两次密码不一致";
  return null;
}

/** 验证用户名 */
export function validateUsername(value: string): FieldError {
  if (!value.trim()) return "请输入用户名";
  if (value.length < 2) return "用户名至少 2 个字符";
  if (value.length > 20) return "用户名最多 20 个字符";
  if (!VALIDATORS.username.test(value)) return "支持中英文、数字和下划线";
  return null;
}
