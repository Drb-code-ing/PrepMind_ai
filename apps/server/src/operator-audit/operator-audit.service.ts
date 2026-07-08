import { createHash } from 'node:crypto';

import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Prisma } from '@repo/database';

import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type OperatorAuditAction = 'OUTBOX_REQUEUE';
type OperatorAuditStatus = 'SUCCEEDED' | 'FAILED';

type AuditRequest = {
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

@Injectable()
export class OperatorAuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly logger: Pick<Logger, 'warn'> = new Logger(
      OperatorAuditService.name,
    ),
  ) {}

  async recordSuccess(input: AuditInput): Promise<void> {
    await this.record({
      ...this.createBaseData(input, 'SUCCEEDED'),
      metadata: sanitizeMetadata(input.metadata),
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
      ipAddressHash: hashValue(input.request?.ip),
      userAgentHash: hashValue(readHeader(input.request, 'user-agent')),
      createdAt: input.now,
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

function hashValue(value: string | undefined) {
  if (!value) return undefined;
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
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
