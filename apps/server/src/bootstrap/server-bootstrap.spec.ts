import { bootstrapServer, shouldListenHttp } from './server-bootstrap';

describe('shouldListenHttp', () => {
  it('listens for api and both roles but not worker-only role', () => {
    expect(shouldListenHttp('api')).toBe(true);
    expect(shouldListenHttp('both')).toBe(true);
    expect(shouldListenHttp('worker')).toBe(false);
  });
});

describe('bootstrapServer', () => {
  const createHttpApp = jest.fn();
  const createApplicationContext = jest.fn();

  beforeEach(() => {
    createHttpApp.mockReset();
    createApplicationContext.mockReset();
  });

  it('creates an application context without listening in worker-only mode', async () => {
    createApplicationContext.mockResolvedValue({ close: jest.fn() });
    const logger = { log: jest.fn() };

    await bootstrapServer({
      serverRole: 'worker',
      createHttpApp,
      createApplicationContext,
      logger,
    });

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(createHttpApp).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith('Starting server role: worker');
  });

  it('creates and listens with the HTTP app in api mode', async () => {
    const logger = { log: jest.fn() };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'PORT') return 3001;
        if (key === 'CORS_ORIGIN') return 'http://localhost:3000';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'SWAGGER_ENABLED') return false;
        return undefined;
      }),
    };
    const app = {
      get: jest.fn().mockReturnValue(config),
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    createHttpApp.mockResolvedValue(app);

    await bootstrapServer({
      serverRole: 'api',
      createHttpApp,
      createApplicationContext,
      logger,
    });

    expect(createHttpApp).toHaveBeenCalledTimes(1);
    expect(createApplicationContext).not.toHaveBeenCalled();
    expect(app.use).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.useGlobalFilters).toHaveBeenCalledTimes(1);
    expect(app.useGlobalInterceptors).toHaveBeenCalledTimes(1);
    expect(app.listen).toHaveBeenCalledWith(3001);
    expect(logger.log).toHaveBeenCalledWith('Starting server role: api');
  });

  it('creates and listens with the HTTP app in both mode', async () => {
    const logger = { log: jest.fn() };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'PORT') return 3002;
        if (key === 'CORS_ORIGIN') return 'http://localhost:3000';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'SWAGGER_ENABLED') return false;
        return undefined;
      }),
    };
    const app = {
      get: jest.fn().mockReturnValue(config),
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    createHttpApp.mockResolvedValue(app);

    await bootstrapServer({
      serverRole: 'both',
      createHttpApp,
      createApplicationContext,
      logger,
    });

    expect(createHttpApp).toHaveBeenCalledTimes(1);
    expect(createApplicationContext).not.toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith(3002);
    expect(logger.log).toHaveBeenCalledWith('Starting server role: both');
  });
});
