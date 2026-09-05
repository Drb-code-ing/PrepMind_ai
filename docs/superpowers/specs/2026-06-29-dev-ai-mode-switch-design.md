# Dev AI Mode Switch Design

## Context

PrepMind currently protects real model calls with two environment switches:

- `AI_PROVIDER_MODE=live`
- `AI_ENABLE_LIVE_CALLS=true`

This is safe, but awkward during Phase 6 acceptance because switching between mock and live usually means editing env and restarting the frontend. The new feature adds a development-only switch so a tester can change Chat between mock and live while the dev server is running.

## Goals

- Let a developer switch `/api/chat` between mock and live from the app UI.
- Keep mock as the default.
- Keep real model calls guarded by server-side config, API key availability, and login validation.
- Avoid exposing a production runtime switch.
- Keep model calls centralized in `apps/web/src/app/api/chat/route.ts`.
- Keep `@repo/agent` deterministic and free of API keys or model calls.

## Non-Goals

- This does not add a production feature flag console.
- This does not let anonymous users call live models.
- This does not move model provider logic into `packages/agent`.
- This does not persist the selected dev mode across server restarts.

## Recommended Approach

Use a local-only Next.js API route with in-memory state:

- `GET /api/dev/ai-mode`
- `PUT /api/dev/ai-mode`

The endpoint is enabled when the runtime is explicitly local:

- `NODE_ENV !== 'production'`, or
- `PREPMIND_LOCAL_DEV_TOOLS_ENABLED=true` for the local Docker standalone image.

`AI_DEV_MODE_SWITCH_ENABLED=false` explicitly disables the endpoint; otherwise it is visible in a local runtime. The endpoint reports the base environment mode, active mode, and whether a real provider credential is ready. Mock remains the process-start default. Selecting Live creates an in-memory effective environment for subsequent Chat requests, without editing `.env` or restarting the Web process.

The effective environment sets the two global Live values, defaults only missing Chat-chain component gates, normalizes the DeepSeek `/v1` endpoint, and lets component-specific Chat credentials fall back to the generic DeepSeek key. One effective snapshot is passed to Router/Verifier, Tutor, Retriever query rewrite, and FinalResponse. Explicit component `false` values remain authoritative.

## Data Flow

1. User opens `/agent-trace`.
2. The page fetches `GET /api/dev/ai-mode`.
3. In a local runtime the UI always shows a small `Mock / Live` segmented control.
4. User switches mode.
5. UI sends `PUT /api/dev/ai-mode` with `{ "mode": "mock" }` or `{ "mode": "live" }`.
6. Future `/api/chat` requests resolve provider mode from the dev override.
7. If active mode is live, `/api/chat` still enforces provider configuration and canonical authenticated access before constructing model runtimes.
8. Chat responses continue to expose `x-prepmind-ai-mode=mock|live` for acceptance checks.

## API Contract

`GET /api/dev/ai-mode` returns:

```json
{
  "enabled": true,
  "envMode": "mock",
  "activeMode": "mock",
  "requestedMode": "mock",
  "liveAllowedByEnv": false,
  "message": "Live mode requires AI_ENABLE_LIVE_CALLS=true and a configured API key."
}
```

`PUT /api/dev/ai-mode` accepts:

```json
{
  "mode": "mock"
}
```

Invalid modes return `400`. Disabled endpoint returns `404` so production does not advertise a hidden control.

## UI Placement

Place the switch in `/agent-trace`, because this page is already the Phase 6 debugging and observability surface. The control should be compact:

- Label: `AI 模式`
- Options: `Mock` and `Live`
- Live remains selectable even when the provider credential is missing; the status copy explains readiness and Chat fails explicitly rather than falling back to Mock.

The switch should not appear as normal product functionality on Chat or Profile.

## Safety Rules

- Mock remains default.
- Shell/deployment Live still requires `AI_ENABLE_LIVE_CALLS=true`; local UI selection creates the equivalent in-memory value for the current process.
- Live mode requires a configured `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`.
- Live chat still requires a valid access token through `validateChatLiveAccess`.
- The dev endpoint is disabled in ordinary production and when explicitly set to `AI_DEV_MODE_SWITCH_ENABLED=false`.
- The override is process-local memory, not database state.

## Testing Plan

Follow TDD:

1. Add tests proving dev switch disabled by default and in production.
2. Add tests proving valid modes can be set only when enabled.
3. Add tests proving live override cannot bypass `AI_ENABLE_LIVE_CALLS` or missing API key.
4. Add tests proving `/api/chat` continues to use mock by default.
5. Add tests around UI helper behavior where practical.

Manual smoke:

1. Start frontend with `AI_DEV_MODE_SWITCH_ENABLED=true`.
2. Confirm `/agent-trace` shows the switch.
3. Switch to mock and send Chat; confirm `x-prepmind-ai-mode=mock`.
4. Start with live guards and API key, switch to live, log in, send Chat; confirm `x-prepmind-ai-mode=live`.
5. Try live without login; confirm `/api/chat` rejects it.

## Documentation

Update:

- `docs/dev-start.md`
- `docs/ai-behavior-acceptance.md`
- `docs/data-flow.md` if the Chat mode boundary changes materially

The docs must make clear that this is a development convenience, not a production override.

## Self-Review

- No placeholder requirements remain.
- Production safety is explicit.
- The design keeps the existing provider boundary.
- The design remains small enough for one implementation step.
