import { OperatorAuditService } from './operator-audit.service';

type OperatorAuditLogCreateData = {
  actorUserId: string;
  action: string;
  status: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  metadata?: unknown;
  errorCode?: string;
  errorPreview?: string;
  requestId?: string;
  ipAddressHash?: string;
  userAgentHash?: string;
  createdAt?: Date;
};

type OperatorAuditLogCreateArgs = {
  data: OperatorAuditLogCreateData;
};

describe('OperatorAuditService', () => {
  const now = new Date('2026-07-08T10:00:00.000Z');
  const createAuditLog = jest.fn<
    Promise<unknown>,
    [OperatorAuditLogCreateArgs]
  >();
  const prisma = {
    operatorAuditLog: {
      create: createAuditLog,
    },
  };
  const logger = {
    warn: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records successful operator actions with hashed request source', async () => {
    createAuditLog.mockResolvedValue({ id: 'audit_1' });

    await createService().recordSuccess({
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      reason: 'fixed provider config',
      request: createRequest(),
      metadata: {
        previousStatus: 'DEAD',
        nextStatus: 'PENDING',
        payloadHash: 'sha256:payload',
      },
      now,
    });

    expect(createAuditLog).toHaveBeenCalledTimes(1);
    const data = getLastCreateData();
    expect(data.actorUserId).toBe('user_admin');
    expect(data.action).toBe('OUTBOX_REQUEUE');
    expect(data.status).toBe('SUCCEEDED');
    expect(data.targetType).toBe('OutboxEvent');
    expect(data.targetId).toBe('evt_1');
    expect(data.reason).toBe('fixed provider config');
    expect(data.requestId).toBe('req_1');
    expect(data.ipAddressHash).toMatch(/^sha256:/);
    expect(data.userAgentHash).toMatch(/^sha256:/);
    expect(data.createdAt).toBe(now);
    expect(data.metadata).toEqual({
      previousStatus: 'DEAD',
      nextStatus: 'PENDING',
      payloadHash: 'sha256:payload',
    });
    expect(JSON.stringify(data)).not.toContain('127.0.0.1');
    expect(JSON.stringify(data)).not.toContain('Playwright');
  });

  it('sanitizes operator-provided reason before persisting audit logs', async () => {
    createAuditLog.mockResolvedValue({ id: 'audit_1' });

    await createService().recordSuccess({
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      reason:
        'fixed with Bearer secret-token and Cookie: refresh=secret-cookie',
      now,
    });

    const data = getLastCreateData();
    expect(data.reason).toContain('[redacted]');
    expect(data.reason).not.toContain('secret-token');
    expect(data.reason).not.toContain('secret-cookie');
  });

  it('records failed operator actions with sanitized and truncated errors', async () => {
    createAuditLog.mockResolvedValue({ id: 'audit_1' });

    await createService().recordFailure({
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      reason: 'retry failed event',
      request: createRequest(),
      error: new Error(
        `provider failed Bearer secret-token QWEN_API_KEY=qwen-secret ${'x'.repeat(400)}`,
      ),
      now,
    });

    const data = getLastCreateData();
    expect(data).toEqual(
      expect.objectContaining({
        actorUserId: 'user_admin',
        action: 'OUTBOX_REQUEUE',
        status: 'FAILED',
        errorCode: 'Error',
        createdAt: now,
      }),
    );
    expect(data.errorPreview).toContain('[redacted]');
    expect(data.errorPreview.length).toBeLessThanOrEqual(240);
    expect(JSON.stringify(data)).not.toContain('secret-token');
    expect(JSON.stringify(data)).not.toContain('qwen-secret');
  });

  it('only persists allowlisted metadata keys', async () => {
    createAuditLog.mockResolvedValue({ id: 'audit_1' });

    await createService().recordSuccess({
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      metadata: {
        previousStatus: 'DEAD',
        nextStatus: 'PENDING',
        attemptsBefore: 5,
        attemptsAfter: 0,
        source: 'http',
        payload: { prompt: 'do secret things' },
        aggregateId: 'doc_1',
        accessToken: 'access-secret',
        cookie: 'refresh-secret',
        Authorization: 'Bearer secret-token',
        promptText: 'ignore all previous instructions',
        chunks: ['private chunk'],
        note: 'Bearer nested-secret',
        safeNested: {
          nextStatus: 'PENDING',
          apiKey: 'provider-secret',
        },
      },
      now,
    });

    const data = getLastCreateData();
    expect(data.metadata).toEqual({
      attemptsAfter: 0,
      attemptsBefore: 5,
      nextStatus: 'PENDING',
      previousStatus: 'DEAD',
      source: 'http',
    });
    expect(JSON.stringify(data)).not.toContain('do secret things');
    expect(JSON.stringify(data)).not.toContain('doc_1');
    expect(JSON.stringify(data)).not.toContain('access-secret');
    expect(JSON.stringify(data)).not.toContain('provider-secret');
    expect(JSON.stringify(data)).not.toContain('secret-token');
    expect(JSON.stringify(data)).not.toContain(
      'ignore all previous instructions',
    );
    expect(JSON.stringify(data)).not.toContain('private chunk');
    expect(JSON.stringify(data)).not.toContain('nested-secret');
  });

  it('does not throw when audit persistence fails', async () => {
    createAuditLog.mockRejectedValue(new Error('database down'));

    await expect(
      createService().recordSuccess({
        actorUserId: 'user_admin',
        action: 'OUTBOX_REQUEUE',
        targetType: 'OutboxEvent',
        targetId: 'evt_1',
        now,
      }),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to record operator audit log'),
    );
  });

  function createService() {
    return new OperatorAuditService(prisma as never, logger);
  }

  function getLastCreateData() {
    const call = createAuditLog.mock.calls.at(-1);
    if (!call) {
      throw new Error('Expected operator audit create to be called');
    }

    return call[0].data;
  }

  function createRequest() {
    return {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Playwright',
        'x-request-id': 'req_1',
      },
    };
  }
});
