# Phase 7 Worker Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `SERVER_ROLE=worker` start a real worker-only Nest process without an HTTP listener, while keeping `api` and `both` modes predictable.

**Architecture:** Extract server bootstrap role decisions from `apps/server/src/main.ts` into a small testable helper. HTTP roles create the normal Nest HTTP app and run cookie/CORS/filter/interceptor/Swagger setup; worker-only role creates an application context and relies on module initialization to register BullMQ processors.

**Tech Stack:** NestJS 11, TypeScript, Jest, BullMQ, Docker Compose, Bun workspace.

---

## File Map

- Create: `apps/server/src/bootstrap/server-bootstrap.ts`
  - Owns `shouldListenHttp()`, HTTP app configuration, and `bootstrapServer()`.
- Create: `apps/server/src/bootstrap/server-bootstrap.spec.ts`
  - Tests role behavior without booting a real HTTP server.
- Modify: `apps/server/src/main.ts`
  - Delegates to `bootstrapServer()`.
- Modify: `docker/docker-compose.dev.yml`
  - Makes role defaults explicit and adds an optional worker service for queue-mode local validation.
- Modify: `AGENTS.md`
  - Updates project snapshot, commands, environment notes, and next step status.
- Modify: `DEVLOG.md`
  - Cleans current Phase 7 entry and records the worker split.
- Modify: `docs/dev-start.md`
  - Documents `api / worker / both` startup patterns in PowerShell.
- Modify: `docs/data-flow.md`
  - Documents API and worker process responsibility boundaries.
- Modify: `docs/roadmap.md`
  - Marks worker split progress and updates next priorities.
- Create: `docs/blogs/phase-7-worker-split.md`
  - Interview-oriented learning blog with no date prefix.

## Task 1: Bootstrap Role Tests

**Files:**
- Create: `apps/server/src/bootstrap/server-bootstrap.spec.ts`
- Create: `apps/server/src/bootstrap/server-bootstrap.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/bootstrap/server-bootstrap.spec.ts` with tests that express the desired role behavior:

```ts
import { shouldListenHttp } from './server-bootstrap';

describe('shouldListenHttp', () => {
  it('listens for api and both roles but not worker-only role', () => {
    expect(shouldListenHttp('api')).toBe(true);
    expect(shouldListenHttp('both')).toBe(true);
    expect(shouldListenHttp('worker')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
bun --filter @repo/server test -- server-bootstrap
```

Expected: FAIL because `./server-bootstrap` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `apps/server/src/bootstrap/server-bootstrap.ts`:

```ts
import type { ServerEnv } from '../config/env';

export function shouldListenHttp(role: ServerEnv['SERVER_ROLE']) {
  return role === 'api' || role === 'both';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
bun --filter @repo/server test -- server-bootstrap
```

Expected: PASS for `shouldListenHttp`.

- [ ] **Step 5: Commit**

```powershell
git add apps/server/src/bootstrap/server-bootstrap.ts apps/server/src/bootstrap/server-bootstrap.spec.ts
git commit -m "test(server): define server role bootstrap behavior"
```

## Task 2: Worker-Only Bootstrap

**Files:**
- Modify: `apps/server/src/bootstrap/server-bootstrap.ts`
- Modify: `apps/server/src/bootstrap/server-bootstrap.spec.ts`
- Modify: `apps/server/src/main.ts`

- [ ] **Step 1: Extend tests before production code**

Add test doubles to `server-bootstrap.spec.ts` so the bootstrap can be tested without a real Nest server:

```ts
import { bootstrapServer, shouldListenHttp } from './server-bootstrap';

describe('bootstrapServer', () => {
  const createHttpApp = jest.fn();
  const createApplicationContext = jest.fn();

  beforeEach(() => {
    createHttpApp.mockReset();
    createApplicationContext.mockReset();
  });

  it('creates an application context without listening in worker-only mode', async () => {
    const context = {
      get: jest.fn().mockReturnValue({
        get: jest.fn((key: string) => (key === 'SERVER_ROLE' ? 'worker' : undefined)),
      }),
    };
    createApplicationContext.mockResolvedValue(context);

    await bootstrapServer({ createHttpApp, createApplicationContext });

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
    expect(createHttpApp).not.toHaveBeenCalled();
  });

  it('creates and listens with the HTTP app in api mode', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SERVER_ROLE') return 'api';
        if (key === 'PORT') return 3001;
        if (key === 'CORS_ORIGIN') return 'http://localhost:3000';
        if (key === 'NODE_ENV') return 'development';
        if (key === 'SWAGGER_ENABLED') return false;
        return undefined;
      }),
    };
    const app = {
      get: jest.fn().mockReturnValue(config),
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };
    createHttpApp.mockResolvedValue(app);

    await bootstrapServer({ createHttpApp, createApplicationContext });

    expect(createHttpApp).toHaveBeenCalledTimes(1);
    expect(createApplicationContext).not.toHaveBeenCalled();
    expect(app.listen).toHaveBeenCalledWith(3001);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
bun --filter @repo/server test -- server-bootstrap
```

Expected: FAIL because `bootstrapServer()` is not implemented.

- [ ] **Step 3: Implement bootstrap helper**

Update `apps/server/src/bootstrap/server-bootstrap.ts` to:

- Import `cookie-parser`, `ConfigService`, `NestFactory`, `AppModule`, `HttpExceptionFilter`, `ResponseEnvelopeInterceptor`, `createCorsOriginValidator`, and `setupSwagger`.
- Export `bootstrapServer()`.
- Use `NestFactory.createApplicationContext(AppModule)` when `SERVER_ROLE=worker`.
- Use `NestFactory.create(AppModule)` and existing HTTP setup when `SERVER_ROLE=api | both`.

- [ ] **Step 4: Simplify main**

Replace `apps/server/src/main.ts` with:

```ts
import { bootstrapServer } from './bootstrap/server-bootstrap';

void bootstrapServer();
```

- [ ] **Step 5: Run role tests**

Run:

```powershell
bun --filter @repo/server test -- server-bootstrap worker-role
```

Expected: PASS for bootstrap and worker role tests.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/src/bootstrap/server-bootstrap.ts apps/server/src/bootstrap/server-bootstrap.spec.ts apps/server/src/main.ts
git commit -m "feat(server): split api and worker bootstrap"
```

## Task 3: Local Compose Role Split

**Files:**
- Modify: `docker/docker-compose.dev.yml`

- [ ] **Step 1: Update compose roles**

Update the existing `server` service with explicit local defaults:

```yaml
      SERVER_ROLE: both
      KNOWLEDGE_PROCESSING_MODE: inline
```

Add an optional worker service that has no published ports:

```yaml
  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    depends_on:
      - postgres
      - redis
      - minio
    environment:
      SERVER_ROLE: worker
      KNOWLEDGE_PROCESSING_MODE: queue
      DATABASE_URL: postgresql://prepmind:devpass@postgres:5432/prepmind
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      MINIO_PORT: 9000
      MINIO_USE_SSL: "false"
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
      MINIO_BUCKET: prepmind-dev
      PUBLIC_API_BASE_URL: http://server:3001
```

- [ ] **Step 2: Validate compose syntax**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml config
```

Expected: exit code 0 and rendered `server` plus `worker` services.

- [ ] **Step 3: Commit**

```powershell
git add docker/docker-compose.dev.yml
git commit -m "chore(docker): add worker role dev service"
```

## Task 4: Documentation And Blog

**Files:**
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/dev-start.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Create: `docs/blogs/phase-7-worker-split.md`

- [ ] **Step 1: Update project docs**

Document:

- `SERVER_ROLE=api`: HTTP only, no queue consumer.
- `SERVER_ROLE=worker`: queue consumer only, no HTTP port.
- `SERVER_ROLE=both`: local convenience mode.
- Worker-only has no `/health` in this phase; use process logs plus BullMQ / BackgroundJob status.
- New docs/blogs/plans should use semantic names without date prefixes.

- [ ] **Step 2: Write the learning blog**

Create `docs/blogs/phase-7-worker-split.md` with these sections:

- “为什么 API 和 Worker 不应该总绑在一起”
- “我们这次发现的实际问题”
- “`api / worker / both` 三种角色怎么分工”
- “NestJS 里为什么 worker-only 用 application context”
- “这对面试怎么讲”
- “后续还可以怎么演进”

- [ ] **Step 3: Run docs diff check**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 4: Commit**

```powershell
git add AGENTS.md DEVLOG.md docs/dev-start.md docs/data-flow.md docs/roadmap.md docs/blogs/phase-7-worker-split.md
git commit -m "docs: explain phase 7 worker split"
```

## Task 5: Final Verification And Merge

**Files:**
- All files changed in this branch.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
bun --filter @repo/server test -- worker-role server-bootstrap
```

Expected: PASS.

- [ ] **Step 2: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: exit code 0.

- [ ] **Step 3: Run server test suite**

Run:

```powershell
bun --filter @repo/server test
```

Expected: exit code 0.

- [ ] **Step 4: Run diff hygiene**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 5: Commit any final doc corrections**

If verification requires corrections:

```powershell
git add <changed-files>
git commit -m "fix(server): stabilize worker split"
```

- [ ] **Step 6: Merge and push**

Run:

```powershell
git switch main
git merge --no-ff codex/phase-7-worker-split -m "merge: phase 7 worker split"
bun --filter @repo/server test -- worker-role server-bootstrap
bun --filter @repo/server build
git push origin main
git branch -d codex/phase-7-worker-split
```

Expected: merge succeeds, focused verification passes on `main`, and `origin/main` receives the worker split.
