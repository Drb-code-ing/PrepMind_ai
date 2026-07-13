import {
  hashModelAgentRunId,
  type ModelAgentErrorCode,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import type { AgentRoute, RouterResult } from '@repo/types/api/agent';

import {
  runKnowledgeVerifierModelCandidate,
  type KnowledgeVerifierModelCandidateEnvelope,
} from '../model-candidates/knowledge-verifier-model-candidate.ts';
import {
  runRouterModelCandidate,
  type RouterModelCandidateEnvelope,
} from '../model-candidates/router-model-candidate.ts';
import type { ModelCandidateDisposition } from '../model-candidates/model-candidate-policy.ts';
import {
  verifyKnowledgeChunks,
  type KnowledgeVerifierResult,
} from '../nodes/knowledge-verifier.ts';
import { routeAgentRequest } from '../router.ts';
import { createInitialAgentState } from '../state.ts';
import {
  PHASE_6943_DATASET_DIGEST,
  PHASE_6943_PRICING_SCHEMA,
  PHASE_6943_PROMPT_VERSION,
  PHASE_6943_REPORT_SCHEMA_VERSION,
  PHASE_6943_RUNNER_VERSION,
  buildPhase6943InvalidRun,
  buildPhase6943RouterLaneMetrics,
  buildPhase6943VerifierLaneMetrics,
  calculatePhase6943DatasetDigest,
  nearestRank,
  parsePhase6943Output,
  validatePhase6943Dataset,
  type Phase6943DecisionReason,
  type Phase6943Entry,
  type Phase6943Output,
  type Phase6943PricingSnapshot,
  type Phase6943RunKind,
} from './phase-6-9-router-verifier-paired-contract.ts';
import {
  PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
  phase6941RouterCases,
  phase6941VerifierCases,
  type Phase6941RouterCase,
  type Phase6941VerifierCase,
} from './phase-6-9-router-verifier-cases.ts';

export type Phase6943Clocks = {
  epochMs(): number;
  monotonicMs(): number;
};

export type Phase6943LiveDependencies = {
  createRuntime(input: {
    caseId: string;
    agent: 'router' | 'verifier';
  }): Pick<ModelAgentRuntime, 'invokeStructured'>;
  readProviderAttempts(): number;
  pricing: Phase6943PricingSnapshot;
  budgetState: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
};

export type RunPhase6943PairedEvalInput = {
  runId: string;
  runKind: 'mock' | 'live';
  clocks: Phase6943Clocks;
  createMockRuntime(input: {
    caseId: string;
    agent: 'router' | 'verifier';
  }): Pick<ModelAgentRuntime, 'invokeStructured'>;
  live?: Phase6943LiveDependencies;
  signal?: AbortSignal;
  validateDataset?: () => ReturnType<typeof validatePhase6943Dataset>;
  calculateDatasetDigest?: () => string;
  calculateCostUsd?: (
    usage: Readonly<{ inputTokens: number; outputTokens: number }>,
    pricing: Phase6943PricingSnapshot,
  ) => number;
};

const ROUTER_BUDGET = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 800,
  usedInputTokens: 0,
  maxOutputTokens: 120,
  usedOutputTokens: 0,
});
const VERIFIER_BUDGET = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1_600,
  usedInputTokens: 0,
  maxOutputTokens: 180,
  usedOutputTokens: 0,
});
const GLOBAL_CAPS = Object.freeze({
  calls: 28,
  localInputTokens: 32_000,
  localOutputTokens: 4_080,
  providerInputTokens: 96_000,
  providerOutputTokens: 4_080,
  engineeringCostUsd: 0.1,
});
const LIVE_CASE_CEILINGS = Object.freeze({
  router: Object.freeze({ inputTokens: 2_400, outputTokens: 120 }),
  verifier: Object.freeze({ inputTokens: 4_800, outputTokens: 180 }),
});
const MODEL_ERRORS = new Set<ModelAgentErrorCode>([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
]);

const ROUTE_PERMISSIONS: Readonly<
  Record<AgentRoute, { requiresRag: boolean; requiresHumanApproval: boolean }>
> = Object.freeze({
  chat: Object.freeze({ requiresRag: false, requiresHumanApproval: false }),
  tutor: Object.freeze({ requiresRag: false, requiresHumanApproval: false }),
  rag_answer: Object.freeze({ requiresRag: true, requiresHumanApproval: false }),
  wrong_question_organize: Object.freeze({ requiresRag: false, requiresHumanApproval: true }),
  review_analysis: Object.freeze({ requiresRag: false, requiresHumanApproval: true }),
  study_plan: Object.freeze({ requiresRag: false, requiresHumanApproval: true }),
  memory_reflection: Object.freeze({ requiresRag: false, requiresHumanApproval: true }),
  knowledge_dedup: Object.freeze({ requiresRag: false, requiresHumanApproval: true }),
});

type CanonicalCase = Phase6941RouterCase | Phase6941VerifierCase;
type CandidateLane = 'mock' | 'live';
type LaneResult = Extract<Phase6943Output, { kind: 'report' }>['lanes']['deterministic'];
type DeterministicExecution =
  | { testCase: Phase6941RouterCase; entry: Phase6943Entry; result: RouterResult }
  | { testCase: Phase6941VerifierCase; entry: Phase6943Entry; result: KnowledgeVerifierResult };

type CandidateSummary = {
  actualCode: AgentRoute | KnowledgeVerifierResult['status'];
  disposition: ModelCandidateDisposition;
  runtimeInvoked: boolean;
  strictSuccess: boolean;
  runtimeErrorCode?: ModelAgentErrorCode;
  inputTokens: number;
  outputTokens: number;
  traceValid: boolean;
};
type CandidateObservedEntry = Phase6943Entry & {
  entryStatus: 'observed';
  lane: CandidateLane;
  runtimeInvoked: boolean;
  providerAttempted: boolean;
  strictSuccess: boolean;
  durationMs: number;
  additionalLatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  providerReported: boolean;
};
type LiveObservedEntry = CandidateObservedEntry & { lane: 'live' };
type LiveStopEvidence = NonNullable<
  Extract<Phase6943Output, { kind: 'report'; runKind: 'live'; runStatus: 'incomplete' }>['stopEvidence']
>;
type DatasetChecks = {
  validateDataset?: () => ReturnType<typeof validatePhase6943Dataset>;
  calculateDatasetDigest?: () => string;
};
type ValidatedRunnerInput =
  | {
      runId: string;
      runKind: 'mock';
      clocks: Phase6943Clocks;
      createMockRuntime: RunPhase6943PairedEvalInput['createMockRuntime'];
      datasetChecks: DatasetChecks;
      calculateCostUsd: typeof estimatePhase6943CostUsd;
      signal?: AbortSignal;
    }
  | {
      runId: string;
      runKind: 'live';
      clocks: Phase6943Clocks;
      createMockRuntime: RunPhase6943PairedEvalInput['createMockRuntime'];
      live: ReturnType<typeof validateLiveDependencies>;
      datasetChecks: DatasetChecks;
      calculateCostUsd: typeof estimatePhase6943CostUsd;
      signal?: AbortSignal;
    };

type LiveState = {
  calls: number;
  providerInputTokens: number;
  providerOutputTokens: number;
  reportInputTokens: number;
  reportOutputTokens: number;
  estimatedCostUsd: number;
  localInputTokens: number;
  localOutputTokens: number;
};

class RunnerInvalid extends Error {
  constructor(readonly errorCode: 'dataset_mismatch' | 'report_contract_invalid' | 'live_config_invalid') {
    super(errorCode);
  }
}

export async function runPhase6943PairedEval(
  input: RunPhase6943PairedEvalInput,
): Promise<Phase6943Output> {
  const runKind = readRunKind(input);
  try {
    return await runPhase6943PairedEvalUnchecked(input);
  } catch (error) {
    if (!datasetIntegrityIsValid()) {
      return buildPhase6943InvalidRun(runKind, 'dataset_mismatch');
    }
    if (error instanceof RunnerInvalid) {
      return buildPhase6943InvalidRun(runKind, error.errorCode);
    }
    return buildPhase6943InvalidRun(runKind, 'unexpected_runner_error');
  }
}

export function canAdmit(input: {
  current: number;
  reservation: number;
  cap: number;
}): boolean {
  if (!(Number.isFinite(input.current) && input.current >= 0 &&
    Number.isFinite(input.reservation) && input.reservation >= 0 &&
    Number.isFinite(input.cap) && input.cap >= 0)) return false;
  return input.current + input.reservation <= input.cap;
}

export function estimatePhase6943CostUsd(
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  pricing: Phase6943PricingSnapshot,
): number {
  try {
    if (!isSafeNonNegativeInteger(usage.inputTokens) ||
        !isSafeNonNegativeInteger(usage.outputTokens)) return Number.NaN;
    const inputCost =
      (usage.inputTokens / pricing.unitTokens) * pricing.inputUsdPerMillion;
    const outputCost =
      (usage.outputTokens / pricing.unitTokens) * pricing.outputUsdPerMillion;
    const total = inputCost + outputCost;
    return Number.isFinite(total) && total >= 0 ? total : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

async function runPhase6943PairedEvalUnchecked(
  rawInput: RunPhase6943PairedEvalInput,
): Promise<Phase6943Output> {
  const input = validateRunnerInput(rawInput);
  assertDatasetIntegrity(input.datasetChecks);
  const startedAtMs = readEpoch(input.clocks);
  const reportStarted = readMonotonic(input.clocks);

  assertDatasetIntegrity(input.datasetChecks);
  const deterministic = runDeterministicLane(input.clocks);
  assertDatasetIntegrity(input.datasetChecks);

  assertDatasetIntegrity(input.datasetChecks);
  const mock = await runCandidateLane({
    lane: 'mock',
    runId: input.runId,
    clocks: input.clocks,
    deterministic: deterministic.executions,
    createRuntime: input.createMockRuntime,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  assertDatasetIntegrity(input.datasetChecks);

  let live: LaneResult | undefined;
  let stopEvidence: LiveStopEvidence | undefined;
  if (input.runKind === 'live') {
    if (!input.live) throw new RunnerInvalid('live_config_invalid');
    assertDatasetIntegrity(input.datasetChecks);
    const liveResult = await runLiveLane({
      runId: input.runId,
      clocks: input.clocks,
      deterministic: deterministic.executions,
      dependencies: input.live,
      datasetChecks: input.datasetChecks,
      calculateCostUsd: input.calculateCostUsd,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    live = liveResult.lane;
    stopEvidence = liveResult.stopEvidence;
    assertDatasetIntegrity(input.datasetChecks);
  }

  const finishedAtMs = readEpoch(input.clocks);
  const reportFinished = readMonotonic(input.clocks);
  const durationMs = safeDuration(reportStarted, reportFinished);
  const runIdHash = hashModelAgentRunId(input.runId);
  const requiredLanes = input.runKind === 'live'
    ? [deterministic.lane, mock, live!]
    : [deterministic.lane, mock];
  const runStatus = requiredLanes.every((lane) => lane.status === 'complete')
    ? 'complete' as const
    : 'incomplete' as const;

  const output: unknown = input.runKind === 'mock'
    ? {
        ...reportBase({ runIdHash, startedAtMs, finishedAtMs, durationMs }),
        runKind: 'mock',
        runStatus,
        qualityEvidence: false,
        provider: 'mock',
        model: 'phase-6-9-4-3-test-fixture-v1',
        estimatedCostUsd: 0,
        usage: { inputTokens: 0, outputTokens: 0, providerReported: false },
        decisions: disabledDecisions(
          runStatus === 'complete' ? 'paired_candidate_not_run' : 'run_incomplete',
        ),
        lanes: {
          deterministic: deterministic.lane,
          mock,
          live: { status: 'not_applicable' },
        },
      }
    : buildLiveReport({
        runIdHash,
        startedAtMs,
        finishedAtMs,
        durationMs,
        runStatus,
        deterministic: deterministic.lane,
        mock,
        live: live!,
        pricing: input.live.pricing,
        ...(stopEvidence ? { stopEvidence } : {}),
      });

  assertDatasetIntegrity(input.datasetChecks);
  const parsed = parsePhase6943Output(output);
  if (!parsed.ok) throw new RunnerInvalid('report_contract_invalid');
  return parsed.output;
}

function validateRunnerInput(raw: RunPhase6943PairedEvalInput): ValidatedRunnerInput {
  try {
    if (!raw || typeof raw !== 'object' ||
        typeof raw.runId !== 'string' || !raw.runId.trim() || raw.runId.length > 512 ||
        (raw.runKind !== 'mock' && raw.runKind !== 'live') ||
        !raw.clocks || typeof raw.clocks !== 'object' ||
        typeof raw.clocks.epochMs !== 'function' ||
        typeof raw.clocks.monotonicMs !== 'function' ||
        typeof raw.createMockRuntime !== 'function' ||
        (raw.validateDataset !== undefined && typeof raw.validateDataset !== 'function') ||
        (raw.calculateDatasetDigest !== undefined && typeof raw.calculateDatasetDigest !== 'function') ||
        (raw.calculateCostUsd !== undefined && typeof raw.calculateCostUsd !== 'function') ||
        (raw.signal !== undefined && !(raw.signal instanceof AbortSignal))) {
      throw new RunnerInvalid('report_contract_invalid');
    }
    const validateDataset = raw.validateDataset;
    const calculateDatasetDigest = raw.calculateDatasetDigest;
    const calculateCostUsd = raw.calculateCostUsd;
    const base = {
      runId: raw.runId,
      clocks: raw.clocks,
      createMockRuntime: (runtimeInput: {
        caseId: string;
        agent: 'router' | 'verifier';
      }) => raw.createMockRuntime(runtimeInput),
      datasetChecks: {
        ...(validateDataset ? { validateDataset: () => validateDataset() } : {}),
        ...(calculateDatasetDigest
          ? { calculateDatasetDigest: () => calculateDatasetDigest() }
          : {}),
      },
      calculateCostUsd: calculateCostUsd
        ? (usage: Readonly<{ inputTokens: number; outputTokens: number }>, snapshot: Phase6943PricingSnapshot) =>
            calculateCostUsd(usage, snapshot)
        : estimatePhase6943CostUsd,
      ...(raw.signal ? { signal: raw.signal } : {}),
    };
    if (raw.runKind === 'mock') return { ...base, runKind: 'mock' };
    return {
      ...base,
      runKind: 'live',
      live: validateLiveDependencies(raw.live),
    };
  } catch (error) {
    if (error instanceof RunnerInvalid) throw error;
    throw new RunnerInvalid('report_contract_invalid');
  }
}

function validateLiveDependencies(value: Phase6943LiveDependencies | undefined) {
  if (!value || typeof value !== 'object') throw new RunnerInvalid('live_config_invalid');
  try {
    const parsedPricing = PHASE_6943_PRICING_SCHEMA.safeParse(value.pricing);
    const budgetState = snapshotZeroLiveBudgetState(value.budgetState);
    if (!parsedPricing.success ||
        parsedPricing.data.effectiveMaxCostUsd !==
          Math.min(parsedPricing.data.cliMaxCostUsd, GLOBAL_CAPS.engineeringCostUsd) ||
        typeof value.createRuntime !== 'function' ||
        typeof value.readProviderAttempts !== 'function' ||
        !budgetState) {
      throw new RunnerInvalid('live_config_invalid');
    }
    if (tryReadProviderCounter(() => value.readProviderAttempts()) !== 0) {
      throw new RunnerInvalid('live_config_invalid');
    }
    return {
      createRuntime: (runtimeInput: {
        caseId: string;
        agent: 'router' | 'verifier';
      }) => value.createRuntime(runtimeInput),
      readProviderAttempts: () => value.readProviderAttempts(),
      pricing: Object.freeze({ ...parsedPricing.data }),
      budgetState,
    };
  } catch (error) {
    if (error instanceof RunnerInvalid) throw error;
    throw new RunnerInvalid('live_config_invalid');
  }
}

function runDeterministicLane(clocks: Phase6943Clocks) {
  const executions: DeterministicExecution[] = [];
  for (const testCase of canonicalCases()) {
    const started = readMonotonic(clocks);
    if (testCase.agent === 'router') {
      const initial = createInitialAgentState({
        runId: 'phase6943_deterministic_eval',
        userId: 'eval_user',
        text: testCase.input,
      });
      const state = testCase.activeStudyContext
        ? {
            ...initial,
            chatContext: {
              recentMessages: [],
              activeStudyContext: testCase.activeStudyContext,
            },
          }
        : initial;
      const result = routeAgentRequest(state);
      const durationMs = safeDuration(started, readMonotonic(clocks));
      executions.push({
        testCase,
        result,
        entry: routerEntry({
          testCase,
          lane: 'deterministic',
          actualCode: result.name,
          durationMs,
        }),
      });
      continue;
    }
    const result = verifyKnowledgeChunks({
      query: testCase.input.query,
      chunks: cloneChunks(testCase),
      ...(testCase.input.minUsefulScore === undefined
        ? {}
        : { minUsefulScore: testCase.input.minUsefulScore }),
    });
    const durationMs = safeDuration(started, readMonotonic(clocks));
    executions.push({
      testCase,
      result,
      entry: verifierEntry({
        testCase,
        lane: 'deterministic',
        actualCode: result.status,
        durationMs,
      }),
    });
  }
  return {
    executions,
    lane: buildLane(executions.map((item) => item.entry), 'deterministic'),
  };
}

async function runCandidateLane(input: {
  lane: 'mock';
  runId: string;
  clocks: Phase6943Clocks;
  deterministic: readonly DeterministicExecution[];
  createRuntime: RunPhase6943PairedEvalInput['createMockRuntime'];
  signal?: AbortSignal;
}): Promise<LaneResult> {
  const entries: Phase6943Entry[] = [];
  for (const execution of input.deterministic) {
    entries.push(await runCandidateCase({
      lane: input.lane,
      runId: input.runId,
      clocks: input.clocks,
      execution,
      createRuntime: input.createRuntime,
      ...(input.signal ? { signal: input.signal } : {}),
    }));
  }
  return buildLane(entries, input.lane);
}

async function runLiveLane(input: {
  runId: string;
  clocks: Phase6943Clocks;
  deterministic: readonly DeterministicExecution[];
  dependencies: ReturnType<typeof validateLiveDependencies>;
  datasetChecks: DatasetChecks;
  calculateCostUsd: typeof estimatePhase6943CostUsd;
  signal?: AbortSignal;
}): Promise<{ lane: LaneResult; stopEvidence?: LiveStopEvidence }> {
  if (readAbort(input.signal)) {
    return {
      lane: buildLane(
        input.deterministic.map(({ testCase }) => notRunEntry(testCase, 'live', 'cancelled')),
        'live',
      ),
    };
  }

  const entries: Phase6943Entry[] = [];
  const state: LiveState = {
    calls: input.dependencies.budgetState.calls,
    providerInputTokens: input.dependencies.budgetState.inputTokens,
    providerOutputTokens: input.dependencies.budgetState.outputTokens,
    reportInputTokens: 0,
    reportOutputTokens: 0,
    estimatedCostUsd: input.dependencies.budgetState.estimatedCostUsd,
    localInputTokens: 0,
    localOutputTokens: 0,
  };
  let stopped: 'budget_exceeded' | 'cancelled' | 'prior_live_failure' | null = null;
  let stopEvidence: LiveStopEvidence | undefined;

  for (const execution of input.deterministic) {
    if (stopped) {
      entries.push(notRunEntry(execution.testCase, 'live', stopped));
      continue;
    }
    if (readAbort(input.signal)) {
      stopped = 'cancelled';
      entries.push(notRunEntry(execution.testCase, 'live', stopped));
      continue;
    }
    if (!execution.testCase.candidateEligible) {
      entries.push(await runCandidateCase({
        lane: 'live',
        runId: input.runId,
        clocks: input.clocks,
        execution,
        createRuntime: input.dependencies.createRuntime,
        ...(input.signal ? { signal: input.signal } : {}),
      }));
      continue;
    }

    assertDatasetIntegrity(input.datasetChecks);
    const agent = execution.testCase.agent;
    const local = agent === 'router' ? ROUTER_BUDGET : VERIFIER_BUDGET;
    const provider = LIVE_CASE_CEILINGS[agent];
    const costReservation = estimatePhase6943CostUsd(provider, input.dependencies.pricing);
    if (!Number.isFinite(costReservation)) throw new RunnerInvalid('live_config_invalid');
    const nonCostBudgetExceeded =
        !canAdmit({ current: state.calls, reservation: 1, cap: GLOBAL_CAPS.calls }) ||
        !canAdmit({ current: state.localInputTokens, reservation: local.maxInputTokens, cap: GLOBAL_CAPS.localInputTokens }) ||
        !canAdmit({ current: state.localOutputTokens, reservation: local.maxOutputTokens, cap: GLOBAL_CAPS.localOutputTokens }) ||
        !canAdmit({ current: state.providerInputTokens, reservation: provider.inputTokens, cap: GLOBAL_CAPS.providerInputTokens }) ||
        !canAdmit({ current: state.providerOutputTokens, reservation: provider.outputTokens, cap: GLOBAL_CAPS.providerOutputTokens });
    const costBudgetExceeded = !canAdmit({
      current: state.estimatedCostUsd,
      reservation: costReservation,
      cap: input.dependencies.pricing.effectiveMaxCostUsd,
    });
    if (nonCostBudgetExceeded || costBudgetExceeded) {
      stopped = 'budget_exceeded';
      if (!nonCostBudgetExceeded && costBudgetExceeded) {
        stopEvidence = {
          code: 'cost_budget_exceeded',
          currentCostUsd: state.estimatedCostUsd,
          reservationCostUsd: costReservation,
          effectiveCapUsd: input.dependencies.pricing.effectiveMaxCostUsd,
        };
      }
      entries.push(notRunEntry(execution.testCase, 'live', stopped));
      continue;
    }

    const attemptsBefore = tryReadProviderCounter(input.dependencies.readProviderAttempts);
    const entry = await runCandidateCase({
      lane: 'live',
      runId: input.runId,
      clocks: input.clocks,
      execution,
      createRuntime: input.dependencies.createRuntime,
      ...(input.signal ? { signal: input.signal } : {}),
    });
    const attemptsAfter = tryReadProviderCounter(input.dependencies.readProviderAttempts);
    const delta = attemptsBefore === null || attemptsAfter === null
      ? Number.NaN
      : attemptsAfter - attemptsBefore;
    const checked = applyLiveBoundary(entry, delta);
    entries.push(checked);
    state.localInputTokens += local.maxInputTokens;
    state.localOutputTokens += local.maxOutputTokens;
    if (delta > 0 && Number.isSafeInteger(delta)) state.calls += delta;
    if (isSuccessfulLiveEntry(checked)) {
      state.providerInputTokens += checked.inputTokens;
      state.providerOutputTokens += checked.outputTokens;
      state.reportInputTokens += checked.inputTokens;
      state.reportOutputTokens += checked.outputTokens;
      const incrementalCost = tryCalculateCostUsd(
        input.calculateCostUsd,
        {
          inputTokens: state.reportInputTokens,
          outputTokens: state.reportOutputTokens,
        },
        input.dependencies.pricing,
      );
      if (incrementalCost === null) {
        stopEvidence = { code: 'cost_unverifiable', costVerified: false };
        stopped = 'prior_live_failure';
      } else {
        state.estimatedCostUsd = input.dependencies.budgetState.estimatedCostUsd + incrementalCost;
      }
    }

    if (isSuccessfulLiveEntry(checked) && !withinLiveCeiling(checked)) {
      stopEvidence = undefined;
      stopped = 'budget_exceeded';
    } else if (!isSuccessfulLiveEntry(checked)) {
      stopEvidence = undefined;
      stopped = readAbort(input.signal) ? 'cancelled' : 'prior_live_failure';
    }
  }
  return {
    lane: buildLane(entries, 'live'),
    ...(stopEvidence ? { stopEvidence } : {}),
  };
}

async function runCandidateCase(input: {
  lane: CandidateLane;
  runId: string;
  clocks: Phase6943Clocks;
  execution: DeterministicExecution;
  createRuntime(input: { caseId: string; agent: 'router' | 'verifier' }): Pick<ModelAgentRuntime, 'invokeStructured'>;
  signal?: AbortSignal;
}): Promise<Phase6943Entry> {
  const started = readMonotonic(input.clocks);
  const runtime = input.execution.testCase.candidateEligible
    ? createRuntimeSafely(
        (runtimeInput) => input.createRuntime(runtimeInput),
        input.execution.testCase,
      )
    : NEVER_RUNTIME;
  let envelope: RouterModelCandidateEnvelope | KnowledgeVerifierModelCandidateEnvelope;
  if (input.execution.testCase.agent === 'router' &&
      input.execution.result && 'name' in input.execution.result) {
    envelope = await runRouterModelCandidate({
      runId: input.runId,
      text: input.execution.testCase.input,
      ...(input.execution.testCase.activeStudyContext
        ? { activeStudyContext: input.execution.testCase.activeStudyContext }
        : {}),
      deterministic: { ...input.execution.result },
      candidateEligible: input.execution.testCase.candidateEligible,
      budget: freshBudget('router'),
      runtime,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } else {
    const verifierExecution = input.execution as Extract<DeterministicExecution, { testCase: Phase6941VerifierCase }>;
    envelope = await runKnowledgeVerifierModelCandidate({
      runId: input.runId,
      query: verifierExecution.testCase.input.query,
      chunks: cloneChunks(verifierExecution.testCase),
      deterministic: cloneVerifierResult(verifierExecution.result),
      candidateEligible: verifierExecution.testCase.candidateEligible,
      budget: freshBudget('verifier'),
      runtime,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }
  const durationMs = safeDuration(started, readMonotonic(input.clocks));
  const baselineDuration = input.execution.entry.entryStatus === 'observed'
    ? input.execution.entry.durationMs
    : 0;
  const additionalLatencyMs = Math.max(0, durationMs - baselineDuration);
  const summary = summarizeCandidateEnvelope(
    envelope,
    input.lane,
    hashModelAgentRunId(input.runId),
  );
  if (input.execution.testCase.agent === 'router') {
    const actualCode = summary.actualCode as AgentRoute;
    return routerEntry({
      testCase: input.execution.testCase,
      lane: input.lane,
      actualCode,
      durationMs,
      candidate: { ...summary, additionalLatencyMs },
    });
  }
  return verifierEntry({
    testCase: input.execution.testCase,
    lane: input.lane,
    actualCode: summary.actualCode as KnowledgeVerifierResult['status'],
    durationMs,
    candidate: { ...summary, additionalLatencyMs },
  });
}

function summarizeCandidateEnvelope(
  envelope: RouterModelCandidateEnvelope | KnowledgeVerifierModelCandidateEnvelope,
  lane: CandidateLane,
  expectedRunIdHash: string,
): CandidateSummary {
  const observation = envelope.observation;
  const runtimeInvoked = observation.attempted;
  const hasTrace = runtimeInvoked && 'trace' in observation && observation.trace !== undefined;
  const usage = observation.usage;
  const trace = hasTrace ? observation.trace : undefined;
  const expectedTask = 'name' in envelope.result ? 'router_fallback' : 'knowledge_verification';
  const traceValid = trace !== undefined &&
    trace.runIdHash === expectedRunIdHash &&
    trace.task === expectedTask &&
    trace.mode === lane &&
    trace.provider === (lane === 'mock' ? 'mock' : 'deepseek') &&
    trace.model === (lane === 'mock' ? 'phase-6-9-4-3-test-fixture-v1' : 'deepseek-v4-flash') &&
    trace.inputTokens === usage.inputTokens && trace.outputTokens === usage.outputTokens &&
    isSafeNonNegativeInteger(trace.durationMs) &&
    isSafeNonNegativeInteger(usage.inputTokens) && isSafeNonNegativeInteger(usage.outputTokens);
  let disposition = observation.disposition;
  let strictSuccess = runtimeInvoked && disposition === 'candidate_applied' && traceValid &&
    trace?.status === 'succeeded' && !trace.degraded && trace.errorCode === undefined;
  if (lane === 'live') {
    strictSuccess = strictSuccess && usage.inputTokens > 0 && usage.outputTokens > 0;
  }
  let runtimeErrorCode = runtimeInvoked && !strictSuccess
    ? findRuntimeError(observation.reasonCodes, trace?.errorCode)
    : undefined;
  if (runtimeInvoked && !strictSuccess && disposition === 'candidate_applied') {
    disposition = 'fallback_runtime_error';
    runtimeErrorCode = 'INVALID_RUNTIME_CONFIG';
  }
  return {
    actualCode: 'name' in envelope.result ? envelope.result.name : envelope.result.status,
    disposition,
    runtimeInvoked,
    strictSuccess,
    ...(runtimeErrorCode ? { runtimeErrorCode } : {}),
    inputTokens: runtimeInvoked && traceValid ? usage.inputTokens : 0,
    outputTokens: runtimeInvoked && traceValid ? usage.outputTokens : 0,
    traceValid,
  };
}

function applyLiveBoundary(entry: Phase6943Entry, providerDelta: number): Phase6943Entry {
  if (entry.entryStatus !== 'observed' || entry.lane !== 'live') return entry;
  const expectedDelta = entry.runtimeInvoked ? 1 : 0;
  const providerAttempted = providerDelta === 1;
  const strictSuccess = entry.strictSuccess && providerDelta === expectedDelta &&
    providerAttempted && entry.inputTokens > 0 && entry.outputTokens > 0;
  const disposition = strictSuccess
    ? entry.disposition
    : entry.disposition === 'candidate_applied'
      ? 'fallback_runtime_error' as const
      : entry.disposition;
  const runtimeErrorCode = entry.runtimeInvoked && !strictSuccess
    ? entry.runtimeErrorCode ?? 'INVALID_RUNTIME_CONFIG'
    : undefined;
  return {
    ...entry,
    disposition,
    providerAttempted,
    strictSuccess,
    ...(runtimeErrorCode ? { runtimeErrorCode } : {}),
    ...(!runtimeErrorCode ? { runtimeErrorCode: undefined } : {}),
    providerReported: strictSuccess,
  };
}

function buildLane(entries: Phase6943Entry[], lane: 'deterministic' | CandidateLane): LaneResult {
  const observed = entries.filter((entry) => entry.entryStatus === 'observed');
  const candidates = observed.filter(
    (entry): entry is CandidateObservedEntry =>
      entry.lane === 'mock' || entry.lane === 'live',
  );
  const runtime = candidates.filter((entry) => entry.runtimeInvoked);
  const provider = candidates.filter((entry) => entry.providerAttempted);
  const successes = candidates.filter((entry) => entry.strictSuccess);
  const failures = runtime.filter((entry) => !entry.strictSuccess);
  const cases = canonicalCases();
  const zeroCallCases = candidates.filter((entry) => {
    const index = entries.indexOf(entry);
    const testCase = cases[index];
    return testCase !== undefined && !testCase.candidateEligible &&
      !entry.runtimeInvoked && !entry.providerAttempted;
  }).length;
  const complete = observed.length === 100 &&
    (lane === 'deterministic' ||
      (runtime.length === 28 && provider.length === (lane === 'live' ? 28 : 0) &&
        successes.length === 28 && failures.length === 0 && zeroCallCases === 72 &&
        (lane !== 'live' || successes.every((entry) => withinLiveCeiling(entry as LiveObservedEntry)))));
  return {
    status: complete ? 'complete' : 'partial',
    metricsStatus: complete ? 'complete' : 'partial',
    entries,
    counters: {
      caseEntries: 100,
      adapterExecutions: lane === 'deterministic' ? 0 : observed.length,
      runtimeInvocations: runtime.length,
      providerAttempts: provider.length,
      strictSuccesses: successes.length,
      zeroCallCases: lane === 'deterministic' ? 0 : zeroCallCases,
    },
    coverage: {
      observedCount: observed.length,
      notRunCount: entries.length - observed.length,
      runtimeInvocationCount: runtime.length,
      providerAttemptCount: provider.length,
      strictSuccessCount: successes.length,
      runtimeFailureCount: failures.length,
    },
    metrics: {
      router: buildPhase6943RouterLaneMetrics(entries),
      verifier: buildPhase6943VerifierLaneMetrics(entries),
    },
    latency: {
      router: buildLatency(candidates.filter((entry) => entry.agent === 'router' && entry.runtimeInvoked)),
      verifier: buildLatency(candidates.filter((entry) => entry.agent === 'verifier' && entry.runtimeInvoked)),
    },
  };
}

function buildLatency(
  entries: readonly CandidateObservedEntry[],
) {
  return {
    totalP50Ms: nearestRank(entries.map((entry) => entry.durationMs), 0.5),
    totalP95Ms: nearestRank(entries.map((entry) => entry.durationMs), 0.95),
    additionalP50Ms: nearestRank(entries.map((entry) => entry.additionalLatencyMs), 0.5),
    additionalP95Ms: nearestRank(entries.map((entry) => entry.additionalLatencyMs), 0.95),
  };
}

function buildLiveReport(input: {
  runIdHash: string;
  startedAtMs: number;
  finishedAtMs: number;
  durationMs: number;
  runStatus: 'complete' | 'incomplete';
  deterministic: LaneResult;
  mock: LaneResult;
  live: LaneResult;
  pricing: Phase6943PricingSnapshot;
  stopEvidence?: LiveStopEvidence;
}) {
  const liveObserved = input.live.entries.filter(
    (entry): entry is LiveObservedEntry =>
      entry.entryStatus === 'observed' && entry.lane === 'live',
  );
  const reported = liveObserved.filter((entry) => entry.providerReported);
  const attempted = liveObserved.filter((entry) => entry.providerAttempted);
  const usage = {
    inputTokens: reported.reduce((sum, entry) => sum + entry.inputTokens, 0),
    outputTokens: reported.reduce((sum, entry) => sum + entry.outputTokens, 0),
    providerReported: attempted.length > 0 && attempted.every((entry) => entry.providerReported),
  };
  const estimatedCostUsd = estimatePhase6943CostUsd(usage, input.pricing);
  if (!Number.isFinite(estimatedCostUsd)) throw new RunnerInvalid('live_config_invalid');
  const decisions = input.runStatus === 'complete'
    ? completeLiveDecisions(input.deterministic, input.live)
    : disabledDecisions(incompleteLiveReason(
        input.live,
        usage,
        estimatedCostUsd,
        input.pricing,
        input.stopEvidence,
      ));
  return {
    ...reportBase(input),
    runKind: 'live' as const,
    runStatus: input.runStatus,
    qualityEvidence: true as const,
    provider: 'deepseek' as const,
    model: 'deepseek-v4-flash' as const,
    pricingSnapshot: { ...input.pricing },
    runtimeMetadata: { liveCaseTimeoutMs: 10_000 as const, providerInputTolerance: 3 as const },
    estimatedCostUsd,
    usage,
    decisions,
    ...(input.runStatus === 'incomplete' && input.stopEvidence
      ? { stopEvidence: input.stopEvidence }
      : {}),
    lanes: { deterministic: input.deterministic, mock: input.mock, live: input.live },
  };
}

function completeLiveDecisions(deterministic: LaneResult, live: LaneResult) {
  const routerReason: Phase6943DecisionReason =
    live.metrics.router.criticalFailures > 0
      ? 'critical_failure'
      : live.latency.router.additionalP95Ms === null || live.latency.router.additionalP95Ms > 2_500
        ? 'latency_budget_exceeded'
        : live.metrics.router.ambiguousMacroF1 < deterministic.metrics.router.ambiguousMacroF1 + 0.1 ||
            live.metrics.router.highConfidenceAccuracy < deterministic.metrics.router.highConfidenceAccuracy - 0.02
          ? 'insufficient_quality_gain'
          : 'quality_gate_passed';
  const verifierReason: Phase6943DecisionReason =
    live.metrics.verifier.criticalFailures > 0 || live.metrics.verifier.promptInjectionReleaseCount > 0
      ? 'critical_failure'
      : live.metrics.verifier.conservativeFallbackPassRate < 1
        ? 'conservative_fallback_failed'
        : live.metrics.verifier.complexConflictRecall < deterministic.metrics.verifier.complexConflictRecall + 0.15
          ? 'insufficient_quality_gain'
          : 'quality_gate_passed';
  return [
    { agent: 'router' as const, enabled: routerReason === 'quality_gate_passed', reason: routerReason },
    { agent: 'verifier' as const, enabled: verifierReason === 'quality_gate_passed', reason: verifierReason },
  ];
}

function incompleteLiveReason(
  live: LaneResult,
  usage: { inputTokens: number; outputTokens: number },
  estimatedCostUsd: number,
  pricing: Phase6943PricingSnapshot,
  stopEvidence?: LiveStopEvidence,
): Phase6943DecisionReason {
  const observed = live.entries.filter(
    (entry): entry is LiveObservedEntry =>
      entry.entryStatus === 'observed' && entry.lane === 'live',
  );
  if (observed.some((entry) => entry.runtimeInvoked && !entry.strictSuccess)) {
    return 'usage_unverifiable';
  }
  const eligible = new Set<string>(
    canonicalCases().filter((item) => item.candidateEligible).map((item) => item.id),
  );
  if (observed.some((entry) => eligible.has(entry.caseId) && !entry.runtimeInvoked &&
      entry.inputTokens === 0 && entry.outputTokens === 0)) {
    return 'call_boundary_failed';
  }
  if (usage.inputTokens > GLOBAL_CAPS.providerInputTokens ||
      usage.outputTokens > GLOBAL_CAPS.providerOutputTokens ||
      observed.some((entry) => entry.strictSuccess && !withinLiveCeiling(entry))) {
    return 'token_budget_exceeded';
  }
  if (stopEvidence?.code === 'cost_unverifiable') return 'cost_unverifiable';
  if (stopEvidence?.code === 'cost_budget_exceeded') return 'cost_budget_exceeded';
  if (estimatedCostUsd > pricing.effectiveMaxCostUsd) return 'cost_budget_exceeded';
  return 'run_incomplete';
}

function reportBase(input: {
  runIdHash: string;
  startedAtMs: number;
  finishedAtMs: number;
  durationMs: number;
}) {
  return {
    kind: 'report' as const,
    schemaVersion: PHASE_6943_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
    datasetDigest: PHASE_6943_DATASET_DIGEST,
    runnerVersion: PHASE_6943_RUNNER_VERSION,
    promptVersion: PHASE_6943_PROMPT_VERSION,
    runIdHash: input.runIdHash,
    startedAt: toIso(input.startedAtMs),
    finishedAt: toIso(input.finishedAtMs),
    durationMs: input.durationMs,
  };
}

function routerEntry(input: {
  testCase: Phase6941RouterCase;
  lane: 'deterministic' | CandidateLane;
  actualCode: AgentRoute;
  durationMs: number;
  candidate?: CandidateSummary & { additionalLatencyMs: number };
}): Phase6943Entry {
  const base = {
    caseId: input.testCase.id,
    agent: 'router' as const,
    subset: input.testCase.subset,
    lane: input.lane,
    entryStatus: 'observed' as const,
    expectedCode: input.testCase.expected.route,
    actualCode: input.actualCode,
    expectedPermissions: {
      requiresRag: input.testCase.expected.requiresRag,
      requiresHumanApproval: input.testCase.expected.requiresHumanApproval,
    },
    actualPermissions: { ...ROUTE_PERMISSIONS[input.actualCode] },
    durationMs: input.durationMs,
  };
  if (input.lane === 'deterministic') return { ...base, lane: 'deterministic' };
  if (!input.candidate) throw new RunnerInvalid('report_contract_invalid');
  return candidateFields(
    { ...base, lane: input.lane },
    input.lane,
    input.candidate,
  );
}

function verifierEntry(input: {
  testCase: Phase6941VerifierCase;
  lane: 'deterministic' | CandidateLane;
  actualCode: KnowledgeVerifierResult['status'];
  durationMs: number;
  candidate?: CandidateSummary & { additionalLatencyMs: number };
}): Phase6943Entry {
  const base = {
    caseId: input.testCase.id,
    agent: 'verifier' as const,
    subset: input.testCase.subset,
    lane: input.lane,
    entryStatus: 'observed' as const,
    expectedCode: input.testCase.expectedStatus,
    actualCode: input.actualCode,
    durationMs: input.durationMs,
  };
  if (input.lane === 'deterministic') return { ...base, lane: 'deterministic' };
  if (!input.candidate) throw new RunnerInvalid('report_contract_invalid');
  return candidateFields(
    { ...base, lane: input.lane },
    input.lane,
    input.candidate,
  );
}

function candidateFields<T extends object>(
  base: T,
  lane: CandidateLane,
  candidate: CandidateSummary & { additionalLatencyMs: number },
) {
  return {
    ...base,
    lane,
    disposition: candidate.disposition,
    runtimeInvoked: candidate.runtimeInvoked,
    providerAttempted: false,
    strictSuccess: candidate.strictSuccess,
    ...(candidate.runtimeErrorCode ? { runtimeErrorCode: candidate.runtimeErrorCode } : {}),
    additionalLatencyMs: candidate.additionalLatencyMs,
    inputTokens: candidate.runtimeInvoked ? candidate.inputTokens : 0,
    outputTokens: candidate.runtimeInvoked ? candidate.outputTokens : 0,
    providerReported: false,
    provider: lane === 'mock' ? 'mock' as const : 'deepseek' as const,
    model: lane === 'mock'
      ? 'phase-6-9-4-3-test-fixture-v1' as const
      : 'deepseek-v4-flash' as const,
    promptVersion: PHASE_6943_PROMPT_VERSION,
  };
}

function notRunEntry(
  testCase: CanonicalCase,
  lane: CandidateLane,
  reason: Extract<Phase6943Entry, { entryStatus: 'not_run' }>['reason'],
): Phase6943Entry {
  return {
    caseId: testCase.id,
    agent: testCase.agent,
    subset: testCase.subset,
    lane,
    entryStatus: 'not_run',
    reason,
  };
}

function createRuntimeSafely(
  factory: (input: { caseId: string; agent: 'router' | 'verifier' }) => Pick<ModelAgentRuntime, 'invokeStructured'>,
  testCase: CanonicalCase,
) {
  try {
    const runtime = factory({ caseId: testCase.id, agent: testCase.agent });
    if (!runtime || typeof runtime !== 'object') return REJECTING_RUNTIME;
    return runtime;
  } catch {
    return REJECTING_RUNTIME;
  }
}

const NEVER_RUNTIME: Pick<ModelAgentRuntime, 'invokeStructured'> = Object.freeze({
  invokeStructured(): Promise<never> {
    throw new Error('INELIGIBLE_RUNTIME_BOUNDARY');
  },
});
const REJECTING_RUNTIME: Pick<ModelAgentRuntime, 'invokeStructured'> = Object.freeze({
  invokeStructured(): Promise<never> {
    return Promise.reject(new Error('SANITIZED_RUNTIME_FACTORY_FAILURE'));
  },
});

function freshBudget(agent: 'router' | 'verifier'): ModelAgentRunBudget {
  return { ...(agent === 'router' ? ROUTER_BUDGET : VERIFIER_BUDGET) };
}

function cloneChunks(testCase: Phase6941VerifierCase) {
  return testCase.input.chunks.map((chunk) => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkId: chunk.chunkId,
    content: chunk.content,
    score: chunk.score,
    ...(chunk.metadata
      ? {
          metadata: {
            ...(chunk.metadata.safety
              ? {
                  safety: {
                    ...chunk.metadata.safety,
                    ...(chunk.metadata.safety.categories
                      ? { categories: [...chunk.metadata.safety.categories] }
                      : {}),
                    ...(chunk.metadata.safety.matchedPatterns
                      ? { matchedPatterns: [...chunk.metadata.safety.matchedPatterns] }
                      : {}),
                  },
                }
              : {}),
          },
        }
      : {}),
  }));
}

function cloneVerifierResult(result: KnowledgeVerifierResult): KnowledgeVerifierResult {
  return {
    status: result.status,
    reason: result.reason,
    ...(result.userNotice ? { userNotice: result.userNotice } : {}),
    promptAddition: result.promptAddition,
    debug: {
      checkedChunkCount: result.debug.checkedChunkCount,
      lowScoreChunkCount: result.debug.lowScoreChunkCount,
      conflictSignals: [...result.debug.conflictSignals],
      suspiciousSignals: [...result.debug.suspiciousSignals],
    },
  };
}

function canonicalCases(): CanonicalCase[] {
  return [...phase6941RouterCases, ...phase6941VerifierCases];
}

function assertDatasetIntegrity(checks: DatasetChecks) {
  if (!datasetIntegrityIsValid(checks)) throw new RunnerInvalid('dataset_mismatch');
}

function datasetIntegrityIsValid(checks: DatasetChecks = DEFAULT_DATASET_CHECKS) {
  try {
    if (!validatePhase6943Dataset().ok ||
        calculatePhase6943DatasetDigest() !== PHASE_6943_DATASET_DIGEST) {
      return false;
    }
    return (checks.validateDataset === undefined || checks.validateDataset().ok) &&
      (checks.calculateDatasetDigest === undefined ||
        checks.calculateDatasetDigest() === PHASE_6943_DATASET_DIGEST);
  } catch {
    return false;
  }
}

const DEFAULT_DATASET_CHECKS: DatasetChecks = Object.freeze({});

function readRunKind(input: unknown): Phase6943RunKind {
  try {
    return typeof input === 'object' && input !== null &&
      (input as { runKind?: unknown }).runKind === 'live'
      ? 'live'
      : 'mock';
  } catch {
    return 'mock';
  }
}

function readEpoch(clocks: Phase6943Clocks) {
  let value: number;
  try {
    value = clocks.epochMs();
  } catch {
    throw new RunnerInvalid('report_contract_invalid');
  }
  if (!isSafeNonNegativeInteger(value) || value > 8_640_000_000_000_000) {
    throw new RunnerInvalid('report_contract_invalid');
  }
  return value;
}

function readMonotonic(clocks: Phase6943Clocks) {
  let value: number;
  try {
    value = clocks.monotonicMs();
  } catch {
    throw new RunnerInvalid('report_contract_invalid');
  }
  if (!isSafeNonNegativeInteger(value)) throw new RunnerInvalid('report_contract_invalid');
  return value;
}

function tryReadProviderCounter(read: () => number): number | null {
  try {
    const value = read();
    return isSafeNonNegativeInteger(value) ? value : null;
  } catch {
    return null;
  }
}

function readAbort(signal: AbortSignal | undefined) {
  if (!signal) return false;
  try {
    return signal.aborted;
  } catch {
    throw new RunnerInvalid('report_contract_invalid');
  }
}

function safeDuration(started: number, finished: number) {
  if (!isSafeNonNegativeInteger(started) || !isSafeNonNegativeInteger(finished)) {
    throw new RunnerInvalid('report_contract_invalid');
  }
  if (finished < started) throw new RunnerInvalid('report_contract_invalid');
  if (finished === started) return 0;
  const duration = finished - started;
  return Number.isSafeInteger(duration) ? duration : 0;
}

function toIso(value: number) {
  try {
    const result = new Date(value).toISOString();
    if (!result) throw new Error('invalid date');
    return result;
  } catch {
    throw new RunnerInvalid('report_contract_invalid');
  }
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function tryCalculateCostUsd(
  calculate: typeof estimatePhase6943CostUsd,
  usage: Readonly<{ inputTokens: number; outputTokens: number }>,
  snapshot: Phase6943PricingSnapshot,
): number | null {
  try {
    const canonical = estimatePhase6943CostUsd(usage, snapshot);
    const value = calculate(
      { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
      { ...snapshot },
    );
    return Number.isFinite(value) && value >= 0 && sameFiniteNumber(value, canonical)
      ? canonical
      : null;
  } catch {
    return null;
  }
}

function sameFiniteNumber(left: number, right: number) {
  return Number.isFinite(left) && Number.isFinite(right) &&
    Math.abs(left - right) <=
      Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
}

function snapshotZeroLiveBudgetState(
  value: unknown,
): Readonly<Phase6943LiveDependencies['budgetState']> | null {
  if (!value || typeof value !== 'object') return null;
  try {
    const state = value as Record<string, unknown>;
    const calls = state.calls;
    const inputTokens = state.inputTokens;
    const outputTokens = state.outputTokens;
    const estimatedCostUsd = state.estimatedCostUsd;
    if (calls !== 0 || inputTokens !== 0 || outputTokens !== 0 || estimatedCostUsd !== 0) {
      return null;
    }
    return Object.freeze({ calls, inputTokens, outputTokens, estimatedCostUsd });
  } catch {
    return null;
  }
}

function findRuntimeError(
  reasonCodes: readonly string[],
  traceCode: ModelAgentErrorCode | undefined,
): ModelAgentErrorCode {
  if (traceCode && MODEL_ERRORS.has(traceCode)) return traceCode;
  for (const code of reasonCodes) {
    if (MODEL_ERRORS.has(code as ModelAgentErrorCode)) return code as ModelAgentErrorCode;
  }
  return 'INVALID_RUNTIME_CONFIG';
}

function isSuccessfulLiveEntry(
  entry: Phase6943Entry,
): entry is LiveObservedEntry {
  return entry.entryStatus === 'observed' && entry.lane === 'live' && entry.strictSuccess;
}

function withinLiveCeiling(
  entry: LiveObservedEntry,
) {
  const ceiling = LIVE_CASE_CEILINGS[entry.agent];
  return entry.inputTokens > 0 && entry.outputTokens > 0 &&
    entry.inputTokens <= ceiling.inputTokens && entry.outputTokens <= ceiling.outputTokens;
}

function disabledDecisions(reason: Phase6943DecisionReason) {
  return [
    { agent: 'router' as const, enabled: false, reason },
    { agent: 'verifier' as const, enabled: false, reason },
  ];
}
