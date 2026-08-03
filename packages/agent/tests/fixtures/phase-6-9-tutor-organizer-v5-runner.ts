import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from '../../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697V5Harness,
  Phase697V5RuntimeResult,
  Phase697V5ZeroCallResult,
} from '../../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';

const SAFE = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export type Phase697V5SyntheticHooks = Readonly<{
  zeroCall?(entryId: string): Phase697V5ZeroCallResult | null;
  tutor?(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V5RuntimeResult> | null;
  organizer?(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V5RuntimeResult> | null;
}>;

export function createPhase697V5SyntheticHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  hooks?: Phase697V5SyntheticHooks;
}): Phase697V5Harness {
  const mode = input?.mode ?? 'mock';
  return Object.freeze({
    runId: input?.runId ?? '00000000-0000-4000-8000-000000000501',
    runScope: input?.runScope ?? 'branch',
    mode,
    provider: mode === 'mock' ? 'mock' : 'deepseek',
    model: mode === 'mock' ? 'mock' : 'deepseek-v4-pro',
    structuredOutputMode: mode === 'mock' ? 'mock_json_v5' : 'deepseek_v4_pro_nonthinking_json',
    executorProvenance: mode === 'mock' ? 'mock_synthetic' : 'synthetic_test',
    async runZeroCall(entry) {
      return (
        input?.hooks?.zeroCall?.(entry.id) ?? {
          ...SAFE,
          runtimeInvocations: 0,
          candidateDisposition:
            entry.input.requestAborted === true ? 'fallback_aborted' : 'not_eligible',
          zeroCallVerified: true,
          failureCategory:
            entry.input.requestAborted === true ? 'pre_dispatch_abort' : 'local_guard',
        }
      );
    },
    async runTutor(entry, signal) {
      const overridden = input?.hooks?.tutor?.(entry, signal);
      return overridden ?? successfulTutorResult();
    },
    async runOrganizer(entry, signal) {
      const overridden = input?.hooks?.organizer?.(entry, signal);
      return overridden ?? successfulOrganizerResult(entry.expected.decisions.length);
    },
  });
}

export function successfulTutorResult(): Phase697V5RuntimeResult {
  return Object.freeze({
    ...SAFE,
    runtimeInvocations: 1,
    candidateDisposition: 'candidate_applied',
    failureCategory: 'none',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: true,
    semanticAxes: {
      agent: 'tutor',
      intent: true,
      depth: true,
      contextUse: true,
      guidingPolicy: true,
      finalAnswerBoundary: true,
      answerStructure: true,
    },
    latencyMs: 10,
    orchestrationLatencyMs: 12,
    usage: { inputTokens: 120, outputTokens: 30, estimatedCostCny: 0.001 },
    usageDisposition: 'verified',
  });
}

export function successfulOrganizerResult(decisionUnits = 1): Phase697V5RuntimeResult {
  return Object.freeze({
    ...SAFE,
    runtimeInvocations: 1,
    candidateDisposition: 'candidate_applied',
    failureCategory: 'none',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: true,
    semanticAxes: {
      agent: 'wrong_question_organizer',
      decisionUnits,
      subject: true,
      deck: true,
      topic: true,
      confidence: true,
    },
    latencyMs: 15,
    orchestrationLatencyMs: null,
    usage: { inputTokens: 240, outputTokens: 60, estimatedCostCny: 0.002 },
    usageDisposition: 'verified',
  });
}

export function failedRuntimeResult(
  failureCategory: Phase697V5RuntimeResult['failureCategory'] = 'dynamic_contract',
): Phase697V5RuntimeResult {
  return Object.freeze({
    ...SAFE,
    runtimeInvocations: 1,
    candidateDisposition: 'fallback_schema_invalid',
    failureCategory,
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    semanticAxes: null,
    latencyMs: 20,
    orchestrationLatencyMs: null,
    usage: { inputTokens: 100, outputTokens: 10, estimatedCostCny: 0.001 },
    usageDisposition: 'verified',
  });
}

export function unknownUsageRuntimeResult(): Phase697V5RuntimeResult {
  return Object.freeze({
    ...failedRuntimeResult('usage_unknown'),
    candidateDisposition: 'fallback_runtime_error',
    usage: null,
    usageDisposition: 'unknown_after_attempt',
  });
}
