# Phase 6.9.5 Review / Planner controlled-Live v3 profile design

## 1. Decision

Phase 6.9.5 has not passed Live acceptance. The completed engineering work is
still useful, but the two consumed diagnostics are terminal historical facts:

| Profile | Final safe result | Consequence |
| --- | --- | --- |
| v1 | `invalid_attempted / structured_output / closed / attempts=1 / usageKnown=false` | Its evidence and `.review-planner-controlled-live.once` marker remain read-only. It cannot be rerun. |
| v2 | `invalid_attempted / structured_output / closed / attempts=1 / usageKnown=false` | Its evidence and `.review-planner-controlled-live-v2.once` marker remain read-only. It cannot be rerun. |

Neither profile proves a zero-call boundary, a zero cost, semantic quality, or
production availability. Their counters must never be added to each other or
to a future run. In particular, v3 is not a retry of either profile: it is a
newly designed, independently reviewed profile with a new evidence schema,
directory, once lock, run identity, and decision.

The purpose of v3 is narrow. It lets the controlled diagnostic expose one
static, non-content structured-output *stage* when that is the trusted runtime
classification, so that a future `structured_output` closure is actionable
without keeping a raw provider error. It does not relax any model authority,
budget, timeout, safety, evidence, or default-off rule.

## 2. Why v3 is necessary

The v2 request fixed the known local prompt/schema mismatch: the diagnostic
asked for a valid `REVIEW_MODEL_CANDIDATE_SCHEMA` object in JSON-object mode.
Its resulting generic `structured_output` category still deliberately omitted
whether the trusted provider boundary classified the failure as JSON parsing,
provider type validation, or an absent generated object. That omission is
correct for v1/v2, whose persisted contract is already frozen, but it leaves a
future root-cause design unable to distinguish those three non-content stages.

`@repo/ai` now carries the stage only as a trusted runtime-trace field, created
at the provider adapter boundary. The candidate sanitizer deliberately removes
it before Review/Planner production suggestions, observations, Agent Trace,
HTTP DTOs, headers, browser state, and paired-evaluation entries. v3 may copy
that field only through a new controlled-diagnostic mapper into a v3-only safe
summary. This is a diagnostic evidence exception, not a production telemetry
feature.

The only legal stage values are the fixed enum below. They identify a boundary,
not a provider message, content sample, status code, model name, endpoint, or
request detail.

```ts
const CONTROLLED_LIVE_V3_STRUCTURED_OUTPUT_STAGES = [
  'provider_json_parse',
  'provider_type_validation',
  'provider_object_missing',
] as const;
```

## 3. v3 profile and evidence contract

The implementation must introduce an explicit immutable profile descriptor,
not change a v1/v2 constant in place.

```ts
const CONTROLLED_LIVE_V3_PROFILE = {
  id: 'phase-6.9.5-review-planner-controlled-live-v3',
  evidenceSchemaVersion:
    'phase-6.9.5-review-planner-controlled-live-evidence-v3',
  evidenceDirectory: 'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
  onceLockLeaf: '.review-planner-controlled-live-v3.once',
} as const;
```

The v3 evidence schema remains strict and content-free. It retains the existing
safe fields (`schemaVersion`, state, status, gate, provider attempt count,
usage-known flag, and generic diagnostic code) and adds only the optional
`structuredOutputStage` enum. The cross-field invariant is mandatory:

```ts
structuredOutputStage !== undefined
  => status === 'invalid_attempted'
  && gate === 'closed'
  && providerAttemptCount === 1
  && usageKnown === false
  && diagnosticCode === 'structured_output'
```

The inverse is intentionally not required: a generic `structured_output`
closure may have no stage when it was a local runtime schema failure or an
unrecognised safe provider boundary. `structuredOutputStage` is therefore never
used to make a pass/fail decision, infer usage, or authorize a retry.

The field is allowed only in the v3 controlled-diagnostic evidence and its CLI
safe summary. It is forbidden in all of the following, including v1/v2
serializers and historical files:

- Review/Planner candidate result sanitizer and `modelObservations`;
- account Agent Trace persistence, HTTP response headers/DTOs, Web state and
  browser rendering;
- paired-evaluation case entries and 48-case report;
- all raw provider artifacts, including prompts, generated JSON, errors,
  causes, URLs, headers, status codes, credentials, token/cost details, and
  user facts.

## 4. Safety and authority stay unchanged

V3 remains a server-only, fact-free diagnostic using DeepSeek-compatible
JSON-object transport and the canonical Review schema. It uses one diagnostic
provider attempt, zero retry, a 4500 ms timeout, 96 maximum input tokens, 32
maximum output tokens, and a fresh one-call diagnostic budget. It never reads
the database, `/review-agent/suggestions`, browser storage, a user session, or
production Agent Trace.

The diagnostic may start only while both business gates are explicitly false:

```text
REVIEW_AGENT_MODEL_ENABLED=false
PLANNER_AGENT_MODEL_ENABLED=false
```

The general live double gate, controlled-eval gate, HTTPS provider
configuration, credential, known price and strict executor preflight remain
required. Failure in any pre-provider condition creates no provider attempt
and leaves the gate closed. Once a v3 reservation is made, every terminal path
must preserve a parseable v3 safe evidence record; a failed reservation blocks
before the provider boundary.

V3 uses the existing Windows HANDLE-relative/no-reparse writer or the existing
non-Windows bound-parent fallback. Its `v3` lock and evidence may only be
created below the v3 directory. A root/ancestor swap, junction, parent drift,
write/replace/delete error, or conflicting v3 lock fails closed and makes zero
provider calls. V1/v2 directories, locks, and evidence are neither opened for
write nor removed as part of v3.

## 5. Private-stage mapping

The controlled factory reads `result.trace.structuredOutputStage` only after
the runtime has already produced a trusted failed result. The mapper must
discard it unless every condition below is true:

```ts
result.ok === false
result.error.code === 'PROVIDER_ERROR'
result.error.providerFailureCategory === 'structured_output'
result.trace.providerFailureCategory === 'structured_output'
result.trace.structuredOutputStage is one of the v3 enum values
```

The mapped v3 result stays `diagnosticCode: 'structured_output'`; the optional
stage is merely its bounded subcategory. A runtime `SCHEMA_INVALID`, timeout,
abort, malformed trace, hostile injected runtime, unmatched error/trace pair,
or non-structured provider category persists no stage. V1/v2 continue to map
all of those cases to their historical generic contract, including when the
private runtime trace happens to contain a stage.

## 6. Required zero-network proof before v3 is armed

No provider credential is permitted in this proof. All executor dependencies
are injected fakes and any unexpected network call must fail the test. Fresh
tests must prove:

1. v1/v2 safe serializers reject `structuredOutputStage`; their existing
   evidence and once markers are byte-for-byte unchanged before and after a v3
   reservation attempt.
2. A v3 trusted JSON-parse, type-validation, or object-missing signal produces
   exactly `invalid_attempted / closed / attempts=1 / usageKnown=false /
   structured_output` plus the matching static stage, and no canary content.
3. A local schema-invalid result, generic structured-output result without a
   trusted stage, mismatched error/trace pair, forged stage, timeout, abort,
   budget failure, and preflight failure expose no stage and remain closed.
4. A valid diagnostic object with positive usage is `complete`, carries no
   stage, and only then permits the injected 48-case runner to be reached.
5. V3 has a distinct directory/lock/schema/run id. A v3 lock or final evidence
   blocks a second v3 invocation, while existing v1/v2 locks do not substitute
   for the v3 lock or alter v3's decision.
6. No stage appears in `@repo/agent` sanitized candidates, production
   observations, account Trace/DTO projection, Web model status, CLI output
   outside the v3 command, or paired report entries.
7. Native evidence regression tests still reject a junction, parent rename,
   root swap, and recovery race without a root-external write, leftover file,
   or provider call.

After focused tests, the fresh no-network gate consists of Agent/AI/Server/Web
tests, lint, TypeScript/build checks, Compose allowlist/config checks, a new
Mock report, forbidden-content scans, and independent specification plus
quality review. Any P1/P2 result stops before v3 is armed.

## 7. Exact execution sequence

The operator may run exactly one v3 controlled command only after every
zero-network proof and both independent reviews are recorded as approved, the
working tree is clean, v3 has no lock/evidence yet, and the v1/v2 historical
artifacts have been integrity-checked. The command must require the literal
single argument `--confirm-controlled-live-v3`; a v1/v2 confirmation argument
cannot select v3, and extra arguments block before any reservation.

1. The process validates its v3-only preflight and atomically reserves the v3
   lock and initial evidence before creating an executor.
2. It makes the one fact-free diagnostic attempt. If it is not `complete` with
   verifiable positive usage, it finalizes the v3 evidence closed (including a
   stage only when legal) and stops. It does not start the 48-case runner,
   Docker, browser, or a second diagnostic.
3. Only a complete diagnostic starts the one fixed 48-case Live runner in the
   same v3 process and profile. The 26 zero-call cases make zero provider
   attempts; each of the 22 eligible cases has at most one runtime attempt,
   no retry, the frozen `2 / 1950 / 440` candidate budget, and the existing
   4500 ms latency limit. Its evidence cannot borrow v1/v2 counters.
4. The 48-case result opens the controlled decision only when the canonical
   report says `quality_gate_passed`: strict schema rate 100%, semantic quality
   at least 90%, critical failures 0, p95 at most 4500 ms, all zero-call
   boundaries intact, usage/cost verifiable, and no per-case budget breach.
   Every other result finalizes v3 closed and ends the task.
5. Docker authenticated `/review-agent/suggestions` and `/plan` may run only
   after that v3 quality decision is open. It temporarily enables both business
   gates for the Docker server only, proves at least one `candidate_applied`
   Review/Planner path and one safe deterministic fallback, verifies no model
   text is displayed, then restores both gates to false and precisely removes
   only the synthetic account and associated traces. Browser windows remain
   visible for the user.

No branch merge, main verification, or remote push is authorized until the
Docker evidence is successful and default-off restoration is independently
verified.

## 8. Non-goals and review questions

V3 does not make Review/Planner a write-capable agent, change the 48-case
rubric, enlarge timeout/token caps, expose provider diagnostics to users,
backfill old evidence, or authorize Phase 6.10 memory work. It also does not
claim that a stage proves provider fault; it only identifies the trusted output
boundary at which the request stopped.

Useful review questions are:

- Why must stage exposure be isolated to the v3 controlled diagnostic rather
  than added to Agent Trace or the user-facing degraded state?
- Why do v1/v2 markers remain terminal even though the new v3 profile has a
  more informative safe schema?
- Which conditions separate a successful v3 diagnostic from a passed 48-case
  quality gate, and from a Docker product acceptance?
