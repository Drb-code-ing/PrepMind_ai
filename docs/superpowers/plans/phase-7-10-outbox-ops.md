# Phase 7.10 Outbox Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-only, safety-first Outbox Ops surface for sanitized list/detail inspection and manual requeue of `FAILED` / `DEAD` outbox events.

**Architecture:** Define shared Zod contracts in `@repo/types`, add an `OUTBOX_OPS_ENABLED` env gate, implement `OutboxOpsService` for sanitized reads and compare-and-swap requeue, then expose guarded NestJS endpoints through `OutboxOpsController`. The first slice has no frontend and no destructive operations.

**Tech Stack:** TypeScript, Zod, NestJS 11, Prisma, Jest, Swagger decorators, Bun workspace.

---

## File Map

- Create `packages/types/src/api/outbox.ts`: shared request/response schemas and inferred types.
- Modify `packages/types/src/api/index.ts`: export the new outbox API contract.
- Modify `apps/server/src/config/env.ts`: add `OUTBOX_OPS_ENABLED` parsing and non-production default.
- Modify `apps/server/src/config/env.spec.ts`: cover default and explicit enablement behavior.
- Create `apps/server/src/outbox/outbox-ops.service.ts`: sanitized list/detail/requeue logic.
- Create `apps/server/src/outbox/outbox-ops.service.spec.ts`: unit coverage for mapping, filters, and state transitions.
- Create `apps/server/src/outbox/outbox-ops.controller.ts`: guarded HTTP surface.
- Create `apps/server/src/outbox/outbox-ops.controller.spec.ts`: guard/gate/controller behavior tests.
- Modify `apps/server/src/outbox/outbox.module.ts`: register/export ops service and controller.
- Modify `AGENTS.md`, `DEVLOG.md`, `docs/ai-behavior-acceptance.md`: record Phase 7.10 behavior and boundaries after implementation.

---

## Task 1: Add Shared Outbox API Contract

**Files:**
- Create: `packages/types/src/api/outbox.ts`
- Modify: `packages/types/src/api/index.ts`

- [ ] **Step 1: Write the contract file**

Create `packages/types/src/api/outbox.ts` with this content:

```ts
import { z } from 'zod';

export const outboxEventStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'DEAD',
]);

export const outboxEventListQuerySchema = z.object({
  status: outboxEventStatusSchema.optional(),
  type: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export const outboxEventListItemSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    status: outboxEventStatusSchema,
    attempts: z.number().int().min(0),
    maxAttempts: z.number().int().min(1),
    nextRunAt: z.string().datetime().nullable(),
    lockedAt: z.string().datetime().nullable(),
    processedAt: z.string().datetime().nullable(),
    lastErrorCode: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    hasPayload: z.boolean(),
    hasLastError: z.boolean(),
    canRequeue: z.boolean(),
  })
  .strict();

export const outboxEventDetailResponseSchema = outboxEventListItemSchema
  .extend({
    lockedBy: z.string().min(1).nullable(),
    lastErrorPreview: z.string().min(1).nullable(),
    payloadHash: z.string().min(1).nullable(),
  })
  .strict();

export const outboxEventListResponseSchema = z
  .object({
    items: z.array(outboxEventListItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const outboxEventRequeueRequestSchema = z
  .object({
    reason: z.string().trim().min(1).max(300).optional(),
  })
  .strict()
  .default({});

export type OutboxEventStatus = z.infer<typeof outboxEventStatusSchema>;
export type OutboxEventListQuery = z.infer<
  typeof outboxEventListQuerySchema
>;
export type OutboxEventListItem = z.infer<typeof outboxEventListItemSchema>;
export type OutboxEventDetailResponse = z.infer<
  typeof outboxEventDetailResponseSchema
>;
export type OutboxEventListResponse = z.infer<
  typeof outboxEventListResponseSchema
>;
export type OutboxEventRequeueRequest = z.infer<
  typeof outboxEventRequeueRequestSchema
>;
```

- [ ] **Step 2: Export the contract**

Add this line to `packages/types/src/api/index.ts`:

```ts
export * from './outbox';
```

- [ ] **Step 3: Verify types package**

Run:

```powershell
bun --cwd packages/types typecheck
```

Expected: exit code `0`.

- [ ] **Step 4: Commit**

```powershell
git add packages/types/src/api/outbox.ts packages/types/src/api/index.ts
git commit -m "feat(types): add outbox ops contract"
```

---

## Task 2: Add Outbox Ops Environment Gate

**Files:**
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/config/env.spec.ts`

- [ ] **Step 1: Write failing env tests**

Add these tests near the existing outbox dispatcher env tests in `apps/server/src/config/env.spec.ts`:

```ts
it('enables outbox ops by default outside production', () => {
  expect(parseEnv(requiredEnv).OUTBOX_OPS_ENABLED).toBe(true);

  expect(
    parseEnv({
      ...requiredEnv,
      NODE_ENV: 'test',
    }).OUTBOX_OPS_ENABLED,
  ).toBe(true);
});

it('disables outbox ops by default in production', () => {
  expect(
    parseEnv({
      ...requiredEnv,
      NODE_ENV: 'production',
    }).OUTBOX_OPS_ENABLED,
  ).toBe(false);
});

it('allows explicit outbox ops enablement overrides', () => {
  expect(
    parseEnv({
      ...requiredEnv,
      NODE_ENV: 'production',
      OUTBOX_OPS_ENABLED: 'true',
    }).OUTBOX_OPS_ENABLED,
  ).toBe(true);

  expect(
    parseEnv({
      ...requiredEnv,
      NODE_ENV: 'development',
      OUTBOX_OPS_ENABLED: 'false',
    }).OUTBOX_OPS_ENABLED,
  ).toBe(false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
bun --filter @repo/server test -- env
```

Expected: FAIL because `OUTBOX_OPS_ENABLED` is not parsed yet.

- [ ] **Step 3: Implement env parsing**

In `apps/server/src/config/env.ts`, add `OUTBOX_OPS_ENABLED` next to `OUTBOX_DISPATCHER_ENABLED`:

```ts
OUTBOX_OPS_ENABLED: z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim().length === 0) {
    return undefined;
  }

  return value;
}, booleanStringSchema.optional()),
```

Extend the `ServerEnv` type omission list:

```ts
export type ServerEnv = Omit<
  ParsedServerEnv,
  | 'SWAGGER_ENABLED'
  | 'WORKER_OBSERVABILITY_ENABLED'
  | 'OUTBOX_DISPATCHER_ENABLED'
  | 'OUTBOX_OPS_ENABLED'
> & {
  SWAGGER_ENABLED: boolean;
  WORKER_OBSERVABILITY_ENABLED: boolean;
  OUTBOX_DISPATCHER_ENABLED: boolean;
  OUTBOX_OPS_ENABLED: boolean;
};
```

Add the default in `parseEnv()`:

```ts
OUTBOX_OPS_ENABLED:
  env.OUTBOX_OPS_ENABLED ?? env.NODE_ENV !== 'production',
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- env
bun --cwd apps/server eslint src/config
```

Expected: env tests pass and lint exits `0`.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/config/env.ts apps/server/src/config/env.spec.ts
git commit -m "feat(server): add outbox ops env gate"
```

---

## Task 3: Implement Sanitized Outbox Ops Service

**Files:**
- Create: `apps/server/src/outbox/outbox-ops.service.ts`
- Create: `apps/server/src/outbox/outbox-ops.service.spec.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/server/src/outbox/outbox-ops.service.spec.ts`:

```ts
import { HttpStatus } from '@nestjs/common';

import { AppError } from '../common/errors/app-error';
import { OutboxOpsService } from './outbox-ops.service';

describe('OutboxOpsService', () => {
  const now = new Date('2026-07-07T10:00:00.000Z');
  const prisma = {
    outboxEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists sanitized outbox events without payload or aggregate id', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ id: 'evt_2', status: 'DEAD', lastError: 'Bearer secret-token' }),
    ]);

    const result = await createService().list({ limit: 20 });

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      select: expect.objectContaining({
        payload: true,
        aggregateId: false,
      }),
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'evt_2',
        hasPayload: true,
        hasLastError: true,
        canRequeue: true,
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain('secret-token');
    expect(JSON.stringify(result)).not.toContain('doc_1');
    expect(result.nextCursor).toBeNull();
  });

  it('applies status, type, and cursor filters', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([]);

    await createService().list({
      status: 'FAILED',
      type: 'knowledge.document.processing.requested',
      limit: 10,
      cursor: 'evt_9',
    });

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'FAILED',
          type: 'knowledge.document.processing.requested',
          id: { lt: 'evt_9' },
        },
        take: 11,
      }),
    );
  });

  it('returns nextCursor when there are more rows than the requested limit', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      row({ id: 'evt_3' }),
      row({ id: 'evt_2' }),
      row({ id: 'evt_1' }),
    ]);

    const result = await createService().list({ limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['evt_3', 'evt_2']);
    expect(result.nextCursor).toBe('evt_2');
  });

  it('returns sanitized event detail with redacted error preview', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({
        id: 'evt_1',
        status: 'DEAD',
        lastError: 'provider failed with Bearer secret-token-value',
      }),
    );

    const result = await createService().getDetail('evt_1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'evt_1',
        lastErrorPreview: 'provider failed with [redacted]',
        payloadHash: 'sha256:payload',
      }),
    );
    expect(JSON.stringify(result)).not.toContain('secret-token-value');
  });

  it('throws not found when detail row is missing', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue(null);

    await expect(createService().getDetail('missing')).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  });

  it('requeues failed and dead events to pending without executing handlers', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({ id: 'evt_1', status: 'PENDING', attempts: 0 }),
    );

    const result = await createService().requeue('evt_1', now);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt_1', status: { in: ['FAILED', 'DEAD'] } },
      data: {
        status: 'PENDING',
        attempts: 0,
        lockedAt: null,
        lockedBy: null,
        processedAt: null,
        nextRunAt: now,
      },
    });
    expect(result.status).toBe('PENDING');
    expect(result.canRequeue).toBe(false);
  });

  it('rejects requeue for non-requeueable statuses', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst.mockResolvedValue(
      row({ id: 'evt_1', status: 'PROCESSING' }),
    );

    await expect(createService().requeue('evt_1', now)).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_NOT_REQUEUEABLE',
      statusCode: HttpStatus.CONFLICT,
    });
  });

  it('returns conflict when requeue loses the transition race', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    prisma.outboxEvent.findFirst
      .mockResolvedValueOnce(row({ id: 'evt_1', status: 'DEAD' }))
      .mockResolvedValueOnce(row({ id: 'evt_1', status: 'DEAD' }));

    await expect(createService().requeue('evt_1', now)).rejects.toMatchObject({
      code: 'OUTBOX_EVENT_REQUEUE_CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  });

  function createService() {
    return new OutboxOpsService(prisma as never);
  }

  function row(
    overrides: Partial<{
      id: string;
      status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';
      attempts: number;
      lastError: string | null;
    }> = {},
  ) {
    return {
      id: overrides.id ?? 'evt_1',
      type: 'knowledge.document.processing.requested',
      status: overrides.status ?? 'FAILED',
      attempts: overrides.attempts ?? 3,
      maxAttempts: 5,
      nextRunAt: now,
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      lastErrorCode: 'OUTBOX_HANDLER_FAILED',
      lastError: overrides.lastError ?? 'provider failed',
      createdAt: now,
      updatedAt: now,
      payload: { documentId: 'doc_1' },
      payloadHash: 'sha256:payload',
    };
  }
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
bun --filter @repo/server test -- outbox-ops
```

Expected: FAIL because `OutboxOpsService` does not exist.

- [ ] **Step 3: Implement service**

Create `apps/server/src/outbox/outbox-ops.service.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import type { OutboxEventStatus, Prisma } from '@prisma/client';
import type {
  OutboxEventDetailResponse,
  OutboxEventListQuery,
  OutboxEventListResponse,
} from '@repo/types/api/outbox';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { sanitizeJobError } from '../jobs/job-error-sanitizer';

type OutboxOpsRow = {
  id: string;
  type: string;
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  processedAt: Date | null;
  lastErrorCode: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  payload: Prisma.JsonValue;
  payloadHash: string | null;
};

const outboxOpsSelect = {
  id: true,
  type: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  nextRunAt: true,
  lockedAt: true,
  lockedBy: true,
  processedAt: true,
  lastErrorCode: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  payload: true,
  payloadHash: true,
  aggregateId: false,
} satisfies Prisma.OutboxEventSelect;

@Injectable()
export class OutboxOpsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: OutboxEventListQuery): Promise<OutboxEventListResponse> {
    const limit = query.limit ?? 20;
    const rows = await this.prisma.outboxEvent.findMany({
      where: this.buildListWhere(query),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: outboxOpsSelect,
    });

    const visibleRows = rows.slice(0, limit);

    return {
      items: visibleRows.map((row) => this.toListItem(row)),
      nextCursor:
        rows.length > limit
          ? (visibleRows[visibleRows.length - 1]?.id ?? null)
          : null,
    };
  }

  async getDetail(id: string): Promise<OutboxEventDetailResponse> {
    const row = await this.prisma.outboxEvent.findFirst({
      where: { id },
      select: outboxOpsSelect,
    });

    if (!row) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_FOUND',
        'Outbox event not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toDetail(row);
  }

  async requeue(
    id: string,
    now = new Date(),
  ): Promise<OutboxEventDetailResponse> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { id, status: { in: ['FAILED', 'DEAD'] } },
      data: {
        status: 'PENDING',
        attempts: 0,
        lockedAt: null,
        lockedBy: null,
        processedAt: null,
        nextRunAt: now,
      },
    });

    if (result.count === 1) {
      return this.getDetail(id);
    }

    const existing = await this.prisma.outboxEvent.findFirst({
      where: { id },
      select: outboxOpsSelect,
    });

    if (!existing) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_FOUND',
        'Outbox event not found',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!isRequeueable(existing.status)) {
      throw new AppError(
        'OUTBOX_EVENT_NOT_REQUEUEABLE',
        'Only failed or dead outbox events can be requeued',
        HttpStatus.CONFLICT,
      );
    }

    throw new AppError(
      'OUTBOX_EVENT_REQUEUE_CONFLICT',
      'Outbox event changed while requeueing',
      HttpStatus.CONFLICT,
    );
  }

  private buildListWhere(query: OutboxEventListQuery): Prisma.OutboxEventWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    };
  }

  private toListItem(row: OutboxOpsRow) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      nextRunAt: toIso(row.nextRunAt),
      lockedAt: toIso(row.lockedAt),
      processedAt: toIso(row.processedAt),
      lastErrorCode: row.lastErrorCode,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      hasPayload: row.payload !== null && row.payload !== undefined,
      hasLastError: Boolean(row.lastError),
      canRequeue: isRequeueable(row.status),
    };
  }

  private toDetail(row: OutboxOpsRow): OutboxEventDetailResponse {
    return {
      ...this.toListItem(row),
      lockedBy: row.lockedBy,
      lastErrorPreview: row.lastError
        ? sanitizeJobError(row.lastError).slice(0, 300)
        : null,
      payloadHash: row.payloadHash,
    };
  }
}

function isRequeueable(status: OutboxEventStatus) {
  return status === 'FAILED' || status === 'DEAD';
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}
```

- [ ] **Step 4: Verify service tests**

Run:

```powershell
bun --filter @repo/server test -- outbox-ops
```

Expected: service tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/outbox/outbox-ops.service.ts apps/server/src/outbox/outbox-ops.service.spec.ts
git commit -m "feat(server): add outbox ops service"
```

---

## Task 4: Add Guarded Outbox Ops Controller

**Files:**
- Create: `apps/server/src/outbox/outbox-ops.controller.ts`
- Create: `apps/server/src/outbox/outbox-ops.controller.spec.ts`
- Modify: `apps/server/src/outbox/outbox.module.ts`

- [ ] **Step 1: Write failing controller tests**

Create `apps/server/src/outbox/outbox-ops.controller.spec.ts`:

```ts
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
    const controller = new OutboxOpsController(service as never, config as never);

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
    const controller = new OutboxOpsController(service as never, config as never);

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
    const controller = new OutboxOpsController(service as never, config as never);

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
    const controller = new OutboxOpsController(service as never, config as never);

    await expect(
      controller.requeue('evt_1', { reason: 'fixed provider config' }),
    ).resolves.toEqual({ id: 'evt_1', status: 'PENDING' });
    expect(service.requeue).toHaveBeenCalledWith('evt_1', expect.any(Date));
  });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run:

```powershell
bun --filter @repo/server test -- outbox-ops
```

Expected: FAIL because `OutboxOpsController` does not exist.

- [ ] **Step 3: Implement controller**

Create `apps/server/src/outbox/outbox-ops.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  outboxEventListQuerySchema,
  outboxEventRequeueRequestSchema,
} from '@repo/types/api/outbox';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ServerEnv } from '../config/env';
import { OutboxOpsService } from './outbox-ops.service';

@Controller('outbox-events')
@UseGuards(JwtAuthGuard)
@ApiTags('Outbox Ops')
@ApiBearerAuth('access-token')
export class OutboxOpsController {
  constructor(
    private readonly service: OutboxOpsService,
    private readonly config: ConfigService<ServerEnv, true>,
  ) {}

  @Get()
  @ApiOperation({
    summary: '查看脱敏 Outbox 事件列表',
    description:
      '仅用于本地开发和受控诊断。不会返回 payload、aggregateId、用户正文、prompt、chunk、API key、token 或 cookie。',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiOkResponse({ description: '脱敏 outbox 事件列表。' })
  list(@Query() query: Record<string, unknown>) {
    this.assertEnabled();
    return this.service.list(outboxEventListQuerySchema.parse(query));
  }

  @Get(':id')
  @ApiOperation({
    summary: '查看单个脱敏 Outbox 事件',
    description:
      '返回状态、attempts、锁信息和脱敏错误预览，但永远不返回 payload 或业务正文。',
  })
  @ApiParam({ name: 'id', description: 'Outbox event id' })
  @ApiOkResponse({ description: '脱敏 outbox 事件详情。' })
  detail(@Param('id') id: string) {
    this.assertEnabled();
    return this.service.getDetail(id);
  }

  @Post(':id/requeue')
  @ApiOperation({
    summary: '重新排队 FAILED / DEAD Outbox 事件',
    description:
      '只把 FAILED 或 DEAD 事件安全重置为 PENDING，不会立即执行 handler，也不会修改 payload。',
  })
  @ApiParam({ name: 'id', description: 'Outbox event id' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          example: '修复 provider 配置后重新排队',
        },
      },
    },
  })
  @ApiOkResponse({ description: '重新排队后的脱敏 outbox 事件详情。' })
  requeue(@Param('id') id: string, @Body() body: unknown) {
    this.assertEnabled();
    outboxEventRequeueRequestSchema.parse(body ?? {});
    return this.service.requeue(id, new Date());
  }

  private assertEnabled() {
    if (!this.config.get('OUTBOX_OPS_ENABLED', { infer: true })) {
      throw new NotFoundException('Outbox ops is disabled');
    }
  }
}
```

- [ ] **Step 4: Register controller and service**

Modify `apps/server/src/outbox/outbox.module.ts`:

```ts
import { OutboxOpsController } from './outbox-ops.controller';
import { OutboxOpsService } from './outbox-ops.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [OutboxOpsController],
  providers: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
    // existing runner provider and handlers stay unchanged
  ],
  exports: [
    OutboxService,
    OutboxDispatcherService,
    OutboxMetricsService,
    OutboxOpsService,
  ],
})
export class OutboxModule {}
```

- [ ] **Step 5: Verify controller tests**

Run:

```powershell
bun --filter @repo/server test -- outbox-ops
bun --cwd apps/server eslint src/outbox
```

Expected: tests and lint pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/src/outbox/outbox-ops.controller.ts apps/server/src/outbox/outbox-ops.controller.spec.ts apps/server/src/outbox/outbox.module.ts
git commit -m "feat(server): expose guarded outbox ops endpoints"
```

---

## Task 5: Add E2E Coverage For Outbox Ops

**Files:**
- Create: `apps/server/test/outbox-ops.e2e-spec.ts`

- [ ] **Step 1: Write e2e tests**

Create `apps/server/test/outbox-ops.e2e-spec.ts` following existing e2e setup style:

```ts
import cookieParser from 'cookie-parser';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from '../src/common/interceptors/response-envelope.interceptor';
import { PrismaService } from '../src/database/prisma.service';

describe('OutboxOpsController (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let token: string;
  const email = `outbox-ops-${Date.now()}@example.com`;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET ??= 'dev-secret-change-me';
    process.env.OUTBOX_OPS_ENABLED = 'true';
    process.env.DATABASE_URL ??=
      'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind';

    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
    await app.init();

    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    const register = await request(server).post('/auth/register').send({
      email,
      password: 'Password123!',
    });
    token = register.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({
      where: { type: 'test.outbox.ops' },
    });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    delete process.env.OUTBOX_OPS_ENABLED;
  });

  it('requires authentication', async () => {
    await request(server).get('/outbox-events').expect(401);
  });

  it('lists sanitized outbox events', async () => {
    await prisma.outboxEvent.create({
      data: {
        type: 'test.outbox.ops',
        status: 'DEAD',
        payload: { secret: 'do-not-return' },
        payloadHash: 'sha256:test',
        attempts: 5,
        maxAttempts: 5,
        lastErrorCode: 'TEST_ERROR',
        lastError: 'failed with Bearer secret-token',
      },
    });

    const response = await request(server)
      .get('/outbox-events?status=DEAD&type=test.outbox.ops')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.items).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain('do-not-return');
    expect(JSON.stringify(response.body)).not.toContain('secret-token');
    expect(response.body.data.items[0]).toEqual(
      expect.objectContaining({
        type: 'test.outbox.ops',
        status: 'DEAD',
        canRequeue: true,
      }),
    );
  });

  it('returns sanitized detail and requeues a dead event', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        type: 'test.outbox.ops',
        status: 'DEAD',
        payload: { documentId: 'doc_secret' },
        payloadHash: 'sha256:test',
        attempts: 5,
        maxAttempts: 5,
        lastErrorCode: 'TEST_ERROR',
        lastError: 'failed with Bearer secret-token',
      },
    });

    const detail = await request(server)
      .get(`/outbox-events/${event.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.data.lastErrorPreview).toBe(
      'failed with [redacted]',
    );
    expect(JSON.stringify(detail.body)).not.toContain('doc_secret');

    const requeued = await request(server)
      .post(`/outbox-events/${event.id}/requeue`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'fixed test config' })
      .expect(201);

    expect(requeued.body.data.status).toBe('PENDING');
    expect(requeued.body.data.attempts).toBe(0);
    expect(requeued.body.data.canRequeue).toBe(false);
  });
});
```

- [ ] **Step 2: Run e2e test**

Run:

```powershell
bun --cwd apps/server jest --config ./test/jest-e2e.json --runInBand --testTimeout=30000 outbox-ops
```

Expected: e2e passes when local PostgreSQL is running.

- [ ] **Step 3: Commit**

```powershell
git add apps/server/test/outbox-ops.e2e-spec.ts
git commit -m "test(server): cover outbox ops e2e"
```

---

## Task 6: Document Phase 7.10

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/ai-behavior-acceptance.md`

- [ ] **Step 1: Update AGENTS phase table and boundaries**

Add Phase 7.10 to the table:

```md
| Phase 7.10 | 已完成 | Outbox Ops 后端闭环、脱敏列表/详情、FAILED / DEAD 安全 requeue |
```

Add a data-flow note near the outbox sections:

```md
- Outbox Ops：`GET /outbox-events`、`GET /outbox-events/:id` 与 `POST /outbox-events/:id/requeue` 是经过 `JwtAuthGuard` 且受 `OUTBOX_OPS_ENABLED` 控制的后端诊断入口；默认非 production 开启、production 关闭。接口只返回脱敏状态、attempts、时间戳、payloadHash 和错误预览，不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。requeue 只允许 `FAILED / DEAD -> PENDING`，不直接执行 handler，不支持删除、强制成功或 payload 编辑。
```

- [ ] **Step 2: Update DEVLOG**

Add a new recent record:

```md
### 2026-07-07 - Phase 7.10 Outbox Ops

本轮目标：给 Phase 7.9 durable outbox 补上安全的后端操作闭环，让开发者能在不暴露 payload 的前提下查看失败事件，并在修复根因后手动 requeue。

完成内容：
- 新增 `@repo/types/api/outbox` contract。
- 新增 `OUTBOX_OPS_ENABLED`，默认非 production 开启、production 关闭。
- 新增 `OutboxOpsService` 和 `OutboxOpsController`，支持脱敏列表、脱敏详情和 `FAILED / DEAD` requeue。
- requeue 只把事件重置为 `PENDING`，不直接执行 handler。
- 新增 e2e 覆盖认证、脱敏响应和 requeue 状态流转。

边界：
- 不新增前端页面。
- 不返回 payload、aggregateId、用户正文、prompt、RAG chunk、模型回答、API key、token 或 cookie。
- 不支持删除、强制成功、跳过、payload 编辑或直接 dispatch。
```

- [ ] **Step 3: Update AI behavior acceptance**

Add a note that Phase 7.10 does not require live model acceptance:

```md
- Phase 7.10 Outbox Ops 只新增后台 outbox 诊断与 requeue 能力，不改变 Chat / RAG prompt / live model 调用链路；验收重点是 API 鉴权、脱敏响应和状态流转，不需要真实模型 smoke。
```

- [ ] **Step 4: Verify docs**

Run:

```powershell
rg "Phase 7.10|Outbox Ops|OUTBOX_OPS_ENABLED|outbox-events" AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git diff --check
```

Expected: expected terms are present and diff check exits `0`.

- [ ] **Step 5: Commit**

```powershell
git add AGENTS.md DEVLOG.md docs/ai-behavior-acceptance.md
git commit -m "docs: record phase 7.10 outbox ops"
```

---

## Task 7: Final Verification

**Files:**
- No code edits unless verification reveals a bug.

- [ ] **Step 1: Run targeted gate**

Run:

```powershell
bun --cwd packages/types typecheck
bun --filter @repo/server test -- outbox-ops env
bun --cwd apps/server eslint src/outbox src/config
bun --filter @repo/server build
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run e2e**

Run:

```powershell
bun --filter @repo/server test:e2e
```

Expected: all e2e tests pass. If Docker PostgreSQL is not running, start dev infra with:

```powershell
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
```

Then rerun the e2e command.

- [ ] **Step 3: Run broad merge gate**

Run:

```powershell
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --filter @repo/web lint
bun --filter @repo/web test
bun --filter @repo/web build
bun --cwd packages/types typecheck
bun --cwd packages/database test
bun --cwd packages/fsrs test
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit any verification fixes**

If verification required small fixes, commit them separately:

```powershell
git add <changed-files>
git commit -m "test: stabilize phase 7.10 outbox ops"
```

If no files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan implements the approved design sections for shared contracts, env gate, service, controller, e2e, docs, and verification.
- Scope control: The plan does not add frontend UI, delete/force-success/dispatch endpoints, production admin roles, Prometheus, new business event types, or model behavior changes.
- Safety: The DTOs and tests explicitly reject payload exposure and do not return aggregate id or user content.
- TDD: Behavior changes start with failing tests before implementation.
- Commit cadence: Every completed task ends with a commit.
