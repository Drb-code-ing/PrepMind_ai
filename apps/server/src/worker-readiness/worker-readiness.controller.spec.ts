import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  WorkerReadinessController,
  WorkerReadinessEnabledGuard,
} from './worker-readiness.controller';
import { WorkerReadinessModule } from './worker-readiness.module';
import { WorkerReadinessService } from './worker-readiness.service';

describe('WorkerReadinessController', () => {
  it('runs worker readiness feature gate before JwtAuthGuard and OperatorGuard', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkerReadinessController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toEqual([
      WorkerReadinessEnabledGuard,
      JwtAuthGuard,
      OperatorGuard,
    ]);
  });

  it('returns service readiness when worker readiness is enabled', async () => {
    const readiness = {
      ready: true,
      status: 'ready',
      checkedAt: '2026-07-08T00:00:00.000Z',
    };
    const service = {
      getReadiness: jest.fn().mockResolvedValue(readiness),
    };
    const controller = new WorkerReadinessController(service as never);

    await expect(controller.readiness()).resolves.toEqual(readiness);
    expect(service.getReadiness).toHaveBeenCalledTimes(1);
  });

  it('hides the endpoint from the feature gate guard when disabled', () => {
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const guard = new WorkerReadinessEnabledGuard(config as never);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
    expect(config.get).toHaveBeenCalledWith('WORKER_READINESS_ENABLED', {
      infer: true,
    });
  });

  it('allows the request through the feature gate guard when enabled', () => {
    const config = {
      get: jest.fn().mockReturnValue(true),
    };
    const guard = new WorkerReadinessEnabledGuard(config as never);

    expect(guard.canActivate()).toBe(true);
  });

  it('registers WorkerReadinessService through an explicit factory provider', () => {
    const providersMetadata = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      WorkerReadinessModule,
    ) as unknown;
    const providers = Array.isArray(providersMetadata) ? providersMetadata : [];
    const readinessProvider = providers.find(isWorkerReadinessProvider);

    expect(readinessProvider).toBeDefined();
  });
});

function isWorkerReadinessProvider(provider: unknown): provider is {
  provide: typeof WorkerReadinessService;
  useFactory: (...args: unknown[]) => WorkerReadinessService;
} {
  if (typeof provider !== 'object' || provider === null) {
    return false;
  }

  const candidate = provider as {
    provide?: unknown;
    useFactory?: unknown;
  };

  return (
    candidate.provide === WorkerReadinessService &&
    typeof candidate.useFactory === 'function'
  );
}
