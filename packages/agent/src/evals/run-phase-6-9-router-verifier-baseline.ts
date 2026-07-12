import { verifyKnowledgeChunks } from '../nodes/knowledge-verifier.ts';
import { routeAgentRequest } from '../router.ts';
import { createInitialAgentState } from '../state.ts';
import {
  buildAgentEvalSummary,
  createAgentEvalOutcome,
  type AgentEvalRun,
  type AgentEvalSummary,
} from './phase-6-9-eval-contract.ts';
import {
  PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
  phase6941RouterCases,
  phase6941VerifierCases,
  type Phase6941RouterCase,
  type Phase6941VerifierCase,
} from './phase-6-9-router-verifier-cases.ts';
import {
  buildRouterEvalMetrics,
  buildVerifierEvalMetrics,
  type EvalMetricsResult,
  type RouterEvalMetrics,
  type RouterEvalObservation,
  type VerifierEvalMetrics,
  type VerifierEvalObservation,
} from './phase-6-9-router-verifier-metrics.ts';

export type Phase6941RouterVerifierBaselineReport = {
  datasetVersion: typeof PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION;
  routerRuns: AgentEvalRun[];
  verifierRuns: AgentEvalRun[];
  summary: AgentEvalSummary;
  routerMetrics: EvalMetricsResult<RouterEvalMetrics>;
  verifierMetrics: EvalMetricsResult<VerifierEvalMetrics>;
};

export function runPhase6941RouterVerifierBaseline(): Phase6941RouterVerifierBaselineReport {
  const routerResults = phase6941RouterCases.map(runRouterCase);
  const verifierResults = phase6941VerifierCases.map(runVerifierCase);
  const routerRuns = routerResults.map((result) => result.run);
  const verifierRuns = verifierResults.map((result) => result.run);

  return {
    datasetVersion: PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
    routerRuns,
    verifierRuns,
    summary: buildAgentEvalSummary([...routerRuns, ...verifierRuns]),
    routerMetrics: buildRouterEvalMetrics(
      routerResults.map((result) => result.observation),
    ),
    verifierMetrics: buildVerifierEvalMetrics(
      verifierResults.map((result) => result.observation),
    ),
  };
}

function runRouterCase(testCase: Phase6941RouterCase): {
  run: AgentEvalRun;
  observation: RouterEvalObservation;
} {
  const startedAt = Date.now();

  try {
    const initialState = createInitialAgentState({
      runId: `eval_${testCase.id}`,
      userId: 'eval_user',
      text: testCase.input,
    });
    const state = testCase.activeStudyContext
      ? {
          ...initialState,
          chatContext: {
            recentMessages: [],
            activeStudyContext: testCase.activeStudyContext,
          },
        }
      : initialState;
    const actual = routeAgentRequest(state);
    const boundaryMatches =
      actual.requiresRag === testCase.expected.requiresRag &&
      actual.requiresHumanApproval ===
        testCase.expected.requiresHumanApproval;
    const passed = actual.name === testCase.expected.route && boundaryMatches;
    const observation: RouterEvalObservation = {
      caseId: testCase.id,
      subset: testCase.subset,
      expectedRoute: testCase.expected.route,
      actualRoute: actual.name,
      expectedRequiresRag: testCase.expected.requiresRag,
      actualRequiresRag: actual.requiresRag,
      expectedRequiresHumanApproval:
        testCase.expected.requiresHumanApproval,
      actualRequiresHumanApproval: actual.requiresHumanApproval,
      criticalSafetyCase: testCase.criticalSafetyCase,
    };

    return {
      observation,
      run: createRun({
        testCase,
        passed,
        startedAt,
        expectedCode: testCase.expected.route,
        actualCode: actual.name,
        ...(actual.name === testCase.expected.route && !boundaryMatches
          ? { errorCode: 'router_boundary_mismatch' }
          : {}),
      }),
    };
  } catch {
    const actualRoute = differentRoute(testCase.expected.route);
    return {
      observation: {
        caseId: testCase.id,
        subset: testCase.subset,
        expectedRoute: testCase.expected.route,
        actualRoute,
        expectedRequiresRag: testCase.expected.requiresRag,
        actualRequiresRag: !testCase.expected.requiresRag,
        expectedRequiresHumanApproval:
          testCase.expected.requiresHumanApproval,
        actualRequiresHumanApproval:
          !testCase.expected.requiresHumanApproval,
        criticalSafetyCase: testCase.criticalSafetyCase,
      },
      run: createRun({
        testCase,
        passed: false,
        startedAt,
        expectedCode: testCase.expected.route,
        actualCode: 'deterministic_error',
        errorCode: 'deterministic_error',
      }),
    };
  }
}

function runVerifierCase(testCase: Phase6941VerifierCase): {
  run: AgentEvalRun;
  observation: VerifierEvalObservation;
} {
  const startedAt = Date.now();

  try {
    const actual = verifyKnowledgeChunks({
      query: testCase.input.query,
      chunks: [...testCase.input.chunks],
      ...(testCase.input.minUsefulScore === undefined
        ? {}
        : { minUsefulScore: testCase.input.minUsefulScore }),
    });
    const passed = actual.status === testCase.expectedStatus;
    return {
      observation: {
        caseId: testCase.id,
        subset: testCase.subset,
        expectedStatus: testCase.expectedStatus,
        actualStatus: actual.status,
        criticalSafetyCase: testCase.criticalSafetyCase,
        candidateAttempted: false,
        runtimeFailed: false,
      },
      run: createRun({
        testCase,
        passed,
        startedAt,
        expectedCode: testCase.expectedStatus,
        actualCode: actual.status,
      }),
    };
  } catch {
    const actualStatus = differentStatus(testCase.expectedStatus);
    return {
      observation: {
        caseId: testCase.id,
        subset: testCase.subset,
        expectedStatus: testCase.expectedStatus,
        actualStatus,
        criticalSafetyCase: testCase.criticalSafetyCase,
        candidateAttempted: false,
        runtimeFailed: true,
      },
      run: createRun({
        testCase,
        passed: false,
        startedAt,
        expectedCode: testCase.expectedStatus,
        actualCode: 'deterministic_error',
        errorCode: 'deterministic_error',
      }),
    };
  }
}

function createRun(input: {
  testCase: Phase6941RouterCase | Phase6941VerifierCase;
  passed: boolean;
  startedAt: number;
  expectedCode: string;
  actualCode: string;
  errorCode?: string;
}): AgentEvalRun {
  return {
    caseId: input.testCase.id,
    agent: input.testCase.agent,
    mode: 'deterministic',
    datasetVersion: PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
    passed: input.passed,
    criticalFailure: input.testCase.criticalSafetyCase && !input.passed,
    latencyMs: Math.max(0, Date.now() - input.startedAt),
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    outcome: createAgentEvalOutcome({
      expectedCode: input.expectedCode,
      actualCode: input.actualCode,
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    }),
  };
}

function differentRoute(expected: Phase6941RouterCase['expected']['route']) {
  return expected === 'chat' ? ('tutor' as const) : ('chat' as const);
}

function differentStatus(expected: Phase6941VerifierCase['expectedStatus']) {
  return expected === 'trusted' ? ('suspicious' as const) : ('trusted' as const);
}
