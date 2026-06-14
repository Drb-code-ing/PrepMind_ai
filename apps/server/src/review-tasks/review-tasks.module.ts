import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReviewTasksController } from './review-tasks.controller';
import { ReviewTasksService } from './review-tasks.service';

@Module({
  imports: [AuthModule],
  controllers: [ReviewTasksController],
  providers: [ReviewTasksService],
})
export class ReviewTasksModule {}
