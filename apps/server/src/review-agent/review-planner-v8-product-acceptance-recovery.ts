import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceProfile,
} from './review-planner-product-acceptance-profile';

export type ReviewPlannerV8ProductAcceptanceEnvironment = 'branch' | 'main';
export type ReviewPlannerV8ProductAcceptanceOwnerRole = 'product' | 'recovery';

export type ReviewPlannerV8ProductAcceptanceOwner = Readonly<{
  assertHeld(): void;
  close(): void;
}>;

type OwnerState = {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  profile: ReviewPlannerProductAcceptanceProfile;
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

function assertRecoveryManifestProfile(
  manifest: z.infer<typeof recoveryManifestSchema>,
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  if (
    manifest.publicLedgerPath !==
      profile.publicLedgerPath(manifest.environment) ||
    manifest.browserProfilePath !==
      profile.browserProfilePath(manifest.environment)
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID');
  }
  return manifest;
}

const RECOVERY_STAGE_LEAVES = Object.freeze([
  'restore.claimed',
  'restore.verified.json',
  'cleanup.claimed',
  'cleanup.verified.json',
] as const);
type RecoveryStageLeaf = (typeof RECOVERY_STAGE_LEAVES)[number];
const RECOVERY_BINDING_LEAVES = Object.freeze([
  'account-review.json',
  'account-planner.json',
] as const);
type RecoveryBindingComponent = 'review' | 'planner';
const RECOVERY_MODE_LEAF = 'mode.json' as const;
const recoveryModeSchema = z.discriminatedUnion('mode', [
  z
    .object({
      schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-mode-v1'),
      environment: z.enum(['branch', 'main']),
      mode: z.literal('recovery'),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-mode-v1'),
      environment: z.enum(['branch', 'main']),
      mode: z.literal('preseal'),
      pairedEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
      acceptanceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
]);

const recoveryAccountBindingSchema = z
  .object({
    component: z.enum(['review', 'planner']),
    email: z.string().email().max(254),
    accountId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
  })
  .strict();

const KNOWN_PUBLIC_LEAVES = new Set([
  '.acceptance-reserved',
  'manifest.json',
  '.slot-01-review-api',
  '.slot-01-review-api.result.json',
  '.slot-02-review-browser',
  '.slot-02-review-browser.result.json',
  '.review-default-off.json',
  '.slot-03-planner-api',
  '.slot-03-planner-api.result.json',
  '.slot-04-planner-browser',
  '.slot-04-planner-browser.result.json',
  '.planner-default-off.json',
  '.owner-isolation-verified.json',
  '.cleanup-verified.json',
  '.recovery-only.json',
  'acceptance.json',
  '.acceptance-success',
  'plan.png',
  'today.png',
]);

export const reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-default-off-v2',
    ),
    component: z.enum(['review', 'planner', 'recovery']),
    container: z
      .object({
        previousIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
        newIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
        healthContainerIdSha256: z.string().regex(/^[a-f0-9]{64}$/),
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
        message: 'DEFAULT_OFF_CONTAINER_BINDING_INVALID',
      });
    }
  });

const recoveryRestoreSchema =
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.refine(
    (value) => value.component === 'recovery',
  );

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
  profile: ReviewPlannerProductAcceptanceProfile;
  directory: WindowsNoReparseChildDirectory;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  closed: boolean;
  authorized: boolean;
  authority: ReviewPlannerV8RecoveryAuthority | null;
  authorizationAttempt: object | null;
  authorizationPromise: Promise<ReviewPlannerV8RecoveryAuthority> | null;
  publicDirectory: WindowsNoReparseChildDirectory | null;
  bindingPublicDirectory: WindowsNoReparseChildDirectory | null;
};

export type ReviewPlannerV8RecoveryAuthority = Readonly<{
  assertAuthorized(): void;
}>;

export type ReviewPlannerV8ProductAcceptanceRecoveryJournal = Readonly<{
  snapshot(): ReviewPlannerV8ProductAcceptanceRecoverySnapshot;
  bindAccount(input: {
    component: RecoveryBindingComponent;
    email: string;
    accountId: string;
  }): void;
  authorizeRecoveryOnly(): Promise<ReviewPlannerV8RecoveryAuthority>;
  appendStage(leaf: RecoveryStageLeaf, contents: string): void;
  finalizeRecoveryOnly(): Promise<void>;
  close(): void;
}>;

export type ReviewPlannerV8ProductAcceptanceRecoverySnapshot = Readonly<{
  manifest: Readonly<
    Omit<
      z.infer<typeof recoveryManifestSchema>,
      'syntheticEmails' | 'fixtureIds'
    > & {
      syntheticEmails: Readonly<
        z.infer<typeof recoveryManifestSchema>['syntheticEmails']
      >;
      fixtureIds: readonly string[];
    }
  >;
  bindings: Readonly<
    Partial<
      Record<
        RecoveryBindingComponent,
        z.infer<typeof recoveryAccountBindingSchema>
      >
    >
  >;
  mode: Readonly<z.infer<typeof recoveryModeSchema>> | null;
  stages: Readonly<{
    restoreClaimed: boolean;
    restoreVerified: boolean;
    cleanupClaimed: boolean;
    cleanupVerified: boolean;
  }>;
}>;

const journalState = new WeakMap<
  ReviewPlannerV8ProductAcceptanceRecoveryJournal,
  RecoveryJournalState
>();

export async function acquireReviewPlannerV8ProductAcceptanceOwner(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV8ProductAcceptanceOwnerRole;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV8ProductAcceptanceOwner;
    }>
  | Readonly<{ status: 'owner_active' }>
> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  if (!isEnvironment(input.environment) || !isRole(input.role)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_INPUT_INVALID');
  }
  const directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
    ...profile.recoverySegments(input.environment),
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
      profile,
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
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
): void {
  const state = ownerState.get(owner);
  if (
    !state ||
    state.closed ||
    state.environment !== environment ||
    state.profile !== profile ||
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
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  assertReviewPlannerV8ProductAcceptanceOwner(
    input.owner,
    input.environment,
    ['product'],
    profile,
  );
  const parsed = recoveryManifestSchema.safeParse(input.manifest);
  if (!parsed.success || parsed.data.environment !== input.environment) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID');
  }
  assertRecoveryManifestProfile(parsed.data, profile);
  const directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
    ...profile.recoverySegments(input.environment),
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
      profile,
      directory,
      owner: input.owner,
      closed: false,
      authorized: false,
      authority: null,
      authorizationAttempt: null,
      authorizationPromise: null,
      publicDirectory: null,
      bindingPublicDirectory: await openWindowsNoReparseExistingFrozenDirectory(
        input.repoRoot,
        [...profile.publicLedgerSegments(input.environment)],
      ),
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
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  assertReviewPlannerV8ProductAcceptanceOwner(
    input.owner,
    input.environment,
    ['recovery'],
    profile,
  );
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [...profile.recoverySegments(input.environment)],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
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
    assertRecoveryManifestProfile(parsed, profile);
    return createRecoveryJournal({
      repoRoot: input.repoRoot,
      environment: input.environment,
      profile,
      directory,
      owner: input.owner,
      closed: false,
      authorized: false,
      authority: null,
      authorizationAttempt: null,
      authorizationPromise: null,
      publicDirectory: null,
      bindingPublicDirectory: null,
    });
  } catch {
    directory.close();
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

export async function hasReviewPlannerV8ProductAcceptanceRecoveryManifest(
  repoRoot: string,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
): Promise<boolean> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    repoRoot,
    [...profile.recoverySegments(environment)],
  );
  try {
    const leaves = directory.listLeafNames();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
      ...RECOVERY_STAGE_LEAVES,
    ]);
    if (!leaves.includes('recovery-manifest.json')) return false;
    const parsed = recoveryManifestSchema.safeParse(
      JSON.parse(
        directory.readRegularFile('recovery-manifest.json').toString(),
      ),
    );
    return (
      parsed.success &&
      parsed.data.environment === environment &&
      (() => {
        assertRecoveryManifestProfile(parsed.data, profile);
        return true;
      })()
    );
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export async function assertReviewPlannerV8ProductAcceptanceRecoveryClear(
  repoRoot: string,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
): Promise<void> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    repoRoot,
    [...profile.recoverySegments(environment)],
  );
  try {
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
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

export async function verifyReviewPlannerV8ProductAcceptanceRecoveryTerminal(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  terminal: unknown;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<void> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  const terminal = recoveryTerminalSchema.parse(input.terminal);
  if (terminal.environment !== input.environment) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [...profile.recoverySegments(input.environment)],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const expectedLeaves = [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_STAGE_LEAVES,
    ];
    assertOnlyRecoveryLeaves(directory, [
      ...expectedLeaves,
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
    ]);
    requireRecoveryMode(directory, input.environment);
    const leaves = directory.listLeafNames();
    if (
      !expectedLeaves.every((leaf) => leaves.includes(leaf)) ||
      directory.readRegularFile('restore.claimed').byteLength !== 0 ||
      directory.readRegularFile('cleanup.claimed').byteLength !== 0
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    const manifestBytes = directory.readRegularFile('recovery-manifest.json');
    const restoreBytes = directory.readRegularFile('restore.verified.json');
    const cleanupBytes = directory.readRegularFile('cleanup.verified.json');
    const manifest = recoveryManifestSchema.parse(
      JSON.parse(manifestBytes.toString()),
    );
    assertRecoveryManifestProfile(manifest, profile);
    recoveryRestoreSchema.parse(JSON.parse(restoreBytes.toString()));
    recoveryCleanupSchema.parse(JSON.parse(cleanupBytes.toString()));
    if (
      manifest.environment !== input.environment ||
      terminal.recoveryManifestSha256 !== sha256(manifestBytes) ||
      terminal.restoreReceiptSha256 !== sha256(restoreBytes) ||
      terminal.cleanupReceiptSha256 !== sha256(cleanupBytes)
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export async function claimReviewPlannerV8ProductAcceptancePresealMode(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  pairedEvidenceSha256: string;
  acceptanceSha256: string;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<Readonly<{ modeSha256: string }>> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  assertReviewPlannerV8ProductAcceptanceOwner(
    input.owner,
    input.environment,
    ['recovery'],
    profile,
  );
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [...profile.recoverySegments(input.environment)],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
      ...RECOVERY_STAGE_LEAVES,
    ]);
    const manifest = recoveryManifestSchema.parse(
      JSON.parse(
        directory.readRegularFile('recovery-manifest.json').toString(),
      ),
    );
    assertRecoveryManifestProfile(manifest, profile);
    if (manifest.environment !== input.environment) throw new Error();
    const stages = validateRecoveryStages(directory);
    if (stages.some(Boolean)) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_MODE_CONFLICT');
    }
    const record = recoveryModeSchema.parse({
      schemaVersion: 'phase-6.9.5-v8-product-acceptance-mode-v1',
      environment: input.environment,
      mode: 'preseal',
      pairedEvidenceSha256: input.pairedEvidenceSha256,
      acceptanceSha256: input.acceptanceSha256,
    });
    return Object.freeze({
      modeSha256: claimMode(
        directory,
        record,
        'V8_PRODUCT_ACCEPTANCE_PRESEAL_MODE_CONFLICT',
      ),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'V8_PRODUCT_ACCEPTANCE_PRESEAL_MODE_CONFLICT'
    ) {
      throw error;
    }
    throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_MODE_CONFLICT');
  } finally {
    directory.close();
  }
}

export async function readReviewPlannerV8ProductAcceptanceLocalMode(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<
  Readonly<{
    mode: Readonly<z.infer<typeof recoveryModeSchema>> | null;
    modeSha256: string | null;
    stagesPresent: boolean;
  }>
> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [...profile.recoverySegments(input.environment)],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertOnlyRecoveryLeaves(directory, [
      'owner.lock',
      'recovery-manifest.json',
      ...RECOVERY_BINDING_LEAVES,
      RECOVERY_MODE_LEAF,
      ...RECOVERY_STAGE_LEAVES,
    ]);
    const stages = validateRecoveryStages(directory);
    const mode = readMode(directory, input.environment);
    return Object.freeze({
      mode: mode === null ? null : Object.freeze({ ...mode }),
      modeSha256:
        mode === null
          ? null
          : sha256(directory.readRegularFile(RECOVERY_MODE_LEAF)),
      stagesPresent: stages.some(Boolean),
    });
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

function createRecoveryJournal(
  initialState: RecoveryJournalState,
): ReviewPlannerV8ProductAcceptanceRecoveryJournal {
  const journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal =
    Object.freeze({
      snapshot() {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['product', 'recovery'],
          state.profile,
        );
        return snapshotRecoveryState(state);
      },
      bindAccount(input) {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['product'],
          state.profile,
        );
        const parsed = recoveryAccountBindingSchema.safeParse(input);
        if (!parsed.success || parsed.data.component !== input.component) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
        }
        const snapshot = snapshotRecoveryState(state);
        if (
          snapshot.mode !== null ||
          Object.values(snapshot.stages).some(Boolean)
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
        }
        const publicDirectory = state.bindingPublicDirectory;
        if (publicDirectory === null) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
        }
        const publicLeaves = publicDirectory.listLeafNames();
        if (
          publicLeaves.includes('.acceptance-success') ||
          publicLeaves.includes('.recovery-only.json') ||
          publicLeaves.some((leaf) => !KNOWN_PUBLIC_LEAVES.has(leaf))
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
        }
        if (
          parsed.data.email !==
          snapshot.manifest.syntheticEmails[parsed.data.component]
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
        }
        const leaf = `account-${parsed.data.component}.json` as const;
        if (state.directory.listLeafNames().includes(leaf)) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_EXISTS');
        }
        publish(
          state.directory,
          leaf,
          `${JSON.stringify(parsed.data)}\n`,
          'V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_IO',
        );
      },
      authorizeRecoveryOnly() {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['recovery'],
          state.profile,
        );
        if (state.authorized && state.authority !== null) {
          return Promise.resolve(state.authority);
        }
        if (state.authorizationPromise !== null) {
          return state.authorizationPromise;
        }
        const authorizationAttempt = Object.freeze({});
        state.authorizationAttempt = authorizationAttempt;
        const pending = (async () => {
          let publicDirectory: WindowsNoReparseChildDirectory | null = null;
          try {
            publicDirectory = await openWindowsNoReparseExistingFrozenDirectory(
              state.repoRoot,
              [...state.profile.publicLedgerSegments(state.environment)],
            );
            const current = requireJournalState(journal);
            assertReviewPlannerV8ProductAcceptanceOwner(
              current.owner,
              current.environment,
              ['recovery'],
              current.profile,
            );
            if (
              current.authorizationAttempt !== authorizationAttempt ||
              current.authorized ||
              current.publicDirectory !== null
            ) {
              throw new Error(
                'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
              );
            }
            publicDirectory.assertLocalFixedNtfsVolume();
            const leaves = publicDirectory.listLeafNames();
            if (
              !leaves.includes('.acceptance-reserved') ||
              leaves.includes('.acceptance-success') ||
              leaves.includes('.recovery-only.json') ||
              leaves.some((leaf) => !isKnownPublicLeaf(leaf))
            ) {
              throw new Error(
                'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
              );
            }
            claimMode(
              current.directory,
              {
                schemaVersion: 'phase-6.9.5-v8-product-acceptance-mode-v1',
                environment: current.environment,
                mode: 'recovery',
              },
              'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
            );
            const authority: ReviewPlannerV8RecoveryAuthority = Object.freeze({
              assertAuthorized() {
                const latest = requireJournalState(journal);
                assertReviewPlannerV8ProductAcceptanceOwner(
                  latest.owner,
                  latest.environment,
                  ['recovery'],
                  latest.profile,
                );
                if (!latest.authorized || latest.authority !== authority) {
                  throw new Error(
                    'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
                  );
                }
                requireRecoveryMode(latest.directory, latest.environment);
              },
            });
            current.authorized = true;
            current.authority = authority;
            current.publicDirectory = publicDirectory;
            publicDirectory = null;
            return authority;
          } catch (error) {
            publicDirectory?.close();
            throw error;
          } finally {
            const current = journalState.get(journal);
            if (current?.authorizationAttempt === authorizationAttempt) {
              current.authorizationAttempt = null;
              current.authorizationPromise = null;
            }
          }
        })();
        state.authorizationPromise = pending;
        return pending;
      },
      appendStage(leaf, contents) {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['recovery'],
          state.profile,
        );
        if (!state.authorized) {
          throw new Error(
            'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
          );
        }
        requireRecoveryMode(state.directory, state.environment);
        if (!RECOVERY_STAGE_LEAVES.includes(leaf)) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
        }
        assertOnlyRecoveryLeaves(state.directory, [
          'owner.lock',
          'recovery-manifest.json',
          ...RECOVERY_BINDING_LEAVES,
          RECOVERY_MODE_LEAF,
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
      finalizeRecoveryOnly() {
        const state = requireJournalState(journal);
        assertReviewPlannerV8ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['recovery'],
          state.profile,
        );
        if (!state.authorized) {
          throw new Error(
            'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
          );
        }
        requireRecoveryMode(state.directory, state.environment);
        assertOnlyRecoveryLeaves(state.directory, [
          'owner.lock',
          'recovery-manifest.json',
          ...RECOVERY_BINDING_LEAVES,
          RECOVERY_MODE_LEAF,
          ...RECOVERY_STAGE_LEAVES,
        ]);
        const recoveryLeaves = state.directory.listLeafNames();
        if (
          !RECOVERY_STAGE_LEAVES.every((leaf) => recoveryLeaves.includes(leaf))
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_INCOMPLETE');
        }
        const manifest = recoveryManifestSchema.parse(
          JSON.parse(
            state.directory
              .readRegularFile('recovery-manifest.json')
              .toString(),
          ),
        );
        assertRecoveryManifestProfile(manifest, state.profile);
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

        const publicDirectory = state.publicDirectory;
        if (publicDirectory === null) {
          throw new Error(
            'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
          );
        }
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
        return Promise.resolve();
      },
      close() {
        const state = journalState.get(journal);
        if (!state || state.closed) return;
        state.closed = true;
        state.authorized = false;
        state.authority = null;
        state.authorizationAttempt = null;
        try {
          state.publicDirectory?.close();
        } finally {
          try {
            state.bindingPublicDirectory?.close();
          } finally {
            state.directory.close();
          }
        }
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

function snapshotRecoveryState(
  state: RecoveryJournalState,
): ReviewPlannerV8ProductAcceptanceRecoverySnapshot {
  assertOnlyRecoveryLeaves(state.directory, [
    'owner.lock',
    'recovery-manifest.json',
    ...RECOVERY_BINDING_LEAVES,
    RECOVERY_MODE_LEAF,
    ...RECOVERY_STAGE_LEAVES,
  ]);
  try {
    const manifest = recoveryManifestSchema.parse(
      JSON.parse(
        state.directory.readRegularFile('recovery-manifest.json').toString(),
      ),
    );
    if (manifest.environment !== state.environment) throw new Error();
    assertRecoveryManifestProfile(manifest, state.profile);
    const leaves = state.directory.listLeafNames();
    const orderedStages = RECOVERY_STAGE_LEAVES.map((leaf) =>
      leaves.includes(leaf),
    );
    let missingSeen = false;
    for (const present of orderedStages) {
      if (!present) missingSeen = true;
      else if (missingSeen) throw new Error();
    }
    if (
      orderedStages[0] &&
      state.directory.readRegularFile('restore.claimed').byteLength !== 0
    ) {
      throw new Error();
    }
    if (orderedStages[1]) {
      const receipt = recoveryRestoreSchema.parse(
        JSON.parse(
          state.directory.readRegularFile('restore.verified.json').toString(),
        ),
      );
      if (receipt.component !== 'recovery') throw new Error();
    }
    if (
      orderedStages[2] &&
      state.directory.readRegularFile('cleanup.claimed').byteLength !== 0
    ) {
      throw new Error();
    }
    if (orderedStages[3]) {
      recoveryCleanupSchema.parse(
        JSON.parse(
          state.directory.readRegularFile('cleanup.verified.json').toString(),
        ),
      );
    }
    const mode = leaves.includes(RECOVERY_MODE_LEAF)
      ? recoveryModeSchema.parse(
          JSON.parse(
            state.directory.readRegularFile(RECOVERY_MODE_LEAF).toString(),
          ),
        )
      : null;
    if (mode !== null && mode.environment !== state.environment) {
      throw new Error();
    }
    const bindings: Partial<
      Record<
        RecoveryBindingComponent,
        z.infer<typeof recoveryAccountBindingSchema>
      >
    > = {};
    for (const component of ['review', 'planner'] as const) {
      const leaf = `account-${component}.json` as const;
      if (!leaves.includes(leaf)) continue;
      const binding = recoveryAccountBindingSchema.parse(
        JSON.parse(state.directory.readRegularFile(leaf).toString()),
      );
      if (
        binding.component !== component ||
        binding.email !== manifest.syntheticEmails[component]
      ) {
        throw new Error();
      }
      bindings[component] = Object.freeze({ ...binding });
    }
    return Object.freeze({
      manifest: Object.freeze({
        ...manifest,
        syntheticEmails: Object.freeze({ ...manifest.syntheticEmails }),
        fixtureIds: Object.freeze([...manifest.fixtureIds]),
      }),
      bindings: Object.freeze(bindings),
      mode: mode === null ? null : Object.freeze({ ...mode }),
      stages: Object.freeze({
        restoreClaimed: leaves.includes('restore.claimed'),
        restoreVerified: leaves.includes('restore.verified.json'),
        cleanupClaimed: leaves.includes('cleanup.claimed'),
        cleanupVerified: leaves.includes('cleanup.verified.json'),
      }),
    });
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function parseRecoveryStage<T>(schema: z.ZodType<T>, contents: string) {
  try {
    return schema.safeParse(JSON.parse(contents)).success;
  } catch {
    return false;
  }
}

function claimMode(
  directory: WindowsNoReparseChildDirectory,
  value: z.infer<typeof recoveryModeSchema>,
  conflictCode: string,
) {
  const contents = `${JSON.stringify(value)}\n`;
  const leaves = directory.listLeafNames();
  if (leaves.includes(RECOVERY_MODE_LEAF)) {
    const existing = directory.readRegularFile(RECOVERY_MODE_LEAF);
    let parsed: z.infer<typeof recoveryModeSchema>;
    try {
      parsed = recoveryModeSchema.parse(JSON.parse(existing.toString()));
    } catch {
      throw new Error(conflictCode);
    }
    if (JSON.stringify(parsed) !== JSON.stringify(value)) {
      throw new Error(conflictCode);
    }
    return sha256(existing);
  }
  publish(directory, RECOVERY_MODE_LEAF, contents, conflictCode);
  return sha256(Buffer.from(contents));
}

function readMode(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
) {
  if (!directory.listLeafNames().includes(RECOVERY_MODE_LEAF)) return null;
  const mode = recoveryModeSchema.parse(
    JSON.parse(directory.readRegularFile(RECOVERY_MODE_LEAF).toString()),
  );
  if (mode.environment !== environment) throw new Error();
  return mode;
}

function requireRecoveryMode(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
) {
  const mode = readMode(directory, environment);
  if (mode?.mode !== 'recovery') {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID');
  }
}

function validateRecoveryStages(directory: WindowsNoReparseChildDirectory) {
  const leaves = directory.listLeafNames();
  const stages = RECOVERY_STAGE_LEAVES.map((leaf) => leaves.includes(leaf));
  let missingSeen = false;
  for (const present of stages) {
    if (!present) missingSeen = true;
    else if (missingSeen) throw new Error();
  }
  if (
    stages[0] &&
    directory.readRegularFile('restore.claimed').byteLength !== 0
  ) {
    throw new Error();
  }
  if (stages[1]) {
    const receipt = recoveryRestoreSchema.parse(
      JSON.parse(directory.readRegularFile('restore.verified.json').toString()),
    );
    if (receipt.component !== 'recovery') throw new Error();
  }
  if (
    stages[2] &&
    directory.readRegularFile('cleanup.claimed').byteLength !== 0
  ) {
    throw new Error();
  }
  if (stages[3]) {
    recoveryCleanupSchema.parse(
      JSON.parse(directory.readRegularFile('cleanup.verified.json').toString()),
    );
  }
  return stages;
}

function isKnownPublicLeaf(leaf: string) {
  return KNOWN_PUBLIC_LEAVES.has(leaf);
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
