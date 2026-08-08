import {
  canonicalP1Json,
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
  sha256P1,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import { PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import {
  PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
  PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256,
} from './phase-6-9-8-retriever-final-response-p1-s2-reviewed-mock.ts';

const SHA40 = /^[0-9a-f]{40}$/u;
const MAX_TEXT_LENGTH = 240;

export const PHASE_6_9_8_P1_L2_LINEAGE =
  'phase-6.9.8-retriever-final-response-p1-l2-v1' as const;
export const PHASE_6_9_8_P1_L2_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-p1-l2-admission-v1' as const;
export const PHASE_6_9_8_P1_L2_AUTHORITY =
  'zero_provider_retriever_final_response_p1_l2_admission_contract' as const;
export const PHASE_6_9_8_P1_L2_GATE = 'l2_admission_zero_provider' as const;
export const PHASE_6_9_8_P1_L2_QUALITY_AUTHORITY = 'none' as const;
export const PHASE_6_9_8_P1_L2_MODE = 'zero_provider_admission' as const;
export const PHASE_6_9_8_P1_L2_APPROVED_BRANCH =
  'drb/phase-6-9-8-p1-l2-controlled-live' as const;
export const PHASE_6_9_8_P1_L2_APPROVED_TAG =
  'phase-6.9.8-retriever-final-response-p1-l2-approved' as const;
export const PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_P1_L2_CONTROLLED_LIVE_ONCE' as const;

const L2_BUDGET_DESCRIPTOR = Object.freeze({
  maxCandidateInvocations: 12,
  maxInputTokens: 37_600,
  maxOutputTokens: 8_800,
  maxCostMicrosCny: 176_000,
  priceProfile: 'revalidate_at_live_admission',
});

export const PHASE_6_9_8_P1_L2_PRICE_PROFILE_SHA256 =
  `sha256:${sha256P1(canonicalP1Json(L2_BUDGET_DESCRIPTOR))}` as const;
export const PHASE_6_9_8_P1_L2_BUDGET = Object.freeze({
  ...L2_BUDGET_DESCRIPTOR,
  priceProfileSha256: PHASE_6_9_8_P1_L2_PRICE_PROFILE_SHA256,
});

export const PHASE_6_9_8_P1_L2_FAILURE_CODES = Object.freeze([
  'input_invalid',
  'source_branch_invalid',
  'source_dirty',
  'source_parity_invalid',
  'source_commit_invalid',
  'approved_tag_invalid',
  'approved_tag_mismatch',
  'source_formal_evidence_present',
  'source_old_lineage_present',
  'source_anchor_invalid',
  'authorization_invalid',
  'data_boundary_invalid',
  'budget_invalid',
] as const);
export type Phase698P1L2FailureCode = (typeof PHASE_6_9_8_P1_L2_FAILURE_CODES)[number];

export type Phase698P1L2SourceSnapshot = Readonly<{
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  clean: boolean;
  approvedTag: Readonly<{ name: string; commit: string }>;
  manifestSha256: string;
  policySha256: string;
  baselineSha256: string;
  s2FactorySha256: string;
  final11CompatibilitySha256: string;
  formalEvidencePaths: readonly string[];
  oldLineagePaths: readonly string[];
}>;

export type Phase698P1L2DataBoundaryReceipt = Readonly<{
  accepted: boolean;
  confirmation: string;
  providers: readonly ['deepseek', 'qwen'];
  scope: 'current_account';
}>;

export type Phase698P1L2ExactAuthorization = Readonly<{
  confirmation: string;
  lineage: string;
  sourceBranch: string;
  sourceCommit: string;
}>;

export type Phase698P1L2BudgetInput = Readonly<{
  maxCandidateInvocations: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxCostMicrosCny: number;
  priceProfileSha256: string;
}>;

export type Phase698P1L2AdmissionInput = Readonly<{
  source: Phase698P1L2SourceSnapshot;
  dataBoundary: Phase698P1L2DataBoundaryReceipt;
  authorization: Phase698P1L2ExactAuthorization;
  budget: Phase698P1L2BudgetInput;
}>;

export type Phase698P1L2AdmissionRecord = Readonly<{
  schemaVersion: typeof PHASE_6_9_8_P1_L2_SCHEMA_VERSION;
  lineage: typeof PHASE_6_9_8_P1_L2_LINEAGE;
  authority: typeof PHASE_6_9_8_P1_L2_AUTHORITY;
  gate: typeof PHASE_6_9_8_P1_L2_GATE;
  qualityAuthority: typeof PHASE_6_9_8_P1_L2_QUALITY_AUTHORITY;
  mode: typeof PHASE_6_9_8_P1_L2_MODE;
  providerDispatchAllowed: false;
  source: Readonly<{
    branch: typeof PHASE_6_9_8_P1_L2_APPROVED_BRANCH;
    head: string;
    upstream: string;
    origin: string;
    approvedTag: typeof PHASE_6_9_8_P1_L2_APPROVED_TAG;
    manifestSha256: typeof PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256;
    policySha256: typeof PHASE_6_9_8_P1_FROZEN_POLICY_SHA256;
    baselineSha256: typeof PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256;
  }>;
  dataBoundary: Readonly<{
    accepted: true;
    providers: readonly ['deepseek', 'qwen'];
    scope: 'current_account';
    confirmationSha256: string;
  }>;
  authorization: Readonly<{
    sourceBranch: typeof PHASE_6_9_8_P1_L2_APPROVED_BRANCH;
    sourceCommit: string;
    lineage: typeof PHASE_6_9_8_P1_L2_LINEAGE;
    confirmationSha256: string;
  }>;
  budget: typeof PHASE_6_9_8_P1_L2_BUDGET;
  s2Identity: Readonly<{
    factorySha256: typeof PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256;
    final11CompatibilitySha256: typeof PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256;
  }>;
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
}>;

export type Phase698P1L2Admission =
  | Readonly<{ ok: true; admission: Phase698P1L2AdmissionRecord }>
  | Readonly<{ ok: false; authority: 'none'; code: Phase698P1L2FailureCode }>;

export type Phase698P1L2AdmissionCapability = object;

type CapabilityState = Readonly<{ admission: Phase698P1L2AdmissionRecord; consumed: boolean }> & {
  consumed: boolean;
};
const capabilityStates = new WeakMap<object, CapabilityState>();

export function admitPhase698P1L2ZeroProvider(
  input: unknown,
): Phase698P1L2Admission {
  const root = readRecord(input, ['source', 'dataBoundary', 'authorization', 'budget']);
  if (!root) return failure('input_invalid');

  const sourceResult = parseSource(root.source);
  if (!sourceResult.ok) return failure(sourceResult.code);
  const boundary = parseBoundary(root.dataBoundary);
  if (!boundary) return failure('data_boundary_invalid');
  const authorization = parseAuthorization(root.authorization);
  if (!authorization) return failure('authorization_invalid');
  const budget = parseBudget(root.budget);
  if (!budget) return failure('budget_invalid');

  if (
    authorization.sourceCommit !== sourceResult.source.head ||
    authorization.sourceBranch !== sourceResult.source.branch
  ) {
    return failure('authorization_invalid');
  }

  const admission: Phase698P1L2AdmissionRecord = deepFreeze({
    schemaVersion: PHASE_6_9_8_P1_L2_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_P1_L2_LINEAGE,
    authority: PHASE_6_9_8_P1_L2_AUTHORITY,
    gate: PHASE_6_9_8_P1_L2_GATE,
    qualityAuthority: PHASE_6_9_8_P1_L2_QUALITY_AUTHORITY,
    mode: PHASE_6_9_8_P1_L2_MODE,
    providerDispatchAllowed: false,
    source: {
      branch: PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
      head: sourceResult.source.head,
      upstream: sourceResult.source.upstream,
      origin: sourceResult.source.origin,
      approvedTag: PHASE_6_9_8_P1_L2_APPROVED_TAG,
      manifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
      baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
    },
    dataBoundary: {
      accepted: true,
      providers: ['deepseek', 'qwen'],
      scope: 'current_account',
      confirmationSha256: digest(boundary.confirmation),
    },
    authorization: {
      sourceBranch: PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
      sourceCommit: authorization.sourceCommit,
      lineage: PHASE_6_9_8_P1_L2_LINEAGE,
      confirmationSha256: digest(authorization.confirmation),
    },
    budget: PHASE_6_9_8_P1_L2_BUDGET,
    s2Identity: {
      factorySha256: PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
      final11CompatibilitySha256: PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256,
    },
    providerCalls: 0,
    credentialReads: 0,
    formalEvidence: 0,
  });
  return Object.freeze({ ok: true, admission });
}

export function issuePhase698P1L2AdmissionCapability(
  input: Phase698P1L2AdmissionInput,
): Phase698P1L2AdmissionCapability {
  const result = admitPhase698P1L2ZeroProvider(input);
  if (!result.ok) throw new Error(`PHASE_6_9_8_P1_L2_${result.code.toUpperCase()}`);
  const capability = Object.freeze({});
  capabilityStates.set(capability, { admission: result.admission, consumed: false });
  return capability;
}

export function consumePhase698P1L2AdmissionCapability(
  capability: unknown,
): Phase698P1L2AdmissionRecord {
  if (typeof capability !== 'object' || capability === null) {
    throw new Error('PHASE_6_9_8_P1_L2_CAPABILITY_INVALID');
  }
  const state = capabilityStates.get(capability);
  if (!state || state.consumed) throw new Error('PHASE_6_9_8_P1_L2_CAPABILITY_CONSUMED');
  state.consumed = true;
  return state.admission;
}

export function createPhase698P1L2SyntheticAdmissionInput(
  commit = 'a'.repeat(40),
): Phase698P1L2AdmissionInput {
  if (!SHA40.test(commit)) throw new Error('PHASE_6_9_8_P1_L2_COMMIT_INVALID');
  return deepFreeze({
    source: {
      branch: PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
      head: commit,
      upstream: commit,
      origin: commit,
      clean: true,
      approvedTag: { name: PHASE_6_9_8_P1_L2_APPROVED_TAG, commit },
      manifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
      policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
      baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
      s2FactorySha256: PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256,
      final11CompatibilitySha256: PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256,
      formalEvidencePaths: [],
      oldLineagePaths: [],
    },
    dataBoundary: {
      accepted: true,
      confirmation: PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION,
      providers: ['deepseek', 'qwen'],
      scope: 'current_account',
    },
    authorization: {
      confirmation: PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION,
      lineage: PHASE_6_9_8_P1_L2_LINEAGE,
      sourceBranch: PHASE_6_9_8_P1_L2_APPROVED_BRANCH,
      sourceCommit: commit,
    },
    budget: {
      maxCandidateInvocations: PHASE_6_9_8_P1_L2_BUDGET.maxCandidateInvocations,
      maxInputTokens: PHASE_6_9_8_P1_L2_BUDGET.maxInputTokens,
      maxOutputTokens: PHASE_6_9_8_P1_L2_BUDGET.maxOutputTokens,
      maxCostMicrosCny: PHASE_6_9_8_P1_L2_BUDGET.maxCostMicrosCny,
      priceProfileSha256: PHASE_6_9_8_P1_L2_BUDGET.priceProfileSha256,
    },
  });
}

function parseSource(value: unknown):
  | Readonly<{ ok: true; source: Phase698P1L2SourceSnapshot }>
  | Readonly<{ ok: false; code: Phase698P1L2FailureCode }> {
  const record = readRecord(value, [
    'branch',
    'head',
    'upstream',
    'origin',
    'clean',
    'approvedTag',
    'manifestSha256',
    'policySha256',
    'baselineSha256',
    's2FactorySha256',
    'final11CompatibilitySha256',
    'formalEvidencePaths',
    'oldLineagePaths',
  ]);
  if (!record) return failure('input_invalid');
  if (record.branch !== PHASE_6_9_8_P1_L2_APPROVED_BRANCH) return failure('source_branch_invalid');
  if (record.clean !== true) return failure('source_dirty');
  if (
    typeof record.branch !== 'string' ||
    typeof record.head !== 'string' ||
    typeof record.upstream !== 'string' ||
    typeof record.origin !== 'string' ||
    typeof record.manifestSha256 !== 'string' ||
    typeof record.policySha256 !== 'string' ||
    typeof record.baselineSha256 !== 'string' ||
    typeof record.s2FactorySha256 !== 'string' ||
    typeof record.final11CompatibilitySha256 !== 'string' ||
    record.head !== record.upstream ||
    record.head !== record.origin
  ) {
    return failure('source_parity_invalid');
  }
  if (!SHA40.test(record.head)) return failure('source_commit_invalid');
  const tag = readRecord(record.approvedTag, ['name', 'commit']);
  if (
    !tag ||
    typeof tag.name !== 'string' ||
    typeof tag.commit !== 'string' ||
    tag.name !== PHASE_6_9_8_P1_L2_APPROVED_TAG ||
    !SHA40.test(tag.commit)
  ) {
    return failure('approved_tag_invalid');
  }
  if (tag.commit !== record.head) return failure('approved_tag_mismatch');
  if (!emptyStringArray(record.formalEvidencePaths)) return failure('source_formal_evidence_present');
  if (!emptyStringArray(record.oldLineagePaths)) return failure('source_old_lineage_present');
  if (
    record.manifestSha256 !== PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256 ||
    record.policySha256 !== PHASE_6_9_8_P1_FROZEN_POLICY_SHA256 ||
    record.baselineSha256 !== PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 ||
    record.s2FactorySha256 !== PHASE_6_9_8_P1_S2_FACTORY_FROZEN_SHA256 ||
    record.final11CompatibilitySha256 !== PHASE_6_9_8_P1_S2_FINAL_11_COMPATIBILITY_FROZEN_SHA256
  ) {
    return failure('source_anchor_invalid');
  }
  return {
    ok: true,
    source: deepFreeze({
      branch: record.branch,
      head: record.head,
      upstream: record.upstream,
      origin: record.origin,
      clean: true,
      approvedTag: { name: tag.name, commit: tag.commit },
      manifestSha256: record.manifestSha256,
      policySha256: record.policySha256,
      baselineSha256: record.baselineSha256,
      s2FactorySha256: record.s2FactorySha256,
      final11CompatibilitySha256: record.final11CompatibilitySha256,
      formalEvidencePaths: [],
      oldLineagePaths: [],
    }),
  };
}

function parseBoundary(value: unknown): Phase698P1L2DataBoundaryReceipt | null {
  try {
    const record = readRecord(value, ['accepted', 'confirmation', 'providers', 'scope']);
    if (
      !record ||
      record.accepted !== true ||
      typeof record.confirmation !== 'string' ||
      record.confirmation !== PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION
    ) {
      return null;
    }
    if (
      record.scope !== 'current_account' ||
      !Array.isArray(record.providers) ||
      record.providers.length !== 2 ||
      record.providers[0] !== 'deepseek' ||
      record.providers[1] !== 'qwen'
    ) {
      return null;
    }
    return deepFreeze({
      accepted: true,
      confirmation: record.confirmation,
      providers: ['deepseek', 'qwen'] as const,
      scope: 'current_account',
    });
  } catch {
    return null;
  }
}

function parseAuthorization(value: unknown): Phase698P1L2ExactAuthorization | null {
  const record = readRecord(value, ['confirmation', 'lineage', 'sourceBranch', 'sourceCommit']);
  if (
    !record ||
    typeof record.confirmation !== 'string' ||
    record.confirmation !== PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION
  ) {
    return null;
  }
  if (
    typeof record.lineage !== 'string' ||
    typeof record.sourceBranch !== 'string' ||
    record.lineage !== PHASE_6_9_8_P1_L2_LINEAGE ||
    record.sourceBranch !== PHASE_6_9_8_P1_L2_APPROVED_BRANCH ||
    typeof record.sourceCommit !== 'string' ||
    !SHA40.test(record.sourceCommit)
  ) {
    return null;
  }
  return deepFreeze({
    confirmation: record.confirmation,
    lineage: record.lineage,
    sourceBranch: record.sourceBranch,
    sourceCommit: record.sourceCommit,
  });
}

function parseBudget(value: unknown): Phase698P1L2BudgetInput | null {
  const record = readRecord(value, [
    'maxCandidateInvocations',
    'maxInputTokens',
    'maxOutputTokens',
    'maxCostMicrosCny',
    'priceProfileSha256',
  ]);
  if (!record) return null;
  if (
    record.maxCandidateInvocations !== L2_BUDGET_DESCRIPTOR.maxCandidateInvocations ||
    record.maxInputTokens !== L2_BUDGET_DESCRIPTOR.maxInputTokens ||
    record.maxOutputTokens !== L2_BUDGET_DESCRIPTOR.maxOutputTokens ||
    record.maxCostMicrosCny !== L2_BUDGET_DESCRIPTOR.maxCostMicrosCny ||
    record.priceProfileSha256 !== PHASE_6_9_8_P1_L2_PRICE_PROFILE_SHA256
  ) {
    return null;
  }
  return PHASE_6_9_8_P1_L2_BUDGET;
}

function readRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  try {
    const object = value as Record<string, unknown>;
    const keys = Reflect.ownKeys(object);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const prototype = Object.getPrototypeOf(object) as object | null;
    if (prototype !== Object.prototype && prototype !== null) return null;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !('value' in descriptor)) return null;
    }
    return object;
  } catch {
    return null;
  }
}

function emptyStringArray(value: unknown): value is readonly string[] {
  try {
    return (
      Array.isArray(value) &&
      value.length === 0 &&
      value.every((entry) => typeof entry === 'string' && entry.length <= MAX_TEXT_LENGTH)
    );
  } catch {
    return false;
  }
}

function digest(value: unknown): string {
  return `sha256:${sha256P1(canonicalP1Json(value))}`;
}

function failure(code: Phase698P1L2FailureCode): Readonly<{ ok: false; authority: 'none'; code: Phase698P1L2FailureCode }> {
  return { ok: false, authority: 'none', code };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
