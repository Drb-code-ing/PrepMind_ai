import type {
  KnowledgeDedupItem,
  KnowledgeOrganizerCollection,
} from '@repo/types/api/knowledge-agent';

export type KnowledgeDedupTone = 'info' | 'warning';

export function getKnowledgeAgentEmptyMessage() {
  return '处理更多资料后，我会在这里提示重复、版本更新和可整理的资料集合。';
}

export function getKnowledgeDedupTone(
  item: Pick<KnowledgeDedupItem, 'severity'>,
): KnowledgeDedupTone {
  return item.severity === 'warning' ? 'warning' : 'info';
}

export function getKnowledgeOrganizerCollectionSummary(
  collection: Pick<KnowledgeOrganizerCollection, 'name' | 'documentIds'>,
) {
  return `${collection.name} · ${collection.documentIds.length} 份资料`;
}
