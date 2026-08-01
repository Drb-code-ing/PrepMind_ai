import { createHash } from 'node:crypto';

import { z } from 'zod';

export const PHASE_6_9_7_FULL_GATE_LINEAGE = 'phase-6.9.7-tutor-organizer-full-gate-v1' as const;
export const PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION =
  'phase-6.9.7-tutor-organizer-full-gate-manifest-v1' as const;
export const PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION =
  'phase-6.9-tutor-wrong-question-v2' as const;
export const PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256 =
  '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b' as const;
export const PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION =
  'phase-6.9.7-v5-eval-policy-v1' as const;
export const PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256 =
  'b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d' as const;

const tutorGuardCaseIds = [
  'tutor-v2-zero-route-not-tutor',
  'tutor-v2-zero-explicit-answer',
  'tutor-v2-zero-explicit-hint',
  'tutor-v2-zero-explicit-step',
  'tutor-v2-zero-explicit-concept',
  'tutor-v2-zero-explicit-explain',
  'tutor-v2-zero-empty-input',
  'tutor-v2-zero-aborted',
  'tutor-v2-zero-budget-exhausted',
  'tutor-v2-zero-credential-material',
  'tutor-v2-zero-instruction-override',
  'tutor-v2-zero-hostile-accessor',
] as const;

const organizerGuardCaseIds = [
  'organizer-v2-zero-existing-item',
  'organizer-v2-zero-exact-deck',
  'organizer-v2-zero-high-knowledge',
  'organizer-v2-zero-high-category',
  'organizer-v2-zero-gate-off',
  'organizer-v2-zero-live-off',
  'organizer-v2-zero-aborted',
  'organizer-v2-zero-budget-exhausted',
  'organizer-v2-zero-owner-mismatch',
  'organizer-v2-zero-credential-material',
  'organizer-v2-zero-instruction-override',
  'organizer-v2-zero-hostile-accessor',
] as const;

const runtimePairs = Array.from({ length: 24 }, (_, pairedRunIndex) => ({
  pairedRunIndex,
  tutorCaseId: `tutor-v2-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`,
  organizerCaseId: `organizer-v2-runtime-${String(pairedRunIndex + 1).padStart(2, '0')}`,
}));

export const PHASE_6_9_7_FULL_GATE_MANIFEST = deepFreeze({
  manifestVersion: PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
  sourceDatasetVersion: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
  sourceDatasetSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
  sourceEvalPolicyVersion: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION,
  sourceEvalPolicySha256: PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256,
  tutorGuardCaseIds,
  organizerGuardCaseIds,
  runtimePairs,
});

const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);

export const PHASE_6_9_7_FULL_GATE_MANIFEST_SCHEMA = z
  .object({
    manifestVersion: z.literal(PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION),
    sourceDatasetVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION),
    sourceDatasetSha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256),
    sourceEvalPolicyVersion: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_VERSION),
    sourceEvalPolicySha256: z.literal(PHASE_6_9_7_FULL_GATE_SOURCE_EVAL_POLICY_SHA256),
    tutorGuardCaseIds: z.array(caseIdSchema).length(12),
    organizerGuardCaseIds: z.array(caseIdSchema).length(12),
    runtimePairs: z
      .array(
        z
          .object({
            pairedRunIndex: z.number().int().min(0).max(23),
            tutorCaseId: caseIdSchema,
            organizerCaseId: caseIdSchema,
          })
          .strict(),
      )
      .length(24),
  })
  .strict();

export const PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256 = computePhase697FullGateCanonicalSha256(
  PHASE_6_9_7_FULL_GATE_MANIFEST,
);
export const PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256 =
  'e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78' as const;

if (PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256 !== PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256) {
  throw new Error('PHASE_6_9_7_FULL_GATE_MANIFEST_SHA_MISMATCH');
}

export type Phase697FullGateExpectedEntry = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  kind: 'guard' | 'runtime';
  pairedRunIndex: number | null;
}>;

export const PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES: readonly Phase697FullGateExpectedEntry[] =
  deepFreeze([
    ...PHASE_6_9_7_FULL_GATE_MANIFEST.tutorGuardCaseIds.map((caseId) => ({
      caseId,
      agent: 'tutor' as const,
      kind: 'guard' as const,
      pairedRunIndex: null,
    })),
    ...PHASE_6_9_7_FULL_GATE_MANIFEST.organizerGuardCaseIds.map((caseId) => ({
      caseId,
      agent: 'wrong_question_organizer' as const,
      kind: 'guard' as const,
      pairedRunIndex: null,
    })),
    ...PHASE_6_9_7_FULL_GATE_MANIFEST.runtimePairs.flatMap((pair) => [
      {
        caseId: pair.tutorCaseId,
        agent: 'tutor' as const,
        kind: 'runtime' as const,
        pairedRunIndex: pair.pairedRunIndex,
      },
      {
        caseId: pair.organizerCaseId,
        agent: 'wrong_question_organizer' as const,
        kind: 'runtime' as const,
        pairedRunIndex: pair.pairedRunIndex,
      },
    ]),
  ]);

export const PHASE_6_9_7_FULL_GATE_L2_ANCHOR_PAIR_INDEXES = deepFreeze([
  0, 7, 9, 11, 14, 18, 22, 23,
] as const);

export function validatePhase697FullGateManifest(
  value: unknown,
): Readonly<{ ok: true }> | Readonly<{ ok: false; issues: readonly string[] }> {
  try {
    const cloned = cloneCanonicalJson(value);
    const parsed = PHASE_6_9_7_FULL_GATE_MANIFEST_SCHEMA.safeParse(cloned);
    if (!parsed.success) return deepFreeze({ ok: false, issues: ['schema_invalid'] });
    if (
      canonicalJson(parsed.data) !== canonicalJson(PHASE_6_9_7_FULL_GATE_MANIFEST) ||
      computePhase697FullGateCanonicalSha256(parsed.data) !==
        PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256
    ) {
      return deepFreeze({ ok: false, issues: ['manifest_authority_mismatch'] });
    }
    return { ok: true };
  } catch {
    return deepFreeze({ ok: false, issues: ['non_canonical_input'] });
  }
}

export function computePhase697FullGateCanonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function canonicalPhase697FullGateJson(value: unknown): string {
  return canonicalJson(value);
}

function canonicalJson(value: unknown) {
  return JSON.stringify(cloneCanonicalJson(value));
}

function cloneCanonicalJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_FULL_GATE_NON_FINITE_VALUE');
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error('PHASE_6_9_7_FULL_GATE_UNSUPPORTED_VALUE');
  }
  if (seen.has(value)) throw new Error('PHASE_6_9_7_FULL_GATE_CYCLIC_VALUE');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) {
        throw new Error('PHASE_6_9_7_FULL_GATE_SPARSE_ARRAY');
      }
      return value.map((child) => cloneCanonicalJson(child, seen));
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('PHASE_6_9_7_FULL_GATE_NON_PLAIN_VALUE');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      throw new Error('PHASE_6_9_7_FULL_GATE_SYMBOL_KEY');
    }
    const entries = (keys as string[]).sort(compareCodePoints).map((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error('PHASE_6_9_7_FULL_GATE_ACCESSOR_VALUE');
      }
      return [key, cloneCanonicalJson(descriptor.value, seen)] as const;
    });
    return Object.fromEntries(entries);
  } finally {
    seen.delete(value);
  }
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
