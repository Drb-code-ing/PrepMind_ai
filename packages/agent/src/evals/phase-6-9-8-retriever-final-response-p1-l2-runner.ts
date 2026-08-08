import { z } from 'zod';

import {
  PHASE_6_9_8_P1_MANIFEST,
  type Phase698P1FinalResponseManifestEntry,
  type Phase698P1GuardManifestEntry,
  type Phase698P1RewriteManifestEntry,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  buildPhase698P1L2Report,
  PHASE_6_9_8_P1_L2_FAILURE_CATEGORIES,
  PHASE_6_9_8_P1_L2_LANE_ORDER,
  scorePhase698P1L2,
  type Phase698P1L2FailureCategory,
  type Phase698P1L2Disposition,
  type Phase698P1L2FinalResponseObservation,
  type Phase698P1L2Gate,
  type Phase698P1L2GuardObservation,
  type Phase698P1L2LaneId,
  type Phase698P1L2LaneTerminal,
  type Phase698P1L2Report,
  type Phase698P1L2RewriteObservation,
  type Phase698P1L2Source,
  type Phase698P1L2Wire,
} from './phase-6-9-8-retriever-final-response-p1-l2-contract.ts';
import {
  consumePhase698P1L2AdmissionCapability,
  type Phase698P1L2AdmissionCapability,
} from './phase-6-9-8-retriever-final-response-p1-l2-admission.ts';
import {
  projectP1FinalResponseCandidateInput,
  projectP1RewriteCandidateInput,
  type Phase698P1FinalResponseCandidateInput,
  type Phase698P1RewriteCandidateInput,
} from './phase-6-9-8-retriever-final-response-p1-candidate-contract.ts';
import type { Phase698P1BaselineBundle } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';

const CATEGORY = z.enum(PHASE_6_9_8_P1_L2_FAILURE_CATEGORIES);
const USAGE = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();
const ZERO_WIRE: Phase698P1L2Wire = Object.freeze({
  reservation: 1,
  dispatch: 0,
  response: 0,
  strictValidated: 0,
  verifiedUsage: 0,
});
const HARD_FAILURES = new Set<Phase698P1L2FailureCategory>([
  'contract',
  'permission',
  'safety',
  'budget',
  'transport',
  'schema',
  'usage',
  'stale',
]);

export type Phase698P1L2GuardResult = Readonly<{
  observedReasonCode: string;
  strict: boolean;
  terminal: boolean;
  fakeSearchPortCalls: number;
  providerCalls: 0;
  credentialReads: 0;
  failureCategory: Phase698P1L2FailureCategory;
}>;

export type Phase698P1L2RewriteResult = Readonly<{
  runtime: boolean;
  wire: boolean;
  verifiedUsage: boolean;
  responseObserved: boolean;
  strict: boolean;
  candidateRecallAt5: number | null;
  candidateNdcgAt5: number | null;
  noHitObserved: boolean | null;
  intentPreserved: boolean;
  unsafeRewrite: boolean;
  durationMs: number | null;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  verifiedCostCny: number | null;
  provenance: 'deepseek_network' | 'runtime_untrusted' | 'not_invoked';
  failureCategory: Phase698P1L2FailureCategory;
}>;

export type Phase698P1L2FinalResponseResult = Readonly<{
  runtime: boolean;
  wire: boolean;
  verifiedUsage: boolean;
  responseObserved: boolean;
  strict: boolean;
  groundedScore: number | null;
  observedCitationCount: number;
  citationTruePositiveCount: number;
  noticeSatisfied: boolean;
  falseToolSuccess: boolean;
  falseCitation: boolean;
  safetyFailure: boolean;
  durationMs: number | null;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
  verifiedCostCny: number | null;
  provenance: 'deepseek_network' | 'runtime_untrusted' | 'not_invoked';
  failureCategory: Phase698P1L2FailureCategory;
}>;

export type Phase698P1L2Harness = Readonly<{
  mode: 'controlled_live' | 'reviewed_mock';
  runGuard(entry: Phase698P1GuardManifestEntry, signal: AbortSignal): Promise<unknown>;
  runRewrite(input: Phase698P1RewriteCandidateInput, signal: AbortSignal): Promise<unknown>;
  runFinalResponse(
    input: Phase698P1FinalResponseCandidateInput,
    signal: AbortSignal,
  ): Promise<unknown>;
}>;

export type Phase698P1L2LaneLifecycle = Readonly<{
  appendStage(stage: 'dispatch_started' | 'response_observed' | 'strict_validated'): Promise<void>;
}>;
export type Phase698P1L2Lifecycle = Readonly<{
  runId: string;
  source: Phase698P1L2Source;
  appendGuardTerminal(entry: Phase698P1L2GuardObservation): Promise<void>;
  reserveLane(laneId: Phase698P1L2LaneId, sequence: number): Promise<Phase698P1L2LaneLifecycle>;
  appendLaneTerminal(entry: Phase698P1L2LaneTerminal): Promise<void>;
  appendRunTerminal(report: Phase698P1L2Report): Promise<void>;
}>;

export type RunPhase698P1L2Input = Readonly<{
  runId: string;
  admissionCapability: Phase698P1L2AdmissionCapability;
  baselineBundle: Phase698P1BaselineBundle;
  harness: Phase698P1L2Harness;
  lifecycle: Phase698P1L2Lifecycle;
  signal: AbortSignal;
  credentialReads?: number;
  allowReviewedMock?: true;
}>;
export type Phase698P1L2RunResult = Readonly<{
  report: Phase698P1L2Report;
  gate: Phase698P1L2Gate;
}>;

/** Production-shaped, max-concurrency-one runner. It never retries or replays a lane. */
export async function runPhase698P1L2(input: RunPhase698P1L2Input): Promise<Phase698P1L2RunResult> {
  assertInput(input);
  const admission = consumePhase698P1L2AdmissionCapability(input.admissionCapability);
  const source = sourceFromAdmission(admission);
  if (
    input.lifecycle.runId !== input.runId ||
    JSON.stringify(input.lifecycle.source) !== JSON.stringify(source)
  ) {
    throw new Error('PHASE_6_9_8_P1_L2_RUNTIME_AUTHORITY_INVALID');
  }
  if (input.baselineBundle.sha256 !== admission.source.baselineSha256) {
    throw new Error('PHASE_6_9_8_P1_L2_BASELINE_OR_MODE_INVALID');
  }
  if (input.harness.mode === 'reviewed_mock' && input.allowReviewedMock !== true) {
    throw new Error('PHASE_6_9_8_P1_L2_LIVE_REQUIRED');
  }
  const guards: Phase698P1L2GuardObservation[] = [];
  let breakerReason: string | null = null;
  for (const testCase of PHASE_6_9_8_P1_MANIFEST.guardCases) {
    const result = await runGuard(testCase, input.harness, input.signal);
    guards.push(result);
    await input.lifecycle.appendGuardTerminal(result);
    if (!result.strict || !result.terminal || result.fakeSearchPortCalls !== 0)
      breakerReason ??= 'guard_failure';
  }

  const rewriteEntries: Phase698P1L2RewriteObservation[] = [];
  const finalEntries: Phase698P1L2FinalResponseObservation[] = [];
  const terminals: Phase698P1L2LaneTerminal[] = [];
  let providerCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let verifiedCostCny = 0;
  let costKnown = true;
  let invocations = 0;
  const baselineRewrite = new Map(
    input.baselineBundle.report.rewriteEntries.map((entry) => [entry.caseId, entry]),
  );
  const baselineFinal = new Map(
    input.baselineBundle.report.finalResponseEntries.map((entry) => [entry.caseId, entry]),
  );

  for (let index = 0; index < PHASE_6_9_8_P1_L2_LANE_ORDER.length; index += 1) {
    const laneId = PHASE_6_9_8_P1_L2_LANE_ORDER[index];
    const sequence = index + 1;
    const lane = await input.lifecycle.reserveLane(laneId, sequence);
    if (breakerReason !== null || input.signal.aborted) {
      const reason = input.signal.aborted ? 'parent_abort' : breakerReason;
      breakerReason ??= 'parent_abort';
      const terminal = notStartedTerminal(
        laneId,
        sequence,
        input.signal.aborted ? 'not_started_parent_aborted' : 'not_started_quality_breaker',
        reason ?? 'quality_breaker',
      );
      await input.lifecycle.appendLaneTerminal(terminal);
      terminals.push(terminal);
      if (laneId.startsWith('rewrite_'))
        rewriteEntries.push(
          incompleteRewrite(
            laneId,
            baselineRewrite.get(laneId),
            input.signal.aborted ? 'abort' : 'stale',
          ),
        );
      else
        finalEntries.push(
          incompleteFinal(
            laneId,
            baselineFinal.get(laneId),
            input.signal.aborted ? 'abort' : 'stale',
          ),
        );
      continue;
    }
    const result = await executeLane({
      laneId,
      sequence,
      lane,
      harness: input.harness,
      signal: input.signal,
      manifest: laneId.startsWith('rewrite_')
        ? PHASE_6_9_8_P1_MANIFEST.rewriteCases.find((entry) => entry.caseId === laneId)!
        : PHASE_6_9_8_P1_MANIFEST.finalResponseCases.find((entry) => entry.caseId === laneId)!,
      baselineRewrite: baselineRewrite.get(laneId),
      baselineFinal: baselineFinal.get(laneId),
    });
    invocations += result.invocations;
    providerCalls += result.providerCalls;
    if (result.usage) {
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
    }
    if (result.verifiedCostCny === null) costKnown = false;
    else verifiedCostCny += result.verifiedCostCny;
    terminals.push(result.terminal);
    await input.lifecycle.appendLaneTerminal(result.terminal);
    if (laneId.startsWith('rewrite_'))
      rewriteEntries.push(result.observation as Phase698P1L2RewriteObservation);
    else finalEntries.push(result.observation as Phase698P1L2FinalResponseObservation);
    if (
      result.terminal.failureCategory !== 'none' &&
      result.terminal.failureCategory !== 'semantic_mismatch'
    )
      breakerReason ??= result.terminal.failureCategory;
  }
  if (invocations > 12) throw new Error('PHASE_6_9_8_P1_L2_CANDIDATE_CAP');
  const report = buildPhase698P1L2Report({
    runId: input.runId,
    source,
    guardEntries: guards,
    rewriteEntries,
    finalResponseEntries: finalEntries,
    laneTerminals: terminals,
    providerCalls,
    credentialReads: input.credentialReads ?? 0,
    inputTokens,
    outputTokens,
    verifiedCostCny: costKnown ? Number(verifiedCostCny.toFixed(8)) : null,
    breakerReason,
  });
  await input.lifecycle.appendRunTerminal(report);
  const gate = scorePhase698P1L2(report, input.baselineBundle);
  return Object.freeze({ report, gate });
}

export function createPhase698P1L2ReviewedMockHarness(
  baseline: Phase698P1BaselineBundle,
): Phase698P1L2Harness {
  const guards = new Map(baseline.report.guards.map((entry) => [entry.caseId, entry]));
  const finals = new Map(
    baseline.report.finalResponseEntries.map((entry) => [entry.caseId, entry]),
  );
  return Object.freeze({
    mode: 'reviewed_mock' as const,
    runGuard: async (entry) =>
      Object.freeze({
        observedReasonCode: guards.get(entry.caseId)?.expectedReasonCode ?? 'guard_runtime_invalid',
        strict: true,
        terminal: true,
        fakeSearchPortCalls: 0,
        providerCalls: 0 as const,
        credentialReads: 0 as const,
        failureCategory: 'none' as const,
      }),
    runRewrite: async (input) => {
      void input;
      return Object.freeze({
        runtime: true,
        wire: true,
        verifiedUsage: true,
        responseObserved: true,
        strict: true,
        candidateRecallAt5: 1,
        candidateNdcgAt5: 1,
        noHitObserved: false,
        intentPreserved: true,
        unsafeRewrite: false,
        durationMs: 1,
        usage: { inputTokens: 1, outputTokens: 1 },
        verifiedCostCny: 0,
        provenance: 'not_invoked' as const,
        failureCategory: 'none' as const,
      });
    },
    runFinalResponse: async (input) => {
      const entry =
        finals.get((input as { latestUserMessage: string }).latestUserMessage) ??
        finals.values().next().value;
      void entry;
      return Object.freeze({
        runtime: true,
        wire: true,
        verifiedUsage: true,
        responseObserved: true,
        strict: true,
        groundedScore: 1,
        observedCitationCount: 0,
        citationTruePositiveCount: 0,
        noticeSatisfied: true,
        falseToolSuccess: false,
        falseCitation: false,
        safetyFailure: false,
        durationMs: 1,
        usage: { inputTokens: 1, outputTokens: 1 },
        verifiedCostCny: 0,
        provenance: 'not_invoked' as const,
        failureCategory: 'none' as const,
      });
    },
  });
}

function sourceFromAdmission(
  admission: ReturnType<typeof consumePhase698P1L2AdmissionCapability>,
): Phase698P1L2Source {
  return {
    schemaVersion: `${admission.lineage}-source-v1`,
    lineage: admission.lineage,
    mode: 'controlled_live',
    branch: admission.source.branch,
    head: admission.source.head,
    upstream: admission.source.upstream,
    origin: admission.source.origin,
    approvedTag: { name: admission.source.approvedTag, commit: admission.source.head },
    manifestSha256: admission.source.manifestSha256,
    policySha256: admission.source.policySha256,
    baselineSha256: admission.source.baselineSha256,
    s2FactorySha256: admission.s2Identity.factorySha256,
    final11CompatibilitySha256: admission.s2Identity.final11CompatibilitySha256,
    formalEvidencePaths: [],
    oldLineagePaths: [],
  };
}

async function runGuard(
  entry: Phase698P1GuardManifestEntry,
  harness: Phase698P1L2Harness,
  signal: AbortSignal,
): Promise<Phase698P1L2GuardObservation> {
  try {
    const raw = signal.aborted
      ? {
          observedReasonCode: 'parent_abort',
          strict: true,
          terminal: true,
          fakeSearchPortCalls: 0,
          providerCalls: 0,
          credentialReads: 0,
          failureCategory: 'abort',
        }
      : await harness.runGuard(entry, signal);
    const parsed = z
      .object({
        observedReasonCode: z.string(),
        strict: z.boolean(),
        terminal: z.boolean(),
        fakeSearchPortCalls: z.number().int().nonnegative(),
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        failureCategory: CATEGORY,
      })
      .strict()
      .safeParse(raw);
    const value = parsed.success
      ? parsed.data
      : {
          observedReasonCode: 'guard_runtime_invalid',
          strict: false,
          terminal: true,
          fakeSearchPortCalls: 0,
          providerCalls: 0 as const,
          credentialReads: 0 as const,
          failureCategory: 'schema' as const,
        };
    return { caseId: entry.caseId, ...value, breakerOpened: false };
  } catch {
    return {
      caseId: entry.caseId,
      observedReasonCode: 'guard_runtime_invalid',
      strict: false,
      terminal: true,
      fakeSearchPortCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      failureCategory: 'schema',
      breakerOpened: false,
    };
  }
}

async function executeLane(input: {
  laneId: Phase698P1L2LaneId;
  sequence: number;
  lane: Phase698P1L2LaneLifecycle;
  harness: Phase698P1L2Harness;
  signal: AbortSignal;
  manifest: Phase698P1RewriteManifestEntry | Phase698P1FinalResponseManifestEntry;
  baselineRewrite: Phase698P1BaselineBundle['report']['rewriteEntries'][number] | undefined;
  baselineFinal: Phase698P1BaselineBundle['report']['finalResponseEntries'][number] | undefined;
}) {
  await input.lane.appendStage('dispatch_started');
  try {
    const raw = input.laneId.startsWith('rewrite_')
      ? await input.harness.runRewrite(
          projectP1RewriteCandidateInput(input.manifest as Phase698P1RewriteManifestEntry),
          input.signal,
        )
      : await input.harness.runFinalResponse(
          projectP1FinalResponseCandidateInput(
            input.manifest as Phase698P1FinalResponseManifestEntry,
          ),
          input.signal,
        );
    if (input.signal.aborted) throw new Error('aborted');
    const parsed = input.laneId.startsWith('rewrite_')
      ? parseRewriteResult(raw)
      : parseFinalResult(raw);
    if (!parsed.ok) return failedLane(input, parsed.category, false);
    await input.lane.appendStage('response_observed');
    const value = parsed.value;
    const strict =
      value.strict &&
      value.runtime &&
      value.wire &&
      value.verifiedUsage &&
      value.usage !== null &&
      value.verifiedCostCny !== null;
    if (strict) await input.lane.appendStage('strict_validated');
    const category = value.failureCategory;
    const disposition: Phase698P1L2Disposition =
      category === 'none' && strict
        ? 'succeeded'
        : category === 'semantic_mismatch'
          ? 'semantic_mismatch'
          : category === 'abort'
            ? 'attempted_aborted'
            : 'attempted_failed';
    const terminal = attemptedTerminal(
      input.laneId,
      input.sequence,
      category,
      strict,
      disposition,
      value.responseObserved,
    );
    const observation = input.laneId.startsWith('rewrite_')
      ? rewriteObservation(input.laneId, value as Phase698P1L2RewriteResult, input.baselineRewrite)
      : finalObservation(
          input.laneId,
          value as Phase698P1L2FinalResponseResult,
          input.baselineFinal,
        );
    return {
      invocations: 1,
      providerCalls: input.harness.mode === 'controlled_live' ? 1 : 0,
      usage: value.usage,
      verifiedCostCny: value.verifiedCostCny,
      terminal,
      observation,
    };
  } catch (error) {
    const category: Phase698P1L2FailureCategory =
      input.signal.aborted || (error instanceof Error && error.message === 'aborted')
        ? 'abort'
        : 'transport';
    return failedLane(input, category, true);
  }
}

function parseRewriteResult(
  value: unknown,
):
  | { ok: true; value: Phase698P1L2RewriteResult }
  | { ok: false; category: Phase698P1L2FailureCategory } {
  const parsed = z
    .object({
      runtime: z.boolean(),
      wire: z.boolean(),
      verifiedUsage: z.boolean(),
      responseObserved: z.boolean(),
      strict: z.boolean(),
      candidateRecallAt5: z.number().min(0).max(1).nullable(),
      candidateNdcgAt5: z.number().min(0).max(1).nullable(),
      noHitObserved: z.boolean().nullable(),
      intentPreserved: z.boolean(),
      unsafeRewrite: z.boolean(),
      durationMs: z.number().finite().nonnegative().nullable(),
      usage: USAGE.nullable(),
      verifiedCostCny: z.number().finite().nonnegative().nullable(),
      provenance: z.enum(['deepseek_network', 'runtime_untrusted', 'not_invoked']),
      failureCategory: CATEGORY,
    })
    .strict()
    .safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, category: 'schema' };
}
function parseFinalResult(
  value: unknown,
):
  | { ok: true; value: Phase698P1L2FinalResponseResult }
  | { ok: false; category: Phase698P1L2FailureCategory } {
  const parsed = z
    .object({
      runtime: z.boolean(),
      wire: z.boolean(),
      verifiedUsage: z.boolean(),
      responseObserved: z.boolean(),
      strict: z.boolean(),
      groundedScore: z.number().min(0).max(1).nullable(),
      observedCitationCount: z.number().int().nonnegative(),
      citationTruePositiveCount: z.number().int().nonnegative(),
      noticeSatisfied: z.boolean(),
      falseToolSuccess: z.boolean(),
      falseCitation: z.boolean(),
      safetyFailure: z.boolean(),
      durationMs: z.number().finite().nonnegative().nullable(),
      usage: USAGE.nullable(),
      verifiedCostCny: z.number().finite().nonnegative().nullable(),
      provenance: z.enum(['deepseek_network', 'runtime_untrusted', 'not_invoked']),
      failureCategory: CATEGORY,
    })
    .strict()
    .safeParse(value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, category: 'schema' };
}

function rewriteObservation(
  laneId: string,
  value: Phase698P1L2RewriteResult,
  baseline: Phase698P1BaselineBundle['report']['rewriteEntries'][number] | undefined,
): Phase698P1L2RewriteObservation {
  return {
    caseId: laneId,
    strict:
      value.strict &&
      value.runtime &&
      value.wire &&
      value.verifiedUsage &&
      value.usage !== null &&
      value.verifiedCostCny !== null,
    runtime: value.runtime,
    wire: value.wire,
    verifiedUsage: value.verifiedUsage,
    terminal: true,
    metricEligible: baseline?.metricEligible ?? true,
    expectedNoHit: baseline?.expectedNoHit ?? false,
    noHitObserved: value.noHitObserved,
    baselineRecallAt5: baseline?.recallAt5 ?? null,
    baselineNdcgAt5: baseline?.ndcgAt5 ?? null,
    candidateRecallAt5: value.candidateRecallAt5,
    candidateNdcgAt5: value.candidateNdcgAt5,
    critical: baseline?.critical ?? false,
    intentPreserved: value.intentPreserved,
    unsafeRewrite: value.unsafeRewrite,
    candidateInvocations: 1,
    durationMs: value.durationMs,
    usage: value.usage,
    verifiedCostCny: value.verifiedCostCny,
    provenance: value.provenance,
    failureCategory: value.failureCategory,
    breakerOpened: HARD_FAILURES.has(value.failureCategory),
  };
}
function finalObservation(
  laneId: string,
  value: Phase698P1L2FinalResponseResult,
  baseline: Phase698P1BaselineBundle['report']['finalResponseEntries'][number] | undefined,
): Phase698P1L2FinalResponseObservation {
  return {
    caseId: laneId,
    strict:
      value.strict &&
      value.runtime &&
      value.wire &&
      value.verifiedUsage &&
      value.usage !== null &&
      value.verifiedCostCny !== null,
    runtime: value.runtime,
    wire: value.wire,
    verifiedUsage: value.verifiedUsage,
    terminal: true,
    groundedScore: value.groundedScore,
    requiredCitationCount: baseline?.requiredCitationCount ?? 0,
    requiredNotice: baseline?.requiredNotice ?? 'none',
    observedCitationCount: value.observedCitationCount,
    citationTruePositiveCount: value.citationTruePositiveCount,
    noticeSatisfied: value.noticeSatisfied,
    falseToolSuccess: value.falseToolSuccess,
    falseCitation: value.falseCitation,
    safetyFailure: value.safetyFailure,
    candidateInvocations: 1,
    durationMs: value.durationMs,
    usage: value.usage,
    verifiedCostCny: value.verifiedCostCny,
    provenance: value.provenance,
    failureCategory: value.failureCategory,
    breakerOpened: HARD_FAILURES.has(value.failureCategory),
  };
}
function failedLane(
  input: {
    laneId: Phase698P1L2LaneId;
    sequence: number;
    harness: Phase698P1L2Harness;
    baselineRewrite: Phase698P1BaselineBundle['report']['rewriteEntries'][number] | undefined;
    baselineFinal: Phase698P1BaselineBundle['report']['finalResponseEntries'][number] | undefined;
  },
  category: Phase698P1L2FailureCategory,
  invoked: boolean,
) {
  const terminal = attemptedTerminal(
    input.laneId,
    input.sequence,
    category,
    false,
    category === 'abort' ? 'attempted_aborted' : 'attempted_failed',
    false,
    invoked ? 1 : 0,
  );
  const usage = null;
  const observation = input.laneId.startsWith('rewrite_')
    ? incompleteRewrite(input.laneId, input.baselineRewrite, category, invoked)
    : incompleteFinal(input.laneId, input.baselineFinal, category, invoked);
  return {
    invocations: invoked ? 1 : 0,
    providerCalls: invoked && input.harness.mode === 'controlled_live' ? 1 : 0,
    usage,
    verifiedCostCny: null,
    terminal,
    observation,
  };
}
function incompleteRewrite(
  laneId: string,
  baseline: Phase698P1BaselineBundle['report']['rewriteEntries'][number] | undefined,
  category: Phase698P1L2FailureCategory,
  invoked = false,
): Phase698P1L2RewriteObservation {
  return {
    caseId: laneId,
    strict: false,
    runtime: false,
    wire: false,
    verifiedUsage: false,
    terminal: true,
    metricEligible: baseline?.metricEligible ?? true,
    expectedNoHit: baseline?.expectedNoHit ?? false,
    noHitObserved: null,
    baselineRecallAt5: baseline?.recallAt5 ?? null,
    baselineNdcgAt5: baseline?.ndcgAt5 ?? null,
    candidateRecallAt5: null,
    candidateNdcgAt5: null,
    critical: baseline?.critical ?? false,
    intentPreserved: false,
    unsafeRewrite: false,
    candidateInvocations: invoked ? 1 : 0,
    durationMs: null,
    usage: null,
    verifiedCostCny: null,
    provenance: invoked ? 'runtime_untrusted' : 'not_invoked',
    failureCategory: category,
    breakerOpened: HARD_FAILURES.has(category),
  };
}
function incompleteFinal(
  laneId: string,
  baseline: Phase698P1BaselineBundle['report']['finalResponseEntries'][number] | undefined,
  category: Phase698P1L2FailureCategory,
  invoked = false,
): Phase698P1L2FinalResponseObservation {
  return {
    caseId: laneId,
    strict: false,
    runtime: false,
    wire: false,
    verifiedUsage: false,
    terminal: true,
    groundedScore: null,
    requiredCitationCount: baseline?.requiredCitationCount ?? 0,
    requiredNotice: baseline?.requiredNotice ?? 'none',
    observedCitationCount: 0,
    citationTruePositiveCount: 0,
    noticeSatisfied: false,
    falseToolSuccess: false,
    falseCitation: false,
    safetyFailure: false,
    candidateInvocations: invoked ? 1 : 0,
    durationMs: null,
    usage: null,
    verifiedCostCny: null,
    provenance: invoked ? 'runtime_untrusted' : 'not_invoked',
    failureCategory: category,
    breakerOpened: HARD_FAILURES.has(category),
  };
}
function attemptedTerminal(
  laneId: Phase698P1L2LaneId,
  sequence: number,
  category: Phase698P1L2FailureCategory,
  strict: boolean,
  disposition: Phase698P1L2Disposition,
  response: boolean,
  invocations = 1,
): Phase698P1L2LaneTerminal {
  return {
    laneId,
    kind: laneId.startsWith('rewrite_') ? 'rewrite' : 'final_response',
    caseId: laneId,
    sequence,
    state: 'terminal',
    disposition,
    failureCategory: category,
    candidateInvocations: invocations as 0 | 1,
    wire: {
      reservation: 1,
      dispatch: invocations ? 1 : 0,
      response: response ? 1 : 0,
      strictValidated: strict ? 1 : 0,
      verifiedUsage: strict ? 1 : 0,
    },
    breakerOpened: HARD_FAILURES.has(category),
    terminalReason: category === 'none' ? 'candidate_completed' : category,
  };
}
function notStartedTerminal(
  laneId: Phase698P1L2LaneId,
  sequence: number,
  disposition: 'not_started_quality_breaker' | 'not_started_parent_aborted',
  reason: string,
): Phase698P1L2LaneTerminal {
  return {
    laneId,
    kind: laneId.startsWith('rewrite_') ? 'rewrite' : 'final_response',
    caseId: laneId,
    sequence,
    state: 'terminal',
    disposition,
    failureCategory: disposition === 'not_started_parent_aborted' ? 'abort' : 'stale',
    candidateInvocations: 0,
    wire: ZERO_WIRE,
    breakerOpened: disposition === 'not_started_quality_breaker',
    terminalReason: /^[a-z0-9_]{1,96}$/u.test(reason) ? reason : 'runner_invalid',
  };
}
function assertInput(input: RunPhase698P1L2Input) {
  if (
    !input ||
    typeof input !== 'object' ||
    !z.string().uuid().safeParse(input.runId).success ||
    !(input.signal instanceof AbortSignal) ||
    !input.baselineBundle ||
    !input.harness ||
    !input.lifecycle ||
    typeof input.harness.runGuard !== 'function' ||
    typeof input.harness.runRewrite !== 'function' ||
    typeof input.harness.runFinalResponse !== 'function'
  )
    throw new Error('PHASE_6_9_8_P1_L2_RUNNER_INPUT_INVALID');
}
