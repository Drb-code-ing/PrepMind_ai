import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OutboxOpsController } from './outbox-ops.controller';

describe('OutboxOpsController', () => {
  it('uses JwtAuthGuard on the controller', () => {
    const guardsMetadata = Reflect.getMetadata(
      GUARDS_METADATA,
      OutboxOpsController,
    ) as unknown;
    const guards = Array.isArray(guardsMetadata) ? guardsMetadata : [];

    expect(guards).toContain(JwtAuthGuard);
  });

  it('hides endpoints when outbox ops is disabled', async () => {
    const service = {
      list: jest.fn(),
      getDetail: jest.fn(),
      requeue: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue(false) };
    const controller = new OutboxOpsController(
      service as never,
      config as never,
    );

    await expect(controller.list({})).rejects.toBeInstanceOf(NotFoundException);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('lists outbox events with parsed query defaults', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getDetail: jest.fn(),
      requeue: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue(true) };
    const controller = new OutboxOpsController(
      service as never,
      config as never,
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
    const config = { get: jest.fn().mockReturnValue(true) };
    const controller = new OutboxOpsController(
      service as never,
      config as never,
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
    const config = { get: jest.fn().mockReturnValue(true) };
    const controller = new OutboxOpsController(
      service as never,
      config as never,
    );

    await expect(
      controller.requeue('evt_1', { reason: 'fixed provider config' }),
    ).resolves.toEqual({ id: 'evt_1', status: 'PENDING' });
    expect(service.requeue).toHaveBeenCalledWith('evt_1', expect.any(Date));
  });
});
