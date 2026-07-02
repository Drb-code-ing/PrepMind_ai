import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { reviewRatingRequestSchema } from '@repo/types/api/review';
import {
  reviewTaskListQuerySchema,
  reviewTaskPlanQuerySchema,
  reviewTaskTodayQuerySchema,
} from '@repo/types/api/review-task';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewTasksService } from './review-tasks.service';

@Controller('review-tasks')
@UseGuards(JwtAuthGuard)
@ApiTags('Review Tasks')
@ApiBearerAuth('access-token')
export class ReviewTasksController {
  constructor(private readonly reviewTasksService: ReviewTasksService) {}

  @Get('today')
  @ApiOperation({
    summary: '读取今日复习任务',
    description: '按当前用户和日期返回今日到期、新卡、学习中和复习卡任务。',
  })
  @ApiOkResponse({
    description:
      '今日复习任务会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getToday(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskTodayQuerySchema.parse(query);
    return this.reviewTasksService.getToday(user.id, input);
  }

  @Get('plan')
  @ApiTags('Plan')
  @ApiOperation({
    summary: '预览未来复习压力',
    description:
      '基于 FSRS 卡片状态和 ReviewPreference 只读计算 7 / 14 天复习压力，不创建未来 ReviewTask。',
  })
  @ApiOkResponse({
    description:
      '计划预览数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  getPlan(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskPlanQuerySchema.parse(query);
    return this.reviewTasksService.getPlan(user.id, input);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskListQuerySchema.parse(query);
    return this.reviewTasksService.list(user.id, input);
  }

  @Post(':taskId/rating')
  @ApiOperation({
    summary: '提交复习评分',
    description:
      '对某个 ReviewTask 提交 FSRS 评分；clientMutationId 用于离线队列补偿和重复提交幂等。',
  })
  @ApiBody({
    description:
      '复习评分请求。rating 取值 1=Again、2=Hard、3=Good、4=Easy。',
    schema: {
      type: 'object',
      required: ['rating'],
      properties: {
        rating: {
          type: 'integer',
          enum: [1, 2, 3, 4],
          example: 3,
        },
        clientMutationId: {
          type: 'string',
          format: 'uuid',
          example: '11111111-1111-4111-8111-111111111111',
        },
        reviewedAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-07-02T09:30:00.000Z',
        },
        reviewDurationMs: {
          type: 'integer',
          minimum: 0,
          example: 45000,
        },
      },
      example: {
        rating: 3,
        clientMutationId: '11111111-1111-4111-8111-111111111111',
        reviewedAt: '2026-07-02T09:30:00.000Z',
        reviewDurationMs: 45000,
      },
    },
  })
  @ApiCreatedResponse({
    description:
      '评分结果会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  submitRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const input = reviewRatingRequestSchema.parse(body);
    return this.reviewTasksService.submitRating(user.id, taskId, input);
  }

  @Post(':taskId/skip')
  @ApiOperation({
    summary: '跳过复习任务',
    description: '暂时跳过任务，不写入 ReviewLog，也不推进 FSRS 卡片状态。',
  })
  @ApiCreatedResponse({
    description:
      '跳过后的任务数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  skip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.reviewTasksService.skip(user.id, taskId);
  }

  @Post(':taskId/reopen')
  @ApiOperation({
    summary: '恢复复习任务',
    description: '把已跳过或已完成的任务恢复到可复习状态，用于用户撤销操作。',
  })
  @ApiCreatedResponse({
    description:
      '恢复后的任务数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.reviewTasksService.reopen(user.id, taskId);
  }
}
