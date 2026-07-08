export type FieldError = string | null;
export type AuthFieldValidator = (value: string) => FieldError;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthEmail(value: string): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return '请输入邮箱';
  if (!EMAIL_PATTERN.test(trimmed)) return '请输入正确的邮箱格式';
  return null;
}

export function validateAuthUsername(value: string): FieldError {
  const trimmed = value.trim();
  if (!trimmed) return '请输入用户名';
  if (trimmed.length > 50) return '用户名最多 50 个字符';
  return null;
}

export function validateLoginPassword(value: string): FieldError {
  if (!value) return '请输入密码';
  if (value.length > 128) return '密码最多 128 位';
  return null;
}

export function validateRegisterPassword(value: string): FieldError {
  if (!value) return '请输入密码';
  if (value.length < 8) return '密码至少 8 位';
  if (value.length > 128) return '密码最多 128 位';
  return null;
}

export function validateConfirmPassword(value: string, password: string): FieldError {
  if (!value) return '请确认密码';
  if (value !== password) return '两次密码不一致';
  return null;
}

export function getAuthFieldChangeError({
  feedbackActive,
  value,
  validate,
}: {
  feedbackActive: boolean;
  value: string;
  validate: AuthFieldValidator;
}): FieldError {
  return feedbackActive ? validate(value) : null;
}
