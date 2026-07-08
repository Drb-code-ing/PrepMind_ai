import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import {
  OutboxOpsController,
  OutboxOpsEnabledGuard,
} from './outbox-ops.controller';

describe('OutboxOpsController', () => {
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
    const controller = new OutboxOpsController(service as never);

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
    const controller = new OutboxOpsController(service as never);

    await expect(controller.detail('evt_1')).resolves.toEqual({ id: 'evt_1' });
    expect(service.getDetail).toHaveBeenCalledWith('evt_1');
  });

  it('requeues an outbox event', async () => {
    const service = {
      list: jest.fn(),
      getDetail: jest.fn(),
      requeue: jest.fn().mockResolvedValue({ id: 'evt_1', status: 'PENDING' }),
    };
    const controller = new OutboxOpsController(service as never);

    await expect(
      controller.requeue('evt_1', { reason: 'fixed provider config' }),
    ).resolves.toEqual({ id: 'evt_1', status: 'PENDING' });
    expect(service.requeue).toHaveBeenCalledWith('evt_1', expect.any(Date));
  });
});
