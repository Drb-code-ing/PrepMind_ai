import {
  CanActivate,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import type { ServerEnv } from '../config/env';
import { WorkerObservabilityService } from './worker-observability.service';

@Injectable()
export class WorkerObservabilityEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService<ServerEnv, true>) {}

  canActivate(): boolean {
    if (!this.config.get('WORKER_OBSERVABILITY_ENABLED', { infer: true })) {
      throw new NotFoundException('Worker observability is disabled');
    }

    return true;
  }
}

@Controller('worker-observability')
@UseGuards(WorkerObservabilityEnabledGuard, JwtAuthGuard, OperatorGuard)
@ApiTags('Worker Observability')
@ApiBearerAuth('access-token')
export class WorkerObservabilityController {
  constructor(private readonly service: WorkerObservabilityService) {}

  @Get('summary')
  @ApiOperation({
    summary: '汇总后台 worker 与队列状态',
    description:
      '读取当前后台处理模式、knowledge-document-processing 队列计数、worker 心跳和当前账号后台任务摘要。队列计数是系统级信号，BackgroundJob 摘要按当前账号隔离。',
  })
  @ApiOkResponse({
    description:
      'worker 可观测摘要会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.id);
  }
}
