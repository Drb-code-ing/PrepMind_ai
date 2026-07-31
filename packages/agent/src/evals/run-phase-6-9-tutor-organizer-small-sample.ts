import {
  createPhase697V7WireDiagnostics,
  type Phase697V7WireCapability,
  type Phase697V7WireSnapshot,
  type Phase697V7WireStage,
} from '@repo/ai';

import {
  PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY,
  buildPhase697SmallSampleReport,
  type Phase697SmallSampleCaseEntry,
  type Phase697SmallSampleReport,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST,
} from './phase-6-9-tutor-organizer-small-sample-manifest.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2OrganizerZeroCallCase,
  type Phase697V2TutorRuntimeCase,
  type Phase697V2TutorZeroCallCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';

const CLEAR_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});

const ZERO_WIRE = Object.freeze({
  executorEntered: 0 as const,
  providerDispatchStarted: 0 as const,
  providerResponseReceived: 0 as const,
  verifiedUsageObserved: 0 as const,
});

export type Phase697SmallSampleGuardCase =
  Phase697V2TutorZeroCallCase | Phase697V2OrganizerZeroCallCase;
export type Phase697SmallSampleRuntimeCase =
  Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase;

export type Phase697SmallSampleGuardResult = Readonly<{
  runtimeInvocations: number;
  zeroCallVerified: boolean;
  safety: Phase697SmallSampleCaseEntry['safety'];
}>;

export type Phase697SmallSampleRuntimeResult = Readonly<{
  disposition: 'succeeded' | 'attempted_failed' | 'attempted_aborted';
  failureCategory: Phase697SmallSampleCaseEntry['failureCategory'];
  strictRuntimeSuccess: boolean;
  durationMs: number | null;
  usage: Phase697SmallSampleCaseEntry['usage'];
  semantic: Phase697SmallSampleCaseEntry['semantic'];
  safety: Phase697SmallSampleCaseEntry['safety'];
}>;

export type Phase697SmallSampleHarness = Readonly<{
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  runGuard(entry: Phase697SmallSampleGuardCase): Promise<Phase697SmallSampleGuardResult>;
  runTutor(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697SmallSampleRuntimeResult>;
  runOrganizer(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697SmallSampleRuntimeResult>;
}>;

export type Phase697SmallSampleLaneIdentity = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
}>;

export type Phase697SmallSampleLifecycle = Readonly<{
  appendGuardTerminal(entry: Phase697SmallSampleCaseEntry): Promise<void>;
  reserveLane(identity: Phase697SmallSampleLaneIdentity): Promise<
    Readonly<{
      appendWireStage(stage: Phase697V7WireStage): Promise<void>;
    }>
  >;
  appendLaneTerminal(
    identity: Phase697SmallSampleLaneIdentity,
    entry: Phase697SmallSampleCaseEntry,
  ): Promise<void>;
  appendLaneNotStarted(entry: Phase697SmallSampleCaseEntry): Promise<void>;
  appendPairTerminal(pairedRunIndex: number): Promise<void>;
  appendRunTerminal(report: Phase697SmallSampleReport): Promise<void>;
}>;

export type RunPhase697SmallSampleInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  approvedRunnableSourceCommit: string;
  sourceHashes: Readonly<{
    tutorPromptSha256: string;
    tutorSchemaSha256: string;
    tutorMergerSha256: string;
    organizerPromptSha256: string;
    organizerSchemaSha256: string;
    organizerMergerSha256: string;
    adapterSha256: string;
  }>;
  harness: Phase697SmallSampleHarness;
  lifecycle: Phase697SmallSampleLifecycle;
  signal: AbortSignal;
}>;

/**
 * The small-sample scheduler owns ordering and fixed-denominator accounting.
 * Provider construction, filesystem durability, and CLI authority remain in
 * separate composition roots.
 */
export async function runPhase697TutorOrganizerSmallSample(
  input: RunPhase697SmallSampleInput,
): Promise<Readonly<Phase697SmallSampleReport>> {
  assertRunnerInput(input);
  const entries = new Map<string, Phase697SmallSampleCaseEntry>();
  let guardFailed = false;

  for (const guardCase of resolveGuardCases()) {
    const entry = await runGuard(input.harness, guardCase);
    entries.set(entry.caseId, entry);
    await input.lifecycle.appendGuardTerminal(entry);
    if (!entry.zeroCallVerified) guardFailed = true;
  }

  if (guardFailed) {
    await appendRemainingNotStarted(input.lifecycle, entries, 'not_started_quality_breaker');
  } else if (isAborted(input.signal)) {
    await appendRemainingNotStarted(input.lifecycle, entries, 'not_started_external_abort');
  } else {
    const runtime = resolveRuntimePairs();
    let terminalMode: 'not_started_quality_breaker' | 'not_started_external_abort' | null = null;
    for (const pair of runtime) {
      if (terminalMode !== null) {
        await appendPairNotStarted(input.lifecycle, entries, pair, terminalMode);
        continue;
      }
      if (isAborted(input.signal)) {
        terminalMode = 'not_started_external_abort';
        await appendPairNotStarted(input.lifecycle, entries, pair, terminalMode);
        continue;
      }

      const [tutorEntry, organizerEntry] = await Promise.all([
        runRuntimeLane({
          testCase: pair.tutor,
          harness: input.harness,
          lifecycle: input.lifecycle,
          parentSignal: input.signal,
        }),
        runRuntimeLane({
          testCase: pair.organizer,
          harness: input.harness,
          lifecycle: input.lifecycle,
          parentSignal: input.signal,
        }),
      ]);
      entries.set(tutorEntry.caseId, tutorEntry);
      entries.set(organizerEntry.caseId, organizerEntry);
      await input.lifecycle.appendPairTerminal(pair.pairedRunIndex);

      const failed = [tutorEntry, organizerEntry].some(
        (entry) => entry.disposition !== 'succeeded',
      );
      if (failed) {
        terminalMode = isAborted(input.signal)
          ? 'not_started_external_abort'
          : 'not_started_quality_breaker';
      }
    }
  }

  const orderedEntries = PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((expected) => {
    const entry = entries.get(expected.caseId);
    if (!entry) throw new Error('PHASE_6_9_7_SMALL_SAMPLE_RUNNER_ENTRY_MISSING');
    return entry;
  });
  const report = buildPhase697SmallSampleReport({
    runId: input.runId,
    runScope: input.runScope,
    mode: input.harness.mode,
    executorProvenance: input.harness.executorProvenance,
    approvedRunnableSourceCommit: input.approvedRunnableSourceCommit,
    sourceHashes: input.sourceHashes,
    caseEntries: orderedEntries,
  });
  await input.lifecycle.appendRunTerminal(report);
  return report;
}

async function runGuard(
  harness: Phase697SmallSampleHarness,
  testCase: Phase697SmallSampleGuardCase,
): Promise<Phase697SmallSampleCaseEntry> {
  try {
    const result = await harness.runGuard(testCase);
    const verified =
      result.zeroCallVerified &&
      result.runtimeInvocations === 0 &&
      safetyTotal(result.safety) === 0;
    return parseEntry({
      entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
      caseId: testCase.id,
      agent: testCase.agent,
      executionKind: 'guard',
      pairedRunIndex: null,
      disposition: verified ? 'not_started_guard' : 'attempted_failed',
      failureCategory: verified ? 'none' : 'guard',
      strictRuntimeSuccess: false,
      zeroCallVerified: verified,
      wire:
        result.runtimeInvocations === 0
          ? ZERO_WIRE
          : {
              executorEntered: 1,
              providerDispatchStarted: 0,
              providerResponseReceived: 0,
              verifiedUsageObserved: 0,
            },
      durationMs: null,
      usage: null,
      semantic: null,
      safety: verified ? CLEAR_SAFETY : { ...result.safety, criticalFailure: true },
    });
  } catch {
    return failedGuardEntry(testCase);
  }
}

async function runRuntimeLane(input: {
  testCase: Phase697SmallSampleRuntimeCase;
  harness: Phase697SmallSampleHarness;
  lifecycle: Phase697SmallSampleLifecycle;
  parentSignal: AbortSignal;
}): Promise<Phase697SmallSampleCaseEntry> {
  const identity: Phase697SmallSampleLaneIdentity = {
    caseId: input.testCase.id,
    agent: input.testCase.agent,
    pairedRunIndex: input.testCase.pairedRunIndex,
  };
  const lane = await input.lifecycle.reserveLane(identity);
  const diagnostics = createPhase697V7WireDiagnostics({
    appendStage: lane.appendWireStage,
  });
  const controller = new AbortController();
  const unlink = linkAbort(input.parentSignal, controller);
  const hardTimeoutMs =
    input.testCase.agent === 'tutor'
      ? PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs
      : PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs;
  let entry: Phase697SmallSampleCaseEntry;
  try {
    const settled = await settleRuntime(
      () =>
        input.testCase.agent === 'tutor'
          ? input.harness.runTutor(input.testCase, controller.signal, diagnostics.capability)
          : input.harness.runOrganizer(input.testCase, controller.signal, diagnostics.capability),
      controller,
      hardTimeoutMs,
    );
    let result: Phase697SmallSampleRuntimeResult;
    if (settled.kind === 'resolved') {
      result = settled.value;
    } else {
      const parentAborted = isAborted(input.parentSignal);
      const aborted = parentAborted || settled.kind === 'aborted';
      await terminateWire(diagnostics, aborted ? 'post_dispatch_abort' : 'runtime_timeout');
      result = failedRuntimeResult(
        aborted ? 'attempted_aborted' : 'attempted_failed',
        parentAborted ? 'external_abort' : aborted ? 'abort' : 'timeout',
      );
    }
    if (diagnostics.readSnapshot().state === 'active') {
      await terminateWire(
        diagnostics,
        result.disposition === 'attempted_aborted'
          ? 'post_dispatch_abort'
          : result.failureCategory === 'timeout'
            ? 'runtime_timeout'
            : 'harness_internal',
      );
    }
    const snapshot = diagnostics.readSnapshot();
    entry = normalizeRuntimeEntry(input.testCase, result, snapshot);
  } catch {
    const parentAborted = isAborted(input.parentSignal);
    await terminateWire(diagnostics, parentAborted ? 'post_dispatch_abort' : 'harness_internal');
    entry = normalizeRuntimeEntry(
      input.testCase,
      failedRuntimeResult(
        parentAborted ? 'attempted_aborted' : 'attempted_failed',
        parentAborted ? 'external_abort' : 'internal',
      ),
      diagnostics.readSnapshot(),
    );
  } finally {
    unlink();
  }
  // Durability failures are intentionally outside the execution catch. A
  // terminal append failure leaves a recoverable durable prefix; retrying the
  // same terminal in-process could create a duplicate or contradict fsync.
  await input.lifecycle.appendLaneTerminal(identity, entry);
  return entry;
}

function normalizeRuntimeEntry(
  testCase: Phase697SmallSampleRuntimeCase,
  result: Phase697SmallSampleRuntimeResult,
  snapshot: Phase697V7WireSnapshot,
): Phase697SmallSampleCaseEntry {
  const wire = {
    executorEntered: bit(snapshot.counters.executorInvocations),
    providerDispatchStarted: bit(snapshot.counters.providerDispatches),
    providerResponseReceived: bit(snapshot.counters.providerResponses),
    verifiedUsageObserved: bit(snapshot.counters.verifiedUsages),
  } as const;
  const fullWire = Object.values(wire).every((value) => value === 1);
  const timeoutMs =
    testCase.agent === 'tutor'
      ? PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs
      : PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs;
  const strict =
    result.disposition === 'succeeded' &&
    result.strictRuntimeSuccess &&
    snapshot.state === 'succeeded' &&
    fullWire &&
    result.durationMs !== null &&
    result.durationMs <= timeoutMs &&
    result.usage !== null &&
    result.semantic !== null &&
    safetyTotal(result.safety) === 0;
  const disposition = strict
    ? ('succeeded' as const)
    : result.disposition === 'attempted_aborted'
      ? ('attempted_aborted' as const)
      : ('attempted_failed' as const);
  const failureCategory = strict
    ? ('none' as const)
    : disposition === 'attempted_aborted'
      ? result.failureCategory === 'external_abort'
        ? ('external_abort' as const)
        : ('abort' as const)
      : normalizeFailureCategory(result.failureCategory);
  return parseEntry({
    entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
    caseId: testCase.id,
    agent: testCase.agent,
    executionKind: 'runtime',
    pairedRunIndex: testCase.pairedRunIndex,
    disposition,
    failureCategory,
    strictRuntimeSuccess: strict,
    zeroCallVerified: false,
    wire,
    durationMs: strict ? result.durationMs : null,
    usage: strict ? result.usage : null,
    semantic: strict ? result.semantic : null,
    safety: result.safety,
  });
}

async function appendRemainingNotStarted(
  lifecycle: Phase697SmallSampleLifecycle,
  entries: Map<string, Phase697SmallSampleCaseEntry>,
  mode: 'not_started_quality_breaker' | 'not_started_external_abort',
) {
  for (const pair of resolveRuntimePairs()) {
    await appendPairNotStarted(lifecycle, entries, pair, mode);
  }
}

async function appendPairNotStarted(
  lifecycle: Phase697SmallSampleLifecycle,
  entries: Map<string, Phase697SmallSampleCaseEntry>,
  pair: ReturnType<typeof resolveRuntimePairs>[number],
  mode: 'not_started_quality_breaker' | 'not_started_external_abort',
) {
  for (const testCase of [pair.tutor, pair.organizer] as const) {
    if (entries.has(testCase.id)) continue;
    const entry = notStartedEntry(testCase, mode);
    entries.set(entry.caseId, entry);
    await lifecycle.appendLaneNotStarted(entry);
  }
  await lifecycle.appendPairTerminal(pair.pairedRunIndex);
}

function notStartedEntry(
  testCase: Phase697SmallSampleRuntimeCase,
  mode: 'not_started_quality_breaker' | 'not_started_external_abort',
) {
  return parseEntry({
    entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
    caseId: testCase.id,
    agent: testCase.agent,
    executionKind: 'runtime',
    pairedRunIndex: testCase.pairedRunIndex,
    disposition: mode,
    failureCategory: mode === 'not_started_quality_breaker' ? 'quality_breaker' : 'external_abort',
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    wire: ZERO_WIRE,
    durationMs: null,
    usage: null,
    semantic: null,
    safety: CLEAR_SAFETY,
  });
}

function failedGuardEntry(testCase: Phase697SmallSampleGuardCase) {
  return parseEntry({
    entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
    caseId: testCase.id,
    agent: testCase.agent,
    executionKind: 'guard',
    pairedRunIndex: null,
    disposition: 'attempted_failed',
    failureCategory: 'guard',
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    wire: ZERO_WIRE,
    durationMs: null,
    usage: null,
    semantic: null,
    safety: { ...CLEAR_SAFETY, criticalFailure: true },
  });
}

function failedRuntimeResult(
  disposition: 'attempted_failed' | 'attempted_aborted',
  failureCategory: Phase697SmallSampleCaseEntry['failureCategory'],
): Phase697SmallSampleRuntimeResult {
  return Object.freeze({
    disposition,
    failureCategory,
    strictRuntimeSuccess: false,
    durationMs: null,
    usage: null,
    semantic: null,
    safety: CLEAR_SAFETY,
  });
}

function resolveGuardCases(): readonly Phase697SmallSampleGuardCase[] {
  const tutor = new Map(phase697V2TutorCases.map((testCase) => [testCase.id, testCase]));
  const organizer = new Map(phase697V2OrganizerCases.map((testCase) => [testCase.id, testCase]));
  return [
    ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.tutorGuardCaseIds.map((caseId) => {
      const testCase = tutor.get(caseId);
      if (!testCase || testCase.expectedRuntimeInvocations !== 0) throw sourceMismatch();
      return testCase;
    }),
    ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.organizerGuardCaseIds.map((caseId) => {
      const testCase = organizer.get(caseId);
      if (!testCase || testCase.expectedRuntimeInvocations !== 0) throw sourceMismatch();
      return testCase;
    }),
  ];
}

function resolveRuntimePairs() {
  const tutor = new Map(phase697V2TutorCases.map((testCase) => [testCase.id, testCase]));
  const organizer = new Map(phase697V2OrganizerCases.map((testCase) => [testCase.id, testCase]));
  return PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs.map((pair) => {
    const tutorCase = tutor.get(pair.tutorCaseId);
    const organizerCase = organizer.get(pair.organizerCaseId);
    if (
      !tutorCase ||
      tutorCase.expectedRuntimeInvocations !== 1 ||
      !organizerCase ||
      organizerCase.expectedRuntimeInvocations !== 1 ||
      tutorCase.pairedRunIndex !== pair.pairedRunIndex ||
      organizerCase.pairedRunIndex !== pair.pairedRunIndex
    ) {
      throw sourceMismatch();
    }
    return Object.freeze({
      pairedRunIndex: pair.pairedRunIndex,
      tutor: tutorCase,
      organizer: organizerCase,
    });
  });
}

function assertRunnerInput(input: RunPhase697SmallSampleInput) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      input.runId,
    ) ||
    !/^[0-9a-f]{40}$/u.test(input.approvedRunnableSourceCommit) ||
    !isAbortSignal(input.signal)
  ) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_RUNNER_INPUT_INVALID');
  }
}

function parseEntry(input: unknown) {
  return deepFreeze(PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse(input));
}

function normalizeFailureCategory(
  category: Phase697SmallSampleCaseEntry['failureCategory'],
): Phase697SmallSampleCaseEntry['failureCategory'] {
  return ['none', 'guard', 'quality_breaker', 'external_abort'].includes(category)
    ? 'internal'
    : category;
}

function bit(value: number): 0 | 1 {
  return value === 1 ? 1 : 0;
}

function safetyTotal(safety: Phase697SmallSampleCaseEntry['safety']) {
  return Object.values(safety).filter(Boolean).length;
}

async function settleRuntime(
  start: () => Promise<Phase697SmallSampleRuntimeResult>,
  controller: AbortController,
  hardTimeoutMs: number,
): Promise<
  | Readonly<{ kind: 'resolved'; value: Phase697SmallSampleRuntimeResult }>
  | Readonly<{ kind: 'timed_out' }>
  | Readonly<{ kind: 'aborted' }>
> {
  if (isAborted(controller.signal)) return Object.freeze({ kind: 'aborted' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTriggered = false;
  const timeout = new Promise<Readonly<{ kind: 'timed_out' }>>((resolve) => {
    timer = setTimeout(() => {
      timeoutTriggered = true;
      resolve(Object.freeze({ kind: 'timed_out' }));
      abortSafely(controller);
    }, hardTimeoutMs);
  });
  let onAbort: (() => void) | undefined;
  const abort = new Promise<Readonly<{ kind: 'aborted' }>>((resolve) => {
    onAbort = () => {
      if (!timeoutTriggered) resolve(Object.freeze({ kind: 'aborted' }));
    };
    controller.signal.addEventListener('abort', onAbort, { once: true });
    if (isAborted(controller.signal)) onAbort();
  });
  // Install the exact hard-timeout watchdog before crossing the harness
  // boundary. Promise.resolve().then also normalizes a synchronous throw.
  const operation = Promise.resolve().then(start);
  const resolved = operation
    .then((value) => Object.freeze({ kind: 'resolved' as const, value }))
    .catch(() =>
      Object.freeze({
        kind: 'resolved' as const,
        value: failedRuntimeResult('attempted_failed', 'internal'),
      }),
    );
  try {
    return await Promise.race([resolved, timeout, abort]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) controller.signal.removeEventListener('abort', onAbort);
    void operation.catch(() => undefined);
  }
}

function linkAbort(parent: AbortSignal, child: AbortController) {
  const abort = () => abortSafely(child);
  parent.addEventListener('abort', abort, { once: true });
  if (isAborted(parent)) abort();
  return () => parent.removeEventListener('abort', abort);
}

async function terminateWire(
  diagnostics: ReturnType<typeof createPhase697V7WireDiagnostics>,
  category: Parameters<typeof diagnostics.terminateRuntime>[0],
) {
  try {
    if (diagnostics.readSnapshot().state === 'active') await diagnostics.terminateRuntime(category);
  } catch {
    // The lane remains failed; no raw transition error crosses this boundary.
  }
}

function abortSafely(controller: AbortController) {
  try {
    controller.abort();
  } catch {
    // Treat hostile AbortController behavior as already aborted.
  }
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function sourceMismatch() {
  return new Error('PHASE_6_9_7_SMALL_SAMPLE_SOURCE_MISMATCH');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
