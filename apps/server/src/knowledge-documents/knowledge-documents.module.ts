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
import { DocumentProcessingService } from './document-processing.service';
import { KnowledgeDocumentsController } from './knowledge-documents.controller';
import { KnowledgeDocumentsService } from './knowledge-documents.service';
import { KnowledgeSearchController } from './knowledge-search.controller';
import { KnowledgeSearchService } from './knowledge-search.service';

@Module({
  imports: [AuthModule, UploadsModule],
  controllers: [KnowledgeDocumentsController, KnowledgeSearchController],
  providers: [
    KnowledgeDocumentsService,
    KnowledgeSearchService,
    DocumentProcessingService,
    DocumentParserService,
    EmbeddingService,
    ChunkPersistenceService,
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (): ServerEmbeddingProvider | undefined => undefined,
    },
  ],
  exports: [
    KnowledgeDocumentsService,
    KnowledgeSearchService,
    DocumentProcessingService,
  ],
})
export class KnowledgeDocumentsModule {}
