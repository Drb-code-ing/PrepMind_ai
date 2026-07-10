# Operator Audit Retention and Evidence Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-bounded, administrator-only incident evidence workflow that retains operator audit metadata for 180 days, asynchronously generates a 24-hour ZIP evidence package, and records request/download access with fail-closed auditing.

**Architecture:** `OperatorAuditExport` is the long-lived domain fact, a `SYSTEM` `BackgroundJob` is the execution fact, and a transactionally-created `OutboxEvent` is the only PostgreSQL-to-BullMQ bridge. A single-concurrency worker reads a repeatable PostgreSQL snapshot into a formula-safe CSV and manifest, uploads an attempt-fenced ZIP to MinIO, and selects the object with a processing-token CAS. An hourly maintenance worker expires objects, repairs abandoned states, advances the 180-day retention watermark, and exposes queue/maintenance health through Worker Readiness.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL 16, BullMQ 5.79.2, Redis 7, MinIO 8, Zod, `csv-stringify`, `archiver`, test-only `unzipper`, Next.js 16, React 19, TanStack Query, Bun workspace, Jest, Node test runner, Docker Compose.

---

## Execution Rules

1. Treat each numbered task below as one reviewable phase and one implementation commit. Do not combine two tasks into one commit.
2. Before every task, switch to the latest verified `main` and create the exact `codex/phase-7-23-*` branch named in that task. Never create a task branch from the previous task branch.
3. Follow RED -> GREEN -> focused regression -> docs -> commit. Do not weaken or delete a failing test just to make GREEN pass.
4. Every task updates `AGENTS.md`, `DEVLOG.md`, and `docs/roadmap.md` with why/what/how, current boundaries, verification evidence, and at least one “回顾时可以问” prompt.
5. After task acceptance, merge with `--no-ff` into `main`, rerun the task's verification on `main`, and only then create the next branch.
6. Keep `Outbox` requeue auditing best-effort. Only evidence-package request and successful download are fail-closed.
7. Never persist or return `objectKey`, Outbox payload, `aggregateId`, `OperatorAuditLog.metadata`, user正文, prompt, RAG chunk, model output, API key, token, cookie, raw IP, or raw User-Agent.
8. Use a single implementation agent by default. A subagent is appropriate only for a bounded read-only review or an independent browser acceptance pass; keep total concurrency at or below three.

## Stable Names and Invariants

Use these names consistently in every task:

```ts
export const OPERATOR_AUDIT_EXPORT_QUEUE = 'operator-audit-export';
export const GENERATE_OPERATOR_AUDIT_EXPORT_JOB =
  'generate-operator-audit-export';
export const OPERATOR_AUDIT_MAINTENANCE_QUEUE =
  'operator-audit-maintenance';
export const MAINTAIN_OPERATOR_AUDIT_JOB = 'maintain-operator-audit';
export const OPERATOR_AUDIT_MAINTENANCE_SCHEDULER =
  'operator-audit-maintenance-hourly';
export const OPERATOR_AUDIT_MAINTENANCE_STATE = 'operator-audit';
export const OPERATOR_AUDIT_EXPORT_REQUESTED_EVENT =
  'operator.audit.export.requested';
export const OPERATOR_AUDIT_RETENTION_LOCK =
  'prepmind:operator-audit-retention';
export const OPERATOR_AUDIT_EXPORT_QUOTA_LOCK =
  'prepmind:operator-audit-export-quota';
```

- `BackgroundJob.resourceType = 'OPERATOR_AUDIT_EXPORT'`.
- `BackgroundJob.resourceId = OperatorAuditExport.id`.
- `OperatorAuditExport.backgroundJobId = BackgroundJob.id`.
- BullMQ `jobId = BackgroundJob.id`.
- Outbox idempotency key is `operator-audit-export-requested:<exportId>`.
- MinIO key is `operator-audit-exports/<exportId>/attempts/<processingToken>.zip`.
- Database lease defaults to 5 minutes; BullMQ lock defaults to 10 minutes; query timeout defaults to 2 minutes; stale repair defaults to 1 hour.
- READY TTL is 24 hours; MinIO lifecycle backstop is 48 hours; DEAD delivery recovery is 24 hours; audit/export metadata retention is 180 days.
- V1 has no legal hold, WORM archive, digital signature, manual TTL extension, expired-file recovery, presigned URL, or full-database export.

## File Structure

### Phase 7.23.2: Contract and persistence

- Create `packages/types/src/api/operator-audit-export.ts` for create/list/detail schemas and DTO types.
- Create `packages/types/tests/operator-audit-export.test.mts` for strict contract and forbidden-field tests.
- Modify `packages/types/tests/operator-audit.test.mts` for the two new audit actions.
- Modify `packages/types/src/api/operator-audit.ts`, `packages/types/src/api/index.ts`, and `packages/types/package.json` to expose new audit actions and export contracts.
- Modify `packages/database/prisma/schema.prisma` and create `packages/database/prisma/migrations/20260710090000_operator_audit_retention_exports/migration.sql`.
- Modify `apps/server/src/config/env.ts` and `apps/server/src/config/env.spec.ts` for bounded defaults and startup invariants.
- Modify `apps/server/src/background-jobs/background-jobs.service.ts` and its spec so every account query explicitly requires `scope=ACCOUNT`.
- Create `apps/server/test/background-job-scope.e2e-spec.ts` for ACCOUNT cascade and SYSTEM survival.

### Phase 7.23.3: Transactional delivery

- Create `apps/server/src/operator-audit-exports/operator-audit-export.constants.ts`.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-request.service.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-export.controller.ts` and spec for `POST /operator-audit-exports`.
- Create `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts`.
- Create `apps/server/src/outbox/operator-audit-export-requested.handler.ts` and spec.
- Modify `apps/server/src/outbox/outbox.service.ts`, `outbox.handlers.ts`, `outbox.module.ts`, and their specs for transaction-aware enqueue and injectable handlers.
- Modify `apps/server/src/operator-audit/operator-audit.service.ts` and spec for HMAC fingerprints plus strict transaction-aware audit writes.
- Modify `apps/server/src/app.module.ts` to register the export API.

### Phase 7.23.4: ZIP worker and object storage

- Modify `apps/server/package.json` and `bun.lock` to add `csv-stringify`, `archiver`, `@types/archiver`, and test-only `unzipper` / `@types/unzipper`.
- Create `apps/server/src/operator-audit-exports/jobs/generate-operator-audit-export.job.ts`.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-state.repository.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-csv.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-archive.service.ts` and spec.
- Create `apps/server/src/operator-audit-exports/jobs/operator-audit-export.processor.ts` and spec.
- Create `apps/server/src/operator-audit-exports/jobs/operator-audit-export-delay.integration.spec.ts` for real BullMQ delayed semantics.
- Modify `apps/server/src/uploads/storage.service.ts` and spec with export-only MinIO methods.
- Modify `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts` to register the worker only for `worker|both`.

### Phase 7.23.5: Retention and maintenance

- Create `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.scheduler.ts` and spec.
- Create `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.processor.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-maintenance.service.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-temp-janitor.service.ts` and spec.
- Modify Worker Readiness/Observability contracts and services to include all three queues and maintenance freshness.
- Modify `apps/admin/src/app/worker/page.tsx` to show audit export, maintenance, and last-success health without exposing job payloads.
- Create `docker/minio/operator-audit-export-lifecycle.json` and update `docker/docker-compose.dev.yml` with `minio-init` and bounded worker temp storage.

### Phase 7.23.6: Query and fail-closed download API

- Create `apps/server/src/operator-audit-exports/operator-audit-export-query.service.ts` and spec.
- Create `apps/server/src/operator-audit-exports/operator-audit-export-download.service.ts` and spec.
- Modify the export controller/module for list, detail, and binary download.
- Modify `apps/server/src/common/interceptors/response-envelope.interceptor.ts` and add its spec for `StreamableFile` bypass.
- Modify `apps/server/src/bootstrap/server-bootstrap.ts` and spec to expose `Content-Disposition` and `X-Content-SHA256`.
- Create `apps/server/test/operator-audit-exports.e2e-spec.ts` for gate/auth/download/security coverage.

### Phase 7.23.7: Admin evidence-package UI

- Create `apps/admin/src/lib/operator-audit-export-api.ts`, view helpers, and tests.
- Modify `apps/admin/src/lib/api-client.ts` and tests with a dedicated authenticated Blob download path.
- Split `apps/admin/src/app/audit/page.tsx` into audit/export panels under accessible tabs.
- Create `apps/admin/src/components/operator-audit-export-panel.tsx` and contract tests.

### Phase 7.23.8: Acceptance, operations docs, and interview study

- Finalize `docker/docker-compose.dev.yml` export gates, worker role, Dispatcher, maintenance, HMAC secret, lifecycle bootstrap, and healthcheck expectations.
- Update `docs/dev-start.md`, `docs/acceptance-checklist.md`, `README.md`, `AGENTS.md`, `DEVLOG.md`, and `docs/roadmap.md`.
- Create `docs/blogs/operator-audit-retention-export.md`.
- Run Docker/API/browser acceptance, clean generated records/objects, merge into `main`, and repeat the acceptance gate on `main`.

---

## Task 1: Phase 7.23.2 Contract, Prisma Schema, and SYSTEM Jobs

**Branch:** `codex/phase-7-23-2-contract-schema`

**Files:**
- Create: `packages/types/src/api/operator-audit-export.ts`
- Create: `packages/types/tests/operator-audit-export.test.mts`
- Modify: `packages/types/tests/operator-audit.test.mts`
- Modify: `packages/types/src/api/operator-audit.ts`
- Modify: `packages/types/src/api/index.ts`
- Modify: `packages/types/package.json`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20260710090000_operator_audit_retention_exports/migration.sql`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/config/env.spec.ts`
- Modify: `apps/server/src/background-jobs/background-jobs.service.ts`
- Modify: `apps/server/src/background-jobs/background-jobs.service.spec.ts`
- Create: `apps/server/test/background-job-scope.e2e-spec.ts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Create the branch from verified main**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-2-contract-schema
```

Expected: `git status --short` prints nothing before branch creation; the new branch points at the latest `main`.

- [ ] **Step 2: Write RED contract tests**

Create `packages/types/tests/operator-audit-export.test.mts` with concrete assertions:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  operatorAuditExportCreateRequestSchema,
  operatorAuditExportDetailResponseSchema,
  operatorAuditExportListQuerySchema,
} from '../src/api/operator-audit-export.ts';

test('accepts a strict export request with optional audit filters', () => {
  const parsed = operatorAuditExportCreateRequestSchema.parse({
    clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-10T00:00:00.000Z',
    reason: 'INC-2026-0710 Outbox retry review',
    action: 'OUTBOX_REQUEUE',
    status: 'FAILED',
    targetType: 'OutboxEvent',
    targetId: 'evt_1',
    actorUserId: 'user_admin',
  });
  assert.equal(parsed.reason, 'INC-2026-0710 Outbox retry review');
});

test('rejects unknown request fields and invalid local ordering', () => {
  assert.throws(() =>
    operatorAuditExportCreateRequestSchema.parse({
      clientRequestId: '1f01912c-7a3e-4e90-a26d-e49c9a314f63',
      startAt: '2026-07-10T00:00:00.000Z',
      endAt: '2026-07-01T00:00:00.000Z',
      reason: 'review export',
      objectKey: 'operator-audit-exports/secret.zip',
    }),
  );
});

test('parses stable list cursor filters', () => {
  const query = operatorAuditExportListQuerySchema.parse({
    status: 'READY',
    requestedByUserId: 'user_admin',
    createdFrom: '2026-07-01T00:00:00.000Z',
    createdTo: '2026-07-10T00:00:00.000Z',
    limit: '40',
    cursor: 'export_cursor',
  });
  assert.equal(query.limit, 40);
});

test('detail DTO rejects storage and internal delivery fields', () => {
  const safe = {
    id: 'export_1',
    requestedByUserId: 'user_admin',
    backgroundJobId: 'job_1',
    status: 'READY',
    filters: {
      action: null,
      status: null,
      targetType: null,
      targetId: null,
      actorUserId: null,
    },
    reason: 'incident review',
    startAt: '2026-07-01T00:00:00.000Z',
    endAt: '2026-07-10T00:00:00.000Z',
    snapshotAt: '2026-07-10T00:00:00.000Z',
    fileName: 'prepmind-operator-audit-20260701-20260710-export1.zip',
    archiveSize: 1024,
    recordCount: 3,
    csvSha256: `sha256:${'a'.repeat(64)}`,
    archiveSha256: `sha256:${'b'.repeat(64)}`,
    schemaVersion: 1,
    errorCode: null,
    errorPreview: null,
    requestedAt: '2026-07-10T00:00:00.000Z',
    startedAt: '2026-07-10T00:00:01.000Z',
    completedAt: '2026-07-10T00:00:02.000Z',
    expiresAt: '2026-07-11T00:00:02.000Z',
    expiredAt: null,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:02.000Z',
    canDownload: true,
  };
  assert.deepEqual(operatorAuditExportDetailResponseSchema.parse(safe), safe);
  assert.throws(() =>
    operatorAuditExportDetailResponseSchema.parse({
      ...safe,
      objectKey: 'operator-audit-exports/export_1/attempts/token.zip',
    }),
  );
});
```

- [ ] **Step 3: Run RED contract verification**

```powershell
bun test packages/types/tests/operator-audit-export.test.mts
```

Expected: FAIL with module-not-found for `src/api/operator-audit-export.ts`.

- [ ] **Step 4: Implement the shared contract**

Create `packages/types/src/api/operator-audit-export.ts` with these exported schemas and inferred types:

```ts
import { z } from 'zod';

import {
  operatorAuditActionSchema,
  operatorAuditStatusSchema,
} from './operator-audit';

const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const nullableDateTimeSchema = z.string().datetime().nullable();

export const operatorAuditExportStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'READY',
  'FAILED',
  'EXPIRED',
]);

export const operatorAuditExportCreateRequestSchema = z
  .object({
    clientRequestId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().trim().min(3).max(240),
    action: operatorAuditActionSchema.optional(),
    status: operatorAuditStatusSchema.optional(),
    targetType: z.string().trim().min(1).max(120).optional(),
    targetId: z.string().trim().min(1).max(200).optional(),
    actorUserId: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.startAt) >= Date.parse(value.endAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endAt'],
        message: 'endAt must be later than startAt',
      });
    }
  });

export const operatorAuditExportFiltersSchema = z
  .object({
    action: operatorAuditActionSchema.nullable(),
    status: operatorAuditStatusSchema.nullable(),
    targetType: z.string().min(1).nullable(),
    targetId: z.string().min(1).nullable(),
    actorUserId: z.string().min(1).nullable(),
  })
  .strict();

export const operatorAuditExportDetailResponseSchema = z
  .object({
    id: z.string().min(1),
    requestedByUserId: z.string().min(1).nullable(),
    backgroundJobId: z.string().min(1),
    status: operatorAuditExportStatusSchema,
    filters: operatorAuditExportFiltersSchema,
    reason: z.string().min(1),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    snapshotAt: z.string().datetime(),
    fileName: z.string().min(1).nullable(),
    archiveSize: z.number().int().min(0).nullable(),
    recordCount: z.number().int().min(0).nullable(),
    csvSha256: sha256Schema.nullable(),
    archiveSha256: sha256Schema.nullable(),
    schemaVersion: z.number().int().positive(),
    errorCode: z.string().min(1).nullable(),
    errorPreview: z.string().min(1).nullable(),
    requestedAt: z.string().datetime(),
    startedAt: nullableDateTimeSchema,
    completedAt: nullableDateTimeSchema,
    expiresAt: nullableDateTimeSchema,
    expiredAt: nullableDateTimeSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    canDownload: z.boolean(),
  })
  .strict();

export const operatorAuditExportListItemSchema =
  operatorAuditExportDetailResponseSchema;

export const operatorAuditExportListQuerySchema = z
  .object({
    status: operatorAuditExportStatusSchema.optional(),
    requestedByUserId: z.string().trim().min(1).optional(),
    createdFrom: z.string().datetime().optional(),
    createdTo: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().trim().min(1).optional(),
  })
  .strict();

export const operatorAuditExportListResponseSchema = z
  .object({
    items: z.array(operatorAuditExportListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export type OperatorAuditExportStatus = z.infer<
  typeof operatorAuditExportStatusSchema
>;
export type OperatorAuditExportCreateRequest = z.infer<
  typeof operatorAuditExportCreateRequestSchema
>;
export type OperatorAuditExportDetailResponse = z.infer<
  typeof operatorAuditExportDetailResponseSchema
>;
export type OperatorAuditExportListQuery = z.infer<
  typeof operatorAuditExportListQuerySchema
>;
export type OperatorAuditExportListResponse = z.infer<
  typeof operatorAuditExportListResponseSchema
>;
```

Extend `operatorAuditActionSchema` in `packages/types/src/api/operator-audit.ts` to:

```ts
export const operatorAuditActionSchema = z.enum([
  'OUTBOX_REQUEUE',
  'AUDIT_EXPORT_REQUEST',
  'AUDIT_EXPORT_DOWNLOAD',
]);
```

Export the new file from `packages/types/src/api/index.ts`; add `"./api/operator-audit-export": "./src/api/operator-audit-export.ts"` to `packages/types/package.json`.

- [ ] **Step 5: Run GREEN contract verification**

```powershell
bun test packages/types/tests/operator-audit-export.test.mts packages/types/tests/operator-audit.test.mts
bun --cwd packages/types typecheck
```

Expected: all named tests PASS and TypeScript exits 0.

- [ ] **Step 6: Write RED env and account-scope tests**

Add env assertions in `apps/server/src/config/env.spec.ts` for all approved defaults, production-off gates, and invalid relative timing:

```ts
it('parses bounded operator audit export defaults', () => {
  expect(parseEnv(requiredEnv)).toMatchObject({
    OPERATOR_AUDIT_EXPORT_ENABLED: false,
    OPERATOR_AUDIT_MAINTENANCE_ENABLED: false,
    OPERATOR_AUDIT_RETENTION_DAYS: 180,
    OPERATOR_AUDIT_EXPORT_TTL_HOURS: 24,
    OPERATOR_AUDIT_EXPORT_MAX_RANGE_DAYS: 31,
    OPERATOR_AUDIT_EXPORT_MAX_RECORDS: 50000,
    OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES: 67108864,
    OPERATOR_AUDIT_EXPORT_PER_ADMIN_ACTIVE_LIMIT: 2,
    OPERATOR_AUDIT_EXPORT_PER_ADMIN_HOURLY_LIMIT: 10,
    OPERATOR_AUDIT_EXPORT_GLOBAL_ACTIVE_LIMIT: 10,
    OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY: 1,
    OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: 600000,
    OPERATOR_AUDIT_EXPORT_LEASE_MS: 300000,
    OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS: 3600000,
    OPERATOR_AUDIT_EXPORT_DELIVERY_RECOVERY_HOURS: 24,
    OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS: 120000,
  });
});

it('rejects an export lease that is not shorter than the BullMQ lock', () => {
  expect(() =>
    parseEnv({
      ...requiredEnv,
      OPERATOR_AUDIT_EXPORT_LEASE_MS: 600000,
      OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS: 600000,
    }),
  ).toThrow();
});
```

Update `apps/server/src/background-jobs/background-jobs.service.spec.ts` so create/list/summary/find/update assertions require `scope: 'ACCOUNT'`. Add a regression test where the Prisma mock contains a `SYSTEM` job and assert the service query includes ACCOUNT scope rather than relying only on `userId`.

- [ ] **Step 7: Run RED env/scope verification**

```powershell
bun --filter @repo/server test -- env background-jobs --runInBand
```

Expected: FAIL because the new env keys and `scope` filters do not exist.

- [ ] **Step 8: Implement Prisma schema and migration**

Add these complete Prisma definitions to `packages/database/prisma/schema.prisma`:

```prisma
enum BackgroundJobScope {
  ACCOUNT
  SYSTEM
}

enum OperatorAuditExportStatus {
  QUEUED
  PROCESSING
  READY
  FAILED
  EXPIRED
}

enum OperatorAuditMaintenanceStatus {
  IDLE
  RUNNING
  SUCCEEDED
  FAILED
}

model OperatorAuditExport {
  id                String                    @id @default(cuid())
  requestedByUserId String?
  clientRequestId   String                    @db.VarChar(80)
  requestHash       String                    @db.VarChar(71)
  backgroundJobId   String                    @unique
  status            OperatorAuditExportStatus @default(QUEUED)
  startAt           DateTime
  endAt             DateTime
  snapshotAt        DateTime
  filterAction      OperatorAuditAction?
  filterStatus      OperatorAuditStatus?
  filterTargetType  String?                   @db.VarChar(120)
  filterTargetId    String?                   @db.VarChar(200)
  filterActorUserId String?
  reason            String                    @db.VarChar(240)
  objectKey         String?                   @unique @db.VarChar(500)
  fileName          String?                   @db.VarChar(180)
  archiveSize       Int?
  recordCount       Int?
  csvSha256         String?                   @db.VarChar(71)
  archiveSha256     String?                   @db.VarChar(71)
  schemaVersion     Int                       @default(1)
  errorCode         String?                   @db.VarChar(120)
  errorPreview      String?                   @db.VarChar(240)
  processingToken   String?                   @db.VarChar(80)
  leaseExpiresAt    DateTime?
  requestedAt       DateTime                  @default(now())
  startedAt         DateTime?
  completedAt       DateTime?
  expiresAt         DateTime?
  expiredAt         DateTime?
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt

  requestedBy User? @relation(fields: [requestedByUserId], references: [id], onDelete: SetNull)

  @@unique([requestedByUserId, clientRequestId])
  @@index([requestedByUserId, createdAt])
  @@index([status, expiresAt])
  @@index([status, startAt])
  @@index([createdAt, id])
}

model OperatorAuditMaintenanceState {
  name               String                         @id
  lastStartedAt      DateTime?
  lastSucceededAt    DateTime?
  lastFinishedAt     DateTime?
  status             OperatorAuditMaintenanceStatus @default(IDLE)
  expiredExportCount Int                            @default(0)
  deletedAuditCount  Int                            @default(0)
  deletedExportCount Int                            @default(0)
  errorCode          String?                        @db.VarChar(120)
  errorPreview       String?                        @db.VarChar(240)
  updatedAt          DateTime                       @updatedAt
}
```

Change `BackgroundJob.userId` to `String?`, add `scope BackgroundJobScope @default(ACCOUNT)`, make `user User?`, and add `@@index([scope, status, createdAt])`. Add `operatorAuditExports OperatorAuditExport[]` to `User`, extend `OperatorAuditAction`, and add `@@index([createdAt, id])` to `OperatorAuditLog`.

The migration must include the database-level invariant and indexes, not only Prisma declarations:

```sql
CREATE TYPE "BackgroundJobScope" AS ENUM ('ACCOUNT', 'SYSTEM');
ALTER TABLE "BackgroundJob"
  ADD COLUMN "scope" "BackgroundJobScope" NOT NULL DEFAULT 'ACCOUNT',
  ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "BackgroundJob"
  ADD CONSTRAINT "BackgroundJob_scope_user_check" CHECK (
    ("scope" = 'ACCOUNT' AND "userId" IS NOT NULL) OR
    ("scope" = 'SYSTEM' AND "userId" IS NULL)
  );
CREATE INDEX "BackgroundJob_scope_status_createdAt_idx"
  ON "BackgroundJob"("scope", "status", "createdAt");
ALTER TYPE "OperatorAuditAction" ADD VALUE 'AUDIT_EXPORT_REQUEST';
ALTER TYPE "OperatorAuditAction" ADD VALUE 'AUDIT_EXPORT_DOWNLOAD';
CREATE INDEX "OperatorAuditLog_createdAt_id_idx"
  ON "OperatorAuditLog"("createdAt", "id");
```

Generate both new tables and the indexes declared above in the migration. Keep `OperatorAuditExport.backgroundJobId` unique but without a foreign key; keep `requestedByUserId` as `ON DELETE SET NULL`.

- [ ] **Step 9: Implement env and ACCOUNT query invariants**

Add every approved configuration key to `envSchema`. Export and maintenance gates default to `false` in every environment. In `superRefine`, enforce:

```ts
if (env.OPERATOR_AUDIT_EXPORT_LEASE_MS >= env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS) {
  context.addIssue({
    code: 'custom',
    path: ['OPERATOR_AUDIT_EXPORT_LEASE_MS'],
    message: 'export lease must be shorter than BullMQ lock',
  });
}

if (env.OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS <= env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS) {
  context.addIssue({
    code: 'custom',
    path: ['OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS'],
    message: 'stale repair must be longer than BullMQ lock',
  });
}

if (env.OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS >= env.OPERATOR_AUDIT_EXPORT_STALE_AFTER_MS) {
  context.addIssue({
    code: 'custom',
    path: ['OPERATOR_AUDIT_EXPORT_QUERY_TIMEOUT_MS'],
    message: 'query timeout must be shorter than stale repair threshold',
  });
}

if (
  env.OPERATOR_AUDIT_EXPORT_ENABLED === true &&
  env.SERVER_ROLE !== 'api' &&
  (!env.OUTBOX_DISPATCHER_ENABLED ||
    env.OPERATOR_AUDIT_MAINTENANCE_ENABLED !== true)
) {
  context.addIssue({
    code: 'custom',
    path: ['OPERATOR_AUDIT_EXPORT_ENABLED'],
    message:
      'worker export requires outbox dispatcher and audit maintenance',
  });
}

if (
  env.NODE_ENV === 'production' &&
  env.OPERATOR_AUDIT_ENABLED === true &&
  !env.OPERATOR_AUDIT_FINGERPRINT_SECRET
) {
  context.addIssue({
    code: 'custom',
    path: ['OPERATOR_AUDIT_FINGERPRINT_SECRET'],
    message: 'production operator audit requires an HMAC secret',
  });
}
```

Give non-production `parseEnv()` a clearly local fallback HMAC secret; never log it. Add `scope: 'ACCOUNT'` to every create/find/count/update/list/summary `BackgroundJobsService` operation while preserving required `userId: string` method signatures. Do not expose scope in account DTOs.

- [ ] **Step 10: Add database e2e coverage for delete semantics**

Create `apps/server/test/background-job-scope.e2e-spec.ts` using `PrismaService` and isolated users. It must assert:

```ts
expect(accountJobAfterUserDelete).toBeNull();
expect(systemJobAfterRequesterDelete).toMatchObject({
  scope: 'SYSTEM',
  userId: null,
});
expect(exportAfterRequesterDelete).toMatchObject({
  requestedByUserId: null,
  backgroundJobId: systemJob.id,
});
```

Also use `$executeRawUnsafe` only in test cleanup, never in production query construction.

- [ ] **Step 11: Run GREEN persistence verification**

```powershell
$env:POSTGRES_PORT='5433'
bun --cwd packages/database prisma:generate
bun packages/database/scripts/prisma-with-root-env.mjs migrate deploy
bun --cwd packages/database test
bun --filter @repo/server test -- env background-jobs --runInBand
bun --filter @repo/server test:e2e -- background-job-scope.e2e-spec.ts
bun --filter @repo/server build
```

Expected: migration applies, Prisma generation/typecheck passes, named unit/e2e tests PASS, and server build exits 0.

- [ ] **Step 12: Synchronize phase docs**

Update `AGENTS.md`, `DEVLOG.md`, and `docs/roadmap.md` to mark Phase 7.23.2 complete and state:

- Contract/schema exists, but no export request is delivered to BullMQ yet.
- ACCOUNT jobs still cascade with the user; SYSTEM jobs have `userId=null` and remain after requester deletion.
- Production export/maintenance remain disabled.
- 回顾时可以问：“为什么 SYSTEM BackgroundJob 不能复用账号级 userId 归属？”

- [ ] **Step 13: Verify, commit, merge, and reverify on main**

```powershell
git diff --check
git add packages/types packages/database apps/server/src/config apps/server/src/background-jobs apps/server/test/background-job-scope.e2e-spec.ts AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(operator): add audit export contract and persistence"
git switch main
git merge --no-ff codex/phase-7-23-2-contract-schema -m "merge: phase 7.23.2 audit export contract"
bun test packages/types/tests/operator-audit-export.test.mts
bun --filter @repo/server test -- env background-jobs --runInBand
bun --filter @repo/server build
git diff --check HEAD^1..HEAD
```

Expected: one feature commit, one merge commit, and the same focused checks pass on `main`.

---

## Task 2: Phase 7.23.3 Transactional Outbox and BullMQ Dispatch

**Branch:** `codex/phase-7-23-3-transactional-delivery`

**Files:**
- Create: `apps/server/src/operator-audit-exports/operator-audit-export.constants.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-request.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-request.service.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export.controller.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export.controller.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts`
- Create: `apps/server/src/outbox/operator-audit-export-requested.handler.ts`
- Create: `apps/server/src/outbox/operator-audit-export-requested.handler.spec.ts`
- Modify: `apps/server/src/outbox/outbox.service.ts`
- Modify: `apps/server/src/outbox/outbox.service.spec.ts`
- Modify: `apps/server/src/outbox/outbox.handlers.ts`
- Modify: `apps/server/src/outbox/outbox.module.ts`
- Modify: `apps/server/src/operator-audit/operator-audit.service.ts`
- Modify: `apps/server/src/operator-audit/operator-audit.service.spec.ts`
- Modify: `apps/server/src/app.module.ts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Branch from the newly verified main**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-3-transactional-delivery
```

- [ ] **Step 2: Write RED transaction and idempotency tests**

In `operator-audit-export-request.service.spec.ts`, use a transaction mock that records operations in order. Cover success, rollback propagation, idempotent replay, conflict, range/retention/future validation, per-admin active/hourly quotas, global active quota, and no direct queue dependency. The success assertion must be exact:

```ts
expect(operationOrder).toEqual([
  'retention-lock',
  'quota-lock',
  'database-now',
  'export-create',
  'background-job-create',
  'outbox-create',
  'audit-create',
]);
expect(createdBackgroundJob).toMatchObject({
  scope: 'SYSTEM',
  userId: null,
  resourceType: 'OPERATOR_AUDIT_EXPORT',
  resourceId: createdExport.id,
});
expect(createdOutbox).toMatchObject({
  type: 'operator.audit.export.requested',
  aggregateType: 'OperatorAuditExport',
  aggregateId: createdExport.id,
  idempotencyKey: `operator-audit-export-requested:${createdExport.id}`,
  payload: {
    exportId: createdExport.id,
    backgroundJobId: createdBackgroundJob.id,
  },
});
expect(queue.add).not.toHaveBeenCalled();
```

For same `clientRequestId`/same hash, return the existing DTO without a second audit. For different hash, expect `OPERATOR_AUDIT_EXPORT_IDEMPOTENCY_CONFLICT`/409.

- [ ] **Step 3: Write RED strict audit and transaction-aware Outbox tests**

The new tests assert all of these concrete boundaries:

```ts
await expect(
  operatorAudit.recordSuccessStrict(transaction, input),
).rejects.toThrow('database down');

await expect(operatorAudit.recordSuccess(input)).resolves.toBeUndefined();
expect(saved.ipAddressHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
expect(saved.userAgentHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);

await outbox.enqueueInTransaction(transaction, safeEvent);
expect(transaction.outboxEvent.create).toHaveBeenCalledTimes(1);
expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
```

Keep the existing Outbox requeue audit failure test unchanged to guard the best-effort boundary.

- [ ] **Step 4: Run RED service verification**

```powershell
bun --filter @repo/server test -- operator-audit-export-request operator-audit.service outbox.service --runInBand
```

Expected: FAIL because strict transaction methods and request service do not exist.

- [ ] **Step 5: Add transaction-aware persistence methods**

In `OutboxService`, preserve `enqueue()` and add:

```ts
async enqueueInTransaction(
  transaction: Prisma.TransactionClient,
  input: EnqueueOutboxEventInput,
) {
  return this.createWithClient(transaction, input);
}

private async createWithClient(
  client: Prisma.TransactionClient | PrismaService,
  input: EnqueueOutboxEventInput,
) {
  return client.outboxEvent.create({
    data: {
      type: input.type,
      status: 'PENDING',
      aggregateType: input.aggregateType ?? null,
      aggregateId: input.aggregateId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      payload: input.payload,
      payloadHash: input.payloadHash ?? null,
      maxAttempts: input.maxAttempts ?? 5,
      nextRunAt: input.nextRunAt,
    },
  });
}
```

The public non-transactional `enqueue()` retains its current unique-key recovery. The strict transactional method does not catch errors or read through the root Prisma client.

In `OperatorAuditService`, inject `ConfigService<ServerEnv, true>`, replace new-source SHA-256 with:

```ts
function hmacValue(value: string | undefined, secret: string) {
  if (!value) return undefined;
  return `hmac-sha256:${createHmac('sha256', secret)
    .update(value)
    .digest('hex')}`;
}
```

Replace its local action union with the shared `OperatorAuditAction` type so strict request/download writes accept `AUDIT_EXPORT_REQUEST` and `AUDIT_EXPORT_DOWNLOAD` without widening to arbitrary strings.

Add `recordSuccessStrict(client: PrismaService | Prisma.TransactionClient, input)` that directly creates the sanitized row and throws on persistence failure. The export request passes its transaction client; download later passes the root Prisma service. Keep `recordSuccess()` and `recordFailure()` wrapping strict persistence in the existing warning-only path.

- [ ] **Step 6: Implement atomic request creation**

Use explicit `randomUUID()` values before entering the transaction. The service signature is:

```ts
async create(
  actorUserId: string,
  input: OperatorAuditExportCreateRequest,
  request?: AuditRequest,
): Promise<OperatorAuditExportDetailResponse>
```

Inside a `Serializable` interactive transaction:

```ts
await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(
    hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0)
  )
`;
await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(
    hashtextextended(${OPERATOR_AUDIT_EXPORT_QUOTA_LOCK}, 0)
  )
`;
const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`
  SELECT clock_timestamp() AS now
`;
```

Normalize all timestamps to `Date.toISOString()`, trim filters/reason, and compute:

```ts
const requestHash = `sha256:${createHash('sha256')
  .update(JSON.stringify(normalizedRequest))
  .digest('hex')}`;
```

Check idempotency before quotas. Validate `startAt < endAt`, at most configured 31 days, `startAt >= databaseNow - retentionDays`, and `endAt <= databaseNow`. Count `QUEUED|PROCESSING` per actor and globally and count the actor's previous-hour requests. Then create export, SYSTEM job, Outbox event, and strict `AUDIT_EXPORT_REQUEST` row in the same transaction. Return a DTO with `canDownload=false`; never return `requestHash`.

- [ ] **Step 7: Add guarded POST controller**

The controller guard order must be:

```ts
@Controller('operator-audit-exports')
@UseGuards(
  OperatorAuditEnabledGuard,
  OperatorAuditExportEnabledGuard,
  JwtAuthGuard,
  OperatorGuard,
)
```

Implement:

```ts
@Post()
@HttpCode(HttpStatus.ACCEPTED)
async create(
  @CurrentUser() user: AuthenticatedUser,
  @Body() body: unknown,
  @Req() request: Request,
) {
  return this.requestService.create(
    user.id,
    operatorAuditExportCreateRequestSchema.parse(body),
    request,
  );
}
```

`OperatorAuditExportEnabledGuard` reads `OPERATOR_AUDIT_EXPORT_ENABLED` and throws 404 before authentication when false. Add Swagger `202`, `400`, `409`, and `429` descriptions with safe sample ids only.

- [ ] **Step 8: Write RED dispatcher handler tests**

Cover safe payload validation, missing/mismatched facts, `QUEUED` enqueue, existing BullMQ job idempotency, `PROCESSING/READY` delivered success, `FAILED/EXPIRED` stale no-op, and Redis failure propagation. Assert exact queue options:

```ts
expect(queue.add).toHaveBeenCalledWith(
  'generate-operator-audit-export',
  { exportId: 'export_1', backgroundJobId: 'job_1' },
  {
    jobId: 'job_1',
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 172800, count: 1000 },
    removeOnFail: { age: 604800, count: 3000 },
  },
);
```

- [ ] **Step 9: Implement injectable export handler**

Create an injectable class whose bound arrow handler preserves `this`:

```ts
@Injectable()
export class OperatorAuditExportRequestedHandler {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OPERATOR_AUDIT_EXPORT_QUEUE)
    private readonly queue: Queue,
  ) {}

  readonly handle: OutboxEventHandler = async (event) => {
    const payload = operatorAuditExportRequestedPayloadSchema.parse(
      event.payload,
    );
    const [auditExport, backgroundJob] = await Promise.all([
      this.prisma.operatorAuditExport.findUnique({
        where: { id: payload.exportId },
      }),
      this.prisma.backgroundJob.findUnique({
        where: { id: payload.backgroundJobId },
      }),
    ]);
    assertLinkedSystemFacts(auditExport, backgroundJob, payload);
    if (auditExport.status === 'FAILED' || auditExport.status === 'EXPIRED') {
      return;
    }
    if (
      (auditExport.status === 'PROCESSING' || auditExport.status === 'READY') &&
      (backgroundJob.status === 'ACTIVE' ||
        backgroundJob.status === 'SUCCEEDED')
    ) {
      return;
    }
    if (await this.queue.getJob(backgroundJob.id)) return;
    await this.queue.add(
      GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
      payload,
      exportQueueOptions(backgroundJob.id),
    );
  };
}
```

Register the queue in `OutboxModule`. Replace the `useValue: outboxHandlers` provider with a factory that combines the existing knowledge handler and `operator.audit.export.requested` handler. A missing/mismatched fact throws `OutboxHandlerError('OUTBOX_INVALID_PAYLOAD', ...)`, allowing the existing Dispatcher retry/dead-letter state machine to operate.

- [ ] **Step 10: Run GREEN transaction/dispatcher verification**

```powershell
bun --filter @repo/server test -- operator-audit-export-request operator-audit-export.controller operator-audit-export-requested operator-audit.service outbox --runInBand
bun --cwd apps/server eslint src/operator-audit-exports src/operator-audit src/outbox
bun --filter @repo/server build
```

Expected: all focused tests PASS, lint exits 0, and build exits 0.

- [ ] **Step 11: Synchronize phase docs**

Mark Phase 7.23.3 complete and document that PostgreSQL commit is now the request success boundary; API never calls `queue.add`; Dispatcher is the only Redis bridge; DEAD remains recoverable for 24 hours; request audit is strict while requeue audit remains best-effort. Add: “回顾时可以问：事务型 Outbox 如何消除 PostgreSQL 成功但 Redis enqueue 失败的双写窗口？”

- [ ] **Step 12: Commit, merge, and main revalidation**

```powershell
git diff --check
git add apps/server/src/operator-audit-exports apps/server/src/outbox apps/server/src/operator-audit apps/server/src/app.module.ts AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(operator): deliver audit exports through outbox"
git switch main
git merge --no-ff codex/phase-7-23-3-transactional-delivery -m "merge: phase 7.23.3 transactional audit export delivery"
bun --filter @repo/server test -- operator-audit-export-request operator-audit-export-requested outbox --runInBand
bun --filter @repo/server build
git diff --check HEAD^1..HEAD
```

---

## Task 3: Phase 7.23.4 ZIP Worker and Attempt-Fenced MinIO Storage

**Branch:** `codex/phase-7-23-4-audit-export-worker`

**Files:**
- Modify: `apps/server/package.json`
- Modify: `bun.lock`
- Create: `apps/server/src/operator-audit-exports/jobs/generate-operator-audit-export.job.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-state.repository.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-state.repository.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-csv.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-csv.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-archive.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-archive.service.spec.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-export.processor.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-export.processor.spec.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-export-delay.integration.spec.ts`
- Modify: `apps/server/src/uploads/storage.service.ts`
- Modify: `apps/server/src/uploads/storage.service.spec.ts`
- Modify: `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Branch from main and install mature stream libraries**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-4-audit-export-worker
bun add --cwd apps/server csv-stringify archiver
bun add --cwd apps/server --dev @types/archiver unzipper @types/unzipper
```

Expected: branch is created from clean `main`; `apps/server/package.json` and `bun.lock` contain the production CSV/ZIP writers and test-only ZIP reader/types. Do not hand-roll CSV quoting or ZIP file structures.

- [ ] **Step 2: Define the strict BullMQ job payload**

Create `jobs/generate-operator-audit-export.job.ts`:

```ts
import { z } from 'zod';

import {
  GENERATE_OPERATOR_AUDIT_EXPORT_JOB,
  OPERATOR_AUDIT_EXPORT_QUEUE,
} from '../operator-audit-export.constants';

export { GENERATE_OPERATOR_AUDIT_EXPORT_JOB, OPERATOR_AUDIT_EXPORT_QUEUE };

export const generateOperatorAuditExportPayloadSchema = z
  .object({
    exportId: z.string().min(1),
    backgroundJobId: z.string().min(1),
  })
  .strict();

export type GenerateOperatorAuditExportPayload = z.infer<
  typeof generateOperatorAuditExportPayloadSchema
>;
```

- [ ] **Step 3: Write RED state-machine tests**

Test `claim`, `renewLease`, `markRetryable`, `markFailed`, and `markReady`. Cover a fresh QUEUED claim, expired PROCESSING lease reclaim, busy live lease, mismatched job facts, and zombie-token rejection. The key assertions are:

```ts
expect(await repository.claim({ exportId: 'export_1', backgroundJobId: 'job_1' })).toEqual({
  kind: 'claimed',
  processingToken: expect.any(String),
  leaseExpiresAt: new Date('2026-07-10T00:05:00.000Z'),
  auditExport: expect.objectContaining({ status: 'PROCESSING' }),
});

expect(await repository.claim(busyInput)).toEqual({
  kind: 'busy',
  leaseExpiresAt: new Date('2026-07-10T00:04:00.000Z'),
});

expect(await repository.markReady({
  exportId: 'export_1',
  backgroundJobId: 'job_1',
  processingToken: 'old-token',
  objectKey: 'operator-audit-exports/export_1/attempts/old-token.zip',
  fileName: 'safe.zip',
  archiveSize: 1024,
  recordCount: 3,
  csvSha256: `sha256:${'a'.repeat(64)}`,
  archiveSha256: `sha256:${'b'.repeat(64)}`,
})).resolves.toEqual({ kind: 'lost-lease' });
```

Assert export and SYSTEM job updates occur inside the same transaction for every state transition.

- [ ] **Step 4: Run RED state verification**

```powershell
bun --filter @repo/server test -- operator-audit-export-state --runInBand
```

Expected: FAIL because the repository does not exist.

- [ ] **Step 5: Implement token/lease state transitions**

Use this result union and public surface:

```ts
export type ExportClaimResult =
  | {
      kind: 'claimed';
      processingToken: string;
      leaseExpiresAt: Date;
      auditExport: OperatorAuditExport;
    }
  | { kind: 'busy'; leaseExpiresAt: Date }
  | { kind: 'stale' };

async claim(input: {
  exportId: string;
  backgroundJobId: string;
}): Promise<ExportClaimResult>;
async renewLease(input: TokenInput): Promise<boolean>;
async markRetryable(input: TokenInput & FailureInput): Promise<boolean>;
async markFailed(input: TokenInput & FailureInput): Promise<boolean>;
async markReady(input: TokenInput & ReadyInput): Promise<
  { kind: 'ready'; expiresAt: Date } | { kind: 'lost-lease' }
>;
```

Every method obtains database time with `clock_timestamp()`. `claim()` first reads linked export/job in a transaction, returns busy when `PROCESSING.leaseExpiresAt > now`, and uses `updateMany` predicates that match the old state before updating both facts. `markReady()` calculates `expiresAt = databaseNow + TTL`, updates only `status=PROCESSING AND processingToken=<current>`, and updates the SYSTEM BackgroundJob to SUCCEEDED in the same transaction. Retry/failure clears token and lease. Store only `sanitizeJobError(error).slice(0, 240)`.

- [ ] **Step 6: Write RED CSV security tests**

Cover UTF-8 BOM, fixed header order, empty rows, Chinese, comma/quote/newline, null cells, and formula bypasses. Include these cases:

```ts
const dangerous = [
  '=1+1',
  ' +SUM(A1:A2)',
  '\t-HYPERLINK("https://example.invalid")',
  '\r@SUM(1,1)',
  '\u00a0=CMD()',
  '\u3000+CMD()',
];
for (const value of dangerous) {
  assert.match(sanitizeOperatorAuditCsvCell(value), /^'/);
}
assert.equal(sanitizeOperatorAuditCsvCell('ordinary text'), 'ordinary text');
```

Also assert that `Bearer secret-token`, `Cookie: refresh=secret`, and `QWEN_API_KEY=secret` never appear in serialized bytes.

- [ ] **Step 7: Implement fixed CSV projection and sanitizer**

Export exactly these columns:

```ts
export const OPERATOR_AUDIT_CSV_COLUMNS = [
  'id',
  'actorUserId',
  'action',
  'status',
  'targetType',
  'targetId',
  'reason',
  'requestId',
  'ipAddressHash',
  'userAgentHash',
  'errorCode',
  'errorPreview',
  'createdAt',
] as const;
```

Implement the sanitizer in this order: existing secret sanitizer, formula detection against `trimStart()`, CRLF normalization, disallowed-control removal, single-quote prefix, then `csv-stringify` quoting. Preserve legitimate embedded newlines. Write BOM bytes `EF BB BF`, use `record_delimiter: '\r\n'`, encode null as `''`, and always end with a newline. Formula detection must run before removing tab/CR control prefixes.

- [ ] **Step 8: Write RED archive tests**

Use a temp directory and fake Prisma transaction. Assert:

- query isolation is `RepeatableRead` and executes `SET TRANSACTION READ ONLY` plus a validated numeric `SET LOCAL statement_timeout`;
- query uses `createdAt ASC, id ASC`, `createdAt >= startAt`, and `createdAt <= min(endAt, snapshotAt)`;
- select explicitly sets `metadata: false` and only includes the 13 DTO fields;
- page size is 1,000 and both pre-count and streamed count enforce 50,000;
- ZIP contains only `records.csv` and `manifest.json`;
- manifest v1 has every required key, including null filters;
- CSV and archive hashes match actual bytes;
- zero records creates a valid package;
- archive >64 MiB and insufficient temp disk produce non-retryable safe errors;
- `finally` removes `prepmind-audit-export-<exportId>-<token>`.

- [ ] **Step 9: Implement the archive builder**

Use this result type:

```ts
export type OperatorAuditArchiveResult = {
  filePath: string;
  fileName: string;
  archiveSize: number;
  recordCount: number;
  csvSha256: `sha256:${string}`;
  archiveSha256: `sha256:${string}`;
  queryStartedAt: Date;
  queryFinishedAt: Date;
  effectiveEndAt: Date;
  cleanup: () => Promise<void>;
};
```

The builder creates a `0700` directory and `0600` files below `os.tmpdir()`. Before writing, call `statfs()` and require free bytes greater than `2 * OPERATOR_AUDIT_EXPORT_MAX_ARCHIVE_BYTES`. In the interactive transaction:

```ts
await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
await tx.$executeRawUnsafe(
  `SET LOCAL statement_timeout = ${validatedQueryTimeoutMs}`,
);
```

The timeout value comes only from validated numeric config; never interpolate user input. Stream pages to `csv-stringify`, compute CSV SHA-256 over final bytes including BOM, write manifest with `JSON.stringify(manifest, null, 2) + '\n'`, and use `archiver('zip', { zlib: { level: 9 } })`. Pipe ZIP output through a byte-counting transform that throws `OPERATOR_AUDIT_EXPORT_ARCHIVE_TOO_LARGE` after the configured maximum while updating archive SHA-256.

Construct manifest v1 with every key present, using JSON null rather than omission:

```ts
const manifest = {
  schemaVersion: 1,
  exportId: auditExport.id,
  generatedAt: queryFinishedAt.toISOString(),
  queryStartedAt: queryStartedAt.toISOString(),
  queryFinishedAt: queryFinishedAt.toISOString(),
  effectiveEndAt: effectiveEndAt.toISOString(),
  requestedByUserId: auditExport.requestedByUserId,
  reason: auditExport.reason,
  snapshotAt: auditExport.snapshotAt.toISOString(),
  range: {
    startAt: auditExport.startAt.toISOString(),
    endAt: auditExport.endAt.toISOString(),
  },
  filters: {
    action: auditExport.filterAction,
    status: auditExport.filterStatus,
    targetType: auditExport.filterTargetType,
    targetId: auditExport.filterTargetId,
    actorUserId: auditExport.filterActorUserId,
  },
  recordCount,
  recordsFile: 'records.csv',
  recordsSha256: csvSha256,
};
```

Server file names use only dates and sanitized id:

```ts
prepmind-operator-audit-<YYYYMMDD>-<YYYYMMDD>-<first8SafeId>.zip
```

Do not include reason, actor, or target ids in the file name.

- [ ] **Step 10: Add export-only MinIO methods with RED/GREEN tests**

Add this exact public surface to `StorageService`:

```ts
async writeOperatorAuditExport(
  exportId: string,
  processingToken: string,
  filePath: string,
): Promise<string>;
async readOperatorAuditExport(objectKey: string): Promise<{
  stream: Readable;
  contentType: 'application/zip';
}>;
async deleteOperatorAuditExport(objectKey: string): Promise<void>;
async listOperatorAuditExportObjects(exportId: string): Promise<string[]>;
```

Add an internal `OperatorAuditExportStorageError` with `kind: 'missing' | 'unavailable'`. Map only MinIO `NoSuchKey` / `NoSuchObject` / HTTP 404 to `missing`; map all other dependency failures to `unavailable` without copying raw messages. Allow only `/^[A-Za-z0-9_-]{1,100}$/` ids/tokens and the exact key grammar `operator-audit-exports/<id>/attempts/<token>.zip`. Use `createReadStream` plus file size for `putObject`. `listObjectsV2(bucket, prefix, true)` must collect only keys that revalidate against the strict grammar. Missing object deletion is idempotent; no existing public upload/read method may accept the export prefix.

- [ ] **Step 11: Write and verify real BullMQ delayed semantics**

The integration spec uses a unique Redis queue, a real `Worker`, and a job whose processor does:

```ts
await job.moveToDelayed(Date.now() + 250, job.token);
throw new DelayedError();
```

Assert the job reaches `delayed`, `attemptsMade` remains `0`, then completes on the next delivery. This pins the behavior verified in BullMQ 5.79.2: `moveToDelayed()` passes `skipAttempt: true`, and Worker handles `DelayedError` without `moveToFailed()`.

```powershell
bun --filter @repo/server test -- operator-audit-export-delay.integration --runInBand
```

Expected: PASS with Docker Redis on `127.0.0.1:6379`. If the installed BullMQ version changes, stop and revalidate this contract before touching processor logic.

- [ ] **Step 12: Implement the single-concurrency processor**

Register:

```ts
@Processor(OPERATOR_AUDIT_EXPORT_QUEUE, {
  concurrency: Number(process.env.OPERATOR_AUDIT_EXPORT_WORKER_CONCURRENCY || 1),
  lockDuration: Number(process.env.OPERATOR_AUDIT_EXPORT_BULL_LOCK_MS || 600000),
})
```

Processor sequence:

1. Strictly parse the payload and claim linked facts.
2. On `stale`, return without file work.
3. On `busy`, call `job.moveToDelayed(leaseExpiresAt + 1000, job.token)` and throw `DelayedError`.
4. Start a renewal interval at `leaseMs / 3`; any failed renewal sets `lostLease=true`.
5. Build the archive inside REPEATABLE READ.
6. Recheck token, upload to the attempt-fenced key, and recheck token again.
7. Call `markReady()`; if CAS loses, delete only the current attempt key.
8. On retryable PostgreSQL/MinIO/filesystem error and remaining BullMQ attempts, mark both facts QUEUED then rethrow.
9. On non-retryable error or exhausted attempts, mark both facts FAILED with a safe code; rethrow only when BullMQ must record the final failure.
10. In `finally`, clear renewal and invoke archive cleanup; log only safe ids/codes.

Tests must prove an old token cannot select its object after a new token succeeds, and upload-success/DB-failure deletes the current key.

- [ ] **Step 13: Register role-bounded worker and run GREEN verification**

Add `BullModule.registerQueue({ name: OPERATOR_AUDIT_EXPORT_QUEUE })` to the export module. Register `OperatorAuditExportProcessor` only when `shouldRegisterWorkers()` is true. Then run:

```powershell
bun --filter @repo/server test -- operator-audit-export-state operator-audit-export-csv operator-audit-export-archive operator-audit-export.processor storage.service --runInBand
bun --filter @repo/server test -- operator-audit-export-delay.integration --runInBand
bun --cwd apps/server eslint src/operator-audit-exports src/uploads
bun --filter @repo/server build
```

Expected: all focused tests PASS, delayed integration PASS, lint and build exit 0.

- [ ] **Step 14: Synchronize docs and commit**

Mark Phase 7.23.4 complete. Explain REPEATABLE READ, formula injection defense, lease renewal, delayed retry without consuming attempts, fenced object keys, DB-selected key, and local plaintext cleanup. Add: “回顾时可以问：processing token 如何阻止失去 lease 的旧 Worker 覆盖新证据包？”

```powershell
git diff --check
git add apps/server/package.json bun.lock apps/server/src/operator-audit-exports apps/server/src/uploads AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(operator): generate fenced audit evidence archives"
git switch main
git merge --no-ff codex/phase-7-23-4-audit-export-worker -m "merge: phase 7.23.4 audit export worker"
bun --filter @repo/server test -- operator-audit-export-csv operator-audit-export-archive operator-audit-export.processor storage.service --runInBand
bun --filter @repo/server build
git diff --check HEAD^1..HEAD
```

Expected: focused worker/security checks pass again on `main`.

---

## Task 4: Phase 7.23.5 Retention, Maintenance, and Readiness

**Branch:** `codex/phase-7-23-5-audit-retention-maintenance`

**Files:**
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.scheduler.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.scheduler.spec.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.processor.ts`
- Create: `apps/server/src/operator-audit-exports/jobs/operator-audit-maintenance.processor.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-maintenance.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-maintenance.service.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-temp-janitor.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-temp-janitor.service.spec.ts`
- Modify: `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts`
- Modify: `packages/types/src/api/worker-readiness.ts`
- Modify: `packages/types/src/api/worker-observability.ts`
- Modify: `packages/types/tests/worker-readiness.test.mts`
- Modify: `packages/types/tests/worker-observability.test.mts`
- Modify: `apps/server/src/worker-observability/worker-observability.constants.ts`
- Modify: `apps/server/src/worker-observability/worker-heartbeat.service.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.service.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.module.ts`
- Modify: `apps/server/src/worker-readiness/worker-readiness.service.ts`
- Modify: `apps/server/src/worker-readiness/worker-readiness.module.ts`
- Modify: `apps/server/scripts/worker-readiness.ts`
- Modify: `apps/server/src/worker-readiness/worker-readiness.service.spec.ts`
- Modify: `apps/server/src/worker-readiness/worker-readiness-cli.spec.ts`
- Modify: `apps/server/src/worker-observability/worker-heartbeat.service.spec.ts`
- Modify: `apps/server/src/worker-observability/worker-observability.service.spec.ts`
- Modify: `apps/admin/src/app/worker/page.tsx`
- Create: `docker/minio/operator-audit-export-lifecycle.json`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Branch from verified main**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-5-audit-retention-maintenance
```

- [ ] **Step 2: Write RED maintenance tests**

Use database time in every case. Test the following exact state transitions:

```ts
expect(await service.expireReadyExports(now)).toEqual({ expired: 1, failed: 0 });
expect(storage.deleteOperatorAuditExport).toHaveBeenCalledWith(selectedObjectKey);
expect(storage.listOperatorAuditExportObjects).toHaveBeenCalledWith('export_1');
expect(prisma.operatorAuditExport.updateMany).toHaveBeenCalledWith({
  where: { id: 'export_1', status: 'READY', expiresAt: { lte: now } },
  data: { status: 'EXPIRED', objectKey: null, expiredAt: now },
});
```

Also cover:

- missing object deletion is idempotent and still reaches EXPIRED;
- MinIO list/delete failure keeps DB objectKey/status for later retry;
- orphan attempt objects on FAILED/EXPIRED exports are deleted by strict prefix;
- audit cutoff is `min(now-180d, oldest QUEUED/PROCESSING startAt)`;
- each 1,000-row batch acquires the retention advisory lock and recalculates cutoff;
- request transaction interleaving cannot pass validation then lose rows before commit;
- maximum batches stops one run deterministically;
- terminal export metadata older than 180 days is deleted only after prefix is empty;
- QUEUED + Outbox DEAD younger than 24h remains QUEUED;
- QUEUED + Outbox DEAD older than 24h updates export/job to FAILED with `DELIVERY_ABANDONED` in one transaction;
- PROCESSING older than 1h is not failed while BullMQ says active;
- stale PROCESSING with expired lease and non-active BullMQ job is failed safely;
- maintenance state records RUNNING then SUCCEEDED/FAILED with safe counters/previews.

- [ ] **Step 3: Run RED maintenance verification**

```powershell
bun --filter @repo/server test -- operator-audit-maintenance --runInBand
```

Expected: FAIL because maintenance service/scheduler/processor do not exist.

- [ ] **Step 4: Implement the bounded maintenance service**

Expose one orchestration method and focused internal phases:

```ts
async run(now?: Date): Promise<{
  expiredExportCount: number;
  deletedAuditCount: number;
  deletedExportCount: number;
}>;

private expireReadyExports(now: Date): Promise<number>;
private cleanOrphanObjects(now: Date): Promise<number>;
private repairAbandonedExports(now: Date): Promise<number>;
private deleteAuditBatch(): Promise<number>;
private deleteTerminalExportBatch(): Promise<number>;
```

`deleteAuditBatch()` runs in a new short transaction for every batch:

```ts
await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(
    hashtextextended(${OPERATOR_AUDIT_RETENTION_LOCK}, 0)
  )
`;
const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`
  SELECT clock_timestamp() AS now
`;
const oldestActive = await tx.operatorAuditExport.findFirst({
  where: { status: { in: ['QUEUED', 'PROCESSING'] } },
  orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
  select: { startAt: true },
});
const baseCutoff = subDays(clock.now, retentionDays);
const effectiveCutoff = oldestActive
  ? minDate(baseCutoff, oldestActive.startAt)
  : baseCutoff;
const ids = await tx.operatorAuditLog.findMany({
  where: { createdAt: { lt: effectiveCutoff } },
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  take: 1000,
  select: { id: true },
});
await tx.operatorAuditLog.deleteMany({
  where: { id: { in: ids.map(({ id }) => id) } },
});
```

Use a configured maximum of 20 batches per hourly run. No maintenance path creates an account BackgroundJob or OperatorAuditLog. All errors stored in maintenance state pass through `sanitizeJobError().slice(0, 240)`.

- [ ] **Step 5: Implement scheduler and processor**

Only `worker|both` with maintenance enabled registers these providers. On module init, use current BullMQ 5 scheduler API:

```ts
await queue.upsertJobScheduler(
  OPERATOR_AUDIT_MAINTENANCE_SCHEDULER,
  { every: 60 * 60 * 1000 },
  {
    name: MAINTAIN_OPERATOR_AUDIT_JOB,
    data: { schemaVersion: 1 },
    opts: {
      removeOnComplete: { age: 172800, count: 100 },
      removeOnFail: { age: 604800, count: 500 },
    },
  },
);
```

Register processor concurrency 1 and strict payload `{ schemaVersion: 1 }`. Processor calls only `maintenance.run()`; it never accepts actor/user/filter data.

- [ ] **Step 6: Write and implement crash janitor tests**

Create temp directories matching and not matching `prepmind-audit-export-<safeExportId>-<safeToken>`. Delete only when all are true:

1. name matches strict grammar;
2. DB export is absent or its current lease has expired and token is not current;
3. `queue.getJob(backgroundJobId)` is absent or not `active`;
4. recursive target resolves beneath `os.tmpdir()`.

Never delete by age alone. Run janitor on worker module init and after each maintenance run. A failed deletion logs ids only, never file content/path segments supplied by users.

- [ ] **Step 7: Write RED readiness contract tests**

Preserve `checks.queue` as the knowledge queue for backward compatibility and add:

```ts
checks: {
  redis,
  queue,
  auditExportQueue: queueCheck,
  auditMaintenanceQueue: queueCheck,
  workers,
  outbox,
  auditMaintenance: {
    status: 'pass' | 'warn' | 'fail',
    message: string,
    enabled: boolean,
    lastSucceededAt: string | null,
    overdue: boolean,
  },
}
```

Tests require `auditMaintenance.status='fail'` when enabled and more than two hourly intervals have elapsed since `lastSucceededAt`; a paused audit queue is not ready; failed audit jobs degrade readiness; disabled export/maintenance does not make an otherwise healthy knowledge worker fail.

- [ ] **Step 8: Extend heartbeat, readiness, observability, CLI, and Admin worker page**

Set heartbeat capabilities to:

```ts
export const WORKER_HEARTBEAT_QUEUE_NAMES = [
  'knowledge-document-processing',
  'operator-audit-export',
  'operator-audit-maintenance',
] as const;
```

Inject all three queues into readiness/observability services and modules. Collect each queue independently so one failed Redis call returns safe fail/warn signals without printing connection details. Read only `OperatorAuditMaintenanceState(name='operator-audit')`. Extend the CLI output with export/maintenance queue counts and maintenance freshness. Update `apps/admin/src/app/worker/page.tsx` with three queue cards plus one maintenance card; keep status text in addition to color.

- [ ] **Step 9: Add MinIO lifecycle and bounded temp volume**

Create `docker/minio/operator-audit-export-lifecycle.json` with a 2-day prefix expiration rule:

```json
{
  "Rules": [
    {
      "ID": "operator-audit-export-48h-backstop",
      "Status": "Enabled",
      "Filter": { "Prefix": "operator-audit-exports/" },
      "Expiration": { "Days": 2 },
      "NoncurrentVersionExpiration": { "NoncurrentDays": 2 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    },
    {
      "ID": "operator-audit-export-delete-markers",
      "Status": "Enabled",
      "Filter": { "Prefix": "operator-audit-exports/" },
      "Expiration": { "ExpiredObjectDeleteMarker": true }
    }
  ]
}
```

Add a `minio-init` service using `minio/mc` that runs the equivalent of the following fixed local-dev commands, with the JSON mounted read-only at `/config/operator-audit-export-lifecycle.json`:

```sh
mc alias set local http://minio:9000 minioadmin minioadmin
mc ready local
mc mb --ignore-existing local/prepmind-dev
mc ilm import local/prepmind-dev < /config/operator-audit-export-lifecycle.json
```

Make server/worker depend on successful init. Add worker tmpfs:

```yaml
tmpfs:
  - /tmp/prepmind-audit-exports:size=134217728,mode=0700
```

Add source-contract tests confirming the prefix rule, 2-day expiry, noncurrent cleanup, incomplete multipart cleanup, and tmpfs limit. Production versioned buckets must also validate delete-marker cleanup in deployment configuration; dev MinIO need not enable versioning.

- [ ] **Step 10: Run GREEN maintenance/readiness verification**

```powershell
bun test packages/types/tests/worker-readiness.test.mts packages/types/tests/worker-observability.test.mts
bun --filter @repo/server test -- operator-audit-maintenance operator-audit-export-temp-janitor worker-readiness worker-observability docker-compose-readiness --runInBand
bun --filter @repo/admin test
bun --cwd apps/server eslint src/operator-audit-exports src/worker-readiness src/worker-observability
bun --filter @repo/server build
bun --filter @repo/admin build
```

Expected: contract/unit/source tests PASS and both builds exit 0.

- [ ] **Step 11: Synchronize docs and commit**

Mark Phase 7.23.5 complete. Document 24h logical expiry, hourly physical cleanup, 48h lifecycle backstop, active-export watermark, per-batch advisory lock, DEAD 24h recovery, stale repair checks, crash janitor, and readiness freshness. Add: “回顾时可以问：活跃导出水位如何避免 180 天清理与长时间导出互相踩踏？”

```powershell
git diff --check
git add apps/server/src/operator-audit-exports apps/server/src/worker-readiness apps/server/src/worker-observability apps/server/scripts/worker-readiness.ts packages/types apps/admin/src/app/worker/page.tsx docker AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(operator): enforce audit retention maintenance"
git switch main
git merge --no-ff codex/phase-7-23-5-audit-retention-maintenance -m "merge: phase 7.23.5 audit retention maintenance"
bun --filter @repo/server test -- operator-audit-maintenance worker-readiness docker-compose-readiness --runInBand
bun --filter @repo/server build
bun --filter @repo/admin build
git diff --check HEAD^1..HEAD
```

---

## Task 5: Phase 7.23.6 Query, Detail, and Fail-Closed Download API

**Branch:** `codex/phase-7-23-6-audit-export-api`

**Files:**
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-query.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-query.service.spec.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-download.service.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-download.service.spec.ts`
- Modify: `apps/server/src/operator-audit-exports/operator-audit-export.controller.ts`
- Modify: `apps/server/src/operator-audit-exports/operator-audit-export.controller.spec.ts`
- Modify: `apps/server/src/operator-audit-exports/operator-audit-exports.module.ts`
- Modify: `apps/server/src/common/interceptors/response-envelope.interceptor.ts`
- Create: `apps/server/src/common/interceptors/response-envelope.interceptor.spec.ts`
- Modify: `apps/server/src/bootstrap/server-bootstrap.ts`
- Modify: `apps/server/src/bootstrap/server-bootstrap.spec.ts`
- Create: `apps/server/test/operator-audit-exports.e2e-spec.ts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Branch from verified main**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-6-audit-export-api
```

- [ ] **Step 2: Write RED query tests**

Test global admin visibility, safe projection, stable cursor, creation-time filters, and database-time `canDownload`. The select object must explicitly omit internals:

```ts
expect(findMany).toHaveBeenCalledWith({
  where: expect.any(Object),
  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  take: 21,
  select: expect.objectContaining({
    objectKey: false,
    requestHash: false,
    processingToken: false,
    leaseExpiresAt: false,
  }),
});
expect(result.items[0]).not.toHaveProperty('objectKey');
expect(result.items[0]).not.toHaveProperty('requestHash');
expect(result.items[0].canDownload).toBe(true);
```

Use cursor lookup by id to recover `createdAt`, then add the existing stable predicate:

```ts
OR: [
  { createdAt: { lt: cursor.createdAt } },
  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
]
```

No query adds `requestedByUserId=currentAdmin`; any guarded ADMIN may inspect another ADMIN's export.

- [ ] **Step 3: Implement safe query service**

Expose:

```ts
async list(
  query: OperatorAuditExportListQuery,
): Promise<OperatorAuditExportListResponse>;
async getDetail(id: string): Promise<OperatorAuditExportDetailResponse>;
```

Read database `clock_timestamp()` once per response. Map filter columns into the nested `filters` DTO. `canDownload` is true only when status is READY, `expiresAt > databaseNow`, and internal `objectKey`, `archiveSha256`, and `fileName` exist; use internals only to derive the boolean and never copy them to the DTO.

- [ ] **Step 4: Write RED download tests**

Cover not found, not READY, expired, missing object, successful cross-admin download, and strict audit failure. The success order is mandatory:

```ts
expect(operationOrder).toEqual([
  'load-export',
  'database-now',
  'open-minio-stream',
  'strict-download-audit',
  'return-stream',
]);
```

When strict audit fails:

```ts
await expect(service.download('downloading_admin', 'export_1', request)).rejects.toMatchObject({
  code: 'OPERATOR_AUDIT_EXPORT_AUDIT_FAILED',
  statusCode: 503,
});
expect(stream.destroy).toHaveBeenCalledTimes(1);
```

When object read fails, best-effort record FAILED download audit, CAS READY export to FAILED/`EXPORT_FILE_MISSING` only for confirmed not-found, and return safe 502 without raw MinIO error.

- [ ] **Step 5: Implement fail-closed download service**

Return an internal result, not a public DTO:

```ts
export type OperatorAuditExportDownload = {
  stream: Readable;
  fileName: string;
  archiveSize: number;
  archiveSha256: string;
};

async download(
  actorUserId: string,
  exportId: string,
  request?: AuditRequest,
): Promise<OperatorAuditExportDownload>;
```

Load the export by id, read database time, enforce READY and `expiresAt > now`, validate required internal file fields, then call `StorageService.readOperatorAuditExport(objectKey)`. Only after the stream opens, call:

```ts
await operatorAudit.recordSuccessStrict(prisma, {
  actorUserId,
  action: 'AUDIT_EXPORT_DOWNLOAD',
  targetType: 'OperatorAuditExport',
  targetId: exportId,
  reason: auditExport.reason,
  request,
  metadata: { source: 'http' },
});
```

`recordSuccessStrict` accepts `PrismaService | Prisma.TransactionClient`; it must not swallow the write error. On audit failure, destroy the opened stream and throw the safe 503. A successful audit means the server authorized and prepared the stream, not that the browser persisted every byte.

- [ ] **Step 6: Write RED interceptor and CORS tests**

Create interceptor tests with RxJS `lastValueFrom`:

```ts
const file = new StreamableFile(Readable.from(['zip']));
await expect(lastValueFrom(interceptor.intercept(context, handler(file)))).resolves.toBe(file);
await expect(lastValueFrom(interceptor.intercept(context, handler({ ok: true })))).resolves.toEqual({
  success: true,
  data: { ok: true },
  requestId: 'req_1',
});
```

Bootstrap tests must assert:

```ts
expect(app.enableCors).toHaveBeenCalledWith(
  expect.objectContaining({
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Content-SHA256'],
  }),
);
```

- [ ] **Step 7: Implement binary response boundary**

In the global interceptor:

```ts
map((data: unknown) => {
  if (data instanceof StreamableFile) return data;
  return {
    success: true,
    data,
    requestId: request.requestId ?? 'unknown',
  };
})
```

Add only the two approved exposed headers to CORS. Do not use a presigned URL.

- [ ] **Step 8: Extend the controller with list/detail/download**

Implement:

```ts
@Get()
list(@Query() query: unknown) {
  return this.queryService.list(operatorAuditExportListQuerySchema.parse(query));
}

@Get(':id')
detail(@Param('id') id: string) {
  return this.queryService.getDetail(id);
}

@Post(':id/download')
async download(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') id: string,
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
) {
  const file = await this.downloadService.download(user.id, id, request);
  response.setHeader('Content-Type', 'application/zip');
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${sanitizeDownloadFileName(file.fileName)}"`,
  );
  response.setHeader('Cache-Control', 'no-store, private');
  response.setHeader('X-Content-SHA256', file.archiveSha256);
  response.setHeader('Content-Length', String(file.archiveSize));
  return new StreamableFile(file.stream);
}
```

`sanitizeDownloadFileName` permits only `[A-Za-z0-9._-]`, strips CR/LF, and falls back to `prepmind-operator-audit-export.zip`. Swagger describes `application/zip` as the global JSON-envelope exception.

- [ ] **Step 9: Add API e2e security coverage**

Create admins A/B and a student through existing auth helpers. Seed one READY export with a StorageService override that returns a test ZIP stream. Assert:

- gate disabled -> 404 before authentication;
- gate enabled, no token -> 401;
- STUDENT -> 403 for create/list/detail/download;
- ADMIN B can download ADMIN A's READY export;
- response bytes begin with ZIP signature and body is not `{ success, data }` JSON;
- headers include `no-store`, safe filename, and SHA-256;
- download audit actor is ADMIN B;
- expired -> 410, FAILED/QUEUED -> 409, missing file -> 502;
- strict audit failure -> 503 and no bytes returned;
- list/detail JSON contains no objectKey, requestHash, processingToken, payload, metadata, secret, token, or cookie;
- legacy `sha256:` and new `hmac-sha256:` fingerprints are returned only as opaque correlation values.

- [ ] **Step 10: Run GREEN API verification**

```powershell
bun --filter @repo/server test -- operator-audit-export-query operator-audit-export-download operator-audit-export.controller response-envelope server-bootstrap --runInBand
bun --filter @repo/server test:e2e -- operator-audit-exports.e2e-spec.ts
bun --cwd apps/server eslint src/operator-audit-exports src/common/interceptors src/bootstrap
bun --filter @repo/server build
```

Expected: unit/e2e tests PASS, binary bypass is proven, lint/build exit 0.

- [ ] **Step 11: Synchronize docs and commit**

Mark Phase 7.23.6 complete. Document system-wide ADMIN visibility, stable cursor semantics, POST download, server-generated names, no-store headers, binary envelope bypass, strict download audit, stream destruction on audit failure, and the meaning of successful download audit. Add: “回顾时可以问：为什么下载必须在打开对象流之后、返回字节之前 fail-closed 写审计？”

```powershell
git diff --check
git add apps/server/src/operator-audit-exports apps/server/src/common/interceptors apps/server/src/bootstrap apps/server/test/operator-audit-exports.e2e-spec.ts AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(operator): add audited evidence download API"
git switch main
git merge --no-ff codex/phase-7-23-6-audit-export-api -m "merge: phase 7.23.6 audit export API"
bun --filter @repo/server test -- operator-audit-export-query operator-audit-export-download response-envelope --runInBand
bun --filter @repo/server test:e2e -- operator-audit-exports.e2e-spec.ts
bun --filter @repo/server build
git diff --check HEAD^1..HEAD
```

---

## Task 6: Phase 7.23.7 Admin Audit Evidence-Package UI

**Branch:** `codex/phase-7-23-7-admin-audit-evidence-ui`

**Files:**
- Modify: `apps/admin/src/lib/api-client.ts`
- Modify: `apps/admin/src/lib/api-client.test.mts`
- Create: `apps/admin/src/lib/operator-audit-export-api.ts`
- Create: `apps/admin/src/lib/operator-audit-export-api.test.mts`
- Create: `apps/admin/src/lib/operator-audit-export-view.ts`
- Create: `apps/admin/src/lib/operator-audit-export-view.test.mts`
- Modify: `apps/admin/src/app/audit/page.tsx`
- Create: `apps/admin/src/components/operator-audit-export-panel.tsx`
- Create: `apps/admin/src/lib/operator-audit-export-page-contract.test.mts`
- Modify: `apps/admin/src/lib/operator-audit-view.ts`
- Modify: `apps/admin/src/lib/operator-audit-view.test.mts`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Branch from verified main**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-7-admin-audit-evidence-ui
```

- [ ] **Step 2: Write RED binary client tests**

In `api-client.test.mts`, exercise an authenticated POST that returns Blob on success and parses the existing JSON error envelope on failure:

```ts
const result = await client.download('/operator-audit-exports/export_1/download', {
  accessToken: 'access-token',
});
assert.equal(result.blob.type, 'application/zip');
assert.equal(result.fileName, 'prepmind-operator-audit-export.zip');
assert.equal(result.sha256, `sha256:${'a'.repeat(64)}`);
assert.equal(fetchCall.init.method, 'POST');
assert.equal(fetchCall.init.headers.get('authorization'), 'Bearer access-token');

await assert.rejects(
  () => failedClient.download('/operator-audit-exports/export_1/download', {
    accessToken: 'access-token',
  }),
  (error: ApiClientError) => error.code === 'OPERATOR_AUDIT_EXPORT_EXPIRED',
);
```

- [ ] **Step 3: Implement dedicated Blob download**

Do not route binary through `request<T>()` or `response.json()`. Add:

```ts
async function download(path: string, options: ApiRequestOptions = {}) {
  const headers = new Headers(options.headers);
  if (options.accessToken) {
    headers.set('authorization', `Bearer ${options.accessToken}`);
  }
  const response = await fetchImpl(toUrl(baseUrl, path), {
    method: 'POST',
    headers,
    credentials: options.credentials ?? 'include',
  });
  if (!response.ok) {
    throw toApiClientError(await parseJson(response), response.status);
  }
  return {
    blob: await response.blob(),
    fileName: parseAttachmentFileName(
      response.headers.get('content-disposition'),
    ),
    sha256: response.headers.get('x-content-sha256'),
  };
}
```

`parseAttachmentFileName` accepts only `[A-Za-z0-9._-]` and otherwise returns `prepmind-operator-audit-export.zip`. Refactor the current JSON failure conversion into `toApiClientError` so normal JSON calls retain existing behavior.

- [ ] **Step 4: Write RED export API/view tests**

API tests must assert Zod parsing for create/list/detail and Blob download path. View tests cover:

- labels and non-color-only tones for QUEUED/PROCESSING/READY/FAILED/EXPIRED;
- polling true only for QUEUED/PROCESSING;
- range validation rejects missing dates, `startAt >= endAt`, and >31 days;
- READY enables download only when DTO `canDownload=true`;
- EXPIRED has no recovery/extend action;
- generated object URL is revoked after triggering download.

Use this helper signature:

```ts
export function getOperatorAuditExportPollInterval(
  items: OperatorAuditExportDetailResponse[] | undefined,
): 5000 | false;
```

- [ ] **Step 5: Implement typed export API and view helpers**

`operatorAuditExportApi` exposes:

```ts
create(input, accessToken): Promise<OperatorAuditExportDetailResponse>;
list(query, accessToken): Promise<OperatorAuditExportListResponse>;
detail(id, accessToken): Promise<OperatorAuditExportDetailResponse>;
download(id, accessToken): Promise<{
  blob: Blob;
  fileName: string;
  sha256: string | null;
}>;
```

All JSON responses pass their shared schema. Query parameters include only status/requester/created range/limit/cursor. Download calls the dedicated client method.

- [ ] **Step 6: Write RED page contract tests**

The source contract test must find:

```ts
assert.match(pageSource, /role="tablist"/);
assert.match(pageSource, /role="tab"/);
assert.match(pageSource, /role="tabpanel"/);
assert.match(exportPanelSource, /reason/);
assert.match(exportPanelSource, /31 天/);
assert.match(exportPanelSource, /50,000/);
assert.match(exportPanelSource, /operatorAuditExportApi\.download/);
assert.match(exportPanelSource, /aria-label="下载证据包"/);
assert.match(exportPanelSource, /aria-label="复制 ZIP SHA-256"/);
assert.doesNotMatch(exportPanelSource, /objectKey|processingToken|requestHash|payload|metadata/);
assert.doesNotMatch(exportPanelSource, /延长|恢复文件|编辑对象/);
```

- [ ] **Step 7: Refactor `/audit` into accessible tabs with shared filters**

Lift audit filters into `AdminAuditPage`:

```ts
type AuditFilterState = {
  action: OperatorAuditAction | 'ALL';
  status: OperatorAuditStatus | 'ALL';
  targetType: string;
  targetId: string;
  actorUserId: string;
};
```

Render a two-option segmented tab control labeled `审计记录` and `证据包`. Use stable `aria-controls`, `aria-selected`, keyboard ArrowLeft/ArrowRight/Home/End, and one visible tabpanel. Pass current filters into `OperatorAuditExportPanel` as defaults; do not duplicate a second card around the existing list/aside layout.

- [ ] **Step 8: Build the evidence package panel**

The panel contains:

1. A compact unframed request band with local `datetime-local` start/end, reason, and inherited filters.
2. A cursor-capable export list ordered newest first.
3. A fixed-width detail aside showing filters, reason, SYSTEM BackgroundJob id, record count, file size, hashes, timestamps, and safe error.

Mutation idempotency rules:

```ts
const requestId = pendingClientRequestId ?? crypto.randomUUID();
setPendingClientRequestId(requestId);
await operatorAuditExportApi.create(
  { ...normalizedForm, clientRequestId: requestId },
  accessToken,
);
```

Keep the same id after network/5xx failure so retry is idempotent. Clear it when any form field changes or after confirmed success. Disable submit while pending. On success select the QUEUED export; never label it generated/ready.

Polling uses TanStack Query `refetchInterval` and stops when no item is QUEUED/PROCESSING. READY shows a `Download` icon button and `Copy` icon button from Lucide with `aria-label` and `title`. Download creates an object URL, clicks a temporary `<a download>`, and always calls `URL.revokeObjectURL()` in `finally`. FAILED suggests narrowing the range; EXPIRED states the file is deleted and offers no recovery action.

- [ ] **Step 9: Run GREEN Admin verification**

```powershell
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
```

Expected: all Admin tests PASS, lint has no errors, and Next production build succeeds.

- [ ] **Step 10: Run browser acceptance at desktop sizes**

Start the Admin dev server when not already running, then use Playwright at `1440x900` and `1024x768` to verify:

- no overlapping filters, tabs, list, or detail panels;
- keyboard tabs work;
- reason/date errors are associated with their controls;
- long ids/hashes wrap without widening layout;
- QUEUED -> PROCESSING -> READY updates do not shift fixed list/detail tracks;
- download and copy buttons have accessible names/tooltips;
- forbidden internal fields never appear in DOM text.

Capture screenshots under `docs/acceptance/phase-7-23-7/` only if the repository's existing acceptance convention keeps them; otherwise record paths/results in DEVLOG without committing transient screenshots.

- [ ] **Step 11: Synchronize docs and commit**

Mark Phase 7.23.7 complete. Document tab behavior, inherited filters, idempotent request retry, active-only polling, status-specific actions, authenticated Blob download, and accessibility. Add: “回顾时可以问：前端为什么要在网络失败后复用 clientRequestId，而不是每次点击都生成新 UUID？”

```powershell
git diff --check
git add apps/admin/src AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "feat(admin): add audit evidence package workspace"
git switch main
git merge --no-ff codex/phase-7-23-7-admin-audit-evidence-ui -m "merge: phase 7.23.7 admin audit evidence UI"
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
git diff --check HEAD^1..HEAD
```

---

## Task 7: Phase 7.23.8 Docker Acceptance, Documentation, and Interview Blog

**Branch:** `codex/phase-7-23-8-audit-export-acceptance`

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/scripts/operator-audit-export-smoke.ts`
- Create: `apps/server/src/operator-audit-exports/operator-audit-export-smoke.spec.ts`
- Modify: `docker/docker-compose.dev.yml`
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`
- Modify: `docs/dev-start.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Create: `docs/blogs/operator-audit-retention-export.md`

- [ ] **Step 1: Branch from verified main and confirm Docker prerequisites**

```powershell
git switch main
git status --short
git switch -c codex/phase-7-23-8-audit-export-acceptance
docker version
docker compose version
docker compose -f docker/docker-compose.dev.yml --profile worker config --quiet
```

Expected: clean branch base, Docker daemon responds, and Compose config exits 0.

- [ ] **Step 2: Write RED Compose contract tests**

Extend `docker-compose-readiness.spec.ts` to assert:

```ts
expect(serverService).toContain('SERVER_ROLE: ${SERVER_ROLE:-api}');
expect(serverService).toContain('OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}');
expect(workerService).toContain('OUTBOX_DISPATCHER_ENABLED: ${OUTBOX_DISPATCHER_ENABLED:-true}');
expect(workerService).toContain('OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}');
expect(workerService).toContain('OPERATOR_AUDIT_MAINTENANCE_ENABLED: ${OPERATOR_AUDIT_MAINTENANCE_ENABLED:-true}');
expect(workerService).toContain('OPERATOR_AUDIT_FINGERPRINT_SECRET:');
expect(compose).toContain('minio-init:');
expect(workerService).toContain('/tmp/prepmind-audit-exports:size=134217728,mode=0700');
```

Also assert production Docker docs never reuse the checked-in local development HMAC secret.

- [ ] **Step 3: Finalize local Compose topology**

Set Docker `server` default role to `api`; the profile `worker` is the only processor in full-stack acceptance. Explicitly configure:

```yaml
server:
  environment:
    SERVER_ROLE: ${SERVER_ROLE:-api}
    OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}
    OPERATOR_AUDIT_FINGERPRINT_SECRET: ${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}

worker:
  environment:
    SERVER_ROLE: worker
    OUTBOX_DISPATCHER_ENABLED: ${OUTBOX_DISPATCHER_ENABLED:-true}
    OPERATOR_AUDIT_EXPORT_ENABLED: ${OPERATOR_AUDIT_EXPORT_ENABLED:-true}
    OPERATOR_AUDIT_MAINTENANCE_ENABLED: ${OPERATOR_AUDIT_MAINTENANCE_ENABLED:-true}
    OPERATOR_AUDIT_FINGERPRINT_SECRET: ${OPERATOR_AUDIT_FINGERPRINT_SECRET:-local-dev-audit-fingerprint-change-me}
```

Keep export and maintenance production defaults false in code. Compose is explicitly local development. Preserve `minio-init`, 48h lifecycle, and tmpfs from Phase 7.23.5.

- [ ] **Step 4: Add a deterministic API/queue smoke script with RED tests**

Add package script:

```json
"smoke:operator-audit-export": "ts-node -r tsconfig-paths/register scripts/operator-audit-export-smoke.ts"
```

The smoke config parser requires:

```text
OPERATOR_AUDIT_EXPORT_SMOKE_ADMIN_TOKEN
OPERATOR_AUDIT_EXPORT_SMOKE_STUDENT_TOKEN
```

and supports safe defaults:

```text
OPERATOR_AUDIT_EXPORT_SMOKE_BASE_URL=http://127.0.0.1:3001
OPERATOR_AUDIT_EXPORT_SMOKE_TIMEOUT_MS=120000
OPERATOR_AUDIT_EXPORT_SMOKE_KEEP_DATA=false
```

Unit-test missing tokens, invalid base URL, timeout bounds, and boolean parsing. Do not print tokens or full response bodies.

- [ ] **Step 5: Implement end-to-end smoke orchestration**

The script must:

1. POST a <=31-day request with `crypto.randomUUID()` and a synthetic reason.
2. Assert STUDENT list/create/download each return 403.
3. Poll detail every second until READY or terminal timeout; report only id/status/errorCode.
4. POST download and verify `application/zip`, no-store, safe filename, and header SHA-256 against downloaded bytes.
5. Open ZIP with `unzipper.Open.buffer`; require exactly `records.csv` and `manifest.json`.
6. Verify CSV begins with UTF-8 BOM and fixed header; parse manifest and compare export id, range, record count, and CSV SHA-256.
7. Query PostgreSQL for REQUEST/DOWNLOAD audit actions and verify the actual admin actor, without selecting metadata.
8. Set this synthetic export's `expiresAt` to database past time, enqueue one deterministic maintenance job, wait for EXPIRED, assert download returns 410, and assert MinIO object is absent.
9. Unless KEEP_DATA is true, delete only records whose export id/clientRequestId/reason match the synthetic run and remove any remaining strict export-prefix objects.

Use `try/finally` cleanup. The final output is bounded:

```text
Operator audit export smoke: PASS
export=<safe id> records=<count> requestAudit=1 downloadAudit=1 expired=true objectDeleted=true
```

On failure, print a safe stage/code and exit 1; never print token, cookie, object key, payload, metadata, response ZIP contents, or raw dependency errors.

- [ ] **Step 6: Run the complete branch verification gate**

```powershell
$env:POSTGRES_PORT='5433'
bun install --frozen-lockfile
bun test packages/types/tests/operator-audit-export.test.mts packages/types/tests/operator-audit.test.mts packages/types/tests/worker-readiness.test.mts packages/types/tests/worker-observability.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/database prisma:generate
bun packages/database/scripts/prisma-with-root-env.mjs migrate deploy
bun --cwd packages/database test
bun --filter @repo/server test -- operator-audit-export outbox background-jobs operator-audit worker-readiness worker-observability storage server-bootstrap response-envelope docker-compose-readiness --runInBand
bun --filter @repo/server test:e2e
bun --cwd apps/server eslint src/operator-audit-exports src/operator-audit src/outbox src/background-jobs src/worker-readiness src/worker-observability src/uploads src/common/interceptors src/bootstrap
bun --filter @repo/server build
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
git diff --check
```

Expected: all contract/unit/e2e tests PASS and every lint/typecheck/build exits 0.

- [ ] **Step 7: Run Docker full-stack acceptance**

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
docker compose -f docker/docker-compose.dev.yml --profile worker ps
docker compose -f docker/docker-compose.dev.yml --profile worker logs --tail 120 server worker minio-init
```

Expected:

- server, worker, web, admin, PostgreSQL, Redis, and MinIO are running;
- worker is `healthy`;
- minio-init exits 0 after lifecycle application;
- logs contain no secret/token/cookie/object payload and no startup invariant failure.

Prepare dedicated ADMIN/STUDENT test accounts through the existing auth flow, promote only the synthetic admin in local PostgreSQL, export access tokens to the smoke env variables, and run:

```powershell
bun --filter @repo/server smoke:operator-audit-export
```

Expected: `Operator audit export smoke: PASS`. Then manually verify `http://127.0.0.1:3100/audit` at 1440x900: request -> QUEUED/PROCESSING -> READY -> download -> REQUEST/DOWNLOAD records -> EXPIRED. Confirm STUDENT receives 403 and sees no Admin navigation.

- [ ] **Step 8: Verify quotas, idempotency, failure recovery, and cleanup**

Use focused API/test helpers rather than creating 50,001 real audit rows. Verify:

- same admin/id/hash returns same export and one request audit;
- same admin/id/different hash returns 409;
- third active request per admin and eleventh hourly request return 429;
- eleventh global active request returns 429;
- Redis unavailable leaves Outbox retryable and request facts durable;
- DEAD event remains requeueable inside 24h and becomes DELIVERY_ABANDONED after the window;
- 50,001 pre-count, 64 MiB byte counter, and low temp disk tests fail safely;
- maintenance removes synthetic MinIO objects and plaintext temp directories;
- Worker Readiness returns to its expected no-backlog state after cleanup.

Record commands and sanitized counts in DEVLOG. Do not preserve generated ZIPs in Git.

- [ ] **Step 9: Write operating documentation**

Update:

- `docs/dev-start.md`: gates, HMAC secret, API vs worker roles, Dispatcher dependency, lifecycle, tmpfs, queue names, migration, smoke command, troubleshooting, and cleanup.
- `docs/acceptance-checklist.md`: automated gate, Docker route, ADMIN/STUDENT matrix, ZIP/hash checks, 410 expiry, maintenance/readiness, and main revalidation.
- `README.md`: delivered capability and current Phase 7.23 status.
- `AGENTS.md`: authoritative data flow, non-goals, env defaults, fail-closed boundary, object lifecycle, queue topology, and no-presigned-URL rule.
- `DEVLOG.md`: each phase commit/merge, tests, Docker evidence, defects found/fixed, cleanup, and current next phase.
- `docs/roadmap.md`: mark Phase 7.23.2 through 7.23.8 complete and link spec, plan, blog, and acceptance section.

Each doc must answer why/what/how and include concrete commands, expected result, boundaries, and “回顾时可以问”.

- [ ] **Step 10: Write the interview-study blog**

Create `docs/blogs/operator-audit-retention-export.md` in conversational Chinese with these exact sections:

```markdown
# 从审计日志到可下载证据包：事务型 Outbox、租约 fencing 与保留水位

## 这篇文章解决什么问题
## 为什么不能直接导出数据库
## 三份事实为什么缺一不可
## 事务型 Outbox 如何消除 PostgreSQL 与 Redis 双写窗口
## Worker 如何用 lease、processing token 和 delayed retry 防止僵尸覆盖
## REPEATABLE READ、稳定游标与 manifest 能证明什么
## CSV 公式注入和敏感字段泄漏怎么防
## 24 小时下载、48 小时 lifecycle 与 180 天保留如何配合
## 为什么申请和下载 fail-closed，但 Outbox requeue 仍 best-effort
## 一次真实故障怎样恢复
## 面试时怎么讲
## 常见追问
## 还可以继续优化什么
## 回顾时可以问
```

Include small sanitized code snippets for atomic transaction, Outbox handler, token CAS, formula sanitizer, and retention watermark. State clearly that SHA-256 is integrity checking, not signing/non-repudiation; fingerprint is correlation data, not anonymous data; package is an engineering-consistent observation, not a legal database snapshot.

- [ ] **Step 11: Commit Phase 7.23.8 after branch acceptance**

```powershell
git diff --check
git status --short
git add apps/server/package.json apps/server/scripts/operator-audit-export-smoke.ts apps/server/src/operator-audit-exports/operator-audit-export-smoke.spec.ts docker apps/server/src/worker-readiness/docker-compose-readiness.spec.ts docs README.md AGENTS.md DEVLOG.md
git commit -m "docs(operator): close audit evidence export delivery"
git show --check --stat --oneline HEAD
```

Expected: one Phase 7.23.8 commit contains smoke/Compose acceptance support plus synchronized docs/blog; `git show --check` exits 0.

- [ ] **Step 12: Merge to main and repeat the complete acceptance gate**

```powershell
git switch main
git merge --no-ff codex/phase-7-23-8-audit-export-acceptance -m "merge: phase 7.23 audit retention and evidence export"
bun test packages/types/tests/operator-audit-export.test.mts packages/types/tests/worker-readiness.test.mts
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --filter @repo/server test -- operator-audit-export outbox background-jobs operator-audit worker-readiness storage response-envelope --runInBand
bun --filter @repo/server test:e2e
bun --filter @repo/server build
bun --filter @repo/admin test
bun --filter @repo/admin lint
bun --filter @repo/admin build
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio minio-init server worker web admin
bun --filter @repo/server smoke:operator-audit-export
docker compose -f docker/docker-compose.dev.yml --profile worker ps
git diff --check HEAD^1..HEAD
git status --short --branch
```

Expected: the same test/build/Docker/smoke evidence passes on merged `main`; worker is healthy; smoke data is cleaned; worktree is clean. Do not start any Phase 7.24 branch until this main verification is recorded in DEVLOG.

---

## Self-Review Checklist

- **Spec coverage:** Task 1 covers contract/schema/SYSTEM ownership; Task 2 covers atomic request and only-path Dispatcher delivery; Task 3 covers snapshot ZIP generation, fencing, lease, limits, and MinIO; Task 4 covers expiry, retention, repair, lifecycle, janitor, and readiness; Task 5 covers system-wide query and fail-closed binary download; Task 6 covers the accessible Admin workflow; Task 7 covers Docker, cleanup, docs, and interview study.
- **Reliability:** The plan never calls BullMQ from the request path, never lets Outbox replace the domain model, and never lets a stale processing token select an object.
- **Security:** Contract and e2e tests reject internal fields; CSV cells are sanitized before mature-library quoting; downloads are POST/no-store, server-named, ADMIN-only, and fail-closed audited.
- **Retention:** Request and every deletion batch share the advisory lock; active watermarks can only retain extra data temporarily; READY is logically unavailable after TTL even before physical cleanup.
- **Type consistency:** Queue/job/event names, `SYSTEM` scope, resource type, payload fields, processing token, DTO fields, hashes, and configuration names are identical across tasks.
- **Placeholder scan:** No deferred placeholders, vague test instructions, generic error-handling steps, or unnamed files remain. Every test step has a command and expected failure/pass boundary.
- **Workflow:** Every phase starts from verified `main`, has one implementation commit, synchronizes docs, merges `--no-ff`, and is reverified on `main` before the next branch.

## 回顾时可以问

- “为什么证据包同时需要 OperatorAuditExport、SYSTEM BackgroundJob 和 OutboxEvent？”
- “为什么 request audit 必须和 export/outbox 同事务，而 download audit 必须在打开对象流后写？”
- “BullMQ moveToDelayed + DelayedError 如何避免 live lease 重投消耗 attempts？”
- “attempt-fenced object key 和数据库 CAS 分别防住了哪一种僵尸 Worker？”
- “REPEATABLE READ、snapshotAt 和 manifest 为什么仍不能宣称法律级快照？”
- “活跃导出水位和 transaction advisory lock 如何一起保护 180 天清理边界？”
- “为什么 READY 过期后立即 410，但物理删除允许由小时任务和 48 小时 lifecycle 兜底？”
- “前端怎样保持 clientRequestId 重试幂等，又避免修改请求后误复用旧 id？”

---
