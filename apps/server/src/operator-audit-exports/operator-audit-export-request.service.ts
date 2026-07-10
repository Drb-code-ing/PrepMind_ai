import { createHash, randomUUID } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type OperatorAuditExport } from '@prisma/client';
import type {
  OperatorAuditExportCreateRequest,
  OperatorAuditExportDetailResponse,
} from '@repo/types/api/operator-audit-export';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  type AuditRequest,
  OperatorAuditService,
} from '../operator-audit/operator-audit.service';
import { OutboxService } from '../outbox/outbox.service';
import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_EXPORT_QUOTA_LOCK,
  OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT,
  OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
  OPERATOR_AUDIT_RETENTION_LOCK,
} from './operator-audit-export.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const ACTIVE_EXPORT_STATUSES = ['QUEUED', 'PROCESSING'] as const;
// Serializable transactions can lose an advisory-lock snapshot race. Retrying
// the whole side-effect-free transaction gives each attempt a fresh snapshot.
const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 5;

type NormalizedRequest = {
  clientRequestId: string;
  startAt: string;
  endAt: string;
  reason: string;
  filters: {
    action: OperatorAuditExportCreateRequest['action'] | null;
    status: OperatorAuditExportCreateRequest['status'] | null;
    targetType: string | null;
    targetId: string | null;
    actorUserId: string | null;
  };
};

@Injectable()
export class OperatorAuditExportRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly outbox: OutboxService,
    private readonly audit: OperatorAuditService,
  ) {}

  async create(
    actorUserId: string,
    input: OperatorAuditExportCreateRequest,
    request?: AuditRequest,
  ): Promise<OperatorAuditExportDetailResponse> {
    const normalized = normalizeRequest(input);
    const exportId = randomUUID();
    const backgroundJobId = randomUUID();

    const runTransaction = () =>
      this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0)
            )
          `;
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${OPERATOR_AUDIT_EXPORT_QUOTA_LOCK}, 0)
            )
        `;
          const [clock] = await transaction.$queryRaw<Array<{ now: Date }>>`
          SELECT clock_timestamp() AS now
        `;
          if (!clock) {
            throw new Error('Database clock query returned no rows');
          }

          const databaseNow = clock.now;
          const requestHash = hashNormalizedRequest(normalized);

          const existing = await transaction.operatorAuditExport.findUnique({
            where: {
              requestedByUserId_clientRequestId: {
                requestedByUserId: actorUserId,
                clientRequestId: normalized.clientRequestId,
              },
            },
          });
          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new AppError(
                'OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT',
                'clientRequestId is already used by a different export request',
                HttpStatus.CONFLICT,
              );
            }

            return toDetailResponse(existing);
          }

          validateWindow(normalized, databaseNow, {
            retentionDays: this.config.get('OPERATOR_AUDIT_RETENTION_DAYS', {
              infer: true,
            }),
            maxRangeDays: this.config.get(
              'OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS',
              { infer: true },
            ),
          });

          await this.assertQuota(transaction, actorUserId, databaseNow);

          const createdExport = await transaction.operatorAuditExport.create({
            data: {
              id: exportId,
              requestedByUserId: actorUserId,
              clientRequestId: normalized.clientRequestId,
              requestHash,
              backgroundJobId,
              status: 'QUEUED',
              startAt: new Date(normalized.startAt),
              endAt: new Date(normalized.endAt),
              snapshotAt: databaseNow,
              filterAction: normalized.filters.action,
              filterStatus: normalized.filters.status,
              filterTargetType: normalized.filters.targetType,
              filterTargetId: normalized.filters.targetId,
              filterActorUserId: normalized.filters.actorUserId,
              reason: normalized.reason,
            },
          });
          const backgroundJob = await transaction.backgroundJob.create({
            data: {
              id: backgroundJobId,
              userId: null,
              scope: 'SYSTEM',
              queueName: OPERATOR_AUDIT_EXPORT_QUEUE,
              jobName: GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
              status: 'QUEUED',
              resourceType: OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
              resourceId: createdExport.id,
              maxAttempts: 3,
            },
          });
          await this.outbox.enqueueInTransaction(transaction, {
            type: OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT,
            aggregateType: 'OperatorAuditExport',
            aggregateId: createdExport.id,
            idempotencyKey: `operator-audit-export-requested:${createdExport.id}`,
            payload: {
              exportId: createdExport.id,
              backgroundJobId: backgroundJob.id,
            },
          });
          try {
            await this.audit.recordSuccessStrict(transaction, {
              actorUserId,
              action: 'AUDIT_EXPORT_REQUEST',
              targetType: 'OperatorAuditExport',
              targetId: createdExport.id,
              reason: normalized.reason,
              request,
              now: databaseNow,
            });
          } catch (error) {
            if (isRetryableSerializableTransactionError(error)) {
              throw error;
            }
            throw new AppError(
              'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
              'Operator audit export request audit failed',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }

          return toDetailResponse(createdExport);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await runTransaction();
      } catch (error) {
        if (
          attempt === MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !isRetryableSerializableTransactionError(error)
        ) {
          throw error;
        }
      }
    }

    throw new Error('Serializable transaction retry loop exhausted');
  }

  private async assertQuota(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    databaseNow: Date,
  ) {
    const perAdminActive = await transaction.operatorAuditExport.count({
      where: {
        requestedByUserId: actorUserId,
        status: { in: [...ACTIVE_EXPORT_STATUSES] },
      },
    });
    if (
      perAdminActive >=
      this.config.get('OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT', {
        infer: true,
      })
    ) {
      throw exportLimitReached();
    }

    const perAdminHourly = await transaction.operatorAuditExport.count({
      where: {
        requestedByUserId: actorUserId,
        requestedAt: {
          gte: new Date(databaseNow.getTime() - HOUR_MS),
          lte: databaseNow,
        },
      },
    });
    if (
      perAdminHourly >=
      this.config.get('OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT', {
        infer: true,
      })
    ) {
      throw exportLimitReached();
    }

    const globalActive = await transaction.operatorAuditExport.count({
      where: { status: { in: [...ACTIVE_EXPORT_STATUSES] } },
    });
    if (
      globalActive >=
      this.config.get('OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT', {
        infer: true,
      })
    ) {
      throw exportLimitReached();
    }
  }
}

function normalizeRequest(
  input: OperatorAuditExportCreateRequest,
): NormalizedRequest {
  try {
    return {
      clientRequestId: input.clientRequestId,
      startAt: new Date(input.startAt).toISOString(),
      endAt: new Date(input.endAt).toISOString(),
      reason: input.reason.trim(),
      filters: {
        action: input.action ?? null,
        status: input.status ?? null,
        targetType: trimToNull(input.targetType),
        targetId: trimToNull(input.targetId),
        actorUserId: trimToNull(input.actorUserId),
      },
    };
  } catch {
    throw invalidExportRequest();
  }
}

function validateWindow(
  input: NormalizedRequest,
  databaseNow: Date,
  limits: { retentionDays: number; maxRangeDays: number },
) {
  const startAt = Date.parse(input.startAt);
  const endAt = Date.parse(input.endAt);
  const retentionCutoff = databaseNow.getTime() - limits.retentionDays * DAY_MS;

  if (
    startAt >= endAt ||
    endAt - startAt > limits.maxRangeDays * DAY_MS ||
    startAt < retentionCutoff ||
    endAt > databaseNow.getTime()
  ) {
    throw invalidExportRequest();
  }
}

function hashNormalizedRequest(input: NormalizedRequest) {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')}`;
}

function isRetryableSerializableTransactionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034') return true;
    if (error.code !== 'P2002') return false;

    const target = error.meta?.target;
    return (
      error.meta?.modelName === 'OperatorAuditExport' &&
      Array.isArray(target) &&
      target.length === 2 &&
      target.includes('requestedByUserId') &&
      target.includes('clientRequestId')
    );
  }

  return readErrorCode(error) === '40001';
}

function readErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return undefined;
  const value = error as { code?: unknown };
  return typeof value.code === 'string' ? value.code : undefined;
}

function toDetailResponse(
  value: OperatorAuditExport,
): OperatorAuditExportDetailResponse {
  return {
    id: value.id,
    requestedByUserId: value.requestedByUserId,
    backgroundJobId: value.backgroundJobId,
    status: value.status,
    filters: {
      action: value.filterAction,
      status: value.filterStatus,
      targetType: value.filterTargetType,
      targetId: value.filterTargetId,
      actorUserId: value.filterActorUserId,
    },
    reason: value.reason,
    startAt: value.startAt.toISOString(),
    endAt: value.endAt.toISOString(),
    snapshotAt: value.snapshotAt.toISOString(),
    fileName: value.fileName,
    archiveSize: value.archiveSize,
    recordCount: value.recordCount,
    csvSha256: value.csvSha256,
    archiveSha256: value.archiveSha256,
    schemaVersion: value.schemaVersion,
    errorCode: value.errorCode,
    errorPreview: value.errorPreview,
    requestedAt: value.requestedAt.toISOString(),
    startedAt: toNullableIso(value.startedAt),
    completedAt: toNullableIso(value.completedAt),
    expiresAt: toNullableIso(value.expiresAt),
    expiredAt: toNullableIso(value.expiredAt),
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    canDownload: false,
  };
}

function toNullableIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

function trimToNull(value: string | undefined) {
  return value?.trim() || null;
}

function invalidExportRequest() {
  return new AppError(
    'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
    'Invalid operator audit export request',
    HttpStatus.BAD_REQUEST,
  );
}

function exportLimitReached() {
  return new AppError(
    'OPERATOR_AUDIT_EXPORT_LIMIT_REACHED',
    'Operator audit export limit reached',
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
