import { readReviewPlannerV16ProductAcceptanceLedger } from './review-planner-v16-product-acceptance-ledger';
import {
  createDefaultReviewPlannerProductAcceptanceHostRuntime,
  type ReviewPlannerProductAcceptanceHostRuntime,
} from './review-planner-product-acceptance-host-runtime';
import { createDefaultReviewPlannerV16ProductAcceptanceRecoveryHost } from './review-planner-v16-product-acceptance-host';

type Environment = 'branch' | 'main';

export type ReviewPlannerV16ProductAcceptanceRecoveryCompositionPorts =
  Readonly<{
    preflight(input: {
      environment: Environment;
      repoRoot: string;
    }): Promise<Readonly<{ status: 'blocked' | 'ready' }>>;
    recover(input: {
      environment: Environment;
      repoRoot: string;
    }): Promise<Readonly<{ status: 'blocked' | 'recovered' }>>;
  }>;

export async function runReviewPlannerV16ProductAcceptanceRecoveryComposition(input: {
  environment: Environment;
  repoRoot: string;
  ports: ReviewPlannerV16ProductAcceptanceRecoveryCompositionPorts;
}): Promise<
  | Readonly<{ status: 'blocked'; stage: 'preflight' }>
  | Readonly<{ status: 'recovered'; environment: Environment }>
> {
  const preflight = await input.ports.preflight({
    environment: input.environment,
    repoRoot: input.repoRoot,
  });
  if (preflight.status !== 'ready') {
    return Object.freeze({
      status: 'blocked' as const,
      stage: 'preflight' as const,
    });
  }
  const recovery = await input.ports.recover({
    environment: input.environment,
    repoRoot: input.repoRoot,
  });
  if (recovery.status !== 'recovered') {
    return Object.freeze({
      status: 'blocked' as const,
      stage: 'preflight' as const,
    });
  }
  return Object.freeze({
    status: 'recovered' as const,
    environment: input.environment,
  });
}

type ReviewPlannerV16RecoveryCompositionOptions = Partial<{
  readLedger: typeof readReviewPlannerV16ProductAcceptanceLedger;
  host: ReviewPlannerProductAcceptanceHostRuntime;
}>;

export function createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition(
  repoRootOrOptions: string | ReviewPlannerV16RecoveryCompositionOptions = '',
  options: ReviewPlannerV16RecoveryCompositionOptions = {},
): Readonly<{
  ports: ReviewPlannerV16ProductAcceptanceRecoveryCompositionPorts;
}> {
  const repoRoot =
    typeof repoRootOrOptions === 'string' ? repoRootOrOptions : '';
  const resolvedOptions =
    typeof repoRootOrOptions === 'string' ? options : repoRootOrOptions;
  const readLedger =
    resolvedOptions.readLedger ?? readReviewPlannerV16ProductAcceptanceLedger;
  const host =
    resolvedOptions.host ??
    createDefaultReviewPlannerProductAcceptanceHostRuntime();
  const v16Host =
    !resolvedOptions.host && repoRoot
      ? createDefaultReviewPlannerV16ProductAcceptanceRecoveryHost(repoRoot)
      : undefined;
  return Object.freeze({
    ports: Object.freeze({
      async preflight(input: { environment: Environment; repoRoot: string }) {
        if (v16Host) return v16Host.preflight(input);
        try {
          const [ledger, hostPreflight] = await Promise.all([
            readLedger(input),
            host.preflight(input),
          ]);
          return Object.freeze({
            status:
              ledger.status === 'operation_failed' &&
              hostPreflight.status === 'ready'
                ? ('ready' as const)
                : ('blocked' as const),
          });
        } catch {
          return Object.freeze({ status: 'blocked' as const });
        }
      },
      recover: (input: { environment: Environment; repoRoot: string }) =>
        v16Host?.recover(input) ?? host.recover(input),
    }),
  });
}
