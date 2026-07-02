import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
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
    summary: '检索知识库 chunks',
    description:
      '为查询文本生成 embedding，并只在当前用户已处理完成的资料 chunks 中做 pgvector 相似度检索。',
  })
  @ApiBody({
    description: '知识库检索请求。query 是用户问题或检索词，不应该放系统指令。',
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          maxLength: 2000,
          example: '数学函数极限复习',
        },
        topK: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 5,
          example: 5,
        },
        minScore: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.7,
          example: 0.72,
        },
      },
      example: {
        query: '数学函数极限复习',
        topK: 5,
        minScore: 0.72,
      },
    },
  })
  @ApiCreatedResponse({
    description:
      '检索结果和 SafetyGuard 元数据会包在全局 response envelope 中返回：{ success: true, data, requestId }。',
  })
  search(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = knowledgeSearchRequestSchema.parse(body ?? {});
    return this.knowledgeSearchService.search(user.id, input);
  }
}
