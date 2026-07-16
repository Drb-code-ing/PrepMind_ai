import { describe, expect, test } from 'bun:test';

import {
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  phase695ReviewPlannerCases,
} from '../src/evals/phase-6-9-review-planner-cases.ts';
import {
  PHASE_695_SHARED_BUDGET,
  phase695ReportSchema,
} from '../src/evals/phase-6-9-review-planner-contract.ts';
import { runPhase695ReviewPlannerPaired } from '../src/evals/run-phase-6-9-review-planner-paired.ts';

describe('phase 6.9 review planner paired contract', () => {
  test('freezes exactly 48 synthetic cases with 26 zero-call safety lanes', () => {
    expect(PHASE_695_REVIEW_PLANNER_DATASET_VERSION).toBe('phase-6.9-review-planner-v1');
    expect(Object.isFrozen(phase695ReviewPlannerCases)).toBe(true);
    expect(phase695ReviewPlannerCases).toHaveLength(48);
    expect(phase695ReviewPlannerCases.filter((entry) => entry.lane === 'review')).toHaveLength(24);
    expect(phase695ReviewPlannerCases.filter((entry) => entry.lane === 'planner')).toHaveLength(24);
    expect(phase695ReviewPlannerCases.filter((entry) => entry.executionKind === 'zero_call')).toHaveLength(26);
    expect(PHASE_695_SHARED_BUDGET).toEqual({ maxCalls: 2, maxInputTokens: 1950, maxOutputTokens: 440 });
  });

  test('accepts only the redacted report shape', async () => {
    const report = await runPhase695ReviewPlannerPaired({ mode: 'mock' });

    expect(phase695ReportSchema.parse(report)).toEqual(report);
    expect(() => phase695ReportSchema.parse({ ...report, prompt: 'must-not-persist' })).toThrow();
    expect(() => phase695ReportSchema.parse({
      ...report,
      caseEntries: [{ ...report.caseEntries[0]!, providerOutput: 'must-not-persist' }, ...report.caseEntries.slice(1)],
    })).toThrow();
    expect(JSON.stringify(report)).not.toMatch(/prompt|api.?key|base.?url|provider.?output/i);
  });

  test('rejects a forged non-critical result for a fixed critical semantic case', async () => {
    const report = await runPhase695ReviewPlannerPaired({ mode: 'mock' });
    const caseEntries = report.caseEntries.map((entry) => entry.caseId === 'review_21'
      ? { ...entry, qualityPass: false, criticalFailure: false, gate: 'candidate_rejected' as const }
      : entry);

    expect(() => phase695ReportSchema.parse({
      ...report,
      caseEntries,
      counters: { ...report.counters, qualityPasses: report.counters.qualityPasses - 1 },
      metrics: { ...report.metrics, semanticQualityRate: 21 / 22 },
      productionDecision: 'quality_gate_passed',
    })).toThrow();
  });
});
