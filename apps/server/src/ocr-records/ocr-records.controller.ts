import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  createOcrRecordRequestSchema,
  listOcrRecordsQuerySchema,
} from '@repo/types/api/ocr-record';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OcrRecordsService } from './ocr-records.service';

@Controller('ocr-records')
@UseGuards(JwtAuthGuard)
@ApiTags('OCR Records')
@ApiBearerAuth('access-token')
export class OcrRecordsController {
  constructor(private readonly ocrRecordsService: OcrRecordsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const input = listOcrRecordsQuerySchema.parse(query);
    return this.ocrRecordsService.list(user.id, input);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocrRecordsService.getById(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = createOcrRecordRequestSchema.parse(body);
    return this.ocrRecordsService.create(user.id, input);
  }

  @Delete(':id')
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ocrRecordsService.delete(user.id, id);
  }
}
