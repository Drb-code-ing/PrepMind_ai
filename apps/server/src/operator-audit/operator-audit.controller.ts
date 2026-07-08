import {
  CanActivate,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  operatorAuditLogListQuerySchema,
  type OperatorAuditLogListResponse,
} from '@repo/types/api/operator-audit';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import type { ServerEnv } from '../config/env';
import { OperatorAuditService } from './operator-audit.service';

@Injectable()
export class OperatorAuditEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService<ServerEnv, true>) {}

  canActivate() {
    if (!this.config.get('OPERATOR_AUDIT_ENABLED', { infer: true })) {
      throw new NotFoundException('Operator audit is disabled');
    }

    return true;
  }
}

@Controller('operator-audit-logs')
@UseGuards(OperatorAuditEnabledGuard, JwtAuthGuard, OperatorGuard)
@ApiTags('Operator Audit')
@ApiBearerAuth('access-token')
export class OperatorAuditController {
  constructor(private readonly service: OperatorAuditService) {}

  @Get()
  @ApiOperation({
    summary: '查看脱敏 operator 操作审计日志',
    description:
      '仅用于本地开发和受控诊断。返回高权限诊断写操作的脱敏审计记录，不返回 payload、metadata、prompt、RAG chunk、模型回答、API key、token、cookie、原始 IP 或原始 User-Agent。',
  })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'targetId', required: false })
  @ApiQuery({ name: 'actorUserId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiOkResponse({ description: '脱敏 operator 审计日志列表。' })
  async list(
    @Query() query: Record<string, unknown>,
  ): Promise<OperatorAuditLogListResponse> {
    return this.service.list(operatorAuditLogListQuerySchema.parse(query));
  }
}
