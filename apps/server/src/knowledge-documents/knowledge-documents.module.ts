import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from '../auth/auth.module';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';
import { shouldRegisterWorkers } from '../jobs/worker-role';
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
import { DocumentProcessingJobService } from './jobs/document-processing-job.service';
import { DocumentProcessingProcessor } from './jobs/document-processing.processor';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from './jobs/process-document.job';

const knowledgeDocumentProcessorProviders = shouldRegisterWorkers(
  (process.env.SERVER_ROLE ?? 'both') as 'api' | 'worker' | 'both',
)
  ? [DocumentProcessingProcessor]
  : [];

@Module({
  imports: [
    AuthModule,
    BackgroundJobsModule,
    UploadsModule,
    BullModule.registerQueue({ name: PROCESS_KNOWLEDGE_DOCUMENT_QUEUE }),
  ],
  controllers: [KnowledgeDocumentsController, KnowledgeSearchController],
  providers: [
    KnowledgeDocumentsService,
    KnowledgeSearchService,
    DocumentProcessingService,
    DocumentProcessingJobService,
    ...knowledgeDocumentProcessorProviders,
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
    DocumentProcessingJobService,
  ],
})
export class KnowledgeDocumentsModule {}
