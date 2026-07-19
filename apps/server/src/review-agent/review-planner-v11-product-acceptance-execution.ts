import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  assertReviewPlannerV11ProductAcceptanceOwner,
  readReviewPlannerV11ProductAcceptanceAttemptBinding,
  type ReviewPlannerV11ProductAcceptanceOwner,
} from './review-planner-v8-product-acceptance-recovery';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import { REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const V11_SYNTHETIC_ACCOUNT_ID =
  /^v11-synthetic-account-[a-z0-9][a-z0-9_-]{0,96}$/i;
const V11_SYNTHETIC_FIXTURE_ID =
  /^v11-synthetic-fixture-[a-z0-9][a-z0-9_-]{0,96}$/i;
const CREDENTIAL_LIKE_SELECTOR =
  /(?:^|[-_])(?:sk|bearer|api[-_]?key|token|password)(?:[-_]|$)/i;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\\[^\0]{1,500}$/;
const COST_CNY = /^(?:0|[1-9]\d*)\.\d{8}$/;
const PRIVATE_EXECUTION_MANIFEST_LEAF = 'execution-manifest.json';
const PRIVATE_ATTEMPT_BINDING_LEAF = 'attempt-binding.json';
const PRIVATE_OWNER_LOCK_LEAF = 'owner.lock';
const PRIVATE_CHECKPOINT_LEAF = /^checkpoint-\d{3}-[a-z_]+\.json$/;

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS = [
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
] as const;

export type ReviewPlannerV11ProductAcceptanceExecutionSlot =
  (typeof REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS)[number];

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOT_LEAVES =
  Object.freeze({
    'review-api': '.slot-01-review-api',
    'review-browser': '.slot-02-review-browser',
    'planner-api': '.slot-03-planner-api',
    'planner-browser': '.slot-04-planner-browser',
  } as const satisfies Readonly<
    Record<ReviewPlannerV11ProductAcceptanceExecutionSlot, string>
  >);

const V11_SUCCESS_PUBLIC_LEAVES = Object.freeze([
  '.acceptance-reserved',
  '.failure.json',
  'manifest.json',
  ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS.flatMap((slot) => {
    const claim =
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOT_LEAVES[slot];
    return [claim, `${claim}.result.json`];
  }),
  '.review-default-off.json',
  '.planner-default-off.json',
  '.owner-isolation-verified.json',
  '.cleanup-verified.json',
  'acceptance.json',
  '.acceptance-success',
] as const);

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PUBLIC_LEAVES =
  V11_SUCCESS_PUBLIC_LEAVES;

const safeHashSchema = z.string().regex(SHA256);
const existingAttemptBindingSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v11-product-acceptance-attempt-v1'),
    attemptId: z.string().regex(SHA256),
    attemptSha256: safeHashSchema,
  })
  .strict()
  .refine(
    (value) => sha256(value.attemptId) === value.attemptSha256,
    'V11_ATTEMPT_HASH_INVALID',
  );
const componentHashesSchema = z
  .object({ review: safeHashSchema, planner: safeHashSchema })
  .strict()
  .refine((value) => value.review !== value.planner, {
    message: 'V11_COMPONENT_HASHES_NOT_ISOLATED',
  });

export const reviewPlannerV11ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    commitSha: z.string().regex(COMMIT_SHA),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    accountSha256: componentHashesSchema,
    fixtureSha256: componentHashesSchema,
  })
  .strict();

const slotResultBase = {
  schemaVersion: z.literal(
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
  ),
  provider: z.literal('deepseek'),
  model: z.literal('deepseek-v4-pro'),
  observation: z.literal('candidate_applied'),
  provenance: z.literal('live_candidate'),
  durationMs: z.number().int().positive().max(60_000),
  traceSha256: safeHashSchema,
};

export const reviewPlannerV11ProductAcceptanceSlotResultSchema =
  z.discriminatedUnion('slot', [
    z.object({ ...slotResultBase, slot: z.literal('review-api') }).strict(),
    z
      .object({
        ...slotResultBase,
        slot: z.literal('review-browser'),
        screenshotSha256: safeHashSchema,
      })
      .strict(),
    z.object({ ...slotResultBase, slot: z.literal('planner-api') }).strict(),
    z
      .object({
        ...slotResultBase,
        slot: z.literal('planner-browser'),
        screenshotSha256: safeHashSchema,
      })
      .strict(),
  ]);

export const reviewPlannerV11ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    component: z.enum(['review', 'planner']),
    containerSha256: safeHashSchema,
    gates: z
      .object({
        liveCallsEnabled: z.literal(false),
        reviewAgentModelEnabled: z.literal(false),
        plannerAgentModelEnabled: z.literal(false),
      })
      .strict(),
    providerInvocations: z.literal(0),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    accountSha256: componentHashesSchema,
    factsSha256: z
      .object({
        reviewBefore: safeHashSchema,
        reviewAfter: safeHashSchema,
        plannerBefore: safeHashSchema,
        plannerAfter: safeHashSchema,
      })
      .strict(),
    traceSha256: z.array(safeHashSchema).length(4),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.factsSha256.reviewBefore !== value.factsSha256.reviewAfter ||
      value.factsSha256.plannerBefore !== value.factsSha256.plannerAfter ||
      new Set(value.traceSha256).size !== 4
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V11_OWNER_ISOLATION_INVALID',
      });
    }
  });

export const reviewPlannerV11ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    observation: z.literal('candidate_applied'),
    aggregate: z
      .object({
        requests: z.literal(4),
        durationMs: z.number().int().positive().max(240_000),
        usage: z
          .object({
            input: z.number().int().positive().max(100_000),
            output: z.number().int().positive().max(100_000),
          })
          .strict(),
        costCny: z.string().regex(COST_CNY),
      })
      .strict(),
    screenshotSha256: z
      .object({ plan: safeHashSchema, today: safeHashSchema })
      .strict(),
    cleanup: z.literal(true),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    manifestSha256: safeHashSchema,
    resultSha256: z.array(safeHashSchema).length(4),
    defaultOffSha256: z.array(safeHashSchema).length(2),
    ownerIsolationSha256: safeHashSchema,
    cleanupSha256: safeHashSchema,
    acceptanceSha256: safeHashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.resultSha256).size !== 4 ||
      new Set(value.defaultOffSha256).size !== 2
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V11_SUCCESS_HASHES_NOT_UNIQUE',
      });
    }
  });

export const reviewPlannerV11ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    resources: z
      .object({
        accountId: z
          .object({
            review: syntheticSelectorSchema(V11_SYNTHETIC_ACCOUNT_ID),
            planner: syntheticSelectorSchema(V11_SYNTHETIC_ACCOUNT_ID),
          })
          .strict()
          .refine((value) => value.review !== value.planner, {
            message: 'V11_EXECUTION_ACCOUNTS_NOT_ISOLATED',
          }),
        fixtureId: z
          .object({
            review: syntheticSelectorSchema(V11_SYNTHETIC_FIXTURE_ID),
            planner: syntheticSelectorSchema(V11_SYNTHETIC_FIXTURE_ID),
          })
          .strict()
          .refine((value) => value.review !== value.planner, {
            message: 'V11_EXECUTION_FIXTURES_NOT_ISOLATED',
          }),
        browser: z
          .object({
            executablePath: z.string().regex(WINDOWS_ABSOLUTE_PATH),
            profilePath: z.string().min(1).max(500),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

function syntheticSelectorSchema(pattern: RegExp) {
  return z
    .string()
    .regex(pattern)
    .refine((value) => !CREDENTIAL_LIKE_SELECTOR.test(value), {
      message: 'V11_EXECUTION_SELECTOR_CREDENTIAL_INVALID',
    });
}

export type ReviewPlannerV11ProductAcceptanceManifestRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV11ProductAcceptanceSlotResultRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV11ProductAcceptanceDefaultOffRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV11ProductAcceptanceOwnerIsolationRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV11ProductAcceptanceCleanupRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV11ProductAcceptanceAggregateRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV11ProductAcceptanceSuccessRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV11ProductAcceptanceExecutionManifestRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceExecutionManifestSchema
>;

export function parseReviewPlannerV11ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceManifestRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceManifestSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceSlotResultRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceDefaultOffRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceOwnerIsolationRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceCleanupRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceCleanupSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceAggregateRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceAggregateSchema,
    value,
    true,
  );
}

export function parseReviewPlannerV11ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceSuccessRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceSuccessSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceExecutionManifestRecord {
  if (containsForbiddenExecutionKey(value, false)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  const parsed =
    reviewPlannerV11ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export async function writeReviewPlannerV11ProductAcceptanceExecutionManifest(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    value: unknown;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
    input.value,
  );
  return writeReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
    {
      ...input,
      value: manifest,
      attemptSha256: binding.attemptSha256,
    },
  );
}

export async function writeReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    attemptSha256: string;
    value: unknown;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  if (binding.attemptSha256 !== input.attemptSha256) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
    input.value,
  );
  if (
    manifest.environment !== input.environment ||
    manifest.attemptSha256 !== input.attemptSha256 ||
    manifest.resources.browser.profilePath !==
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        input.environment,
      )
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length > 0) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
    }
    const result = directory.commitExclusiveDurableFileViaRename(
      PRIVATE_EXECUTION_MANIFEST_LEAF,
      serialize(manifest),
    );
    if (!result.committed || result.cleanupStatus !== 'closed') {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
    }
    return Object.freeze({ ...manifest });
  } catch (error) {
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    directory?.close();
  }
}

export async function readReviewPlannerV11ProductAcceptanceExecutionManifest(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  const attemptSha256 = await readBoundV11AttemptHashForExecution(input);
  return readReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
    { ...input, attemptSha256 },
  );
}

export async function readReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    attemptSha256: string;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  if (!SHA256.test(input.attemptSha256)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length !== 1 || leaves[0] !== PRIVATE_EXECUTION_MANIFEST_LEAF) {
      throw new Error();
    }
    const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
      JSON.parse(
        directory.readRegularFile(PRIVATE_EXECUTION_MANIFEST_LEAF).toString(),
      ),
    );
    if (
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== input.attemptSha256 ||
      manifest.resources.browser.profilePath !==
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
          input.environment,
        )
    ) {
      throw new Error();
    }
    return Object.freeze({ ...manifest });
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    directory?.close();
  }
}

export function executionManifestMatchesPublicManifest(
  execution: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
  manifest: ReviewPlannerV11ProductAcceptanceManifestRecord,
) {
  return (
    execution.environment === manifest.environment &&
    execution.attemptSha256 === manifest.attemptSha256 &&
    sha256(execution.resources.accountId.review) ===
      manifest.accountSha256.review &&
    sha256(execution.resources.accountId.planner) ===
      manifest.accountSha256.planner &&
    sha256(execution.resources.fixtureId.review) ===
      manifest.fixtureSha256.review &&
    sha256(execution.resources.fixtureId.planner) ===
      manifest.fixtureSha256.planner
  );
}

function parsePublicRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  allowAggregateUsage = false,
): T {
  if (containsForbiddenExecutionKey(value, allowAggregateUsage)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function containsForbiddenExecutionKey(
  value: unknown,
  allowAggregateUsage: boolean,
) {
  const seen = new Set<object>();
  const visit = (candidate: unknown, path: readonly string[]): boolean => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    try {
      for (const key of Object.keys(candidate)) {
        const nextPath = [...path, key];
        const aggregateUsage =
          allowAggregateUsage &&
          path.length === 1 &&
          path[0] === 'aggregate' &&
          key === 'usage';
        if (
          !aggregateUsage &&
          /raw.?error|prompt|response|url|header|token|credential|cookie|user.?fact|email|password|access.?token|capability|provider.?key|api.?key|trace.?id/i.test(
            key,
          )
        ) {
          return true;
        }
        if (visit((candidate as Record<string, unknown>)[key], nextPath)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  };
  return visit(value, []);
}

async function readBoundV11AttemptHashForExecution(input: {
  repoRoot: string;
  environment: 'branch' | 'main';
}) {
  let publicDirectory: WindowsNoReparseChildDirectory | null = null;
  let privateDirectory: WindowsNoReparseChildDirectory | null = null;
  try {
    publicDirectory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    publicDirectory.assertLocalFixedNtfsVolume();
    const leaves = publicDirectory.listLeafNames();
    if (
      !leaves.includes('.acceptance-reserved') ||
      leaves.some(
        (leaf) =>
          !(
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PUBLIC_LEAVES as readonly string[]
          ).includes(leaf),
      )
    ) {
      throw new Error();
    }
    const attemptSha256 = publicDirectory
      .readRegularFile('.acceptance-reserved')
      .toString();
    if (
      !SHA256.test(attemptSha256.trim()) ||
      attemptSha256 !== `${attemptSha256.trim()}\n`
    ) {
      throw new Error();
    }
    privateDirectory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
          input.environment,
        ),
      ],
    );
    privateDirectory.assertLocalFixedNtfsVolume();
    const privateLeaves = privateDirectory.listLeafNames();
    if (
      !privateLeaves.includes(PRIVATE_OWNER_LOCK_LEAF) ||
      !privateLeaves.includes(PRIVATE_ATTEMPT_BINDING_LEAF) ||
      privateLeaves.some(
        (leaf) =>
          leaf !== PRIVATE_OWNER_LOCK_LEAF &&
          leaf !== PRIVATE_ATTEMPT_BINDING_LEAF &&
          !PRIVATE_CHECKPOINT_LEAF.test(leaf),
      )
    ) {
      throw new Error();
    }
    const binding = existingAttemptBindingSchema.parse(
      JSON.parse(
        privateDirectory
          .readRegularFile(PRIVATE_ATTEMPT_BINDING_LEAF)
          .toString(),
      ),
    );
    if (binding.attemptSha256 !== attemptSha256.trim()) throw new Error();
    return binding.attemptSha256;
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    privateDirectory?.close();
    publicDirectory?.close();
  }
}

function serialize(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
