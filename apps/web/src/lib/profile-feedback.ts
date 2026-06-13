import type { DailyIntensity, ExplanationStyle } from './learning-preferences.ts';

const explanationStyleLabels: Record<ExplanationStyle, string> = {
  direct: '先结论后推导',
  socratic: '引导式追问',
  detailed: '详细步骤拆解',
};

const dailyIntensityLabels: Record<DailyIntensity, string> = {
  light: '轻量 20 分钟',
  standard: '标准 35 分钟',
  intense: '强化 60 分钟',
};

const profileSuccessMessages = {
  name: '昵称已更新',
  preferences: '学习偏好已保存',
} as const;

export type ProfileSuccessAction = keyof typeof profileSuccessMessages;

export function getExplanationStyleLabel(style: ExplanationStyle) {
  return explanationStyleLabels[style];
}

export function getDailyIntensityLabel(intensity: DailyIntensity) {
  return dailyIntensityLabels[intensity];
}

export function getProfileSuccessMessage(action: ProfileSuccessAction) {
  return profileSuccessMessages[action];
}
