import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { OcrRecordsController } from './ocr-records.controller';
import { OcrRecordsService } from './ocr-records.service';

@Module({
  imports: [AuthModule],
  controllers: [OcrRecordsController],
  providers: [OcrRecordsService],
})
export class OcrRecordsModule {}
