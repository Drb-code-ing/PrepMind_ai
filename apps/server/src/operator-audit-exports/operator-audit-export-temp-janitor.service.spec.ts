import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { OperatorAuditExportTempJanitorService } from './operator-audit-export-temp-janitor.service';

describe('OperatorAuditExportTempJanitorService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-janitor-test-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function setup(exportRow: unknown = null, bullState = 'failed') {
    const prisma = {
      operatorAuditExport: {
        findUnique: jest.fn().mockResolvedValue(exportRow),
      },
      backgroundJob: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ now: new Date('2026-07-10T08:00:00Z') }]),
    };
    const queue = {
      getJob: jest.fn().mockResolvedValue({
        getState: jest.fn().mockResolvedValue(bullState),
      }),
    };
    return {
      service: new OperatorAuditExportTempJanitorService(
        prisma as never,
        queue as never,
        { tempRoot: root },
      ),
      prisma,
      queue,
    };
  }

  it('deletes only a strict directory whose export is absent and target stays under temp root', async () => {
    const token = '12345678-1234-4234-8234-123456789abc';
    const safe = join(root, `prepmind-audit-export-export_1-${token}`);
    const unrelated = join(root, 'prepmind-audit-export-../unsafe');
    await mkdir(safe);
    await mkdir(join(root, 'unrelated'));
    const ctx = setup(null);

    expect(await ctx.service.run()).toBe(1);
    await expect(realpath(safe)).rejects.toThrow();
    await expect(realpath(join(root, 'unrelated'))).resolves.toBeTruthy();
    expect(unrelated).toContain('unsafe');
  });

  it('keeps current token, live lease, and active BullMQ work regardless of directory age', async () => {
    const token = '12345678-1234-4234-8234-123456789abc';
    const path = join(root, `prepmind-audit-export-export_1-${token}`);
    await mkdir(path);
    const live = setup({
      id: 'export_1',
      backgroundJobId: 'job_1',
      processingToken: token,
      leaseExpiresAt: new Date('2026-07-10T09:00:00Z'),
    });
    expect(await live.service.run()).toBe(0);

    const expiredButActive = setup(
      {
        id: 'export_1',
        backgroundJobId: 'job_1',
        processingToken: 'other_token',
        leaseExpiresAt: new Date('2026-07-10T07:00:00Z'),
      },
      'active',
    );
    expect(await expiredButActive.service.run()).toBe(0);
    await expect(realpath(path)).resolves.toBeTruthy();
  });

  it('deletes an expired non-current token after BullMQ is no longer active', async () => {
    const token = '12345678-1234-4234-8234-123456789abc';
    const path = join(root, `prepmind-audit-export-export_1-${token}`);
    await mkdir(path);
    const ctx = setup({
      id: 'export_1',
      backgroundJobId: 'job_1',
      processingToken: 'other_token',
      leaseExpiresAt: new Date('2026-07-10T07:00:00Z'),
    });
    expect(await ctx.service.run()).toBe(1);
    await expect(realpath(path)).rejects.toThrow();
  });

  it('treats a terminal export without a lease as safe when the directory token is non-current', async () => {
    const token = '12345678-1234-4234-8234-123456789abc';
    const path = join(root, `prepmind-audit-export-export_1-${token}`);
    await mkdir(path);
    const ctx = setup({
      id: 'export_1',
      backgroundJobId: 'job_1',
      processingToken: null,
      leaseExpiresAt: null,
    });
    expect(await ctx.service.run()).toBe(1);
    await expect(realpath(path)).rejects.toThrow();
  });

  it('does not fail worker module initialization or log raw paths when the startup scan fails', async () => {
    const logger = { warn: jest.fn() };
    const outside = join(tmpdir(), '..', `outside-${Date.now()}`);
    const prisma = { $queryRaw: jest.fn() };
    const service = new OperatorAuditExportTempJanitorService(
      prisma as never,
      { getJob: jest.fn() } as never,
      { tempRoot: outside, logger },
    );
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      'Operator audit export temp janitor startup failed',
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(outside);
  });
});
