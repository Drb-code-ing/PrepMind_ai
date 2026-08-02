import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  type Phase697V7WireCapability,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
  calculatePhase697FullGateCostCny,
  type Phase697FullGateCaseEntry,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_FULL_GATE_MODEL,
  createPhase697FullGateLiveHarness,
} from './phase-6-9-tutor-organizer-full-gate-live.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
  PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION,
  type Phase697SchemaRecoverySchemaObservation,
} from './phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import type {
  Phase697SchemaRecoveryHarness,
  Phase697SchemaRecoveryRuntimeResult,
} from './run-phase-6-9-tutor-organizer-schema-recovery.ts';
import type { Phase697V2TutorRuntimeCase } from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  runTutorSchemaRecoveryModelCandidate,
  type TutorSchemaRecoveryModelCandidateEnvelope,
} from '../model-candidates/tutor-schema-recovery-model-candidate.ts';
import {
  createTutorSchemaRecoveryDiagnosticCollector,
  type TutorSchemaRecoveryBoundedDiagnostic,
} from '../model-candidates/tutor-schema-recovery-contract.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_SR5_LIVE_HARNESS_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-live-harness-v1' as const;

const CLEAR_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});

/**
 * Fixed first-party SR5 composition. Tutor uses the recovery envelope and local
 * authority/merger; Organizer reuses the already reviewed production V9 path.
 * No model, URL, fetch, adapter, clock, retry, or executor can be injected.
 */
export function createPhase697SchemaRecoverySr5LiveHarness(input: {
  runId: string;
  apiKey: string;
}): Readonly<Phase697SchemaRecoveryHarness> {
  if (!isUuid(input.runId) || !isCredential(input.apiKey)) {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_SR5_LIVE_CONFIGURATION_INVALID');
  }
  const upstream = createPhase697FullGateLiveHarness(input);
  const runId = input.runId;
  const apiKey = input.apiKey;
  return Object.freeze({
    mode: 'live' as const,
    executorProvenance: 'deepseek_network' as const,
    runGuard: upstream.runGuard,
    runTutor: (entry, signal, wireCapability) =>
      runTutor(entry, signal, wireCapability, runId, apiKey),
    async runOrganizer(entry, signal, wireCapability) {
      const result = await upstream.runOrganizer(entry, signal, wireCapability);
      return Object.freeze({ ...result, schema: schemaForRuntimeResult(result) });
    },
  });
}

async function runTutor(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  wireCapability: Phase697V7WireCapability,
  runId: string,
  apiKey: string,
): Promise<Phase697SchemaRecoveryRuntimeResult> {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey,
      baseURL: PHASE_6_9_7_FULL_GATE_DEEPSEEK_BASE_URL,
      model: PHASE_6_9_7_FULL_GATE_MODEL,
    },
    wireCapability,
  );
  if (adapter.provenance !== 'first_party_deepseek_v4_pro_direct') {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_SR5_ADAPTER_PROVENANCE_INVALID');
  }
  let runtimeInvocations = 0;
  const executor: StructuredModelExecutor = async (request) => {
    runtimeInvocations += 1;
    return adapter.executor(request);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: PHASE_6_9_7_FULL_GATE_MODEL,
    liveCallsEnabled: true,
    timeoutMs: PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorHardTimeoutMs,
    executor,
  });
  const startedAt = performance.now();
  try {
    const candidate = await runTutorSchemaRecoveryModelCandidate({
      runId: `${runId}:schema-recovery:tutor:${entry.pairedRunIndex}`,
      finalRoute: 'tutor',
      latestUserText: entry.input.latestUserText,
      ...(entry.input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: entry.input.activeStudyContext }),
      deterministic: buildTutorStrategy({
        latestUserText: entry.input.latestUserText,
        activeStudyContext: entry.input.activeStudyContext,
      }),
      safety: {
        latestUserText: 'safe_for_model',
        ...(entry.input.activeStudyContext === undefined
          ? {}
          : { activeStudyContext: 'safe_for_model' as const }),
      },
      runtime,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.tutorPerLane.inputTokensMax,
        maxOutputTokens: PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.tutorPerLane.outputTokensMax,
      }),
      signal,
    });
    return mapTutorCandidate({
      entry,
      candidate,
      runtimeInvocations,
      orchestrationDurationMs: performance.now() - startedAt,
      signal,
    });
  } catch {
    return failedResult(
      isAborted(signal) ? 'attempted_aborted' : 'attempted_failed',
      isAborted(signal) ? 'external_abort' : runtimeInvocations === 0 ? 'internal' : 'transport',
      PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
      runtimeInvocations === 0,
    );
  }
}

function mapTutorCandidate(input: {
  entry: Phase697V2TutorRuntimeCase;
  candidate: TutorSchemaRecoveryModelCandidateEnvelope;
  runtimeInvocations: number;
  orchestrationDurationMs: number;
  signal: AbortSignal;
}): Phase697SchemaRecoveryRuntimeResult {
  const trace =
    input.candidate.observation.attempted && 'trace' in input.candidate.observation
      ? input.candidate.observation.trace
      : undefined;
  const durationMs = readNonNegativeFinite(trace?.durationMs);
  const usage = readVerifiedUsage(input.candidate);
  const schemaSuccess =
    input.candidate.schemaDiagnostic === null ||
    input.candidate.schemaDiagnostic.reasonCode === 'extension_fields_discarded';
  const success =
    input.runtimeInvocations === 1 &&
    !isAborted(input.signal) &&
    input.candidate.observation.disposition === 'candidate_applied' &&
    input.candidate.observation.attempted &&
    trace !== undefined &&
    trace.mode === 'live' &&
    trace.provider === 'deepseek' &&
    trace.model === PHASE_6_9_7_FULL_GATE_MODEL &&
    trace.status === 'succeeded' &&
    durationMs !== null &&
    durationMs <= PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorHardTimeoutMs &&
    usage !== null &&
    schemaSuccess;

  if (success) {
    const expected = input.entry.expected;
    const actual = input.candidate.result;
    return Object.freeze({
      disposition: 'succeeded' as const,
      failureCategory: 'none' as const,
      strictRuntimeSuccess: true,
      durationMs,
      orchestrationDurationMs: Math.max(
        durationMs,
        readNonNegativeFinite(input.orchestrationDurationMs) ?? durationMs,
      ),
      usage,
      semantic: Object.freeze({
        agent: 'tutor' as const,
        observation: Object.freeze({
          caseId: input.entry.id,
          expectedIntent: expected.intent,
          actualIntent: actual.intent === 'answer_direct' ? null : actual.intent,
          expectedDepth: expected.depth,
          actualDepth: actual.depth,
          expectedContextUse: expected.contextUse,
          actualContextUse: actual.shouldUseActiveStudyContext,
          expectedGuidingQuestion: expected.guidingQuestion,
          actualGuidingQuestion: actual.shouldAskGuidingQuestion,
          expectedFinalAnswer: expected.finalAnswer,
          actualFinalAnswer: actual.shouldGiveFinalAnswer,
          expectedAnswerStructure: [...expected.answerStructure],
          actualAnswerStructure: [...actual.answerStructure],
          validOutput: true,
        }),
      }),
      safety: CLEAR_SAFETY,
      schema: successObservation(input.candidate.schemaDiagnostic),
    });
  }

  const aborted =
    isAborted(input.signal) || input.candidate.observation.disposition === 'fallback_aborted';
  const failureCategory = aborted
    ? isAborted(input.signal)
      ? ('external_abort' as const)
      : ('abort' as const)
    : classifyTutorFailure(input.candidate, input.runtimeInvocations);
  return failedResult(
    aborted ? 'attempted_aborted' : 'attempted_failed',
    failureCategory,
    schemaForTutorFailure(input.candidate, failureCategory),
    failureCategory === 'dynamic_authority' || failureCategory === 'internal',
  );
}

function classifyTutorFailure(
  candidate: TutorSchemaRecoveryModelCandidateEnvelope,
  runtimeInvocations: number,
): Phase697FullGateCaseEntry['failureCategory'] {
  if (runtimeInvocations > 1) return 'internal';
  if (candidate.observation.disposition === 'fallback_budget_exceeded') return 'budget';
  if (candidate.observation.disposition === 'fallback_timeout') return 'timeout';
  const diagnostic = candidate.schemaDiagnostic;
  if (diagnostic !== null && diagnostic.reasonCode !== 'extension_fields_discarded') {
    if (diagnostic.stage === 'local_authority' || diagnostic.stage === 'local_merger') {
      return 'dynamic_authority';
    }
    if (diagnostic.stage === 'usage') return 'usage';
    return 'schema';
  }
  const trace =
    candidate.observation.attempted && 'trace' in candidate.observation
      ? candidate.observation.trace
      : undefined;
  if (trace?.errorCode === 'TIMEOUT') return 'timeout';
  if (trace?.providerFailureCategory === 'transport') return 'transport';
  if (trace?.providerFailureCategory?.startsWith('http_')) return 'http';
  if (
    trace?.providerFailureCategory === 'structured_output' ||
    trace?.providerFailureCategory === 'invalid_response' ||
    trace?.structuredOutputStage !== undefined
  ) {
    return 'schema';
  }
  if (
    candidate.observation.attempted &&
    (trace?.providerFailureCategory === 'unknown' || !validUsage(candidate.observation.usage))
  ) {
    return 'usage';
  }
  return runtimeInvocations === 0 ? 'internal' : 'transport';
}

function successObservation(
  diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null,
): Phase697SchemaRecoverySchemaObservation {
  return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse(
    diagnostic === null
      ? { outcome: 'canonical', diagnostic: null }
      : { outcome: 'extension_fields_discarded', diagnostic },
  );
}

function schemaForTutorFailure(
  candidate: TutorSchemaRecoveryModelCandidateEnvelope,
  category: Phase697FullGateCaseEntry['failureCategory'],
): Phase697SchemaRecoverySchemaObservation {
  if (isContractFailureCategory(category)) {
    const diagnostic =
      candidate.schemaDiagnostic !== null &&
      candidate.schemaDiagnostic.reasonCode !== 'extension_fields_discarded'
        ? candidate.schemaDiagnostic
        : diagnosticForCategory(category);
    return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
      outcome: 'rejected',
      diagnostic,
    });
  }
  return PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED;
}

function schemaForRuntimeResult(
  result: Omit<Phase697SchemaRecoveryRuntimeResult, 'schema'>,
): Phase697SchemaRecoverySchemaObservation {
  if (result.disposition === 'succeeded') {
    return PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
      outcome: 'canonical',
      diagnostic: null,
    });
  }
  return isContractFailureCategory(result.failureCategory)
    ? PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
        outcome: 'rejected',
        diagnostic: diagnosticForCategory(result.failureCategory),
      })
    : PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED;
}

function diagnosticForCategory(category: 'schema' | 'dynamic_authority' | 'usage') {
  const collector = createTutorSchemaRecoveryDiagnosticCollector();
  if (category === 'schema') collector.recordProjectedSchemaFailure();
  else if (category === 'dynamic_authority') collector.recordLocalAuthorityFailure();
  else collector.recordUsageFailure();
  const diagnostic = collector.read();
  if (diagnostic === null) {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_SR5_DIAGNOSTIC_UNAVAILABLE');
  }
  return diagnostic;
}

function isContractFailureCategory(
  category: Phase697FullGateCaseEntry['failureCategory'],
): category is 'schema' | 'dynamic_authority' | 'usage' {
  return category === 'schema' || category === 'dynamic_authority' || category === 'usage';
}

function failedResult(
  disposition: 'attempted_failed' | 'attempted_aborted',
  failureCategory: Phase697FullGateCaseEntry['failureCategory'],
  schema: Phase697SchemaRecoverySchemaObservation,
  criticalFailure: boolean,
): Phase697SchemaRecoveryRuntimeResult {
  return Object.freeze({
    disposition,
    failureCategory,
    strictRuntimeSuccess: false,
    durationMs: null,
    orchestrationDurationMs: null,
    usage: null,
    semantic: null,
    safety: criticalFailure
      ? Object.freeze({ ...CLEAR_SAFETY, criticalFailure: true })
      : CLEAR_SAFETY,
    schema,
  });
}

function readVerifiedUsage(candidate: TutorSchemaRecoveryModelCandidateEnvelope) {
  const usage = candidate.observation.usage;
  if (!validUsage(usage)) return null;
  const estimatedCostCny = calculatePhase697FullGateCostCny(usage.inputTokens, usage.outputTokens);
  if (estimatedCostCny > PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.tutorPerLane.costCnyMax) {
    return null;
  }
  return Object.freeze({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostCny,
    pricingProfile: PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.pricingProfile,
  });
}

function validUsage(value: Readonly<{ inputTokens: number; outputTokens: number }>) {
  const lane = PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.tutorPerLane;
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    value.inputTokens <= lane.inputTokensMax &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0 &&
    value.outputTokens <= lane.outputTokensMax
  );
}

function readNonNegativeFinite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
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
