import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { backgroundJobListQuerySchema } from '@repo/types/api/background-job';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/decorators/current-user.decorator';
import { BackgroundJobsService } from './background-jobs.service';

@Controller('background-jobs')
@UseGuards(JwtAuthGuard)
export class BackgroundJobsController {
  constructor(private readonly service: BackgroundJobsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(user.id, backgroundJobListQuerySchema.parse(query));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.id);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }
}
