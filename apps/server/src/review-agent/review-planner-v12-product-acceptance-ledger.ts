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

export type ReviewPlannerV12ProductAcceptanceManifest = z.infer<
  typeof reviewPlannerV12ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV12ProductAcceptanceExecutionManifest = z.infer<
  typeof reviewPlannerV12ProductAcceptanceExecutionManifestSchema
>;

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  attemptSha256: string;
  owner: ReviewPlannerV12ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  executionWritten: boolean;
  closed: boolean;
};

export type ReviewPlannerV12ProductAcceptanceLedger = Readonly<{
  attemptSha256(): string;
  writeExecutionManifest(value: unknown): Promise<void>;
  writeManifest(value: unknown): void;
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
}): Promise<Readonly<{ status: 'empty' | 'incomplete' | 'evidence_io' }>> {
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
      leaves.length !== 2 ||
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
    return Object.freeze({ status: 'incomplete' as const });
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
