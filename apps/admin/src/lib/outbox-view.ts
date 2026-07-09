import type { OutboxEventStatus } from '@repo/types/api/outbox';

export type OutboxTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface OutboxErrorGuidanceInput {
  lastErrorCode: string | null;
  lastErrorPreview: string | null;
}

export interface OutboxAftercareInput {
  eventId: string;
  status: OutboxEventStatus;
  requeued: boolean;
}

export function isOutboxEventRequeueable(status: OutboxEventStatus) {
  return status === 'FAILED' || status === 'DEAD';
}

export function getOutboxReadOnlyReason(status: OutboxEventStatus) {
  if (status === 'PENDING') return '事件正在等待 worker claim，当前不需要重新入队。';
  if (status === 'PROCESSING') return '事件正在处理，避免和 worker 并发操作。';
  if (status === 'SUCCEEDED') return '事件已经成功处理，不能重新入队。';
  return null;
}

export function getOutboxAftercare(input: OutboxAftercareInput) {
  if (!input.requeued) {
    return {
      title: '重新入队后如何验证',
      message:
        'requeue 会把 FAILED / DEAD 事件放回 PENDING，等待 worker dispatcher 后续按状态机 claim；它不会立刻执行 handler，也不会修改 payload 或强制成功。',
      links: {
        worker: { href: '/worker', label: '查看 Worker Readiness' },
        audit: { href: '/audit', label: '查看操作审计' },
      },
    };
  }

  return {
    title: `已重新入队：${input.eventId}`,
    message: `当前事件已回到 ${input.status}。这不会立刻执行 handler；请等待 worker dispatcher 下一轮 claim，并在 Worker Readiness 和操作审计中确认恢复信号。`,
    links: {
      worker: { href: '/worker', label: '查看 Worker Readiness' },
      audit: { href: '/audit', label: '查看操作审计' },
    },
  };
}

export function getOutboxStatusTone(status: OutboxEventStatus): OutboxTone {
  if (status === 'DEAD') return 'danger';
  if (status === 'FAILED') return 'warning';
  if (status === 'PROCESSING') return 'info';
  if (status === 'SUCCEEDED') return 'success';
  return 'neutral';
}

export function getOutboxErrorGuidance(input: OutboxErrorGuidanceInput): {
  tone: OutboxTone;
  message: string;
} {
  const code = input.lastErrorCode?.toUpperCase() ?? '';
  const preview = input.lastErrorPreview?.toLowerCase() ?? '';
  const isHandlerMissing =
    code.includes('HANDLER_NOT_FOUND') ||
    code.includes('NO_HANDLER') ||
    preview.includes('no outbox handler') ||
    preview.includes('handler not found') ||
    preview.includes('no handler');

  if (isHandlerMissing) {
    return {
      tone: 'danger',
      message: '这个事件缺少 handler，先修复代码或注册 handler，不要盲目重新入队。',
    };
  }

  const isInvalidPayload =
    code.includes('INVALID_PAYLOAD') ||
    code.includes('INVALID_METADATA') ||
    preview.includes('payload') ||
    preview.includes('metadata') ||
    preview.includes('must be');

  if (isInvalidPayload) {
    return {
      tone: 'danger',
      message:
        '这个事件的 payload / metadata 数据契约不合法，先修复事件生产方或数据来源，再考虑重新入队。',
    };
  }

  const isTransient =
    code.includes('TIMEOUT') ||
    code.includes('ECONNRESET') ||
    code.includes('ECONNREFUSED') ||
    code.includes('REDIS') ||
    code.includes('DATABASE') ||
    preview.includes('timeout') ||
    preview.includes('timed out') ||
    preview.includes('redis') ||
    preview.includes('database') ||
    preview.includes('connection');

  if (isTransient) {
    return {
      tone: 'warning',
      message: '看起来像依赖连接、Redis、数据库或超时类问题；请确认依赖已经恢复，再重新入队。',
    };
  }

  if (input.lastErrorCode || input.lastErrorPreview) {
    return {
      tone: 'warning',
      message: '错误类型不明确；重新入队前请先查看 worker 日志、Worker Readiness 和相关部署状态。',
    };
  }

  return {
    tone: 'neutral',
    message: '当前事件没有可见错误摘要，操作前请先确认业务上下文。',
  };
}

export function normalizeOutboxReason(value: string) {
  const reason = value.trim();
  return reason ? { reason: reason.slice(0, 300) } : {};
}

export function formatOutboxTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
