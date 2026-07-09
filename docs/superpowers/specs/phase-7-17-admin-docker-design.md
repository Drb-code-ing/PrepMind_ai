# Phase 7.17 Admin Console Docker Design

## Goal

Phase 7.17 turns the Phase 7.16 admin console from a Bun-only local app into a first-class Docker Compose service.

After this phase, local full-stack startup should make the deployment roles easy to explain:

- `web`: student learning PWA on `http://127.0.0.1:3000`
- `admin`: operator/admin console on `http://127.0.0.1:3100`
- `server`: NestJS API on `http://127.0.0.1:3001`
- `worker`: background job worker, no public HTTP port
- `postgres`, `redis`, `minio`: local infrastructure dependencies

## Why This Matters

Phase 7.16 created a separate admin app, but Docker still only knew about `web`, `server`, and `worker`. That means the code structure was separated, while the deployment structure was still incomplete.

Adding an `admin` container makes the system easier to operate and easier to explain in interviews:

- the learning product and admin console are deployed as separate frontends;
- admin pages can evolve without mixing their runtime with the student PWA;
- compose-based acceptance can verify the same service boundaries developers talk about in architecture diagrams.

## Recommended Architecture

Create a dedicated `docker/Dockerfile.admin` instead of overloading `docker/Dockerfile.web`.

The admin Dockerfile should mirror the existing Next standalone pattern:

1. install Bun workspace dependencies from the monorepo lockfile;
2. copy workspace packages and app sources;
3. run Prisma client generation because workspace packages may need generated database client types during build;
4. build `@repo/admin`;
5. copy `apps/admin/.next/standalone`, static assets, and public assets into a production runner image;
6. expose port `3100` and run `bun apps/admin/server.js`.

The compose service should be named `admin` and depend on `server`. It should set:

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
PREPMIND_INTERNAL_API_BASE_URL=http://server:3001
PORT=3100
HOSTNAME=0.0.0.0
```

The existing `web` service should also receive:

```text
NEXT_PUBLIC_ADMIN_CONSOLE_URL=http://127.0.0.1:3100
```

so the student app's ADMIN sidebar entry points to the Docker admin console by default.

## Alternatives Considered

### One Parametric Frontend Dockerfile

Use one Dockerfile with a build arg such as `FRONTEND_APP=web|admin`.

This reduces duplicated Dockerfile lines, but it makes local diagnosis less obvious: a failed `web` build and failed `admin` build would share the same file and require more context to understand which app is being built.

### Dedicated Dockerfile.admin

This is the chosen approach. It duplicates a small amount of Dockerfile structure, but the deployment roles become explicit and easy to teach:

```text
Dockerfile.web   -> @repo/web
Dockerfile.admin -> @repo/admin
```

For this project, clarity is more valuable than prematurely abstracting Docker build logic.

## Scope

In scope:

- add `docker/Dockerfile.admin`;
- add an `admin` service to `docker/docker-compose.dev.yml`;
- wire `NEXT_PUBLIC_ADMIN_CONSOLE_URL` into the Docker `web` service;
- update startup docs and roadmap/devlog/agent notes;
- add focused tests or static checks for compose and Dockerfile wiring;
- run Docker build/start acceptance when Docker is available.

Out of scope:

- new admin pages;
- new backend APIs;
- changes to `JwtAuthGuard`, `OperatorGuard`, roles, or permissions;
- production-grade reverse proxy/TLS/domain routing;
- Kubernetes, CI deployment, or registry publishing;
- making the admin UI fully mobile-native. The entry can appear on mobile, but the admin app remains desktop-first.

## Runtime Boundaries

The admin container is only an operator experience layer. It must not bypass backend authorization.

All sensitive operations still go through existing server guards:

- `GET /outbox-events`
- `GET /outbox-events/:id`
- `POST /outbox-events/:id/requeue`
- `GET /operator-audit-logs`
- `GET /worker-readiness`

If a non-admin user opens the admin app, the frontend may show a no-permission state, but the real enforcement remains on the NestJS API.

## Acceptance Criteria

Phase 7.17 is complete when:

1. `docker compose -f docker/docker-compose.dev.yml --profile worker up -d --build postgres redis minio server worker web admin` starts all services.
2. `docker compose -f docker/docker-compose.dev.yml --profile worker ps` shows `admin` running and `worker` healthy.
3. `http://127.0.0.1:3100` opens the admin console in a browser.
4. an ADMIN account can log in to the admin console and view dashboard, Outbox Ops, audit, and worker readiness.
5. a normal user cannot use admin-only backend APIs.
6. `http://127.0.0.1:3000` still opens the learning app, and ADMIN sidebar "后台管理" points to `http://127.0.0.1:3100`.
7. docs explain both Bun startup and Docker startup clearly.

## Verification Plan

Minimum code verification:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts
bun --filter @repo/admin lint
bun --filter @repo/admin build
bun --filter @repo/web lint
```

Docker verification:

```powershell
docker compose -f docker/docker-compose.dev.yml --profile worker build admin web server worker
docker compose -f docker/docker-compose.dev.yml --profile worker up -d postgres redis minio server worker web admin
docker compose -f docker/docker-compose.dev.yml --profile worker ps
```

Browser verification should cover both:

- `http://127.0.0.1:3000`
- `http://127.0.0.1:3100`
