import type {
  WorkerObservabilityStatus,
  WorkerObservabilitySummaryResponse,
} from '@repo/types/api/worker-observability';

export type WorkerObservabilityTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export function getWorkerObservabilityTone(
  status: WorkerObservabilityStatus,
): WorkerObservabilityTone {
  if (status === 'healthy') return 'success';
  if (status === 'attention') return 'warning';
  if (status === 'degraded') return 'danger';
  return 'neutral';
}

export function getWorkerObservabilityWorkerLabel(
  workers: WorkerObservabilitySummaryResponse['workers'],
) {
  return workers.onlineCount > 0 ? 'worker 在线' : '暂未检测到 worker';
}

export function getWorkerObservabilityUnavailableMessage() {
  return '后台健康状态暂不可用';
}

export function shouldShowWorkerObservabilityStrip(
  documentCount: number,
  isPollingProcessingState: boolean,
) {
  return documentCount > 0 || isPollingProcessingState;
}

export function getWorkerObservabilityPollInterval(
  summary: WorkerObservabilitySummaryResponse | undefined,
  isPollingProcessingState: boolean,
  pollIntervalMs: number,
) {
  if (isPollingProcessingState) return pollIntervalMs;
  if (!summary) return false;

  const hasQueueActivity =
    summary.queue.counts.waiting > 0 ||
    summary.queue.counts.active > 0 ||
    summary.queue.counts.delayed > 0;

  if (hasQueueActivity || summary.backgroundJobs.activeCount > 0) {
    return pollIntervalMs;
  }

  if (
    summary.signals.status === 'attention' ||
    summary.signals.status === 'degraded'
  ) {
    return pollIntervalMs;
  }

  return false;
}

export function getWorkerObservabilityCountLabel(
  counts: WorkerObservabilitySummaryResponse['queue']['counts'],
) {
  return `等待 ${counts.waiting} · 处理中 ${counts.active} · 失败 ${counts.failed}`;
}
