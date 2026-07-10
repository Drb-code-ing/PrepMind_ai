import { OperatorAuditMaintenanceScheduler } from './operator-audit-maintenance.scheduler';
import { createOperatorAuditMaintenanceWorkerProviders } from '../operator-audit-exports.module';
import { OperatorAuditMaintenanceProcessor } from './operator-audit-maintenance.processor';

describe('OperatorAuditMaintenanceScheduler', () => {
  it('upserts one strict hourly system job', async () => {
    const queue = { upsertJobScheduler: jest.fn().mockResolvedValue({}) };
    await new OperatorAuditMaintenanceScheduler(queue as never).onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      'operator-audit-maintenance-hourly',
      { every: 3_600_000 },
      {
        name: 'maintain-operator-audit',
        data: { schemaVersion: 1 },
        opts: {
          removeOnComplete: { age: 172800, count: 100 },
          removeOnFail: { age: 604800, count: 500 },
        },
      },
    );
  });

  it('registers maintenance only for worker roles with its explicit gate', () => {
    expect(
      createOperatorAuditMaintenanceWorkerProviders({
        role: 'api',
        maintenanceEnabled: true,
      }),
    ).toEqual([]);
    expect(
      createOperatorAuditMaintenanceWorkerProviders({
        role: 'worker',
        maintenanceEnabled: false,
      }),
    ).toEqual([]);
    for (const role of ['worker', 'both'] as const) {
      expect(
        createOperatorAuditMaintenanceWorkerProviders({
          role,
          maintenanceEnabled: true,
        }),
      ).toEqual(
        expect.arrayContaining([
          OperatorAuditMaintenanceScheduler,
          OperatorAuditMaintenanceProcessor,
        ]),
      );
    }
  });

  it('sets maintenance queue global concurrency to one during worker bootstrap', async () => {
    const providers = createOperatorAuditMaintenanceWorkerProviders({
      role: 'worker',
      maintenanceEnabled: true,
    });
    const concurrencyProvider = providers.find(
      (provider) =>
        typeof provider === 'function' &&
        provider.name === 'OperatorAuditMaintenanceQueueConcurrencyService',
    );
    expect(concurrencyProvider).toBeDefined();
    if (typeof concurrencyProvider !== 'function') {
      throw new Error('Maintenance queue concurrency provider is missing');
    }
    const queue = { setGlobalConcurrency: jest.fn().mockResolvedValue(1) };
    const service = Reflect.construct(concurrencyProvider, [queue]) as {
      onApplicationBootstrap: () => Promise<void>;
    };

    await service.onApplicationBootstrap();

    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(1);
  });
});
