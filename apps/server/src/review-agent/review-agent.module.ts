import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewPreferencesModule } from '../review-preferences/review-preferences.module';
import { ReviewTasksModule } from '../review-tasks/review-tasks.module';
import { ReviewAgentController } from './review-agent.controller';
import { ReviewAgentService } from './review-agent.service';

@Module({
  imports: [AuthModule, ReviewTasksModule, ReviewPreferencesModule],
  controllers: [ReviewAgentController],
  providers: [ReviewAgentService],
})
export class ReviewAgentModule {}
