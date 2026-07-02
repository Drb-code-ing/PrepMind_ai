import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { AgentTracesController } from '../agent-traces/agent-traces.controller';
import { AuthController } from '../auth/auth.controller';
import { BackgroundJobsController } from '../background-jobs/background-jobs.controller';
import { ChatMessagesController } from '../chat-messages/chat-messages.controller';
import { KnowledgeAgentController } from '../knowledge-agent/knowledge-agent.controller';
import { KnowledgeDocumentsController } from '../knowledge-documents/knowledge-documents.controller';
import { KnowledgeSearchController } from '../knowledge-documents/knowledge-search.controller';
import { MemoryAgentController } from '../memory-agent/memory-agent.controller';
import { OcrRecordsController } from '../ocr-records/ocr-records.controller';
import { ReviewAgentController } from '../review-agent/review-agent.controller';
import { ReviewPreferencesController } from '../review-preferences/review-preferences.controller';
import { ReviewTasksController } from '../review-tasks/review-tasks.controller';
import { ReviewsController } from '../reviews/reviews.controller';
import { UploadsController } from '../uploads/uploads.controller';
import { UsersController } from '../users/users.controller';
import { WrongQuestionOrganizerController } from '../wrong-question-organizer/wrong-question-organizer.controller';
import { WrongQuestionsController } from '../wrong-questions/wrong-questions.controller';
import {
  buildSwaggerDocumentOptions,
  setupSwagger,
  shouldEnableSwagger,
} from './swagger';

jest.mock(
  '../knowledge-documents/jobs/document-processing-job.service',
  () => ({
    DocumentProcessingJobService: class DocumentProcessingJobService {},
  }),
);

const swaggerOperationKeys = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const;

type SwaggerPathItem = Partial<
  Record<(typeof swaggerOperationKeys)[number], { tags?: string[] }>
>;

function collectOperationTags(document: { paths?: Record<string, unknown> }) {
  return Object.values(document.paths ?? {}).flatMap((pathItem) =>
    swaggerOperationKeys.flatMap((method) => {
      const operation = (pathItem as SwaggerPathItem | undefined)?.[method];
      return Array.isArray(operation?.tags) ? operation.tags : [];
    }),
  );
}

describe('swagger config', () => {
  it('enables Swagger from parsed env', () => {
    expect(
      shouldEnableSwagger({
        SWAGGER_ENABLED: true,
      }),
    ).toBe(true);

    expect(
      shouldEnableSwagger({
        SWAGGER_ENABLED: false,
      }),
    ).toBe(false);
  });

  it('builds an OpenAPI document with security and envelope guidance', async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    try {
      const options = buildSwaggerDocumentOptions();
      const document = SwaggerModule.createDocument(app, options);
      const documentText = JSON.stringify(document);

      expect(document.info.title).toBe('PrepMind AI API');
      expect(document.components?.securitySchemes).toHaveProperty(
        'access-token',
      );
      expect(documentText).toContain('Bearer');
      expect(documentText).toContain('envelope');
      expect(documentText).toContain('success');
      expect(documentText).toContain('requestId');
    } finally {
      await app.close();
    }
  });

  it('documents core API tags for current product flows', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        ChatMessagesController,
        OcrRecordsController,
        WrongQuestionsController,
        WrongQuestionOrganizerController,
        ReviewsController,
        ReviewTasksController,
        ReviewPreferencesController,
        ReviewAgentController,
        KnowledgeDocumentsController,
        KnowledgeSearchController,
        KnowledgeAgentController,
        MemoryAgentController,
        AgentTracesController,
        BackgroundJobsController,
        UploadsController,
      ],
    })
      .useMocker((token) => {
        if (token === ConfigService) {
          return {
            get: () => 10_000_000,
          };
        }

        return {};
      })
      .compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        buildSwaggerDocumentOptions(),
      );
      const documentedTags = [...new Set(collectOperationTags(document))];

      expect(documentedTags).toEqual(
        expect.arrayContaining([
          'Auth',
          'Users',
          'Chat Messages',
          'OCR Records',
          'Wrong Questions',
          'Wrong Question Organizer',
          'Reviews',
          'Review Tasks',
          'Plan',
          'Review Preferences',
          'Review Agent',
          'Knowledge Documents',
          'Knowledge Search',
          'Knowledge Agent',
          'Memory Agent',
          'User Memories',
          'Agent Traces',
          'Background Jobs',
          'Uploads',
        ]),
      );
    } finally {
      await app.close();
    }
  });

  it('does not register Swagger routes when disabled', async () => {
    const moduleRef = await Test.createTestingModule({}).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    const createDocumentSpy = jest.spyOn(SwaggerModule, 'createDocument');
    const setupSpy = jest.spyOn(SwaggerModule, 'setup');

    try {
      expect(
        setupSwagger(app, {
          SWAGGER_ENABLED: false,
        }),
      ).toBe(false);
      expect(createDocumentSpy).not.toHaveBeenCalled();
      expect(setupSpy).not.toHaveBeenCalled();
    } finally {
      createDocumentSpy.mockRestore();
      setupSpy.mockRestore();
      await app.close();
    }
  });
});
