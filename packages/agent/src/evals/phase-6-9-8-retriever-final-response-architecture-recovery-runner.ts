import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryDiagnosticStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_RESULT_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA,
  buildPhase698ArchitectureRecoveryReport,
  createPhase698ArchitectureRecoveryNotStartedEntry,
  expectedPhase698ArchitectureRecoveryCallSchedule,
  type Phase698ArchitectureRecoveryCallEntry,
  type Phase698ArchitectureRecoveryCallIdentity,
  type Phase698ArchitectureRecoveryCallResult,
  type Phase698ArchitectureRecoveryFailureReason,
  type Phase698ArchitectureRecoveryFinalEntry,
  type Phase698ArchitectureRecoveryGuardEntry,
  type Phase698ArchitectureRecoveryProviderWire,
  type Phase698ArchitectureRecoveryReport,
  type Phase698ArchitectureRecoveryRewriteEntry,
  type Phase698ArchitectureRecoveryRunnerStage,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import {
  validatePhase698ArchitectureRecoveryRunnerObservation,
  type Phase698ArchitectureRecoveryRunnerObservationCapability,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-observation.ts';
import { consumePhase698ArchitectureRecoveryRewriteRunnerObservation } from './phase-6-9-8-retriever-final-response-architecture-recovery-contract.ts';
import { consumePhase698ArchitectureRecoveryFinalResponseRunnerObservation } from './phase-6-9-8-retriever-final-response-architecture-recovery-final-response.ts';
import { consumePhase698ArchitectureRecoveryQwenRunnerObservation } from './phase-6-9-8-retriever-final-response-architecture-recovery-qwen.ts';
import {
  consumePhase698ArchitectureRecoveryAdmissionCapability,
  type Phase698ArchitectureRecoveryAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';
import type {
  Phase698Task8FinalResponseCase,
  Phase698Task8GuardCase,
  Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-outcome-capability-v1' as const;

export type Phase698ArchitectureRecoveryOutcomeCapability = Readonly<{
  version: typeof PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_VERSION;
}>;

export type Phase698ArchitectureRecoveryGuardResult = Readonly<{
  observedReasonCode: string;
  zeroCallVerified: boolean;
  permissionFailure: boolean;
  crossOwnerFailure: boolean;
  credentialFailure: boolean;
  injectionFailure: boolean;
}>;

export type Phase698ArchitectureRecoveryHarness = Readonly<{
  runMode: 'synthetic_fault' | 'reviewed_mock' | 'controlled_live';
  transportAuthority: 'synthetic_injected' | 'external_provider';
  runGuard(
    testCase: Phase698Task8GuardCase,
    signal: AbortSignal,
  ): Promise<Phase698ArchitectureRecoveryGuardResult>;
  invokeCall(
    input: Readonly<{
      identity: Phase698ArchitectureRecoveryCallIdentity;
      testCase: Phase698Task8RewriteCase | Phase698Task8FinalResponseCase;
      rewrittenQuery?: string;
      signal: AbortSignal;
    }>,
  ): Promise<Phase698ArchitectureRecoveryOutcomeCapability>;
}>;

export type Phase698ArchitectureRecoveryDiagnosticJournalTerminal = Readonly<{
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic;
  diagnosticStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
  providerWire: Phase698ArchitectureRecoveryProviderWire;
}>;

export type Phase698ArchitectureRecoveryCallLifecycle = Readonly<{
  appendRunnerStage(
    stage: Phase698ArchitectureRecoveryRunnerStage,
    preparedSuccess?: Phase698ArchitectureRecoveryCallEntry,
  ): Promise<void>;
  appendDiagnosticStage(
    event: 'started' | 'succeeded' | 'failed',
    stage: Phase698ArchitectureRecoveryDiagnosticStage,
    terminal?: Phase698ArchitectureRecoveryDiagnosticJournalTerminal,
  ): Promise<void>;
  appendCallPrepared(entry: Phase698ArchitectureRecoveryCallEntry): Promise<void>;
}>;

export type Phase698ArchitectureRecoveryLifecycle = Readonly<{
  runId: string;
  appendGuardTerminal(entry: Phase698ArchitectureRecoveryGuardEntry): Promise<void>;
  reserveCall(
    identity: Phase698ArchitectureRecoveryCallIdentity,
  ): Promise<Phase698ArchitectureRecoveryCallLifecycle>;
  appendCallTerminal(entry: Phase698ArchitectureRecoveryCallEntry): Promise<void>;
  appendRewriteTerminal(entry: Phase698ArchitectureRecoveryRewriteEntry): Promise<void>;
  appendFinalTerminal(entry: Phase698ArchitectureRecoveryFinalEntry): Promise<void>;
  appendRunTerminal(report: Phase698ArchitectureRecoveryReport): Promise<void>;
}>;

export type RunPhase698ArchitectureRecoveryInput = Readonly<{
  runId: string;
  authority: 'synthetic_test' | 'controlled_live';
  runMode: 'synthetic_fault' | 'reviewed_mock' | 'controlled_live';
  credentialReads: number;
  admissionCapability: Phase698ArchitectureRecoveryAdmissionCapability;
  harness: Phase698ArchitectureRecoveryHarness;
  lifecycle: Phase698ArchitectureRecoveryLifecycle;
  signal: AbortSignal;
}>;

type Outcome = Readonly<{
  authority: 'synthetic_test' | 'controlled_live';
  identity: Phase698ArchitectureRecoveryCallIdentity;
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic;
  diagnosticStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
  providerWire: Phase698ArchitectureRecoveryProviderWire;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  verifiedCostCny: number | null;
  result: Phase698ArchitectureRecoveryCallResult | null;
}>;

const outcomes = new WeakMap<object, Outcome>();
const consumedOutcomes = new WeakSet<object>();
const UUID = z.string().uuid();
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const OUTCOME_INPUT_SCHEMA = z
  .object({
    identity: z.unknown(),
    diagnostic: PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
    diagnosticStages: z.array(z.string()),
    providerWire: z
      .object({
        executions: z.number().int().min(0).max(1),
        dispatches: z.number().int().min(0).max(1),
        responses: z.number().int().min(0).max(1),
        verifiedUsage: z.number().int().min(0).max(1),
      })
      .strict(),
    usage: z
      .object({
        inputTokens: z.number().int().positive(),
        outputTokens: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    result: PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_RESULT_SCHEMA.nullable(),
  })
  .strict();

type RunnerDependencies = Readonly<{
  now(): number;
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  timeoutMs(identity: Phase698ArchitectureRecoveryCallIdentity): number;
}>;

const DEFAULT_DEPENDENCIES: RunnerDependencies = Object.freeze({
  now: () => performance.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
  timeoutMs: (identity) => timeoutForPhase(identity.phase),
});

/**
 * Synthetic structural seam only. It issues an opaque single-use result capability and never
 * creates controlled-Live authority.
 */
export function createPhase698ArchitectureRecoverySyntheticOutcomeForTest(
  input: Readonly<{
    identity: Phase698ArchitectureRecoveryCallIdentity;
    diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic;
    diagnosticStages: readonly Phase698ArchitectureRecoveryDiagnosticStage[];
    providerWire: Phase698ArchitectureRecoveryProviderWire;
    usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
    verifiedCostCny: number | null;
    result: Phase698ArchitectureRecoveryCallResult | null;
  }>,
): Phase698ArchitectureRecoveryOutcomeCapability {
  return issueOutcome('synthetic_test', input);
}

/**
 * Internal first-party harness seam. Source admission still gates the runner; this function only
 * seals an already bounded R1/R2 observation and cannot read credentials or call a Provider.
 */
export function createPhase698ArchitectureRecoveryControlledOutcome(
  input: Readonly<{
    identity: Phase698ArchitectureRecoveryCallIdentity;
    observationCapability: Phase698ArchitectureRecoveryRunnerObservationCapability;
    usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
    verifiedCostCny: number | null;
    result: Phase698ArchitectureRecoveryCallResult | null;
  }>,
): Phase698ArchitectureRecoveryOutcomeCapability {
  const identity = parseIdentity(input.identity);
  const record =
    identity.phase === 'rewrite_candidate_model'
      ? consumePhase698ArchitectureRecoveryRewriteRunnerObservation(input.observationCapability)
      : identity.phase === 'final_response_model'
        ? consumePhase698ArchitectureRecoveryFinalResponseRunnerObservation(
            input.observationCapability,
          )
        : consumePhase698ArchitectureRecoveryQwenRunnerObservation(input.observationCapability);
  if (!record) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  }
  const observation = validatePhase698ArchitectureRecoveryRunnerObservation(record, identity);
  return issueOutcome('controlled_live', {
    identity,
    diagnostic: observation.diagnostic,
    diagnosticStages: observation.diagnosticStages,
    providerWire: observation.providerWire,
    usage: input.usage,
    verifiedCostCny: input.verifiedCostCny,
    result: input.result,
  });
}

export function runPhase698ArchitectureRecoveryR3(
  input: RunPhase698ArchitectureRecoveryInput,
): Promise<Readonly<Phase698ArchitectureRecoveryReport>> {
  return runEvaluation(input, DEFAULT_DEPENDENCIES);
}

/** Synthetic-only watchdog seam for bounded timeout/fault tests. */
export function runPhase698ArchitectureRecoveryR3ForTest(
  input: RunPhase698ArchitectureRecoveryInput,
  dependencies: Partial<RunnerDependencies>,
): Promise<Readonly<Phase698ArchitectureRecoveryReport>> {
  if (input.authority !== 'synthetic_test') {
    return Promise.reject(new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_TEST_AUTHORITY_INVALID'));
  }
  return runEvaluation(
    input,
    Object.freeze({
      now: dependencies.now ?? DEFAULT_DEPENDENCIES.now,
      setTimer: dependencies.setTimer ?? DEFAULT_DEPENDENCIES.setTimer,
      clearTimer: dependencies.clearTimer ?? DEFAULT_DEPENDENCIES.clearTimer,
      timeoutMs: dependencies.timeoutMs ?? DEFAULT_DEPENDENCIES.timeoutMs,
    }),
  );
}

async function runEvaluation(
  input: RunPhase698ArchitectureRecoveryInput,
  dependencies: RunnerDependencies,
) {
  const normalized = normalizeInput(input);
  const admission = consumePhase698ArchitectureRecoveryAdmissionCapability(
    normalized.admissionCapability,
    normalized.authority,
  );
  const expectedTransport =
    normalized.authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected';
  if (
    normalized.harness.transportAuthority !== expectedTransport ||
    normalized.harness.runMode !== normalized.runMode ||
    normalized.lifecycle.runId !== normalized.runId ||
    (normalized.authority === 'controlled_live' &&
      (normalized.runMode !== 'controlled_live' || normalized.credentialReads !== 3)) ||
    (normalized.authority === 'synthetic_test' &&
      (normalized.runMode === 'controlled_live' || normalized.credentialReads !== 0))
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNTIME_AUTHORITY_INVALID');
  }

  const guards: Phase698ArchitectureRecoveryGuardEntry[] = [];
  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.guardCases) {
    const entry = await runGuard(testCase, normalized.harness, normalized.signal);
    await normalized.lifecycle.appendGuardTerminal(entry);
    guards.push(entry);
  }

  const calls: Phase698ArchitectureRecoveryCallEntry[] = [];
  const rewrites: Phase698ArchitectureRecoveryRewriteEntry[] = [];
  const finals: Phase698ArchitectureRecoveryFinalEntry[] = [];
  const schedule = expectedPhase698ArchitectureRecoveryCallSchedule();
  const callsById = new Map(schedule.map((entry) => [entry.callId, entry]));
  let breaker: 'case_guard' | 'quality_breaker' | 'external_abort' | null = guards.every(
    (entry) => entry.disposition === 'passed',
  )
    ? normalized.signal.aborted
      ? 'external_abort'
      : null
    : 'case_guard';

  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.rewriteCases) {
    const identities = rewriteIdentities(testCase.caseId, callsById);
    if (breaker !== null) {
      for (const identity of identities) {
        const call = createPhase698ArchitectureRecoveryNotStartedEntry(
          identity,
          expectedTransport,
          breaker,
        );
        await normalized.lifecycle.appendCallTerminal(call);
        calls.push(call);
      }
      const rewrite = incompleteRewrite(testCase);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewrites.push(rewrite);
      continue;
    }

    const original = await executeCall({
      identity: identities[0],
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      authority: normalized.authority,
      transportAuthority: expectedTransport,
      signal: normalized.signal,
      dependencies,
    });
    calls.push(original.entry);
    if (!original.result) {
      breaker = breakerFromEntry(original.entry);
      for (const identity of identities.slice(1)) {
        const call = createPhase698ArchitectureRecoveryNotStartedEntry(
          identity,
          expectedTransport,
          breaker,
        );
        await normalized.lifecycle.appendCallTerminal(call);
        calls.push(call);
      }
      const rewrite = incompleteRewrite(testCase);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewrites.push(rewrite);
      continue;
    }

    const candidate = await executeCall({
      identity: identities[1],
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      authority: normalized.authority,
      transportAuthority: expectedTransport,
      signal: normalized.signal,
      dependencies,
    });
    calls.push(candidate.entry);
    if (!candidate.result || candidate.result.phase !== 'rewrite_candidate_model') {
      breaker = breakerFromEntry(candidate.entry);
      const call = createPhase698ArchitectureRecoveryNotStartedEntry(
        identities[2],
        expectedTransport,
        breaker,
      );
      await normalized.lifecycle.appendCallTerminal(call);
      calls.push(call);
      const rewrite = incompleteRewrite(testCase, original.result);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewrites.push(rewrite);
      continue;
    }

    const candidateRetrieval = await executeCall({
      identity: identities[2],
      testCase,
      rewrittenQuery: candidate.result.executedQuery,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      authority: normalized.authority,
      transportAuthority: expectedTransport,
      signal: normalized.signal,
      dependencies,
    });
    calls.push(candidateRetrieval.entry);
    if (!candidateRetrieval.result) breaker = breakerFromEntry(candidateRetrieval.entry);
    const rewrite = buildRewriteEntry(
      testCase,
      original.result,
      candidate.result,
      candidateRetrieval.result,
    );
    await normalized.lifecycle.appendRewriteTerminal(rewrite);
    rewrites.push(rewrite);
  }

  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases) {
    const identity = requireIdentity(`${testCase.caseId}.final_response_model`, callsById);
    if (breaker !== null) {
      const call = createPhase698ArchitectureRecoveryNotStartedEntry(
        identity,
        expectedTransport,
        breaker,
      );
      await normalized.lifecycle.appendCallTerminal(call);
      calls.push(call);
      const final = incompleteFinal(testCase, call.disposition);
      await normalized.lifecycle.appendFinalTerminal(final);
      finals.push(final);
      continue;
    }
    const executed = await executeCall({
      identity,
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      authority: normalized.authority,
      transportAuthority: expectedTransport,
      signal: normalized.signal,
      dependencies,
    });
    calls.push(executed.entry);
    if (!executed.result) breaker = breakerFromEntry(executed.entry);
    const final = buildFinalEntry(testCase, executed.result, executed.entry.disposition);
    await normalized.lifecycle.appendFinalTerminal(final);
    finals.push(final);
  }

  const report = buildPhase698ArchitectureRecoveryReport({
    runId: normalized.runId,
    authority: normalized.authority,
    runMode: normalized.runMode,
    completionMode: 'runtime',
    source: admission.source,
    credentialReads: normalized.credentialReads,
    guardEntries: guards,
    callEntries: calls,
    rewriteEntries: rewrites,
    finalResponseEntries: finals,
  });
  await normalized.lifecycle.appendRunTerminal(report);
  return report;
}

async function runGuard(
  testCase: Phase698Task8GuardCase,
  harness: Phase698ArchitectureRecoveryHarness,
  signal: AbortSignal,
) {
  let result: Phase698ArchitectureRecoveryGuardResult;
  try {
    result = signal.aborted
      ? {
          observedReasonCode: 'external_abort',
          zeroCallVerified: true,
          permissionFailure: false,
          crossOwnerFailure: false,
          credentialFailure: false,
          injectionFailure: false,
        }
      : await harness.runGuard(testCase, signal);
  } catch {
    result = {
      observedReasonCode: 'guard_runtime_invalid',
      zeroCallVerified: true,
      permissionFailure: false,
      crossOwnerFailure: false,
      credentialFailure: false,
      injectionFailure: false,
    };
  }
  const parsed = z
    .object({
      observedReasonCode: SAFE_CODE,
      zeroCallVerified: z.boolean(),
      permissionFailure: z.boolean(),
      crossOwnerFailure: z.boolean(),
      credentialFailure: z.boolean(),
      injectionFailure: z.boolean(),
    })
    .strict()
    .safeParse(result);
  const observed = parsed.success
    ? parsed.data
    : {
        observedReasonCode: 'guard_runtime_invalid',
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      };
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_GUARD_ENTRY_SCHEMA.parse({
    kind: 'guard',
    caseId: testCase.caseId,
    disposition:
      observed.observedReasonCode === testCase.expectedReasonCode &&
      observed.zeroCallVerified &&
      !observed.permissionFailure &&
      !observed.crossOwnerFailure &&
      !observed.credentialFailure &&
      !observed.injectionFailure
        ? 'passed'
        : 'failed',
    expectedReasonCode: testCase.expectedReasonCode,
    ...observed,
  });
}

async function executeCall(
  input: Readonly<{
    identity: Phase698ArchitectureRecoveryCallIdentity;
    testCase: Phase698Task8RewriteCase | Phase698Task8FinalResponseCase;
    rewrittenQuery?: string;
    harness: Phase698ArchitectureRecoveryHarness;
    lifecycle: Phase698ArchitectureRecoveryLifecycle;
    authority: 'synthetic_test' | 'controlled_live';
    transportAuthority: 'synthetic_injected' | 'external_provider';
    signal: AbortSignal;
    dependencies: RunnerDependencies;
  }>,
): Promise<
  Readonly<{
    entry: Phase698ArchitectureRecoveryCallEntry;
    result: Phase698ArchitectureRecoveryCallResult | null;
  }>
> {
  const lifecycle = await input.lifecycle.reserveCall(input.identity);
  const startedAt = input.dependencies.now();
  if (input.signal.aborted) {
    const entry = runnerFailureEntry(input.identity, input.transportAuthority, {
      kind: 'pre_dispatch_abort',
      runnerWire: { reservations: 1, dispatches: 0, harnessReturns: 0, verifiedResults: 0 },
      durationMs: duration(input.dependencies.now() - startedAt),
    });
    await appendTranscript(lifecycle, entry);
    await lifecycle.appendCallPrepared(entry);
    await input.lifecycle.appendCallTerminal(entry);
    return Object.freeze({ entry, result: null });
  }

  await lifecycle.appendRunnerStage('dispatch_started');
  let capability: Phase698ArchitectureRecoveryOutcomeCapability;
  try {
    capability = await withHardTimeout(
      (signal) =>
        input.harness.invokeCall({
          identity: input.identity,
          testCase: input.testCase,
          ...(input.rewrittenQuery === undefined ? {} : { rewrittenQuery: input.rewrittenQuery }),
          signal,
        }),
      input.signal,
      input.dependencies.timeoutMs(input.identity),
      input.dependencies,
    );
  } catch (error) {
    const kind = classifyRunnerFailure(error, input.signal);
    const entry = runnerFailureEntry(input.identity, input.transportAuthority, {
      kind,
      runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 0, verifiedResults: 0 },
      durationMs: duration(input.dependencies.now() - startedAt),
    });
    await appendTranscript(lifecycle, entry);
    await lifecycle.appendCallPrepared(entry);
    await input.lifecycle.appendCallTerminal(entry);
    return Object.freeze({ entry, result: null });
  }

  await lifecycle.appendRunnerStage('harness_returned');
  let outcome: Outcome;
  try {
    outcome = consumeOutcome(capability, input.authority, input.identity);
  } catch {
    const entry = runnerFailureEntry(input.identity, input.transportAuthority, {
      kind: 'invalid_outcome',
      runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 0 },
      durationMs: duration(input.dependencies.now() - startedAt),
    });
    await appendTranscript(lifecycle, entry);
    await lifecycle.appendCallPrepared(entry);
    await input.lifecycle.appendCallTerminal(entry);
    return Object.freeze({ entry, result: null });
  }

  const succeeded = outcome.diagnostic.reasonCode === 'applied' && outcome.result !== null;
  const durationMs = duration(input.dependencies.now() - startedAt);
  await appendOutcomeTranscript(lifecycle, outcome);
  const entry = buildOutcomeEntry(
    outcome,
    input.transportAuthority,
    {
      reservations: 1,
      dispatches: 1,
      harnessReturns: 1,
      verifiedResults: succeeded ? 1 : 0,
    },
    durationMs,
  );
  if (succeeded) {
    await lifecycle.appendRunnerStage('verified_result', entry);
  }
  await lifecycle.appendCallPrepared(entry);
  await input.lifecycle.appendCallTerminal(entry);
  return Object.freeze({ entry, result: succeeded ? outcome.result : null });
}

function issueOutcome(
  authority: Outcome['authority'],
  input: Parameters<typeof createPhase698ArchitectureRecoverySyntheticOutcomeForTest>[0],
) {
  const parsed = OUTCOME_INPUT_SCHEMA.safeParse(input);
  if (!parsed.success) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_INVALID');
  const identity = parseIdentity(input.identity);
  const diagnosticStages = input.diagnosticStages.map((stage) =>
    z
      .enum([
        'admission',
        'request_contract',
        'provider_dispatch',
        'provider_response',
        'provider_envelope',
        'runtime_result',
        'rewrite_candidate_projection',
        'rewrite_local_authority',
        'embedding_contract',
        'ranking_contract',
        'stream_event_contract',
        'terminal_ledger',
        'citation_ledger',
        'trace_contract',
        'usage_contract',
        'cost_contract',
        'delivery_contract',
        'call_result_contract',
        'applied',
      ])
      .parse(stage),
  );
  const provisional = buildOutcomeEntry(
    {
      authority,
      identity,
      diagnostic: parsed.data.diagnostic,
      diagnosticStages,
      providerWire: parsed.data.providerWire,
      usage: parsed.data.usage,
      verifiedCostCny: parsed.data.verifiedCostCny,
      result: parsed.data.result,
    },
    authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected',
    {
      reservations: 1,
      dispatches: 1,
      harnessReturns: 1,
      verifiedResults:
        parsed.data.diagnostic.reasonCode === 'applied' && parsed.data.result !== null ? 1 : 0,
    },
    0,
  );
  const outcome: Outcome = deepFreeze({
    authority,
    identity,
    diagnostic: provisional.diagnostic!,
    diagnosticStages: provisional.diagnosticStages,
    providerWire: provisional.providerWire,
    usage: provisional.usage,
    verifiedCostCny: provisional.verifiedCostCny,
    result: parsed.data.result,
  });
  const capability = Object.freeze({
    version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_VERSION,
  });
  outcomes.set(capability, outcome);
  return capability;
}

function consumeOutcome(
  capability: Phase698ArchitectureRecoveryOutcomeCapability,
  expectedAuthority: Outcome['authority'],
  expectedIdentity: Phase698ArchitectureRecoveryCallIdentity,
) {
  if (
    !isObject(capability) ||
    capability.version !== PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_VERSION ||
    consumedOutcomes.has(capability)
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_INVALID');
  }
  const outcome = outcomes.get(capability);
  if (
    !outcome ||
    outcome.authority !== expectedAuthority ||
    outcome.identity.callId !== expectedIdentity.callId
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_OUTCOME_CAPABILITY_INVALID');
  }
  consumedOutcomes.add(capability);
  return outcome;
}

function buildOutcomeEntry(
  outcome: Outcome,
  transportAuthority: 'synthetic_injected' | 'external_provider',
  runnerWire: Phase698ArchitectureRecoveryCallEntry['runnerWire'],
  durationMs: number,
) {
  const applied = outcome.diagnostic.reasonCode === 'applied';
  const failureReason = applied ? null : failureReasonForDiagnostic(outcome.diagnostic);
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...outcome.identity,
    transportAuthority,
    disposition: applied
      ? 'succeeded'
      : failureReason === 'aborted'
        ? 'aborted'
        : failureReason === 'timeout'
          ? 'timeout'
          : 'failed',
    failureReason,
    runnerWire,
    providerWire: outcome.providerWire,
    diagnosticStages: outcome.diagnosticStages,
    diagnostic: outcome.diagnostic,
    usage: outcome.usage,
    verifiedCostCny: outcome.verifiedCostCny,
    durationMs,
  });
}

function runnerFailureEntry(
  identity: Phase698ArchitectureRecoveryCallIdentity,
  transportAuthority: 'synthetic_injected' | 'external_provider',
  input: Readonly<{
    kind: 'pre_dispatch_abort' | 'post_dispatch_abort' | 'timeout' | 'invalid_outcome' | 'thrown';
    runnerWire: Phase698ArchitectureRecoveryCallEntry['runnerWire'];
    durationMs: number;
  }>,
) {
  const diagnostic = runnerFailureDiagnostic(identity, input.kind);
  const failureReason: Phase698ArchitectureRecoveryFailureReason =
    input.kind === 'pre_dispatch_abort' || input.kind === 'post_dispatch_abort'
      ? 'aborted'
      : input.kind === 'timeout'
        ? 'timeout'
        : 'runtime_contract_invalid';
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...identity,
    transportAuthority,
    disposition:
      failureReason === 'aborted' ? 'aborted' : failureReason === 'timeout' ? 'timeout' : 'failed',
    failureReason,
    runnerWire: input.runnerWire,
    providerWire: { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    diagnosticStages: diagnostic.stages,
    diagnostic: diagnostic.terminal,
    usage: null,
    verifiedCostCny: null,
    durationMs: input.durationMs,
  });
}

function runnerFailureDiagnostic(
  identity: Phase698ArchitectureRecoveryCallIdentity,
  kind: 'pre_dispatch_abort' | 'post_dispatch_abort' | 'timeout' | 'invalid_outcome' | 'thrown',
) {
  const preDispatch = kind === 'pre_dispatch_abort';
  const timeoutOrAbort = kind === 'timeout' || kind === 'post_dispatch_abort';
  const stages = preDispatch
    ? []
    : timeoutOrAbort
      ? ['admission', 'request_contract', 'provider_dispatch']
      : ['admission', 'request_contract'];
  const stage = preDispatch
    ? 'admission'
    : timeoutOrAbort
      ? 'provider_response'
      : 'provider_dispatch';
  const reasonCode = preDispatch
    ? 'aborted_before_dispatch'
    : kind === 'post_dispatch_abort'
      ? 'aborted_after_dispatch'
      : kind === 'timeout'
        ? 'timeout'
        : 'unknown';
  const terminal = PHASE_6_9_8_ARCHITECTURE_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.parse({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase: identity.phase,
    stage,
    reasonCode,
    providerBoundary: preDispatch ? 'not_dispatched' : 'unknown',
    topLevelTypeBucket: 'not_observed',
    fieldCountBucket: 'not_observed',
    terminalCountBucket: identity.phase === 'final_response_model' ? 'unknown' : 'not_applicable',
    rawDataRetained: false,
  });
  return deepFreeze({ stages, terminal });
}

async function appendTranscript(
  lifecycle: Phase698ArchitectureRecoveryCallLifecycle,
  entry: Phase698ArchitectureRecoveryCallEntry,
) {
  const diagnostic = entry.diagnostic;
  if (!diagnostic) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_MISSING');
  const terminal = Object.freeze({
    diagnostic,
    diagnosticStages: entry.diagnosticStages,
    providerWire: entry.providerWire,
  });
  const applied = diagnostic.stage === 'applied' && diagnostic.reasonCode === 'applied';
  const nonTerminalStages = applied ? entry.diagnosticStages.slice(0, -1) : entry.diagnosticStages;
  for (const stage of nonTerminalStages) {
    await lifecycle.appendDiagnosticStage('started', stage);
    await lifecycle.appendDiagnosticStage('succeeded', stage);
  }
  await lifecycle.appendDiagnosticStage('started', diagnostic.stage);
  await lifecycle.appendDiagnosticStage(
    applied ? 'succeeded' : 'failed',
    diagnostic.stage,
    terminal,
  );
}

async function appendOutcomeTranscript(
  lifecycle: Phase698ArchitectureRecoveryCallLifecycle,
  outcome: Outcome,
) {
  const terminal = Object.freeze({
    diagnostic: outcome.diagnostic,
    diagnosticStages: outcome.diagnosticStages,
    providerWire: outcome.providerWire,
  });
  const applied =
    outcome.diagnostic.stage === 'applied' && outcome.diagnostic.reasonCode === 'applied';
  const nonTerminalStages = applied
    ? outcome.diagnosticStages.slice(0, -1)
    : outcome.diagnosticStages;
  for (const stage of nonTerminalStages) {
    await lifecycle.appendDiagnosticStage('started', stage);
    await lifecycle.appendDiagnosticStage('succeeded', stage);
  }
  await lifecycle.appendDiagnosticStage('started', outcome.diagnostic.stage);
  await lifecycle.appendDiagnosticStage(
    applied ? 'succeeded' : 'failed',
    outcome.diagnostic.stage,
    terminal,
  );
}

function failureReasonForDiagnostic(
  diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic,
): Phase698ArchitectureRecoveryFailureReason {
  switch (diagnostic.reasonCode) {
    case 'aborted_before_dispatch':
    case 'aborted_after_dispatch':
      return 'aborted';
    case 'timeout':
      return 'timeout';
    case 'transport_failure':
    case 'response_not_observed':
      return 'transport';
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
      return diagnostic.reasonCode;
    case 'provider_envelope_invalid':
    case 'stream_event_invalid':
      return 'response_invalid';
    case 'usage_missing':
    case 'usage_invalid':
    case 'dispatch_count_invalid':
    case 'response_count_invalid':
      return 'usage_invalid';
    case 'cost_mismatch':
      return 'budget_exceeded';
    case 'result_shape_invalid':
    case 'phase_mismatch':
      return 'schema_invalid';
    default:
      return 'diagnostic_failed';
  }
}

async function withHardTimeout<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
  dependencies: RunnerDependencies,
) {
  if (parentSignal.aborted) throw new RunnerBoundaryError('post_dispatch_abort');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new RunnerBoundaryError('thrown');
  }
  const controller = new AbortController();
  let rejectAbort: ((reason: unknown) => void) | null = null;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onParentAbort = () => {
    controller.abort();
    rejectAbort?.(new RunnerBoundaryError('post_dispatch_abort'));
  };
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  try {
    timer = dependencies.setTimer(() => {
      controller.abort();
      rejectAbort?.(new RunnerBoundaryError('timeout'));
    }, timeoutMs);
  } catch {
    parentSignal.removeEventListener('abort', onParentAbort);
    controller.abort();
    throw new RunnerBoundaryError('thrown');
  }
  const invoked = Promise.resolve().then(() => invoke(controller.signal));
  void invoked.catch(() => undefined);
  let outcome: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: unknown }>;
  try {
    outcome = Object.freeze({ ok: true, value: await Promise.race([invoked, abortPromise]) });
  } catch (error) {
    outcome = Object.freeze({ ok: false, error });
  }
  let cleanupFailed = false;
  try {
    dependencies.clearTimer(timer);
  } catch {
    cleanupFailed = true;
  }
  parentSignal.removeEventListener('abort', onParentAbort);
  if (cleanupFailed) throw new RunnerBoundaryError('thrown');
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

class RunnerBoundaryError extends Error {
  readonly kind: 'post_dispatch_abort' | 'timeout' | 'thrown';

  constructor(kind: RunnerBoundaryError['kind']) {
    super('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_BOUNDARY');
    this.kind = kind;
  }
}

function classifyRunnerFailure(error: unknown, parentSignal: AbortSignal) {
  if (parentSignal.aborted) return 'post_dispatch_abort' as const;
  if (error instanceof RunnerBoundaryError) return error.kind;
  return 'thrown' as const;
}

function buildRewriteEntry(
  testCase: Phase698Task8RewriteCase,
  original: Phase698ArchitectureRecoveryCallResult | null,
  candidate: Phase698ArchitectureRecoveryCallResult | null,
  candidateRetrieval: Phase698ArchitectureRecoveryCallResult | null,
) {
  if (
    original?.phase !== 'rewrite_original_retrieval' ||
    candidate?.phase !== 'rewrite_candidate_model' ||
    candidateRetrieval?.phase !== 'rewrite_candidate_retrieval'
  ) {
    return incompleteRewrite(
      testCase,
      original?.phase === 'rewrite_original_retrieval' ? original : null,
    );
  }
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: sha256Reference(testCase.originalQuery),
    executedQueryHash: sha256Reference(candidate.executedQuery),
    originalTargetRank: original.targetRank,
    candidateTargetRank: candidateRetrieval.targetRank,
    originalRecallAt5: original.recallAt5,
    originalNdcgAt5: original.ndcgAt5,
    candidateRecallAt5: candidateRetrieval.recallAt5,
    candidateNdcgAt5: candidateRetrieval.ndcgAt5,
    critical: testCase.critical,
    strict: true,
    intentPreserved: candidate.intentPreserved,
    unsafeRewrite: candidate.unsafeRewrite,
    safetyFailure: candidate.unsafeRewrite,
  });
}

function incompleteRewrite(
  testCase: Phase698Task8RewriteCase,
  original?: Phase698ArchitectureRecoveryCallResult | null,
) {
  const retrieval = original?.phase === 'rewrite_original_retrieval' ? original : null;
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: sha256Reference(testCase.originalQuery),
    executedQueryHash: null,
    originalTargetRank: retrieval?.targetRank ?? null,
    candidateTargetRank: null,
    originalRecallAt5: retrieval?.recallAt5 ?? null,
    originalNdcgAt5: retrieval?.ndcgAt5 ?? null,
    candidateRecallAt5: null,
    candidateNdcgAt5: null,
    critical: testCase.critical,
    strict: false,
    intentPreserved: null,
    unsafeRewrite: null,
    safetyFailure: false,
  });
}

function buildFinalEntry(
  testCase: Phase698Task8FinalResponseCase,
  result: Phase698ArchitectureRecoveryCallResult | null,
  disposition: Phase698ArchitectureRecoveryCallEntry['disposition'],
) {
  if (result?.phase !== 'final_response_model') return incompleteFinal(testCase, disposition);
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA.parse({
    kind: 'final_response',
    caseId: testCase.caseId,
    responseTextHash: result.responseTextHash,
    evidenceStatus: testCase.evidenceStatus,
    strict: true,
    terminal: result.terminal,
    terminalCount: result.terminalCount,
    terminalLast: result.terminalLast,
    grounded: result.grounded,
    noticeSatisfied: result.noticeSatisfied,
    requiredCitationCount: result.requiredCitationCount,
    observedCitationCount: result.observedCitationCount,
    citationTruePositiveCount: result.citationTruePositiveCount,
    falseToolSuccess: result.falseToolSuccess,
    falseCitation: result.falseCitation,
    ttftMs: result.ttftMs,
    totalMs: result.totalMs,
    endToEndMs: result.endToEndMs,
    safetyFailure: result.falseToolSuccess || result.falseCitation,
  });
}

function incompleteFinal(
  testCase: Phase698Task8FinalResponseCase,
  disposition: Phase698ArchitectureRecoveryCallEntry['disposition'],
) {
  const attempted = !disposition.startsWith('not_started_');
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_FINAL_ENTRY_SCHEMA.parse({
    kind: 'final_response',
    caseId: testCase.caseId,
    responseTextHash: null,
    evidenceStatus: testCase.evidenceStatus,
    strict: false,
    terminal: attempted ? (disposition === 'aborted' ? 'aborted' : 'response_failed') : null,
    terminalCount: attempted ? 1 : 0,
    terminalLast: attempted,
    grounded: null,
    noticeSatisfied: null,
    requiredCitationCount: null,
    observedCitationCount: null,
    citationTruePositiveCount: null,
    falseToolSuccess: null,
    falseCitation: null,
    ttftMs: null,
    totalMs: null,
    endToEndMs: null,
    safetyFailure: false,
  });
}

function rewriteIdentities(
  caseId: string,
  calls: ReadonlyMap<string, Phase698ArchitectureRecoveryCallIdentity>,
) {
  return [
    requireIdentity(`${caseId}.rewrite_original_retrieval`, calls),
    requireIdentity(`${caseId}.rewrite_candidate_model`, calls),
    requireIdentity(`${caseId}.rewrite_candidate_retrieval`, calls),
  ] as const;
}

function requireIdentity(
  callId: string,
  calls: ReadonlyMap<string, Phase698ArchitectureRecoveryCallIdentity>,
) {
  const value = calls.get(callId);
  if (!value) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_SCHEDULE_INVALID');
  return value;
}

function parseIdentity(value: unknown): Phase698ArchitectureRecoveryCallIdentity {
  if (!isObject(value)) throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_IDENTITY_INVALID');
  const callId = readOwnData(value, 'callId');
  const expected = expectedPhase698ArchitectureRecoveryCallSchedule().find(
    (entry) => entry.callId === callId,
  );
  if (
    !expected ||
    readOwnData(value, 'caseId') !== expected.caseId ||
    readOwnData(value, 'phase') !== expected.phase ||
    readOwnData(value, 'provider') !== expected.provider ||
    readOwnData(value, 'model') !== expected.model ||
    readOwnData(value, 'priceProfile') !== expected.priceProfile
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_IDENTITY_INVALID');
  }
  return expected;
}

function breakerFromEntry(entry: Phase698ArchitectureRecoveryCallEntry) {
  return entry.disposition === 'aborted' || entry.disposition === 'not_started_external_abort'
    ? ('external_abort' as const)
    : ('quality_breaker' as const);
}

function timeoutForPhase(phase: Phase698ArchitectureRecoveryCallIdentity['phase']) {
  if (phase === 'rewrite_candidate_model') {
    return PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.deepseek.rewrite.hardTimeoutMs;
  }
  if (phase === 'final_response_model') {
    return PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.deepseek.finalResponse.hardTimeoutMs;
  }
  return PHASE_6_9_8_ARCHITECTURE_RECOVERY_EVAL_POLICY.qwen.hardTimeoutMs;
}

function normalizeInput(input: RunPhase698ArchitectureRecoveryInput) {
  if (
    !input ||
    !UUID.safeParse(input.runId).success ||
    (input.authority !== 'synthetic_test' && input.authority !== 'controlled_live') ||
    !['synthetic_fault', 'reviewed_mock', 'controlled_live'].includes(input.runMode) ||
    !Number.isSafeInteger(input.credentialReads) ||
    input.credentialReads < 0 ||
    input.credentialReads > 3 ||
    !isNativeAbortSignal(input.signal) ||
    !input.harness ||
    typeof input.harness.runGuard !== 'function' ||
    typeof input.harness.invokeCall !== 'function' ||
    !input.lifecycle ||
    typeof input.lifecycle.appendGuardTerminal !== 'function' ||
    typeof input.lifecycle.reserveCall !== 'function' ||
    typeof input.lifecycle.appendCallTerminal !== 'function' ||
    typeof input.lifecycle.appendRewriteTerminal !== 'function' ||
    typeof input.lifecycle.appendFinalTerminal !== 'function' ||
    typeof input.lifecycle.appendRunTerminal !== 'function'
  ) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_INPUT_INVALID');
  }
  return input;
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function duration(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURATION_INVALID');
  }
  return Number(value.toFixed(3));
}

function sha256Reference(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function readOwnData(value: object, key: string): unknown {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? (descriptor.value as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
