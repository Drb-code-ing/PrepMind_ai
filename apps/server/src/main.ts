import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { createCorsOriginValidator } from './config/cors-origin';
import type { ServerEnv } from './config/env';
import { setupSwagger } from './config/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<ServerEnv, true>);

  app.use(cookieParser());
  app.enableCors({
    origin: createCorsOriginValidator({
      configuredOrigins: config.get('CORS_ORIGIN', { infer: true }),
      nodeEnv: config.get('NODE_ENV', { infer: true }),
    }),
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  setupSwagger(app, {
    SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
  });

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
