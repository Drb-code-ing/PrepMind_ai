import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { knowledgeAgentSuggestionQuerySchema } from '@repo/types/api/knowledge-agent';

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
  getSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    return this.knowledgeAgentService.getSuggestions(
      user.id,
      knowledgeAgentSuggestionQuerySchema.parse(query),
    );
  }
}
