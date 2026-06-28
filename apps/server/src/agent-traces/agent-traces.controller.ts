import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
export class AgentTracesController {
  constructor(private readonly agentTracesService: AgentTracesService) {}

  @Post()
  createTrace(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.agentTracesService.createTrace(
      user.id,
      agentTraceCreateRequestSchema.parse(body),
    );
  }

  @Get()
  listTraces(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.listTraces(
      user.id,
      agentTraceListQuerySchema.parse(query),
    );
  }

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.agentTracesService.getSummary(
      user.id,
      agentTraceSummaryQuerySchema.parse(query),
    );
  }

  @Get(':id')
  getTrace(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.agentTracesService.getTrace(user.id, id);
  }
}
