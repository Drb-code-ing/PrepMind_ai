import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { JobsModule } from '../jobs/jobs.module';
import { OperatorAuditModule } from '../operator-audit/operator-audit.module';
import { OPERATOR_AUDIT_EXPORT_QUEUE } from '../operator-audit-exports/operator-audit-export.constants';
import { OperatorAuditExportRequestedHandler } from './operator-audit-export-requested.handler';
import { OutboxDispatcherRunnerService } from './outbox-dispatcher-runner.service';
import { OutboxDispatcherService } from './outbox.dispatcher';
import { createOutboxHandlers, OUTBOX_HANDLERS } from './outbox.handlers';
import { OutboxMetricsService } from './outbox-metrics.service';
import {
  OutboxOpsController,
  OutboxOpsEnabledGuard,
} from './outbox-ops.controller';
import { OutboxOpsService } from './outbox-ops.service';
import { OutboxService } from './outbox.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    DatabaseModule,
    JobsModule,
    OperatorAuditModule,
    BullModule.registerQueue({ name: OPERATOR_AUDIT_EXPORT_QUEUE }),
  ],
  controllers: [OutboxOpsController],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
    OutboxOpsEnabledGuard,
    OperatorAuditExportRequestedHandler,
    {
      provide: OutboxDispatcherRunnerService,
      inject: [OutboxDispatcherService, ConfigService],
      useFactory: (
        dispatcher: OutboxDispatcherService,
        config: ConfigService<ServerEnv, true>,
      ) => new OutboxDispatcherRunnerService(dispatcher, config),
    },
    {
      provide: OUTBOX_HANDLERS,
      inject: [OperatorAuditExportRequestedHandler],
      useFactory: (handler: OperatorAuditExportRequestedHandler) =>
        createOutboxHandlers(handler.handle),
    },
  ],
  exports: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
  ],
})
export class OutboxModule {}
