import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  normalizeReviewPlannerProductAcceptanceSchemaRecord,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceProfile,
  type ReviewPlannerProductAcceptanceSchemaKey,
  withReviewPlannerProductAcceptanceSchemaIdentity,
} from './review-planner-product-acceptance-profile';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS,
  parseReviewPlannerV11ProductAcceptanceCheckpoint,
  parseReviewPlannerV11ProductAcceptanceFailure,
  readReviewPlannerV11ProductAcceptanceCheckpoints,
  type ReviewPlannerV11ProductAcceptanceCheckpointRecord,
  type ReviewPlannerV11ProductAcceptanceFailureRecord,
} from './review-planner-v11-product-acceptance-diagnostics';

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
  runtimeDirectory: WindowsNoReparseChildDirectory;
  runtimeLock: WindowsExclusiveLifetimeFile;
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
  let runtimeDirectory: WindowsNoReparseChildDirectory | null = null;
  let lock: WindowsExclusiveLifetimeFile | null = null;
  let runtimeLock: WindowsExclusiveLifetimeFile | null = null;
  try {
    directory.assertLocalFixedNtfsVolume();
    runtimeDirectory = await openWindowsNoReparseFrozenDirectory(
      input.repoRoot,
      sharedRuntimeOwnerSegments(),
    );
    runtimeDirectory.assertLocalFixedNtfsVolume();
    lock = directory.tryAcquireExclusiveLifetimeFile('owner.lock');
    if (lock === null) {
      closeAcquisitionResources([runtimeDirectory, directory]);
      return Object.freeze({ status: 'owner_active' as const });
    }
    runtimeLock =
      runtimeDirectory.tryAcquireExclusiveLifetimeFile('owner.lock');
    if (runtimeLock === null) {
      closeAcquisitionResources([lock, runtimeDirectory, directory]);
      return Object.freeze({ status: 'owner_active' as const });
    }
    const owner: ReviewPlannerV8ProductAcceptanceOwner = Object.freeze({
      assertHeld() {
        const state = ownerState.get(owner);
        if (!state || state.closed) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_CLOSED');
        }
        state.lock.assertHeld();
        state.runtimeLock.assertHeld();
      },
      close() {
        const state = ownerState.get(owner);
        if (!state || state.closed) return;
        state.closed = true;
        try {
          state.runtimeLock.close();
        } finally {
          try {
            state.runtimeDirectory.close();
          } finally {
            try {
              state.lock.close();
            } finally {
              state.directory.close();
            }
          }
        }
      },
    });
    ownerState.set(owner, {
      environment: input.environment,
      profile,
      role: input.role,
      directory,
      lock,
      runtimeDirectory,
      runtimeLock,
      closed: false,
    });
    runtimeDirectory = null;
    lock = null;
    runtimeLock = null;
    return Object.freeze({ status: 'acquired' as const, owner });
  } catch (error) {
    closeAcquisitionResourcesIgnoringFailures([
      runtimeLock,
      lock,
      runtimeDirectory,
      directory,
    ]);
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
  const parsed = safeParseProfileRecord(
    recoveryManifestSchema,
    profile,
    'recoveryManifest',
    input.manifest,
  );
  if (
    parsed === null ||
    !parsed.success ||
    parsed.data.environment !== input.environment
  ) {
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
      serializeProfileRecord(profile, 'recoveryManifest', parsed.data),
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
    const parsed = readProfileRecord(
      directory,
      'recovery-manifest.json',
      recoveryManifestSchema,
      profile,
      'recoveryManifest',
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
    const parsed = safeReadProfileRecord(
      directory,
      'recovery-manifest.json',
      recoveryManifestSchema,
      profile,
      'recoveryManifest',
    );
    return (
      parsed !== null &&
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
    requireRecoveryMode(directory, input.environment, profile);
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
    const manifest = parseProfileRecord(
      recoveryManifestSchema,
      profile,
      'recoveryManifest',
      JSON.parse(manifestBytes.toString()),
    );
    assertRecoveryManifestProfile(manifest, profile);
    parseProfileRecord(
      recoveryRestoreSchema,
      profile,
      'defaultOff',
      JSON.parse(restoreBytes.toString()),
    );
    parseProfileRecord(
      recoveryCleanupSchema,
      profile,
      'recoveryCleanup',
      JSON.parse(cleanupBytes.toString()),
    );
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
    const manifest = readProfileRecord(
      directory,
      'recovery-manifest.json',
      recoveryManifestSchema,
      profile,
      'recoveryManifest',
    );
    assertRecoveryManifestProfile(manifest, profile);
    if (manifest.environment !== input.environment) throw new Error();
    const stages = validateRecoveryStages(directory, profile);
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
        profile,
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
    const stages = validateRecoveryStages(directory, profile);
    const mode = readMode(directory, input.environment, profile);
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
              current.profile,
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
                requireRecoveryMode(
                  latest.directory,
                  latest.environment,
                  latest.profile,
                );
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
        requireRecoveryMode(state.directory, state.environment, state.profile);
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
        let persistedContents = contents;
        if (leaf === 'restore.claimed') {
          if (contents !== '') {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
        } else if (leaf === 'restore.verified.json') {
          const receipt = parseRecoveryStage(
            recoveryRestoreSchema,
            state.profile,
            'defaultOff',
            contents,
          );
          if (!leaves.includes('restore.claimed') || receipt === null) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
          persistedContents = serializeProfileRecord(
            state.profile,
            'defaultOff',
            receipt,
          );
        } else if (leaf === 'cleanup.claimed') {
          if (contents !== '' || !leaves.includes('restore.verified.json')) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
        } else {
          const receipt = parseRecoveryStage(
            recoveryCleanupSchema,
            state.profile,
            'recoveryCleanup',
            contents,
          );
          if (!leaves.includes('cleanup.claimed') || receipt === null) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
          }
          persistedContents = serializeProfileRecord(
            state.profile,
            'recoveryCleanup',
            receipt,
          );
        }
        publish(
          state.directory,
          leaf,
          persistedContents,
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
        requireRecoveryMode(state.directory, state.environment, state.profile);
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
        const manifest = readProfileRecord(
          state.directory,
          'recovery-manifest.json',
          recoveryManifestSchema,
          state.profile,
          'recoveryManifest',
        );
        assertRecoveryManifestProfile(manifest, state.profile);
        readProfileRecord(
          state.directory,
          'restore.verified.json',
          recoveryRestoreSchema,
          state.profile,
          'defaultOff',
        );
        readProfileRecord(
          state.directory,
          'cleanup.verified.json',
          recoveryCleanupSchema,
          state.profile,
          'recoveryCleanup',
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
          serializeProfileRecord(state.profile, 'recoveryTerminal', terminal),
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
    const manifest = readProfileRecord(
      state.directory,
      'recovery-manifest.json',
      recoveryManifestSchema,
      state.profile,
      'recoveryManifest',
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
      const receipt = readProfileRecord(
        state.directory,
        'restore.verified.json',
        recoveryRestoreSchema,
        state.profile,
        'defaultOff',
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
      readProfileRecord(
        state.directory,
        'cleanup.verified.json',
        recoveryCleanupSchema,
        state.profile,
        'recoveryCleanup',
      );
    }
    const mode = leaves.includes(RECOVERY_MODE_LEAF)
      ? readProfileRecord(
          state.directory,
          RECOVERY_MODE_LEAF,
          recoveryModeSchema,
          state.profile,
          'recoveryMode',
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

function parseProfileRecord<T>(
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: unknown,
): T {
  const normalized = normalizeReviewPlannerProductAcceptanceSchemaRecord(
    profile,
    key,
    value,
  );
  if (normalized === null) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
  return schema.parse(normalized);
}

function safeParseProfileRecord<T>(
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: unknown,
) {
  const normalized = normalizeReviewPlannerProductAcceptanceSchemaRecord(
    profile,
    key,
    value,
  );
  return normalized === null ? null : schema.safeParse(normalized);
}

function readProfileRecord<T>(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
) {
  return parseProfileRecord(
    schema,
    profile,
    key,
    JSON.parse(directory.readRegularFile(leaf).toString()),
  );
}

function safeReadProfileRecord<T>(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
) {
  try {
    return safeParseProfileRecord(
      schema,
      profile,
      key,
      JSON.parse(directory.readRegularFile(leaf).toString()),
    );
  } catch {
    return null;
  }
}

function serializeProfileRecord(
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: Record<string, unknown>,
) {
  return `${JSON.stringify(
    withReviewPlannerProductAcceptanceSchemaIdentity(profile, key, value),
  )}\n`;
}

function parseRecoveryStage<T>(
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  contents: string,
) {
  try {
    return parseProfileRecord(schema, profile, key, JSON.parse(contents));
  } catch {
    return null;
  }
}

function claimMode(
  directory: WindowsNoReparseChildDirectory,
  value: z.infer<typeof recoveryModeSchema>,
  profile: ReviewPlannerProductAcceptanceProfile,
  conflictCode: string,
) {
  const contents = serializeProfileRecord(profile, 'recoveryMode', value);
  const leaves = directory.listLeafNames();
  if (leaves.includes(RECOVERY_MODE_LEAF)) {
    const existing = directory.readRegularFile(RECOVERY_MODE_LEAF);
    let parsed: z.infer<typeof recoveryModeSchema>;
    try {
      parsed = parseProfileRecord(
        recoveryModeSchema,
        profile,
        'recoveryMode',
        JSON.parse(existing.toString()),
      );
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
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  if (!directory.listLeafNames().includes(RECOVERY_MODE_LEAF)) return null;
  const mode = readProfileRecord(
    directory,
    RECOVERY_MODE_LEAF,
    recoveryModeSchema,
    profile,
    'recoveryMode',
  );
  if (mode.environment !== environment) throw new Error();
  return mode;
}

function requireRecoveryMode(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  const mode = readMode(directory, environment, profile);
  if (mode?.mode !== 'recovery') {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID');
  }
}

function validateRecoveryStages(
  directory: WindowsNoReparseChildDirectory,
  profile: ReviewPlannerProductAcceptanceProfile,
) {
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
    const receipt = readProfileRecord(
      directory,
      'restore.verified.json',
      recoveryRestoreSchema,
      profile,
      'defaultOff',
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
    readProfileRecord(
      directory,
      'cleanup.verified.json',
      recoveryCleanupSchema,
      profile,
      'recoveryCleanup',
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

function closeAcquisitionResources(
  resources: readonly ({ close(): void } | null | undefined)[],
) {
  let failure: Error | undefined;
  for (const resource of resources) {
    if (!resource) continue;
    try {
      resource.close();
    } catch (error) {
      failure ??=
        error instanceof Error
          ? error
          : new Error('V8_PRODUCT_ACCEPTANCE_OWNER_IO');
    }
  }
  if (failure !== undefined) throw failure;
}

function closeAcquisitionResourcesIgnoringFailures(
  resources: readonly ({ close(): void } | null | undefined)[],
) {
  try {
    closeAcquisitionResources(resources);
  } catch {
    // The acquisition error remains authoritative after best-effort release.
  }
}

function sharedRuntimeOwnerSegments() {
  return ['.tmp', 'phase-6-9-5-product-acceptance-runtime'] as const;
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

const V11_OWNER_LOCK_LEAF = 'owner.lock';
const V11_ATTEMPT_BINDING_LEAF = 'attempt-binding.json';
const V11_CHECKPOINT_LEAF = /^checkpoint-(\d{3})-([a-z_]+)\.json$/;
const V11_ATTEMPT_ID = /^[a-f0-9]{64}$/;
const V11_ATTEMPT_HASH = /^[a-f0-9]{64}$/;
const V11_PUBLIC_ATTEMPT_LEAVES = Object.freeze([
  '.acceptance-reserved',
  '.failure.json',
] as const);

const v11AttemptBindingSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v11-product-acceptance-attempt-v1'),
    attemptId: z.string().regex(V11_ATTEMPT_ID),
    attemptSha256: z.string().regex(V11_ATTEMPT_HASH),
  })
  .strict()
  .superRefine((value, context) => {
    if (sha256(Buffer.from(value.attemptId)) !== value.attemptSha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attemptSha256'],
        message: 'ATTEMPT_HASH_INVALID',
      });
    }
  });

type V11AttemptBinding = z.infer<typeof v11AttemptBindingSchema>;

export type ReviewPlannerV11ProductAcceptanceOwnerRole = 'product' | 'recovery';

export type ReviewPlannerV11ProductAcceptanceOwner = Readonly<{
  assertHeld(): void;
  close(): void;
}>;

type V11OwnerState = {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV11ProductAcceptanceOwnerRole;
  directory: WindowsNoReparseChildDirectory;
  lock: WindowsExclusiveLifetimeFile;
  runtimeDirectory: WindowsNoReparseChildDirectory;
  runtimeLock: WindowsExclusiveLifetimeFile;
  attemptSha256: string | null;
  closed: boolean;
};

const v11OwnerState = new WeakMap<
  ReviewPlannerV11ProductAcceptanceOwner,
  V11OwnerState
>();

export async function acquireReviewPlannerV11ProductAcceptanceOwner(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV11ProductAcceptanceOwnerRole;
}): Promise<
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV11ProductAcceptanceOwner;
    }>
  | Readonly<{ status: 'owner_active' }>
> {
  if (!isEnvironment(input.environment) || !isV11OwnerRole(input.role)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_OWNER_INPUT_INVALID');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  let runtimeDirectory: WindowsNoReparseChildDirectory | null = null;
  let lock: WindowsExclusiveLifetimeFile | null = null;
  let runtimeLock: WindowsExclusiveLifetimeFile | null = null;
  try {
    directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    runtimeDirectory = await openWindowsNoReparseFrozenDirectory(
      input.repoRoot,
      sharedRuntimeOwnerSegments(),
    );
    runtimeDirectory.assertLocalFixedNtfsVolume();
    lock = directory.tryAcquireExclusiveLifetimeFile(V11_OWNER_LOCK_LEAF);
    if (lock === null) {
      runtimeDirectory.close();
      directory.close();
      return Object.freeze({ status: 'owner_active' as const });
    }
    runtimeLock =
      runtimeDirectory.tryAcquireExclusiveLifetimeFile('owner.lock');
    if (runtimeLock === null) {
      lock.close();
      runtimeDirectory.close();
      directory.close();
      return Object.freeze({ status: 'owner_active' as const });
    }
    const owner: ReviewPlannerV11ProductAcceptanceOwner = Object.freeze({
      assertHeld() {
        const state = v11OwnerState.get(owner);
        if (!state || state.closed) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_OWNER_CLOSED');
        }
        state.lock.assertHeld();
        state.runtimeLock.assertHeld();
      },
      close() {
        const state = v11OwnerState.get(owner);
        if (!state || state.closed) return;
        state.closed = true;
        try {
          state.runtimeLock.close();
        } finally {
          try {
            state.runtimeDirectory.close();
          } finally {
            try {
              state.lock.close();
            } finally {
              state.directory.close();
            }
          }
        }
      },
    });
    v11OwnerState.set(owner, {
      environment: input.environment,
      role: input.role,
      directory,
      lock,
      runtimeDirectory,
      runtimeLock,
      attemptSha256: null,
      closed: false,
    });
    runtimeDirectory = null;
    lock = null;
    runtimeLock = null;
    directory = null;
    return Object.freeze({ status: 'acquired' as const, owner });
  } catch (error) {
    closeAcquisitionResourcesIgnoringFailures([
      runtimeLock,
      lock,
      runtimeDirectory,
      directory,
    ]);
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_OWNER_IO');
  }
}

export function assertReviewPlannerV11ProductAcceptanceOwner(
  owner: ReviewPlannerV11ProductAcceptanceOwner,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  allowedRoles: readonly ReviewPlannerV11ProductAcceptanceOwnerRole[],
): void {
  const state = v11OwnerState.get(owner);
  if (
    !state ||
    state.closed ||
    state.environment !== environment ||
    !allowedRoles.includes(state.role)
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_OWNER_INVALID');
  }
  owner.assertHeld();
  state.runtimeLock.assertHeld();
}

export function registerReviewPlannerV11ProductAcceptanceOwnerAttempt(
  owner: ReviewPlannerV11ProductAcceptanceOwner,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  attemptSha256: string,
): void {
  assertReviewPlannerV11ProductAcceptanceOwner(owner, environment, ['product']);
  const state = v11OwnerState.get(owner);
  if (
    !state ||
    state.attemptSha256 !== null ||
    !V11_ATTEMPT_HASH.test(attemptSha256)
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  state.attemptSha256 = attemptSha256;
}

function assertReviewPlannerV11ProductAcceptanceOwnerAttempt(
  owner: ReviewPlannerV11ProductAcceptanceOwner,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  attemptSha256: string,
) {
  assertReviewPlannerV11ProductAcceptanceOwner(owner, environment, ['product']);
  const state = v11OwnerState.get(owner);
  if (!state || state.attemptSha256 !== attemptSha256) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
}

export async function bindReviewPlannerV11ProductAcceptanceAttempt(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
  attemptId: string;
}): Promise<Readonly<V11AttemptBinding>> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const expectedHash = sha256(Buffer.from(input.attemptId));
  if (!V11_ATTEMPT_ID.test(input.attemptId)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  const publicHash = await readReviewPlannerV11ProductAcceptanceAttemptHash({
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  if (publicHash !== expectedHash) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertV11CheckpointLeaves(directory);
    if (directory.listLeafNames().includes(V11_ATTEMPT_BINDING_LEAF)) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_INVALID');
    }
    const binding = v11AttemptBindingSchema.parse({
      schemaVersion: 'phase-6.9.5-v11-product-acceptance-attempt-v1',
      attemptId: input.attemptId,
      attemptSha256: expectedHash,
    });
    publish(
      directory,
      V11_ATTEMPT_BINDING_LEAF,
      `${JSON.stringify(binding)}\n`,
      'V11_PRODUCT_ACCEPTANCE_ATTEMPT_IO',
    );
    return Object.freeze({ ...binding });
  } catch (error) {
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_ATTEMPT_IO');
  } finally {
    directory.close();
  }
}

export async function readReviewPlannerV11ProductAcceptanceAttemptBinding(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<Readonly<V11AttemptBinding>> {
  const publicHash =
    await readReviewPlannerV11ProductAcceptanceAttemptHash(input);
  const binding =
    await readReviewPlannerV11ProductAcceptancePrivateAttemptBinding(input);
  if (binding.attemptSha256 !== publicHash) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
  return binding;
}

async function readReviewPlannerV11ProductAcceptancePrivateAttemptBinding(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<Readonly<V11AttemptBinding>> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertV11CheckpointLeaves(directory);
    if (!directory.listLeafNames().includes(V11_ATTEMPT_BINDING_LEAF)) {
      throw new Error();
    }
    const binding = v11AttemptBindingSchema.parse(
      JSON.parse(
        directory.readRegularFile(V11_ATTEMPT_BINDING_LEAF).toString(),
      ),
    );
    return Object.freeze({ ...binding });
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export async function readReviewPlannerV11ProductAcceptanceAttemptHash(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<string> {
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      !leaves.includes('.acceptance-reserved') ||
      leaves.some(
        (leaf) =>
          !(V11_PUBLIC_ATTEMPT_LEAVES as readonly string[]).includes(leaf),
      )
    ) {
      throw new Error();
    }
    const attemptHash = directory
      .readRegularFile('.acceptance-reserved')
      .toString();
    if (
      !V11_ATTEMPT_HASH.test(attemptHash.trim()) ||
      attemptHash !== `${attemptHash.trim()}\n`
    ) {
      throw new Error();
    }
    return attemptHash.trim();
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

type V11CheckpointJournalState = {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  role: ReviewPlannerV11ProductAcceptanceOwnerRole;
  attemptSha256: string;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  closed: boolean;
  sealed: boolean;
  failureAuthority: ReviewPlannerV11ProductAcceptanceFailureAuthority | null;
};

export type ReviewPlannerV11ProductAcceptanceFailureAuthority = Readonly<{
  assertAuthorized(): void;
}>;

export type ReviewPlannerV11ProductAcceptanceFailurePublisher = Readonly<{
  recordFailure(
    authority: ReviewPlannerV11ProductAcceptanceFailureAuthority,
    value: unknown,
  ): void;
}>;

export type ReviewPlannerV11ProductAcceptanceRecoveryJournal = Readonly<{
  appendCheckpoint(
    value: unknown,
  ): ReviewPlannerV11ProductAcceptanceCheckpointRecord;
  latestCheckpoint(): ReviewPlannerV11ProductAcceptanceCheckpointRecord;
  issueFailureAuthority(): ReviewPlannerV11ProductAcceptanceFailureAuthority;
  projectRecoveryOnly(
    publisher: ReviewPlannerV11ProductAcceptanceFailurePublisher,
  ): void;
  close(): void;
}>;

const v11CheckpointJournalState = new WeakMap<
  ReviewPlannerV11ProductAcceptanceRecoveryJournal,
  V11CheckpointJournalState
>();

const v11FailureAuthorityState = new WeakMap<
  ReviewPlannerV11ProductAcceptanceFailureAuthority,
  ReviewPlannerV11ProductAcceptanceRecoveryJournal
>();

export async function prepareReviewPlannerV11ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
}): Promise<ReviewPlannerV11ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
    ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
      input.environment,
    ),
  ]);
  try {
    directory.assertLocalFixedNtfsVolume();
    assertV11CheckpointLeaves(directory);
    const binding =
      await readReviewPlannerV11ProductAcceptancePrivateAttemptBinding({
        repoRoot: input.repoRoot,
        environment: input.environment,
      });
    try {
      assertReviewPlannerV11ProductAcceptanceOwnerAttempt(
        input.owner,
        input.environment,
        binding.attemptSha256,
      );
    } catch {
      throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    if (v11CheckpointHistory(directory).length > 0) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_EXISTS');
    }
    return createV11CheckpointJournal({
      environment: input.environment,
      role: 'product',
      attemptSha256: binding.attemptSha256,
      owner: input.owner,
      directory,
      closed: false,
      sealed: false,
      failureAuthority: null,
    });
  } catch (error) {
    directory.close();
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

export async function openReviewPlannerV11ProductAcceptanceRecoveryJournal(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
}): Promise<ReviewPlannerV11ProductAcceptanceRecoveryJournal> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertV11CheckpointLeaves(directory);
    const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
      repoRoot: input.repoRoot,
      environment: input.environment,
    });
    return createV11CheckpointJournal({
      environment: input.environment,
      role: 'recovery',
      attemptSha256: binding.attemptSha256,
      owner: input.owner,
      directory,
      closed: false,
      sealed: false,
      failureAuthority: null,
    });
  } catch {
    directory.close();
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV11ProductAcceptanceRecoveryCheckpoint(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV11ProductAcceptanceCheckpointRecord> {
  const latest =
    await inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint(input);
  if (latest === null) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
  return latest;
}

export async function inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<ReviewPlannerV11ProductAcceptanceCheckpointRecord | null> {
  try {
    await readReviewPlannerV11ProductAcceptanceAttemptBinding(input);
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        input.environment,
      ),
    ],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    const history = v11CheckpointHistory(directory);
    const latest = history.at(-1);
    return latest === undefined ? null : Object.freeze({ ...latest });
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  } finally {
    directory.close();
  }
}

export function assertReviewPlannerV11ProductAcceptanceFailureAuthority(
  authority: ReviewPlannerV11ProductAcceptanceFailureAuthority,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  attemptSha256: string,
  value: unknown,
): void {
  const journal = v11FailureAuthorityState.get(authority);
  const state =
    journal === undefined ? undefined : v11CheckpointJournalState.get(journal);
  if (!state || state.closed || state.failureAuthority !== authority) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
  }
  try {
    assertReviewPlannerV11ProductAcceptanceOwner(state.owner, environment, [
      'product',
      'recovery',
    ]);
    authority.assertAuthorized();
    const failure = parseReviewPlannerV11ProductAcceptanceFailure(value);
    const latest = v11CheckpointHistory(state.directory).at(-1);
    if (
      !latest ||
      state.attemptSha256 !== attemptSha256 ||
      failure.environment !== environment ||
      failure.component !== latest.component ||
      failure.slot !== latest.slot ||
      failure.checkpoint !== latest.checkpoint ||
      failure.providerCallState !== latest.providerCallState
    ) {
      throw new Error();
    }
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
  }
}

function createV11CheckpointJournal(
  initialState: V11CheckpointJournalState,
): ReviewPlannerV11ProductAcceptanceRecoveryJournal {
  const journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal =
    Object.freeze({
      appendCheckpoint(value) {
        const state = requireV11CheckpointJournalState(journal);
        assertReviewPlannerV11ProductAcceptanceOwner(
          state.owner,
          state.environment,
          state.role === 'recovery' ? ['recovery'] : ['product'],
        );
        if (state.sealed) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_SEALED');
        }
        let record: ReviewPlannerV11ProductAcceptanceCheckpointRecord;
        try {
          record = parseReviewPlannerV11ProductAcceptanceCheckpoint(value);
          const history = v11CheckpointHistory(state.directory);
          if (
            state.role === 'recovery' &&
            (history.length !== 0 ||
              record.component !== 'review' ||
              record.slot !== 'api' ||
              record.checkpoint !== 'review_api_activate' ||
              record.providerCallState !== 'not_started')
          ) {
            throw new Error();
          }
          const prefix = v11SlotCheckpoints(record.component, record.slot);
          const localHistory = history.filter(
            (entry) =>
              entry.component === record.component &&
              entry.slot === record.slot,
          );
          const expected = prefix[localHistory.length];
          if (expected !== record.checkpoint) throw new Error();
          const expectedState = v11ExpectedProviderCallState(record);
          if (record.providerCallState !== expectedState) throw new Error();
          const leaf = `checkpoint-${String(history.length + 1).padStart(3, '0')}-${record.checkpoint}.json`;
          publish(
            state.directory,
            leaf,
            `${JSON.stringify(record)}\n`,
            'V11_PRODUCT_ACCEPTANCE_CHECKPOINT_IO',
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'V11_PRODUCT_ACCEPTANCE_CHECKPOINT_IO'
          ) {
            throw error;
          }
          throw new Error('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_INVALID');
        }
        return Object.freeze({ ...record });
      },
      latestCheckpoint() {
        const state = requireV11CheckpointJournalState(journal);
        assertReviewPlannerV11ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['product', 'recovery'],
        );
        try {
          const latest = v11CheckpointHistory(state.directory).at(-1);
          if (!latest) throw new Error();
          return Object.freeze({ ...latest });
        } catch {
          throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
        }
      },
      issueFailureAuthority() {
        const state = requireV11CheckpointJournalState(journal);
        assertReviewPlannerV11ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['product', 'recovery'],
        );
        let latest:
          | ReviewPlannerV11ProductAcceptanceCheckpointRecord
          | undefined;
        try {
          latest = v11CheckpointHistory(state.directory).at(-1);
        } catch {
          throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
        }
        if (!latest) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_REQUIRED');
        }
        if (state.failureAuthority !== null) return state.failureAuthority;
        const authority: ReviewPlannerV11ProductAcceptanceFailureAuthority =
          Object.freeze({
            assertAuthorized() {
              const latest = requireV11CheckpointJournalState(journal);
              assertReviewPlannerV11ProductAcceptanceOwner(
                latest.owner,
                latest.environment,
                ['product', 'recovery'],
              );
              if (latest.failureAuthority !== authority) {
                throw new Error(
                  'V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID',
                );
              }
            },
          });
        state.sealed = true;
        state.failureAuthority = authority;
        v11FailureAuthorityState.set(authority, journal);
        return authority;
      },
      projectRecoveryOnly(publisher) {
        const state = requireV11CheckpointJournalState(journal);
        assertReviewPlannerV11ProductAcceptanceOwner(
          state.owner,
          state.environment,
          ['recovery'],
        );
        let latest: ReviewPlannerV11ProductAcceptanceCheckpointRecord;
        try {
          latest =
            v11CheckpointHistory(state.directory).at(-1) ??
            (() => {
              throw new Error();
            })();
        } catch {
          throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
        }
        const authority = journal.issueFailureAuthority();
        publisher.recordFailure(authority, {
          schemaVersion:
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
          environment: state.environment,
          component: latest.component,
          slot: latest.slot,
          checkpoint: latest.checkpoint,
          terminal: 'operation_failed',
          providerCallState: latest.providerCallState,
        } satisfies ReviewPlannerV11ProductAcceptanceFailureRecord);
      },
      close() {
        const state = v11CheckpointJournalState.get(journal);
        if (!state || state.closed) return;
        state.closed = true;
        state.failureAuthority = null;
        state.directory.close();
      },
    });
  v11CheckpointJournalState.set(journal, initialState);
  return journal;
}

function requireV11CheckpointJournalState(
  journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal,
) {
  const state = v11CheckpointJournalState.get(journal);
  if (!state || state.closed) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_JOURNAL_CLOSED');
  }
  return state;
}

function v11CheckpointHistory(
  directory: WindowsNoReparseChildDirectory,
): readonly ReviewPlannerV11ProductAcceptanceCheckpointRecord[] {
  assertV11CheckpointLeaves(directory);
  try {
    const entries = directory
      .listLeafNames()
      .filter(
        (leaf) =>
          leaf !== V11_OWNER_LOCK_LEAF && leaf !== V11_ATTEMPT_BINDING_LEAF,
      )
      .map((leaf) => {
        const match = V11_CHECKPOINT_LEAF.exec(leaf);
        if (!match) throw new Error();
        return {
          index: Number(match[1]),
          checkpoint: match[2],
          leaf,
        };
      })
      .sort((left, right) => left.index - right.index);
    for (const [position, entry] of entries.entries()) {
      if (entry.index !== position + 1) throw new Error();
    }
    const records = readReviewPlannerV11ProductAcceptanceCheckpoints(
      entries.map((entry) => {
        const record = parseReviewPlannerV11ProductAcceptanceCheckpoint(
          JSON.parse(directory.readRegularFile(entry.leaf).toString()),
        );
        if (record.checkpoint !== entry.checkpoint) throw new Error();
        return record;
      }),
    );
    return Object.freeze(records.map((record) => Object.freeze({ ...record })));
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function assertV11CheckpointLeaves(directory: WindowsNoReparseChildDirectory) {
  const leaves = directory.listLeafNames();
  if (
    !leaves.includes(V11_OWNER_LOCK_LEAF) ||
    leaves.some(
      (leaf) =>
        leaf !== V11_OWNER_LOCK_LEAF &&
        leaf !== V11_ATTEMPT_BINDING_LEAF &&
        !V11_CHECKPOINT_LEAF.test(leaf),
    )
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function v11SlotCheckpoints(
  component: ReviewPlannerV11ProductAcceptanceCheckpointRecord['component'],
  slot: ReviewPlannerV11ProductAcceptanceCheckpointRecord['slot'],
) {
  const prefix = `${component}_${slot}_`;
  return Object.freeze(
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter((checkpoint) =>
      checkpoint.startsWith(prefix),
    ),
  );
}

function v11ExpectedProviderCallState(
  record: ReviewPlannerV11ProductAcceptanceCheckpointRecord,
) {
  const checkpoints = v11SlotCheckpoints(record.component, record.slot);
  const dispatch =
    `${record.component}_${record.slot}_dispatch` as ReviewPlannerV11ProductAcceptanceCheckpointRecord['checkpoint'];
  return checkpoints.indexOf(record.checkpoint) >= checkpoints.indexOf(dispatch)
    ? 'indeterminate'
    : 'not_started';
}

function isV11OwnerRole(
  value: unknown,
): value is ReviewPlannerV11ProductAcceptanceOwnerRole {
  return value === 'product' || value === 'recovery';
}
