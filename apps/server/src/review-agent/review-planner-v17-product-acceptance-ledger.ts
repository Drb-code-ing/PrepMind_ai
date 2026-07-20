import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { buildReviewPlannerV8DefaultOffEnvironment } from './review-planner-v8-product-acceptance-composition';
import {
  assertReviewPlannerV17ProductAcceptanceOwner,
  bindReviewPlannerV17ProductAcceptanceAttempt,
  inspectReviewPlannerV17ProductAcceptanceRecoveryCheckpoint,
  readReviewPlannerV17ProductAcceptanceAttemptBinding,
  registerReviewPlannerV17ProductAcceptanceOwnerAttempt,
  type ReviewPlannerV17ProductAcceptanceOwner,
} from './review-planner-v17-product-acceptance-recovery';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE,
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
const ATTEMPT_BINDING_LEAF = 'attempt-binding.json';
const OWNER_LOCK_LEAF = 'owner.lock';
const SLOT_LEAF = /^slot-(review|planner)-(api|browser)\.json$/;
const DEFAULT_OFF_LEAF = /^default-off-(review|planner)\.json$/;
const V17_DEFAULT_OFF_BASE_URLS = [
  'https://api.deepseek.com',
  'https://api.deepseek.com/v1',
] as const;

export const reviewPlannerV17ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict();

const v17ExecutionSelector = (
  kind: 'account' | 'fixture',
  component: 'review' | 'planner',
) =>
  z
    .string()
    .regex(new RegExp(`^v17-synthetic-${kind}-${component}-[a-f0-9]{32}$`));

export const reviewPlannerV17ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    databaseUrlSha256: z.string().regex(ATTEMPT_HASH),
    resources: z
      .object({
        accountId: z
          .object({
            review: v17ExecutionSelector('account', 'review'),
            planner: v17ExecutionSelector('account', 'planner'),
          })
          .strict(),
        fixtureId: z
          .object({
            review: v17ExecutionSelector('fixture', 'review'),
            planner: v17ExecutionSelector('fixture', 'planner'),
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
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        value.environment,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'V17 profile mismatch' });
    }
  });

const v17SlotSchema = z.enum([
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
]);
const v17ComponentSchema = z.enum(['review', 'planner']);
const v17HashSchema = z.string().regex(ATTEMPT_HASH);

export const reviewPlannerV17ProductAcceptanceSlotResultSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
    ),
    slot: v17SlotSchema,
    traceSha256: v17HashSchema,
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    model: z.enum(['deepseek-v4-flash', 'deepseek-v4-pro']),
    baseUrl: z.enum(V17_DEFAULT_OFF_BASE_URLS),
    component: v17ComponentSchema,
    container: z
      .object({
        previousIdSha256: v17HashSchema,
        newIdSha256: v17HashSchema,
      })
      .strict(),
    inspected: z
      .object({
        aiProviderMode: z.literal('mock'),
        liveCallsEnabled: z.literal(false),
        reviewAgentModelEnabled: z.literal(false),
        plannerAgentModelEnabled: z.literal(false),
        acceptanceEnabled: z.literal(false),
        acceptanceComponent: z.literal(''),
        capabilitySha256: z.literal(''),
        maxRequests: z.literal(0),
        deepseekCredentialPresent: z.literal(false),
        openaiCredentialPresent: z.literal(false),
      })
      .strict(),
    binding: z
      .object({
        port: z.literal(3001),
        healthContainerIdSha256: v17HashSchema,
      })
      .strict(),
    deterministicProbe: z
      .object({
        passed: z.literal(true),
        provenance: z.literal('local_deterministic'),
      })
      .strict(),
    providerInvocations: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.container.previousIdSha256 === value.container.newIdSha256 ||
      value.binding.healthContainerIdSha256 !== value.container.newIdSha256
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V17_DEFAULT_OFF_CONTAINER_BINDING_INVALID',
      });
    }
  });

export function assertReviewPlannerV17DefaultOffEnvironment(
  entries: readonly string[],
) {
  const expected = buildReviewPlannerV8DefaultOffEnvironment();
  const controlledKeys = new Set(Object.keys(expected));
  const seen = new Set<string>();
  const environment = new Map<string, string>();

  for (const entry of entries) {
    const separator = entry.indexOf('=');
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (controlledKeys.has(key)) {
      if (seen.has(key)) throw new Error('V17_DEFAULT_OFF_ENVIRONMENT_INVALID');
      seen.add(key);
    }
    environment.set(key, value);
  }

  const model = environment.get('AI_MODEL');
  if (model !== 'deepseek-v4-flash' && model !== 'deepseek-v4-pro') {
    throw new Error('V17_DEFAULT_OFF_ENVIRONMENT_INVALID');
  }
  const baseUrl = environment.get('AI_BASE_URL');
  if (!V17_DEFAULT_OFF_BASE_URLS.some((allowed) => allowed === baseUrl)) {
    throw new Error('V17_DEFAULT_OFF_ENVIRONMENT_INVALID');
  }
  for (const [key, value] of Object.entries(expected)) {
    const expectedValue =
      key === 'AI_MODEL' ? model : key === 'AI_BASE_URL' ? baseUrl : value;
    if (environment.get(key) !== expectedValue) {
      throw new Error('V17_DEFAULT_OFF_ENVIRONMENT_INVALID');
    }
  }
}

export const reviewPlannerV17ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
    traceSha256: z.array(v17HashSchema).length(4),
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v17HashSchema,
    requests: z.literal(4),
    durationMs: z.number().int().positive().max(240_000),
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v17HashSchema,
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceFailureSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v17HashSchema,
    component: v17ComponentSchema,
    slot: z.enum(['api', 'browser']),
    checkpoint: z.string().regex(/^(review|planner)_(api|browser)_[a-z_]+$/),
    terminal: z.literal('operation_failed'),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict();

export const reviewPlannerV17ProductAcceptanceRecoverySchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    terminal: z.literal('recovered'),
  })
  .strict();

export type ReviewPlannerV17ProductAcceptanceManifest = z.infer<
  typeof reviewPlannerV17ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV17ProductAcceptanceExecutionManifest = z.infer<
  typeof reviewPlannerV17ProductAcceptanceExecutionManifestSchema
>;
export type ReviewPlannerV17ProductAcceptanceSlotResult = z.infer<
  typeof reviewPlannerV17ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV17ProductAcceptanceDefaultOff = z.infer<
  typeof reviewPlannerV17ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV17ProductAcceptanceOwnerIsolation = z.infer<
  typeof reviewPlannerV17ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV17ProductAcceptanceCleanup = z.infer<
  typeof reviewPlannerV17ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV17ProductAcceptanceAggregate = z.infer<
  typeof reviewPlannerV17ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV17ProductAcceptanceSuccess = z.infer<
  typeof reviewPlannerV17ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV17ProductAcceptanceFailure = z.infer<
  typeof reviewPlannerV17ProductAcceptanceFailureSchema
>;
export type ReviewPlannerV17ProductAcceptanceRecovery = z.infer<
  typeof reviewPlannerV17ProductAcceptanceRecoverySchema
>;

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  owner: ReviewPlannerV17ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  executionWritten: boolean;
  claimedSlots: Set<ReviewPlannerV17ProductAcceptanceSlotResult['slot']>;
  slotResults: Set<ReviewPlannerV17ProductAcceptanceSlotResult['slot']>;
  defaultOff: Set<ReviewPlannerV17ProductAcceptanceDefaultOff['component']>;
  ownerIsolationWritten: boolean;
  cleanupWritten: boolean;
  failureWritten: boolean;
  finalized: boolean;
  closed: boolean;
};

export type ReviewPlannerV17ProductAcceptanceLedger = Readonly<{
  attemptSha256(): string;
  writeExecutionManifest(value: unknown): Promise<void>;
  writeManifest(value: unknown): void;
  rollbackUnstartedReservation(): Promise<void>;
  claimSlot(slot: ReviewPlannerV17ProductAcceptanceSlotResult['slot']): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(value: unknown): Promise<void>;
  recordFailure(value: unknown): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV17ProductAcceptanceLedger,
  LedgerState
>();

export async function reserveReviewPlannerV17ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV17ProductAcceptanceOwner;
}): Promise<ReviewPlannerV17ProductAcceptanceLedger> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV17ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    const repoRoot = resolve(input.repoRoot);
    directory = await openWindowsNoReparseFrozenDirectory(repoRoot, [
      ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    const attemptId = randomBytes(32).toString('hex');
    const attemptSha256 = sha256(attemptId);
    directory.createExclusiveDurableFile(
      RESERVATION_LEAF,
      `${attemptSha256}\n`,
    );
    const binding = await bindReviewPlannerV17ProductAcceptanceAttempt({
      repoRoot,
      environment: input.environment,
      owner: input.owner,
      attemptId,
    });
    if (binding.attemptSha256 !== attemptSha256) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    reservationGuard =
      directory.tryAcquireExclusiveLifetimeFile(RESERVATION_LEAF);
    if (reservationGuard === null) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    registerReviewPlannerV17ProductAcceptanceOwnerAttempt(
      input.owner,
      input.environment,
      attemptSha256,
    );
    const ledger = createV17Ledger({
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
      /^V17_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V17_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV17ProductAcceptanceLedger(input: {
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
    REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath(
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
        ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      !hasOnlyV17PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF)
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV17ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV17ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV17ProductAcceptanceExecutionManifest(input);
    if (
      binding.attemptSha256 !== attemptSha256 ||
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== attemptSha256 ||
      execution.environment !== input.environment ||
      execution.attemptSha256 !== attemptSha256
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    await inspectReviewPlannerV17ProductAcceptanceRecoveryCheckpoint(input);
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
      const failure = parseReviewPlannerV17ProductAcceptanceFailure(
        JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
      );
      const checkpoint =
        await inspectReviewPlannerV17ProductAcceptanceRecoveryCheckpoint(input);
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
        const recovery = parseReviewPlannerV17ProductAcceptanceRecovery(
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
      const record = parseReviewPlannerV17ProductAcceptanceSlotResult(
        JSON.parse(directory.readRegularFile(`slot-${slot}.json`).toString()),
      );
      if (record.slot !== slot)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    for (const component of ['review', 'planner'] as const) {
      const record = parseReviewPlannerV17ProductAcceptanceDefaultOff(
        JSON.parse(
          directory.readRegularFile(`default-off-${component}.json`).toString(),
        ),
      );
      if (record.component !== component)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    parseReviewPlannerV17ProductAcceptanceOwnerIsolation(
      JSON.parse(directory.readRegularFile(OWNER_ISOLATION_LEAF).toString()),
    );
    parseReviewPlannerV17ProductAcceptanceCleanup(
      JSON.parse(directory.readRegularFile(CLEANUP_LEAF).toString()),
    );
    const aggregate = parseReviewPlannerV17ProductAcceptanceAggregate(
      JSON.parse(directory.readRegularFile(AGGREGATE_LEAF).toString()),
    );
    const success = parseReviewPlannerV17ProductAcceptanceSuccess(
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

export async function readReviewPlannerV17ProductAcceptanceExecutionManifest(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV17ProductAcceptanceExecutionManifest> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
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
    return parseReviewPlannerV17ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
  } catch {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function parseReviewPlannerV17ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceManifest {
  const parsed =
    reviewPlannerV17ProductAcceptanceManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function parseReviewPlannerV17ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceExecutionManifest {
  const parsed =
    reviewPlannerV17ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function createReviewPlannerV17ProductAcceptanceExecutionManifest(input: {
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  databaseUrlSha256: string;
}): ReviewPlannerV17ProductAcceptanceExecutionManifest {
  if (
    !isEnvironment(input.environment) ||
    !ATTEMPT_HASH.test(input.attemptSha256) ||
    !ATTEMPT_HASH.test(input.databaseUrlSha256)
  ) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  const selector = () => randomBytes(16).toString('hex');
  return parseReviewPlannerV17ProductAcceptanceExecutionManifest({
    schemaVersion:
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    environment: input.environment,
    attemptSha256: input.attemptSha256,
    databaseUrlSha256: input.databaseUrlSha256,
    resources: {
      accountId: {
        review: `v17-synthetic-account-review-${selector()}`,
        planner: `v17-synthetic-account-planner-${selector()}`,
      },
      fixtureId: {
        review: `v17-synthetic-fixture-review-${selector()}`,
        planner: `v17-synthetic-fixture-planner-${selector()}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            input.environment,
          ),
      },
    },
  });
}

export function parseReviewPlannerV17ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceSlotResult {
  return parseV17Record(
    reviewPlannerV17ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV17ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceDefaultOff {
  return parseV17Record(
    reviewPlannerV17ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV17ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceOwnerIsolation {
  return parseV17Record(
    reviewPlannerV17ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV17ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceCleanup {
  return parseV17Record(reviewPlannerV17ProductAcceptanceCleanupSchema, value);
}

export function parseReviewPlannerV17ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceAggregate {
  return parseV17Record(
    reviewPlannerV17ProductAcceptanceAggregateSchema,
    value,
  );
}

export function parseReviewPlannerV17ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceSuccess {
  return parseV17Record(reviewPlannerV17ProductAcceptanceSuccessSchema, value);
}

export function parseReviewPlannerV17ProductAcceptanceFailure(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceFailure {
  return parseV17Record(reviewPlannerV17ProductAcceptanceFailureSchema, value);
}

export function parseReviewPlannerV17ProductAcceptanceRecovery(
  value: unknown,
): ReviewPlannerV17ProductAcceptanceRecovery {
  return parseV17Record(reviewPlannerV17ProductAcceptanceRecoverySchema, value);
}

export async function finalizeReviewPlannerV17ProductAcceptanceRecovery(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV17ProductAcceptanceOwner;
}): Promise<void> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
  }
  assertReviewPlannerV17ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      !hasOnlyV17PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF) ||
      !leaves.includes(FAILURE_LEAF) ||
      leaves.includes(SUCCESS_LEAF) ||
      leaves.includes(RECOVERY_LEAF)
    ) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV17ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV17ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV17ProductAcceptanceExecutionManifest(input);
    const failure = parseReviewPlannerV17ProductAcceptanceFailure(
      JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
    );
    const checkpoint =
      await inspectReviewPlannerV17ProductAcceptanceRecoveryCheckpoint(input);
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
      throw new Error('V17_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    directory.createExclusiveDurableFile(
      RECOVERY_LEAF,
      `${JSON.stringify(
        parseReviewPlannerV17ProductAcceptanceRecovery({
          schemaVersion:
            REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
          environment: input.environment,
          attemptSha256,
          terminal: 'recovered',
        }),
      )}\n`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'V17_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED'
    ) {
      throw error;
    }
    throw new Error('V17_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory?.close();
  }
}

function parseV17Record<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function createV17Ledger(
  state: LedgerState,
): ReviewPlannerV17ProductAcceptanceLedger {
  const ledger: ReviewPlannerV17ProductAcceptanceLedger = Object.freeze({
    attemptSha256: () => state.attemptSha256,
    async writeExecutionManifest(value) {
      assertActiveLedger(ledger);
      const manifest =
        parseReviewPlannerV17ProductAcceptanceExecutionManifest(value);
      if (
        state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      const directory = await openWindowsNoReparseFrozenDirectory(
        state.repoRoot,
        [
          ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
            state.environment,
          ),
        ],
      );
      try {
        directory.assertLocalFixedNtfsVolume();
        if (directory.listLeafNames().length !== 0) {
          throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
      const manifest = parseReviewPlannerV17ProductAcceptanceManifest(value);
      if (
        !state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      if (state.directory.listLeafNames().length !== 1) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
      }
      state.directory.createExclusiveDurableFile(
        MANIFEST_LEAF,
        `${JSON.stringify(manifest)}\n`,
      );
    },
    async rollbackUnstartedReservation() {
      assertActiveLedger(ledger);
      if (
        state.claimedSlots.size !== 0 ||
        state.slotResults.size !== 0 ||
        state.defaultOff.size !== 0 ||
        state.ownerIsolationWritten ||
        state.cleanupWritten ||
        state.failureWritten ||
        state.finalized
      ) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      const publicLeaves = state.directory.listLeafNames();
      if (
        !publicLeaves.includes(RESERVATION_LEAF) ||
        !publicLeaves.every(
          (leaf) => leaf === RESERVATION_LEAF || leaf === MANIFEST_LEAF,
        )
      ) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      state.reservationGuard.close();
      const binding = await readReviewPlannerV17ProductAcceptanceAttemptBinding(
        {
          repoRoot: state.repoRoot,
          environment: state.environment,
        },
      );
      if (binding.attemptSha256 !== state.attemptSha256) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      if (publicLeaves.includes(MANIFEST_LEAF)) {
        const manifest = parseReviewPlannerV17ProductAcceptanceManifest(
          JSON.parse(state.directory.readRegularFile(MANIFEST_LEAF).toString()),
        );
        if (
          manifest.environment !== state.environment ||
          manifest.attemptSha256 !== state.attemptSha256
        ) {
          throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
        }
      }
      await assertV17UnstartedRecoveryState(state);
      await deleteV17UnstartedExecutionManifest(state);

      if (publicLeaves.includes(MANIFEST_LEAF)) {
        state.directory.deleteFile(MANIFEST_LEAF);
      }
      const recoveryDirectory =
        await openWindowsNoReparseExistingFrozenDirectory(state.repoRoot, [
          ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
            state.environment,
          ),
        ]);
      try {
        recoveryDirectory.assertLocalFixedNtfsVolume();
        const recoveryLeaves = recoveryDirectory.listLeafNames();
        if (
          recoveryLeaves.length !== 2 ||
          !recoveryLeaves.includes(OWNER_LOCK_LEAF) ||
          !recoveryLeaves.includes(ATTEMPT_BINDING_LEAF)
        ) {
          throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
        }
        recoveryDirectory.deleteFile(ATTEMPT_BINDING_LEAF);
      } finally {
        recoveryDirectory.close();
      }
      state.directory.deleteFile(RESERVATION_LEAF);
      if (state.directory.listLeafNames().length !== 0) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_EVIDENCE_IO');
      }
      state.closed = true;
      state.directory.close();
    },
    claimSlot(slot) {
      assertActiveLedger(ledger);
      if (state.finalized || state.claimedSlots.has(slot)) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      state.claimedSlots.add(slot);
    },
    recordSlotResult(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV17ProductAcceptanceSlotResult(value);
      if (
        !state.claimedSlots.has(record.slot) ||
        state.slotResults.has(record.slot) ||
        state.finalized
      )
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `slot-${record.slot}.json`, record);
      state.slotResults.add(record.slot);
    },
    recordDefaultOff(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV17ProductAcceptanceDefaultOff(value);
      if (state.defaultOff.has(record.component) || state.finalized)
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `default-off-${record.component}.json`, record);
      state.defaultOff.add(record.component);
    },
    recordOwnerIsolation(value) {
      assertActiveLedger(ledger);
      const record =
        parseReviewPlannerV17ProductAcceptanceOwnerIsolation(value);
      if (state.ownerIsolationWritten || state.finalized)
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, OWNER_ISOLATION_LEAF, record);
      state.ownerIsolationWritten = true;
    },
    recordCleanup(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV17ProductAcceptanceCleanup(value);
      if (state.cleanupWritten || state.finalized)
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, CLEANUP_LEAF, record);
      state.cleanupWritten = true;
    },
    finalizeSuccess(value) {
      assertActiveLedger(ledger);
      const aggregate = parseReviewPlannerV17ProductAcceptanceAggregate(value);
      if (
        state.finalized ||
        state.failureWritten ||
        state.slotResults.size !== 4 ||
        state.defaultOff.size !== 2 ||
        !state.ownerIsolationWritten ||
        !state.cleanupWritten ||
        aggregate.environment !== state.environment ||
        aggregate.attemptSha256 !== state.attemptSha256
      )
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, AGGREGATE_LEAF, aggregate);
      writePublicRecord(
        state,
        SUCCESS_LEAF,
        parseReviewPlannerV17ProductAcceptanceSuccess({
          schemaVersion:
            REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
          environment: state.environment,
          attemptSha256: state.attemptSha256,
        }),
      );
      state.finalized = true;
      return Promise.resolve();
    },
    recordFailure(value) {
      assertActiveLedger(ledger);
      const failure = parseReviewPlannerV17ProductAcceptanceFailure(value);
      if (
        state.finalized ||
        state.failureWritten ||
        failure.environment !== state.environment ||
        failure.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
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

function assertActiveLedger(ledger: ReviewPlannerV17ProductAcceptanceLedger) {
  const state = ledgerState.get(ledger);
  if (!state || state.closed) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  }
  assertReviewPlannerV17ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
  ]);
}

function writePublicRecord(state: LedgerState, leaf: string, value: object) {
  if (
    !state.executionWritten ||
    !state.directory.listLeafNames().includes(MANIFEST_LEAF)
  ) {
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  state.directory.createExclusiveDurableFile(
    leaf,
    `${JSON.stringify(value)}\n`,
  );
}

async function assertV17UnstartedRecoveryState(state: LedgerState) {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    state.repoRoot,
    [
      ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        state.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      leaves.length !== 2 ||
      !leaves.includes(OWNER_LOCK_LEAF) ||
      !leaves.includes(ATTEMPT_BINDING_LEAF)
    ) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
  } finally {
    directory.close();
  }
}

async function deleteV17UnstartedExecutionManifest(state: LedgerState) {
  const path = resolve(
    state.repoRoot,
    ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
      state.environment,
    ),
  );
  if (!existsSync(path)) {
    if (state.executionWritten) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    return;
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    state.repoRoot,
    [
      ...REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
        state.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0 && !state.executionWritten) return;
    if (leaves.length !== 1 || leaves[0] !== EXECUTION_MANIFEST_LEAF) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    const manifest = parseReviewPlannerV17ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
    if (
      manifest.environment !== state.environment ||
      manifest.attemptSha256 !== state.attemptSha256
    ) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    directory.deleteFile(EXECUTION_MANIFEST_LEAF);
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V17_PRODUCT_ACCEPTANCE_ROLLBACK_EVIDENCE_IO');
    }
  } finally {
    directory.close();
  }
}

function hasOnlyV17PublicLeaves(leaves: readonly string[]) {
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
    throw new Error('V17_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
