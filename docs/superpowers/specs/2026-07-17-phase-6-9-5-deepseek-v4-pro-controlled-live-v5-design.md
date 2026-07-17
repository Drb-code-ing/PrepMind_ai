# Phase 6.9.5 DeepSeek V4 Pro controlled-Live v5 design

## Decision and scope

This v5 profile is the approved, independent completion attempt for the
read-only `ReviewAgent` and `PlannerAgent` model path. It uses the user's
provided DeepSeek V4 Pro product/pricing snapshot dated 2026-07-17:

- OpenAI-compatible host: `https://api.deepseek.com`;
- model identity: `deepseek-v4-pro`;
- JSON Output: supported;
- non-cached input/output: CNY 3 / CNY 6 per million tokens;
- cached input: CNY 0.025 per million tokens (not relied on for a cap);
- concurrency limit: 500.

The actual OpenAI-compatible client root is the existing canonical
`https://api.deepseek.com/v1`. V5 does not change normal Chat, does not use
Qwen for Review/Planner, and does not begin Phase 6.10 memory work.

V1--V4 are immutable historical terminal attempts. Each remains in its own
evidence directory and has already consumed its own once marker. V5 neither
retries, edits, deletes, aggregates, nor reinterprets their results.

## Root-cause boundary and selected transport

The failed V4 diagnostic used `createFirstPartyDeepSeekV4Runtime`, a
direct-fetch adapter that parses the provider HTTP response and the completion
content itself. It records a safe `provider_json_parse` stage when that
adapter cannot reduce the response to its strict object. Normal product
Review/Planner candidates, however, use
`createOpenAICompatibleStructuredExecutor` and Vercel AI SDK `generateObject`
in `mode: 'json'`.

Therefore V5 deliberately tests the production transport rather than cloning
the failed direct adapter:

```text
DeepSeek V4 Pro -> OpenAI-compatible /v1 Chat Completions
  -> JSON-object transport / AI SDK mode json / maxRetries 0
  -> canonical local Zod candidate schema
  -> deterministic fact merger and read-only suggestion response
```

The request contains no tools, `tool_choice`, JSON-schema wire extension,
provider search extension, user account facts, write capability, or retry.
DeepSeek is only asked to produce JSON; local Zod remains authoritative for
shape, indexes, enum values, lengths, and cross-field rules. The deterministic
merger remains authoritative for FSRS facts, task dates, priorities, links,
permissions, and persistence. A failed call, timeout, invalid schema, invalid
usage, or exhausted budget produces the existing restrictive deterministic
fallback.

## Gates, permissions, and bounded cost

The V5 CLI is opt-in and runs only when all of the following exact conditions
hold:

```text
AI_PROVIDER_MODE=live
AI_ENABLE_LIVE_CALLS=true
REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED=true
AI_MODEL=deepseek-v4-pro
AI_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=<canonical existing credential>
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
```

It uses the regular server-only Review/Planner executor configuration but does
not expose it in stdout, evidence, traces, HTTP, browser data, or documents.
The model may emit only a candidate. It cannot call tools, read other users,
create a future review task, alter a review plan, alter a memory, write a
database record, or bypass local safety/policy checks.

V5 first reserves one new evidence record, runs exactly one fact-free Review
schema canary, then runs the frozen v2 48-case evaluator only when that canary
returns canonical valid JSON **and positive, safe-integer provider input and
output usage**. The evaluator has 26 mandatory zero-call boundary cases and
22 eligible runtime cases, each with at most one provider attempt. No retries
are allowed.

The user-approved hard cap is CNY 1.00. The profile pre-reserves the stricter
non-cached worst case:

```text
input  = 96 + 22 * 1950 = 42,996 tokens
output = 32 + 22 * 440  =  9,712 tokens
cap    = 42,996 / 1,000,000 * 3 + 9,712 / 1,000,000 * 6
       = CNY 0.18726 < CNY 1.00
```

The V5 evidence records only the fixed pricing profile id, `CNY`, safe integer
token totals, capped CNY estimate, pass/fail booleans, bounded diagnostic
codes, and aggregate quality counters. It never stores prompts, candidates,
provider output/errors, credentials, URLs, headers, user facts, or stack
traces. Existing online Agent Trace amounts are USD-labelled and therefore
remain `pricingKnown=false` for V4 Pro; V5 will not put CNY into a USD field or
invent an exchange rate.

## Immutable evidence lineage

V5 has a dedicated profile, evidence schema, directory, confirmation token,
and once marker:

```text
profile: phase-6.9.5-review-planner-controlled-live-v5-deepseek-v4-pro
directory: docs/acceptance/evidence/phase-6-9-5-controlled-live-v5-deepseek-v4-pro
marker: .review-planner-controlled-live-v5-deepseek-v4-pro.once
confirmation: --confirm-controlled-live-v5-deepseek-v4-pro
```

Before reserve, before the provider boundary, and after finalization, V5 takes
and verifies SHA-256 snapshots of the V1--V4 evidence directories and their
once markers. Any missing, added, renamed, changed, reparse-point, or hash
mismatch fails closed. A mismatch before the provider boundary yields zero
provider attempts; a mismatch after an attempt closes V5 with evidence I/O
failure. V5 may write only its own native handle-relative directory.

## Acceptance sequence and terminal criteria

1. No-network tests prove DeepSeek V4 Pro exact config binding, JSON-mode/no
   retry transport, positive-usage rejection, CNY cap, historical hash
   preservation, once-only behavior, and default-off product gates.
2. A fresh Mock report proves all 48 cases, including the 26 real zero-call
   guard traversals. It is labelled `mock_quality_not_evidence`.
3. An independent implementation review confirms the code and documents match
   this design.
4. One exact V5 confirmation runs the canary and, only on success, the frozen
   48-case controlled-Live evaluation.
5. It may proceed only with 48 entries, 26 verified zero-call cases, 22 runtime
   attempts, 100% strict schema success, zero critical failures, at least 90%
   semantic score, valid positive provider usage, p95 at or below 4.5 seconds,
   and non-cached CNY estimate at or below CNY 1.00.
6. Only then, Docker receives temporary server-only Review/Planner business
   gates. An authenticated synthetic account verifies suggestions and the
   visible `/plan` and `/today` surfaces. The browser remains open. Gates are
   restored to `false`, only synthetic account/trace data is deleted, and no
   Docker service, volume, cache, or unrelated data is removed.
7. The branch is independently reviewed, merged with `--no-ff` into `main`,
   then key static/Docker/browser checks are repeated on `main` before pushing
   the merge to `origin`.

Any canary, quality, cost, evidence, or cleanup failure is terminal for V5;
it never silently falls back to Qwen or turns on the product gates.

## Non-goals

- No automatic provider fallback or arbitrary endpoint/model/price from env.
- No mutation of the current global Chat model selection.
- No real-model write authority, tool execution, or memory injection.
- No claim that a Mock result, a canary alone, or an unmerged branch proves
  production availability.
