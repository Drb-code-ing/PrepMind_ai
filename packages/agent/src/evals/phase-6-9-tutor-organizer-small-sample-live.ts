import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentTrace,
  type Phase697V7WireCapability,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY,
  calculatePhase697SmallSampleCostCny,
  type Phase697SmallSampleCaseEntry,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  type Phase697SmallSampleGuardCase,
  type Phase697SmallSampleHarness,
  type Phase697SmallSampleRuntimeResult,
} from './run-phase-6-9-tutor-organizer-small-sample.ts';
import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697V6OrganizerSource,
  runPhase697V6ZeroCallCase,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import { runTutorV6ModelCandidate } from '../model-candidates/tutor-v6-model-candidate.ts';
import { runWrongQuestionOrganizerV9ModelCandidate } from '../model-candidates/wrong-question-organizer-v9-model-candidate.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_MODEL = 'deepseek-v4-pro' as const;

const CLEAR_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});

type Agent = 'tutor' | 'wrong_question_organizer';

/**
 * First-party production composition. It has no adapter/fetch/model/URL/clock
 * injection surface. Synthetic composition belongs in test fixtures and can
 * never be returned by this function.
 */
export function createPhase697SmallSampleLiveHarness(input: {
  runId: string;
  apiKey: string;
}): Readonly<Phase697SmallSampleHarness> {
  if (!isUuid(input.runId) || !isCredential(input.apiKey)) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_LIVE_CONFIGURATION_INVALID');
  }
  const apiKey = input.apiKey;
  const runId = input.runId;
  return Object.freeze({
    mode: 'live' as const,
    executorProvenance: 'deepseek_network' as const,
    runGuard: async (entry) => runGuard(entry),
    runTutor: (entry, signal, wireCapability) =>
      runTutor(entry, signal, wireCapability, runId, apiKey),
    runOrganizer: (entry, signal, wireCapability) =>
      runOrganizer(entry, signal, wireCapability, runId, apiKey),
  });
}

function runGuard(entry: Phase697SmallSampleGuardCase) {
  const result = runPhase697V6ZeroCallCase(entry);
  return Object.freeze({
    runtimeInvocations: result.runtimeInvocations,
    zeroCallVerified: result.zeroCallVerified,
    safety: Object.freeze({
      criticalFailure: result.criticalFailure,
      permissionFailure: result.permissionFailure,
      mutationFailure: result.mutationFailure,
      broaderThanDeterministicFallback: result.broaderThanDeterministicFallback,
      lockedNameChanged: false,
      writeCommandLeaked: false,
    }),
  });
}

async function runTutor(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  wireCapability: Phase697V7WireCapability,
  runId: string,
  apiKey: string,
): Promise<Phase697SmallSampleRuntimeResult> {
  const tracked = createTrackedRuntime('tutor', apiKey, wireCapability);
  try {
    const deterministic = buildTutorStrategy({
      latestUserText: entry.input.latestUserText,
      activeStudyContext: entry.input.activeStudyContext,
    });
    const candidate = await runTutorV6ModelCandidate({
      runId: `${runId}:tutor:${entry.pairedRunIndex}`,
      finalRoute: 'tutor',
      latestUserText: entry.input.latestUserText,
      ...(entry.input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: entry.input.activeStudyContext }),
      deterministic,
      safety: {
        latestUserText: 'safe_for_model',
        ...(entry.input.activeStudyContext === undefined
          ? {}
          : { activeStudyContext: 'safe_for_model' as const }),
      },
      runtime: tracked.runtime,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor.inputTokensMax,
        maxOutputTokens: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor.outputTokensMax,
      }),
      signal,
    });
    const trace = candidateTrace(candidate.observation);
    const usage = verifiedUsage('tutor', candidate.observation.usage);
    const actualIntent =
      candidate.result.intent === 'answer_direct' ? null : candidate.result.intent;
    const strict =
      tracked.invocations() === 1 &&
      candidate.observation.attempted &&
      candidate.observation.disposition === 'candidate_applied' &&
      trace?.status === 'succeeded' &&
      trace.provider === 'deepseek' &&
      trace.model === PHASE_6_9_7_SMALL_SAMPLE_MODEL &&
      actualIntent !== null &&
      usage !== null &&
      validDuration('tutor', trace.durationMs);
    const semantic: Phase697SmallSampleRuntimeResult['semantic'] = strict
      ? {
          agent: 'tutor',
          observation: {
            caseId: entry.id,
            expectedIntent: entry.expected.intent,
            actualIntent,
            expectedDepth: entry.expected.depth,
            actualDepth: candidate.result.depth,
            expectedContextUse: entry.expected.contextUse,
            actualContextUse: candidate.result.shouldUseActiveStudyContext,
            expectedGuidingQuestion: entry.expected.guidingQuestion,
            actualGuidingQuestion: candidate.result.shouldAskGuidingQuestion,
            expectedFinalAnswer: entry.expected.finalAnswer,
            actualFinalAnswer: candidate.result.shouldGiveFinalAnswer,
            expectedAnswerStructure: [...entry.expected.answerStructure],
            actualAnswerStructure: [...candidate.result.answerStructure],
            validOutput: true,
          },
        }
      : null;
    return Object.freeze({
      disposition: strict
        ? ('succeeded' as const)
        : candidate.observation.disposition === 'fallback_aborted'
          ? ('attempted_aborted' as const)
          : ('attempted_failed' as const),
      failureCategory: strict
        ? ('none' as const)
        : classifyFailure(
            candidate.observation.disposition,
            candidate.observation.reasonCodes,
            trace,
          ),
      strictRuntimeSuccess: strict,
      durationMs: strict ? trace.durationMs : null,
      usage: strict ? usage : null,
      semantic,
      safety: CLEAR_SAFETY,
    });
  } catch {
    return runtimeFailure(signal, tracked.invocations());
  }
}

async function runOrganizer(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  wireCapability: Phase697V7WireCapability,
  runId: string,
  apiKey: string,
): Promise<Phase697SmallSampleRuntimeResult> {
  const tracked = createTrackedRuntime('wrong_question_organizer', apiKey, wireCapability);
  try {
    const source = buildPhase697V6OrganizerSource(entry);
    const candidate = await runWrongQuestionOrganizerV9ModelCandidate({
      runId: `${runId}:organizer:${entry.pairedRunIndex}`,
      shortlistSource: source,
      runtime: tracked.runtime,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens:
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer.inputTokensMax,
        maxOutputTokens:
          PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer.outputTokensMax,
      }),
      revalidateSource: () => source,
      signal,
    });
    const trace = candidateTrace(candidate.observation);
    const usage = verifiedUsage('wrong_question_organizer', candidate.observation.usage);
    const observations = buildOrganizerObservations(entry, candidate.result);
    const lockedNameChanged = detectLockedNameChange(entry, candidate.result);
    const strict =
      tracked.invocations() === 1 &&
      candidate.observation.attempted &&
      candidate.observation.disposition === 'candidate_applied' &&
      candidate.result.binding !== null &&
      observations.every((observation) => observation.validOutput) &&
      trace?.status === 'succeeded' &&
      trace.provider === 'deepseek' &&
      trace.model === PHASE_6_9_7_SMALL_SAMPLE_MODEL &&
      usage !== null &&
      validDuration('wrong_question_organizer', trace.durationMs) &&
      !lockedNameChanged;
    const safety = Object.freeze({
      ...CLEAR_SAFETY,
      criticalFailure: lockedNameChanged,
      lockedNameChanged,
    });
    return Object.freeze({
      disposition: strict
        ? ('succeeded' as const)
        : candidate.observation.disposition === 'fallback_aborted'
          ? ('attempted_aborted' as const)
          : ('attempted_failed' as const),
      failureCategory: strict
        ? ('none' as const)
        : lockedNameChanged
          ? ('dynamic_authority' as const)
          : classifyFailure(
              candidate.observation.disposition,
              candidate.observation.reasonCodes,
              trace,
            ),
      strictRuntimeSuccess: strict,
      durationMs: strict ? trace.durationMs : null,
      usage: strict ? usage : null,
      semantic: strict ? { agent: 'wrong_question_organizer' as const, observations } : null,
      safety,
    });
  } catch {
    return runtimeFailure(signal, tracked.invocations());
  }
}

function createTrackedRuntime(
  agent: Agent,
  apiKey: string,
  wireCapability: Phase697V7WireCapability,
) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey,
      baseURL: PHASE_6_9_7_SMALL_SAMPLE_DEEPSEEK_BASE_URL,
      model: PHASE_6_9_7_SMALL_SAMPLE_MODEL,
    },
    wireCapability,
  );
  if (adapter.provenance !== 'first_party_deepseek_v4_pro_direct') {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_ADAPTER_PROVENANCE_INVALID');
  }
  let invocations = 0;
  const executor: StructuredModelExecutor = async (request) => {
    invocations += 1;
    return adapter.executor(request);
  };
  const timeoutMs =
    agent === 'tutor'
      ? PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs
      : PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs;
  return Object.freeze({
    runtime: createModelAgentRuntime({
      mode: 'live',
      provider: 'deepseek',
      model: PHASE_6_9_7_SMALL_SAMPLE_MODEL,
      liveCallsEnabled: true,
      timeoutMs,
      executor,
    }),
    invocations: () => invocations,
  });
}

function buildOrganizerObservations(
  entry: Phase697V2OrganizerRuntimeCase,
  result: Awaited<ReturnType<typeof runWrongQuestionOrganizerV9ModelCandidate>>['result'],
): Extract<
  NonNullable<Phase697SmallSampleCaseEntry['semantic']>,
  { agent: 'wrong_question_organizer' }
>['observations'] {
  const suggestions = new Map(
    result.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  return entry.expected.decisions.map((expected) => {
    const question = entry.input.questions[expected.questionIndex];
    const suggestion = question ? suggestions.get(question.id) : undefined;
    const selection =
      suggestion && suggestion.selection.source === 'model_ordinal' ? suggestion.selection : null;
    const deckDecision = selection?.deckDecision;
    const actualDeckIndex =
      deckDecision?.action === 'reuse_existing'
        ? entry.input.existingDecks.findIndex((deck) => deck.id === deckDecision.deckId)
        : -1;
    return {
      decisionId: `${entry.id}:q${expected.questionIndex}`,
      expectedSubject: expected.subject,
      actualSubject: selection?.resolvedSubject ?? null,
      expectedDeckAction: expected.deckAction,
      actualDeckAction: selection?.deckDecision.action ?? null,
      expectedDeckIndex: expected.deckIndex ?? null,
      actualDeckIndex: actualDeckIndex >= 0 ? actualDeckIndex : null,
      canonicalTopicLabel: expected.canonicalTopicLabel,
      acceptedTopicLabels: [...expected.acceptedTopicLabels],
      actualTopicLabel: suggestion?.organization.deckName ?? null,
      expectedConfidence: expected.confidence,
      actualConfidence: selection?.confidence ?? null,
      requiredEvidenceCodes: [...expected.requiredEvidenceCodes],
      allowedEvidenceCodes: [...expected.allowedEvidenceCodes],
      actualEvidenceCodes:
        question && suggestion
          ? [...inferEvidenceCodes(question, suggestion.organization.signals)]
          : [],
      validOutput: result.binding !== null && selection !== null,
    };
  });
}

function detectLockedNameChange(
  entry: Phase697V2OrganizerRuntimeCase,
  result: Awaited<ReturnType<typeof runWrongQuestionOrganizerV9ModelCandidate>>['result'],
) {
  const suggestions = new Map(
    result.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  return entry.input.questions.some((question) => {
    const suggestion = suggestions.get(question.id);
    if (!suggestion || suggestion.selection.source !== 'model_ordinal') return false;
    const deckDecision = suggestion.selection.deckDecision;
    if (deckDecision.action !== 'reuse_existing') return false;
    const deck = entry.input.existingDecks.find(
      (candidate) => candidate.id === deckDecision.deckId,
    );
    return Boolean(
      deck?.nameLocked &&
      normalizeLabel(deck.name) !== normalizeLabel(suggestion.organization.deckName),
    );
  });
}

function inferEvidenceCodes(
  question: Phase697V2OrganizerRuntimeCase['input']['questions'][number],
  signals: readonly string[],
): readonly (
  | 'structured_subject'
  | 'semantic_topic'
  | 'existing_deck_overlap'
  | 'error_pattern'
  | 'insufficient_signal'
)[] {
  const evidence: (
    | 'structured_subject'
    | 'semantic_topic'
    | 'existing_deck_overlap'
    | 'error_pattern'
    | 'insufficient_signal'
  )[] = [];
  if (question.subject?.trim()) evidence.push('structured_subject');
  if (signals.includes('knowledgePoint') || signals.includes('category')) {
    evidence.push('semantic_topic');
  }
  if (signals.includes('existingDeck')) evidence.push('existing_deck_overlap');
  if (signals.includes('errorType')) evidence.push('error_pattern');
  if (signals.includes('fallback')) evidence.push('insufficient_signal');
  return Object.freeze([...new Set(evidence)]);
}

function verifiedUsage(agent: Agent, usage: { inputTokens: number; outputTokens: number }) {
  const lane =
    agent === 'tutor'
      ? PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.tutor
      : PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget.wrongQuestionOrganizer;
  if (
    !Number.isSafeInteger(usage.inputTokens) ||
    usage.inputTokens <= 0 ||
    usage.inputTokens > lane.inputTokensMax ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.outputTokens <= 0 ||
    usage.outputTokens > lane.outputTokensMax
  ) {
    return null;
  }
  const estimatedCostCny = calculatePhase697SmallSampleCostCny(
    usage.inputTokens,
    usage.outputTokens,
  );
  if (estimatedCostCny > lane.cnyMax) return null;
  return Object.freeze({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostCny,
    pricingProfile: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.pricing.profile,
  });
}

function candidateTrace(observation: { attempted: boolean } & Record<string, unknown>) {
  if (!observation.attempted || !('trace' in observation)) return null;
  const trace = observation.trace;
  return isModelAgentTrace(trace) ? trace : null;
}

function classifyFailure(
  disposition: string,
  reasonCodes: readonly string[],
  trace: ModelAgentTrace | null,
): Phase697SmallSampleCaseEntry['failureCategory'] {
  if (disposition === 'fallback_aborted') return 'abort';
  if (trace?.errorCode === 'TIMEOUT') return 'timeout';
  const provider = trace?.providerFailureCategory ?? null;
  if (provider === 'transport') return 'transport';
  if (
    provider === 'http_auth' ||
    provider === 'http_client' ||
    provider === 'http_server' ||
    provider === 'http_rate_limit'
  ) {
    return 'http';
  }
  if (provider === 'structured_output' || trace?.errorCode === 'SCHEMA_INVALID') return 'schema';
  if (reasonCodes.includes('stale_shortlist') || reasonCodes.includes('authority_merge_invalid')) {
    return 'dynamic_authority';
  }
  if (reasonCodes.some((code) => code.includes('BUDGET'))) return 'budget';
  if (trace?.errorCode === 'PROVIDER_ERROR') return 'transport';
  return 'internal';
}

function runtimeFailure(
  signal: AbortSignal,
  invocations: number,
): Phase697SmallSampleRuntimeResult {
  const aborted = isAborted(signal);
  return Object.freeze({
    disposition: aborted ? 'attempted_aborted' : 'attempted_failed',
    failureCategory: aborted ? 'abort' : invocations === 0 ? 'internal' : 'transport',
    strictRuntimeSuccess: false,
    durationMs: null,
    usage: null,
    semantic: null,
    safety: CLEAR_SAFETY,
  });
}

function validDuration(agent: Agent, durationMs: number) {
  const limit =
    agent === 'tutor'
      ? PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs
      : PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs;
  return Number.isFinite(durationMs) && durationMs >= 0 && durationMs <= limit;
}

function isModelAgentTrace(value: unknown): value is ModelAgentTrace {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof (value as { durationMs?: unknown }).durationMs === 'number' &&
      typeof (value as { status?: unknown }).status === 'string'
    );
  } catch {
    return false;
  }
}

function isCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}
