import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AgentTracesModule } from '../agent-traces/agent-traces.module';
import { AuthModule } from '../auth/auth.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { WrongQuestionOrganizerCommandExecutor } from './wrong-question-organizer-command';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME,
  createWrongQuestionOrganizerModelRuntime,
} from './wrong-question-organizer-model-runtime.factory';
import { WrongQuestionOrganizerController } from './wrong-question-organizer.controller';
import { WrongQuestionOrganizerOwnerSnapshotSource } from './wrong-question-organizer-owner-snapshot';
import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';

@Module({
  imports: [AuthModule, DatabaseModule, AgentTracesModule],
  controllers: [WrongQuestionOrganizerController],
  providers: [
    {
      provide: WRONG_QUESTION_ORGANIZER_MODEL_RUNTIME,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ServerEnv, true>) => {
        const workerOnly =
          config.get('SERVER_ROLE', { infer: true }) === 'worker';
        return createWrongQuestionOrganizerModelRuntime({
          AI_PROVIDER_MODE: config.get('AI_PROVIDER_MODE', { infer: true }),
          AI_ENABLE_LIVE_CALLS: config.get('AI_ENABLE_LIVE_CALLS', {
            infer: true,
          }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
          WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: workerOnly
            ? false
            : config.get('WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED', {
                infer: true,
              }),
          WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: config.get(
            'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS',
            { infer: true },
          ),
          WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: config.get(
            'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY',
            { infer: true },
          ),
        });
      },
    },
    WrongQuestionOrganizerService,
    WrongQuestionOrganizerOwnerSnapshotSource,
    WrongQuestionOrganizerCommandExecutor,
  ],
})
export class WrongQuestionOrganizerModule {}
