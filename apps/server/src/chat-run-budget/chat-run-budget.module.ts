import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ChatRunBudgetRepository } from './chat-run-budget.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ChatRunBudgetRepository],
  exports: [ChatRunBudgetRepository],
})
export class ChatRunBudgetModule {}
