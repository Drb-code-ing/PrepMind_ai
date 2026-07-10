import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OperatorAuditModule } from '../operator-audit/operator-audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import {
  OperatorAuditExportController,
  OperatorAuditExportEnabledGuard,
} from './operator-audit-export.controller';
import { OperatorAuditExportRequestService } from './operator-audit-export-request.service';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    DatabaseModule,
    OperatorAuditModule,
    OutboxModule,
  ],
  controllers: [OperatorAuditExportController],
  providers: [
    OperatorAuditExportRequestService,
    OperatorAuditExportEnabledGuard,
  ],
})
export class OperatorAuditExportsModule {}
