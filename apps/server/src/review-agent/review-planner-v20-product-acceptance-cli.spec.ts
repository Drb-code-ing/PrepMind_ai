/* eslint-disable @typescript-eslint/require-await -- async port fixture signatures are part of the CLI boundary */
import {
  parseReviewPlannerV20ProductAcceptanceArguments,
  executeReviewPlannerV20ProductAcceptanceProductCli,
  runReviewPlannerV20ProductAcceptanceProductCli,
  serializeReviewPlannerV20ProductAcceptanceCliFailure,
} from './review-planner-v20-product-acceptance-cli';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

describe('Review Planner V20 product-acceptance CLI', () => {
  const argv = [
    REVIEW_PLANNER_V20_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
    '--environment=branch',
  ] as const;

  it('rejects an immutable V11 confirmation before V20 preflight or any external boundary', async () => {
    const ports = createBlockedPorts();

    await expect(
      runReviewPlannerV20ProductAcceptanceProductCli({
        argv: [
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
          '--environment=branch',
        ],
        repoRoot: 'E:\\v20-cli',
        ports,
      }),
    ).rejects.toThrow('V20_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');

    expect(ports.preflight).not.toHaveBeenCalled();
    expect(ports.acquireOwner).not.toHaveBeenCalled();
    expect(ports.docker).not.toHaveBeenCalled();
    expect(ports.browser).not.toHaveBeenCalled();
    expect(ports.api).not.toHaveBeenCalled();
    expect(ports.provider).not.toHaveBeenCalled();
  });

  it('keeps a valid V20 invocation default-off at preflight before owner or runtime work', async () => {
    const ports = createBlockedPorts();

    await expect(
      runReviewPlannerV20ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v20-cli',
        ports,
      }),
    ).resolves.toEqual({
      stage: 'preflight',
      status: 'blocked',
      code: 'default_off',
    });

    expect(ports.preflight).toHaveBeenCalledWith({
      environment: 'branch',
      repoRoot: 'E:\\v20-cli',
    });
    expect(ports.acquireOwner).not.toHaveBeenCalled();
    expect(ports.docker).not.toHaveBeenCalled();
    expect(ports.browser).not.toHaveBeenCalled();
    expect(ports.api).not.toHaveBeenCalled();
    expect(ports.provider).not.toHaveBeenCalled();
  });

  it('projects a fake-ready V20 composition result instead of hard-coding default_off', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const ledger = {
      attemptSha256: () => 'a'.repeat(64),
      writeExecutionManifest: jest.fn(async () => undefined),
      writeManifest: jest.fn(),
      close: jest.fn(),
    };
    const journal = {
      appendCheckpoint: jest.fn(),
      latestCheckpoint: jest.fn(() => null),
      close: jest.fn(),
    };
    const runRunner = jest.fn(async () => undefined);
    const ports = {
      preflight: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v20-cli',
        commitSha: 'b'.repeat(40),
        pairedEvidenceSha256: 'c'.repeat(64),
        databaseUrlSha256: 'e'.repeat(64),
        accountIdSha256: { review: 'd'.repeat(64), planner: 'e'.repeat(64) },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
        dependencies: {},
      })),
      revalidate: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v20-cli',
        commitSha: 'b'.repeat(40),
        pairedEvidenceSha256: 'c'.repeat(64),
        databaseUrlSha256: 'e'.repeat(64),
      })),
      acquireOwner: jest.fn(async () => ({
        status: 'acquired' as const,
        owner,
      })),
      reserveLedger: jest.fn(async () => ledger),
      prepareJournal: jest.fn(async () => journal),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner,
    };

    await expect(
      runReviewPlannerV20ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v20-cli',
        ports: ports as never,
      }),
    ).resolves.toEqual({
      stage: 'complete',
      status: 'passed',
      environment: 'branch',
      requestCount: 4,
    });

    expect(runRunner).toHaveBeenCalledTimes(1);
    expect(ledger.close).toHaveBeenCalledTimes(1);
    expect(owner.close).toHaveBeenCalledTimes(1);
  });

  it('projects a fake-ready runner failure without exposing a runtime error', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const ledger = {
      attemptSha256: () => 'f'.repeat(64),
      writeExecutionManifest: jest.fn(async () => undefined),
      writeManifest: jest.fn(),
      close: jest.fn(),
    };
    const journal = {
      appendCheckpoint: jest.fn(),
      latestCheckpoint: jest.fn(() => null),
      close: jest.fn(),
    };
    const ports = {
      preflight: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v20-cli',
        commitSha: 'a'.repeat(40),
        pairedEvidenceSha256: 'b'.repeat(64),
        databaseUrlSha256: 'e'.repeat(64),
        accountIdSha256: { review: 'c'.repeat(64), planner: 'd'.repeat(64) },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
        dependencies: {},
      })),
      revalidate: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v20-cli',
        commitSha: 'a'.repeat(40),
        pairedEvidenceSha256: 'b'.repeat(64),
        databaseUrlSha256: 'e'.repeat(64),
      })),
      acquireOwner: jest.fn(async () => ({
        status: 'acquired' as const,
        owner,
      })),
      reserveLedger: jest.fn(async () => ledger),
      prepareJournal: jest.fn(async () => journal),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(async () => {
        throw new Error('password=secret prompt=private');
      }),
    };

    await expect(
      runReviewPlannerV20ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v20-cli',
        ports: ports as never,
      }),
    ).resolves.toEqual({
      stage: 'operation',
      status: 'failed',
      code: 'operation_failed',
    });
  });

  it('keeps V11 confirmations out of the V20 parser and serializes a nonsecret rejection', () => {
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceArguments(
        [
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoveryConfirmation,
          '--environment=branch',
        ],
        'recovery',
      ),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');

    const value = serializeReviewPlannerV20ProductAcceptanceCliFailure(
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

  it('uses the exact execute path but blocks at owner during read-only preflight', async () => {
    const acquireOwner = jest.fn(async () => {
      throw new Error('OWNER_PORT_MUST_NOT_RUN');
    });

    await expect(
      executeReviewPlannerV20ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v20-cli',
        ports: {
          preflight: jest.fn(async () => ({
            status: 'ready' as const,
            environment: 'branch' as const,
            repoRoot: 'E:\\v20-cli',
            commitSha: 'a'.repeat(40),
            pairedEvidenceSha256: 'b'.repeat(64),
            databaseUrlSha256: 'c'.repeat(64),
          })),
          acquireOwner,
        },
        preflightOnly: true,
      } as never),
    ).resolves.toEqual({
      stage: 'owner',
      status: 'blocked',
      code: 'owner_active',
    });

    expect(acquireOwner).not.toHaveBeenCalled();
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
