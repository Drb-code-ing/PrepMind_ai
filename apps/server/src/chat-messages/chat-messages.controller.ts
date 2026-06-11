import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  clearChatMessagesQuerySchema,
  listChatMessagesQuerySchema,
  syncChatMessagesRequestSchema,
} from '@repo/types/api/chat-message';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ChatMessagesService } from './chat-messages.service';

@Controller('chat-messages')
@UseGuards(JwtAuthGuard)
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

  @Delete()
  clear(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = clearChatMessagesQuerySchema.parse(query);
    return this.chatMessagesService.clear(user.id, input.conversationId);
  }
}
