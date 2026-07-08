export type LogoutConfirmationState = 'idle' | 'confirming' | 'pending';

export type LogoutConfirmationInput = {
  confirming: boolean;
  pending: boolean;
};

export type LogoutConfirmationView = {
  state: LogoutConfirmationState;
  primaryLabel: string;
  secondaryLabel: string | null;
  description: string | null;
};

export function getLogoutConfirmationView({
  confirming,
  pending,
}: LogoutConfirmationInput): LogoutConfirmationView {
  if (pending) {
    return {
      state: 'pending',
      primaryLabel: '退出中...',
      secondaryLabel: null,
      description: '正在安全退出当前账号。',
    };
  }

  if (confirming) {
    return {
      state: 'confirming',
      primaryLabel: '确认退出',
      secondaryLabel: '取消',
      description: '退出后需要重新登录才能继续同步学习记录。',
    };
  }

  return {
    state: 'idle',
    primaryLabel: '退出登录',
    secondaryLabel: null,
    description: null,
  };
}
