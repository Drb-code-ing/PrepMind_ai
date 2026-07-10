import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { OPERATOR_AUDIT_RETENTION_LOCK } from './operator-audit-export.constants';

describe('operator audit retention advisory lock integration', () => {
  const prisma = new PrismaClient();
  const auditId = randomUUID();
  const exportId = randomUUID();

  beforeAll(async () => prisma.$connect());
  afterAll(async () => {
    await prisma.operatorAuditExport.deleteMany({ where: { id: exportId } });
    await prisma.operatorAuditLog.deleteMany({ where: { id: auditId } });
    await prisma.$disconnect();
  });

  it('cannot delete a validated range before the request transaction commits its active watermark', async () => {
    const now = new Date();
    const startAt = new Date(now.getTime() - 181 * 86_400_000);
    await prisma.operatorAuditLog.create({
      data: {
        id: auditId,
        action: 'AUDIT_EXPORT_REQUEST',
        status: 'SUCCEEDED',
        targetType: 'LockIntegration',
        createdAt: startAt,
      },
    });

    let validated!: () => void;
    const validatedPromise = new Promise<void>((resolve) => {
      validated = resolve;
    });
    let release!: () => void;
    const releasePromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const request = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0))`;
      expect(await tx.operatorAuditLog.count({ where: { id: auditId } })).toBe(
        1,
      );
      validated();
      await releasePromise;
      await tx.operatorAuditExport.create({
        data: {
          id: exportId,
          clientRequestId: randomUUID(),
          requestHash: `sha256:${'a'.repeat(64)}`,
          backgroundJobId: randomUUID(),
          status: 'QUEUED',
          startAt,
          endAt: now,
          snapshotAt: now,
          reason: 'integration lock proof',
        },
      });
    });

    await validatedPromise;
    let maintenanceLockAcquired = false;
    const maintenance = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0))`;
      maintenanceLockAcquired = true;
      const [clock] = await tx.$queryRaw<
        Array<{ now: Date }>
      >`SELECT clock_timestamp() AS now`;
      const oldest = await tx.operatorAuditExport.findFirst({
        where: { status: { in: ['QUEUED', 'PROCESSING'] } },
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        select: { startAt: true },
      });
      const base = new Date((clock?.now ?? now).getTime() - 180 * 86_400_000);
      const cutoff = oldest && oldest.startAt < base ? oldest.startAt : base;
      await tx.operatorAuditLog.deleteMany({
        where: { id: auditId, createdAt: { lt: cutoff } },
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(maintenanceLockAcquired).toBe(false);
    expect(
      await prisma.operatorAuditLog.count({ where: { id: auditId } }),
    ).toBe(1);
    release();
    await Promise.all([request, maintenance]);
    expect(
      await prisma.operatorAuditLog.count({ where: { id: auditId } }),
    ).toBe(1);
  }, 20_000);
});
