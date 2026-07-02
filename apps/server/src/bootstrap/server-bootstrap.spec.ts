import { shouldListenHttp } from './server-bootstrap';

describe('shouldListenHttp', () => {
  it('listens for api and both roles but not worker-only role', () => {
    expect(shouldListenHttp('api')).toBe(true);
    expect(shouldListenHttp('both')).toBe(true);
    expect(shouldListenHttp('worker')).toBe(false);
  });
});
