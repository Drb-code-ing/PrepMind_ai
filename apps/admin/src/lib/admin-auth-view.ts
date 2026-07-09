export type AdminRole = 'STUDENT' | 'ADMIN';

export interface AdminGateUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export type AdminGateView =
  | {
      state: 'loading' | 'anonymous' | 'forbidden';
      title: string;
      description: string;
    }
  | {
      state: 'allowed';
      title: string;
      description: string;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAdminEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '请输入管理员邮箱';
  if (!EMAIL_PATTERN.test(trimmed)) return '请输入正确的邮箱格式';
  return null;
}

export function validateAdminPassword(value: string) {
  if (!value) return '请输入密码';
  if (value.length < 8) return '密码至少 8 位';
  if (value.length > 128) return '密码最多 128 位';
  return null;
}

export function getAdminGateView({
  hydrated,
  user,
}: {
  hydrated: boolean;
  user: AdminGateUser | null;
}): AdminGateView {
  if (!hydrated) {
    return {
      state: 'loading',
      title: '正在确认管理员身份',
      description: '后台管理需要先确认登录态和账号角色。',
    };
  }

  if (!user) {
    return {
      state: 'anonymous',
      title: '请先登录管理员账号',
      description: '后台管理独立运行，需要使用 ADMIN 账号登录后访问。',
    };
  }

  if (user.role !== 'ADMIN') {
    return {
      state: 'forbidden',
      title: '当前账号不是管理员',
      description: '后台管理只开放给 ADMIN 账号，普通学习账号不能访问系统级诊断入口。',
    };
  }

  return {
    state: 'allowed',
    title: '管理员身份已确认',
    description: '可以访问后台管理工具。',
  };
}
