import { z } from 'zod';

import {
  PHASE_695_REVIEW_PLANNER_DATASET_VERSION,
  phase695ReviewPlannerCases,
  type Phase695ReviewPlannerCase,
} from './phase-6-9-review-planner-cases.ts';

export const PHASE_695_REPORT_SCHEMA_VERSION = 'phase-6.9-review-planner-report-v1' as const;
export const PHASE_695_SHARED_BUDGET = Object.freeze({
  maxCalls: 2,
  maxInputTokens: 1_950,
  maxOutputTokens: 440,
});

export enum ReviewPlannerDiagnosticCode {
  PreflightInvalid = 'preflight_invalid',
  ExecutorInit = 'executor_init',
  HttpAuth = 'http_auth',
  HttpRateLimit = 'http_rate_limit',
  HttpClient = 'http_client',
  HttpServer = 'http_server',
  Transport = 'transport',
  StructuredOutput = 'structured_output',
  InvalidResponse = 'invalid_response',
  UsageUnverifiable = 'usage_unverifiable',
  EvidenceIo = 'evidence_io',
}

export const reviewPlannerDiagnosticCodeSchema = z.enum([
  ReviewPlannerDiagnosticCode.PreflightInvalid,
  ReviewPlannerDiagnosticCode.ExecutorInit,
  ReviewPlannerDiagnosticCode.HttpAuth,
  ReviewPlannerDiagnosticCode.HttpRateLimit,
  ReviewPlannerDiagnosticCode.HttpClient,
  ReviewPlannerDiagnosticCode.HttpServer,
  ReviewPlannerDiagnosticCode.Transport,
  ReviewPlannerDiagnosticCode.StructuredOutput,
  ReviewPlannerDiagnosticCode.InvalidResponse,
  ReviewPlannerDiagnosticCode.UsageUnverifiable,
  ReviewPlannerDiagnosticCode.EvidenceIo,
]);

const safeInteger = z.number().int().safe().min(0);
const rate = z.number().finite().min(0).max(1);
const caseIdSchema = z.string().regex(/^(?:review|planner)_[1-9][0-9]?$/);
const budgetSchema = z.object({
  maxCalls: z.literal(PHASE_695_SHARED_BUDGET.maxCalls),
  maxInputTokens: z.literal(PHASE_695_SHARED_BUDGET.maxInputTokens),
  maxOutputTokens: z.literal(PHASE_695_SHARED_BUDGET.maxOutputTokens),
}).strict();
const usageSchema = z.object({
  inputTokens: safeInteger,
  outputTokens: safeInteger,
}).strict();

const caseEntrySchema = z.object({
  caseId: caseIdSchema,
  lane: z.enum(['review', 'planner']),
  executionKind: z.enum(['runtime', 'zero_call']),
  runtimeInvocations: z.union([z.literal(0), z.literal(1)]),
  strictSuccess: z.boolean(),
  qualityPass: z.boolean(),
  criticalFailure: z.boolean(),
  durationMs: safeInteger,
  usage: usageSchema,
  budget: budgetSchema,
  gate: z.enum(['zero_call', 'candidate_evaluated', 'candidate_rejected']),
  diagnosticCode: reviewPlannerDiagnosticCodeSchema.optional(),
}).strict();

const countersSchema = z.object({
  caseEntries: z.literal(48),
  zeroCallCases: z.literal(26),
  runtimeInvocations: safeInteger,
  strictSuccesses: safeInteger,
  qualityPasses: safeInteger,
  criticalFailures: safeInteger,
  inputTokens: safeInteger,
  outputTokens: safeInteger,
}).strict();

const metricsSchema = z.object({
  strictSchemaSuccessRate: rate,
  semanticQualityRate: rate,
  criticalFailures: safeInteger,
  p95DurationMs: safeInteger,
}).strict();

const productionDecisionSchema = z.enum([
  'mock_quality_not_evidence',
  'quality_gate_passed',
  'strict_schema_incomplete',
  'semantic_quality_below_threshold',
  'critical_failure',
  'latency_budget_exceeded',
  'budget_exceeded',
  'zero_call_boundary_failed',
  'invalid_report',
]);

const reportShapeSchema = z.object({
  schemaVersion: z.literal(PHASE_695_REPORT_SCHEMA_VERSION),
  datasetVersion: z.literal(PHASE_695_REVIEW_PLANNER_DATASET_VERSION),
  mode: z.enum(['mock', 'live']),
  caseEntries: z.array(caseEntrySchema).length(48),
  counters: countersSchema,
  metrics: metricsSchema,
  productionDecision: productionDecisionSchema,
}).strict();

export type Phase695CaseEntry = z.infer<typeof caseEntrySchema>;
export type Phase695Report = z.infer<typeof reportShapeSchema>;
export type Phase695ProductionDecision = z.infer<typeof productionDecisionSchema>;

export const phase695ReportSchema = reportShapeSchema.superRefine((report, context) => {
  const canonical = new Map<string, Phase695ReviewPlannerCase>(
    phase695ReviewPlannerCases.map((item) => [item.id, item]),
  );
  const seen = new Set<string>();
  let zeroCallCases = 0;
  let runtimeInvocations = 0;
  let strictSuccesses = 0;
  let qualityPasses = 0;
  let criticalFailures = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const [index, entry] of report.caseEntries.entries()) {
    const expected = canonical.get(entry.caseId);
    if (!expected || seen.has(entry.caseId) ||
      expected.lane !== entry.lane || expected.executionKind !== entry.executionKind) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['caseEntries', index], message: 'case_mismatch' });
      continue;
    }
    seen.add(entry.caseId);
    const expectedZeroCall = entry.executionKind === 'zero_call';
    if ((expectedZeroCall &&
        (entry.runtimeInvocations !== 0 || !entry.strictSuccess || !entry.qualityPass ||
         entry.criticalFailure || entry.durationMs !== 0 || entry.usage.inputTokens !== 0 ||
         entry.usage.outputTokens !== 0 || entry.gate !== 'zero_call' || entry.diagnosticCode !== undefined)) ||
      (!expectedZeroCall &&
        (entry.runtimeInvocations > 1 ||
         (entry.runtimeInvocations === 0 &&
          (entry.strictSuccess || entry.qualityPass || entry.gate !== 'candidate_rejected' ||
           entry.diagnosticCode === undefined || entry.usage.inputTokens !== 0 ||
           entry.usage.outputTokens !== 0)) ||
         (entry.strictSuccess && entry.diagnosticCode !== undefined) ||
         (!entry.strictSuccess && entry.diagnosticCode === undefined) ||
         (entry.strictSuccess && entry.qualityPass && entry.gate !== 'candidate_evaluated') ||
         ((!entry.strictSuccess || !entry.qualityPass) && entry.gate !== 'candidate_rejected')))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['caseEntries', index], message: 'entry_boundary_invalid' });
    }
    if (entry.criticalFailure !== (expected.criticalSemanticCase && !entry.qualityPass)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['caseEntries', index], message: 'critical_failure_mismatch' });
    }
    zeroCallCases += expectedZeroCall ? 1 : 0;
    runtimeInvocations += entry.runtimeInvocations;
    strictSuccesses += entry.strictSuccess ? 1 : 0;
    qualityPasses += entry.qualityPass ? 1 : 0;
    criticalFailures += entry.criticalFailure ? 1 : 0;
    inputTokens += entry.usage.inputTokens;
    outputTokens += entry.usage.outputTokens;
  }

  if (seen.size !== canonical.size ||
    report.counters.caseEntries !== report.caseEntries.length ||
    report.counters.zeroCallCases !== zeroCallCases ||
    report.counters.runtimeInvocations !== runtimeInvocations ||
    report.counters.strictSuccesses !== strictSuccesses ||
    report.counters.qualityPasses !== qualityPasses ||
    report.counters.criticalFailures !== criticalFailures ||
    report.counters.inputTokens !== inputTokens ||
    report.counters.outputTokens !== outputTokens) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['counters'], message: 'counter_mismatch' });
  }

  const runtimeEntries = report.caseEntries.filter((entry) => entry.executionKind === 'runtime');
  const strictSchemaSuccessRate = ratio(runtimeEntries.filter((entry) => entry.strictSuccess).length, runtimeEntries.length);
  const semanticQualityRate = ratio(runtimeEntries.filter((entry) => entry.qualityPass).length, runtimeEntries.length);
  const p95DurationMs = nearestRank(runtimeEntries.map((entry) => entry.durationMs), 0.95);
  if (report.metrics.strictSchemaSuccessRate !== strictSchemaSuccessRate ||
    report.metrics.semanticQualityRate !== semanticQualityRate ||
    report.metrics.criticalFailures !== criticalFailures ||
    report.metrics.p95DurationMs !== p95DurationMs) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['metrics'], message: 'metric_mismatch' });
  }

  if (report.productionDecision !== decideProductionDecision({
    mode: report.mode,
    zeroCallCases,
    runtimeEntries,
    metrics: { strictSchemaSuccessRate, semanticQualityRate, criticalFailures, p95DurationMs },
  })) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['productionDecision'], message: 'decision_mismatch' });
  }
});

export function decideProductionDecision(input: {
  mode: 'mock' | 'live';
  zeroCallCases: number;
  runtimeEntries: readonly Pick<Phase695CaseEntry, 'budget' | 'usage'>[];
  metrics: Pick<Phase695Report['metrics'], 'strictSchemaSuccessRate' | 'semanticQualityRate' | 'criticalFailures' | 'p95DurationMs'>;
}): Phase695ProductionDecision {
  if (input.mode === 'mock') return 'mock_quality_not_evidence';
  if (input.zeroCallCases !== 26) return 'zero_call_boundary_failed';
  if (input.runtimeEntries.some((entry) =>
    entry.usage.inputTokens > entry.budget.maxInputTokens ||
    entry.usage.outputTokens > entry.budget.maxOutputTokens ||
    entry.budget.maxCalls !== 2 || entry.budget.maxInputTokens !== 1_950 || entry.budget.maxOutputTokens !== 440,
  )) return 'budget_exceeded';
  if (input.metrics.strictSchemaSuccessRate !== 1) return 'strict_schema_incomplete';
  if (input.metrics.semanticQualityRate < 0.9) return 'semantic_quality_below_threshold';
  if (input.metrics.criticalFailures !== 0) return 'critical_failure';
  if (input.metrics.p95DurationMs > 4_500) return 'latency_budget_exceeded';
  return 'quality_gate_passed';
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function nearestRank(values: readonly number[], percentile: 0.95): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1] ?? 0;
}
