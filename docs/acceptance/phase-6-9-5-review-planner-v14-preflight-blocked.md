# Phase 6.9.5 V14 Branch Preflight Blocked

Date: 2026-07-20

## Command and result

After commit `b808d97`, the authorised V14 branch CLI was invoked once with the
V14 product confirmation and `--environment=branch`. It returned only:

```json
{"stage":"preflight","status":"blocked","code":"default_off"}
```

The result is not a semantic-quality, provider, cost or product-acceptance
result.

## Boundary evidence

- Server tests had passed: 138 suites, 1605 tests, with 30 configured skips.
- Agent tests had passed: 410 tests.
- Server build, Agent typecheck/lint, Server lint, Compose config and the
  server image build had passed before the command.
- The recreated Docker server was healthy, `AI_PROVIDER_MODE=mock`, live calls
  and both Review/Planner model gates were `false`, and neither provider key was
  injected.
- V14 public, recovery and execution roots are all absent after the command.

Therefore the command did not reach owner acquisition, ledger reservation,
Docker mutation, visible browser launch, API/provider invocation or synthetic
resource creation. No recovery-admissible `operation_failed` terminal exists.

## Root cause

The V14 host delegates its preflight default-off receipt to the historical V8
acceptance boundary. That boundary requires `AI_MODEL=deepseek-v4-pro` even
while the provider mode, live calls and both model gates are disabled. The
ordinary Compose server correctly restored Mock/default-off, but retained the
Chat default `AI_MODEL=deepseek-v4-flash`; the strict receipt rejected that
otherwise safe state.

## Required next authority

V14 must not be retried. Recovery is inapplicable because no V14 terminal or
root exists. A new user decision is required before either changing the strict
default-off contract and creating a new lineage, or choosing another path.
