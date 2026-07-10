import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { PrismaService } from '../database/prisma.service';
import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
  operatorAuditExportRequestedPayloadSchema,
  type OperatorAuditExportRequestedPayload,
} from '../operator-audit-exports/operator-audit-export.constants';
import { OutboxHandlerError, type OutboxEventHandler } from './outbox.handlers';

@Injectable()
export class OperatorAuditExportRequestedHandler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OPERATOR_AUDIT_EXPORT_QUEUE)
    private readonly queue: Queue,
  ) {}

  readonly handle: OutboxEventHandler = async (event) => {
    const parsed = operatorAuditExportRequestedPayloadSchema.safeParse(
      event.payload,
    );
    if (!parsed.success) {
      throw invalidPayload('Operator audit export outbox payload is invalid');
    }
    const payload = parsed.data;
    const [auditExport, backgroundJob] = await Promise.all([
      this.prisma.operatorAuditExport.findUnique({
        where: { id: payload.exportId },
      }),
      this.prisma.backgroundJob.findUnique({
        where: { id: payload.backgroundJobId },
      }),
    ]);

    const linked = assertLinkedSystemFacts(auditExport, backgroundJob, payload);
    if (
      linked.auditExport.status === 'FAILED' ||
      linked.auditExport.status === 'EXPIRED'
    ) {
      return;
    }
    if (
      (linked.auditExport.status === 'PROCESSING' ||
        linked.auditExport.status === 'READY') &&
      (linked.backgroundJob.status === 'ACTIVE' ||
        linked.backgroundJob.status === 'SUCCEEDED')
    ) {
      return;
    }
    if (
      linked.auditExport.status !== 'QUEUED' ||
      linked.backgroundJob.status !== 'QUEUED'
    ) {
      throw invalidPayload('Operator audit export delivery states are invalid');
    }
    if (await this.queue.getJob(linked.backgroundJob.id)) return;

    await this.queue.add(GENERATE_OPERATOR_AUDIT_EXPORT_JOB, payload, {
      jobId: linked.backgroundJob.id,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 172800, count: 1000 },
      removeOnFail: { age: 604800, count: 3000 },
    });
  };
}

type ExportFact = {
  id: string;
  backgroundJobId: string;
  status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED';
};

type BackgroundJobFact = {
  id: string;
  userId: string | null;
  scope: 'ACCOUNT' | 'SYSTEM';
  queueName: string;
  jobName: string;
  status:
    | 'QUEUED'
    | 'ACTIVE'
    | 'SUCCEEDED'
    | 'FAILED'
    | 'CANCELLED'
    | 'STALE_SKIPPED';
  resourceType: string;
  resourceId: string;
};

function assertLinkedSystemFacts(
  auditExport: ExportFact | null,
  backgroundJob: BackgroundJobFact | null,
  payload: OperatorAuditExportRequestedPayload,
) {
  if (
    !auditExport ||
    !backgroundJob ||
    auditExport.id !== payload.exportId ||
    auditExport.backgroundJobId !== payload.backgroundJobId ||
    backgroundJob.id !== payload.backgroundJobId ||
    backgroundJob.scope !== 'SYSTEM' ||
    backgroundJob.userId !== null ||
    backgroundJob.queueName !== OPERATOR_AUDIT_EXPORT_QUEUE ||
    backgroundJob.jobName !== GENERATE_OPERATOR_AUDIT_EXPORT_JOB ||
    backgroundJob.resourceType !== OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE ||
    backgroundJob.resourceId !== auditExport.id
  ) {
    throw invalidPayload('Operator audit export delivery facts are invalid');
  }

  return { auditExport, backgroundJob };
}

function invalidPayload(message: string) {
  return new OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', message);
}
