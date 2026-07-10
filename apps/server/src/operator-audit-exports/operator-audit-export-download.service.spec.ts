import { Readable } from 'node:stream';

import { HttpStatus } from '@nestjs/common';

import { AppError } from '../common/errors/app-error';
import {
  OperatorAuditExportStorageError,
  type StorageService,
} from '../uploads/storage.service';
import { OperatorAuditExportDownloadService } from './operator-audit-export-download.service';

describe('OperatorAuditExportDownloadService', () => {
  const databaseNow = new Date('2026-07-11T12:00:00.000Z');
  const operatorAuditExport = {
    findFirst: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = {
    operatorAuditExport,
    $queryRaw: jest.fn().mockResolvedValue([{ now: databaseNow }]),
  };
  const storage = {
    readOperatorAuditExport: jest.fn(),
  };
  const audit = {
    recordSuccessStrict: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn<(input: unknown) => Promise<void>>(),
  };
  const config = {
    get: jest.fn().mockReturnValue(256),
  };
  const logger = { warn: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ now: databaseNow }]);
    operatorAuditExport.findFirst.mockResolvedValue(exportRow());
    operatorAuditExport.updateMany.mockResolvedValue({ count: 1 });
    storage.readOperatorAuditExport.mockResolvedValue({
      stream: Readable.from([Buffer.from('PK\u0003\u0004zip')]),
      contentType: 'application/zip',
      size: 128,
    });
    audit.recordSuccessStrict.mockResolvedValue(undefined);
    audit.recordFailure.mockResolvedValue(undefined);
  });

  it('opens a cross-admin export stream before strict audit and returns only after audit succeeds', async () => {
    const operationOrder: string[] = [];
    const stream = Readable.from([Buffer.from('PK\u0003\u0004zip')]);
    operatorAuditExport.findFirst.mockImplementation(() => {
      operationOrder.push('load-export');
      return Promise.resolve(exportRow({ requestedByUserId: 'admin_a' }));
    });
    prisma.$queryRaw.mockImplementation(() => {
      operationOrder.push('database-now');
      return Promise.resolve([{ now: databaseNow }]);
    });
    storage.readOperatorAuditExport.mockImplementation(() => {
      operationOrder.push('open-minio-stream');
      return Promise.resolve({
        stream,
        contentType: 'application/zip',
        size: 128,
      });
    });
    audit.recordSuccessStrict.mockImplementation(() => {
      operationOrder.push('strict-download-audit');
      return Promise.resolve();
    });
    const request = {
      requestId: 'req_1',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Playwright' },
    };

    const result = await createService().download(
      'downloading_admin_b',
      'export_1',
      request,
    );
    operationOrder.push('return-stream');

    expect(operationOrder).toEqual([
      'load-export',
      'database-now',
      'open-minio-stream',
      'strict-download-audit',
      'return-stream',
    ]);
    expect(result).toEqual({
      stream,
      fileName: 'operator-audit-export.zip',
      archiveSize: 128,
      archiveSha256: `sha256:${'b'.repeat(64)}`,
    });
    expect(audit.recordSuccessStrict).toHaveBeenCalledWith(prisma, {
      actorUserId: 'downloading_admin_b',
      action: 'AUDIT_EXPORT_DOWNLOAD',
      targetType: 'OperatorAuditExport',
      targetId: 'export_1',
      reason: 'INC evidence review',
      request,
      metadata: { source: 'http' },
    });
  });

  it('returns a safe 404 before reading database time for an unknown export', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(null);

    await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
  });

  it.each(['QUEUED', 'PROCESSING', 'FAILED'])(
    'returns a safe 409 when status is %s',
    async (status) => {
      operatorAuditExport.findFirst.mockResolvedValue(exportRow({ status }));

      await expectDomainError(
        'OPERATOR_AUDIT_EXPORT_NOT_READY',
        HttpStatus.CONFLICT,
      );

      expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
      expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
    },
  );

  it('returns a safe 410 when maintenance already marked the export EXPIRED', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(
      exportRow({ status: 'EXPIRED' }),
    );

    await expectDomainError('OPERATOR_AUDIT_EXPORT_EXPIRED', HttpStatus.GONE);

    expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
    expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
  });

  it('returns a safe 410 when READY expiresAt equals database time', async () => {
    operatorAuditExport.findFirst.mockResolvedValue(
      exportRow({ expiresAt: databaseNow }),
    );

    await expectDomainError('OPERATOR_AUDIT_EXPORT_EXPIRED', HttpStatus.GONE);

    expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
  });

  it.each([
    ['objectKey', null],
    ['fileName', null],
    ['archiveSize', null],
    ['archiveSha256', null],
    ['archiveSha256', 'sha256:invalid\r\nX-Evil: value'],
  ])(
    'returns a safe 502 when required internal %s is missing',
    async (field, value) => {
      operatorAuditExport.findFirst.mockResolvedValue(
        exportRow({ [field]: value }),
      );

      await expectDomainError(
        'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
        HttpStatus.BAD_GATEWAY,
      );

      expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
      expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
    },
  );

  it.each([0, 257])(
    'returns a safe 502 before storage when database archiveSize is %s',
    async (archiveSize) => {
      operatorAuditExport.findFirst.mockResolvedValue(
        exportRow({ archiveSize }),
      );

      await expectDomainError(
        'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
        HttpStatus.BAD_GATEWAY,
      );

      expect(storage.readOperatorAuditExport).not.toHaveBeenCalled();
      expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
    },
  );

  it('destroys the stream, records failure, and returns safe 502 on exact size mismatch', async () => {
    const stream = Readable.from([Buffer.from('PK\u0003\u0004zip')]);
    const destroy = jest.spyOn(stream, 'destroy');
    storage.readOperatorAuditExport.mockResolvedValue({
      stream,
      contentType: 'application/zip',
      size: 127,
    });

    const error = await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
      HttpStatus.BAD_GATEWAY,
    );

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(audit.recordFailure).toHaveBeenCalledTimes(1);
    expect(audit.recordSuccessStrict).not.toHaveBeenCalled();
    expect(operatorAuditExport.updateMany).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      'Operator audit export size mismatch',
    );
    expect(error.message).not.toContain('127');
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /127|128|objectKey|secret/i,
    );
  });

  it('records failure and CAS-marks READY failed only for a confirmed missing object', async () => {
    const rawError = new OperatorAuditExportStorageError('missing');
    storage.readOperatorAuditExport.mockRejectedValue(rawError);

    const error = await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
      HttpStatus.BAD_GATEWAY,
    );

    expect(error.message).not.toContain(rawError.message);
    expect(audit.recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'downloading_admin',
        action: 'AUDIT_EXPORT_DOWNLOAD',
        targetType: 'OperatorAuditExport',
        targetId: 'export_1',
        reason: 'INC evidence review',
        request: undefined,
        metadata: { source: 'http' },
      }),
    );
    expect(JSON.stringify(audit.recordFailure.mock.calls)).toContain(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
    );
    expect(operatorAuditExport.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'export_1',
        status: 'READY',
        objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      },
      data: {
        status: 'FAILED',
        objectKey: null,
        errorCode: 'EXPORT_FILE_MISSING',
        errorPreview: 'Export file is missing',
      },
    });
  });

  it('keeps the safe 502 and logs a fixed warning when confirmed-missing CAS fails', async () => {
    storage.readOperatorAuditExport.mockRejectedValue(
      new OperatorAuditExportStorageError('missing'),
    );
    operatorAuditExport.updateMany.mockRejectedValue(
      new Error('postgres password=raw-secret objectKey=raw-key'),
    );

    await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
      HttpStatus.BAD_GATEWAY,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to mark missing operator audit export',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /raw-secret|raw-key|objectKey|password/i,
    );
  });

  it('logs the same fixed warning when confirmed-missing CAS selects no READY row', async () => {
    storage.readOperatorAuditExport.mockRejectedValue(
      new OperatorAuditExportStorageError('missing'),
    );
    operatorAuditExport.updateMany.mockResolvedValue({ count: 0 });

    await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
      HttpStatus.BAD_GATEWAY,
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to mark missing operator audit export',
    );
  });

  it('records failure but does not mutate READY on an unavailable storage dependency', async () => {
    storage.readOperatorAuditExport.mockRejectedValue(
      new OperatorAuditExportStorageError('unavailable'),
    );

    await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_FILE_UNAVAILABLE',
      HttpStatus.BAD_GATEWAY,
    );

    expect(audit.recordFailure).toHaveBeenCalledTimes(1);
    expect(operatorAuditExport.updateMany).not.toHaveBeenCalled();
  });

  it('destroys the opened stream and returns a safe 503 when strict audit fails', async () => {
    const stream = Readable.from([Buffer.from('PK\u0003\u0004zip')]);
    const destroy = jest.spyOn(stream, 'destroy');
    storage.readOperatorAuditExport.mockResolvedValue({
      stream,
      contentType: 'application/zip',
      size: 128,
    });
    audit.recordSuccessStrict.mockRejectedValue(
      new Error('database secret raw error'),
    );

    const error = await expectDomainError(
      'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Operator audit export download audit failed',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(
      /database secret raw error|objectKey|connection/i,
    );
    expect(error.message).not.toContain('database secret raw error');
  });

  function createService() {
    return new OperatorAuditExportDownloadService(
      prisma as never,
      storage as unknown as StorageService,
      audit as never,
      config as never,
      logger,
    );
  }

  async function expectDomainError(code: string, statusCode: number) {
    const error: unknown = await createService()
      .download('downloading_admin', 'export_1')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code, statusCode });
    return error as AppError;
  }

  function exportRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'export_1',
      requestedByUserId: 'admin_a',
      status: 'READY',
      reason: 'INC evidence review',
      objectKey: 'operator-audit-exports/export_1/attempts/token_1.zip',
      fileName: 'operator-audit-export.zip',
      archiveSize: 128,
      archiveSha256: `sha256:${'b'.repeat(64)}`,
      expiresAt: new Date('2026-07-12T12:00:00.000Z'),
      ...overrides,
    };
  }
});
