import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { ChatMessagesModule } from './chat-messages/chat-messages.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { KnowledgeDocumentsModule } from './knowledge-documents/knowledge-documents.module';
import { OcrRecordsModule } from './ocr-records/ocr-records.module';
import { ReviewPreferencesModule } from './review-preferences/review-preferences.module';
import { ReviewTasksModule } from './review-tasks/review-tasks.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { WrongQuestionOrganizerModule } from './wrong-question-organizer/wrong-question-organizer.module';
import { WrongQuestionsModule } from './wrong-questions/wrong-questions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WrongQuestionsModule,
    ChatMessagesModule,
    OcrRecordsModule,
    ReviewsModule,
    ReviewPreferencesModule,
    ReviewTasksModule,
    UploadsModule,
    KnowledgeDocumentsModule,
    WrongQuestionOrganizerModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
