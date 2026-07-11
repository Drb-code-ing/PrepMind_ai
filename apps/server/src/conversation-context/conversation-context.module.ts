import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AuthModule } from '../auth/auth.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { ConversationContextController } from './conversation-context.controller';
import { ConversationContextService } from './conversation-context.service';
import {
  CONVERSATION_STATE_REDIS,
  ConversationStateCacheService,
} from './conversation-state-cache.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ConversationContextController],
  providers: [
    {
      provide: CONVERSATION_STATE_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ServerEnv, true>) =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        }),
    },
    ConversationStateCacheService,
    ConversationContextService,
  ],
  exports: [ConversationStateCacheService, ConversationContextService],
})
export class ConversationContextModule {}
