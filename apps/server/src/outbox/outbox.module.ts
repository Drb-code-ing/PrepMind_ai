import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxDispatcherService],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}
