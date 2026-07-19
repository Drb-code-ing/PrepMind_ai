import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { PrismaClient } from '@repo/database';
import { chromium } from 'playwright-core';

import { parseReviewPlannerControlledLiveV8CommittedCandidate } from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE,
  readReviewPlannerControlledLiveV10SemanticQualityEvidence,
} from './review-planner-controlled-live-eval-v10-semantic-quality.evidence';

import {
  calculateReviewPlannerV8ProductAcceptanceCost,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE,
} from './review-planner-v8-product-acceptance-evidence';
import {
  finalizeReviewPlannerV8ProductAcceptancePresealedSuccess,
  openReviewPlannerV11ProductAcceptanceRecoveryLedger,
  readReviewPlannerV11ProductAcceptanceLedger,
  reserveReviewPlannerV11ProductAcceptanceLedger,
  readReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedger,
  type ReviewPlannerV11ProductAcceptanceLedger,
  type ReviewPlannerV8ProductAcceptanceLedger,
} from './review-planner-v8-product-acceptance-ledger';
import {
  acquireReviewPlannerV8ProductAcceptanceOwner,
  acquireReviewPlannerV11ProductAcceptanceOwner,
  assertReviewPlannerV11ProductAcceptanceOwnerSelfLock,
  openReviewPlannerV8ProductAcceptanceRecoveryJournal,
  openReviewPlannerV11ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV11ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV8ProductAcceptanceRecoveryJournal,
  readReviewPlannerV11ProductAcceptanceAttemptBinding,
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
  type ReviewPlannerV8ProductAcceptanceEnvironment,
  type ReviewPlannerV8ProductAcceptanceOwner,
  type ReviewPlannerV8ProductAcceptanceRecoveryJournal,
  type ReviewPlannerV11ProductAcceptanceFailureAuthority,
  type ReviewPlannerV11ProductAcceptanceOwner,
  type ReviewPlannerV11ProductAcceptanceRecoveryJournal,
} from './review-planner-v8-product-acceptance-recovery';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptancePersistedTrace,
  type ReviewPlannerV8ProductAcceptanceRequestResult,
  type ReviewPlannerV11ProductAcceptanceDiagnosticsPort,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
  type ReviewPlannerV8ProductAcceptanceRunResult,
} from './review-planner-v8-product-acceptance-runner';
import {
  normalizeReviewPlannerProductAcceptanceSchemaRecord,
  parseReviewPlannerProductAcceptanceArguments,
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceProfile,
} from './review-planner-product-acceptance-profile';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS,
  parseReviewPlannerV11ProductAcceptanceCheckpoint,
  type ReviewPlannerV11ProductAcceptanceCheckpoint,
  type ReviewPlannerV11ProductAcceptanceFailureRecord,
} from './review-planner-v11-product-acceptance-diagnostics';
import {
  createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter,
  readReviewPlannerV11ProductAcceptanceExecutionManifest,
  type ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
} from './review-planner-v11-product-acceptance-execution';

const execFileAsync = promisify(execFile);

export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION =
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation;
export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION =
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.recoveryConfirmation;
export const REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_CONFIRMATION =
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation;
export const REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION =
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.recoveryConfirmation;

type Component = 'review' | 'planner';
type CliKind = 'product' | 'recovery';
type FactsPhase = 'before' | 'after';

const REVIEW_PLANNER_FACT_TABLES = [
  'wrongQuestionSubjectGroup',
  'wrongQuestionDeck',
  'wrongQuestion',
  'wrongQuestionDeckItem',
  'card',
  'reviewLog',
  'reviewTask',
  'reviewPreference',
] as const;

type ReviewPlannerFactsTable = (typeof REVIEW_PLANNER_FACT_TABLES)[number];
type ReviewPlannerFactRow = Readonly<{ id: string }>;

export function createReviewPlannerV11ProductAcceptanceDiagnosticsPort(input: {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal;
  ledger: ReviewPlannerV11ProductAcceptanceLedger;
}): ReviewPlannerV11ProductAcceptanceDiagnosticsPort {
  let failurePublished = false;
  let cachedFailure:
    | Readonly<{
        authority: ReviewPlannerV11ProductAcceptanceFailureAuthority;
        failure: ReviewPlannerV11ProductAcceptanceFailureRecord;
      }>
    | undefined;
  return Object.freeze({
    checkpoint(value: ReviewPlannerV11ProductAcceptanceCheckpoint) {
      const record = toReviewPlannerV11Checkpoint(value);
      input.journal.appendCheckpoint(record);
    },
    publishFailure() {
      if (failurePublished) return;
      if (!cachedFailure) {
        const latest = parseReviewPlannerV11ProductAcceptanceCheckpoint(
          input.journal.latestCheckpoint(),
        );
        const failure = Object.freeze({
          schemaVersion:
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
          environment: input.environment,
          component: latest.component,
          slot: latest.slot,
          checkpoint: latest.checkpoint,
          terminal: 'operation_failed' as const,
          providerCallState: latest.providerCallState,
        } satisfies ReviewPlannerV11ProductAcceptanceFailureRecord);
        cachedFailure = Object.freeze({
          authority: input.journal.issueFailureAuthority(),
          failure,
        });
      }
      input.ledger.recordFailure(
        cachedFailure.authority,
        cachedFailure.failure,
      );
      failurePublished = true;
    },
  });
}

function toReviewPlannerV11Checkpoint(
  value: ReviewPlannerV11ProductAcceptanceCheckpoint,
) {
  const [component, slot] = value.split('_') as [
    'review' | 'planner',
    'api' | 'browser',
  ];
  const slotCheckpoints =
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter((checkpoint) =>
      checkpoint.startsWith(`${component}_${slot}_`),
    );
  const dispatch = `${component}_${slot}_dispatch`;
  return {
    schemaVersion:
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
    component,
    slot,
    checkpoint: value,
    providerCallState:
      slotCheckpoints.indexOf(value) >=
      slotCheckpoints.indexOf(
        dispatch as ReviewPlannerV11ProductAcceptanceCheckpoint,
      )
        ? ('indeterminate' as const)
        : ('not_started' as const),
  };
}

export type ReviewPlannerOwnerFactsSnapshot = Readonly<
  Record<ReviewPlannerFactsTable, readonly ReviewPlannerFactRow[]>
>;

export interface ReviewPlannerFactsPrisma {
  wrongQuestionSubjectGroup: Pick<
    PrismaClient['wrongQuestionSubjectGroup'],
    'findMany'
  >;
  wrongQuestionDeck: Pick<PrismaClient['wrongQuestionDeck'], 'findMany'>;
  wrongQuestion: Pick<PrismaClient['wrongQuestion'], 'findMany'>;
  wrongQuestionDeckItem: Pick<
    PrismaClient['wrongQuestionDeckItem'],
    'findMany'
  >;
  card: Pick<PrismaClient['card'], 'findMany'>;
  reviewLog: Pick<PrismaClient['reviewLog'], 'findMany'>;
  reviewTask: Pick<PrismaClient['reviewTask'], 'findMany'>;
  reviewPreference: Pick<PrismaClient['reviewPreference'], 'findMany'>;
}

type ReviewPlannerFactsSnapshotState = Record<
  Component,
  Partial<Record<FactsPhase, ReviewPlannerOwnerFactsSnapshot>>
>;

type ReviewPlannerOwnerFactsAttestorPrisma = ReviewPlannerFactsPrisma & {
  wrongQuestion: ReviewPlannerFactsPrisma['wrongQuestion'] &
    Pick<PrismaClient['wrongQuestion'], 'count'>;
};

type ProductPreflight =
  | Readonly<{
      status: 'blocked';
      code: 'paired_evidence_incomplete' | 'preflight_failed';
    }>
  | Readonly<{
      status: 'ready';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      repoRoot: string;
      commitSha: string;
      branchName: string;
      pairedEvidenceSha256: string;
      chromeExecutablePath: string;
      utcStamp: string;
    }>;

type GeneratedResources = Readonly<{
  syntheticEmails: Readonly<Record<Component | 'probe', string>>;
  fixtureIds: readonly string[];
  browserProfilePath: string;
  passwords: Readonly<Record<Component, string>>;
  capabilities: Readonly<Record<Component, string>>;
}>;

type RuntimeAccount = Readonly<{ id: string; token: string }>;
type RuntimeAccounts = Readonly<Record<Component, RuntimeAccount>>;

type FixtureReceipt = Readonly<{
  accountIdSha256: Readonly<Record<Component, string>>;
  fixtureIdSha256: Readonly<Record<Component, string>>;
}>;

type ProductOwnerResult =
  | Readonly<{ status: 'owner_active' }>
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV8ProductAcceptanceOwner;
    }>;

export interface ReviewPlannerV8ProductAcceptanceCompositionPorts {
  preflight(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<ProductPreflight>;
  acquireOwner(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    role: 'product';
  }): Promise<ProductOwnerResult>;
  revalidatePreflight(input: {
    preflight: Extract<ProductPreflight, { status: 'ready' }>;
  }): Promise<boolean>;
  reserveLedger(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    owner: ReviewPlannerV8ProductAcceptanceOwner;
    pairedEvidenceSha256: string;
  }): Promise<ReviewPlannerV8ProductAcceptanceLedger>;
  generateResources(
    input: ProductPreflight & { status: 'ready' },
  ): GeneratedResources;
  prepareRecoveryJournal(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    owner: ReviewPlannerV8ProductAcceptanceOwner;
    manifest: unknown;
  }): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal>;
  registerAccount(input: {
    component: Component;
    email: string;
    password: string;
  }): Promise<RuntimeAccount>;
  bindAccount(input: {
    component: Component;
    email: string;
    accountId: string;
    journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal;
  }): Promise<void>;
  createFixtures(input: {
    accounts: RuntimeAccounts;
    fixtureIds: readonly string[];
  }): Promise<FixtureReceipt>;
  createRunnerDependencies(input: {
    preflight: ProductPreflight & { status: 'ready' };
    resources: GeneratedResources;
    accounts: RuntimeAccounts;
    fixtureReceipt: FixtureReceipt;
  }): ReviewPlannerV8ProductAcceptanceRunnerDependencies;
  runAcceptance(
    input: unknown,
  ): Promise<ReviewPlannerV8ProductAcceptanceRunResult>;
}

type ReviewPlannerV11ProductPreflight =
  | Readonly<{ status: 'blocked' }>
  | Readonly<{
      status: 'ready';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      repoRoot: string;
      commitSha: string;
      branchName: string;
      pairedEvidenceSha256: string;
      chromeExecutablePath: string;
    }>;

type ReviewPlannerV11CompositionOwnerResult =
  | Readonly<{ status: 'owner_active' }>
  | Readonly<{
      status: 'acquired';
      owner: ReviewPlannerV11ProductAcceptanceOwner;
    }>;

export interface ReviewPlannerV11ProductAcceptanceCompositionPorts {
  preflight(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<ReviewPlannerV11ProductPreflight>;
  acquireOwner(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    role: 'product';
  }): Promise<ReviewPlannerV11CompositionOwnerResult>;
  revalidatePreflight(input: {
    preflight: Extract<ReviewPlannerV11ProductPreflight, { status: 'ready' }>;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
  }): Promise<boolean>;
  reserveLedger(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
  }): Promise<
    Readonly<{
      ledger: ReviewPlannerV11ProductAcceptanceLedger;
      attemptSha256: string;
    }>
  >;
  writeExecutionManifest(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    ledger: ReviewPlannerV11ProductAcceptanceLedger;
    attemptSha256: string;
    preflight: Extract<ReviewPlannerV11ProductPreflight, { status: 'ready' }>;
  }): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord>;
  createFixtures(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    ledger: ReviewPlannerV11ProductAcceptanceLedger;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<unknown>;
  prepareRecoveryJournal(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    ledger: ReviewPlannerV11ProductAcceptanceLedger;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<ReviewPlannerV11ProductAcceptanceRecoveryJournal>;
  createRunner(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    ledger: ReviewPlannerV11ProductAcceptanceLedger;
    journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal;
    fixtures: unknown;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<Readonly<{ run(): Promise<unknown> }>>;
  recoverFailure(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<void>;
}

export async function runReviewPlannerV11ProductAcceptanceComposition(input: {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  repoRoot: string;
  ports: ReviewPlannerV11ProductAcceptanceCompositionPorts;
}): Promise<
  | Readonly<{
      status: 'blocked';
      stage: 'preflight' | 'owner' | 'revalidate';
    }>
  | Readonly<{
      status: 'passed';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    }>
  | Readonly<{
      status: 'recovered';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    }>
> {
  let owner: ReviewPlannerV11ProductAcceptanceOwner | undefined;
  let ledger: ReviewPlannerV11ProductAcceptanceLedger | undefined;
  let journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal | undefined;
  let executionManifest:
    | ReviewPlannerV11ProductAcceptanceExecutionManifestRecord
    | undefined;
  let failure: Error | undefined;
  let result:
    | Readonly<{
        status: 'blocked';
        stage: 'preflight' | 'owner' | 'revalidate';
      }>
    | Readonly<{
        status: 'passed';
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      }>
    | Readonly<{
        status: 'recovered';
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      }>
    | undefined;
  try {
    const preflight = await input.ports.preflight({
      environment: input.environment,
      repoRoot: input.repoRoot,
    });
    if (
      preflight.status !== 'ready' ||
      preflight.environment !== input.environment ||
      preflight.repoRoot !== input.repoRoot
    ) {
      result = Object.freeze({
        status: 'blocked' as const,
        stage: 'preflight' as const,
      });
      return result;
    }
    const ownership = await input.ports.acquireOwner({
      environment: input.environment,
      repoRoot: input.repoRoot,
      role: 'product',
    });
    if (ownership.status !== 'acquired') {
      result = Object.freeze({
        status: 'blocked' as const,
        stage: 'owner' as const,
      });
      return result;
    }
    owner = ownership.owner;
    owner.assertHeld();
    if (!(await input.ports.revalidatePreflight({ preflight, owner }))) {
      result = Object.freeze({
        status: 'blocked' as const,
        stage: 'revalidate' as const,
      });
      return result;
    }
    const reservation = await input.ports.reserveLedger({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
    });
    ledger = reservation.ledger;
    executionManifest = await input.ports.writeExecutionManifest({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      ledger,
      attemptSha256: reservation.attemptSha256,
      preflight,
    });
    if (
      executionManifest.environment !== input.environment ||
      executionManifest.attemptSha256 !== reservation.attemptSha256
    ) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
    }
    const fixtures = await input.ports.createFixtures({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      ledger,
      executionManifest,
    });
    journal = await input.ports.prepareRecoveryJournal({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      ledger,
      executionManifest,
    });
    const runner = await input.ports.createRunner({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      ledger,
      journal,
      fixtures,
      executionManifest,
    });
    await runner.run();
    result = Object.freeze({
      status: 'passed' as const,
      environment: input.environment,
    });
  } catch (error) {
    failure =
      error instanceof Error
        ? error
        : new Error('V11_PRODUCT_ACCEPTANCE_OPERATION_FAILED');
  } finally {
    journal?.close();
    ledger?.close();
    owner?.close();
  }
  if (failure !== undefined) {
    if (executionManifest !== undefined) {
      try {
        await input.ports.recoverFailure({
          environment: input.environment,
          repoRoot: input.repoRoot,
          executionManifest,
        });
      } catch {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
      }
      return Object.freeze({
        status: 'recovered' as const,
        environment: input.environment,
      });
    }
    throw failure;
  }
  if (result === undefined) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_OPERATION_FAILED');
  }
  return result;
}

type ReviewPlannerV11RecoveryPreflight =
  | Readonly<{ status: 'blocked' }>
  | Readonly<{
      status: 'ready';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      repoRoot: string;
      attemptSha256: string;
      executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
    }>;

export interface ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts {
  preflight(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<ReviewPlannerV11RecoveryPreflight>;
  readAuthoritativeExecutionManifest(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<
    Readonly<{
      attemptSha256: string;
      executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
    }>
  >;
  acquireOwner(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    role: 'recovery';
  }): Promise<ReviewPlannerV11CompositionOwnerResult>;
  openRecoveryJournal(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<ReviewPlannerV11ProductAcceptanceRecoveryJournal>;
  publishFailure(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal;
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
  }): Promise<void>;
  restoreDefaultOff(
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
  ): Promise<void>;
  cleanupExact(
    executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
  ): Promise<void>;
}

export async function runReviewPlannerV11ProductAcceptanceRecoveryComposition(input: {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  repoRoot: string;
  ports: ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts;
}): Promise<
  | Readonly<{ status: 'blocked'; stage: 'preflight' | 'owner' }>
  | Readonly<{
      status: 'recovered';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    }>
> {
  let owner: ReviewPlannerV11ProductAcceptanceOwner | undefined;
  let journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal | undefined;
  try {
    const preflight = await input.ports.preflight({
      environment: input.environment,
      repoRoot: input.repoRoot,
    });
    if (
      preflight.status !== 'ready' ||
      preflight.environment !== input.environment ||
      preflight.repoRoot !== input.repoRoot ||
      preflight.executionManifest.environment !== input.environment ||
      preflight.executionManifest.attemptSha256 !== preflight.attemptSha256
    ) {
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'preflight' as const,
      });
    }
    const authoritative = await input.ports.readAuthoritativeExecutionManifest({
      environment: input.environment,
      repoRoot: input.repoRoot,
    });
    if (
      authoritative.attemptSha256 !== preflight.attemptSha256 ||
      !sameReviewPlannerV11ExecutionManifest(
        authoritative.executionManifest,
        preflight.executionManifest,
      )
    ) {
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'preflight' as const,
      });
    }
    const ownership = await input.ports.acquireOwner({
      environment: input.environment,
      repoRoot: input.repoRoot,
      role: 'recovery',
    });
    if (ownership.status !== 'acquired') {
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'owner' as const,
      });
    }
    owner = ownership.owner;
    journal = await input.ports.openRecoveryJournal({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      executionManifest: preflight.executionManifest,
    });
    await input.ports.publishFailure({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
      journal,
      executionManifest: preflight.executionManifest,
    });
    await input.ports.restoreDefaultOff(preflight.executionManifest);
    await input.ports.cleanupExact(preflight.executionManifest);
    return Object.freeze({
      status: 'recovered' as const,
      environment: input.environment,
    });
  } finally {
    journal?.close();
    owner?.close();
  }
}

function sameReviewPlannerV11ExecutionManifest(
  left: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
  right: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
) {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.environment === right.environment &&
    left.attemptSha256 === right.attemptSha256 &&
    left.resources.accountId.review === right.resources.accountId.review &&
    left.resources.accountId.planner === right.resources.accountId.planner &&
    left.resources.fixtureId.review === right.resources.fixtureId.review &&
    left.resources.fixtureId.planner === right.resources.fixtureId.planner &&
    left.resources.browser.executablePath ===
      right.resources.browser.executablePath &&
    left.resources.browser.profilePath === right.resources.browser.profilePath
  );
}

type RecoveryPreflight =
  | Readonly<{
      status: 'blocked';
      code: 'recovery_not_authorized' | 'preflight_failed';
    }>
  | Readonly<{
      status: 'ready';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      repoRoot: string;
      presealed: boolean;
      manifest: Readonly<{
        browserExecutablePath: string;
        browserProfilePath: string;
      }>;
    }>;

type RecoveryCleanupReceipt = Readonly<{
  schemaVersion: string;
  syntheticAccounts: 0;
  fixtures: 0;
  traces: 0;
  browserProcesses: 0;
  browserProfiles: 0;
  probeAccounts: 0;
}>;

export interface ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts {
  preflightRecovery(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<RecoveryPreflight>;
  acquireOwner(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    role: 'recovery';
  }): Promise<ProductOwnerResult>;
  openRecoveryJournal(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    owner: ReviewPlannerV8ProductAcceptanceOwner;
  }): Promise<ReviewPlannerV8ProductAcceptanceRecoveryJournal>;
  finalizePresealedSuccess(input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    owner: ReviewPlannerV8ProductAcceptanceOwner;
  }): Promise<void>;
  terminateExactBrowser(input: {
    executablePath: string;
    profilePath: string;
  }): Promise<void>;
  restoreDefaultOff(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal;
  }): Promise<unknown>;
  cleanupExact(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    manifest: Extract<RecoveryPreflight, { status: 'ready' }>['manifest'];
    journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal;
  }): Promise<RecoveryCleanupReceipt>;
}

export type ReviewPlannerV8ProductAcceptanceCliSummary =
  | Readonly<{
      stage: 'preflight';
      status: 'blocked';
      code: 'paired_evidence_incomplete' | 'preflight_failed';
    }>
  | Readonly<{
      stage: 'owner';
      status: 'blocked';
      code: 'owner_active';
    }>
  | Readonly<{
      stage: 'complete';
      status: 'passed';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      requestCount: 4;
      inputTokens: number;
      outputTokens: number;
      costCny: string;
    }>
  | Readonly<{
      stage: 'fixtures' | 'operation' | 'recovery';
      status: 'failed';
      code: 'operation_failed' | 'recovery_required';
    }>
  | Readonly<{
      stage: 'preflight';
      status: 'blocked';
      code: 'recovery_not_authorized';
    }>
  | Readonly<{
      stage: 'recovery';
      status: 'recovered';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      providerInvocations: 0;
      acceptanceRequests: 0;
      browserContinues: 0;
    }>
  | Readonly<{
      stage: 'preseal';
      status: 'sealed';
      environment: ReviewPlannerV8ProductAcceptanceEnvironment;
      providerInvocations: 0;
      acceptanceRequests: 0;
      browserContinues: 0;
    }>;

export type ReviewPlannerV8DisposableComposition<Ports> = Readonly<{
  ports: Ports;
  dispose(): Promise<void>;
}>;

type ReviewPlannerV8DefaultCompositionOptions = Readonly<{
  env?: Readonly<Record<string, string>>;
  prisma?: PrismaClient;
  pairedEvidenceAuthority?: PairedEvidenceAuthority;
  profile?: ReviewPlannerProductAcceptanceProfile;
  preflightFactory?(input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }): Promise<ProductPreflight>;
  resourcesFactory?(
    preflight: Extract<ProductPreflight, { status: 'ready' }>,
    profile: ReviewPlannerProductAcceptanceProfile,
  ): GeneratedResources;
  runnerCleanupScopeFactory?(
    input: Parameters<
      ReviewPlannerV8ProductAcceptanceCompositionPorts['createRunnerDependencies']
    >[0],
  ):
    | Readonly<{
        executablePath: string;
        allowedProfilePaths: readonly string[];
      }>
    | undefined;
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary;
  terminateBrowser?: typeof terminateDefaultReviewPlannerV8ExactBrowser;
}>;

export type PairedEvidenceAuthority = Readonly<{
  profile: 'v10';
  readCommittedSuccess(repoRoot: string): Promise<Readonly<{
    providerAttemptCount: 23;
    pairedAdmissionCount: 22;
    evidenceSha256: string;
  }> | null>;
}>;

export function createReviewPlannerV10PairedEvidenceAuthority(
  dependencies: Readonly<{
    readEvidence?: (repoRoot: string) => Promise<Record<string, unknown>>;
  }> = {},
): PairedEvidenceAuthority {
  const readEvidence =
    dependencies.readEvidence ??
    readReviewPlannerControlledLiveV10SemanticQualityEvidence;
  return Object.freeze({
    profile: 'v10' as const,
    async readCommittedSuccess(repoRoot: string) {
      try {
        const evidence = await readEvidence(repoRoot);
        const attempts = evidence.attempts;
        if (
          evidence.schemaVersion !==
            'phase-6.9.5-review-planner-v10-semantic-quality-v1' ||
          evidence.state !== 'finalized' ||
          evidence.status !== 'complete' ||
          evidence.gate !== 'closed' ||
          evidence.terminalReason !== 'passed' ||
          !attempts ||
          typeof attempts !== 'object' ||
          (attempts as Record<string, unknown>).providerCount !== 23 ||
          (attempts as Record<string, unknown>).pairedAdmissionCount !== 22 ||
          typeof evidence.evidenceSha256 !== 'string' ||
          !/^[a-f0-9]{64}$/.test(evidence.evidenceSha256)
        ) {
          return null;
        }
        return Object.freeze({
          providerAttemptCount: 23 as const,
          pairedAdmissionCount: 22 as const,
          evidenceSha256: evidence.evidenceSha256,
        });
      } catch {
        return null;
      }
    },
  });
}

/** @deprecated Kept only for injected legacy test fixtures; it still validates V10 evidence. */
export const createReviewPlannerV9PairedEvidenceAuthority =
  createReviewPlannerV10PairedEvidenceAuthority;

export async function captureReviewPlannerV8RepositorySnapshotFromAuthority(
  input: Readonly<{
    readGitStatus(): Promise<string>;
    listEvidencePaths(): Promise<readonly string[]>;
    readEvidenceIndex(): Promise<string>;
    authority: PairedEvidenceAuthority;
    repoRoot: string;
  }>,
) {
  const before = parseReviewPlannerV8GitPorcelainSnapshot(
    await input.readGitStatus(),
  );
  if (input.authority.profile !== 'v10') return null;
  const beforePaths = [...(await input.listEvidencePaths())].sort();
  assertReviewPlannerV8EvidenceIndexIsOrdinary(
    await input.readEvidenceIndex(),
    beforePaths,
  );
  const evidence = await input.authority.readCommittedSuccess(input.repoRoot);
  const afterPaths = [...(await input.listEvidencePaths())].sort();
  assertReviewPlannerV8EvidenceIndexIsOrdinary(
    await input.readEvidenceIndex(),
    afterPaths,
  );
  const after = parseReviewPlannerV8GitPorcelainSnapshot(
    await input.readGitStatus(),
  );
  if (
    beforePaths.length !== afterPaths.length ||
    beforePaths.some((path, index) => path !== afterPaths[index]) ||
    before.commitSha !== after.commitSha ||
    before.branchName !== after.branchName ||
    before.clean !== after.clean
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_REPOSITORY_DRIFTED');
  }
  if (evidence === null) return null;
  return Object.freeze({
    ...after,
    pairedEvidenceSha256: evidence.evidenceSha256,
  });
}

export function parseReviewPlannerV8ProductAcceptanceArguments(
  argv: readonly string[],
  kind: CliKind,
): Readonly<{ environment: ReviewPlannerV8ProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export function parseReviewPlannerV10ProductAcceptanceArguments(
  argv: readonly string[],
  kind: CliKind,
): Readonly<{ environment: ReviewPlannerV8ProductAcceptanceEnvironment }> {
  return parseReviewPlannerProductAcceptanceArguments(
    REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
    argv,
    kind,
  );
}

export async function runReviewPlannerV8ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV8ProductAcceptanceCompositionPorts;
}): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  return runReviewPlannerProductAcceptanceProductCli(
    input,
    REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

export async function runReviewPlannerV10ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV8ProductAcceptanceCompositionPorts;
}): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  return runReviewPlannerProductAcceptanceProductCli(
    input,
    REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

async function runReviewPlannerProductAcceptanceProductCli(
  input: {
    argv: readonly string[];
    repoRoot: string;
    ports: ReviewPlannerV8ProductAcceptanceCompositionPorts;
  },
  profile: ReviewPlannerProductAcceptanceProfile,
): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerProductAcceptanceArguments(
    profile,
    input.argv,
    'product',
  );
  let preflight: ProductPreflight;
  try {
    preflight = await input.ports.preflight({
      environment,
      repoRoot: input.repoRoot,
    });
  } catch {
    return Object.freeze({
      stage: 'preflight',
      status: 'blocked',
      code: 'preflight_failed',
    });
  }
  if (preflight.status === 'blocked')
    return Object.freeze(preflightResult(preflight));
  if (
    preflight.environment !== environment ||
    preflight.repoRoot !== input.repoRoot
  ) {
    return Object.freeze({
      stage: 'preflight',
      status: 'blocked',
      code: 'preflight_failed',
    });
  }

  let owner: ReviewPlannerV8ProductAcceptanceOwner | undefined;
  let ledger: ReviewPlannerV8ProductAcceptanceLedger | undefined;
  let journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal | undefined;
  let stage: 'operation' | 'fixtures' = 'operation';
  try {
    const ownership = await input.ports.acquireOwner({
      repoRoot: input.repoRoot,
      environment,
      role: 'product',
    });
    if (ownership.status === 'owner_active') {
      return Object.freeze({
        stage: 'owner',
        status: 'blocked',
        code: 'owner_active',
      });
    }
    owner = ownership.owner;
    if (!(await input.ports.revalidatePreflight({ preflight }))) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_PREFLIGHT_DRIFTED');
    }
    ledger = await input.ports.reserveLedger({
      repoRoot: input.repoRoot,
      environment,
      owner,
      pairedEvidenceSha256: preflight.pairedEvidenceSha256,
    });
    const resources = input.ports.generateResources(preflight);
    journal = await input.ports.prepareRecoveryJournal({
      repoRoot: input.repoRoot,
      environment,
      owner,
      manifest: buildRecoveryManifest(preflight, resources, profile),
    });

    const accounts = {} as Record<Component, RuntimeAccount>;
    for (const component of ['review', 'planner'] as const) {
      const account = await input.ports.registerAccount({
        component,
        email: resources.syntheticEmails[component],
        password: resources.passwords[component],
      });
      accounts[component] = account;
      await input.ports.bindAccount({
        component,
        email: resources.syntheticEmails[component],
        accountId: account.id,
        journal,
      });
    }

    stage = 'fixtures';
    const fixtureReceipt = await input.ports.createFixtures({
      accounts,
      fixtureIds: resources.fixtureIds,
    });
    ledger.writeManifest(
      buildPublicManifest(preflight, fixtureReceipt, profile),
    );
    stage = 'operation';
    const dependencies = input.ports.createRunnerDependencies({
      preflight,
      resources,
      accounts,
      fixtureReceipt,
    });
    const result = await input.ports.runAcceptance({
      environment,
      commitSha: preflight.commitSha,
      pairedEvidenceSha256: preflight.pairedEvidenceSha256,
      accountIdSha256: fixtureReceipt.accountIdSha256,
      capabilities: resources.capabilities,
      webOrigin: 'http://127.0.0.1:3000',
      apiOrigin: 'http://127.0.0.1:3001',
      ledger,
      dependencies,
    });
    return Object.freeze({
      stage: 'complete',
      status: 'passed',
      environment,
      requestCount: 4,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costCny: calculateSafeCny(result.usage),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED'
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
    }
    throw new Error(
      stage === 'fixtures'
        ? 'V8_PRODUCT_ACCEPTANCE_OPERATION_FAILED'
        : 'V8_PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
  } finally {
    journal?.close();
    ledger?.close();
    owner?.close();
  }
}

export async function runReviewPlannerV8ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts;
}): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  return runReviewPlannerProductAcceptanceRecoveryCli(
    input,
    REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

export async function runReviewPlannerV10ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts;
}): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  return runReviewPlannerProductAcceptanceRecoveryCli(
    input,
    REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

async function runReviewPlannerProductAcceptanceRecoveryCli(
  input: {
    argv: readonly string[];
    repoRoot: string;
    ports: ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts;
  },
  profile: ReviewPlannerProductAcceptanceProfile,
): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerProductAcceptanceArguments(
    profile,
    input.argv,
    'recovery',
  );
  let preflight: RecoveryPreflight;
  try {
    preflight = await input.ports.preflightRecovery({
      environment,
      repoRoot: input.repoRoot,
    });
  } catch {
    return Object.freeze({
      stage: 'preflight',
      status: 'blocked',
      code: 'preflight_failed',
    });
  }
  if (preflight.status === 'blocked') {
    return Object.freeze({
      stage: 'preflight',
      status: 'blocked',
      code: preflight.code,
    });
  }
  if (
    preflight.environment !== environment ||
    preflight.repoRoot !== input.repoRoot
  ) {
    return Object.freeze({
      stage: 'preflight',
      status: 'blocked',
      code: 'preflight_failed',
    });
  }

  let owner: ReviewPlannerV8ProductAcceptanceOwner | undefined;
  let journal: ReviewPlannerV8ProductAcceptanceRecoveryJournal | undefined;
  try {
    const ownership = await input.ports.acquireOwner({
      repoRoot: input.repoRoot,
      environment,
      role: 'recovery',
    });
    if (ownership.status === 'owner_active') {
      return Object.freeze({
        stage: 'owner',
        status: 'blocked',
        code: 'owner_active',
      });
    }
    owner = ownership.owner;
    if (preflight.presealed) {
      await input.ports.finalizePresealedSuccess({
        repoRoot: input.repoRoot,
        environment,
        owner,
      });
      return Object.freeze({
        stage: 'preseal',
        status: 'sealed',
        environment,
        providerInvocations: 0,
        acceptanceRequests: 0,
        browserContinues: 0,
      });
    }
    journal = await input.ports.openRecoveryJournal({
      repoRoot: input.repoRoot,
      environment,
      owner,
    });
    const authority = await journal.authorizeRecoveryOnly();
    authority.assertAuthorized();
    let recoveryState = journal.snapshot();
    if (
      recoveryState.manifest.environment !== environment ||
      recoveryState.manifest.browserExecutablePath !==
        preflight.manifest.browserExecutablePath ||
      recoveryState.manifest.browserProfilePath !==
        preflight.manifest.browserProfilePath
    ) {
      throw new Error();
    }
    await input.ports.terminateExactBrowser({
      executablePath: recoveryState.manifest.browserExecutablePath,
      profilePath: recoveryState.manifest.browserProfilePath,
    });

    if (!recoveryState.stages.restoreVerified) {
      authority.assertAuthorized();
      if (!recoveryState.stages.restoreClaimed) {
        journal.appendStage('restore.claimed', '');
      }
      const restoreRaw = await input.ports.restoreDefaultOff({
        environment,
        journal,
      });
      const restore = parseRecoveryDefaultOffReceipt(profile, restoreRaw);
      if (restore.component !== 'recovery') throw new Error();
      journal.appendStage(
        'restore.verified.json',
        `${JSON.stringify(restoreRaw)}\n`,
      );
      recoveryState = journal.snapshot();
    }

    if (!recoveryState.stages.cleanupVerified) {
      authority.assertAuthorized();
      if (!recoveryState.stages.cleanupClaimed) {
        journal.appendStage('cleanup.claimed', '');
      }
      const cleanup = await input.ports.cleanupExact({
        environment,
        manifest: preflight.manifest,
        journal,
      });
      assertRecoveryCleanupReceipt(cleanup, profile);
      journal.appendStage(
        'cleanup.verified.json',
        `${JSON.stringify(cleanup)}\n`,
      );
    }
    authority.assertAuthorized();
    await journal.finalizeRecoveryOnly();
    return Object.freeze({
      stage: 'recovery',
      status: 'recovered',
      environment,
      providerInvocations: 0,
      acceptanceRequests: 0,
      browserContinues: 0,
    });
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
  } finally {
    journal?.close();
    owner?.close();
  }
}

export async function executeReviewPlannerV8ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceCompositionPorts>;
}) {
  return executeReviewPlannerProductAcceptanceProductCli(
    input,
    REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

export async function executeReviewPlannerV10ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceCompositionPorts>;
}) {
  return executeReviewPlannerProductAcceptanceProductCli(
    input,
    REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

async function executeReviewPlannerProductAcceptanceProductCli(
  input: {
    argv: readonly string[];
    repoRoot: string;
    composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceCompositionPorts>;
  },
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  if (!input.composition) {
    parseReviewPlannerProductAcceptanceArguments(
      profile,
      input.argv,
      'product',
    );
  }
  const composition =
    input.composition ??
    createDefaultReviewPlannerV8ProductAcceptanceComposition(input.repoRoot, {
      profile,
    });
  try {
    if (input.composition) {
      parseReviewPlannerProductAcceptanceArguments(
        profile,
        input.argv,
        'product',
      );
    }
    return await runReviewPlannerProductAcceptanceProductCli(
      {
        argv: input.argv,
        repoRoot: input.repoRoot,
        ports: composition.ports,
      },
      profile,
    );
  } finally {
    await composition.dispose();
  }
}

export async function executeReviewPlannerV8ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts>;
}) {
  return executeReviewPlannerProductAcceptanceRecoveryCli(
    input,
    REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

export async function executeReviewPlannerV10ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts>;
}) {
  return executeReviewPlannerProductAcceptanceRecoveryCli(
    input,
    REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  );
}

async function executeReviewPlannerProductAcceptanceRecoveryCli(
  input: {
    argv: readonly string[];
    repoRoot: string;
    composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts>;
  },
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  if (!input.composition) {
    parseReviewPlannerProductAcceptanceArguments(
      profile,
      input.argv,
      'recovery',
    );
  }
  const composition =
    input.composition ??
    createDefaultReviewPlannerV8ProductAcceptanceRecoveryComposition(
      input.repoRoot,
      { profile },
    );
  try {
    if (input.composition) {
      parseReviewPlannerProductAcceptanceArguments(
        profile,
        input.argv,
        'recovery',
      );
    }
    return await runReviewPlannerProductAcceptanceRecoveryCli(
      {
        argv: input.argv,
        repoRoot: input.repoRoot,
        ports: composition.ports,
      },
      profile,
    );
  } finally {
    await composition.dispose();
  }
}

export function serializeReviewPlannerV8ProductAcceptanceCliSummary(
  summary: ReviewPlannerV8ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
}

export function serializeReviewPlannerV10ProductAcceptanceCliFailure(
  kind: CliKind,
  error: unknown,
): string {
  if (
    error instanceof Error &&
    error.message === 'V10_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED'
  ) {
    return JSON.stringify({
      stage: 'preflight',
      status: 'blocked',
      code: 'confirmation_required',
    });
  }
  return JSON.stringify(
    kind === 'product'
      ? {
          stage: 'operation',
          status: 'failed',
          code: 'operation_failed',
        }
      : {
          stage: 'recovery',
          status: 'failed',
          code: 'recovery_required',
        },
  );
}

function preflightResult(
  preflight: Extract<ProductPreflight, { status: 'blocked' }>,
) {
  return {
    stage: 'preflight' as const,
    status: 'blocked' as const,
    code: preflight.code,
  };
}

function buildRecoveryManifest(
  preflight: Extract<ProductPreflight, { status: 'ready' }>,
  resources: GeneratedResources,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  return Object.freeze({
    schemaVersion: profile.schemas.recoveryManifest,
    environment: preflight.environment,
    publicLedgerPath: profile.publicLedgerPath(preflight.environment),
    syntheticEmails: resources.syntheticEmails,
    fixtureIds: resources.fixtureIds,
    browserExecutablePath: preflight.chromeExecutablePath,
    browserProfilePath: resources.browserProfilePath,
  });
}

function buildPublicManifest(
  preflight: Extract<ProductPreflight, { status: 'ready' }>,
  fixture: FixtureReceipt,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  return Object.freeze({
    schemaVersion: profile.schemas.manifest,
    environment: preflight.environment,
    commitSha: preflight.commitSha,
    pairedEvidenceSha256: preflight.pairedEvidenceSha256,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    pricing: REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE,
    accountIdSha256: fixture.accountIdSha256,
    fixtureIdSha256: fixture.fixtureIdSha256,
    reservation: {
      slotInputTokens: 1_950,
      slotOutputTokens: 440,
      environmentInputTokens: 7_800,
      environmentOutputTokens: 1_760,
      combinedInputTokens: 15_600,
      combinedOutputTokens: 3_520,
      environmentWorstCaseCostCny: '0.03396000',
      combinedWorstCaseCostCny: '0.06792000',
      hardCapCny: REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.hardCapCny,
    },
  });
}

function calculateSafeCny(usage: {
  inputTokens: number;
  outputTokens: number;
}) {
  return calculateReviewPlannerV8ProductAcceptanceCost(
    usage.inputTokens,
    usage.outputTokens,
  ).costCny;
}

function parseRecoveryDefaultOffReceipt(
  profile: ReviewPlannerProductAcceptanceProfile,
  value: unknown,
) {
  const normalized = normalizeReviewPlannerProductAcceptanceSchemaRecord(
    profile,
    'defaultOff',
    value,
  );
  if (normalized === null) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_DEFAULT_OFF_INVALID');
  }
  return reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.parse(
    normalized,
  );
}

function assertRecoveryCleanupReceipt(
  value: RecoveryCleanupReceipt,
  profile: ReviewPlannerProductAcceptanceProfile,
): asserts value is RecoveryCleanupReceipt {
  if (
    !value ||
    Object.keys(value).sort().join(',') !==
      'browserProcesses,browserProfiles,fixtures,probeAccounts,schemaVersion,syntheticAccounts,traces' ||
    normalizeReviewPlannerProductAcceptanceSchemaRecord(
      profile,
      'recoveryCleanup',
      value,
    ) === null ||
    value.syntheticAccounts !== 0 ||
    value.fixtures !== 0 ||
    value.traces !== 0 ||
    value.browserProcesses !== 0 ||
    value.browserProfiles !== 0 ||
    value.probeAccounts !== 0
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_CLEANUP_INVALID');
  }
}

export function sha256ReviewPlannerV8CompositionValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function readReviewPlannerOwnerFactsSnapshot(
  prisma: ReviewPlannerFactsPrisma,
  userId: string,
): Promise<ReviewPlannerOwnerFactsSnapshot> {
  const [
    wrongQuestionSubjectGroup,
    wrongQuestionDeck,
    wrongQuestion,
    wrongQuestionDeckItem,
    card,
    reviewLog,
    reviewTask,
    reviewPreference,
  ] = await Promise.all([
    prisma.wrongQuestionSubjectGroup.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
    prisma.wrongQuestionDeck.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
    prisma.wrongQuestion.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
    prisma.wrongQuestionDeckItem.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
    prisma.card.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    prisma.reviewLog.findMany({
      where: { card: { userId } },
      orderBy: { id: 'asc' },
    }),
    prisma.reviewTask.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
    prisma.reviewPreference.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    }),
  ]);
  return canonicalizeReviewPlannerFactsSnapshot({
    wrongQuestionSubjectGroup,
    wrongQuestionDeck,
    wrongQuestion,
    wrongQuestionDeckItem,
    card,
    reviewLog,
    reviewTask,
    reviewPreference,
  });
}

export function hashReviewPlannerOwnerFactsSnapshot(
  snapshot: ReviewPlannerOwnerFactsSnapshot,
) {
  return sha256ReviewPlannerV8CompositionValue(canonicalJson(snapshot));
}

export function countReviewPlannerOwnerFactsChanges(
  before: ReviewPlannerOwnerFactsSnapshot,
  after: ReviewPlannerOwnerFactsSnapshot,
) {
  return REVIEW_PLANNER_FACT_TABLES.reduce((total, table) => {
    const beforeRows = indexFactsRows(before[table]);
    const afterRows = indexFactsRows(after[table]);
    const ids = new Set([...beforeRows.keys(), ...afterRows.keys()]);
    for (const id of ids) {
      if (beforeRows.get(id) !== afterRows.get(id)) total += 1;
    }
    return total;
  }, 0);
}

export function createReviewPlannerV8OwnerFactsAttestor(input: {
  prisma: ReviewPlannerOwnerFactsAttestorPrisma;
  accountIds: Readonly<Record<Component, string>>;
  fixtureIds: readonly string[];
}) {
  const snapshots = createEmptyFactsSnapshotState();
  return {
    async readFactsDigest(request: {
      component: Component;
      phase: FactsPhase;
    }) {
      const snapshot = await readReviewPlannerOwnerFactsSnapshot(
        input.prisma,
        input.accountIds[request.component],
      );
      snapshots[request.component][request.phase] = snapshot;
      return hashReviewPlannerOwnerFactsSnapshot(snapshot);
    },
    async verifyOwnerIsolation() {
      return verifyReviewPlannerOwnerFactsIsolation({
        prisma: input.prisma,
        accountIds: input.accountIds,
        fixtureIds: input.fixtureIds,
        snapshots,
      });
    },
  };
}

function canonicalizeReviewPlannerFactsSnapshot(
  snapshot: Record<ReviewPlannerFactsTable, readonly unknown[]>,
): ReviewPlannerOwnerFactsSnapshot {
  return Object.freeze(
    Object.fromEntries(
      REVIEW_PLANNER_FACT_TABLES.map((table) => [
        table,
        Object.freeze(
          snapshot[table]
            .map((row) => canonicalizeJsonValue(row) as ReviewPlannerFactRow)
            .sort(compareFactRows),
        ),
      ]),
    ) as Record<ReviewPlannerFactsTable, readonly ReviewPlannerFactRow[]>,
  );
}

function compareFactRows(
  left: ReviewPlannerFactRow,
  right: ReviewPlannerFactRow,
) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function indexFactsRows(rows: readonly ReviewPlannerFactRow[]) {
  const indexed = new Map<string, string>();
  for (const row of rows) {
    if (indexed.has(row.id)) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_FACTS_DUPLICATE_ID');
    }
    indexed.set(row.id, canonicalJson(row));
  }
  return indexed;
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalizeJsonValue(value));
}

function canonicalizeJsonValue(value: unknown): unknown {
  const serialized = JSON.stringify(value, (_key, current: unknown) =>
    typeof current === 'bigint' ? current.toString() : current,
  );
  if (serialized === undefined) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_FACTS_NOT_SERIALIZABLE');
  }
  return sortCanonicalJsonValue(JSON.parse(serialized) as unknown);
}

function sortCanonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortCanonicalJsonValue(entry)]),
  );
}

function createEmptyFactsSnapshotState(): ReviewPlannerFactsSnapshotState {
  return { review: {}, planner: {} };
}

async function verifyReviewPlannerOwnerFactsIsolation(input: {
  prisma: ReviewPlannerOwnerFactsAttestorPrisma;
  accountIds: Readonly<Record<Component, string>>;
  fixtureIds: readonly string[];
  snapshots: ReviewPlannerFactsSnapshotState;
}) {
  const reviewBefore = input.snapshots.review.before;
  const plannerBefore = input.snapshots.planner.before;
  if (!reviewBefore || !plannerBefore) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_FACTS_SNAPSHOT_MISSING');
  }
  const [reviewFinal, plannerFinal, reviewSeesPlanner, plannerSeesReview] =
    await Promise.all([
      readReviewPlannerOwnerFactsSnapshot(
        input.prisma,
        input.accountIds.review,
      ),
      readReviewPlannerOwnerFactsSnapshot(
        input.prisma,
        input.accountIds.planner,
      ),
      input.prisma.wrongQuestion.count({
        where: { id: input.fixtureIds[10], userId: input.accountIds.review },
      }),
      input.prisma.wrongQuestion.count({
        where: { id: input.fixtureIds[2], userId: input.accountIds.planner },
      }),
    ]);
  return {
    crossAccountInvisible: reviewSeesPlanner === 0 && plannerSeesReview === 0,
    businessWrites:
      countReviewPlannerOwnerFactsChanges(reviewBefore, reviewFinal) +
      countReviewPlannerOwnerFactsChanges(plannerBefore, plannerFinal),
  };
}

type DefaultRuntimeState = {
  prisma: PrismaClient;
  repoRoot: string;
  env: Readonly<Record<string, string>>;
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary;
  terminateBrowser: typeof terminateDefaultReviewPlannerV8ExactBrowser;
  resources: GeneratedResources | null;
  accounts: Partial<Record<Component, RuntimeAccount & { email: string }>>;
  fixtureIds: readonly string[];
  traceIds: Set<string>;
  traceBaselines: Map<string, Set<string>>;
  liveContainerId: Partial<Record<Component, string>>;
  factsSnapshots: ReviewPlannerFactsSnapshotState;
};

type ReviewPlannerV11DefaultRuntimeBoundary = Readonly<{
  readOnlyExec?(input: {
    cwd: string;
    file: string;
    args: readonly string[];
    options: Readonly<{ signal?: AbortSignal; timeoutMs?: number }>;
  }): Promise<string>;
  fetchHealth?(input: { url: string; init: RequestInit }): Promise<Response>;
  dockerExec?(): void;
  apiProvider?(): void;
  chromium?(): void;
  fetch?(): void;
  terminateBrowser?: typeof terminateDefaultReviewPlannerV8ExactBrowser;
  assertRootsEmpty?: typeof assertReviewPlannerV11ProductAcceptanceRootsEmpty;
}>;

export function createDefaultReviewPlannerV8ProductAcceptanceComposition(
  repoRoot: string,
  options: ReviewPlannerV8DefaultCompositionOptions = {},
): ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceCompositionPorts> {
  const root = resolve(repoRoot);
  const profile =
    options.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  const env = options.env ?? readRootEnvironment(root);
  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: { db: { url: requiredEnv(env, 'DATABASE_URL') } },
    });
  const state: DefaultRuntimeState = {
    prisma,
    repoRoot: root,
    env,
    runtimeBoundary: options.runtimeBoundary,
    terminateBrowser:
      options.terminateBrowser ?? terminateDefaultReviewPlannerV8ExactBrowser,
    resources: null,
    accounts: {},
    fixtureIds: [],
    traceIds: new Set(),
    traceBaselines: new Map(),
    liveContainerId: {},
    factsSnapshots: createEmptyFactsSnapshotState(),
  };
  const pairedEvidenceAuthority =
    options.pairedEvidenceAuthority ??
    createReviewPlannerV10PairedEvidenceAuthority();
  const ports: ReviewPlannerV8ProductAcceptanceCompositionPorts = {
    preflight: (input) =>
      options.preflightFactory?.(input) ??
      runDefaultProductPreflight(input, pairedEvidenceAuthority, profile),
    acquireOwner: (input) =>
      acquireReviewPlannerV8ProductAcceptanceOwner({ ...input, profile }),
    revalidatePreflight: ({ preflight }) =>
      revalidateDefaultProductPreflight(preflight, pairedEvidenceAuthority),
    reserveLedger: (input) =>
      reserveReviewPlannerV8ProductAcceptanceLedger({ ...input, profile }),
    generateResources(preflight) {
      const resources =
        options.resourcesFactory?.(preflight, profile) ??
        generateDefaultResources(preflight, profile);
      state.resources = resources;
      state.fixtureIds = resources.fixtureIds;
      return resources;
    },
    prepareRecoveryJournal: (input) =>
      prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
        ...input,
        profile,
      }),
    async registerAccount(input) {
      const body = await fetchEnvelope(
        'http://127.0.0.1:3001/auth/register',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: input.email,
            password: input.password,
            name: `V8 ${input.component}`,
          }),
        },
        state.runtimeBoundary,
      );
      const account = parseAuthEnvelope(body);
      state.accounts[input.component] = {
        ...account,
        email: input.email,
      };
      return account;
    },
    bindAccount(input) {
      input.journal.bindAccount({
        component: input.component,
        email: input.email,
        accountId: input.accountId,
      });
      return Promise.resolve();
    },
    async createFixtures(input) {
      await createDefaultFixtures(state, input.accounts, input.fixtureIds);
      return {
        accountIdSha256: {
          review: sha256ReviewPlannerV8CompositionValue(
            input.accounts.review.id,
          ),
          planner: sha256ReviewPlannerV8CompositionValue(
            input.accounts.planner.id,
          ),
        },
        fixtureIdSha256: {
          review: sha256ReviewPlannerV8CompositionValue(
            input.fixtureIds.slice(0, 8).join('\n'),
          ),
          planner: sha256ReviewPlannerV8CompositionValue(
            input.fixtureIds.slice(8, 16).join('\n'),
          ),
        },
      };
    },
    createRunnerDependencies(input) {
      return createDefaultRunnerDependencies(
        state,
        input,
        profile,
        options.runnerCleanupScopeFactory?.(input),
      );
    },
    runAcceptance: (input) =>
      runReviewPlannerV8ProductAcceptance({
        ...(input as Record<string, unknown>),
        profile,
      }),
  };
  return Object.freeze({
    ports,
    dispose: createIdempotentPrismaDisposer(prisma),
  });
}

type ReviewPlannerV11DefaultCompositionOptions = Omit<
  ReviewPlannerV8DefaultCompositionOptions,
  'profile' | 'resourcesFactory' | 'preflightFactory'
> &
  Readonly<{
    boundary?: Readonly<{
      preflight?(input: {
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
        repoRoot: string;
      }): Promise<ProductPreflight>;
      acquireOwner?(input: {
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
        repoRoot: string;
        role: 'product';
      }): Promise<ReviewPlannerV11CompositionOwnerResult>;
      revalidatePreflight?(input: {
        preflight: Extract<
          ReviewPlannerV11ProductPreflight,
          { status: 'ready' }
        >;
        owner: ReviewPlannerV11ProductAcceptanceOwner;
      }): Promise<boolean>;
      runtime?: Readonly<{
        readOnlyExec?(input: {
          cwd: string;
          file: string;
          args: readonly string[];
          options: Readonly<{ signal?: AbortSignal; timeoutMs?: number }>;
        }): Promise<string>;
        fetchHealth?(input: {
          url: string;
          init: RequestInit;
        }): Promise<Response>;
        dockerExec?(): void;
        apiProvider?(): void;
        chromium?(): void;
        fetch?(): void;
        terminateBrowser?: typeof terminateDefaultReviewPlannerV8ExactBrowser;
      }>;
      recoverFailure?(input: {
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
        repoRoot: string;
        executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
      }): Promise<void>;
      createFixtures?(input: {
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
        repoRoot: string;
        owner: ReviewPlannerV11ProductAcceptanceOwner;
        ledger: ReviewPlannerV11ProductAcceptanceLedger;
        executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
      }): Promise<ReviewPlannerV11FixtureState>;
      createRunner?(input: {
        environment: ReviewPlannerV8ProductAcceptanceEnvironment;
        repoRoot: string;
        owner: ReviewPlannerV11ProductAcceptanceOwner;
        ledger: ReviewPlannerV11ProductAcceptanceLedger;
        journal: ReviewPlannerV11ProductAcceptanceRecoveryJournal;
        fixtures: ReviewPlannerV11FixtureState;
        executionManifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord;
      }): Promise<Readonly<{ run(): Promise<unknown> }>>;
      captureRunnerDependencies?(input: {
        dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
        runtime: ReviewPlannerV11DefaultRuntimeBoundary | undefined;
      }): void;
    }>;
  }>;

type ReviewPlannerV11FixtureState = Readonly<{
  resources: GeneratedResources;
  accounts: RuntimeAccounts;
  fixtureReceipt: FixtureReceipt;
}>;

/**
 * Builds the V11 product bridge without starting runtime work. The actual
 * Docker, browser, API, and provider effects remain behind `runner.run()`.
 */
export function createDefaultReviewPlannerV11ProductAcceptanceComposition(
  repoRoot: string,
  options: ReviewPlannerV11DefaultCompositionOptions = {},
): ReviewPlannerV8DisposableComposition<ReviewPlannerV11ProductAcceptanceCompositionPorts> {
  let selectedExecutionManifest:
    | ReviewPlannerV11ProductAcceptanceExecutionManifestRecord
    | undefined;
  let latestPreflight:
    | Extract<ProductPreflight, { status: 'ready' }>
    | undefined;
  const pairedEvidenceAuthority =
    options.pairedEvidenceAuthority ??
    createReviewPlannerV10PairedEvidenceAuthority();
  const boundary = options.boundary;
  const legacy = createDefaultReviewPlannerV8ProductAcceptanceComposition(
    repoRoot,
    {
      ...options,
      pairedEvidenceAuthority,
      preflightFactory:
        boundary?.preflight ??
        ((input) =>
          runDefaultReviewPlannerV11ProductPreflight(
            input,
            pairedEvidenceAuthority,
            boundary?.runtime,
          )),
      resourcesFactory: () => {
        if (!selectedExecutionManifest) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
        }
        return createReviewPlannerV11SyntheticResources(
          selectedExecutionManifest,
        );
      },
      runnerCleanupScopeFactory: () => {
        if (!selectedExecutionManifest) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
        }
        return Object.freeze({
          executablePath:
            selectedExecutionManifest.resources.browser.executablePath,
          allowedProfilePaths: Object.freeze([
            selectedExecutionManifest.resources.browser.profilePath,
          ]),
        });
      },
      runtimeBoundary: boundary?.runtime,
      terminateBrowser: boundary?.runtime?.terminateBrowser,
    },
  );
  const ports: ReviewPlannerV11ProductAcceptanceCompositionPorts = {
    async preflight(input) {
      const result = await legacy.ports.preflight(input);
      if (result.status !== 'ready')
        return Object.freeze({ status: 'blocked' });
      latestPreflight = result;
      return result;
    },
    acquireOwner: (input) =>
      boundary?.acquireOwner?.(input) ??
      acquireReviewPlannerV11ProductAcceptanceOwner(input),
    revalidatePreflight: ({ preflight, owner }) =>
      boundary?.revalidatePreflight?.({ preflight, owner }) ??
      revalidateDefaultReviewPlannerV11ProductPreflight(
        preflight,
        pairedEvidenceAuthority,
        boundary?.runtime,
        owner,
      ),
    async reserveLedger(input) {
      const ledger =
        await reserveReviewPlannerV11ProductAcceptanceLedger(input);
      return Object.freeze({ ledger, attemptSha256: ledger.attemptSha256() });
    },
    async writeExecutionManifest(input) {
      const manifest = createReviewPlannerV11ExecutionManifest({
        environment: input.environment,
        attemptSha256: input.attemptSha256,
        chromeExecutablePath: input.preflight.chromeExecutablePath,
      });
      await input.ledger.writeExecutionManifest(manifest);
      input.ledger.writeManifest({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
        environment: input.environment,
        attemptSha256: input.attemptSha256,
        commitSha: input.preflight.commitSha,
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        accountSha256: {
          review: sha256ReviewPlannerV8CompositionValue(
            manifest.resources.accountId.review,
          ),
          planner: sha256ReviewPlannerV8CompositionValue(
            manifest.resources.accountId.planner,
          ),
        },
        fixtureSha256: {
          review: sha256ReviewPlannerV8CompositionValue(
            manifest.resources.fixtureId.review,
          ),
          planner: sha256ReviewPlannerV8CompositionValue(
            manifest.resources.fixtureId.planner,
          ),
        },
      });
      selectedExecutionManifest = manifest;
      return manifest;
    },
    async createFixtures(input) {
      if (
        selectedExecutionManifest !== input.executionManifest ||
        latestPreflight === undefined
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
      }
      const resources = legacy.ports.generateResources(latestPreflight);
      if (boundary?.createFixtures) {
        return boundary.createFixtures(input);
      }
      const accounts = {} as Record<Component, RuntimeAccount>;
      for (const component of ['review', 'planner'] as const) {
        const account = await legacy.ports.registerAccount({
          component,
          email: resources.syntheticEmails[component],
          password: resources.passwords[component],
        });
        accounts[component] = account;
      }
      const fixtureReceipt = await legacy.ports.createFixtures({
        accounts,
        fixtureIds: resources.fixtureIds,
      });
      return Object.freeze({ resources, accounts, fixtureReceipt });
    },
    prepareRecoveryJournal: (input) => {
      if (selectedExecutionManifest !== input.executionManifest) {
        return Promise.reject(
          new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID'),
        );
      }
      return prepareReviewPlannerV11ProductAcceptanceRecoveryJournal({
        repoRoot: input.repoRoot,
        environment: input.environment,
        owner: input.owner,
      });
    },
    createRunner(input) {
      if (boundary?.createRunner) {
        return boundary.createRunner({
          ...input,
          fixtures: input.fixtures as ReviewPlannerV11FixtureState,
        });
      }
      const preflight = latestPreflight;
      if (
        selectedExecutionManifest !== input.executionManifest ||
        preflight === undefined
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
      }
      const fixtures = input.fixtures as ReviewPlannerV11FixtureState;
      const runnerLedger =
        createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter({
          environment: input.environment,
          attemptSha256: input.executionManifest.attemptSha256,
          ledger: input.ledger,
          manifest: {
            schemaVersion:
              REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
            environment: input.environment,
            attemptSha256: input.executionManifest.attemptSha256,
            commitSha: preflight.commitSha,
            provider: 'deepseek',
            model: 'deepseek-v4-pro',
            accountSha256: {
              review: sha256ReviewPlannerV8CompositionValue(
                input.executionManifest.resources.accountId.review,
              ),
              planner: sha256ReviewPlannerV8CompositionValue(
                input.executionManifest.resources.accountId.planner,
              ),
            },
            fixtureSha256: {
              review: sha256ReviewPlannerV8CompositionValue(
                input.executionManifest.resources.fixtureId.review,
              ),
              planner: sha256ReviewPlannerV8CompositionValue(
                input.executionManifest.resources.fixtureId.planner,
              ),
            },
          },
        });
      const diagnostics =
        createReviewPlannerV11ProductAcceptanceDiagnosticsPort({
          environment: input.environment,
          journal: input.journal,
          ledger: input.ledger,
        });
      const dependencies = legacy.ports.createRunnerDependencies({
        preflight,
        resources: fixtures.resources,
        accounts: fixtures.accounts,
        fixtureReceipt: fixtures.fixtureReceipt,
      });
      boundary?.captureRunnerDependencies?.({
        dependencies,
        runtime: boundary?.runtime,
      });
      return Promise.resolve(
        Object.freeze({
          run: () =>
            runReviewPlannerV8ProductAcceptance({
              environment: input.environment,
              commitSha: preflight.commitSha,
              pairedEvidenceSha256: preflight.pairedEvidenceSha256,
              accountIdSha256: fixtures.fixtureReceipt.accountIdSha256,
              capabilities: fixtures.resources.capabilities,
              webOrigin: 'http://127.0.0.1:3000',
              apiOrigin: 'http://127.0.0.1:3001',
              ledger: runnerLedger,
              dependencies,
              diagnostics,
            }),
        }),
      );
    },
    async recoverFailure(input) {
      if (boundary?.recoverFailure) {
        await boundary.recoverFailure(input);
        return;
      }
      const recovery =
        createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition(
          input.repoRoot,
          { env: options.env },
        );
      try {
        const result =
          await runReviewPlannerV11ProductAcceptanceRecoveryComposition({
            environment: input.environment,
            repoRoot: input.repoRoot,
            ports: recovery.ports,
          });
        if (result.status !== 'recovered') {
          throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
        }
      } finally {
        await recovery.dispose();
      }
    },
  };
  return Object.freeze({ ports, dispose: legacy.dispose });
}

function createReviewPlannerV11ExecutionManifest(input: {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  attemptSha256: string;
  chromeExecutablePath: string;
}): ReviewPlannerV11ProductAcceptanceExecutionManifestRecord {
  const nonce = input.attemptSha256.slice(0, 16);
  return Object.freeze({
    schemaVersion:
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    environment: input.environment,
    attemptSha256: input.attemptSha256,
    resources: {
      accountId: {
        review: `v11-synthetic-account-review-${nonce}`,
        planner: `v11-synthetic-account-planner-${nonce}`,
      },
      fixtureId: {
        review: `v11-synthetic-fixture-review-${nonce}`,
        planner: `v11-synthetic-fixture-planner-${nonce}`,
      },
      browser: {
        executablePath: input.chromeExecutablePath,
        profilePath:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            input.environment,
          ),
      },
    },
  });
}

function createReviewPlannerV11SyntheticResources(
  manifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
): GeneratedResources {
  const fixtureIds = (['review', 'planner'] as const).flatMap((component) =>
    Array.from(
      { length: 8 },
      (_, index) => `${manifest.resources.fixtureId[component]}-${index + 1}`,
    ),
  );
  return Object.freeze({
    syntheticEmails: Object.freeze({
      review: `${manifest.resources.accountId.review}@example.invalid`,
      planner: `${manifest.resources.accountId.planner}@example.invalid`,
      probe: `v11-synthetic-probe-${manifest.attemptSha256.slice(0, 16)}@example.invalid`,
    }),
    fixtureIds: Object.freeze(fixtureIds),
    browserProfilePath: manifest.resources.browser.profilePath,
    passwords: Object.freeze({
      review: randomBytes(24).toString('base64url'),
      planner: randomBytes(24).toString('base64url'),
    }),
    capabilities: Object.freeze({
      review: randomBytes(32).toString('hex'),
      planner: randomBytes(32).toString('hex'),
    }),
  });
}

async function runDefaultProductPreflight(
  input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  },
  pairedEvidenceAuthority: PairedEvidenceAuthority,
  profile: ReviewPlannerProductAcceptanceProfile,
): Promise<ProductPreflight> {
  try {
    const repoRoot = resolve(input.repoRoot);
    const expectedRoot = resolve(__dirname, '../../../..');
    if (
      process.platform !== 'win32' ||
      repoRoot !== expectedRoot ||
      !existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ) {
      throw new Error();
    }
    const repository = await readReviewPlannerV8RepositorySnapshot(
      repoRoot,
      pairedEvidenceAuthority,
    );
    if (repository === null) {
      return { status: 'blocked', code: 'paired_evidence_incomplete' };
    }
    if (
      !repository.clean ||
      (input.environment === 'main'
        ? repository.branchName !== 'main'
        : repository.branchName === 'main' ||
          !repository.branchName.startsWith('codex/'))
    ) {
      throw new Error();
    }
    await assertCurrentServerDefaultOff(repoRoot);
    if (input.environment === 'main') {
      const branchLedger = await readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot,
        environment: 'branch',
        profile,
      });
      if (
        branchLedger.status !== 'complete' ||
        branchLedger.pairedEvidenceSha256 !== repository.pairedEvidenceSha256
      ) {
        throw new Error();
      }
    }
    return Object.freeze({
      status: 'ready',
      environment: input.environment,
      repoRoot,
      commitSha: repository.commitSha,
      branchName: repository.branchName,
      pairedEvidenceSha256: repository.pairedEvidenceSha256,
      chromeExecutablePath:
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      utcStamp: new Date().toISOString().replace(/[-:.]/g, '').toLowerCase(),
    });
  } catch {
    return { status: 'blocked', code: 'preflight_failed' };
  }
}

async function runDefaultReviewPlannerV11ProductPreflight(
  input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  },
  pairedEvidenceAuthority: PairedEvidenceAuthority,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
  activeOwner?: ReviewPlannerV11ProductAcceptanceOwner,
): Promise<ProductPreflight> {
  try {
    const repoRoot = resolve(input.repoRoot);
    const expectedRoot = resolve(__dirname, '../../../..');
    if (
      process.platform !== 'win32' ||
      repoRoot !== expectedRoot ||
      !existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ) {
      throw new Error();
    }
    const repository = await readReviewPlannerV8RepositorySnapshot(
      repoRoot,
      pairedEvidenceAuthority,
      runtimeBoundary,
    );
    if (
      repository === null ||
      !repository.clean ||
      (input.environment === 'main'
        ? repository.branchName !== 'main'
        : repository.branchName === 'main' ||
          !repository.branchName.startsWith('codex/'))
    ) {
      throw new Error();
    }
    const assertRootsEmpty =
      runtimeBoundary?.assertRootsEmpty ??
      assertReviewPlannerV11ProductAcceptanceRootsEmpty;
    await assertRootsEmpty({
      repoRoot,
      environment: input.environment,
      activeOwner,
    });
    await assertCurrentServerV11PreflightDefaultOff(repoRoot, runtimeBoundary);
    if (input.environment === 'main') {
      const branch = await readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot,
        environment: 'branch',
      });
      if (branch.status !== 'complete') throw new Error();
    }
    return Object.freeze({
      status: 'ready',
      environment: input.environment,
      repoRoot,
      commitSha: repository.commitSha,
      branchName: repository.branchName,
      pairedEvidenceSha256: repository.pairedEvidenceSha256,
      chromeExecutablePath:
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      utcStamp: new Date().toISOString().replace(/[-:.]/g, '').toLowerCase(),
    });
  } catch {
    return { status: 'blocked', code: 'preflight_failed' };
  }
}

export async function assertReviewPlannerV11ProductAcceptanceRootsEmpty(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  activeOwner?: ReviewPlannerV11ProductAcceptanceOwner;
}): Promise<void> {
  if (input.activeOwner) {
    assertReviewPlannerV11ProductAcceptanceOwnerSelfLock(
      input.activeOwner,
      input.environment,
    );
  }
  const root = resolve(input.repoRoot);
  const relativeRoots = [
    {
      kind: 'public' as const,
      relativePath:
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath(
          input.environment,
        ),
    },
    {
      kind: 'recovery' as const,
      relativePath: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoveryPath(
        input.environment,
      ),
    },
    {
      kind: 'execution' as const,
      relativePath:
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestPath(
          input.environment,
        ),
    },
  ];
  for (const { kind, relativePath } of relativeRoots) {
    if (kind === 'recovery' && input.activeOwner) continue;
    const absolutePath = resolve(root, relativePath);
    if (!existsSync(absolutePath)) continue;
    if ((await readdir(absolutePath)).length !== 0) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_ROOT_NOT_EMPTY');
    }
  }
}

async function revalidateDefaultReviewPlannerV11ProductPreflight(
  preflight: Extract<ReviewPlannerV11ProductPreflight, { status: 'ready' }>,
  pairedEvidenceAuthority: PairedEvidenceAuthority,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
  activeOwner?: ReviewPlannerV11ProductAcceptanceOwner,
) {
  const current = await runDefaultReviewPlannerV11ProductPreflight(
    {
      environment: preflight.environment,
      repoRoot: preflight.repoRoot,
    },
    pairedEvidenceAuthority,
    runtimeBoundary,
    activeOwner,
  );
  return (
    current.status === 'ready' &&
    current.environment === preflight.environment &&
    current.repoRoot === preflight.repoRoot &&
    current.commitSha === preflight.commitSha &&
    current.branchName === preflight.branchName &&
    current.pairedEvidenceSha256 === preflight.pairedEvidenceSha256 &&
    current.chromeExecutablePath === preflight.chromeExecutablePath
  );
}

async function revalidateDefaultProductPreflight(
  preflight: Extract<ProductPreflight, { status: 'ready' }>,
  pairedEvidenceAuthority: PairedEvidenceAuthority,
) {
  try {
    const current = await readReviewPlannerV8RepositorySnapshot(
      preflight.repoRoot,
      pairedEvidenceAuthority,
    );
    return (
      current !== null &&
      current.clean &&
      current.commitSha === preflight.commitSha &&
      current.branchName === preflight.branchName &&
      current.pairedEvidenceSha256 === preflight.pairedEvidenceSha256
    );
  } catch {
    return false;
  }
}

function generateDefaultResources(
  preflight: Extract<ProductPreflight, { status: 'ready' }>,
  profile: ReviewPlannerProductAcceptanceProfile,
): GeneratedResources {
  const prefix = `phase695-${profile.lineage}-accept-${preflight.utcStamp}`;
  const fixtureIds = Array.from({ length: 16 }, () =>
    randomUUID().replaceAll('-', ''),
  );
  return Object.freeze({
    syntheticEmails: Object.freeze({
      review: `${prefix}-review@example.invalid`,
      planner: `${prefix}-planner@example.invalid`,
      probe: `${prefix}-probe@example.invalid`,
    }),
    fixtureIds: Object.freeze(fixtureIds),
    browserProfilePath: profile.browserProfilePath(preflight.environment),
    passwords: Object.freeze({
      review: randomBytes(24).toString('base64url'),
      planner: randomBytes(24).toString('base64url'),
    }),
    capabilities: Object.freeze({
      review: randomBytes(32).toString('hex'),
      planner: randomBytes(32).toString('hex'),
    }),
  });
}

async function createDefaultFixtures(
  state: DefaultRuntimeState,
  accounts: RuntimeAccounts,
  fixtureIds: readonly string[],
) {
  if (fixtureIds.length !== 16 || new Set(fixtureIds).size !== 16) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_FIXTURE_IDS_INVALID');
  }
  const now = new Date();
  const overdue = new Date(now.getTime() - 2 * 86_400_000);
  await state.prisma.$transaction(async (tx) => {
    for (const [index, component] of (
      ['review', 'planner'] as const
    ).entries()) {
      const offset = index * 8;
      const userId = accounts[component].id;
      const subject = `V8-${component}`;
      await tx.wrongQuestionSubjectGroup.create({
        data: {
          id: fixtureIds[offset],
          userId,
          subject,
          displayName: `${component} subject`,
        },
      });
      await tx.wrongQuestionDeck.create({
        data: {
          id: fixtureIds[offset + 1],
          userId,
          subjectGroupId: fixtureIds[offset],
          name: `${component} deck`,
          source: 'SYSTEM',
          confidence: 1,
        },
      });
      await tx.wrongQuestion.create({
        data: {
          id: fixtureIds[offset + 2],
          userId,
          questionText: `${component} weak algebra question`,
          subject,
          category: 'algebra',
          knowledgePoints: ['quadratic-equation'],
          analysis: 'synthetic acceptance fixture',
          answer: '1',
          status: 'UNRESOLVED',
        },
      });
      await tx.wrongQuestionDeckItem.create({
        data: {
          id: fixtureIds[offset + 3],
          userId,
          deckId: fixtureIds[offset + 1],
          wrongQuestionId: fixtureIds[offset + 2],
          source: 'SYSTEM',
          confidence: 1,
        },
      });
      await tx.card.create({
        data: {
          id: fixtureIds[offset + 4],
          userId,
          wrongQuestionId: fixtureIds[offset + 2],
          difficulty: 8,
          stability: 1,
          retrievability: 0.4,
          lastReview: overdue,
          nextReview: overdue,
          reviewCount: 2,
          lapses: 1,
          state: 'REVIEW',
        },
      });
      await tx.reviewLog.create({
        data: {
          id: fixtureIds[offset + 5],
          cardId: fixtureIds[offset + 4],
          rating: 2,
          scheduledDays: 1,
          elapsedDays: 2,
          stabilityBefore: 0.8,
          stabilityAfter: 1,
          difficultyBefore: 7.5,
          difficultyAfter: 8,
          reviewedAt: overdue,
        },
      });
      await tx.reviewTask.create({
        data: {
          id: fixtureIds[offset + 6],
          userId,
          cardId: fixtureIds[offset + 4],
          reviewLogId: fixtureIds[offset + 5],
          scheduledDate: overdue.toISOString().slice(0, 10),
          dueAt: overdue,
          status: 'COMPLETED',
          source: 'FSRS',
          completedAt: overdue,
        },
      });
      await tx.reviewPreference.create({
        data: {
          id: fixtureIds[offset + 7],
          userId,
          planWindowDays: 7,
        },
      });
    }
  });
}

function createDefaultRunnerDependencies(
  state: DefaultRuntimeState,
  input: Parameters<
    ReviewPlannerV8ProductAcceptanceCompositionPorts['createRunnerDependencies']
  >[0],
  profile: ReviewPlannerProductAcceptanceProfile,
  cleanupScope?: Readonly<{
    executablePath: string;
    allowedProfilePaths: readonly string[];
  }>,
): ReviewPlannerV8ProductAcceptanceRunnerDependencies {
  return {
    async activateComponent(request) {
      const previous = await readServerContainerId(state.repoRoot);
      const activationEnvironment = buildReviewPlannerV8ActivationEnvironment(
        request.component,
        request.capabilitySha256,
        requiredEnv(state.env, 'DEEPSEEK_API_KEY'),
      );
      await recreateServer(state, activationEnvironment);
      const current = await readServerContainerId(state.repoRoot);
      if (!current || current === previous) throw new Error();
      const inspected = await waitForDefaultServerReadiness(
        state.repoRoot,
        current,
        state.runtimeBoundary,
      );
      assertExpectedServerEnvironment(
        inspected.environment,
        activationEnvironment,
      );
      state.liveContainerId[request.component] = current;
    },
    readFactsDigest: ({ component, phase }) =>
      readFactsDigest(state, component, phase),
    async captureTraceBaseline({ component, slot }) {
      state.traceBaselines.set(
        `${component}:${slot}`,
        await readLiveTraceIds(
          state.accounts[component]?.token,
          state.runtimeBoundary,
        ),
      );
    },
    async dispatchApi({ component, acceptanceCapability }) {
      const traceBaselineKey = `${component}:api`;
      if (!state.traceBaselines.has(traceBaselineKey)) {
        state.traceBaselines.set(
          traceBaselineKey,
          await readLiveTraceIds(
            state.accounts[component]?.token,
            state.runtimeBoundary,
          ),
        );
      }
      return fetchSuggestion(
        state.accounts[component]?.token,
        acceptanceCapability,
        component,
        state.runtimeBoundary,
      );
    },
    // eslint-disable-next-line @typescript-eslint/unbound-method -- port callback is defined without receiver state
    async runBrowser({ component, webOrigin, onRoute }) {
      const account = state.accounts[component];
      const resources = state.resources;
      if (!account || !resources) throw new Error();
      const traceBaselineKey = `${component}:browser`;
      if (!state.traceBaselines.has(traceBaselineKey)) {
        state.traceBaselines.set(
          traceBaselineKey,
          await readLiveTraceIds(
            state.accounts[component]?.token,
            state.runtimeBoundary,
          ),
        );
      }
      const profilePath = resolve(state.repoRoot, resources.browserProfilePath);
      const callbacks = new Set<Promise<void>>();
      let responseResult:
        | ReviewPlannerV8ProductAcceptanceRequestResult
        | undefined;
      let contextClosed = false;
      let continuedRequests = 0;
      state.runtimeBoundary?.chromium?.();
      const context = await chromium.launchPersistentContext(profilePath, {
        executablePath: input.preflight.chromeExecutablePath,
        headless: false,
      });
      try {
        const page = context.pages()[0] ?? (await context.newPage());
        await page.goto(`${webOrigin}/login`);
        await page.locator('#login-email').fill(account.email);
        await page
          .locator('#login-password')
          .fill(resources.passwords[component]);
        await page.locator('button[type=submit]').click();
        await page.waitForURL(`${webOrigin}/chat`);
        await page.route(
          'http://127.0.0.1:3001/review-agent/suggestions*',
          async (route, request) => {
            const pending = (async () => {
              await onRoute(
                {
                  async continueWithAcceptanceCapability(capability) {
                    continuedRequests += 1;
                    await route.continue({
                      headers: mergeReviewPlannerV8AcceptanceHeaders(
                        request.headers(),
                        capability,
                      ),
                    });
                  },
                  abort: () => route.abort(),
                },
                { url: () => request.url(), method: () => request.method() },
              );
            })();
            callbacks.add(pending);
            await pending.finally(() => callbacks.delete(pending));
          },
        );
        const response = await Promise.all([
          page.waitForResponse((candidate) =>
            candidate
              .url()
              .startsWith('http://127.0.0.1:3001/review-agent/suggestions?'),
          ),
          page.goto(`${webOrigin}/plan`),
        ]).then(([candidate]) => candidate);
        responseResult = parseSuggestionEnvelope(
          await response.json(),
          component,
        );
        await page.getByText('Agent 学习建议').waitFor();
        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: true,
        });
        await page.waitForTimeout(250);
        await context.close();
        contextClosed = true;
        await Promise.allSettled([...callbacks]);
        await terminateDefaultReviewPlannerV8ExactBrowser({
          repoRoot: state.repoRoot,
          executablePath: input.preflight.chromeExecutablePath,
          profilePath,
          profile,
          allowedProfilePaths: [resources.browserProfilePath],
        });
        if (
          !responseResult ||
          continuedRequests !== 1 ||
          callbacks.size !== 0
        ) {
          throw new Error();
        }
        return {
          ...responseResult,
          screenshot,
          receipt: {
            headed: true,
            contextClosed: true,
            routeCallbacksSettled: true,
            continuedRequests: 1 as const,
            abortedLateRequests: 0 as const,
            noPendingCallbacks: true as const,
          },
        };
      } finally {
        if (!contextClosed) await context.close().catch(() => undefined);
        await Promise.allSettled([...callbacks]);
      }
    },
    async readPersistedTraces({ component, slot }) {
      const token = state.accounts[component]?.token;
      const baseline = state.traceBaselines.get(`${component}:${slot}`);
      if (!token || !baseline) throw new Error();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const list = await fetchTraceList(token, state.runtimeBoundary);
        const candidates = list.filter((id) => !baseline.has(id));
        if (candidates.length === 1) {
          const trace = await fetchTraceDetail(
            token,
            candidates[0],
            state.runtimeBoundary,
          );
          state.traceIds.add(trace.traceId);
          return [trace];
        }
        if (candidates.length > 1) throw new Error();
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
      }
      throw new Error();
    },
    restoreDefaultOff: (component) =>
      restoreDefaultOff(state, component, profile),
    async verifyOwnerIsolation() {
      const review = state.accounts.review;
      const planner = state.accounts.planner;
      if (!review || !planner) throw new Error();
      return verifyReviewPlannerOwnerFactsIsolation({
        prisma: state.prisma,
        accountIds: { review: review.id, planner: planner.id },
        fixtureIds: state.fixtureIds,
        snapshots: state.factsSnapshots,
      });
    },
    async cleanup() {
      await cleanupDefaultState(state, cleanupScope);
      return {
        schemaVersion: profile.schemas.cleanup,
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      };
    },
  };
}

async function readFactsDigest(
  state: DefaultRuntimeState,
  component: Component,
  phase: FactsPhase,
) {
  const account = state.accounts[component];
  if (!account) throw new Error();
  const snapshot = await readReviewPlannerOwnerFactsSnapshot(
    state.prisma,
    account.id,
  );
  state.factsSnapshots[component][phase] = snapshot;
  return hashReviewPlannerOwnerFactsSnapshot(snapshot);
}

async function restoreDefaultOff(
  state: DefaultRuntimeState,
  component: Component,
  profile: ReviewPlannerProductAcceptanceProfile,
) {
  const previous = state.liveContainerId[component];
  if (!previous) throw new Error();
  await recreateServer(state, buildReviewPlannerV8DefaultOffEnvironment());
  const current = await readServerContainerId(state.repoRoot);
  if (!current || current === previous) throw new Error();
  const inspected = await waitForDefaultServerReadiness(
    state.repoRoot,
    current,
    state.runtimeBoundary,
  );
  assertDefaultOffEnvironment(inspected.environment);
  const account = state.accounts[component];
  if (!account) throw new Error();
  const probe = await fetchSuggestion(
    account.token,
    undefined,
    component,
    state.runtimeBoundary,
  );
  if (
    probe.target.attempted ||
    probe.target.provenance !== 'local_deterministic'
  ) {
    throw new Error();
  }
  return {
    schemaVersion: profile.schemas.defaultOff,
    component,
    container: {
      previousIdSha256: sha256ReviewPlannerV8CompositionValue(previous),
      newIdSha256: sha256ReviewPlannerV8CompositionValue(current),
    },
    inspected: {
      aiProviderMode: 'mock',
      liveCallsEnabled: false,
      reviewAgentModelEnabled: false,
      plannerAgentModelEnabled: false,
      acceptanceEnabled: false,
      acceptanceComponent: '',
      capabilitySha256: '',
      maxRequests: 0,
      deepseekCredentialPresent: false,
      openaiCredentialPresent: false,
    },
    binding: {
      port: 3001,
      healthContainerIdSha256: sha256ReviewPlannerV8CompositionValue(current),
    },
    deterministicProbe: {
      passed: true,
      provenance: 'local_deterministic',
    },
    providerInvocations: 0,
  };
}

export function buildReviewPlannerV8ActivationEnvironment(
  component: Component,
  capabilitySha256: string,
  deepseekApiKey: string,
): Readonly<Record<string, string>> {
  if (!/^[a-f0-9]{64}$/.test(capabilitySha256) || !deepseekApiKey) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_ACTIVATION_INVALID');
  }
  return Object.freeze({
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_MODEL: 'deepseek-v4-pro',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: deepseekApiKey,
    OPENAI_API_KEY: '',
    REVIEW_AGENT_MODEL_ENABLED: component === 'review' ? 'true' : 'false',
    PLANNER_AGENT_MODEL_ENABLED: component === 'planner' ? 'true' : 'false',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: component,
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: capabilitySha256,
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '2',
    REVIEW_AGENT_MODEL_TIMEOUT_MS: '4500',
    PLANNER_AGENT_MODEL_TIMEOUT_MS: '4500',
  });
}

export function buildReviewPlannerV8DefaultOffEnvironment(): Readonly<
  Record<string, string>
> {
  return {
    AI_PROVIDER_MODE: 'mock',
    AI_ENABLE_LIVE_CALLS: 'false',
    AI_MODEL: 'deepseek-v4-pro',
    AI_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
    REVIEW_AGENT_MODEL_ENABLED: 'false',
    PLANNER_AGENT_MODEL_ENABLED: 'false',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'false',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: '',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: '',
    REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '0',
    REVIEW_AGENT_MODEL_TIMEOUT_MS: '4500',
    PLANNER_AGENT_MODEL_TIMEOUT_MS: '4500',
  };
}

export function buildReviewPlannerV8ServerRecreateEnvironment(
  rootEnvironment: Readonly<Record<string, string>>,
  overrides: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const activationEnabled =
    overrides.REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED === 'true';
  const productDeepseekApiKey = activationEnabled
    ? overrides.DEEPSEEK_API_KEY
    : '';
  if (activationEnabled && !productDeepseekApiKey) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_ACTIVATION_INVALID');
  }
  return Object.freeze({
    ...rootEnvironment,
    ...overrides,
    DEEPSEEK_API_KEY: '',
    REVIEW_PLANNER_PRODUCT_DEEPSEEK_API_KEY: productDeepseekApiKey,
  });
}

async function recreateServer(
  state: Readonly<{
    repoRoot: string;
    env: Readonly<Record<string, string>>;
    runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary;
  }>,
  overrides: Readonly<Record<string, string>>,
) {
  state.runtimeBoundary?.dockerExec?.();
  const command = buildReviewPlannerV8ServerRecreateCommand();
  await execFileAsync(command.file, [...command.args], {
    cwd: state.repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      ...buildReviewPlannerV8ServerRecreateEnvironment(state.env, overrides),
    },
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
  });
}

export function buildReviewPlannerV8ServerRecreateCommand() {
  return Object.freeze({
    file: 'docker',
    args: Object.freeze([
      'compose',
      '--env-file',
      '.env',
      '-f',
      'docker/docker-compose.dev.yml',
      '--profile',
      'worker',
      'up',
      '-d',
      '--no-deps',
      '--force-recreate',
      'server',
    ]),
  });
}

export function mergeReviewPlannerV8AcceptanceHeaders(
  headers: Readonly<Record<string, string>>,
  capability: string,
) {
  if (!capability) throw new Error('V8_PRODUCT_ACCEPTANCE_CAPABILITY_INVALID');
  return {
    ...headers,
    'x-prepmind-review-planner-acceptance': capability,
  };
}

export type ReviewPlannerV8BrowserProcess = Readonly<{
  processId: number;
  executablePath: string;
  commandLine: string;
}>;

export function selectReviewPlannerV8ExactBrowserProcesses(
  processes: readonly ReviewPlannerV8BrowserProcess[],
  executablePath: string,
  profilePath: string,
) {
  const expectedExecutable = normalizeWindowsPath(executablePath);
  const expectedProfile = normalizeWindowsPath(profilePath);
  return Object.freeze(
    processes
      .filter((process) => {
        if (
          !Number.isSafeInteger(process.processId) ||
          process.processId <= 0 ||
          normalizeWindowsPath(process.executablePath) !== expectedExecutable
        ) {
          return false;
        }
        try {
          const args = parseWindowsCommandLine(process.commandLine);
          const profiles: string[] = [];
          for (let index = 0; index < args.length; index += 1) {
            const argument = args[index];
            const lowered = argument.toLowerCase();
            if (lowered === '--user-data-dir') {
              if (index + 1 >= args.length) return false;
              profiles.push(args[index + 1]);
              index += 1;
            } else if (lowered.startsWith('--user-data-dir=')) {
              profiles.push(argument.slice('--user-data-dir='.length));
            }
          }
          return (
            profiles.length === 1 &&
            normalizeWindowsPath(profiles[0]) === expectedProfile
          );
        } catch {
          return false;
        }
      })
      .sort((left, right) => left.processId - right.processId),
  );
}

export async function terminateReviewPlannerV8ExactBrowser(input: {
  executablePath: string;
  profilePath: string;
  listProcesses(
    signal: AbortSignal,
  ): Promise<readonly ReviewPlannerV8BrowserProcess[]>;
  terminateProcess(
    process: ReviewPlannerV8BrowserProcess,
    signal: AbortSignal,
  ): Promise<void>;
  removeProfile(signal: AbortSignal): Promise<void>;
  profileExists(signal: AbortSignal): boolean | Promise<boolean>;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  const deadline = Date.now() + input.timeoutMs;
  const attemptedIdentities = new Set<string>();
  const terminatedProcessIds = new Set<number>();
  const terminateNewProcesses = async (
    processes: readonly ReviewPlannerV8BrowserProcess[],
  ) => {
    const currentIdentities = new Set(processes.map(browserProcessIdentity));
    for (const identity of attemptedIdentities) {
      if (!currentIdentities.has(identity)) {
        attemptedIdentities.delete(identity);
      }
    }
    for (const process of processes) {
      const identity = browserProcessIdentity(process);
      if (attemptedIdentities.has(identity)) continue;
      await runBrowserDrainOperation(
        (signal) => input.terminateProcess(process, signal),
        deadline,
      );
      attemptedIdentities.add(identity);
      terminatedProcessIds.add(process.processId);
    }
  };
  const initial = selectReviewPlannerV8ExactBrowserProcesses(
    await runBrowserDrainOperation(
      (signal) => input.listProcesses(signal),
      deadline,
    ),
    input.executablePath,
    input.profilePath,
  );
  await terminateNewProcesses(initial);
  while (Date.now() <= deadline) {
    const remaining = selectReviewPlannerV8ExactBrowserProcesses(
      await runBrowserDrainOperation(
        (signal) => input.listProcesses(signal),
        deadline,
      ),
      input.executablePath,
      input.profilePath,
    );
    await terminateNewProcesses(remaining);
    if (remaining.length === 0) {
      await runBrowserProfileRemoval(
        (signal) => input.removeProfile(signal),
        deadline,
      );
      if (
        await runBrowserDrainOperation(
          (signal) => Promise.resolve(input.profileExists(signal)),
          deadline,
        )
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PROFILE_REMAINS');
      }
      return Object.freeze({
        terminatedProcessIds: Object.freeze(
          [...terminatedProcessIds].sort((left, right) => left - right),
        ),
        remaining: 0 as const,
      });
    }
    const delay = Math.min(input.pollIntervalMs, deadline - Date.now());
    if (delay > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
}

async function runBrowserProfileRemoval(
  operation: (signal: AbortSignal) => Promise<void>,
  deadline: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
  }
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const removal = Promise.resolve().then(() => operation(controller.signal));
  const outcome = await Promise.race([
    removal.then(
      () => ({ status: 'settled' as const }),
      (error: unknown) => ({ status: 'failed' as const, error }),
    ),
    new Promise<Readonly<{ status: 'timed_out' }>>((resolveTimeout) => {
      timeout = setTimeout(() => {
        controller.abort();
        resolveTimeout({ status: 'timed_out' });
      }, remaining);
    }),
  ]);
  if (timeout !== undefined) clearTimeout(timeout);
  if (outcome.status === 'timed_out') {
    await removal.catch(() => undefined);
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
  }
  if (outcome.status === 'failed') {
    if (controller.signal.aborted) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
    }
    throw outcome.error;
  }
}

function browserProcessIdentity(process: ReviewPlannerV8BrowserProcess) {
  return `${process.processId}\u0000${process.executablePath}\u0000${process.commandLine}`;
}

async function runBrowserDrainOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadline: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remaining);
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      'abort',
      () => reject(new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT')),
      { once: true },
    );
  });
  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function parseWindowsCommandLine(commandLine: string) {
  const args: string[] = [];
  let index = 0;
  while (index < commandLine.length) {
    while (/\s/.test(commandLine[index] ?? '')) index += 1;
    if (index >= commandLine.length) break;
    let argument = '';
    let quoted = false;
    while (index < commandLine.length) {
      const character = commandLine[index];
      if (!quoted && /\s/.test(character)) break;
      if (character === '\\') {
        let slashes = 0;
        while (commandLine[index] === '\\') {
          slashes += 1;
          index += 1;
        }
        if (commandLine[index] === '"') {
          argument += '\\'.repeat(Math.floor(slashes / 2));
          if (slashes % 2 === 0) quoted = !quoted;
          else argument += '"';
          index += 1;
        } else {
          argument += '\\'.repeat(slashes);
        }
        continue;
      }
      if (character === '"') {
        quoted = !quoted;
        index += 1;
        continue;
      }
      argument += character;
      index += 1;
    }
    if (quoted) throw new Error('V8_PRODUCT_ACCEPTANCE_COMMAND_LINE_INVALID');
    args.push(argument);
    while (/\s/.test(commandLine[index] ?? '')) index += 1;
  }
  return args;
}

function normalizeWindowsPath(value: string) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PATH_INVALID');
  }
  const normalized = resolve(value)
    .replace(/[\\/]+$/, '')
    .toLowerCase();
  if (!normalized) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PATH_INVALID');
  }
  return normalized;
}

async function listDefaultReviewPlannerV8BrowserProcesses(
  executablePath: string,
  signal?: AbortSignal,
) {
  const result = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$items=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.CommandLine -and $_.ExecutablePath -ieq $env:V8_EXEC } | ForEach-Object { [pscustomobject]@{ processId=[int]$_.ProcessId; executablePath=[string]$_.ExecutablePath; commandLine=[string]$_.CommandLine } }); ConvertTo-Json -InputObject $items -Compress',
    ],
    {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, V8_EXEC: resolve(executablePath) },
      signal,
    },
  );
  const decoded = JSON.parse(result.stdout || '[]') as unknown;
  if (!Array.isArray(decoded)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PROCESS_LIST_INVALID');
  }
  return Object.freeze(
    decoded.map((value) => {
      const record = asRecord(value);
      if (
        Object.keys(record).sort().join(',') !==
          'commandLine,executablePath,processId' ||
        !Number.isSafeInteger(record.processId) ||
        Number(record.processId) <= 0
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PROCESS_LIST_INVALID');
      }
      return Object.freeze({
        processId: Number(record.processId),
        executablePath: requireString(record.executablePath),
        commandLine: requireString(record.commandLine),
      });
    }),
  );
}

async function terminateDefaultReviewPlannerV8BrowserProcess(
  browserProcess: ReviewPlannerV8BrowserProcess,
  signal?: AbortSignal,
) {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "$target=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$env:V8_PID); if ($null -eq $target -or $target.ExecutablePath -ine $env:V8_EXEC -or $target.CommandLine -cne $env:V8_COMMAND_LINE) { exit 41 }; $result=Invoke-CimMethod -InputObject $target -MethodName Terminate; if ($result.ReturnValue -ne 0) { exit 42 }",
    ],
    {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        V8_PID: String(browserProcess.processId),
        V8_EXEC: browserProcess.executablePath,
        V8_COMMAND_LINE: browserProcess.commandLine,
      },
      signal,
    },
  );
}

async function terminateDefaultReviewPlannerV8ExactBrowser(input: {
  repoRoot: string;
  executablePath: string;
  profilePath: string;
  profile?: ReviewPlannerProductAcceptanceProfile;
  allowedProfilePaths?: readonly string[];
}) {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  const repoRoot = resolve(input.repoRoot);
  const profilePath = resolve(input.profilePath);
  const allowedProfiles = new Set(
    (
      input.allowedProfilePaths ??
      (['branch', 'main'] as const).map((environment) =>
        profile.browserProfilePath(environment),
      )
    ).map((candidate) => normalizeWindowsPath(resolve(repoRoot, candidate))),
  );
  if (!allowedProfiles.has(normalizeWindowsPath(profilePath))) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PATH_INVALID');
  }
  return terminateReviewPlannerV8ExactBrowser({
    executablePath: resolve(input.executablePath),
    profilePath,
    listProcesses: (signal) =>
      listDefaultReviewPlannerV8BrowserProcesses(input.executablePath, signal),
    terminateProcess: (browserProcess, signal) =>
      terminateDefaultReviewPlannerV8BrowserProcess(browserProcess, signal),
    removeProfile: (signal) =>
      removeDefaultReviewPlannerV8BrowserProfile(repoRoot, profilePath, signal),
    profileExists: () => existsSync(profilePath),
    timeoutMs: 10_000,
    pollIntervalMs: 100,
  });
}

async function removeDefaultReviewPlannerV8BrowserProfile(
  repoRoot: string,
  profilePath: string,
  signal: AbortSignal,
) {
  await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$path=$env:V8_PROFILE; if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop }; if (Test-Path -LiteralPath $path) { exit 43 }',
    ],
    {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, V8_PROFILE: profilePath },
      signal,
    },
  );
}

async function readServerContainerId(
  repoRoot: string,
  signal?: AbortSignal,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  return (
    await runRuntimeBoundReadOnlyProcess(
      runtimeBoundary,
      repoRoot,
      'docker',
      [
        'compose',
        '--env-file',
        '.env',
        '-f',
        'docker/docker-compose.dev.yml',
        '--profile',
        'worker',
        'ps',
        '-q',
        'server',
      ],
      { signal },
    )
  ).trim();
}

async function inspectServerContainer(
  containerId: string,
  signal?: AbortSignal,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  const output = await runRuntimeBoundReadOnlyProcess(
    runtimeBoundary,
    process.cwd(),
    'docker',
    [
      'inspect',
      '--format',
      '{"id":{{json .Id}},"environment":{{json .Config.Env}},"status":{{json .State.Status}},"health":{{json .State.Health.Status}},"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}',
      containerId,
    ],
    { signal },
  );
  return parseReviewPlannerV8ServerInspection(output, containerId);
}

export type ReviewPlannerV8ServerInspection = Readonly<{
  id: string;
  environment: readonly string[];
  status: 'running';
  health: 'starting' | 'healthy';
  composeProject: 'docker';
  composeService: 'server';
  publishedPort: 3001;
}>;

export function parseReviewPlannerV8ServerInspection(
  output: string,
  expectedContainerId: string,
): ReviewPlannerV8ServerInspection {
  try {
    const value = asRecord(JSON.parse(output) as unknown);
    if (
      Object.keys(value).sort().join(',') !==
        'environment,health,id,labels,ports,status' ||
      requireString(value.id) !== expectedContainerId ||
      !/^[a-f0-9]{64}$/.test(expectedContainerId) ||
      value.status !== 'running' ||
      (value.health !== 'starting' && value.health !== 'healthy') ||
      !Array.isArray(value.environment) ||
      !value.environment.every((entry) => typeof entry === 'string')
    ) {
      throw new Error();
    }
    const labels = asRecord(value.labels);
    if (
      labels['com.docker.compose.project'] !== 'docker' ||
      labels['com.docker.compose.service'] !== 'server'
    ) {
      throw new Error();
    }
    const ports = asRecord(value.ports);
    if (Object.keys(ports).join(',') !== '3001/tcp') throw new Error();
    const bindings = ports['3001/tcp'];
    if (
      !Array.isArray(bindings) ||
      bindings.length === 0 ||
      !bindings.every((binding) => {
        const record = asRecord(binding);
        return (
          Object.keys(record).sort().join(',') === 'HostIp,HostPort' &&
          typeof record.HostIp === 'string' &&
          record.HostIp.length > 0 &&
          record.HostPort === '3001'
        );
      })
    ) {
      throw new Error();
    }
    return Object.freeze({
      id: expectedContainerId,
      environment: Object.freeze([...value.environment]),
      status: 'running',
      health: value.health,
      composeProject: 'docker',
      composeService: 'server',
      publishedPort: 3001,
    });
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
  }
}

function assertDefaultOffEnvironment(entries: readonly string[]) {
  assertExpectedServerEnvironment(
    entries,
    buildReviewPlannerV8DefaultOffEnvironment(),
  );
}

function assertExpectedServerEnvironment(
  entries: readonly string[],
  expected: Readonly<Record<string, string>>,
) {
  const env = new Map(
    entries.map((entry) => {
      const index = entry.indexOf('=');
      return [entry.slice(0, index), entry.slice(index + 1)] as const;
    }),
  );
  for (const [key, value] of Object.entries(expected)) {
    if (env.get(key) !== value) throw new Error();
  }
}

async function assertCurrentServerDefaultOff(
  repoRoot: string,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  const id = await readServerContainerId(repoRoot, undefined, runtimeBoundary);
  if (!id) throw new Error();
  const inspected = await waitForDefaultServerReadiness(
    repoRoot,
    id,
    runtimeBoundary,
  );
  assertDefaultOffEnvironment(inspected.environment);
}

async function assertCurrentServerV11PreflightDefaultOff(
  repoRoot: string,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  const id = await readServerContainerId(repoRoot, undefined, runtimeBoundary);
  if (!id) throw new Error();
  const inspected = await waitForDefaultServerReadiness(
    repoRoot,
    id,
    runtimeBoundary,
  );
  assertV11PreflightDefaultOffEnvironment(inspected.environment);
}

function assertV11PreflightDefaultOffEnvironment(entries: readonly string[]) {
  const environment = new Map(
    entries.map((entry) => {
      const index = entry.indexOf('=');
      return [entry.slice(0, index), entry.slice(index + 1)] as const;
    }),
  );
  const model = environment.get('AI_MODEL');
  if (model !== 'deepseek-v4-flash' && model !== 'deepseek-v4-pro') {
    throw new Error();
  }
  assertExpectedServerEnvironment(entries, {
    ...buildReviewPlannerV8DefaultOffEnvironment(),
    AI_MODEL: model,
  });
}

export async function waitForReviewPlannerV8ServerReadiness(input: {
  expectedContainerId: string;
  readCurrentContainerId(signal: AbortSignal): Promise<string>;
  inspectContainer(
    signal: AbortSignal,
  ): Promise<ReviewPlannerV8ServerInspection>;
  fetchHealth(signal: AbortSignal): Promise<boolean>;
  totalTimeoutMs: number;
  attemptTimeoutMs: number;
  pollIntervalMs?: number;
}) {
  const deadline = Date.now() + input.totalTimeoutMs;
  const pollIntervalMs = input.pollIntervalMs ?? 250;
  while (Date.now() < deadline) {
    try {
      const current = await runReadinessOperation(
        (signal) => input.readCurrentContainerId(signal),
        deadline,
        input.attemptTimeoutMs,
      );
      if (current !== input.expectedContainerId) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
      }
      const inspected = await runReadinessOperation(
        (signal) => input.inspectContainer(signal),
        deadline,
        input.attemptTimeoutMs,
      );
      if (inspected.id !== input.expectedContainerId) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
      }
      if (inspected.health === 'healthy') {
        const healthy = await runReadinessOperation(
          (signal) => input.fetchHealth(signal),
          deadline,
          input.attemptTimeoutMs,
        ).catch(() => false);
        if (healthy) {
          if (
            (await runReadinessOperation(
              (signal) => input.readCurrentContainerId(signal),
              deadline,
              input.attemptTimeoutMs,
            )) !== input.expectedContainerId
          ) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
          }
          const finalInspection = await runReadinessOperation(
            (signal) => input.inspectContainer(signal),
            deadline,
            input.attemptTimeoutMs,
          );
          if (
            finalInspection.id !== input.expectedContainerId ||
            finalInspection.health !== 'healthy'
          ) {
            throw new Error('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
          }
          return finalInspection;
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID'
      ) {
        throw error;
      }
    }
    const delay = Math.min(pollIntervalMs, deadline - Date.now());
    if (delay > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delay));
    }
  }
  throw new Error('V8_PRODUCT_ACCEPTANCE_HEALTH_TIMEOUT');
}

async function runReadinessOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  deadline: number,
  attemptTimeoutMs: number,
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_READINESS_ATTEMPT_TIMEOUT');
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Math.min(attemptTimeoutMs, remaining)),
  );
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      'abort',
      () =>
        reject(new Error('V8_PRODUCT_ACCEPTANCE_READINESS_ATTEMPT_TIMEOUT')),
      { once: true },
    );
  });
  try {
    return await Promise.race([operation(controller.signal), aborted]);
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForDefaultServerReadiness(
  repoRoot: string,
  expectedContainerId: string,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  return waitForReviewPlannerV8ServerReadiness({
    expectedContainerId,
    readCurrentContainerId: (signal) =>
      readServerContainerId(repoRoot, signal, runtimeBoundary),
    inspectContainer: (signal) =>
      inspectServerContainer(expectedContainerId, signal, runtimeBoundary),
    fetchHealth: async (signal) => {
      runtimeBoundary?.fetch?.();
      const healthInit = { signal };
      const response = runtimeBoundary?.fetchHealth
        ? await runtimeBoundary.fetchHealth({
            url: 'http://127.0.0.1:3001/health',
            init: healthInit,
          })
        : await fetch('http://127.0.0.1:3001/health', healthInit);
      return response.ok;
    },
    totalTimeoutMs: 45_000,
    attemptTimeoutMs: 2_000,
    pollIntervalMs: 250,
  });
}

async function fetchSuggestion(
  token: string | undefined,
  acceptanceCapability: string | undefined,
  component: Component,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
): Promise<ReviewPlannerV8ProductAcceptanceRequestResult> {
  if (!token) throw new Error();
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (acceptanceCapability) {
    headers['x-prepmind-review-planner-acceptance'] = acceptanceCapability;
  }
  const body = await fetchEnvelope(
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-480',
    { headers },
    runtimeBoundary,
  );
  return parseSuggestionEnvelope(body, component);
}

function parseSuggestionEnvelope(
  envelope: unknown,
  component: Component,
): ReviewPlannerV8ProductAcceptanceRequestResult {
  const data = unwrapEnvelope(envelope);
  const observations = asRecord(asRecord(data).modelObservations);
  const target = parseObservation(observations[component]);
  const inactive = parseObservation(
    observations[component === 'review' ? 'planner' : 'review'],
  );
  return Object.freeze({ target, inactive });
}

function parseObservation(value: unknown) {
  const record = asRecord(value);
  const usage = asRecord(record.usage);
  return Object.freeze({
    attempted: requireBoolean(record.attempted),
    degraded: requireBoolean(record.degraded),
    disposition: requireString(record.disposition),
    provenance: requireString(record.provenance),
    durationMs: requireNonNegativeInteger(record.durationMs),
    usage: Object.freeze({
      inputTokens: requireNonNegativeInteger(usage.inputTokens),
      outputTokens: requireNonNegativeInteger(usage.outputTokens),
    }),
  });
}

async function readLiveTraceIds(
  token: string | undefined,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  if (!token) throw new Error();
  return new Set(await fetchTraceList(token, runtimeBoundary));
}

async function fetchTraceList(
  token: string,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  const envelope = await fetchEnvelope(
    'http://127.0.0.1:3001/agent-traces?limit=50&route=review_analysis&mode=live',
    { headers: { authorization: `Bearer ${token}` } },
    runtimeBoundary,
  );
  const runs = asRecord(unwrapEnvelope(envelope)).runs;
  if (!Array.isArray(runs)) throw new Error();
  return runs.map((run) => requireString(asRecord(run).id));
}

async function fetchTraceDetail(
  token: string,
  traceId: string,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
): Promise<ReviewPlannerV8ProductAcceptancePersistedTrace> {
  const envelope = await fetchEnvelope(
    `http://127.0.0.1:3001/agent-traces/${encodeURIComponent(traceId)}`,
    { headers: { authorization: `Bearer ${token}` } },
    runtimeBoundary,
  );
  const data = asRecord(unwrapEnvelope(envelope));
  const run = asRecord(data.run);
  if (!Array.isArray(data.steps) || data.steps.length !== 4) throw new Error();
  const steps = data.steps.map((value) => {
    const step = asRecord(value);
    const node = requireString(step.node);
    if (
      ![
        'deterministic_review',
        'review_candidate',
        'deterministic_planner',
        'planner_candidate',
      ].includes(node)
    ) {
      throw new Error();
    }
    const candidateApplied =
      requireString(step.outputSummary) === 'disposition=candidate_applied';
    return Object.freeze({
      name: node as
        | 'deterministic_review'
        | 'review_candidate'
        | 'deterministic_planner'
        | 'planner_candidate',
      attempted: candidateApplied,
      disposition: candidateApplied ? 'candidate_applied' : 'not_eligible',
      provenance: candidateApplied ? 'live_candidate' : 'local_deterministic',
    });
  });
  const applied = steps.filter((step) => step.attempted);
  if (applied.length !== 1) throw new Error();
  return Object.freeze({
    traceId,
    component: applied[0].name === 'review_candidate' ? 'review' : 'planner',
    provider: requireString(run.modelProvider),
    model: requireString(run.modelName),
    pricingKnown: requireBoolean(run.pricingKnown),
    costEstimateUsd: Number(run.costEstimate),
    steps: Object.freeze(steps),
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
    durationMs: requirePositiveInteger(run.totalDurationMs),
    usage: Object.freeze({
      inputTokens: requirePositiveInteger(run.inputTokenEstimate),
      outputTokens: requirePositiveInteger(run.outputTokenEstimate),
    }),
  });
}

async function cleanupDefaultState(
  state: DefaultRuntimeState,
  cleanupScope?: Readonly<{
    executablePath: string;
    allowedProfilePaths: readonly string[];
  }>,
) {
  const accountEntries = Object.values(state.accounts);
  await state.prisma.$transaction(async (tx) => {
    if (state.traceIds.size > 0) {
      await tx.agentTraceRun.deleteMany({
        where: { id: { in: [...state.traceIds] } },
      });
    }
    for (const account of accountEntries) {
      await tx.user.deleteMany({
        where: { id: account.id, email: account.email },
      });
    }
  });
  const profile = state.resources?.browserProfilePath;
  if (profile) {
    await state.terminateBrowser({
      repoRoot: state.repoRoot,
      executablePath:
        cleanupScope?.executablePath ??
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      profilePath: resolve(state.repoRoot, profile),
      ...(cleanupScope
        ? { allowedProfilePaths: cleanupScope.allowedProfilePaths }
        : {}),
    });
  }
  const [users, fixtures, traces] = await Promise.all([
    state.prisma.user.count({
      where: { id: { in: accountEntries.map((account) => account.id) } },
    }),
    state.prisma.wrongQuestion.count({
      where: { id: { in: [state.fixtureIds[2], state.fixtureIds[10]] } },
    }),
    state.prisma.agentTraceRun.count({
      where: { id: { in: [...state.traceIds] } },
    }),
  ]);
  if (users !== 0 || fixtures !== 0 || traces !== 0) throw new Error();
}

function readRootEnvironment(repoRoot: string) {
  const contents = readFileSync(resolve(repoRoot, '.env'), 'utf8');
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return Object.freeze(values);
}

function requiredEnv(env: Readonly<Record<string, string>>, key: string) {
  const value = env[key];
  if (!value) throw new Error('V8_PRODUCT_ACCEPTANCE_CONFIG_MISSING');
  return value;
}

export function assertReviewPlannerV8EvidenceIndexIsOrdinary(
  output: string,
  expectedRelativePaths: readonly string[],
) {
  const lines = output.split(/\r?\n/).filter((line) => line.length > 0);
  const actualPaths: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('H ')) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
    }
    actualPaths.push(line.slice(2));
  }
  const expected = [...expectedRelativePaths].sort();
  actualPaths.sort();
  if (
    expected.length !== actualPaths.length ||
    expected.some((path, index) => path !== actualPaths[index])
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
  }
}

export function parseReviewPlannerV8GitPorcelainSnapshot(output: string) {
  const lines = output.split(/\r?\n/).filter((line) => line.length > 0);
  const oidLines = lines.filter((line) => line.startsWith('# branch.oid '));
  const headLines = lines.filter((line) => line.startsWith('# branch.head '));
  if (oidLines.length !== 1 || headLines.length !== 1) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_GIT_SNAPSHOT_INVALID');
  }
  const commitSha = oidLines[0].slice('# branch.oid '.length);
  const branchName = headLines[0].slice('# branch.head '.length);
  if (
    !/^[a-f0-9]{40}$/.test(commitSha) ||
    !/^[A-Za-z0-9._/-]{1,255}$/.test(branchName)
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_GIT_SNAPSHOT_INVALID');
  }
  return Object.freeze({
    commitSha,
    branchName,
    clean: lines.every((line) => line.startsWith('# ')),
  });
}

export async function captureReviewPlannerV8RepositorySnapshot(input: {
  readGitStatus(): Promise<string>;
  readEvidenceReference(): Promise<Readonly<{ relativePath: string }> | null>;
  readCommittedEvidence(
    commitSha: string,
    relativePath: string,
  ): Promise<string>;
}) {
  const before = parseReviewPlannerV8GitPorcelainSnapshot(
    await input.readGitStatus(),
  );
  const evidence = await input.readEvidenceReference();
  if (evidence === null) return null;
  if (
    !/^docs\/acceptance\/evidence\/[A-Za-z0-9._/-]+\.json$/.test(
      evidence.relativePath,
    )
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_PATH_INVALID');
  }
  const committedEvidence = await input.readCommittedEvidence(
    before.commitSha,
    evidence.relativePath,
  );
  parseReviewPlannerControlledLiveV8CommittedCandidate(committedEvidence);
  const after = parseReviewPlannerV8GitPorcelainSnapshot(
    await input.readGitStatus(),
  );
  if (
    before.commitSha !== after.commitSha ||
    before.branchName !== after.branchName ||
    before.clean !== after.clean
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_REPOSITORY_DRIFTED');
  }
  return Object.freeze({
    ...after,
    pairedEvidenceSha256: createHash('sha256')
      .update(committedEvidence)
      .digest('hex'),
  });
}

async function readReviewPlannerV8RepositorySnapshot(
  repoRoot: string,
  authority: PairedEvidenceAuthority,
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  const evidenceDirectory =
    REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
  const readGitStatus = () =>
    runRuntimeBoundReadOnlyProcess(runtimeBoundary, repoRoot, 'git', [
      'status',
      '--porcelain=v2',
      '--branch',
      '--untracked-files=all',
    ]);
  const listEvidencePaths = async () =>
    (await readdir(resolve(repoRoot, evidenceDirectory)))
      .sort()
      .map((name) => `${evidenceDirectory}/${name}`);
  const readEvidenceIndex = () =>
    runRuntimeBoundReadOnlyProcess(runtimeBoundary, repoRoot, 'git', [
      'ls-files',
      '-v',
      '--full-name',
      '--',
      evidenceDirectory,
    ]);
  return captureReviewPlannerV8RepositorySnapshotFromAuthority({
    readGitStatus,
    listEvidencePaths,
    readEvidenceIndex,
    authority,
    repoRoot,
  });
}

async function runReadOnlyProcess(
  cwd: string,
  file: string,
  args: readonly string[],
  options: Readonly<{ signal?: AbortSignal; timeoutMs?: number }> = {},
) {
  const result = await execFileAsync(file, [...args], {
    cwd,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    timeout: Math.min(options.timeoutMs ?? 15_000, 15_000),
    signal: options.signal,
  });
  return result.stdout;
}

async function runRuntimeBoundReadOnlyProcess(
  runtimeBoundary: ReviewPlannerV11DefaultRuntimeBoundary | undefined,
  cwd: string,
  file: string,
  args: readonly string[],
  options: Readonly<{ signal?: AbortSignal; timeoutMs?: number }> = {},
) {
  if (runtimeBoundary?.readOnlyExec) {
    return runtimeBoundary.readOnlyExec({ cwd, file, args, options });
  }
  return runReadOnlyProcess(cwd, file, args, options);
}

async function fetchEnvelope(
  url: string,
  init: RequestInit = {},
  runtimeBoundary?: ReviewPlannerV11DefaultRuntimeBoundary,
) {
  runtimeBoundary?.apiProvider?.();
  runtimeBoundary?.fetch?.();
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('V8_PRODUCT_ACCEPTANCE_HTTP_FAILED');
  return response.json() as Promise<unknown>;
}

function unwrapEnvelope(value: unknown) {
  const record = asRecord(value);
  if (record.success !== true || !('data' in record)) throw new Error();
  return record.data;
}

function parseAuthEnvelope(value: unknown): RuntimeAccount {
  const data = asRecord(unwrapEnvelope(value));
  const user = asRecord(data.user);
  return Object.freeze({
    id: requireString(user.id),
    token: requireString(data.accessToken),
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RESPONSE_INVALID');
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) throw new Error();
  return value;
}

function requireBoolean(value: unknown) {
  if (typeof value !== 'boolean') throw new Error();
  return value;
}

function requirePositiveInteger(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error();
  }
  return value;
}

function requireNonNegativeInteger(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error();
  }
  return value;
}

export function createDefaultReviewPlannerV8ProductAcceptanceRecoveryComposition(
  repoRoot: string,
  options: ReviewPlannerV8DefaultCompositionOptions = {},
): ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts> {
  const root = resolve(repoRoot);
  const profile =
    options.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  const env = options.env ?? readRootEnvironment(root);
  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: { db: { url: requiredEnv(env, 'DATABASE_URL') } },
    });
  let probeAccount: (RuntimeAccount & { email: string }) | null = null;
  const ports: ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts = {
    async preflightRecovery({ environment, repoRoot: requestedRoot }) {
      try {
        if (
          process.platform !== 'win32' ||
          resolve(requestedRoot) !== root ||
          root !== resolve(__dirname, '../../../..')
        ) {
          throw new Error();
        }
        const publicState = await readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment,
          profile,
        });
        if (publicState.status !== 'incomplete') {
          return {
            status: 'blocked',
            code: 'recovery_not_authorized',
          };
        }
        return {
          status: 'ready',
          environment,
          repoRoot: root,
          presealed:
            existsSync(
              resolve(
                root,
                profile.publicLedgerPath(environment),
                'acceptance.json',
              ),
            ) &&
            !existsSync(
              resolve(
                root,
                profile.publicLedgerPath(environment),
                '.acceptance-success',
              ),
            ),
          manifest: {
            browserExecutablePath:
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            browserProfilePath: profile.browserProfilePath(environment),
          },
        };
      } catch {
        return { status: 'blocked', code: 'preflight_failed' };
      }
    },
    acquireOwner: (input) =>
      acquireReviewPlannerV8ProductAcceptanceOwner({ ...input, profile }),
    openRecoveryJournal: (input) =>
      openReviewPlannerV8ProductAcceptanceRecoveryJournal({
        ...input,
        profile,
      }),
    finalizePresealedSuccess: (input) =>
      finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
        ...input,
        profile,
      }),
    async terminateExactBrowser(input) {
      const executable = resolve(input.executablePath);
      const profilePath = resolve(root, input.profilePath);
      const allowedProfiles = new Set(
        (['branch', 'main'] as const).map((environment) =>
          resolve(root, profile.browserProfilePath(environment)),
        ),
      );
      if (
        executable !==
          resolve(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          ) ||
        !allowedProfiles.has(profilePath)
      ) {
        throw new Error();
      }
      await terminateDefaultReviewPlannerV8ExactBrowser({
        repoRoot: root,
        executablePath: executable,
        profilePath,
        profile,
      });
    },
    async restoreDefaultOff({ journal }) {
      const previous = await readServerContainerId(root);
      if (!previous) throw new Error();
      await recreateServer(
        {
          repoRoot: root,
          env,
        },
        buildReviewPlannerV8DefaultOffEnvironment(),
      );
      const current = await readServerContainerId(root);
      if (!current || current === previous) throw new Error();
      const inspected = await waitForDefaultServerReadiness(root, current);
      assertDefaultOffEnvironment(inspected.environment);
      const manifest = journal.snapshot().manifest;
      const password = randomBytes(24).toString('base64url');
      await prisma.user.deleteMany({
        where: { email: manifest.syntheticEmails.probe },
      });
      const account = parseAuthEnvelope(
        await fetchEnvelope('http://127.0.0.1:3001/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: manifest.syntheticEmails.probe,
            password,
            name: 'V8 recovery probe',
          }),
        }),
      );
      probeAccount = { ...account, email: manifest.syntheticEmails.probe };
      const probe = await fetchSuggestion(account.token, undefined, 'review');
      if (
        probe.target.attempted ||
        probe.target.provenance !== 'local_deterministic'
      ) {
        throw new Error();
      }
      return {
        schemaVersion: profile.schemas.defaultOff,
        component: 'recovery',
        container: {
          previousIdSha256: sha256ReviewPlannerV8CompositionValue(previous),
          newIdSha256: sha256ReviewPlannerV8CompositionValue(current),
        },
        inspected: {
          aiProviderMode: 'mock',
          liveCallsEnabled: false,
          reviewAgentModelEnabled: false,
          plannerAgentModelEnabled: false,
          acceptanceEnabled: false,
          acceptanceComponent: '',
          capabilitySha256: '',
          maxRequests: 0,
          deepseekCredentialPresent: false,
          openaiCredentialPresent: false,
        },
        binding: {
          port: 3001,
          healthContainerIdSha256:
            sha256ReviewPlannerV8CompositionValue(current),
        },
        deterministicProbe: {
          passed: true,
          provenance: 'local_deterministic',
        },
        providerInvocations: 0,
      };
    },
    async cleanupExact({ journal }) {
      const snapshot = journal.snapshot();
      const bindings = Object.values(snapshot.bindings);
      await prisma.$transaction(async (tx) => {
        if (probeAccount) {
          await tx.user.deleteMany({
            where: { id: probeAccount.id, email: probeAccount.email },
          });
        }
        for (const binding of bindings) {
          await tx.user.deleteMany({
            where: { id: binding.accountId, email: binding.email },
          });
        }
        for (const email of Object.values(snapshot.manifest.syntheticEmails)) {
          await tx.user.deleteMany({ where: { email } });
        }
      });
      if (existsSync(resolve(root, snapshot.manifest.browserProfilePath))) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_BROWSER_PROFILE_REMAINS');
      }
      const remaining = await prisma.user.count({
        where: {
          email: { in: Object.values(snapshot.manifest.syntheticEmails) },
        },
      });
      if (remaining !== 0) throw new Error();
      return {
        schemaVersion: profile.schemas.recoveryCleanup,
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProcesses: 0,
        browserProfiles: 0,
        probeAccounts: 0,
      };
    },
  };
  return Object.freeze({
    ports,
    dispose: createIdempotentPrismaDisposer(prisma),
  });
}

type ReviewPlannerV11DefaultRecoveryCompositionOptions = Readonly<{
  env?: Readonly<Record<string, string>>;
  prisma?: PrismaClient;
  boundary?: Readonly<{
    readLedger?: typeof readReviewPlannerV11ProductAcceptanceLedger;
    readAttemptBinding?: typeof readReviewPlannerV11ProductAcceptanceAttemptBinding;
    readExecutionManifest?: typeof readReviewPlannerV11ProductAcceptanceExecutionManifest;
    acquireOwner?: typeof acquireReviewPlannerV11ProductAcceptanceOwner;
  }>;
}>;

export function createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition(
  repoRoot: string,
  options: ReviewPlannerV11DefaultRecoveryCompositionOptions = {},
): ReviewPlannerV8DisposableComposition<ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts> {
  const root = resolve(repoRoot);
  const env = options.env ?? readRootEnvironment(root);
  const boundary = options.boundary;
  const readLedger =
    boundary?.readLedger ?? readReviewPlannerV11ProductAcceptanceLedger;
  const readAttemptBinding =
    boundary?.readAttemptBinding ??
    readReviewPlannerV11ProductAcceptanceAttemptBinding;
  const readExecutionManifest =
    boundary?.readExecutionManifest ??
    readReviewPlannerV11ProductAcceptanceExecutionManifest;
  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: { db: { url: requiredEnv(env, 'DATABASE_URL') } },
    });
  const readAuthoritative = async (input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  }) => {
    if (resolve(input.repoRoot) !== root) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    const binding = await readAttemptBinding({
      repoRoot: root,
      environment: input.environment,
    });
    const execution = await readExecutionManifest({
      repoRoot: root,
      environment: input.environment,
    });
    if (
      execution.environment !== input.environment ||
      execution.attemptSha256 !== binding.attemptSha256 ||
      execution.resources.browser.profilePath !==
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
          input.environment,
        )
    ) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    return Object.freeze({
      attemptSha256: binding.attemptSha256,
      executionManifest: execution,
    });
  };
  const ports: ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts = {
    async preflight(input) {
      try {
        if (process.platform !== 'win32' || resolve(input.repoRoot) !== root) {
          throw new Error();
        }
        const ledger = await readLedger({
          repoRoot: root,
          environment: input.environment,
        });
        if (
          ledger.status !== 'incomplete' &&
          ledger.status !== 'operation_failed'
        ) {
          throw new Error();
        }
        const authoritative = await readAuthoritative(input);
        return Object.freeze({
          status: 'ready' as const,
          environment: input.environment,
          repoRoot: root,
          ...authoritative,
        });
      } catch {
        return Object.freeze({ status: 'blocked' as const });
      }
    },
    acquireOwner: (input) =>
      boundary?.acquireOwner?.(input) ??
      acquireReviewPlannerV11ProductAcceptanceOwner(input),
    readAuthoritativeExecutionManifest: readAuthoritative,
    openRecoveryJournal: (input) =>
      openReviewPlannerV11ProductAcceptanceRecoveryJournal({
        repoRoot: input.repoRoot,
        environment: input.environment,
        owner: input.owner,
      }),
    async publishFailure(input) {
      try {
        input.journal.latestCheckpoint();
      } catch {
        input.journal.appendCheckpoint({
          schemaVersion:
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
          component: 'review',
          slot: 'api',
          checkpoint: 'review_api_activate',
          providerCallState: 'not_started',
        });
      }
      const ledger = await openReviewPlannerV11ProductAcceptanceRecoveryLedger({
        repoRoot: input.repoRoot,
        environment: input.environment,
        owner: input.owner,
      });
      try {
        input.journal.projectRecoveryOnly(ledger);
      } finally {
        ledger.close();
      }
    },
    restoreDefaultOff: (executionManifest) =>
      restoreDefaultV11ReviewPlannerOff(root, env, executionManifest),
    cleanupExact: (executionManifest) =>
      cleanupDefaultV11ReviewPlannerResources(root, prisma, executionManifest),
  };
  return Object.freeze({
    ports,
    dispose: createIdempotentPrismaDisposer(prisma),
  });
}

async function restoreDefaultV11ReviewPlannerOff(
  repoRoot: string,
  env: Readonly<Record<string, string>>,
  manifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
) {
  assertDefaultV11ExecutionManifest(manifest);
  const previous = await readServerContainerId(repoRoot);
  if (!previous) throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
  await recreateServer(
    { repoRoot, env },
    buildReviewPlannerV8DefaultOffEnvironment(),
  );
  const current = await readServerContainerId(repoRoot);
  if (!current || current === previous) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
  }
  const inspected = await waitForDefaultServerReadiness(repoRoot, current);
  assertDefaultOffEnvironment(inspected.environment);
}

async function cleanupDefaultV11ReviewPlannerResources(
  repoRoot: string,
  prisma: PrismaClient,
  manifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
) {
  assertDefaultV11ExecutionManifest(manifest);
  const profilePath = resolve(repoRoot, manifest.resources.browser.profilePath);
  await terminateDefaultReviewPlannerV8ExactBrowser({
    repoRoot,
    executablePath: manifest.resources.browser.executablePath,
    profilePath,
    allowedProfilePaths: [manifest.resources.browser.profilePath],
  });
  const emails = ['review', 'planner'].map(
    (component) =>
      `${manifest.resources.accountId[component as Component]}@example.invalid`,
  );
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const remaining = await prisma.user.count({
    where: { email: { in: emails } },
  });
  if (remaining !== 0 || existsSync(profilePath)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
  }
}

function assertDefaultV11ExecutionManifest(
  manifest: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
) {
  if (
    manifest.resources.browser.executablePath !==
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' ||
    manifest.resources.browser.profilePath !==
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        manifest.environment,
      )
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

function createIdempotentPrismaDisposer(prisma: PrismaClient) {
  let disposal: Promise<void> | undefined;
  return () => {
    disposal ??= prisma.$disconnect();
    return disposal;
  };
}
