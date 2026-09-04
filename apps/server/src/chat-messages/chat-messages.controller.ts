import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  clearChatMessagesQuerySchema,
  listChatMessagesQuerySchema,
  prepareChatMessagesRequestSchema,
  syncChatMessagesRequestSchema,
} from '@repo/types/api/chat-message';
import { CHAT_TURN_ID_PATTERN } from '@repo/types/api/chat-turn';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ChatMessagesService } from './chat-messages.service';

@Controller('chat-messages')
@UseGuards(JwtAuthGuard)
@ApiTags('Chat Messages')
@ApiBearerAuth('access-token')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = listChatMessagesQuerySchema.parse(query);
    return this.chatMessagesService.list(user.id, input);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = syncChatMessagesRequestSchema.parse(body);
    return this.chatMessagesService.sync(user.id, input);
  }

  @Post('prepare')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '持久化 ChatTurn 输入快照',
    description:
      '在入队前以 append-only 方式确认 owner-bound 会话消息；允许 user 尾部，不删除既有消息，冲突时 fail-closed。',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['conversationId', 'messages'],
      properties: {
        conversationId: {
          type: 'string',
          pattern: CHAT_TURN_ID_PATTERN,
        },
        messages: {
          type: 'array',
          minItems: 1,
          maxItems: 1000,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'role', 'content', 'order'],
            properties: {
              id: { type: 'string', pattern: CHAT_TURN_ID_PATTERN },
              role: { type: 'string', enum: ['USER', 'ASSISTANT'] },
              content: { type: 'string', minLength: 1, maxLength: 100000 },
              order: { type: 'integer', minimum: 0 },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      '返回本次输入消息的 canonical PostgreSQL 投影；响应仍由全局 envelope 包装。',
  })
  prepareForTurn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = prepareChatMessagesRequestSchema.parse(body);
    return this.chatMessagesService.prepareForTurn(user.id, input);
  }

  @Delete()
  clear(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = clearChatMessagesQuerySchema.parse(query);
    return this.chatMessagesService.clear(user.id, input.conversationId);
  }
}
