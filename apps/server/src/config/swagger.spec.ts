import { INestApplication, Module } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
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
  '@nestjs/swagger/dist/constants',
  () => {
    const path = require('node:path') as typeof import('node:path');
    const swaggerPackageJsonPath = require.resolve(
      '@nestjs/swagger/package.json',
    );

    return require(
      path.join(path.dirname(swaggerPackageJsonPath), 'dist/constants.js'),
    );
  },
  { virtual: true },
);

jest.mock('../knowledge-documents/document-processing.service', () => ({
  DocumentProcessingService: class DocumentProcessingService {},
}));

@Module({})
class EmptyTestModule {}

type ControllerClass = { prototype: Record<string, unknown> };

function getClassTags(controller: ControllerClass) {
  return Reflect.getMetadata(DECORATORS.API_TAGS, controller) ?? [];
}

function getMethodTags(controller: ControllerClass, methodName: string) {
  return (
    Reflect.getMetadata(
      DECORATORS.API_TAGS,
      controller.prototype[methodName],
    ) ?? []
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
    const moduleRef = await Test.createTestingModule({
      imports: [EmptyTestModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    const options = buildSwaggerDocumentOptions();
    const document = SwaggerModule.createDocument(app, options);
    const documentText = JSON.stringify(document);

    expect(document.info.title).toBe('PrepMind AI API');
    expect(document.components?.securitySchemes).toHaveProperty('access-token');
    expect(documentText).toContain('Bearer');
    expect(documentText).toContain('envelope');
    expect(documentText).toContain('success');
    expect(documentText).toContain('requestId');

    await app.close();
  });

  it('documents core API tags for current product flows', () => {
    const classTaggedControllers: Array<[ControllerClass, string]> = [
      [AuthController, 'Auth'],
      [UsersController, 'Users'],
      [ChatMessagesController, 'Chat Messages'],
      [OcrRecordsController, 'OCR Records'],
      [WrongQuestionsController, 'Wrong Questions'],
      [WrongQuestionOrganizerController, 'Wrong Question Organizer'],
      [ReviewsController, 'Reviews'],
      [ReviewTasksController, 'Review Tasks'],
      [ReviewPreferencesController, 'Review Preferences'],
      [ReviewAgentController, 'Review Agent'],
      [KnowledgeDocumentsController, 'Knowledge Documents'],
      [KnowledgeSearchController, 'Knowledge Search'],
      [KnowledgeAgentController, 'Knowledge Agent'],
      [AgentTracesController, 'Agent Traces'],
      [BackgroundJobsController, 'Background Jobs'],
      [UploadsController, 'Uploads'],
    ];
    const methodTaggedControllers: Array<
      [ControllerClass, string, string]
    > = [
      [ReviewTasksController, 'getPlan', 'Plan'],
      [MemoryAgentController, 'listCandidates', 'Memory Agent'],
      [MemoryAgentController, 'generateCandidates', 'Memory Agent'],
      [MemoryAgentController, 'acceptCandidate', 'Memory Agent'],
      [MemoryAgentController, 'rejectCandidate', 'Memory Agent'],
      [MemoryAgentController, 'listMemories', 'User Memories'],
      [MemoryAgentController, 'updateMemory', 'User Memories'],
      [MemoryAgentController, 'deleteMemory', 'User Memories'],
    ];

    for (const [controller, tag] of classTaggedControllers) {
      expect(getClassTags(controller)).toContain(tag);
    }

    for (const [controller, methodName, tag] of methodTaggedControllers) {
      expect(getMethodTags(controller, methodName)).toContain(tag);
    }

    const documentedTags = new Set([
      ...classTaggedControllers.map(([, tag]) => tag),
      ...methodTaggedControllers.map(([, , tag]) => tag),
    ]);

    expect([...documentedTags]).toEqual(
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
  });

  it('does not register Swagger routes when disabled', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EmptyTestModule],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();

    const createDocumentSpy = jest.spyOn(SwaggerModule, 'createDocument');
    const setupSpy = jest.spyOn(SwaggerModule, 'setup');

    expect(
      setupSwagger(app, {
        SWAGGER_ENABLED: false,
      }),
    ).toBe(false);
    expect(createDocumentSpy).not.toHaveBeenCalled();
    expect(setupSpy).not.toHaveBeenCalled();

    createDocumentSpy.mockRestore();
    setupSpy.mockRestore();
    await app.close();
  });
});
