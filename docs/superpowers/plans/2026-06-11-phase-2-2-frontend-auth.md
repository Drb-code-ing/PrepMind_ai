# Phase 2.2 Frontend Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the frontend auth flow from localStorage mock accounts to the NestJS Auth API.

**Architecture:** Add a small API client, an in-memory auth session store, and TanStack Query hooks. Pages call the hooks, while existing Dexie business data continues to read the current user shape from the session store.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, Zustand, NestJS Auth API.

---

## File Structure

- Modify `apps/web/package.json`: add `@tanstack/react-query`.
- Create `apps/web/src/lib/api-client.ts`: fetch wrapper, envelope parsing, structured errors.
- Create `apps/web/src/lib/api-client.test.mts`: unit tests for success, API failure, invalid JSON, and network failure.
- Create `apps/web/src/lib/auth-api.ts`: typed Auth API methods.
- Modify `apps/web/src/stores/userStore.ts`: keep current user/session state only, remove local mock account authority.
- Create `apps/web/src/components/providers/query-provider.tsx`: QueryClient provider.
- Create `apps/web/src/components/providers/auth-session-provider.tsx`: refresh session on app boot.
- Modify `apps/web/src/app/layout.tsx`: wrap app with providers.
- Create `apps/web/src/hooks/use-auth.ts`: `useMe`, `useLogin`, `useRegister`, `useLogout`.
- Modify `apps/web/src/components/layout/auth-guard.tsx`: gate protected routes by backend-backed session.
- Modify `apps/web/src/app/page.tsx`: redirect based on backend-backed session.
- Modify `apps/web/src/app/(auth)/login/page.tsx`: replace local login with backend login.
- Modify `apps/web/src/app/(auth)/register/page.tsx`: replace local register with backend register.
- Modify `apps/web/src/components/chat/chat-sidebar.tsx`: replace local logout with backend logout.

## Task 1: Dependency And Provider Skeleton

- [ ] Add `@tanstack/react-query` to `apps/web/package.json` using Bun.
- [ ] Create `QueryProvider` with a stable browser `QueryClient`.
- [ ] Create `AuthSessionProvider` that renders children for now.
- [ ] Wrap `RootLayout` body content with `QueryProvider` and `AuthSessionProvider`.
- [ ] Run `bun --filter @repo/web lint`.
- [ ] Commit with `chore: add frontend query providers`.

## Task 2: API Client

- [ ] Write `api-client.test.mts` covering successful envelope parsing:

```ts
import assert from 'node:assert/strict';
import { createApiClient } from './api-client.ts';

const client = createApiClient({
  baseUrl: 'http://localhost:3001',
  fetchImpl: async () =>
    new Response(JSON.stringify({ success: true, data: { ok: true }, requestId: 'req_1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
});

const result = await client.get<{ ok: boolean }>('/health');
assert.deepEqual(result, { ok: true });
```

- [ ] Add tests for `success: false`, invalid JSON, and thrown fetch errors.
- [ ] Implement `ApiClientError` and `createApiClient`.
- [ ] Export a default `apiClient` using `NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'`.
- [ ] Run `node --experimental-strip-types apps/web/src/lib/api-client.test.mts`.
- [ ] Commit with `feat: add frontend api client`.

## Task 3: Auth API And Session Store

- [ ] Create `auth-api.ts` methods for `/auth/register`, `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`.
- [ ] Simplify `userStore.ts` to hold `currentUser`, `accessToken`, `setSession`, and `clearSession`.
- [ ] Keep `CurrentUser` compatible with existing consumers: `id`, `username`, `email`, `phone`.
- [ ] Map backend `AuthUser.name` to frontend `CurrentUser.username`, fallback to email prefix.
- [ ] Run `bun --filter @repo/web lint`.
- [ ] Commit with `feat: add frontend auth session state`.

## Task 4: TanStack Query Auth Hooks

- [ ] Create `use-auth.ts` with query key `['auth', 'me']`.
- [ ] Implement `useMe` using access token and `/auth/me`.
- [ ] Implement `useRefreshSession` helper for app boot.
- [ ] Implement `useLogin`, `useRegister`, `useLogout` mutations.
- [ ] Mutations must update user store and query cache together.
- [ ] Run `bun --filter @repo/web lint`.
- [ ] Commit with `feat: add auth query hooks`.

## Task 5: Page Migration

- [ ] Update `AuthSessionProvider` to call refresh once on boot and mark hydration complete.
- [ ] Update `AuthGuard` to show loading while session is hydrating or `/auth/me` is loading.
- [ ] Update home page redirect to use backend-backed current user.
- [ ] Update login page email flow to call `useLogin`; disable phone login as unavailable.
- [ ] Update register page to call `useRegister` and route to `/chat` after success.
- [ ] Update chat sidebar logout to call `useLogout`.
- [ ] Run `bun --filter @repo/web lint`.
- [ ] Commit with `feat: migrate frontend auth to backend`.

## Task 6: Verification

- [ ] Run `bun --filter @repo/web lint`.
- [ ] Run `bun --filter @repo/web build`.
- [ ] Run `bun --filter @repo/server lint`.
- [ ] Run `bun --filter @repo/server build`.
- [ ] Run `bun --filter @repo/server test`.
- [ ] Run `bun --filter @repo/server test:e2e` if Docker PostgreSQL is running.
- [ ] Update `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`, `CLAUDE.md`, and `AGENTS.md`.
- [ ] Commit docs with `docs: update Phase 2.2 auth flow`.

