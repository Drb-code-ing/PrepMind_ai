import { Readable } from 'node:stream';

import {
  type ArgumentsHost,
  HttpStatus,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';

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
import { OperatorAuditExportDownloadService } from './operator-audit-export-download.service';
import { OperatorAuditExportQueryService } from './operator-audit-export-query.service';
import { OperatorAuditExportsModule } from './operator-audit-exports.module';

describe('OperatorAuditExportController', () => {
  it('registers query and download services as module providers', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      OperatorAuditExportsModule,
    ) as unknown;

    expect(Array.isArray(providers) ? providers : []).toEqual(
      expect.arrayContaining([
        OperatorAuditExportQueryService,
        OperatorAuditExportDownloadService,
      ]),
    );
  });

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
    const controller = createController({ requestService: service });
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
      const controller = createController({ requestService: service });

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
    const controller = createController({ requestService: service });
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

  it('passes a strict parsed list query to the system-wide query service', async () => {
    const queryService = {
      list: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      getDetail: jest.fn(),
    };
    const controller = createController({ queryService });

    await expect(
      controller.list({
        status: 'READY',
        requestedByUserId: 'admin_a',
        limit: '7',
      }),
    ).resolves.toEqual({ items: [], nextCursor: null });

    expect(queryService.list).toHaveBeenCalledWith({
      status: 'READY',
      requestedByUserId: 'admin_a',
      limit: 7,
    });
  });

  it.each([
    ['unknown field', { objectKey: 'secret' }],
    ['invalid status', { status: 'SECRET' }],
    ['invalid limit', { limit: '101' }],
    [
      'reversed creation range',
      {
        createdFrom: '2026-07-11T00:00:00.000Z',
        createdTo: '2026-07-10T00:00:00.000Z',
      },
    ],
  ])(
    'maps %s list query validation to the safe domain 400',
    async (_name, query) => {
      const queryService = { list: jest.fn(), getDetail: jest.fn() };
      const controller = createController({ queryService });

      const error: unknown = await controller
        .list(query)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: 'OPERATOR_AUDIT_EXPORT_INVALID_REQUEST',
        statusCode: HttpStatus.BAD_REQUEST,
      });
      expect(queryService.list).not.toHaveBeenCalled();
    },
  );

  it('returns export detail without applying current-admin ownership', async () => {
    const queryService = {
      list: jest.fn(),
      getDetail: jest.fn().mockResolvedValue({
        id: 'export_admin_a',
        requestedByUserId: 'admin_a',
      }),
    };
    const controller = createController({ queryService });

    await expect(controller.detail('export_admin_a')).resolves.toMatchObject({
      requestedByUserId: 'admin_a',
    });
    expect(queryService.getDetail).toHaveBeenCalledWith('export_admin_a');
  });

  it('returns a StreamableFile with safe ZIP headers and the downloading admin actor', async () => {
    const stream = Readable.from([Buffer.from('PK\u0003\u0004zip')]);
    const downloadService = {
      download: jest.fn().mockResolvedValue({
        stream,
        fileName: 'unsafe\r\nHeader: value 审计.zip',
        archiveSize: 7,
        archiveSha256: `sha256:${'b'.repeat(64)}`,
      }),
    };
    const controller = createController({ downloadService });
    const response = { setHeader: jest.fn() };
    const request = createRequest();

    const result = await controller.download(
      createAdmin(),
      'export_admin_a',
      request as never,
      response as never,
    );

    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getStream()).toBe(stream);
    expect(downloadService.download).toHaveBeenCalledWith(
      'user_admin',
      'export_admin_a',
      request,
    );
    expect(response.setHeader.mock.calls).toEqual([
      ['Content-Type', 'application/zip'],
      ['Content-Disposition', 'attachment; filename="unsafeHeader-value-.zip"'],
      ['Cache-Control', 'no-store, private'],
      ['X-Content-SHA256', `sha256:${'b'.repeat(64)}`],
      ['Content-Length', '7'],
    ]);
    expect(JSON.stringify(response.setHeader.mock.calls)).not.toMatch(/[\r\n]/);
  });

  it('falls back to a fixed server filename when the stored name has no safe characters', async () => {
    const downloadService = {
      download: jest.fn().mockResolvedValue({
        stream: Readable.from(['zip']),
        fileName: '审计证据包',
        archiveSize: 3,
        archiveSha256: `sha256:${'b'.repeat(64)}`,
      }),
    };
    const response = { setHeader: jest.fn() };

    await createController({ downloadService }).download(
      createAdmin(),
      'export_1',
      createRequest() as never,
      response as never,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="prepmind-operator-audit-export.zip"',
    );
  });

  function createAdmin(): AuthenticatedUser {
    return {
      id: 'user_admin',
      email: 'admin@example.com',
      role: 'ADMIN',
    };
  }

  function createController(
    overrides: {
      requestService?: Record<string, jest.Mock>;
      queryService?: Record<string, jest.Mock>;
      downloadService?: Record<string, jest.Mock>;
    } = {},
  ) {
    return new OperatorAuditExportController(
      (overrides.requestService ?? { create: jest.fn() }) as never,
      (overrides.queryService ?? {
        list: jest.fn(),
        getDetail: jest.fn(),
      }) as never,
      (overrides.downloadService ?? { download: jest.fn() }) as never,
    );
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
