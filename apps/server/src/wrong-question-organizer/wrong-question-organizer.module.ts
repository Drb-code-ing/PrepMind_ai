import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WrongQuestionOrganizerController } from './wrong-question-organizer.controller';
import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WrongQuestionOrganizerController],
  providers: [WrongQuestionOrganizerService],
})
export class WrongQuestionOrganizerModule {}
