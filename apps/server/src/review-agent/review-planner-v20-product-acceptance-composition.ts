import {
  createReviewPlannerV20ProductAcceptanceDiagnosticsPort,
  type ReviewPlannerV20ProductAcceptanceFailure,
} from './review-planner-v20-product-acceptance-diagnostics';
import {
  createReviewPlannerV20ProductAcceptanceRunnerLedgerAdapter,
  type ReviewPlannerV20ProductAcceptanceSafeEvent,
} from './review-planner-v20-product-acceptance-execution';
import {
  createReviewPlannerV20ProductAcceptanceExecutionManifest,
  reserveReviewPlannerV20ProductAcceptanceLedger,
  type ReviewPlannerV20ProductAcceptanceLedger,
  type ReviewPlannerV20ProductAcceptanceExecutionManifest,
} from './review-planner-v20-product-acceptance-ledger';
import {
  acquireReviewPlannerV20ProductAcceptanceOwner,
  prepareReviewPlannerV20ProductAcceptanceRecoveryJournal,
  type ReviewPlannerV20ProductAcceptanceOwner,
  type ReviewPlannerV20ProductAcceptanceRecoveryJournal,
} from './review-planner-v20-product-acceptance-recovery';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
} from './review-planner-v8-product-acceptance-runner';
import {
  createDefaultReviewPlannerV20ProductAcceptanceHost,
  type ReviewPlannerV20ProductAcceptanceHost,
} from './review-planner-v20-product-acceptance-host';
import { REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

export type ReviewPlannerV20ReadyPreflight = Readonly<{
  status: 'ready';
  environment: 'branch' | 'main';
  repoRoot: string;
  commitSha: string;
  pairedEvidenceSha256: string;
  databaseUrlSha256: string;
  accountIdSha256?: Readonly<{ review: string; planner: string }>;
  capabilities?: Readonly<{ review: string; planner: string }>;
  dependencies?: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}>;

export type ReviewPlannerV20ProductAcceptanceCompositionPorts = Readonly<{
  preflight(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
  }): Promise<Readonly<{ status: 'blocked' }> | ReviewPlannerV20ReadyPreflight>;
  revalidate(
    preflight: ReviewPlannerV20ReadyPreflight,
  ): Promise<Readonly<{ status: 'blocked' }> | ReviewPlannerV20ReadyPreflight>;
  acquireOwner(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    role: 'product';
  }): ReturnType<typeof acquireReviewPlannerV20ProductAcceptanceOwner>;
  reserveLedger(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    owner: ReviewPlannerV20ProductAcceptanceOwner;
  }): Promise<ReviewPlannerV20ProductAcceptanceLedger>;
  prepareJournal(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    owner: ReviewPlannerV20ProductAcceptanceOwner;
  }): Promise<ReviewPlannerV20ProductAcceptanceRecoveryJournal>;
  prepareExecution(input: {
    environment: 'branch' | 'main';
    repoRoot: string;
    preflight: ReviewPlannerV20ReadyPreflight;
    ledger: ReviewPlannerV20ProductAcceptanceLedger;
    journal: ReviewPlannerV20ProductAcceptanceRecoveryJournal;
    executionManifest: ReviewPlannerV20ProductAcceptanceExecutionManifest;
  }): Promise<
    Readonly<{
      accountIdSha256: Readonly<{ review: string; planner: string }>;
      capabilities: Readonly<{ review: string; planner: string }>;
      dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
    }>
  >;
  recordFailure(value: ReviewPlannerV20ProductAcceptanceFailure): void;
  record(event: ReviewPlannerV20ProductAcceptanceSafeEvent): void;
  runRunner(input: unknown): Promise<unknown>;
  dispose?(): Promise<void>;
}>;

export async function runReviewPlannerV20ProductAcceptanceComposition(input: {
  environment: 'branch' | 'main';
  repoRoot: string;
  ports: ReviewPlannerV20ProductAcceptanceCompositionPorts;
}): Promise<
  | Readonly<{ status: 'blocked'; stage: 'preflight' | 'owner' }>
  | Readonly<{ status: 'passed'; environment: 'branch' | 'main' }>
  | Readonly<{ status: 'failed'; stage: 'runner' }>
> {
  let owner: ReviewPlannerV20ProductAcceptanceOwner | undefined;
  let ledger: ReviewPlannerV20ProductAcceptanceLedger | undefined;
  let journal: ReviewPlannerV20ProductAcceptanceRecoveryJournal | undefined;
  let diagnostics:
    | ReturnType<typeof createReviewPlannerV20ProductAcceptanceDiagnosticsPort>
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
    const revalidated = await input.ports.revalidate(preflight);
    if (!isSameV20ReadyPreflight(preflight, revalidated)) {
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'owner' as const,
      });
    }
    const reservedLedger = await input.ports.reserveLedger({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
    });
    ledger = reservedLedger;
    const attemptSha256 = reservedLedger.attemptSha256();
    const manifest = {
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-manifest-v1' as const,
      environment: input.environment,
      attemptSha256,
    };
    const executionManifest =
      createReviewPlannerV20ProductAcceptanceExecutionManifest({
        environment: input.environment,
        attemptSha256,
        databaseUrlSha256: preflight.databaseUrlSha256,
      });
    await reservedLedger.writeExecutionManifest(executionManifest);
    reservedLedger.writeManifest(manifest);
    journal = await input.ports.prepareJournal({
      environment: input.environment,
      repoRoot: input.repoRoot,
      owner,
    });
    diagnostics = createReviewPlannerV20ProductAcceptanceDiagnosticsPort({
      environment: input.environment,
      journal,
      recordFailure: (failure) => reservedLedger.recordFailure(failure),
    });
    diagnostics.checkpoint('review_api_setup');
    const runtime = await input.ports.prepareExecution({
      environment: input.environment,
      repoRoot: input.repoRoot,
      preflight,
      ledger: reservedLedger,
      journal,
      executionManifest,
    });
    const runnerLedger =
      createReviewPlannerV20ProductAcceptanceRunnerLedgerAdapter({
        environment: input.environment,
        ledger: reservedLedger,
        manifest,
      });
    await input.ports.runRunner({
      environment: input.environment,
      commitSha: preflight.commitSha,
      pairedEvidenceSha256: preflight.pairedEvidenceSha256,
      accountIdSha256: runtime.accountIdSha256,
      capabilities: runtime.capabilities,
      webOrigin: 'http://127.0.0.1:3000',
      apiOrigin: 'http://127.0.0.1:3001',
      profile: REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE,
      ledger: runnerLedger,
      dependencies: runtime.dependencies,
      diagnostics,
    });
    return Object.freeze({
      status: 'passed' as const,
      environment: input.environment,
    });
  } catch {
    if (!diagnostics) {
      if (ledger) {
        journal?.close();
        journal = undefined;
        try {
          await ledger.rollbackUnstartedReservation();
          return Object.freeze({
            status: 'blocked' as const,
            stage: 'preflight' as const,
          });
        } catch {
          return Object.freeze({
            status: 'failed' as const,
            stage: 'runner' as const,
          });
        }
      }
      return Object.freeze({
        status: 'blocked' as const,
        stage: 'preflight' as const,
      });
    }
    try {
      diagnostics?.publishFailure();
    } catch {
      // The durable terminal remains fail-closed if its own publication fails.
    }
    return Object.freeze({
      status: 'failed' as const,
      stage: 'runner' as const,
    });
  } finally {
    journal?.close();
    ledger?.close();
    owner?.close();
    await input.ports.dispose?.();
  }
}

export type ReviewPlannerV20DefaultCompositionOptions = Readonly<{
  hostFactory?: (repoRoot: string) => ReviewPlannerV20ProductAcceptanceHost;
  boundary?: Readonly<{
    preflight(input: {
      environment: 'branch' | 'main';
      repoRoot: string;
    }): Promise<
      Readonly<{ status: 'blocked' }> | ReviewPlannerV20ReadyPreflight
    >;
  }>;
}>;

export function createDefaultReviewPlannerV20ProductAcceptanceComposition(
  repoRoot = '',
  options: ReviewPlannerV20DefaultCompositionOptions = {},
): Readonly<{
  ports: ReviewPlannerV20ProductAcceptanceCompositionPorts;
}> {
  const host =
    options.hostFactory?.(repoRoot) ??
    (!options.boundary && repoRoot
      ? createDefaultReviewPlannerV20ProductAcceptanceHost(repoRoot)
      : undefined);
  return Object.freeze({
    ports: Object.freeze({
      preflight: (input: {
        environment: 'branch' | 'main';
        repoRoot: string;
      }) =>
        options.boundary?.preflight(input) ??
        host?.preflight(input) ??
        Promise.resolve(Object.freeze({ status: 'blocked' as const })),
      revalidate: (preflight: ReviewPlannerV20ReadyPreflight) =>
        host?.revalidate?.(preflight) ??
        options.boundary?.preflight({
          environment: preflight.environment,
          repoRoot: preflight.repoRoot,
        }) ??
        Promise.resolve(Object.freeze({ status: 'blocked' as const })),
      acquireOwner: acquireReviewPlannerV20ProductAcceptanceOwner,
      reserveLedger: reserveReviewPlannerV20ProductAcceptanceLedger,
      prepareJournal: prepareReviewPlannerV20ProductAcceptanceRecoveryJournal,
      prepareExecution: (
        input: Parameters<
          ReviewPlannerV20ProductAcceptanceCompositionPorts['prepareExecution']
        >[0],
      ) => {
        if (host) return host.prepareExecution(input);
        const { accountIdSha256, capabilities, dependencies } = input.preflight;
        if (!accountIdSha256 || !capabilities || !dependencies) {
          return Promise.reject(
            new Error('V20_PRODUCT_ACCEPTANCE_RUNTIME_UNAVAILABLE'),
          );
        }
        return Promise.resolve(
          Object.freeze({ accountIdSha256, capabilities, dependencies }),
        );
      },
      recordFailure: () => undefined,
      record: () => undefined,
      runRunner: runReviewPlannerV8ProductAcceptance,
      dispose: () => host?.dispose() ?? Promise.resolve(),
    }),
  });
}

function isSameV20ReadyPreflight(
  expected: ReviewPlannerV20ReadyPreflight,
  value: Readonly<{ status: 'blocked' }> | ReviewPlannerV20ReadyPreflight,
): value is ReviewPlannerV20ReadyPreflight {
  return (
    value.status === 'ready' &&
    value.environment === expected.environment &&
    value.repoRoot === expected.repoRoot &&
    value.commitSha === expected.commitSha &&
    value.pairedEvidenceSha256 === expected.pairedEvidenceSha256 &&
    value.databaseUrlSha256 === expected.databaseUrlSha256
  );
}
