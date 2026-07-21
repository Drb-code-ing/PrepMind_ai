import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeAgentController } from './knowledge-agent.controller';
import { KnowledgeAgentService } from './knowledge-agent.service';
import { KnowledgeOwnerSnapshotSource } from './knowledge-owner-snapshot';
import { KnowledgeSemanticCandidateSource } from './knowledge-semantic-candidate.source';

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeAgentController],
  providers: [
    KnowledgeAgentService,
    KnowledgeOwnerSnapshotSource,
    KnowledgeSemanticCandidateSource,
  ],
})
export class KnowledgeAgentModule {}
