/* eslint-disable @typescript-eslint/require-await -- async port fixture signatures are part of the CLI boundary */
import {
  parseReviewPlannerV11ProductAcceptanceArguments,
  runReviewPlannerV11ProductAcceptanceProductCli,
  serializeReviewPlannerV11ProductAcceptanceCliFailure,
} from './review-planner-v11-product-acceptance-cli';
import { REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

describe('Review Planner V11 product-acceptance CLI', () => {
  const argv = [
    '--confirm-v11-review-planner-product-acceptance',
    '--environment=branch',
  ] as const;

  it('rejects a V10 confirmation before it can compose V11 runtime work', () => {
    expect(() =>
      parseReviewPlannerV11ProductAcceptanceArguments(
        [
          REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.productConfirmation,
          '--environment=branch',
        ],
        'product',
      ),
    ).toThrow('V11_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
  });

  it('returns owner_active before a V11 reservation or any resource stage', async () => {
    const ports = {
      preflight: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v11-cli',
        commitSha: 'a'.repeat(40),
        branchName: 'codex/v11-cli',
        pairedEvidenceSha256: 'b'.repeat(64),
        chromeExecutablePath: 'C:\\Browser\\chrome.exe',
      })),
      acquireOwner: jest.fn(async () => ({ status: 'owner_active' as const })),
      revalidatePreflight: jest.fn(),
      reserveLedger: jest.fn(),
      writeExecutionManifest: jest.fn(),
      createFixtures: jest.fn(),
      prepareRecoveryJournal: jest.fn(),
      createRunner: jest.fn(),
      recoverFailure: jest.fn(),
    };

    await expect(
      runReviewPlannerV11ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v11-cli',
        ports: ports,
      }),
    ).resolves.toEqual({
      stage: 'owner',
      status: 'blocked',
      code: 'owner_active',
    });

    expect(ports.reserveLedger).not.toHaveBeenCalled();
    expect(ports.writeExecutionManifest).not.toHaveBeenCalled();
    expect(ports.createFixtures).not.toHaveBeenCalled();
    expect(ports.createRunner).not.toHaveBeenCalled();
  });

  it('reports a completed automatic recovery and does not ask the operator to run it again', async () => {
    const owner = {
      assertHeld: jest.fn(),
      close: jest.fn(),
    };
    const ledger = {
      close: jest.fn(),
    };
    const manifest = {
      environment: 'branch' as const,
      attemptSha256: 'c'.repeat(64),
    };
    const recoverFailure = jest.fn(async () => undefined);
    const ports = {
      preflight: jest.fn(async () => ({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v11-cli',
        commitSha: 'a'.repeat(40),
        branchName: 'codex/v11-cli',
        pairedEvidenceSha256: 'b'.repeat(64),
        chromeExecutablePath: 'C:\\Browser\\chrome.exe',
      })),
      acquireOwner: jest.fn(async () => ({
        status: 'acquired' as const,
        owner,
      })),
      revalidatePreflight: jest.fn(async () => true),
      reserveLedger: jest.fn(async () => ({
        ledger,
        attemptSha256: manifest.attemptSha256,
      })),
      writeExecutionManifest: jest.fn(async () => manifest),
      createFixtures: jest.fn(async () => {
        throw new Error('fixture failure');
      }),
      prepareRecoveryJournal: jest.fn(),
      createRunner: jest.fn(),
      recoverFailure,
    };

    await expect(
      runReviewPlannerV11ProductAcceptanceProductCli({
        argv,
        repoRoot: 'E:\\v11-cli',
        ports: ports as never,
      }),
    ).resolves.toEqual({
      stage: 'recovery',
      status: 'failed',
      code: 'operation_failed_recovered',
    });

    expect(recoverFailure).toHaveBeenCalledWith(
      expect.objectContaining({ executionManifest: manifest }),
    );
  });

  it('serializes a nonsecret failure projection', () => {
    const value = serializeReviewPlannerV11ProductAcceptanceCliFailure(
      'product',
      new Error(
        'password=secret https://provider.invalid prompt=private response=private',
      ),
    );

    expect(value).toBe(
      JSON.stringify({
        stage: 'operation',
        status: 'failed',
        code: 'operation_failed',
      }),
    );
    expect(value).not.toMatch(/password|secret|https?:|prompt|response/i);
  });
});
