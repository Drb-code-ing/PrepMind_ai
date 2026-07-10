import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { DelayedError, type Job } from 'bullmq';

import type { ServerEnv } from '../../config/env';
import {
  createOperatorAuditExportObjectKey,
  OperatorAuditExportStorageError,
  StorageService,
} from '../../uploads/storage.service';
import {
  OperatorAuditExportArchiveError,
  OperatorAuditExportArchiveService,
  type OperatorAuditArchiveResult,
} from '../operator-audit-export-archive.service';
import { OperatorAuditExportStateRepository } from '../operator-audit-export-state.repository';
import {
  generateOperatorAuditExportPayloadSchema,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  type GenerateOperatorAuditExportPayload,
} from './generate-operator-audit-export.job';

@Processor(OPERATOR_AUDIT_EXPORT_QUEUE, {
  autorun: false,
  concurrency: 1,
  lockDuration: Number(
    process.env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS || 600_000,
  ),
})
export class OperatorAuditExportProcessor extends WorkerHost {
  private readonly logger = new Logger(OperatorAuditExportProcessor.name);

  constructor(
    private readonly state: OperatorAuditExportStateRepository,
    private readonly archive: OperatorAuditExportArchiveService,
    private readonly storage: StorageService,
    private readonly config: ConfigService<ServerEnv, true>,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const parsed = generateOperatorAuditExportPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
      job.discard();
      throw new OperatorAuditExportProcessorError(
        'OPERATOR_AUDIT_EXPORT_INVALID_PAYLOAD',
        false,
        'Operator audit export job payload is invalid',
      );
    }
    const payload = parsed.data;
    const claim = await this.state.claim(payload);
    if (claim.kind === 'stale') return;
    if (claim.kind === 'busy') {
      if (!job.token) {
        throw new OperatorAuditExportProcessorError(
          'OPERATOR_AUDIT_EXPORT_BULL_TOKEN_MISSING',
          true,
          'BullMQ worker token is missing',
        );
      }
      await job.moveToDelayed(claim.leaseExpiresAt.getTime() + 1000, job.token);
      throw new DelayedError();
    }

    const tokenInput = {
      ...payload,
      processingToken: claim.processingToken,
    };
    let archiveResult: OperatorAuditArchiveResult | undefined;
    let objectKey: string | undefined;
    let objectMayBeSelected = false;
    let lostLease = false;
    let renewalError: OperatorAuditExportProcessorError | undefined;
    let renewalInFlight = false;
    const renewal = setInterval(
      () => {
        if (renewalInFlight || lostLease) return;
        renewalInFlight = true;
        void this.state
          .renewLease(tokenInput)
          .then((renewed) => {
            if (!renewed) lostLease = true;
          })
          .catch(() => {
            renewalError = new OperatorAuditExportProcessorError(
              'OPERATOR_AUDIT_EXPORT_DATABASE_ERROR',
              true,
              'Operator audit export database unavailable',
            );
            this.safeWarn(payload, 'OPERATOR_AUDIT_EXPORT_LEASE_RENEW_FAILED');
          })
          .finally(() => {
            renewalInFlight = false;
          });
      },
      Math.max(1_000, Math.floor(this.leaseMs() / 3)),
    );
    renewal.unref();

    try {
      archiveResult = await this.archive.build({
        auditExport: claim.auditExport,
        processingToken: claim.processingToken,
      });
      await this.assertCurrentLease(
        tokenInput,
        () => lostLease,
        () => renewalError,
      );
      objectKey = createOperatorAuditExportObjectKey(
        payload.exportId,
        claim.processingToken,
      );
      const storedObjectKey = await this.storage.writeOperatorAuditExport(
        payload.exportId,
        claim.processingToken,
        archiveResult.filePath,
      );
      if (storedObjectKey !== objectKey) {
        throw new OperatorAuditExportProcessorError(
          'OPERATOR_AUDIT_EXPORT_STORAGE_KEY_MISMATCH',
          false,
          'Operator audit export storage key is invalid',
        );
      }
      await this.assertCurrentLease(
        tokenInput,
        () => lostLease,
        () => renewalError,
      );

      let ready;
      objectMayBeSelected = true;
      try {
        ready = await this.state.markReady({
          ...tokenInput,
          objectKey,
          fileName: archiveResult.fileName,
          archiveSize: archiveResult.archiveSize,
          recordCount: archiveResult.recordCount,
          csvSha256: archiveResult.csvSha256,
          archiveSha256: archiveResult.archiveSha256,
        });
      } catch (error) {
        let reconciliation;
        try {
          reconciliation = await this.state.reconcileReady({
            ...tokenInput,
            objectKey,
          });
        } catch {
          reconciliation = { kind: 'uncertain' } as const;
          this.safeWarn(
            payload,
            'OPERATOR_AUDIT_EXPORT_READY_RECONCILIATION_FAILED',
          );
        }
        if (reconciliation.kind === 'committed') return;
        if (reconciliation.kind === 'unselected') {
          objectMayBeSelected = false;
          throw new LostLeaseError();
        }
        if (reconciliation.kind === 'current-token') {
          objectMayBeSelected = false;
        }
        throw new OperatorAuditExportProcessorError(
          'OPERATOR_AUDIT_EXPORT_DATABASE_ERROR',
          true,
          'Operator audit export database unavailable',
          error,
        );
      }
      objectMayBeSelected = false;
      if (ready.kind === 'lost-lease') throw new LostLeaseError();
    } catch (error) {
      if (error instanceof DelayedError) throw error;
      if (objectMayBeSelected) {
        await this.delayForLeaseRecovery(job);
        throw new DelayedError();
      }
      if (objectKey) await this.deleteAttemptBestEffort(payload, objectKey);
      if (lostLease || error instanceof LostLeaseError) return;

      const retryable = isRetryable(error);
      const hasRemainingAttempt = job.attemptsMade + 1 < maxAttempts(job);
      if (retryable && hasRemainingAttempt) {
        let marked;
        try {
          marked = await this.state.markRetryable({
            ...tokenInput,
            errorCode: errorCodeFor(error, false),
            error,
          });
        } catch {
          await this.delayForLeaseRecovery(job);
          throw new DelayedError();
        }
        if (!marked) return;
        throw error;
      }

      let marked;
      try {
        marked = await this.state.markFailed({
          ...tokenInput,
          errorCode: errorCodeFor(error, retryable),
          error,
        });
      } catch {
        await this.delayForLeaseRecovery(job);
        throw new DelayedError();
      }
      if (!marked) return;
      if (!retryable) job.discard();
      throw error;
    } finally {
      clearInterval(renewal);
      if (archiveResult) {
        await archiveResult.cleanup().catch(() => {
          this.safeWarn(payload, 'OPERATOR_AUDIT_EXPORT_TEMP_CLEANUP_FAILED');
        });
      }
    }
  }

  private async assertCurrentLease(
    input: GenerateOperatorAuditExportPayload & { processingToken: string },
    leaseAlreadyLost: () => boolean,
    readRenewalError: () => OperatorAuditExportProcessorError | undefined,
  ) {
    if (leaseAlreadyLost()) throw new LostLeaseError();
    const renewalError = readRenewalError();
    if (renewalError) throw renewalError;
    try {
      if (!(await this.state.renewLease(input))) throw new LostLeaseError();
    } catch (error) {
      if (error instanceof LostLeaseError) throw error;
      throw new OperatorAuditExportProcessorError(
        'OPERATOR_AUDIT_EXPORT_DATABASE_ERROR',
        true,
        'Operator audit export database unavailable',
        error,
      );
    }
  }

  private async deleteAttemptBestEffort(
    payload: GenerateOperatorAuditExportPayload,
    objectKey: string,
  ) {
    await this.storage.deleteOperatorAuditExport(objectKey).catch(() => {
      this.safeWarn(payload, 'OPERATOR_AUDIT_EXPORT_ATTEMPT_DELETE_FAILED');
    });
  }

  private async delayForLeaseRecovery(job: Job<unknown>) {
    if (!job.token) {
      throw new OperatorAuditExportProcessorError(
        'OPERATOR_AUDIT_EXPORT_BULL_TOKEN_MISSING',
        true,
        'BullMQ worker token is missing',
      );
    }
    await job.moveToDelayed(Date.now() + this.leaseMs() + 1000, job.token);
  }

  private leaseMs() {
    return this.config.get('OPERATOR_AUDIT_EXPORT_LEASE_MS', { infer: true });
  }

  private safeWarn(
    payload: GenerateOperatorAuditExportPayload,
    errorCode: string,
  ) {
    this.logger.warn(
      {
        exportId: safeIdentifier(payload.exportId),
        backgroundJobId: safeIdentifier(payload.backgroundJobId),
        errorCode,
      },
      'Operator audit export worker warning',
    );
  }
}

class LostLeaseError extends Error {}

export class OperatorAuditExportProcessorError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
    options?: unknown,
  ) {
    super(message, options === undefined ? undefined : { cause: options });
    this.name = 'OperatorAuditExportProcessorError';
  }
}

function maxAttempts(job: Job<unknown>) {
  return typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
}

function isRetryable(error: unknown) {
  if (error instanceof OperatorAuditExportProcessorError) {
    return error.retryable;
  }
  if (error instanceof OperatorAuditExportArchiveError) return error.retryable;
  if (error instanceof OperatorAuditExportStorageError) {
    return error.kind === 'unavailable';
  }
  return true;
}

function errorCodeFor(error: unknown, retryExhausted: boolean) {
  if (error instanceof OperatorAuditExportProcessorError) return error.code;
  if (error instanceof OperatorAuditExportArchiveError) return error.code;
  if (error instanceof OperatorAuditExportStorageError) {
    return error.kind === 'missing'
      ? 'OPERATOR_AUDIT_EXPORT_STORAGE_MISSING'
      : 'OPERATOR_AUDIT_EXPORT_STORAGE_UNAVAILABLE';
  }
  return retryExhausted
    ? 'OPERATOR_AUDIT_EXPORT_RETRY_EXHAUSTED'
    : 'OPERATOR_AUDIT_EXPORT_RETRYABLE_ERROR';
}

function safeIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 100) || 'unknown';
}
