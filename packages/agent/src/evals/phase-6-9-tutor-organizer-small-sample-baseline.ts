import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
  type Phase697V2OrganizerCase,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorCase,
  type Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  runPhase697V2DeterministicOrganizerCase,
  runPhase697V2DeterministicTutorCase,
} from './phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v5-policy.ts';
import {
  buildTutorWrongQuestionSemanticMetrics,
  type OrganizerDecisionObservation,
} from './phase-6-9-tutor-wrong-question-metrics.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256,
  canonicalPhase697SmallSampleJson,
  computePhase697SmallSampleCanonicalSha256,
  validatePhase697SmallSampleManifest,
} from './phase-6-9-tutor-organizer-small-sample-manifest.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-baseline-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-baseline-report-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-baseline-file-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_RELATIVE_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-small-sample-baseline.json' as const;

const TUTOR_GUARD_REASONS = deepFreeze({
  'tutor-v2-zero-route-not-tutor': 'route_not_tutor',
  'tutor-v2-zero-credential-material': 'credential_material',
  'tutor-v2-zero-instruction-override': 'instruction_override',
  'tutor-v2-zero-hostile-accessor': 'hostile_accessor',
} as const);

const ORGANIZER_GUARD_REASONS = deepFreeze({
  'organizer-v2-zero-owner-mismatch': 'owner_mismatch',
  'organizer-v2-zero-credential-material': 'credential_material',
  'organizer-v2-zero-instruction-override': 'instruction_override',
  'organizer-v2-zero-hostile-accessor': 'hostile_accessor',
} as const);

const unitNumber = z.number().finite().min(0).max(1);
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SCHEMA = z
  .object({
    baselineVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION),
    manifestSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256),
    providerInvocations: z.literal(0),
    tutor: z
      .object({
        scoredCases: z.literal(8),
        fullMatches: z.number().int().min(0).max(8),
        intentMacroF1: unitNumber,
        depthAccuracy: unitNumber,
        contextUseAccuracy: unitNumber,
        pedagogyPolicyAccuracy: unitNumber,
        semanticScore: unitNumber,
        criticalFailures: z.number().int().min(0).max(8),
      })
      .strict(),
    organizer: z
      .object({
        scoredDecisions: z.literal(12),
        fullMatches: z.number().int().min(0).max(12),
        subjectAccuracy: unitNumber,
        deckActionAccuracy: unitNumber,
        existingDeckPrecision: unitNumber,
        topicLabelMacroF1: unitNumber,
        evidenceConfidenceAccuracy: unitNumber,
        semanticScore: unitNumber,
        criticalFailures: z.number().int().min(0).max(8),
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

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SCHEMA = z
  .object({
    reportVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_VERSION),
    lineage: z.literal(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE),
    manifestVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION),
    manifestSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256),
    sourceDatasetVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION),
    sourceDatasetSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256),
    sourceEvalPolicyVersion: z.literal(PHASE_6_9_7_V5_EVAL_POLICY_VERSION),
    sourceEvalPolicySha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256),
    mode: z.literal('deterministic'),
    counts: z
      .object({
        guards: z.literal(8),
        runtimePairs: z.literal(8),
        runtimeLanes: z.literal(16),
        tutorRuntimeCases: z.literal(8),
        organizerRuntimeCases: z.literal(8),
        organizerDecisionUnits: z.literal(12),
      })
      .strict(),
    runs: z.array(baselineRunSchema).length(16),
    summary: z
      .object({
        tutorFullMatches: z.number().int().min(0).max(8),
        organizerDecisionFullMatches: z.number().int().min(0).max(12),
        criticalFailures: z.number().int().min(0).max(16),
        providerInvocations: z.literal(0),
        inputTokens: z.literal(0),
        outputTokens: z.literal(0),
        estimatedCostCny: z.literal(0),
      })
      .strict(),
    authority: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SCHEMA,
  })
  .strict();

export type Phase697SmallSampleBaselineReport = z.infer<
  typeof PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SCHEMA
>;

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SCHEMA = z
  .object({
    fileVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_VERSION),
    reportLogicalSha256: sha256Schema,
    report: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SCHEMA,
  })
  .strict();

export function buildPhase697SmallSampleDeterministicBaseline(): Readonly<Phase697SmallSampleBaselineReport> {
  assertSourceBinding();
  const manifestValidation = validatePhase697SmallSampleManifest(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST);
  if (!manifestValidation.ok) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_INVALID');
  }

  const tutorById = new Map(phase697V2TutorCases.map((testCase) => [testCase.id, testCase]));
  const organizerById = new Map(
    phase697V2OrganizerCases.map((testCase) => [testCase.id, testCase]),
  );
  const tutorCases = PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs.map((pair) => {
    const testCase = tutorById.get(pair.tutorCaseId);
    if (!isTutorRuntimeCase(testCase) || testCase.pairedRunIndex !== pair.pairedRunIndex) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_TUTOR_SOURCE_MISMATCH');
    }
    return testCase;
  });
  const organizerCases = PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs.map((pair) => {
    const testCase = organizerById.get(pair.organizerCaseId);
    if (!isOrganizerRuntimeCase(testCase) || testCase.pairedRunIndex !== pair.pairedRunIndex) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_ORGANIZER_SOURCE_MISMATCH');
    }
    return testCase;
  });
  const tutorResults = tutorCases.map(runPhase697V2DeterministicTutorCase);
  const organizerResults = organizerCases.map(runPhase697V2DeterministicOrganizerCase);
  const organizerObservations = organizerResults.flatMap((result) => result.observations);
  const metricsResult = buildTutorWrongQuestionSemanticMetrics(
    tutorResults.map((result) => result.observation),
    organizerObservations,
  );
  if (!metricsResult.ok) throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_METRICS_INVALID');

  const tutorFullMatches = tutorResults.filter((result) => result.run.passed).length;
  const organizerDecisionFullMatches = organizerObservations.filter(
    organizerObservationMatches,
  ).length;
  const tutorCriticalFailures = tutorResults.filter((result) => result.run.criticalFailure).length;
  const organizerCriticalFailures = organizerResults.filter(
    (result) => result.run.criticalFailure,
  ).length;
  const authority = PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SCHEMA.parse({
    baselineVersion: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_VERSION,
    manifestSha256: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
    providerInvocations: 0,
    tutor: {
      scoredCases: metricsResult.metrics.tutor.scoredCases,
      fullMatches: tutorFullMatches,
      intentMacroF1: metricsResult.metrics.tutor.intentMacroF1,
      depthAccuracy: metricsResult.metrics.tutor.depthAccuracy,
      contextUseAccuracy: metricsResult.metrics.tutor.contextUseAccuracy,
      pedagogyPolicyAccuracy: metricsResult.metrics.tutor.pedagogyPolicyAccuracy,
      semanticScore: metricsResult.metrics.tutor.semanticScore,
      criticalFailures: tutorCriticalFailures,
    },
    organizer: {
      scoredDecisions: metricsResult.metrics.organizer.scoredDecisions,
      fullMatches: organizerDecisionFullMatches,
      subjectAccuracy: metricsResult.metrics.organizer.subjectAccuracy,
      deckActionAccuracy: metricsResult.metrics.organizer.deckActionAccuracy,
      existingDeckPrecision: metricsResult.metrics.organizer.existingDeckPrecision,
      topicLabelMacroF1: metricsResult.metrics.organizer.topicLabelMacroF1,
      evidenceConfidenceAccuracy: metricsResult.metrics.organizer.evidenceConfidenceAccuracy,
      semanticScore: metricsResult.metrics.organizer.semanticScore,
      criticalFailures: organizerCriticalFailures,
    },
    combinedSemanticScore: metricsResult.metrics.combinedSemanticScore,
  });
  if (
    computePhase697SmallSampleCanonicalSha256(authority) !==
    PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_AUTHORITY_SHA256
  ) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_MISMATCH');
  }

  return deepFreeze(
    PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SCHEMA.parse({
      reportVersion: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_VERSION,
      lineage: PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
      manifestVersion: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
      manifestSha256: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
      sourceDatasetVersion: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
      sourceDatasetSha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
      sourceEvalPolicyVersion: PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
      sourceEvalPolicySha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256,
      mode: 'deterministic',
      counts: {
        guards: 8,
        runtimePairs: 8,
        runtimeLanes: 16,
        tutorRuntimeCases: 8,
        organizerRuntimeCases: 8,
        organizerDecisionUnits: organizerObservations.length,
      },
      runs: [
        ...tutorResults.map((result) => result.run),
        ...organizerResults.map((result) => result.run),
      ],
      summary: {
        tutorFullMatches,
        organizerDecisionFullMatches,
        criticalFailures: tutorCriticalFailures + organizerCriticalFailures,
        providerInvocations: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostCny: 0,
      },
      authority,
    }),
  );
}

export function validatePhase697SmallSampleSourceCoverage(
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

  for (const caseId of PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.tutorGuardCaseIds) {
    const testCase = tutorById.get(caseId);
    const expectedReason = TUTOR_GUARD_REASONS[caseId];
    if (
      !testCase ||
      testCase.expectedRuntimeInvocations !== 0 ||
      testCase.expected.zeroCallReason !== expectedReason
    ) {
      issues.add('tutor_guard_source_mismatch');
    }
  }
  for (const caseId of PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.organizerGuardCaseIds) {
    const testCase = organizerById.get(caseId);
    const expectedReason = ORGANIZER_GUARD_REASONS[caseId];
    if (
      !testCase ||
      testCase.expectedRuntimeInvocations !== 0 ||
      testCase.expected.zeroCallReason !== expectedReason
    ) {
      issues.add('organizer_guard_source_mismatch');
    }
  }

  let organizerDecisionUnits = 0;
  for (const pair of PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs) {
    const tutorCase = tutorById.get(pair.tutorCaseId);
    const organizerCase = organizerById.get(pair.organizerCaseId);
    if (!isTutorRuntimeCase(tutorCase) || tutorCase.pairedRunIndex !== pair.pairedRunIndex) {
      issues.add('tutor_runtime_source_mismatch');
      continue;
    }
    if (
      !isOrganizerRuntimeCase(organizerCase) ||
      organizerCase.pairedRunIndex !== pair.pairedRunIndex
    ) {
      issues.add('organizer_runtime_source_mismatch');
      continue;
    }
    organizerDecisionUnits += organizerCase.expected.decisions.length;
    if (
      canonicalPhase697SmallSampleJson(pair.selectionTags) !==
      canonicalPhase697SmallSampleJson(buildSelectionTags(tutorCase, organizerCase))
    ) {
      issues.add('selection_coverage_mismatch');
    }
  }
  if (organizerDecisionUnits !== 12) issues.add('organizer_decision_count_mismatch');

  return issues.size === 0 ? { ok: true } : deepFreeze({ ok: false, issues: [...issues].sort() });
}

export const PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_AUTHORITY_SHA256 =
  'd36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e' as const;

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT =
  buildPhase697SmallSampleDeterministicBaseline();
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY =
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT.authority;
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256 =
  computePhase697SmallSampleCanonicalSha256(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY);
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256 =
  computePhase697SmallSampleCanonicalSha256(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT);

const baselineFileEnvelope = deepFreeze({
  fileVersion: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_VERSION,
  reportLogicalSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
  report: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT,
});

export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES = `${JSON.stringify(
  baselineFileEnvelope,
  null,
  2,
)}\n`;
export const PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256 = createHash('sha256')
  .update(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES, 'utf8')
  .digest('hex');

export const PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_REPORT_SHA256 =
  'ad3aa54d61a5890c777358edebdfd3a65c6faa2ba7f68ff562afbad09259d002' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_FILE_SHA256 =
  'e8bcbcb57afd23b9ec3dd8f3614550a13df629bd8105a4d350b5ada4b0aa658b' as const;

if (
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256 !==
    PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_AUTHORITY_SHA256 ||
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256 !==
    PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_REPORT_SHA256 ||
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256 !==
    PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_FILE_SHA256
) {
  throw new Error('PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FROZEN_SHA_MISMATCH');
}

export function validatePhase697SmallSampleBaselineFile(input: string | Uint8Array):
  | Readonly<{
      ok: true;
      reportLogicalSha256: string;
      physicalFileSha256: string;
    }>
  | Readonly<{ ok: false; code: string }> {
  try {
    const text =
      typeof input === 'string' ? input : new TextDecoder('utf-8', { fatal: true }).decode(input);
    const physicalFileSha256 = createHash('sha256').update(text, 'utf8').digest('hex');
    const parsed = PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SCHEMA.safeParse(JSON.parse(text));
    if (!parsed.success) return { ok: false, code: 'schema_invalid' };
    const reportLogicalSha256 = computePhase697SmallSampleCanonicalSha256(parsed.data.report);
    if (
      reportLogicalSha256 !== parsed.data.reportLogicalSha256 ||
      reportLogicalSha256 !== PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256 ||
      canonicalPhase697SmallSampleJson(parsed.data.report) !==
        canonicalPhase697SmallSampleJson(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT) ||
      text !== PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES ||
      physicalFileSha256 !== PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256
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
      PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION ||
    PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256 !==
      PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256 ||
    PHASE_6_9_7_V5_EVAL_POLICY_SHA256 !== PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256
  ) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_SOURCE_BINDING_MISMATCH');
  }
  const coverage = validatePhase697SmallSampleSourceCoverage();
  if (!coverage.ok) {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_SOURCE_COVERAGE_MISMATCH');
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

function buildSelectionTags(
  tutorCase: Phase697V2TutorRuntimeCase,
  organizerCase: Phase697V2OrganizerRuntimeCase,
) {
  const tags = [`tutor:${tutorCase.expected.intent}`, `language:${tutorCase.authority.language}`];
  if (tutorCase.tags.includes('conflicting_signals')) tags.push('tutor:conflicting_signals');

  const subjects = uniqueOrdered(
    organizerCase.expected.decisions.map((decision) => decision.subject),
  );
  tags.push(`organizer:${subjects.join('+')}`);
  const actions = new Set(organizerCase.expected.decisions.map((decision) => decision.deckAction));
  if (actions.size === 1 && actions.has('create_topic')) tags.push('action:create_topic');
  else if (actions.size === 1 && actions.has('reuse_existing')) tags.push('action:reuse_existing');
  else if (actions.size === 2 && actions.has('create_topic') && actions.has('reuse_existing')) {
    tags.push('action:create+reuse');
  } else {
    tags.push('action:invalid');
  }

  if (
    organizerCase.expected.decisions.some((decision) =>
      decision.requiredEvidenceCodes.includes('structured_subject'),
    )
  ) {
    tags.push('authority:structured_subject');
  }
  if (organizerCase.authority.batchRelation === 'cross_subject_batch') {
    tags.push('batch:cross_subject');
  }
  if (tutorCase.tags.includes('critical_hint_no_final')) tags.push('critical:hint_no_final');
  if (organizerCase.tags.includes('critical_locked_name')) tags.push('critical:locked_name');
  if (organizerCase.tags.includes('critical_no_write_command')) {
    tags.push('critical:no_write_command');
  }
  return tags;
}

function uniqueOrdered<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function isTutorRuntimeCase(
  value: (typeof phase697V2TutorCases)[number] | undefined,
): value is Phase697V2TutorRuntimeCase {
  return value?.expectedRuntimeInvocations === 1;
}

function isOrganizerRuntimeCase(
  value: (typeof phase697V2OrganizerCases)[number] | undefined,
): value is Phase697V2OrganizerRuntimeCase {
  return value?.expectedRuntimeInvocations === 1;
}

function organizerObservationMatches(observation: OrganizerDecisionObservation) {
  if (
    !observation.validOutput ||
    observation.actualSubject !== observation.expectedSubject ||
    observation.actualDeckAction !== observation.expectedDeckAction ||
    (observation.expectedDeckAction === 'reuse_existing' &&
      observation.actualDeckIndex !== observation.expectedDeckIndex) ||
    observation.actualTopicLabel === null ||
    observation.actualConfidence !== observation.expectedConfidence
  ) {
    return false;
  }
  const actualTopic = normalizeLabel(observation.actualTopicLabel);
  const acceptedTopics = observation.acceptedTopicLabels.map(normalizeLabel);
  if (!acceptedTopics.includes(actualTopic)) return false;
  const actualEvidence = new Set(observation.actualEvidenceCodes);
  const allowedEvidence = new Set(observation.allowedEvidenceCodes);
  return (
    observation.requiredEvidenceCodes.every((code) => actualEvidence.has(code)) &&
    observation.actualEvidenceCodes.every((code) => allowedEvidence.has(code))
  );
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
