import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  OutboxOpsController,
  OutboxOpsEnabledGuard,
} from './outbox-ops.controller';

describe('OutboxOpsController', () => {
  type AuditInput = {
    actorUserId: string;
    action: 'OUTBOX_REQUEUE';
    targetType: string;
    targetId: string;
    reason?: string;
    request?: { requestId?: string };
    metadata?: {
      nextStatus?: string;
      source?: string;
    };
    error?: unknown;
  };

  it('checks the outbox ops gate before JwtAuthGuard and OperatorGuard', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      OutboxOpsController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toEqual([
      OutboxOpsEnabledGuard,
      JwtAuthGuard,
      OperatorGuard,
    ]);
  });

  it('hides endpoints before authentication when outbox ops is disabled', () => {
    const config = { get: jest.fn().mockReturnValue(false) };
    const guard = new OutboxOpsEnabledGuard(config as never);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('allows requests through the feature gate when outbox ops is enabled', () => {
    const config = { get: jest.fn().mockReturnValue(true) };
    const guard = new OutboxOpsEnabledGuard(config as never);

    expect(guard.canActivate()).toBe(true);
  });

  it('lists outbox events with parsed query defaults', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getDetail: jest.fn(),
      requeue: jest.fn(),
    };
    const controller = new OutboxOpsController(
      service as never,
      createAudit() as never,
    );

    await expect(controller.list({ status: 'DEAD' })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(service.list).toHaveBeenCalledWith({
      status: 'DEAD',
      limit: 20,
    });
  });

  it('gets outbox event detail', async () => {
    const service = {
      list: jest.fn(),
      getDetail: jest.fn().mockResolvedValue({ id: 'evt_1' }),
      requeue: jest.fn(),
    };
    const controller = new OutboxOpsController(
      service as never,
      createAudit() as never,
    );

    await expect(controller.detail('evt_1')).resolves.toEqual({ id: 'evt_1' });
    expect(service.getDetail).toHaveBeenCalledWith('evt_1');
  });

  it('requeues an outbox event', async () => {
    const service = {
      list: jest.fn(),
      getDetail: jest.fn(),
      requeue: jest.fn().mockResolvedValue({ id: 'evt_1', status: 'PENDING' }),
    };
    const audit = createAudit();
    const controller = new OutboxOpsController(
      service as never,
      audit as never,
    );

    await expect(
      controller.requeue(
        createAdmin(),
        'evt_1',
        { reason: 'fixed provider config' },
        createRequest(),
      ),
    ).resolves.toEqual({ id: 'evt_1', status: 'PENDING' });
    expect(service.requeue).toHaveBeenCalledWith('evt_1', expect.any(Date));
    const auditInput = audit.recordSuccess.mock.calls[0]?.[0];
    expect(auditInput?.actorUserId).toBe('user_admin');
    expect(auditInput?.action).toBe('OUTBOX_REQUEUE');
    expect(auditInput?.targetType).toBe('OutboxEvent');
    expect(auditInput?.targetId).toBe('evt_1');
    expect(auditInput?.reason).toBe('fixed provider config');
    expect(auditInput?.request?.requestId).toBe('req_1');
    expect(auditInput?.metadata?.nextStatus).toBe('PENDING');
    expect(auditInput?.metadata?.source).toBe('http');
  });

  it('records failed requeue attempts before rethrowing the original error', async () => {
    const error = new Error('not requeueable');
    const service = {
      list: jest.fn(),
      getDetail: jest.fn(),
      requeue: jest.fn().mockRejectedValue(error),
    };
    const audit = createAudit();
    const controller = new OutboxOpsController(
      service as never,
      audit as never,
    );

    await expect(
      controller.requeue(
        createAdmin(),
        'evt_1',
        { reason: 'retry after fix' },
        createRequest(),
      ),
    ).rejects.toBe(error);
    const auditInput = audit.recordFailure.mock.calls[0]?.[0];
    expect(auditInput?.actorUserId).toBe('user_admin');
    expect(auditInput?.action).toBe('OUTBOX_REQUEUE');
    expect(auditInput?.targetType).toBe('OutboxEvent');
    expect(auditInput?.targetId).toBe('evt_1');
    expect(auditInput?.reason).toBe('retry after fix');
    expect(auditInput?.request?.requestId).toBe('req_1');
    expect(auditInput?.error).toBe(error);
  });

  function createAudit() {
    return {
      recordSuccess: jest
        .fn<Promise<void>, [AuditInput]>()
        .mockResolvedValue(undefined),
      recordFailure: jest
        .fn<Promise<void>, [AuditInput]>()
        .mockResolvedValue(undefined),
    };
  }

  function createAdmin(): AuthenticatedUser {
    return {
      id: 'user_admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
  }

  function createRequest() {
    return {
      requestId: 'req_1',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Playwright',
      },
    };
  }
});
