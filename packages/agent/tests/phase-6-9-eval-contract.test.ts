import { describe, expect, it } from 'bun:test';

import {
  buildAgentEvalSummary,
  createAgentEvalOutcome,
  decideAgentModelPath,
  type AgentEvalRun,
} from '../src/evals/phase-6-9-eval-contract';

const runs: AgentEvalRun[] = [
  {
    caseId: 'router_chat_1',
    agent: 'router',
    mode: 'deterministic',
    datasetVersion: 'phase-6.9-seed-v1',
    passed: true,
    criticalFailure: false,
    latencyMs: 2,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    outcome: createAgentEvalOutcome({ expectedCode: 'chat', actualCode: 'chat' }),
  },
  {
    caseId: 'router_ambiguous_1',
    agent: 'router',
    mode: 'deterministic',
    datasetVersion: 'phase-6.9-seed-v1',
    passed: false,
    criticalFailure: false,
    latencyMs: 1,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    outcome: createAgentEvalOutcome({
      expectedCode: 'rag_answer',
      actualCode: 'tutor',
    }),
  },
];

describe('Phase 6.9 agent eval contract', () => {
  it('builds reproducible metrics without dividing by zero', () => {
    expect(buildAgentEvalSummary(runs)).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      criticalFailures: 0,
      passRate: 0.5,
      p95LatencyMs: 2,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
    });
    expect(buildAgentEvalSummary([]).passRate).toBe(0);
  });

  it('keeps deterministic when quality or safety gates fail', () => {
    expect(
      decideAgentModelPath({
        agent: 'router',
        baselineScore: 0.72,
        candidateScore: 0.79,
        minimumImprovement: 0.1,
        criticalFailures: 0,
        latencyWithinBudget: true,
        costWithinBudget: true,
      }).reason,
    ).toBe('insufficient_quality_gain');

    expect(
      decideAgentModelPath({
        agent: 'router',
        baselineScore: 0.72,
        candidateScore: 0.84,
        minimumImprovement: 0.1,
        criticalFailures: 1,
        latencyWithinBudget: true,
        costWithinBudget: true,
      }).reason,
    ).toBe('critical_failure');
  });

  it('fails closed when model-path metrics are invalid', () => {
    const valid = {
      agent: 'router' as const,
      baselineScore: 0.72,
      candidateScore: 0.84,
      minimumImprovement: 0.1,
      criticalFailures: 0,
      latencyWithinBudget: true,
      costWithinBudget: true,
    };

    for (const input of [
      { ...valid, baselineScore: Number.NaN },
      { ...valid, candidateScore: Number.POSITIVE_INFINITY },
      { ...valid, minimumImprovement: -0.1 },
      { ...valid, criticalFailures: -1 },
      { ...valid, criticalFailures: 0.5 },
    ]) {
      expect(decideAgentModelPath(input)).toEqual({
        enabled: false,
        reason: 'invalid_metrics',
      });
    }
  });

  it('only permits bounded structural codes in evaluation outcomes', () => {
    expect(
      createAgentEvalOutcome({
        expectedCode: 'trusted',
        actualCode: 'complete private prompt output',
        errorCode: 'provider stack with private output',
      }),
    ).toEqual({
      expectedCode: 'trusted',
      actualCode: 'redacted',
      errorCode: 'redacted',
    });
  });

  it('exports the stable evaluation contract subpath', async () => {
    const module = await import('@repo/agent/phase-6-9-eval');

    expect(typeof module.buildAgentEvalSummary).toBe('function');
    expect(typeof module.decideAgentModelPath).toBe('function');
  });
});
