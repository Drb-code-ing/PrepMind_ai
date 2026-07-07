import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OUTBOX_HANDLERS, outboxHandlers } from './outbox.handlers';
import { OutboxService } from './outbox.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    { provide: OUTBOX_HANDLERS, useValue: outboxHandlers },
  ],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}
