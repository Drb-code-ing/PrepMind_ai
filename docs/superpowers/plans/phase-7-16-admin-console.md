# Phase 7.16 Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a desktop-first administrator console with Outbox Ops, operator audit, and worker readiness tools, while keeping the existing mobile `/operator-audit` page.

**Architecture:** Create a separate Next.js workspace app at `apps/admin` on port `3100`, sharing the existing NestJS API and `@repo/types` contracts. The student PWA keeps its mobile-first navigation, but ADMIN users on desktop see a single "后台管理" entry that opens the admin console. Backend security remains `JwtAuthGuard + OperatorGuard`; the admin frontend only improves workflow and does not become the security boundary.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, TanStack Query, Zustand, Zod contracts from `@repo/types`, existing NestJS admin-only APIs.

---

### Task 1: Add Admin Console Workspace Shell

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/postcss.config.mjs`
- Create: `apps/admin/eslint.config.mjs`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/src/app/layout.tsx`
- Create: `apps/admin/src/app/globals.css`
- Modify: `package.json`

- [ ] **Step 1: Write failing workspace tests**

Create `apps/admin/src/lib/admin-nav.test.mts` with assertions for expected admin nav ids before `admin-nav.ts` exists.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test apps/admin/src/lib/admin-nav.test.mts`

Expected: FAIL because `admin-nav.ts` is missing.

- [ ] **Step 3: Add workspace shell**

Add `@repo/admin` package, `dev/build/start/test/lint` scripts, Next config with `allowedDevOrigins: ['127.0.0.1']`, Tailwind PostCSS config, and app layout/styles.

- [ ] **Step 4: Add root command**

Add `dev:admin` to root `package.json`:

```json
"dev:admin": "bun --filter @repo/admin dev"
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/admin-nav.test.mts
bun --filter @repo/admin lint
```

- [ ] **Step 6: Commit**

```powershell
git add package.json apps/admin
git commit -m "feat(admin): add admin console workspace"
```

### Task 2: Share Auth and API Utilities in Admin App

**Files:**
- Create: `apps/admin/src/lib/api-client.ts`
- Create: `apps/admin/src/lib/auth-api.ts`
- Create: `apps/admin/src/lib/auth-form-validation.ts`
- Create: `apps/admin/src/stores/admin-session-store.ts`
- Create: `apps/admin/src/components/query-provider.tsx`
- Create: `apps/admin/src/components/auth-session-provider.tsx`
- Create: `apps/admin/src/components/admin-auth-gate.tsx`
- Create: `apps/admin/src/app/login/page.tsx`

- [ ] **Step 1: Write failing auth tests**

Create `apps/admin/src/lib/admin-auth-view.test.mts` covering desktop login field validation and admin role gate messages.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test apps/admin/src/lib/admin-auth-view.test.mts`

Expected: FAIL because view helpers are missing.

- [ ] **Step 3: Implement API/auth utilities**

Implement API client, login/refresh/me/logout methods, session store, query provider, refresh-on-boot provider, and `AdminAuthGate` that allows only `role=ADMIN`.

- [ ] **Step 4: Add login page**

Create a desktop-oriented login screen that uses existing `/auth/login`, shows validation feedback, and redirects admin users to `/`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/admin-auth-view.test.mts
bun --filter @repo/admin lint
```

- [ ] **Step 6: Commit**

```powershell
git add apps/admin
git commit -m "feat(admin): add admin auth flow"
```

### Task 3: Build Admin Dashboard and Outbox Ops

**Files:**
- Create: `apps/admin/src/lib/outbox-api.ts`
- Create: `apps/admin/src/lib/outbox-view.ts`
- Create: `apps/admin/src/lib/outbox-view.test.mts`
- Create: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/app/outbox/page.tsx`

- [ ] **Step 1: Write failing Outbox view tests**

Test that `FAILED` and `DEAD` events are requeueable, `PENDING/PROCESSING/SUCCEEDED` are not, and unknown handler errors produce a "fix code first" warning.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test apps/admin/src/lib/outbox-view.test.mts`

Expected: FAIL because `outbox-view.ts` is missing.

- [ ] **Step 3: Implement outbox API and view helpers**

Use `@repo/types/api/outbox` schemas to call:

```text
GET /outbox-events
GET /outbox-events/:id
POST /outbox-events/:id/requeue
```

- [ ] **Step 4: Build dashboard and Outbox Ops page**

Dashboard links to Outbox Ops, Operator Audit, and Worker Readiness. Outbox page supports status/type filters, detail inspection, reason input, explicit confirmation, and requeue mutation.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/outbox-view.test.mts
bun --filter @repo/admin lint
```

- [ ] **Step 6: Commit**

```powershell
git add apps/admin
git commit -m "feat(admin): add outbox ops page"
```

### Task 4: Add Audit and Worker Pages

**Files:**
- Create: `apps/admin/src/lib/operator-audit-api.ts`
- Create: `apps/admin/src/lib/operator-audit-view.ts`
- Create: `apps/admin/src/lib/worker-readiness-api.ts`
- Create: `apps/admin/src/lib/worker-readiness-view.ts`
- Create: `apps/admin/src/app/audit/page.tsx`
- Create: `apps/admin/src/app/worker/page.tsx`

- [ ] **Step 1: Write failing view tests**

Create tests for audit labels and worker readiness status tones.

- [ ] **Step 2: Verify RED**

Run admin lib tests and confirm missing helpers fail.

- [ ] **Step 3: Implement API/view helpers**

Use existing `@repo/types` schemas for `/operator-audit-logs` and `/worker-readiness`.

- [ ] **Step 4: Build pages**

Audit page lists recent requeue audit logs. Worker page displays readiness checks and issues.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
bun --filter @repo/admin lint
```

- [ ] **Step 6: Commit**

```powershell
git add apps/admin
git commit -m "feat(admin): add audit and worker pages"
```

### Task 5: Add Desktop-Only Admin Entry in Web App

**Files:**
- Modify: `apps/web/src/lib/sidebar-nav.ts`
- Modify: `apps/web/src/lib/sidebar-nav.test.mts`
- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Write failing sidebar tests**

Update tests to expect ADMIN users to see `/admin-console` metadata and keep `/operator-audit` available.

- [ ] **Step 2: Verify RED**

Run: `node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts`

Expected: FAIL until nav metadata is updated.

- [ ] **Step 3: Implement admin-only entry**

Add an ADMIN-only "后台管理" item that links to `NEXT_PUBLIC_ADMIN_CONSOLE_URL || http://127.0.0.1:3100`, opens with clear external semantics, and is visible on both mobile and desktop. Keep the existing `/operator-audit` item for mobile/admin continuity. The admin console app itself remains desktop-first in layout.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts
bun --filter @repo/web lint
```

- [ ] **Step 5: Commit**

```powershell
git add apps/web
git commit -m "feat(web): add desktop admin console entry"
```

### Task 6: Documentation, Acceptance, and Final Verification

**Files:**
- Modify: `docs/dev-start.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Document commands**

Add:

```powershell
bun --filter @repo/admin dev
# or
bun run dev:admin
```

and explain `http://127.0.0.1:3100`, required `ADMIN` account, backend API requirement, and Docker service dependency.

- [ ] **Step 2: Update phase docs**

Mark Phase 7.16 as admin console first slice, preserving `/operator-audit` mobile page.

- [ ] **Step 3: Run final verification**

Run:

```powershell
node --experimental-strip-types --test apps/admin/src/lib/*.test.mts
node --experimental-strip-types --test apps/web/src/lib/sidebar-nav.test.mts
bun --filter @repo/admin lint
bun --filter @repo/admin build
bun --filter @repo/web lint
bun --filter @repo/server test -- outbox-ops.controller operator-audit.controller worker-readiness.controller --runInBand
```

- [ ] **Step 4: Browser acceptance**

Start backend and admin frontend, open `http://127.0.0.1:3100`, log in with an ADMIN account, verify dashboard, outbox list, audit list, worker readiness, and confirm non-admin sees a no-permission state.

- [ ] **Step 5: Commit and push**

```powershell
git add docs DEVLOG.md AGENTS.md
git commit -m "docs: document admin console operations"
git push -u origin codex/phase-7-16-admin-console
```
