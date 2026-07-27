import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from '../../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697V6Harness,
  Phase697V6RuntimeResult,
  Phase697V6ZeroCallResult,
} from '../../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';

const SAFE = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export type Phase697V6SyntheticHooks = Readonly<{
  zeroCall?(entryId: string): Phase697V6ZeroCallResult | null;
  tutor?(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V6RuntimeResult> | null;
  organizer?(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V6RuntimeResult> | null;
}>;

export function createPhase697V6SyntheticHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  hooks?: Phase697V6SyntheticHooks;
}): Phase697V6Harness {
  const mode = input?.mode ?? 'mock';
  return Object.freeze({
    runId: input?.runId ?? '00000000-0000-4000-8000-000000000501',
    runScope: input?.runScope ?? 'branch',
    mode,
    provider: mode === 'mock' ? 'mock' : 'deepseek',
    model: mode === 'mock' ? 'mock' : 'deepseek-v4-pro',
    structuredOutputMode: mode === 'mock' ? 'mock_json_v6' : 'deepseek_v4_pro_nonthinking_json',
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
      return overridden ?? successfulTutorResult(entry);
    },
    async runOrganizer(entry, signal) {
      const overridden = input?.hooks?.organizer?.(entry, signal);
      return overridden ?? successfulOrganizerResult(entry);
    },
  });
}

export function successfulTutorResult(entry: Phase697V2TutorRuntimeCase): Phase697V6RuntimeResult {
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
    modelOwnedDecision: { agent: 'tutor', intent: entry.expected.intent },
    durationEvidence: {
      executor: duration('executor', 8, 3_500),
      runtimeTrace: duration('runtime_trace', 10, 3_500),
      candidateOrchestration: duration('candidate_orchestration', 12, 6_500),
    },
    usage: { inputTokens: 120, outputTokens: 30, estimatedCostCny: 0.001 },
    usageDisposition: 'verified',
  });
}

export function successfulOrganizerResult(
  entry: Phase697V2OrganizerRuntimeCase,
): Phase697V6RuntimeResult {
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
      decisionUnits: entry.expected.decisions.length,
      subject: true,
      deck: true,
      topic: true,
      confidence: true,
    },
    modelOwnedDecision: {
      agent: 'wrong_question_organizer',
      decisions: entry.expected.decisions.map((expected) => {
        const authority = entry.authority.decisions.find(
          (decision) => decision.questionIndex === expected.questionIndex,
        );
        const question = entry.input.questions[expected.questionIndex];
        if (!authority || !question) throw new Error('V6 synthetic organizer authority missing');
        const subjectDecision =
          question.structuredSubjectAuthority !== null
            ? ({ action: 'keep_local' } as const)
            : ({
                action: 'select_subject' as const,
                subjectIndex: authority.subjectCandidates.indexOf(expected.subject),
              } as const);
        const targetOrdinal =
          expected.deckAction === 'reuse_existing'
            ? expected.deckIndex
            : expected.topicCandidateIndex;
        if (targetOrdinal === undefined || targetOrdinal < 0) {
          throw new Error('V6 synthetic organizer target missing');
        }
        return {
          decisionId: `${entry.id}:q${expected.questionIndex}`,
          subjectDecision,
          deckAction: expected.deckAction,
          targetOrdinal,
        };
      }),
    },
    durationEvidence: {
      executor: duration('executor', 12, 5_000),
      runtimeTrace: duration('runtime_trace', 15, 5_000),
      candidateOrchestration: duration('candidate_orchestration', 18, 4_500),
    },
    usage: { inputTokens: 240, outputTokens: 60, estimatedCostCny: 0.002 },
    usageDisposition: 'verified',
  });
}

export function failedRuntimeResult(
  failureCategory: Phase697V6RuntimeResult['failureCategory'] = 'dynamic_contract',
): Phase697V6RuntimeResult {
  return Object.freeze({
    ...SAFE,
    runtimeInvocations: 1,
    candidateDisposition: 'fallback_schema_invalid',
    failureCategory,
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    semanticAxes: null,
    modelOwnedDecision: null,
    durationEvidence: {
      executor: duration('executor', 18, 5_000),
      runtimeTrace: duration('runtime_trace', 20, 5_000),
      candidateOrchestration: duration('candidate_orchestration', 22, 4_500),
    },
    usage: { inputTokens: 100, outputTokens: 10, estimatedCostCny: 0.001 },
    usageDisposition: 'verified',
  });
}

function duration(
  stage: 'executor' | 'runtime_trace' | 'candidate_orchestration',
  durationMs: number,
  deadlineMs: number,
) {
  return Object.freeze({
    stage,
    durationMs,
    deadlineMs,
    deadlineExceeded: durationMs > deadlineMs,
    deadlineOvershootMs: Math.max(0, durationMs - deadlineMs),
  });
}

export function unknownUsageRuntimeResult(): Phase697V6RuntimeResult {
  return Object.freeze({
    ...failedRuntimeResult('usage_unknown'),
    candidateDisposition: 'fallback_runtime_error',
    usage: null,
    usageDisposition: 'unknown_after_attempt',
  });
}
