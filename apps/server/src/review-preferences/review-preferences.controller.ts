import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { reviewPreferencePatchSchema } from '@repo/types/api/review-preference';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ReviewPreferencesService } from './review-preferences.service';

@Controller('review-preferences')
@UseGuards(JwtAuthGuard)
@ApiTags('Review Preferences')
@ApiBearerAuth('access-token')
export class ReviewPreferencesController {
  constructor(
    private readonly reviewPreferencesService: ReviewPreferencesService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.reviewPreferencesService.getByUserId(user.id);
  }

  @Patch()
  patch(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = reviewPreferencePatchSchema.parse(body);
    return this.reviewPreferencesService.patch(user.id, input);
  }
}
