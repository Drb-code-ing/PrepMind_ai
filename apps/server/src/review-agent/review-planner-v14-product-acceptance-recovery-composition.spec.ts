import {
  createDefaultReviewPlannerV14ProductAcceptanceRecoveryComposition,
  runReviewPlannerV14ProductAcceptanceRecoveryComposition,
} from './review-planner-v14-product-acceptance-recovery-composition';
import { createDefaultReviewPlannerProductAcceptanceHostRuntime } from './review-planner-product-acceptance-host-runtime';

describe('Review Planner V14 recovery composition', () => {
  it('blocks a missing or damaged V14 terminal before host recovery', async () => {
    const restoreDefaultOff = jest.fn();
    const cleanupExact = jest.fn();
    const composition =
      createDefaultReviewPlannerV14ProductAcceptanceRecoveryComposition({
        readLedger: () => Promise.resolve({ status: 'evidence_io' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV14ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v14-damaged',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });
    expect(restoreDefaultOff).not.toHaveBeenCalled();
    expect(cleanupExact).not.toHaveBeenCalled();
  });

  it('recovers a V14-only failure through default-off and cleanup exactly once', async () => {
    const restoreDefaultOff = jest.fn(() => Promise.resolve());
    const cleanupExact = jest.fn(() => Promise.resolve());
    const composition =
      createDefaultReviewPlannerV14ProductAcceptanceRecoveryComposition({
        readLedger: () =>
          Promise.resolve({ status: 'operation_failed' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV14ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v14-failure',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'recovered', environment: 'branch' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledTimes(1);
  });
});
