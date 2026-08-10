import { createHash } from 'node:crypto';

import { calculateQwenTextEmbeddingV4CostCny } from '@repo/ai';
import { z } from 'zod';

import {
  calculatePhase698Task9DeepseekCostCny,
  PHASE_6_9_8_TASK9_EVAL_POLICY,
  PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA,
  type Phase698Task9CallEntry,
  type Phase698Task9CallIdentity,
  type Phase698Task9FinalEntry,
  type Phase698Task9GuardEntry,
  type Phase698Task9RewriteEntry,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import {
  Phase698Task9RuntimeError,
  type Phase698Task9CallResult,
  type Phase698Task9GuardResult,
} from './phase-6-9-8-retriever-final-response-task9-runner.ts';
import {
  buildPhase698RetrieverSchemaRecoverySr5LiveReport,
  expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY,
  type Phase698RetrieverSchemaRecoverySr5LiveReport,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-contract.ts';
import {
  consumePhase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-admission.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from './phase-6-9-8-retriever-final-response-manifest.ts';

const UUID = z.string().uuid();
const SAFE_CODE = z.string().regex(/^[a-z0-9_]{1,96}$/u);
const USAGE_SCHEMA = z
  .object({ inputTokens: z.number().int().positive(), outputTokens: z.number().int().nonnegative() })
  .strict();
const RETRIEVAL_RESULT_SCHEMA = z
  .object({
    phase: z.enum(['rewrite_original_retrieval', 'rewrite_candidate_retrieval']),
    targetRank: z.number().int().min(1).max(8).nullable(),
    recallAt5: z.number().min(0).max(1),
    ndcgAt5: z.number().min(0).max(1),
    usage: USAGE_SCHEMA,
    verifiedCostCny: z.number().nonnegative().finite(),
  })
  .strict();
const REWRITE_RESULT_SCHEMA = z
  .object({
    phase: z.literal('rewrite_candidate_model'),
    executedQuery: z.string().min(1).max(2_000),
    intentPreserved: z.boolean(),
    unsafeRewrite: z.boolean(),
    usage: USAGE_SCHEMA,
    verifiedCostCny: z.number().nonnegative().finite(),
  })
  .strict();
const FINAL_RESULT_SCHEMA = z
  .object({
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
    usage: USAGE_SCHEMA,
    verifiedCostCny: z.number().nonnegative().finite(),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr5LiveHarness = Readonly<{
  transportAuthority: 'external_provider' | 'synthetic_injected';
  runGuard(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.guardCases)[number], signal: AbortSignal): Promise<Phase698Task9GuardResult>;
  invokeCall(input: Readonly<{
    identity: Phase698Task9CallIdentity;
    testCase:
      | (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number]
      | (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number];
    rewrittenQuery?: string;
    signal: AbortSignal;
  }>): Promise<Phase698Task9CallResult>;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveCallLifecycle = Readonly<{
  appendWireStage(stage: 'dispatch_started' | 'response_received' | 'usage_verified', preparedSuccess?: Phase698Task9CallEntry): Promise<void>;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveLifecycle = Readonly<{
  runId: string;
  appendGuardTerminal(entry: Phase698RetrieverSchemaRecoverySr5LiveGuardEntry): Promise<void>;
  reserveCall(identity: Phase698Task9CallIdentity): Promise<Phase698RetrieverSchemaRecoverySr5LiveCallLifecycle>;
  appendCallTerminal(entry: Phase698Task9CallEntry): Promise<void>;
  appendRewriteTerminal(entry: Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry): Promise<void>;
  appendFinalTerminal(entry: Phase698RetrieverSchemaRecoverySr5LiveFinalEntry): Promise<void>;
  appendRunTerminal(report: Phase698RetrieverSchemaRecoverySr5LiveReport): Promise<void>;
}>;

export type RunPhase698RetrieverSchemaRecoverySr5LiveInput = Readonly<{
  runId: string;
  repositoryRoot: string;
  admissionAuthority: 'git_verified_live' | 'synthetic_test_live';
  admissionCapability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability;
  harness: Phase698RetrieverSchemaRecoverySr5LiveHarness;
  lifecycle: Phase698RetrieverSchemaRecoverySr5LiveLifecycle;
  signal: AbortSignal;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveGuardEntry = Phase698Task9GuardEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveCallEntry = Phase698Task9CallEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveRewriteEntry = Phase698Task9RewriteEntry;
export type Phase698RetrieverSchemaRecoverySr5LiveFinalEntry = Phase698Task9FinalEntry;

export function runPhase698RetrieverSchemaRecoverySr5ControlledLive(
  input: RunPhase698RetrieverSchemaRecoverySr5LiveInput,
): Promise<Readonly<Phase698RetrieverSchemaRecoverySr5LiveReport>> {
  return runEvaluation(input, false);
}

/** Synthetic harness seam: it never reads credentials or calls a Provider. */
export function runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest(
  input: RunPhase698RetrieverSchemaRecoverySr5LiveInput,
): Promise<Readonly<Phase698RetrieverSchemaRecoverySr5LiveReport>> {
  return runEvaluation(input, true);
}

export function createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(): Phase698RetrieverSchemaRecoverySr5LiveHarness {
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
    async invokeCall(input) {
      const rewrite = input.identity.phase === 'rewrite_candidate_model';
      const retrieval =
        input.identity.phase === 'rewrite_original_retrieval' ||
        input.identity.phase === 'rewrite_candidate_retrieval';
      if (retrieval) {
        const usage = { inputTokens: 128, outputTokens: 0 } as const;
        return Object.freeze({
          phase: input.identity.phase,
          targetRank: 1,
          recallAt5: 1,
          ndcgAt5: 1,
          usage,
          verifiedCostCny: calculateQwenTextEmbeddingV4CostCny(usage.inputTokens),
        });
      }
      if (rewrite) {
        const usage = { inputTokens: 160, outputTokens: 80 } as const;
        return Object.freeze({
          phase: 'rewrite_candidate_model' as const,
          executedQuery: 'controlled synthetic query',
          intentPreserved: true,
          unsafeRewrite: false,
          usage,
          verifiedCostCny: calculatePhase698Task9DeepseekCostCny(
            usage.inputTokens,
            usage.outputTokens,
          ),
        });
      }
      const usage = { inputTokens: 300, outputTokens: 150 } as const;
      return Object.freeze({
        phase: 'final_response_model' as const,
        responseTextHash: `sha256:${'a'.repeat(64)}`,
        terminal: 'response_completed' as const,
        terminalCount: 1 as const,
        terminalLast: true as const,
        grounded: true,
        noticeSatisfied: true,
        requiredCitationCount: 0,
        observedCitationCount: 0,
        citationTruePositiveCount: 0,
        falseToolSuccess: false,
        falseCitation: false,
        ttftMs: 10,
        totalMs: 20,
        endToEndMs: 30,
        usage,
        verifiedCostCny: calculatePhase698Task9DeepseekCostCny(
          usage.inputTokens,
          usage.outputTokens,
        ),
      });
    },
  });
}

async function runEvaluation(
  input: RunPhase698RetrieverSchemaRecoverySr5LiveInput,
  allowSynthetic: boolean,
): Promise<Readonly<Phase698RetrieverSchemaRecoverySr5LiveReport>> {
  normalizeInput(input, allowSynthetic);
  const issued = consumePhase698RetrieverSchemaRecoverySr5LiveAdmissionCapability(
    input.admissionCapability,
    input.admissionAuthority,
    input.repositoryRoot,
  );
  const live = input.admissionAuthority === 'git_verified_live';
  const expectedTransportAuthority = live ? 'external_provider' : 'synthetic_injected';
  const expectedCredentialReads = live ? 3 : 0;
  if (
    issued.externalProviderDispatchAllowed !== live ||
    issued.credentialReadsPlanned !== expectedCredentialReads ||
    input.lifecycle.runId !== input.runId ||
    input.harness.transportAuthority !== expectedTransportAuthority
  ) {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY_INVALID');
  }
  const guards: Phase698Task9GuardEntry[] = [];
  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.guardCases.slice(0, 8)) {
    const entry = await runGuard(testCase, input.harness, input.signal);
    await input.lifecycle.appendGuardTerminal(entry);
    guards.push(entry);
  }
  const schedule = expectedPhase698RetrieverSchemaRecoverySr5LiveCallSchedule();
  const byId = new Map(schedule.map((entry) => [entry.callId, entry]));
  const calls: Phase698Task9CallEntry[] = [];
  const rewrites: Phase698Task9RewriteEntry[] = [];
  const finals: Phase698Task9FinalEntry[] = [];
  let breaker: 'case_guard' | 'quality_breaker' | 'external_abort' | null = guards.every(
    (entry) => entry.disposition === 'passed',
  )
    ? input.signal.aborted
      ? 'external_abort'
      : null
    : 'case_guard';
  const budget = { inputTokens: 0, outputTokens: 0, costCny: 0 };

  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.slice(0, 6)) {
    const identities = [
      requireIdentity(`${testCase.caseId}.rewrite_original_retrieval`, byId),
      requireIdentity(`${testCase.caseId}.rewrite_candidate_model`, byId),
      requireIdentity(`${testCase.caseId}.rewrite_candidate_retrieval`, byId),
    ];
    if (breaker !== null) {
      for (const identity of identities) {
        const entry = notStarted(identity, breaker, input.harness.transportAuthority);
        await input.lifecycle.appendCallTerminal(entry);
        calls.push(entry);
      }
      const incomplete = incompleteRewrite(testCase);
      await input.lifecycle.appendRewriteTerminal(incomplete);
      rewrites.push(incomplete);
      continue;
    }
    const original = await executeCall(input, identities[0], testCase, undefined, budget);
    calls.push(original.entry);
    if (!original.result) {
      breaker = breakerFrom(original.entry);
      for (const identity of identities.slice(1)) {
        const entry = notStarted(identity, breaker, input.harness.transportAuthority);
        await input.lifecycle.appendCallTerminal(entry);
        calls.push(entry);
      }
      const incomplete = incompleteRewrite(testCase, original.result);
      await input.lifecycle.appendRewriteTerminal(incomplete);
      rewrites.push(incomplete);
      continue;
    }
    const candidate = await executeCall(input, identities[1], testCase, undefined, budget);
    calls.push(candidate.entry);
    if (!candidate.result || candidate.result.phase !== 'rewrite_candidate_model') {
      breaker = breakerFrom(candidate.entry);
      const suffix = notStarted(identities[2], breaker, input.harness.transportAuthority);
      await input.lifecycle.appendCallTerminal(suffix);
      calls.push(suffix);
      const incomplete = incompleteRewrite(testCase, original.result);
      await input.lifecycle.appendRewriteTerminal(incomplete);
      rewrites.push(incomplete);
      continue;
    }
    const candidateRetrieval = await executeCall(
      input,
      identities[2],
      testCase,
      candidate.result.executedQuery,
      budget,
    );
    calls.push(candidateRetrieval.entry);
    if (!candidateRetrieval.result) breaker = breakerFrom(candidateRetrieval.entry);
    const rewrite = buildRewrite(testCase, original.result, candidate.result, candidateRetrieval.result);
    await input.lifecycle.appendRewriteTerminal(rewrite);
    rewrites.push(rewrite);
  }

  for (const testCase of PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.slice(0, 6)) {
    const identity = requireIdentity(`${testCase.caseId}.final_response_model`, byId);
    if (breaker !== null) {
      const entry = notStarted(identity, breaker, input.harness.transportAuthority);
      await input.lifecycle.appendCallTerminal(entry);
      calls.push(entry);
      const incomplete = incompleteFinal(testCase, entry.disposition);
      await input.lifecycle.appendFinalTerminal(incomplete);
      finals.push(incomplete);
      continue;
    }
    const executed = await executeCall(input, identity, testCase, undefined, budget);
    calls.push(executed.entry);
    if (!executed.result) breaker = breakerFrom(executed.entry);
    const final = buildFinal(testCase, executed.result, executed.entry.disposition);
    await input.lifecycle.appendFinalTerminal(final);
    finals.push(final);
  }
  const report = buildPhase698RetrieverSchemaRecoverySr5LiveReport({
    runId: input.runId,
    authority: live
      ? PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY
      : PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY,
    completionMode: 'runtime',
    source: issued.source,
    sourceBinding: issued.sourceBinding,
    guardEntries: guards,
    callEntries: calls,
    rewriteEntries: rewrites,
    finalResponseEntries: finals,
  });
  await input.lifecycle.appendRunTerminal(report);
  return report;
}

async function runGuard(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.guardCases)[number], harness: Phase698RetrieverSchemaRecoverySr5LiveHarness, signal: AbortSignal) {
  let value: Phase698Task9GuardResult;
  try {
    value = signal.aborted
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
    value = {
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
    .safeParse(value);
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

async function executeCall(
  input: RunPhase698RetrieverSchemaRecoverySr5LiveInput,
  identity: Phase698Task9CallIdentity,
  testCase:
    | (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number]
    | (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number],
  rewrittenQuery: string | undefined,
  budget: { inputTokens: number; outputTokens: number; costCny: number },
) {
  const lifecycle = await input.lifecycle.reserveCall(identity);
  const wire = { attempts: 1, dispatches: 0, responses: 0, verifiedUsage: 0 };
  const started = performance.now();
  await lifecycle.appendWireStage('dispatch_started');
  wire.dispatches = 1;
  let raw: unknown;
  try {
    raw = await withHardTimeout(
      (signal) =>
        input.harness.invokeCall({
          identity,
          testCase,
          ...(rewrittenQuery === undefined ? {} : { rewrittenQuery }),
          signal,
        }),
      input.signal,
      timeoutFor(identity.phase),
    );
  } catch (error) {
    const entry = failureEntry(
      identity,
      wire,
      duration(performance.now() - started),
      error,
      input.harness.transportAuthority,
    );
    await input.lifecycle.appendCallTerminal(entry);
    return { entry, result: null } as const;
  }
  await lifecycle.appendWireStage('response_received');
  wire.responses = 1;
  let result: Phase698Task9CallResult;
  try {
    result = parseResult(identity.phase, raw);
    const entry = PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA.parse({
      kind: 'provider_call',
      ...identity,
      transportAuthority: input.harness.transportAuthority,
      disposition: 'succeeded',
      failureReason: null,
      wire: { ...wire, verifiedUsage: 1 },
      usage: result.usage,
      verifiedCostCny: result.verifiedCostCny,
      durationMs: duration(performance.now() - started),
    });
    const nextBudget = {
      inputTokens: budget.inputTokens + result.usage.inputTokens,
      outputTokens: budget.outputTokens + result.usage.outputTokens,
      costCny: Number((budget.costCny + result.verifiedCostCny).toFixed(9)),
    };
    if (
      nextBudget.inputTokens > PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxInputTokens ||
      nextBudget.outputTokens > PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxOutputTokens ||
      nextBudget.costCny >
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.maxCostMicrosCny / 1_000_000
    ) {
      const overBudget = failureEntry(
        identity,
        wire,
        duration(performance.now() - started),
        new Phase698Task9RuntimeError('budget_exceeded'),
        input.harness.transportAuthority,
      );
      await input.lifecycle.appendCallTerminal(overBudget);
      return { entry: overBudget, result: null } as const;
    }
    await lifecycle.appendWireStage('usage_verified', entry);
    wire.verifiedUsage = 1;
    await input.lifecycle.appendCallTerminal(entry);
    Object.assign(budget, nextBudget);
    return { entry, result } as const;
  } catch (error) {
    const entry = failureEntry(
      identity,
      wire,
      duration(performance.now() - started),
      error,
      input.harness.transportAuthority,
    );
    await input.lifecycle.appendCallTerminal(entry);
    return { entry, result: null } as const;
  }
}

function parseResult(phase: Phase698Task9CallIdentity['phase'], value: unknown): Phase698Task9CallResult {
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

function failureEntry(
  identity: Phase698Task9CallIdentity,
  wire: Readonly<{ attempts: number; dispatches: number; responses: number; verifiedUsage: number }>,
  durationMs: number,
  error: unknown,
  transportAuthority: 'external_provider' | 'synthetic_injected',
) {
  const reason = classify(error);
  return PHASE_6_9_8_TASK9_CALL_ENTRY_SCHEMA.parse({
    kind: 'provider_call',
    ...identity,
    transportAuthority,
    disposition: reason === 'aborted' ? 'aborted' : reason === 'timeout' ? 'timeout' : 'failed',
    failureReason: reason,
    wire,
    usage: null,
    verifiedCostCny: null,
    durationMs,
  });
}

function buildRewrite(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number], original: Phase698Task9CallResult | null, candidate: Phase698Task9CallResult | null, retrieval: Phase698Task9CallResult | null) {
  if (
    original?.phase !== 'rewrite_original_retrieval' ||
    candidate?.phase !== 'rewrite_candidate_model' ||
    retrieval?.phase !== 'rewrite_candidate_retrieval'
  ) return incompleteRewrite(testCase, original);
  return PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: hashRef(testCase.originalQuery),
    executedQueryHash: hashRef(candidate.executedQuery),
    originalTargetRank: original.targetRank,
    candidateTargetRank: retrieval.targetRank,
    originalRecallAt5: original.recallAt5,
    originalNdcgAt5: original.ndcgAt5,
    candidateRecallAt5: retrieval.recallAt5,
    candidateNdcgAt5: retrieval.ndcgAt5,
    critical: testCase.critical,
    strict: true,
    intentPreserved: candidate.intentPreserved,
    unsafeRewrite: candidate.unsafeRewrite,
    safetyFailure: candidate.unsafeRewrite,
  });
}

function incompleteRewrite(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.rewriteCases)[number], original: Phase698Task9CallResult | null = null) {
  const retrieval = original?.phase === 'rewrite_original_retrieval' ? original : null;
  return PHASE_6_9_8_TASK9_REWRITE_ENTRY_SCHEMA.parse({
    kind: 'rewrite_pair',
    caseId: testCase.caseId,
    originalQueryHash: hashRef(testCase.originalQuery),
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

function buildFinal(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number], result: Phase698Task9CallResult | null, disposition: Phase698Task9CallEntry['disposition']) {
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

function incompleteFinal(testCase: (typeof PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases)[number], disposition: Phase698Task9CallEntry['disposition']) {
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

function notStarted(
  identity: Phase698Task9CallIdentity,
  breaker: 'case_guard' | 'quality_breaker' | 'external_abort',
  transportAuthority: 'external_provider' | 'synthetic_injected',
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
    failureReason: breaker === 'case_guard' ? 'case_guard' : breaker === 'external_abort' ? 'aborted' : 'quality_breaker',
    wire: { attempts: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
  });
}

async function withHardTimeout<T>(invoke: (signal: AbortSignal) => Promise<T>, parent: AbortSignal, timeoutMs: number): Promise<T> {
  if (parent.aborted) throw new Phase698Task9RuntimeError('aborted');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  }
  const controller = new AbortController();
  let rejectAbort: ((error: unknown) => void) | null = null;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    controller.abort();
    rejectAbort?.(new Phase698Task9RuntimeError('aborted'));
  };
  parent.addEventListener('abort', onAbort, { once: true });
  let timer: ReturnType<typeof setTimeout>;
  try {
    timer = setTimeout(() => {
      controller.abort();
      rejectAbort?.(new Phase698Task9RuntimeError('timeout'));
    }, timeoutMs);
  } catch {
    parent.removeEventListener('abort', onAbort);
    controller.abort();
    throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  }
  const invoked = Promise.resolve().then(() => invoke(controller.signal));
  void invoked.catch(() => undefined);
  let outcome: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: unknown }>;
  try {
    outcome = Object.freeze({ ok: true as const, value: await Promise.race([invoked, abortPromise]) });
  } catch (error) {
    outcome = Object.freeze({ ok: false as const, error });
  }
  let cleanupFailed = false;
  try {
    clearTimeout(timer);
  } catch {
    cleanupFailed = true;
  }
  parent.removeEventListener('abort', onAbort);
  if (cleanupFailed) throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

function timeoutFor(phase: Phase698Task9CallIdentity['phase']) {
  if (phase === 'rewrite_candidate_model') return PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.rewrite.hardTimeoutMs;
  if (phase === 'final_response_model') return PHASE_6_9_8_TASK9_EVAL_POLICY.deepseek.finalResponse.hardTimeoutMs;
  return PHASE_6_9_8_TASK9_EVAL_POLICY.qwen.hardTimeoutMs;
}

function classify(error: unknown): Phase698Task9CallEntry['failureReason'] {
  if (error instanceof Phase698Task9RuntimeError) return error.reason;
  return 'transport';
}

function breakerFrom(entry: Phase698Task9CallEntry) {
  return entry.disposition === 'aborted' || entry.disposition === 'not_started_external_abort'
    ? ('external_abort' as const)
    : ('quality_breaker' as const);
}

function requireIdentity(callId: string, byId: ReadonlyMap<string, Phase698Task9CallIdentity>) {
  const identity = byId.get(callId);
  if (!identity) throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SCHEDULE_INVALID');
  return identity;
}

function duration(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Phase698Task9RuntimeError('runtime_contract_invalid');
  return Number(value.toFixed(3));
}

function hashRef(value: string) {
  return `sha256:${sha256(value)}`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeInput(input: RunPhase698RetrieverSchemaRecoverySr5LiveInput, allowSynthetic: boolean) {
  if (
    !input ||
    !UUID.safeParse(input.runId).success ||
    (input.admissionAuthority !== 'git_verified_live' &&
      (!allowSynthetic || input.admissionAuthority !== 'synthetic_test_live')) ||
    !(input.signal instanceof AbortSignal) ||
    !input.harness ||
    input.harness.transportAuthority !==
      (input.admissionAuthority === 'git_verified_live' ? 'external_provider' : 'synthetic_injected') ||
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
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_INPUT_INVALID');
  }
}
