import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import {
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
} from '../operator-audit-exports/operator-audit-export.constants';

export const DOCUMENT_PROCESSING_QUEUE_NAME = PROCESS_KNOWLEDGE_DOCUMENT_QUEUE;
export const WORKER_HEARTBEAT_QUEUE_NAMES = [
  DOCUMENT_PROCESSING_QUEUE_NAME,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_MAINTENANCE_QUEUE,
] as const;

export function createWorkerHeartbeatKey(prefix: string, workerId: string) {
  return `${prefix}:worker-heartbeat:${workerId}`;
}
