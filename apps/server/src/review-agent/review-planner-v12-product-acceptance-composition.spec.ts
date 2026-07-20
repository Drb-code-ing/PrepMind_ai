import { createDefaultReviewPlannerV12ProductAcceptanceComposition } from './review-planner-v12-product-acceptance-composition';

describe('Review Planner V12 default product composition', () => {
  it('keeps the unconfigured host boundary default-off before any runtime capability', async () => {
    const composition =
      createDefaultReviewPlannerV12ProductAcceptanceComposition();

    await expect(
      composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v12-default-off',
      }),
    ).resolves.toEqual({ status: 'blocked' });
  });

  it('accepts an injected V12-only ready preflight without touching a V11 boundary', async () => {
    const preflight = jest.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v12-ready',
        commitSha: 'a'.repeat(40),
        pairedEvidenceSha256: 'b'.repeat(64),
        accountIdSha256: {
          review: 'c'.repeat(64),
          planner: 'd'.repeat(64),
        },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
        dependencies: {},
      }),
    );
    const create =
      createDefaultReviewPlannerV12ProductAcceptanceComposition as unknown as (
        root: string,
        options: { boundary: { preflight: typeof preflight } },
      ) => ReturnType<
        typeof createDefaultReviewPlannerV12ProductAcceptanceComposition
      >;
    const composition = create('E:\\v12-ready', {
      boundary: { preflight },
    });

    await expect(
      composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v12-ready',
      }),
    ).resolves.toMatchObject({ status: 'ready', environment: 'branch' });
    expect(preflight).toHaveBeenCalledTimes(1);
  });
});
