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

export function getSubjectGroupHref({ id }: { id: string }) {
  const params = new URLSearchParams({ subjectGroupId: id });
  return `/error-book?${params.toString()}`;
}

export function getDeckHref({ id }: { id: string }) {
  const params = new URLSearchParams({ deckId: id });
  return `/error-book?${params.toString()}`;
}
