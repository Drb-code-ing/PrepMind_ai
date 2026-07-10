import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma, type OperatorAuditExport } from '@prisma/client';
import type { Queue } from 'bullmq';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';
import {
  createOperatorAuditExportObjectKey,
  StorageService,
} from '../uploads/storage.service';
import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
  OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT,
  OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
  OPERATOR_AUDIT_MAINTENANCE_STATE,
  OPERATOR_AUDIT_RETENTION_LOCK,
} from './operator-audit-export.constants';
import { OperatorAuditExportTempJanitorService } from './operator-audit-export-temp-janitor.service';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const BATCH_SIZE = 1000;
const MAX_BATCHES = 20;
const TERMINAL_STATUSES = ['FAILED', 'EXPIRED'] as const;

export type OperatorAuditMaintenanceResult = {
  expiredExportCount: number;
  deletedAuditCount: number;
  deletedExportCount: number;
};

@Injectable()
export class OperatorAuditMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(OPERATOR_AUDIT_EXPORT_QUEUE)
    private readonly exportQueue: Queue,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly janitor: OperatorAuditExportTempJanitorService,
  ) {}

  async run(): Promise<OperatorAuditMaintenanceResult> {
    const startedAt = await this.databaseNow();
    await this.writeRunning(startedAt);
    const result: OperatorAuditMaintenanceResult = {
      expiredExportCount: 0,
      deletedAuditCount: 0,
      deletedExportCount: 0,
    };

    try {
      result.expiredExportCount = await this.expireReadyExports(startedAt);
      await this.cleanOrphanObjects(startedAt);
      await this.repairAbandonedExports(startedAt);
      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const deleted = await this.deleteAuditBatch();
        result.deletedAuditCount += deleted;
        if (deleted < BATCH_SIZE) break;
      }
      for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
        const deleted = await this.deleteTerminalExportBatch();
        result.deletedExportCount += deleted;
        if (deleted < BATCH_SIZE) break;
      }
      await this.janitor.run();
      const finishedAt = await this.databaseNow();
      await this.prisma.operatorAuditMaintenanceState.upsert({
        where: { name: OPERATOR_AUDIT_MAINTENANCE_STATE },
        create: {
          name: OPERATOR_AUDIT_MAINTENANCE_STATE,
          status: 'SUCCEEDED',
          lastStartedAt: startedAt,
          lastSucceededAt: finishedAt,
          lastFinishedAt: finishedAt,
          ...result,
        },
        update: {
          status: 'SUCCEEDED',
          lastSucceededAt: finishedAt,
          lastFinishedAt: finishedAt,
          errorCode: null,
          errorPreview: null,
          ...result,
        },
      });
      return result;
    } catch (error) {
      const finishedAt = await this.databaseNow().catch(() => startedAt);
      await this.prisma.operatorAuditMaintenanceState.upsert({
        where: { name: OPERATOR_AUDIT_MAINTENANCE_STATE },
        create: {
          name: OPERATOR_AUDIT_MAINTENANCE_STATE,
          status: 'FAILED',
          lastStartedAt: startedAt,
          lastFinishedAt: finishedAt,
          errorCode: 'OPERATOR_AUDIT_MAINTENANCE_FAILED',
          errorPreview: sanitizeJobError(error).slice(0, 240),
          ...result,
        },
        update: {
          status: 'FAILED',
          lastFinishedAt: finishedAt,
          errorCode: 'OPERATOR_AUDIT_MAINTENANCE_FAILED',
          errorPreview: sanitizeJobError(error).slice(0, 240),
          ...result,
        },
      });
      throw error;
    }
  }

  private async expireReadyExports(now: Date): Promise<number> {
    const rows = await this.prisma.operatorAuditExport.findMany({
      where: { status: 'READY', expiresAt: { lte: now } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true, objectKey: true, expiresAt: true },
    });
    let expired = 0;
    for (const row of rows) {
      if (row.objectKey)
        await this.storage.deleteOperatorAuditExport(row.objectKey);
      const objects = await this.storage.listOperatorAuditExportObjects(row.id);
      for (const objectKey of objects) {
        if (objectKey !== row.objectKey) {
          await this.storage.deleteOperatorAuditExport(objectKey);
        }
      }
      const count = await this.prisma.$transaction(async (transaction) => {
        const databaseNow = await readDatabaseClock(transaction);
        return transaction.operatorAuditExport.updateMany({
          where: {
            id: row.id,
            status: 'READY',
            expiresAt: { lte: databaseNow },
          },
          data: { status: 'EXPIRED', objectKey: null, expiredAt: databaseNow },
        });
      });
      expired += count.count;
    }
    return expired;
  }

  private async cleanOrphanObjects(now: Date): Promise<number> {
    const rows = await this.prisma.operatorAuditExport.findMany({
      where: {
        OR: [
          { status: { in: [...TERMINAL_STATUSES] } },
          { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
        ],
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: {
        id: true,
        status: true,
        objectKey: true,
        backgroundJobId: true,
        processingToken: true,
        leaseExpiresAt: true,
      },
    });
    let deleted = 0;
    for (const row of rows) {
      if (row.status === 'PROCESSING') {
        const job = await this.exportQueue.getJob(row.backgroundJobId);
        if (job && (await job.getState()) === 'active') continue;
      }
      const objects = await this.storage.listOperatorAuditExportObjects(row.id);
      if (row.status === 'PROCESSING') {
        const current = await this.prisma.operatorAuditExport.findUnique({
          where: { id: row.id },
          select: {
            status: true,
            objectKey: true,
            backgroundJobId: true,
            processingToken: true,
            leaseExpiresAt: true,
          },
        });
        const databaseNow = await this.databaseNow();
        if (
          !current ||
          current.status !== 'PROCESSING' ||
          !current.processingToken ||
          current.processingToken !== row.processingToken ||
          !current.leaseExpiresAt ||
          current.leaseExpiresAt > databaseNow
        ) {
          continue;
        }
        const currentJob = await this.exportQueue.getJob(
          current.backgroundJobId,
        );
        if (currentJob && (await currentJob.getState()) === 'active') continue;

        const protectedKeys = new Set([
          current.objectKey,
          createOperatorAuditExportObjectKey(row.id, current.processingToken),
        ]);
        for (const objectKey of objects) {
          if (protectedKeys.has(objectKey)) continue;
          await this.storage.deleteOperatorAuditExport(objectKey);
          deleted += 1;
        }
        continue;
      }
      for (const objectKey of objects) {
        await this.storage.deleteOperatorAuditExport(objectKey);
        deleted += 1;
      }
    }
    return deleted;
  }

  private async repairAbandonedExports(now: Date): Promise<number> {
    const rows = await this.prisma.operatorAuditExport.findMany({
      where: {
        OR: [
          { status: 'QUEUED' },
          {
            status: 'PROCESSING',
            startedAt: { lte: new Date(now.getTime() - this.staleAfterMs()) },
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
    });
    let repaired = 0;
    for (const row of rows) {
      if (row.status === 'QUEUED') {
        const dead = await this.prisma.$transaction(async (transaction) => {
          const databaseNow = await readDatabaseClock(transaction);
          const outbox = await transaction.outboxEvent.findFirst({
            where: {
              type: OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT,
              aggregateType: 'OperatorAuditExport',
              aggregateId: row.id,
              status: 'DEAD',
            },
            orderBy: { updatedAt: 'desc' },
          });
          if (
            !outbox ||
            outbox.updatedAt.getTime() >
              databaseNow.getTime() - this.deliveryRecoveryMs()
          )
            return 0;
          return this.failLinkedFacts(
            transaction,
            row,
            databaseNow,
            'DELIVERY_ABANDONED',
          );
        });
        repaired += dead;
        continue;
      }

      const bullJob = await this.exportQueue.getJob(row.backgroundJobId);
      const bullState = bullJob ? await bullJob.getState() : 'missing';
      if (bullState === 'active') continue;
      repaired += await this.prisma.$transaction(async (transaction) => {
        const databaseNow = await readDatabaseClock(transaction);
        if (!row.leaseExpiresAt || row.leaseExpiresAt > databaseNow) return 0;
        return this.failLinkedFacts(
          transaction,
          row,
          databaseNow,
          'STALE_PROCESSING',
        );
      });
    }
    return repaired;
  }

  private async failLinkedFacts(
    transaction: Prisma.TransactionClient,
    row: Pick<
      OperatorAuditExport,
      'id' | 'backgroundJobId' | 'status' | 'processingToken'
    >,
    now: Date,
    errorCode: 'DELIVERY_ABANDONED' | 'STALE_PROCESSING',
  ) {
    const exportUpdate = await transaction.operatorAuditExport.updateMany({
      where: {
        id: row.id,
        status: row.status,
        ...(row.status === 'PROCESSING'
          ? {
              processingToken: row.processingToken,
              startedAt: {
                lte: new Date(now.getTime() - this.staleAfterMs()),
              },
              leaseExpiresAt: { lte: now },
            }
          : {}),
      },
      data: {
        status: 'FAILED',
        processingToken: null,
        leaseExpiresAt: null,
        completedAt: now,
        errorCode,
        errorPreview: errorCode,
      },
    });
    if (exportUpdate.count !== 1) return 0;
    const jobUpdate = await transaction.backgroundJob.updateMany({
      where: {
        id: row.backgroundJobId,
        userId: null,
        scope: 'SYSTEM',
        queueName: OPERATOR_AUDIT_EXPORT_QUEUE,
        jobName: GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
        resourceType: OPERATOR_AUDIT_EXPORT_RESOURCE_TYPE,
        resourceId: row.id,
        status: row.status === 'QUEUED' ? 'QUEUED' : 'ACTIVE',
      },
      data: {
        status: 'FAILED',
        finishedAt: now,
        errorCode,
        errorMessage: errorCode,
      },
    });
    if (jobUpdate.count !== 1)
      throw new Error('Linked SYSTEM background job CAS failed');
    return 1;
  }

  private async deleteAuditBatch(): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      await lockRetention(transaction);
      const databaseNow = await readDatabaseClock(transaction);
      const oldestActive = await transaction.operatorAuditExport.findFirst({
        where: { status: { in: ['QUEUED', 'PROCESSING'] } },
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        select: { startAt: true },
      });
      const baseCutoff = new Date(databaseNow.getTime() - this.retentionMs());
      const cutoff =
        oldestActive && oldestActive.startAt < baseCutoff
          ? oldestActive.startAt
          : baseCutoff;
      const ids = await transaction.operatorAuditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: BATCH_SIZE,
        select: { id: true },
      });
      if (!ids.length) return 0;
      return (
        await transaction.operatorAuditLog.deleteMany({
          where: { id: { in: ids.map(({ id }) => id) } },
        })
      ).count;
    });
  }

  private async deleteTerminalExportBatch(): Promise<number> {
    const databaseNow = await this.databaseNow();
    const cutoff = new Date(databaseNow.getTime() - this.retentionMs());
    const rows = await this.prisma.operatorAuditExport.findMany({
      where: {
        status: { in: [...TERMINAL_STATUSES] },
        createdAt: { lt: cutoff },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: BATCH_SIZE,
      select: { id: true },
    });
    const safeIds: string[] = [];
    for (const row of rows) {
      const objects = await this.storage.listOperatorAuditExportObjects(row.id);
      if (objects.length === 0) safeIds.push(row.id);
    }
    if (!safeIds.length) return 0;
    return this.prisma.$transaction(async (transaction) => {
      await lockRetention(transaction);
      const now = await readDatabaseClock(transaction);
      return (
        await transaction.operatorAuditExport.deleteMany({
          where: {
            id: { in: safeIds },
            status: { in: [...TERMINAL_STATUSES] },
            createdAt: { lt: new Date(now.getTime() - this.retentionMs()) },
          },
        })
      ).count;
    });
  }

  private async writeRunning(now: Date) {
    await this.prisma.operatorAuditMaintenanceState.upsert({
      where: { name: OPERATOR_AUDIT_MAINTENANCE_STATE },
      create: {
        name: OPERATOR_AUDIT_MAINTENANCE_STATE,
        status: 'RUNNING',
        lastStartedAt: now,
      },
      update: {
        status: 'RUNNING',
        lastStartedAt: now,
        errorCode: null,
        errorPreview: null,
      },
    });
  }

  private async databaseNow() {
    const [clock] = await this.prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    if (!clock) throw new Error('Database clock query returned no rows');
    return clock.now;
  }

  private retentionMs() {
    return (
      this.config.get('OPERATOR_AUDIT_RETENTION_DAYS', { infer: true }) * DAY_MS
    );
  }
  private staleAfterMs() {
    return this.config.get('OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS', {
      infer: true,
    });
  }
  private deliveryRecoveryMs() {
    return (
      this.config.get('OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS', {
        infer: true,
      }) * HOUR_MS
    );
  }
}

async function readDatabaseClock(transaction: Prisma.TransactionClient) {
  const [clock] = await transaction.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  if (!clock) throw new Error('Database clock query returned no rows');
  return clock.now;
}

async function lockRetention(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0))`;
}
