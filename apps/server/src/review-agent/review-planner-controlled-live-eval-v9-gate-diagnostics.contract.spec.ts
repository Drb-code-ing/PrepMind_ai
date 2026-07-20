import {
  deriveV9GateDiagnostic,
  serializeV9GateDiagnostic,
  v9GateDiagnosticSchema,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.contract';

const passingInput = Object.freeze({
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
    semanticPasses: 20,
    semanticTotal: 22,
    p95DurationMs: 4_500,
    productionDecision: 'quality_gate_passed',
  },
  usage: { known: true, inputTokens: 42_000, outputTokens: 9_000 },
  cost: { evaluated: true, amountCny: 0.18, hardCapCny: 1, withinCap: true },
} as const);

function passingDiagnostic() {
  return deriveV9GateDiagnostic(passingInput);
}

describe('V9 safe report gate diagnostic contract', () => {
  it('derives the complete passing gate without storing case-level data', () => {
    expect(passingDiagnostic()).toEqual({
      schemaVersion: 'phase-6.9.5-review-planner-v9-gate-diagnostic-v1',
      datasetVersion: 'phase-6.9-review-planner-v2',
      state: 'diagnostic_candidate',
      status: 'invalid_attempted',
      gate: 'closed',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      priceProfileId:
        'deepseek-v4-pro-cny-noncached-2026-07-18-v8-stage-diagnostics',
      ...passingInput,
      gates: {
        schema: 'passed',
        quality: 'passed',
        p95: 'passed',
        usage: 'passed',
        attempt: 'passed',
        admission: 'passed',
        cost: 'passed',
      },
      terminalReason: 'passed',
    });
  });

  it.each([
    ['schema', { report: { schemaValid: false } }, 'schema_invalid'],
    [
      'quality',
      {
        report: {
          ...passingInput.report,
          qualityPasses: 47,
          semanticPasses: 19,
          productionDecision: 'semantic_quality_below_threshold',
        },
      },
      'quality_gate_failed',
    ],
    [
      'p95',
      {
        report: {
          ...passingInput.report,
          p95DurationMs: 4_501,
          productionDecision: 'latency_budget_exceeded',
        },
      },
      'p95_exceeded',
    ],
    [
      'usage',
      {
        usage: { known: false, reason: 'usage_unverifiable' },
        cost: { evaluated: false, reason: 'usage_unverifiable' },
      },
      'usage_unverifiable',
    ],
    [
      'attempt',
      {
        attempts: {
          ...passingInput.attempts,
          providerCount: 22,
          auditRecordCount: 22,
        },
      },
      'attempt_count_mismatch',
    ],
    [
      'admission',
      { attempts: { ...passingInput.attempts, pairedAdmissionCount: 21 } },
      'admission_count_mismatch',
    ],
    [
      'cost',
      {
        cost: {
          evaluated: true,
          amountCny: 1.00000001,
          hardCapCny: 1,
          withinCap: false,
        },
      },
      'cost_cap_exceeded',
    ],
  ] as const)(
    'derives an isolated %s failure',
    (gate, patch, terminalReason) => {
      const input = {
        ...passingInput,
        ...patch,
      };
      const diagnostic = deriveV9GateDiagnostic(input);

      expect(diagnostic.gates[gate]).toBe('failed');
      expect(diagnostic.terminalReason).toBe(terminalReason);
    },
  );

  it('attributes an isolated overflow to the admission gate', () => {
    const diagnostic = deriveV9GateDiagnostic({
      ...passingInput,
      attempts: { ...passingInput.attempts, overflow: true },
    });

    expect(diagnostic.gates.attempt).toBe('passed');
    expect(diagnostic.gates.admission).toBe('failed');
    expect(diagnostic.terminalReason).toBe('admission_count_mismatch');
  });

  it('derives zero-call boundary failure from the safe verified aggregate', () => {
    const diagnostic = deriveV9GateDiagnostic({
      ...passingInput,
      report: {
        ...passingInput.report,
        zeroCallVerified: 25,
        productionDecision: 'zero_call_boundary_failed',
      },
    });

    expect(diagnostic.report).toMatchObject({
      zeroCallCases: 26,
      zeroCallVerified: 25,
      productionDecision: 'zero_call_boundary_failed',
    });
    expect(diagnostic.gates.quality).toBe('failed');
  });

  it('derives budget failure from the safe aggregate count', () => {
    const diagnostic = deriveV9GateDiagnostic({
      ...passingInput,
      report: {
        ...passingInput.report,
        budgetExceededCases: 1,
        productionDecision: 'budget_exceeded',
      },
    });

    expect(diagnostic.report).toMatchObject({
      budgetExceededCases: 1,
      productionDecision: 'budget_exceeded',
    });
    expect(diagnostic.gates.quality).toBe('failed');
  });

  it('uses the fixed schema, quality, p95, usage, attempt, admission, cost priority', () => {
    const diagnostic = deriveV9GateDiagnostic({
      ...passingInput,
      attempts: {
        ...passingInput.attempts,
        providerCount: 24,
        pairedAdmissionCount: 21,
        overflow: true,
        auditRecordCount: 24,
      },
      report: { schemaValid: false },
      usage: { known: false, reason: 'usage_unverifiable' },
      cost: { evaluated: false, reason: 'usage_unverifiable' },
    });

    expect(diagnostic.terminalReason).toBe('schema_invalid');
    expect(diagnostic.gates).toEqual({
      schema: 'failed',
      quality: 'not_evaluated',
      p95: 'not_evaluated',
      usage: 'failed',
      attempt: 'failed',
      admission: 'failed',
      cost: 'not_evaluated',
    });
  });

  it('does not evaluate quality or P95 when the report schema is invalid', () => {
    expect(
      deriveV9GateDiagnostic({
        ...passingInput,
        report: { schemaValid: false },
      }),
    ).toMatchObject({
      report: { schemaValid: false },
      gates: {
        schema: 'failed',
        quality: 'not_evaluated',
        p95: 'not_evaluated',
      },
    });
  });

  it('does not evaluate cost when aggregate usage is unknown', () => {
    expect(
      deriveV9GateDiagnostic({
        ...passingInput,
        usage: { known: false, reason: 'usage_unverifiable' },
        cost: { evaluated: false, reason: 'usage_unverifiable' },
      }),
    ).toMatchObject({
      usage: { known: false, reason: 'usage_unverifiable' },
      cost: { evaluated: false, reason: 'usage_unverifiable' },
      gates: { usage: 'failed', cost: 'not_evaluated' },
    });
  });

  it.each([
    [4_501, 'quality_gate_passed'],
    [4_500, 'latency_budget_exceeded'],
  ] as const)(
    'rejects P95 %i with impossible production decision %s',
    (p95DurationMs, productionDecision) => {
      expect(() =>
        deriveV9GateDiagnostic({
          ...passingInput,
          report: {
            ...passingInput.report,
            p95DurationMs,
            productionDecision,
          },
        }),
      ).toThrow();
    },
  );

  it.each([
    ['runtimeInvocations', 21],
    ['qualityPasses', 47],
    ['semanticTotal', 21],
  ] as const)('rejects quality_gate_passed when %s is %i', (field, value) => {
    expect(() =>
      deriveV9GateDiagnostic({
        ...passingInput,
        report: {
          ...passingInput.report,
          [field]: value,
          productionDecision: 'quality_gate_passed',
        },
      }),
    ).toThrow();
  });

  it.each([
    'caseEntries',
    'caseId',
    'prompt',
    'output',
    'response',
    'reasoning',
    'rawError',
    'path',
    'url',
    'header',
    'key',
    'cookie',
    'stack',
    'perCaseUsage',
    'perCaseDuration',
    'successCommitment',
    'seal',
  ])('rejects forbidden field %s', (field) => {
    expect(() =>
      v9GateDiagnosticSchema.parse({
        ...passingDiagnostic(),
        [field]: 'forbidden',
      }),
    ).toThrow();
  });

  it('rejects schema extras at every aggregate boundary', () => {
    const diagnostic = passingDiagnostic();
    for (const candidate of [
      { ...diagnostic, extra: true },
      { ...diagnostic, attempts: { ...diagnostic.attempts, extra: true } },
      { ...diagnostic, report: { ...diagnostic.report, extra: true } },
      { ...diagnostic, usage: { ...diagnostic.usage, extra: true } },
      { ...diagnostic, cost: { ...diagnostic.cost, extra: true } },
      { ...diagnostic, gates: { ...diagnostic.gates, extra: 'passed' } },
    ]) {
      expect(() => v9GateDiagnosticSchema.parse(candidate)).toThrow();
    }
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0.5,
  ])('rejects invalid numeric aggregate %p', (value) => {
    expect(() =>
      v9GateDiagnosticSchema.parse({
        ...passingDiagnostic(),
        attempts: { ...passingDiagnostic().attempts, providerCount: value },
      }),
    ).toThrow();
  });

  it('rejects out-of-bounds counts, usage and precision', () => {
    const diagnostic = passingDiagnostic();
    for (const candidate of [
      { ...diagnostic, report: { ...diagnostic.report, qualityPasses: 49 } },
      { ...diagnostic, usage: { ...diagnostic.usage, inputTokens: 42_997 } },
      { ...diagnostic, usage: { ...diagnostic.usage, outputTokens: 9_713 } },
      { ...diagnostic, cost: { ...diagnostic.cost, amountCny: 0.123456789 } },
    ]) {
      expect(() => v9GateDiagnosticSchema.parse(candidate)).toThrow();
    }
  });

  it('rejects forged passed gates and terminal state', () => {
    const failed = deriveV9GateDiagnostic({
      ...passingInput,
      report: {
        ...passingInput.report,
        p95DurationMs: 4_501,
        productionDecision: 'latency_budget_exceeded',
      },
    });

    expect(() =>
      v9GateDiagnosticSchema.parse({
        ...failed,
        gates: { ...failed.gates, p95: 'passed' },
        terminalReason: 'passed',
      }),
    ).toThrow();
    expect(() =>
      v9GateDiagnosticSchema.parse({
        ...passingDiagnostic(),
        status: 'complete',
      }),
    ).toThrow();
  });

  it('serializes only a revalidated strict diagnostic', () => {
    const diagnostic = passingDiagnostic();
    expect(JSON.parse(serializeV9GateDiagnostic(diagnostic))).toEqual(
      diagnostic,
    );
    expect(() =>
      serializeV9GateDiagnostic({ ...diagnostic, prompt: 'forbidden' }),
    ).toThrow();
  });
});
