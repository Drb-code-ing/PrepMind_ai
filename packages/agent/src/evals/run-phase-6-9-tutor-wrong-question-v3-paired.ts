import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  type Phase69OrganizerRuntimeCase,
  type Phase69OrganizerZeroCallCase,
  type Phase69TutorRuntimeCase,
  type Phase69TutorZeroCallCase,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_PRICING_PROFILE,
  type Phase697TutorOrganizerCaseEntry,
} from './phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V3_LAST_COMPLETED_STAGES,
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA,
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  buildPhase697TutorOrganizerV3Report,
  runtimeContractSuccess,
  type Phase697TutorOrganizerV3Report,
  type Phase697V3CaseEntry,
  type Phase697V3RuntimeEvidence,
} from './phase-6-9-tutor-wrong-question-v3-contract.ts';
import type {
  Phase697OrganizerEvalResult,
  Phase697RuntimeEvidenceRecorder,
  Phase697RuntimeUsage,
  Phase697TutorEvalResult,
  Phase697TutorOrganizerEvalHarness,
  Phase697ZeroCallResult,
} from './run-phase-6-9-tutor-wrong-question-paired.ts';

type Phase697ZeroCallCase = Phase69TutorZeroCallCase | Phase69OrganizerZeroCallCase;
type Phase697RuntimeAgent = 'tutor' | 'wrong_question_organizer';

export const PHASE_6_9_7_V3_SIBLING_SETTLEMENT_TIMEOUT_MS = 1_000 as const;

export type Phase697V3RunnerOptions = Readonly<{
  siblingSettlementTimeoutMs?: number;
}>;

export type Phase697V3DispatchReservation = Readonly<{
  runId: string;
  agent: Phase697RuntimeAgent;
  pairedRunIndex: number;
  key: string;
}>;

export type Phase697V3DispatchLedger = Readonly<{
  reserve(agent: Phase697RuntimeAgent, pairedRunIndex: number): Phase697V3DispatchReservation;
  complete(reservation: Phase697V3DispatchReservation): void;
  summary(): Readonly<{ reservedEntries: number; terminalEntries: number }>;
}>;

export function createPhase697V3DispatchLedger(runId: string): Phase697V3DispatchLedger {
  const entries = new Map<string, 'reserved' | 'terminal'>();
  const keyFor = (agent: Phase697RuntimeAgent, pairedRunIndex: number) =>
    `${runId}:${agent}:${pairedRunIndex}`;

  return Object.freeze({
    reserve(agent, pairedRunIndex) {
      if (!Number.isSafeInteger(pairedRunIndex) || pairedRunIndex < 0 || pairedRunIndex > 23) {
        throw new Error('PHASE_6_9_7_V3_DISPATCH_INDEX_INVALID');
      }
      const key = keyFor(agent, pairedRunIndex);
      if (entries.has(key)) throw new Error('PHASE_6_9_7_V3_DUPLICATE_DISPATCH');
      entries.set(key, 'reserved');
      return Object.freeze({ runId, agent, pairedRunIndex, key });
    },
    complete(reservation) {
      if (
        reservation.runId !== runId ||
        reservation.key !== keyFor(reservation.agent, reservation.pairedRunIndex) ||
        entries.get(reservation.key) !== 'reserved'
      ) {
        throw new Error('PHASE_6_9_7_V3_DISPATCH_TERMINAL_INVALID');
      }
      entries.set(reservation.key, 'terminal');
    },
    summary() {
      return Object.freeze({
        reservedEntries: entries.size,
        terminalEntries: [...entries.values()].filter((state) => state === 'terminal').length,
      });
    },
  });
}

export async function runPhase697TutorOrganizerPairedEvalV3(
  harness: Phase697TutorOrganizerEvalHarness,
  options?: Phase697V3RunnerOptions,
): Promise<Phase697TutorOrganizerV3Report> {
  const siblingSettlementTimeoutMs = boundedSiblingSettlementTimeout(
    options?.siblingSettlementTimeoutMs,
  );
  const zeroCallCases = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.filter(
    (entry): entry is Phase697ZeroCallCase => entry.expectedRuntimeInvocations === 0,
  );
  const zeroEntries = await Promise.all(
    zeroCallCases.map((entry) => runAndBuildZeroCallEntry(harness, entry)),
  );
  const guardFailure = zeroEntries.find((entry) => !entry.zeroCallVerified) ?? null;
  const dispatchLedger = createPhase697V3DispatchLedger(harness.runId);
  const runtimeEntries: Phase697V3CaseEntry[] = [];
  const pairedCandidateSamplesMs: number[] = [];
  let breakerTrigger: Phase697V3CaseEntry | null = guardFailure;
  let dispatchedPairs = 0;
  let completedPairs = 0;
  let activeLaneOperations = 0;
  let maximumActiveLaneOperations = 0;

  if (guardFailure) {
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
      if (breakerTrigger) {
        runtimeEntries.push(
          buildNotStartedRuntimeEntry(tutorCase, 'not_started_quality_breaker'),
          buildNotStartedRuntimeEntry(organizerCase, 'not_started_quality_breaker'),
        );
        continue;
      }

      const tutorReservation = dispatchLedger.reserve('tutor', pairedRunIndex);
      const organizerReservation = dispatchLedger.reserve(
        'wrong_question_organizer',
        pairedRunIndex,
      );
      dispatchedPairs += 1;
      const tutorController = new AbortController();
      const organizerController = new AbortController();
      const pairStartedAt = performance.now();
      let pairTrigger: Phase697V3CaseEntry | null = null;

      const runLane = async (
        reservation: Phase697V3DispatchReservation,
        operation: () => Promise<Phase697V3CaseEntry>,
        abortSibling: () => void,
      ) => {
        activeLaneOperations += 1;
        maximumActiveLaneOperations = Math.max(maximumActiveLaneOperations, activeLaneOperations);
        try {
          const entry = await operation();
          if (!runtimeContractSuccess(entry) && pairTrigger === null) {
            pairTrigger = entry;
            abortSibling();
          }
          return entry;
        } finally {
          activeLaneOperations -= 1;
          dispatchLedger.complete(reservation);
        }
      };

      const [tutorEntry, organizerEntry] = await Promise.all([
        runLane(
          tutorReservation,
          () =>
            runAndBuildTutorEntry(
              harness,
              tutorCase,
              tutorController.signal,
              siblingSettlementTimeoutMs,
            ),
          () => organizerController.abort('quality_gate_impossible'),
        ),
        runLane(
          organizerReservation,
          () =>
            runAndBuildOrganizerEntry(
              harness,
              organizerCase,
              organizerController.signal,
              siblingSettlementTimeoutMs,
            ),
          () => tutorController.abort('quality_gate_impossible'),
        ),
      ]);
      completedPairs += 1;
      runtimeEntries.push(tutorEntry, organizerEntry);
      if (tutorEntry.latencyMs !== null && organizerEntry.latencyMs !== null) {
        pairedCandidateSamplesMs.push(
          Math.max(
            performance.now() - pairStartedAt,
            tutorEntry.latencyMs,
            organizerEntry.latencyMs,
          ),
        );
      }
      if (pairTrigger !== null) breakerTrigger = pairTrigger;
    }
  }

  const caseEntries = [...zeroEntries, ...runtimeEntries];
  const breakerState = guardFailure
    ? ('guard_failed' as const)
    : breakerTrigger
      ? ('quality_gate_impossible' as const)
      : ('closed' as const);
  const trigger = breakerTrigger;
  return buildPhase697TutorOrganizerV3Report({
    runId: harness.runId,
    runScope: harness.runScope,
    mode: harness.mode,
    provider: harness.provider,
    model: harness.model,
    structuredOutputMode: harness.structuredOutputMode,
    executorProvenance: harness.executorProvenance,
    caseEntries,
    pairedCandidateSamplesMs,
    scheduler: {
      guardPhasePassed: guardFailure === null,
      breakerState,
      triggerCaseId: trigger?.caseId ?? null,
      triggerAgent: trigger?.agent ?? null,
      triggerPairedRunIndex: trigger?.executionKind === 'runtime' ? trigger.pairedRunIndex : null,
      dispatchedPairs,
      completedPairs,
      maxConcurrentPairs: dispatchedPairs > 0 ? 1 : 0,
      maxConcurrentLaneOperations: maximumActiveLaneOperations,
    },
    ledger: dispatchLedger.summary(),
  });
}

async function runAndBuildZeroCallEntry(
  harness: Phase697TutorOrganizerEvalHarness,
  entry: Phase697ZeroCallCase,
): Promise<Phase697V3CaseEntry> {
  const ledger = createRuntimeEvidenceLedger();
  let result: Phase697ZeroCallResult;
  try {
    result = await harness.runZeroCall(entry, ledger.recorder);
  } catch {
    result = {
      criticalFailure: true,
      permissionFailure: false,
      mutationFailure: false,
      broaderThanDeterministicFallback: false,
      runtimeInvocations: ledger.invocations(),
      observedReason: 'guard_mismatch',
    };
  }
  const runtimeInvocations = result.runtimeInvocations === 1 ? 1 : 0;
  const harnessFailure = result.runtimeInvocations !== runtimeInvocations;
  const executionOutcome =
    runtimeInvocations === 0 ? 'not_started_case_guard' : 'harness_internal_error';
  const raw = {
    ...baseEntry(entry.id, entry.agent, result),
    executionKind: 'zero_call' as const,
    pairedRunIndex: null,
    runtimeInvocations,
    observedZeroCallReason: result.observedReason,
    zeroCallVerified:
      !harnessFailure &&
      runtimeInvocations === 0 &&
      result.observedReason === entry.expected.zeroCallReason,
    rawSchemaValid: null,
    candidateDisposition: null,
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    latencyMs: null,
    tutorOrchestrationLatencyMs: null,
    usage: null,
    tutorExpected: null,
    tutorActual: null,
    organizerDecisions: [],
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: runtimeInvocations === 1 ? ledger.lastCompletedStage() : null,
    executionOutcome,
    usageDisposition:
      runtimeInvocations === 1
        ? ('unknown_after_attempt' as const)
        : ('absent_not_attempted' as const),
  };
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse(raw);
}

async function runAndBuildTutorEntry(
  harness: Phase697TutorOrganizerEvalHarness,
  entry: Phase69TutorRuntimeCase,
  signal: AbortSignal,
  siblingSettlementTimeoutMs: number,
): Promise<Phase697V3CaseEntry> {
  const ledger = createRuntimeEvidenceLedger();
  const startedAt = performance.now();
  try {
    const settled = await settleRuntimeOperation(
      harness.runTutor(entry, ledger.recorder, signal),
      signal,
      siblingSettlementTimeoutMs,
    );
    if (settled.kind === 'orphaned') {
      return buildRuntimeOrphanedEntry(entry, ledger, performance.now() - startedAt);
    }
    if (settled.kind === 'rejected') {
      return buildRuntimeHarnessFailureEntry(entry, ledger, signal, performance.now() - startedAt);
    }
    return buildTutorRuntimeEntry(
      entry,
      settled.value,
      ledger,
      signal,
      performance.now() - startedAt,
    );
  } catch {
    return buildRuntimeHarnessFailureEntry(entry, ledger, signal, performance.now() - startedAt);
  }
}

async function runAndBuildOrganizerEntry(
  harness: Phase697TutorOrganizerEvalHarness,
  entry: Phase69OrganizerRuntimeCase,
  signal: AbortSignal,
  siblingSettlementTimeoutMs: number,
): Promise<Phase697V3CaseEntry> {
  const ledger = createRuntimeEvidenceLedger();
  const startedAt = performance.now();
  try {
    const settled = await settleRuntimeOperation(
      harness.runOrganizer(entry, ledger.recorder, signal),
      signal,
      siblingSettlementTimeoutMs,
    );
    if (settled.kind === 'orphaned') {
      return buildRuntimeOrphanedEntry(entry, ledger, performance.now() - startedAt);
    }
    if (settled.kind === 'rejected') {
      return buildRuntimeHarnessFailureEntry(entry, ledger, signal, performance.now() - startedAt);
    }
    return buildOrganizerRuntimeEntry(
      entry,
      settled.value,
      ledger,
      signal,
      performance.now() - startedAt,
    );
  } catch {
    return buildRuntimeHarnessFailureEntry(entry, ledger, signal, performance.now() - startedAt);
  }
}

type RuntimeOperationSettlement<Result> =
  | Readonly<{ kind: 'resolved'; value: Result }>
  | Readonly<{ kind: 'rejected' }>
  | Readonly<{ kind: 'orphaned' }>;

async function settleRuntimeOperation<Result>(
  operation: Promise<Result>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<RuntimeOperationSettlement<Result>> {
  const settled: Promise<RuntimeOperationSettlement<Result>> = operation.then(
    (value): RuntimeOperationSettlement<Result> => ({ kind: 'resolved', value }),
    (): RuntimeOperationSettlement<Result> => ({ kind: 'rejected' }),
  );
  if (!signal.aborted) {
    let abortListener: (() => void) | null = null;
    const aborted = new Promise<RuntimeOperationSettlement<Result>>((resolve) => {
      abortListener = () => resolve({ kind: 'orphaned' });
      signal.addEventListener('abort', abortListener, { once: true });
    });
    const first = await Promise.race([settled, aborted]);
    if (abortListener) signal.removeEventListener('abort', abortListener);
    if (first.kind !== 'orphaned') return first;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<RuntimeOperationSettlement<Result>>((resolve) => {
    timeoutHandle = setTimeout(() => resolve({ kind: 'orphaned' }), timeoutMs);
  });
  const final = await Promise.race([settled, timeout]);
  if (timeoutHandle) clearTimeout(timeoutHandle);
  return final;
}

function buildTutorRuntimeEntry(
  entry: Phase69TutorRuntimeCase,
  result: Phase697TutorEvalResult,
  ledger: RuntimeEvidenceLedger,
  signal: AbortSignal,
  observedLatencyMs: number,
): Phase697V3CaseEntry {
  const evidence = normalizeResultEvidence(result, ledger, signal);
  if (!evidence) return buildRuntimeHarnessFailureEntry(entry, ledger, signal, observedLatencyMs);
  const raw = {
    ...baseEntry(entry.id, entry.agent, result),
    executionKind: 'runtime' as const,
    pairedRunIndex: entry.pairedRunIndex,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: result.rawSchemaValid,
    candidateDisposition: result.candidateDisposition,
    canonicalSchemaSuccess: result.canonicalSchemaSuccess,
    canonicalValidationStage: result.canonicalDiagnostic.canonicalValidationStage,
    canonicalFailureReason: result.canonicalDiagnostic.canonicalFailureReason,
    strictRuntimeSuccess: false,
    latencyMs: finiteLatency(result.latencyMs),
    tutorOrchestrationLatencyMs: finiteLatency(
      Math.max(result.tutorOrchestrationLatencyMs, result.latencyMs),
    ),
    usage: evidence.usageDisposition === 'verified' ? toCaseUsage(result.usage) : null,
    tutorExpected: {
      ...entry.expected,
      answerStructure: [...entry.expected.answerStructure],
    },
    tutorActual: result.observation.validOutput
      ? {
          intent: result.observation.actualIntent,
          depth: result.observation.actualDepth,
          contextUse: result.observation.actualContextUse,
          guidingQuestion: result.observation.actualGuidingQuestion,
          finalAnswer: result.observation.actualFinalAnswer,
          answerStructure: [...result.observation.actualAnswerStructure],
        }
      : null,
    organizerDecisions: [],
    ...evidence,
  };
  raw.strictRuntimeSuccess = runtimeContractSuccess(raw);
  const parsed = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse(raw);
  return parsed.success
    ? parsed.data
    : buildRuntimeHarnessFailureEntry(entry, ledger, signal, observedLatencyMs);
}

function buildOrganizerRuntimeEntry(
  entry: Phase69OrganizerRuntimeCase,
  result: Phase697OrganizerEvalResult,
  ledger: RuntimeEvidenceLedger,
  signal: AbortSignal,
  observedLatencyMs: number,
): Phase697V3CaseEntry {
  const evidence = normalizeResultEvidence(result, ledger, signal);
  if (!evidence) return buildRuntimeHarnessFailureEntry(entry, ledger, signal, observedLatencyMs);
  const raw = {
    ...baseEntry(entry.id, entry.agent, result),
    executionKind: 'runtime' as const,
    pairedRunIndex: entry.pairedRunIndex,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: result.rawSchemaValid,
    candidateDisposition: result.candidateDisposition,
    canonicalSchemaSuccess: result.canonicalSchemaSuccess,
    canonicalValidationStage: result.canonicalDiagnostic.canonicalValidationStage,
    canonicalFailureReason: result.canonicalDiagnostic.canonicalFailureReason,
    strictRuntimeSuccess: false,
    latencyMs: finiteLatency(result.latencyMs),
    tutorOrchestrationLatencyMs: null,
    usage: evidence.usageDisposition === 'verified' ? toCaseUsage(result.usage) : null,
    tutorExpected: null,
    tutorActual: null,
    organizerDecisions: organizerDecisionEntries(entry, result.observations),
    ...evidence,
  };
  raw.strictRuntimeSuccess = runtimeContractSuccess(raw);
  const parsed = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse(raw);
  return parsed.success
    ? parsed.data
    : buildRuntimeHarnessFailureEntry(entry, ledger, signal, observedLatencyMs);
}

function normalizeResultEvidence(
  result: Phase697TutorEvalResult | Phase697OrganizerEvalResult,
  ledger: RuntimeEvidenceLedger,
  signal: AbortSignal,
): Phase697V3RuntimeEvidence | null {
  if (signal.aborted && result.runtimeInvocations === 0) {
    return notStartedEvidence('not_started_parent_abort');
  }
  const parsed = PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse(result.v3RuntimeEvidence);
  if (!parsed.success || parsed.data.runtimeInvocations !== result.runtimeInvocations) return null;
  if (
    (parsed.data.usageDisposition === 'verified') !== (result.usage !== null) ||
    parsed.data.runtimeInvocations !== ledger.invocations()
  ) {
    return null;
  }
  return parsed.data;
}

function buildRuntimeHarnessFailureEntry(
  entry: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
  ledger: RuntimeEvidenceLedger,
  signal: AbortSignal,
  observedLatencyMs: number,
): Phase697V3CaseEntry {
  const invocations = ledger.invocations();
  if (signal.aborted && invocations === 0) {
    return buildNotStartedRuntimeEntry(entry, 'not_started_parent_abort');
  }
  const runtimeInvocations = invocations === 1 ? 1 : 0;
  const executionOutcome =
    signal.aborted && runtimeInvocations === 1
      ? ('attempted_aborted' as const)
      : ('harness_internal_error' as const);
  const usageDisposition =
    runtimeInvocations === 1
      ? ('unknown_after_attempt' as const)
      : ('absent_not_attempted' as const);
  const raw = {
    ...baseEntry(entry.id, entry.agent, {
      criticalFailure: false,
      permissionFailure: false,
      mutationFailure: false,
      broaderThanDeterministicFallback: false,
    }),
    executionKind: 'runtime' as const,
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: false,
    candidateDisposition:
      executionOutcome === 'attempted_aborted'
        ? ('fallback_aborted' as const)
        : ('fallback_runtime_error' as const),
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    latencyMs: finiteLatency(observedLatencyMs),
    tutorOrchestrationLatencyMs: entry.agent === 'tutor' ? finiteLatency(observedLatencyMs) : null,
    usage: null,
    tutorExpected:
      entry.agent === 'tutor'
        ? { ...entry.expected, answerStructure: [...entry.expected.answerStructure] }
        : null,
    tutorActual: null,
    organizerDecisions:
      entry.agent === 'wrong_question_organizer' ? organizerDecisionEntries(entry, []) : [],
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: ledger.lastCompletedStage(),
    executionOutcome,
    usageDisposition,
  };
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse(raw);
}

function buildRuntimeOrphanedEntry(
  entry: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
  ledger: RuntimeEvidenceLedger,
  observedLatencyMs: number,
): Phase697V3CaseEntry {
  const runtimeInvocations = ledger.invocations();
  if (runtimeInvocations === 0) {
    return buildNotStartedRuntimeEntry(entry, 'not_started_orphaned');
  }
  const raw = {
    ...baseEntry(entry.id, entry.agent, {
      criticalFailure: false,
      permissionFailure: false,
      mutationFailure: false,
      broaderThanDeterministicFallback: false,
    }),
    executionKind: 'runtime' as const,
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_runtime_error' as const,
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    latencyMs: finiteLatency(observedLatencyMs),
    tutorOrchestrationLatencyMs: entry.agent === 'tutor' ? finiteLatency(observedLatencyMs) : null,
    usage: null,
    tutorExpected:
      entry.agent === 'tutor'
        ? { ...entry.expected, answerStructure: [...entry.expected.answerStructure] }
        : null,
    tutorActual: null,
    organizerDecisions:
      entry.agent === 'wrong_question_organizer' ? organizerDecisionEntries(entry, []) : [],
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: ledger.lastCompletedStage(),
    executionOutcome: 'attempted_orphaned' as const,
    usageDisposition: 'unknown_after_attempt' as const,
  };
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse(raw);
}

function buildNotStartedRuntimeEntry(
  entry: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
  executionOutcome:
    | 'not_started_case_guard'
    | 'not_started_quality_breaker'
    | 'not_started_parent_abort'
    | 'not_started_orphaned',
): Phase697V3CaseEntry {
  const raw = {
    ...baseEntry(entry.id, entry.agent, {
      criticalFailure: false,
      permissionFailure: false,
      mutationFailure: false,
      broaderThanDeterministicFallback: false,
    }),
    executionKind: 'runtime' as const,
    pairedRunIndex: entry.pairedRunIndex,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: null,
    candidateDisposition: null,
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    latencyMs: null,
    tutorOrchestrationLatencyMs: null,
    usage: null,
    tutorExpected:
      entry.agent === 'tutor'
        ? { ...entry.expected, answerStructure: [...entry.expected.answerStructure] }
        : null,
    tutorActual: null,
    organizerDecisions:
      entry.agent === 'wrong_question_organizer' ? organizerDecisionEntries(entry, []) : [],
    ...notStartedEvidence(executionOutcome),
  };
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse(raw);
}

function notStartedEvidence(
  executionOutcome:
    | 'not_started_case_guard'
    | 'not_started_quality_breaker'
    | 'not_started_parent_abort'
    | 'not_started_orphaned',
): Phase697V3RuntimeEvidence {
  return {
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    runtimeInvocations: 0,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: null,
    executionOutcome,
    usageDisposition: 'absent_not_attempted',
  };
}

function organizerDecisionEntries(
  entry: Phase69OrganizerRuntimeCase,
  observations: Phase697OrganizerEvalResult['observations'],
): Phase697TutorOrganizerCaseEntry['organizerDecisions'] {
  return entry.expected.decisions.map((expected) => {
    const observation = observations.find(
      (candidate) => candidate.decisionId === `${entry.id}:q${expected.questionIndex}`,
    );
    return {
      decisionIndex: expected.questionIndex,
      expectedSubject: expected.subject,
      actualSubject: observation?.actualSubject ?? null,
      expectedDeckAction: expected.deckAction,
      actualDeckAction: observation?.actualDeckAction ?? null,
      expectedDeckIndex: expected.deckIndex ?? null,
      actualDeckIndex: observation?.actualDeckIndex ?? null,
      canonicalTopicLabel: expected.canonicalTopicLabel,
      actualTopicLabelClass: observation?.actualTopicLabel ?? null,
      expectedConfidence: expected.confidence,
      actualConfidence: observation?.actualConfidence ?? null,
      requiredEvidenceCodes: [...expected.requiredEvidenceCodes],
      allowedEvidenceCodes: [...expected.allowedEvidenceCodes],
      actualEvidenceCodes: [...(observation?.actualEvidenceCodes ?? [])],
      validOutput: observation?.validOutput ?? false,
    };
  });
}

function baseEntry(
  caseId: string,
  agent: Phase697RuntimeAgent,
  result: Readonly<{
    criticalFailure: boolean;
    permissionFailure: boolean;
    mutationFailure: boolean;
    broaderThanDeterministicFallback: boolean;
  }>,
) {
  return {
    caseId,
    agent,
    criticalFailure: result.criticalFailure,
    permissionFailure: result.permissionFailure,
    mutationFailure: result.mutationFailure,
    broaderThanDeterministicFallback: result.broaderThanDeterministicFallback,
  };
}

function toCaseUsage(value: Phase697RuntimeUsage | null) {
  return value
    ? {
        ...value,
        pricingKnown: true as const,
        currency: 'CNY' as const,
        pricingProfile: PHASE_6_9_7_PRICING_PROFILE,
      }
    : null;
}

function finiteLatency(value: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function boundedSiblingSettlementTimeout(value: number | undefined) {
  return Number.isSafeInteger(value) && (value ?? 0) >= 1 && (value ?? 0) <= 15_000
    ? value!
    : PHASE_6_9_7_V3_SIBLING_SETTLEMENT_TIMEOUT_MS;
}

function getRuntimeCase(agent: 'tutor', pairedRunIndex: number): Phase69TutorRuntimeCase;
function getRuntimeCase(
  agent: 'wrong_question_organizer',
  pairedRunIndex: number,
): Phase69OrganizerRuntimeCase;
function getRuntimeCase(agent: Phase697RuntimeAgent, pairedRunIndex: number) {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
    (candidate) =>
      candidate.agent === agent &&
      candidate.expectedRuntimeInvocations === 1 &&
      candidate.pairedRunIndex === pairedRunIndex,
  );
  if (!entry || entry.expectedRuntimeInvocations !== 1) {
    throw new Error(`PHASE_6_9_7_V3_PAIRED_CASE_MISSING:${agent}:${pairedRunIndex}`);
  }
  return entry;
}

type RuntimeEvidenceLedger = ReturnType<typeof createRuntimeEvidenceLedger>;

function createRuntimeEvidenceLedger() {
  let invocations: 0 | 1 = 0;
  let lastCompletedStage: Phase697V3RuntimeEvidence['lastCompletedStage'] = null;
  const recorder: Phase697RuntimeEvidenceRecorder = Object.freeze({
    completeStage(stage) {
      const previousIndex = lastCompletedStage
        ? PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(lastCompletedStage)
        : -1;
      const nextIndex = PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(stage);
      const delegateIndex = PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf('delegate_started');
      if (
        nextIndex < 0 ||
        nextIndex < previousIndex ||
        (invocations === 0 && nextIndex >= delegateIndex) ||
        (invocations === 1 && nextIndex < delegateIndex)
      ) {
        throw new Error('PHASE_6_9_7_V3_LEDGER_STAGE_INVALID');
      }
      lastCompletedStage = stage;
    },
    startDelegate() {
      const requestIndex = PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf('request_validated');
      const currentIndex = lastCompletedStage
        ? PHASE_6_9_7_V3_LAST_COMPLETED_STAGES.indexOf(lastCompletedStage)
        : -1;
      if (invocations !== 0 || currentIndex !== requestIndex) {
        throw new Error('PHASE_6_9_7_V3_LEDGER_DISPATCH_INVALID');
      }
      invocations = 1;
      lastCompletedStage = 'delegate_started';
    },
  });
  return Object.freeze({
    recorder,
    invocations: () => invocations,
    lastCompletedStage: () => lastCompletedStage,
  });
}
