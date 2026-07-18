import { Controller, Get, Headers, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { reviewAgentSuggestionQuerySchema } from '@repo/types/api/review-agent';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewAgentService } from './review-agent.service';
import { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_HEADER } from './review-planner-product-acceptance-admission';

@Controller('review-agent')
@UseGuards(JwtAuthGuard)
@ApiTags('Review Agent')
@ApiBearerAuth('access-token')
export class ReviewAgentController {
  constructor(private readonly reviewAgentService: ReviewAgentService) {}

  @Get('suggestions')
  getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
    @Headers(REVIEW_PLANNER_PRODUCT_ACCEPTANCE_HEADER)
    rawAcceptanceCapability: unknown,
  ) {
    const input = reviewAgentSuggestionQuerySchema.parse(query);
    return this.reviewAgentService.getSuggestions(
      user.id,
      input,
      typeof rawAcceptanceCapability === 'string'
        ? rawAcceptanceCapability
        : undefined,
    );
  }
}
