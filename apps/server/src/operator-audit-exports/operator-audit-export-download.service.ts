import type { Readable } from 'node:stream';

import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@repo/database';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  type AuditRequest,
  OperatorAuditService,
} from '../operator-audit/operator-audit.service';
import {
  OperatorAuditExportStorageError,
  StorageService,
} from '../uploads/storage.service';

export type OperatorAuditExportDownload = {
  stream: Readable;
  fileName: string;
  archiveSize: number;
  archiveSha256: string;
};

const operatorAuditExportDownloadSelect = {
  id: true,
  requestedByUserId: true,
  status: true,
  reason: true,
  objectKey: true,
  fileName: true,
  archiveSize: true,
  archiveSha256: true,
  expiresAt: true,
} satisfies Prisma.OperatorAuditExportSelect;

@Injectable()
export class OperatorAuditExportDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: OperatorAuditService,
    private readonly config: ConfigService<ServerEnv, true>,
    @Optional()
    private readonly logger: Pick<Logger, 'warn'> = new Logger(
      OperatorAuditExportDownloadService.name,
    ),
  ) {}

  async download(
    actorUserId: string,
    exportId: string,
    request?: AuditRequest,
  ): Promise<OperatorAuditExportDownload> {
    const auditExport = await this.prisma.operatorAuditExport.findFirst({
      where: { id: exportId },
      select: operatorAuditExportDownloadSelect,
    });
    if (!auditExport) {
      throw domainError(
        'OPERATOR_AUDIT_EXPORT_NOT_FOUND',
        'Operator audit export not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const databaseNow = await this.databaseNow();
    if (auditExport.status === 'EXPIRED') {
      throw domainError(
        'OPERATOR_AUDIT_EXPORT_EXPIRED',
        'Operator audit export has expired',
        HttpStatus.GONE,
      );
    }
    if (auditExport.status !== 'READY') {
      throw domainError(
        'OPERATOR_AUDIT_EXPORT_NOT_READY',
        'Operator audit export is not ready',
        HttpStatus.CONFLICT,
      );
    }
    if (!auditExport.expiresAt || auditExport.expiresAt <= databaseNow) {
      throw domainError(
        'OPERATOR_AUDIT_EXPORT_EXPIRED',
        'Operator audit export has expired',
        HttpStatus.GONE,
      );
    }

    const { objectKey, fileName, archiveSize, archiveSha256 } = auditExport;
    if (
      !objectKey ||
      !fileName ||
      archiveSize === null ||
      !Number.isSafeInteger(archiveSize) ||
      archiveSize <= 0 ||
      archiveSize >
        this.config.get('OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES', {
          infer: true,
        }) ||
      !archiveSha256 ||
      !/^sha256:[a-f0-9]{64}$/.test(archiveSha256)
    ) {
      throw fileUnavailable();
    }

    let stream: Readable;
    let storageSize: number;
    try {
      ({ stream, size: storageSize } =
        await this.storage.readOperatorAuditExport(objectKey));
    } catch (error) {
      const safeError = fileUnavailable();
      await this.auditDownloadFailure({
        actorUserId,
        exportId,
        reason: auditExport.reason,
        request,
        error: safeError,
      });
      if (
        error instanceof OperatorAuditExportStorageError &&
        error.kind === 'missing'
      ) {
        await this.markConfirmedMissing(exportId, objectKey);
      }
      throw safeError;
    }

    if (storageSize !== archiveSize) {
      stream.destroy();
      this.logger.warn('Operator audit export size mismatch');
      const safeError = fileUnavailable();
      await this.auditDownloadFailure({
        actorUserId,
        exportId,
        reason: auditExport.reason,
        request,
        error: safeError,
      });
      throw safeError;
    }

    try {
      await this.audit.recordSuccessStrict(this.prisma, {
        actorUserId,
        action: 'AUDIT_EXPORT_DOWNLOAD',
        targetType: 'OperatorAuditExport',
        targetId: exportId,
        reason: auditExport.reason,
        request,
        metadata: { source: 'http' },
      });
    } catch {
      this.logger.warn('Operator audit export download audit failed');
      stream.destroy();
      throw domainError(
        'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
        'Operator audit export download audit failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { stream, fileName, archiveSize, archiveSha256 };
  }

  private async auditDownloadFailure(input: {
    actorUserId: string;
    exportId: string;
    reason: string;
    request?: AuditRequest;
    error: AppError;
  }) {
    await this.audit
      .recordFailure({
        actorUserId: input.actorUserId,
        action: 'AUDIT_EXPORT_DOWNLOAD',
        targetType: 'OperatorAuditExport',
        targetId: input.exportId,
        reason: input.reason,
        request: input.request,
        metadata: { source: 'http' },
        error: input.error,
      })
      .catch(() => undefined);
  }

  private async markConfirmedMissing(exportId: string, objectKey: string) {
    try {
      const result = await this.prisma.operatorAuditExport.updateMany({
        where: { id: exportId, status: 'READY', objectKey },
        data: {
          status: 'FAILED',
          objectKey: null,
          errorCode: 'EXPORT_FILE_MISSING',
          errorPreview: 'Export file is missing',
        },
      });
      if (result.count !== 1) {
        this.logger.warn('Failed to mark missing operator audit export');
      }
    } catch {
      this.logger.warn('Failed to mark missing operator audit export');
    }
  }

  private async databaseNow() {
    const [clock] = await this.prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS now
    `;
    if (!clock) throw new Error('Database clock query returned no rows');
    return clock.now;
  }
}

function fileUnavailable() {
  return domainError(
    'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
    'Operator audit export file is unavailable',
    HttpStatus.BAD_GATEWAY,
  );
}

function domainError(code: string, message: string, status: number) {
  return new AppError(code, message, status);
}
