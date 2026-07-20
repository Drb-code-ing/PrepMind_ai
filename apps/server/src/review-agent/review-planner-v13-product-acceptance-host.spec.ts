import { createHash } from 'node:crypto';

import {
  createDefaultReviewPlannerV13ProductAcceptanceRecoveryHost,
  isReviewPlannerV13DatabaseFingerprintStable,
} from './review-planner-v13-product-acceptance-host';

describe('Review Planner V13 recovery host', () => {
  const databaseUrl = 'postgresql://v13-recovery.example.invalid/prepmind';
  const databaseUrlSha256 = createHash('sha256')
    .update(databaseUrl)
    .digest('hex');
  const executionManifest = {
    schemaVersion:
      'phase-6.9.5-v13-product-acceptance-execution-manifest-v1' as const,
    environment: 'branch' as const,
    attemptSha256: 'a'.repeat(64),
    databaseUrlSha256,
    resources: {
      accountId: {
        review: `v13-synthetic-account-review-${'b'.repeat(32)}`,
        planner: `v13-synthetic-account-planner-${'c'.repeat(32)}`,
      },
      fixtureId: {
        review: `v13-synthetic-fixture-review-${'d'.repeat(32)}`,
        planner: `v13-synthetic-fixture-planner-${'e'.repeat(32)}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          '.tmp/phase-6-9-5-v13-product-acceptance/branch/profile-v13',
      },
    },
  };

  it('accepts only the database fingerprint captured with the reusable host', () => {
    expect(
      isReviewPlannerV13DatabaseFingerprintStable(
        databaseUrlSha256,
        databaseUrlSha256,
      ),
    ).toBe(true);
    expect(
      isReviewPlannerV13DatabaseFingerprintStable(
        databaseUrlSha256,
        'f'.repeat(64),
      ),
    ).toBe(false);
  });

  it('takes the recovery owner, revalidates its attempt, and seals only after restore plus exact cleanup', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const restoreDefaultOff = jest.fn(() => Promise.resolve());
    const cleanupExact = jest.fn(() => Promise.resolve());
    const finalize = jest.fn(() => Promise.resolve());
    const readLedger = jest
      .fn()
      .mockResolvedValueOnce({ status: 'operation_failed' as const })
      .mockResolvedValueOnce({ status: 'operation_failed' as const })
      .mockResolvedValue({ status: 'recovered' as const });
    const host = createDefaultReviewPlannerV13ProductAcceptanceRecoveryHost(
      'E:\\v13-recovery-host',
      {
        platform: 'win32',
        readLedger,
        readExecutionManifest: jest.fn(() =>
          Promise.resolve(executionManifest),
        ),
        acquireOwner: jest.fn(() =>
          Promise.resolve({
            status: 'acquired' as const,
            owner,
          }),
        ),
        finalize,
        restoreDefaultOff,
        cleanupExact,
        readDatabaseUrl: () => databaseUrl,
      },
    );

    await expect(
      host.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v13-recovery-host',
      }),
    ).resolves.toEqual({ status: 'ready' });
    await expect(
      host.recover({
        environment: 'branch',
        repoRoot: 'E:\\v13-recovery-host',
      }),
    ).resolves.toEqual({ status: 'recovered' });

    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledWith(executionManifest, databaseUrl);
    expect(finalize).toHaveBeenCalledWith({
      repoRoot: 'E:\\v13-recovery-host',
      environment: 'branch',
      owner,
    });
    expect(owner.close).toHaveBeenCalledTimes(1);
    await expect(
      host.recover({
        environment: 'branch',
        repoRoot: 'E:\\v13-recovery-host',
      }),
    ).resolves.toEqual({ status: 'blocked' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
  });

  it('fails closed before acquiring the owner when the execution database fingerprint drifts', async () => {
    const acquireOwner = jest.fn();
    const restoreDefaultOff = jest.fn();
    const cleanupExact = jest.fn();
    const host = createDefaultReviewPlannerV13ProductAcceptanceRecoveryHost(
      'E:\\v13-recovery-drift',
      {
        platform: 'win32',
        readLedger: jest.fn(() =>
          Promise.resolve({
            status: 'operation_failed' as const,
          }),
        ),
        readExecutionManifest: jest.fn(() =>
          Promise.resolve(executionManifest),
        ),
        acquireOwner,
        finalize: jest.fn(),
        restoreDefaultOff,
        cleanupExact,
        readDatabaseUrl: () =>
          'postgresql://different.example.invalid/prepmind',
      },
    );

    await expect(
      host.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v13-recovery-drift',
      }),
    ).resolves.toEqual({ status: 'blocked' });
    expect(acquireOwner).not.toHaveBeenCalled();
    expect(restoreDefaultOff).not.toHaveBeenCalled();
    expect(cleanupExact).not.toHaveBeenCalled();
  });
});
