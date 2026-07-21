import type { ModelCandidateObservation } from '@repo/agent/model-candidates';

import {
  buildKnowledgeSuggestionTrace,
  toKnowledgeRuntimeMetadata,
} from './knowledge-agent-trace';

describe('knowledge agent trace', () => {
  const startedAt = new Date('2026-07-21T08:00:00.000Z');
  const finishedAt = new Date('2026-07-21T08:00:01.200Z');

  it('creates one parent and two candidate steps without sensitive snapshot material', () => {
    const dedup = succeededObservation('knowledge_dedup', 120, 30, 410);
    const organizer = succeededObservation('knowledge_organizer', 180, 40, 520);
    const trace = buildKnowledgeSuggestionTrace({
      runId: 'run_1',
      startedAt,
      finishedAt,
      dedup: {
        runtime: toKnowledgeRuntimeMetadata({
          observation: dedup,
          traceId: 'run_1',
        }),
        observation: dedup,
        usageRef: 'usage_dedup',
      },
      organizer: {
        runtime: toKnowledgeRuntimeMetadata({
          observation: organizer,
          traceId: 'run_1',
        }),
        observation: organizer,
        usageRef: 'usage_organizer',
      },
    });

    expect(trace.steps.map((step) => step.node)).toEqual([
      'knowledge_suggestion_parent',
      'knowledge_dedup_candidate',
      'knowledge_organizer_candidate',
    ]);
    expect(trace.inputTokenEstimate).toBe(300);
    expect(trace.outputTokenEstimate).toBe(70);
    expect(trace.pricingKnown).toBe(false);
    expect(trace.costEstimate).toBe(0);
    expect(trace.degraded).toBe(false);
    const persistedText = trace.steps
      .flatMap((step) => [
        step.inputSummary,
        step.outputSummary,
        step.errorMessage,
      ])
      .join(' ');
    expect(persistedText).not.toMatch(
      /owner[_-]?(id|hash)|fingerprint|ordinal|prompt|filename|summaryText|chunk|embedding|vector|providerOutput|rawError|apiKey|secret/i,
    );
  });

  it('deduplicates one provider call by usageRef and never invents USD pricing', () => {
    const shared = succeededObservation('knowledge_dedup', 100, 25, 300);
    const trace = buildKnowledgeSuggestionTrace({
      runId: 'run_shared',
      startedAt,
      finishedAt,
      dedup: {
        runtime: toKnowledgeRuntimeMetadata({
          observation: shared,
          traceId: 'run_shared',
        }),
        observation: shared,
        usageRef: 'shared_call',
      },
      organizer: {
        runtime: toKnowledgeRuntimeMetadata({
          observation: shared,
          traceId: 'run_shared',
        }),
        observation: shared,
        usageRef: 'shared_call',
      },
    });

    expect(trace.inputTokenEstimate).toBe(100);
    expect(trace.outputTokenEstimate).toBe(25);
    expect(trace.pricingKnown).toBe(false);
    expect(trace.costEstimate).toBe(0);
  });

  it('maps unavailable trace evidence to a local degraded result', () => {
    const metadata = toKnowledgeRuntimeMetadata({
      observation: {
        attempted: true,
        traceUnavailable: true,
        usageUnavailable: true,
        disposition: 'fallback_runtime_error',
        budget: budget(),
        usage: { inputTokens: 0, outputTokens: 0 },
        reasonCodes: ['fallback_runtime_error'],
      },
      traceId: null,
    });

    expect(metadata).toEqual({
      source: 'local_deterministic',
      disposition: 'fallback_runtime_error',
      reasonCode: 'fallback_runtime_error',
      attempted: true,
      degraded: true,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        pricingKnown: false,
        estimatedCostCny: null,
      },
      traceId: null,
    });
  });
});

function succeededObservation(
  task: 'knowledge_dedup' | 'knowledge_organizer',
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): ModelCandidateObservation<string> {
  return {
    attempted: true,
    disposition: 'candidate_applied',
    budget: budget(),
    usage: { inputTokens, outputTokens },
    reasonCodes: ['candidate_applied', 'semantic_match'],
    trace: {
      runIdHash: `sha256:${'a'.repeat(64)}`,
      task,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      status: 'succeeded',
      inputTokens,
      outputTokens,
      maxOutputTokens: task === 'knowledge_dedup' ? 500 : 700,
      durationMs,
      degraded: false,
    },
  };
}

function budget() {
  return {
    maxCalls: 1,
    usedCalls: 1,
    maxInputTokens: 3000,
    usedInputTokens: 3000,
    maxOutputTokens: 700,
    usedOutputTokens: 700,
  };
}
