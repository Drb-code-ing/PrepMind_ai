import {
  createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition,
  runReviewPlannerV16ProductAcceptanceRecoveryComposition,
} from './review-planner-v16-product-acceptance-recovery-composition';
import { createDefaultReviewPlannerProductAcceptanceHostRuntime } from './review-planner-product-acceptance-host-runtime';

describe('Review Planner V16 recovery composition', () => {
  it('blocks a missing or damaged V16 terminal before host recovery', async () => {
    const restoreDefaultOff = jest.fn();
    const cleanupExact = jest.fn();
    const composition =
      createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition({
        readLedger: () => Promise.resolve({ status: 'evidence_io' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV16ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-damaged',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });
    expect(restoreDefaultOff).not.toHaveBeenCalled();
    expect(cleanupExact).not.toHaveBeenCalled();
  });

  it('recovers a V16-only failure through default-off and cleanup exactly once', async () => {
    const restoreDefaultOff = jest.fn(() => Promise.resolve());
    const cleanupExact = jest.fn(() => Promise.resolve());
    const composition =
      createDefaultReviewPlannerV16ProductAcceptanceRecoveryComposition({
        readLedger: () =>
          Promise.resolve({ status: 'operation_failed' as const }),
        host: createDefaultReviewPlannerProductAcceptanceHostRuntime({
          preflight: () => Promise.resolve({ status: 'ready' as const }),
          restoreDefaultOff,
          cleanupExact,
        }),
      });

    await expect(
      runReviewPlannerV16ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-failure',
        ports: composition.ports,
      }),
    ).resolves.toEqual({ status: 'recovered', environment: 'branch' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledTimes(1);
  });
});
