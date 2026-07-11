import { analyzeMemory } from '../nodes/memory.ts';
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
  PHASE_69_SEED_DATASET_VERSION,
  phase69SeedCases,
  type Phase69MemorySeedCase,
  type Phase69OrchestratorSeedCase,
  type Phase69RouterSeedCase,
  type Phase69VerifierSeedCase,
} from './phase-6-9-seed-cases.ts';

export type Phase69BaselineReport = {
  datasetVersion: typeof PHASE_69_SEED_DATASET_VERSION;
  runs: AgentEvalRun[];
  expectationOnly: Phase69OrchestratorSeedCase[];
  summary: AgentEvalSummary;
};

export function runPhase69DeterministicBaseline(): Phase69BaselineReport {
  const executableCases = phase69SeedCases.filter(
    (testCase): testCase is Exclude<typeof testCase, Phase69OrchestratorSeedCase> =>
      testCase.agent !== 'orchestrator',
  );
  const expectationOnly = phase69SeedCases.filter(
    (testCase): testCase is Phase69OrchestratorSeedCase =>
      testCase.agent === 'orchestrator',
  );
  const runs = executableCases.map(runExecutableCase);

  return {
    datasetVersion: PHASE_69_SEED_DATASET_VERSION,
    runs,
    expectationOnly,
    summary: buildAgentEvalSummary(runs),
  };
}

function runExecutableCase(
  testCase: Phase69RouterSeedCase | Phase69VerifierSeedCase | Phase69MemorySeedCase,
): AgentEvalRun {
  const startedAt = Date.now();
  const result = evaluateCase(testCase);

  return {
    caseId: testCase.id,
    agent: testCase.agent,
    mode: 'deterministic',
    datasetVersion: PHASE_69_SEED_DATASET_VERSION,
    passed: result.passed,
    criticalFailure: testCase.criticalSafetyCase && !result.passed,
    latencyMs: Math.max(0, Date.now() - startedAt),
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    outcome: createAgentEvalOutcome({
      expectedCode: result.expectedCode,
      actualCode: result.actualCode,
    }),
  };
}

function evaluateCase(
  testCase: Phase69RouterSeedCase | Phase69VerifierSeedCase | Phase69MemorySeedCase,
) {
  if (testCase.agent === 'router') {
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
    const result = routeAgentRequest(state);
    return {
      passed: result.name === testCase.expectedRoute,
      expectedCode: testCase.expectedRoute,
      actualCode: result.name,
    };
  }

  if (testCase.agent === 'verifier') {
    const result = verifyKnowledgeChunks(testCase.input);
    return {
      passed: result.status === testCase.expectedStatus,
      expectedCode: testCase.expectedStatus,
      actualCode: result.status,
    };
  }

  const result = analyzeMemory(testCase.input);
  const actualTypes = result.candidates.map((candidate) => candidate.type).sort();
  const expectedTypes = [...testCase.expectedCandidateTypes].sort();
  return {
    passed: JSON.stringify(actualTypes) === JSON.stringify(expectedTypes),
    expectedCode: expectedTypes.join('.') || 'none',
    actualCode: actualTypes.join('.') || 'none',
  };
}
