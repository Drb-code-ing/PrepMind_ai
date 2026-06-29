import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { reviewAgentSuggestionQuerySchema } from '@repo/types/api/review-agent';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewAgentService } from './review-agent.service';

@Controller('review-agent')
@UseGuards(JwtAuthGuard)
export class ReviewAgentController {
  constructor(private readonly reviewAgentService: ReviewAgentService) {}

  @Get('suggestions')
  getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const input = reviewAgentSuggestionQuerySchema.parse(query);
    return this.reviewAgentService.getSuggestions(user.id, input);
  }
}
