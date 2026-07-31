import { createHash } from 'node:crypto';

import { z } from 'zod';

export const PHASE_6_9_7_SMALL_SAMPLE_LINEAGE =
  'phase-6.9.7-tutor-organizer-small-sample-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-manifest-v1' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION =
  'phase-6.9-tutor-wrong-question-v2' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256 =
  '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b' as const;
export const PHASE_6_9_7_SMALL_SAMPLE_SOURCE_EVAL_POLICY_SHA256 =
  'b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d' as const;

export const PHASE_6_9_7_SMALL_SAMPLE_MANIFEST = deepFreeze({
  manifestVersion: PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION,
  sourceDatasetVersion: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION,
  sourceDatasetSha256: PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
  tutorGuardCaseIds: [
    'tutor-v2-zero-route-not-tutor',
    'tutor-v2-zero-credential-material',
    'tutor-v2-zero-instruction-override',
    'tutor-v2-zero-hostile-accessor',
  ],
  organizerGuardCaseIds: [
    'organizer-v2-zero-owner-mismatch',
    'organizer-v2-zero-credential-material',
    'organizer-v2-zero-instruction-override',
    'organizer-v2-zero-hostile-accessor',
  ],
  runtimePairs: [
    {
      pairedRunIndex: 0,
      tutorCaseId: 'tutor-v2-runtime-01',
      organizerCaseId: 'organizer-v2-runtime-01',
      selectionTags: [
        'tutor:socratic_hint',
        'language:zh',
        'organizer:math',
        'action:create_topic',
        'critical:hint_no_final',
      ],
    },
    {
      pairedRunIndex: 7,
      tutorCaseId: 'tutor-v2-runtime-08',
      organizerCaseId: 'organizer-v2-runtime-08',
      selectionTags: [
        'tutor:step_check',
        'language:zh',
        'organizer:english',
        'action:reuse_existing',
      ],
    },
    {
      pairedRunIndex: 9,
      tutorCaseId: 'tutor-v2-runtime-10',
      organizerCaseId: 'organizer-v2-runtime-10',
      selectionTags: [
        'tutor:step_check',
        'language:mixed',
        'tutor:conflicting_signals',
        'organizer:major',
        'action:create_topic',
      ],
    },
    {
      pairedRunIndex: 11,
      tutorCaseId: 'tutor-v2-runtime-12',
      organizerCaseId: 'organizer-v2-runtime-12',
      selectionTags: [
        'tutor:concept_bridge',
        'language:en',
        'organizer:politics',
        'action:create_topic',
      ],
    },
    {
      pairedRunIndex: 14,
      tutorCaseId: 'tutor-v2-runtime-15',
      organizerCaseId: 'organizer-v2-runtime-15',
      selectionTags: [
        'tutor:concept_bridge',
        'language:zh',
        'tutor:conflicting_signals',
        'organizer:computer',
        'action:create_topic',
        'authority:structured_subject',
      ],
    },
    {
      pairedRunIndex: 18,
      tutorCaseId: 'tutor-v2-runtime-19',
      organizerCaseId: 'organizer-v2-runtime-19',
      selectionTags: [
        'tutor:explain_solution',
        'language:en',
        'organizer:computer',
        'action:reuse_existing',
      ],
    },
    {
      pairedRunIndex: 22,
      tutorCaseId: 'tutor-v2-runtime-23',
      organizerCaseId: 'organizer-v2-runtime-23',
      selectionTags: [
        'tutor:general_follow_up',
        'language:zh',
        'organizer:major+other',
        'action:create+reuse',
        'batch:cross_subject',
        'critical:locked_name',
      ],
    },
    {
      pairedRunIndex: 23,
      tutorCaseId: 'tutor-v2-runtime-24',
      organizerCaseId: 'organizer-v2-runtime-24',
      selectionTags: [
        'tutor:general_follow_up',
        'language:en',
        'organizer:math+english+computer',
        'action:create_topic',
        'batch:cross_subject',
        'critical:no_write_command',
      ],
    },
  ],
} as const);

const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);
const selectionTagSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9_:+-]+$/);

export const PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SCHEMA = z
  .object({
    manifestVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_VERSION),
    sourceDatasetVersion: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_VERSION),
    sourceDatasetSha256: z.literal(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256),
    tutorGuardCaseIds: z.array(caseIdSchema).length(4),
    organizerGuardCaseIds: z.array(caseIdSchema).length(4),
    runtimePairs: z
      .array(
        z
          .object({
            pairedRunIndex: z.number().int().min(0).max(23),
            tutorCaseId: caseIdSchema,
            organizerCaseId: caseIdSchema,
            selectionTags: z.array(selectionTagSchema).min(4).max(6),
          })
          .strict(),
      )
      .length(8),
  })
  .strict();

export const PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256 = computePhase697SmallSampleCanonicalSha256(
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST,
);
export const PHASE_6_9_7_SMALL_SAMPLE_FROZEN_MANIFEST_SHA256 =
  'ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61' as const;

if (PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256 !== PHASE_6_9_7_SMALL_SAMPLE_FROZEN_MANIFEST_SHA256) {
  throw new Error('PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA_MISMATCH');
}

export type Phase697SmallSampleExpectedEntry = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  kind: 'guard' | 'runtime';
  pairedRunIndex: number | null;
}>;

export const PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES: readonly Phase697SmallSampleExpectedEntry[] =
  deepFreeze([
    ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.tutorGuardCaseIds.map((caseId) => ({
      caseId,
      agent: 'tutor' as const,
      kind: 'guard' as const,
      pairedRunIndex: null,
    })),
    ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.organizerGuardCaseIds.map((caseId) => ({
      caseId,
      agent: 'wrong_question_organizer' as const,
      kind: 'guard' as const,
      pairedRunIndex: null,
    })),
    ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs.flatMap((pair) => [
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

export function validatePhase697SmallSampleManifest(
  value: unknown,
): Readonly<{ ok: true }> | Readonly<{ ok: false; issues: readonly string[] }> {
  try {
    const cloned = cloneCanonicalJson(value);
    const parsed = PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SCHEMA.safeParse(cloned);
    if (!parsed.success) {
      return deepFreeze({ ok: false, issues: ['schema_invalid'] });
    }
    if (
      canonicalJson(parsed.data) !== canonicalJson(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST) ||
      computePhase697SmallSampleCanonicalSha256(parsed.data) !==
        PHASE_6_9_7_SMALL_SAMPLE_FROZEN_MANIFEST_SHA256
    ) {
      return deepFreeze({ ok: false, issues: ['manifest_authority_mismatch'] });
    }
    return { ok: true };
  } catch {
    return deepFreeze({ ok: false, issues: ['non_canonical_input'] });
  }
}

export function computePhase697SmallSampleCanonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function canonicalPhase697SmallSampleJson(value: unknown): string {
  return canonicalJson(value);
}

function canonicalJson(value: unknown) {
  return JSON.stringify(cloneCanonicalJson(value));
}

function cloneCanonicalJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_SMALL_SAMPLE_NON_FINITE_VALUE');
    return value;
  }
  if (typeof value !== 'object') {
    throw new Error('PHASE_6_9_7_SMALL_SAMPLE_UNSUPPORTED_VALUE');
  }
  if (seen.has(value)) throw new Error('PHASE_6_9_7_SMALL_SAMPLE_CYCLIC_VALUE');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.keys(value).length !== value.length) {
        throw new Error('PHASE_6_9_7_SMALL_SAMPLE_SPARSE_ARRAY');
      }
      return value.map((child) => cloneCanonicalJson(child, seen));
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_NON_PLAIN_VALUE');
    }
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) {
      throw new Error('PHASE_6_9_7_SMALL_SAMPLE_SYMBOL_KEY');
    }
    const entries = (keys as string[]).sort(compareCodePoints).map((key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        throw new Error('PHASE_6_9_7_SMALL_SAMPLE_ACCESSOR_VALUE');
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
