/* eslint-disable @typescript-eslint/require-await -- async port fixture signatures are part of the CLI boundary */
import {
  parseReviewPlannerV12ProductAcceptanceArguments,
  runReviewPlannerV12ProductAcceptanceProductCli,
  serializeReviewPlannerV12ProductAcceptanceCliFailure,
} from './review-planner-v12-product-acceptance-cli';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

describe('Review Planner V12 product-acceptance CLI', () => {
  const argv = [
    REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
    '--environment=branch',
  ] as const;

  it('rejects an immutable V11 confirmation before V12 preflight or any external boundary', async () => {
    const ports = createBlockedPorts();

    await expect(
      runReviewPlannerV12ProductAcceptanceProductCli({
        argv: [
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
          '--environment=branch',
        ],
        repoRoot: 'E:\\v12-cli',
        ports,
      }),
    ).rejects.toThrow('V12_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');

    expect(ports.preflight).not.toHaveBeenCalled();
    expect(ports.acquireOwner).not.toHaveBeenCalled();
    expect(ports.docker).not.toHaveBeenCalled();
    expect(ports.browser).not.toHaveBeenCalled();
    expect(ports.api).not.toHaveBeenCalled();
    expect(ports.provider).not.toHaveBeenCalled();
  });

  it('keeps a valid V12 invocation default-off at preflight before owner or runtime work', async () => {
    const ports = createBlockedPorts();

    await expect(
      runReviewPlannerV12ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v12-cli',
        ports,
      }),
    ).resolves.toEqual({
      stage: 'preflight',
      status: 'blocked',
      code: 'default_off',
    });

    expect(ports.preflight).toHaveBeenCalledWith({
      environment: 'branch',
      repoRoot: 'E:\\v12-cli',
    });
    expect(ports.acquireOwner).not.toHaveBeenCalled();
    expect(ports.docker).not.toHaveBeenCalled();
    expect(ports.browser).not.toHaveBeenCalled();
    expect(ports.api).not.toHaveBeenCalled();
    expect(ports.provider).not.toHaveBeenCalled();
  });

  it('keeps V11 confirmations out of the V12 parser and serializes a nonsecret rejection', () => {
    expect(() =>
      parseReviewPlannerV12ProductAcceptanceArguments(
        [
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoveryConfirmation,
          '--environment=branch',
        ],
        'recovery',
      ),
    ).toThrow('V12_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');

    const value = serializeReviewPlannerV12ProductAcceptanceCliFailure(
      'product',
      new Error('password=secret https://provider.invalid prompt=private'),
    );
    expect(value).toBe(
      JSON.stringify({
        stage: 'preflight',
        status: 'blocked',
        code: 'default_off',
      }),
    );
    expect(value).not.toMatch(/password|secret|https?:|prompt/i);
  });
});

function createBlockedPorts() {
  return {
    preflight: jest.fn(async () => ({ status: 'blocked' as const })),
    acquireOwner: jest.fn(async () => undefined),
    docker: jest.fn(async () => undefined),
    browser: jest.fn(async () => undefined),
    api: jest.fn(async () => undefined),
    provider: jest.fn(async () => undefined),
  };
}
