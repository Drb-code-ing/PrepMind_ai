import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewPreferencesModule } from '../review-preferences/review-preferences.module';
import { ReviewTasksController } from './review-tasks.controller';
import { ReviewTasksService } from './review-tasks.service';

@Module({
  imports: [AuthModule, ReviewPreferencesModule],
  controllers: [ReviewTasksController],
  providers: [ReviewTasksService],
  exports: [ReviewTasksService],
})
export class ReviewTasksModule {}
