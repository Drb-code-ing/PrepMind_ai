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
  readReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedger,
  type ReviewPlannerV8ProductAcceptanceLedger,
} from './review-planner-v8-product-acceptance-ledger';
import {
  acquireReviewPlannerV8ProductAcceptanceOwner,
  openReviewPlannerV8ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV8ProductAcceptanceRecoveryJournal,
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
  type ReviewPlannerV8ProductAcceptanceEnvironment,
  type ReviewPlannerV8ProductAcceptanceOwner,
  type ReviewPlannerV8ProductAcceptanceRecoveryJournal,
} from './review-planner-v8-product-acceptance-recovery';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptancePersistedTrace,
  type ReviewPlannerV8ProductAcceptanceRequestResult,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
  type ReviewPlannerV8ProductAcceptanceRunResult,
} from './review-planner-v8-product-acceptance-runner';

const execFileAsync = promisify(execFile);

export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION =
  '--confirm-v8-review-planner-product-acceptance' as const;
export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION =
  '--confirm-v8-review-planner-product-acceptance-recovery-only' as const;

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
  schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1';
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
  const confirmation =
    kind === 'product'
      ? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION
      : REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION;
  if (
    argv.length !== 2 ||
    argv[0] !== confirmation ||
    (argv[1] !== '--environment=branch' && argv[1] !== '--environment=main')
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
  }
  return Object.freeze({
    environment: argv[1] === '--environment=branch' ? 'branch' : 'main',
  });
}

export async function runReviewPlannerV8ProductAcceptanceProductCli(input: {
  argv: readonly string[];
  repoRoot: string;
  ports: ReviewPlannerV8ProductAcceptanceCompositionPorts;
}): Promise<ReviewPlannerV8ProductAcceptanceCliSummary> {
  const { environment } = parseReviewPlannerV8ProductAcceptanceArguments(
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
      manifest: buildRecoveryManifest(preflight, resources),
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
    ledger.writeManifest(buildPublicManifest(preflight, fixtureReceipt));
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
  const { environment } = parseReviewPlannerV8ProductAcceptanceArguments(
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
      const restore =
        reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.parse(
          await input.ports.restoreDefaultOff({ environment, journal }),
        );
      if (restore.component !== 'recovery') throw new Error();
      journal.appendStage(
        'restore.verified.json',
        `${JSON.stringify(restore)}\n`,
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
      assertRecoveryCleanupReceipt(cleanup);
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
  if (!input.composition) {
    parseReviewPlannerV8ProductAcceptanceArguments(input.argv, 'product');
  }
  const composition =
    input.composition ??
    createDefaultReviewPlannerV8ProductAcceptanceComposition(input.repoRoot);
  try {
    if (input.composition) {
      parseReviewPlannerV8ProductAcceptanceArguments(input.argv, 'product');
    }
    return await runReviewPlannerV8ProductAcceptanceProductCli({
      argv: input.argv,
      repoRoot: input.repoRoot,
      ports: composition.ports,
    });
  } finally {
    await composition.dispose();
  }
}

export async function executeReviewPlannerV8ProductAcceptanceRecoveryCli(input: {
  argv: readonly string[];
  repoRoot: string;
  composition?: ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts>;
}) {
  if (!input.composition) {
    parseReviewPlannerV8ProductAcceptanceArguments(input.argv, 'recovery');
  }
  const composition =
    input.composition ??
    createDefaultReviewPlannerV8ProductAcceptanceRecoveryComposition(
      input.repoRoot,
    );
  try {
    if (input.composition) {
      parseReviewPlannerV8ProductAcceptanceArguments(input.argv, 'recovery');
    }
    return await runReviewPlannerV8ProductAcceptanceRecoveryCli({
      argv: input.argv,
      repoRoot: input.repoRoot,
      ports: composition.ports,
    });
  } finally {
    await composition.dispose();
  }
}

export function serializeReviewPlannerV8ProductAcceptanceCliSummary(
  summary: ReviewPlannerV8ProductAcceptanceCliSummary,
): string {
  return JSON.stringify(summary);
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
) {
  return Object.freeze({
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-v1',
    environment: preflight.environment,
    publicLedgerPath: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/${preflight.environment}`,
    syntheticEmails: resources.syntheticEmails,
    fixtureIds: resources.fixtureIds,
    browserExecutablePath: preflight.chromeExecutablePath,
    browserProfilePath: resources.browserProfilePath,
  });
}

function buildPublicManifest(
  preflight: Extract<ProductPreflight, { status: 'ready' }>,
  fixture: FixtureReceipt,
) {
  return Object.freeze({
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-manifest-v1',
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

function assertRecoveryCleanupReceipt(
  value: RecoveryCleanupReceipt,
): asserts value is RecoveryCleanupReceipt {
  if (
    !value ||
    Object.keys(value).sort().join(',') !==
      'browserProcesses,browserProfiles,fixtures,probeAccounts,schemaVersion,syntheticAccounts,traces' ||
    value.schemaVersion !==
      'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1' ||
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
  resources: GeneratedResources | null;
  accounts: Partial<Record<Component, RuntimeAccount & { email: string }>>;
  fixtureIds: readonly string[];
  traceIds: Set<string>;
  traceBaselines: Map<string, Set<string>>;
  liveContainerId: Partial<Record<Component, string>>;
  factsSnapshots: ReviewPlannerFactsSnapshotState;
};

export function createDefaultReviewPlannerV8ProductAcceptanceComposition(
  repoRoot: string,
  options: ReviewPlannerV8DefaultCompositionOptions = {},
): ReviewPlannerV8DisposableComposition<ReviewPlannerV8ProductAcceptanceCompositionPorts> {
  const root = resolve(repoRoot);
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
      runDefaultProductPreflight(input, pairedEvidenceAuthority),
    acquireOwner: (input) =>
      acquireReviewPlannerV8ProductAcceptanceOwner(input),
    revalidatePreflight: ({ preflight }) =>
      revalidateDefaultProductPreflight(preflight, pairedEvidenceAuthority),
    reserveLedger: (input) =>
      reserveReviewPlannerV8ProductAcceptanceLedger(input),
    generateResources(preflight) {
      const resources = generateDefaultResources(preflight);
      state.resources = resources;
      state.fixtureIds = resources.fixtureIds;
      return resources;
    },
    prepareRecoveryJournal: (input) =>
      prepareReviewPlannerV8ProductAcceptanceRecoveryJournal(input),
    async registerAccount(input) {
      const body = await fetchEnvelope('http://127.0.0.1:3001/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          name: `V8 ${input.component}`,
        }),
      });
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
      return createDefaultRunnerDependencies(state, input);
    },
    runAcceptance: (input) => runReviewPlannerV8ProductAcceptance(input),
  };
  return Object.freeze({
    ports,
    dispose: createIdempotentPrismaDisposer(prisma),
  });
}

async function runDefaultProductPreflight(
  input: {
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    repoRoot: string;
  },
  pairedEvidenceAuthority: PairedEvidenceAuthority,
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
): GeneratedResources {
  const prefix = `phase695-v8-accept-${preflight.utcStamp}`;
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
    browserProfilePath: `.tmp/phase-6-9-5-v8-product-acceptance/${preflight.environment}/profile-v8`,
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
      );
      assertExpectedServerEnvironment(
        inspected.environment,
        activationEnvironment,
      );
      state.liveContainerId[request.component] = current;
    },
    readFactsDigest: ({ component, phase }) =>
      readFactsDigest(state, component, phase),
    async dispatchApi({ component, acceptanceCapability }) {
      state.traceBaselines.set(
        `${component}:api`,
        await readLiveTraceIds(state.accounts[component]?.token),
      );
      return fetchSuggestion(
        state.accounts[component]?.token,
        acceptanceCapability,
        component,
      );
    },
    // eslint-disable-next-line @typescript-eslint/unbound-method -- port callback is defined without receiver state
    async runBrowser({ component, webOrigin, onRoute }) {
      state.traceBaselines.set(
        `${component}:browser`,
        await readLiveTraceIds(state.accounts[component]?.token),
      );
      const account = state.accounts[component];
      const resources = state.resources;
      if (!account || !resources) throw new Error();
      const profilePath = resolve(state.repoRoot, resources.browserProfilePath);
      const callbacks = new Set<Promise<void>>();
      let responseResult:
        | ReviewPlannerV8ProductAcceptanceRequestResult
        | undefined;
      let contextClosed = false;
      let continuedRequests = 0;
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
        const list = await fetchTraceList(token);
        const candidates = list.filter((id) => !baseline.has(id));
        if (candidates.length === 1) {
          const trace = await fetchTraceDetail(token, candidates[0]);
          state.traceIds.add(trace.traceId);
          return [trace];
        }
        if (candidates.length > 1) throw new Error();
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
      }
      throw new Error();
    },
    restoreDefaultOff: (component) => restoreDefaultOff(state, component),
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
      await cleanupDefaultState(state);
      return {
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-cleanup-v1',
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
) {
  const previous = state.liveContainerId[component];
  if (!previous) throw new Error();
  await recreateServer(state, buildReviewPlannerV8DefaultOffEnvironment());
  const current = await readServerContainerId(state.repoRoot);
  if (!current || current === previous) throw new Error();
  const inspected = await waitForDefaultServerReadiness(
    state.repoRoot,
    current,
  );
  assertDefaultOffEnvironment(inspected.environment);
  const account = state.accounts[component];
  if (!account) throw new Error();
  const probe = await fetchSuggestion(account.token, undefined, component);
  if (
    probe.target.attempted ||
    probe.target.provenance !== 'local_deterministic'
  ) {
    throw new Error();
  }
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2',
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

async function recreateServer(
  state: Pick<DefaultRuntimeState, 'repoRoot' | 'env'>,
  overrides: Readonly<Record<string, string>>,
) {
  const command = buildReviewPlannerV8ServerRecreateCommand();
  await execFileAsync(command.file, [...command.args], {
    cwd: state.repoRoot,
    windowsHide: true,
    env: { ...process.env, ...state.env, ...overrides },
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
}) {
  const repoRoot = resolve(input.repoRoot);
  const profilePath = resolve(input.profilePath);
  const allowedProfiles = new Set(
    (['branch', 'main'] as const).map((environment) =>
      normalizeWindowsPath(
        resolve(
          repoRoot,
          '.tmp',
          'phase-6-9-5-v8-product-acceptance',
          environment,
          'profile-v8',
        ),
      ),
    ),
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

async function readServerContainerId(repoRoot: string, signal?: AbortSignal) {
  return (
    await runReadOnlyProcess(
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
) {
  const output = await runReadOnlyProcess(
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

async function assertCurrentServerDefaultOff(repoRoot: string) {
  const id = await readServerContainerId(repoRoot);
  if (!id) throw new Error();
  const inspected = await waitForDefaultServerReadiness(repoRoot, id);
  assertDefaultOffEnvironment(inspected.environment);
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
) {
  return waitForReviewPlannerV8ServerReadiness({
    expectedContainerId,
    readCurrentContainerId: (signal) => readServerContainerId(repoRoot, signal),
    inspectContainer: (signal) =>
      inspectServerContainer(expectedContainerId, signal),
    fetchHealth: async (signal) => {
      const response = await fetch('http://127.0.0.1:3001/health', { signal });
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
): Promise<ReviewPlannerV8ProductAcceptanceRequestResult> {
  if (!token) throw new Error();
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  if (acceptanceCapability) {
    headers['x-prepmind-review-planner-acceptance'] = acceptanceCapability;
  }
  const body = await fetchEnvelope(
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-480',
    { headers },
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

async function readLiveTraceIds(token: string | undefined) {
  if (!token) throw new Error();
  return new Set(await fetchTraceList(token));
}

async function fetchTraceList(token: string) {
  const envelope = await fetchEnvelope(
    'http://127.0.0.1:3001/agent-traces?limit=50&route=review_analysis&mode=live',
    { headers: { authorization: `Bearer ${token}` } },
  );
  const runs = asRecord(unwrapEnvelope(envelope)).runs;
  if (!Array.isArray(runs)) throw new Error();
  return runs.map((run) => requireString(asRecord(run).id));
}

async function fetchTraceDetail(
  token: string,
  traceId: string,
): Promise<ReviewPlannerV8ProductAcceptancePersistedTrace> {
  const envelope = await fetchEnvelope(
    `http://127.0.0.1:3001/agent-traces/${encodeURIComponent(traceId)}`,
    { headers: { authorization: `Bearer ${token}` } },
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

async function cleanupDefaultState(state: DefaultRuntimeState) {
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
    await terminateDefaultReviewPlannerV8ExactBrowser({
      repoRoot: state.repoRoot,
      executablePath:
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      profilePath: resolve(state.repoRoot, profile),
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
) {
  const evidenceDirectory =
    REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
  const readGitStatus = () =>
    runReadOnlyProcess(repoRoot, 'git', [
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
    runReadOnlyProcess(repoRoot, 'git', [
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

async function fetchEnvelope(url: string, init: RequestInit = {}) {
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
                'docs',
                'acceptance',
                'evidence',
                'phase-6-9-5-v8-product-acceptance',
                environment,
                'acceptance.json',
              ),
            ) &&
            !existsSync(
              resolve(
                root,
                'docs',
                'acceptance',
                'evidence',
                'phase-6-9-5-v8-product-acceptance',
                environment,
                '.acceptance-success',
              ),
            ),
          manifest: {
            browserExecutablePath:
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            browserProfilePath: `.tmp/phase-6-9-5-v8-product-acceptance/${environment}/profile-v8`,
          },
        };
      } catch {
        return { status: 'blocked', code: 'preflight_failed' };
      }
    },
    acquireOwner: (input) =>
      acquireReviewPlannerV8ProductAcceptanceOwner(input),
    openRecoveryJournal: (input) =>
      openReviewPlannerV8ProductAcceptanceRecoveryJournal(input),
    finalizePresealedSuccess: (input) =>
      finalizeReviewPlannerV8ProductAcceptancePresealedSuccess(input),
    async terminateExactBrowser(input) {
      const executable = resolve(input.executablePath);
      const profile = resolve(root, input.profilePath);
      if (
        executable !==
          resolve(
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          ) ||
        profile !== resolve(root, input.profilePath) ||
        !profile.startsWith(
          `${resolve(root, '.tmp', 'phase-6-9-5-v8-product-acceptance')}\\`,
        )
      ) {
        throw new Error();
      }
      await terminateDefaultReviewPlannerV8ExactBrowser({
        repoRoot: root,
        executablePath: executable,
        profilePath: profile,
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
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2',
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
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1',
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

function createIdempotentPrismaDisposer(prisma: PrismaClient) {
  let disposal: Promise<void> | undefined;
  return () => {
    disposal ??= prisma.$disconnect();
    return disposal;
  };
}
