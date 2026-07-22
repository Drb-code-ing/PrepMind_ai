import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  runKnowledgeDedupModelCandidate,
  type KnowledgeDedupModelCandidateInput,
} from '../src/model-candidates/knowledge-dedup-model-candidate.ts';
import type { KnowledgeAgentDocumentInput } from '../src/nodes/knowledge-dedup.ts';

const NOW = '2026-07-21T08:00:00.000Z';

function document(
  id: string,
  overrides: Partial<KnowledgeAgentDocumentInput> = {},
): KnowledgeAgentDocumentInput {
  return {
    id,
    name: `${id === 'd1' ? '函数讲义' : '函数练习'}.pdf`,
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: `hash-${id}`,
    chunkCount: 2,
    processedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    chunkSummaries: ['二次函数与判别式。', '典型例题与练习。'],
    ...overrides,
  };
}

function projectionSource(
  documents: readonly KnowledgeAgentDocumentInput[],
  pairs: readonly {
    leftDocumentId: string;
    rightDocumentId: string;
    evidenceBand: 'medium' | 'high';
  }[] = [],
) {
  return {
    documents: documents.map((item) => ({
      documentId: item.id,
      name: item.name,
      type: item.type,
      relativeTime: 'same_time' as const,
      safety: 'safe_for_model' as const,
      summaries: item.chunkSummaries.map((text) => ({
        text,
        safety: 'safe_for_model' as const,
      })),
    })),
    pairs,
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'knowledge-dedup-test',
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => output,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return { requests, runtime };
}

function budget(overrides: { maxInputTokens?: number; maxOutputTokens?: number } = {}) {
  return createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: overrides.maxInputTokens ?? 3000,
    maxOutputTokens: overrides.maxOutputTokens ?? 500,
  });
}

function candidateInput(
  output: unknown,
  overrides: Partial<KnowledgeDedupModelCandidateInput> = {},
) {
  const documents = [document('d1'), document('d2')];
  const tracked = trackedRuntime(output);
  return {
    tracked,
    input: {
      runId: 'knowledge-dedup-test-run',
      deterministicInput: { now: NOW, documents },
      projectionSource: projectionSource(documents, [
        { leftDocumentId: 'd1', rightDocumentId: 'd2', evidenceBand: 'high' },
      ]),
      runtime: tracked.runtime,
      budget: budget(),
      ...overrides,
    } satisfies KnowledgeDedupModelCandidateInput,
  };
}

describe('knowledge Dedup model candidate', () => {
  test('keeps exact hash local and skips runtime when no semantic pair exists', async () => {
    const documents = [
      document('d1', { contentHash: 'same-hash' }),
      document('d2', { contentHash: 'same-hash' }),
    ];
    const tracked = trackedRuntime({ decisions: [] });

    const result = await runKnowledgeDedupModelCandidate({
      runId: 'exact-hash-zero-call',
      deterministicInput: { now: NOW, documents },
      projectionSource: projectionSource(documents, [
        { leftDocumentId: 'd1', rightDocumentId: 'd2', evidenceBand: 'high' },
      ]),
      runtime: tracked.runtime,
      budget: budget(),
    });

    expect(tracked.requests).toHaveLength(0);
    expect(result.value.items[0]).toMatchObject({
      kind: 'exact_duplicate',
      recommendation: 'use_existing',
      documentIds: ['d1', 'd2'],
    });
    expect(result.observation).toMatchObject({ attempted: false, disposition: 'not_eligible' });
  });

  test('downgrades a revision without local version or timestamp evidence', async () => {
    const { input, tracked } = candidateInput({
      decisions: [
        {
          pairIndex: 0,
          relation: 'possible_revision',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap'],
        },
      ],
    });

    const result = await runKnowledgeDedupModelCandidate(input);

    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.value.items[0]).toMatchObject({
      kind: 'possible_revision',
      recommendation: 'review_manually',
      documentIds: ['d1', 'd2'],
    });
    expect(result.value.items[0]?.signals).toContain('insufficient_version_evidence');
  });

  test('represents a semantic duplicate without pretending it is a revision or write action', async () => {
    const { input, tracked } = candidateInput({
      decisions: [
        {
          pairIndex: 0,
          relation: 'semantic_duplicate',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap', 'same_scope'],
        },
      ],
    });

    const result = await runKnowledgeDedupModelCandidate(input);

    expect(result.value.items[0]).toMatchObject({
      kind: 'semantic_duplicate',
      recommendation: 'review_manually',
      documentIds: ['d1', 'd2'],
    });
    expect(result.value.items[0]?.recommendation).not.toBe('use_existing');
    expect(tracked.requests[0]?.task).toBe('knowledge_dedup');
    expect(tracked.requests[0]?.userPrompt).not.toMatch(/documentId|hash-|contentHash/);
    expect(tracked.requests[0]?.systemPrompt).toContain(
      'possible_revision requires semantic_overlap',
    );
    expect(tracked.requests[0]?.systemPrompt).toContain(
      'complementary requires different_purpose or complementary_coverage',
    );
    expect(tracked.requests[0]?.systemPrompt).toContain(
      'unrelated requires different_purpose or insufficient_version_evidence',
    );
  });

  test('lets authoritative local version or timestamp evidence upgrade a semantic duplicate to a revision', async () => {
    const documents = [
      document('d1', { updatedAt: '2026-07-01T08:00:00.000Z' }),
      document('d2', { updatedAt: '2026-07-15T08:00:00.000Z' }),
    ];
    const tracked = trackedRuntime({
      decisions: [
        {
          pairIndex: 0,
          relation: 'semantic_duplicate',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap', 'same_scope'],
        },
      ],
    });

    const result = await runKnowledgeDedupModelCandidate({
      runId: 'local-revision-authority',
      deterministicInput: { now: NOW, documents },
      projectionSource: projectionSource(documents, [
        { leftDocumentId: 'd1', rightDocumentId: 'd2', evidenceBand: 'high' },
      ]),
      runtime: tracked.runtime,
      budget: budget(),
    });

    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.value.items[0]).toMatchObject({
      kind: 'possible_revision',
      recommendation: 'review_manually',
      documentIds: ['d1', 'd2'],
    });
    expect(result.value.items[0]?.signals).toEqual(
      expect.arrayContaining(['semantic_overlap', 'newer_timestamp', 'localVersionSignal']),
    );
  });

  test('preserves exact-hash authority while applying a separate semantic decision', async () => {
    const documents = [
      document('d1', { contentHash: 'same-hash' }),
      document('d2', { contentHash: 'same-hash' }),
      document('d3', { name: '专题训练.pdf' }),
    ];
    const tracked = trackedRuntime({
      decisions: [
        {
          pairIndex: 0,
          relation: 'complementary',
          confidence: 'high',
          evidenceCodes: ['different_purpose', 'complementary_coverage'],
        },
      ],
    });

    const result = await runKnowledgeDedupModelCandidate({
      runId: 'exact-and-semantic',
      deterministicInput: { now: NOW, documents },
      projectionSource: projectionSource(documents, [
        { leftDocumentId: 'd1', rightDocumentId: 'd3', evidenceBand: 'high' },
      ]),
      runtime: tracked.runtime,
      budget: budget(),
    });

    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.value.items).toHaveLength(2);
    expect(result.value.items[0]).toMatchObject({
      kind: 'exact_duplicate',
      recommendation: 'use_existing',
      confidence: 0.96,
    });
    expect(result.value.items[1]).toMatchObject({
      kind: 'complementary',
      recommendation: 'keep_both',
      documentIds: ['d1', 'd3'],
    });
  });

  test('rejects the whole attempted candidate for duplicate or out-of-range pair indexes', async () => {
    for (const decisions of [
      [
        {
          pairIndex: 0,
          relation: 'semantic_duplicate',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap'],
        },
        {
          pairIndex: 0,
          relation: 'semantic_duplicate',
          confidence: 'medium',
          evidenceCodes: ['semantic_overlap'],
        },
      ],
      [
        {
          pairIndex: 1,
          relation: 'semantic_duplicate',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap'],
        },
      ],
    ]) {
      const { input } = candidateInput({ decisions });
      const result = await runKnowledgeDedupModelCandidate(input);
      expect(result.observation.disposition).toBe('fallback_schema_invalid');
      expect(result.value).toEqual(
        (await runKnowledgeDedupModelCandidate({
          ...input,
          projectionSource: { ...input.projectionSource, pairs: [] },
        })).value,
      );
    }
  });

  test('blocks unsafe projection, abort, and insufficient budget before runtime', async () => {
    const { input, tracked } = candidateInput({ decisions: [] });
    const unsafe = await runKnowledgeDedupModelCandidate({
      ...input,
      projectionSource: {
        ...input.projectionSource,
        documents: [
          { ...input.projectionSource.documents[0], name: 'api_key=sk-abcdefghijklmnop' },
        ],
        pairs: [],
      },
    });
    expect(unsafe.observation).toMatchObject({ attempted: false, disposition: 'safety_blocked' });

    const controller = new AbortController();
    controller.abort();
    const aborted = await runKnowledgeDedupModelCandidate({ ...input, signal: controller.signal });
    expect(aborted.observation).toMatchObject({ attempted: false, disposition: 'fallback_aborted' });

    const exhausted = await runKnowledgeDedupModelCandidate({
      ...input,
      budget: budget({ maxInputTokens: 1, maxOutputTokens: 1 }),
    });
    expect(exhausted.observation).toMatchObject({
      attempted: false,
      disposition: 'fallback_budget_exceeded',
    });
    expect(tracked.requests).toHaveLength(0);
  });

  test('falls back on runtime throw or schema-invalid output without exposing content', async () => {
    const { input } = candidateInput({
      decisions: [
        {
          pairIndex: 0,
          relation: 'semantic_duplicate',
          confidence: 'high',
          evidenceCodes: ['semantic_overlap'],
          deleteDocument: true,
        },
      ],
    });
    const schemaInvalid = await runKnowledgeDedupModelCandidate(input);
    expect(schemaInvalid.observation).toMatchObject({
      attempted: true,
      disposition: 'fallback_schema_invalid',
    });

    const throwing = await runKnowledgeDedupModelCandidate({
      ...input,
      runtime: {
        async invokeStructured() {
          throw new Error('provider body secret canary');
        },
      },
    });
    expect(throwing.observation).toMatchObject({
      attempted: true,
      disposition: 'fallback_runtime_error',
      traceUnavailable: true,
      usageUnavailable: true,
    });
    expect(JSON.stringify(throwing.observation)).not.toMatch(
      /provider body|函数讲义|二次函数|prompt|api.?key|raw.*error/i,
    );
  });

  test('falls back on timeout and unverifiable live usage from injected no-network executors', async () => {
    const timeoutRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'knowledge-dedup-no-network-test',
      liveCallsEnabled: true,
      timeoutMs: 50,
      executor: async () => new Promise<never>(() => undefined),
    });
    const usageInvalidRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'knowledge-dedup-no-network-test',
      liveCallsEnabled: true,
      timeoutMs: 100,
      executor: async () => ({
        object: {
          decisions: [
            {
              pairIndex: 0,
              relation: 'semantic_duplicate',
              confidence: 'high',
              evidenceCodes: ['semantic_overlap'],
            },
          ],
        },
      }),
    });
    const { input } = candidateInput({ decisions: [] });

    const [timeout, usageInvalid] = await Promise.all([
      runKnowledgeDedupModelCandidate({ ...input, runtime: timeoutRuntime }),
      runKnowledgeDedupModelCandidate({ ...input, runtime: usageInvalidRuntime }),
    ]);

    expect(timeout.observation.disposition).toBe('fallback_timeout');
    expect(usageInvalid.observation.disposition).toBe('fallback_runtime_error');
    expect(usageInvalid.observation.disposition).not.toBe('candidate_applied');
  });

  test('caps merged suggestions at five and does not mutate caller input or budget', async () => {
    const documents = Array.from({ length: 7 }, (_, index) =>
      document(`d${index + 1}`, {
        name: `资料 ${index + 1}.pdf`,
        contentHash: `hash-${index + 1}`,
      }),
    );
    const pairs = Array.from({ length: 6 }, (_, index) => ({
      leftDocumentId: 'd1',
      rightDocumentId: `d${index + 2}`,
      evidenceBand: 'high' as const,
    }));
    const decisions = pairs.map((_, pairIndex) => ({
      pairIndex,
      relation: 'complementary' as const,
      confidence: 'high' as const,
      evidenceCodes: ['different_purpose', 'complementary_coverage'] as const,
    }));
    const tracked = trackedRuntime({ decisions });
    const callerBudget = budget();
    const beforeBudget = { ...callerBudget };
    const source = projectionSource(documents, pairs);

    const result = await runKnowledgeDedupModelCandidate({
      runId: 'max-five',
      deterministicInput: { now: NOW, documents },
      projectionSource: source,
      runtime: tracked.runtime,
      budget: callerBudget,
    });

    expect(result.value.items).toHaveLength(5);
    expect(callerBudget).toEqual(beforeBudget);
    expect(source.documents.every((item) => !('ordinal' in item))).toBe(true);
  });
});
