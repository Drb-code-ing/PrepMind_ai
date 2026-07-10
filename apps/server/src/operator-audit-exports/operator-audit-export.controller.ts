import {
  Body,
  CanActivate,
  Controller,
  HttpCode,
  HttpStatus,
  Injectable,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  operatorAuditExportCreateRequestSchema,
  type OperatorAuditExportDetailResponse,
} from '@repo/types/api/operator-audit-export';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { AppError } from '../common/errors/app-error';
import type { RequestWithId } from '../common/middleware/request-id.middleware';
import type { ServerEnv } from '../config/env';
import { OperatorAuditEnabledGuard } from '../operator-audit/operator-audit.controller';
import { OperatorAuditExportRequestService } from './operator-audit-export-request.service';

@Injectable()
export class OperatorAuditExportEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService<ServerEnv, true>) {}

  canActivate() {
    if (!this.config.get('OPERATOR_AUDIT_EXPORT_ENABLED', { infer: true })) {
      throw new NotFoundException('Operator audit export is disabled');
    }

    return true;
  }
}

const safeErrorExample = (code: string) => ({
  success: false,
  error: { code, message: 'Safe operator-facing error' },
  requestId: 'req_safe_id',
});

@Controller('operator-audit-exports')
@UseGuards(
  OperatorAuditEnabledGuard,
  OperatorAuditExportEnabledGuard,
  JwtAuthGuard,
  OperatorGuard,
)
@ApiTags('Operator Audit Exports')
@ApiBearerAuth('access-token')
export class OperatorAuditExportController {
  constructor(
    private readonly requestService: OperatorAuditExportRequestService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: '申请异步 Operator Audit 证据包',
    description:
      '在单个 PostgreSQL 事务内创建导出、SYSTEM 后台任务、Outbox 事件和严格申请审计；请求链路不直接调用 BullMQ。',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['clientRequestId', 'startAt', 'endAt', 'reason'],
      properties: {
        clientRequestId: { type: 'string', format: 'uuid' },
        startAt: { type: 'string', format: 'date-time' },
        endAt: { type: 'string', format: 'date-time' },
        reason: { type: 'string', minLength: 3, maxLength: 240 },
        action: {
          type: 'string',
          enum: [
            'OUTBOX_REQUEUE',
            'AUDIT_EXPORT_REQUEST',
            'AUDIT_EXPORT_DOWNLOAD',
          ],
        },
        status: {
          type: 'string',
          enum: ['SUCCEEDED', 'FAILED'],
        },
        targetType: { type: 'string', minLength: 1, maxLength: 120 },
        targetId: { type: 'string', minLength: 1, maxLength: 200 },
        actorUserId: { type: 'string', minLength: 1 },
      },
      example: {
        clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
        startAt: '2026-07-01T00:00:00.000Z',
        endAt: '2026-07-10T00:00:00.000Z',
        reason: 'INC-safe-id evidence review',
        action: 'OUTBOX_REQUEUE',
        status: 'FAILED',
        targetType: 'OutboxEvent',
        targetId: 'evt_safe_id',
        actorUserId: 'user_safe_id',
      },
    },
  })
  @ApiAcceptedResponse({
    description: '脱敏证据包申请详情；不包含 requestHash 或 objectKey。',
    schema: {
      example: {
        id: 'export_safe_id',
        backgroundJobId: 'job_safe_id',
        status: 'QUEUED',
        canDownload: false,
      },
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: safeErrorExample('OPERATOR_AUDIT_EXPORT_INVALID_REQUEST'),
    },
  })
  @ApiConflictResponse({
    schema: {
      example: safeErrorExample('OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT'),
    },
  })
  @ApiTooManyRequestsResponse({
    schema: {
      example: safeErrorExample('OPERATOR_AUDIT_EXPORT_LIMIT_REACHED'),
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      example: safeErrorExample('OPERATOR_AUDIT_EXPORT_AUDIT_FAILED'),
    },
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Req() request: RequestWithId,
  ): Promise<OperatorAuditExportDetailResponse> {
    const parsed = operatorAuditExportCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
        'Invalid operator audit export request',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.requestService.create(user.id, parsed.data, request);
  }
}
