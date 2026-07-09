export type LogoutConfirmationState = 'idle' | 'confirming' | 'pending';

export type LogoutConfirmationInput = {
  confirming: boolean;
  pending: boolean;
};

export type LogoutConfirmationView = {
  state: LogoutConfirmationState;
  primaryLabel: string;
  secondaryLabel: string | null;
  title: string | null;
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
      title: '正在退出',
      description: '正在安全退出当前账号。',
    };
  }

  if (confirming) {
    return {
      state: 'confirming',
      primaryLabel: '退出登录',
      secondaryLabel: '继续学习',
      title: '退出当前账号？',
      description: '本机登录状态会清除，学习记录仍会保存在账号中。',
    };
  }

  return {
    state: 'idle',
    primaryLabel: '退出登录',
    secondaryLabel: null,
    title: null,
    description: null,
  };
}
