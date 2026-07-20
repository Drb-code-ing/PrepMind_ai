import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceEnvironment,
} from './review-planner-product-acceptance-profile';

const ATTEMPT_ID = /^[a-f0-9]{64}$/;
const ATTEMPT_HASH = /^[a-f0-9]{64}$/;
const OWNER_LOCK_LEAF = 'owner.lock';
const ATTEMPT_BINDING_LEAF = 'attempt-binding.json';
const CHECKPOINT_LEAF = /^checkpoint-(\d{3})-([a-z_]+)\.json$/;
const PUBLIC_RESERVATION_LEAF = '.acceptance-reserved';
const PUBLIC_MANIFEST_LEAF = 'manifest.json';
const V19_PUBLIC_SLOT_LEAF = /^slot-(review|planner)-(api|browser)\.json$/;
const V19_PUBLIC_DEFAULT_OFF_LEAF = /^default-off-(review|planner)\.json$/;
const V19_PUBLIC_RECEIPT_LEAVES = new Set([
  'owner-isolation.json',
  'cleanup.json',
  'aggregate.json',
  'success.json',
  'failure.json',
  'recovery.json',
]);

export const REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS = [
  'review_api_setup',
  'review_api_activate',
  'review_api_facts_before',
  'review_api_trace_baseline',
  'review_api_dispatch',
  'review_api_observation',
  'review_api_trace_wait',
  'review_api_trace_canonicalize',
  'review_api_slot_record',
  'review_browser_trace_baseline',
  'review_browser_launch',
  'review_browser_dispatch',
  'review_browser_observation',
  'review_browser_default_off',
  'review_browser_trace_wait',
  'review_browser_trace_canonicalize',
  'review_browser_slot_record',
  'planner_api_activate',
  'planner_api_facts_before',
  'planner_api_trace_baseline',
  'planner_api_dispatch',
  'planner_api_observation',
  'planner_api_trace_wait',
  'planner_api_trace_canonicalize',
  'planner_api_slot_record',
  'planner_browser_trace_baseline',
  'planner_browser_launch',
  'planner_browser_dispatch',
  'planner_browser_observation',
  'planner_browser_default_off',
  'planner_browser_trace_wait',
  'planner_browser_trace_canonicalize',
  'planner_browser_slot_record',
] as const;

export type ReviewPlannerV19ProductAcceptanceCheckpoint =
  (typeof REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS)[number];
export type ReviewPlannerV19ProductAcceptanceOwnerRole = 'product' | 'recovery';

const attemptBindingSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v19-product-acceptance-attempt-v1'),
    attemptId: z.string().regex(ATTEMPT_ID),
    attemptSha256: z.string().regex(ATTEMPT_HASH),
  })
  .strict()
  .superRefine((value, context) => {
    if (sha256(value.attemptId) !== value.attemptSha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attemptSha256'],
        message: 'ATTEMPT_HASH_INVALID',
      });
    }
  });

const checkpointSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
    ),
    component: z.enum(['review', 'planner']),
    slot: z.enum(['api', 'browser']),
    checkpoint: z.enum(REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict();

type AttemptBinding = z.infer<typeof attemptBindingSchema>;
export type ReviewPlannerV19ProductAcceptanceCheckpointRecord = z.infer<
  typeof checkpointSchema
>;

export type ReviewPlannerV19ProductAcceptanceOwner = Readonly<{
  assertHeld(): void;
  close(): void;
}>;

type OwnerState = {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  role: ReviewPlannerV19ProductAcceptanceOwnerRole;
  directory: WindowsNoReparseChildDirectory;
  lock: WindowsExclusiveLifetimeFile;
  attemptSha256: string | null;
  closed: boolean;
};

const ownerState = new WeakMap<
  ReviewPlannerV19ProductAcceptanceOwner,
  OwnerState
>();

export type ReviewPlannerV19ProductAcceptanceRecoveryJournal = Readonly<{
  attemptSha256(): string;
  appendCheckpoint(
    value: unknown,
  ): ReviewPlannerV19ProductAcceptanceCheckpointRecord;
  latestCheckpoint(): ReviewPlannerV19ProductAcceptanceCheckpointRecord | null;
  close(): void;
}>;

type JournalState = {
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV19ProductAcceptanceOwner;
  attemptSha256: string;
  directory: WindowsNoReparseChildDirectory;
  closed: boolean;
};

const journalState = new WeakMap<
  ReviewPlannerV19ProductAcceptanceRecoveryJournal,
  JournalState
>();

export async function acquireReviewPlannerV19ProductAcceptanceOwner(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  role: ReviewPlannerV19ProductAcceptanceOwnerRole;
}): Promise<
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV19ProductAcceptanceOwner;
    }>
  | Readonly<{ status: 'owner_active' }>
> {
  if (!isEnvironment(input.environment) || !isOwnerRole(input.role)) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_OWNER_INPUT_INVALID');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  let lock: WindowsExclusiveLifetimeFile | null = null;
  try {
    const repoRoot = resolve(input.repoRoot);
    directory = await openWindowsNoReparseFrozenDirectory(repoRoot, [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    lock = directory.tryAcquireExclusiveLifetimeFile(OWNER_LOCK_LEAF);
    if (lock === null) {
      directory.close();
      return Object.freeze({ status: 'owner_active' as const });
    }
    const owner: ReviewPlannerV19ProductAcceptanceOwner = Object.freeze({
      assertHeld() {
        const state = ownerState.get(owner);
        if (!state || state.closed) {
          throw new Error('V19_PRODUCT_ACCEPTANCE_OWNER_CLOSED');
        }
        state.lock.assertHeld();
      },
      close() {
        const state = ownerState.get(owner);
        if (!state || state.closed) return;
        state.closed = true;
        try {
          state.lock.close();
        } finally {
          state.directory.close();
        }
      },
    });
    ownerState.set(owner, {
      repoRoot,
      environment: input.environment,
      role: input.role,
      directory,
      lock,
      attemptSha256: null,
      closed: false,
    });
    directory = null;
    lock = null;
    return Object.freeze({ status: 'acquired' as const, owner });
  } catch (error) {
    lock?.close();
    directory?.close();
    if (
      error instanceof Error &&
      /^V19_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V19_PRODUCT_ACCEPTANCE_OWNER_IO');
  }
}

export function assertReviewPlannerV19ProductAcceptanceOwner(
  owner: ReviewPlannerV19ProductAcceptanceOwner,
  environment: ReviewPlannerProductAcceptanceEnvironment,
  allowedRoles: readonly ReviewPlannerV19ProductAcceptanceOwnerRole[],
): void {
  const state = ownerState.get(owner);
  if (
    !state ||
    state.closed ||
    state.environment !== environment ||
    !allowedRoles.includes(state.role)
  ) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_OWNER_INVALID');
  }
  owner.assertHeld();
}

export function registerReviewPlannerV19ProductAcceptanceOwnerAttempt(
  owner: ReviewPlannerV19ProductAcceptanceOwner,
  environment: ReviewPlannerProductAcceptanceEnvironment,
  attemptSha256: string,
): void {
  assertReviewPlannerV19ProductAcceptanceOwner(owner, environment, ['product']);
  const state = ownerState.get(owner);
  if (
    !state ||
    state.attemptSha256 !== null ||
    !ATTEMPT_HASH.test(attemptSha256)
  ) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  state.attemptSha256 = attemptSha256;
}

export async function bindReviewPlannerV19ProductAcceptanceAttempt(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV19ProductAcceptanceOwner;
  attemptId: string;
}): Promise<Readonly<AttemptBinding>> {
  assertReviewPlannerV19ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  if (!ATTEMPT_ID.test(input.attemptId)) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  const expectedHash = sha256(input.attemptId);
  if ((await readPublicAttemptHash(input)) !== expectedHash) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertRecoveryLeaves(directory, false);
    const binding = parseAttemptBinding({
      schemaVersion: 'phase-6.9.5-v19-product-acceptance-attempt-v1',
      attemptId: input.attemptId,
      attemptSha256: expectedHash,
    });
    directory.createExclusiveDurableFile(
      ATTEMPT_BINDING_LEAF,
      `${JSON.stringify(binding)}\n`,
    );
    return Object.freeze({ ...binding });
  } catch (error) {
    if (
      error instanceof Error &&
      /^V19_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_IO');
  } finally {
    directory.close();
  }
}

export async function readReviewPlannerV19ProductAcceptanceAttemptBinding(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<Readonly<AttemptBinding>> {
  try {
    const publicHash = await readPublicAttemptHash(input);
    const binding = await readPrivateAttemptBinding(input);
    if (binding.attemptSha256 !== publicHash) throw new Error();
    return binding;
  } catch {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

export async function prepareReviewPlannerV19ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV19ProductAcceptanceOwner;
}): Promise<ReviewPlannerV19ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV19ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const state = ownerState.get(input.owner);
  if (!state || state.attemptSha256 === null) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  const binding = await readPrivateAttemptBinding(input);
  if (binding.attemptSha256 !== state.attemptSha256) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  return openV19Journal(input, state.attemptSha256, true);
}

export async function openReviewPlannerV19ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
  owner: ReviewPlannerV19ProductAcceptanceOwner;
}): Promise<ReviewPlannerV19ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV19ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  const binding =
    await readReviewPlannerV19ProductAcceptanceAttemptBinding(input);
  return openV19Journal(input, binding.attemptSha256, false);
}

export async function inspectReviewPlannerV19ProductAcceptanceRecoveryCheckpoint(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV19ProductAcceptanceCheckpointRecord | null> {
  await readReviewPlannerV19ProductAcceptanceAttemptBinding(input);
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const latest = readCheckpointHistory(directory).at(-1);
    return latest === undefined ? null : Object.freeze({ ...latest });
  } catch {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function parseReviewPlannerV19ProductAcceptanceCheckpoint(
  value: unknown,
): ReviewPlannerV19ProductAcceptanceCheckpointRecord {
  const parsed = checkpointSchema.safeParse(value);
  if (!parsed.success || !checkpointMatchesBoundary(parsed.data)) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_RECORD_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

function parseAttemptBinding(value: unknown): AttemptBinding {
  const parsed = attemptBindingSchema.safeParse(value);
  if (!parsed.success)
    throw new Error('V19_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  return Object.freeze({ ...parsed.data });
}

async function openV19Journal(
  input: {
    repoRoot: string;
    environment: ReviewPlannerProductAcceptanceEnvironment;
    owner: ReviewPlannerV19ProductAcceptanceOwner;
  },
  attemptSha256: string,
  requireEmpty: boolean,
) {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const history = readCheckpointHistory(directory);
    if (requireEmpty && history.length !== 0) {
      throw new Error('V19_PRODUCT_ACCEPTANCE_CHECKPOINT_EXISTS');
    }
    const journal: ReviewPlannerV19ProductAcceptanceRecoveryJournal =
      Object.freeze({
        attemptSha256: () => attemptSha256,
        appendCheckpoint(value) {
          const state = journalState.get(journal);
          if (!state || state.closed) {
            throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_CLOSED');
          }
          assertReviewPlannerV19ProductAcceptanceOwner(
            state.owner,
            state.environment,
            ['product', 'recovery'],
          );
          const record =
            parseReviewPlannerV19ProductAcceptanceCheckpoint(value);
          const current = readCheckpointHistory(state.directory);
          assertNextCheckpoint(current, record);
          const index = String(current.length + 1).padStart(3, '0');
          state.directory.createExclusiveDurableFile(
            `checkpoint-${index}-${record.checkpoint}.json`,
            `${JSON.stringify(record)}\n`,
          );
          return record;
        },
        latestCheckpoint() {
          const state = journalState.get(journal);
          if (!state || state.closed) {
            throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_CLOSED');
          }
          const latest = readCheckpointHistory(state.directory).at(-1);
          return latest === undefined ? null : Object.freeze({ ...latest });
        },
        close() {
          const state = journalState.get(journal);
          if (!state || state.closed) return;
          state.closed = true;
          state.directory.close();
        },
      });
    journalState.set(journal, {
      environment: input.environment,
      owner: input.owner,
      attemptSha256,
      directory,
      closed: false,
    });
    return journal;
  } catch (error) {
    directory.close();
    if (
      error instanceof Error &&
      /^V19_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

async function readPublicAttemptHash(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<string> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      !leaves.includes(PUBLIC_RESERVATION_LEAF) ||
      leaves.some(
        (leaf) =>
          leaf !== PUBLIC_RESERVATION_LEAF &&
          leaf !== PUBLIC_MANIFEST_LEAF &&
          !V19_PUBLIC_SLOT_LEAF.test(leaf) &&
          !V19_PUBLIC_DEFAULT_OFF_LEAF.test(leaf) &&
          !V19_PUBLIC_RECEIPT_LEAVES.has(leaf),
      )
    ) {
      throw new Error();
    }
    const raw = directory.readRegularFile(PUBLIC_RESERVATION_LEAF).toString();
    if (!ATTEMPT_HASH.test(raw.trim()) || raw !== `${raw.trim()}\n`) {
      throw new Error();
    }
    return raw.trim();
  } catch {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

async function readPrivateAttemptBinding(input: {
  repoRoot: string;
  environment: ReviewPlannerProductAcceptanceEnvironment;
}): Promise<Readonly<AttemptBinding>> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertRecoveryLeaves(directory, true);
    return parseAttemptBinding(
      JSON.parse(directory.readRegularFile(ATTEMPT_BINDING_LEAF).toString()),
    );
  } finally {
    directory.close();
  }
}

function assertRecoveryLeaves(
  directory: WindowsNoReparseChildDirectory,
  requireBinding: boolean,
) {
  const leaves = directory.listLeafNames();
  if (
    leaves.some(
      (leaf) =>
        leaf !== OWNER_LOCK_LEAF &&
        leaf !== ATTEMPT_BINDING_LEAF &&
        !CHECKPOINT_LEAF.test(leaf),
    ) ||
    (requireBinding && !leaves.includes(ATTEMPT_BINDING_LEAF)) ||
    (!requireBinding && leaves.includes(ATTEMPT_BINDING_LEAF))
  ) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function readCheckpointHistory(
  directory: WindowsNoReparseChildDirectory,
): readonly ReviewPlannerV19ProductAcceptanceCheckpointRecord[] {
  assertRecoveryLeaves(directory, true);
  try {
    const entries = directory
      .listLeafNames()
      .filter(
        (leaf) => leaf !== OWNER_LOCK_LEAF && leaf !== ATTEMPT_BINDING_LEAF,
      )
      .map((leaf) => {
        const match = CHECKPOINT_LEAF.exec(leaf);
        if (!match) throw new Error();
        return { index: Number(match[1]), checkpoint: match[2], leaf };
      })
      .sort((left, right) => left.index - right.index);
    for (const [position, entry] of entries.entries()) {
      if (entry.index !== position + 1) throw new Error();
    }
    const records = entries.map((entry) => {
      const record = parseReviewPlannerV19ProductAcceptanceCheckpoint(
        JSON.parse(directory.readRegularFile(entry.leaf).toString()),
      );
      if (record.checkpoint !== entry.checkpoint) throw new Error();
      return record;
    });
    records.forEach((record, index) =>
      assertNextCheckpoint(records.slice(0, index), record),
    );
    return Object.freeze(records.map((record) => Object.freeze({ ...record })));
  } catch {
    throw new Error('V19_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function assertNextCheckpoint(
  history: readonly ReviewPlannerV19ProductAcceptanceCheckpointRecord[],
  record: ReviewPlannerV19ProductAcceptanceCheckpointRecord,
) {
  const boundary = `${record.component}_${record.slot}`;
  const expected = REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter(
    (checkpoint) => checkpoint.startsWith(`${boundary}_`),
  );
  const previous = history.filter(
    (item) => `${item.component}_${item.slot}` === boundary,
  );
  if (
    record.checkpoint !== expected[previous.length] ||
    record.providerCallState !== expectedProviderCallState(record)
  ) {
    throw new Error('V19_PRODUCT_ACCEPTANCE_CHECKPOINT_ORDER_INVALID');
  }
}

function expectedProviderCallState(
  record: ReviewPlannerV19ProductAcceptanceCheckpointRecord,
) {
  return record.checkpoint.endsWith('_dispatch') ||
    REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS.indexOf(
      record.checkpoint,
    ) >
      REVIEW_PLANNER_V19_PRODUCT_ACCEPTANCE_CHECKPOINTS.indexOf(
        `${record.component}_${record.slot}_dispatch`,
      )
    ? 'indeterminate'
    : 'not_started';
}

function checkpointMatchesBoundary(
  value: ReviewPlannerV19ProductAcceptanceCheckpointRecord,
) {
  return value.checkpoint.startsWith(`${value.component}_${value.slot}_`);
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function isEnvironment(
  value: unknown,
): value is ReviewPlannerProductAcceptanceEnvironment {
  return value === 'branch' || value === 'main';
}

function isOwnerRole(
  value: unknown,
): value is ReviewPlannerV19ProductAcceptanceOwnerRole {
  return value === 'product' || value === 'recovery';
}
