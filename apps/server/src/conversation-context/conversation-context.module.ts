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
import {
  CONVERSATION_SUMMARY_RUNTIME,
  createConversationSummaryRuntime,
} from './conversation-summary-runtime.factory';
import { ConversationSummaryService } from './conversation-summary.service';

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
    {
      provide: CONVERSATION_SUMMARY_RUNTIME,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ServerEnv, true>) =>
        createConversationSummaryRuntime({
          AI_PROVIDER_MODE: config.get('AI_PROVIDER_MODE', { infer: true }),
          AI_ENABLE_LIVE_CALLS: config.get('AI_ENABLE_LIVE_CALLS', {
            infer: true,
          }),
          AI_MODEL: config.get('AI_MODEL', { infer: true }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
          DEEPSEEK_API_KEY: config.get('DEEPSEEK_API_KEY', { infer: true }),
          OPENAI_API_KEY: config.get('OPENAI_API_KEY', { infer: true }),
          CONVERSATION_SUMMARY_MAX_CALLS: config.get(
            'CONVERSATION_SUMMARY_MAX_CALLS',
            { infer: true },
          ),
          CONVERSATION_SUMMARY_MAX_INPUT_TOKENS: config.get(
            'CONVERSATION_SUMMARY_MAX_INPUT_TOKENS',
            { infer: true },
          ),
          CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS: config.get(
            'CONVERSATION_SUMMARY_MAX_OUTPUT_TOKENS',
            { infer: true },
          ),
          CONVERSATION_SUMMARY_TIMEOUT_MS: config.get(
            'CONVERSATION_SUMMARY_TIMEOUT_MS',
            { infer: true },
          ),
        }),
    },
    ConversationSummaryService,
    ConversationContextService,
  ],
  exports: [ConversationStateCacheService, ConversationContextService],
})
export class ConversationContextModule {}
