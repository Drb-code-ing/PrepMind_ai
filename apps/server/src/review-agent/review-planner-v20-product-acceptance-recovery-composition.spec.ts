import {
  createDefaultReviewPlannerV20ProductAcceptanceRecoveryComposition,
  runReviewPlannerV20ProductAcceptanceRecoveryComposition,
} from './review-planner-v20-product-acceptance-recovery-composition';
import { createDefaultReviewPlannerProductAcceptanceHostRuntime } from './review-planner-product-acceptance-host-runtime';

describe('Review Planner V20 recovery composition', () => {
  it('blocks a missing or damaged V20 terminal before host recovery', async () => {
    const restoreDefaultOff = jest.fn();
    const cleanupExact = jest.fn();
    const composition =
      createDefaultReviewPlannerV20ProductAcceptanceRecoveryComposition({
        readLedger: () => Promise.resolve({ status: 'evidence_io' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV20ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v20-damaged',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });
    expect(restoreDefaultOff).not.toHaveBeenCalled();
    expect(cleanupExact).not.toHaveBeenCalled();
  });

  it('recovers a V20-only failure through default-off and cleanup exactly once', async () => {
    const restoreDefaultOff = jest.fn(() => Promise.resolve());
    const cleanupExact = jest.fn(() => Promise.resolve());
    const composition =
      createDefaultReviewPlannerV20ProductAcceptanceRecoveryComposition({
        readLedger: () =>
          Promise.resolve({ status: 'operation_failed' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV20ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v20-failure',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'recovered', environment: 'branch' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledTimes(1);
  });
});
