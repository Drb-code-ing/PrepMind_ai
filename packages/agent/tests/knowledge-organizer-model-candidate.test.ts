import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  runKnowledgeOrganizerModelCandidate,
  type KnowledgeOrganizerModelCandidateInput,
} from '../src/model-candidates/knowledge-organizer-model-candidate.ts';
import type { KnowledgeAgentDocumentInput } from '../src/nodes/knowledge-dedup.ts';
import { organizeKnowledgeDocuments } from '../src/nodes/knowledge-organizer.ts';

const NOW = '2026-07-21T08:00:00.000Z';

function document(
  id: string,
  overrides: Partial<KnowledgeAgentDocumentInput> = {},
): KnowledgeAgentDocumentInput {
  return {
    id,
    name: `${id === 'd1' ? '离散数学笔记' : '算法练习'}.pdf`,
    type: 'PDF',
    size: 1024,
    status: 'DONE',
    sourceType: 'UPLOAD',
    contentHash: `hash-${id}`,
    chunkCount: 2,
    processedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    chunkSummaries: ['图论、组合数学与算法分析。', '包含典型例题。'],
    ...overrides,
  };
}

function projectionSource(documents: readonly KnowledgeAgentDocumentInput[]) {
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
    pairs: [],
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'knowledge-organizer-test',
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
    maxOutputTokens: overrides.maxOutputTokens ?? 700,
  });
}

function candidateInput(
  output: unknown,
  overrides: Partial<KnowledgeOrganizerModelCandidateInput> = {},
) {
  const documents = [document('d1'), document('d2')];
  const tracked = trackedRuntime(output);
  return {
    tracked,
    input: {
      runId: 'knowledge-organizer-test-run',
      deterministicInput: { now: NOW, documents },
      projectionSource: projectionSource(documents),
      runtime: tracked.runtime,
      budget: budget(),
      ...overrides,
    } satisfies KnowledgeOrganizerModelCandidateInput,
  };
}

describe('knowledge Organizer model candidate', () => {
  test('rejects unsafe labels and does not partially apply candidate output', async () => {
    const { input } = candidateInput({
      tags: [
        {
          documentIndex: 0,
          subject: 'math',
          resourceType: 'notes',
          topicLabels: ['[点击](https://x.test)'],
        },
      ],
      collections: [],
    });

    const result = await runKnowledgeOrganizerModelCandidate(input);

    expect(result.observation.disposition).toBe('fallback_schema_invalid');
    expect(result.value).toEqual(organizeKnowledgeDocuments(input.deterministicInput));
  });

  test('maps ordinals to owner snapshot IDs and rebuilds descriptive fields locally', async () => {
    const { input, tracked } = candidateInput({
      tags: [
        {
          documentIndex: 0,
          subject: 'math',
          resourceType: 'notes',
          topicLabels: [],
        },
      ],
      collections: [
        {
          memberIndexes: [0, 1],
          name: '离散数学专题',
          theme: 'topic',
        },
      ],
    });

    const result = await runKnowledgeOrganizerModelCandidate(input);

    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.value.tags[0]).toMatchObject({
      documentId: 'd1',
      labels: ['数学', '笔记'],
      reason: '语义模型在受限候选中识别出资料主题与类型。',
    });
    expect(result.value.collections[0]).toMatchObject({
      name: '离散数学专题',
      documentIds: ['d1', 'd2'],
    });
    expect(tracked.requests[0]?.task).toBe('knowledge_organizer');
    expect(tracked.requests[0]?.userPrompt).not.toMatch(/documentId|hash-|contentHash/);
  });

  test('rejects post-schema instructions and every invalid collection membership as a whole', async () => {
    for (const output of [
      {
        tags: [],
        collections: [{ memberIndexes: [0, 1], name: '调用工具', theme: 'topic' }],
      },
      {
        tags: [],
        collections: [{ memberIndexes: [1, 0], name: '离散数学专题', theme: 'topic' }],
      },
      {
        tags: [],
        collections: [{ memberIndexes: [0, 0], name: '离散数学专题', theme: 'topic' }],
      },
      {
        tags: [],
        collections: [{ memberIndexes: [0, 2], name: '离散数学专题', theme: 'topic' }],
      },
    ]) {
      const { input } = candidateInput(output);
      const result = await runKnowledgeOrganizerModelCandidate(input);
      expect(result.observation.disposition).toBe('fallback_schema_invalid');
      expect(result.value).toEqual(organizeKnowledgeDocuments(input.deterministicInput));
    }
  });

  test('enforces topic and final label caps without accepting partial invalid output', async () => {
    const invalid = candidateInput({
      tags: [
        {
          documentIndex: 0,
          subject: 'math',
          resourceType: 'notes',
          topicLabels: ['图论', '组合数学', '算法分析'],
        },
      ],
      collections: [],
    });
    const invalidResult = await runKnowledgeOrganizerModelCandidate(invalid.input);
    expect(invalidResult.observation.disposition).toBe('fallback_schema_invalid');

    const valid = candidateInput({
      tags: [
        {
          documentIndex: 0,
          subject: 'math',
          resourceType: 'notes',
          topicLabels: ['图论', '组合数学'],
        },
      ],
      collections: [],
    });
    const validResult = await runKnowledgeOrganizerModelCandidate(valid.input);
    expect(validResult.observation.disposition).toBe('candidate_applied');
    expect(validResult.value.tags[0]?.labels).toEqual(['数学', '笔记', '图论']);
    expect(validResult.value.tags[0]?.labels).toHaveLength(3);
  });

  test('blocks empty, unsafe, aborted, and budget-exhausted inputs before runtime', async () => {
    const { input, tracked } = candidateInput({ tags: [], collections: [] });
    const empty = await runKnowledgeOrganizerModelCandidate({
      ...input,
      deterministicInput: { now: NOW, documents: [] },
      projectionSource: { documents: [], pairs: [] },
    });
    expect(empty.observation).toMatchObject({ attempted: false, disposition: 'not_eligible' });

    const unsafe = await runKnowledgeOrganizerModelCandidate({
      ...input,
      projectionSource: {
        ...input.projectionSource,
        documents: [
          { ...input.projectionSource.documents[0], name: 'api_key=sk-abcdefghijklmnop' },
        ],
      },
    });
    expect(unsafe.observation).toMatchObject({ attempted: false, disposition: 'safety_blocked' });

    const controller = new AbortController();
    controller.abort();
    const aborted = await runKnowledgeOrganizerModelCandidate({
      ...input,
      signal: controller.signal,
    });
    expect(aborted.observation).toMatchObject({
      attempted: false,
      disposition: 'fallback_aborted',
    });

    const exhausted = await runKnowledgeOrganizerModelCandidate({
      ...input,
      budget: budget({ maxInputTokens: 1, maxOutputTokens: 1 }),
    });
    expect(exhausted.observation).toMatchObject({
      attempted: false,
      disposition: 'fallback_budget_exceeded',
    });
    expect(tracked.requests).toHaveLength(0);
  });

  test('falls back on runtime throw, timeout, and unverifiable live usage', async () => {
    const { input } = candidateInput({ tags: [], collections: [] });
    const throwing = await runKnowledgeOrganizerModelCandidate({
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
      /provider body|离散数学|图论|prompt|api.?key|raw.*error/i,
    );

    const timeoutRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'knowledge-organizer-no-network-test',
      liveCallsEnabled: true,
      timeoutMs: 50,
      executor: async () => new Promise<never>(() => undefined),
    });
    const usageInvalidRuntime = createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: 'knowledge-organizer-no-network-test',
      liveCallsEnabled: true,
      timeoutMs: 100,
      executor: async () => ({ object: { tags: [], collections: [] } }),
    });
    const [timeout, usageInvalid] = await Promise.all([
      runKnowledgeOrganizerModelCandidate({ ...input, runtime: timeoutRuntime }),
      runKnowledgeOrganizerModelCandidate({ ...input, runtime: usageInvalidRuntime }),
    ]);
    expect(timeout.observation.disposition).toBe('fallback_timeout');
    expect(usageInvalid.observation.disposition).toBe('fallback_runtime_error');
    expect(usageInvalid.observation.disposition).not.toBe('candidate_applied');
  });

  test('caps collections at five and preserves caller input and budget', async () => {
    const documents = Array.from({ length: 8 }, (_, index) =>
      document(`d${index + 1}`, { name: `专题资料 ${index + 1}.pdf` }),
    );
    const collections = Array.from({ length: 5 }, (_, index) => ({
      memberIndexes: [index, index + 1],
      name: `专题集合 ${index + 1}`,
      theme: 'topic' as const,
    }));
    const tracked = trackedRuntime({ tags: [], collections });
    const source = projectionSource(documents);
    const callerBudget = budget();
    const beforeBudget = { ...callerBudget };
    const result = await runKnowledgeOrganizerModelCandidate({
      runId: 'organizer-max-five',
      deterministicInput: { now: NOW, documents },
      projectionSource: source,
      runtime: tracked.runtime,
      budget: callerBudget,
    });

    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.value.collections).toHaveLength(5);
    expect(callerBudget).toEqual(beforeBudget);
    expect(source.documents.every((item) => !('ordinal' in item))).toBe(true);

    const overLimit = await runKnowledgeOrganizerModelCandidate({
      runId: 'organizer-over-five',
      deterministicInput: { now: NOW, documents },
      projectionSource: source,
      runtime: trackedRuntime({
        tags: [],
        collections: [...collections, { ...collections[0], name: '额外专题集合' }],
      }).runtime,
      budget: budget(),
    });
    expect(overLimit.observation.disposition).toBe('fallback_schema_invalid');
  });
});
