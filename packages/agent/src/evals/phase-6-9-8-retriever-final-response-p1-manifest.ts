import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
  PHASE_6_9_8_TASK8_LINEAGE,
  PHASE_6_9_8_TASK8_MANIFEST,
  PHASE_6_9_8_TASK8_MANIFEST_SHA256,
  PHASE_6_9_8_TASK8_POLICY_SHA256,
} from './phase-6-9-8-retriever-final-response-manifest.ts';

export const PHASE_6_9_8_P1_LINEAGE = 'phase-6.9.8-retriever-final-response-p1-v1' as const;
export const PHASE_6_9_8_P1_MANIFEST_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-manifest-v1' as const;
export const PHASE_6_9_8_P1_POLICY_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-eval-policy-v1' as const;
export const PHASE_6_9_8_P1_AUTHORITY =
  'zero_provider_retriever_final_response_p1_g1_contract_baseline' as const;
export const PHASE_6_9_8_P1_QUALITY_AUTHORITY = 'none' as const;

export const PHASE_6_9_8_P1_SOURCE_ANCHORS = Object.freeze({
  task8Lineage: PHASE_6_9_8_TASK8_LINEAGE,
  task8ManifestSha256: PHASE_6_9_8_TASK8_MANIFEST_SHA256,
  task8FrozenManifestSha256: PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
  task8PolicySha256: PHASE_6_9_8_TASK8_POLICY_SHA256,
  task8FrozenPolicySha256: PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
  retrieverBaselineManifestSha256:
    '8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d',
  retrieverBaselineReportSha256: 'a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442',
  p1DesignManifestSha256: 'e7216d072eb20e47eaea469646b4c831c180bd9248fdaae059a335a22404fab2',
  p1DesignPolicySha256: 'ab6a453a60fad5bf7678d4f04b9f1e1c30a5ab5642580b0ea5615f4edd20d146',
  p1DesignBaselineAnchorSha256: '63748b92cfa5da4ba60c8c457c7d97e8f079a0add130adbc7698a70ccc2f503b',
});

const GUARD_CASE_IDS = [
  'guard_02',
  'guard_03',
  'guard_04',
  'guard_09',
  'guard_10',
  'guard_11',
  'guard_15',
  'guard_16',
] as const;
const REWRITE_CASE_IDS = [
  'rewrite_01',
  'rewrite_03',
  'rewrite_05',
  'rewrite_09',
  'rewrite_12',
  'rewrite_15',
] as const;
const FINAL_RESPONSE_CASE_IDS = [
  'final_01',
  'final_07',
  'final_09',
  'final_11',
  'final_13',
  'final_15',
] as const;

const TURN_SCHEMA = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(500),
  })
  .strict();

const ACTIVE_CONTEXT_SCHEMA = z
  .object({
    trust: z.literal('untrusted'),
    question: z.string().min(1).max(300).optional(),
    goal: z.string().min(1).max(300).optional(),
  })
  .strict()
  .refine((value) => value.question !== undefined || value.goal !== undefined, {
    message: 'active context requires question or goal',
  });

const GUARD_ENTRY_SCHEMA = z
  .object({
    caseId: z.string().regex(/^guard_(?:0[1-9]|1[0-6])$/u),
    selectionTag: z.string().regex(/^p1_guard_[a-z0-9_]+$/u),
    scenario: z.enum([
      'anonymous',
      'unsafe_original_query',
      'credential_original_query',
      'pre_aborted',
      'expired_deadline',
      'top_k_policy_drift',
      'correlation_drift',
      'cross_owner_port',
    ]),
  })
  .strict();

const REWRITE_ENTRY_SCHEMA = z
  .object({
    caseId: z.string().regex(/^rewrite_(?:0[1-9]|1[0-6])$/u),
    selectionTag: z.string().regex(/^p1_rewrite_[a-z0-9_]+$/u),
    originalQuery: z.string().min(1).max(2_000),
    recentTurns: z.array(TURN_SCHEMA).max(8),
    activeContext: ACTIVE_CONTEXT_SCHEMA.optional(),
  })
  .strict();

const FINAL_ENTRY_SCHEMA = z
  .object({
    caseId: z.string().regex(/^final_(?:0[1-9]|1[0-6])$/u),
    selectionTag: z.string().regex(/^p1_final_[a-z0-9_]+$/u),
    latestUserMessage: z.string().min(1).max(4_000),
    recentConversation: z.array(TURN_SCHEMA).max(8),
  })
  .strict();

const MANIFEST_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_P1_MANIFEST_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_P1_LINEAGE),
    sourceAnchors: z
      .object({
        task8ManifestSha256: z.string().regex(/^[0-9a-f]{64}$/u),
        retrieverBaselineManifestSha256: z.string().regex(/^[0-9a-f]{64}$/u),
        retrieverBaselineReportSha256: z.string().regex(/^[0-9a-f]{64}$/u),
      })
      .strict(),
    guardCases: z.array(GUARD_ENTRY_SCHEMA).length(8),
    rewriteCases: z.array(REWRITE_ENTRY_SCHEMA).length(6),
    finalResponseCases: z.array(FINAL_ENTRY_SCHEMA).length(6),
  })
  .strict()
  .superRefine((manifest, context) => {
    const allIds = [
      ...manifest.guardCases.map((entry) => entry.caseId),
      ...manifest.rewriteCases.map((entry) => entry.caseId),
      ...manifest.finalResponseCases.map((entry) => entry.caseId),
    ];
    if (new Set(allIds).size !== 20) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'p1_case_ids_not_unique' });
    }
    if (manifest.guardCases.map((entry) => entry.caseId).join(',') !== GUARD_CASE_IDS.join(',')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'p1_guard_order_drift' });
    }
    if (
      manifest.rewriteCases.map((entry) => entry.caseId).join(',') !== REWRITE_CASE_IDS.join(',')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'p1_rewrite_order_drift' });
    }
    if (
      manifest.finalResponseCases.map((entry) => entry.caseId).join(',') !==
      FINAL_RESPONSE_CASE_IDS.join(',')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'p1_final_order_drift' });
    }
  });

export type Phase698P1GuardManifestEntry = z.infer<typeof GUARD_ENTRY_SCHEMA>;
export type Phase698P1RewriteManifestEntry = z.infer<typeof REWRITE_ENTRY_SCHEMA>;
export type Phase698P1FinalResponseManifestEntry = z.infer<typeof FINAL_ENTRY_SCHEMA>;
export type Phase698P1Manifest = z.infer<typeof MANIFEST_SCHEMA>;

function findGuard(caseId: (typeof GUARD_CASE_IDS)[number], index: number) {
  const source = PHASE_6_9_8_TASK8_MANIFEST.guardCases.find((entry) => entry.caseId === caseId);
  if (!source) throw new Error('PHASE_6_9_8_P1_SOURCE_GUARD_MISSING');
  return Object.freeze({
    caseId,
    selectionTag: `p1_guard_slot_${String(index + 1).padStart(2, '0')}`,
    scenario: source.scenario as Phase698P1GuardManifestEntry['scenario'],
  });
}

function findRewrite(caseId: (typeof REWRITE_CASE_IDS)[number], index: number) {
  const source = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.find((entry) => entry.caseId === caseId);
  if (!source) throw new Error('PHASE_6_9_8_P1_SOURCE_REWRITE_MISSING');
  return Object.freeze({
    caseId,
    selectionTag: `p1_rewrite_slot_${String(index + 1).padStart(2, '0')}`,
    originalQuery: source.originalQuery,
    recentTurns: source.recentTurns.map((turn) => ({ ...turn })),
    ...(source.activeContext === undefined ? {} : { activeContext: { ...source.activeContext } }),
  });
}

function findFinal(caseId: (typeof FINAL_RESPONSE_CASE_IDS)[number], index: number) {
  const source = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.find(
    (entry) => entry.caseId === caseId,
  );
  if (!source) throw new Error('PHASE_6_9_8_P1_SOURCE_FINAL_MISSING');
  return Object.freeze({
    caseId,
    selectionTag: `p1_final_slot_${String(index + 1).padStart(2, '0')}`,
    latestUserMessage: source.latestUserMessage,
    recentConversation: source.recentConversation.map((turn) => ({ ...turn })),
  });
}

const MANIFEST_INPUT = {
  schemaVersion: PHASE_6_9_8_P1_MANIFEST_SCHEMA_VERSION,
  lineage: PHASE_6_9_8_P1_LINEAGE,
  sourceAnchors: {
    task8ManifestSha256: PHASE_6_9_8_TASK8_MANIFEST_SHA256,
    retrieverBaselineManifestSha256:
      '8a1788aa8973507555931ce358c08dcd739dd166636376f6ddcc2eff3a33654d',
    retrieverBaselineReportSha256:
      'a1478f22a4a2fad154496c4ffbfd761532c102fe3ae9453d1916a10ba2c26442',
  },
  guardCases: GUARD_CASE_IDS.map(findGuard),
  rewriteCases: REWRITE_CASE_IDS.map(findRewrite),
  finalResponseCases: FINAL_RESPONSE_CASE_IDS.map(findFinal),
};

export const PHASE_6_9_8_P1_MANIFEST = deepFreeze(MANIFEST_SCHEMA.parse(MANIFEST_INPUT));
export const PHASE_6_9_8_P1_MANIFEST_SHA256 = sha256P1(canonicalP1Json(PHASE_6_9_8_P1_MANIFEST));
export const PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256 =
  'f117f6257b2d412912d0a50b322c23d74ca194ea37667a614c45549bb1ccb189' as const;

export const PHASE_6_9_8_P1_EVAL_POLICY = deepFreeze({
  schemaVersion: PHASE_6_9_8_P1_POLICY_SCHEMA_VERSION,
  lineage: PHASE_6_9_8_P1_LINEAGE,
  authority: PHASE_6_9_8_P1_AUTHORITY,
  qualityAuthority: PHASE_6_9_8_P1_QUALITY_AUTHORITY,
  counts: {
    guards: 8,
    rewrite: 6,
    finalResponse: 6,
    semanticLanes: 12,
    total: 20,
  },
  execution: {
    providerCalls: 0,
    credentialReads: 0,
    qwenEmbeddingCalls: 0,
    maxConcurrency: 1,
    candidateInvocationsMax: 12,
    retry: false,
    resume: false,
    replay: false,
    backfill: false,
    backgroundJob: false,
    outbox: false,
  },
  thresholds: {
    guardPassCount: 8,
    guardZeroCallCount: 8,
    rewriteStrictCount: 6,
    rewriteRuntimeCount: 6,
    rewriteWireCount: 6,
    rewriteVerifiedUsageCount: 6,
    finalStrictCount: 6,
    finalTerminalCount: 6,
    finalWireCount: 6,
    finalVerifiedUsageCount: 6,
    retrieverRecallAt5: 0.9,
    retrieverNdcgAt5: 0.85,
    eligibleSubsetNdcgUplift: 0.08,
    criticalTargetRecall: 1,
    rewriteIntentPreservation: 0.95,
    unsafeRewriteCount: 0,
    groundedRubric: 0.9,
    citationPrecision: 1,
    requiredCitationRecall: 0.9,
    criticalNoticeRecall: 1,
    falseToolSuccessCount: 0,
    falseCitationCount: 0,
    safetyFailureCount: 0,
  },
  latency: {
    aggregates: ['median', 'max'] as const,
    p95: null,
    p95Reason: 'insufficient_sample_size_6' as const,
  },
  formalEvidence: {
    markerCount: 0,
    journalCount: 0,
    artifactCount: 0,
    recoveryClaimCount: 0,
  },
  pricing: {
    verifiedCostCny: null,
    syntheticCostAuthority: null,
  },
});

export const PHASE_6_9_8_P1_POLICY_SHA256 = sha256P1(canonicalP1Json(PHASE_6_9_8_P1_EVAL_POLICY));
export const PHASE_6_9_8_P1_FROZEN_POLICY_SHA256 =
  'edaa07d1071a93336b40d68948011a21a3e96938ca7d7b862991bb2bc37537f3' as const;

if (PHASE_6_9_8_P1_MANIFEST_SHA256 !== PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256) {
  throw new Error('PHASE_6_9_8_P1_MANIFEST_SHA_MISMATCH');
}
if (PHASE_6_9_8_P1_POLICY_SHA256 !== PHASE_6_9_8_P1_FROZEN_POLICY_SHA256) {
  throw new Error('PHASE_6_9_8_P1_POLICY_SHA_MISMATCH');
}

export function validatePhase698P1FrozenIdentity(): Readonly<{
  ok: boolean;
  manifestSha256: string;
  policySha256: string;
}> {
  return Object.freeze({
    ok:
      PHASE_6_9_8_P1_MANIFEST_SHA256 === PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256 &&
      PHASE_6_9_8_P1_POLICY_SHA256 === PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    manifestSha256: PHASE_6_9_8_P1_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_P1_POLICY_SHA256,
  });
}

export function canonicalP1Json(value: unknown): string {
  return JSON.stringify(canonicalP1Value(value));
}

export function sha256P1(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalP1Value(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalP1Value);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalP1Value((value as Record<string, unknown>)[key])]),
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
