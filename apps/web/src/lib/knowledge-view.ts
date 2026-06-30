import type {
  KnowledgeDocumentProcessResponse,
  KnowledgeDocumentResponse,
  KnowledgeDocumentStatus,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';
import type {
  BackgroundJobResponse,
  BackgroundJobStatus,
} from '@repo/types/api/background-job';

type KnowledgeDocumentStatusMeta = {
  label: string;
  className: string;
};

type KnowledgeDocumentAction = {
  label: string;
  force: boolean;
  disabled: boolean;
};

type KnowledgeBackgroundJobStatusMeta = {
  label: string;
  className: string;
  active: boolean;
};

export const KNOWLEDGE_PAGE_SEARCH_MIN_SCORE = 0.4;

const knowledgeDocumentStatusMeta: Record<KnowledgeDocumentStatus, KnowledgeDocumentStatusMeta> = {
  PENDING: {
    label: '待处理',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  PROCESSING: {
    label: '处理中',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  DONE: {
    label: '已入库',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  FAILED: {
    label: '处理失败',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

const knowledgeDocumentActions: Record<KnowledgeDocumentStatus, KnowledgeDocumentAction> = {
  PENDING: {
    label: '开始处理',
    force: false,
    disabled: false,
  },
  PROCESSING: {
    label: '处理中',
    force: false,
    disabled: true,
  },
  DONE: {
    label: '已入库',
    force: false,
    disabled: true,
  },
  FAILED: {
    label: '重新处理',
    force: true,
    disabled: false,
  },
};

const visibleBackgroundJobStatusMeta: Partial<
  Record<BackgroundJobStatus, KnowledgeBackgroundJobStatusMeta>
> = {
  QUEUED: {
    label: '排队中',
    className: 'bg-amber-50/80 text-amber-700 ring-amber-100',
    active: true,
  },
  ACTIVE: {
    label: '处理中',
    className: 'bg-sky-50/80 text-sky-700 ring-sky-100',
    active: true,
  },
  FAILED: {
    label: '处理失败',
    className: 'bg-red-50/80 text-red-700 ring-red-100',
    active: false,
  },
  STALE_SKIPPED: {
    label: '旧任务已跳过',
    className: 'bg-slate-50/80 text-slate-600 ring-slate-100',
    active: false,
  },
};

export function formatKnowledgeFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${formatCompactDecimal(size / 1024)} KB`;
  }

  return `${formatCompactDecimal(size / 1024 / 1024)} MB`;
}

export function formatKnowledgeDateTime(value: string | null) {
  if (!value) {
    return '未处理';
  }

  const date = new Date(value);
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${month}/${day} ${hour}:${minute}`;
}

export function getKnowledgeDocumentStatusMeta(status: KnowledgeDocumentStatus) {
  return knowledgeDocumentStatusMeta[status];
}

export function getKnowledgeDocumentAction(status: KnowledgeDocumentStatus) {
  return knowledgeDocumentActions[status];
}

export function getKnowledgeBackgroundJobStatusMeta(status: BackgroundJobStatus) {
  return visibleBackgroundJobStatusMeta[status] ?? null;
}

export function getKnowledgeProcessSuccessMessage(
  document: KnowledgeDocumentResponse,
  processed: KnowledgeDocumentProcessResponse,
) {
  if (processed.processing || processed.status === 'PROCESSING') {
    return `《${document.name}》已进入后台处理队列。`;
  }

  return `《${document.name}》处理完成，当前 ${processed.chunkCount} 个片段。`;
}

export function groupLatestKnowledgeJobsByDocumentId(jobs: BackgroundJobResponse[]) {
  const grouped = new Map<string, BackgroundJobResponse>();

  for (const job of jobs) {
    const previous = grouped.get(job.resourceId);
    if (!previous || new Date(job.updatedAt).getTime() > new Date(previous.updatedAt).getTime()) {
      grouped.set(job.resourceId, job);
    }
  }

  return grouped;
}

export function shouldCloseKnowledgeDocumentMenuOnPointerDown({
  menuOpen,
  pointerDownInsideMenuRoot,
}: {
  menuOpen: boolean;
  pointerDownInsideMenuRoot: boolean;
}) {
  return menuOpen && !pointerDownInsideMenuRoot;
}

export function getKnowledgeSearchHitSummary(hit: KnowledgeSearchHit) {
  const chunkIndex =
    typeof hit.metadata.chunkIndex === 'number' && Number.isFinite(hit.metadata.chunkIndex)
      ? String(hit.metadata.chunkIndex)
      : '?';

  return `《${hit.documentName}》 · 片段 ${chunkIndex} · 相似度 ${hit.score.toFixed(2)}`;
}

function formatCompactDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}
