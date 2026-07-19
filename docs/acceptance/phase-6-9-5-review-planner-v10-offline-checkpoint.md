# Phase 6.9.5 Review / Planner V10 Offline Checkpoint

Date: 2026-07-19
Status: offline gates passed; the unique V10 controlled-Live has **not** run.

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
- V10 evidence directory, once marker, and success seal: absent

This checkpoint does not prove provider quality, product behavior, Docker behavior, browser behavior, cost, or Phase 6.9.5 completion.

## One-Shot Preconditions

Use a clean HEAD and a fresh PowerShell process. The root `.env` is input only through `--env-file=.env`; do not edit `.env` and do not persist a gate there.

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

The profile uses JSON-object non-thinking transport, a `4500ms` timeout, at most `23` provider attempts / `22` paired admissions, `26` verified zero-call cases, and a CNY `1.00` hard cap. V8/V9 eval gates and both product gates must stay explicitly `false`.

## Durable Safety Boundary

V10 owns a separate profile, confirmation, eval gate, evidence directory, once marker, stage manifest, and success seal. Before reservation it snapshots V1--V9 and fails closed on drift. Its safe writer and public reader accept only strict aggregate lane counts; they reject unknown fields and prompt, snapshot, model output, raw error, URL, credential, cookie, stack, case entry, and per-case duration or usage.

Any non-success terminal result consumes and seals V10. It must not be retried, deleted, overwritten, reconstructed, or combined with other lineages. No V10 failure may be replaced by a Mock, Docker, browser, or historical result.

## Exact Next Actions

1. Independently review this checkpoint and the V10 code/authority boundary.
2. Run the single controlled-Live command above once, then read only its durable terminal evidence.
3. Continue to branch Docker and headed-browser acceptance only when the V10 reader reports committed success; restore product gates to `false` after each component check.
4. Only after branch acceptance, cleanup, `--no-ff` main merge, main replay, and evidence review may the phase be declared complete and `origin/main` be pushed.
