import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { DocumentParserService } from './document-parser.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [KnowledgeDocumentsController],
  providers: [KnowledgeDocumentsService, DocumentParserService],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}
