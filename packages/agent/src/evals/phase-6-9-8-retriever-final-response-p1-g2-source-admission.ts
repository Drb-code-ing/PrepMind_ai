import {
  PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import { PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256 } from './phase-6-9-8-retriever-final-response-p1-baseline.ts';
import {
  PHASE_6_9_8_P1_G2_AUTHORITY,
  PHASE_6_9_8_P1_G2_LINEAGE,
  validatePhase698P1G2Source,
  type Phase698P1G2Source,
} from './phase-6-9-8-retriever-final-response-p1-g2-contract.ts';

const BRANCH = 'drb/phase-6-9-8-g2-runner-durability' as const;
const SHA40 = /^[0-9a-f]{40}$/u;

export const PHASE_6_9_8_P1_G2_SOURCE_ADMISSION_VERSION =
  `${PHASE_6_9_8_P1_G2_LINEAGE}-source-admission-v1` as const;
export const PHASE_6_9_8_P1_G2_SOURCE_FAILURE_CODES = Object.freeze([
  'source_input_invalid',
  'source_branch_invalid',
  'source_dirty',
  'source_parity_invalid',
  'source_formal_evidence_present',
  'source_old_lineage_present',
  'source_anchor_invalid',
] as const);
export type Phase698P1G2SourceFailureCode = (typeof PHASE_6_9_8_P1_G2_SOURCE_FAILURE_CODES)[number];

export type Phase698P1G2SourceSnapshot = Readonly<{
  branch: string;
  head: string;
  upstream: string;
  origin: string;
  clean: boolean;
  formalEvidencePaths: readonly string[];
  oldLineagePaths: readonly string[];
}>;

export type Phase698P1G2SourceAdmission =
  | Readonly<{
      ok: true;
      authority: typeof PHASE_6_9_8_P1_G2_AUTHORITY;
      source: Phase698P1G2Source;
    }>
  | Readonly<{
      ok: false;
      authority: 'none';
      code: Phase698P1G2SourceFailureCode;
    }>;

export type Phase698P1G2SourceAdmissionCapability = object;
type CapabilityState = { source: Phase698P1G2Source; consumed: boolean };
const capabilityStates = new WeakMap<object, CapabilityState>();

export function admitPhase698P1G2Source(input: unknown): Phase698P1G2SourceAdmission {
  const snapshot = readSnapshot(input);
  if (!snapshot) return { ok: false, authority: 'none', code: 'source_input_invalid' };
  if (snapshot.branch !== BRANCH)
    return { ok: false, authority: 'none', code: 'source_branch_invalid' };
  if (!snapshot.clean) return { ok: false, authority: 'none', code: 'source_dirty' };
  if (snapshot.head !== snapshot.upstream || snapshot.head !== snapshot.origin) {
    return { ok: false, authority: 'none', code: 'source_parity_invalid' };
  }
  if (snapshot.formalEvidencePaths.length > 0) {
    return { ok: false, authority: 'none', code: 'source_formal_evidence_present' };
  }
  if (snapshot.oldLineagePaths.length > 0) {
    return { ok: false, authority: 'none', code: 'source_old_lineage_present' };
  }
  if (![snapshot.head, snapshot.upstream, snapshot.origin].every((value) => SHA40.test(value))) {
    return { ok: false, authority: 'none', code: 'source_anchor_invalid' };
  }
  const source: Phase698P1G2Source = validatePhase698P1G2Source({
    schemaVersion: `${PHASE_6_9_8_P1_G2_LINEAGE}-source-v1`,
    lineage: PHASE_6_9_8_P1_G2_LINEAGE,
    mode: 'synthetic_zero_provider',
    branch: BRANCH,
    head: snapshot.head,
    upstream: snapshot.upstream,
    origin: snapshot.origin,
    manifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
    frozenManifestSha256: PHASE_6_9_8_P1_FROZEN_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    frozenPolicySha256: PHASE_6_9_8_P1_FROZEN_POLICY_SHA256,
    baselineSha256: PHASE_6_9_8_P1_BASELINE_FROZEN_SHA256,
    approvedTag: null,
    providerCalls: 0,
    credentialReads: 0,
    formalEvidence: { markerCount: 0, journalCount: 0, artifactCount: 0, recoveryClaimCount: 0 },
  });
  return Object.freeze({ ok: true, authority: PHASE_6_9_8_P1_G2_AUTHORITY, source });
}

export function issuePhase698P1G2SourceAdmissionCapability(
  input: Phase698P1G2SourceSnapshot,
): Phase698P1G2SourceAdmissionCapability {
  const admission = admitPhase698P1G2Source(input);
  if (!admission.ok) throw new Error(`PHASE_6_9_8_P1_G2_${admission.code.toUpperCase()}`);
  const token = Object.freeze({});
  capabilityStates.set(token, { source: admission.source, consumed: false });
  return token;
}

export function consumePhase698P1G2SourceAdmissionCapability(
  capability: unknown,
): Phase698P1G2Source {
  if (typeof capability !== 'object' || capability === null) {
    throw new Error('PHASE_6_9_8_P1_G2_SOURCE_CAPABILITY_INVALID');
  }
  const state = capabilityStates.get(capability);
  if (!state || state.consumed) throw new Error('PHASE_6_9_8_P1_G2_SOURCE_CAPABILITY_CONSUMED');
  state.consumed = true;
  return state.source;
}

export function createPhase698P1G2SyntheticSourceSnapshot(
  commit = 'a'.repeat(40),
): Phase698P1G2SourceSnapshot {
  if (!SHA40.test(commit)) throw new Error('PHASE_6_9_8_P1_G2_COMMIT_INVALID');
  return Object.freeze({
    branch: BRANCH,
    head: commit,
    upstream: commit,
    origin: commit,
    clean: true,
    formalEvidencePaths: Object.freeze([]),
    oldLineagePaths: Object.freeze([]),
  });
}

function readSnapshot(value: unknown): Phase698P1G2SourceSnapshot | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Reflect.ownKeys(record);
  const expected = [
    'branch',
    'head',
    'upstream',
    'origin',
    'clean',
    'formalEvidencePaths',
    'oldLineagePaths',
  ];
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== 'string' || !expected.includes(key))
  ) {
    return null;
  }
  const arrays = (entry: unknown) =>
    Array.isArray(entry) && entry.every((item) => typeof item === 'string' && item.length <= 240);
  if (
    typeof record.branch !== 'string' ||
    typeof record.head !== 'string' ||
    typeof record.upstream !== 'string' ||
    typeof record.origin !== 'string' ||
    typeof record.clean !== 'boolean' ||
    !arrays(record.formalEvidencePaths) ||
    !arrays(record.oldLineagePaths)
  ) {
    return null;
  }
  return Object.freeze({
    branch: record.branch,
    head: record.head,
    upstream: record.upstream,
    origin: record.origin,
    clean: record.clean,
    formalEvidencePaths: Object.freeze([...(record.formalEvidencePaths as string[])]),
    oldLineagePaths: Object.freeze([...(record.oldLineagePaths as string[])]),
  });
}
