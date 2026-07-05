import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkerObservabilityController } from './worker-observability.controller';

describe('WorkerObservabilityController', () => {
  it('uses JwtAuthGuard on the controller', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, WorkerObservabilityController) ?? [];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('returns service summary for current user', async () => {
    const service = {
      getSummary: jest.fn().mockResolvedValue({ signals: { status: 'idle' } }),
    };
    const controller = new WorkerObservabilityController(service as never);

    await expect(
      controller.summary({
        id: 'user-1',
        email: 'learner@example.com',
        role: 'STUDENT',
      }),
    ).resolves.toEqual({
      signals: { status: 'idle' },
    });
    expect(service.getSummary).toHaveBeenCalledWith('user-1');
  });
});
