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

export function getWorkerObservabilityCountLabel(
  counts: WorkerObservabilitySummaryResponse['queue']['counts'],
) {
  return `等待 ${counts.waiting} · 处理中 ${counts.active} · 失败 ${counts.failed}`;
}
