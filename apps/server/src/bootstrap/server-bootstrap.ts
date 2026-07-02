import cookieParser from 'cookie-parser';
import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';
import { createCorsOriginValidator } from '../config/cors-origin';
import type { ServerEnv } from '../config/env';
import { setupSwagger } from '../config/swagger';

type HttpAppLike = {
  get: INestApplication['get'];
  use: INestApplication['use'];
  enableCors: INestApplication['enableCors'];
  useGlobalFilters: INestApplication['useGlobalFilters'];
  useGlobalInterceptors: INestApplication['useGlobalInterceptors'];
  listen: INestApplication['listen'];
};

type BootstrapServerDependencies = {
  serverRole?: ServerEnv['SERVER_ROLE'];
  createHttpApp?: () => Promise<HttpAppLike>;
  createApplicationContext?: () => Promise<unknown>;
  logger?: Pick<Logger, 'log'>;
};

const defaultLogger = new Logger('Bootstrap');

export function shouldListenHttp(role: ServerEnv['SERVER_ROLE']) {
  return role === 'api' || role === 'both';
}

function resolveServerRole(rawRole: string | undefined): ServerEnv['SERVER_ROLE'] {
  if (rawRole === 'api' || rawRole === 'worker' || rawRole === 'both') {
    return rawRole;
  }

  return 'both';
}

function configureHttpApp(
  app: HttpAppLike,
  config: ConfigService<ServerEnv, true>,
) {
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
  setupSwagger(app as INestApplication, {
    SWAGGER_ENABLED: config.get('SWAGGER_ENABLED', { infer: true }),
  });
}

export async function bootstrapServer(deps: BootstrapServerDependencies = {}) {
  const serverRole = deps.serverRole ?? resolveServerRole(process.env.SERVER_ROLE);
  const logger = deps.logger ?? defaultLogger;

  logger.log(`Starting server role: ${serverRole}`);

  if (!shouldListenHttp(serverRole)) {
    await (
      deps.createApplicationContext ??
      (() => NestFactory.createApplicationContext(AppModule))
    )();
    return;
  }

  const app = await (deps.createHttpApp ?? (() => NestFactory.create(AppModule)))();
  const config = app.get(ConfigService<ServerEnv, true>);

  configureHttpApp(app, config);

  await app.listen(config.get('PORT', { infer: true }));
}
