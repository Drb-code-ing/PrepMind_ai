import { z } from 'zod';

import {
  canonicalP1Json,
  PHASE_6_9_8_P1_EVAL_POLICY,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_P1_MANIFEST,
  sha256P1,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import {
  PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
  type Phase698P1BaselineBundle,
} from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import {
  PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
  PHASE_6_9_8_P1_L2_APPROVED_TAG,
  PHASE_6_9_8_P1_L2_LINEAGE,
  type Phase698P1L2AdmissionRecord,
} from './phase-6-9-8-retriever-final-response-p1-l2-admission.ts';

export const PHASE_6_9_8_P1_L2_REPORT_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-report-v1' as const;
export const PHASE_6_9_8_P1_L2_AUTHORITY =
  'controlled_live_retriever_final_response_p1_l2' as const;
export const PHASE_6_9_8_P1_L2_SEMANTIC_GATE = 'p1_semantic_gate' as const;
export const PHASE_6_9_8_P1_L2_QUALITY_AUTHORITY = 'none' as const;
export const PHASE_6_9_8_P1_L2_DURABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-durability-v1' as const;
export const PHASE_6_9_8_P1_L2_MARKER_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-marker-v1' as const;
export const PHASE_6_9_8_P1_L2_JOURNAL_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-journal-v1' as const;
export const PHASE_6_9_8_P1_L2_ARTIFACT_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-artifact-v1' as const;
export const PHASE_6_9_8_P1_L2_RECOVERY_CLAIM_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-recovery-claim-v1' as const;

export const PHASE_6_9_8_P1_L2_MARKER_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-l2.marker' as const;
export const PHASE_6_9_8_P1_L2_JOURNAL_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-l2-{runId}.journal.jsonl' as const;
export const PHASE_6_9_8_P1_L2_REPORT_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-l2-{runId}.report.json' as const;
export const PHASE_6_9_8_P1_L2_RECOVERY_RELATIVE_PATH =
  '.tmp/phase-6-9-8-retriever-final-response-p1-l2-{runId}.recovery.claim' as const;
export const PHASE_6_9_8_P1_L2_ARTIFACT_PREFIX =
  'phase-6-9-8-retriever-final-response-p1-l2-' as const;

export const PHASE_6_9_8_P1_L2_LANE_ORDER = Object.freeze([
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
export type Phase698P1L2LaneId = (typeof PHASE_6_9_8_P1_L2_LANE_ORDER)[number];

export const PHASE_6_9_8_P1_L2_FAILURE_CATEGORIES = Object.freeze([
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
export type Phase698P1L2FailureCategory = (typeof PHASE_6_9_8_P1_L2_FAILURE_CATEGORIES)[number];
export const PHASE_6_9_8_P1_L2_DISPOSITIONS = Object.freeze([
  'succeeded',
  'semantic_mismatch',
  'attempted_failed',
  'attempted_aborted',
  'not_started_quality_breaker',
  'not_started_parent_aborted',
] as const);
export type Phase698P1L2Disposition = (typeof PHASE_6_9_8_P1_L2_DISPOSITIONS)[number];

const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const UUID = z.string().uuid();
const DATE = z.string().datetime({ offset: true });
const NON_NEGATIVE_INT = z.number().int().safe().nonnegative();
const UNIT = z.number().finite().min(0).max(1);
const FAILURE = z.enum(PHASE_6_9_8_P1_L2_FAILURE_CATEGORIES);
const DISPOSITION = z.enum(PHASE_6_9_8_P1_L2_DISPOSITIONS);
const USAGE = z.object({ inputTokens: NON_NEGATIVE_INT, outputTokens: NON_NEGATIVE_INT }).strict();

export const PHASE_6_9_8_P1_L2_SOURCE_SCHEMA = z
  .object({
    schemaVersion: z.literal(`${PHASE_6_9_8_P1_L2_LINEAGE}-source-v1`),
    lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
    mode: z.literal('controlled_live'),
    branch: z.literal(PHASE_6_9_8_P1_L2_APPROVED_BRANCH),
    head: z.string().regex(/^[0-9a-f]{40}$/u),
    upstream: z.string().regex(/^[0-9a-f]{40}$/u),
    origin: z.string().regex(/^[0-9a-f]{40}$/u),
    approvedTag: z
      .object({
        name: z.literal(PHASE_6_9_8_P1_L2_APPROVED_TAG),
        commit: z.string().regex(/^[0-9a-f]{40}$/u),
      })
      .strict(),
    manifestSha256: z.literal(PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256),
    policySha256: z.literal(PHASE_6_9_8_P1_FROZEN_POLICY_SHA256),
    baselineSha256: z.literal(PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256),
    s2FactorySha256: z.string().regex(/^[0-9a-f]{64}$/u),
    final11CompatibilitySha256: z.string().regex(/^[0-9a-f]{64}$/u),
    formalEvidencePaths: z.array(z.string().max(240)).length(0),
    oldLineagePaths: z.array(z.string().max(240)).length(0),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.head !== source.upstream || source.head !== source.origin) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_parity_invalid' });
    }
    if (source.approvedTag.commit !== source.head) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'approved_tag_mismatch' });
    }
  });
export type Phase698P1L2Source = z.infer<typeof PHASE_6_9_8_P1_L2_SOURCE_SCHEMA>;

const GUARD = z
  .object({
    caseId: z.string(),
    observedReasonCode: z.string().min(1).max(96),
    strict: z.boolean(),
    terminal: z.boolean(),
    fakeSearchPortCalls: NON_NEGATIVE_INT,
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();
const REWRITE = z
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
    usage: USAGE.nullable(),
    verifiedCostCny: z.number().finite().nonnegative().nullable(),
    provenance: z.enum(['deepseek_network', 'runtime_untrusted', 'not_invoked']),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();
const FINAL = z
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
    usage: USAGE.nullable(),
    verifiedCostCny: z.number().finite().nonnegative().nullable(),
    provenance: z.enum(['deepseek_network', 'runtime_untrusted', 'not_invoked']),
    failureCategory: FAILURE,
    breakerOpened: z.boolean(),
  })
  .strict();

export type Phase698P1L2GuardObservation = z.infer<typeof GUARD>;
export type Phase698P1L2RewriteObservation = z.infer<typeof REWRITE>;
export type Phase698P1L2FinalResponseObservation = z.infer<typeof FINAL>;

export const PHASE_6_9_8_P1_L2_WIRE_SCHEMA = z
  .object({
    reservation: z.literal(1),
    dispatch: z.union([z.literal(0), z.literal(1)]),
    response: z.union([z.literal(0), z.literal(1)]),
    strictValidated: z.union([z.literal(0), z.literal(1)]),
    verifiedUsage: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
export type Phase698P1L2Wire = z.infer<typeof PHASE_6_9_8_P1_L2_WIRE_SCHEMA>;

export const PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA = z
  .object({
    laneId: z.enum(PHASE_6_9_8_P1_L2_LANE_ORDER),
    kind: z.enum(['rewrite', 'final_response']),
    caseId: z.enum(PHASE_6_9_8_P1_L2_LANE_ORDER),
    sequence: z.number().int().positive().max(12),
    state: z.literal('terminal'),
    disposition: DISPOSITION,
    failureCategory: FAILURE,
    candidateInvocations: z.union([z.literal(0), z.literal(1)]),
    wire: PHASE_6_9_8_P1_L2_WIRE_SCHEMA,
    breakerOpened: z.boolean(),
    terminalReason: z.string().regex(/^[a-z0-9_]{1,96}$/u),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.caseId !== entry.laneId)
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_identity' });
    if (entry.kind === 'rewrite' && !entry.laneId.startsWith('rewrite_'))
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_kind' });
    if (entry.kind === 'final_response' && !entry.laneId.startsWith('final_'))
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'lane_kind' });
    if (entry.disposition === 'succeeded' && entry.failureCategory !== 'none')
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'success_failure' });
    if (
      entry.disposition.startsWith('not_started_') &&
      (entry.wire.dispatch !== 0 || entry.wire.response !== 0 || entry.candidateInvocations !== 0)
    )
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'not_started_wire' });
  });
export type Phase698P1L2LaneTerminal = z.infer<typeof PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA>;

export const PHASE_6_9_8_P1_L2_REPORT_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_P1_L2_REPORT_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_P1_L2_AUTHORITY),
    qualityAuthority: z.literal(PHASE_6_9_8_P1_L2_QUALITY_AUTHORITY),
    semanticGate: z.enum(['none', PHASE_6_9_8_P1_L2_SEMANTIC_GATE]),
    source: PHASE_6_9_8_P1_L2_SOURCE_SCHEMA,
    execution: z
      .object({
        providerCalls: z.number().int().min(0).max(12),
        credentialReads: z.number().int().min(0).max(3),
        qwenEmbeddingCalls: z.literal(0),
        candidateInvocations: z.number().int().min(0).max(12),
        inputTokens: NON_NEGATIVE_INT,
        outputTokens: NON_NEGATIVE_INT,
        verifiedCostCny: z.number().finite().nonnegative().nullable(),
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
        markerCount: z.literal(1),
        journalCount: z.number().int().positive(),
        artifactCount: z.literal(1),
        recoveryClaimCount: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    guardEntries: z.array(GUARD).length(8),
    rewriteEntries: z.array(REWRITE).length(6),
    finalResponseEntries: z.array(FINAL).length(6),
    laneTerminals: z.array(PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA).length(12),
  })
  .strict();
export type Phase698P1L2Report = z.infer<typeof PHASE_6_9_8_P1_L2_REPORT_SCHEMA>;

export const PHASE_6_9_8_P1_L2_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_P1_L2_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_P1_L2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_P1_L2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    plannedGuards: z.literal(8),
    plannedLanes: z.literal(12),
    candidateInvocationCap: z.literal(12),
    source: PHASE_6_9_8_P1_L2_SOURCE_SCHEMA,
    creatorPid: z.number().int().positive(),
    createdAt: DATE,
  })
  .strict();
export type Phase698P1L2Marker = z.infer<typeof PHASE_6_9_8_P1_L2_MARKER_SCHEMA>;

const JOURNAL_COMMON = {
  journalVersion: z.literal(PHASE_6_9_8_P1_L2_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
  runId: UUID,
  sequence: z.number().int().nonnegative(),
  markerSha256: HEX,
  previousHash: HEX.nullable(),
  recordHash: HEX,
} as const;
export const PHASE_6_9_8_P1_L2_JOURNAL_SCHEMA = z.discriminatedUnion('event', [
  z.object({ ...JOURNAL_COMMON, event: z.literal('attempt_reserved'), createdAt: DATE }).strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('guard_terminal'), entry: GUARD }).strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_reserved'),
      laneId: z.enum(PHASE_6_9_8_P1_L2_LANE_ORDER),
      sequenceInRun: z.number().int().positive().max(12),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_stage'),
      laneId: z.enum(PHASE_6_9_8_P1_L2_LANE_ORDER),
      stage: z.enum(['dispatch_started', 'response_observed', 'strict_validated']),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('lane_terminal'),
      entry: PHASE_6_9_8_P1_L2_LANE_TERMINAL_SCHEMA,
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
export type Phase698P1L2JournalRecord = z.infer<typeof PHASE_6_9_8_P1_L2_JOURNAL_SCHEMA>;

export const PHASE_6_9_8_P1_L2_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_P1_L2_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_P1_L2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_L2_LINEAGE),
    runId: UUID,
    markerSha256: HEX,
    reportLogicalSha256: HEX,
    report: PHASE_6_9_8_P1_L2_REPORT_SCHEMA,
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
export type Phase698P1L2Artifact = z.infer<typeof PHASE_6_9_8_P1_L2_ARTIFACT_SCHEMA>;

export type Phase698P1L2Gate = Readonly<{
  status: 'p1_l2_semantic_gate_passed' | 'p1_l2_quality_gate_failed' | 'p1_l2_report_invalid';
  passed: boolean;
  authority: typeof PHASE_6_9_8_P1_L2_AUTHORITY;
  qualityAuthority: typeof PHASE_6_9_8_P1_L2_SEMANTIC_GATE | 'none';
  failureReasons: readonly string[];
  usage: Readonly<{ inputTokens: number; outputTokens: number; verifiedCostCny: number | null }>;
}>;

export function buildPhase698P1L2Report(input: {
  runId: string;
  source: Phase698P1L2Source;
  guardEntries: readonly Phase698P1L2GuardObservation[];
  rewriteEntries: readonly Phase698P1L2RewriteObservation[];
  finalResponseEntries: readonly Phase698P1L2FinalResponseObservation[];
  laneTerminals: readonly Phase698P1L2LaneTerminal[];
  providerCalls: number;
  credentialReads: number;
  inputTokens: number;
  outputTokens: number;
  verifiedCostCny: number | null;
  breakerReason: string | null;
  journalRecords?: number;
  recoveryClaimCount?: 0 | 1;
}): Phase698P1L2Report {
  return PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse({
    schemaVersion: PHASE_6_9_8_P1_L2_REPORT_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    runId: input.runId,
    authority: PHASE_6_9_8_P1_L2_AUTHORITY,
    qualityAuthority: 'none',
    semanticGate: 'none',
    source: input.source,
    execution: {
      providerCalls: input.providerCalls,
      credentialReads: input.credentialReads,
      qwenEmbeddingCalls: 0,
      candidateInvocations: input.laneTerminals.reduce(
        (sum, entry) => sum + entry.candidateInvocations,
        0,
      ),
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      verifiedCostCny: input.verifiedCostCny,
      maxConcurrency: 1,
      retry: false,
      resume: false,
      replay: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
      breakerReason: input.breakerReason,
    },
    formalEvidence: {
      markerCount: 1,
      journalCount: input.journalRecords ?? 1,
      artifactCount: 1,
      recoveryClaimCount: input.recoveryClaimCount ?? 0,
    },
    guardEntries: input.guardEntries,
    rewriteEntries: input.rewriteEntries,
    finalResponseEntries: input.finalResponseEntries,
    laneTerminals: input.laneTerminals,
  });
}

export function scorePhase698P1L2(
  report: unknown,
  baselineBundle: Phase698P1BaselineBundle,
): Phase698P1L2Gate {
  const parsed = PHASE_6_9_8_P1_L2_REPORT_SCHEMA.safeParse(report);
  const usage = parsed.success
    ? {
        inputTokens: parsed.data.execution.inputTokens,
        outputTokens: parsed.data.execution.outputTokens,
        verifiedCostCny: parsed.data.execution.verifiedCostCny,
      }
    : { inputTokens: 0, outputTokens: 0, verifiedCostCny: null };
  if (!parsed.success) return gate('p1_l2_report_invalid', ['report_schema_invalid'], usage);
  const value = parsed.data;
  const failures: string[] = [];
  if (value.source.branch !== PHASE_6_9_8_P1_L2_APPROVED_BRANCH) failures.push('source_branch');
  if (value.source.approvedTag.commit !== value.source.head) failures.push('approved_tag');
  if (
    value.source.manifestSha256 !== PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256 ||
    value.source.policySha256 !== PHASE_6_9_8_P1_FROZEN_POLICY_SHA256 ||
    baselineBundle.sha256 !== PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256
  )
    failures.push('identity');
  if (value.execution.candidateInvocations !== 12)
    failures.push('candidate_invocation_denominator');
  if (value.execution.providerCalls !== 12 || value.execution.qwenEmbeddingCalls !== 0)
    failures.push('provider_accounting');
  if (value.execution.inputTokens > 37_600 || value.execution.outputTokens > 8_800)
    failures.push('token_budget');
  if (value.execution.verifiedCostCny === null || value.execution.verifiedCostCny > 0.176)
    failures.push('cost_budget');
  if (
    value.guardEntries.length !== 8 ||
    value.guardEntries.some(
      (entry, i) =>
        entry.caseId !== PHASE_6_9_8_P1_MANIFEST.guardCases[i]?.caseId ||
        !entry.strict ||
        !entry.terminal ||
        entry.fakeSearchPortCalls !== 0 ||
        entry.providerCalls !== 0 ||
        entry.credentialReads !== 0,
    )
  )
    failures.push('guard_gate');
  if (
    value.laneTerminals.length !== 12 ||
    value.laneTerminals.some(
      (entry, i) => entry.laneId !== PHASE_6_9_8_P1_L2_LANE_ORDER[i] || entry.sequence !== i + 1,
    )
  )
    failures.push('lane_order');
  if (
    value.laneTerminals.some(
      (entry) =>
        entry.disposition !== 'succeeded' ||
        entry.failureCategory !== 'none' ||
        entry.candidateInvocations !== 1 ||
        entry.wire.dispatch !== 1 ||
        entry.wire.response !== 1 ||
        entry.wire.strictValidated !== 1 ||
        entry.wire.verifiedUsage !== 1,
    )
  )
    failures.push('lane_strict');
  if (
    value.rewriteEntries.some(
      (entry) =>
        !entry.strict ||
        !entry.runtime ||
        !entry.wire ||
        !entry.verifiedUsage ||
        entry.unsafeRewrite ||
        !entry.intentPreserved ||
        entry.candidateRecallAt5 === null ||
        entry.candidateNdcgAt5 === null,
    )
  )
    failures.push('rewrite_semantic');
  if (
    value.finalResponseEntries.some(
      (entry) =>
        !entry.strict ||
        !entry.runtime ||
        !entry.wire ||
        !entry.verifiedUsage ||
        entry.falseToolSuccess ||
        entry.falseCitation ||
        entry.safetyFailure ||
        entry.groundedScore === null ||
        entry.observedCitationCount < entry.requiredCitationCount ||
        !entry.noticeSatisfied,
    )
  )
    failures.push('final_semantic');
  const eligible = value.rewriteEntries.filter(
    (entry) => entry.metricEligible && !entry.expectedNoHit,
  );
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const recall = avg(
    eligible.map((e) => e.candidateRecallAt5).filter((x): x is number => x !== null),
  );
  const ndcg = avg(eligible.map((e) => e.candidateNdcgAt5).filter((x): x is number => x !== null));
  const uplift = avg(
    eligible.map((e) =>
      e.candidateNdcgAt5 !== null && e.baselineNdcgAt5 !== null
        ? e.candidateNdcgAt5 - e.baselineNdcgAt5
        : 0,
    ),
  );
  const critical = eligible.filter((e) => e.critical);
  const criticalRecall = avg(
    critical.map((e) => e.candidateRecallAt5).filter((x): x is number => x !== null),
  );
  const intent = avg(eligible.map((e) => (e.intentPreserved ? 1 : 0)));
  const grounded = avg(value.finalResponseEntries.map((e) => e.groundedScore ?? 0));
  const observed = value.finalResponseEntries.reduce((a, e) => a + e.observedCitationCount, 0);
  const truePositive = value.finalResponseEntries.reduce(
    (a, e) => a + Math.min(e.citationTruePositiveCount, e.observedCitationCount),
    0,
  );
  const required = value.finalResponseEntries.filter((e) => e.requiredCitationCount > 0);
  const citationRecall = required.length
    ? required.filter((e) => e.observedCitationCount >= e.requiredCitationCount).length /
      required.length
    : 1;
  const notices = value.finalResponseEntries.filter((e) => e.requiredNotice !== 'none');
  const noticeRecall = notices.length
    ? notices.filter((e) => e.noticeSatisfied).length / notices.length
    : 1;
  if (recall === null || recall < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.retrieverRecallAt5)
    failures.push('recall');
  if (ndcg === null || ndcg < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.retrieverNdcgAt5)
    failures.push('ndcg');
  if (uplift === null || uplift < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.eligibleSubsetNdcgUplift)
    failures.push('uplift');
  if (criticalRecall !== 1) failures.push('critical_recall');
  if (intent === null || intent < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.rewriteIntentPreservation)
    failures.push('intent');
  if (grounded === null || grounded < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.groundedRubric)
    failures.push('grounded');
  if (observed > 0 && truePositive !== observed) failures.push('citation_precision');
  if (citationRecall < PHASE_6_9_8_P1_EVAL_POLICY.thresholds.requiredCitationRecall)
    failures.push('citation_recall');
  if (noticeRecall !== 1) failures.push('notice_recall');
  if (value.execution.breakerReason !== null) failures.push('breaker_open');
  return gate(
    failures.length ? 'p1_l2_quality_gate_failed' : 'p1_l2_semantic_gate_passed',
    failures,
    usage,
  );
}

export function canonicalPhase698P1L2Json(value: unknown): string {
  return canonicalP1Json(value);
}
export function sha256Phase698P1L2(value: string): string {
  return sha256P1(value);
}
export function validatePhase698P1L2Report(value: unknown): Phase698P1L2Report {
  return PHASE_6_9_8_P1_L2_REPORT_SCHEMA.parse(value);
}
export function sourceFromPhase698P1L2Admission(
  admission: Phase698P1L2AdmissionRecord,
): Phase698P1L2Source {
  return PHASE_6_9_8_P1_L2_SOURCE_SCHEMA.parse({
    schemaVersion: `${PHASE_6_9_8_P1_L2_LINEAGE}-source-v1`,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    mode: 'controlled_live',
    branch: admission.source.branch,
    head: admission.source.head,
    upstream: admission.source.upstream,
    origin: admission.source.origin,
    approvedTag: { name: admission.source.approvedTag, commit: admission.source.head },
    manifestSha256: admission.source.manifestSha256,
    policySha256: admission.source.policySha256,
    baselineSha256: admission.source.baselineSha256,
    s2FactorySha256: admission.s2Identity.factorySha256,
    final11CompatibilitySha256: admission.s2Identity.final11CompatibilitySha256,
    formalEvidencePaths: [],
    oldLineagePaths: [],
  });
}

function gate(
  status: Phase698P1L2Gate['status'],
  reasons: readonly string[],
  usage: Phase698P1L2Gate['usage'],
): Phase698P1L2Gate {
  const passed = status === 'p1_l2_semantic_gate_passed';
  return Object.freeze({
    status,
    passed,
    authority: PHASE_6_9_8_P1_L2_AUTHORITY,
    qualityAuthority: passed ? PHASE_6_9_8_P1_L2_SEMANTIC_GATE : 'none',
    failureReasons: [...new Set(reasons)],
    usage,
  });
}
