import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  assertReviewPlannerV14ProductAcceptanceOwner,
  bindReviewPlannerV14ProductAcceptanceAttempt,
  inspectReviewPlannerV14ProductAcceptanceRecoveryCheckpoint,
  readReviewPlannerV14ProductAcceptanceAttemptBinding,
  registerReviewPlannerV14ProductAcceptanceOwnerAttempt,
  type ReviewPlannerV14ProductAcceptanceOwner,
} from './review-planner-v14-product-acceptance-recovery';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';

const ATTEMPT_HASH = /^[a-f0-9]{64}$/;
const RESERVATION_LEAF = '.acceptance-reserved';
const MANIFEST_LEAF = 'manifest.json';
const EXECUTION_MANIFEST_LEAF = 'execution-manifest.json';
const OWNER_ISOLATION_LEAF = 'owner-isolation.json';
const CLEANUP_LEAF = 'cleanup.json';
const AGGREGATE_LEAF = 'aggregate.json';
const SUCCESS_LEAF = 'success.json';
const FAILURE_LEAF = 'failure.json';
const RECOVERY_LEAF = 'recovery.json';
const SLOT_LEAF = /^slot-(review|planner)-(api|browser)\.json$/;
const DEFAULT_OFF_LEAF = /^default-off-(review|planner)\.json$/;

export const reviewPlannerV14ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict();

const v14ExecutionSelector = (
  kind: 'account' | 'fixture',
  component: 'review' | 'planner',
) =>
  z
    .string()
    .regex(new RegExp(`^v14-synthetic-${kind}-${component}-[a-f0-9]{32}$`));

export const reviewPlannerV14ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    databaseUrlSha256: z.string().regex(ATTEMPT_HASH),
    resources: z
      .object({
        accountId: z
          .object({
            review: v14ExecutionSelector('account', 'review'),
            planner: v14ExecutionSelector('account', 'planner'),
          })
          .strict(),
        fixtureId: z
          .object({
            review: v14ExecutionSelector('fixture', 'review'),
            planner: v14ExecutionSelector('fixture', 'planner'),
          })
          .strict(),
        browser: z
          .object({
            executablePath: z.literal(
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            ),
            profilePath: z.string(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.resources.browser.profilePath !==
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        value.environment,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'V14 profile mismatch' });
    }
  });

const v14SlotSchema = z.enum([
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
]);
const v14ComponentSchema = z.enum(['review', 'planner']);
const v14HashSchema = z.string().regex(ATTEMPT_HASH);

export const reviewPlannerV14ProductAcceptanceSlotResultSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
    ),
    slot: v14SlotSchema,
    traceSha256: v14HashSchema,
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    component: v14ComponentSchema,
    providerInvocations: z.literal(0),
    gates: z
      .object({
        liveCallsEnabled: z.literal(false),
        reviewAgentModelEnabled: z.literal(false),
        plannerAgentModelEnabled: z.literal(false),
      })
      .strict(),
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
    traceSha256: z.array(v14HashSchema).length(4),
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v14HashSchema,
    requests: z.literal(4),
    durationMs: z.number().int().positive().max(240_000),
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v14HashSchema,
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceFailureSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v14HashSchema,
    component: v14ComponentSchema,
    slot: z.enum(['api', 'browser']),
    checkpoint: z.string().regex(/^(review|planner)_(api|browser)_[a-z_]+$/),
    terminal: z.literal('operation_failed'),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict();

export const reviewPlannerV14ProductAcceptanceRecoverySchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    terminal: z.literal('recovered'),
  })
  .strict();

export type ReviewPlannerV14ProductAcceptanceManifest = z.infer<
  typeof reviewPlannerV14ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV14ProductAcceptanceExecutionManifest = z.infer<
  typeof reviewPlannerV14ProductAcceptanceExecutionManifestSchema
>;
export type ReviewPlannerV14ProductAcceptanceSlotResult = z.infer<
  typeof reviewPlannerV14ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV14ProductAcceptanceDefaultOff = z.infer<
  typeof reviewPlannerV14ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV14ProductAcceptanceOwnerIsolation = z.infer<
  typeof reviewPlannerV14ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV14ProductAcceptanceCleanup = z.infer<
  typeof reviewPlannerV14ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV14ProductAcceptanceAggregate = z.infer<
  typeof reviewPlannerV14ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV14ProductAcceptanceSuccess = z.infer<
  typeof reviewPlannerV14ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV14ProductAcceptanceFailure = z.infer<
  typeof reviewPlannerV14ProductAcceptanceFailureSchema
>;
export type ReviewPlannerV14ProductAcceptanceRecovery = z.infer<
  typeof reviewPlannerV14ProductAcceptanceRecoverySchema
>;

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  owner: ReviewPlannerV14ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  executionWritten: boolean;
  claimedSlots: Set<ReviewPlannerV14ProductAcceptanceSlotResult['slot']>;
  slotResults: Set<ReviewPlannerV14ProductAcceptanceSlotResult['slot']>;
  defaultOff: Set<ReviewPlannerV14ProductAcceptanceDefaultOff['component']>;
  ownerIsolationWritten: boolean;
  cleanupWritten: boolean;
  failureWritten: boolean;
  finalized: boolean;
  closed: boolean;
};

export type ReviewPlannerV14ProductAcceptanceLedger = Readonly<{
  attemptSha256(): string;
  writeExecutionManifest(value: unknown): Promise<void>;
  writeManifest(value: unknown): void;
  claimSlot(slot: ReviewPlannerV14ProductAcceptanceSlotResult['slot']): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(value: unknown): Promise<void>;
  recordFailure(value: unknown): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV14ProductAcceptanceLedger,
  LedgerState
>();

export async function reserveReviewPlannerV14ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV14ProductAcceptanceOwner;
}): Promise<ReviewPlannerV14ProductAcceptanceLedger> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV14ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    const repoRoot = resolve(input.repoRoot);
    directory = await openWindowsNoReparseFrozenDirectory(repoRoot, [
      ...REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V14_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    const attemptId = randomBytes(32).toString('hex');
    const attemptSha256 = sha256(attemptId);
    directory.createExclusiveDurableFile(
      RESERVATION_LEAF,
      `${attemptSha256}\n`,
    );
    const binding = await bindReviewPlannerV14ProductAcceptanceAttempt({
      repoRoot,
      environment: input.environment,
      owner: input.owner,
      attemptId,
    });
    if (binding.attemptSha256 !== attemptSha256) {
      throw new Error('V14_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    reservationGuard =
      directory.tryAcquireExclusiveLifetimeFile(RESERVATION_LEAF);
    if (reservationGuard === null) {
      throw new Error('V14_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    registerReviewPlannerV14ProductAcceptanceOwnerAttempt(
      input.owner,
      input.environment,
      attemptSha256,
    );
    const ledger = createV14Ledger({
      repoRoot,
      environment: input.environment,
      attemptSha256,
      owner: input.owner,
      directory,
      reservationGuard,
      executionWritten: false,
      claimedSlots: new Set(),
      slotResults: new Set(),
      defaultOff: new Set(),
      ownerIsolationWritten: false,
      cleanupWritten: false,
      failureWritten: false,
      finalized: false,
      closed: false,
    });
    directory = null;
    reservationGuard = null;
    return ledger;
  } catch (error) {
    reservationGuard?.close();
    directory?.close();
    if (
      error instanceof Error &&
      /^V14_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V14_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV14ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<
  Readonly<{
    status:
      | 'empty'
      | 'incomplete'
      | 'complete'
      | 'operation_failed'
      | 'recovered'
      | 'evidence_io';
  }>
> {
  if (!isEnvironment(input.environment)) {
    return Object.freeze({ status: 'evidence_io' as const });
  }
  const publicPath = resolve(
    input.repoRoot,
    REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath(
      input.environment,
    ),
  );
  if (!existsSync(publicPath))
    return Object.freeze({ status: 'empty' as const });
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      !hasOnlyV14PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF)
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV14ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV14ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV14ProductAcceptanceExecutionManifest(input);
    if (
      binding.attemptSha256 !== attemptSha256 ||
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== attemptSha256 ||
      execution.environment !== input.environment ||
      execution.attemptSha256 !== attemptSha256
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    await inspectReviewPlannerV14ProductAcceptanceRecoveryCheckpoint(input);
    const hasFailure = leaves.includes(FAILURE_LEAF);
    const hasSuccess = leaves.includes(SUCCESS_LEAF);
    const hasRecovery = leaves.includes(RECOVERY_LEAF);
    if (
      (hasFailure && hasSuccess) ||
      (hasSuccess && hasRecovery) ||
      (!hasFailure && hasRecovery)
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    if (hasFailure) {
      const failure = parseReviewPlannerV14ProductAcceptanceFailure(
        JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
      );
      const checkpoint =
        await inspectReviewPlannerV14ProductAcceptanceRecoveryCheckpoint(input);
      if (
        failure.environment !== input.environment ||
        failure.attemptSha256 !== attemptSha256 ||
        checkpoint === null ||
        checkpoint.component !== failure.component ||
        checkpoint.slot !== failure.slot ||
        checkpoint.checkpoint !== failure.checkpoint ||
        checkpoint.providerCallState !== failure.providerCallState
      ) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      if (hasRecovery) {
        const recovery = parseReviewPlannerV14ProductAcceptanceRecovery(
          JSON.parse(directory.readRegularFile(RECOVERY_LEAF).toString()),
        );
        if (
          recovery.environment !== input.environment ||
          recovery.attemptSha256 !== attemptSha256
        ) {
          return Object.freeze({ status: 'evidence_io' as const });
        }
        return Object.freeze({ status: 'recovered' as const });
      }
      return Object.freeze({ status: 'operation_failed' as const });
    }
    if (!hasSuccess) {
      return Object.freeze({ status: 'incomplete' as const });
    }
    const slots = [
      'review-api',
      'review-browser',
      'planner-api',
      'planner-browser',
    ] as const;
    for (const slot of slots) {
      const record = parseReviewPlannerV14ProductAcceptanceSlotResult(
        JSON.parse(directory.readRegularFile(`slot-${slot}.json`).toString()),
      );
      if (record.slot !== slot)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    for (const component of ['review', 'planner'] as const) {
      const record = parseReviewPlannerV14ProductAcceptanceDefaultOff(
        JSON.parse(
          directory.readRegularFile(`default-off-${component}.json`).toString(),
        ),
      );
      if (record.component !== component)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    parseReviewPlannerV14ProductAcceptanceOwnerIsolation(
      JSON.parse(directory.readRegularFile(OWNER_ISOLATION_LEAF).toString()),
    );
    parseReviewPlannerV14ProductAcceptanceCleanup(
      JSON.parse(directory.readRegularFile(CLEANUP_LEAF).toString()),
    );
    const aggregate = parseReviewPlannerV14ProductAcceptanceAggregate(
      JSON.parse(directory.readRegularFile(AGGREGATE_LEAF).toString()),
    );
    const success = parseReviewPlannerV14ProductAcceptanceSuccess(
      JSON.parse(directory.readRegularFile(SUCCESS_LEAF).toString()),
    );
    if (
      aggregate.environment !== input.environment ||
      aggregate.attemptSha256 !== attemptSha256 ||
      success.environment !== input.environment ||
      success.attemptSha256 !== attemptSha256
    )
      return Object.freeze({ status: 'evidence_io' as const });
    return Object.freeze({ status: 'complete' as const });
  } catch {
    return Object.freeze({ status: 'evidence_io' as const });
  } finally {
    directory?.close();
  }
}

export async function readReviewPlannerV14ProductAcceptanceExecutionManifest(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV14ProductAcceptanceExecutionManifest> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length !== 1 || leaves[0] !== EXECUTION_MANIFEST_LEAF) {
      throw new Error();
    }
    return parseReviewPlannerV14ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
  } catch {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function parseReviewPlannerV14ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceManifest {
  const parsed =
    reviewPlannerV14ProductAcceptanceManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function parseReviewPlannerV14ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceExecutionManifest {
  const parsed =
    reviewPlannerV14ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function createReviewPlannerV14ProductAcceptanceExecutionManifest(input: {
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  databaseUrlSha256: string;
}): ReviewPlannerV14ProductAcceptanceExecutionManifest {
  if (
    !isEnvironment(input.environment) ||
    !ATTEMPT_HASH.test(input.attemptSha256) ||
    !ATTEMPT_HASH.test(input.databaseUrlSha256)
  ) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  const selector = () => randomBytes(16).toString('hex');
  return parseReviewPlannerV14ProductAcceptanceExecutionManifest({
    schemaVersion:
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    environment: input.environment,
    attemptSha256: input.attemptSha256,
    databaseUrlSha256: input.databaseUrlSha256,
    resources: {
      accountId: {
        review: `v14-synthetic-account-review-${selector()}`,
        planner: `v14-synthetic-account-planner-${selector()}`,
      },
      fixtureId: {
        review: `v14-synthetic-fixture-review-${selector()}`,
        planner: `v14-synthetic-fixture-planner-${selector()}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            input.environment,
          ),
      },
    },
  });
}

export function parseReviewPlannerV14ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceSlotResult {
  return parseV14Record(
    reviewPlannerV14ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV14ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceDefaultOff {
  return parseV14Record(
    reviewPlannerV14ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV14ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceOwnerIsolation {
  return parseV14Record(
    reviewPlannerV14ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV14ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceCleanup {
  return parseV14Record(reviewPlannerV14ProductAcceptanceCleanupSchema, value);
}

export function parseReviewPlannerV14ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceAggregate {
  return parseV14Record(
    reviewPlannerV14ProductAcceptanceAggregateSchema,
    value,
  );
}

export function parseReviewPlannerV14ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceSuccess {
  return parseV14Record(reviewPlannerV14ProductAcceptanceSuccessSchema, value);
}

export function parseReviewPlannerV14ProductAcceptanceFailure(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceFailure {
  return parseV14Record(reviewPlannerV14ProductAcceptanceFailureSchema, value);
}

export function parseReviewPlannerV14ProductAcceptanceRecovery(
  value: unknown,
): ReviewPlannerV14ProductAcceptanceRecovery {
  return parseV14Record(reviewPlannerV14ProductAcceptanceRecoverySchema, value);
}

export async function finalizeReviewPlannerV14ProductAcceptanceRecovery(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV14ProductAcceptanceOwner;
}): Promise<void> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
  }
  assertReviewPlannerV14ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      !hasOnlyV14PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF) ||
      !leaves.includes(FAILURE_LEAF) ||
      leaves.includes(SUCCESS_LEAF) ||
      leaves.includes(RECOVERY_LEAF)
    ) {
      throw new Error('V14_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV14ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV14ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV14ProductAcceptanceExecutionManifest(input);
    const failure = parseReviewPlannerV14ProductAcceptanceFailure(
      JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
    );
    const checkpoint =
      await inspectReviewPlannerV14ProductAcceptanceRecoveryCheckpoint(input);
    if (
      binding.attemptSha256 !== attemptSha256 ||
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== attemptSha256 ||
      execution.environment !== input.environment ||
      execution.attemptSha256 !== attemptSha256 ||
      failure.environment !== input.environment ||
      failure.attemptSha256 !== attemptSha256 ||
      checkpoint === null ||
      checkpoint.component !== failure.component ||
      checkpoint.slot !== failure.slot ||
      checkpoint.checkpoint !== failure.checkpoint ||
      checkpoint.providerCallState !== failure.providerCallState
    ) {
      throw new Error('V14_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    directory.createExclusiveDurableFile(
      RECOVERY_LEAF,
      `${JSON.stringify(
        parseReviewPlannerV14ProductAcceptanceRecovery({
          schemaVersion:
            REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
          environment: input.environment,
          attemptSha256,
          terminal: 'recovered',
        }),
      )}\n`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'V14_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED'
    ) {
      throw error;
    }
    throw new Error('V14_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory?.close();
  }
}

function parseV14Record<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function createV14Ledger(
  state: LedgerState,
): ReviewPlannerV14ProductAcceptanceLedger {
  const ledger: ReviewPlannerV14ProductAcceptanceLedger = Object.freeze({
    attemptSha256: () => state.attemptSha256,
    async writeExecutionManifest(value) {
      assertActiveLedger(ledger);
      const manifest =
        parseReviewPlannerV14ProductAcceptanceExecutionManifest(value);
      if (
        state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      const directory = await openWindowsNoReparseFrozenDirectory(
        state.repoRoot,
        [
          ...REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
            state.environment,
          ),
        ],
      );
      try {
        directory.assertLocalFixedNtfsVolume();
        if (directory.listLeafNames().length !== 0) {
          throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
        }
        directory.createExclusiveDurableFile(
          EXECUTION_MANIFEST_LEAF,
          `${JSON.stringify(manifest)}\n`,
        );
        state.executionWritten = true;
      } finally {
        directory.close();
      }
    },
    writeManifest(value) {
      assertActiveLedger(ledger);
      const manifest = parseReviewPlannerV14ProductAcceptanceManifest(value);
      if (
        !state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      if (state.directory.listLeafNames().length !== 1) {
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
      }
      state.directory.createExclusiveDurableFile(
        MANIFEST_LEAF,
        `${JSON.stringify(manifest)}\n`,
      );
    },
    claimSlot(slot) {
      assertActiveLedger(ledger);
      if (state.finalized || state.claimedSlots.has(slot)) {
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      state.claimedSlots.add(slot);
    },
    recordSlotResult(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV14ProductAcceptanceSlotResult(value);
      if (
        !state.claimedSlots.has(record.slot) ||
        state.slotResults.has(record.slot) ||
        state.finalized
      )
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `slot-${record.slot}.json`, record);
      state.slotResults.add(record.slot);
    },
    recordDefaultOff(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV14ProductAcceptanceDefaultOff(value);
      if (state.defaultOff.has(record.component) || state.finalized)
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `default-off-${record.component}.json`, record);
      state.defaultOff.add(record.component);
    },
    recordOwnerIsolation(value) {
      assertActiveLedger(ledger);
      const record =
        parseReviewPlannerV14ProductAcceptanceOwnerIsolation(value);
      if (state.ownerIsolationWritten || state.finalized)
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, OWNER_ISOLATION_LEAF, record);
      state.ownerIsolationWritten = true;
    },
    recordCleanup(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV14ProductAcceptanceCleanup(value);
      if (state.cleanupWritten || state.finalized)
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, CLEANUP_LEAF, record);
      state.cleanupWritten = true;
    },
    finalizeSuccess(value) {
      assertActiveLedger(ledger);
      const aggregate = parseReviewPlannerV14ProductAcceptanceAggregate(value);
      if (
        state.finalized ||
        state.slotResults.size !== 4 ||
        state.defaultOff.size !== 2 ||
        !state.ownerIsolationWritten ||
        !state.cleanupWritten ||
        aggregate.environment !== state.environment ||
        aggregate.attemptSha256 !== state.attemptSha256
      )
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, AGGREGATE_LEAF, aggregate);
      writePublicRecord(
        state,
        SUCCESS_LEAF,
        parseReviewPlannerV14ProductAcceptanceSuccess({
          schemaVersion:
            REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
          environment: state.environment,
          attemptSha256: state.attemptSha256,
        }),
      );
      state.finalized = true;
      return Promise.resolve();
    },
    recordFailure(value) {
      assertActiveLedger(ledger);
      const failure = parseReviewPlannerV14ProductAcceptanceFailure(value);
      if (
        state.finalized ||
        state.failureWritten ||
        failure.environment !== state.environment
      ) {
        throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      writePublicRecord(state, FAILURE_LEAF, failure);
      state.failureWritten = true;
    },
    close() {
      if (state.closed) return;
      state.closed = true;
      try {
        state.reservationGuard.close();
      } finally {
        state.directory.close();
      }
    },
  });
  ledgerState.set(ledger, state);
  return ledger;
}

function assertActiveLedger(ledger: ReviewPlannerV14ProductAcceptanceLedger) {
  const state = ledgerState.get(ledger);
  if (!state || state.closed) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  }
  assertReviewPlannerV14ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
  ]);
}

function writePublicRecord(state: LedgerState, leaf: string, value: object) {
  if (
    !state.executionWritten ||
    !state.directory.listLeafNames().includes(MANIFEST_LEAF)
  ) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  state.directory.createExclusiveDurableFile(
    leaf,
    `${JSON.stringify(value)}\n`,
  );
}

function hasOnlyV14PublicLeaves(leaves: readonly string[]) {
  const required = new Set([
    RESERVATION_LEAF,
    MANIFEST_LEAF,
    OWNER_ISOLATION_LEAF,
    CLEANUP_LEAF,
    AGGREGATE_LEAF,
    SUCCESS_LEAF,
    FAILURE_LEAF,
    RECOVERY_LEAF,
  ]);
  return leaves.every(
    (leaf) =>
      required.has(leaf) || SLOT_LEAF.test(leaf) || DEFAULT_OFF_LEAF.test(leaf),
  );
}

function readReservationHash(
  directory: WindowsNoReparseChildDirectory,
): string {
  const raw = directory.readRegularFile(RESERVATION_LEAF).toString();
  if (!ATTEMPT_HASH.test(raw.trim()) || raw !== `${raw.trim()}\n`) {
    throw new Error('V14_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
  }
  return raw.trim();
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isEnvironment(
  value: unknown,
): value is ReviewPlannerProductAcceptanceEnvironment {
  return value === 'branch' || value === 'main';
}
