import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { WorkerReadinessResponse } from '@repo/types/api/worker-readiness';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ServerEnv } from '../config/env';
import { WorkerReadinessService } from './worker-readiness.service';

@Controller('worker-readiness')
@UseGuards(JwtAuthGuard)
@ApiTags('Worker Readiness')
@ApiBearerAuth('access-token')
export class WorkerReadinessController {
  constructor(
    private readonly service: WorkerReadinessService,
    private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: '检查后台 worker readiness',
    description:
      '返回 Redis、BullMQ 队列、worker heartbeat 和 outbox 的安全 readiness 摘要。不返回 payload、用户正文、prompt、RAG chunk、API key、token 或 cookie。',
  })
  @ApiOkResponse({
    description:
      'readiness 摘要会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  async readiness(): Promise<WorkerReadinessResponse> {
    if (!this.config.get('WORKER_READINESS_ENABLED', { infer: true })) {
      throw new NotFoundException('Worker readiness is disabled');
    }

    return this.service.getReadiness();
  }
}
