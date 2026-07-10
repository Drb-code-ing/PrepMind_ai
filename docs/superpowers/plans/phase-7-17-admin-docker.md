# Phase 7.17 Admin Console Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Docker Compose `admin` service for the Phase 7.16 admin console.

**Architecture:** Create a dedicated `docker/Dockerfile.admin` that mirrors the existing Next standalone `web` image but builds `@repo/admin` and serves port `3100`. Wire the Docker `web` service to `NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100`, and verify the compose topology with static tests plus Docker/browser acceptance.

**Tech Stack:** Docker Compose, Bun workspace, Next.js standalone output, Jest server static tests, existing `@repo/admin` Next app.

---

### Task 1: Add Docker Static Contract Tests

**Files:**
- Modify: `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`

- [ ] **Step 1: Write failing Docker contract tests**

Add two tests to `apps/server/src/worker-readiness/docker-compose-readiness.spec.ts`.

The first test should assert `docker/Dockerfile.admin` exists and contains these strings:

```ts
expect(dockerfile).toContain('FROM oven/bun:1.3.14-alpine AS base');
expect(dockerfile).toContain('COPY apps/admin/package.json ./apps/admin/');
expect(dockerfile).toContain('COPY packages/types/package.json ./packages/types/');
expect(dockerfile).toContain('bun install --frozen-lockfile');
expect(dockerfile).toContain('ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001');
expect(dockerfile).toContain('ENV PREPMIND_INTERNAL_API_BASE_URL=$PREPMIND_INTERNAL_API_BASE_URL');
expect(dockerfile).toContain('bun --filter @repo/admin build');
expect(dockerfile).toContain('COPY --from=builder /app/apps/admin/.next/standalone ./');
expect(dockerfile).toContain('COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static');
expect(dockerfile).toContain('EXPOSE 3100');
expect(dockerfile).toContain('ENV PORT=3100');
expect(dockerfile).toContain('CMD ["bun", "apps/admin/server.js"]');
```

The second test should extract the `admin` and `web` compose sections and assert:

```ts
expect(adminService).toContain('dockerfile: docker/Dockerfile.admin');
expect(adminService).toContain('"3100:3100"');
expect(adminService).toContain('depends_on:');
expect(adminService).toContain('- server');
expect(adminService).toContain('NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_ADMIN_API_BASE_URL:-http://127.0.0.1:3001}');
expect(adminService).toContain('PREPMIND_INTERNAL_API_BASE_URL: http://server:3001');
expect(webService).toContain('NEXT_PUBLIC_ADMIN_CONSOLE_URL: ${NEXT_PUBLIC_ADMIN_CONSOLE_URL:-http://127.0.0.1:3100}');
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
bun --filter @repo/server test -- docker-compose-readiness --runInBand
```

Expected: FAIL because `docker/Dockerfile.admin` and compose `admin` service do not exist yet.

- [ ] **Step 3: Commit RED test**

```powershell
git add apps/server/src/worker-readiness/docker-compose-readiness.spec.ts
git commit -m "test(docker): cover admin console service wiring"
```

### Task 2: Add Admin Dockerfile and Compose Service

**Files:**
- Create: `docker/Dockerfile.admin`
- Modify: `docker/docker-compose.dev.yml`

- [ ] **Step 1: Implement `docker/Dockerfile.admin`**

Create a dedicated admin Dockerfile with this structure:

```dockerfile
FROM oven/bun:1.3.14-alpine AS base

FROM base AS deps
WORKDIR /app
COPY bun.lock package.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/agent/package.json ./packages/agent/
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/fsrs/package.json ./packages/fsrs/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/rag/package.json ./packages/rag/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
ARG PREPMIND_INTERNAL_API_BASE_URL=http://server:3001
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV PREPMIND_INTERNAL_API_BASE_URL=$PREPMIND_INTERNAL_API_BASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages
COPY . .
RUN bun --cwd packages/database prisma:generate
RUN bun --filter @repo/admin build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
ARG PREPMIND_INTERNAL_API_BASE_URL=http://server:3001
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV PREPMIND_INTERNAL_API_BASE_URL=$PREPMIND_INTERNAL_API_BASE_URL
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
CMD ["bun", "apps/admin/server.js"]
```

- [ ] **Step 2: Add compose `admin` service**

Add this service after `web` in `docker/docker-compose.dev.yml`:

```yaml
  admin:
    build:
      context: ..
      dockerfile: docker/Dockerfile.admin
      args:
        NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_ADMIN_API_BASE_URL:-http://127.0.0.1:3001}
        PREPMIND_INTERNAL_API_BASE_URL: http://server:3001
    env_file:
      - ../.env
    ports:
      - "3100:3100"
    depends_on:
      - server
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_ADMIN_API_BASE_URL:-http://127.0.0.1:3001}
      PREPMIND_INTERNAL_API_BASE_URL: http://server:3001
```

Also add this to the existing `web.environment` block:

```yaml
      NEXT_PUBLIC_ADMIN_CONSOLE_URL: ${NEXT_PUBLIC_ADMIN_CONSOLE_URL:-http://127.0.0.1:3100}
```

- [ ] **Step 3: Verify GREEN**

Run:

```powershell
bun --filter @repo/server test -- docker-compose-readiness --runInBand
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add docker/Dockerfile.admin docker/docker-compose.dev.yml apps/server/src/worker-readiness/docker-compose-readiness.spec.ts
git commit -m "feat(docker): add admin console service"
```

### Task 3: Build and Smoke Docker Admin Image

**Files:**
- No source changes expected unless Docker build reveals a real bug.

- [ ] **Step 1: Build admin image**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker build admin
```

Expected: build exits 0 and produces the admin image.

- [ ] **Step 2: Build web image to verify admin URL wiring does not break learning app image**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker build web
```

Expected: build exits 0.

- [ ] **Step 3: Commit any Docker build fixes**

If build required code changes:

```powershell
git add <changed-files>
git commit -m "fix(docker): stabilize admin image build"
```

If no changes were needed, skip the commit.

### Task 4: Full Compose Acceptance

**Files:**
- No source changes expected unless acceptance reveals a real bug.

- [ ] **Step 1: Start full local stack**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

Expected: command exits 0.

- [ ] **Step 2: Check service status**

Run:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

Expected:

- `admin` is running and exposes `3100:3100`;
- `web` is running and exposes `3000:3000`;
- `server` is running and exposes `3001:3001`;
- `worker` is `healthy`.

- [ ] **Step 3: Browser acceptance**

Open:

```text
http://127.0.0.1:3000
http://127.0.0.1:3100
```

Verify:

- learning app loads on `3000`;
- admin app loads on `3100`;
- ADMIN user can log in to admin console;
- admin dashboard, Outbox Ops, audit, and Worker Readiness pages render;
- normal user cannot use admin-only APIs.

- [ ] **Step 4: Clean test data**

If acceptance inserts test users or outbox events, remove only the known Phase 7.17 test rows. Do not reset volumes.

### Task 5: Documentation and Phase Status

**Files:**
- Modify: `docs/dev-start.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update startup docs**

In `docs/dev-start.md`, add Docker admin startup instructions:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin
```

Document URLs:

```text
学习端：http://127.0.0.1:3000
管理员后台：http://127.0.0.1:3100
API：http://127.0.0.1:3001
```

Explain that Bun startup remains:

```powershell
bun run dev:admin
```

- [ ] **Step 2: Update roadmap/devlog/agent notes**

Update Phase 7.17 status and explain:

- why `admin` is a separate service;
- what Docker services now mean;
- what remains out of scope.

- [ ] **Step 3: Final verification**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts
bun --filter @repo/admin lint
bun --filter @repo/admin build
bun --filter @repo/web lint
bun --filter @repo/server test -- docker-compose-readiness outbox-ops.controller operator-audit.controller worker-readiness.controller --runInBand
```

- [ ] **Step 4: Commit docs**

```powershell
git add docs/dev-start.md docs/roadmap.md DEVLOG.md AGENTS.md
git commit -m "docs: document docker admin console startup"
```

- [ ] **Step 5: Push branch**

```powershell
git push -u origin codex/phase-7-17-admin-docker
```

