import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import {
  consumePhase698TransportReentryV2DedicatedCapability,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';
import {
  preparePhase698TransportReentryV2C1Projection,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';
import { makePhase698TransportReentryV2SyntheticPreflightInput } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

export { PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c2-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c2-source-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c2-admission-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RESERVATION_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c2-reservation-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CONFIGURATION_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c2-configuration-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY =
  'zero_provider_transport_reentry_v2_c2' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE =
  'transport_reentry_v2_c2_zero_provider_passed' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE_FAILED =
  'transport_reentry_v2_c2_zero_provider_blocked' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-contract' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_PROVIDER_CALLS = 3 as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY = 0.024096 as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER = Object.freeze([
  'rewrite',
  'qwen',
  'final_response',
] as const);
export type Phase698TransportReentryV2C2Slot =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER)[number];

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES = Object.freeze([
  'missing',
  'invalid',
  'conflict',
  'abort',
  'timeout',
  'transport',
  'schema',
  'usage',
  'publication',
  'source',
  'journal',
  'validation',
] as const);
export type Phase698TransportReentryV2C2FailureCode =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES)[number];

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS = Object.freeze([
  'packages/agent/package.json',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts',
  'packages/agent/src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
  'packages/agent/scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts',
] as const);

const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const UUID = z.string().uuid();
const ZERO_COMMIT = '0'.repeat(40);

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    branch: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedSourceCommit: COMMIT,
    admissionAuthority: z.enum(['synthetic_fixture', 'git_verified']),
    workingTreeClean: z.literal(true),
    formalArtifactCount: z.literal(0),
    sourceBundleSha256: HEX,
    t2Gate: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING),
    t3cGate: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedSourceCommit
    ) {
      context.addIssue({ code: 'custom', message: 'source parity mismatch' });
    }
  });
export type Phase698TransportReentryV2C2Source = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA
>;

export type Phase698TransportReentryV2C2AdmissionCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
}>;
export type Phase698TransportReentryV2C2ReservationCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RESERVATION_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
}>;
export type Phase698TransportReentryV2C2ConfigurationCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CONFIGURATION_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
}>;

type Issued = Readonly<{
  authority: 'synthetic_test' | 'git_verified';
  source: Phase698TransportReentryV2C2Source;
}>;
const admissions = new WeakMap<object, Issued>();
const consumedAdmissions = new WeakSet<object>();
const reservations = new WeakMap<object, Issued>();
const consumedReservations = new WeakSet<object>();
const configurations = new WeakMap<
  object,
  Readonly<{
    lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
    families: readonly ['rewrite', 'qwen', 'final_response'];
  }>
>();
const consumedConfigurations = new WeakSet<object>();

export type Phase698TransportReentryV2C2AdmissionResult =
  | Readonly<{
      ok: true;
      authority: 'synthetic_test' | 'git_verified';
      source: Phase698TransportReentryV2C2Source;
      capability: Phase698TransportReentryV2C2AdmissionCapability;
      reservationCapability: Phase698TransportReentryV2C2ReservationCapability;
    }>
  | Readonly<{ ok: false; reasonCode: 'source_admission_invalid' }>;

export function createPhase698TransportReentryV2C2SyntheticAdmissionForTest(
  sourceInput?: Phase698TransportReentryV2C2Source,
): Extract<Phase698TransportReentryV2C2AdmissionResult, { ok: true }> {
  const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA.parse(
    sourceInput ?? {
      version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION,
      lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
      branch: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH,
      commit: ZERO_COMMIT,
      trackingCommit: ZERO_COMMIT,
      remoteCommit: ZERO_COMMIT,
      approvedSourceCommit: ZERO_COMMIT,
      admissionAuthority: 'synthetic_fixture',
      workingTreeClean: true,
      formalArtifactCount: 0,
      sourceBundleSha256: '0'.repeat(64),
      t2Gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING,
      t3cGate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING,
    },
  );
  if (source.admissionAuthority !== 'synthetic_fixture')
    throw new Error('C2_SYNTHETIC_SOURCE_INVALID');
  return issuePair('synthetic_test', source);
}

export function inspectPhase698TransportReentryV2C2SourceAdmission(
  repositoryRoot: string,
): Phase698TransportReentryV2C2AdmissionResult {
  try {
    const root = resolveTrustedGitRoot(repositoryRoot);
    if (!root) return { ok: false, reasonCode: 'source_admission_invalid' };
    const branch = gitText(root, ['branch', '--show-current']);
    const commit = gitText(root, ['rev-parse', '--verify', 'HEAD']);
    const tracking = gitText(root, ['rev-parse', '--verify', '@{upstream}']);
    const remote = gitText(root, [
      'rev-parse',
      '--verify',
      `refs/remotes/origin/${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH}`,
    ]);
    const status = gitText(root, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (
      !branch ||
      !commit ||
      !tracking ||
      !remote ||
      status !== '' ||
      branch !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_BRANCH
    )
      return { ok: false, reasonCode: 'source_admission_invalid' };
    if (![commit, tracking, remote].every((value) => COMMIT.safeParse(value).success))
      return { ok: false, reasonCode: 'source_admission_invalid' };
    if (commit !== tracking || commit !== remote || countFormalArtifacts(root) !== 0)
      return { ok: false, reasonCode: 'source_admission_invalid' };
    const bundle = computeSourceBundle(root, commit);
    if (!bundle) return { ok: false, reasonCode: 'source_admission_invalid' };
    const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA.parse({
      version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_VERSION,
      lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
      branch,
      commit,
      trackingCommit: tracking,
      remoteCommit: remote,
      approvedSourceCommit: commit,
      admissionAuthority: 'git_verified',
      workingTreeClean: true,
      formalArtifactCount: 0,
      sourceBundleSha256: bundle,
      t2Gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING,
      t3cGate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING,
    });
    return issuePair('git_verified', source);
  } catch {
    return { ok: false, reasonCode: 'source_admission_invalid' };
  }
}

export function validatePhase698TransportReentryV2C2SourceForTest(input: unknown): boolean {
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA.safeParse(input).success;
}

export function consumePhase698TransportReentryV2C2AdmissionCapability(
  capability: unknown,
  expectedAuthority: 'synthetic_test' | 'git_verified',
): Issued {
  if (!isObject(capability) || consumedAdmissions.has(capability))
    throw new Error('C2_ADMISSION_CAPABILITY_INVALID');
  const issued = admissions.get(capability);
  if (!issued || issued.authority !== expectedAuthority)
    throw new Error('C2_ADMISSION_CAPABILITY_INVALID');
  consumedAdmissions.add(capability);
  return issued;
}

export function consumePhase698TransportReentryV2C2ReservationCapability(
  capability: unknown,
  expectedAuthority: 'synthetic_test' | 'git_verified',
): Issued {
  if (!isObject(capability) || consumedReservations.has(capability))
    throw new Error('C2_RESERVATION_CAPABILITY_INVALID');
  const issued = reservations.get(capability);
  if (!issued || issued.authority !== expectedAuthority)
    throw new Error('C2_RESERVATION_CAPABILITY_INVALID');
  consumedReservations.add(capability);
  return issued;
}

export type Phase698TransportReentryV2C2ConfigurationResult =
  | Readonly<{
      ok: true;
      capability: Phase698TransportReentryV2C2ConfigurationCapability;
      credentialReads: 0;
      providerCalls: 0;
      formalEvidence: 0;
    }>
  | Readonly<{ ok: false; reasonCode: 'configuration_invalid' }>;

/**
 * Consume the three C1 dedicated capabilities as an opaque pre-marker receipt.
 * This function never returns or stores a raw key and has no Provider port.
 */
export function preparePhase698TransportReentryV2C2Configuration(
  projection: unknown,
): Phase698TransportReentryV2C2ConfigurationResult {
  try {
    if (!isPlainRecord(projection)) return { ok: false, reasonCode: 'configuration_invalid' };
    const keys = Reflect.ownKeys(projection);
    if (
      keys.length !== 4 ||
      keys.some(
        (key) =>
          typeof key !== 'string' ||
          !['lineage', 'rewrite', 'qwen', 'final_response'].includes(key),
      )
    )
      return { ok: false, reasonCode: 'configuration_invalid' };
    const lineage = ownData(projection, 'lineage');
    if (!lineage.ok || lineage.value !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE)
      return { ok: false, reasonCode: 'configuration_invalid' };
    const rewrite = ownData(projection, 'rewrite');
    const qwen = ownData(projection, 'qwen');
    const finalResponse = ownData(projection, 'final_response');
    if (!rewrite.ok || !qwen.ok || !finalResponse.ok)
      return { ok: false, reasonCode: 'configuration_invalid' };
    consumePhase698TransportReentryV2DedicatedCapability(
      rewrite.value,
      'rewrite',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.rewrite,
    );
    consumePhase698TransportReentryV2DedicatedCapability(
      qwen.value,
      'qwen',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.qwen,
    );
    consumePhase698TransportReentryV2DedicatedCapability(
      finalResponse.value,
      'final_response',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.final_response,
    );
    const capability = Object.freeze({
      version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CONFIGURATION_CAPABILITY_VERSION,
      lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    });
    configurations.set(capability, {
      lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
      families: ['rewrite', 'qwen', 'final_response'],
    });
    return Object.freeze({
      ok: true as const,
      capability,
      credentialReads: 0 as const,
      providerCalls: 0 as const,
      formalEvidence: 0 as const,
    });
  } catch {
    return { ok: false, reasonCode: 'configuration_invalid' };
  }
}

export function makePhase698TransportReentryV2C2SyntheticConfigurationForTest() {
  const projection = preparePhase698TransportReentryV2C1Projection(
    makePhase698TransportReentryV2SyntheticPreflightInput(),
    { DEEPSEEK_API_KEY: 'synthetic-deepseek-key', QWEN_API_KEY: 'synthetic-qwen-key' },
  );
  if (!projection.ok) throw new Error('C2_SYNTHETIC_CONFIGURATION_INVALID');
  const result = preparePhase698TransportReentryV2C2Configuration(projection.projection);
  if (!result.ok) throw new Error('C2_SYNTHETIC_CONFIGURATION_INVALID');
  return result;
}

export function consumePhase698TransportReentryV2C2ConfigurationCapability(
  capability: unknown,
): boolean {
  if (!isObject(capability) || consumedConfigurations.has(capability)) return false;
  const issued = configurations.get(capability);
  if (!issued || issued.lineage !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE) return false;
  consumedConfigurations.add(capability);
  return true;
}

function issuePair(
  authority: Issued['authority'],
  source: Phase698TransportReentryV2C2Source,
): Extract<Phase698TransportReentryV2C2AdmissionResult, { ok: true }> {
  const issued = Object.freeze({ authority, source });
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  });
  const reservationCapability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RESERVATION_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  });
  admissions.set(capability, issued);
  reservations.set(reservationCapability, issued);
  return Object.freeze({
    ok: true as const,
    authority,
    source,
    capability,
    reservationCapability,
  });
}

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RUN_ID_SCHEMA = UUID;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA = z
  .object({
    slot: z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER),
    provider: z.enum(['deepseek', 'qwen']),
    sequence: z.number().int().min(1).max(3),
    disposition: z.enum([
      'completed',
      'executed_failure',
      'attempted_aborted',
      'not_started_quality_breaker',
      'not_started_external_abort',
    ]),
    failureCode: z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES).nullable(),
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
    syntheticPortCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        totalTokens: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    verifiedCostCny: z
      .number()
      .nonnegative()
      .max(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY)
      .nullable(),
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
      context.addIssue({ code: 'custom', message: 'provider mismatch' });
    if (
      value.disposition === 'completed' &&
      (value.failureCode !== null ||
        value.providerWire.verifiedUsage !== 1 ||
        value.runnerWire.verifiedResults !== 1)
    )
      context.addIssue({ code: 'custom', message: 'completed wire mismatch' });
    if (value.disposition !== 'completed' && value.failureCode === null)
      context.addIssue({ code: 'custom', message: 'failure code required' });
    if (value.disposition !== 'completed' && value.usage !== null)
      context.addIssue({ code: 'custom', message: 'failed usage must be null' });
  });
export type Phase698TransportReentryV2C2SlotResult = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    gate: z.enum([
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE,
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE_FAILED,
    ]),
    passed: z.boolean(),
    plannedSlots: z.literal(3),
    startedSlots: z.number().int().min(0).max(3),
    completedSlots: z.number().int().min(0).max(3),
    notStartedQualityBreaker: z.number().int().min(0).max(3),
    notStartedExternalAbort: z.number().int().min(0).max(3),
    syntheticPortCalls: z.number().int().min(0).max(3),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidence: z.literal(0),
    verifiedUsageSlots: z.number().int().min(0).max(3),
    verifiedCostCny: z
      .number()
      .nonnegative()
      .max(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY)
      .nullable(),
    budgetCnyMax: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY),
    breaker: z
      .object({
        open: z.boolean(),
        reason: z.enum(['none', ...PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES]),
        openedAtSequence: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    slotOrder: z.array(z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER)).length(3),
    slots: z.array(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA).length(3),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.completedSlots !== value.slots.filter((slot) => slot.disposition === 'completed').length
    )
      context.addIssue({ code: 'custom', message: 'completed count mismatch' });
    if (
      value.startedSlots !== value.slots.filter((slot) => slot.runnerWire.dispatches === 1).length
    )
      context.addIssue({ code: 'custom', message: 'started count mismatch' });
    if (
      value.verifiedUsageSlots !==
      value.slots.filter((slot) => slot.providerWire.verifiedUsage === 1).length
    )
      context.addIssue({ code: 'custom', message: 'usage count mismatch' });
    if (value.passed !== (value.gate === PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE))
      context.addIssue({ code: 'custom', message: 'gate mismatch' });
  });
export type Phase698TransportReentryV2C2Report = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA
>;

export type Phase698TransportReentryV2C2Marker = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(`${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-marker`),
    durabilityVersion: z.literal(`${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-durability`),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    runId: UUID,
    authority: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY),
    qualityAuthority: z.literal('none'),
    runMode: z.literal('synthetic_static'),
    plannedSlots: z.literal(3),
    source: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA,
    credentialReads: z.literal(0),
    providerCalls: z.literal(0),
    formalEvidence: z.literal(0),
    creatorPid: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type Phase698TransportReentryV2C2JournalBase = Readonly<{
  version: string;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
  runId: string;
  sequence: number;
  previousHash: string | null;
  recordHash: string;
}>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.journal.jsonl' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_RELATIVE =
  '.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2.recovery.json' as const;

export function phase698TransportReentryV2C2ReportRelativePath(runId: string) {
  return `.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2-${UUID.parse(runId)}.report.json`;
}
export function phase698TransportReentryV2C2ArtifactRelativePath(runId: string) {
  return `phase-6-9-8-retriever-final-response-transport-reentry-v2-${UUID.parse(runId)}.json`;
}
export function phase698TransportReentryV2C2WritableRelativePath(relativePath: string) {
  return (
    relativePath === PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE ||
    relativePath === PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE ||
    relativePath === PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_RELATIVE ||
    /^\.tmp\/phase-6-9-8-retriever-final-response-transport-reentry-v2-[0-9a-f-]{36}\.report\.json$/u.test(
      relativePath,
    ) ||
    /^phase-6-9-8-retriever-final-response-transport-reentry-v2-[0-9a-f-]{36}\.json$/u.test(
      relativePath,
    )
  );
}

export function phase698TransportReentryV2C2SyntheticRootPrefix() {
  return 'phase-698-transport-reentry-v2-c2-';
}

export function phase698TransportReentryV2C2Sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function phase698TransportReentryV2C2Canonical(value: unknown): string {
  return JSON.stringify(sortCanonicalValue(value));
}

function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((child) => sortCanonicalValue(child));
  if (!isPlainRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) throw new Error('C2_CANONICAL_ACCESSOR');
    const child: unknown = descriptor.value;
    result[key] = sortCanonicalValue(child);
  }
  return result;
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false;
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
    if (!descriptor || !('value' in descriptor)) return Object.freeze({ ok: false as const });
    const dataValue: unknown = descriptor.value;
    return Object.freeze({ ok: true as const, value: dataValue });
  } catch {
    return Object.freeze({ ok: false as const });
  }
}

function resolveTrustedGitRoot(input: string) {
  try {
    const supplied = realpathSync(resolve(input));
    const candidate = gitText(supplied, ['rev-parse', '--show-toplevel']);
    return candidate ? realpathSync(candidate) : null;
  } catch {
    return null;
  }
}

function gitText(root: string, args: string[]) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  const output = String(result.stdout).trim();
  return output;
}

function computeSourceBundle(root: string, commit: string) {
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const path of PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_PATHS) {
    const result = spawnSync('git', ['-C', root, 'cat-file', 'blob', `${commit}:${path}`], {
      encoding: null,
      timeout: 10_000,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.status !== 0 || !result.stdout) return null;
    entries.push({ path, sha256: phase698TransportReentryV2C2Sha256(result.stdout) });
  }
  return phase698TransportReentryV2C2Sha256(phase698TransportReentryV2C2Canonical(entries));
}

function countFormalArtifacts(root: string) {
  try {
    const tmp = readdirSync(join(root, '.tmp'), { withFileTypes: true });
    const rootEntries = readdirSync(root, { withFileTypes: true });
    const c2 =
      /^phase-6-9-8-retriever-final-response-transport-reentry-v2(?:-[0-9a-f-]{36})?\.(?:json|jsonl)$/u;
    return (
      tmp.filter(
        (entry) =>
          entry.isFile() &&
          (entry.name === 'phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json' ||
            c2.test(entry.name)),
      ).length + rootEntries.filter((entry) => entry.isFile() && c2.test(entry.name)).length
    );
  } catch {
    return 0;
  }
}
