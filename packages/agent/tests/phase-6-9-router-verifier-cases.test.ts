import { describe, expect, it } from 'bun:test';

import {
  PHASE_69_SEED_DATASET_VERSION,
  phase69SeedCases,
} from '../src/evals/phase-6-9-seed-cases';
import {
  PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
  phase6941RouterCases,
  phase6941VerifierCases,
} from '../src/evals/phase-6-9-router-verifier-cases';

describe('Phase 6.9.4.1 Router / Verifier eval cases', () => {
  it('keeps the historical seed dataset unchanged', () => {
    expect(PHASE_69_SEED_DATASET_VERSION).toBe('phase-6.9-seed-v1');
    expect(phase69SeedCases).toHaveLength(32);
  });

  it('fixes the expanded dataset version, counts, and subset quotas', () => {
    expect(PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION).toBe(
      'phase-6.9-router-verifier-v1',
    );
    expect(phase6941RouterCases).toHaveLength(60);
    expect(phase6941VerifierCases).toHaveLength(40);

    expect(countSubsets(phase6941RouterCases)).toEqual({
      high_confidence: 36,
      ambiguous: 16,
      safety_boundary: 8,
    });
    expect(countSubsets(phase6941VerifierCases)).toEqual({
      trusted: 12,
      insufficient: 8,
      complex_conflict: 8,
      uncertain_or_stale: 4,
      prompt_injection: 8,
    });
  });

  it('uses stable unique ASCII ids and non-empty unique tags', () => {
    const cases = [...phase6941RouterCases, ...phase6941VerifierCases];
    const ids = cases.map((testCase) => testCase.id);

    expect(new Set(ids).size).toBe(100);
    for (const testCase of cases) {
      expect(testCase.id).toMatch(/^(router|verifier)_[a-z0-9_]{3,80}$/);
      expect(testCase.tags.length).toBeGreaterThan(0);
      expect(new Set(testCase.tags).size).toBe(testCase.tags.length);
    }
  });

  it('keeps critical safety cases away from future model candidates', () => {
    const cases = [...phase6941RouterCases, ...phase6941VerifierCases];
    const criticalCases = cases.filter((testCase) => testCase.criticalSafetyCase);

    expect(criticalCases.length).toBeGreaterThan(0);
    expect(criticalCases.every((testCase) => !testCase.candidateEligible)).toBe(
      true,
    );
  });

  it('only marks ambiguous Router and semantic Verifier cases candidate eligible', () => {
    expect(
      phase6941RouterCases.filter((testCase) => testCase.candidateEligible),
    ).toHaveLength(16);
    expect(
      phase6941RouterCases
        .filter((testCase) => testCase.candidateEligible)
        .every((testCase) => testCase.subset === 'ambiguous'),
    ).toBe(true);
    expect(
      phase6941VerifierCases.filter((testCase) => testCase.candidateEligible),
    ).toHaveLength(12);
    expect(
      phase6941VerifierCases
        .filter((testCase) => testCase.candidateEligible)
        .every((testCase) =>
          ['complex_conflict', 'uncertain_or_stale'].includes(testCase.subset),
        ),
    ).toBe(true);
  });

  it('keeps meaningful Verifier queries and immutable exported fixtures', () => {
    expect(
      phase6941VerifierCases.every(
        (testCase) =>
          testCase.input.query.trim().length >= 4 &&
          testCase.input.query !== '评测查询',
      ),
    ).toBe(true);
    expect(Object.isFrozen(phase6941RouterCases)).toBe(true);
    expect(Object.isFrozen(phase6941VerifierCases)).toBe(true);
    expect(
      [...phase6941RouterCases, ...phase6941VerifierCases].every((testCase) =>
        Object.isFrozen(testCase),
      ),
    ).toBe(true);
    expect(
      phase6941VerifierCases.every(
        (testCase) =>
          Object.isFrozen(testCase.input) &&
          Object.isFrozen(testCase.input.chunks),
      ),
    ).toBe(true);
  });

  it('contains no credential, auth header, email, or private-key material', () => {
    const serialized = JSON.stringify([
      ...phase6941RouterCases,
      ...phase6941VerifierCases,
    ]);

    for (const forbidden of [
      /authorization\s*:\s*bearer/i,
      /cookie\s*:/i,
      /(?:sk|ds|AIza)[-_A-Za-z0-9]{16,}/,
      /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    ]) {
      expect(serialized).not.toMatch(forbidden);
    }
  });
});

function countSubsets(values: readonly { subset: string }[]) {
  return Object.fromEntries(
    values.reduce((counts, value) => {
      counts.set(value.subset, (counts.get(value.subset) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
  );
}
