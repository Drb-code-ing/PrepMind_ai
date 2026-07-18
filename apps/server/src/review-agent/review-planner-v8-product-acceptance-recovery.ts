import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  openWindowsNoReparseDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

export type ReviewPlannerV8ProductAcceptanceEnvironment = 'branch' | 'main';
export type ReviewPlannerV8ProductAcceptanceOwnerRole = 'product' | 'recovery';

export type ReviewPlannerV8ProductAcceptanceOwner = Readonly<{
  assertHeld(): void;
  close(): void;
}>;

type OwnerState = {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV8ProductAcceptanceOwnerRole;
  directory: WindowsNoReparseChildDirectory;
  lock: WindowsExclusiveLifetimeFile;
  closed: boolean;
};

const ownerState = new WeakMap<
  ReviewPlannerV8ProductAcceptanceOwner,
  OwnerState
>();

const recoveryManifestSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-recovery-v1'),
    environment: z.enum(['branch', 'main']),
    publicLedgerPath: z.string().max(240),
    syntheticEmails: z
      .object({
        review: z.string().email().max(254),
        planner: z.string().email().max(254),
        probe: z.string().email().max(254),
      })
      .strict(),
    fixtureIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,120}$/)).max(100),
    browserExecutablePath: z.string().regex(/^[A-Za-z]:\\[^\0]{1,500}$/),
    browserProfilePath: z.string().max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedPublic = `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/${value.environment}`;
    const expectedProfile = `.tmp/phase-6-9-5-v8-product-acceptance/${value.environment}/profile-v8`;
    if (value.publicLedgerPath !== expectedPublic) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['publicLedgerPath'],
        message: 'RECOVERY_PUBLIC_PATH_INVALID',
      });
    }
    if (value.browserProfilePath !== expectedProfile) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['browserProfilePath'],
        message: 'RECOVERY_PROFILE_PATH_INVALID',
      });
    }
    const emails = Object.values(value.syntheticEmails);
    if (new Set(emails).size !== emails.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['syntheticEmails'],
        message: 'RECOVERY_EMAILS_NOT_UNIQUE',
      });
    }
    if (new Set(value.fixtureIds).size !== value.fixtureIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixtureIds'],
        message: 'RECOVERY_FIXTURES_NOT_UNIQUE',
      });
    }
  });

const RECOVERY_STAGE_LEAVES = Object.freeze([
  'restore.claimed',
  'restore.verified.json',
  'cleanup.claimed',
  'cleanup.verified.json',
] as const);
type RecoveryStageLeaf = (typeof RECOVERY_STAGE_LEAVES)[number];

const recoveryRestoreSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-recovery-restore-v1',
    ),
    reviewAgentModelEnabled: z.literal(false),
    plannerAgentModelEnabled: z.literal(false),
    acceptanceEnabled: z.literal(false),
    capabilityPresent: z.literal(false),
    providerMode: z.literal('mock'),
    liveCallsEnabled: z.literal(false),
    deterministicProbePassed: z.literal(true),
    containerIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
    providerInvocations: z.literal(0),
  })
  .strict();

const recoveryCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1',
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProcesses: z.literal(0),
    browserProfiles: z.literal(0),
    probeAccounts: z.literal(0),
  })
  .strict();

const recoveryTerminalSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-recovery-terminal-v1',
    ),
    environment: z.enum(['branch', 'main']),
    status: z.literal('failed'),
    reason: z.literal('hard_crash_recovered'),
    providerInvocations: z.literal(0),
    recoveryManifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    restoreReceiptSha256: z.string().regex(/^[a-f0-9]{64}$/),
    cleanupReceiptSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

type RecoveryJournalState = {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  directory: WindowsNoReparseChildDirectory;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  closed: boolean;
};

export type ReviewPlannerV8ProductAcceptanceRecoveryJournal = Readonly<{
  appendStage(leaf: RecoveryStageLeaf, contents: string): void;
  finalizeRecoveryOnly(): Promise<void>;
  close(): void;
}>;

const journalState = new WeakMap<
  ReviewPlannerV8ProductAcceptanceRecoveryJournal,
  RecoveryJournalState
>();

export async function acquireReviewPlannerV8ProductAcceptanceOwner(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV8ProductAcceptanceOwnerRole;
}): Promise<
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV8ProductAcceptanceOwner;
    }>
  | Readonly<{ status: 'owner_active' }>
> {
  if (!isEnvironment(input.environment) || !isRole(input.role)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_INPUT_INVALID');
  }
  const directory = await openWindowsNoReparseDirectory(input.repoRoot, [
    '.tmp',
    'phase-6-9-5-v8-product-acceptance',
    input.environment,
  ]);
  try {
    directory.assertLocalFixedNtfsVolume();
    const lock = directory.tryAcquireExclusiveLifetimeFile('owner.lock');
    if (lock === null) {
      directory.close();
      return Object.freeze({ status: 'owner_active' as const });
    }
    const owner: ReviewPlannerV8ProductAcceptanceOwner = Object.freeze({
      assertHeld() {
        const state = ownerState.get(owner);
        if (!state || state.closed) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_CLOSED');
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
      environment: input.environment,
      role: input.role,
      directory,
      lock,
      closed: false,
    });
    return Object.freeze({ status: 'acquired' as const, owner });
  } catch (error) {
    directory.close();
    throw sanitizeOwnerError(error);
  }
}

export function assertReviewPlannerV8ProductAcceptanceOwner(
  owner: ReviewPlannerV8ProductAcceptanceOwner,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  allowedRoles: readonly ReviewPlannerV8ProductAcceptanceOwnerRole[],
): void {
  const state = ownerState.get(owner);
  if (
    !state ||
    state.closed ||
    state.environment !== environment ||
    !allowedRoles.includes(state.role)
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_INVALID');
  }
  owner.assertHeld();
}

export async function prepareReviewPlannerV8ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  manifest: unknown;
}): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV8ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const parsed = recoveryManifestSchema.safeParse(input.manifest);
  if (!parsed.success || parsed.data.environment !== input.environment) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID');
  }
  const directory = await openWindowsNoReparseDirectory(input.repoRoot, [
    '.tmp',
    'phase-6-9-5-v8-product-acceptance',
    input.environment,
  ]);
  try {
    directory.assertLocalFixedNtfsVolume();
    assertOnlyRecoveryLeaves(directory, ['owner.lock']);
    publish(
      directory,
      'recovery-manifest.json',
      `${JSON.stringify(parsed.data)}\n`,
      'V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_IO',
    );
    return createRecoveryJournal({
      repoRoot: input.repoRoot,
      environment: input.environment,
      directory,
      owner: input.owner,
      closed: false,
    });
  } catch (error) {
    directory.close();
    if (
      error instanceof Error &&
      error.message === 'V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID'
    ) {
      throw error;
    }
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_IO');
  }
}

export async function openReviewPlannerV8ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
}): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV8ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  const directory = await openWindowsNoReparseDirectory(input.repoRoot, [
    '.tmp',
    'phase-6-9-5-v8-product-acceptance',
    input.environment,
  ]);
  try {
    directory.assertLocalFixedNtfsVolume();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_STAGE_LEAVES,
    ]);
    const parsed = recoveryManifestSchema.parse(
      JSON.parse(
        directory.readRegularFile('recovery-manifest.json').toString(),
      ),
    );
    if (parsed.environment !== input.environment) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID');
    }
    return createRecoveryJournal({
      repoRoot: input.repoRoot,
      environment: input.environment,
      directory,
      owner: input.owner,
      closed: false,
    });
  } catch {
    directory.close();
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

export async function hasReviewPlannerV8ProductAcceptanceRecoveryManifest(
  repoRoot: string,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
): Promise<boolean> {
  const directory = await openWindowsNoReparseDirectory(repoRoot, [
    '.tmp',
    'phase-6-9-5-v8-product-acceptance',
    environment,
  ]);
  try {
    const leaves = directory.listLeafNames();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_STAGE_LEAVES,
    ]);
    if (!leaves.includes('recovery-manifest.json')) return false;
    const parsed = recoveryManifestSchema.safeParse(
      JSON.parse(
        directory.readRegularFile('recovery-manifest.json').toString(),
      ),
    );
    return parsed.success && parsed.data.environment === environment;
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export async function assertReviewPlannerV8ProductAcceptanceRecoveryClear(
  repoRoot: string,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
): Promise<void> {
  const directory = await openWindowsNoReparseDirectory(repoRoot, [
    '.tmp',
    'phase-6-9-5-v8-product-acceptance',
    environment,
  ]);
  try {
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_STAGE_LEAVES,
    ]);
    if (
      directory
        .listLeafNames()
        .some((leaf) =>
          (RECOVERY_STAGE_LEAVES as readonly string[]).includes(leaf),
        )
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_ACTIVE');
    }
  } finally {
    directory.close();
  }
}

function createRecoveryJournal(
  initialState: RecoveryJournalState,
): ReviewPlannerV8ProductAcceptanceRecoveryJournal {
  const journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal =
    Object.freeze({
      appendStage(leaf, contents) {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['product', 'recovery'],
        );
        if (!RECOVERY_STAGE_LEAVES.includes(leaf)) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
        }
        assertOnlyRecoveryLeaves(state.directory, [
          'owner.lock',
          'recovery-manifest.json',
          ...RECOVERY_STAGE_LEAVES,
        ]);
        const leaves = state.directory.listLeafNames();
        if (leaf === 'restore.claimed') {
          if (contents !== '') {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
        } else if (leaf === 'restore.verified.json') {
          if (
            !leaves.includes('restore.claimed') ||
            !parseRecoveryStage(recoveryRestoreSchema, contents)
          ) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
        } else if (leaf === 'cleanup.claimed') {
          if (contents !== '' || !leaves.includes('restore.verified.json')) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
        } else if (
          !leaves.includes('cleanup.claimed') ||
          !parseRecoveryStage(recoveryCleanupSchema, contents)
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
        }
        publish(
          state.directory,
          leaf,
          contents,
          'V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_IO',
        );
      },
      async finalizeRecoveryOnly() {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['recovery'],
        );
        assertOnlyRecoveryLeaves(state.directory, [
          'owner.lock',
          'recovery-manifest.json',
          ...RECOVERY_STAGE_LEAVES,
        ]);
        const recoveryLeaves = state.directory.listLeafNames();
        if (
          !RECOVERY_STAGE_LEAVES.every((leaf) => recoveryLeaves.includes(leaf))
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_INCOMPLETE');
        }
        recoveryManifestSchema.parse(
          JSON.parse(
            state.directory
              .readRegularFile('recovery-manifest.json')
              .toString(),
          ),
        );
        recoveryRestoreSchema.parse(
          JSON.parse(
            state.directory.readRegularFile('restore.verified.json').toString(),
          ),
        );
        recoveryCleanupSchema.parse(
          JSON.parse(
            state.directory.readRegularFile('cleanup.verified.json').toString(),
          ),
        );

        const publicDirectory = await openWindowsNoReparseDirectory(
          state.repoRoot,
          [
            'docs',
            'acceptance',
            'evidence',
            'phase-6-9-5-v8-product-acceptance',
            state.environment,
          ],
        );
        try {
          publicDirectory.assertLocalFixedNtfsVolume();
          const publicLeaves = publicDirectory.listLeafNames();
          if (
            !publicLeaves.includes('.acceptance-reserved') ||
            publicLeaves.includes('.acceptance-success') ||
            publicLeaves.includes('.recovery-only.json') ||
            publicLeaves.includes('acceptance.json') ||
            publicLeaves.some((leaf) => !isKnownPublicLeaf(leaf))
          ) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_TERMINAL_INVALID');
          }
          const terminal = recoveryTerminalSchema.parse({
            schemaVersion:
              'phase-6.9.5-v8-product-acceptance-recovery-terminal-v1',
            environment: state.environment,
            status: 'failed',
            reason: 'hard_crash_recovered',
            providerInvocations: 0,
            recoveryManifestSha256: sha256(
              state.directory.readRegularFile('recovery-manifest.json'),
            ),
            restoreReceiptSha256: sha256(
              state.directory.readRegularFile('restore.verified.json'),
            ),
            cleanupReceiptSha256: sha256(
              state.directory.readRegularFile('cleanup.verified.json'),
            ),
          });
          publish(
            publicDirectory,
            '.recovery-only.json',
            `${JSON.stringify(terminal)}\n`,
            'V8_PRODUCT_ACCEPTANCE_RECOVERY_TERMINAL_IO',
          );
        } finally {
          publicDirectory.close();
        }
      },
      close() {
        const state = journalState.get(journal);
        if (!state || state.closed) return;
        state.closed = true;
        state.directory.close();
      },
    });
  journalState.set(journal, initialState);
  return journal;
}

function requireJournalState(
  journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal,
) {
  const state = journalState.get(journal);
  if (!state || state.closed) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_JOURNAL_CLOSED');
  }
  return state;
}

function parseRecoveryStage<T>(schema: z.ZodType<T>, contents: string) {
  try {
    return schema.safeParse(JSON.parse(contents)).success;
  } catch {
    return false;
  }
}

function isKnownPublicLeaf(leaf: string) {
  return (
    leaf === '.acceptance-reserved' ||
    leaf === 'manifest.json' ||
    /^\.slot-0[1-4]-(?:review|planner)-(?:api|browser)(?:\.result\.json)?$/.test(
      leaf,
    ) ||
    leaf === '.review-default-off.json' ||
    leaf === '.planner-default-off.json' ||
    leaf === '.owner-isolation-verified.json' ||
    leaf === '.cleanup-verified.json' ||
    leaf === 'plan.png' ||
    leaf === 'today.png'
  );
}

function sha256(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function assertOnlyRecoveryLeaves(
  directory: WindowsNoReparseChildDirectory,
  allowed: readonly string[],
) {
  if (directory.listLeafNames().some((leaf) => !allowed.includes(leaf))) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function publish(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  contents: string,
  errorCode: string,
) {
  const result = directory.commitExclusiveDurableFileViaRename(leaf, contents);
  if (!result.committed || result.cleanupStatus !== 'closed') {
    throw new Error(errorCode);
  }
}

function isEnvironment(
  value: unknown,
): value is ReviewPlannerV8ProductAcceptanceEnvironment {
  return value === 'branch' || value === 'main';
}

function isRole(
  value: unknown,
): value is ReviewPlannerV8ProductAcceptanceOwnerRole {
  return value === 'product' || value === 'recovery';
}

function sanitizeOwnerError(error: unknown) {
  if (
    error instanceof Error &&
    /^V8_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
  ) {
    return error;
  }
  return new Error('V8_PRODUCT_ACCEPTANCE_OWNER_IO');
}
