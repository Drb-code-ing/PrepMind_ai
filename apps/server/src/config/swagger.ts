import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import type { ServerEnv } from './env';

export const SWAGGER_UI_PATH = 'api-docs';
export const SWAGGER_JSON_PATH = 'api-docs-json';

type SwaggerEnv = Pick<ServerEnv, 'SWAGGER_ENABLED'>;

export function shouldEnableSwagger(env: SwaggerEnv): boolean {
  return env.SWAGGER_ENABLED;
}

export function buildSwaggerDocumentOptions() {
  return new DocumentBuilder()
    .setTitle('PrepMind AI API')
    .setDescription(
      [
        'PrepMind AI server REST API for local development, integration debugging, and interview walkthroughs.',
        'Successful responses are wrapped by the global response envelope: { success: true, data, requestId }.',
        'Error responses are wrapped as: { success: false, error: { code, message }, requestId }.',
        'The source of truth for request and response fields remains @repo/types Zod schemas.',
        'Production Swagger exposure requires an explicit SWAGGER_ENABLED=true override and should only be used in controlled environments.',
      ].join(' '),
    )
    .setVersion('0.7.5')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste a short-lived Bearer access token for manual debugging. The web app primary auth flow still uses httpOnly refresh cookies.',
      },
      'access-token',
    )
    .build();
}

export function setupSwagger(app: INestApplication, env: SwaggerEnv): boolean {
  if (!shouldEnableSwagger(env)) return false;

  const document = SwaggerModule.createDocument(
    app,
    buildSwaggerDocumentOptions(),
  );
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
    jsonDocumentUrl: SWAGGER_JSON_PATH,
  });

  return true;
}
