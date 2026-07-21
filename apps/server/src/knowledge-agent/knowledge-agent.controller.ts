import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  knowledgeAgentSuggestionQuerySchema,
  knowledgeAgentSuggestionResponseSchema,
  type KnowledgeAgentSuggestionResponse,
} from '@repo/types/api/knowledge-agent';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KnowledgeAgentService } from './knowledge-agent.service';

@Controller('knowledge-agent')
@UseGuards(JwtAuthGuard)
@ApiTags('Knowledge Agent')
@ApiBearerAuth('access-token')
export class KnowledgeAgentController {
  constructor(private readonly knowledgeAgentService: KnowledgeAgentService) {}

  @Get('suggestions')
  async getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
    @Req() request: Request,
  ): Promise<KnowledgeAgentSuggestionResponse> {
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.once('aborted', abort);
    if (request.aborted) abort();
    try {
      return knowledgeAgentSuggestionResponseSchema.parse(
        await this.knowledgeAgentService.getSuggestions(
          user.id,
          knowledgeAgentSuggestionQuerySchema.parse(query),
          abortController.signal,
        ),
      );
    } finally {
      request.off('aborted', abort);
    }
  }
}
