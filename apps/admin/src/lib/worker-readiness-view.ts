import type {
  WorkerReadinessCheckStatus,
  WorkerReadinessOverallStatus,
  WorkerReadinessResponse,
} from '@repo/types/api/worker-readiness';

export type WorkerReadinessTone = 'success' | 'warning' | 'danger';

export interface WorkerReadinessSummaryInput {
  status: WorkerReadinessOverallStatus;
  ready: boolean;
  serverRole: WorkerReadinessResponse['server']['role'];
  knowledgeProcessingMode: WorkerReadinessResponse['server']['knowledgeProcessingMode'];
  issueCount: number;
}

export function getWorkerReadinessLabel(status: WorkerReadinessOverallStatus) {
  if (status === 'ready') return 'Ready';
  if (status === 'degraded') return 'Degraded';
  return 'Not Ready';
}

export function getWorkerReadinessTone(status: WorkerReadinessOverallStatus): WorkerReadinessTone {
  if (status === 'ready') return 'success';
  if (status === 'degraded') return 'warning';
  return 'danger';
}

export function getWorkerCheckTone(status: WorkerReadinessCheckStatus): WorkerReadinessTone {
  if (status === 'pass') return 'success';
  if (status === 'warn') return 'warning';
  return 'danger';
}

export function summarizeWorkerReadiness(input: WorkerReadinessSummaryInput) {
  if (input.issueCount === 0 && input.ready) {
    return `${input.serverRole} / ${input.knowledgeProcessingMode}，后台任务链路可以接流量。`;
  }

  return `${input.serverRole} / ${input.knowledgeProcessingMode}，当前有 ${input.issueCount} 个问题需要处理。`;
}

export function formatWorkerReadinessTime(value: string | null) {
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
