import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PROCESS_KNOWLEDGE_DOCUMENT_QUEUE } from '../knowledge-documents/jobs/process-document.job';
import { WorkerReadinessController } from './worker-readiness.controller';
import { WorkerReadinessModule } from './worker-readiness.module';

describe('WorkerReadinessController', () => {
  it('uses JwtAuthGuard on the controller', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      WorkerReadinessController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toContain(JwtAuthGuard);
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
    const config = {
      get: jest.fn().mockReturnValue(true),
    };
    const controller = new WorkerReadinessController(
      service as never,
      config as never,
    );

    await expect(controller.readiness()).resolves.toEqual(readiness);
    expect(config.get).toHaveBeenCalledWith('WORKER_READINESS_ENABLED', {
      infer: true,
    });
    expect(service.getReadiness).toHaveBeenCalledTimes(1);
  });

  it('hides the endpoint when worker readiness is disabled', async () => {
    const service = {
      getReadiness: jest.fn(),
    };
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const controller = new WorkerReadinessController(
      service as never,
      config as never,
    );

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(config.get).toHaveBeenCalledWith('WORKER_READINESS_ENABLED', {
      infer: true,
    });
    expect(service.getReadiness).not.toHaveBeenCalled();
  });

  it('registers the knowledge document queue provider in the module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      WorkerReadinessModule,
    ) as Array<{ providers?: Array<{ provide?: unknown }> }> | undefined;
    const providers = imports?.flatMap((moduleImport) => {
      return Array.isArray(moduleImport.providers)
        ? moduleImport.providers
        : [];
    });

    expect(providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: expect.stringContaining(PROCESS_KNOWLEDGE_DOCUMENT_QUEUE),
        }),
      ]),
    );
  });
});
