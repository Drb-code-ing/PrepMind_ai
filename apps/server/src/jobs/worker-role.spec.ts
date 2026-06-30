import { shouldRegisterWorkers } from './worker-role';

describe('shouldRegisterWorkers', () => {
  it('does not register BullMQ workers in api-only processes', () => {
    expect(shouldRegisterWorkers('api')).toBe(false);
    expect(shouldRegisterWorkers('worker')).toBe(true);
    expect(shouldRegisterWorkers('both')).toBe(true);
  });
});
