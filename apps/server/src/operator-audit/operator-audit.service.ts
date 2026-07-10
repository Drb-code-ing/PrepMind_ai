import { createHmac } from 'node:crypto';

import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@repo/database';
import type {
  OperatorAuditAction,
  OperatorAuditLogDetailResponse,
  OperatorAuditLogListQuery,
  OperatorAuditLogListResponse,
} from '@repo/types/api/operator-audit';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type OperatorAuditStatus = 'SUCCEEDED' | 'FAILED';

export type AuditRequest = {
  ip?: string;
  requestId?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type AuditInput = {
  actorUserId: string;
  action: OperatorAuditAction;
  targetType: string;
  targetId?: string;
  reason?: string;
  request?: AuditRequest;
  metadata?: Prisma.InputJsonValue;
  now?: Date;
};

type FailureAuditInput = AuditInput & {
  error: unknown;
};

type OperatorAuditCreateData = {
  actorUserId: string;
  action: OperatorAuditAction;
  status: OperatorAuditStatus;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: Prisma.InputJsonValue;
  errorCode?: string;
  errorPreview?: string;
  requestId?: string;
  ipAddressHash?: string;
  userAgentHash?: string;
  createdAt?: Date;
};

type OperatorAuditLogRow = {
  id: string;
  actorUserId: string | null;
  action: OperatorAuditAction;
  status: OperatorAuditStatus;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
  ipAddressHash: string | null;
  userAgentHash: string | null;
  errorCode: string | null;
  errorPreview: string | null;
  createdAt: Date;
};

const MAX_REASON_LENGTH = 240;
const MAX_ERROR_PREVIEW_LENGTH = 240;
const MAX_REQUEST_ID_LENGTH = 80;
const ALLOWED_METADATA_KEYS = new Set([
  'attemptsAfter',
  'attemptsBefore',
  'lastErrorCode',
  'nextStatus',
  'payloadHash',
  'previousStatus',
  'source',
]);

const operatorAuditLogSelect = {
  id: true,
  actorUserId: true,
  action: true,
  status: true,
  targetType: true,
  targetId: true,
  reason: true,
  requestId: true,
  ipAddressHash: true,
  userAgentHash: true,
  errorCode: true,
  errorPreview: true,
  createdAt: true,
  metadata: false,
} satisfies Prisma.OperatorAuditLogSelect;

@Injectable()
export class OperatorAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    @Optional()
    private readonly logger: Pick<Logger, 'warn'> = new Logger(
      OperatorAuditService.name,
    ),
  ) {}

  async recordSuccess(input: AuditInput): Promise<void> {
    try {
      await this.recordSuccessStrict(this.prisma, input);
    } catch {
      this.logger.warn('Failed to record operator audit log');
    }
  }

  async recordSuccessStrict(
    client: PrismaService | Prisma.TransactionClient,
    input: AuditInput,
  ): Promise<void> {
    await client.operatorAuditLog.create({
      data: {
        ...this.createBaseData(input, 'SUCCEEDED'),
        metadata: sanitizeMetadata(input.metadata),
      },
    });
  }

  async recordFailure(input: FailureAuditInput): Promise<void> {
    await this.record({
      ...this.createBaseData(input, 'FAILED'),
      errorCode: sanitizeText(
        getErrorCode(input.error),
        MAX_ERROR_PREVIEW_LENGTH,
      ),
      errorPreview: sanitizeJobError(
        input.error,
        'Operator action failed',
      ).slice(0, MAX_ERROR_PREVIEW_LENGTH),
    });
  }

  async list(
    query: OperatorAuditLogListQuery,
  ): Promise<OperatorAuditLogListResponse> {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.operatorAuditLog.findMany({
      where: await this.buildListWhere(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: operatorAuditLogSelect,
    });

    const visibleRows = rows.slice(0, limit);

    return {
      items: visibleRows.map((row) => this.toListItem(row)),
      nextCursor:
        rows.length > limit
          ? (visibleRows[visibleRows.length - 1]?.id ?? null)
          : null,
    };
  }

  async getDetail(id: string): Promise<OperatorAuditLogDetailResponse> {
    const row = await this.prisma.operatorAuditLog.findFirst({
      where: { id },
      select: operatorAuditLogSelect,
    });

    if (!row) {
      throw new AppError(
        'OPERATOR_AUDIT_LOG_NOT_FOUND',
        'Operator audit log not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toListItem(row);
  }

  private async record(data: OperatorAuditCreateData) {
    try {
      await this.prisma.operatorAuditLog.create({
        data,
      });
    } catch {
      this.logger.warn('Failed to record operator audit log');
    }
  }

  private createBaseData(
    input: AuditInput,
    status: OperatorAuditStatus,
  ): OperatorAuditCreateData {
    return {
      actorUserId: input.actorUserId,
      action: input.action,
      status,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: sanitizeText(input.reason, MAX_REASON_LENGTH),
      requestId: truncate(
        sanitizeText(
          input.request?.requestId ?? readHeader(input.request, 'x-request-id'),
          MAX_REQUEST_ID_LENGTH,
        ),
        MAX_REQUEST_ID_LENGTH,
      ),
      ipAddressHash: hmacValue(
        input.request?.ip,
        this.config.get('OPERATOR_AUDIT_FINGERPRINT_SECRET', { infer: true }),
      ),
      userAgentHash: hmacValue(
        readHeader(input.request, 'user-agent'),
        this.config.get('OPERATOR_AUDIT_FINGERPRINT_SECRET', { infer: true }),
      ),
      createdAt: input.now,
    };
  }

  private async buildListWhere(
    query: OperatorAuditLogListQuery,
  ): Promise<Prisma.OperatorAuditLogWhereInput> {
    return {
      ...(query.action ? { action: query.action } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(await this.buildCursorWhere(query.cursor)),
    };
  }

  private async buildCursorWhere(
    cursor?: string,
  ): Promise<Prisma.OperatorAuditLogWhereInput> {
    if (!cursor) {
      return {};
    }

    const cursorRow = await this.prisma.operatorAuditLog.findFirst({
      where: { id: cursor },
      select: { id: true, createdAt: true },
    });

    if (!cursorRow) {
      return {
        AND: [{ id: cursor }, { id: { not: cursor } }],
      };
    }

    return {
      OR: [
        { createdAt: { lt: cursorRow.createdAt } },
        { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
      ],
    };
  }

  private toListItem(row: OperatorAuditLogRow) {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      status: row.status,
      targetType: row.targetType,
      targetId: row.targetId,
      reason: row.reason,
      requestId: row.requestId,
      ipAddressHash: row.ipAddressHash,
      userAgentHash: row.userAgentHash,
      errorCode: row.errorCode,
      errorPreview: row.errorPreview,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function sanitizeMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return undefined;
  if (typeof value !== 'object') return sanitizePrimitive(value);

  const result: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!ALLOWED_METADATA_KEYS.has(key)) continue;

    const sanitized =
      typeof entry === 'string'
        ? sanitizeText(entry, 240)
        : sanitizePrimitive(entry);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function sanitizePrimitive(value: unknown): Prisma.InputJsonValue | undefined {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  return undefined;
}

function readHeader(request: AuditRequest | undefined, name: string) {
  const value = request?.headers?.[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function hmacValue(value: string | undefined, secret: string | undefined) {
  if (!value || !secret) return undefined;
  return `hmac-sha256:${createHmac('sha256', secret).update(value).digest('hex')}`;
}

function truncate(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  return value.slice(0, maxLength);
}

function sanitizeText(value: string | undefined, maxLength: number) {
  if (!value) return undefined;
  return sanitizeJobError(value, '').slice(0, maxLength) || undefined;
}

function getErrorCode(error: unknown) {
  if (error instanceof Error) return error.name;
  return typeof error;
}
