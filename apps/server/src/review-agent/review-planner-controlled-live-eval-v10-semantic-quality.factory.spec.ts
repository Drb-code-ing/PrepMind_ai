import type {
  OpenAICompatibleExecutorConfig,
  StructuredModelExecutor,
} from '@repo/ai';
import { REVIEW_MODEL_CANDIDATE_SCHEMA } from '@repo/agent';

import {
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED,
  createReviewPlannerControlledLiveV10SemanticQualityEvaluator,
  validateReviewPlannerControlledLiveV10SemanticQualityPreflight,
} from './review-planner-controlled-live-eval-v10-semantic-quality.factory';

const readyEnv = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED: 'false',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED: 'false',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-pro',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v10-private-test-key',
  REVIEW_AGENT_MODEL_TIMEOUT_MS: '4500',
  PLANNER_AGENT_MODEL_TIMEOUT_MS: '4500',
});

describe('Review Planner controlled Live V10 semantic quality factory', () => {
  it('requires its own gate while predecessor and product gates remain closed', () => {
    expect(
      REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED,
    ).toBe('REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED');
    expect(
      validateReviewPlannerControlledLiveV10SemanticQualityPreflight(readyEnv),
    ).toEqual({ ok: true });
    expect(
      validateReviewPlannerControlledLiveV10SemanticQualityPreflight({
        ...readyEnv,
        REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED: 'true',
      }),
    ).toEqual({ ok: false, diagnosticCode: 'preflight_invalid' });
  });

  it('captures a strict V10 aggregate after exactly one canary and 22 paired admissions', async () => {
    const harness = createHarness();
    const diagnostics: unknown[] = [];
    const evaluator =
      createReviewPlannerControlledLiveV10SemanticQualityEvaluator(readyEnv, {
        createExecutor: harness.createExecutor,
        runPairedEvaluation: async ({ live }) => {
          for (let index = 0; index < 22; index += 1) {
            await live.runtime.invokeStructured({
              runId: `v10-${index}`,
              task: 'review_suggestion',
              schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
              systemPrompt: 'safe',
              userPrompt: 'safe',
              estimatedInputTokens: 12,
              maxOutputTokens: 4,
              budget: {
                maxCalls: 1,
                usedCalls: 0,
                maxInputTokens: 12,
                usedInputTokens: 0,
                maxOutputTokens: 4,
                usedOutputTokens: 0,
              },
            });
          }
          return successfulReport();
        },
        onDiagnostic: (value) => diagnostics.push(value),
      });

    if (evaluator.state !== 'ready')
      throw new Error('expected ready evaluator');
    await expect(evaluator.runCanary()).resolves.toMatchObject({
      kind: 'complete',
      providerAttemptCount: 1,
      usageKnown: true,
    });
    const paired = await evaluator.runPaired();

    expect(paired.diagnostic.attempts).toEqual({
      providerCount: 23,
      expectedProviderCount: 23,
      pairedAdmissionCount: 22,
      expectedPairedAdmissionCount: 22,
      overflow: false,
      auditRecordCount: 23,
    });
    expect(paired.diagnostic.terminalReason).toBe('passed');
    expect(paired.result).toMatchObject({ kind: 'report' });
    expect(paired.diagnostic.report.lanes).toEqual({
      review: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
      planner: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
    });
    expect(diagnostics).toHaveLength(1);
    expect(harness.executor).toHaveBeenCalledTimes(23);
    expect(evaluator.providerAttemptCount()).toBe(23);
  });
});

function createHarness() {
  let onAudit: ((value: unknown) => void) | undefined;
  const executor = jest.fn(() => {
    onAudit?.({
      reasoning: 'reported_zero',
      reasoningContentPresent: false,
      reportedReasoningTokens: 0,
      usageState: 'positive',
    });
    return Promise.resolve({
      object: { focusIndexes: [0] },
      usage: { inputTokens: 12, outputTokens: 4 },
    });
  }) as jest.MockedFunction<StructuredModelExecutor>;
  return {
    executor,
    createExecutor: jest.fn((config: OpenAICompatibleExecutorConfig) => {
      onAudit = config.onNonThinkingAudit;
      return executor;
    }),
  };
}

function successfulReport() {
  const entries = Array.from({ length: 48 }, (_, index) => {
    const runtime = index >= 26;
    return {
      executionKind: runtime ? 'runtime' : 'zero_call',
      zeroCallVerified: !runtime,
      runtimeInvocations: runtime ? 1 : 0,
      strictSuccess: true,
      qualityPass: true,
      criticalFailure: false,
      usage: runtime
        ? { inputTokens: 12, outputTokens: 4 }
        : { inputTokens: 0, outputTokens: 0 },
      budget: { maxCalls: 2, maxInputTokens: 1950, maxOutputTokens: 440 },
    };
  });
  return {
    schemaVersion: 'phase-6.9-review-planner-v10-report-v1',
    datasetVersion: 'phase-6.9-review-planner-v3',
    mode: 'live',
    caseEntries: entries,
    aggregate: {
      review: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
      planner: {
        caseEntries: 24,
        runtimeCases: 11,
        zeroCallCases: 13,
        strictSuccesses: 24,
        qualityPasses: 24,
        criticalFailures: 0,
      },
    },
    counters: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      inputTokens: 264,
      outputTokens: 88,
    },
    metrics: {
      strictSchemaSuccessRate: 1,
      semanticQualityRate: 1,
      criticalFailures: 0,
      p95DurationMs: 1,
    },
    productionDecision: 'quality_gate_passed',
  };
}
