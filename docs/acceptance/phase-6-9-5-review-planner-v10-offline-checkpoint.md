# Phase 6.9.5 Review / Planner V10 Controlled-Live Outcome

Date: 2026-07-19
Status: the unique V10 controlled-Live completed successfully; product gates remain default-off. The recovered V8 branch product-acceptance attempt is read-only, so a new isolated V10 product-acceptance lineage is required next.

## What This Checkpoint Proves

V10 is the smallest repair to the V9 semantic-quality contract. The model may return only the two decisions production actually applies:

- Review: `focusIndexes`
- Planner: `blockOrder`

The server still owns JWT owner isolation, facts, FSRS, minutes, links, all write permissions, deterministic strategy wording, and the final read-only suggestion. The complete deterministic snapshot is safety-scanned before its numbered options are projected to the model.

V9 remains immutable: its only controlled-Live is `finalized / invalid_attempted / closed / quality_gate_failed` with `23` provider attempts, `22` paired admissions, quality `30/48`, semantic `4/22`, and `2` critical failures. V10 neither retries nor reinterprets that result.

## Verified Offline Evidence

- V10/V8/V9/composition Jest: `266/266`
- Agent suite: `409/409`; Agent typecheck: pass
- Server lint, full test, build, and types: pass
- Web lint, test, and build: pass
- AI test and typecheck; Compose `config --quiet`: pass
- V10 native evidence tests: `3/3`
- `git diff --check`: pass
- Fresh V1--V9 immutable manifest: `36` entries, SHA-256 `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d`
- The V1--V9 manifest was unchanged at `36` entries / `61a6e4a956784a59a8b8639d4c94d6fd870bce5dd8549a026abf02a0e7cb769d` before the V10 reservation.

These offline gates did not by themselves prove provider quality, product behavior, Docker behavior, browser behavior, cost, or Phase 6.9.5 completion.

## Controlled-Live Result

The approved command below ran once from a clean HEAD and exited `0`. The public reader was fresh-read five times and remained `complete / passed` with `23` provider attempts and `22` paired admissions. Its V10 v3 safe aggregate reports:

- `48/48` strict successes and quality passes; `0` critical failures
- schema, quality, P95, usage, attempt, admission, and cost gates all passed
- P95 `1465ms`; usage `5764` input / `232` output tokens
- CNY `0.018684`, within the CNY `1.00` hard cap

The root `.env` was only injected by `--env-file=.env`; it was not edited. After the process, the ordinary environment remains mock/default-off: V8/V9/V10 eval gates are absent or false as applicable, and `REVIEW_AGENT_MODEL_ENABLED` / `PLANNER_AGENT_MODEL_ENABLED` remain false.

The consumed command was:

```powershell
$env:AI_PROVIDER_MODE='live'
$env:AI_ENABLE_LIVE_CALLS='true'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED='true'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED='false'
$env:REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED='false'
$env:REVIEW_AGENT_MODEL_ENABLED='false'
$env:PLANNER_AGENT_MODEL_ENABLED='false'
$env:AI_MODEL='deepseek-v4-pro'
$env:AI_BASE_URL='https://api.deepseek.com/v1'
$env:REVIEW_AGENT_MODEL_TIMEOUT_MS='4500'
$env:PLANNER_AGENT_MODEL_TIMEOUT_MS='4500'
bun --env-file=.env --filter @repo/server eval:review-planner:live:v10:semantic-quality -- --confirm-controlled-live-v10-deepseek-v4-pro-semantic-quality
```

It used JSON-object non-thinking transport, a `4500ms` timeout, `26` verified zero-call cases, and the fixed CNY `1.00` hard cap. V8/V9 eval gates and both product gates were explicitly `false` during the run and remain default-off.

## Durable Safety Boundary

V10 owns a separate profile, confirmation, eval gate, evidence directory, once marker, stage manifest, and success seal. Before reservation it snapshots V1--V9 and fails closed on drift. Its safe writer and public reader accept only strict aggregate lane counts; they reject unknown fields and prompt, snapshot, model output, raw error, URL, credential, cookie, stack, case entry, and per-case duration or usage.

The successful V10 evidence is immutable. It must not be retried, deleted, overwritten, reconstructed, or combined with other lineages. No Docker, browser, Mock, or historical result may alter or substitute this controlled-Live result.

## Exact Next Actions

1. Do not reset, reuse, or extend the recovered V8 branch product-acceptance evidence. Its omitted-preflight-argument zero-call failure and later runner parse failure were sealed as recovery-only; recovery made zero new provider calls and cleanup reached zero.
2. Design and implement a new isolated V10 product-acceptance lineage, then perform its branch Docker/headed-browser acceptance with one product gate at a time and restore both to `false`.
3. Only after that new lineage's branch acceptance, cleanup, `--no-ff` main merge, main replay, and evidence review may the phase be declared complete and `origin/main` be pushed.
