import type { OutboxEventStatus } from '@repo/types/api/outbox';

export type OutboxTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface OutboxErrorGuidanceInput {
  lastErrorCode: string | null;
  lastErrorPreview: string | null;
}

export function isOutboxEventRequeueable(status: OutboxEventStatus) {
  return status === 'FAILED' || status === 'DEAD';
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

  if (input.lastErrorCode || input.lastErrorPreview) {
    return {
      tone: 'warning',
      message: '重新入队前请确认依赖、数据快照和错误原因已经处理。',
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
