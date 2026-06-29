# Dev AI Mode Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a development-only UI/API switch that lets testers toggle `/api/chat` between mock and live mode without weakening live-call guards.

**Architecture:** Add a small `dev-ai-mode` library that owns enabled checks, in-memory requested mode, and status shaping. Expose it through `GET`/`PUT /api/dev/ai-mode`, let `/api/chat` pass the optional override into `getAiProviderStatus`, and render a compact switch inside `/agent-trace`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node test runner, existing `/api/chat` provider guard.

---

## File Structure

- Create `apps/web/src/lib/dev-ai-mode.ts`: local-only switch state, status calculation, mode validation.
- Create `apps/web/src/lib/dev-ai-mode.test.mts`: TDD coverage for enabled checks, mode updates, and live guard interaction.
- Modify `apps/web/src/lib/ai-provider.ts`: accept an optional provider mode override while preserving all guards.
- Modify `apps/web/src/lib/ai-provider.test.mts`: prove override cannot bypass `AI_ENABLE_LIVE_CALLS` or missing API key.
- Create `apps/web/src/app/api/dev/ai-mode/route.ts`: expose `GET` and `PUT`.
- Modify `apps/web/src/app/api/chat/route.ts`: read dev override and pass it to provider status.
- Create `apps/web/src/hooks/use-dev-ai-mode.ts`: React Query helper for the UI.
- Modify `apps/web/src/app/(main)/agent-trace/page.tsx`: render the switch only when enabled.
- Modify docs: `docs/dev-start.md`, `docs/ai-behavior-acceptance.md`, `docs/data-flow.md`.

## Task 1: Provider Override Tests

**Files:**
- Modify: `apps/web/src/lib/ai-provider.test.mts`
- Modify: `apps/web/src/lib/ai-provider.ts`

- [ ] **Step 1: Write failing tests**

Add tests showing that an explicit mock override wins over live env, and a live override is still blocked by `AI_ENABLE_LIVE_CALLS`.

```ts
test('allows an explicit mock override even when env mode is live', () => {
  const status = getAiProviderStatus(
    {
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: 'true',
      DEEPSEEK_API_KEY: 'sk-test',
    },
    { modeOverride: 'mock' },
  );

  assert.equal(status.configured, true);
  if (status.configured) {
    assert.equal(status.mode, 'mock');
    assert.equal(status.model, 'mock-prepmind-chat');
  }
});

test('does not let a live override bypass the live-call guard', () => {
  const status = getAiProviderStatus(
    {
      AI_PROVIDER_MODE: 'mock',
      AI_ENABLE_LIVE_CALLS: '',
      DEEPSEEK_API_KEY: 'sk-test',
    },
    { modeOverride: 'live' },
  );

  assert.equal(status.configured, false);
  assert.equal(status.mode, 'live');
});
```

- [ ] **Step 2: Verify red**

Run: `bun --filter @repo/web test -- src/lib/ai-provider.test.mts`

Expected: FAIL because `getAiProviderStatus` does not accept the second argument.

- [ ] **Step 3: Implement minimal provider override**

Change the signature to:

```ts
export function getAiProviderStatus(
  env: NodeJS.ProcessEnv = process.env,
  options: { modeOverride?: 'mock' | 'live' | null } = {},
): AiProviderStatus {
  const mode = options.modeOverride ?? (env.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock');
  // keep the existing body
}
```

- [ ] **Step 4: Verify green**

Run: `bun --filter @repo/web test -- src/lib/ai-provider.test.mts`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `test(web): cover ai provider mode override`

## Task 2: Dev Mode State API

**Files:**
- Create: `apps/web/src/lib/dev-ai-mode.ts`
- Create: `apps/web/src/lib/dev-ai-mode.test.mts`
- Create: `apps/web/src/app/api/dev/ai-mode/route.ts`

- [ ] **Step 1: Write failing tests**

Test disabled behavior, enabled status, invalid mode rejection, valid mode update, and live availability.

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDevAiModeStatus,
  getDevAiModeOverride,
  resetDevAiModeForTest,
  setDevAiMode,
} from './dev-ai-mode.ts';

test('is disabled unless explicitly enabled outside production', () => {
  resetDevAiModeForTest();
  assert.equal(buildDevAiModeStatus({ NODE_ENV: 'development' }).enabled, false);
  assert.equal(
    buildDevAiModeStatus({
      NODE_ENV: 'production',
      AI_DEV_MODE_SWITCH_ENABLED: 'true',
    }).enabled,
    false,
  );
});

test('defaults to mock when enabled', () => {
  resetDevAiModeForTest();
  const status = buildDevAiModeStatus({
    NODE_ENV: 'development',
    AI_DEV_MODE_SWITCH_ENABLED: 'true',
  });

  assert.equal(status.enabled, true);
  assert.equal(status.activeMode, 'mock');
  assert.equal(getDevAiModeOverride({ NODE_ENV: 'development', AI_DEV_MODE_SWITCH_ENABLED: 'true' }), 'mock');
});

test('updates requested mode only for mock or live', () => {
  resetDevAiModeForTest();
  const env = { NODE_ENV: 'development', AI_DEV_MODE_SWITCH_ENABLED: 'true' };

  assert.deepEqual(setDevAiMode('live', env), { ok: true });
  assert.equal(buildDevAiModeStatus(env).requestedMode, 'live');
  assert.equal(setDevAiMode('bad', env).ok, false);
});
```

- [ ] **Step 2: Verify red**

Run: `bun --filter @repo/web test -- src/lib/dev-ai-mode.test.mts`

Expected: FAIL because `dev-ai-mode.ts` does not exist.

- [ ] **Step 3: Implement minimal library**

Add exported helpers:

```ts
export type DevAiMode = 'mock' | 'live';

let requestedMode: DevAiMode = 'mock';

export function isDevAiModeSwitchEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== 'production' && env.AI_DEV_MODE_SWITCH_ENABLED === 'true';
}

export function getDevAiModeOverride(env: NodeJS.ProcessEnv = process.env): DevAiMode | null {
  return isDevAiModeSwitchEnabled(env) ? requestedMode : null;
}
```

Also add `buildDevAiModeStatus`, `setDevAiMode`, and `resetDevAiModeForTest`.

- [ ] **Step 4: Add API route**

`GET` returns the status. `PUT` parses JSON and calls `setDevAiMode`. Disabled endpoint returns `404`.

- [ ] **Step 5: Verify green**

Run: `bun --filter @repo/web test -- src/lib/dev-ai-mode.test.mts src/lib/ai-provider.test.mts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat(web): add dev ai mode switch api`

## Task 3: Chat Integration

**Files:**
- Modify: `apps/web/src/app/api/chat/route.ts`

- [ ] **Step 1: Wire override**

Import `getDevAiModeOverride` and change:

```ts
const providerStatus = getAiProviderStatus();
```

to:

```ts
const providerStatus = getAiProviderStatus(process.env, {
  modeOverride: getDevAiModeOverride(),
});
```

- [ ] **Step 2: Verify**

Run: `bun --filter @repo/web test -- src/lib/ai-provider.test.mts src/lib/chat-api-policy.test.mts src/lib/dev-ai-mode.test.mts`

Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `feat(web): apply dev ai mode to chat`

## Task 4: Agent Trace UI

**Files:**
- Create: `apps/web/src/hooks/use-dev-ai-mode.ts`
- Modify: `apps/web/src/app/(main)/agent-trace/page.tsx`

- [ ] **Step 1: Add hook**

Use `@tanstack/react-query` to fetch and update `/api/dev/ai-mode`.

- [ ] **Step 2: Render switch**

Add a compact section under the summary card. Render nothing when `enabled` is false. Disable the `Live` button when `liveAllowedByEnv` is false.

- [ ] **Step 3: Verify lint**

Run: `bun --filter @repo/web lint`

Expected: PASS.

- [ ] **Step 4: Commit**

Commit message: `feat(web): add dev ai mode switch ui`

## Task 5: Documentation and Final Verification

**Files:**
- Modify: `docs/dev-start.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/data-flow.md`

- [ ] **Step 1: Update docs**

Document this startup shape:

```powershell
$env:AI_PROVIDER_MODE='mock'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:AI_DEV_MODE_SWITCH_ENABLED='true'
bun --filter @repo/web dev
```

Explain that live still requires login and a configured API key.

- [ ] **Step 2: Run verification**

Run:

```powershell
bun --filter @repo/web test
bun --filter @repo/web lint
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Optional browser smoke**

With dev server running, open `http://localhost:3000/agent-trace`, switch modes, then call Chat and inspect `x-prepmind-ai-mode`.

- [ ] **Step 4: Commit**

Commit message: `docs: document dev ai mode switch`
