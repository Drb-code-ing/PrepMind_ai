export type AgentEvalAgent = 'router' | 'verifier' | 'memory' | 'orchestrator';
export type AgentEvalMode = 'deterministic' | 'mock' | 'live';

declare const safeAgentEvalCodeBrand: unique symbol;
export type SafeAgentEvalCode = string & {
  readonly [safeAgentEvalCodeBrand]: 'SafeAgentEvalCode';
};

export type AgentEvalOutcome = {
  expectedCode: SafeAgentEvalCode;
  actualCode: SafeAgentEvalCode;
  errorCode?: SafeAgentEvalCode;
};

export type AgentEvalRun = {
  caseId: string;
  agent: AgentEvalAgent;
  mode: AgentEvalMode;
  datasetVersion: string;
  passed: boolean;
  criticalFailure: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  outcome: AgentEvalOutcome;
};

export type AgentEvalSummary = {
  total: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  passRate: number;
  p95LatencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
};

export type AgentModelPathDecisionInput = {
  agent: AgentEvalAgent;
  baselineScore: number;
  candidateScore: number;
  minimumImprovement: number;
  criticalFailures: number;
  latencyWithinBudget: boolean;
  costWithinBudget: boolean;
};

export type AgentModelPathDecision = {
  enabled: boolean;
  reason:
    | 'quality_gate_passed'
    | 'invalid_metrics'
    | 'insufficient_quality_gain'
    | 'critical_failure'
    | 'latency_budget_exceeded'
    | 'cost_budget_exceeded';
};

export function createAgentEvalOutcome(input: {
  expectedCode: string;
  actualCode: string;
  errorCode?: string;
}): AgentEvalOutcome {
  return {
    expectedCode: toSafeCode(input.expectedCode),
    actualCode: toSafeCode(input.actualCode),
    ...(input.errorCode ? { errorCode: toSafeCode(input.errorCode) } : {}),
  };
}

export function buildAgentEvalSummary(runs: readonly AgentEvalRun[]): AgentEvalSummary {
  const latencies = runs.map((run) => run.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
  const passed = runs.filter((run) => run.passed).length;

  return {
    total: runs.length,
    passed,
    failed: runs.length - passed,
    criticalFailures: runs.filter((run) => run.criticalFailure).length,
    passRate: runs.length === 0 ? 0 : passed / runs.length,
    p95LatencyMs: latencies[p95Index] ?? 0,
    inputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
    outputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
    estimatedCost: runs.reduce((sum, run) => sum + run.estimatedCost, 0),
  };
}

export function decideAgentModelPath(input: AgentModelPathDecisionInput): AgentModelPathDecision {
  if (
    !isScore(input.baselineScore) ||
    !isScore(input.candidateScore) ||
    !isScore(input.minimumImprovement) ||
    !Number.isInteger(input.criticalFailures) ||
    input.criticalFailures < 0
  ) {
    return { enabled: false, reason: 'invalid_metrics' };
  }
  if (input.criticalFailures > 0) {
    return { enabled: false, reason: 'critical_failure' };
  }
  if (!input.latencyWithinBudget) {
    return { enabled: false, reason: 'latency_budget_exceeded' };
  }
  if (!input.costWithinBudget) {
    return { enabled: false, reason: 'cost_budget_exceeded' };
  }
  if (input.candidateScore - input.baselineScore < input.minimumImprovement) {
    return { enabled: false, reason: 'insufficient_quality_gain' };
  }
  return { enabled: true, reason: 'quality_gate_passed' };
}

function isScore(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function toSafeCode(value: string): SafeAgentEvalCode {
  return (/^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : 'redacted') as SafeAgentEvalCode;
}
