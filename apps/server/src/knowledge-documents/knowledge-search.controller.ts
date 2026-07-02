import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Search processed knowledge document chunks for the current user',
  })
  @ApiCreatedResponse({
    description:
      'Search results and safety metadata are returned in the global response envelope: { success: true, data, requestId }.',
  })
  search(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = knowledgeSearchRequestSchema.parse(body ?? {});
    return this.knowledgeSearchService.search(user.id, input);
  }
}
