import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { buildReviewPlannerV8DefaultOffEnvironment } from './review-planner-v8-product-acceptance-composition';
import {
  assertReviewPlannerV22ProductAcceptanceOwner,
  bindReviewPlannerV22ProductAcceptanceAttempt,
  inspectReviewPlannerV22ProductAcceptanceRecoveryCheckpoint,
  readReviewPlannerV22ProductAcceptanceAttemptBinding,
  registerReviewPlannerV22ProductAcceptanceOwnerAttempt,
  type ReviewPlannerV22ProductAcceptanceOwner,
} from './review-planner-v22-product-acceptance-recovery';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE,
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
const V22_DEFAULT_OFF_BASE_URLS = [
  'https://api.deepseek.com',
  'https://api.deepseek.com/v1',
] as const;

export const reviewPlannerV22ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict();

const v22ExecutionSelector = (
  kind: 'account' | 'fixture',
  component: 'review' | 'planner',
) =>
  z
    .string()
    .regex(new RegExp(`^v22-synthetic-${kind}-${component}-[a-f0-9]{32}$`));

export const reviewPlannerV22ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    databaseUrlSha256: z.string().regex(ATTEMPT_HASH),
    resources: z
      .object({
        accountId: z
          .object({
            review: v22ExecutionSelector('account', 'review'),
            planner: v22ExecutionSelector('account', 'planner'),
          })
          .strict(),
        fixtureId: z
          .object({
            review: v22ExecutionSelector('fixture', 'review'),
            planner: v22ExecutionSelector('fixture', 'planner'),
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
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        value.environment,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'V22 profile mismatch' });
    }
  });

const v22SlotSchema = z.enum([
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
]);
const v22ComponentSchema = z.enum(['review', 'planner']);
const v22HashSchema = z.string().regex(ATTEMPT_HASH);

export const reviewPlannerV22ProductAcceptanceSlotResultSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
    ),
    slot: v22SlotSchema,
    traceSha256: v22HashSchema,
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    model: z.enum(['deepseek-v4-flash', 'deepseek-v4-pro']),
    baseUrl: z.enum(V22_DEFAULT_OFF_BASE_URLS),
    component: v22ComponentSchema,
    container: z
      .object({
        previousIdSha256: v22HashSchema,
        newIdSha256: v22HashSchema,
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
        healthContainerIdSha256: v22HashSchema,
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
        message: 'V22_DEFAULT_OFF_CONTAINER_BINDING_INVALID',
      });
    }
  });

export function assertReviewPlannerV22DefaultOffEnvironment(
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
      if (seen.has(key)) throw new Error('V22_DEFAULT_OFF_ENVIRONMENT_INVALID');
      seen.add(key);
    }
    environment.set(key, value);
  }

  const model = environment.get('AI_MODEL');
  if (model !== 'deepseek-v4-flash' && model !== 'deepseek-v4-pro') {
    throw new Error('V22_DEFAULT_OFF_ENVIRONMENT_INVALID');
  }
  const baseUrl = environment.get('AI_BASE_URL');
  if (!V22_DEFAULT_OFF_BASE_URLS.some((allowed) => allowed === baseUrl)) {
    throw new Error('V22_DEFAULT_OFF_ENVIRONMENT_INVALID');
  }
  for (const [key, value] of Object.entries(expected)) {
    const expectedValue =
      key === 'AI_MODEL' ? model : key === 'AI_BASE_URL' ? baseUrl : value;
    if (environment.get(key) !== expectedValue) {
      throw new Error('V22_DEFAULT_OFF_ENVIRONMENT_INVALID');
    }
  }
}

export const reviewPlannerV22ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
    traceSha256: z.array(v22HashSchema).length(4),
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v22HashSchema,
    requests: z.literal(4),
    durationMs: z.number().int().positive().max(240_000),
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v22HashSchema,
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceFailureSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v22HashSchema,
    component: v22ComponentSchema,
    slot: z.enum(['api', 'browser']),
    checkpoint: z.string().regex(/^(review|planner)_(api|browser)_[a-z_]+$/),
    terminal: z.literal('operation_failed'),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict();

export const reviewPlannerV22ProductAcceptanceRecoverySchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
    terminal: z.literal('recovered'),
  })
  .strict();

export type ReviewPlannerV22ProductAcceptanceManifest = z.infer<
  typeof reviewPlannerV22ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV22ProductAcceptanceExecutionManifest = z.infer<
  typeof reviewPlannerV22ProductAcceptanceExecutionManifestSchema
>;
export type ReviewPlannerV22ProductAcceptanceSlotResult = z.infer<
  typeof reviewPlannerV22ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV22ProductAcceptanceDefaultOff = z.infer<
  typeof reviewPlannerV22ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV22ProductAcceptanceOwnerIsolation = z.infer<
  typeof reviewPlannerV22ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV22ProductAcceptanceCleanup = z.infer<
  typeof reviewPlannerV22ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV22ProductAcceptanceAggregate = z.infer<
  typeof reviewPlannerV22ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV22ProductAcceptanceSuccess = z.infer<
  typeof reviewPlannerV22ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV22ProductAcceptanceFailure = z.infer<
  typeof reviewPlannerV22ProductAcceptanceFailureSchema
>;
export type ReviewPlannerV22ProductAcceptanceRecovery = z.infer<
  typeof reviewPlannerV22ProductAcceptanceRecoverySchema
>;

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  owner: ReviewPlannerV22ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  executionWritten: boolean;
  claimedSlots: Set<ReviewPlannerV22ProductAcceptanceSlotResult['slot']>;
  slotResults: Set<ReviewPlannerV22ProductAcceptanceSlotResult['slot']>;
  defaultOff: Set<ReviewPlannerV22ProductAcceptanceDefaultOff['component']>;
  ownerIsolationWritten: boolean;
  cleanupWritten: boolean;
  failureWritten: boolean;
  finalized: boolean;
  closed: boolean;
};

export type ReviewPlannerV22ProductAcceptanceLedger = Readonly<{
  attemptSha256(): string;
  writeExecutionManifest(value: unknown): Promise<void>;
  writeManifest(value: unknown): void;
  rollbackUnstartedReservation(): Promise<void>;
  claimSlot(slot: ReviewPlannerV22ProductAcceptanceSlotResult['slot']): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(value: unknown): Promise<void>;
  recordFailure(value: unknown): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV22ProductAcceptanceLedger,
  LedgerState
>();

export async function reserveReviewPlannerV22ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV22ProductAcceptanceOwner;
}): Promise<ReviewPlannerV22ProductAcceptanceLedger> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV22ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    const repoRoot = resolve(input.repoRoot);
    directory = await openWindowsNoReparseFrozenDirectory(repoRoot, [
      ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    const attemptId = randomBytes(32).toString('hex');
    const attemptSha256 = sha256(attemptId);
    directory.createExclusiveDurableFile(
      RESERVATION_LEAF,
      `${attemptSha256}\n`,
    );
    const binding = await bindReviewPlannerV22ProductAcceptanceAttempt({
      repoRoot,
      environment: input.environment,
      owner: input.owner,
      attemptId,
    });
    if (binding.attemptSha256 !== attemptSha256) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    reservationGuard =
      directory.tryAcquireExclusiveLifetimeFile(RESERVATION_LEAF);
    if (reservationGuard === null) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    registerReviewPlannerV22ProductAcceptanceOwnerAttempt(
      input.owner,
      input.environment,
      attemptSha256,
    );
    const ledger = createV22Ledger({
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
      /^V22_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V22_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV22ProductAcceptanceLedger(input: {
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
    REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath(
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
        ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      !hasOnlyV22PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF)
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV22ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV22ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV22ProductAcceptanceExecutionManifest(input);
    if (
      binding.attemptSha256 !== attemptSha256 ||
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== attemptSha256 ||
      execution.environment !== input.environment ||
      execution.attemptSha256 !== attemptSha256
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    await inspectReviewPlannerV22ProductAcceptanceRecoveryCheckpoint(input);
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
      const failure = parseReviewPlannerV22ProductAcceptanceFailure(
        JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
      );
      const checkpoint =
        await inspectReviewPlannerV22ProductAcceptanceRecoveryCheckpoint(input);
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
        const recovery = parseReviewPlannerV22ProductAcceptanceRecovery(
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
      const record = parseReviewPlannerV22ProductAcceptanceSlotResult(
        JSON.parse(directory.readRegularFile(`slot-${slot}.json`).toString()),
      );
      if (record.slot !== slot)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    for (const component of ['review', 'planner'] as const) {
      const record = parseReviewPlannerV22ProductAcceptanceDefaultOff(
        JSON.parse(
          directory.readRegularFile(`default-off-${component}.json`).toString(),
        ),
      );
      if (record.component !== component)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    parseReviewPlannerV22ProductAcceptanceOwnerIsolation(
      JSON.parse(directory.readRegularFile(OWNER_ISOLATION_LEAF).toString()),
    );
    parseReviewPlannerV22ProductAcceptanceCleanup(
      JSON.parse(directory.readRegularFile(CLEANUP_LEAF).toString()),
    );
    const aggregate = parseReviewPlannerV22ProductAcceptanceAggregate(
      JSON.parse(directory.readRegularFile(AGGREGATE_LEAF).toString()),
    );
    const success = parseReviewPlannerV22ProductAcceptanceSuccess(
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

export async function readReviewPlannerV22ProductAcceptanceExecutionManifest(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV22ProductAcceptanceExecutionManifest> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
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
    return parseReviewPlannerV22ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
  } catch {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function parseReviewPlannerV22ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceManifest {
  const parsed =
    reviewPlannerV22ProductAcceptanceManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function parseReviewPlannerV22ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceExecutionManifest {
  const parsed =
    reviewPlannerV22ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function createReviewPlannerV22ProductAcceptanceExecutionManifest(input: {
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  databaseUrlSha256: string;
}): ReviewPlannerV22ProductAcceptanceExecutionManifest {
  if (
    !isEnvironment(input.environment) ||
    !ATTEMPT_HASH.test(input.attemptSha256) ||
    !ATTEMPT_HASH.test(input.databaseUrlSha256)
  ) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  const selector = () => randomBytes(16).toString('hex');
  return parseReviewPlannerV22ProductAcceptanceExecutionManifest({
    schemaVersion:
      REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    environment: input.environment,
    attemptSha256: input.attemptSha256,
    databaseUrlSha256: input.databaseUrlSha256,
    resources: {
      accountId: {
        review: `v22-synthetic-account-review-${selector()}`,
        planner: `v22-synthetic-account-planner-${selector()}`,
      },
      fixtureId: {
        review: `v22-synthetic-fixture-review-${selector()}`,
        planner: `v22-synthetic-fixture-planner-${selector()}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            input.environment,
          ),
      },
    },
  });
}

export function parseReviewPlannerV22ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceSlotResult {
  return parseV22Record(
    reviewPlannerV22ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV22ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceDefaultOff {
  return parseV22Record(
    reviewPlannerV22ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV22ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceOwnerIsolation {
  return parseV22Record(
    reviewPlannerV22ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV22ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceCleanup {
  return parseV22Record(reviewPlannerV22ProductAcceptanceCleanupSchema, value);
}

export function parseReviewPlannerV22ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceAggregate {
  return parseV22Record(
    reviewPlannerV22ProductAcceptanceAggregateSchema,
    value,
  );
}

export function parseReviewPlannerV22ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceSuccess {
  return parseV22Record(reviewPlannerV22ProductAcceptanceSuccessSchema, value);
}

export function parseReviewPlannerV22ProductAcceptanceFailure(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceFailure {
  return parseV22Record(reviewPlannerV22ProductAcceptanceFailureSchema, value);
}

export function parseReviewPlannerV22ProductAcceptanceRecovery(
  value: unknown,
): ReviewPlannerV22ProductAcceptanceRecovery {
  return parseV22Record(reviewPlannerV22ProductAcceptanceRecoverySchema, value);
}

export async function finalizeReviewPlannerV22ProductAcceptanceRecovery(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV22ProductAcceptanceOwner;
}): Promise<void> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
  }
  assertReviewPlannerV22ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      !hasOnlyV22PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF) ||
      !leaves.includes(FAILURE_LEAF) ||
      leaves.includes(SUCCESS_LEAF) ||
      leaves.includes(RECOVERY_LEAF)
    ) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV22ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV22ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV22ProductAcceptanceExecutionManifest(input);
    const failure = parseReviewPlannerV22ProductAcceptanceFailure(
      JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
    );
    const checkpoint =
      await inspectReviewPlannerV22ProductAcceptanceRecoveryCheckpoint(input);
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
      throw new Error('V22_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    }
    directory.createExclusiveDurableFile(
      RECOVERY_LEAF,
      `${JSON.stringify(
        parseReviewPlannerV22ProductAcceptanceRecovery({
          schemaVersion:
            REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.recovery,
          environment: input.environment,
          attemptSha256,
          terminal: 'recovered',
        }),
      )}\n`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'V22_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED'
    ) {
      throw error;
    }
    throw new Error('V22_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory?.close();
  }
}

function parseV22Record<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function createV22Ledger(
  state: LedgerState,
): ReviewPlannerV22ProductAcceptanceLedger {
  const ledger: ReviewPlannerV22ProductAcceptanceLedger = Object.freeze({
    attemptSha256: () => state.attemptSha256,
    async writeExecutionManifest(value) {
      assertActiveLedger(ledger);
      const manifest =
        parseReviewPlannerV22ProductAcceptanceExecutionManifest(value);
      if (
        state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      const directory = await openWindowsNoReparseFrozenDirectory(
        state.repoRoot,
        [
          ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
            state.environment,
          ),
        ],
      );
      try {
        directory.assertLocalFixedNtfsVolume();
        if (directory.listLeafNames().length !== 0) {
          throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
      const manifest = parseReviewPlannerV22ProductAcceptanceManifest(value);
      if (
        !state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      if (state.directory.listLeafNames().length !== 1) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
        throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      const publicLeaves = state.directory.listLeafNames();
      if (
        !publicLeaves.includes(RESERVATION_LEAF) ||
        !publicLeaves.every(
          (leaf) => leaf === RESERVATION_LEAF || leaf === MANIFEST_LEAF,
        )
      ) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      state.reservationGuard.close();
      const binding = await readReviewPlannerV22ProductAcceptanceAttemptBinding(
        {
          repoRoot: state.repoRoot,
          environment: state.environment,
        },
      );
      if (binding.attemptSha256 !== state.attemptSha256) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
      }
      if (publicLeaves.includes(MANIFEST_LEAF)) {
        const manifest = parseReviewPlannerV22ProductAcceptanceManifest(
          JSON.parse(state.directory.readRegularFile(MANIFEST_LEAF).toString()),
        );
        if (
          manifest.environment !== state.environment ||
          manifest.attemptSha256 !== state.attemptSha256
        ) {
          throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
        }
      }
      await assertV22UnstartedRecoveryState(state);
      await deleteV22UnstartedExecutionManifest(state);

      if (publicLeaves.includes(MANIFEST_LEAF)) {
        state.directory.deleteFile(MANIFEST_LEAF);
      }
      const recoveryDirectory =
        await openWindowsNoReparseExistingFrozenDirectory(state.repoRoot, [
          ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
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
          throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
        }
        recoveryDirectory.deleteFile(ATTEMPT_BINDING_LEAF);
      } finally {
        recoveryDirectory.close();
      }
      state.directory.deleteFile(RESERVATION_LEAF);
      if (state.directory.listLeafNames().length !== 0) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_EVIDENCE_IO');
      }
      state.closed = true;
      state.directory.close();
    },
    claimSlot(slot) {
      assertActiveLedger(ledger);
      if (state.finalized || state.claimedSlots.has(slot)) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      state.claimedSlots.add(slot);
    },
    recordSlotResult(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV22ProductAcceptanceSlotResult(value);
      if (
        !state.claimedSlots.has(record.slot) ||
        state.slotResults.has(record.slot) ||
        state.finalized
      )
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `slot-${record.slot}.json`, record);
      state.slotResults.add(record.slot);
    },
    recordDefaultOff(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV22ProductAcceptanceDefaultOff(value);
      if (state.defaultOff.has(record.component) || state.finalized)
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `default-off-${record.component}.json`, record);
      state.defaultOff.add(record.component);
    },
    recordOwnerIsolation(value) {
      assertActiveLedger(ledger);
      const record =
        parseReviewPlannerV22ProductAcceptanceOwnerIsolation(value);
      if (state.ownerIsolationWritten || state.finalized)
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, OWNER_ISOLATION_LEAF, record);
      state.ownerIsolationWritten = true;
    },
    recordCleanup(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV22ProductAcceptanceCleanup(value);
      if (state.cleanupWritten || state.finalized)
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, CLEANUP_LEAF, record);
      state.cleanupWritten = true;
    },
    finalizeSuccess(value) {
      assertActiveLedger(ledger);
      const aggregate = parseReviewPlannerV22ProductAcceptanceAggregate(value);
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
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, AGGREGATE_LEAF, aggregate);
      writePublicRecord(
        state,
        SUCCESS_LEAF,
        parseReviewPlannerV22ProductAcceptanceSuccess({
          schemaVersion:
            REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
          environment: state.environment,
          attemptSha256: state.attemptSha256,
        }),
      );
      state.finalized = true;
      return Promise.resolve();
    },
    recordFailure(value) {
      assertActiveLedger(ledger);
      const failure = parseReviewPlannerV22ProductAcceptanceFailure(value);
      if (
        state.finalized ||
        state.failureWritten ||
        failure.environment !== state.environment ||
        failure.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
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

function assertActiveLedger(ledger: ReviewPlannerV22ProductAcceptanceLedger) {
  const state = ledgerState.get(ledger);
  if (!state || state.closed) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  }
  assertReviewPlannerV22ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
  ]);
}

function writePublicRecord(state: LedgerState, leaf: string, value: object) {
  if (
    !state.executionWritten ||
    !state.directory.listLeafNames().includes(MANIFEST_LEAF)
  ) {
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  state.directory.createExclusiveDurableFile(
    leaf,
    `${JSON.stringify(value)}\n`,
  );
}

async function assertV22UnstartedRecoveryState(state: LedgerState) {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    state.repoRoot,
    [
      ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
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
      throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
  } finally {
    directory.close();
  }
}

async function deleteV22UnstartedExecutionManifest(state: LedgerState) {
  const path = resolve(
    state.repoRoot,
    ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
      state.environment,
    ),
  );
  if (!existsSync(path)) {
    if (state.executionWritten) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    return;
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    state.repoRoot,
    [
      ...REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
        state.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0 && !state.executionWritten) return;
    if (leaves.length !== 1 || leaves[0] !== EXECUTION_MANIFEST_LEAF) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    const manifest = parseReviewPlannerV22ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
    if (
      manifest.environment !== state.environment ||
      manifest.attemptSha256 !== state.attemptSha256
    ) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_NOT_AUTHORIZED');
    }
    directory.deleteFile(EXECUTION_MANIFEST_LEAF);
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V22_PRODUCT_ACCEPTANCE_ROLLBACK_EVIDENCE_IO');
    }
  } finally {
    directory.close();
  }
}

function hasOnlyV22PublicLeaves(leaves: readonly string[]) {
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
    throw new Error('V22_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
