import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_EVAL_POLICY,
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA,
  buildPhase698Task9Report,
  expectedPhase698Task9CallSchedule,
  type Phase698Task9CallEntry,
  type Phase698Task9CallIdentity,
  type Phase698Task9CallPhase,
  type Phase698Task9FailureReason,
  type Phase698Task9FinalEntry,
  type Phase698Task9GuardEntry,
  type Phase698Task9Report,
  type Phase698Task9RewriteEntry,
  type Phase698Task9WireStage,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';
import type {
  Phase698Task8FinalResponseCase,
  Phase698Task8GuardCase,
  Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  consumePhase698Task9AdmissionCapability,
  type Phase698Task9AdmissionCapability,
} from './phase-6-9-8-retriever-final-response-task9-source-admission.ts';

const UUID = z.string().uuid();
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();
const COMMON_RESULT = {
  usage: USAGE_SCHEMA,
  verifiedCostCny: z.number().nonnegative().finite(),
} as const;
const RETRIEVAL_RESULT_SCHEMA = z
  .object({
    ...COMMON_RESULT,
    phase: z.enum(['rewrite_original_retrieval', 'rewrite_candidate_retrieval']),
    targetRank: z.number().int().min(1).max(8).nullable(),
    recallAt5: z.number().min(0).max(1),
    ndcgAt5: z.number().min(0).max(1),
  })
  .strict();
const REWRITE_RESULT_SCHEMA = z
  .object({
    ...COMMON_RESULT,
    phase: z.literal('rewrite_candidate_model'),
    executedQuery: z.string().min(1).max(2_000),
    intentPreserved: z.boolean(),
    unsafeRewrite: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.executedQuery !== value.executedQuery.trim()) {
      context.addIssue({ code: 'custom', message: 'executed query is not canonical' });
    }
  });
const FINAL_RESULT_SCHEMA = z
  .object({
    ...COMMON_RESULT,
    phase: z.literal('final_response_model'),
    responseTextHash: z.string().regex(/^sha256:[0-9a-f]{64}$/u),
    terminal: z.literal('response_completed'),
    terminalCount: z.literal(1),
    terminalLast: z.literal(true),
    grounded: z.boolean(),
    noticeSatisfied: z.boolean(),
    requiredCitationCount: z.number().int().nonnegative(),
    observedCitationCount: z.number().int().nonnegative(),
    citationTruePositiveCount: z.number().int().nonnegative(),
    falseToolSuccess: z.boolean(),
    falseCitation: z.boolean(),
    ttftMs: z.number().nonnegative().finite(),
    totalMs: z.number().nonnegative().finite(),
    endToEndMs: z.number().nonnegative().finite(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.ttftMs > value.totalMs ||
      value.totalMs > value.endToEndMs ||
      value.citationTruePositiveCount > value.observedCitationCount ||
      value.citationTruePositiveCount > value.requiredCitationCount
    ) {
      context.addIssue({ code: 'custom', message: 'final result prefix mismatch' });
    }
  });

export type Phase698Task9GuardResult = Readonly<{
  observedReasonCode: string;
  zeroCallVerified: boolean;
  permissionFailure: boolean;
  crossOwnerFailure: boolean;
  credentialFailure: boolean;
  injectionFailure: boolean;
}>;

export type Phase698Task9CallResult =
  | z.infer<typeof RETRIEVAL_RESULT_SCHEMA>
  | z.infer<typeof REWRITE_RESULT_SCHEMA>
  | z.infer<typeof FINAL_RESULT_SCHEMA>;

export type Phase698Task9Harness = Readonly<{
  transportAuthority: 'synthetic_injected' | 'external_provider';
  runGuard(
    testCase: Phase698Task8GuardCase,
    signal: AbortSignal,
  ): Promise<Phase698Task9GuardResult>;
  invokeCall(
    input: Readonly<{
      identity: Phase698Task9CallIdentity;
      testCase: Phase698Task8RewriteCase | Phase698Task8FinalResponseCase;
      rewrittenQuery?: string;
      signal: AbortSignal;
    }>,
  ): Promise<Phase698Task9CallResult>;
}>;

export type Phase698Task9CallLifecycle = Readonly<{
  appendWireStage(
    stage: Phase698Task9WireStage,
    preparedSuccess?: Phase698Task9CallEntry,
  ): Promise<void>;
}>;

export type Phase698Task9Lifecycle = Readonly<{
  runId: string;
  appendGuardTerminal(entry: Phase698Task9GuardEntry): Promise<void>;
  reserveCall(identity: Phase698Task9CallIdentity): Promise<Phase698Task9CallLifecycle>;
  appendCallTerminal(entry: Phase698Task9CallEntry): Promise<void>;
  appendRewriteTerminal(entry: Phase698Task9RewriteEntry): Promise<void>;
  appendFinalTerminal(entry: Phase698Task9FinalEntry): Promise<void>;
  appendRunTerminal(report: Phase698Task9Report): Promise<void>;
}>;

export type RunPhase698Task9Input = Readonly<{
  runId: string;
  authority: 'synthetic_test' | 'controlled_live';
  credentialReads: number;
  admissionCapability: Phase698Task9AdmissionCapability;
  harness: Phase698Task9Harness;
  lifecycle: Phase698Task9Lifecycle;
  signal: AbortSignal;
}>;

export class Phase698Task9RuntimeError extends Error {
  readonly reason: Phase698Task9FailureReason;

  constructor(reason: Phase698Task9FailureReason) {
    super(`PHASE_6_9_8_TASK9_${reason.toUpperCase()}`);
    this.name = 'Phase698Task9RuntimeError';
    this.reason = reason;
  }
}

type RunnerDependencies = Readonly<{
  now(): number;
  setTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimer(timer: ReturnType<typeof setTimeout>): void;
  timeoutMs(phase: Phase698Task9CallPhase): number;
}>;

const DEFAULT_DEPENDENCIES: RunnerDependencies = Object.freeze({
  now: () => performance.now(),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer),
  timeoutMs: timeoutForPhase,
});

export function runPhase698Task9(
  input: RunPhase698Task9Input,
): Promise<Readonly<Phase698Task9Report>> {
  return runEvaluation(input, DEFAULT_DEPENDENCIES);
}

/** Synthetic-only watchdog seam. It cannot create or consume a Live source admission. */
export function runPhase698Task9ForTest(
  input: RunPhase698Task9Input,
  dependencies: Partial<RunnerDependencies>,
): Promise<Readonly<Phase698Task9Report>> {
  if (input.authority !== 'synthetic_test') {
    return Promise.reject(new Error('PHASE_6_9_8_TASK9_TEST_AUTHORITY_INVALID'));
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

async function runEvaluation(input: RunPhase698Task9Input, dependencies: RunnerDependencies) {
  const normalized = normalizeInput(input);
  const expectedAdmissionAuthority =
    normalized.authority === 'controlled_live' ? 'controlled_live' : 'synthetic_test';
  const admission = consumePhase698Task9AdmissionCapability(
    normalized.admissionCapability,
    expectedAdmissionAuthority,
  );
  const expectedTransportAuthority =
    normalized.authority === 'controlled_live' ? 'external_provider' : 'synthetic_injected';
  if (
    normalized.harness.transportAuthority !== expectedTransportAuthority ||
    normalized.lifecycle.runId !== normalized.runId ||
    (normalized.authority === 'controlled_live' && normalized.credentialReads !== 3) ||
    (normalized.authority === 'synthetic_test' && normalized.credentialReads !== 0)
  ) {
    throw new Error('PHASE_6_9_8_TASK9_RUNTIME_AUTHORITY_INVALID');
  }

  const guardEntries: Phase698Task9GuardEntry[] = [];
  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.guardCases) {
    const entry = await runGuard(testCase, normalized.harness, normalized.signal);
    await normalized.lifecycle.appendGuardTerminal(entry);
    guardEntries.push(entry);
  }

  const callEntries: Phase698Task9CallEntry[] = [];
  const rewriteEntries: Phase698Task9RewriteEntry[] = [];
  const finalEntries: Phase698Task9FinalEntry[] = [];
  const schedule = expectedPhase698Task9CallSchedule();
  const callsById = new Map(schedule.map((entry) => [entry.callId, entry]));
  let breaker: 'case_guard' | 'quality_breaker' | 'external_abort' | null = guardEntries.every(
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
        const entry = notStartedEntry(identity, expectedTransportAuthority, breaker);
        await normalized.lifecycle.appendCallTerminal(entry);
        callEntries.push(entry);
      }
      const rewrite = incompleteRewrite(testCase);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewriteEntries.push(rewrite);
      continue;
    }

    const original = await executeCall({
      identity: identities[0],
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      transportAuthority: expectedTransportAuthority,
      signal: normalized.signal,
      dependencies,
    });
    callEntries.push(original.entry);
    if (!original.result) {
      breaker = breakerFromEntry(original.entry);
      const remaining = identities
        .slice(1)
        .map((identity) => notStartedEntry(identity, expectedTransportAuthority, breaker!));
      for (const entry of remaining) await normalized.lifecycle.appendCallTerminal(entry);
      callEntries.push(...remaining);
      const rewrite = incompleteRewrite(testCase, original.result);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewriteEntries.push(rewrite);
      continue;
    }

    const candidate = await executeCall({
      identity: identities[1],
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      transportAuthority: expectedTransportAuthority,
      signal: normalized.signal,
      dependencies,
    });
    callEntries.push(candidate.entry);
    if (!candidate.result || candidate.result.phase !== 'rewrite_candidate_model') {
      breaker = breakerFromEntry(candidate.entry);
      const remaining = notStartedEntry(identities[2], expectedTransportAuthority, breaker);
      await normalized.lifecycle.appendCallTerminal(remaining);
      callEntries.push(remaining);
      const rewrite = incompleteRewrite(testCase, original.result);
      await normalized.lifecycle.appendRewriteTerminal(rewrite);
      rewriteEntries.push(rewrite);
      continue;
    }

    const candidateRetrieval = await executeCall({
      identity: identities[2],
      testCase,
      rewrittenQuery: candidate.result.executedQuery,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      transportAuthority: expectedTransportAuthority,
      signal: normalized.signal,
      dependencies,
    });
    callEntries.push(candidateRetrieval.entry);
    if (!candidateRetrieval.result) breaker = breakerFromEntry(candidateRetrieval.entry);
    const rewrite = buildRewriteEntry(
      testCase,
      original.result,
      candidate.result,
      candidateRetrieval.result,
    );
    await normalized.lifecycle.appendRewriteTerminal(rewrite);
    rewriteEntries.push(rewrite);
  }

  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases) {
    const identity = requireIdentity(`${testCase.caseId}.final_response_model`, callsById);
    if (breaker !== null) {
      const call = notStartedEntry(identity, expectedTransportAuthority, breaker);
      await normalized.lifecycle.appendCallTerminal(call);
      callEntries.push(call);
      const final = incompleteFinal(testCase, call.disposition);
      await normalized.lifecycle.appendFinalTerminal(final);
      finalEntries.push(final);
      continue;
    }
    const executed = await executeCall({
      identity,
      testCase,
      harness: normalized.harness,
      lifecycle: normalized.lifecycle,
      transportAuthority: expectedTransportAuthority,
      signal: normalized.signal,
      dependencies,
    });
    callEntries.push(executed.entry);
    if (!executed.result) breaker = breakerFromEntry(executed.entry);
    const final = buildFinalEntry(testCase, executed.result, executed.entry.disposition);
    await normalized.lifecycle.appendFinalTerminal(final);
    finalEntries.push(final);
  }

  const report = buildPhase698Task9Report({
    runId: normalized.runId,
    authority: normalized.authority,
    completionMode: 'runtime',
    source: admission.source,
    credentialReads: normalized.credentialReads,
    guardEntries,
    callEntries,
    rewriteEntries,
    finalResponseEntries: finalEntries,
  });
  await normalized.lifecycle.appendRunTerminal(report);
  return report;
}

async function runGuard(
  testCase: Phase698Task8GuardCase,
  harness: Phase698Task9Harness,
  signal: AbortSignal,
) {
  let result: Phase698Task9GuardResult;
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
  const safe = z
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
  const observed = safe.success
    ? safe.data
    : {
        observedReasonCode: 'guard_runtime_invalid',
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      };
  return PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA.parse({
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

async function executeCall(input: {
  identity: Phase698Task9CallIdentity;
  testCase: Phase698Task8RewriteCase | Phase698Task8FinalResponseCase;
  rewrittenQuery?: string;
  harness: Phase698Task9Harness;
  lifecycle: Phase698Task9Lifecycle;
  transportAuthority: 'synthetic_injected' | 'external_provider';
  signal: AbortSignal;
  dependencies: RunnerDependencies;
}): Promise<Readonly<{ entry: Phase698Task9CallEntry; result: Phase698Task9CallResult | null }>> {
  const lifecycle = await input.lifecycle.reserveCall(input.identity);
  const wire = { attempts: 1, dispatches: 0, responses: 0, verifiedUsage: 0 };
  const startedAt = input.dependencies.now();
  await lifecycle.appendWireStage('dispatch_started');
  wire.dispatches = 1;

  let raw: unknown;
  try {
    raw = await withHardTimeout(
      (signal) =>
        input.harness.invokeCall({
          identity: input.identity,
          testCase: input.testCase,
          ...(input.rewrittenQuery === undefined ? {} : { rewrittenQuery: input.rewrittenQuery }),
          signal,
        }),
      input.signal,
      input.dependencies.timeoutMs(input.identity.phase),
      input.dependencies,
    );
  } catch (error) {
    return terminateRuntimeFailure(input, wire, startedAt, error);
  }

  await lifecycle.appendWireStage('response_received');
  wire.responses = 1;

  let result: Phase698Task9CallResult;
  let candidate: Phase698Task9CallEntry;
  try {
    result = parseCallResult(input.identity.phase, raw);
    const durationMs = duration(input.dependencies.now() - startedAt);
    const parsedCandidate = PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA.safeParse({
      kind: 'provider_call',
      ...input.identity,
      transportAuthority: input.transportAuthority,
      disposition: 'succeeded',
      failureReason: null,
      wire: { ...wire, verifiedUsage: 1 },
      usage: result.usage,
      verifiedCostCny: result.verifiedCostCny,
      durationMs,
    });
    if (!parsedCandidate.success) throw new Phase698Task9RuntimeError('usage_invalid');
    candidate = parsedCandidate.data;
  } catch (error) {
    return terminateRuntimeFailure(input, wire, startedAt, error);
  }

  await lifecycle.appendWireStage('usage_verified', candidate);
  wire.verifiedUsage = 1;
  await input.lifecycle.appendCallTerminal(candidate);
  return Object.freeze({ entry: candidate, result });
}

async function terminateRuntimeFailure(
  input: Pick<
    Parameters<typeof executeCall>[0],
    'identity' | 'transportAuthority' | 'signal' | 'lifecycle' | 'dependencies'
  >,
  wire: Readonly<{
    attempts: number;
    dispatches: number;
    responses: number;
    verifiedUsage: number;
  }>,
  startedAt: number,
  error: unknown,
) {
  const reason = classifyFailure(error, input.signal);
  const entry = PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...input.identity,
    transportAuthority: input.transportAuthority,
    disposition: reason === 'aborted' ? 'aborted' : reason === 'timeout' ? 'timeout' : 'failed',
    failureReason: reason,
    wire,
    usage: null,
    verifiedCostCny: null,
    durationMs: duration(input.dependencies.now() - startedAt),
  });
  await input.lifecycle.appendCallTerminal(entry);
  return Object.freeze({ entry, result: null });
}

function parseCallResult(phase: Phase698Task9CallPhase, value: unknown): Phase698Task9CallResult {
  const schema =
    phase === 'rewrite_candidate_model'
      ? REWRITE_RESULT_SCHEMA
      : phase === 'final_response_model'
        ? FINAL_RESULT_SCHEMA
        : RETRIEVAL_RESULT_SCHEMA;
  const parsed = schema.safeParse(value);
  if (!parsed.success || parsed.data.phase !== phase) {
    throw new Phase698Task9RuntimeError('schema_invalid');
  }
  return parsed.data;
}

async function withHardTimeout<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  parentSignal: AbortSignal,
  timeoutMs: number,
  dependencies: RunnerDependencies,
): Promise<T> {
  if (parentSignal.aborted) throw new Phase698Task9RuntimeError('aborted');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  }
  const controller = new AbortController();
  let rejectAbort: ((reason: unknown) => void) | null = null;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onParentAbort = () => {
    controller.abort();
    rejectAbort?.(new Phase698Task9RuntimeError('aborted'));
  };
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  try {
    timer = dependencies.setTimer(() => {
      controller.abort();
      rejectAbort?.(new Phase698Task9RuntimeError('timeout'));
    }, timeoutMs);
  } catch {
    parentSignal.removeEventListener('abort', onParentAbort);
    controller.abort();
    throw new Phase698Task9RuntimeError('runtime_contract_invalid');
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
  if (cleanupFailed) throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

function buildRewriteEntry(
  testCase: Phase698Task8RewriteCase,
  original: Phase698Task9CallResult | null,
  candidate: Phase698Task9CallResult | null,
  candidateRetrieval: Phase698Task9CallResult | null,
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
  return PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA.parse({
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
  original?: Phase698Task9CallResult | null,
) {
  const retrieval = original?.phase === 'rewrite_original_retrieval' ? original : null;
  return PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA.parse({
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
  result: Phase698Task9CallResult | null,
  disposition: Phase698Task9CallEntry['disposition'],
) {
  if (result?.phase !== 'final_response_model') return incompleteFinal(testCase, disposition);
  return PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA.parse({
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
  disposition: Phase698Task9CallEntry['disposition'],
) {
  const attempted = !disposition.startsWith('not_started_');
  return PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA.parse({
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

function notStartedEntry(
  identity: Phase698Task9CallIdentity,
  transportAuthority: Phase698Task9Harness['transportAuthority'],
  breaker: 'case_guard' | 'quality_breaker' | 'external_abort',
) {
  return PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...identity,
    transportAuthority,
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
    wire: { attempts: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
  });
}

function breakerFromEntry(entry: Phase698Task9CallEntry) {
  return entry.disposition === 'aborted' || entry.disposition === 'not_started_external_abort'
    ? ('external_abort' as const)
    : ('quality_breaker' as const);
}

function rewriteIdentities(caseId: string, calls: ReadonlyMap<string, Phase698Task9CallIdentity>) {
  return [
    requireIdentity(`${caseId}.rewrite_original_retrieval`, calls),
    requireIdentity(`${caseId}.rewrite_candidate_model`, calls),
    requireIdentity(`${caseId}.rewrite_candidate_retrieval`, calls),
  ] as const;
}

function requireIdentity(callId: string, calls: ReadonlyMap<string, Phase698Task9CallIdentity>) {
  const value = calls.get(callId);
  if (!value) throw new Error('PHASE_6_9_8_TASK9_SCHEDULE_INVALID');
  return value;
}

function classifyFailure(error: unknown, parentSignal: AbortSignal): Phase698Task9FailureReason {
  if (parentSignal.aborted) return 'aborted';
  if (error instanceof Phase698Task9RuntimeError) return error.reason;
  return 'transport';
}

function duration(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  }
  return Number(value.toFixed(3));
}

function timeoutForPhase(phase: Phase698Task9CallPhase) {
  if (phase === 'rewrite_candidate_model') {
    return PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.rewrite.hardTimeoutMs;
  }
  if (phase === 'final_response_model') {
    return PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.finalResponse.hardTimeoutMs;
  }
  return PHASE_6_9_8_TASK9_EVAL_POLICY.qwen.hardTimeoutMs;
}

function normalizeInput(input: RunPhase698Task9Input): RunPhase698Task9Input {
  if (
    !input ||
    UUID.safeParse(input.runId).success === false ||
    (input.authority !== 'synthetic_test' && input.authority !== 'controlled_live') ||
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
    throw new Error('PHASE_6_9_8_TASK9_RUNNER_INPUT_INVALID');
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

function sha256Reference(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
