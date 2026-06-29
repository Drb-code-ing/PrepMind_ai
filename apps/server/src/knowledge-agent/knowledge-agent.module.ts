import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { KnowledgeAgentController } from './knowledge-agent.controller';
import { KnowledgeAgentService } from './knowledge-agent.service';

@Module({
  imports: [AuthModule],
  controllers: [KnowledgeAgentController],
  providers: [KnowledgeAgentService],
})
export class KnowledgeAgentModule {}
