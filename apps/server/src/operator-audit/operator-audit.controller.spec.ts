import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  OperatorAuditController,
  OperatorAuditEnabledGuard,
} from './operator-audit.controller';

describe('OperatorAuditController', () => {
  it('runs the operator audit feature gate before JwtAuthGuard and OperatorGuard', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      OperatorAuditController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toEqual([
      OperatorAuditEnabledGuard,
      JwtAuthGuard,
      OperatorGuard,
    ]);
  });

  it('hides the endpoint from the feature gate guard when disabled', () => {
    const config = {
      get: jest.fn().mockReturnValue(false),
    };
    const guard = new OperatorAuditEnabledGuard(config as never);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
    expect(config.get).toHaveBeenCalledWith('OPERATOR_AUDIT_ENABLED', {
      infer: true,
    });
  });

  it('allows the request through the feature gate guard when enabled', () => {
    const config = {
      get: jest.fn().mockReturnValue(true),
    };
    const guard = new OperatorAuditEnabledGuard(config as never);

    expect(guard.canActivate()).toBe(true);
  });

  it('parses query and returns redacted audit logs', async () => {
    const response = {
      items: [
        {
          id: 'audit_1',
          actorUserId: 'user_admin',
          action: 'OUTBOX_REQUEUE',
          status: 'FAILED',
          targetType: 'OutboxEvent',
          targetId: 'evt_1',
          reason: 'retry after fix',
          requestId: 'req_1',
          ipAddressHash: 'sha256:ip',
          userAgentHash: 'sha256:ua',
          errorCode: 'Error',
          errorPreview: 'Operator action failed',
          createdAt: '2026-07-08T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    };
    const service = {
      list: jest.fn().mockResolvedValue(response),
    };
    const controller = new OperatorAuditController(service as never);

    await expect(
      controller.list({
        action: 'OUTBOX_REQUEUE',
        status: 'FAILED',
        targetType: 'OutboxEvent',
        targetId: 'evt_1',
        limit: '10',
      }),
    ).resolves.toEqual(response);
    expect(service.list).toHaveBeenCalledWith({
      action: 'OUTBOX_REQUEUE',
      status: 'FAILED',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      limit: 10,
    });
    expect(JSON.stringify(response)).not.toContain('payload');
    expect(JSON.stringify(response)).not.toContain('metadata');
  });

  it('returns one redacted audit log detail by id', async () => {
    const response = {
      id: 'audit_1',
      actorUserId: 'user_admin',
      action: 'OUTBOX_REQUEUE',
      status: 'SUCCEEDED',
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      reason: 'fixed provider config',
      requestId: 'req_1',
      ipAddressHash: 'sha256:ip',
      userAgentHash: 'sha256:ua',
      errorCode: null,
      errorPreview: null,
      createdAt: '2026-07-08T10:00:00.000Z',
    };
    const service = {
      detail: jest.fn(),
      getDetail: jest.fn().mockResolvedValue(response),
      list: jest.fn(),
    };
    const controller = new OperatorAuditController(service as never);

    await expect(controller.detail('audit_1')).resolves.toEqual(response);
    expect(service.getDetail).toHaveBeenCalledWith('audit_1');
    expect(JSON.stringify(response)).not.toContain('metadata');
    expect(JSON.stringify(response)).not.toContain('payload');
  });
});
