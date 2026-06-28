import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MemoryAgentController } from './memory-agent.controller';
import { MemoryAgentService } from './memory-agent.service';

@Module({
  imports: [AuthModule],
  controllers: [MemoryAgentController],
  providers: [MemoryAgentService],
})
export class MemoryAgentModule {}
