import {
  type ArgumentsHost,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorGuard } from '../auth/operator.guard';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppError } from '../common/errors/app-error';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { OperatorAuditEnabledGuard } from '../operator-audit/operator-audit.controller';
import {
  OperatorAuditExportController,
  OperatorAuditExportEnabledGuard,
} from './operator-audit-export.controller';

describe('OperatorAuditExportController', () => {
  it('checks audit and export gates before authentication and operator authorization', () => {
    const metadata = Reflect.getMetadata(
      GUARDS_METADATA,
      OperatorAuditExportController,
    ) as unknown;

    expect(Array.isArray(metadata) ? metadata : []).toEqual([
      OperatorAuditEnabledGuard,
      OperatorAuditExportEnabledGuard,
      JwtAuthGuard,
      OperatorGuard,
    ]);
  });

  it('hides the export endpoint before authentication when its gate is disabled', () => {
    const guard = new OperatorAuditExportEnabledGuard({
      get: jest.fn().mockReturnValue(false),
    } as never);

    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('allows requests when the export gate is enabled', () => {
    const guard = new OperatorAuditExportEnabledGuard({
      get: jest.fn().mockReturnValue(true),
    } as never);

    expect(guard.canActivate()).toBe(true);
  });

  it('returns 202 and passes parsed input, current user, and request to the service', async () => {
    const service = {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'export_1', canDownload: false }),
    };
    const controller = new OperatorAuditExportController(service as never);
    const request = createRequest();

    await expect(
      controller.create(createAdmin(), createBody(), request as never),
    ).resolves.toEqual({ id: 'export_1', canDownload: false });

    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        Reflect.get(
          OperatorAuditExportController.prototype,
          'create',
        ) as object,
      ),
    ).toBe(HttpStatus.ACCEPTED);
    expect(service.create).toHaveBeenCalledWith(
      'user_admin',
      createBody(),
      request,
    );
  });

  it('documents the strict shared request shape in Swagger metadata', () => {
    const metadata = Reflect.getMetadata(
      'swagger/apiParameters',
      Reflect.get(OperatorAuditExportController.prototype, 'create') as object,
    ) as unknown;
    const parameters = Array.isArray(metadata) ? metadata : [];
    const body = parameters.find(
      (parameter: unknown) =>
        typeof parameter === 'object' &&
        parameter !== null &&
        Reflect.get(parameter, 'in') === 'body',
    ) as { schema?: unknown } | undefined;

    expect(body?.schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['clientRequestId', 'startAt', 'endAt', 'reason'],
      properties: {
        clientRequestId: { type: 'string', format: 'uuid' },
        startAt: { type: 'string', format: 'date-time' },
        endAt: { type: 'string', format: 'date-time' },
        reason: { type: 'string', minLength: 3, maxLength: 240 },
        action: {
          type: 'string',
          enum: [
            'OUTBOX_REQUEUE',
            'AUDIT_EXPORT_REQUEST',
            'AUDIT_EXPORT_DOWNLOAD',
          ],
        },
        status: { type: 'string', enum: ['SUCCEEDED', 'FAILED'] },
        targetType: { type: 'string', minLength: 1, maxLength: 120 },
        targetId: { type: 'string', minLength: 1, maxLength: 200 },
        actorUserId: { type: 'string', minLength: 1 },
      },
    });
  });

  it.each([
    ['invalid UUID', { clientRequestId: 'not-a-uuid' }],
    ['short reason', { reason: 'x' }],
    ['invalid date', { startAt: 'not-a-date' }],
    ['unknown field', { objectKey: 'operator-audit-exports/secret.zip' }],
  ])(
    'maps %s request validation to the safe domain 400',
    async (_name, patch) => {
      const service = { create: jest.fn() };
      const controller = new OperatorAuditExportController(service as never);

      const error: unknown = await controller
        .create(
          createAdmin(),
          { ...createBody(), ...patch },
          createRequest() as never,
        )
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
        statusCode: HttpStatus.BAD_REQUEST,
      });
      expect(service.create).not.toHaveBeenCalled();
    },
  );

  it('keeps the domain validation code and request id in the global error envelope', async () => {
    const service = { create: jest.fn() };
    const controller = new OperatorAuditExportController(service as never);
    const filter = new HttpExceptionFilter();
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const request = createRequest();
    let caught: unknown;
    try {
      await controller.create(
        createAdmin(),
        { ...createBody(), objectKey: 'operator-audit-exports/secret.zip' },
        request as never,
      );
    } catch (error) {
      caught = error;
    }

    filter.catch(caught, createHost(status, request.requestId));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
        message: 'Invalid operator audit export request',
      },
      requestId: 'req_1',
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('objectKey');
    expect(JSON.stringify(json.mock.calls)).not.toContain('issues');
    expect(service.create).not.toHaveBeenCalled();
  });

  function createAdmin(): AuthenticatedUser {
    return {
      id: 'user_admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
  }

  function createBody() {
    return {
      clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
      startAt: '2026-07-01T00:00:00.000Z',
      endAt: '2026-07-10T00:00:00.000Z',
      reason: 'INC-2026-0710 evidence review',
      action: 'OUTBOX_REQUEUE' as const,
      status: 'FAILED' as const,
      targetType: 'OutboxEvent',
      targetId: 'evt_1',
      actorUserId: 'user_actor',
    };
  }

  function createRequest() {
    return {
      requestId: 'req_1',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Playwright' },
    };
  }

  function createHost(status: jest.Mock, requestId: string): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ requestId }),
        getNext: jest.fn(),
      }),
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getType: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ArgumentsHost;
  }
});
