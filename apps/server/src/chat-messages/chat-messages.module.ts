import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConversationContextModule } from '../conversation-context/conversation-context.module';
import { DatabaseModule } from '../database/database.module';
import { ChatMessagesController } from './chat-messages.controller';
import { ChatMessagesService } from './chat-messages.service';

@Module({
  imports: [AuthModule, DatabaseModule, ConversationContextModule],
  controllers: [ChatMessagesController],
  providers: [ChatMessagesService],
})
export class ChatMessagesModule {}
