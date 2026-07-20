import {
  createReviewPlannerV12ProductAcceptanceDiagnosticsPort,
  type ReviewPlannerV12ProductAcceptanceFailure,
} from './review-planner-v12-product-acceptance-diagnostics';
import {
  createReviewPlannerV12ProductAcceptanceRunnerLedgerAdapter,
  type ReviewPlannerV12ProductAcceptanceSafeEvent,
} from './review-planner-v12-product-acceptance-execution';
import {
  reserveReviewPlannerV12ProductAcceptanceLedger,
  type ReviewPlannerV12ProductAcceptanceLedger,
} from './review-planner-v12-product-acceptance-ledger';
import {
  acquireReviewPlannerV12ProductAcceptanceOwner,
  prepareReviewPlannerV12ProductAcceptanceRecoveryJournal,
  type ReviewPlannerV12ProductAcceptanceOwner,
  type ReviewPlannerV12ProductAcceptanceRecoveryJournal,
} from './review-planner-v12-product-acceptance-recovery';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
} from './review-planner-v8-product-acceptance-runner';
import { REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

export type ReviewPlannerV12ReadyPreflight = Readonly<{
  status: 'ready';
  environment: 'branch' | 'main';
  repoRoot: string;
  commitSha: string;
  pairedEvidenceSha256: string;
  accountIdSha256: Readonly<{ review: string; planner: string }>;
  capabilities: Readonly<{ review: string; planner: string }>;
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}>;

export type ReviewPlannerV12ProductAcceptanceCompositionPorts = Readonly<{
  preflight(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' }> | ReviewPlannerV12ReadyPreflight>;
  acquireOwner(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    role: 'product';
  }): ReturnType<typeof acquireReviewPlannerV12ProductAcceptanceOwner>;
  reserveLedger(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    owner: ReviewPlannerV12ProductAcceptanceOwner;
  }): Promise<ReviewPlannerV12ProductAcceptanceLedger>;
  prepareJournal(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    owner: ReviewPlannerV12ProductAcceptanceOwner;
  }): Promise<ReviewPlannerV12ProductAcceptanceRecoveryJournal>;
  recordFailure(value: ReviewPlannerV12ProductAcceptanceFailure): void;
  record(event: ReviewPlannerV12ProductAcceptanceSafeEvent): void;
  runRunner(input: unknown): Promise<unknown>;
}>;

export async function runReviewPlannerV12ProductAcceptanceComposition(input: {
  environment: 'branch' | 'main';
  repoRoot: string;
  ports: ReviewPlannerV12ProductAcceptanceCompositionPorts;
}): Promise<
  | Readonly<{ status: 'blocked'; stage: 'preflight' | 'owner' }>
  | Readonly<{ status: 'passed'; environment: 'branch' | 'main' }>
  | Readonly<{ status: 'failed'; stage: 'runner' }>
> {
  let owner: ReviewPlannerV12ProductAcceptanceOwner | undefined;
  let ledger: ReviewPlannerV12ProductAcceptanceLedger | undefined;
  let journal: ReviewPlannerV12ProductAcceptanceRecoveryJournal | undefined;
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
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'preflight' as const,
      });
    }
    const ownership = await input.ports.acquireOwner({
      environment: input.environment,
      repoRoot: input.repoRoot,
      role: 'product',
    });
    if (ownership.status !== 'acquired') {
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'owner' as const,
      });
    }
    owner = ownership.owner;
    owner.assertHeld();
    const reservedLedger = await input.ports.reserveLedger({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
    });
    ledger = reservedLedger;
    const attemptSha256 = reservedLedger.attemptSha256();
    const manifest = {
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-manifest-v1' as const,
      environment: input.environment,
      attemptSha256,
    };
    await reservedLedger.writeExecutionManifest({
      schemaVersion: 'phase-6.9.5-v12-product-acceptance-execution-manifest-v1',
      environment: input.environment,
      attemptSha256,
    });
    reservedLedger.writeManifest(manifest);
    journal = await input.ports.prepareJournal({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
    });
    const diagnostics = createReviewPlannerV12ProductAcceptanceDiagnosticsPort({
      environment: input.environment,
      journal,
      recordFailure: (failure) => reservedLedger.recordFailure(failure),
    });
    const runnerLedger =
      createReviewPlannerV12ProductAcceptanceRunnerLedgerAdapter({
        environment: input.environment,
        ledger: reservedLedger,
        manifest,
      });
    await input.ports.runRunner({
      environment: input.environment,
      commitSha: preflight.commitSha,
      pairedEvidenceSha256: preflight.pairedEvidenceSha256,
      accountIdSha256: preflight.accountIdSha256,
      capabilities: preflight.capabilities,
      webOrigin: 'http://127.0.0.1:3000',
      apiOrigin: 'http://127.0.0.1:3001',
      profile: REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
      ledger: runnerLedger,
      dependencies: preflight.dependencies,
      diagnostics,
    });
    return Object.freeze({
      status: 'passed' as const,
      environment: input.environment,
    });
  } catch {
    return Object.freeze({
      status: 'failed' as const,
      stage: 'runner' as const,
    });
  } finally {
    journal?.close();
    ledger?.close();
    owner?.close();
  }
}

export type ReviewPlannerV12DefaultCompositionOptions = Readonly<{
  boundary?: Readonly<{
    preflight(input: {
      environment: 'branch' | 'main';
      repoRoot: string;
    }): Promise<
      Readonly<{ status: 'blocked' }> | ReviewPlannerV12ReadyPreflight
    >;
  }>;
}>;

export function createDefaultReviewPlannerV12ProductAcceptanceComposition(
  _repoRoot = '',
  options: ReviewPlannerV12DefaultCompositionOptions = {},
): Readonly<{
  ports: ReviewPlannerV12ProductAcceptanceCompositionPorts;
}> {
  void _repoRoot;
  return Object.freeze({
    ports: Object.freeze({
      preflight: (input: {
        environment: 'branch' | 'main';
        repoRoot: string;
      }) =>
        options.boundary?.preflight(input) ??
        Promise.resolve(Object.freeze({ status: 'blocked' as const })),
      acquireOwner: acquireReviewPlannerV12ProductAcceptanceOwner,
      reserveLedger: reserveReviewPlannerV12ProductAcceptanceLedger,
      prepareJournal: prepareReviewPlannerV12ProductAcceptanceRecoveryJournal,
      recordFailure: () => undefined,
      record: () => undefined,
      runRunner: runReviewPlannerV8ProductAcceptance,
    }),
  });
}
