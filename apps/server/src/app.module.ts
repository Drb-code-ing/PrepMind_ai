import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { AgentTracesModule } from './agent-traces/agent-traces.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { ChatMessagesModule } from './chat-messages/chat-messages.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { KnowledgeAgentModule } from './knowledge-agent/knowledge-agent.module';
import { KnowledgeDocumentsModule } from './knowledge-documents/knowledge-documents.module';
import { MemoryAgentModule } from './memory-agent/memory-agent.module';
import { OcrRecordsModule } from './ocr-records/ocr-records.module';
import { ReviewAgentModule } from './review-agent/review-agent.module';
import { ReviewPreferencesModule } from './review-preferences/review-preferences.module';
import { ReviewTasksModule } from './review-tasks/review-tasks.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WorkerObservabilityModule } from './worker-observability/worker-observability.module';
import { WrongQuestionOrganizerModule } from './wrong-question-organizer/wrong-question-organizer.module';
import { WrongQuestionsModule } from './wrong-questions/wrong-questions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventsModule,
    JobsModule,
    HealthModule,
    AuthModule,
    AgentTracesModule,
    BackgroundJobsModule,
    UsersModule,
    WrongQuestionsModule,
    ChatMessagesModule,
    OcrRecordsModule,
    ReviewsModule,
    ReviewAgentModule,
    ReviewPreferencesModule,
    ReviewTasksModule,
    MemoryAgentModule,
    KnowledgeAgentModule,
    UploadsModule,
    KnowledgeDocumentsModule,
    WorkerObservabilityModule,
    WrongQuestionOrganizerModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
