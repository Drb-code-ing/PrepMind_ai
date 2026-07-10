import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database';
import {
  operatorAuditExportDetailResponseSchema,
  operatorAuditExportListResponseSchema,
  type OperatorAuditExportDetailResponse,
  type OperatorAuditExportListQuery,
  type OperatorAuditExportListResponse,
} from '@repo/types/api/operator-audit-export';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const operatorAuditExportQuerySelect = {
  id: true,
  requestedByUserId: true,
  backgroundJobId: true,
  status: true,
  startAt: true,
  endAt: true,
  snapshotAt: true,
  filterAction: true,
  filterStatus: true,
  filterTargetType: true,
  filterTargetId: true,
  filterActorUserId: true,
  reason: true,
  objectKey: true,
  fileName: true,
  archiveSize: true,
  recordCount: true,
  csvSha256: true,
  archiveSha256: true,
  schemaVersion: true,
  errorCode: true,
  errorPreview: true,
  requestedAt: true,
  startedAt: true,
  completedAt: true,
  expiresAt: true,
  expiredAt: true,
  createdAt: true,
  updatedAt: true,
  requestHash: false,
  processingToken: false,
  leaseExpiresAt: false,
} satisfies Prisma.OperatorAuditExportSelect;

type OperatorAuditExportQueryRow = Prisma.OperatorAuditExportGetPayload<{
  select: typeof operatorAuditExportQuerySelect;
}>;

@Injectable()
export class OperatorAuditExportQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: OperatorAuditExportListQuery,
  ): Promise<OperatorAuditExportListResponse> {
    const limit = query.limit ?? 20;
    const databaseNow = await this.databaseNow();
    const rows = await this.prisma.operatorAuditExport.findMany({
      where: await this.buildListWhere(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: operatorAuditExportQuerySelect,
    });
    const visibleRows = rows.slice(0, limit);

    return operatorAuditExportListResponseSchema.parse({
      items: visibleRows.map((row) => toDetailResponse(row, databaseNow)),
      nextCursor:
        rows.length > limit
          ? (visibleRows[visibleRows.length - 1]?.id ?? null)
          : null,
    });
  }

  async getDetail(id: string): Promise<OperatorAuditExportDetailResponse> {
    const row = await this.prisma.operatorAuditExport.findFirst({
      where: { id },
      select: operatorAuditExportQuerySelect,
    });
    if (!row) {
      throw new AppError(
        'OPERATOR_AUDIT_EXPORT_NOT_FOUND',
        'Operator audit export not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return operatorAuditExportDetailResponseSchema.parse(
      toDetailResponse(row, await this.databaseNow()),
    );
  }

  private async buildListWhere(
    query: OperatorAuditExportListQuery,
  ): Promise<Prisma.OperatorAuditExportWhereInput> {
    const createdAt = {
      ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
      ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
    };

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.requestedByUserId
        ? { requestedByUserId: query.requestedByUserId }
        : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      ...(await this.buildCursorWhere(query.cursor)),
    };
  }

  private async buildCursorWhere(
    cursor?: string,
  ): Promise<Prisma.OperatorAuditExportWhereInput> {
    if (!cursor) return {};

    const cursorRow = await this.prisma.operatorAuditExport.findFirst({
      where: { id: cursor },
      select: { id: true, createdAt: true },
    });
    if (!cursorRow) {
      return { AND: [{ id: cursor }, { id: { not: cursor } }] };
    }

    return {
      OR: [
        { createdAt: { lt: cursorRow.createdAt } },
        { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
      ],
    };
  }

  private async databaseNow() {
    const [clock] = await this.prisma.$queryRaw<Array<{ now: Date }>>`
      SELECT clock_timestamp() AS now
    `;
    if (!clock) throw new Error('Database clock query returned no rows');
    return clock.now;
  }
}

function toDetailResponse(
  row: OperatorAuditExportQueryRow,
  databaseNow: Date,
): OperatorAuditExportDetailResponse {
  return {
    id: row.id,
    requestedByUserId: row.requestedByUserId,
    backgroundJobId: row.backgroundJobId,
    status: row.status,
    filters: {
      action: row.filterAction,
      status: row.filterStatus,
      targetType: row.filterTargetType,
      targetId: row.filterTargetId,
      actorUserId: row.filterActorUserId,
    },
    reason: row.reason,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    snapshotAt: row.snapshotAt.toISOString(),
    fileName: row.fileName,
    archiveSize: row.archiveSize,
    recordCount: row.recordCount,
    csvSha256: row.csvSha256,
    archiveSha256: row.archiveSha256,
    schemaVersion: row.schemaVersion,
    errorCode: row.errorCode,
    errorPreview: row.errorPreview,
    requestedAt: row.requestedAt.toISOString(),
    startedAt: toNullableIso(row.startedAt),
    completedAt: toNullableIso(row.completedAt),
    expiresAt: toNullableIso(row.expiresAt),
    expiredAt: toNullableIso(row.expiredAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canDownload:
      row.status === 'READY' &&
      row.expiresAt !== null &&
      row.expiresAt > databaseNow &&
      Boolean(row.objectKey && row.archiveSha256 && row.fileName),
  };
}

function toNullableIso(value: Date | null) {
  return value?.toISOString() ?? null;
}
