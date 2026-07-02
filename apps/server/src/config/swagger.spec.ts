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
  Record<
    (typeof swaggerOperationKeys)[number],
    {
      summary?: string;
      tags?: string[];
      requestBody?: unknown;
      responses?: Record<string, { description?: string }>;
    }
  >
>;

const coreApiControllers = [
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
];

function useSwaggerTestingMocker(token: unknown) {
  if (token === ConfigService) {
    return {
      get: () => 10_000_000,
    };
  }

  return {};
}

function collectOperationTags(document: { paths?: Record<string, unknown> }) {
  return Object.values(document.paths ?? {}).flatMap((pathItem) =>
    swaggerOperationKeys.flatMap((method) => {
      const operation = (pathItem as SwaggerPathItem | undefined)?.[method];
      return Array.isArray(operation?.tags) ? operation.tags : [];
    }),
  );
}

function getSwaggerOperation(
  document: { paths?: Record<string, unknown> },
  path: string,
  method: (typeof swaggerOperationKeys)[number],
) {
  return (document.paths?.[path] as SwaggerPathItem | undefined)?.[method];
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
      controllers: coreApiControllers,
    })
      .useMocker(useSwaggerTestingMocker)
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

  it('keeps generated OpenAPI JSON free of sensitive examples and raw payload fields', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: coreApiControllers,
    })
      .useMocker(useSwaggerTestingMocker)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        buildSwaggerDocumentOptions(),
      );
      const text = JSON.stringify(document);

      expect(text).toContain('response envelope');
      expect(text).toContain('success');
      expect(text).toContain('requestId');

      for (const forbidden of [
        'DEEPSEEK_API_KEY',
        'OPENAI_API_KEY',
        'Authorization: Bearer',
        'Cookie:',
        'refreshToken example',
        'rawPayload',
        'fullPrompt',
        'fullChunk',
        'complete prompt',
        'complete RAG chunk',
      ]) {
        expect(text).not.toContain(forbidden);
      }
    } finally {
      await app.close();
    }
  });

  it('documents selected high-value operations with summaries and response envelopes', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: coreApiControllers,
    })
      .useMocker(useSwaggerTestingMocker)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        buildSwaggerDocumentOptions(),
      );
      const operations = [
        ['post', '/auth/register'],
        ['post', '/auth/login'],
        ['post', '/auth/refresh'],
        ['post', '/auth/logout'],
        ['get', '/auth/me'],
        ['post', '/knowledge/documents'],
        ['get', '/knowledge/documents'],
        ['get', '/knowledge/documents/{id}'],
        ['put', '/knowledge/documents/{id}/file'],
        ['post', '/knowledge/documents/{id}/process'],
        ['delete', '/knowledge/documents/{id}'],
        ['post', '/knowledge/search'],
        ['post', '/agent-traces'],
        ['get', '/agent-traces'],
        ['get', '/agent-traces/summary'],
        ['get', '/agent-traces/{id}'],
        ['get', '/review-tasks/today'],
        ['post', '/review-tasks/{taskId}/rating'],
        ['post', '/review-tasks/{taskId}/skip'],
        ['post', '/review-tasks/{taskId}/reopen'],
        ['get', '/review-tasks/plan'],
        ['get', '/background-jobs'],
        ['get', '/background-jobs/summary'],
        ['get', '/background-jobs/{id}'],
      ] as const;

      for (const [method, path] of operations) {
        const operation = getSwaggerOperation(document, path, method);
        expect(operation?.summary).toEqual(expect.any(String));
        expect(operation?.summary?.length).toBeGreaterThan(0);

        const successResponseDescription = Object.entries(
          operation?.responses ?? {},
        ).find(([status]) => status.startsWith('2'))?.[1].description;
        expect(successResponseDescription).toContain('response envelope');
        expect(successResponseDescription).toContain('requestId');
      }
    } finally {
      await app.close();
    }
  });

  it('documents request bodies for high-value debug operations', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: coreApiControllers,
    })
      .useMocker(useSwaggerTestingMocker)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        buildSwaggerDocumentOptions(),
      );
      const jsonBodyOperations = [
        ['post', '/auth/register'],
        ['post', '/auth/login'],
        ['post', '/knowledge/documents/{id}/process'],
        ['post', '/knowledge/search'],
        ['post', '/review-tasks/{taskId}/rating'],
        ['post', '/agent-traces'],
      ] as const;
      const multipartBodyOperations = [
        ['post', '/knowledge/documents'],
        ['put', '/knowledge/documents/{id}/file'],
      ] as const;

      for (const [method, path] of jsonBodyOperations) {
        const operation = getSwaggerOperation(document, path, method);
        const requestBodyText = JSON.stringify(operation?.requestBody);

        expect(operation?.requestBody).toBeDefined();
        expect(requestBodyText).toContain('application/json');
        expect(requestBodyText).toContain('example');
      }

      for (const [method, path] of multipartBodyOperations) {
        const operation = getSwaggerOperation(document, path, method);
        const requestBodyText = JSON.stringify(operation?.requestBody);

        expect(operation?.requestBody).toBeDefined();
        expect(requestBodyText).toContain('multipart/form-data');
        expect(requestBodyText).toContain('file');
      }
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
