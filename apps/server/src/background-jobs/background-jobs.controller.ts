import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { backgroundJobListQuerySchema } from '@repo/types/api/background-job';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { BackgroundJobsService } from './background-jobs.service';

@Controller('background-jobs')
@UseGuards(JwtAuthGuard)
@ApiTags('Background Jobs')
@ApiBearerAuth('access-token')
export class BackgroundJobsController {
  constructor(private readonly service: BackgroundJobsService) {}

  @Get()
  @ApiOperation({
    summary: '列出后台任务记录',
    description:
      '按当前用户读取后台任务列表。返回内容只包含任务状态和必要摘要，并隐藏敏感内容。',
  })
  @ApiOkResponse({
    description:
      '后台任务列表会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(
      user.id,
      backgroundJobListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: '汇总最近后台任务状态',
    description:
      '统计当前用户最近后台任务的活跃、成功、失败和跳过情况，用于页面状态提示。',
  })
  @ApiOkResponse({
    description:
      '后台任务汇总会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: '读取单个后台任务详情',
    description:
      '读取当前用户的一条后台任务记录，只返回状态、资源信息、时间戳和错误摘要等安全字段。',
  })
  @ApiOkResponse({
    description:
      '后台任务详情会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }
}
