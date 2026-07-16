import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AgentTracesModule } from '../agent-traces/agent-traces.module';
import { AuthModule } from '../auth/auth.module';
import type { ServerEnv } from '../config/env';
import { ReviewPreferencesModule } from '../review-preferences/review-preferences.module';
import { ReviewTasksModule } from '../review-tasks/review-tasks.module';
import { ReviewAgentController } from './review-agent.controller';
import { ReviewAgentService } from './review-agent.service';
import {
  REVIEW_PLANNER_MODEL_RUNTIMES,
  createReviewPlannerModelRuntimes,
} from './review-planner-model-runtime.factory';

@Module({
  imports: [
    AuthModule,
    AgentTracesModule,
    ReviewTasksModule,
    ReviewPreferencesModule,
  ],
  controllers: [ReviewAgentController],
  providers: [
    {
      provide: REVIEW_PLANNER_MODEL_RUNTIMES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ServerEnv, true>) =>
        createReviewPlannerModelRuntimes({
          AI_PROVIDER_MODE: config.get('AI_PROVIDER_MODE', { infer: true }),
          AI_ENABLE_LIVE_CALLS: config.get('AI_ENABLE_LIVE_CALLS', {
            infer: true,
          }),
          REVIEW_AGENT_MODEL_ENABLED: config.get('REVIEW_AGENT_MODEL_ENABLED', {
            infer: true,
          }),
          PLANNER_AGENT_MODEL_ENABLED: config.get(
            'PLANNER_AGENT_MODEL_ENABLED',
            { infer: true },
          ),
          AI_MODEL: config.get('AI_MODEL', { infer: true }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
          DEEPSEEK_API_KEY: config.get('DEEPSEEK_API_KEY', { infer: true }),
          OPENAI_API_KEY: config.get('OPENAI_API_KEY', { infer: true }),
          REVIEW_AGENT_MODEL_TIMEOUT_MS: config.get(
            'REVIEW_AGENT_MODEL_TIMEOUT_MS',
            { infer: true },
          ),
          PLANNER_AGENT_MODEL_TIMEOUT_MS: config.get(
            'PLANNER_AGENT_MODEL_TIMEOUT_MS',
            { infer: true },
          ),
        }),
    },
    ReviewAgentService,
  ],
})
export class ReviewAgentModule {}
