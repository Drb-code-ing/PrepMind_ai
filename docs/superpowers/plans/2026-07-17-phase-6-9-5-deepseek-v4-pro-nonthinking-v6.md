# DeepSeek V4 Pro non-thinking V6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and independently verify a default-off, DeepSeek V4 Pro-only Review/Planner transport that sends `thinking: { type: 'disabled' }`, then prepare one new immutable V6 controlled-Live profile without invoking it until the user explicitly approves that separate spend.

**Architecture:** Keep Vercel AI SDK `generateObject(mode: 'json')`, local Zod, ModelAgentRuntime budgets and the deterministic Review/Planner merger. Add one closed `deepseek_v4_pro_nonthinking_json` executor mode. Its custom `fetch` middleware validates the exact already-normalised `/v1/chat/completions` JSON request, inserts only the frozen non-thinking field, and fails before the delegate on any drift. A V6-only response audit reduces any provider response to safe non-content metadata; it never retains a prompt, candidate, chain of thought, header, URL, API key or raw error. The V6 factory/evidence/CLI are a new lineage that hash-protects V1--V5 and remains business-gate-off.

**Tech Stack:** Bun workspace, TypeScript, Vercel AI SDK `4.3.19`, `@ai-sdk/openai` `1.3.24`, Zod, Jest, Bun native tests, native Windows HANDLE-relative evidence I/O, Docker Compose, Playwright.

---

## Preconditions and stop rules

- Work on `codex/phase-6-9-5-review-planner-live-diagnostics`; do not create a
  nested branch or worktree.
- Do not alter V1--V5 evidence files or their markers. Never run V5 again.
- Do not read, print, copy or commit `.env`; never echo a credential or a full
  Compose config.
- Do not run Docker, browser, a provider request, the V6 script, or any
  command containing V6 confirmation while completing Tasks 1--6.
- `REVIEW_AGENT_MODEL_ENABLED` and `PLANNER_AGENT_MODEL_ENABLED` remain
  `false` in every automated test and runtime configuration until a later,
  separately approved product acceptance.
- Never run `docker compose down -v`, remove Docker data, containers, volumes,
  images, cache, MinIO, PostgreSQL or Redis.
- Every task ends with its own commit after its exact tests pass. A failed test,
  review blocker, stale historical hash or unexpected live attempt stops the
  current task; do not work around it by changing the model/provider.

## File map

| File | Responsibility |
| --- | --- |
| `packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts` | Exact URL/body guard, fixed request injection and safe response audit; no environment access. |
| `packages/ai/src/model-agent-provider.ts` | Closed executor-config union and composition of the V6-only `fetch` middleware with the existing JSON executor. |
| `packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts` | Direct fake-fetch rejection/response-audit tests; no network. |
| `packages/ai/tests/model-agent-provider.test.ts` | Actual AI SDK wire regression for the special mode and unchanged normal/strict-tool paths. |
| `apps/server/src/review-agent/review-planner-model-config.ts` | Selects the special mode only for exact DeepSeek V4 Pro `/v1`; all other allowlisted models retain normal JSON mode. |
| `apps/server/src/review-agent/review-planner-model-config.spec.ts` | Default-off resolver and exact-mode isolation checks. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.ts` | V6 preflight, CNY cap, canary, attempt counter, safe reasoning audit and frozen paired evaluator. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.spec.ts` | Factory red/green tests for gates, cost, usage, audit and 23-call ceiling. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.ts` | V6-only strict safe evidence schema, once marker, V1--V5 snapshot/verification and two-phase seal. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.spec.ts` | Jest schema/lifecycle/hash-deny-list tests. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.native.bun.test.ts` | Native Windows no-reparse writer/race/byte-preservation tests. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.ts` | Exact confirmation, no-retry sequence, safe closure and no sensitive stdout. |
| `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.spec.ts` | CLI ordering, one-marker, terminal-state and serialization tests. |
| `apps/server/scripts/review-planner-controlled-live-eval-v6-deepseek-nonthinking.ts` | Thin process entry point with fixed failure output. |
| `apps/server/package.json` | Explicit V6 script, not a normal development command. |
| `DEVLOG.md`, `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md` | Observed offline/Mock facts only; no premature Live success claim. |
| `AGENTS.md`, `docs/roadmap.md`, `docs/ai-behavior-acceptance.md`, `docs/acceptance-checklist.md` | Update only when their stated project status has actually changed. |

## Task 1: Add the closed DeepSeek V4 Pro non-thinking transport

**Files:**

- Create: `packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts`
- Create: `packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts`
- Modify: `packages/ai/src/model-agent-provider.ts`
- Modify: `packages/ai/tests/model-agent-provider.test.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing direct transport tests**

Create a local fake delegate that captures only a parsed request body and
returns a fixed JSON object. Write tests for these exact cases:

```ts
const EXPECTED_URL = 'https://api.deepseek.com/v1/chat/completions';
const EXPECTED_THINKING = { type: 'disabled' } as const;

expect(captured.body).toMatchObject({
  model: 'deepseek-v4-pro',
  response_format: { type: 'json_object' },
  thinking: EXPECTED_THINKING,
});
expect(captured.body.tools).toBeUndefined();
expect(captured.body.tool_choice).toBeUndefined();
expect(captured.body.functions).toBeUndefined();
expect(captured.body.function_call).toBeUndefined();
expect(captured.body.json_schema).toBeUndefined();
```

For each invalid input below, assert the delegate count stays `0` and the
error string does not contain the sentinel `V6_PRIVATE_TRANSPORT_CANARY`:

```ts
['http://api.deepseek.com/v1/chat/completions',
 'https://api.deepseek.com/v1/chat/completions?x=1',
 'https://api.deepseek.com/v1/responses']
```

Also test `GET`, an unreadable/non-object JSON body, `model: 'deepseek-v4-flash'`,
`response_format: { type: 'json_schema' }`, a pre-existing `thinking`, and
each forbidden tool field. Add response-audit fixtures that reduce a response
to one of these values only:

```ts
{ reasoning: 'not_reported', reasoningContentPresent: false }
{ reasoning: 'reported_zero', reasoningContentPresent: false }
{ reasoning: 'reported_positive', reasoningContentPresent: true }
{ reasoning: 'invalid_detail', reasoningContentPresent: false }
```

The fixtures may contain a sentinel `reasoning_content`, but assertions must
prove the callback receives only the enum/boolean/safe integer and never that
sentinel or `message.content`.

- [ ] **Step 2: Run the direct test and observe RED**

Run:

```powershell
bun --cwd packages/ai test tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
```

Expected: FAIL because the V6 transport module does not exist.

- [ ] **Step 3: Implement the no-reparse, no-content transport**

Export these exact constants and public-safe types from the new module:

```ts
export const DEEPSEEK_V4_PRO_NONTHINKING_BASE_URL =
  'https://api.deepseek.com/v1' as const;
export const DEEPSEEK_V4_PRO_NONTHINKING_MODEL =
  'deepseek-v4-pro' as const;
export const DEEPSEEK_V4_PRO_NONTHINKING_COMPLETIONS_URL =
  'https://api.deepseek.com/v1/chat/completions' as const;

export type DeepSeekV4ProNonThinkingAudit =
  | Readonly<{ reasoning: 'not_reported'; reasoningContentPresent: boolean }>
  | Readonly<{ reasoning: 'reported_zero'; reasoningContentPresent: boolean; reportedReasoningTokens: 0 }>
  | Readonly<{ reasoning: 'reported_positive'; reasoningContentPresent: boolean; reportedReasoningTokens: number }>
  | Readonly<{ reasoning: 'invalid_detail'; reasoningContentPresent: boolean }>;
```

`createDeepSeekV4ProNonThinkingFetch(delegate, onAudit?)` must:

1. accept only a URL string or `URL` that normalises exactly to the constant,
   plus `POST` and a JSON string body;
2. parse the body into a null-prototype-free plain record, require the exact
   model and exactly one `response_format.type==='json_object'` key;
3. reject any existing `thinking` or tool/function/schema key before the
   delegate is called;
4. create a new body with `{ ...body, thinking: { type: 'disabled' } }`; do
   not mutate `init`, a caller object, or global fetch;
5. call the supplied delegate once, clone the returned `Response` only for
   ephemeral safe audit reduction, then return the original response;
6. never log, throw, retain or return raw request/response text. All rejection
   messages are fixed constants such as `DEEPSEEK_V4_PRO_NONTHINKING_REQUEST_INVALID`.

The audit reader may inspect only `choices[0].message.reasoning_content` for
presence and `usage.completion_tokens_details.reasoning_tokens` for a safe
non-negative integer. It must neither inspect nor copy `message.content`.
Unreadable/non-JSON response audit returns `not_reported`; the AI SDK remains
the authority that classifies the actual response parse.

- [ ] **Step 4: Add the closed executor mode and its real-SDK wire test**

Extend `OpenAICompatibleExecutorConfig` with the only new union member:

```ts
{
  provider: 'deepseek';
  apiKey: string;
  baseURL: 'https://api.deepseek.com/v1';
  model: 'deepseek-v4-pro';
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json';
  onNonThinkingAudit?: (audit: DeepSeekV4ProNonThinkingAudit) => void;
  schemaProfiles?: never;
}
```

Keep the callback in-process only: it is never read from env, sent to the
provider, serialized, traced, or exposed from a public API. Make
`ProviderFactory` accept an optional `fetch` member; pass it to `createOpenAI`
only for this new mode. Normalise special config only when provider/model/base
URL are exact, `schemaProfiles` is absent and the optional callback is a
function. The normal JSON and strict-tool branches must preserve their current
factory input shapes.

In `model-agent-provider.test.ts`, use the real SDK with a fake global
underlying fetch. Invoke the special executor once and assert its final wire
has the exact non-thinking and JSON-object values, no forbidden fields, and a
single fetch request. In a separate control test, pass
`providerOptions: { openai: { thinking: { type: 'disabled' } } }` directly to
the current SDK and assert it does **not** place an unknown `thinking` key in
the body; this prevents future accidental replacement of the typed middleware
with a non-working option.

- [ ] **Step 5: Run focused regressions and commit Task 1**

Run:

```powershell
bun --cwd packages/ai test tests/model-agent-deepseek-v4-pro-nonthinking.test.ts
bun --cwd packages/ai test tests/model-agent-provider.test.ts
bun --filter @repo/ai test
```

Expected: all exit `0`, fake delegate counts match the assertions, and no
network-capable command is run. Add a DEVLOG line saying only “V6 typed
non-thinking transport has offline wire evidence; no V6 provider attempt and
no production gate change.” Then commit:

```powershell
git add packages/ai/src/model-agent-deepseek-v4-pro-nonthinking.ts packages/ai/src/model-agent-provider.ts packages/ai/tests/model-agent-deepseek-v4-pro-nonthinking.test.ts packages/ai/tests/model-agent-provider.test.ts DEVLOG.md
git commit -m "feat(agent): add V6 non-thinking transport"
```

## Task 2: Bind only exact Review/Planner V4 Pro configuration to the new mode

**Files:**

- Modify: `apps/server/src/review-agent/review-planner-model-config.ts`
- Modify: `apps/server/src/review-agent/review-planner-model-config.spec.ts`
- Modify: `apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing resolver/runtime tests**

Add three explicit cases:

```ts
// exact live credentials + both business gates false
expect(resolveReviewPlannerLiveExecutorConfig(v4ProEnv)).toMatchObject({
  provider: 'deepseek',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
});

// DeepSeek V4 Flash remains the existing normal JSON path
expect(resolveReviewPlannerLiveExecutorConfig(v4FlashEnv)?.structuredOutputMode)
  .toBe('json_object');

// false business gates create mock runtimes and no executor
expect(createExecutor).not.toHaveBeenCalled();
```

Also assert an exact V4 Pro model with a trailing slash, port, query, wrong
host, wrong provider credential or any `schemaProfiles` input fails closed and
does not create an executor. Serialize every returned public
`ReviewPlannerModelConfig` and assert it has neither test key nor base URL.

- [ ] **Step 2: Run the focused tests and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
```

Expected: the exact V4 Pro assertion fails while the resolver still returns
`json_object`.

- [ ] **Step 3: Implement the exact resolver branch**

After existing live/provider/HTTPS validation succeeds, select the special
mode only under this complete predicate:

```ts
provider.name === 'deepseek' &&
baseURL === 'https://api.deepseek.com/v1' &&
model === 'deepseek-v4-pro'
```

Return the literal special config without `onNonThinkingAudit`; that callback
is controlled-evaluator private state, not a user configuration value. Return
the existing literal `json_object` config for all other valid models. Do not
add an environment variable, a default model change or an ordinary Chat
provider change. Preserve `resolveReviewPlannerModelConfig()` public output and
the existing “disabled means no executor construction” runtime condition.

- [ ] **Step 4: Run server/AI boundary checks and commit Task 2**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-model-config.spec.ts review-planner-model-runtime.factory.spec.ts
bun --cwd packages/ai test
bun --cwd packages/types typecheck
```

Expected: exit `0`; no test enables a business gate or touches a provider.
Record the exact default-off resolver fact in DEVLOG, then commit:

```powershell
git add apps/server/src/review-agent/review-planner-model-config.ts apps/server/src/review-agent/review-planner-model-config.spec.ts apps/server/src/review-agent/review-planner-model-runtime.factory.spec.ts DEVLOG.md
git commit -m "feat(agent): bind V4 Pro review planner transport"
```

## Task 3: Build the V6 evaluator and conservative reasoning accounting

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.spec.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing evaluator tests**

Use this frozen test-only preflight input:

```ts
const v6Env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v6-private-test-key',
});
```

Assert the factory passes exactly the special executor mode and an internal
audit callback, one valid canary consumes one attempt, and all of the following
close without paired evaluation: missing/zero/fractional/negative aggregate
usage; a `reported_positive` audit; `reasoningContentPresent: true`; invalid
audit detail; a changed gate/model/base URL; a price profile mismatch; and a
24th delegate call. Assert `not_reported` and `reported_zero` both use full
`completionTokens` in the CNY calculation; they must never reduce output cost.

The successful fake paired report must require exactly `48/26/22/22`, zero
critical failures, P95 `<=4500`, semantic quality `>=90`, aggregate positive
usage, CNY `<=1`, and no non-thinking audit violation.

- [ ] **Step 2: Run the factory test and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.spec.ts
```

Expected: FAIL because the V6 factory does not exist.

- [ ] **Step 3: Implement the bounded factory**

Use these fixed values; do not read them from environment:

```ts
const V6_TIMEOUT_MS = 4_500;
const V6_MAX_PAIRED_PROVIDER_ATTEMPTS = 22;
const V6_MAX_PROVIDER_ATTEMPTS = 23;
const V6_RESERVED_INPUT_TOKENS = 42_996;
const V6_RESERVED_OUTPUT_TOKENS = 9_712;
const V6_HARD_CAP_CNY = 1;
const V6_INPUT_CNY_PER_MILLION = 3;
const V6_OUTPUT_CNY_PER_MILLION = 6;
```

Wrap `createOpenAICompatibleStructuredExecutor` with a bounded counter and
compose the audit callback into a V6-private aggregate. The callback stores
only audit enum, boolean and safe token count; it must be reset only by
creating a new evaluator and never written to Agent Trace. Map a non-thinking
violation to a V6-safe bounded diagnostic code `thinking_not_disabled` in the
V6 factory/evidence domain; do not expose a new provider raw-error category.

The canary remains the fact-free canonical Review candidate. It may continue
only with one attempt, positive safe integer input/output usage, no audit
violation and unchanged CNY reservation. The paired runner receives the same
runtime, preserves all existing zero-call guards and stops if an audit
violation occurs. Cost is always:

```ts
Math.round(((inputTokens * 3 + outputTokens * 6) / 1_000_000) * 100_000_000) /
  100_000_000;
```

No USD Trace price is introduced and no `reportedReasoningTokens` is deducted
from `outputTokens`.

- [ ] **Step 4: Run focused evaluator and shared paired regressions**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.spec.ts review-planner-controlled-live-eval-v5-deepseek.factory.spec.ts
bun --filter @repo/agent test
bun --filter @repo/ai test
```

Expected: exit `0`, V5 remains immutable, and all calls use injected fakes.
Update DEVLOG with offline evaluator status only, then commit:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.factory.spec.ts DEVLOG.md
git commit -m "feat(agent): add V6 non-thinking evaluator"
```

## Task 4: Add V6-only immutable evidence and V1--V5 integrity protection

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.spec.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.native.bun.test.ts`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing evidence schema/lifecycle tests**

Use these exact V6 profile constants:

```ts
id: 'phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking'
evidenceSchemaVersion: 'phase-6.9.5-review-planner-controlled-live-evidence-v6-deepseek-v4-pro-nonthinking'
evidenceDirectory: 'docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking'
onceLockLeaf: '.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once'
```

Assert complete evidence contains only fixed status/gate, attempt count, price
profile id, CNY aggregate tokens/cost/cap, fixed quality counters and the
safe audit aggregate (`not_reported` or `reported_zero`). Assert closed evidence
contains a bounded diagnostic and, for `thinking_not_disabled`, only the safe
audit enum/boolean/non-negative token count. Test all legacy-sensitive words
against serialized evidence:

```ts
/prompt|candidate|api[_-]?key|authorization|cookie|stack|bearer|-----begin|password|secret|endpoint|header|raw[_-]?output|error/i
```

Make a fixture history containing every V1--V5 evidence directory plus marker.
Verify hashes before reserve, before executor construction, before provider
boundary and after finalisation. Test added/changed/removed/renamed historical
file, junction/reparse point, duplicate V6 marker, writer failure and final
post-check failure. The last case must overwrite an unsealed result with
closed `evidence_io`, then seal, exactly as V5's two-phase correction requires.

- [ ] **Step 2: Run the tests and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.spec.ts
```

Expected: FAIL because V6 evidence functions do not exist.

- [ ] **Step 3: Implement the strict native writer**

Use `openWindowsNoReparseDirectory` and
`openWindowsNoReparseExistingDirectory` only. The V6 writer may create or
write only the new V6 directory, its unique marker and its safe JSON record.
The historical reader is HANDLE-relative, existing-only and has no reparse
following; it includes V5 in its static manifest. Keep separate `reserved`,
`attempted` and `finalized` strict Zod records. `finalize()` remains writable
until the last historical verification passes; `seal()` is called only after
the terminal safe record is written. Do not reuse V5 schema names or paths.

- [ ] **Step 4: Run evidence regression suite and commit Task 4**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.spec.ts
Push-Location apps/server
bun test src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.native.bun.test.ts
Pop-Location
```

Expected: exit `0`; Windows race tests prove V1--V5 byte preservation and
V6-only write authority. Update DEVLOG with the actual offline evidence fact,
then commit:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.spec.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.evidence.native.bun.test.ts DEVLOG.md
git commit -m "feat(agent): isolate V6 non-thinking evidence"
```

## Task 5: Add the V6 once-only CLI and complete no-network Mock evidence

**Files:**

- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.ts`
- Create: `apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.spec.ts`
- Create: `apps/server/scripts/review-planner-controlled-live-eval-v6-deepseek-nonthinking.ts`
- Modify: `apps/server/package.json`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Write failing CLI tests**

Accept only this one argument vector:

```text
--confirm-controlled-live-v6-deepseek-v4-pro-nonthinking
```

Fakes must prove invalid confirmation, any false/missing preflight value,
snapshot failure, reservation failure, pre-attempt historical mismatch, audit
violation, failed canary, invalid usage, CNY overflow, quality/P95 failure,
post-finalisation hash mismatch and a reused marker all close terminally. Each
provider-boundary failure must assert its exact counter: `0` when before
attempted, `1` after only a canary, and never more than `23`. A successful fake
route must prove `48` case entries, `26` verified zero-call entries, `22`
runtime calls, no retry, full safe schema success and no serialized credential,
candidate, audit fixture canary or URL.

- [ ] **Step 2: Run the focused CLI test and observe RED**

Run:

```powershell
bun --filter @repo/server test -- --runInBand review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.spec.ts
```

Expected: FAIL because no V6 CLI exists.

- [ ] **Step 3: Implement the CLI and thin script**

The CLI order is fixed:

```text
exact confirmation
-> strict preflight (both business gates false)
-> V1--V5 snapshot
-> V6 reservation
-> V1--V5 verification
-> mark attempted
-> construct evaluator
-> one canary
-> only then frozen paired evaluator
-> final history verification
-> safe finalise/second history verification/seal
```

Use a unique run id and timestamp only for V6 filename construction. Stdout is
the strict safe summary. The catch-all script output is exactly a closed JSON
tuple with `providerAttemptCount:0`, `usageKnown:false` and
`diagnosticCode:'evidence_io'`; it cannot include `error.message`. Add only:

```json
"eval:review-planner:live:v6:deepseek-nonthinking": "bun scripts/review-planner-controlled-live-eval-v6-deepseek-nonthinking.ts"
```

Do not run that script during this task.

- [ ] **Step 4: Run no-network Mock proof and focused regressions**

Run the focused CLI tests, then call the frozen paired evaluator in `mock`
mode from an ignored `.tmp` artifact. Verify exactly:

```text
caseEntries=48
zeroCallVerified=26
runtimeInvocations=22
strictSuccesses=48
criticalFailures=0
productionDecision=mock_quality_not_evidence
```

The artifact is not committed, does not create a V6 directory/marker, and is
not a Live quality claim.

- [ ] **Step 5: Commit Task 5**

Update DEVLOG stating “V6 CLI/Mock-ready; no V6 controlled-Live attempt; both
Review/Planner gates remain false.” Then commit:

```powershell
git add apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.ts apps/server/src/review-agent/review-planner-controlled-live-eval-v6-deepseek-nonthinking.cli.spec.ts apps/server/scripts/review-planner-controlled-live-eval-v6-deepseek-nonthinking.ts apps/server/package.json DEVLOG.md
git commit -m "feat(agent): add once-only V6 non-thinking CLI"
```

## Task 6: Offline acceptance, independent review and approval checkpoint

**Files:**

- Modify: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`
- Modify: `DEVLOG.md`
- Modify: `AGENTS.md` only if the file's next-step/status wording is now factually stale
- Modify: `docs/roadmap.md` only if the file's next-step/status wording is now factually stale
- Modify: `docs/ai-behavior-acceptance.md` only with offline transport facts
- Modify: `docs/acceptance-checklist.md` only with new V6 pre-Live checks

- [ ] **Step 1: Run complete offline verification**

Run each command and record its actual exit status/count without copying
credentials or resolved Compose values:

```powershell
bun --filter @repo/ai test
bun --filter @repo/agent test
bun --filter @repo/server test
bun --filter @repo/server lint
bun --filter @repo/server build
bun --cwd packages/types typecheck
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
docker compose --env-file .env -f docker/docker-compose.dev.yml --profile worker config --quiet
git diff --check
```

Expected: all exit `0`. The Compose command validates only configuration and
does not start, remove or print services. If any command fails, diagnose and
repair in a separate task/commit before proceeding.

- [ ] **Step 2: Perform an independent code/document review**

Review from commit `26219c8` through `HEAD` against the approved V6 design.
Check every boundary: exact config binding, request guard before delegate,
unchanged normal/strict modes, no retry, default-off gates, aggregate token
cost, no raw audit persistence, V1--V5 byte preservation, V6 two-phase seal,
one marker and safe stdout. Resolve all blocker/important findings with tests
and a separate `fix(agent): ...` commit.

- [ ] **Step 3: Write only fact-backed offline documentation and commit**

Document the V6 transport as *offline/Mock-ready*, not Live-passed. State that
the next action is a separate user authorization for a single V6 confirmation;
do not state that Review/Planner is enabled or usable through a real model.
Commit only observed docs:

```powershell
git add docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md DEVLOG.md AGENTS.md docs/roadmap.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md
git commit -m "docs(agent): record V6 offline acceptance"
```

- [ ] **Step 4: Stop and obtain explicit V6 Live approval**

Report the fresh test evidence, current branch/commit and the worst-case CNY
reservation `0.18726 / 1.00`. Ask the user to explicitly authorize exactly
one V6 command. Do not infer approval from the earlier V6 design approval.

## Task 7: One controlled-Live V6 run (requires a new explicit user approval)

**Files:**

- Create at runtime only: `docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking/<safe-run-id>.json`
- Create at runtime only: `docs/acceptance/evidence/phase-6-9-5-controlled-live-v6-deepseek-v4-pro-nonthinking/.review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking.once`
- Modify after observation only: `docs/acceptance/phase-6-9-5-review-planner-live-diagnostic.md`, `DEVLOG.md`

- [ ] **Step 1: Re-check non-sensitive readiness**

Confirm by presence/boolean checks only that the exact V6 preflight values are
available and that no V6 marker exists. Do not print any value from `.env`.
Verify V1--V5 marker/evidence paths still exist and `git status --short` has
only expected work.

- [ ] **Step 2: Run exactly one command**

In one explicit process environment, with both business gates false, run:

```powershell
bun --filter @repo/server eval:review-planner:live:v6:deepseek-nonthinking -- --confirm-controlled-live-v6-deepseek-v4-pro-nonthinking
```

Never re-run it. Do not invoke Docker, browser, product API, another provider,
or a second profile based on its result.

- [ ] **Step 3: Record the observed terminal state and commit**

If the result is anything but strict `complete/open`, record only safe status,
attempt count, usage flag, bounded diagnostic and evidence path. Keep gates
false and stop Phase 6.9.5 product acceptance. If it is `complete/open`,
record the safe quality/cost/audit aggregate, keep gates false, and ask the
user for separate Docker/browser approval. Never infer a supplier bill or
persist raw provider data.

## Task 8: Docker/browser, main merge and remote push (only after V6 Live passes and a further approval)

**Files:**

- Create: `docs/acceptance/2026-07-17-phase-6-9-5-review-planner-v6-production.md`
- Modify: `AGENTS.md`, `DEVLOG.md`, `docs/roadmap.md`, `docs/ai-behavior-acceptance.md`, `docs/acceptance-checklist.md`

- [ ] **Step 1: Temporary server-only Docker acceptance**

Use the existing Compose services without `down`, volume deletion or cache
cleanup. Enable only the temporary server container's V6-eligible
Review/Planner gates. Prove API suggestions work under an authenticated
synthetic account and retain only safe status/latency/token observations.

- [ ] **Step 2: Visible browser acceptance and narrow cleanup**

Open `/plan` and `/today` visibly, verify candidate-applied or documented
restrictive fallback and leave the browser open. Restore both gates to false.
Delete only the synthetic account and its traces; verify the synthetic counts
are zero. Do not remove any Docker service, data, cache or unrelated account.

- [ ] **Step 3: Merge/revalidate/push**

Independently review the completed branch, merge it to `main` with `--no-ff`,
run the critical static/Docker/visible-browser acceptance again on `main`, then
push `main` to `origin`. Preserve the branch until the main revalidation and
push both succeed.

## Plan self-review checklist

- The plan keeps normal Chat and all V1--V5 evidence outside the write scope.
- The actual SDK wire proof precedes any V6 profile/marker/provider boundary.
- The non-thinking request field is typed and fixed, not environment-driven.
- Reasoning usage is never subtracted from the CNY aggregate; missing detail is
  not reinterpreted as zero.
- Every provider/Docker/browser action is behind a later explicit user approval.
- Every task has a focused red/green command, verification command and commit.
