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
import {
  agentTraceCreateRequestSchema,
  agentTraceListQuerySchema,
  agentTraceSummaryQuerySchema,
} from '@repo/types/api/agent-trace';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgentTracesService } from './agent-traces.service';

@Controller('agent-traces')
@UseGuards(JwtAuthGuard)
@ApiTags('Agent Traces')
@ApiBearerAuth('access-token')
export class AgentTracesController {
  constructor(private readonly agentTracesService: AgentTracesService) {}

  @Post()
  @ApiOperation({ summary: 'Record a redacted agent trace run' })
  @ApiCreatedResponse({
    description:
      'Created trace metadata is returned in the global response envelope: { success: true, data, requestId }.',
  })
  createTrace(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.agentTracesService.createTrace(
      user.id,
      agentTraceCreateRequestSchema.parse(body),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List redacted agent trace runs for the current user',
  })
  @ApiOkResponse({
    description:
      'Trace list data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  listTraces(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.listTraces(
      user.id,
      agentTraceListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Summarize recent agent trace usage and estimated cost',
  })
  @ApiOkResponse({
    description:
      'Trace summary data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.getSummary(
      user.id,
      agentTraceSummaryQuerySchema.parse(query),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read one redacted agent trace run with steps' })
  @ApiOkResponse({
    description:
      'Trace detail data is returned in the global response envelope: { success: true, data, requestId }.',
  })
  getTrace(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentTracesService.getTrace(user.id, id);
  }
}
