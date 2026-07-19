import {
  deriveV10SemanticQualityDiagnostic,
  v10SemanticQualityDiagnosticSchema,
} from './review-planner-controlled-live-eval-v10-semantic-quality.contract';

describe('Review Planner controlled Live V10 semantic quality contract', () => {
  it('derives a pass-only safe aggregate with independently scoped lane totals', () => {
    const diagnostic = deriveV10SemanticQualityDiagnostic({
      attempts: {
        providerCount: 23,
        expectedProviderCount: 23,
        pairedAdmissionCount: 22,
        expectedPairedAdmissionCount: 22,
        overflow: false,
        auditRecordCount: 23,
      },
      report: {
        schemaValid: true,
        caseEntries: 48,
        zeroCallCases: 26,
        zeroCallVerified: 26,
        runtimeInvocations: 22,
        budgetExceededCases: 0,
        strictSuccesses: 48,
        qualityPasses: 48,
        criticalFailures: 0,
        p95DurationMs: 4_500,
        productionDecision: 'quality_gate_passed',
        lanes: {
          review: {
            caseEntries: 24,
            runtimeCases: 11,
            zeroCallCases: 13,
            strictSuccesses: 24,
            qualityPasses: 24,
            criticalFailures: 0,
          },
          planner: {
            caseEntries: 24,
            runtimeCases: 11,
            zeroCallCases: 13,
            strictSuccesses: 24,
            qualityPasses: 24,
            criticalFailures: 0,
          },
        },
      },
      usage: { known: true, inputTokens: 42_000, outputTokens: 9_000 },
      cost: {
        evaluated: true,
        amountCny: 0.18,
        hardCapCny: 1,
        withinCap: true,
      },
    });

    expect(diagnostic.terminalReason).toBe('passed');
    expect(diagnostic.gates).toEqual({
      schema: 'passed',
      quality: 'passed',
      p95: 'passed',
      usage: 'passed',
      attempt: 'passed',
      admission: 'passed',
      cost: 'passed',
    });
    expect(Object.isFrozen(diagnostic)).toBe(true);
  });

  it('rejects unknown safe-diagnostic fields at every level', () => {
    const baseline = deriveV10SemanticQualityDiagnostic({
      attempts: {
        providerCount: 23,
        expectedProviderCount: 23,
        pairedAdmissionCount: 22,
        expectedPairedAdmissionCount: 22,
        overflow: false,
        auditRecordCount: 23,
      },
      report: {
        schemaValid: true,
        caseEntries: 48,
        zeroCallCases: 26,
        zeroCallVerified: 26,
        runtimeInvocations: 22,
        budgetExceededCases: 0,
        strictSuccesses: 48,
        qualityPasses: 48,
        criticalFailures: 0,
        p95DurationMs: 1,
        productionDecision: 'quality_gate_passed',
        lanes: {
          review: {
            caseEntries: 24,
            runtimeCases: 11,
            zeroCallCases: 13,
            strictSuccesses: 24,
            qualityPasses: 24,
            criticalFailures: 0,
          },
          planner: {
            caseEntries: 24,
            runtimeCases: 11,
            zeroCallCases: 13,
            strictSuccesses: 24,
            qualityPasses: 24,
            criticalFailures: 0,
          },
        },
      },
      usage: { known: true, inputTokens: 1, outputTokens: 1 },
      cost: {
        evaluated: true,
        amountCny: 0.000009,
        hardCapCny: 1,
        withinCap: true,
      },
    });

    expect(
      v10SemanticQualityDiagnosticSchema.safeParse({
        ...baseline,
        prompt: 'forbidden',
      }).success,
    ).toBe(false);
    expect(
      v10SemanticQualityDiagnosticSchema.safeParse({
        ...baseline,
        report: { schemaValid: false, caseEntriesDetail: [] },
      }).success,
    ).toBe(false);
  });
});
