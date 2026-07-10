import { Readable } from 'node:stream';

import {
  type CallHandler,
  type ExecutionContext,
  StreamableFile,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';

import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor();
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ requestId: 'req_1' }) }),
  } as ExecutionContext;

  it('returns the same Nest StreamableFile instance without a JSON envelope', async () => {
    const file = new StreamableFile(
      Readable.from([Buffer.from('PK\u0003\u0004zip')]),
    );

    await expect(
      lastValueFrom(interceptor.intercept(context, handler(file))),
    ).resolves.toBe(file);
  });

  it('continues wrapping ordinary JSON data', async () => {
    await expect(
      lastValueFrom(interceptor.intercept(context, handler({ ok: true }))),
    ).resolves.toEqual({
      success: true,
      data: { ok: true },
      requestId: 'req_1',
    });
  });

  function handler(value: unknown): CallHandler {
    return { handle: () => of(value) };
  }
});
