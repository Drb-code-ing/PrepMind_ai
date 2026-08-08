import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_BRANCH,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS,
  inspectPhase698TransportReentryV2C2SourceAdmission,
  type Phase698TransportReentryV2C2AdmissionResult,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';

export {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
};

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-l1-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-durability` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-marker` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-journal` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-artifact` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-recovery-claim` as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY =
  'controlled_live_transport_reentry_v2' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE =
  'transport_reentry_v2_l1_controlled_canary_passed' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE_FAILED =
  'transport_reentry_v2_l1_controlled_canary_failed' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_BRANCH = PHASE_6_9_8_TRANSPORT_REENTRY_V2_BRANCH;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_PROVIDER_CALLS = 3 as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY = 0.024096 as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER = Object.freeze([
  'rewrite',
  'qwen',
  'final_response',
] as const);
export type Phase698TransportReentryV2L1Slot =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER)[number];

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_HARD_TIMEOUT_MS = Object.freeze({
  rewrite: 4_000,
  qwen: 5_500,
  final_response: 20_000,
} as const);
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_COST_CAP_CNY = Object.freeze({
  rewrite: 0.005,
  qwen: 0.004096,
  final_response: 0.015,
} as const);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.recovery.json' as const;
export function phase698TransportReentryV2L1ReportRelativePath(runId: string) {
  return `.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2-${runId}.report.json`;
}
export function phase698TransportReentryV2L1ArtifactRelativePath(runId: string) {
  return `phase-6-9-8-retriever-final-response-transport-reentry-v2-${runId}.json`;
}

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT =
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_FAILURE_CODES = Object.freeze([
  'configuration',
  'abort',
  'timeout',
  'transport',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'schema',
  'usage',
  'publication',
  'source',
  'journal',
  'validation',
] as const);
export type Phase698TransportReentryV2L1FailureCode =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_FAILURE_CODES)[number];

const UUID = z.string().uuid();
const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SLOT = z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  ...PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS.filter(
    (path) => path !== 'packages/agent/package.json',
  ),
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-cli-core.ts',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts',
] as const);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA = z
  .object({
    version: z.literal(`${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-source`),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    branch: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceCommit: COMMIT,
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: HEX,
    c2SourceBundleSha256: HEX,
    t2Gate: z.string().min(1).max(128),
    t3cGate: z.string().min(1).max(128),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedSourceCommit
    )
      context.addIssue({ code: 'custom', message: 'source parity mismatch' });
  });
export type Phase698TransportReentryV2L1Source = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA
>;

export type Phase698TransportReentryV2L1AdmissionResult =
  | Readonly<{
      ok: true;
      authority: 'git_verified';
      source: Phase698TransportReentryV2L1Source;
      c2Admission: Extract<Phase698TransportReentryV2C2AdmissionResult, { ok: true }>;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }>;

export type Phase698TransportReentryV2L1Preflight = Readonly<{
  args: readonly string[];
  source: Phase698TransportReentryV2L1Source;
  proxy: Readonly<{
    code: 'direct_ready' | 'loopback_proxy_ready';
    providerCalls: 0;
    listenerProbeCalls: 0 | 1;
  }>;
  dataBoundary: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE;
  authorization: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION;
}>;

export type Phase698TransportReentryV2L1GateResult =
  | Readonly<{ ok: true; preflight: Phase698TransportReentryV2L1Preflight }>
  | Readonly<{ ok: false; reasonCode: 'gate_invalid' }>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA = z
  .object({
    slot: SLOT,
    provider: z.enum(['deepseek', 'qwen']),
    sequence: z.number().int().min(1).max(3),
    disposition: z.enum([
      'completed',
      'executed_failure',
      'attempted_aborted',
      'not_started_quality_breaker',
      'not_started_external_abort',
    ]),
    failureCode: z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_FAILURE_CODES).nullable(),
    runnerWire: z
      .object({
        reservations: z.literal(1),
        dispatches: z.union([z.literal(0), z.literal(1)]),
        harnessReturns: z.union([z.literal(0), z.literal(1)]),
        verifiedResults: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    providerWire: z
      .object({
        executions: z.union([z.literal(0), z.literal(1)]),
        dispatches: z.union([z.literal(0), z.literal(1)]),
        responses: z.union([z.literal(0), z.literal(1)]),
        verifiedUsage: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    providerCalls: z.union([z.literal(0), z.literal(1)]),
    credentialReads: z.union([z.literal(0), z.literal(1)]),
    usage: z
      .object({
        inputTokens: z.number().int().positive(),
        outputTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    durationMs: z.number().int().nonnegative().max(20_000).nullable(),
    diagnostic: z
      .object({
        stage: z.enum(['preflight', 'dispatch', 'response', 'usage', 'terminal', 'publication']),
        reason: z.string().min(1).max(64),
        type: z.string().min(1).max(64),
        count: z.number().int().nonnegative().max(3),
        rawDataRetained: z.literal(false),
      })
      .strict()
      .nullable(),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedProvider = value.slot === 'qwen' ? 'qwen' : 'deepseek';
    if (value.provider !== expectedProvider)
      context.addIssue({ code: 'custom', message: 'provider' });
    if (value.disposition === 'completed') {
      if (
        value.failureCode !== null ||
        value.providerWire.verifiedUsage !== 1 ||
        value.runnerWire.verifiedResults !== 1 ||
        value.usage === null ||
        value.verifiedCostCny === null
      )
        context.addIssue({ code: 'custom', message: 'completed wire' });
    } else if (
      value.failureCode === null ||
      value.usage !== null ||
      value.verifiedCostCny !== null
    ) {
      context.addIssue({ code: 'custom', message: 'failure accounting' });
    }
    if (value.credentialReads !== value.providerCalls)
      context.addIssue({ code: 'custom', message: 'credential accounting' });
    if (
      value.usage &&
      value.usage.totalTokens !== value.usage.inputTokens + value.usage.outputTokens
    )
      context.addIssue({ code: 'custom', message: 'usage total' });
  });
export type Phase698TransportReentryV2L1SlotResult = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY),
    qualityAuthority: z.literal('none'),
    gate: z.enum([
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE,
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE_FAILED,
    ]),
    passed: z.boolean(),
    plannedSlots: z.literal(3),
    startedSlots: z.number().int().min(0).max(3),
    completedSlots: z.number().int().min(0).max(3),
    notStartedQualityBreaker: z.number().int().min(0).max(3),
    notStartedExternalAbort: z.number().int().min(0).max(3),
    providerCalls: z.number().int().min(0).max(3),
    credentialReads: z.number().int().min(0).max(3),
    formalEvidence: z.literal(1),
    verifiedUsageSlots: z.number().int().min(0).max(3),
    verifiedCostCny: z
      .number()
      .nonnegative()
      .finite()
      .max(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY)
      .nullable(),
    budgetCnyMax: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY),
    breaker: z
      .object({
        open: z.boolean(),
        reason: z.enum(['none', ...PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_FAILURE_CODES]),
        openedAtSequence: z.number().int().min(1).max(3).nullable(),
      })
      .strict(),
    slotOrder: z.array(SLOT).length(3),
    slots: z.array(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA).length(3),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.slotOrder.some(
        (slot, index) => slot !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[index],
      )
    )
      context.addIssue({ code: 'custom', message: 'slot order' });
    if (
      value.slots.some(
        (slot, index) => slot.slot !== value.slotOrder[index] || slot.sequence !== index + 1,
      )
    )
      context.addIssue({ code: 'custom', message: 'slot sequence' });
    const started = value.slots.filter((slot) => slot.runnerWire.dispatches === 1).length;
    const completed = value.slots.filter((slot) => slot.disposition === 'completed').length;
    const quality = value.slots.filter(
      (slot) => slot.disposition === 'not_started_quality_breaker',
    ).length;
    const external = value.slots.filter(
      (slot) => slot.disposition === 'not_started_external_abort',
    ).length;
    const calls = value.slots.reduce((sum, slot) => sum + slot.providerCalls, 0);
    const reads = value.slots.reduce((sum, slot) => sum + slot.credentialReads, 0);
    const usage = value.slots.reduce((sum, slot) => sum + slot.providerWire.verifiedUsage, 0);
    if (
      started !== value.startedSlots ||
      completed !== value.completedSlots ||
      quality !== value.notStartedQualityBreaker ||
      external !== value.notStartedExternalAbort ||
      calls !== value.providerCalls ||
      reads !== value.credentialReads ||
      usage !== value.verifiedUsageSlots
    )
      context.addIssue({ code: 'custom', message: 'accounting' });
    if (value.passed !== (value.gate === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE))
      context.addIssue({ code: 'custom', message: 'gate' });
    if (value.providerCalls > PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_PROVIDER_CALLS)
      context.addIssue({ code: 'custom', message: 'budget calls' });
  });
export type Phase698TransportReentryV2L1Report = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runMode: z.literal('controlled_live'),
    plannedSlots: z.literal(3),
    source: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA,
    credentialReads: z.literal(0),
    providerCalls: z.literal(0),
    formalEvidence: z.literal(0),
    creatorPid: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type Phase698TransportReentryV2L1Marker = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA
>;

const JOURNAL_COMMON = {
  version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
  runId: UUID,
  sequence: z.number().int().nonnegative(),
  previousHash: HEX.nullable(),
  recordHash: HEX,
};
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA = z.discriminatedUnion('event', [
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('attempt_reserved'),
      markerSha256: HEX,
      createdAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('slot_dispatch_started'), slot: SLOT }).strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('slot_response_observed'), slot: SLOT }).strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('slot_usage_verified'), slot: SLOT }).strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('slot_terminal'),
      result: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('run_terminal'),
      reportSha256: HEX,
      slotCount: z.literal(3),
    })
    .strict(),
  z.object({ ...JOURNAL_COMMON, event: z.literal('recovery_claimed'), claimSha256: HEX }).strict(),
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('publication_started'), reportSha256: HEX })
    .strict(),
  z
    .object({ ...JOURNAL_COMMON, event: z.literal('evidence_published'), evidenceSha256: HEX })
    .strict(),
]);
export type Phase698TransportReentryV2L1JournalRecord = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    runId: UUID,
    markerSha256: HEX,
    reportLogicalSha256: HEX,
    durability: z
      .object({
        publicationMode: z.enum(['runtime', 'recovery']),
        terminalSequence: z.number().int().nonnegative(),
        terminalRecordHash: HEX,
        journalRecordsBeforePublication: z.number().int().positive(),
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    report: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA,
  })
  .strict();
export type Phase698TransportReentryV2L1Artifact = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_SCHEMA
>;

export type Phase698TransportReentryV2L1Validation = Readonly<{
  ok: boolean;
  runId: string | null;
  gate:
    | typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE
    | typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE_FAILED
    | null;
  qualityAuthority: 'none' | null;
  finalJournalEvent: 'evidence_published' | null;
  journalRecords: number;
  reportLogicalSha256: string | null;
  physicalArtifactSha256: string | null;
  providerCalls: number;
  credentialReads: number;
  formalEvidence: number;
}>;

export type Phase698TransportReentryV2L1RecoveryResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'journal_invalid'
        | 'publication_invalid'
        | 'already_published';
    }>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    runId: UUID,
  })
  .strict();
export type Phase698TransportReentryV2L1RecoveryClaim = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_SCHEMA
>;

export function phase698TransportReentryV2L1Canonical(value: unknown): string {
  return JSON.stringify(sortCanonical(value));
}
export function phase698TransportReentryV2L1Sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
export function phase698TransportReentryV2L1WritableRelativePath(path: string): boolean {
  return (
    path === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE ||
    path === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE ||
    path === PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE ||
    /^\.tmp\/phase-6-9-8-retriever-final-response-transport-reentry-v2-[0-9a-f-]{36}\.report\.json$/u.test(
      path,
    ) ||
    /^phase-6-9-8-retriever-final-response-transport-reentry-v2-[0-9a-f-]{36}\.json$/u.test(path)
  );
}

/** Source gate for the L1 lineage. It delegates Git parity to C2, then binds
 * the newly added L1 source files into an independent source-bundle hash. */
export function inspectPhase698TransportReentryV2L1SourceAdmission(
  repositoryRoot: string,
): Phase698TransportReentryV2L1AdmissionResult {
  try {
    const c2 = inspectPhase698TransportReentryV2C2SourceAdmission(repositoryRoot);
    if (!c2.ok || c2.authority !== 'git_verified')
      return { ok: false, reasonCode: 'source_admission_invalid' };
    const root = realpathSync(resolve(repositoryRoot));
    const commit = gitText(root, ['rev-parse', '--verify', 'HEAD']);
    if (!commit || c2.source.commit !== commit)
      return { ok: false, reasonCode: 'source_admission_invalid' };
    const l1Bundle = computeSourceBundle(root);
    if (!l1Bundle) return { ok: false, reasonCode: 'source_admission_invalid' };
    const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA.parse({
      version: `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-source`,
      lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
      branch: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_BRANCH,
      commit: c2.source.commit,
      trackingCommit: c2.source.trackingCommit,
      remoteCommit: c2.source.remoteCommit,
      approvedSourceCommit: c2.source.approvedSourceCommit,
      workingTreeClean: true,
      formalArtifactCount: 0,
      sourceBundleSha256: l1Bundle,
      c2SourceBundleSha256: c2.source.sourceBundleSha256,
      t2Gate: c2.source.t2Gate,
      t3cGate: c2.source.t3cGate,
    });
    return Object.freeze({ ok: true, authority: 'git_verified', source, c2Admission: c2 });
  } catch {
    return { ok: false, reasonCode: 'source_admission_invalid' };
  }
}

export function inspectPhase698TransportReentryV2L1Gate(
  input: unknown,
): Phase698TransportReentryV2L1GateResult {
  try {
    if (!isPlainRecord(input)) return { ok: false, reasonCode: 'gate_invalid' };
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== 5 ||
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !['args', 'source', 'proxy', 'dataBoundary', 'authorization'].includes(key),
      )
    )
      return { ok: false, reasonCode: 'gate_invalid' };
    const args = ownData(input, 'args');
    const source = ownData(input, 'source');
    const proxy = ownData(input, 'proxy');
    const data = ownData(input, 'dataBoundary');
    const auth = ownData(input, 'authorization');
    if (!args.ok || !source.ok || !proxy.ok || !data.ok || !auth.ok)
      return { ok: false, reasonCode: 'gate_invalid' };
    if (
      !Array.isArray(args.value) ||
      args.value.length !== 1 ||
      args.value[0] !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT
    )
      return { ok: false, reasonCode: 'gate_invalid' };
    const parsedSource = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA.safeParse(source.value);
    if (!parsedSource.success || !isPlainRecord(proxy.value))
      return { ok: false, reasonCode: 'gate_invalid' };
    const proxyKeys = Reflect.ownKeys(proxy.value);
    if (
      proxyKeys.length !== 3 ||
      proxyKeys.some(
        (key) =>
          typeof key !== 'string' || !['code', 'providerCalls', 'listenerProbeCalls'].includes(key),
      )
    )
      return { ok: false, reasonCode: 'gate_invalid' };
    const code = ownData(proxy.value, 'code');
    const calls = ownData(proxy.value, 'providerCalls');
    const probes = ownData(proxy.value, 'listenerProbeCalls');
    if (!code.ok || !calls.ok || !probes.ok) return { ok: false, reasonCode: 'gate_invalid' };
    if (
      !(
        (code.value === 'direct_ready' && probes.value === 0) ||
        (code.value === 'loopback_proxy_ready' && probes.value === 1)
      ) ||
      calls.value !== 0
    )
      return { ok: false, reasonCode: 'gate_invalid' };
    if (
      data.value !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE ||
      auth.value !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION
    )
      return { ok: false, reasonCode: 'gate_invalid' };
    return Object.freeze({
      ok: true,
      preflight: Object.freeze({
        args: Object.freeze(args.value.map(String)),
        source: parsedSource.data,
        proxy: Object.freeze({
          code: code.value,
          providerCalls: 0 as const,
          listenerProbeCalls: probes.value,
        }),
        dataBoundary: data.value,
        authorization: auth.value,
      }),
    });
  } catch {
    return { ok: false, reasonCode: 'gate_invalid' };
  }
}

function computeSourceBundle(root: string): string | null {
  try {
    const hash = createHash('sha256');
    for (const relative of PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_PATHS) {
      const path = resolve(root, relative);
      const stat = statSync(path);
      if (!stat.isFile()) return null;
      const bytes = readFileSync(path);
      hash.update(relative, 'utf8');
      hash.update('\0', 'utf8');
      hash.update(bytes);
      hash.update('\n', 'utf8');
    }
    return hash.digest('hex');
  } catch {
    return null;
  }
}

function gitText(root: string, args: readonly string[]): string | null {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  const value = result.stdout.trim();
  return value.length > 0 ? value : null;
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}
function ownData(
  value: object,
  key: PropertyKey,
): Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }> {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor
      ? { ok: true, value: descriptor.value }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}
function sortCanonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (!isPlainRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error('L1_CANONICAL_ACCESSOR');
    output[key] = sortCanonical(descriptor.value);
  }
  return output;
}

export function createPhase698TransportReentryV2L1SyntheticGateForTest() {
  const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA.parse({
    version: `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-source`,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    branch: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_BRANCH,
    commit: '0'.repeat(40),
    trackingCommit: '0'.repeat(40),
    remoteCommit: '0'.repeat(40),
    approvedSourceCommit: '0'.repeat(40),
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '0'.repeat(64),
    c2SourceBundleSha256: '0'.repeat(64),
    t2Gate: 'transport_evidence_t2_zero_provider_passed',
    t3cGate: 'zero_provider_transport_evidence_t3_configuration_guard',
  });
  return Object.freeze({
    args: [PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT],
    source,
    proxy: {
      code: 'direct_ready' as const,
      providerCalls: 0 as const,
      listenerProbeCalls: 0 as const,
    },
    dataBoundary: PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
    authorization: PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
  });
}

export type Phase698TransportReentryV2L1SlotInput = Readonly<{
  slot: Phase698TransportReentryV2L1Slot;
  sequence: number;
  signal: AbortSignal;
}>;
export type Phase698TransportReentryV2L1SlotSuccess = Readonly<{
  usage: Readonly<{ inputTokens: number; outputTokens: number; totalTokens: number }>;
  verifiedCostCny: number;
  durationMs: number;
}>;
export type Phase698TransportReentryV2L1SlotPort = (
  input: Phase698TransportReentryV2L1SlotInput,
) => Promise<Phase698TransportReentryV2L1SlotSuccess>;
export type Phase698TransportReentryV2L1Ports = Readonly<
  Record<Phase698TransportReentryV2L1Slot, Phase698TransportReentryV2L1SlotPort>
>;
