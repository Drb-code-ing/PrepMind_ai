import {
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type Provider,
} from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import type { ServerEnv } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { shouldRegisterWorkers } from '../jobs/worker-role';
import { OperatorAuditModule } from '../operator-audit/operator-audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { UploadsModule } from '../uploads/uploads.module';
import { OperatorAuditExportProcessor } from './jobs/operator-audit-export.processor';
import {
  OperatorAuditExportController,
  OperatorAuditExportEnabledGuard,
} from './operator-audit-export.controller';
import { OperatorAuditExportArchiveService } from './operator-audit-export-archive.service';
import { OPERATOR_AUDIT_EXPORT_QUEUE } from './operator-audit-export.constants';
import { OperatorAuditExportRequestService } from './operator-audit-export-request.service';
import { OperatorAuditExportStateRepository } from './operator-audit-export-state.repository';

export type OperatorAuditExportWorkerRegistration = {
  role: ServerEnv['SERVER_ROLE'];
  exportEnabled: boolean;
  outboxDispatcherEnabled: boolean;
  maintenanceEnabled: boolean;
};

@Injectable()
export class OperatorAuditExportProcessControl {
  terminate() {
    process.exitCode = 1;
    try {
      process.kill(process.pid, 'SIGTERM');
    } catch {
      process.exit(1);
    }
  }
}

@Injectable()
export class OperatorAuditExportWorkerFatalExitService {
  private readonly logger = new Logger(
    OperatorAuditExportWorkerFatalExitService.name,
  );

  constructor(
    private readonly processControl: OperatorAuditExportProcessControl,
  ) {}

  terminateAfterWorkerFailure() {
    this.logger.error(
      'Operator audit export worker stopped; terminating process',
    );
    this.processControl.terminate();
  }
}

@Injectable()
export class OperatorAuditExportQueueConcurrencyService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(OPERATOR_AUDIT_EXPORT_QUEUE)
    private readonly queue: Queue,
    private readonly processor: OperatorAuditExportProcessor,
    private readonly fatalExit: OperatorAuditExportWorkerFatalExitService,
  ) {}

  async onApplicationBootstrap() {
    await this.queue.setGlobalConcurrency(1);
    void this.processor.worker
      .run()
      .catch(() => this.fatalExit.terminateAfterWorkerFailure());
  }
}

export function createOperatorAuditExportWorkerProviders(
  options: OperatorAuditExportWorkerRegistration,
): Provider[] {
  return shouldRegisterWorkers(options.role) &&
    options.exportEnabled &&
    options.outboxDispatcherEnabled &&
    options.maintenanceEnabled
    ? [
        OperatorAuditExportProcessControl,
        OperatorAuditExportWorkerFatalExitService,
        OperatorAuditExportQueueConcurrencyService,
        OperatorAuditExportProcessor,
      ]
    : [];
}

const operatorAuditExportWorkerProviders =
  createOperatorAuditExportWorkerProviders({
    role: (process.env.SERVER_ROLE ?? 'both') as ServerEnv['SERVER_ROLE'],
    exportEnabled: isExplicitlyEnabled(
      process.env.OPERATOR_AUDIT_EXPORT_ENABLED,
    ),
    outboxDispatcherEnabled: isExplicitlyEnabled(
      process.env.OUTBOX_DISPATCHER_ENABLED,
    ),
    maintenanceEnabled: isExplicitlyEnabled(
      process.env.OPERATOR_AUDIT_MAINTENANCE_ENABLED,
    ),
  });

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    DatabaseModule,
    OperatorAuditModule,
    OutboxModule,
    UploadsModule,
    BullModule.registerQueue({ name: OPERATOR_AUDIT_EXPORT_QUEUE }),
  ],
  controllers: [OperatorAuditExportController],
  providers: [
    OperatorAuditExportRequestService,
    OperatorAuditExportEnabledGuard,
    OperatorAuditExportStateRepository,
    OperatorAuditExportArchiveService,
    ...operatorAuditExportWorkerProviders,
  ],
})
export class OperatorAuditExportsModule {}
