import { INestApplication, Module } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import {
  buildSwaggerDocumentOptions,
  setupSwagger,
  shouldEnableSwagger,
} from './swagger';
import { AppModule } from '../app.module';

@Module({})
class EmptyTestModule {}

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

  it('documents core API tags for current product flows', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const document = SwaggerModule.createDocument(
        app,
        buildSwaggerDocumentOptions(),
      );
      const operationTags = Object.values(document.paths ?? {}).flatMap(
        (pathItem) =>
          Object.values(pathItem ?? {}).flatMap((operation) => {
            const tags = (operation as { tags?: string[] }).tags;
            return Array.isArray(tags) ? tags : [];
          }),
      );
      const tagNames = new Set([
        ...(document.tags ?? []).map((tag) => tag.name),
        ...operationTags,
      ]);

      expect([...tagNames]).toEqual(
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
