import { OperatorAuditMaintenanceProcessor } from './operator-audit-maintenance.processor';

describe('OperatorAuditMaintenanceProcessor', () => {
  it('accepts only schemaVersion 1 and calls maintenance without actor input', async () => {
    const maintenance = { run: jest.fn().mockResolvedValue({}) };
    const processor = new OperatorAuditMaintenanceProcessor(
      maintenance as never,
    );
    await processor.process({
      data: { schemaVersion: 1 },
      discard: jest.fn(),
    } as never);
    expect(maintenance.run).toHaveBeenCalledWith();
  });

  it('discards any payload with actor fields', async () => {
    const maintenance = { run: jest.fn() };
    const job = {
      data: { schemaVersion: 1, actorUserId: 'admin' },
      discard: jest.fn(),
    };
    await expect(
      new OperatorAuditMaintenanceProcessor(maintenance as never).process(
        job as never,
      ),
    ).rejects.toThrow('invalid');
    expect(job.discard).toHaveBeenCalled();
    expect(maintenance.run).not.toHaveBeenCalled();
  });
});
