import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  assertReviewPlannerV12ProductAcceptanceOwner,
  bindReviewPlannerV12ProductAcceptanceAttempt,
  inspectReviewPlannerV12ProductAcceptanceRecoveryCheckpoint,
  readReviewPlannerV12ProductAcceptanceAttemptBinding,
  registerReviewPlannerV12ProductAcceptanceOwnerAttempt,
  type ReviewPlannerV12ProductAcceptanceOwner,
} from './review-planner-v12-product-acceptance-recovery';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
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
const SLOT_LEAF = /^slot-(review|planner)-(api|browser)\.json$/;
const DEFAULT_OFF_LEAF = /^default-off-(review|planner)\.json$/;

export const reviewPlannerV12ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict();

const v12SlotSchema = z.enum([
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
]);
const v12ComponentSchema = z.enum(['review', 'planner']);
const v12HashSchema = z.string().regex(ATTEMPT_HASH);

export const reviewPlannerV12ProductAcceptanceSlotResultSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
    ),
    slot: v12SlotSchema,
    traceSha256: v12HashSchema,
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    component: v12ComponentSchema,
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

export const reviewPlannerV12ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
    traceSha256: z.array(v12HashSchema).length(4),
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v12HashSchema,
    requests: z.literal(4),
    durationMs: z.number().int().positive().max(240_000),
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: v12HashSchema,
  })
  .strict();

export const reviewPlannerV12ProductAcceptanceFailureSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
    ),
    environment: z.enum(['branch', 'main']),
    component: v12ComponentSchema,
    slot: z.enum(['api', 'browser']),
    checkpoint: z.string().regex(/^(review|planner)_(api|browser)_[a-z_]+$/),
    terminal: z.literal('operation_failed'),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict();

export type ReviewPlannerV12ProductAcceptanceManifest = z.infer<
  typeof reviewPlannerV12ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV12ProductAcceptanceExecutionManifest = z.infer<
  typeof reviewPlannerV12ProductAcceptanceExecutionManifestSchema
>;
export type ReviewPlannerV12ProductAcceptanceSlotResult = z.infer<
  typeof reviewPlannerV12ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV12ProductAcceptanceDefaultOff = z.infer<
  typeof reviewPlannerV12ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV12ProductAcceptanceOwnerIsolation = z.infer<
  typeof reviewPlannerV12ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV12ProductAcceptanceCleanup = z.infer<
  typeof reviewPlannerV12ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV12ProductAcceptanceAggregate = z.infer<
  typeof reviewPlannerV12ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV12ProductAcceptanceSuccess = z.infer<
  typeof reviewPlannerV12ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV12ProductAcceptanceFailure = z.infer<
  typeof reviewPlannerV12ProductAcceptanceFailureSchema
>;

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  owner: ReviewPlannerV12ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  executionWritten: boolean;
  claimedSlots: Set<ReviewPlannerV12ProductAcceptanceSlotResult['slot']>;
  slotResults: Set<ReviewPlannerV12ProductAcceptanceSlotResult['slot']>;
  defaultOff: Set<ReviewPlannerV12ProductAcceptanceDefaultOff['component']>;
  ownerIsolationWritten: boolean;
  cleanupWritten: boolean;
  failureWritten: boolean;
  finalized: boolean;
  closed: boolean;
};

export type ReviewPlannerV12ProductAcceptanceLedger = Readonly<{
  attemptSha256(): string;
  writeExecutionManifest(value: unknown): Promise<void>;
  writeManifest(value: unknown): void;
  claimSlot(slot: ReviewPlannerV12ProductAcceptanceSlotResult['slot']): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(value: unknown): Promise<void>;
  recordFailure(value: unknown): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV12ProductAcceptanceLedger,
  LedgerState
>();

export async function reserveReviewPlannerV12ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV12ProductAcceptanceOwner;
}): Promise<ReviewPlannerV12ProductAcceptanceLedger> {
  if (!isEnvironment(input.environment)) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV12ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    const repoRoot = resolve(input.repoRoot);
    directory = await openWindowsNoReparseFrozenDirectory(repoRoot, [
      ...REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length !== 0) {
      throw new Error('V12_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    const attemptId = randomBytes(32).toString('hex');
    const attemptSha256 = sha256(attemptId);
    directory.createExclusiveDurableFile(
      RESERVATION_LEAF,
      `${attemptSha256}\n`,
    );
    const binding = await bindReviewPlannerV12ProductAcceptanceAttempt({
      repoRoot,
      environment: input.environment,
      owner: input.owner,
      attemptId,
    });
    if (binding.attemptSha256 !== attemptSha256) {
      throw new Error('V12_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    reservationGuard =
      directory.tryAcquireExclusiveLifetimeFile(RESERVATION_LEAF);
    if (reservationGuard === null) {
      throw new Error('V12_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    registerReviewPlannerV12ProductAcceptanceOwnerAttempt(
      input.owner,
      input.environment,
      attemptSha256,
    );
    const ledger = createV12Ledger({
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
      /^V12_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V12_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV12ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<
  Readonly<{
    status:
      | 'empty'
      | 'incomplete'
      | 'complete'
      | 'operation_failed'
      | 'evidence_io';
  }>
> {
  if (!isEnvironment(input.environment)) {
    return Object.freeze({ status: 'evidence_io' as const });
  }
  const publicPath = resolve(
    input.repoRoot,
    REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath(
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
        ...REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      !hasOnlyV12PublicLeaves(leaves) ||
      !leaves.includes(RESERVATION_LEAF) ||
      !leaves.includes(MANIFEST_LEAF)
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    const attemptSha256 = readReservationHash(directory);
    const binding =
      await readReviewPlannerV12ProductAcceptanceAttemptBinding(input);
    const manifest = parseReviewPlannerV12ProductAcceptanceManifest(
      JSON.parse(directory.readRegularFile(MANIFEST_LEAF).toString()),
    );
    const execution =
      await readReviewPlannerV12ProductAcceptanceExecutionManifest(input);
    if (
      binding.attemptSha256 !== attemptSha256 ||
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== attemptSha256 ||
      execution.environment !== input.environment ||
      execution.attemptSha256 !== attemptSha256
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    await inspectReviewPlannerV12ProductAcceptanceRecoveryCheckpoint(input);
    if (leaves.includes(FAILURE_LEAF)) {
      const failure = parseReviewPlannerV12ProductAcceptanceFailure(
        JSON.parse(directory.readRegularFile(FAILURE_LEAF).toString()),
      );
      if (failure.environment !== input.environment) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      return Object.freeze({ status: 'operation_failed' as const });
    }
    if (!leaves.includes(SUCCESS_LEAF)) {
      return Object.freeze({ status: 'incomplete' as const });
    }
    const slots = [
      'review-api',
      'review-browser',
      'planner-api',
      'planner-browser',
    ] as const;
    for (const slot of slots) {
      const record = parseReviewPlannerV12ProductAcceptanceSlotResult(
        JSON.parse(directory.readRegularFile(`slot-${slot}.json`).toString()),
      );
      if (record.slot !== slot)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    for (const component of ['review', 'planner'] as const) {
      const record = parseReviewPlannerV12ProductAcceptanceDefaultOff(
        JSON.parse(
          directory.readRegularFile(`default-off-${component}.json`).toString(),
        ),
      );
      if (record.component !== component)
        return Object.freeze({ status: 'evidence_io' as const });
    }
    parseReviewPlannerV12ProductAcceptanceOwnerIsolation(
      JSON.parse(directory.readRegularFile(OWNER_ISOLATION_LEAF).toString()),
    );
    parseReviewPlannerV12ProductAcceptanceCleanup(
      JSON.parse(directory.readRegularFile(CLEANUP_LEAF).toString()),
    );
    const aggregate = parseReviewPlannerV12ProductAcceptanceAggregate(
      JSON.parse(directory.readRegularFile(AGGREGATE_LEAF).toString()),
    );
    const success = parseReviewPlannerV12ProductAcceptanceSuccess(
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

export async function readReviewPlannerV12ProductAcceptanceExecutionManifest(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV12ProductAcceptanceExecutionManifest> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
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
    return parseReviewPlannerV12ProductAcceptanceExecutionManifest(
      JSON.parse(directory.readRegularFile(EXECUTION_MANIFEST_LEAF).toString()),
    );
  } catch {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function parseReviewPlannerV12ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceManifest {
  const parsed =
    reviewPlannerV12ProductAcceptanceManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function parseReviewPlannerV12ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceExecutionManifest {
  const parsed =
    reviewPlannerV12ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function parseReviewPlannerV12ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceSlotResult {
  return parseV12Record(
    reviewPlannerV12ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV12ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceDefaultOff {
  return parseV12Record(
    reviewPlannerV12ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV12ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceOwnerIsolation {
  return parseV12Record(
    reviewPlannerV12ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV12ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceCleanup {
  return parseV12Record(reviewPlannerV12ProductAcceptanceCleanupSchema, value);
}

export function parseReviewPlannerV12ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceAggregate {
  return parseV12Record(
    reviewPlannerV12ProductAcceptanceAggregateSchema,
    value,
  );
}

export function parseReviewPlannerV12ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceSuccess {
  return parseV12Record(reviewPlannerV12ProductAcceptanceSuccessSchema, value);
}

export function parseReviewPlannerV12ProductAcceptanceFailure(
  value: unknown,
): ReviewPlannerV12ProductAcceptanceFailure {
  return parseV12Record(reviewPlannerV12ProductAcceptanceFailureSchema, value);
}

function parseV12Record<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function createV12Ledger(
  state: LedgerState,
): ReviewPlannerV12ProductAcceptanceLedger {
  const ledger: ReviewPlannerV12ProductAcceptanceLedger = Object.freeze({
    attemptSha256: () => state.attemptSha256,
    async writeExecutionManifest(value) {
      assertActiveLedger(ledger);
      const manifest =
        parseReviewPlannerV12ProductAcceptanceExecutionManifest(value);
      if (
        state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      const directory = await openWindowsNoReparseFrozenDirectory(
        state.repoRoot,
        [
          ...REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
            state.environment,
          ),
        ],
      );
      try {
        directory.assertLocalFixedNtfsVolume();
        if (directory.listLeafNames().length !== 0) {
          throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
      const manifest = parseReviewPlannerV12ProductAcceptanceManifest(value);
      if (
        !state.executionWritten ||
        manifest.environment !== state.environment ||
        manifest.attemptSha256 !== state.attemptSha256
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      if (state.directory.listLeafNames().length !== 1) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
      }
      state.directory.createExclusiveDurableFile(
        MANIFEST_LEAF,
        `${JSON.stringify(manifest)}\n`,
      );
    },
    claimSlot(slot) {
      assertActiveLedger(ledger);
      if (state.finalized || state.claimedSlots.has(slot)) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      }
      state.claimedSlots.add(slot);
    },
    recordSlotResult(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV12ProductAcceptanceSlotResult(value);
      if (
        !state.claimedSlots.has(record.slot) ||
        state.slotResults.has(record.slot) ||
        state.finalized
      )
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `slot-${record.slot}.json`, record);
      state.slotResults.add(record.slot);
    },
    recordDefaultOff(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV12ProductAcceptanceDefaultOff(value);
      if (state.defaultOff.has(record.component) || state.finalized)
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, `default-off-${record.component}.json`, record);
      state.defaultOff.add(record.component);
    },
    recordOwnerIsolation(value) {
      assertActiveLedger(ledger);
      const record =
        parseReviewPlannerV12ProductAcceptanceOwnerIsolation(value);
      if (state.ownerIsolationWritten || state.finalized)
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, OWNER_ISOLATION_LEAF, record);
      state.ownerIsolationWritten = true;
    },
    recordCleanup(value) {
      assertActiveLedger(ledger);
      const record = parseReviewPlannerV12ProductAcceptanceCleanup(value);
      if (state.cleanupWritten || state.finalized)
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, CLEANUP_LEAF, record);
      state.cleanupWritten = true;
    },
    finalizeSuccess(value) {
      assertActiveLedger(ledger);
      const aggregate = parseReviewPlannerV12ProductAcceptanceAggregate(value);
      if (
        state.finalized ||
        state.slotResults.size !== 4 ||
        state.defaultOff.size !== 2 ||
        !state.ownerIsolationWritten ||
        !state.cleanupWritten ||
        aggregate.environment !== state.environment ||
        aggregate.attemptSha256 !== state.attemptSha256
      )
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
      writePublicRecord(state, AGGREGATE_LEAF, aggregate);
      writePublicRecord(
        state,
        SUCCESS_LEAF,
        parseReviewPlannerV12ProductAcceptanceSuccess({
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
          environment: state.environment,
          attemptSha256: state.attemptSha256,
        }),
      );
      state.finalized = true;
      return Promise.resolve();
    },
    recordFailure(value) {
      assertActiveLedger(ledger);
      const failure = parseReviewPlannerV12ProductAcceptanceFailure(value);
      if (
        state.finalized ||
        state.failureWritten ||
        failure.environment !== state.environment
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
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

function assertActiveLedger(ledger: ReviewPlannerV12ProductAcceptanceLedger) {
  const state = ledgerState.get(ledger);
  if (!state || state.closed) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  }
  assertReviewPlannerV12ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
  ]);
}

function writePublicRecord(state: LedgerState, leaf: string, value: object) {
  if (
    !state.executionWritten ||
    !state.directory.listLeafNames().includes(MANIFEST_LEAF)
  ) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  }
  state.directory.createExclusiveDurableFile(
    leaf,
    `${JSON.stringify(value)}\n`,
  );
}

function hasOnlyV12PublicLeaves(leaves: readonly string[]) {
  const required = new Set([
    RESERVATION_LEAF,
    MANIFEST_LEAF,
    OWNER_ISOLATION_LEAF,
    CLEANUP_LEAF,
    AGGREGATE_LEAF,
    SUCCESS_LEAF,
    FAILURE_LEAF,
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
    throw new Error('V12_PRODUCT_ACCEPTANCE_LEDGER_EVIDENCE_IO');
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
