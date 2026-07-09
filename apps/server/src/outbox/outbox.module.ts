import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { OperatorAuditModule } from '../operator-audit/operator-audit.module';
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { OUTBOX_HANDLERS, outboxHandlers } from './outbox.handlers';
import { OutboxMetricsService } from './outbox-metrics.service';
import {
  OutboxOpsController,
  OutboxOpsEnabledGuard,
} from './outbox-ops.controller';
import { OutboxOpsService } from './outbox-ops.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule, OperatorAuditModule],
  controllers: [OutboxOpsController],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
    OutboxOpsEnabledGuard,
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
  exports: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
  ],
})
export class OutboxModule {}
