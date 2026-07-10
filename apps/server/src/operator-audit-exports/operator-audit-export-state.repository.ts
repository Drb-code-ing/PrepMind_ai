import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type OperatorAuditExport } from '@prisma/client';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';
import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
} from './operator-audit-export.constants';

const HOUR_MS = 60 * 60 * 1000;

export type ExportClaimResult =
  | {
      kind: 'claimed';
      processingToken: string;
      leaseExpiresAt: Date;
      auditExport: OperatorAuditExport;
    }
  | { kind: 'busy'; leaseExpiresAt: Date }
  | { kind: 'stale' };

export type TokenInput = {
  exportId: string;
  backgroundJobId: string;
  processingToken: string;
};

export type FailureInput = {
  errorCode: string;
  error: unknown;
};

export type ReadyInput = {
  objectKey: string;
  fileName: string;
  archiveSize: number;
  recordCount: number;
  csvSha256: string;
  archiveSha256: string;
};

export type ReadyReconciliationResult =
  | { kind: 'committed' }
  | { kind: 'current-token' }
  | { kind: 'unselected' }
  | { kind: 'uncertain' };

@Injectable()
export class OperatorAuditExportStateRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  async claim(input: {
    exportId: string;
    backgroundJobId: string;
  }): Promise<ExportClaimResult> {
    const processingToken = randomUUID();

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const databaseNow = await readDatabaseClock(transaction);
        const [auditExport, backgroundJob] = await Promise.all([
          transaction.operatorAuditExport.findUnique({
            where: { id: input.exportId },
          }),
          transaction.backgroundJob.findUnique({
            where: { id: input.backgroundJobId },
          }),
        ]);

        if (
          !auditExport ||
          !backgroundJob ||
          !factsAreLinked(auditExport, backgroundJob, input)
        ) {
          return { kind: 'stale' } as const;
        }

        if (
          auditExport.status === 'PROCESSING' &&
          backgroundJob.status === 'ACTIVE' &&
          auditExport.leaseExpiresAt &&
          auditExport.leaseExpiresAt > databaseNow
        ) {
          return {
            kind: 'busy',
            leaseExpiresAt: auditExport.leaseExpiresAt,
          } as const;
        }

        const isFresh =
          auditExport.status === 'QUEUED' && backgroundJob.status === 'QUEUED';
        const isExpired =
          auditExport.status === 'PROCESSING' &&
          backgroundJob.status === 'ACTIVE' &&
          Boolean(auditExport.processingToken) &&
          Boolean(
            auditExport.leaseExpiresAt &&
            auditExport.leaseExpiresAt <= databaseNow,
          );
        if (!isFresh && !isExpired) return { kind: 'stale' } as const;

        const leaseExpiresAt = this.leaseEnd(databaseNow);
        const exportUpdate = await transaction.operatorAuditExport.updateMany({
          where: {
            id: input.exportId,
            backgroundJobId: input.backgroundJobId,
            ...(isFresh
              ? { status: 'QUEUED' as const, processingToken: null }
              : {
                  status: 'PROCESSING' as const,
                  processingToken: auditExport.processingToken,
                  leaseExpiresAt: { lte: databaseNow },
                }),
          },
          data: {
            status: 'PROCESSING',
            processingToken,
            leaseExpiresAt,
            startedAt: databaseNow,
            completedAt: null,
            expiresAt: null,
            errorCode: null,
            errorPreview: null,
          },
        });
        if (exportUpdate.count !== 1) throw new StateCasLostError();

        const jobUpdate = await transaction.backgroundJob.updateMany({
          where: linkedJobWhere(input, isFresh ? 'QUEUED' : 'ACTIVE'),
          data: {
            status: 'ACTIVE',
            startedAt: databaseNow,
            finishedAt: null,
            progress: 0,
            errorCode: null,
            errorMessage: null,
          },
        });
        if (jobUpdate.count !== 1) throw new StateCasLostError();

        const claimed = await transaction.operatorAuditExport.findUnique({
          where: { id: input.exportId },
        });
        if (!claimed) throw new StateCasLostError();

        return {
          kind: 'claimed',
          processingToken,
          leaseExpiresAt,
          auditExport: claimed,
        } as const;
      });
    } catch (error) {
      if (error instanceof StateCasLostError) return { kind: 'stale' };
      throw error;
    }
  }

  async renewLease(input: TokenInput): Promise<boolean> {
    return this.withLostLease(false, async (transaction) => {
      const databaseNow = await readDatabaseClock(transaction);
      const exportUpdate = await transaction.operatorAuditExport.updateMany({
        where: currentTokenWhere(input),
        data: { leaseExpiresAt: this.leaseEnd(databaseNow) },
      });
      if (exportUpdate.count !== 1) return false;

      const jobUpdate = await transaction.backgroundJob.updateMany({
        where: linkedJobWhere(input, 'ACTIVE'),
        data: { status: 'ACTIVE' },
      });
      if (jobUpdate.count !== 1) throw new StateCasLostError();
      return true;
    });
  }

  async markRetryable(input: TokenInput & FailureInput): Promise<boolean> {
    return this.markFailure(input, false);
  }

  async markFailed(input: TokenInput & FailureInput): Promise<boolean> {
    return this.markFailure(input, true);
  }

  async markReady(
    input: TokenInput & ReadyInput,
  ): Promise<{ kind: 'ready'; expiresAt: Date } | { kind: 'lost-lease' }> {
    return this.withLostLease(
      { kind: 'lost-lease' } as const,
      async (transaction) => {
        const databaseNow = await readDatabaseClock(transaction);
        const expiresAt = new Date(
          databaseNow.getTime() +
            this.config.get('OPERATOR_AUDIT_EXPORT_TTL_HOURS', {
              infer: true,
            }) *
              HOUR_MS,
        );
        const exportUpdate = await transaction.operatorAuditExport.updateMany({
          where: currentTokenWhere(input),
          data: {
            status: 'READY',
            objectKey: input.objectKey,
            fileName: input.fileName,
            archiveSize: input.archiveSize,
            recordCount: input.recordCount,
            csvSha256: input.csvSha256,
            archiveSha256: input.archiveSha256,
            processingToken: null,
            leaseExpiresAt: null,
            completedAt: databaseNow,
            expiresAt,
            errorCode: null,
            errorPreview: null,
          },
        });
        if (exportUpdate.count !== 1) return { kind: 'lost-lease' } as const;

        const jobUpdate = await transaction.backgroundJob.updateMany({
          where: linkedJobWhere(input, 'ACTIVE'),
          data: {
            status: 'SUCCEEDED',
            progress: 100,
            finishedAt: databaseNow,
            errorCode: null,
            errorMessage: null,
            resultSummary: {
              exportId: input.exportId,
              archiveSize: input.archiveSize,
              recordCount: input.recordCount,
            },
          },
        });
        if (jobUpdate.count !== 1) throw new StateCasLostError();
        return { kind: 'ready', expiresAt } as const;
      },
    );
  }

  async reconcileReady(
    input: TokenInput & Pick<ReadyInput, 'objectKey'>,
  ): Promise<ReadyReconciliationResult> {
    return this.prisma.$transaction(async (transaction) => {
      const [auditExport, backgroundJob] = await Promise.all([
        transaction.operatorAuditExport.findUnique({
          where: { id: input.exportId },
        }),
        transaction.backgroundJob.findUnique({
          where: { id: input.backgroundJobId },
        }),
      ]);

      if (
        !auditExport ||
        !backgroundJob ||
        !factsAreLinked(auditExport, backgroundJob, input)
      ) {
        return { kind: 'uncertain' };
      }

      if (
        auditExport.status === 'READY' &&
        backgroundJob.status === 'SUCCEEDED' &&
        auditExport.objectKey === input.objectKey
      ) {
        return { kind: 'committed' };
      }

      if (auditExport.objectKey === input.objectKey) {
        return { kind: 'uncertain' };
      }

      if (
        auditExport.status === 'PROCESSING' &&
        backgroundJob.status === 'ACTIVE'
      ) {
        return auditExport.processingToken === input.processingToken
          ? { kind: 'current-token' }
          : { kind: 'unselected' };
      }

      if (
        (auditExport.status === 'QUEUED' &&
          backgroundJob.status === 'QUEUED') ||
        (auditExport.status === 'READY' &&
          backgroundJob.status === 'SUCCEEDED') ||
        (auditExport.status === 'FAILED' &&
          backgroundJob.status === 'FAILED') ||
        (auditExport.status === 'EXPIRED' &&
          backgroundJob.status === 'SUCCEEDED')
      ) {
        return { kind: 'unselected' };
      }

      return { kind: 'uncertain' };
    });
  }

  private async markFailure(
    input: TokenInput & FailureInput,
    terminal: boolean,
  ): Promise<boolean> {
    return this.withLostLease(false, async (transaction) => {
      const databaseNow = await readDatabaseClock(transaction);
      const errorCode = safeErrorCode(input.errorCode);
      const errorPreview = sanitizeJobError(input.error).slice(0, 240);
      const exportUpdate = await transaction.operatorAuditExport.updateMany({
        where: currentTokenWhere(input),
        data: {
          status: terminal ? 'FAILED' : 'QUEUED',
          processingToken: null,
          leaseExpiresAt: null,
          completedAt: terminal ? databaseNow : null,
          errorCode,
          errorPreview,
        },
      });
      if (exportUpdate.count !== 1) return false;

      const jobUpdate = await transaction.backgroundJob.updateMany({
        where: linkedJobWhere(input, 'ACTIVE'),
        data: {
          status: terminal ? 'FAILED' : 'QUEUED',
          ...(terminal
            ? { finishedAt: databaseNow }
            : { startedAt: null, finishedAt: null }),
          errorCode,
          errorMessage: errorPreview,
        },
      });
      if (jobUpdate.count !== 1) throw new StateCasLostError();
      return true;
    });
  }

  private async withLostLease<T>(
    lostValue: T,
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(callback);
    } catch (error) {
      if (error instanceof StateCasLostError) return lostValue;
      throw error;
    }
  }

  private leaseEnd(databaseNow: Date) {
    return new Date(
      databaseNow.getTime() +
        this.config.get('OPERATOR_AUDIT_EXPORT_LEASE_MS', { infer: true }),
    );
  }
}

class StateCasLostError extends Error {}

async function readDatabaseClock(transaction: Prisma.TransactionClient) {
  const [clock] = await transaction.$queryRaw<Array<{ now: Date }>>`
    SELECT clock_timestamp() AS now
  `;
  if (!clock) throw new Error('Database clock query returned no rows');
  return clock.now;
}

function factsAreLinked(
  auditExport: OperatorAuditExport,
  backgroundJob: {
    id: string;
    userId: string | null;
    scope: string;
    queueName: string;
    jobName: string;
    status: string;
    resourceType: string;
    resourceId: string;
  },
  input: { exportId: string; backgroundJobId: string },
) {
  return Boolean(
    auditExport.id === input.exportId &&
    auditExport.backgroundJobId === input.backgroundJobId &&
    backgroundJob.id === input.backgroundJobId &&
    backgroundJob.scope === 'SYSTEM' &&
    backgroundJob.userId === null &&
    backgroundJob.queueName === OPERATOR_AUDIT_EXPORT_QUEUE &&
    backgroundJob.jobName === GENERATE_OPERATOR_AUDIT_EXPORT_JOB &&
    backgroundJob.resourceType === OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE &&
    backgroundJob.resourceId === input.exportId,
  );
}

function currentTokenWhere(input: TokenInput) {
  return {
    id: input.exportId,
    backgroundJobId: input.backgroundJobId,
    status: 'PROCESSING' as const,
    processingToken: input.processingToken,
  };
}

function linkedJobWhere(
  input: { exportId: string; backgroundJobId: string },
  status: 'QUEUED' | 'ACTIVE',
) {
  return {
    id: input.backgroundJobId,
    userId: null,
    scope: 'SYSTEM' as const,
    queueName: OPERATOR_AUDIT_EXPORT_QUEUE,
    jobName: GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
    status,
    resourceType: OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
    resourceId: input.exportId,
  };
}

function safeErrorCode(value: string) {
  return (
    value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .slice(0, 120) || 'OPERATOR_AUDIT_EXPORT_FAILED'
  );
}
