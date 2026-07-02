import { INestApplication, Module } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import {
  buildSwaggerDocumentOptions,
  setupSwagger,
  shouldEnableSwagger,
} from './swagger';

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
