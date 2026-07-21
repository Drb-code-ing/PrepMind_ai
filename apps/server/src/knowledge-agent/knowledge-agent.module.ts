import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { AgentTracesModule } from '../agent-traces/agent-traces.module';
import type { ServerEnv } from '../config/env';
import { KnowledgeAgentController } from './knowledge-agent.controller';
import { KnowledgeAgentService } from './knowledge-agent.service';
import {
  KNOWLEDGE_MODEL_RUNTIMES,
  createKnowledgeModelRuntimes,
} from './knowledge-model-runtime.factory';
import { KnowledgeOwnerSnapshotSource } from './knowledge-owner-snapshot';
import { KnowledgeSemanticCandidateSource } from './knowledge-semantic-candidate.source';

@Module({
  imports: [AuthModule, AgentTracesModule],
  controllers: [KnowledgeAgentController],
  providers: [
    {
      provide: KNOWLEDGE_MODEL_RUNTIMES,
      inject: [ConfigService],
      useFactory: (config: ConfigService<ServerEnv, true>) => {
        const workerOnly =
          config.get('SERVER_ROLE', { infer: true }) === 'worker';
        return createKnowledgeModelRuntimes({
          AI_PROVIDER_MODE: config.get('AI_PROVIDER_MODE', { infer: true }),
          AI_ENABLE_LIVE_CALLS: config.get('AI_ENABLE_LIVE_CALLS', {
            infer: true,
          }),
          AI_BASE_URL: config.get('AI_BASE_URL', { infer: true }),
          KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: workerOnly
            ? false
            : config.get('KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED', {
                infer: true,
              }),
          KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: workerOnly
            ? false
            : config.get('KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED', {
                infer: true,
              }),
          KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: config.get(
            'KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS',
            { infer: true },
          ),
          KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: config.get(
            'KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS',
            { infer: true },
          ),
          DEEPSEEK_API_KEY: config.get('KNOWLEDGE_AGENT_DEEPSEEK_API_KEY', {
            infer: true,
          }),
        });
      },
    },
    KnowledgeAgentService,
    KnowledgeOwnerSnapshotSource,
    KnowledgeSemanticCandidateSource,
  ],
})
export class KnowledgeAgentModule {}
