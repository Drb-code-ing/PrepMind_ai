import { z } from 'zod';

import {
  RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  RETRIEVER_SCHEMA_RECOVERY_STAGES,
} from '../model-candidates/retriever-schema-recovery-contract.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY,
  buildPhase698RetrieverSchemaRecoverySr3Report,
  canonicalPhase698RetrieverSchemaRecoverySr3Json,
  expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule,
  sha256Phase698RetrieverSchemaRecoverySr3,
  type Phase698RetrieverSchemaRecoverySr3Diagnostic,
  type Phase698RetrieverSchemaRecoverySr3FailureReason,
  type Phase698RetrieverSchemaRecoverySr3FinalResponseCase,
  type Phase698RetrieverSchemaRecoverySr3GuardCase,
  type Phase698RetrieverSchemaRecoverySr3GuardEntry,
  type Phase698RetrieverSchemaRecoverySr3LaneEntry,
  type Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  type Phase698RetrieverSchemaRecoverySr3LanePhase,
  type Phase698RetrieverSchemaRecoverySr3LaneStage,
  type Phase698RetrieverSchemaRecoverySr3Report,
  type Phase698RetrieverSchemaRecoverySr3RewriteCase,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import {
  consumePhase698RetrieverSchemaRecoverySr3AdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr3AdmissionCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

const UUID = z.string().uuid();
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const SAFE_REFERENCE = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();

const REWRITE_OUTCOME_SCHEMA = z
  .object({
    phase: z.literal('rewrite_candidate_model'),
    schemaStage: z.enum(RETRIEVER_SCHEMA_RECOVERY_STAGES),
    schemaDisposition: z.enum(['canonical', 'extensions_discarded']),
    schemaDiagnostic: RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.nullable(),
    executedQueryHash: SAFE_REFERENCE,
    usage: USAGE_SCHEMA,
    verifiedCostCny: z.number().nonnegative().finite(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.schemaDisposition === 'extensions_discarded' &&
      value.schemaDiagnostic?.reasonCode !== 'extension_fields_discarded'
    ) {
      context.addIssue({ code: 'custom', message: 'extension diagnostic missing' });
    }
    if (value.schemaDisposition === 'canonical' && value.schemaDiagnostic !== null) {
      context.addIssue({ code: 'custom', message: 'canonical diagnostic must be null' });
    }
  });

const FINAL_OUTCOME_SCHEMA = z
  .object({
    phase: z.literal('final_response_model'),
    responseTextHash: SAFE_REFERENCE,
    terminal: z.literal('response_completed'),
    terminalCount: z.literal(1),
    terminalLast: z.literal(true),
    usage: USAGE_SCHEMA,
    verifiedCostCny: z.number().nonnegative().finite(),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr3GuardResult = Readonly<{
  observedReasonCode: string;
  zeroCallVerified: boolean;
  permissionFailure: boolean;
  crossOwnerFailure: boolean;
  credentialFailure: boolean;
  injectionFailure: boolean;
}>;

export type Phase698RetrieverSchemaRecoverySr3LaneOutcome =
  z.infer<typeof REWRITE_OUTCOME_SCHEMA> | z.infer<typeof FINAL_OUTCOME_SCHEMA>;

export type Phase698RetrieverSchemaRecoverySr3Harness = Readonly<{
  transportAuthority: 'synthetic_injected';
  runGuard(
    testCase: Phase698RetrieverSchemaRecoverySr3GuardCase,
    signal: AbortSignal,
  ): Promise<Phase698RetrieverSchemaRecoverySr3GuardResult>;
  invokeLane(
    input: Readonly<{
      identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity;
      testCase:
        | Phase698RetrieverSchemaRecoverySr3RewriteCase
        | Phase698RetrieverSchemaRecoverySr3FinalResponseCase;
      signal: AbortSignal;
    }>,
  ): Promise<Phase698RetrieverSchemaRecoverySr3LaneOutcome>;
}>;

export type Phase698RetrieverSchemaRecoverySr3LaneLifecycle = Readonly<{
  appendLaneStage(
    stage: Phase698RetrieverSchemaRecoverySr3LaneStage,
    preparedSuccess?: Phase698RetrieverSchemaRecoverySr3LaneEntry,
  ): Promise<void>;
}>;

export type Phase698RetrieverSchemaRecoverySr3Lifecycle = Readonly<{
  runId: string;
  appendGuardTerminal(entry: Phase698RetrieverSchemaRecoverySr3GuardEntry): Promise<void>;
  reserveLane(
    identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  ): Promise<Phase698RetrieverSchemaRecoverySr3LaneLifecycle>;
  appendLaneTerminal(entry: Phase698RetrieverSchemaRecoverySr3LaneEntry): Promise<void>;
  appendRunTerminal(report: Phase698RetrieverSchemaRecoverySr3Report): Promise<void>;
}>;

export type RunPhase698RetrieverSchemaRecoverySr3Input = Readonly<{
  runId: string;
  runMode: 'reviewed_mock' | 'synthetic_fault';
  admissionCapability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability;
  harness: Phase698RetrieverSchemaRecoverySr3Harness;
  lifecycle: Phase698RetrieverSchemaRecoverySr3Lifecycle;
  signal: AbortSignal;
}>;

export class Phase698RetrieverSchemaRecoverySr3RuntimeError extends Error {
  constructor(
    readonly reason: Phase698RetrieverSchemaRecoverySr3FailureReason,
    readonly diagnostic: Phase698RetrieverSchemaRecoverySr3Diagnostic | null = null,
  ) {
    super(`PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_${reason.toUpperCase()}`);
    this.name = 'Phase698RetrieverSchemaRecoverySr3RuntimeError';
  }
}

type RunnerDependencies = Readonly<{
  now(): number;
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  timeoutMs(phase: Phase698RetrieverSchemaRecoverySr3LanePhase): number;
}>;

const DEFAULT_DEPENDENCIES: RunnerDependencies = Object.freeze({
  now: () => performance.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
  timeoutMs: (phase) => (phase === 'rewrite_candidate_model' ? 3_500 : 15_000),
});

export function runPhase698RetrieverSchemaRecoverySr3(
  input: RunPhase698RetrieverSchemaRecoverySr3Input,
): Promise<Readonly<Phase698RetrieverSchemaRecoverySr3Report>> {
  return runEvaluation(input, DEFAULT_DEPENDENCIES);
}

/** Synthetic-only clock/watchdog seam. */
export function runPhase698RetrieverSchemaRecoverySr3ForTest(
  input: RunPhase698RetrieverSchemaRecoverySr3Input,
  dependencies: Partial<RunnerDependencies> = {},
): Promise<Readonly<Phase698RetrieverSchemaRecoverySr3Report>> {
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

export function createPhase698RetrieverSchemaRecoverySr3NoopLifecycleForTest(
  runId: string,
): Phase698RetrieverSchemaRecoverySr3Lifecycle {
  UUID.parse(runId);
  return Object.freeze({
    runId,
    appendGuardTerminal: async () => undefined,
    reserveLane: async () => Object.freeze({ appendLaneStage: async () => undefined }),
    appendLaneTerminal: async () => undefined,
    appendRunTerminal: async () => undefined,
  });
}

/** Deterministic reviewed Mock used only by SR3 zero-provider checks. */
export function createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest(): Phase698RetrieverSchemaRecoverySr3Harness {
  return Object.freeze({
    transportAuthority: 'synthetic_injected' as const,
    async runGuard(testCase) {
      return Object.freeze({
        observedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      });
    },
    async invokeLane({ identity }) {
      const usage =
        identity.phase === 'rewrite_candidate_model'
          ? { inputTokens: 240, outputTokens: 120 }
          : { inputTokens: 1_100, outputTokens: 480 };
      const verifiedCostCny = Number(
        (usage.inputTokens * 0.0000003 + usage.outputTokens * 0.0000012).toFixed(9),
      );
      if (identity.phase === 'rewrite_candidate_model') {
        return Object.freeze({
          phase: identity.phase,
          schemaStage: 'rewrite_projection' as const,
          schemaDisposition: 'canonical' as const,
          schemaDiagnostic: null,
          executedQueryHash: `sha256:${'1'.repeat(64)}`,
          usage,
          verifiedCostCny,
        });
      }
      return Object.freeze({
        phase: identity.phase,
        responseTextHash: `sha256:${'2'.repeat(64)}`,
        terminal: 'response_completed' as const,
        terminalCount: 1 as const,
        terminalLast: true as const,
        usage,
        verifiedCostCny,
      });
    },
  });
}

async function runEvaluation(
  input: RunPhase698RetrieverSchemaRecoverySr3Input,
  dependencies: RunnerDependencies,
) {
  const normalized = normalizeInput(input);
  const admission = consumePhase698RetrieverSchemaRecoverySr3AdmissionCapability(
    normalized.admissionCapability,
    'zero_provider',
  );
  if (
    !['synthetic_fixture', 'git_verified'].includes(admission.source.admissionAuthority) ||
    normalized.harness.transportAuthority !== 'synthetic_injected' ||
    normalized.lifecycle.runId !== normalized.runId
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY_INVALID');
  }

  const guardEntries: Phase698RetrieverSchemaRecoverySr3GuardEntry[] = [];
  for (const testCase of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.guardCases) {
    const entry = await runGuard(testCase, normalized.harness, normalized.signal);
    await normalized.lifecycle.appendGuardTerminal(entry);
    guardEntries.push(entry);
  }

  const laneEntries: Phase698RetrieverSchemaRecoverySr3LaneEntry[] = [];
  const schedule = expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule();
  const identityByLaneId = new Map(schedule.map((entry) => [entry.laneId, entry]));
  let breaker: 'case_guard' | 'quality_breaker' | 'external_abort' | null = guardEntries.every(
    (entry) => entry.disposition === 'passed',
  )
    ? normalized.signal.aborted
      ? 'external_abort'
      : null
    : 'case_guard';
  const budget = { inputTokens: 0, outputTokens: 0, costCny: 0 };

  for (let index = 0; index < 6; index += 1) {
    const rewriteCase = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.rewriteCases[index];
    const finalCase = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.finalResponseCases[index];
    if (!rewriteCase || !finalCase) {
      throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_INVALID');
    }
    const pair = [
      {
        identity: requireIdentity(
          `${rewriteCase.caseId}.rewrite_candidate_model`,
          identityByLaneId,
        ),
        testCase: rewriteCase,
      },
      {
        identity: requireIdentity(`${finalCase.caseId}.final_response_model`, identityByLaneId),
        testCase: finalCase,
      },
    ] as const;

    for (const lane of pair) {
      if (breaker !== null) {
        const entry = notStartedLane(lane.identity, breaker);
        await normalized.lifecycle.appendLaneTerminal(entry);
        laneEntries.push(entry);
        continue;
      }
      const executed = await executeLane({
        identity: lane.identity,
        testCase: lane.testCase,
        harness: normalized.harness,
        lifecycle: normalized.lifecycle,
        signal: normalized.signal,
        dependencies,
        budget,
      });
      laneEntries.push(executed);
      if (executed.disposition !== 'succeeded') {
        breaker =
          executed.disposition === 'aborted' ? ('external_abort' as const) : 'quality_breaker';
      }
    }
  }

  const report = buildPhase698RetrieverSchemaRecoverySr3Report({
    runId: normalized.runId,
    completionMode: 'runtime',
    runMode: normalized.runMode,
    source: admission.source,
    guardEntries,
    laneEntries,
  });
  await normalized.lifecycle.appendRunTerminal(report);
  return report;
}

async function runGuard(
  testCase: Phase698RetrieverSchemaRecoverySr3GuardCase,
  harness: Phase698RetrieverSchemaRecoverySr3Harness,
  signal: AbortSignal,
) {
  let raw: unknown;
  try {
    raw = signal.aborted
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
    raw = {
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
    .safeParse(raw);
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
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_GUARD_ENTRY_SCHEMA.parse({
    kind: 'guard',
    caseId: testCase.caseId,
    expectedReasonCode: testCase.expectedReasonCode,
    disposition:
      observed.observedReasonCode === testCase.expectedReasonCode &&
      observed.zeroCallVerified &&
      !observed.permissionFailure &&
      !observed.crossOwnerFailure &&
      !observed.credentialFailure &&
      !observed.injectionFailure
        ? 'passed'
        : 'failed',
    ...observed,
  });
}

async function executeLane(input: {
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity;
  testCase:
    | Phase698RetrieverSchemaRecoverySr3RewriteCase
    | Phase698RetrieverSchemaRecoverySr3FinalResponseCase;
  harness: Phase698RetrieverSchemaRecoverySr3Harness;
  lifecycle: Phase698RetrieverSchemaRecoverySr3Lifecycle;
  signal: AbortSignal;
  dependencies: RunnerDependencies;
  budget: { inputTokens: number; outputTokens: number; costCny: number };
}): Promise<Phase698RetrieverSchemaRecoverySr3LaneEntry> {
  const laneLifecycle = await input.lifecycle.reserveLane(input.identity);
  const wire = { reservations: 1, dispatches: 0, responses: 0, verifiedUsage: 0 };
  const startedAt = input.dependencies.now();
  await laneLifecycle.appendLaneStage('dispatch_started');
  wire.dispatches = 1;

  let raw: unknown;
  try {
    raw = await withHardTimeout(
      (signal) =>
        input.harness.invokeLane({
          identity: input.identity,
          testCase: input.testCase,
          signal,
        }),
      input.signal,
      input.dependencies.timeoutMs(input.identity.phase),
      input.dependencies,
    );
  } catch (error) {
    const failed = failureLane(
      input.identity,
      wire,
      duration(input.dependencies.now() - startedAt),
      error,
    );
    await input.lifecycle.appendLaneTerminal(failed);
    return failed;
  }

  await laneLifecycle.appendLaneStage('response_observed');
  wire.responses = 1;
  let outcome: Phase698RetrieverSchemaRecoverySr3LaneOutcome;
  try {
    outcome = parseLaneOutcome(input.identity.phase, raw);
  } catch (error) {
    const failed = failureLane(
      input.identity,
      wire,
      duration(input.dependencies.now() - startedAt),
      error,
    );
    await input.lifecycle.appendLaneTerminal(failed);
    return failed;
  }

  wire.verifiedUsage = 1;
  const nextBudget = {
    inputTokens: input.budget.inputTokens + outcome.usage.inputTokens,
    outputTokens: input.budget.outputTokens + outcome.usage.outputTokens,
    costCny: Number((input.budget.costCny + outcome.verifiedCostCny).toFixed(9)),
  };
  if (
    nextBudget.inputTokens >
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.inputTokensMax ||
    nextBudget.outputTokens >
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.outputTokensMax ||
    nextBudget.costCny > PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.budget.totalCostCnyMax
  ) {
    const failed = failureLane(
      input.identity,
      wire,
      duration(input.dependencies.now() - startedAt),
      new Phase698RetrieverSchemaRecoverySr3RuntimeError('budget'),
      outcome,
    );
    await laneLifecycle.appendLaneStage('usage_verified');
    await input.lifecycle.appendLaneTerminal(failed);
    return failed;
  }

  const succeeded = successLane(
    input.identity,
    outcome,
    wire,
    duration(input.dependencies.now() - startedAt),
  );
  await laneLifecycle.appendLaneStage('usage_verified', succeeded);
  await input.lifecycle.appendLaneTerminal(succeeded);
  Object.assign(input.budget, nextBudget);
  return succeeded;
}

function successLane(
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  outcome: Phase698RetrieverSchemaRecoverySr3LaneOutcome,
  wire: { reservations: number; dispatches: number; responses: number; verifiedUsage: number },
  durationMs: number,
) {
  const resultDigest = `sha256:${sha256Phase698RetrieverSchemaRecoverySr3(
    canonicalPhase698RetrieverSchemaRecoverySr3Json(outcome),
  )}`;
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse({
    kind: 'candidate_lane',
    ...identity,
    transportAuthority: 'synthetic_injected',
    disposition: 'succeeded',
    failureReason: null,
    wire,
    schemaStage:
      outcome.phase === 'rewrite_candidate_model' ? outcome.schemaStage : 'final_response_stream',
    schemaDisposition:
      outcome.phase === 'rewrite_candidate_model'
        ? outcome.schemaDisposition
        : ('not_applicable' as const),
    schemaDiagnostic: outcome.phase === 'rewrite_candidate_model' ? outcome.schemaDiagnostic : null,
    usage: outcome.usage,
    verifiedCostCny: outcome.verifiedCostCny,
    durationMs,
    resultDigest,
  });
}

function failureLane(
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  wire: { reservations: number; dispatches: number; responses: number; verifiedUsage: number },
  durationMs: number,
  error: unknown,
  verifiedOutcome?: Phase698RetrieverSchemaRecoverySr3LaneOutcome,
) {
  const reason = classifyFailure(error);
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse({
    kind: 'candidate_lane',
    ...identity,
    transportAuthority: 'synthetic_injected',
    disposition: reason === 'aborted' ? 'aborted' : reason === 'timeout' ? 'timeout' : 'failed',
    failureReason: reason,
    wire,
    schemaStage:
      reason === 'schema'
        ? error instanceof Phase698RetrieverSchemaRecoverySr3RuntimeError
          ? (error.diagnostic?.stage ?? 'projected_schema')
          : 'projected_schema'
        : null,
    schemaDisposition: reason === 'schema' ? 'rejected' : null,
    schemaDiagnostic:
      error instanceof Phase698RetrieverSchemaRecoverySr3RuntimeError ? error.diagnostic : null,
    usage: wire.verifiedUsage === 1 ? (verifiedOutcome?.usage ?? null) : null,
    verifiedCostCny: wire.verifiedUsage === 1 ? (verifiedOutcome?.verifiedCostCny ?? null) : null,
    durationMs,
    resultDigest: null,
  });
}

function notStartedLane(
  identity: Phase698RetrieverSchemaRecoverySr3LaneIdentity,
  breaker: 'case_guard' | 'quality_breaker' | 'external_abort',
) {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_LANE_ENTRY_SCHEMA.parse({
    kind: 'candidate_lane',
    ...identity,
    transportAuthority: 'synthetic_injected',
    disposition:
      breaker === 'case_guard'
        ? 'not_started_case_guard'
        : breaker === 'external_abort'
          ? 'not_started_external_abort'
          : 'not_started_quality_breaker',
    failureReason:
      breaker === 'case_guard'
        ? 'case_guard'
        : breaker === 'external_abort'
          ? 'aborted'
          : 'quality_breaker',
    wire: { reservations: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    schemaStage: null,
    schemaDisposition: null,
    schemaDiagnostic: null,
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
    resultDigest: null,
  });
}

function parseLaneOutcome(
  phase: Phase698RetrieverSchemaRecoverySr3LanePhase,
  value: unknown,
): Phase698RetrieverSchemaRecoverySr3LaneOutcome {
  const parsed = (
    phase === 'rewrite_candidate_model' ? REWRITE_OUTCOME_SCHEMA : FINAL_OUTCOME_SCHEMA
  ).safeParse(value);
  if (!parsed.success || parsed.data.phase !== phase) {
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('schema');
  }
  return parsed.data;
}

async function withHardTimeout<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
  dependencies: RunnerDependencies,
): Promise<T> {
  if (parentSignal.aborted) {
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('aborted');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('runtime_contract');
  }
  const controller = new AbortController();
  let rejectAbort: ((reason: unknown) => void) | null = null;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onParentAbort = () => {
    controller.abort();
    rejectAbort?.(new Phase698RetrieverSchemaRecoverySr3RuntimeError('aborted'));
  };
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  try {
    timer = dependencies.setTimer(() => {
      controller.abort();
      rejectAbort?.(new Phase698RetrieverSchemaRecoverySr3RuntimeError('timeout'));
    }, timeoutMs);
  } catch {
    parentSignal.removeEventListener('abort', onParentAbort);
    controller.abort();
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('runtime_contract');
  }
  const invoked = Promise.resolve().then(() => invoke(controller.signal));
  void invoked.catch(() => undefined);
  let outcome: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: unknown }>;
  try {
    outcome = Object.freeze({
      ok: true as const,
      value: await Promise.race([invoked, abortPromise]),
    });
  } catch (error) {
    outcome = Object.freeze({ ok: false as const, error });
  }
  let cleanupFailed = false;
  try {
    dependencies.clearTimer(timer);
  } catch {
    cleanupFailed = true;
  }
  parentSignal.removeEventListener('abort', onParentAbort);
  if (cleanupFailed) {
    controller.abort();
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('runtime_contract');
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

function classifyFailure(error: unknown): Phase698RetrieverSchemaRecoverySr3FailureReason {
  if (error instanceof Phase698RetrieverSchemaRecoverySr3RuntimeError) return error.reason;
  return 'transport';
}

function requireIdentity(
  laneId: string,
  identities: ReadonlyMap<string, Phase698RetrieverSchemaRecoverySr3LaneIdentity>,
) {
  const identity = identities.get(laneId);
  if (!identity) throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SCHEDULE_INVALID');
  return identity;
}

function duration(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Phase698RetrieverSchemaRecoverySr3RuntimeError('runtime_contract');
  }
  return Number(value.toFixed(3));
}

function normalizeInput(
  input: RunPhase698RetrieverSchemaRecoverySr3Input,
): RunPhase698RetrieverSchemaRecoverySr3Input {
  if (
    !input ||
    !UUID.safeParse(input.runId).success ||
    (input.runMode !== 'reviewed_mock' && input.runMode !== 'synthetic_fault') ||
    !isAbortSignal(input.signal) ||
    !input.harness ||
    input.harness.transportAuthority !== 'synthetic_injected' ||
    typeof input.harness.runGuard !== 'function' ||
    typeof input.harness.invokeLane !== 'function' ||
    !input.lifecycle ||
    typeof input.lifecycle.appendGuardTerminal !== 'function' ||
    typeof input.lifecycle.reserveLane !== 'function' ||
    typeof input.lifecycle.appendLaneTerminal !== 'function' ||
    typeof input.lifecycle.appendRunTerminal !== 'function'
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_RUNNER_INPUT_INVALID');
  }
  return input;
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}
