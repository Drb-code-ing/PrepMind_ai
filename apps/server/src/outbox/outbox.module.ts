import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ConfigModule } from '../config/config.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OUTBOX_HANDLERS, outboxHandlers } from './outbox.handlers';
import { OutboxService } from './outbox.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    {
      provide: OutboxDispatcherRunnerService,
      inject: [OutboxDispatcherService, ConfigService],
      useFactory: (
        dispatcher: OutboxDispatcherService,
        config: ConfigService<ServerEnv, true>,
      ) => new OutboxDispatcherRunnerService(dispatcher, config),
    },
    { provide: OUTBOX_HANDLERS, useValue: outboxHandlers },
  ],
  exports: [OutboxService, OutboxDispatcherService],
})
export class OutboxModule {}
