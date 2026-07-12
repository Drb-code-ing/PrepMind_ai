import { describe, expect, it } from 'bun:test';

import {
  buildRouterEvalMetrics,
  buildVerifierEvalMetrics,
  type RouterEvalObservation,
  type VerifierEvalObservation,
} from '../src/evals/phase-6-9-router-verifier-metrics';

describe('Phase 6.9.4.1 Router / Verifier metrics', () => {
  it('computes Router route quality, ambiguity F1, boundaries, and critical failures', () => {
    const result = buildRouterEvalMetrics([
      router(),
      router({
        caseId: 'router_ambiguous_tutor_01',
        subset: 'ambiguous',
        expectedRoute: 'tutor',
        actualRoute: 'tutor',
      }),
      router({
        caseId: 'router_ambiguous_rag_02',
        subset: 'ambiguous',
        expectedRoute: 'rag_answer',
        actualRoute: 'chat',
        expectedRequiresRag: true,
      }),
      router({
        caseId: 'router_safety_01',
        subset: 'safety_boundary',
        criticalSafetyCase: true,
        actualRequiresHumanApproval: true,
      }),
    ]);

    expect(result).toEqual({
      ok: true,
      metrics: {
        overallAccuracy: 0.75,
        ambiguousMacroF1: 0.5,
        highConfidenceAccuracy: 1,
        permissionBoundaryPassRate: 0.5,
        criticalFailures: 1,
      },
    });
  });

  it('computes Verifier conflict recall, conservative fallback, and injection release', () => {
    const result = buildVerifierEvalMetrics([
      verifier(),
      verifier({
        caseId: 'verifier_conflict_01',
        subset: 'complex_conflict',
        expectedStatus: 'conflict',
        actualStatus: 'trusted',
      }),
      verifier({
        caseId: 'verifier_stale_01',
        subset: 'uncertain_or_stale',
        expectedStatus: 'suspicious',
        actualStatus: 'suspicious',
      }),
      verifier({
        caseId: 'verifier_injection_01',
        subset: 'prompt_injection',
        expectedStatus: 'suspicious',
        actualStatus: 'suspicious',
        criticalSafetyCase: true,
        candidateAttempted: true,
      }),
    ]);

    expect(result).toEqual({
      ok: true,
      metrics: {
        overallAccuracy: 0.75,
        complexConflictRecall: 0,
        conservativeFallbackPassRate: 1,
        promptInjectionReleaseCount: 1,
        criticalFailures: 1,
      },
    });
  });

  it('treats runtime failures as conservative only when the result stays restrictive', () => {
    const result = buildVerifierEvalMetrics([
      verifier({
        caseId: 'verifier_conflict_01',
        subset: 'complex_conflict',
        expectedStatus: 'conflict',
        actualStatus: 'insufficient',
      }),
      verifier({
        caseId: 'verifier_runtime_safe_01',
        subset: 'trusted',
        actualStatus: 'suspicious',
        runtimeFailed: true,
      }),
      verifier({
        caseId: 'verifier_runtime_unsafe_02',
        subset: 'trusted',
        actualStatus: 'trusted',
        runtimeFailed: true,
      }),
    ]);

    expect(result).toEqual({
      ok: true,
      metrics: {
        overallAccuracy: 1 / 3,
        complexConflictRecall: 0,
        conservativeFallbackPassRate: 0.5,
        promptInjectionReleaseCount: 0,
        criticalFailures: 0,
      },
    });
  });

  it('fails closed for empty, duplicate, or structurally invalid observations', () => {
    expect(buildRouterEvalMetrics([])).toEqual(invalidMetrics());
    expect(buildRouterEvalMetrics([router(), router()])).toEqual(invalidMetrics());
    expect(buildVerifierEvalMetrics([])).toEqual(invalidMetrics());
    expect(
      buildVerifierEvalMetrics([verifier({ caseId: '' })]),
    ).toEqual(invalidMetrics());
    expect(
      buildRouterEvalMetrics([
        router({ subset: 'unknown' as RouterEvalObservation['subset'] }),
      ]),
    ).toEqual(invalidMetrics());
  });
});

function router(
  overrides: Partial<RouterEvalObservation> = {},
): RouterEvalObservation {
  return {
    caseId: 'router_high_chat_01',
    subset: 'high_confidence',
    expectedRoute: 'chat',
    actualRoute: 'chat',
    expectedRequiresRag: false,
    actualRequiresRag: false,
    expectedRequiresHumanApproval: false,
    actualRequiresHumanApproval: false,
    criticalSafetyCase: false,
    ...overrides,
  };
}

function verifier(
  overrides: Partial<VerifierEvalObservation> = {},
): VerifierEvalObservation {
  return {
    caseId: 'verifier_trusted_01',
    subset: 'trusted',
    expectedStatus: 'trusted',
    actualStatus: 'trusted',
    criticalSafetyCase: false,
    candidateAttempted: false,
    runtimeFailed: false,
    ...overrides,
  };
}

function invalidMetrics() {
  return { ok: false, errorCode: 'invalid_metrics' } as const;
}
