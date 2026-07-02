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
        'PrepMind AI 后端 REST API，用于本地开发、接口联调和面试讲解。',
        '成功响应会包在全局 response envelope（统一响应外壳）中：{ success: true, data, requestId }。',
        '错误响应会包成：{ success: false, error: { code, message }, requestId }。',
        '请求和响应字段的事实源仍然是 @repo/types 中的 Zod schema；Swagger 只负责展示和调试。',
        '生产环境默认不暴露 Swagger；只有在受控环境中显式设置 SWAGGER_ENABLED=true 时才建议临时开启。',
      ].join(' '),
    )
    .setVersion('0.7.5')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          '手动调试受保护接口时，在这里粘贴短期有效的 Bearer access token。正式登录续期仍通过 httpOnly refresh cookie 完成。',
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
