import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';

export const DOCUMENT_PROCESSING_QUEUE_NAME = PROCESS_KNOWLEDGE_DOCUMENT_QUEUE;
export const WORKER_HEARTBEAT_QUEUE_NAMES = [
  DOCUMENT_PROCESSING_QUEUE_NAME,
] as const;

export function createWorkerHeartbeatKey(prefix: string, workerId: string) {
  return `${prefix}:worker-heartbeat:${workerId}`;
}
