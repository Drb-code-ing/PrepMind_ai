import {
  Body,
  CanActivate,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  outboxEventListQuerySchema,
  outboxEventRequeueRequestSchema,
} from '@repo/types/api/outbox';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import type { RequestWithId } from '../common/middleware/request-id.middleware';
import type { ServerEnv } from '../config/env';
import { OperatorAuditService } from '../operator-audit/operator-audit.service';
import { OutboxOpsService } from './outbox-ops.service';

@Injectable()
export class OutboxOpsEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService<ServerEnv, true>) {}

  canActivate() {
    if (!this.config.get('OUTBOX_OPS_ENABLED', { infer: true })) {
      throw new NotFoundException('Outbox ops is disabled');
    }

    return true;
  }
}

@Controller('outbox-events')
@UseGuards(OutboxOpsEnabledGuard, JwtAuthGuard, OperatorGuard)
@ApiTags('Outbox Ops')
@ApiBearerAuth('access-token')
export class OutboxOpsController {
  constructor(
    private readonly service: OutboxOpsService,
    private readonly audit: OperatorAuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '查看脱敏 Outbox 事件列表',
    description:
      '仅用于本地开发和受控诊断。不会返回 payload、aggregateId、用户正文、prompt、chunk、API key、token 或 cookie。',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiOkResponse({ description: '脱敏 outbox 事件列表。' })
  async list(@Query() query: Record<string, unknown>) {
    return this.service.list(outboxEventListQuerySchema.parse(query));
  }

  @Get(':id')
  @ApiOperation({
    summary: '查看单个脱敏 Outbox 事件',
    description:
      '返回状态、attempts、锁信息和脱敏错误预览，但永远不返回 payload 或业务正文。',
  })
  @ApiParam({ name: 'id', description: 'Outbox event id' })
  @ApiOkResponse({ description: '脱敏 outbox 事件详情。' })
  async detail(@Param('id') id: string) {
    return this.service.getDetail(id);
  }

  @Post(':id/requeue')
  @ApiOperation({
    summary: '重新排队 FAILED / DEAD Outbox 事件',
    description:
      '只把 FAILED 或 DEAD 事件安全重置为 PENDING，不会立即执行 handler，也不会修改 payload。',
  })
  @ApiParam({ name: 'id', description: 'Outbox event id' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          example: '修复 provider 配置后重新排队',
        },
      },
    },
  })
  @ApiOkResponse({ description: '重新排队后的脱敏 outbox 事件详情。' })
  async requeue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: RequestWithId,
  ) {
    const parsed = outboxEventRequeueRequestSchema.parse(body ?? {});

    try {
      const result = await this.service.requeue(id, new Date());
      await this.audit.recordSuccess({
        actorUserId: user.id,
        action: 'OUTBOX_REQUEUE',
        targetType: 'OutboxEvent',
        targetId: id,
        reason: parsed.reason,
        request,
        metadata: {
          nextStatus: result.status,
          payloadHash: result.payloadHash,
          source: 'http',
        },
      });

      return result;
    } catch (error) {
      await this.audit.recordFailure({
        actorUserId: user.id,
        action: 'OUTBOX_REQUEUE',
        targetType: 'OutboxEvent',
        targetId: id,
        reason: parsed.reason,
        request,
        error,
      });
      throw error;
    }
  }
}
