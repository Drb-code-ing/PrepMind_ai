import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { knowledgeSearchRequestSchema } from '@repo/types/api/knowledge';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KnowledgeSearchService } from './knowledge-search.service';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
@ApiTags('Knowledge Search')
@ApiBearerAuth('access-token')
export class KnowledgeSearchController {
  constructor(
    private readonly knowledgeSearchService: KnowledgeSearchService,
  ) {}

  @Post('search')
  search(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = knowledgeSearchRequestSchema.parse(body ?? {});
    return this.knowledgeSearchService.search(user.id, input);
  }
}
