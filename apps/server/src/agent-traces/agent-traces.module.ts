import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AgentTracesController } from './agent-traces.controller';
import { AgentTracesService } from './agent-traces.service';

@Module({
  imports: [AuthModule],
  controllers: [AgentTracesController],
  providers: [AgentTracesService],
  exports: [AgentTracesService],
})
export class AgentTracesModule {}
