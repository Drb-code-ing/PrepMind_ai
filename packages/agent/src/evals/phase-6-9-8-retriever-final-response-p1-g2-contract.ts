import { z } from 'zod';

import {
  canonicalP1Json,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_P1_LINEAGE,
  PHASE_6_9_8_P1_MANIFEST_SHA256,
  PHASE_6_9_8_P1_POLICY_SHA256,
  sha256P1,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import { PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import type { Phase698P1G1Report } from './phase-6-9-8-retriever-final-response-p1-scorer.ts';
import { scorePhase698P1G1 } from './phase-6-9-8-retriever-final-response-p1-scorer.ts';
import type { Phase698P1BaselineBundle } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';

export const PHASE_6_9_8_P1_G2_LINEAGE = 'phase-6.9.8-retriever-final-response-p1-g2-v1' as const;
export const PHASE_6_9_8_P1_G2_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-report-v1' as const;
export const PHASE_6_9_8_P1_G2_AUTHORITY =
  'zero_provider_retriever_final_response_p1_g2_runner_durability' as const;
export const PHASE_6_9_8_P1_G2_QUALITY_AUTHORITY = 'none' as const;
export const PHASE_6_9_8_P1_G2_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-durability-v1' as const;
export const PHASE_6_9_8_P1_G2_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-marker-v1' as const;
export const PHASE_6_9_8_P1_G2_JOURNAL_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-journal-v1' as const;
export const PHASE_6_9_8_P1_G2_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-artifact-v1' as const;
export const PHASE_6_9_8_P1_G2_RECOVERY_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-p1-g2-recovery-claim-v1' as const;

export const PHASE_6_9_8_P1_G2_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-g2.marker' as const;
export const PHASE_6_9_8_P1_G2_JOURNAL_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-g2-{runId}.journal.jsonl' as const;
export const PHASE_6_9_8_P1_G2_REPORT_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-g2-{runId}.report.json' as const;
export const PHASE_6_9_8_P1_G2_RECOVERY_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-g2-{runId}.recovery.claim' as const;

export const PHASE_6_9_8_P1_G2_LANE_ORDER = Object.freeze([
  'rewrite_01',
  'rewrite_03',
  'rewrite_05',
  'rewrite_09',
  'rewrite_12',
  'rewrite_15',
  'final_01',
  'final_07',
  'final_09',
  'final_11',
  'final_13',
  'final_15',
] as const);
export type Phase698P1G2LaneId = (typeof PHASE_6_9_8_P1_G2_LANE_ORDER)[number];
export const PHASE_6_9_8_P1_G2_FAILURE_CATEGORIES = Object.freeze([
  'none',
  'semantic_mismatch',
  'contract',
  'permission',
  'safety',
  'budget',
  'transport',
  'schema',
  'usage',
  'stale',
  'abort',
] as const);
export type Phase698P1G2FailureCategory = (typeof PHASE_6_9_8_P1_G2_FAILURE_CATEGORIES)[number];
export const PHASE_6_9_8_P1_G2_DISPOSITIONS = Object.freeze([
  'succeeded',
  'semantic_mismatch',
  'attempted_failed',
  'attempted_aborted',
  'not_started_quality_breaker',
  'not_started_parent_aborted',
  'not_started_stale',
] as const);
export type Phase698P1G2Disposition = (typeof PHASE_6_9_8_P1_G2_DISPOSITIONS)[number];

const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const UUID = z.string().uuid();
const DATETIME = z.string().datetime({ offset: true });
const NON_NEGATIVE_INT = z.number().int().safe().nonnegative();
const UNIT = z.number().finite().min(0).max(1);
const FAILURE = z.enum(PHASE_6_9_8_P1_G2_FAILURE_CATEGORIES);
const DISPOSITION = z.enum(PHASE_6_9_8_P1_G2_DISPOSITIONS);

export const PHASE_6_9_8_P1_G2_SOURCE_SCHEMA = z
  .object({
    schemaVersion: z.literal(`${PHASE_6_9_8_P1_G2_LINEAGE}-source-v1`),
    lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
    mode: z.literal('synthetic_zero_provider'),
    branch: z.literal('drb/phase-6-9-8-g2-runner-durability'),
    head: z.string().regex(/^[0-9a-f]{40}$/u),
    upstream: z.string().regex(/^[0-9a-f]{40}$/u),
    origin: z.string().regex(/^[0-9a-f]{40}$/u),
    manifestSha256: z.literal(PHASE_6_9_8_P1_MANIFEST_SHA256),
    frozenManifestSha256: z.literal(PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_P1_POLICY_SHA256),
    frozenPolicySha256: z.literal(PHASE_6_9_8_P1_FROZEN_POLICY_SHA256),
    baselineSha256: z.literal(PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256),
    approvedTag: z.null(),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidence: z
      .object({
        markerCount: z.literal(0),
        journalCount: z.literal(0),
        artifactCount: z.literal(0),
        recoveryClaimCount: z.literal(0),
      })
      .strict(),
  })
  .strict();
export type Phase698P1G2Source = z.infer<typeof PHASE_6_9_8_P1_G2_SOURCE_SCHEMA>;

const GUARD_OBSERVATION = z
  .object({
    caseId: z.string(),
    observedReasonCode: z.string().min(1).max(64),
    strict: z.boolean(),
    terminal: z.boolean(),
    fakeSearchPortCalls: NON_NEGATIVE_INT,
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();
const REWRITE_OBSERVATION = z
  .object({
    caseId: z.string(),
    strict: z.boolean(),
    runtime: z.boolean(),
    wire: z.boolean(),
    verifiedUsage: z.boolean(),
    terminal: z.boolean(),
    metricEligible: z.boolean(),
    expectedNoHit: z.boolean(),
    noHitObserved: z.boolean().nullable(),
    baselineRecallAt5: UNIT.nullable(),
    baselineNdcgAt5: UNIT.nullable(),
    candidateRecallAt5: UNIT.nullable(),
    candidateNdcgAt5: UNIT.nullable(),
    critical: z.boolean(),
    intentPreserved: z.boolean(),
    unsafeRewrite: z.boolean(),
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    durationMs: z.number().finite().nonnegative().nullable(),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();
const FINAL_OBSERVATION = z
  .object({
    caseId: z.string(),
    strict: z.boolean(),
    runtime: z.boolean(),
    wire: z.boolean(),
    verifiedUsage: z.boolean(),
    terminal: z.boolean(),
    groundedScore: UNIT.nullable(),
    requiredCitationCount: NON_NEGATIVE_INT,
    requiredNotice: z.enum(['none', 'caution', 'conflict', 'insufficient']),
    observedCitationCount: NON_NEGATIVE_INT,
    citationTruePositiveCount: NON_NEGATIVE_INT,
    noticeSatisfied: z.boolean(),
    falseToolSuccess: z.boolean(),
    falseCitation: z.boolean(),
    safetyFailure: z.boolean(),
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    durationMs: z.number().finite().nonnegative().nullable(),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();

export type Phase698P1G2GuardObservation = z.infer<typeof GUARD_OBSERVATION>;
export type Phase698P1G2RewriteObservation = z.infer<typeof REWRITE_OBSERVATION>;
export type Phase698P1G2FinalResponseObservation = z.infer<typeof FINAL_OBSERVATION>;

export const PHASE_6_9_8_P1_G2_WIRE_SCHEMA = z
  .object({
    reservation: z.literal(1),
    dispatch: z.union([z.literal(0), z.literal(1)]),
    response: z.union([z.literal(0), z.literal(1)]),
    strictValidated: z.union([z.literal(0), z.literal(1)]),
    verifiedUsage: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
export type Phase698P1G2Wire = z.infer<typeof PHASE_6_9_8_P1_G2_WIRE_SCHEMA>;

export const PHASE_6_9_8_P1_G2_LANE_TERMINAL_SCHEMA = z
  .object({
    laneId: z.enum(PHASE_6_9_8_P1_G2_LANE_ORDER),
    kind: z.enum(['rewrite', 'final_response']),
    caseId: z.enum(PHASE_6_9_8_P1_G2_LANE_ORDER),
    sequence: z.number().int().positive().max(12),
    state: z.literal('terminal'),
    disposition: DISPOSITION,
    failureCategory: FAILURE,
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    wire: PHASE_6_9_8_P1_G2_WIRE_SCHEMA,
    breakerOpened: z.boolean(),
    terminalReason: z.string().regex(/^[a-z0-9_]{1,96}$/u),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.caseId !== entry.laneId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_identity_mismatch' });
    }
    if (entry.kind === 'rewrite' && !entry.laneId.startsWith('rewrite_')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_kind_mismatch' });
    }
    if (entry.kind === 'final_response' && !entry.laneId.startsWith('final_')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_kind_mismatch' });
    }
    if (entry.disposition === 'succeeded' && entry.failureCategory !== 'none') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'success_failure_mismatch' });
    }
    if (
      entry.disposition.startsWith('not_started_') &&
      (entry.wire.dispatch !== 0 || entry.wire.response !== 0 || entry.candidateInvocations !== 0)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'not_started_wire' });
    }
  });
export type Phase698P1G2LaneTerminal = z.infer<typeof PHASE_6_9_8_P1_G2_LANE_TERMINAL_SCHEMA>;

export const PHASE_6_9_8_P1_G2_REPORT_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_P1_G2_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_P1_G2_AUTHORITY),
    qualityAuthority: z.literal(PHASE_6_9_8_P1_G2_QUALITY_AUTHORITY),
    source: PHASE_6_9_8_P1_G2_SOURCE_SCHEMA,
    execution: z
      .object({
        providerCalls: z.literal(0),
        credentialReads: z.literal(0),
        qwenEmbeddingCalls: z.literal(0),
        candidateInvocations: z.number().int().min(0).max(12),
        maxConcurrency: z.literal(1),
        retry: z.literal(false),
        resume: z.literal(false),
        replay: z.literal(false),
        backfill: z.literal(false),
        backgroundJob: z.literal(false),
        outbox: z.literal(false),
        breakerReason: z
          .string()
          .regex(/^[a-z0-9_]{1,96}$/u)
          .nullable(),
      })
      .strict(),
    formalEvidence: z
      .object({
        markerCount: z.literal(0),
        journalCount: z.literal(0),
        artifactCount: z.literal(0),
        recoveryClaimCount: z.literal(0),
      })
      .strict(),
    guardEntries: z.array(GUARD_OBSERVATION).length(8),
    rewriteEntries: z.array(REWRITE_OBSERVATION).length(6),
    finalResponseEntries: z.array(FINAL_OBSERVATION).length(6),
    laneTerminals: z.array(PHASE_6_9_8_P1_G2_LANE_TERMINAL_SCHEMA).length(12),
  })
  .strict();
export type Phase698P1G2Report = z.infer<typeof PHASE_6_9_8_P1_G2_REPORT_SCHEMA>;

export const PHASE_6_9_8_P1_G2_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_P1_G2_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_P1_G2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_P1_G2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    plannedGuards: z.literal(8),
    plannedLanes: z.literal(12),
    candidateInvocationCap: z.literal(12),
    source: PHASE_6_9_8_P1_G2_SOURCE_SCHEMA,
    creatorPid: z.number().int().positive(),
    createdAt: DATETIME,
  })
  .strict();
export type Phase698P1G2Marker = z.infer<typeof PHASE_6_9_8_P1_G2_MARKER_SCHEMA>;

const JOURNAL_COMMON = {
  journalVersion: z.literal(PHASE_6_9_8_P1_G2_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
  runId: UUID,
  sequence: z.number().int().nonnegative(),
  markerSha256: HEX,
  previousHash: HEX.nullable(),
  recordHash: HEX,
} as const;
export const PHASE_6_9_8_P1_G2_JOURNAL_SCHEMA = z.discriminatedUnion('event', [
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('attempt_reserved'), createdAt: DATETIME })
    .strict(),
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('guard_terminal'), entry: GUARD_OBSERVATION })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_reserved'),
      laneId: z.enum(PHASE_6_9_8_P1_G2_LANE_ORDER),
      sequenceInRun: z.number().int().positive().max(12),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_stage'),
      laneId: z.enum(PHASE_6_9_8_P1_G2_LANE_ORDER),
      stage: z.enum(['dispatch_started', 'response_observed', 'strict_validated']),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_terminal'),
      entry: PHASE_6_9_8_P1_G2_LANE_TERMINAL_SCHEMA,
    })
    .strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('run_terminal'), reportSha256: HEX }).strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('recovery_claimed'), claimSha256: HEX }).strict(),
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('publication_started'), reportSha256: HEX })
    .strict(),
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('evidence_published'), evidenceSha256: HEX })
    .strict(),
]);
export type Phase698P1G2JournalRecord = z.infer<typeof PHASE_6_9_8_P1_G2_JOURNAL_SCHEMA>;

export const PHASE_6_9_8_P1_G2_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_P1_G2_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_P1_G2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_G2_LINEAGE),
    runId: UUID,
    markerSha256: HEX,
    reportLogicalSha256: HEX,
    report: PHASE_6_9_8_P1_G2_REPORT_SCHEMA,
    durability: z
      .object({
        publicationMode: z.enum(['runtime', 'recovery']),
        terminalSequence: z.number().int().positive(),
        terminalRecordHash: HEX,
        journalRecordsBeforePublication: z.number().int().positive(),
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
        recoveryClaimSha256: HEX.nullable(),
      })
      .strict(),
  })
  .strict();
export type Phase698P1G2Artifact = z.infer<typeof PHASE_6_9_8_P1_G2_ARTIFACT_SCHEMA>;

export type Phase698P1G2Gate = Readonly<{
  status: 'g2_runner_durability_ready' | 'g2_report_invalid' | 'g2_runner_quality_failed';
  passed: boolean;
  authority: typeof PHASE_6_9_8_P1_G2_AUTHORITY;
  qualityAuthority: 'none';
  failureReasons: readonly string[];
}>;

export function buildPhase698P1G2Report(input: {
  runId: string;
  source: Phase698P1G2Source;
  guardEntries: readonly Phase698P1G2GuardObservation[];
  rewriteEntries: readonly Phase698P1G2RewriteObservation[];
  finalResponseEntries: readonly Phase698P1G2FinalResponseObservation[];
  laneTerminals: readonly Phase698P1G2LaneTerminal[];
  candidateInvocations: number;
  breakerReason: string | null;
}): Phase698P1G2Report {
  return PHASE_6_9_8_P1_G2_REPORT_SCHEMA.parse({
    schemaVersion: PHASE_6_9_8_P1_G2_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    runId: input.runId,
    authority: PHASE_6_9_8_P1_G2_AUTHORITY,
    qualityAuthority: 'none',
    source: input.source,
    execution: {
      providerCalls: 0,
      credentialReads: 0,
      qwenEmbeddingCalls: 0,
      candidateInvocations: input.candidateInvocations,
      maxConcurrency: 1,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
      breakerReason: input.breakerReason,
    },
    formalEvidence: { markerCount: 0, journalCount: 0, artifactCount: 0, recoveryClaimCount: 0 },
    guardEntries: input.guardEntries,
    rewriteEntries: input.rewriteEntries,
    finalResponseEntries: input.finalResponseEntries,
    laneTerminals: input.laneTerminals,
  });
}

export function canonicalPhase698P1G2Json(value: unknown): string {
  return canonicalP1Json(value);
}

export function sha256Phase698P1G2(value: string): string {
  return sha256P1(value);
}

export function projectPhase698P1G2ToG1Report(report: Phase698P1G2Report): Phase698P1G1Report {
  return {
    schemaVersion: 'phase-6.9.8-retriever-final-response-p1-g1-report-v1',
    lineage: PHASE_6_9_8_P1_LINEAGE,
    manifestSha256: PHASE_6_9_8_P1_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
    authority: 'zero_provider_retriever_final_response_p1_g1_strict_scorer',
    qualityAuthority: 'none',
    execution: {
      providerCalls: 0,
      credentialReads: 0,
      qwenEmbeddingCalls: 0,
      candidateInvocations: report.execution.candidateInvocations,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
    },
    formalEvidence: { markerCount: 0, journalCount: 0, artifactCount: 0, recoveryClaimCount: 0 },
    guardEntries: report.guardEntries,
    rewriteEntries: report.rewriteEntries,
    finalResponseEntries: report.finalResponseEntries,
  };
}

export function scorePhase698P1G2Runner(
  report: Phase698P1G2Report,
  baselineBundle: Phase698P1BaselineBundle,
): Phase698P1G2Gate {
  const g1 = scorePhase698P1G1(projectPhase698P1G2ToG1Report(report), baselineBundle);
  const reasons = [...g1.failureReasons];
  const laneIds = report.laneTerminals.map((entry) => entry.laneId);
  if (laneIds.join(',') !== PHASE_6_9_8_P1_G2_LANE_ORDER.join(',')) reasons.push('lane_order');
  if (new Set(laneIds).size !== 12) reasons.push('lane_identity');
  const invocationSum = report.laneTerminals.reduce(
    (sum, entry) => sum + entry.candidateInvocations,
    0,
  );
  if (invocationSum !== report.execution.candidateInvocations)
    reasons.push('lane_invocation_accounting');
  for (const entry of report.laneTerminals) {
    if (
      [
        'contract',
        'permission',
        'safety',
        'budget',
        'transport',
        'schema',
        'usage',
        'stale',
      ].includes(entry.failureCategory) &&
      !entry.breakerOpened
    ) {
      reasons.push('breaker_missing');
    }
    if (entry.failureCategory === 'semantic_mismatch' && entry.breakerOpened) {
      reasons.push('semantic_breaker');
    }
  }
  const status = reasons.length === 0 ? 'g2_runner_durability_ready' : 'g2_runner_quality_failed';
  return Object.freeze({
    status,
    passed: reasons.length === 0,
    authority: PHASE_6_9_8_P1_G2_AUTHORITY,
    qualityAuthority: 'none',
    failureReasons: Object.freeze([...new Set(reasons)]),
  });
}

export function validatePhase698P1G2Source(source: unknown): Phase698P1G2Source {
  return PHASE_6_9_8_P1_G2_SOURCE_SCHEMA.parse(source);
}
