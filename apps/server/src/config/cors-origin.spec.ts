import { isCorsOriginAllowed } from './cors-origin';

describe('isCorsOriginAllowed', () => {
  it('allows configured origins', () => {
    expect(
      isCorsOriginAllowed('http://localhost:3000', {
        configuredOrigins: 'http://localhost:3000',
        nodeEnv: 'production',
      }),
    ).toBe(true);
  });

  it('allows dynamic localhost ports in development', () => {
    expect(
      isCorsOriginAllowed('http://localhost:3002', {
        configuredOrigins: 'http://localhost:3000',
        nodeEnv: 'development',
      }),
    ).toBe(true);
  });

  it('allows private LAN origins in development for mobile testing', () => {
    expect(
      isCorsOriginAllowed('http://192.168.1.8:3002', {
        configuredOrigins: 'http://localhost:3000',
        nodeEnv: 'development',
      }),
    ).toBe(true);
  });

  it('rejects unconfigured origins in production', () => {
    expect(
      isCorsOriginAllowed('http://localhost:3002', {
        configuredOrigins: 'http://localhost:3000',
        nodeEnv: 'production',
      }),
    ).toBe(false);
  });
});
