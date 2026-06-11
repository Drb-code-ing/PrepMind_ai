import { ArgumentsHost, HttpStatus } from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('maps payload too large parser errors to 413', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = createHost(status);
    const filter = new HttpExceptionFilter();

    filter.catch(
      {
        type: 'entity.too.large',
        status: HttpStatus.PAYLOAD_TOO_LARGE,
      },
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: '请求内容过大',
      },
      requestId: 'req_test',
    });
  });
});

function createHost(status: jest.Mock): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ requestId: 'req_test' }),
      getNext: jest.fn(),
    }),
    getArgByIndex: jest.fn(),
    getArgs: jest.fn(),
    getType: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ArgumentsHost;
}
