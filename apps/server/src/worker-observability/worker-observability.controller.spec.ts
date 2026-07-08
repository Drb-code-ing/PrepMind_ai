import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  WorkerObservabilityController,
  WorkerObservabilityEnabledGuard,
} from './worker-observability.controller';
import { WorkerObservabilityModule } from './worker-observability.module';

describe('WorkerObservabilityController', () => {
  it('runs the worker observability feature gate before JwtAuthGuard and OperatorGuard', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkerObservabilityController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toEqual([
      WorkerObservabilityEnabledGuard,
      JwtAuthGuard,
      OperatorGuard,
    ]);
  });

  it('hides endpoints before authentication when worker observability is disabled', () => {
    const guard = new WorkerObservabilityEnabledGuard({
      get: jest.fn().mockReturnValue(false),
    } as never);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('registers WorkerObservabilityEnabledGuard as a module provider', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkerObservabilityModule,
    ) as unknown[];

    expect(providers).toContain(WorkerObservabilityEnabledGuard);
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
        role: 'ADMIN',
      }),
    ).resolves.toEqual({
      signals: { status: 'idle' },
    });
    expect(service.getSummary).toHaveBeenCalledWith('user-1');
  });
});
