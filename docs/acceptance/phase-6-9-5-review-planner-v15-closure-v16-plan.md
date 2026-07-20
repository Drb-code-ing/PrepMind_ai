# Phase 6.9.5 V15 Closure and V16 Plan

Date: 2026-07-20

## V15 closure

The unique V15 branch command returned `default_off` at preflight. It made no
owner, ledger, execution, Docker, browser, API, provider or synthetic-resource
change; all V15 public, recovery and execution roots remain absent. Recovery
is not admissible and V15 must never be retried.

The exact cause was a safe ordinary Compose difference: V15 required
`AI_BASE_URL=https://api.deepseek.com`, while Compose correctly supplied the
same official OpenAI-compatible endpoint as `https://api.deepseek.com/v1`.
All other default-off fields were validated as closed.

## V16 plan

V16 creates a fresh namespace and accepts only those two exact official URLs.
It preserves all non-URL default-off checks, V8 historical semantics and
V11--V15 byte immutability. Its durable receipt records `baseUrl` and `model`,
and its recovery path explicitly receives the V16 validator.

No V16 product/recovery, Docker, browser, API or provider command has run
while this plan was written. Gates remain false. After final static/Docker
preflight, run exactly once:

```powershell
bun --filter @repo/server accept:review-planner:v16:product -- --confirm-v16-review-planner-product-acceptance --environment=branch
```

Only `passed` permits merge, main replay and push.
