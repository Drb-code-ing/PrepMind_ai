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
    summary: 'List redacted background jobs for the current user',
  })
  @ApiOkResponse({
    description:
      'Background job list data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.service.list(
      user.id,
      backgroundJobListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Summarize recent background job status for the current user',
  })
  @ApiOkResponse({
    description:
      'Background job summary data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one redacted background job by id' })
  @ApiOkResponse({
    description:
      'Background job detail data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getById(user.id, id);
  }
}
