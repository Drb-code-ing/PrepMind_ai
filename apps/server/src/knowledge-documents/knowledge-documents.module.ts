import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ChunkPersistenceService } from './chunk-persistence.service';
import { DocumentParserService } from './document-parser.service';
import {
  EMBEDDING_PROVIDER,
  EmbeddingService,
  type ServerEmbeddingProvider,
} from './embedding.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeDocumentsService } from './knowledge-documents.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [KnowledgeDocumentsController],
  providers: [
    KnowledgeDocumentsService,
    DocumentParserService,
    EmbeddingService,
    ChunkPersistenceService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): ServerEmbeddingProvider | undefined => undefined,
    },
  ],
  exports: [KnowledgeDocumentsService],
})
export class KnowledgeDocumentsModule {}
