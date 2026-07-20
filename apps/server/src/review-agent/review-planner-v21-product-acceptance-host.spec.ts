import { createHash } from 'node:crypto';

type DefaultOffEnvironmentValidator = (entries: readonly string[]) => void;
type RestoreDefaultReviewPlannerProductAcceptanceServer = (
  repoRoot: string,
  defaultOffEnvironmentValidator?: DefaultOffEnvironmentValidator,
) => Promise<void>;

let injectedDefaultOffEnvironmentValidator:
  | DefaultOffEnvironmentValidator
  | undefined;
const mockRestoreDefaultReviewPlannerProductAcceptanceServer =
  jest.fn<RestoreDefaultReviewPlannerProductAcceptanceServer>(
    (
      _repoRoot: string,
      defaultOffEnvironmentValidator?: DefaultOffEnvironmentValidator,
    ) => {
      injectedDefaultOffEnvironmentValidator = defaultOffEnvironmentValidator;
      return Promise.resolve();
    },
  );

jest.mock('./review-planner-v8-product-acceptance-composition', () => {
  const actual = jest.requireActual<
    typeof import('./review-planner-v8-product-acceptance-composition')
  >('./review-planner-v8-product-acceptance-composition');
  return {
    ...actual,
    restoreDefaultReviewPlannerProductAcceptanceServer:
      mockRestoreDefaultReviewPlannerProductAcceptanceServer,
  };
});

import {
  createDefaultReviewPlannerV21ProductAcceptanceRecoveryHost,
  isReviewPlannerV21DatabaseFingerprintStable,
} from './review-planner-v21-product-acceptance-host';

describe('Review Planner V21 recovery host', () => {
  const databaseUrl = 'postgresql://v21-recovery.example.invalid/prepmind';
  const databaseUrlSha256 = createHash('sha256')
    .update(databaseUrl)
    .digest('hex');
  const executionManifest = {
    schemaVersion:
      'phase-6.9.5-v21-product-acceptance-execution-manifest-v1' as const,
    environment: 'branch' as const,
    attemptSha256: 'a'.repeat(64),
    databaseUrlSha256,
    resources: {
      accountId: {
        review: `v21-synthetic-account-review-${'b'.repeat(32)}`,
        planner: `v21-synthetic-account-planner-${'c'.repeat(32)}`,
      },
      fixtureId: {
        review: `v21-synthetic-fixture-review-${'d'.repeat(32)}`,
        planner: `v21-synthetic-fixture-planner-${'e'.repeat(32)}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          '.tmp/phase-6-9-5-v21-product-acceptance/branch/profile-v21',
      },
    },
  };

  it('accepts only the database fingerprint captured with the reusable host', () => {
    expect(
      isReviewPlannerV21DatabaseFingerprintStable(
        databaseUrlSha256,
        databaseUrlSha256,
      ),
    ).toBe(true);
    expect(
      isReviewPlannerV21DatabaseFingerprintStable(
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
    const host = createDefaultReviewPlannerV21ProductAcceptanceRecoveryHost(
      'E:\\v21-recovery-host',
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
        repoRoot: 'E:\\v21-recovery-host',
      }),
    ).resolves.toEqual({ status: 'ready' });
    await expect(
      host.recover({
        environment: 'branch',
        repoRoot: 'E:\\v21-recovery-host',
      }),
    ).resolves.toEqual({ status: 'recovered' });

    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(cleanupExact).toHaveBeenCalledWith(executionManifest, databaseUrl);
    expect(finalize).toHaveBeenCalledWith({
      repoRoot: 'E:\\v21-recovery-host',
      environment: 'branch',
      owner,
    });
    expect(owner.close).toHaveBeenCalledTimes(1);
    await expect(
      host.recover({
        environment: 'branch',
        repoRoot: 'E:\\v21-recovery-host',
      }),
    ).resolves.toEqual({ status: 'blocked' });
    expect(restoreDefaultOff).toHaveBeenCalledTimes(1);
  });

  it('injects the V21 default-off validator into recovery restore without relaxing unsafe runtime values', async () => {
    mockRestoreDefaultReviewPlannerProductAcceptanceServer.mockClear();
    injectedDefaultOffEnvironmentValidator = undefined;
    const root = 'E:\\v21-default-validator';
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const host = createDefaultReviewPlannerV21ProductAcceptanceRecoveryHost(
      root,
      {
        platform: 'win32',
        readLedger: jest.fn(() =>
          Promise.resolve({ status: 'operation_failed' as const }),
        ),
        readExecutionManifest: jest.fn(() =>
          Promise.resolve(executionManifest),
        ),
        acquireOwner: jest.fn(() =>
          Promise.resolve({ status: 'acquired' as const, owner }),
        ),
        finalize: jest.fn(() => Promise.resolve()),
        cleanupExact: jest.fn(() => Promise.resolve()),
        readDatabaseUrl: () => databaseUrl,
      },
    );

    await expect(
      host.preflight({ environment: 'branch', repoRoot: root }),
    ).resolves.toEqual({ status: 'ready' });
    await expect(
      host.recover({ environment: 'branch', repoRoot: root }),
    ).resolves.toEqual({ status: 'recovered' });

    expect(
      mockRestoreDefaultReviewPlannerProductAcceptanceServer,
    ).toHaveBeenCalledWith(root, expect.any(Function));
    const validator = injectedDefaultOffEnvironmentValidator;
    if (typeof validator !== 'function') {
      throw new Error('V21 default-off validator was not injected');
    }

    const entries = (model: string, baseUrl: string) => [
      'AI_PROVIDER_MODE=mock',
      'AI_ENABLE_LIVE_CALLS=false',
      `AI_MODEL=${model}`,
      `AI_BASE_URL=${baseUrl}`,
      'DEEPSEEK_API_KEY=',
      'OPENAI_API_KEY=',
      'REVIEW_AGENT_MODEL_ENABLED=false',
      'PLANNER_AGENT_MODEL_ENABLED=false',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED=false',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT=',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256=',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS=0',
      'REVIEW_AGENT_MODEL_TIMEOUT_MS=4500',
      'PLANNER_AGENT_MODEL_TIMEOUT_MS=4500',
    ];
    for (const model of ['deepseek-v4-flash', 'deepseek-v4-pro']) {
      for (const baseUrl of [
        'https://api.deepseek.com',
        'https://api.deepseek.com/v1',
      ]) {
        expect(() => {
          validator(entries(model, baseUrl));
        }).not.toThrow();
      }
    }
    expect(() => {
      validator(entries('deepseek-v4-flash', 'https://api.deepseek.com/v1/'));
    }).toThrow();
    expect(() => {
      validator(entries('unapproved-model', 'https://api.deepseek.com'));
    }).toThrow();
    expect(() => {
      validator([
        ...entries('deepseek-v4-pro', 'https://api.deepseek.com'),
        'AI_ENABLE_LIVE_CALLS=true',
      ]);
    }).toThrow();
  });

  it('fails closed before acquiring the owner when the execution database fingerprint drifts', async () => {
    const acquireOwner = jest.fn();
    const restoreDefaultOff = jest.fn();
    const cleanupExact = jest.fn();
    const host = createDefaultReviewPlannerV21ProductAcceptanceRecoveryHost(
      'E:\\v21-recovery-drift',
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
        repoRoot: 'E:\\v21-recovery-drift',
      }),
    ).resolves.toEqual({ status: 'blocked' });
    expect(acquireOwner).not.toHaveBeenCalled();
    expect(restoreDefaultOff).not.toHaveBeenCalled();
    expect(cleanupExact).not.toHaveBeenCalled();
  });
});
