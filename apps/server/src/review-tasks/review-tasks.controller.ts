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
  @ApiOperation({ summary: 'Get today review tasks for the current user' })
  @ApiOkResponse({
    description:
      'Today review tasks are returned in the global response envelope: { success: true, data, requestId }.',
  })
  getToday(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewTaskTodayQuerySchema.parse(query);
    return this.reviewTasksService.getToday(user.id, input);
  }

  @Get('plan')
  @ApiTags('Plan')
  @ApiOperation({
    summary: 'Preview future review pressure without creating tasks',
  })
  @ApiOkResponse({
    description:
      'Plan preview data is returned in the global response envelope: { success: true, data, requestId }.',
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
    summary: 'Submit an idempotent FSRS rating for a review task',
  })
  @ApiCreatedResponse({
    description:
      'Rating result is returned in the global response envelope: { success: true, data, requestId }.',
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
  @ApiOperation({ summary: 'Skip a review task without rating it' })
  @ApiCreatedResponse({
    description:
      'Skipped task data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  skip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.reviewTasksService.skip(user.id, taskId);
  }

  @Post(':taskId/reopen')
  @ApiOperation({ summary: 'Reopen a skipped or completed review task' })
  @ApiCreatedResponse({
    description:
      'Reopened task data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId') taskId: string,
  ) {
    return this.reviewTasksService.reopen(user.id, taskId);
  }
}
