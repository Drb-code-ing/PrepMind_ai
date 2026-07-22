import type {
  KnowledgeAgentSuggestionResponse,
  KnowledgeDedupItem,
  KnowledgeOrganizerCollection,
} from '@repo/types/api/knowledge-agent';

export type KnowledgeDedupTone = 'info' | 'warning';
export type KnowledgeAgentSourceView = {
  tone: 'semantic' | 'local' | 'degraded';
  label: string;
  description: string;
};

export function getKnowledgeAgentEmptyMessage() {
  return '处理更多资料后，我会在这里提示重复、版本更新和可整理的资料集合。';
}

export function getKnowledgeDedupTone(
  item: Pick<KnowledgeDedupItem, 'severity'>,
): KnowledgeDedupTone {
  return item.severity === 'warning' ? 'warning' : 'info';
}

export function getKnowledgeAgentSourceView(
  response: KnowledgeAgentSuggestionResponse,
): KnowledgeAgentSourceView {
  const runtimes = [response.dedup.runtime, response.organizer.runtime];

  if (runtimes.some((runtime) => runtime.degraded)) {
    return {
      tone: 'degraded',
      label: '本地规则建议',
      description: '语义判断暂不可用，已安全回退；上传、处理与检索不受影响。',
    };
  }

  if (
    runtimes.some(
      (runtime) =>
        runtime.source === 'hybrid_model' && runtime.disposition === 'candidate_applied',
    )
  ) {
    return {
      tone: 'semantic',
      label: '语义建议',
      description: '已结合资料语义生成只读整理建议。',
    };
  }

  return {
    tone: 'local',
    label: '本地规则建议',
    description: '当前使用本地规则，资料功能不受影响。',
  };
}

export function getKnowledgeOrganizerCollectionSummary(
  collection: Pick<KnowledgeOrganizerCollection, 'name' | 'documentIds'>,
) {
  return `${collection.name} · ${collection.documentIds.length} 份资料`;
}

export function hasKnowledgeAgentSuggestions(
  suggestions: Pick<KnowledgeAgentSuggestionResponse, 'dedup' | 'organizer'>,
) {
  return (
    suggestions.dedup.items.some((item) => item.kind !== 'insufficient_signal') ||
    suggestions.organizer.collections.length > 0 ||
    suggestions.organizer.tags.length > 0
  );
}
