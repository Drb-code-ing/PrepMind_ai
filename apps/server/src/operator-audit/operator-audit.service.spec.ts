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

type OperatorAuditLogFindManyArgs = {
  where: unknown;
  orderBy: unknown;
  take: number;
  select: unknown;
};

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

describe('OperatorAuditService', () => {
  const now = new Date('2026-07-08T10:00:00.000Z');
  const createAuditLog = jest.fn<
    Promise<unknown>,
    [OperatorAuditLogCreateArgs]
  >();
  const findManyAuditLogs = jest.fn<
    Promise<unknown[]>,
    [OperatorAuditLogFindManyArgs]
  >();
  const findFirstAuditLog = jest.fn();
  const prisma = {
    operatorAuditLog: {
      create: createAuditLog,
      findMany: findManyAuditLogs,
      findFirst: findFirstAuditLog,
    },
  };
  const logger = {
    warn: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('test-operator-audit-fingerprint-secret'),
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
    expect(data.ipAddressHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(data.userAgentHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
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

  it('strictly writes with the provided client and propagates persistence failure', async () => {
    const strictCreateAuditLog = jest.fn<
      Promise<unknown>,
      [OperatorAuditLogCreateArgs]
    >();
    strictCreateAuditLog.mockResolvedValue({ id: 'audit_1' });
    const transaction = {
      operatorAuditLog: {
        create: strictCreateAuditLog,
      },
    };
    const service = createService();
    const input = {
      actorUserId: 'user_admin',
      action: 'AUDIT_EXPORT_REQUEST' as const,
      targetType: 'OperatorAuditExport',
      targetId: 'export_1',
      reason: 'INC-2026-0710 evidence review',
      request: createRequest(),
      now,
    };

    await service.recordSuccessStrict(transaction as never, input);

    const strictData = strictCreateAuditLog.mock.calls[0]?.[0].data;
    expect(strictData).toEqual(
      objectContaining({
        action: 'AUDIT_EXPORT_REQUEST',
        status: 'SUCCEEDED',
        targetId: 'export_1',
      }),
    );
    expect(strictData.ipAddressHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(strictData.userAgentHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(createAuditLog).not.toHaveBeenCalled();

    const failure = new Error('database down');
    strictCreateAuditLog.mockRejectedValueOnce(failure);
    await expect(
      service.recordSuccessStrict(transaction as never, input),
    ).rejects.toBe(failure);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('lists redacted audit logs without metadata', async () => {
    findManyAuditLogs.mockResolvedValue([
      row({ id: 'audit_2', metadata: { payload: 'secret' } }),
    ]);

    const result = await createService().list({ limit: 20 });

    expect(findManyAuditLogs).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      select: objectContaining({
        metadata: false,
      }),
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'audit_2',
        action: 'OUTBOX_REQUEUE',
        status: 'SUCCEEDED',
        targetType: 'OutboxEvent',
        targetId: 'evt_1',
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.nextCursor).toBeNull();
  });

  it('returns one redacted audit log detail without metadata', async () => {
    findFirstAuditLog.mockResolvedValue(
      row({ id: 'audit_2', metadata: { payload: 'secret' } }),
    );

    const result = await createService().getDetail('audit_2');

    expect(findFirstAuditLog).toHaveBeenCalledWith({
      where: { id: 'audit_2' },
      select: objectContaining({
        metadata: false,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'audit_2',
        action: 'OUTBOX_REQUEUE',
        targetType: 'OutboxEvent',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('metadata');
  });

  it('throws not found when audit log detail does not exist', async () => {
    findFirstAuditLog.mockResolvedValue(null);

    await expect(
      createService().getDetail('missing_audit'),
    ).rejects.toMatchObject({
      code: 'OPERATOR_AUDIT_LOG_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('applies filters and stable cursor pagination', async () => {
    const cursorCreatedAt = new Date('2026-07-08T09:00:00.000Z');
    findFirstAuditLog.mockResolvedValue({
      id: 'audit_cursor',
      createdAt: cursorCreatedAt,
    });
    findManyAuditLogs.mockResolvedValue([]);

    await createService().list({
      action: 'OUTBOX_REQUEUE',
      status: 'FAILED',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      actorUserId: 'user_admin',
      limit: 10,
      cursor: 'audit_cursor',
    });

    expect(findFirstAuditLog).toHaveBeenCalledWith({
      where: { id: 'audit_cursor' },
      select: { id: true, createdAt: true },
    });
    expect(findManyAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: 'OUTBOX_REQUEUE',
          status: 'FAILED',
          targetType: 'OutboxEvent',
          targetId: 'evt_1',
          actorUserId: 'user_admin',
          OR: [
            { createdAt: { lt: cursorCreatedAt } },
            { createdAt: cursorCreatedAt, id: { lt: 'audit_cursor' } },
          ],
        },
        take: 11,
      }),
    );
  });

  it('returns nextCursor when audit rows exceed requested limit', async () => {
    findManyAuditLogs.mockResolvedValue([
      row({ id: 'audit_3' }),
      row({ id: 'audit_2' }),
      row({ id: 'audit_1' }),
    ]);

    const result = await createService().list({ limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['audit_3', 'audit_2']);
    expect(result.nextCursor).toBe('audit_2');
  });

  function createService() {
    return new OperatorAuditService(prisma as never, config as never, logger);
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

  function row(
    overrides: Partial<{
      id: string;
      actorUserId: string | null;
      action: 'OUTBOX_REQUEUE';
      status: 'SUCCEEDED' | 'FAILED';
      targetType: string;
      targetId: string | null;
      reason: string | null;
      requestId: string | null;
      ipAddressHash: string | null;
      userAgentHash: string | null;
      errorCode: string | null;
      errorPreview: string | null;
      createdAt: Date;
      metadata: unknown;
    }> = {},
  ) {
    return {
      id: overrides.id ?? 'audit_1',
      actorUserId: overrides.actorUserId ?? 'user_admin',
      action: overrides.action ?? 'OUTBOX_REQUEUE',
      status: overrides.status ?? 'SUCCEEDED',
      targetType: overrides.targetType ?? 'OutboxEvent',
      targetId: overrides.targetId ?? 'evt_1',
      reason: overrides.reason ?? 'fixed provider config',
      requestId: overrides.requestId ?? 'req_1',
      ipAddressHash: overrides.ipAddressHash ?? 'hmac-sha256:ip',
      userAgentHash: overrides.userAgentHash ?? 'hmac-sha256:ua',
      errorCode: overrides.errorCode ?? null,
      errorPreview: overrides.errorPreview ?? null,
      createdAt: overrides.createdAt ?? now,
      metadata: overrides.metadata,
    };
  }
});
