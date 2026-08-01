import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerCase,
  type Phase697V2TutorCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
  runPhase697V2DeterministicBaseline,
} from './phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v5-policy.ts';
import {
  PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES,
  PHASE_6_9_7_FULL_GATE_LINEAGE,
  PHASE_6_9_7_FULL_GATE_MANIFEST,
  PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
  PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION,
  canonicalPhase697FullGateJson,
  computePhase697FullGateCanonicalSha256,
  validatePhase697FullGateManifest,
} from './phase-6-9-tutor-organizer-full-gate-manifest.ts';

export const PHASE_6_9_7_FULL_GATE_BASELINE_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-baseline-v1' as const;
export const PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-baseline-report-v1' as const;
export const PHASE_6_9_7_FULL_GATE_BASELINE_FILE_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-baseline-file-v1' as const;
export const PHASE_6_9_7_FULL_GATE_BASELINE_FILE_RELATIVE_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-full-gate-baseline.json' as const;
export const PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256 =
  '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca' as const;

const unitNumber = z.number().finite().min(0).max(1);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SCHEMA = z
  .object({
    baselineVersion: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_VERSION),
    manifestSha256: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256),
    sourceDatasetVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION),
    sourceDatasetSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256),
    sourceEvalPolicyVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION),
    sourceEvalPolicySha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256),
    sourceDeterministicBaselineSha256: z.literal(
      PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256,
    ),
    providerInvocations: z.literal(0),
    counts: z
      .object({
        cases: z.literal(72),
        zeroCallCases: z.literal(24),
        runtimeCases: z.literal(48),
        pairedRequests: z.literal(24),
        organizerDecisionUnits: z.literal(32),
      })
      .strict(),
    summary: z
      .object({
        passed: z.literal(12),
        failed: z.literal(36),
        criticalFailures: z.literal(0),
        inputTokens: z.literal(0),
        outputTokens: z.literal(0),
        estimatedCostCny: z.literal(0),
      })
      .strict(),
    tutor: z
      .object({
        scoredCases: z.literal(24),
        fullMatches: z.literal(12),
        intentMacroF1: unitNumber,
        depthAccuracy: unitNumber,
        contextUseAccuracy: unitNumber,
        pedagogyPolicyAccuracy: unitNumber,
        semanticScore: unitNumber,
        invalidCases: z.literal(0),
        criticalFailures: z.literal(0),
      })
      .strict(),
    organizer: z
      .object({
        scoredDecisions: z.literal(32),
        fullMatches: z.literal(0),
        subjectAccuracy: unitNumber,
        deckActionAccuracy: unitNumber,
        existingDeckPrecision: unitNumber,
        topicLabelMacroF1: unitNumber,
        evidenceConfidenceAccuracy: unitNumber,
        semanticScore: unitNumber,
        invalidDecisions: z.literal(0),
        criticalFailures: z.literal(0),
      })
      .strict(),
    combinedSemanticScore: unitNumber,
  })
  .strict();

const baselineRunSchema = z
  .object({
    caseId: z.string().regex(/^(tutor|organizer)-v2-runtime-[0-9]{2}$/),
    agent: z.enum(['tutor', 'wrong_question_organizer']),
    passed: z.boolean(),
    criticalFailure: z.boolean(),
    expectedCode: z.string().min(1).max(256),
    actualCode: z.string().min(1).max(256),
  })
  .strict();

export const PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SCHEMA = z
  .object({
    reportVersion: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_7_FULL_GATE_LINEAGE),
    manifestVersion: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION),
    manifestSha256: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256),
    sourceDatasetVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION),
    sourceDatasetSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256),
    sourceEvalPolicyVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION),
    sourceEvalPolicySha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256),
    sourceDeterministicBaselineSha256: z.literal(
      PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256,
    ),
    mode: z.literal('deterministic'),
    runs: z.array(baselineRunSchema).length(48),
    authority: PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SCHEMA,
  })
  .strict();

export type Phase697FullGateBaselineReport = z.infer<
  typeof PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SCHEMA
>;

export const PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SCHEMA = z
  .object({
    fileVersion: z.literal(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_VERSION),
    reportLogicalSha256: sha256Schema,
    report: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SCHEMA,
  })
  .strict();

export const PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_AUTHORITY_SHA256 =
  '2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2' as const;

export function buildPhase697FullGateDeterministicBaseline(): Readonly<Phase697FullGateBaselineReport> {
  assertSourceBinding();
  const source = runPhase697V2DeterministicBaseline();
  if (!source.metrics.ok) throw new Error('PHASE_6_9_7_FULL_GATE_BASELINE_METRICS_INVALID');
  const authority = PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SCHEMA.parse({
    baselineVersion: PHASE_6_9_7_FULL_GATE_BASELINE_VERSION,
    manifestSha256: PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
    sourceDatasetVersion: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
    sourceDatasetSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
    sourceEvalPolicyVersion: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION,
    sourceEvalPolicySha256: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
    sourceDeterministicBaselineSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256,
    providerInvocations: 0,
    counts: source.counts,
    summary: {
      passed: source.summary.passed,
      failed: source.summary.failed,
      criticalFailures: source.summary.criticalFailures,
      inputTokens: source.summary.inputTokens,
      outputTokens: source.summary.outputTokens,
      estimatedCostCny: source.summary.estimatedCostCny,
    },
    tutor: {
      ...source.metrics.metrics.tutor,
      fullMatches: source.runs.filter((run) => run.agent === 'tutor' && run.passed).length,
      criticalFailures: source.runs.filter((run) => run.agent === 'tutor' && run.criticalFailure)
        .length,
    },
    organizer: {
      ...source.metrics.metrics.organizer,
      fullMatches: source.runs.filter(
        (run) => run.agent === 'wrong_question_organizer' && run.passed,
      ).length,
      criticalFailures: source.runs.filter(
        (run) => run.agent === 'wrong_question_organizer' && run.criticalFailure,
      ).length,
    },
    combinedSemanticScore: source.metrics.metrics.combinedSemanticScore,
  });
  if (
    computePhase697FullGateCanonicalSha256(authority) !==
    PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_AUTHORITY_SHA256
  ) {
    throw new Error('PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_MISMATCH');
  }
  return deepFreeze(
    PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SCHEMA.parse({
      reportVersion: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_VERSION,
      lineage: PHASE_6_9_7_FULL_GATE_LINEAGE,
      manifestVersion: PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
      manifestSha256: PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
      sourceDatasetVersion: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
      sourceDatasetSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
      sourceEvalPolicyVersion: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION,
      sourceEvalPolicySha256: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
      sourceDeterministicBaselineSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256,
      mode: 'deterministic',
      runs: source.runs,
      authority,
    }),
  );
}

export function validatePhase697FullGateSourceCoverage(
  input: Readonly<{
    tutorCases?: readonly Phase697V2TutorCase[];
    organizerCases?: readonly Phase697V2OrganizerCase[];
  }> = {},
): Readonly<{ ok: true }> | Readonly<{ ok: false; issues: readonly string[] }> {
  const tutorCases = input.tutorCases ?? phase697V2TutorCases;
  const organizerCases = input.organizerCases ?? phase697V2OrganizerCases;
  const issues = new Set<string>();
  const tutorById = indexCases(tutorCases, 'tutor', issues);
  const organizerById = indexCases(organizerCases, 'organizer', issues);
  let organizerDecisionUnits = 0;

  for (const expected of PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES) {
    const testCase =
      expected.agent === 'tutor'
        ? tutorById.get(expected.caseId)
        : organizerById.get(expected.caseId);
    const expectedInvocations = expected.kind === 'guard' ? 0 : 1;
    if (
      testCase === undefined ||
      testCase.agent !== expected.agent ||
      testCase.expectedRuntimeInvocations !== expectedInvocations ||
      (expected.kind === 'runtime' &&
        (!('pairedRunIndex' in testCase) || testCase.pairedRunIndex !== expected.pairedRunIndex))
    ) {
      issues.add(`${expected.agent}_source_mismatch`);
      continue;
    }
    if (
      testCase.agent === 'wrong_question_organizer' &&
      testCase.expectedRuntimeInvocations === 1
    ) {
      organizerDecisionUnits += testCase.expected.decisions.length;
    }
  }
  if (tutorCases.length + organizerCases.length !== 72) issues.add('case_count_mismatch');
  if (organizerDecisionUnits !== 32) issues.add('organizer_decision_count_mismatch');
  return issues.size === 0 ? { ok: true } : deepFreeze({ ok: false, issues: [...issues].sort() });
}

export const PHASE_6_9_7_FULL_GATE_BASELINE_REPORT = buildPhase697FullGateDeterministicBaseline();
export const PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY =
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT.authority;
export const PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256 =
  computePhase697FullGateCanonicalSha256(PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY);
export const PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256 = computePhase697FullGateCanonicalSha256(
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT,
);

const baselineFileEnvelope = deepFreeze({
  fileVersion: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_VERSION,
  reportLogicalSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  report: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT,
});

export const PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES = `${JSON.stringify(
  baselineFileEnvelope,
  null,
  2,
)}\n`;
export const PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256 = createHash('sha256')
  .update(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES, 'utf8')
  .digest('hex');

export const PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_REPORT_SHA256 =
  '16c574b1cf9f22beace9ac4c60fb098989795752fb57421ef957795b5f4782c9' as const;
export const PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_FILE_SHA256 =
  '16aa1773d3774380eac7e7379601c1f812d9c920ef8f81e6f91a6ab5ae8a6f73' as const;

if (
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256 !==
    PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_AUTHORITY_SHA256 ||
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256 !==
    PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_REPORT_SHA256 ||
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256 !== PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_FILE_SHA256
) {
  throw new Error('PHASE_6_9_7_FULL_GATE_BASELINE_FROZEN_SHA_MISMATCH');
}

export function validatePhase697FullGateBaselineFile(input: string | Uint8Array):
  | Readonly<{
      ok: true;
      reportLogicalSha256: string;
      physicalFileSha256: string;
    }>
  | Readonly<{ ok: false; code: string }> {
  try {
    const text =
      typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input);
    const physicalFileSha256 = createHash('sha256').update(input).digest('hex');
    const parsed = PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SCHEMA.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, code: 'schema_invalid' };
    const reportLogicalSha256 = computePhase697FullGateCanonicalSha256(parsed.data.report);
    if (
      reportLogicalSha256 !== parsed.data.reportLogicalSha256 ||
      reportLogicalSha256 !== PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_REPORT_SHA256 ||
      canonicalPhase697FullGateJson(parsed.data.report) !==
        canonicalPhase697FullGateJson(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT) ||
      text !== PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES ||
      physicalFileSha256 !== PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_FILE_SHA256
    ) {
      return { ok: false, code: 'authority_mismatch' };
    }
    return deepFreeze({ ok: true, reportLogicalSha256, physicalFileSha256 });
  } catch {
    return { ok: false, code: 'invalid_input' };
  }
}

function assertSourceBinding() {
  if (
    PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION !==
      PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION ||
    PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256 !==
      PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256 ||
    PHASE_6_9_7_V5_EVAL_POLICY_VERSION !== PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION ||
    PHASE_6_9_7_V5_EVAL_POLICY_SHA256 !== PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256 ||
    PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 !==
      PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256 ||
    PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.length !== 72 ||
    !validatePhase697FullGateManifest(PHASE_6_9_7_FULL_GATE_MANIFEST).ok ||
    !validatePhase697FullGateSourceCoverage().ok
  ) {
    throw new Error('PHASE_6_9_7_FULL_GATE_SOURCE_BINDING_MISMATCH');
  }
}

function indexCases<T extends Readonly<{ id: string }>>(
  cases: readonly T[],
  prefix: 'tutor' | 'organizer',
  issues: Set<string>,
) {
  const indexed = new Map<string, T>();
  for (const testCase of cases) {
    if (indexed.has(testCase.id)) issues.add(`${prefix}_source_duplicate_id`);
    indexed.set(testCase.id, testCase);
  }
  return indexed;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
