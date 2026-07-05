export const DOCUMENT_PROCESSING_QUEUE_NAME = 'document-processing';
export const WORKER_HEARTBEAT_QUEUE_NAMES = [
  DOCUMENT_PROCESSING_QUEUE_NAME,
] as const;

export function createWorkerHeartbeatKey(prefix: string, workerId: string) {
  return `${prefix}:worker-heartbeat:${workerId}`;
}
