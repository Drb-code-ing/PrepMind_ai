import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { OperatorAuditController } from './operator-audit.controller';
import { OperatorAuditService } from './operator-audit.service';

@Module({
  imports: [AuthModule, ConfigModule, DatabaseModule],
  controllers: [OperatorAuditController],
  providers: [OperatorAuditService],
  exports: [OperatorAuditService],
})
export class OperatorAuditModule {}
