import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { WorkerObservabilityService } from './worker-observability.service';

@Controller('worker-observability')
@UseGuards(JwtAuthGuard)
@ApiTags('Worker Observability')
@ApiBearerAuth('access-token')
export class WorkerObservabilityController {
  constructor(private readonly service: WorkerObservabilityService) {}

  @Get('summary')
  @ApiOperation({
    summary: '汇总后台 worker 与队列状态',
    description:
      '读取当前后台处理模式、document-processing 队列计数、worker 心跳和当前账号后台任务摘要。队列计数是系统级信号，BackgroundJob 摘要按当前账号隔离。',
  })
  @ApiOkResponse({
    description:
      'worker 可观测摘要会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.id);
  }
}
