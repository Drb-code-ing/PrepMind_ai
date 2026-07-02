import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createReviewCardFromWrongQuestionRequestSchema,
  reviewLogListQuerySchema,
  reviewRatingRequestSchema,
  reviewStatsQuerySchema,
} from '@repo/types/api/review';
import { z } from 'zod';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

const todayTasksQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiTags('Reviews')
@ApiBearerAuth('access-token')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('cards/from-wrong-question')
  createFromWrongQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = createReviewCardFromWrongQuestionRequestSchema.parse(body);
    return this.reviewsService.createFromWrongQuestion(user.id, input);
  }

  @Get('cards/by-wrong-question/:wrongQuestionId')
  getByWrongQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('wrongQuestionId') wrongQuestionId: string,
  ) {
    return this.reviewsService.getByWrongQuestion(user.id, wrongQuestionId);
  }

  @Get('tasks/today')
  getTodayTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const input = todayTasksQuerySchema.parse(query);
    return this.reviewsService.getTodayTasks(user.id, input.date);
  }

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewStatsQuerySchema.parse(query);
    return this.reviewsService.getStats(user.id, input);
  }

  @Get('logs')
  getLogs(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = reviewLogListQuerySchema.parse(query);
    return this.reviewsService.getLogs(user.id, input);
  }

  @Post('cards/:cardId/rating')
  submitRating(
    @CurrentUser() user: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @Body() body: unknown,
  ) {
    const input = reviewRatingRequestSchema.parse(body);
    return this.reviewsService.submitRating(user.id, cardId, input);
  }
}
