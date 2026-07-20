import { createDefaultReviewPlannerProductAcceptanceHostRuntime } from './review-planner-product-acceptance-host-runtime';

describe('Review Planner lineage-neutral host runtime', () => {
  it('is default-off and reaches no host boundary without an injected capability', async () => {
    const runtime = createDefaultReviewPlannerProductAcceptanceHostRuntime();

    await expect(
      runtime.preflight({
        environment: 'branch',
        repoRoot: 'E:\\host-default',
      }),
    ).resolves.toEqual({ status: 'blocked' });
  });

  it('runs injected default-off then exact cleanup once after a ready failure', async () => {
    const restoreDefaultOff = jest.fn(() => Promise.resolve());
    const cleanupExact = jest.fn(() => Promise.resolve());
    const runtime = createDefaultReviewPlannerProductAcceptanceHostRuntime({
      preflight: () => Promise.resolve({ status: 'ready' as const }),
      restoreDefaultOff,
      cleanupExact,
    });

    await expect(
      runtime.recover({ environment: 'branch', repoRoot: 'E:\\host-ready' }),
    ).resolves.toEqual({ status: 'recovered' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledTimes(1);
  });
});
