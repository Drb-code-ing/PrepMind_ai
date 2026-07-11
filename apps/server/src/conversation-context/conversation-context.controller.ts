import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { conversationContextPrepareRequestSchema } from '@repo/types/api/conversation-context';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ConversationContextService } from './conversation-context.service';

@Controller('conversation-context')
@UseGuards(JwtAuthGuard)
@ApiTags('Conversation Context')
@ApiBearerAuth('access-token')
export class ConversationContextController {
  constructor(private readonly service: ConversationContextService) {}

  @Post('prepare')
  prepare(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.service.prepare(
      user.id,
      conversationContextPrepareRequestSchema.parse(body),
    );
  }
}
