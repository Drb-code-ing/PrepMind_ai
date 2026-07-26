import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  type Phase697V2Case,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA,
  PHASE_6_9_7_V5_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V5_LANE_POLICY,
  PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5,
  phase697V5IdentitySnapshot,
  phase697V5QualityGatePasses,
  runtimeContractSuccessV5,
  sha256Phase697V5Stable,
  type Phase697TutorOrganizerV5Report,
  type Phase697V5CaseEntry,
} from './phase-6-9-tutor-wrong-question-v5-contract.ts';
import type { ModelCandidateDisposition } from '../model-candidates/model-candidate-policy.ts';

type Phase697V5Agent = 'tutor' | 'wrong_question_organizer';
type Phase697V5RuntimeCase = Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase;
type Phase697V5ZeroCallCase = Exclude<Phase697V2Case, Phase697V5RuntimeCase>;

export const PHASE_6_9_7_V5_SIBLING_SETTLEMENT_TIMEOUT_MS = 1_000 as const;

const SAFE_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export type Phase697V5SafetyResult = Readonly<typeof SAFE_SAFETY>;

export type Phase697V5Usage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  estimatedCostCny: number;
}>;

export type Phase697V5FailureCategory = Phase697V5CaseEntry['failureCategory'];

export type Phase697V5ZeroCallResult = Phase697V5SafetyResult &
  Readonly<{
    runtimeInvocations: number;
    candidateDisposition: ModelCandidateDisposition;
    zeroCallVerified: boolean;
    failureCategory: Extract<
      Phase697V5FailureCategory,
      'none' | 'local_guard' | 'pre_dispatch_abort' | 'harness_internal'
    >;
  }>;

export type Phase697V5RuntimeResult = Phase697V5SafetyResult &
  Readonly<{
    runtimeInvocations: number;
    candidateDisposition: ModelCandidateDisposition;
    failureCategory: Phase697V5FailureCategory;
    providerFailureCategory: Phase697V5CaseEntry['providerFailureCategory'];
    structuredOutputStage: Phase697V5CaseEntry['structuredOutputStage'];
    strictRuntimeSuccess: boolean;
    semanticAxes: NonNullable<Phase697V5CaseEntry['semanticAxes']> | null;
    latencyMs: number | null;
    orchestrationLatencyMs: number | null;
    usage: Phase697V5Usage | null;
    usageDisposition: Phase697V5CaseEntry['usageDisposition'];
    terminalHint?: 'executed' | 'attempted_aborted';
  }>;

export type Phase697V5Harness = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: 'mock' | 'deepseek-v4-pro';
  structuredOutputMode: 'mock_json_v5' | 'deepseek_v4_pro_nonthinking_json';
  executorProvenance: 'mock_synthetic' | 'deepseek_network' | 'synthetic_test';
  runZeroCall(entry: Phase697V5ZeroCallCase): Promise<Phase697V5ZeroCallResult>;
  runTutor(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V5RuntimeResult>;
  runOrganizer(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
  ): Promise<Phase697V5RuntimeResult>;
}>;

export type Phase697V5DispatchReservation = Readonly<{
  runId: string;
  agent: Phase697V5Agent;
  pairedRunIndex: number;
  key: string;
}>;

export type Phase697V5RunnerLifecycle = Readonly<{
  recordGuardTerminal?(entry: Readonly<Phase697V5CaseEntry>): Promise<void>;
  recordDispatchStarted?(
    reservation: Readonly<Phase697V5DispatchReservation>,
    caseId: string,
  ): Promise<void>;
  recordRuntimeTerminal?(
    reservation: Readonly<Phase697V5DispatchReservation>,
    entry: Readonly<Phase697V5CaseEntry>,
  ): Promise<void>;
  recordPairTerminal?(pairedRunIndex: number, latencyMs: number | null): Promise<void>;
  recordBreakerOpened?(entry: Readonly<Phase697V5CaseEntry>): Promise<void>;
  recordRunCompleted?(report: Readonly<Phase697TutorOrganizerV5Report>): Promise<void>;
}>;

export type Phase697V5RunnerOptions = Readonly<{
  siblingSettlementTimeoutMs?: number;
  lifecycle?: Phase697V5RunnerLifecycle;
}>;

export type Phase697V5DispatchLedger = Readonly<{
  reserve(agent: Phase697V5Agent, pairedRunIndex: number): Phase697V5DispatchReservation;
  complete(reservation: Readonly<Phase697V5DispatchReservation>): void;
  summary(): Readonly<{
    reservedEntries: number;
    terminalEntries: number;
    duplicateDispatchRejected: number;
  }>;
}>;

export function createPhase697V5DispatchLedger(runId: string): Phase697V5DispatchLedger {
  const entries = new Map<string, 'reserved' | 'terminal'>();
  let duplicateDispatchRejected = 0;
  const keyFor = (agent: Phase697V5Agent, pairedRunIndex: number) =>
    sha256Phase697V5Stable({
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5,
      runId,
      agent,
      pairedRunIndex,
    });
  return Object.freeze({
    reserve(agent, pairedRunIndex) {
      if (!Number.isSafeInteger(pairedRunIndex) || pairedRunIndex < 0 || pairedRunIndex > 23) {
        throw new Error('PHASE_6_9_7_V5_DISPATCH_INDEX_INVALID');
      }
      const key = keyFor(agent, pairedRunIndex);
      if (entries.has(key)) {
        duplicateDispatchRejected += 1;
        throw new Error('PHASE_6_9_7_V5_DUPLICATE_DISPATCH');
      }
      entries.set(key, 'reserved');
      return Object.freeze({ runId, agent, pairedRunIndex, key });
    },
    complete(reservation) {
      if (
        reservation.runId !== runId ||
        reservation.key !== keyFor(reservation.agent, reservation.pairedRunIndex) ||
        entries.get(reservation.key) !== 'reserved'
      ) {
        throw new Error('PHASE_6_9_7_V5_DISPATCH_TERMINAL_INVALID');
      }
      entries.set(reservation.key, 'terminal');
    },
    summary() {
      return Object.freeze({
        reservedEntries: entries.size,
        terminalEntries: [...entries.values()].filter((state) => state === 'terminal').length,
        duplicateDispatchRejected,
      });
    },
  });
}

export async function runPhase697TutorOrganizerPairedEvalV5(
  harness: Phase697V5Harness,
  options?: Phase697V5RunnerOptions,
): Promise<Readonly<Phase697TutorOrganizerV5Report>> {
  assertHarnessIdentity(harness);
  const siblingSettlementTimeoutMs = boundedSettlementTimeout(options?.siblingSettlementTimeoutMs);
  const zeroCallCases = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.filter(
    (entry): entry is Phase697V5ZeroCallCase => entry.expectedRuntimeInvocations === 0,
  );
  const zeroEntries = await Promise.all(
    zeroCallCases.map((entry) => runAndBuildZeroCallEntry(harness, entry)),
  );
  for (const entry of zeroEntries) await options?.lifecycle?.recordGuardTerminal?.(entry);
  const guardFailure = zeroEntries.find((entry) => !entry.zeroCallVerified) ?? null;
  const ledger = createPhase697V5DispatchLedger(harness.runId);
  const runtimeEntries: Phase697V5CaseEntry[] = [];
  const pairedLatencies = new Map<number, number | null>();
  let breakerTrigger: Phase697V5CaseEntry | null = guardFailure;
  let dispatchedPairs = 0;
  let completedPairs = 0;
  let activeLaneOperations = 0;
  let maximumActiveLaneOperations = 0;

  if (guardFailure !== null) {
    await options?.lifecycle?.recordBreakerOpened?.(guardFailure);
    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      runtimeEntries.push(
        buildNotStartedRuntimeEntry(
          getRuntimeCase('tutor', pairedRunIndex),
          'not_started_case_guard',
        ),
        buildNotStartedRuntimeEntry(
          getRuntimeCase('wrong_question_organizer', pairedRunIndex),
          'not_started_case_guard',
        ),
      );
    }
  } else {
    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      const tutorCase = getRuntimeCase('tutor', pairedRunIndex);
      const organizerCase = getRuntimeCase('wrong_question_organizer', pairedRunIndex);
      if (breakerTrigger !== null) {
        runtimeEntries.push(
          buildNotStartedRuntimeEntry(tutorCase, 'not_started_quality_breaker'),
          buildNotStartedRuntimeEntry(organizerCase, 'not_started_quality_breaker'),
        );
        continue;
      }

      const tutorReservation = ledger.reserve('tutor', pairedRunIndex);
      const organizerReservation = ledger.reserve('wrong_question_organizer', pairedRunIndex);
      // Durability is intentionally before either harness operation. If append/fsync
      // fails, the runner throws without entering a lane or invoking a provider.
      await options?.lifecycle?.recordDispatchStarted?.(tutorReservation, tutorCase.id);
      await options?.lifecycle?.recordDispatchStarted?.(organizerReservation, organizerCase.id);
      dispatchedPairs += 1;
      const tutorController = new AbortController();
      const organizerController = new AbortController();
      const pairStartedAt = performance.now();
      let pairTrigger: Phase697V5CaseEntry | null = null;

      const runLane = async (
        reservation: Phase697V5DispatchReservation,
        entry: Phase697V5RuntimeCase,
        operation: () => Promise<Phase697V5RuntimeResult>,
        ownSignal: AbortSignal,
        abortSibling: () => void,
      ) => {
        activeLaneOperations += 1;
        maximumActiveLaneOperations = Math.max(maximumActiveLaneOperations, activeLaneOperations);
        let terminal: Phase697V5CaseEntry | null = null;
        try {
          terminal = await runAndBuildRuntimeEntry(
            entry,
            operation,
            ownSignal,
            siblingSettlementTimeoutMs,
          );
          if (!runtimeContractSuccessV5(terminal) && pairTrigger === null) {
            pairTrigger = terminal;
            abortSibling();
          }
          return terminal;
        } finally {
          activeLaneOperations -= 1;
          try {
            if (terminal !== null) {
              await options?.lifecycle?.recordRuntimeTerminal?.(reservation, terminal);
            }
          } finally {
            ledger.complete(reservation);
          }
        }
      };

      const [tutorEntry, organizerEntry] = await Promise.all([
        runLane(
          tutorReservation,
          tutorCase,
          () => harness.runTutor(tutorCase, tutorController.signal),
          tutorController.signal,
          () => organizerController.abort('quality_gate_impossible'),
        ),
        runLane(
          organizerReservation,
          organizerCase,
          () => harness.runOrganizer(organizerCase, organizerController.signal),
          organizerController.signal,
          () => tutorController.abort('quality_gate_impossible'),
        ),
      ]);
      completedPairs += 1;
      runtimeEntries.push(tutorEntry, organizerEntry);
      const pairedLatency = pairLatency(pairStartedAt, tutorEntry, organizerEntry);
      pairedLatencies.set(pairedRunIndex, pairedLatency);
      await options?.lifecycle?.recordPairTerminal?.(pairedRunIndex, pairedLatency);
      if (pairTrigger !== null) {
        breakerTrigger = pairTrigger;
        await options?.lifecycle?.recordBreakerOpened?.(pairTrigger);
      }
    }
  }

  const report = buildPhase697TutorOrganizerV5Report({
    runId: harness.runId,
    runScope: harness.runScope,
    mode: harness.mode,
    provider: harness.provider,
    model: harness.model,
    structuredOutputMode: harness.structuredOutputMode,
    executorProvenance: harness.executorProvenance,
    caseEntries: [...zeroEntries, ...runtimeEntries],
    pairedLatencies,
    scheduler: {
      guardPhasePassed: guardFailure === null,
      breakerState:
        guardFailure !== null
          ? 'guard_failed'
          : breakerTrigger !== null
            ? 'quality_gate_impossible'
            : 'closed',
      triggerCaseId: breakerTrigger?.caseId ?? null,
      triggerAgent: breakerTrigger?.agent ?? null,
      triggerPairedRunIndex:
        breakerTrigger?.executionKind === 'runtime' ? breakerTrigger.pairedRunIndex : null,
      dispatchedPairs,
      completedPairs,
      maxConcurrentPairs: dispatchedPairs > 0 ? 1 : 0,
      maxConcurrentLaneOperations: maximumActiveLaneOperations,
    },
    ledger: ledger.summary(),
  });
  await options?.lifecycle?.recordRunCompleted?.(report);
  return report;
}

export function buildPhase697TutorOrganizerV5Report(input: {
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: 'mock' | 'deepseek-v4-pro';
  structuredOutputMode: 'mock_json_v5' | 'deepseek_v4_pro_nonthinking_json';
  executorProvenance: 'mock_synthetic' | 'deepseek_network' | 'synthetic_test';
  caseEntries: readonly Phase697V5CaseEntry[];
  pairedLatencies: ReadonlyMap<number, number | null>;
  scheduler: Phase697TutorOrganizerV5Report['scheduler'];
  ledger: Phase697TutorOrganizerV5Report['ledger'];
}): Readonly<Phase697TutorOrganizerV5Report> {
  const entries = [...input.caseEntries].sort(compareCaseEntries);
  const runtimeEntries = entries.filter((entry) => entry.executionKind === 'runtime');
  const tutorEntries = runtimeEntries.filter((entry) => entry.agent === 'tutor');
  const organizerEntries = runtimeEntries.filter(
    (entry) => entry.agent === 'wrong_question_organizer',
  );
  const pairedLatencySamplesMs = Array.from(
    { length: 24 },
    (_, pairedRunIndex) => input.pairedLatencies.get(pairedRunIndex) ?? null,
  );
  const metricsComplete = runtimeEntries.every((entry) => entry.semanticAxes !== null);
  const latencyComplete =
    runtimeEntries.every((entry) => entry.latencyMs !== null) &&
    pairedLatencySamplesMs.every((value) => value !== null);
  const usageComplete = runtimeEntries.every(
    (entry) => entry.usageDisposition === 'verified' && entry.usage !== null,
  );
  const metrics = {
    complete: metricsComplete,
    strictRuntimeSuccesses: runtimeEntries.filter(runtimeContractSuccessV5).length,
    tutorSemanticScore: metricsComplete ? semanticScore(tutorEntries) : null,
    organizerSemanticScore: metricsComplete ? semanticScore(organizerEntries) : null,
    combinedSemanticScore: metricsComplete ? semanticScore(runtimeEntries) : null,
  } as const;
  const latency = {
    complete: latencyComplete,
    tutorP95Ms: latencyComplete
      ? nearestRankP95(tutorEntries.map((entry) => entry.latencyMs!))
      : null,
    organizerP95Ms: latencyComplete
      ? nearestRankP95(organizerEntries.map((entry) => entry.latencyMs!))
      : null,
    pairedP95Ms: latencyComplete ? nearestRankP95(pairedLatencySamplesMs) : null,
    orchestrationP95Ms: latencyComplete
      ? nearestRankP95(
          tutorEntries.map((entry) => entry.orchestrationLatencyMs ?? entry.latencyMs!),
        )
      : null,
  } as const;
  const verifiedUsage = runtimeEntries.flatMap((entry) => (entry.usage ? [entry.usage] : []));
  const usage = {
    complete: usageComplete,
    providerInvocations: entries.reduce((sum, entry) => sum + entry.runtimeInvocations, 0),
    verifiedRuntimeCases: verifiedUsage.length,
    inputTokens: usageComplete
      ? verifiedUsage.reduce((sum, entry) => sum + entry.inputTokens, 0)
      : null,
    outputTokens: usageComplete
      ? verifiedUsage.reduce((sum, entry) => sum + entry.outputTokens, 0)
      : null,
    estimatedCostCny: usageComplete
      ? verifiedUsage.reduce((sum, entry) => sum + entry.estimatedCostCny, 0)
      : null,
  } as const;
  const reportWithoutGate = {
    runId: input.runId,
    runScope: input.runScope,
    mode: input.mode,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V5,
    identities: phase697V5IdentitySnapshot(),
    provider: input.provider,
    model: input.model,
    structuredOutputMode: input.structuredOutputMode,
    executorProvenance: input.executorProvenance,
    lanePolicy: PHASE_6_9_7_V5_LANE_POLICY,
    counts: {
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    },
    scheduler: input.scheduler,
    ledger: input.ledger,
    pairedLatencySamplesMs,
    caseEntries: entries,
    metrics,
    latency,
    usage,
    safety: {
      verifiedZeroCalls: entries.filter(
        (entry) => entry.executionKind === 'zero_call' && entry.zeroCallVerified,
      ).length,
      criticalFailures: entries.filter((entry) => entry.safety.criticalFailure).length,
      providerFailures: entries.filter((entry) => entry.providerFailureCategory !== null).length,
      permissionFailures: entries.filter((entry) => entry.safety.permissionFailure).length,
      mutationFailures: entries.filter((entry) => entry.safety.mutationFailure).length,
      broaderFallbacks: entries.filter((entry) => entry.safety.broaderThanDeterministicFallback)
        .length,
    },
  } as const;
  const provisional = {
    ...reportWithoutGate,
    gate: input.mode === 'mock' ? 'mock_quality_not_evidence' : 'quality_gate_failed',
  } as Phase697TutorOrganizerV5Report;
  const final = {
    ...reportWithoutGate,
    gate:
      input.mode === 'mock'
        ? 'mock_quality_not_evidence'
        : phase697V5QualityGatePasses(provisional)
          ? 'quality_gate_passed'
          : 'quality_gate_failed',
  };
  return deepFreeze(PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA.parse(final));
}

export function buildPhase697V5NotStartedEntry(
  entry: Phase697V5RuntimeCase,
  executionOutcome:
    | 'not_started_case_guard'
    | 'not_started_quality_breaker'
    | 'not_started_parent_abort'
    | 'not_started_orphaned',
): Readonly<Phase697V5CaseEntry> {
  return buildNotStartedRuntimeEntry(entry, executionOutcome);
}

export function buildPhase697V5OrphanedEntry(
  entry: Phase697V5RuntimeCase,
  dispatchRecorded: boolean,
): Readonly<Phase697V5CaseEntry> {
  if (!dispatchRecorded) return buildNotStartedRuntimeEntry(entry, 'not_started_orphaned');
  return parseEntry({
    runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
    caseId: entry.id,
    agent: entry.agent,
    executionKind: 'runtime',
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: 1,
    executionOutcome: 'attempted_orphaned',
    candidateDisposition: 'fallback_runtime_error',
    failureCategory: 'orphaned',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    semanticAxes: null,
    latencyMs: null,
    orchestrationLatencyMs: null,
    usageDisposition: 'unknown_after_attempt',
    usage: null,
    safety: SAFE_SAFETY,
    dispatchRecorded: true,
    runtimeTerminalRecorded: true,
  });
}

async function runAndBuildZeroCallEntry(
  harness: Phase697V5Harness,
  entry: Phase697V5ZeroCallCase,
): Promise<Phase697V5CaseEntry> {
  try {
    const result = await harness.runZeroCall(entry);
    const actualInvocations = result.runtimeInvocations === 1 ? 1 : 0;
    const verified =
      result.zeroCallVerified &&
      result.runtimeInvocations === 0 &&
      result.candidateDisposition !== 'candidate_applied';
    return parseEntry({
      runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
      caseId: entry.id,
      agent: entry.agent,
      executionKind: 'zero_call',
      pairedRunIndex: null,
      runtimeInvocations: actualInvocations,
      executionOutcome:
        actualInvocations === 0 ? 'not_started_case_guard' : 'harness_internal_error',
      candidateDisposition: result.candidateDisposition,
      failureCategory: verified ? result.failureCategory : 'harness_internal',
      providerFailureCategory: null,
      structuredOutputStage: null,
      strictRuntimeSuccess: false,
      zeroCallVerified: verified,
      semanticAxes: null,
      latencyMs: null,
      orchestrationLatencyMs: null,
      usageDisposition: actualInvocations === 0 ? 'absent_not_attempted' : 'unknown_after_attempt',
      usage: null,
      safety: {
        ...safetyFrom(result),
        criticalFailure: result.criticalFailure || !verified,
      },
      dispatchRecorded: false,
      runtimeTerminalRecorded: false,
    });
  } catch {
    return parseEntry({
      runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
      caseId: entry.id,
      agent: entry.agent,
      executionKind: 'zero_call',
      pairedRunIndex: null,
      runtimeInvocations: 0,
      executionOutcome: 'not_started_case_guard',
      candidateDisposition: 'fallback_runtime_error',
      failureCategory: 'harness_internal',
      providerFailureCategory: null,
      structuredOutputStage: null,
      strictRuntimeSuccess: false,
      zeroCallVerified: false,
      semanticAxes: null,
      latencyMs: null,
      orchestrationLatencyMs: null,
      usageDisposition: 'absent_not_attempted',
      usage: null,
      safety: { ...SAFE_SAFETY, criticalFailure: true },
      dispatchRecorded: false,
      runtimeTerminalRecorded: false,
    });
  }
}

async function runAndBuildRuntimeEntry(
  entry: Phase697V5RuntimeCase,
  operation: () => Promise<Phase697V5RuntimeResult>,
  signal: AbortSignal,
  settlementTimeoutMs: number,
): Promise<Phase697V5CaseEntry> {
  const startedAt = performance.now();
  const settled = await settleLane(operation(), signal, settlementTimeoutMs);
  if (settled.kind === 'orphaned') return buildPhase697V5OrphanedEntry(entry, true);
  if (settled.kind === 'rejected') {
    const aborted = signal.aborted;
    return attemptedFailureEntry(
      entry,
      aborted ? 'attempted_aborted' : 'executed_failure',
      aborted ? 'post_dispatch_abort' : 'harness_internal',
      performance.now() - startedAt,
    );
  }
  const result = settled.value;
  const invocationValid = result.runtimeInvocations === 1;
  const aborted = signal.aborted || result.terminalHint === 'attempted_aborted';
  const executionOutcome = aborted
    ? 'attempted_aborted'
    : result.strictRuntimeSuccess && invocationValid
      ? 'executed_success'
      : 'executed_failure';
  const usageDisposition = aborted ? 'unknown_after_attempt' : result.usageDisposition;
  const usage = usageDisposition === 'verified' ? result.usage : null;
  return parseEntry({
    runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
    caseId: entry.id,
    agent: entry.agent,
    executionKind: 'runtime',
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: 1,
    executionOutcome,
    candidateDisposition: result.candidateDisposition,
    failureCategory:
      aborted || !invocationValid
        ? aborted
          ? 'post_dispatch_abort'
          : 'harness_internal'
        : result.failureCategory,
    providerFailureCategory: aborted ? null : result.providerFailureCategory,
    structuredOutputStage: aborted ? null : result.structuredOutputStage,
    strictRuntimeSuccess: executionOutcome === 'executed_success',
    zeroCallVerified: false,
    semanticAxes: executionOutcome === 'executed_success' ? result.semanticAxes : null,
    latencyMs:
      executionOutcome === 'attempted_aborted'
        ? null
        : (result.latencyMs ?? performance.now() - startedAt),
    orchestrationLatencyMs:
      executionOutcome === 'attempted_aborted' ? null : result.orchestrationLatencyMs,
    usageDisposition,
    usage,
    safety: safetyFrom(result),
    dispatchRecorded: true,
    runtimeTerminalRecorded: true,
  });
}

function attemptedFailureEntry(
  entry: Phase697V5RuntimeCase,
  outcome: 'executed_failure' | 'attempted_aborted',
  failureCategory: 'harness_internal' | 'post_dispatch_abort',
  latencyMs: number,
) {
  return parseEntry({
    runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
    caseId: entry.id,
    agent: entry.agent,
    executionKind: 'runtime',
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: 1,
    executionOutcome: outcome,
    candidateDisposition: 'fallback_runtime_error',
    failureCategory,
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    semanticAxes: null,
    latencyMs: outcome === 'attempted_aborted' ? null : latencyMs,
    orchestrationLatencyMs: null,
    usageDisposition: 'unknown_after_attempt',
    usage: null,
    safety: { ...SAFE_SAFETY, criticalFailure: outcome === 'executed_failure' },
    dispatchRecorded: true,
    runtimeTerminalRecorded: true,
  });
}

function buildNotStartedRuntimeEntry(
  entry: Phase697V5RuntimeCase,
  executionOutcome:
    | 'not_started_case_guard'
    | 'not_started_quality_breaker'
    | 'not_started_parent_abort'
    | 'not_started_orphaned',
): Phase697V5CaseEntry {
  return parseEntry({
    runtimeEvidenceVersion: PHASE_6_9_7_V5_RUNTIME_EVIDENCE_VERSION,
    caseId: entry.id,
    agent: entry.agent,
    executionKind: 'runtime',
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: 0,
    executionOutcome,
    candidateDisposition: null,
    failureCategory: executionOutcome === 'not_started_orphaned' ? 'orphaned' : 'local_guard',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    semanticAxes: null,
    latencyMs: null,
    orchestrationLatencyMs: null,
    usageDisposition: 'absent_not_attempted',
    usage: null,
    safety: SAFE_SAFETY,
    dispatchRecorded: false,
    runtimeTerminalRecorded: false,
  });
}

function getRuntimeCase(agent: 'tutor', pairedRunIndex: number): Phase697V2TutorRuntimeCase;
function getRuntimeCase(
  agent: 'wrong_question_organizer',
  pairedRunIndex: number,
): Phase697V2OrganizerRuntimeCase;
function getRuntimeCase(agent: Phase697V5Agent, pairedRunIndex: number): Phase697V5RuntimeCase {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (candidate): candidate is Phase697V5RuntimeCase =>
      candidate.expectedRuntimeInvocations === 1 &&
      candidate.agent === agent &&
      candidate.pairedRunIndex === pairedRunIndex,
  );
  if (!entry) throw new Error('PHASE_6_9_7_V5_RUNTIME_CASE_MISSING');
  return entry;
}

function assertHarnessIdentity(harness: Phase697V5Harness) {
  const valid =
    (harness.mode === 'mock' &&
      harness.provider === 'mock' &&
      harness.model === 'mock' &&
      harness.structuredOutputMode === 'mock_json_v5' &&
      harness.executorProvenance === 'mock_synthetic') ||
    (harness.mode === 'live' &&
      harness.provider === 'deepseek' &&
      harness.model === 'deepseek-v4-pro' &&
      harness.structuredOutputMode === 'deepseek_v4_pro_nonthinking_json' &&
      harness.executorProvenance !== 'mock_synthetic');
  if (!valid) throw new Error('PHASE_6_9_7_V5_HARNESS_IDENTITY_INVALID');
}

function parseEntry(input: unknown): Phase697V5CaseEntry {
  return deepFreeze(PHASE_6_9_7_V5_CASE_ENTRY_SCHEMA.parse(input));
}

function pairLatency(
  pairStartedAt: number,
  tutorEntry: Phase697V5CaseEntry,
  organizerEntry: Phase697V5CaseEntry,
) {
  if (tutorEntry.latencyMs === null || organizerEntry.latencyMs === null) return null;
  return Math.max(
    performance.now() - pairStartedAt,
    tutorEntry.latencyMs,
    organizerEntry.latencyMs,
  );
}

function semanticScore(entries: readonly Phase697V5CaseEntry[]) {
  const axes = entries.flatMap((entry) => {
    if (entry.semanticAxes === null) return [];
    return Object.entries(entry.semanticAxes)
      .filter(
        ([key, value]) => key !== 'agent' && key !== 'decisionUnits' && typeof value === 'boolean',
      )
      .map(([, value]) => value as boolean);
  });
  return axes.length === 0 ? 0 : axes.filter(Boolean).length / axes.length;
}

function nearestRankP95(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}

function compareCaseEntries(left: Phase697V5CaseEntry, right: Phase697V5CaseEntry) {
  const leftCase = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.findIndex(
    (entry) => entry.id === left.caseId,
  );
  const rightCase = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.findIndex(
    (entry) => entry.id === right.caseId,
  );
  return leftCase - rightCase;
}

async function settleLane<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<
  | Readonly<{ kind: 'fulfilled'; value: T }>
  | Readonly<{ kind: 'rejected' }>
  | Readonly<{ kind: 'orphaned' }>
> {
  const settled = operation.then(
    (value) => ({ kind: 'fulfilled' as const, value }),
    () => ({ kind: 'rejected' as const }),
  );
  if (signal.aborted) {
    return Promise.race([settled, orphanTimeout(timeoutMs)]);
  }
  return new Promise((resolve) => {
    let finished = false;
    const finish = (value: Awaited<typeof settled> | Readonly<{ kind: 'orphaned' }>) => {
      if (finished) return;
      finished = true;
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => {
      void Promise.race([settled, orphanTimeout(timeoutMs)]).then(finish);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    void settled.then(finish);
  });
}

function orphanTimeout(ms: number): Promise<Readonly<{ kind: 'orphaned' }>> {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ kind: 'orphaned' }), ms);
  });
}

function boundedSettlementTimeout(value: number | undefined) {
  if (value === undefined) return PHASE_6_9_7_V5_SIBLING_SETTLEMENT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value < 1 || value > 10_000) {
    throw new Error('PHASE_6_9_7_V5_SETTLEMENT_TIMEOUT_INVALID');
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function safetyFrom(value: Phase697V5SafetyResult): Phase697V5SafetyResult {
  return {
    criticalFailure: value.criticalFailure,
    permissionFailure: value.permissionFailure,
    mutationFailure: value.mutationFailure,
    broaderThanDeterministicFallback: value.broaderThanDeterministicFallback,
  };
}
