import {
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  PHASE_695_REPORT_SCHEMA_VERSION,
  PHASE_695_SHARED_BUDGET,
  phase695ReportSchema,
  phase695ReviewPlannerCases,
  ReviewPlannerDiagnosticCode,
  type Phase695Report,
} from '@repo/agent';

import {
  executeReviewPlannerControlledLiveV4Cli,
  serializeReviewPlannerControlledLiveV4Summary,
} from './review-planner-controlled-live-eval-v4-cli';
import { createReviewPlannerControlledLiveV4Evaluator } from './review-planner-controlled-live-eval-v4.factory';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'v4-cli-private-key',
});

describe('review planner controlled Live v4 CLI', () => {
  it.each([
    { argv: [] },
    { argv: ['--confirm-controlled-live-v3'] },
    { argv: ['--confirm-controlled-live-v4', '--extra'] },
  ])(
    'rejects confirmation grammar %o before reservation or executor creation',
    async ({ argv }) => {
      const reserveEvidence = jest.fn();
      const createEvaluator = jest.fn();

      await expect(
        executeReviewPlannerControlledLiveV4Cli({
          argv,
          env,
          root: 'v4-invalid-confirmation-root',
          reserveEvidence,
          createEvaluator,
        }),
      ).resolves.toEqual({
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      });
      expect(reserveEvidence).not.toHaveBeenCalled();
      expect(createEvaluator).not.toHaveBeenCalled();
    },
  );

  it('reserves before the private evaluator, finalizes a safe staged closure, and never starts paired evaluation', async () => {
    const events: string[] = [];
    const runPairedEvaluation = jest.fn();
    const reservation = fixtureReservation(events);
    const createEvaluator = jest.fn(() => {
      events.push('evaluator');
      return {
        ok: true,
        value: {
          runDiagnostic: jest.fn().mockResolvedValue({
            status: 'invalid_attempted',
            canContinue: false,
            providerAttemptCount: 1,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
            structuredOutputStage: 'provider_json_parse',
          }),
          runPairedEvaluation,
          providerAttemptCount: () => 1,
        },
      };
    });

    const result = await executeReviewPlannerControlledLiveV4Cli({
      argv: ['--confirm-controlled-live-v4'],
      env,
      root: 'v4-injected-safe-root',
      reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
      createEvaluator: createEvaluator as never,
    });

    expect(result).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_json_parse',
    });
    expect(events.slice(0, 2)).toEqual(['mark_attempted', 'evaluator']);
    expect(runPairedEvaluation).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('v4-cli-private-key');
  });

  it('opens only when the canary plus a canonical 22-runtime case report total exactly 23 attempts', async () => {
    const reservation = fixtureReservation([]);
    let attempts = 1;
    const createEvaluator = jest.fn(() => ({
      ok: true,
      value: {
        runDiagnostic: jest.fn().mockResolvedValue({
          status: 'complete',
          canContinue: true,
          providerAttemptCount: 1,
          usageKnown: true,
        }),
        runPairedEvaluation: jest.fn().mockImplementation(() => {
          attempts = 23;
          return Promise.resolve({ kind: 'report', report: qualityReport() });
        }),
        providerAttemptCount: () => attempts,
      },
    }));

    const result = await executeReviewPlannerControlledLiveV4Cli({
      argv: ['--confirm-controlled-live-v4'],
      env,
      root: 'v4-injected-safe-root',
      reserveEvidence: jest.fn().mockResolvedValue(reservation) as never,
      createEvaluator: createEvaluator as never,
    });

    expect(result).toEqual({
      status: 'complete',
      gate: 'open',
      providerAttemptCount: 23,
      usageKnown: true,
    });
    expect(
      JSON.parse(serializeReviewPlannerControlledLiveV4Summary(result)),
    ).toEqual(result);
  });

  it.each([
    {
      label: 'malformed JSON',
      content: '{"focusIndexes":[0],"diagnosis": RAW_V4_CLI_JSON_CANARY',
      structuredOutputStage: 'provider_json_parse' as const,
    },
    {
      label: 'an invalid JSON fence',
      content:
        '```JSON\n{"focusIndexes":[0],"diagnosis":"review_pressure","raw":"RAW_V4_CLI_FENCE_CANARY"}\n```',
      structuredOutputStage: 'provider_json_parse' as const,
    },
    {
      label: 'a strict schema mismatch',
      content: JSON.stringify({
        focusIndexes: [0],
        diagnosis: 'review_pressure',
        raw: 'RAW_V4_CLI_SCHEMA_CANARY',
      }),
      structuredOutputStage: 'provider_type_validation' as const,
    },
  ])(
    'records the trusted direct JSON %s stage in v4 evidence without raw provider content',
    async ({ content, structuredOutputStage }) => {
      const finalize = jest.fn(() => Promise.resolve(true));
      await withFakeJsonFetch(
        {
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        },
        async (fetch) => {
          const createEvaluator = (candidateEnv: Record<string, unknown>) =>
            createReviewPlannerControlledLiveV4Evaluator(candidateEnv, {
              isPricingKnown: () => true,
            });
          const result = await executeReviewPlannerControlledLiveV4Cli({
            argv: ['--confirm-controlled-live-v4'],
            env,
            root: 'v4-evidence-stage-root',
            reserveEvidence: jest.fn().mockResolvedValue({
              relativePath:
                'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4/test.json',
              markAttempted: jest.fn(() => Promise.resolve(true)),
              finalize,
            }) as never,
            createEvaluator,
          });

          expect(result).toEqual({
            status: 'invalid_attempted',
            gate: 'closed',
            providerAttemptCount: 1,
            usageKnown: false,
            diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
            structuredOutputStage,
          });
          expect(finalize).toHaveBeenLastCalledWith(result);
          expect(fetch).toHaveBeenCalledTimes(1);
          expect(
            JSON.stringify({ result, calls: finalize.mock.calls }),
          ).not.toContain('RAW_V4_CLI_');
        },
      );
    },
  );
});

async function withFakeJsonFetch<T>(
  payload: unknown,
  run: (fetch: jest.MockedFunction<typeof globalThis.fetch>) => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    } as Response),
  );
  globalThis.fetch = fetch;
  try {
    return await run(fetch);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function fixtureReservation(events: string[]) {
  return {
    relativePath:
      'docs/acceptance/evidence/phase-6-9-5-controlled-live-v4/test.json',
    markAttempted: jest.fn(() => {
      events.push('mark_attempted');
      return Promise.resolve(true);
    }),
    finalize: jest.fn(() => Promise.resolve(true)),
  };
}

function qualityReport(): Phase695Report {
  const caseEntries = phase695ReviewPlannerCases.map((testCase) =>
    testCase.executionKind === 'zero_call'
      ? {
          caseId: testCase.id,
          lane: testCase.lane,
          executionKind: 'zero_call' as const,
          zeroCallVerified: true,
          runtimeInvocations: 0 as const,
          strictSuccess: true,
          qualityPass: true,
          criticalFailure: false,
          durationMs: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
          budget: { ...PHASE_695_SHARED_BUDGET },
          gate: 'zero_call' as const,
        }
      : {
          caseId: testCase.id,
          lane: testCase.lane,
          executionKind: 'runtime' as const,
          zeroCallVerified: false,
          runtimeInvocations: 1 as const,
          strictSuccess: true,
          qualityPass: true,
          criticalFailure: false,
          durationMs: 1,
          usage: { inputTokens: 1, outputTokens: 1 },
          budget: { ...PHASE_695_SHARED_BUDGET },
          gate: 'candidate_evaluated' as const,
        },
  );
  return phase695ReportSchema.parse({
    schemaVersion: PHASE_695_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
    mode: 'live',
    caseEntries,
    counters: {
      caseEntries: 48,
      zeroCallCases: 26,
      runtimeInvocations: 22,
      strictSuccesses: 48,
      qualityPasses: 48,
      criticalFailures: 0,
      inputTokens: 22,
      outputTokens: 22,
    },
    metrics: {
      strictSchemaSuccessRate: 1,
      semanticQualityRate: 1,
      criticalFailures: 0,
      p95DurationMs: 1,
    },
    productionDecision: 'quality_gate_passed',
  });
}
