# Phase 6.9.6 Knowledge Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `KnowledgeDedupAgent` and `KnowledgeOrganizerAgent` from deterministic-only advisers to production-gated, read-only hybrid semantic agents using the existing Qwen chunk embeddings and constrained DeepSeek V4 Pro decisions.

**Architecture:** The server creates one immutable owner-scoped `REPEATABLE READ` snapshot, derives exact-hash facts and a stable pgvector shortlist locally, projects only sanitized ordinal data, then runs Dedup and Organizer candidates in parallel under one immutable request budget. Canonical Zod validation and local mergers retain authority over document IDs, revision facts, labels, recommendations, usage, cost, Trace, and all write permissions; every failure returns a deterministic read-only result.

**Tech Stack:** TypeScript, Bun, Zod, NestJS 11, Prisma, PostgreSQL/pgvector, shared `ModelAgentRuntime`, DeepSeek OpenAI-compatible JSON-object transport, Next.js 16, React 19, Vitest/Bun test, Docker Compose.

---

## Execution invariants

- Work only on `codex/phase-6-9-6-knowledge-agents`, which was created directly from pushed `main@923060a`; do not create a worktree or another branch from this feature branch. Before Task 1, run `git fetch origin main` and verify `origin/main` is still the branch base; if main advanced, safely integrate that new pushed main into this same feature branch and rerun the docs-only checks before implementation.
- Complete each task with its focused RED/GREEN verification and one commit before beginning the next task.
- Do not call a real provider before Task 13 and a fresh explicit user authorization. Tasks 1-12 use deterministic or Mock executors only.
- Never log or persist prompt text, document names, summaries, chunk content, vectors, provider response bodies/headers, credentials, base URLs, or raw errors.
- Never add document/tag/collection mutation endpoints or UI actions. The agents remain read-only advisers.
- Never run `docker compose down -v`, Docker prune, volume/database reset, Redis flush, or MinIO wipe.
- Update `AGENTS.md`, `DEVLOG.md`, `docs/roadmap.md`, and the task-specific documentation at each meaningful checkpoint.

## Planned file structure

| Responsibility | Files |
| --- | --- |
| Dataset, baseline, metrics | `packages/agent/src/evals/phase-6-9-knowledge-agent-cases.ts`, `phase-6-9-knowledge-agent-metrics.ts`, `phase-6-9-knowledge-agent-baseline.ts`, matching tests |
| Safe projection and schemas | `packages/agent/src/model-candidates/knowledge-model-projection.ts`, `knowledge-agent-model-contract.ts`, matching tests |
| Dedup/Organizer candidates and mergers | `packages/agent/src/model-candidates/knowledge-dedup-model-candidate.ts`, `knowledge-organizer-model-candidate.ts`, matching tests |
| Snapshot and shortlist | `apps/server/src/knowledge-agent/knowledge-owner-snapshot.ts`, `knowledge-semantic-candidate.source.ts`, matching specs |
| Composition and Trace | `apps/server/src/knowledge-agent/knowledge-model-config.ts`, `knowledge-model-runtime.factory.ts`, `knowledge-agent-trace.ts`, existing module/service/spec files |
| API and UI metadata | `packages/types/src/api/knowledge-agent.ts`, `apps/web/src/lib/knowledge-agent-view.ts`, `apps/web/src/app/(main)/knowledge/page.tsx`, matching tests |
| Paired evaluation | `packages/agent/src/evals/phase-6-9-knowledge-agent-paired-contract.ts`, `run-phase-6-9-knowledge-agent-paired.ts`, `packages/agent/scripts/phase-6-9-6-knowledge-agent-cli.ts`, evidence validator/tests |
| Runtime and delivery docs | `docker-compose.yml`, `.env.example`, `docs/dev-start.md`, acceptance/evidence docs, `AGENTS.md`, `README.md`, `DEVLOG.md`, `docs/roadmap.md`, `docs/data-flow.md` |

### Task 1: Freeze the 72-case dataset, metrics, and deterministic baseline

**Files:**
- Create: `packages/agent/src/evals/phase-6-9-knowledge-agent-cases.ts`
- Create: `packages/agent/src/evals/phase-6-9-knowledge-agent-metrics.ts`
- Create: `packages/agent/src/evals/phase-6-9-knowledge-agent-baseline.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-cases.test.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-metrics.test.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-baseline.test.ts`
- Modify: `packages/agent/package.json`
- Create: `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [x] **Step 1: Write the failing dataset contract test**

```ts
import { describe, expect, test } from 'bun:test';
import { PHASE_6_9_KNOWLEDGE_AGENT_CASES } from '../src/evals/phase-6-9-knowledge-agent-cases.ts';

describe('phase-6.9 knowledge-agent cases', () => {
  test('freezes 40 dedup and 32 organizer cases with 24 verified zero-call cases', () => {
    expect(PHASE_6_9_KNOWLEDGE_AGENT_CASES).toHaveLength(72);
    expect(PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter((item) => item.agent === 'dedup')).toHaveLength(40);
    expect(PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter((item) => item.agent === 'organizer')).toHaveLength(32);
    expect(PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter((item) => item.expectedRuntimeInvocations === 0)).toHaveLength(24);
    expect(new Set(PHASE_6_9_KNOWLEDGE_AGENT_CASES.map((item) => item.id)).size).toBe(72);
    expect(
      PHASE_6_9_KNOWLEDGE_AGENT_CASES.filter((item) => item.expectedRuntimeInvocations === 1)
        .map((item) => item.pairedRunIndex)
        .filter((value): value is number => value !== undefined),
    ).toEqual([...Array(24).keys(), ...Array(24).keys()]);
  });
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `bun test packages/agent/tests/phase-6-9-knowledge-agent-cases.test.ts`

Expected: FAIL because `phase-6-9-knowledge-agent-cases.ts` does not exist.

- [x] **Step 3: Implement the typed fixture matrix and exact case IDs**

```ts
export const PHASE_6_9_KNOWLEDGE_AGENT_DATASET_VERSION = 'phase-6.9-knowledge-agents-v1';

const DEDUP_ZERO_CALL_IDS = [
  'dedup-exact-hash-01', 'dedup-exact-hash-02', 'dedup-gate-off', 'dedup-live-off',
  'dedup-aborted', 'dedup-budget-exhausted', 'dedup-target-owner-mismatch',
  'dedup-target-missing', 'dedup-no-documents', 'dedup-all-unprocessed',
  'dedup-no-safe-embedding', 'dedup-below-threshold', 'dedup-filename-credential',
  'dedup-summary-injection', 'dedup-safety-metadata-unknown', 'dedup-hostile-accessor',
] as const;
const ORGANIZER_ZERO_CALL_IDS = [
  'organizer-gate-off', 'organizer-live-off', 'organizer-aborted',
  'organizer-budget-exhausted', 'organizer-no-documents', 'organizer-no-safe-projection',
  'organizer-summary-credential', 'organizer-hostile-accessor',
] as const;
const DEDUP_RUNTIME_LABELS = [
  'semantic_duplicate', 'possible_revision', 'complementary', 'unrelated',
] as const;
const ORGANIZER_RUNTIME_SUBJECTS = [
  'math', 'english', 'politics', 'computer', 'major', 'other',
] as const;

export const PHASE_6_9_KNOWLEDGE_AGENT_CASES = Object.freeze([
  ...DEDUP_ZERO_CALL_IDS.map((id) => buildZeroCallCase('dedup', id)),
  ...Array.from({ length: 24 }, (_, pairedRunIndex) => buildDedupRuntimeCase({
    id: `dedup-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`,
    pairedRunIndex,
    expectedRelation: DEDUP_RUNTIME_LABELS[pairedRunIndex % DEDUP_RUNTIME_LABELS.length]!,
    revisionExpected: pairedRunIndex % 4 === 1,
  })),
  ...ORGANIZER_ZERO_CALL_IDS.map((id) => buildZeroCallCase('organizer', id)),
  ...Array.from({ length: 24 }, (_, pairedRunIndex) => buildOrganizerRuntimeCase({
    id: `organizer-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`,
    pairedRunIndex,
    expectedSubject: ORGANIZER_RUNTIME_SUBJECTS[pairedRunIndex % ORGANIZER_RUNTIME_SUBJECTS.length]!,
  })),
] satisfies readonly Phase69KnowledgeAgentCase[]);
```

The two builders must emit synthetic filenames/summaries only, explicit expected relation/subject/tags/collection edges, eligibility inputs, and `expectedRuntimeInvocations`; no real document IDs or copied production text.

- [x] **Step 4: Write metric tests before metric implementation**

```ts
test('uses the frozen weighted formula and nearest-rank P95', () => {
  expect(computeKnowledgeSemanticScore({
    dedupSemanticMacroF1: 0.8,
    revisionRecall: 0.9,
    organizerSubjectTop1: 0.9,
    organizerTagMicroF1: 0.8,
    organizerCollectionPairwiseF1: 0.7,
  })).toBeCloseTo(0.82, 10);
  expect(nearestRankP95([...Array(24).keys()].map((value) => value + 1))).toBe(23);
});

test('keeps invalid attempted outputs in the denominator', () => {
  const report = scoreKnowledgeAgentCases([
    prediction('dedup-runtime-01', 'semantic_duplicate'),
    invalidPrediction('dedup-runtime-02'),
  ], twoCaseFixture());
  expect(report.scoredRuntimeCases).toBe(2);
  expect(report.invalidRuntimeCases).toBe(1);
});
```

- [x] **Step 5: Implement metric functions and baseline runner**

```ts
export function computeKnowledgeSemanticScore(input: KnowledgeSemanticMetrics): number {
  return 0.35 * input.dedupSemanticMacroF1
    + 0.15 * input.revisionRecall
    + 0.20 * input.organizerSubjectTop1
    + 0.15 * input.organizerTagMicroF1
    + 0.15 * input.organizerCollectionPairwiseF1;
}

export function nearestRankP95(values: readonly number[]): number {
  if (values.length !== 24 || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error('KNOWLEDGE_AGENT_LATENCY_SAMPLE_INVALID');
  }
  return [...values].sort((left, right) => left - right)[Math.ceil(0.95 * values.length) - 1]!;
}

export function runKnowledgeAgentDeterministicBaseline() {
  const predictions = PHASE_6_9_KNOWLEDGE_AGENT_CASES
    .filter((item) => item.expectedRuntimeInvocations === 1)
    .map(runExistingDeterministicPolicy);
  return scoreKnowledgeAgentCases(predictions, PHASE_6_9_KNOWLEDGE_AGENT_CASES);
}
```

- [x] **Step 6: Run GREEN tests and write immutable baseline evidence**

Run: `bun test packages/agent/tests/phase-6-9-knowledge-agent-{cases,metrics,baseline}.test.ts`

Expected: PASS with 72 total, 24 zero-call, 48 runtime, 24 paired indexes per agent, and a reproducible deterministic score. Record the unmodified numbers in `docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md`; do not improve or relabel the baseline in this task.

- [x] **Step 7: Commit Task 1**

```bash
git add packages/agent/src/evals packages/agent/tests/phase-6-9-knowledge-agent-*.test.ts packages/agent/package.json docs/acceptance/phase-6-9-6-1-knowledge-agent-baseline.md AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "test(agent): baseline knowledge semantic agents"
```

### Task 2: Add strict candidate schemas and `knowledge-model-projection-v1`

**Files:**
- Create: `packages/agent/src/model-candidates/knowledge-agent-model-contract.ts`
- Create: `packages/agent/src/model-candidates/knowledge-model-projection.ts`
- Create: `packages/agent/tests/knowledge-agent-model-contract.test.ts`
- Create: `packages/agent/tests/knowledge-model-projection.test.ts`
- Modify: `packages/agent/src/model-candidates/production.ts`

- [x] **Step 1: Write RED tests for strict schemas and full-field pre-truncation scanning**

```ts
test('rejects extra fields, duplicate pairs, and out-of-range indexes', () => {
  expect(KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse({ decisions: [{
    pairIndex: 0, relation: 'semantic_duplicate', confidence: 'high',
    evidenceCodes: ['semantic_overlap'], deleteDocument: true,
  }] }).success).toBe(false);
  expect(validateDedupDecision(validDedupDecision([0, 0]), 2).ok).toBe(false);
  expect(validateDedupDecision(validDedupDecision([2]), 2).ok).toBe(false);
});

test('scans every complete filename and summary before truncation or ordinal assignment', () => {
  const result = projectKnowledgeSnapshot(snapshotWithSecretAfterCharacterLimit());
  expect(result).toEqual({ ok: false, reasonCode: 'credential_material' });
  expect(candidateTextGuardCalls()).toEqual([
    'document-0:name', 'document-0:summary-0', 'document-0:summary-1',
  ]);
  expect(ordinalAssignments()).toBe(0);
});
```

- [x] **Step 2: Run RED tests**

Run: `bun test packages/agent/tests/knowledge-{agent-model-contract,model-projection}.test.ts`

Expected: FAIL because the schemas and projector do not exist.

- [x] **Step 3: Implement strict output schemas**

```ts
export const KNOWLEDGE_DEDUP_MODEL_SCHEMA = z.object({
  decisions: z.array(z.object({
    pairIndex: z.number().int().min(0).max(11),
    relation: z.enum(['semantic_duplicate', 'possible_revision', 'complementary', 'unrelated']),
    confidence: z.enum(['medium', 'high']),
    evidenceCodes: z.array(z.enum([
      'semantic_overlap', 'same_scope', 'version_signal', 'newer_timestamp',
      'different_purpose', 'complementary_coverage', 'insufficient_version_evidence',
    ])).min(1).max(4),
  }).strict()).max(12),
}).strict();

const safeLabel = z.string().min(2).max(20).regex(/^[\p{L}\p{N} ·()（）_-]+$/u);
export const KNOWLEDGE_ORGANIZER_MODEL_SCHEMA = z.object({
  tags: z.array(z.object({
    documentIndex: z.number().int().min(0).max(19),
    subject: z.enum(['math', 'english', 'politics', 'computer', 'major', 'other']),
    resourceType: z.enum(['lecture', 'notes', 'past_exam', 'mistakes', 'practice', 'reference', 'other']),
    topicLabels: z.array(safeLabel.max(12)).max(2),
  }).strict()).max(20),
  collections: z.array(z.object({
    memberIndexes: z.array(z.number().int().min(0).max(19)).min(2).max(8),
    name: safeLabel,
    theme: z.enum(['subject', 'exam', 'topic', 'project']),
  }).strict()).max(5),
}).strict();
```

- [x] **Step 4: Implement the projector contract**

```ts
export const KNOWLEDGE_MODEL_PROJECTION_VERSION = 'knowledge-model-projection-v1';

export type KnowledgeModelProjection = Readonly<{
  version: typeof KNOWLEDGE_MODEL_PROJECTION_VERSION;
  documents: readonly Readonly<{
    ordinal: `d${number}`;
    normalizedName: string;
    type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
    relativeTime: 'older' | 'same_time' | 'newer';
    summaries: readonly string[];
  }>[];
  pairs: readonly Readonly<{ pairIndex: number; left: `d${number}`; right: `d${number}`; evidenceBand: 'medium' | 'high' }>[];
}>;

export function projectKnowledgeSnapshot(input: unknown): KnowledgeProjectionResult {
  const snapshot = cloneKnowledgeOwnerSnapshot(input); // schema clone rejects getters/proxies
  if (!snapshot.ok) return snapshot;
  for (const document of snapshot.value.documents) {
    for (const [field, value] of completeMutableFields(document)) {
      const guarded = prepareCandidateText({ value, maxRawBytes: 65_536, maxChars: value.length });
      if (!guarded.ok) return { ok: false, reasonCode: mapProjectionReason(guarded) };
    }
    if (document.safety !== 'safe_for_model') return { ok: false, reasonCode: 'unsafe_metadata' };
  }
  return { ok: true, value: deepFreeze(assignOrdinalsAndTruncate(snapshot.value)) };
}
```

`completeMutableFields()` must include the complete normalized filename and every complete selected summary. Only `assignOrdinalsAndTruncate()` may shorten text. Target exclusion returns a fixed `target_projection_blocked`; non-target unsafe documents are excluded, and eligibility is recalculated afterward.

- [x] **Step 5: Run GREEN tests and package checks**

Run: `bun test packages/agent/tests/knowledge-{agent-model-contract,model-projection}.test.ts && bun --filter @repo/agent typecheck && bun --filter @repo/agent lint`

Expected: all commands exit 0; tests prove filename, each summary, metadata conflict, control characters, credentials, injection, hostile getter/proxy, and ordinal-after-scan ordering.

- [x] **Step 6: Commit Task 2**

```bash
git add packages/agent/src/model-candidates packages/agent/tests/knowledge-agent-model-contract.test.ts packages/agent/tests/knowledge-model-projection.test.ts
git commit -m "feat(agent): constrain knowledge model projection"
```

### Task 3: Implement the Dedup candidate and authoritative local merger

**Files:**
- Create: `packages/agent/src/model-candidates/knowledge-dedup-model-candidate.ts`
- Create: `packages/agent/tests/knowledge-dedup-model-candidate.test.ts`
- Modify: `packages/agent/src/nodes/knowledge-dedup.ts`
- Modify: `packages/agent/tests/knowledge-dedup.test.ts`
- Modify: `packages/agent/src/model-candidates/production.ts`

- [ ] **Step 1: Write RED tests for zero-call and merger authority**

```ts
test('keeps exact hash local and skips runtime when no semantic pair exists', async () => {
  const runtime = countingRuntime();
  const result = await runKnowledgeDedupModelCandidate(dedupInput({ exactHashOnly: true, runtime }));
  expect(runtime.invocations).toBe(0);
  expect(result.value.items[0]).toMatchObject({ kind: 'exact_duplicate', recommendation: 'use_existing' });
  expect(result.observation).toMatchObject({ attempted: false, disposition: 'not_eligible' });
});

test('downgrades a revision without local version/time evidence', async () => {
  const result = await runKnowledgeDedupModelCandidate(dedupInput({
    runtime: fixedRuntime({ decisions: [{ pairIndex: 0, relation: 'possible_revision', confidence: 'high', evidenceCodes: ['semantic_overlap'] }] }),
    localRevisionSignal: false,
  }));
  expect(result.value.items[0]).toMatchObject({ kind: 'possible_revision', recommendation: 'review_manually' });
  expect(result.value.items[0]?.signals).toContain('insufficient_version_evidence');
});
```

- [ ] **Step 2: Run RED test**

Run: `bun test packages/agent/tests/knowledge-dedup-model-candidate.test.ts`

Expected: FAIL because the candidate does not exist.

- [ ] **Step 3: Implement candidate invocation and fail-closed merger**

```ts
export async function runKnowledgeDedupModelCandidate(
  input: KnowledgeDedupModelCandidateInput,
): Promise<KnowledgeDedupModelCandidateEnvelope> {
  const local = analyzeKnowledgeDedup(input.deterministicInput);
  const prepared = validateAndProjectDedupInput(input);
  if (!prepared.ok) return localDedupEnvelope(local, prepared.disposition, input.budget, prepared.reasonCode);
  const reservation = reserveModelAgentBudget(input.budget, { inputTokens: prepared.estimatedInputTokens, outputTokens: 500 });
  if (!reservation.ok) return localDedupEnvelope(local, 'fallback_budget_exhausted', input.budget, reservation.code);
  const runtimeResult = await invokeKnowledgeRuntime(input, prepared, KNOWLEDGE_DEDUP_MODEL_SCHEMA, 500);
  if (!runtimeResult.ok) return attemptedDedupFallback(local, runtimeResult);
  const merged = mergeKnowledgeDedupDecision({ local, snapshot: input.snapshot, projection: prepared.projection, decision: runtimeResult.data });
  return merged.ok ? appliedDedupEnvelope(merged.value, runtimeResult) : attemptedDedupFallback(local, runtimeResult, 'SCHEMA_INVALID');
}
```

`mergeKnowledgeDedupDecision()` must reject the whole candidate for duplicate/out-of-range pair indexes or invalid evidence associations, ignore `unrelated`, map `complementary -> keep_both`, map semantic duplicate and all revisions to `review_manually`, and require a local version token or timestamp ordering before retaining `possible_revision`. It must rebuild IDs, title, reason, severity, confidence, recommendation, and signals from the owner snapshot.

- [ ] **Step 4: Run full Dedup GREEN tests**

Run: `bun test packages/agent/tests/knowledge-dedup.test.ts packages/agent/tests/knowledge-dedup-model-candidate.test.ts`

Expected: PASS, including timeout, abort, invalid usage, invalid schema, runtime throw, exact-hash immutability, maximum five suggestions, no write capability, and no prompt/content in observations.

- [ ] **Step 5: Commit Task 3**

```bash
git add packages/agent/src/model-candidates/knowledge-dedup-model-candidate.ts packages/agent/src/model-candidates/production.ts packages/agent/src/nodes/knowledge-dedup.ts packages/agent/tests/knowledge-dedup*.test.ts
git commit -m "feat(agent): add governed dedup candidate"
```

### Task 4: Implement the Organizer candidate and authoritative local merger

**Files:**
- Create: `packages/agent/src/model-candidates/knowledge-organizer-model-candidate.ts`
- Create: `packages/agent/tests/knowledge-organizer-model-candidate.test.ts`
- Modify: `packages/agent/src/nodes/knowledge-organizer.ts`
- Modify: `packages/agent/tests/knowledge-organizer.test.ts`
- Modify: `packages/agent/src/model-candidates/production.ts`

- [ ] **Step 1: Write RED tests for label constraints and local reconstruction**

```ts
test('rejects unsafe labels and does not partially apply candidate output', async () => {
  const result = await runKnowledgeOrganizerModelCandidate(organizerInput({
    runtime: fixedRuntime({
      tags: [{ documentIndex: 0, subject: 'math', resourceType: 'notes', topicLabels: ['[点击](https://x.test)'] }],
      collections: [],
    }),
  }));
  expect(result.observation.disposition).toBe('fallback_schema_invalid');
  expect(result.value).toEqual(organizerInput().deterministic);
});

test('maps ordinals to owner snapshot IDs and rebuilds descriptive fields locally', async () => {
  const result = await runKnowledgeOrganizerModelCandidate(organizerInput({ runtime: validOrganizerRuntime() }));
  expect(result.observation.disposition).toBe('candidate_applied');
  expect(result.value.tags[0]).toMatchObject({ documentId: 'owner-doc-1', labels: ['数学', '笔记'] });
  expect(result.value.tags[0]?.reason).toBe('语义模型在受限候选中识别出资料主题与类型。');
});
```

- [ ] **Step 2: Run RED test**

Run: `bun test packages/agent/tests/knowledge-organizer-model-candidate.test.ts`

Expected: FAIL because the candidate does not exist.

- [ ] **Step 3: Implement Organizer candidate and merger**

```ts
export function mergeKnowledgeOrganizerDecision(input: OrganizerMergeInput): KnowledgeOrganizerResult | null {
  if (!indexesAreUniqueAndInRange(input.decision, input.projection.documents.length)) return null;
  if (!allLabelsPassCandidateTextGuard(input.decision) || !collectionMembersAreSortedUnique(input.decision)) return null;
  const tags = input.decision.tags.map((tag) => ({
    documentId: input.snapshot.documents[tag.documentIndex]!.id,
    labels: buildFinalLabels(tag).slice(0, 3),
    reason: '语义模型在受限候选中识别出资料主题与类型。',
    confidence: 0.82,
  }));
  const collections = input.decision.collections.slice(0, 5).map((collection) => ({
    name: collection.name,
    description: buildLocalCollectionDescription(collection.theme),
    documentIds: collection.memberIndexes.map((index) => input.snapshot.documents[index]!.id),
    reason: buildLocalCollectionReason(collection.theme, collection.memberIndexes.length),
    confidence: 0.8,
    signals: [`modelTheme:${collection.theme}`],
  }));
  return { summary: buildOrganizerSummary(tags, collections), tags, collections, signals: ['semanticOrganization'] };
}
```

The candidate uses a 700-token output reservation. It requires at least one safe projected document, rejects URL/Markdown/HTML/instruction/credential/control characters after schema parsing, never persists tags or collections, and returns the existing deterministic Organizer result on every failure.

- [ ] **Step 4: Run Organizer GREEN tests**

Run: `bun test packages/agent/tests/knowledge-organizer.test.ts packages/agent/tests/knowledge-organizer-model-candidate.test.ts`

Expected: PASS for topic-label max 2, final-label max 3, collection max 5, members 2..8, exact ordinal membership, no duplicates, runtime errors, usage errors, abort, and deterministic fallback.

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/agent/src/model-candidates/knowledge-organizer-model-candidate.ts packages/agent/src/model-candidates/production.ts packages/agent/src/nodes/knowledge-organizer.ts packages/agent/tests/knowledge-organizer*.test.ts
git commit -m "feat(agent): add governed organizer candidate"
```

### Task 5: Build one immutable owner snapshot and provider-preflight stale fence

**Files:**
- Create: `apps/server/src/knowledge-agent/knowledge-owner-snapshot.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-owner-snapshot.spec.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.service.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts`

- [ ] **Step 1: Write RED service tests for transaction isolation and stale revalidation**

```ts
it('loads target ownership, documents, chunks, and shortlist in one RepeatableRead transaction', async () => {
  await service.getSuggestions('owner-1', { limit: 20, documentId: 'doc-1' });
  expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
  expect(outsideTransactionDocumentQueries()).toBe(0);
});

it('returns snapshot_stale without invoking either runtime', async () => {
  staleRevalidationQuery.mockResolvedValueOnce([{ id: 'doc-1', updatedAt: changedDate }]);
  const result = await service.getSuggestions('owner-1', { limit: 20 });
  expect(runtimeInvocations()).toBe(0);
  expect(result.dedup.runtime.reasonCode).toBe('snapshot_stale');
  expect(result.organizer.runtime.reasonCode).toBe('snapshot_stale');
});
```

- [ ] **Step 2: Run RED tests**

Run: `bun --filter @repo/server test -- knowledge-owner-snapshot.spec.ts knowledge-agent.service.spec.ts --runInBand`

Expected: FAIL because current service performs independent ownership/list/target queries and has no snapshot fingerprint.

- [ ] **Step 3: Implement the snapshot contract and hash**

```ts
export const KNOWLEDGE_OWNER_SNAPSHOT_VERSION = 'knowledge-owner-snapshot-v1';

export type KnowledgeOwnerSnapshot = Readonly<{
  version: typeof KNOWLEDGE_OWNER_SNAPSHOT_VERSION;
  ownerHash: string;
  fingerprint: string;
  targetDocumentId?: string;
  documents: readonly KnowledgeOwnerDocument[];
  selectedChunks: readonly KnowledgeOwnerChunk[];
  shortlistVersion: 'knowledge-semantic-shortlist-v1';
}>;

export function fingerprintKnowledgeOwnerSnapshot(input: KnowledgeOwnerSnapshotMaterial): string {
  return createHash('sha256').update(stableStringify({
    ownerHash: input.ownerHash,
    documents: input.documents.map(({ id, updatedAt, contentHash, status }) => ({ id, updatedAt, contentHash, status })),
    chunks: input.selectedChunks.map(({ id, documentId, index, contentHash, safetyVersion }) => ({ id, documentId, index, contentHash, safetyVersion })),
    shortlistVersion: input.shortlistVersion,
  })).digest('hex');
}
```

Owner hash must be HMAC/one-way server-local material, not the raw user ID. Chunk `contentHash` is derived locally from full selected content because Prisma `Chunk` has no `updatedAt`; the hash is not returned to API/Trace.

- [ ] **Step 4: Refactor service snapshot loading and preflight**

```ts
const snapshot = await this.prisma.$transaction(
  (tx) => this.snapshotSource.load(tx, { userId, documentId: query.documentId, limit: Math.min(query.limit, 20) }),
  { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
);
const fresh = await this.snapshotSource.revalidate(this.prisma, snapshot);
if (!fresh) return this.localResponse(snapshot, now, 'snapshot_stale');
return this.runCandidates(snapshot, now);
```

`load()` must throw the existing 404 for an absent/cross-owner target inside the transaction, select at most 20 documents, include the target inside that same bounded set, and deep-freeze all returned arrays/objects. `revalidate()` repeats owner, document version/status/hash, and selected chunk identity/content hash/safety-version checks immediately before provider dispatch.

- [ ] **Step 5: Run GREEN tests and build**

Run: `bun --filter @repo/server test -- knowledge-owner-snapshot.spec.ts knowledge-agent.service.spec.ts --runInBand && bun --filter @repo/server build`

Expected: PASS; model calls occur outside the transaction, a stale/missing/replaced/reprocessed document or chunk yields provider zero-call, and target ownership is never checked in a separate pre-snapshot query.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/server/src/knowledge-agent/knowledge-owner-snapshot.ts apps/server/src/knowledge-agent/knowledge-owner-snapshot.spec.ts apps/server/src/knowledge-agent/knowledge-agent.service.ts apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts
git commit -m "feat(server): fence knowledge owner snapshots"
```

### Task 6: Implement the owner-scoped pgvector semantic shortlist

**Files:**
- Create: `apps/server/src/knowledge-agent/knowledge-semantic-candidate.source.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-semantic-candidate.source.spec.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-owner-snapshot.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.module.ts`

- [ ] **Step 1: Write RED tests for stable sampling, scoring, and isolation**

```ts
it('uses at most six safe chunks per document and top-three cross-document mean', async () => {
  const result = await source.load(transaction, ownerScopeFixture());
  expect(result.selectedChunks.filter((chunk) => chunk.documentId === 'd1')).toHaveLength(6);
  expect(result.pairs[0]).toMatchObject({ leftDocumentId: 'd1', rightDocumentId: 'd2', score: 0.9 });
});

it('binds raw SQL to canonical owner and bounded document IDs', async () => {
  await source.load(transaction, ownerScopeFixture());
  expect(queryText()).toContain('c."userId" =');
  expect(queryParameters()).toContain('owner-1');
  expect(queryParameters()).not.toContain('other-owner-document');
});
```

- [ ] **Step 2: Run RED test**

Run: `bun --filter @repo/server test -- knowledge-semantic-candidate.source.spec.ts --runInBand`

Expected: FAIL because the semantic candidate source does not exist.

- [ ] **Step 3: Implement source constants and deterministic aggregation**

```ts
export const KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION = 'knowledge-semantic-shortlist-v1';
export const KNOWLEDGE_SEMANTIC_THRESHOLD = 0.78;
export const MAX_KNOWLEDGE_DOCUMENTS = 20;
export const MAX_CHUNKS_PER_DOCUMENT = 6;
export const MAX_SEMANTIC_PAIRS = 12;

function scoreDocumentPair(scores: readonly number[]): number {
  const top = [...scores].filter(isFiniteCosine).sort((a, b) => b - a).slice(0, 3);
  return top.length === 0 ? 0 : top.reduce((sum, value) => sum + value, 0) / top.length;
}

function finalizePairs(rows: readonly ChunkSimilarityRow[]): readonly KnowledgeSemanticPair[] {
  return deepFreeze(groupRowsByDocumentPair(rows)
    .map((group) => ({ ...group.identity, score: scoreDocumentPair(group.scores) }))
    .filter((pair) => pair.score >= KNOWLEDGE_SEMANTIC_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.leftDocumentId.localeCompare(b.leftDocumentId) || a.rightDocumentId.localeCompare(b.rightDocumentId))
    .slice(0, MAX_SEMANTIC_PAIRS));
}
```

The raw pgvector query must use `1 - (left.embedding <=> right.embedding)` only for selected current-owner chunks and current snapshot document IDs. Sample chunks by stable index buckets, then index/id order; exclude exact-hash pairs, non-`DONE` documents, null/invalid-dimension vectors, and anything without explicitly safe metadata. Return neither vectors nor content outside the snapshot loader.

- [ ] **Step 4: Run GREEN server tests**

Run: `bun --filter @repo/server test -- knowledge-semantic-candidate.source.spec.ts knowledge-owner-snapshot.spec.ts --runInBand`

Expected: PASS for 1536-dimension validation, top-three mean, threshold boundary, maximum 12 pairs, stable tie ordering, exact-hash exclusion, target filtering, cross-owner exclusion, and fake-source parity.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/server/src/knowledge-agent/knowledge-semantic-candidate.source.ts apps/server/src/knowledge-agent/knowledge-semantic-candidate.source.spec.ts apps/server/src/knowledge-agent/knowledge-owner-snapshot.ts apps/server/src/knowledge-agent/knowledge-agent.module.ts
git commit -m "feat(server): shortlist knowledge semantics"
```

### Task 7: Add default-off gates, DeepSeek runtime, pricing, and immutable shared budget

**Files:**
- Create: `apps/server/src/knowledge-agent/knowledge-model-config.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-model-config.spec.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-model-runtime.factory.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-model-runtime.factory.spec.ts`
- Modify: `apps/server/src/config/env.validation.ts`
- Modify: `apps/server/src/config/env.validation.spec.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.module.ts`

- [ ] **Step 1: Write RED configuration and transport tests**

```ts
it('defaults both gates off and timeouts to 4500ms', () => {
  expect(resolveKnowledgeModelConfig({})).toMatchObject({
    dedupEnabled: false, organizerEnabled: false,
    dedupTimeoutMs: 4500, organizerTimeoutMs: 4500,
    model: 'deepseek-v4-pro', promptVersion: 'knowledge-agents-v1',
  });
});

it('uses non-thinking JSON object mode, maxRetries=0, and no tools', async () => {
  await factory.create(validLiveEnvironment()).invokeStructured(validKnowledgeRequest());
  expect(providerRequest()).toMatchObject({
    model: 'deepseek-v4-pro', response_format: { type: 'json_object' }, maxRetries: 0,
  });
  expect(providerRequest()).not.toHaveProperty('tools');
  expect(providerRequest()).not.toHaveProperty('thinking');
});
```

- [ ] **Step 2: Run RED tests**

Run: `bun --filter @repo/server test -- knowledge-model-config.spec.ts knowledge-model-runtime.factory.spec.ts env.validation.spec.ts --runInBand`

Expected: FAIL because config keys and factory do not exist.

- [ ] **Step 3: Implement composition-only configuration**

```ts
export const KNOWLEDGE_REQUEST_BUDGET = Object.freeze({
  maxCalls: 2, usedCalls: 0,
  maxInputTokens: 6000, usedInputTokens: 0,
  maxOutputTokens: 1200, usedOutputTokens: 0,
});
export const KNOWLEDGE_MODEL_PRICE_CNY = Object.freeze({
  model: 'deepseek-v4-pro', inputPerMillion: 3, outputPerMillion: 6, requestCap: 0.03,
});

export function resolveKnowledgeModelConfig(env: NodeJS.ProcessEnv): KnowledgeModelConfig {
  return Object.freeze({
    dedupEnabled: parseDefaultFalse(env.KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED),
    organizerEnabled: parseDefaultFalse(env.KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED),
    dedupTimeoutMs: parseBoundedTimeout(env.KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS, 4500),
    organizerTimeoutMs: parseBoundedTimeout(env.KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS, 4500),
    model: 'deepseek-v4-pro', promptVersion: 'knowledge-agents-v1',
  });
}
```

The factory receives API key/base URL/pricing through the server composition root only. `@repo/agent` must not read environment variables. Live eligibility is the conjunction of `AI_PROVIDER_MODE=live`, `AI_ENABLE_LIVE_CALLS=true`, the corresponding Knowledge gate, valid credentials, known exact pricing profile, snapshot eligibility, and available budget.

- [ ] **Step 4: Implement parallel-safe budget reservations**

Reserve Dedup `3000/500` and Organizer `3000/700` from one cloned, deep-frozen request budget before either Promise starts. If either reservation cannot be proven, both candidates return `fallback_budget_exhausted` with zero invocation. Runtime usage must be positive safe integers, within its reservation, and reconcile to the aggregate `<=6000/1200`, or the affected candidate fails closed. Assert the frozen worst-case price:

```ts
expect(6000 * 3 / 1_000_000 + 1200 * 6 / 1_000_000).toBe(0.0252);
expect(estimateKnowledgeRequestCostCny({ inputTokens: 6000, outputTokens: 1200 })).toBeLessThanOrEqual(0.03);
```

- [ ] **Step 5: Run GREEN tests and server build**

Run: `bun --filter @repo/server test -- knowledge-model-config.spec.ts knowledge-model-runtime.factory.spec.ts env.validation.spec.ts --runInBand && bun --filter @repo/server build`

Expected: PASS for default-off, malformed booleans/timeouts, unknown price fail-closed, missing credential zero-call, no retry, JSON-object mode, abort deadline, usage validation, and immutable shared budget.

- [ ] **Step 6: Commit Task 7**

```bash
git add apps/server/src/knowledge-agent/knowledge-model-* apps/server/src/config/env.validation* apps/server/src/knowledge-agent/knowledge-agent.module.ts
git commit -m "feat(server): compose knowledge model runtime"
```

### Task 8: Orchestrate both candidates in parallel with API metadata and safe Trace

**Files:**
- Create: `apps/server/src/knowledge-agent/knowledge-agent-trace.ts`
- Create: `apps/server/src/knowledge-agent/knowledge-agent-trace.spec.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.service.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.service.spec.ts`
- Modify: `packages/types/src/api/knowledge-agent.ts`
- Create: `packages/types/tests/knowledge-agent.test.mts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.controller.ts`

- [ ] **Step 1: Write RED API and service orchestration tests**

```ts
it('starts both eligible candidates before awaiting either one', async () => {
  const barrier = twoPartyBarrier();
  dedupCandidate.mockImplementation(() => barrier.enter('dedup'));
  organizerCandidate.mockImplementation(() => barrier.enter('organizer'));
  await service.getSuggestions('owner-1', { limit: 20 });
  expect(barrier.startOrder).toEqual(['dedup', 'organizer']);
});

test('accepts only the backward-compatible safe runtime metadata', () => {
  expect(knowledgeAgentSuggestionResponseSchema.parse(responseFixture()).dedup.runtime).toMatchObject({
    source: 'hybrid_model', disposition: 'candidate_applied', attempted: true, degraded: false,
  });
  expect(JSON.stringify(responseFixture())).not.toMatch(/prompt|summaryText|embedding|providerOutput|rawError|apiKey/i);
});
```

- [ ] **Step 2: Run RED tests**

Run: `node --experimental-strip-types --test packages/types/tests/knowledge-agent.test.mts && bun --filter @repo/server test -- knowledge-agent.service.spec.ts knowledge-agent-trace.spec.ts --runInBand`

Expected: FAIL because response metadata and Trace composer do not exist.

- [ ] **Step 3: Extend the strict response contract**

```ts
export const knowledgeAgentRuntimeMetadataSchema = z.object({
  source: z.enum(['local_deterministic', 'hybrid_model']),
  disposition: z.enum([
    'candidate_applied', 'not_eligible', 'gate_disabled', 'safety_blocked',
    'snapshot_stale', 'fallback_aborted', 'fallback_budget_exhausted',
    'fallback_schema_invalid', 'fallback_runtime_error', 'fallback_usage_invalid',
  ]),
  reasonCode: z.string().regex(/^[a-z0-9_]+$/),
  attempted: z.boolean(),
  degraded: z.boolean(),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), pricingKnown: z.boolean(), estimatedCostCny: z.number().nonnegative().nullable() }).strict(),
  traceId: z.string().min(1).nullable(),
}).strict();

export const knowledgeAgentSuggestionResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  dedup: knowledgeDedupResultSchema.extend({ runtime: knowledgeAgentRuntimeMetadataSchema }),
  organizer: knowledgeOrganizerResultSchema.extend({ runtime: knowledgeAgentRuntimeMetadataSchema }),
}).strict();
```

Default-off/local metadata uses zero usage, `pricingKnown=false`, `estimatedCostCny=null`, never a fake zero-cost model success.

- [ ] **Step 4: Implement service orchestration and Trace composition**

```ts
const [dedup, organizer] = await Promise.all([
  this.runDedup({ snapshot, projection, budget: reservations.dedup, signal }),
  this.runOrganizer({ snapshot, projection, dedupFacts: localDedupFacts, budget: reservations.organizer, signal }),
]);
const trace = await this.traceRecorder.record(buildKnowledgeSuggestionTrace({
  parentRunId, snapshotFingerprint: snapshot.fingerprint, dedup: dedup.observation, organizer: organizer.observation,
}));
return attachSafeRuntimeMetadata({ generatedAt, dedup, organizer, trace });
```

Trace must contain one parent and two candidate steps with agent name, version, disposition, fixed reason codes, latency, verified usage, pricing provenance, and cost. It must not contain owner ID/hash, fingerprint, ordinal map, prompt, filename, summary, chunk/vector, provider body/header, raw error, or credentials. Each provider call gets one `usageRef`; aggregate cost deduplicates by `usageRef`.

- [ ] **Step 5: Run GREEN contracts and orchestration tests**

Run: `node --experimental-strip-types --test packages/types/tests/knowledge-agent.test.mts && bun --filter @repo/server test -- knowledge-agent.service.spec.ts knowledge-agent-trace.spec.ts --runInBand`

Expected: PASS for independent gates, Dedup-only/Organizer-only/both/default-off, parallel dispatch, one-call-one-charge, Trace unavailable fail-closed, stable API schema, no mutations, and no sensitive metadata.

- [ ] **Step 6: Commit Task 8**

```bash
git add packages/types/src/api/knowledge-agent* apps/server/src/knowledge-agent/knowledge-agent.controller.ts apps/server/src/knowledge-agent/knowledge-agent.service* apps/server/src/knowledge-agent/knowledge-agent-trace*
git commit -m "feat(server): orchestrate knowledge semantic agents"
```

### Task 9: Show local, hybrid, and degraded read-only states on `/knowledge`

**Files:**
- Modify: `apps/web/src/lib/knowledge-agent-view.ts`
- Modify: `apps/web/src/lib/knowledge-agent-view.test.mts`
- Modify: `apps/web/src/lib/knowledge-agent-api.test.mts`
- Modify: `apps/web/src/app/(main)/knowledge/page.tsx`
- Modify: `apps/web/src/app/(main)/knowledge/page.test.mts`

- [ ] **Step 1: Write RED view-state tests**

```ts
assert.deepEqual(getKnowledgeAgentSourceView(hybridResponse()), {
  tone: 'semantic', label: '语义建议', description: '已结合资料语义生成只读整理建议。',
});
assert.deepEqual(getKnowledgeAgentSourceView(localResponse()), {
  tone: 'local', label: '本地规则建议', description: '当前使用本地规则，资料功能不受影响。',
});
assert.deepEqual(getKnowledgeAgentSourceView(degradedResponse()), {
  tone: 'degraded', label: '本地规则建议', description: '语义判断暂不可用，已安全回退；上传、处理与检索不受影响。',
});
```

- [ ] **Step 2: Run RED tests**

Run: `bun test apps/web/src/lib/knowledge-agent-view.test.mts apps/web/src/app/'(main)'/knowledge/page.test.mts`

Expected: FAIL because source-state helpers and labels do not exist.

- [ ] **Step 3: Implement source-state mapping and render it**

```ts
export function getKnowledgeAgentSourceView(response: KnowledgeAgentSuggestionResponse): KnowledgeAgentSourceView {
  const runtimes = [response.dedup.runtime, response.organizer.runtime];
  if (runtimes.some((runtime) => runtime.degraded)) {
    return { tone: 'degraded', label: '本地规则建议', description: '语义判断暂不可用，已安全回退；上传、处理与检索不受影响。' };
  }
  if (runtimes.some((runtime) => runtime.source === 'hybrid_model' && runtime.disposition === 'candidate_applied')) {
    return { tone: 'semantic', label: '语义建议', description: '已结合资料语义生成只读整理建议。' };
  }
  return { tone: 'local', label: '本地规则建议', description: '当前使用本地规则，资料功能不受影响。' };
}
```

Render one compact badge/description above the existing suggestions. Do not render cost, prompt, provider error, document UUID, a retry button, or an automatic-organize action. Preserve existing upload/process/replace/delete/search controls and the current empty/error states.

- [ ] **Step 4: Run GREEN web checks**

Run: `bun --filter @repo/web test && bun --filter @repo/web lint && bun --filter @repo/web build`

Expected: all exit 0; tests cover hybrid, default-off local, degraded, empty, request failure, mobile text wrapping, and absence of any automatic mutation action.

- [ ] **Step 5: Commit Task 9**

```bash
git add apps/web/src/lib/knowledge-agent-* apps/web/src/app/'(main)'/knowledge/page.tsx apps/web/src/app/'(main)'/knowledge/page.test.mts
git commit -m "feat(web): label knowledge semantic suggestions"
```

### Task 10: Add the Mock/Live paired runner, CLI, and strict evidence validator

**Files:**
- Create: `packages/agent/src/evals/phase-6-9-knowledge-agent-paired-contract.ts`
- Create: `packages/agent/src/evals/run-phase-6-9-knowledge-agent-paired.ts`
- Create: `packages/agent/scripts/phase-6-9-6-knowledge-agent-cli.ts`
- Create: `packages/agent/scripts/validate-phase-6-9-6-knowledge-agent-evidence.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-paired-contract.test.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-paired-runner.test.ts`
- Create: `packages/agent/tests/phase-6-9-knowledge-agent-cli.test.ts`
- Modify: `packages/agent/package.json`

- [ ] **Step 1: Write RED report-contract and runner tests**

```ts
test('requires exact counts, versions, provenance, and separate branch/main run identity', () => {
  const parsed = PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA.parse(validReport());
  expect(parsed.counts).toEqual({ cases: 72, zeroCall: 24, runtime: 48, pairedRequests: 24 });
  expect(parsed.datasetVersion).toBe('phase-6.9-knowledge-agents-v1');
  expect(parsed.shortlistVersion).toBe('knowledge-semantic-shortlist-v1');
  expect(parsed.projectionVersion).toBe('knowledge-model-projection-v1');
});

test('runs two runtime cases concurrently for every pairedRunIndex', async () => {
  const report = await runKnowledgeAgentPairedEval(mockHarness());
  expect(report.latency.endpointSamplesMs).toHaveLength(24);
  expect(report.caseEntries.filter((entry) => entry.zeroCallVerified)).toHaveLength(24);
  expect(report.runtimeInvocations).toBe(48);
});
```

- [ ] **Step 2: Run RED tests**

Run: `bun test packages/agent/tests/phase-6-9-knowledge-agent-{paired-contract,paired-runner,cli}.test.ts`

Expected: FAIL because paired contracts and CLI do not exist.

- [ ] **Step 3: Implement the strict report schema and gate calculation**

```ts
export const PHASE_6_9_KNOWLEDGE_AGENT_REPORT_SCHEMA = z.object({
  runId: z.string().uuid(),
  runScope: z.enum(['branch', 'main']),
  mode: z.enum(['deterministic', 'mock', 'live']),
  datasetVersion: z.literal('phase-6.9-knowledge-agents-v1'),
  promptVersion: z.literal('knowledge-agents-v1'),
  projectionVersion: z.literal('knowledge-model-projection-v1'),
  shortlistVersion: z.literal('knowledge-semantic-shortlist-v1'),
  provider: z.enum(['none', 'mock', 'deepseek']),
  model: z.enum(['none', 'mock', 'deepseek-v4-pro']),
  counts: z.object({ cases: z.literal(72), zeroCall: z.literal(24), runtime: z.literal(48), pairedRequests: z.literal(24) }).strict(),
  metrics: KNOWLEDGE_SEMANTIC_METRICS_SCHEMA,
  latency: KNOWLEDGE_LATENCY_SCHEMA,
  usage: KNOWLEDGE_USAGE_SCHEMA,
  safety: KNOWLEDGE_SAFETY_SCHEMA,
  caseEntries: z.array(KNOWLEDGE_CASE_ENTRY_SCHEMA).length(72),
  gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
}).strict();
```

`computeKnowledgeGate()` must require 24/24 verified zero-call, 48/48 canonical schema success, no critical/permission/mutation failures, exact-hash 100%, all fixed quality thresholds, absolute score improvement `>=0.10`, Dedup/Organizer P95 `<=4500`, endpoint P95 `<=5200`, known provenance/usage/pricing, total controlled-Live cost `<=1.00 CNY`, and no broader fallback. Failed cases remain in denominators.

- [ ] **Step 4: Implement safe CLI modes and evidence validation**

```ts
const mode = z.enum(['baseline', 'mock', 'live', 'validate']).parse(process.argv[2]);
if (mode === 'live' && process.env.PHASE_6_9_6_CONTROLLED_LIVE_APPROVED !== 'true') {
  throw new Error('PHASE_6_9_6_LIVE_AUTHORIZATION_REQUIRED');
}
```

CLI stdout may print only run ID, versions, aggregate counts, metrics, latency, usage, cost, gate, and evidence path. The evidence writer must reject keys matching `/prompt|filename|summary|chunk|embedding|provider.*(body|header|response)|credential|api.?key|raw.*error/i`. Validator must reject duplicate IDs, wrong counts, missing cases, mixed branch/main run IDs, nonpositive attempted usage, impossible cost, unknown pricing, or any sensitive key.

- [ ] **Step 5: Run GREEN Mock runner and validator**

Run: `bun test packages/agent/tests/phase-6-9-knowledge-agent-{paired-contract,paired-runner,cli}.test.ts && bun --filter @repo/agent eval:phase-6-9-6:mock && bun --filter @repo/agent eval:phase-6-9-6:validate`

Expected: PASS with exactly 72 cases, 24 zero-call verified with 0 invocation, 48 structured Mock successes in 24 paired requests, no sensitive evidence keys, and no network call.

- [ ] **Step 6: Commit Task 10**

```bash
git add packages/agent/src/evals/phase-6-9-knowledge-agent-* packages/agent/scripts/*phase-6-9-6* packages/agent/tests/phase-6-9-knowledge-agent-* packages/agent/package.json
git commit -m "test(agent): add knowledge paired evaluation"
```

### Task 11: Wire server-only Docker configuration and operating documentation

**Files:**
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `apps/server/src/config/env.validation.spec.ts`
- Modify: `apps/server/src/knowledge-agent/knowledge-agent.module.spec.ts`
- Modify: `docs/dev-start.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`
- Modify: `docs/data-flow.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Write RED Docker/config boundary tests**

```ts
it('exposes Knowledge model gates only to the API service', () => {
  const compose = parseCompose();
  expect(compose.services.api.environment).toMatchObject({
    KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: expect.anything(),
    KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: expect.anything(),
  });
  expect(compose.services.worker.environment).not.toHaveProperty('KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED');
  expect(compose.services.web.environment).not.toHaveProperty('KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED');
  expect(compose.services.admin.environment).not.toHaveProperty('KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED');
});
```

- [ ] **Step 2: Run RED tests**

Run: `bun --filter @repo/server test -- env.validation.spec.ts knowledge-agent.module.spec.ts --runInBand`

Expected: FAIL because the Compose/config keys are absent.

- [ ] **Step 3: Add default-off API-only configuration**

```yaml
KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: ${KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED:-false}
KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: ${KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED:-false}
KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS: ${KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS:-4500}
KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: ${KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS:-4500}
```

Add these only under the API service. Document the full live conjunction, independent rollback, 0.03 CNY request cap, synthetic-only controlled-Live rule, provider retention prerequisite, default-off restoration, and the prohibited Docker cleanup commands.

- [ ] **Step 4: Run GREEN config tests and render Compose**

Run: `bun --filter @repo/server test -- env.validation.spec.ts knowledge-agent.module.spec.ts --runInBand && docker compose config --quiet`

Expected: exit 0; rendered API environment contains four variables with false/false/4500/4500 defaults, and worker/web/admin do not contain them.

- [ ] **Step 5: Commit Task 11**

```bash
git add .env.example docker-compose.yml apps/server/src/config/env.validation.spec.ts apps/server/src/knowledge-agent/knowledge-agent.module.spec.ts docs/dev-start.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md docs/data-flow.md README.md AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "docs(agent): operate knowledge semantic agents"
```

### Task 12: Complete branch static and Mock acceptance, then stop for Live authorization

**Files:**
- Create: `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`
- Modify: `AGENTS.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Run the focused suites once**

```bash
bun test packages/agent/tests/knowledge-*.test.ts packages/agent/tests/phase-6-9-knowledge-agent-*.test.ts
node --experimental-strip-types --test packages/types/tests/knowledge-agent.test.mts
bun --filter @repo/server test -- knowledge-agent --runInBand
bun test apps/web/src/lib/knowledge-agent-*.test.mts apps/web/src/app/'(main)'/knowledge/page.test.mts
```

Expected: all pass; capture counts and elapsed time in the acceptance document.

- [ ] **Step 2: Run the branch-wide static gates once**

```bash
bun --filter @repo/agent test
bun --filter @repo/agent typecheck
bun --filter @repo/agent lint
bun --filter @repo/types test
bun --filter @repo/server test -- --runInBand
bun --filter @repo/server build
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: all exit 0. Do not rerun successful expensive gates unless a later change touches their code path.

- [ ] **Step 3: Run and validate deterministic/Mock evidence**

```bash
bun --filter @repo/agent eval:phase-6-9-6:baseline
bun --filter @repo/agent eval:phase-6-9-6:mock
bun --filter @repo/agent eval:phase-6-9-6:validate
git diff --check
git status --short
```

Expected: the frozen deterministic baseline is reproduced; Mock has 24/24 verified zero-call and 48/48 strict runtime success; validator and `git diff --check` pass; only intended acceptance/doc changes remain.

- [ ] **Step 4: Record the branch checkpoint and commit**

The acceptance document must state: no real model call yet, no Docker/browser product acceptance yet, both production gates remain false, controlled-Live needs new explicit approval, static/Mock evidence paths and hashes, no database/object/Trace cleanup was needed, and Phase 6.9.6 is not complete.

```bash
git add docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md AGENTS.md DEVLOG.md docs/roadmap.md
git commit -m "docs(agent): checkpoint knowledge branch acceptance"
```

- [ ] **Step 5: Stop and ask for fresh controlled-Live authorization**

Do not set `PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true`, do not enable live/gates, and do not start Task 13 until the user explicitly authorizes one controlled-Live run.

### Task 13: Execute controlled-Live and product acceptance, merge to main, replay, and push

**Files:**
- Modify: `docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `DEVLOG.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/ai-behavior-acceptance.md`
- Modify: `docs/acceptance-checklist.md`

- [ ] **Step 1: Preflight fresh authorization, provider policy, repository, and Docker data safety**

```bash
git status --short --branch
git log -1 --oneline
docker compose ps
bun --filter @repo/agent eval:phase-6-9-6:validate
```

Expected: clean feature branch at the Task 12 checkpoint; Docker volumes remain present; default provider mode/gates are still mock/false/false; the account/provider retention setting is documented and accepted. If authorization or retention acceptance is missing, stop without a network call.

- [ ] **Step 2: Execute the single authorized branch controlled-Live run**

Run with environment supplied to the process only, never written to evidence:

```bash
PHASE_6_9_6_CONTROLLED_LIVE_APPROVED=true AI_PROVIDER_MODE=live AI_ENABLE_LIVE_CALLS=true KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=true KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=true bun --filter @repo/agent eval:phase-6-9-6:live
bun --filter @repo/agent eval:phase-6-9-6:validate
```

Expected: one report with 72 cases, 24/24 zero-call, 48/48 structured runtime successes, 24 paired endpoint samples, all fixed quality/latency/safety gates, verified positive usage, known cost `<=1.00 CNY`, and no sensitive evidence. If any gate fails, keep both production gates false, preserve the immutable report, document the exact fixed failure code, and return to a newly versioned remediation plan rather than rerunning.

- [ ] **Step 3: Run Docker API acceptance with synthetic owner data**

Start the existing stack without deleting volumes. Test these modes with separately created synthetic accounts/documents and record Trace/API parity:

1. Dedup-only: true/false.
2. Organizer-only: false/true.
3. Both enabled: true/true.
4. Default-off replay: false/false.

Expected: exact hash is always provider zero-call; unsafe/credential/injection/other-owner target is zero-call; eligible semantic data returns `candidate_applied`; forced provider failure returns local degraded results; upload/process/search/list remain successful; no document/chunk/tag/collection mutations occur.

- [ ] **Step 4: Perform visible `/knowledge` browser acceptance and leave the window open**

Use the visible browser against the Docker web app. Verify desktop and mobile widths for semantic badge, local badge, degraded copy, empty state, failure state, suggestions, upload/process/search, and absence of automatic organize/delete/replace actions. Leave the browser window open when acceptance finishes so the user can inspect it.

- [ ] **Step 5: Precisely clean synthetic data and restore defaults**

Delete only synthetic account-owned documents, chunks, MinIO objects, BackgroundJobs, Agent Traces, and browser storage created by this task; verify their counts are zero. Restore:

```text
AI_PROVIDER_MODE=mock
AI_ENABLE_LIVE_CALLS=false
KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED=false
KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED=false
```

Do not prune Docker, remove volumes, reset databases, flush Redis, wipe MinIO, or remove unrelated browser data.

- [ ] **Step 6: Complete independent review, final docs, and branch commit**

Request separate security/permissions and metrics/evidence reviews. Resolve every Critical/Important finding, rerun only affected focused checks, then update all listed docs with actual commit IDs, counts, cost, dispositions, cleanup proof, remaining default-off boundary, next phase, and reusable review questions.

```bash
git add docs/acceptance/2026-07-21-phase-6-9-6-knowledge-agents.md AGENTS.md README.md DEVLOG.md docs/roadmap.md docs/data-flow.md docs/ai-behavior-acceptance.md docs/acceptance-checklist.md
git commit -m "docs(agent): accept knowledge semantic agents"
```

- [ ] **Step 7: Merge with `--no-ff`, replay on main, and push**

```bash
git status --short
git switch main
git pull --ff-only origin main
git merge --no-ff codex/phase-6-9-6-knowledge-agents -m "merge: phase 6.9.6 knowledge semantic agents"
```

On `main`, rerun the focused Agent/types/server/web tests, typecheck/lint/build commands affected by the merge, Docker default-off API replay, and visible `/knowledge` default-off browser replay. Do not repeat the controlled-Live authority run unless the acceptance plan explicitly proves a fresh main-only call is necessary and the user separately authorizes it.

```bash
git push origin main
git fetch origin main
git rev-list --left-right --count origin/main...HEAD
git status --short --branch
```

Expected: push succeeds; parity is `0 0`; main is clean; Docker data/volumes remain intact; both Knowledge gates remain false; Phase 6.9.6 is marked complete only after this replay.

## Final completion boundary

Completing this plan proves the two Knowledge agents can use constrained real semantics and safely fall back in the product. It does **not** complete Phase 6.9, executable LangGraph, MemoryAgent, Tutor/WrongQuestionOrganizer, Retriever/FinalResponse, Tool-Using Orchestrator, Phase 6.10 layered memory, Phase 8, Phase 9, or either interview blog.
