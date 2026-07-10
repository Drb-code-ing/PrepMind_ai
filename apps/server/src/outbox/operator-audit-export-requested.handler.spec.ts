import { OutboxHandlerError, type OutboxEventLike } from './outbox.handlers';
import { OperatorAuditExportRequestedHandler } from './operator-audit-export-requested.handler';

describe('OperatorAuditExportRequestedHandler', () => {
  const operatorAuditExport = { findUnique: jest.fn() };
  const backgroundJob = { findUnique: jest.fn() };
  const prisma = { operatorAuditExport, backgroundJob };
  const queue = { getJob: jest.fn(), add: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    operatorAuditExport.findUnique.mockResolvedValue(exportFact());
    backgroundJob.findUnique.mockResolvedValue(jobFact());
    queue.getJob.mockResolvedValue(null);
    queue.add.mockResolvedValue({ id: 'job_1' });
  });

  it('validates a strict safe payload', async () => {
    await expect(
      createHandler().handle(event({ exportId: 'export_1' })),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    await expect(
      createHandler().handle(
        event({
          exportId: 'export_1',
          backgroundJobId: 'job_1',
          objectKey: 'must-not-be-accepted',
        }),
      ),
    ).rejects.toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
    expect(operatorAuditExport.findUnique).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'missing export', export: null, job: jobFact() },
    { name: 'missing job', export: exportFact(), job: null },
    {
      name: 'job is account scoped',
      export: exportFact(),
      job: jobFact({ scope: 'ACCOUNT', userId: 'user_1' }),
    },
    {
      name: 'export links a different job',
      export: exportFact({ backgroundJobId: 'job_other' }),
      job: jobFact(),
    },
    {
      name: 'job links a different export',
      export: exportFact(),
      job: jobFact({ resourceId: 'export_other' }),
    },
    {
      name: 'job uses a different resource type',
      export: exportFact(),
      job: jobFact({ resourceType: 'KNOWLEDGE_DOCUMENT' }),
    },
  ])(
    'rejects invalid linked SYSTEM facts: $name',
    async ({ export: value, job }) => {
      operatorAuditExport.findUnique.mockResolvedValue(value);
      backgroundJob.findUnique.mockResolvedValue(job);

      const error: unknown = await createHandler()
        .handle(event())
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({ code: 'OUTBOX_INVALID_PAYLOAD' });
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).not.toContain('objectKey');
      }
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('enqueues a QUEUED export with the exact deterministic BullMQ options', async () => {
    await createHandler().handle(event());

    expect(operatorAuditExport.findUnique).toHaveBeenCalledWith({
      where: { id: 'export_1' },
    });
    expect(backgroundJob.findUnique).toHaveBeenCalledWith({
      where: { id: 'job_1' },
    });
    expect(queue.getJob).toHaveBeenCalledWith('job_1');
    expect(queue.add).toHaveBeenCalledWith(
      'generate-operator-audit-export',
      { exportId: 'export_1', backgroundJobId: 'job_1' },
      {
        jobId: 'job_1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 172800, count: 1000 },
        removeOnFail: { age: 604800, count: 3000 },
      },
    );
  });

  it('is idempotent when the BullMQ job already exists', async () => {
    queue.getJob.mockResolvedValue({ id: 'job_1' });

    await createHandler().handle(event());

    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([
    { exportStatus: 'PROCESSING', jobStatus: 'ACTIVE' },
    { exportStatus: 'PROCESSING', jobStatus: 'SUCCEEDED' },
    { exportStatus: 'READY', jobStatus: 'ACTIVE' },
    { exportStatus: 'READY', jobStatus: 'SUCCEEDED' },
  ])(
    'does not redeliver $exportStatus with $jobStatus execution fact',
    async ({ exportStatus, jobStatus }) => {
      operatorAuditExport.findUnique.mockResolvedValue(
        exportFact({ status: exportStatus }),
      );
      backgroundJob.findUnique.mockResolvedValue(
        jobFact({ status: jobStatus }),
      );

      await createHandler().handle(event());

      expect(queue.getJob).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it.each(['FAILED', 'EXPIRED'])(
    'treats stale %s exports as a safe no-op',
    async (status) => {
      operatorAuditExport.findUnique.mockResolvedValue(exportFact({ status }));

      await createHandler().handle(event());

      expect(queue.getJob).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['QUEUED', 'ACTIVE'],
    ['QUEUED', 'SUCCEEDED'],
    ['QUEUED', 'FAILED'],
    ['QUEUED', 'CANCELLED'],
    ['QUEUED', 'STALE_SKIPPED'],
    ['PROCESSING', 'QUEUED'],
    ['PROCESSING', 'FAILED'],
    ['PROCESSING', 'CANCELLED'],
    ['PROCESSING', 'STALE_SKIPPED'],
    ['READY', 'QUEUED'],
    ['READY', 'FAILED'],
    ['READY', 'CANCELLED'],
    ['READY', 'STALE_SKIPPED'],
  ])(
    'rejects the unapproved %s export with %s background job state',
    async (exportStatus, jobStatus) => {
      operatorAuditExport.findUnique.mockResolvedValue(
        exportFact({ status: exportStatus }),
      );
      backgroundJob.findUnique.mockResolvedValue(
        jobFact({ status: jobStatus }),
      );

      await expect(createHandler().handle(event())).rejects.toMatchObject({
        code: 'OUTBOX_INVALID_PAYLOAD',
      });
      expect(queue.getJob).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('propagates Redis failures to the Dispatcher retry/dead-letter state machine', async () => {
    const failure = new Error('redis unavailable');
    queue.add.mockRejectedValue(failure);

    await expect(createHandler().handle(event())).rejects.toBe(failure);
  });

  it('exposes a bound arrow handler', async () => {
    const { handle } = createHandler();

    await expect(handle(event())).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  function createHandler() {
    return new OperatorAuditExportRequestedHandler(
      prisma as never,
      queue as never,
    );
  }

  function event(
    payload: Record<string, unknown> = {
      exportId: 'export_1',
      backgroundJobId: 'job_1',
    },
  ): OutboxEventLike {
    return {
      id: 'outbox_1',
      type: 'operator.audit.export.requested',
      payload,
    };
  }

  function exportFact(overrides: Record<string, unknown> = {}) {
    return {
      id: 'export_1',
      backgroundJobId: 'job_1',
      status: 'QUEUED',
      ...overrides,
    };
  }

  function jobFact(overrides: Record<string, unknown> = {}) {
    return {
      id: 'job_1',
      scope: 'SYSTEM',
      userId: null,
      status: 'QUEUED',
      queueName: 'operator-audit-export',
      jobName: 'generate-operator-audit-export',
      resourceType: 'OPERATOR_AUDIT_EXPORT',
      resourceId: 'export_1',
      ...overrides,
    };
  }

  it('uses the typed outbox error for invalid payloads', () => {
    expect(
      new OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', 'Invalid payload'),
    ).toBeInstanceOf(Error);
  });
});
