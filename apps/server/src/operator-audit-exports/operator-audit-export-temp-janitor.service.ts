import { readdir, realpath, rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { PrismaService } from '../database/prisma.service';
import {
  getOperatorAuditExportTempRoot,
  prepareOperatorAuditExportTempRoot,
} from './operator-audit-export-archive.service';

const TEMP_DIRECTORY_PATTERN =
  /^prepmind-audit-export-([A-Za-z0-9_-]{1,100})-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

type JanitorRuntime = {
  tempRoot?: string;
  logger?: Pick<Logger, 'warn'>;
};

@Injectable()
export class OperatorAuditExportTempJanitorService implements OnModuleInit {
  private readonly tempRoot: string;
  private readonly logger: Pick<Logger, 'warn'>;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('operator-audit-export') private readonly exportQueue: Queue,
    @Optional()
    @Inject('OPERATOR_AUDIT_EXPORT_TEMP_JANITOR_RUNTIME')
    runtime?: JanitorRuntime,
  ) {
    this.tempRoot = runtime?.tempRoot ?? getOperatorAuditExportTempRoot();
    this.logger =
      runtime?.logger ?? new Logger(OperatorAuditExportTempJanitorService.name);
  }

  async onModuleInit() {
    await this.run().catch(() => {
      this.logger.warn('Operator audit export temp janitor startup failed');
    });
  }

  async run(): Promise<number> {
    await prepareOperatorAuditExportTempRoot(this.tempRoot);
    const root = await realpath(this.tempRoot);
    const entries = await readdir(root, { withFileTypes: true });
    const now = await this.databaseNow();
    let deleted = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const parsed = TEMP_DIRECTORY_PATTERN.exec(entry.name);
      if (!parsed) continue;
      const [, exportId, token] = parsed;
      if (!exportId || !token) continue;
      const target = resolve(root, entry.name);

      try {
        const resolvedTarget = await realpath(target);
        if (!isBeneath(root, resolvedTarget)) continue;
        const auditExport = await this.prisma.operatorAuditExport.findUnique({
          where: { id: exportId },
          select: {
            id: true,
            backgroundJobId: true,
            processingToken: true,
            leaseExpiresAt: true,
          },
        });
        if (
          auditExport &&
          (auditExport.processingToken === token ||
            Boolean(
              auditExport.leaseExpiresAt && auditExport.leaseExpiresAt > now,
            ))
        ) {
          continue;
        }

        const backgroundJobId =
          auditExport?.backgroundJobId ??
          (
            await this.prisma.backgroundJob.findFirst({
              where: {
                scope: 'SYSTEM',
                resourceType: 'OPERATOR_AUDIT_EXPORT',
                resourceId: exportId,
              },
              select: { id: true },
            })
          )?.id;
        if (backgroundJobId) {
          const job = await this.exportQueue.getJob(backgroundJobId);
          if (job && (await job.getState()) === 'active') continue;
        }

        await rm(resolvedTarget, { recursive: true, force: true });
        deleted += 1;
      } catch {
        this.logger.warn(
          {
            exportId: safeIdentifier(exportId),
            processingToken: safeIdentifier(token),
          },
          'Operator audit export temp janitor failed',
        );
      }
    }

    return deleted;
  }

  private async databaseNow() {
    const [clock] = await this.prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    if (!clock) throw new Error('Database clock query returned no rows');
    return clock.now;
  }
}

function isBeneath(root: string, target: string) {
  const path = relative(root, target);
  return path.length > 0 && !path.startsWith('..') && !isAbsolute(path);
}

function safeIdentifier(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 100) || 'unknown';
}
