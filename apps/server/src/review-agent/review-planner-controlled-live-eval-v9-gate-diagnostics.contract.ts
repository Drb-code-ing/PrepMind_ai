import { z } from 'zod';

const SCHEMA_VERSION =
  'phase-6.9.5-review-planner-v9-gate-diagnostic-v1' as const;
const DATASET_VERSION = 'phase-6.9-review-planner-v2' as const;
const PRICE_PROFILE_ID =
  'deepseek-v4-pro-cny-noncached-2026-07-18-v8-stage-diagnostics' as const;
const MAX_INPUT_TOKENS = 42_996;
const MAX_OUTPUT_TOKENS = 9_712;
const HARD_CAP_CNY = 1;

const safeCount = z.number().int().safe().min(0);
const gateStateSchema = z.enum(['passed', 'failed', 'not_evaluated']);
const productionDecisionSchema = z.enum([
  'quality_gate_passed',
  'strict_schema_incomplete',
  'semantic_quality_below_threshold',
  'critical_failure',
  'latency_budget_exceeded',
  'budget_exceeded',
  'zero_call_boundary_failed',
  'invalid_report',
]);

const attemptsSchema = z
  .object({
    providerCount: safeCount,
    expectedProviderCount: z.literal(23),
    pairedAdmissionCount: safeCount,
    expectedPairedAdmissionCount: z.literal(22),
    overflow: z.boolean(),
    auditRecordCount: safeCount,
  })
  .strict();

const validReportAggregateSchema = z
  .object({
    schemaValid: z.literal(true),
    caseEntries: safeCount.max(48),
    zeroCallCases: safeCount.max(48),
    zeroCallVerified: safeCount.max(26),
    runtimeInvocations: safeCount.max(48),
    budgetExceededCases: safeCount.max(22),
    strictSuccesses: safeCount.max(48),
    qualityPasses: safeCount.max(48),
    criticalFailures: safeCount.max(48),
    semanticPasses: safeCount.max(22),
    semanticTotal: safeCount.min(1).max(22),
    p95DurationMs: safeCount,
    productionDecision: productionDecisionSchema,
  })
  .strict()
  .superRefine((report, context) => {
    if (report.semanticPasses > report.semanticTotal) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['semanticPasses'],
        message: 'semantic_passes_exceed_total',
      });
    }
    if (
      report.productionDecision !==
      evaluateReportAggregate(report).productionDecision
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productionDecision'],
        message: 'production_decision_mismatch',
      });
    }
  });

const invalidReportAggregateSchema = z
  .object({ schemaValid: z.literal(false) })
  .strict();

const reportAggregateSchema = z.discriminatedUnion('schemaValid', [
  validReportAggregateSchema,
  invalidReportAggregateSchema,
]);

const knownUsageAggregateSchema = z
  .object({
    known: z.literal(true),
    inputTokens: z.number().int().safe().min(1).max(MAX_INPUT_TOKENS),
    outputTokens: z.number().int().safe().min(1).max(MAX_OUTPUT_TOKENS),
  })
  .strict();

const unknownUsageAggregateSchema = z
  .object({
    known: z.literal(false),
    reason: z.literal('usage_unverifiable'),
  })
  .strict();

const usageAggregateSchema = z.discriminatedUnion('known', [
  knownUsageAggregateSchema,
  unknownUsageAggregateSchema,
]);

const eightDecimalCnySchema = z
  .number()
  .finite()
  .min(0)
  .refine(
    (value) => Number(value.toFixed(8)) === value,
    'cny_precision_exceeds_eight_decimals',
  );

const evaluatedCostAggregateSchema = z
  .object({
    evaluated: z.literal(true),
    amountCny: eightDecimalCnySchema,
    hardCapCny: z.literal(HARD_CAP_CNY),
    withinCap: z.boolean(),
  })
  .strict();

const unevaluatedCostAggregateSchema = z
  .object({
    evaluated: z.literal(false),
    reason: z.literal('usage_unverifiable'),
  })
  .strict();

const costAggregateSchema = z.discriminatedUnion('evaluated', [
  evaluatedCostAggregateSchema,
  unevaluatedCostAggregateSchema,
]);

const gatesSchema = z
  .object({
    schema: gateStateSchema,
    quality: gateStateSchema,
    p95: gateStateSchema,
    usage: gateStateSchema,
    attempt: gateStateSchema,
    admission: gateStateSchema,
    cost: gateStateSchema,
  })
  .strict();

const terminalReasonSchema = z.enum([
  'passed',
  'schema_invalid',
  'quality_gate_failed',
  'p95_exceeded',
  'usage_unverifiable',
  'attempt_count_mismatch',
  'admission_count_mismatch',
  'cost_cap_exceeded',
]);

const derivationInputSchema = z
  .object({
    attempts: attemptsSchema,
    report: reportAggregateSchema,
    usage: usageAggregateSchema,
    cost: costAggregateSchema,
  })
  .strict();

const diagnosticShapeSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    datasetVersion: z.literal(DATASET_VERSION),
    state: z.literal('diagnostic_candidate'),
    status: z.literal('invalid_attempted'),
    gate: z.literal('closed'),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    priceProfileId: z.literal(PRICE_PROFILE_ID),
    attempts: attemptsSchema,
    report: reportAggregateSchema,
    usage: usageAggregateSchema,
    cost: costAggregateSchema,
    gates: gatesSchema,
    terminalReason: terminalReasonSchema,
  })
  .strict();

type DerivationInput = z.infer<typeof derivationInputSchema>;
type GateState = z.infer<typeof gateStateSchema>;
type Gates = z.infer<typeof gatesSchema>;
type TerminalReason = z.infer<typeof terminalReasonSchema>;

function expectedGates(input: DerivationInput): Gates {
  const reportEvaluation = input.report.schemaValid
    ? evaluateReportAggregate(input.report)
    : null;
  const schema: GateState = input.report.schemaValid ? 'passed' : 'failed';
  const quality: GateState = reportEvaluation
    ? reportEvaluation.qualityPassed
      ? 'passed'
      : 'failed'
    : 'not_evaluated';
  const p95: GateState = reportEvaluation
    ? reportEvaluation.p95Passed
      ? 'passed'
      : 'failed'
    : 'not_evaluated';
  const usage: GateState = input.usage.known ? 'passed' : 'failed';
  const attempt: GateState =
    input.attempts.providerCount === input.attempts.expectedProviderCount &&
    input.attempts.auditRecordCount === input.attempts.providerCount
      ? 'passed'
      : 'failed';
  const admission: GateState =
    input.attempts.pairedAdmissionCount ===
      input.attempts.expectedPairedAdmissionCount && !input.attempts.overflow
      ? 'passed'
      : 'failed';
  const cost: GateState = !input.usage.known
    ? 'not_evaluated'
    : costPassed(input)
      ? 'passed'
      : 'failed';

  return { schema, quality, p95, usage, attempt, admission, cost };
}

function evaluateReportAggregate(
  report: z.infer<typeof validReportAggregateSchema>,
): Readonly<{
  productionDecision: z.infer<typeof productionDecisionSchema>;
  qualityPassed: boolean;
  p95Passed: boolean;
}> {
  let productionDecision: z.infer<typeof productionDecisionSchema>;
  if (report.zeroCallCases !== 26 || report.zeroCallVerified !== 26) {
    productionDecision = 'zero_call_boundary_failed';
  } else if (report.budgetExceededCases > 0) {
    productionDecision = 'budget_exceeded';
  } else if (
    report.caseEntries !== 48 ||
    report.runtimeInvocations !== 22 ||
    report.semanticTotal !== 22
  ) {
    productionDecision = 'invalid_report';
  } else if (report.strictSuccesses !== 48) {
    productionDecision = 'strict_schema_incomplete';
  } else if (report.semanticPasses < 20) {
    productionDecision = 'semantic_quality_below_threshold';
  } else if (report.criticalFailures !== 0) {
    productionDecision = 'critical_failure';
  } else if (report.qualityPasses !== 48) {
    productionDecision = 'invalid_report';
  } else if (report.p95DurationMs > 4_500) {
    productionDecision = 'latency_budget_exceeded';
  } else {
    productionDecision = 'quality_gate_passed';
  }
  return {
    productionDecision,
    qualityPassed:
      productionDecision === 'quality_gate_passed' ||
      productionDecision === 'latency_budget_exceeded',
    p95Passed: report.p95DurationMs <= 4_500,
  };
}

function costPassed(input: DerivationInput): boolean {
  if (!input.usage.known || !input.cost.evaluated) return false;
  const expectedAmount = Number(
    (
      (input.usage.inputTokens * 3 + input.usage.outputTokens * 6) /
      1_000_000
    ).toFixed(8),
  );
  return (
    input.cost.amountCny === expectedAmount &&
    input.cost.withinCap === input.cost.amountCny <= input.cost.hardCapCny &&
    input.cost.withinCap
  );
}

function firstTerminalReason(gates: Gates): TerminalReason {
  const priority: readonly (readonly [keyof Gates, TerminalReason])[] = [
    ['schema', 'schema_invalid'],
    ['quality', 'quality_gate_failed'],
    ['p95', 'p95_exceeded'],
    ['usage', 'usage_unverifiable'],
    ['attempt', 'attempt_count_mismatch'],
    ['admission', 'admission_count_mismatch'],
    ['cost', 'cost_cap_exceeded'],
  ];
  return priority.find(([gate]) => gates[gate] === 'failed')?.[1] ?? 'passed';
}

export const v9GateDiagnosticSchema = diagnosticShapeSchema.superRefine(
  (diagnostic, context) => {
    const gates = expectedGates(diagnostic);
    for (const gate of Object.keys(gates) as (keyof Gates)[]) {
      if (diagnostic.gates[gate] !== gates[gate]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['gates', gate],
          message: 'gate_mismatch',
        });
      }
    }
    if (diagnostic.terminalReason !== firstTerminalReason(gates)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['terminalReason'],
        message: 'terminal_reason_mismatch',
      });
    }
    if (diagnostic.usage.known !== diagnostic.cost.evaluated) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cost'],
        message: 'usage_cost_evaluation_mismatch',
      });
    }
  },
);

export type V9GateDiagnostic = z.infer<typeof v9GateDiagnosticSchema>;

export function deriveV9GateDiagnostic(input: unknown): V9GateDiagnostic {
  const aggregate = derivationInputSchema.parse(input);
  const gates = expectedGates(aggregate);
  return v9GateDiagnosticSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    datasetVersion: DATASET_VERSION,
    state: 'diagnostic_candidate',
    status: 'invalid_attempted',
    gate: 'closed',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    priceProfileId: PRICE_PROFILE_ID,
    ...aggregate,
    gates,
    terminalReason: firstTerminalReason(gates),
  });
}

export function serializeV9GateDiagnostic(input: unknown): string {
  return JSON.stringify(v9GateDiagnosticSchema.parse(input));
}
