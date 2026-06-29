import { describe, expect, it } from 'bun:test';

import { phase67EvalCases } from '../src/evals/phase-6-7-cases';
import { runPhase67EvalCase } from '../src/evals/run-phase-6-7-evals';

describe('Phase 6.7+ fixed agent eval set', () => {
  for (const testCase of phase67EvalCases) {
    it(testCase.name, () => {
      const result = runPhase67EvalCase(testCase);
      expect(result.passed, result.detail).toBe(true);
    });
  }
});
