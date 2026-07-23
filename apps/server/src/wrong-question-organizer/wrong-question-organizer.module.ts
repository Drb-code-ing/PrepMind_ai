import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { WrongQuestionOrganizerCommandExecutor } from './wrong-question-organizer-command';
import { WrongQuestionOrganizerController } from './wrong-question-organizer.controller';
import { WrongQuestionOrganizerOwnerSnapshotSource } from './wrong-question-organizer-owner-snapshot';
import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [WrongQuestionOrganizerController],
  providers: [
    WrongQuestionOrganizerService,
    WrongQuestionOrganizerOwnerSnapshotSource,
    WrongQuestionOrganizerCommandExecutor,
  ],
})
export class WrongQuestionOrganizerModule {}
