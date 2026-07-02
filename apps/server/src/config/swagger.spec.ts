import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { buildSwaggerDocumentOptions, shouldEnableSwagger } from './swagger';

@Module({})
class EmptyTestModule {}

describe('swagger config', () => {
  it('enables Swagger from parsed env', () => {
    expect(
      shouldEnableSwagger({
        NODE_ENV: 'development',
        SWAGGER_ENABLED: true,
      }),
    ).toBe(true);

    expect(
      shouldEnableSwagger({
        NODE_ENV: 'production',
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
    const documentText = JSON.stringify(options);

    expect(documentText).toContain('PrepMind AI API');
    expect(documentText).toContain('Bearer');
    expect(documentText).toContain('success');
    expect(documentText).toContain('requestId');

    await app.close();
  });
});
