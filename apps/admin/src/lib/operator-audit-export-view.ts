import type {
  OperatorAuditExportDetailResponse,
  OperatorAuditExportStatus,
} from '@repo/types/api/operator-audit-export';

export type OperatorAuditExportTone = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

const statusPresentation: Record<
  OperatorAuditExportStatus,
  { label: string; tone: OperatorAuditExportTone; description: string }
> = {
  QUEUED: {
    label: '排队中',
    tone: 'queued',
    description: '申请已受理，正在等待单并发 Worker 处理。',
  },
  PROCESSING: {
    label: '生成中',
    tone: 'processing',
    description: 'Worker 正在按数据库快照生成证据包。',
  },
  READY: {
    label: '可下载',
    tone: 'ready',
    description: '证据包已生成；仅在有效期内且完整性检查通过时可下载。',
  },
  FAILED: {
    label: '生成失败',
    tone: 'failed',
    description: '本次生成未完成，可缩小时间范围后重新申请。',
  },
  EXPIRED: {
    label: '已过期',
    tone: 'expired',
    description: '证据包文件已删除；如仍需要，请重新提交申请。',
  },
};

export function getOperatorAuditExportStatusPresentation(status: OperatorAuditExportStatus) {
  return statusPresentation[status];
}

export function getOperatorAuditExportPollInterval(
  items: OperatorAuditExportDetailResponse[] | undefined,
): 5000 | false {
  return items?.some((item) => item.status === 'QUEUED' || item.status === 'PROCESSING')
    ? 5000
    : false;
}

export function validateOperatorAuditExportRange(startAt: string, endAt: string) {
  const errors: { startAt?: string; endAt?: string } = {};
  if (!startAt) errors.startAt = '请选择开始时间。';
  if (!endAt) errors.endAt = '请选择结束时间。';
  if (errors.startAt || errors.endAt) return errors;

  const start = Date.parse(startAt);
  const end = Date.parse(endAt);
  if (!Number.isFinite(start)) errors.startAt = '开始时间格式无效。';
  if (!Number.isFinite(end)) errors.endAt = '结束时间格式无效。';
  if (errors.startAt || errors.endAt) return errors;
  if (start >= end) {
    errors.endAt = '结束时间必须晚于开始时间。';
  } else if (end - start > 31 * 24 * 60 * 60 * 1000) {
    errors.endAt = '时间范围不能超过 31 天。';
  }
  return errors;
}

export function canDownloadOperatorAuditExport(item: OperatorAuditExportDetailResponse) {
  return item.status === 'READY' && item.canDownload;
}

export type OperatorAuditExportPendingRequest = {
  clientRequestId: string;
  requestSignature: string;
};

export type OperatorAuditExportRequestEvent =
  | {
      type: 'submit';
      requestSignature: string;
      generatedClientRequestId: string;
    }
  | { type: 'retryable-failure' }
  | { type: 'request-changed' | 'success' | 'final-failure' };

export function transitionOperatorAuditExportRequest(
  pending: OperatorAuditExportPendingRequest | null,
  event: OperatorAuditExportRequestEvent,
): OperatorAuditExportPendingRequest | null {
  if (event.type === 'retryable-failure') return pending;
  if (event.type !== 'submit') return null;
  if (pending?.requestSignature === event.requestSignature) return pending;
  return {
    clientRequestId: event.generatedClientRequestId,
    requestSignature: event.requestSignature,
  };
}

export function mergeOperatorAuditExportPages(pages: OperatorAuditExportDetailResponse[][]) {
  const seen = new Set<string>();
  const merged: OperatorAuditExportDetailResponse[] = [];
  for (const page of pages) {
    for (const item of page) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

interface DownloadAnchor {
  download: string;
  href: string;
  click(): void;
  remove(): void;
}

interface DownloadDependencies {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): DownloadAnchor;
}

export function triggerOperatorAuditExportDownload(
  file: { blob: Blob; fileName: string },
  dependencies: DownloadDependencies = {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement('a'),
  },
) {
  const objectUrl = dependencies.createObjectURL(file.blob);
  let anchor: DownloadAnchor | undefined;
  try {
    anchor = dependencies.createAnchor();
    anchor.href = objectUrl;
    anchor.download = file.fileName;
    anchor.click();
  } finally {
    anchor?.remove();
    dependencies.revokeObjectURL(objectUrl);
  }
}
