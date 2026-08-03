import type { WrongQuestionOrganizerRuntimeMetadata } from '@repo/types/api/wrong-question-organizer';

export type WrongQuestionOrganizerSourceView = {
  tone: 'semantic' | 'local' | 'degraded';
  label: string;
  description: string;
};

export function formatOrganizerCountLabel(total: number, unresolved: number) {
  if (total === 0) {
    return '暂无错题';
  }
  if (unresolved === 0) {
    return `${total} 道 · 已全部掌握`;
  }
  return `${total} 道 · ${unresolved} 道未掌握`;
}

export function getOrganizerMasteryPercent(total: number, resolved: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((resolved / total) * 100);
}

export function getOrganizerConfidenceLabel(confidence: number) {
  if (confidence >= 0.8) {
    return '归类稳定';
  }
  if (confidence >= 0.6) {
    return '建议复核';
  }
  return '待整理';
}

export function getWrongQuestionOrganizerSourceView(
  runtime: WrongQuestionOrganizerRuntimeMetadata,
): WrongQuestionOrganizerSourceView {
  if (runtime.degraded) {
    return {
      tone: 'degraded',
      label: '安全回退',
      description: '语义判断未通过安全门，已使用本地规则完成整理。',
    };
  }
  if (
    runtime.source === 'hybrid_model' &&
    runtime.disposition === 'candidate_applied'
  ) {
    return {
      tone: 'semantic',
      label: '语义整理',
      description: '本次使用了受治理的语义判断，最终分类仍由本地规则确认。',
    };
  }
  return {
    tone: 'local',
    label: '本地规则',
    description: '本次由本地规则完成整理，错题功能不受影响。',
  };
}

export function getSubjectGroupHref({ id }: { id: string }) {
  const params = new URLSearchParams({ subjectGroupId: id });
  return `/error-book?${params.toString()}`;
}

export function getDeckHref({ id }: { id: string }) {
  const params = new URLSearchParams({ deckId: id });
  return `/error-book?${params.toString()}`;
}
