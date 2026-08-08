import { z } from 'zod';

import {
  PHASE_6_9_8_P1_MANIFEST,
  type Phase698P1FinalResponseManifestEntry,
  type Phase698P1GuardManifestEntry,
  type Phase698P1RewriteManifestEntry,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  buildPhase698P1G2Report,
  PHASE_6_9_8_P1_G2_LANE_ORDER,
  scorePhase698P1G2Runner,
  type Phase698P1G2FailureCategory,
  type Phase698P1G2FinalResponseObservation,
  type Phase698P1G2GuardObservation,
  type Phase698P1G2LaneId,
  type Phase698P1G2LaneTerminal,
  type Phase698P1G2Report,
  type Phase698P1G2RewriteObservation,
  type Phase698P1G2Source,
  type Phase698P1G2Wire,
} from './phase-6-9-8-retriever-final-response-p1-g2-contract.ts';
import {
  consumePhase698P1G2SourceAdmissionCapability,
  type Phase698P1G2SourceAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-p1-g2-source-admission.ts';
import {
  projectP1FinalResponseCandidateInput,
  projectP1RewriteCandidateInput,
  type Phase698P1FinalResponseCandidateInput,
  type Phase698P1RewriteCandidateInput,
} from './phase-6-9-8-retriever-final-response-p1-candidate-contract.ts';
import type { Phase698P1BaselineBundle } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';

const ZERO_WIRE: Phase698P1G2Wire = Object.freeze({
  reservation: 1,
  dispatch: 0,
  response: 0,
  strictValidated: 0,
  verifiedUsage: 0,
});
const SAFE_CODE = /^[a-z0-9_]{1,96}$/u;

const GUARD_RESULT = z
  .object({
    observedReasonCode: z.string().min(1).max(64),
    strict: z.boolean(),
    terminal: z.boolean(),
    fakeSearchPortCalls: z.number().int().nonnegative(),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    failureCategory: z.enum([
      'none',
      'semantic_mismatch',
      'contract',
      'permission',
      'safety',
      'budget',
      'transport',
      'schema',
      'usage',
      'stale',
      'abort',
    ]),
  })
  .strict();

const REWRITE_RESULT = z
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
    failureCategory: z.enum([
      'none',
      'semantic_mismatch',
      'contract',
      'permission',
      'safety',
      'budget',
      'transport',
      'schema',
      'usage',
      'stale',
      'abort',
    ]),
  })
  .strict();

const FINAL_RESULT = z
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
    failureCategory: z.enum([
      'none',
      'semantic_mismatch',
      'contract',
      'permission',
      'safety',
      'budget',
      'transport',
      'schema',
      'usage',
      'stale',
      'abort',
    ]),
  })
  .strict();

export type Phase698P1G2GuardResult = z.infer<typeof GUARD_RESULT>;
export type Phase698P1G2RewriteResult = z.infer<typeof REWRITE_RESULT>;
export type Phase698P1G2FinalResponseResult = z.infer<typeof FINAL_RESULT>;

export type Phase698P1G2Harness = Readonly<{
  mode: 'synthetic';
  runGuard(
    entry: Phase698P1GuardManifestEntry,
    signal: AbortSignal,
  ): Promise<Phase698P1G2GuardResult>;
  runRewrite(
    input: Phase698P1RewriteCandidateInput,
    signal: AbortSignal,
  ): Promise<Phase698P1G2RewriteResult>;
  runFinalResponse(
    input: Phase698P1FinalResponseCandidateInput,
    signal: AbortSignal,
  ): Promise<Phase698P1G2FinalResponseResult>;
}>;

export type Phase698P1G2LaneLifecycle = Readonly<{
  appendStage(stage: 'dispatch_started' | 'response_observed' | 'strict_validated'): Promise<void>;
}>;

export type Phase698P1G2Lifecycle = Readonly<{
  runId: string;
  source: Phase698P1G2Source;
  appendGuardTerminal(entry: Phase698P1G2GuardObservation): Promise<void>;
  reserveLane(laneId: Phase698P1G2LaneId, sequence: number): Promise<Phase698P1G2LaneLifecycle>;
  appendLaneTerminal(entry: Phase698P1G2LaneTerminal): Promise<void>;
  appendRunTerminal(report: Phase698P1G2Report): Promise<void>;
}>;

export type RunPhase698P1G2Input = Readonly<{
  runId: string;
  sourceAdmissionCapability: Phase698P1G2SourceAdmissionCapability;
  baselineBundle: Phase698P1BaselineBundle;
  harness: Phase698P1G2Harness;
  lifecycle: Phase698P1G2Lifecycle;
  signal: AbortSignal;
}>;

export type Phase698P1G2RunResult = Readonly<{
  report: Phase698P1G2Report;
  gate: ReturnType<typeof scorePhase698P1G2Runner>;
}>;

/**
 * Synthetic-only harness used by G2 fault tests and the zero-provider CLI.
 * It intentionally derives expected metrics outside the candidate projection;
 * no oracle, case identity, or baseline object reaches a model-shaped method.
 */
export function createPhase698P1G2DeterministicHarness(
  baselineBundle: Phase698P1BaselineBundle,
): Phase698P1G2Harness {
  const guards = new Map(baselineBundle.report.guards.map((entry) => [entry.caseId, entry]));
  const rewriteEntries = [...baselineBundle.report.rewriteEntries];
  const finalEntries = [...baselineBundle.report.finalResponseEntries];
  let rewriteIndex = 0;
  let finalIndex = 0;
  return Object.freeze({
    mode: 'synthetic' as const,
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
      const expected = rewriteEntries[rewriteIndex++] ?? rewriteEntries.at(-1);
      return Object.freeze({
        runtime: true,
        wire: true,
        verifiedUsage: true,
        responseObserved: true,
        strict: true,
        candidateRecallAt5: 1,
        candidateNdcgAt5: 1,
        noHitObserved: expected?.expectedNoHit ?? false,
        intentPreserved: true,
        unsafeRewrite: false,
        durationMs: 1,
        failureCategory: 'none' as const,
      });
    },
    runFinalResponse: async (input) => {
      void input;
      const entry = finalEntries[finalIndex++] ?? finalEntries.at(-1);
      return Object.freeze({
        runtime: true,
        wire: true,
        verifiedUsage: true,
        responseObserved: true,
        strict: true,
        groundedScore: 1,
        observedCitationCount: entry?.requiredCitationCount ?? 0,
        citationTruePositiveCount: entry?.requiredCitationCount ?? 0,
        noticeSatisfied: true,
        falseToolSuccess: false,
        falseCitation: false,
        safetyFailure: false,
        durationMs: 1,
        failureCategory: 'none' as const,
      });
    },
  });
}

export async function runPhase698P1G2(input: RunPhase698P1G2Input): Promise<Phase698P1G2RunResult> {
  assertInput(input);
  const source = consumePhase698P1G2SourceAdmissionCapability(input.sourceAdmissionCapability);
  if (
    input.lifecycle.runId !== input.runId ||
    input.harness.mode !== 'synthetic' ||
    JSON.stringify(input.lifecycle.source) !== JSON.stringify(source)
  ) {
    throw new Error('PHASE_6_9_8_P1_G2_RUNTIME_AUTHORITY_INVALID');
  }
  if (input.baselineBundle.sha256.length !== 64) {
    throw new Error('PHASE_6_9_8_P1_G2_BASELINE_INVALID');
  }
  const guardEntries: Phase698P1G2GuardObservation[] = [];
  let breakerReason: string | null = null;
  for (const testCase of PHASE_6_9_8_P1_MANIFEST.guardCases) {
    const entry = await runGuard(testCase, input.harness, input.signal);
    guardEntries.push(entry);
    await input.lifecycle.appendGuardTerminal(entry);
    if (!entry.strict || !entry.terminal || entry.fakeSearchPortCalls !== 0) {
      breakerReason = breakerReason ?? 'guard_failure';
    }
  }

  const rewriteEntries: Phase698P1G2RewriteObservation[] = [];
  const finalResponseEntries: Phase698P1G2FinalResponseObservation[] = [];
  const laneTerminals: Phase698P1G2LaneTerminal[] = [];
  let candidateInvocations = 0;
  const baselineRewrite = new Map(
    input.baselineBundle.report.rewriteEntries.map((entry) => [entry.caseId, entry]),
  );
  const baselineFinal = new Map(
    input.baselineBundle.report.finalResponseEntries.map((entry) => [entry.caseId, entry]),
  );

  for (let index = 0; index < PHASE_6_9_8_P1_G2_LANE_ORDER.length; index += 1) {
    const laneId = PHASE_6_9_8_P1_G2_LANE_ORDER[index];
    const sequence = index + 1;
    const lane = await input.lifecycle.reserveLane(laneId, sequence);
    if (breakerReason !== null) {
      const parentAbort = breakerReason === 'parent_abort';
      const terminal = makeNotStartedTerminal(
        laneId,
        sequence,
        parentAbort ? 'not_started_parent_aborted' : 'not_started_quality_breaker',
        parentAbort ? 'parent_abort' : breakerReason,
      );
      await input.lifecycle.appendLaneTerminal(terminal);
      laneTerminals.push(terminal);
      if (laneId.startsWith('rewrite_')) {
        const base = baselineRewrite.get(laneId);
        if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_REWRITE_MISSING');
        rewriteEntries.push(incompleteRewrite(laneId, base));
      } else {
        const base = baselineFinal.get(laneId);
        if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_FINAL_MISSING');
        finalResponseEntries.push(incompleteFinal(laneId, base));
      }
      continue;
    }
    if (input.signal.aborted) {
      breakerReason = 'parent_abort';
      const terminal = makeNotStartedTerminal(
        laneId,
        sequence,
        'not_started_parent_aborted',
        'parent_abort',
      );
      await input.lifecycle.appendLaneTerminal(terminal);
      laneTerminals.push(terminal);
      if (laneId.startsWith('rewrite_')) {
        const base = baselineRewrite.get(laneId);
        if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_REWRITE_MISSING');
        rewriteEntries.push(incompleteRewrite(laneId, base));
      } else {
        const base = baselineFinal.get(laneId);
        if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_FINAL_MISSING');
        finalResponseEntries.push(incompleteFinal(laneId, base));
      }
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
      baseline: laneId.startsWith('rewrite_')
        ? baselineRewrite.get(laneId)!
        : baselineFinal.get(laneId)!,
    });
    candidateInvocations += result.invocations;
    laneTerminals.push(result.terminal);
    await input.lifecycle.appendLaneTerminal(result.terminal);
    if (laneId.startsWith('rewrite_')) {
      const base = baselineRewrite.get(laneId);
      if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_REWRITE_MISSING');
      rewriteEntries.push(result.observation as Phase698P1G2RewriteObservation);
    } else {
      const base = baselineFinal.get(laneId);
      if (!base) throw new Error('PHASE_6_9_8_P1_G2_BASELINE_FINAL_MISSING');
      finalResponseEntries.push(result.observation as Phase698P1G2FinalResponseObservation);
    }
    if (
      result.terminal.failureCategory !== 'none' &&
      result.terminal.failureCategory !== 'semantic_mismatch'
    ) {
      breakerReason = result.terminal.failureCategory;
    }
  }

  if (candidateInvocations > 12) throw new Error('PHASE_6_9_8_P1_G2_CANDIDATE_CAP');
  const report = buildPhase698P1G2Report({
    runId: input.runId,
    source,
    guardEntries,
    rewriteEntries,
    finalResponseEntries,
    laneTerminals,
    candidateInvocations,
    breakerReason,
  });
  await input.lifecycle.appendRunTerminal(report);
  return Object.freeze({
    report,
    gate: scorePhase698P1G2Runner(report, input.baselineBundle),
  });
}

function assertInput(input: RunPhase698P1G2Input) {
  if (
    typeof input !== 'object' ||
    input === null ||
    !z.string().uuid().safeParse(input.runId).success ||
    !(input.signal instanceof AbortSignal) ||
    !input.baselineBundle ||
    !input.harness ||
    !input.lifecycle ||
    typeof input.harness.runGuard !== 'function' ||
    typeof input.harness.runRewrite !== 'function' ||
    typeof input.harness.runFinalResponse !== 'function' ||
    typeof input.lifecycle.appendGuardTerminal !== 'function' ||
    typeof input.lifecycle.reserveLane !== 'function' ||
    typeof input.lifecycle.appendLaneTerminal !== 'function' ||
    typeof input.lifecycle.appendRunTerminal !== 'function'
  ) {
    throw new Error('PHASE_6_9_8_P1_G2_RUNNER_INPUT_INVALID');
  }
}

async function runGuard(
  testCase: Phase698P1GuardManifestEntry,
  harness: Phase698P1G2Harness,
  signal: AbortSignal,
): Promise<Phase698P1G2GuardObservation> {
  let raw: unknown;
  try {
    raw = signal.aborted
      ? {
          observedReasonCode: 'parent_abort',
          strict: true,
          terminal: true,
          fakeSearchPortCalls: 0,
          providerCalls: 0,
          credentialReads: 0,
          failureCategory: 'abort',
        }
      : await harness.runGuard(testCase, signal);
  } catch {
    raw = {
      observedReasonCode: 'guard_runtime_invalid',
      strict: false,
      terminal: true,
      fakeSearchPortCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      failureCategory: 'schema',
    };
  }
  const parsed = GUARD_RESULT.safeParse(raw);
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
  return {
    caseId: testCase.caseId,
    observedReasonCode: value.observedReasonCode,
    strict: value.strict,
    terminal: value.terminal,
    fakeSearchPortCalls: value.fakeSearchPortCalls,
    providerCalls: 0,
    credentialReads: 0,
    failureCategory: value.failureCategory,
    breakerOpened: false,
  };
}

async function executeLane(input: {
  laneId: Phase698P1G2LaneId;
  sequence: number;
  lane: Phase698P1G2LaneLifecycle;
  harness: Phase698P1G2Harness;
  signal: AbortSignal;
  manifest: Phase698P1RewriteManifestEntry | Phase698P1FinalResponseManifestEntry;
  baseline:
    | {
        metricEligible: boolean;
        expectedNoHit: boolean;
        recallAt5: number | null;
        ndcgAt5: number | null;
        critical: boolean;
      }
    | {
        requiredCitationCount: number;
        requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
      };
}) {
  let invocations = 0;
  if (input.signal.aborted) {
    return {
      invocations,
      terminal: makeNotStartedTerminal(
        input.laneId,
        input.sequence,
        'not_started_parent_aborted',
        'parent_abort',
      ),
      observation: input.laneId.startsWith('rewrite_')
        ? incompleteRewrite(
            input.laneId,
            input.baseline as {
              metricEligible: boolean;
              expectedNoHit: boolean;
              recallAt5: number | null;
              ndcgAt5: number | null;
              critical: boolean;
            },
          )
        : incompleteFinal(
            input.laneId,
            input.baseline as {
              requiredCitationCount: number;
              requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
            },
          ),
    };
  }
  await input.lane.appendStage('dispatch_started');
  invocations = 1;
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
    const parsed = input.laneId.startsWith('rewrite_')
      ? REWRITE_RESULT.safeParse(raw)
      : FINAL_RESULT.safeParse(raw);
    if (!parsed.success) {
      const terminal = makeAttemptedTerminal(
        input.laneId,
        input.sequence,
        'schema',
        false,
        false,
        true,
      );
      return {
        invocations,
        terminal,
        observation: input.laneId.startsWith('rewrite_')
          ? incompleteRewrite(
              input.laneId,
              input.baseline as {
                metricEligible: boolean;
                expectedNoHit: boolean;
                recallAt5: number | null;
                ndcgAt5: number | null;
                critical: boolean;
              },
              'schema',
            )
          : incompleteFinal(
              input.laneId,
              input.baseline as {
                requiredCitationCount: number;
                requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
              },
              'schema',
            ),
      };
    }
    const value = parsed.data;
    if (value.responseObserved) await input.lane.appendStage('response_observed');
    const strict = value.strict && value.runtime && value.wire && value.verifiedUsage;
    if (strict) await input.lane.appendStage('strict_validated');
    const category = value.failureCategory;
    const disposition =
      category === 'none' && strict
        ? 'succeeded'
        : category === 'semantic_mismatch'
          ? 'semantic_mismatch'
          : category === 'abort'
            ? 'attempted_aborted'
            : 'attempted_failed';
    const terminal = makeAttemptedTerminal(
      input.laneId,
      input.sequence,
      category,
      value.responseObserved,
      strict,
      disposition !== 'succeeded' && disposition !== 'semantic_mismatch',
      disposition,
      value.responseObserved ? 'response_observed' : 'dispatch_no_response',
    );
    const observation = input.laneId.startsWith('rewrite_')
      ? rewriteObservation(
          input.laneId,
          value as Phase698P1G2RewriteResult,
          input.baseline as {
            metricEligible: boolean;
            expectedNoHit: boolean;
            recallAt5: number | null;
            ndcgAt5: number | null;
            critical: boolean;
          },
        )
      : finalObservation(
          input.laneId,
          value as Phase698P1G2FinalResponseResult,
          input.baseline as {
            requiredCitationCount: number;
            requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
          },
        );
    return { invocations, terminal, observation };
  } catch {
    const terminal = makeAttemptedTerminal(
      input.laneId,
      input.sequence,
      'transport',
      false,
      false,
      true,
    );
    return {
      invocations,
      terminal,
      observation: input.laneId.startsWith('rewrite_')
        ? incompleteRewrite(
            input.laneId,
            input.baseline as {
              metricEligible: boolean;
              expectedNoHit: boolean;
              recallAt5: number | null;
              ndcgAt5: number | null;
              critical: boolean;
            },
            'transport',
          )
        : incompleteFinal(
            input.laneId,
            input.baseline as {
              requiredCitationCount: number;
              requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
            },
            'transport',
          ),
    };
  }
}

function rewriteObservation(
  laneId: string,
  result: Phase698P1G2RewriteResult,
  baseline: {
    metricEligible: boolean;
    expectedNoHit: boolean;
    recallAt5: number | null;
    ndcgAt5: number | null;
    critical: boolean;
  },
): Phase698P1G2RewriteObservation {
  return {
    caseId: laneId,
    strict: result.strict && result.runtime && result.wire && result.verifiedUsage,
    runtime: result.runtime,
    wire: result.wire,
    verifiedUsage: result.verifiedUsage,
    terminal: true,
    metricEligible: baseline.metricEligible,
    expectedNoHit: baseline.expectedNoHit,
    noHitObserved: result.noHitObserved,
    baselineRecallAt5: baseline.recallAt5,
    baselineNdcgAt5: baseline.ndcgAt5,
    candidateRecallAt5: result.candidateRecallAt5,
    candidateNdcgAt5: result.candidateNdcgAt5,
    critical: baseline.critical,
    intentPreserved: result.intentPreserved,
    unsafeRewrite: result.unsafeRewrite,
    candidateInvocations: 1,
    durationMs: result.durationMs,
    failureCategory: result.failureCategory,
    breakerOpened: [
      'contract',
      'permission',
      'safety',
      'budget',
      'transport',
      'schema',
      'usage',
      'stale',
    ].includes(result.failureCategory),
  };
}

function finalObservation(
  laneId: string,
  result: Phase698P1G2FinalResponseResult,
  baseline: {
    requiredCitationCount: number;
    requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
  },
): Phase698P1G2FinalResponseObservation {
  return {
    caseId: laneId,
    strict: result.strict && result.runtime && result.wire && result.verifiedUsage,
    runtime: result.runtime,
    wire: result.wire,
    verifiedUsage: result.verifiedUsage,
    terminal: true,
    groundedScore: result.groundedScore,
    requiredCitationCount: baseline.requiredCitationCount,
    requiredNotice: baseline.requiredNotice,
    observedCitationCount: result.observedCitationCount,
    citationTruePositiveCount: result.citationTruePositiveCount,
    noticeSatisfied: result.noticeSatisfied,
    falseToolSuccess: result.falseToolSuccess,
    falseCitation: result.falseCitation,
    safetyFailure: result.safetyFailure,
    candidateInvocations: 1,
    durationMs: result.durationMs,
    failureCategory: result.failureCategory,
    breakerOpened: [
      'contract',
      'permission',
      'safety',
      'budget',
      'transport',
      'schema',
      'usage',
      'stale',
    ].includes(result.failureCategory),
  };
}

function incompleteRewrite(
  laneId: string,
  baseline: {
    metricEligible: boolean;
    expectedNoHit: boolean;
    recallAt5: number | null;
    ndcgAt5: number | null;
    critical: boolean;
  } | null,
  failureCategory: Phase698P1G2FailureCategory = 'stale',
): Phase698P1G2RewriteObservation {
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
    baselineRecallAt5: baseline?.recallAt5 ?? 1,
    baselineNdcgAt5: baseline?.ndcgAt5 ?? 1,
    candidateRecallAt5: null,
    candidateNdcgAt5: null,
    critical: baseline?.critical ?? false,
    intentPreserved: false,
    unsafeRewrite: false,
    candidateInvocations: 0,
    durationMs: null,
    failureCategory,
    breakerOpened: failureCategory !== 'semantic_mismatch',
  };
}

function incompleteFinal(
  laneId: string,
  baseline: {
    requiredCitationCount: number;
    requiredNotice: 'none' | 'caution' | 'conflict' | 'insufficient';
  } | null,
  failureCategory: Phase698P1G2FailureCategory = 'stale',
): Phase698P1G2FinalResponseObservation {
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
    candidateInvocations: 0,
    durationMs: null,
    failureCategory,
    breakerOpened: failureCategory !== 'semantic_mismatch',
  };
}

function makeNotStartedTerminal(
  laneId: Phase698P1G2LaneId,
  sequence: number,
  disposition: 'not_started_quality_breaker' | 'not_started_parent_aborted',
  reason: string,
): Phase698P1G2LaneTerminal {
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
    terminalReason: safeReason(reason),
  };
}

function makeAttemptedTerminal(
  laneId: Phase698P1G2LaneId,
  sequence: number,
  category: Phase698P1G2FailureCategory,
  response: boolean,
  strict: boolean,
  breakerOpened: boolean,
  disposition:
    | 'succeeded'
    | 'semantic_mismatch'
    | 'attempted_failed'
    | 'attempted_aborted' = 'attempted_failed',
  reason = 'candidate_terminal',
): Phase698P1G2LaneTerminal {
  return {
    laneId,
    kind: laneId.startsWith('rewrite_') ? 'rewrite' : 'final_response',
    caseId: laneId,
    sequence,
    state: 'terminal',
    disposition,
    failureCategory: category,
    candidateInvocations: 1,
    wire: {
      reservation: 1,
      dispatch: 1,
      response: response ? 1 : 0,
      strictValidated: strict ? 1 : 0,
      verifiedUsage: strict ? 1 : 0,
    },
    breakerOpened,
    terminalReason: safeReason(reason),
  };
}

function safeReason(value: string) {
  return SAFE_CODE.test(value) ? value : 'runner_invalid';
}
