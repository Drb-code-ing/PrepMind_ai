import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';

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
    const config = {
      get: jest.fn().mockReturnValue(true),
    };
    const controller = new WorkerObservabilityController(
      service as never,
      config as never,
    );

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

  it('hides the summary endpoint when worker observability is disabled', async () => {
    const service = {
      getSummary: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const controller = new WorkerObservabilityController(
      service as never,
      config as never,
    );

    await expect(
      controller.summary({
        id: 'user-1',
        email: 'learner@example.com',
        role: 'STUDENT',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.getSummary).not.toHaveBeenCalled();
  });
});
