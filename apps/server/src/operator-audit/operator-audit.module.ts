import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OperatorAuditService } from './operator-audit.service';

@Module({
  imports: [DatabaseModule],
  providers: [OperatorAuditService],
  exports: [OperatorAuditService],
})
export class OperatorAuditModule {}
