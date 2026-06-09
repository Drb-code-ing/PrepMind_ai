import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((response) => {
        const body = response.body as HealthResponseBody;

        expect(body).toEqual({
          success: true,
          data: {
            status: 'ok',
            service: 'prepmind-server',
          },
          requestId: body.requestId,
        });
        expect(typeof body.requestId).toBe('string');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});

type HealthResponseBody = {
  success: true;
  data: {
    status: 'ok';
    service: 'prepmind-server';
  };
  requestId: string;
};
