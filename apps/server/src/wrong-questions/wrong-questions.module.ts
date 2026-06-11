import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { WrongQuestionsController } from './wrong-questions.controller';
import { WrongQuestionsService } from './wrong-questions.service';

@Module({
  imports: [AuthModule],
  controllers: [WrongQuestionsController],
  providers: [WrongQuestionsService],
})
export class WrongQuestionsModule {}
