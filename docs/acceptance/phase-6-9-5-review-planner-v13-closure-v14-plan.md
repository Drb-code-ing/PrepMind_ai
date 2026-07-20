# Phase 6.9.5 V13 Closure and V14 Plan

Date: 2026-07-20

## V13 terminal

The unique V13 branch command was started after all static/image/default-off
checks. Bun 1.3.14 then terminated with its own segmentation-fault report after
about 3.5 seconds. The only persisted V13 public artifact is the reservation
hash; the private root contains only the owner-lock leaf. There is no execution
manifest, checkpoint, failure record, synthetic account, trace, browser profile
or provider attempt.

The Docker server is healthy and `mock/default-off`: live calls and both model
gates are false, the DeepSeek environment field is empty, and the V13 browser
profile is absent. V13 has no recovery-admissible `operation_failed` terminal,
so recovery must not be invoked. Its reservation is retained as immutable
evidence and its product command must never be retried.

## V14 plan

V14 duplicates the isolated acceptance control plane under fresh roots and
proves that a complete V14 ledger leaves V11, V12 and V13 roots byte-identical.
The shared runner explicitly recognizes V14 and enforces its diagnostic
checkpoint sequence. The actual one-shot host process uses a Node CommonJS
TypeScript runner with two fixed V14 entry names. It transpiles only the
selected entry and code-defined relative TypeScript dependencies whose canonical
paths remain inside the approved scripts/review-agent roots or exactly two
standalone runtime bridges: `packages/database/src/index.ts` and
`packages/agent/src/review-planner-diagnostics.ts`. V7/V8/V9 evidence now uses
the diagnostics public subpath instead of loading the agent barrel. The runner
retains each module's original filename and `__dirname`; it does not create a
bundle. An inherited/unknown entry, blocked path or bootstrap failure returns
the same fixed `default_off` preflight response before roots are created. This
avoids the observed Bun process crash without changing the agent contract.

The V14 branch CLI was invoked once after final static/image verification, but
its host preflight returned the fixed `default_off` projection before owner,
ledger, Docker mutation, browser, API, provider or synthetic-resource work. Its
public, recovery and execution roots remain absent, so it did not create a
recovery-admissible terminal. The concrete cause is a strict historical
default-off comparison: the recreated ordinary Compose server was
`mock/default-off` but retained Chat's `AI_MODEL=deepseek-v4-flash`, while the
V8 acceptance preflight requires `deepseek-v4-pro` even when all model gates are
false. V14 must not be retried without a new explicit user decision; recovery is
not available for this root-absent state. See
`docs/acceptance/phase-6-9-5-review-planner-v14-preflight-blocked.md`.

## Review prompts

- Why is V13 not eligible for recovery even though it has a reservation?
- Why does the Node runner retain every TypeScript module's original filename
  instead of creating a bundle?
- Which immutable sentinels demonstrate that the new lineage cannot rewrite
  prior failed or recovered evidence?
