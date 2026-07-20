/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ReviewPlannerV8ProductAcceptanceLedger } from './review-planner-v8-product-acceptance-ledger';
import {
  createDefaultReviewPlannerV11ProductAcceptanceComposition,
  createDefaultReviewPlannerV8ProductAcceptanceComposition,
} from './review-planner-v8-product-acceptance-composition';
import { createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter } from './review-planner-v11-product-acceptance-execution';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';
import { REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_CHECKPOINTS } from './review-planner-v13-product-acceptance-recovery';
import { REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_CHECKPOINTS } from './review-planner-v14-product-acceptance-recovery';
import { REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_CHECKPOINTS } from './review-planner-v15-product-acceptance-recovery';
import { REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_CHECKPOINTS } from './review-planner-v16-product-acceptance-recovery';
import { REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_CHECKPOINTS } from './review-planner-v17-product-acceptance-recovery';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptancePersistedTrace,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
} from './review-planner-v8-product-acceptance-runner';

const reviewCapability = 'review-capability-v8';
const plannerCapability = 'planner-capability-v8';
const canonicalSuggestionUrl =
  'http://127.0.0.1:3001/review-agent/suggestions?days=7&startDate=2026-07-18&timezoneOffsetMinutes=-480';
const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');
type Mutable<Value> = { -readonly [Key in keyof Value]: Value[Key] };
type MutableTrace = Mutable<
  Omit<ReviewPlannerV8ProductAcceptancePersistedTrace, 'usage' | 'steps'>
> & {
  usage: Mutable<ReviewPlannerV8ProductAcceptancePersistedTrace['usage']>;
  steps: Array<
    Mutable<ReviewPlannerV8ProductAcceptancePersistedTrace['steps'][number]>
  >;
};

describe('Review Planner V8 product acceptance runner', () => {
  it('uses durable receipts in the exact order and derives all identity from persisted traces', async () => {
    const fixture = createFixture();

    const result = await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect(fixture.order).toEqual([
      'ledger-environment',
      'activate:review',
      'facts-before:review',
      'ledger-claim:review-api',
      'api:review',
      'trace:review-api',
      'ledger-result:review-api',
      'ledger-claim:review-browser',
      'browser-start:review',
      'browser-continue:review',
      'browser-end:review',
      'restore:review',
      'ledger-restore:review',
      'trace:review-browser',
      'ledger-screenshot:review',
      'ledger-result:review-browser',
      'facts-after:review',
      'activate:planner',
      'facts-before:planner',
      'ledger-claim:planner-api',
      'api:planner',
      'trace:planner-api',
      'ledger-result:planner-api',
      'ledger-claim:planner-browser',
      'browser-start:planner',
      'browser-continue:planner',
      'browser-end:planner',
      'restore:planner',
      'ledger-restore:planner',
      'trace:planner-browser',
      'ledger-screenshot:planner',
      'ledger-result:planner-browser',
      'facts-after:planner',
      'owner-isolation',
      'ledger-owner-isolation',
      'cleanup',
      'ledger-cleanup',
      'ledger-finalize',
    ]);
    expect(result).toMatchObject({
      environment: 'branch',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      usage: { inputTokens: 420, outputTokens: 82 },
      durationMs: 4200,
    });
    expect(new Set(result.traceIdSha256).size).toBe(4);
    expect(result.traceSummaries).toEqual(
      (['review', 'planner'] as const).flatMap((component) =>
        (['api', 'browser'] as const).map((slot) =>
          traceSummary(component, slot),
        ),
      ),
    );
    expect(fixture.ledger.recordSlotResult).toHaveBeenCalledTimes(4);
    expect(fixture.ledger.finalizeSuccess).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(fixture.ledger.recordSlotResult.mock.calls),
    ).not.toContain(reviewCapability);
    expect(JSON.stringify(result)).not.toContain(reviewCapability);
    expect(JSON.stringify(result)).not.toContain(plannerCapability);
    expect(fixture.apiCapabilitySha256).toEqual([
      sha(reviewCapability),
      sha(plannerCapability),
    ]);
    expect(
      () =>
        fixture.dependencies.dispatchApi.mock.calls[0][0].acceptanceCapability,
    ).toThrow('PRODUCT_ACCEPTANCE_CAPABILITY_UNAVAILABLE');
    expect(
      fixture.routes.continueWithAcceptanceCapability.mock.calls.map(
        ([capability]) => sha(capability),
      ),
    ).toEqual([sha(reviewCapability), sha(plannerCapability)]);
    expect(fixture.routes.continue).not.toHaveBeenCalled();
    for (const [record] of fixture.ledger.recordSlotResult.mock.calls) {
      expect(record).toEqual(
        expect.objectContaining({
          pricingKnown: false,
          costEstimateUsd: 0,
          steps: expect.any(Array),
        }),
      );
    }
  });

  it('uses the V10 default composition cleanup and seals only V10 ledger records', async () => {
    const profile = REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE;
    const composition =
      createDefaultReviewPlannerV8ProductAcceptanceComposition(
        'E:\\PrepMind_ai智能备考助手',
        {
          profile,
          env: { DATABASE_URL: 'postgresql://unused.invalid/prepmind' },
          prisma: createCleanupOnlyPrisma() as never,
        },
      );
    try {
      const fixture = createFixture();
      const defaultDependencies = composition.ports.createRunnerDependencies(
        {} as never,
      );
      fixture.input.profile = profile;
      fixture.dependencies.restoreDefaultOff = jest.fn(async (component) => ({
        ...defaultOffReceipt(component),
        schemaVersion: profile.schemas.defaultOff,
      }));
      fixture.dependencies.cleanup = jest.fn(() =>
        defaultDependencies.cleanup(),
      );

      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).resolves.toMatchObject({ environment: 'branch' });
      expect(
        fixture.ledger.recordSlotResult.mock.calls.map(
          ([record]) => record.schemaVersion,
        ),
      ).toEqual(Array(4).fill(profile.schemas.slotResult));
      expect(
        fixture.ledger.recordDefaultOff.mock.calls.map(
          ([record]) => record.schemaVersion,
        ),
      ).toEqual(Array(2).fill(profile.schemas.defaultOff));
      expect(
        fixture.ledger.recordOwnerIsolation.mock.calls[0][0].schemaVersion,
      ).toBe(profile.schemas.ownerIsolation);
      expect(fixture.ledger.recordCleanup.mock.calls[0][0].schemaVersion).toBe(
        profile.schemas.cleanup,
      );
      expect(fixture.ledger.finalizeSuccess).toHaveBeenCalledTimes(1);
    } finally {
      await composition.dispose();
    }
  });

  it('records the complete V11 checkpoint sequence before every product boundary', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual([
      'review_api_activate',
      'review_api_facts_before',
      'review_api_trace_baseline',
      'review_api_dispatch',
      'review_api_observation',
      'review_api_trace_wait',
      'review_api_trace_canonicalize',
      'review_api_slot_record',
      'review_browser_trace_baseline',
      'review_browser_launch',
      'review_browser_dispatch',
      'review_browser_observation',
      'review_browser_default_off',
      'review_browser_trace_wait',
      'review_browser_trace_canonicalize',
      'review_browser_slot_record',
      'planner_api_activate',
      'planner_api_facts_before',
      'planner_api_trace_baseline',
      'planner_api_dispatch',
      'planner_api_observation',
      'planner_api_trace_wait',
      'planner_api_trace_canonicalize',
      'planner_api_slot_record',
      'planner_browser_trace_baseline',
      'planner_browser_launch',
      'planner_browser_dispatch',
      'planner_browser_observation',
      'planner_browser_default_off',
      'planner_browser_trace_wait',
      'planner_browser_trace_canonicalize',
      'planner_browser_slot_record',
    ]);
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('admits the independent V13 profile and records its complete checkpoint sequence', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual(
      REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_CHECKPOINTS.slice(1),
    );
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('admits the isolated V14 profile and records its complete checkpoint sequence', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual(
      REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_CHECKPOINTS.slice(1),
    );
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('admits the isolated V15 profile and records its complete checkpoint sequence', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual(
      REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_CHECKPOINTS.slice(1),
    );
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('admits the isolated V16 profile and records its complete checkpoint sequence', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual(
      REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_CHECKPOINTS.slice(1),
    );
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('admits the isolated V17 profile and records its complete checkpoint sequence', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).resolves.toMatchObject({ environment: 'branch' });

    expect(diagnostics.checkpoint.mock.calls.map(([value]) => value)).toEqual(
      REVIEW_PLANNER_V17_PRODUCT_ACCEPTANCE_CHECKPOINTS.slice(1),
    );
    expect(diagnostics.publishFailure).not.toHaveBeenCalled();
  });

  it('serializes the four runner slots into the isolated V11 success ledger after exact cleanup', async () => {
    const fixture = createFixture();
    const v11 = createV11RunnerLedgerFixture();
    const legacyRoots = await createLegacyProductAcceptanceRootSnapshot();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(() => v11.recordFailure()),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      ledger: createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter({
        environment: 'branch',
        attemptSha256: 'a'.repeat(64),
        ledger: v11.ledger,
        manifest: v11RunnerManifest(),
      }),
      diagnostics,
    });

    try {
      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).resolves.toMatchObject({ environment: 'branch' });

      expect(v11.slotResults).toHaveLength(4);
      expect(v11.slotResults.map((record) => record.slot)).toEqual([
        'review-api',
        'review-browser',
        'planner-api',
        'planner-browser',
      ]);
      expect(
        v11.slotResults.every((record) =>
          record.schemaVersion.includes('-v11-'),
        ),
      ).toBe(true);
      expect(v11.success).toMatchObject({
        schemaVersion: expect.stringContaining('-v11-'),
      });
      await legacyRoots.expectUnchanged();
      expect(v11.order.indexOf('cleanup')).toBeLessThan(
        v11.order.indexOf('acceptance'),
      );
      expect(v11.order.indexOf('acceptance')).toBeLessThan(
        v11.order.indexOf('success'),
      );
      expect(diagnostics.publishFailure).not.toHaveBeenCalled();
    } finally {
      await legacyRoots.dispose();
    }
  });

  it('runs fake V11 success through manifest-bound default cleanup before finalizing the V11 ledger', async () => {
    const fixture = createFixture();
    const v11 = createV11RunnerLedgerFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(() => v11.recordFailure()),
    };
    const terminateBrowser = jest.fn(async () => undefined);
    const runtime = Object.freeze({
      dockerExec: jest.fn(() => undefined),
      apiProvider: jest.fn(() => undefined),
      chromium: jest.fn(() => undefined),
      fetch: jest.fn(() => undefined),
      terminateBrowser,
    });
    let defaultDependencies:
      | ReviewPlannerV8ProductAcceptanceRunnerDependencies
      | undefined;
    let observedRuntime: unknown;
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceComposition(
        'E:\\v11-cleanup-scope',
        {
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: {
            $disconnect: jest.fn(async () => undefined),
            $transaction: jest.fn(async (callback) => callback({})),
            user: { count: jest.fn(async () => 0) },
            wrongQuestion: { count: jest.fn(async () => 0) },
            agentTraceRun: { count: jest.fn(async () => 0) },
          } as never,
          boundary: {
            preflight: async () =>
              ({
                status: 'ready',
                environment: 'branch',
                repoRoot: 'E:\\v11-cleanup-scope',
                commitSha: 'b'.repeat(40),
                pairedEvidenceSha256: 'c'.repeat(64),
                chromeExecutablePath:
                  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                utcStamp: '20260720t000000z',
              }) as never,
            createFixtures: async () =>
              ({ resources: {}, accounts: {}, fixtureReceipt: {} }) as never,
            captureRunnerDependencies: (input: {
              dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
              runtime: unknown;
            }) => {
              defaultDependencies = input.dependencies;
              observedRuntime = input.runtime;
            },
            runtime,
          },
        } as never,
      );

    try {
      const preflight = await composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v11-cleanup-scope',
      });
      if (preflight.status !== 'ready') throw new Error('expected preflight');
      const executionManifest = await composition.ports.writeExecutionManifest({
        environment: 'branch',
        repoRoot: 'E:\\v11-cleanup-scope',
        owner: {} as never,
        ledger: v11.ledger,
        attemptSha256: 'a'.repeat(64),
        preflight,
      });
      const fixtures = await composition.ports.createFixtures({
        environment: 'branch',
        repoRoot: 'E:\\v11-cleanup-scope',
        owner: {} as never,
        ledger: v11.ledger,
        executionManifest,
      });
      await composition.ports.createRunner({
        environment: 'branch',
        repoRoot: 'E:\\v11-cleanup-scope',
        owner: {} as never,
        ledger: v11.ledger,
        journal: {} as never,
        fixtures,
        executionManifest,
      });
      expect(defaultDependencies).toBeDefined();
      expect(observedRuntime).toBe(runtime);
      await expect(defaultDependencies?.cleanup()).resolves.toMatchObject({
        schemaVersion:
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
      });
      fixture.dependencies.cleanup = jest.fn(() =>
        defaultDependencies?.cleanup(),
      );
      Object.assign(fixture.input, {
        profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
        ledger: createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter({
          environment: 'branch',
          attemptSha256: 'a'.repeat(64),
          ledger: v11.ledger,
          manifest: v11RunnerManifest(),
        }),
        diagnostics,
      });

      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).resolves.toMatchObject({ environment: 'branch' });
      expect(terminateBrowser).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedProfilePaths: [
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
              'branch',
            ),
          ],
        }),
      );
      expect(v11.success).toBeDefined();
    } finally {
      await composition.dispose();
    }
  });

  it('publishes exactly one V11 failure without a V11 success when the runner fails', async () => {
    const fixture = createFixture();
    const v11 = createV11RunnerLedgerFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(() => v11.recordFailure()),
    };
    fixture.dependencies.activateComponent = jest.fn(async () => {
      throw new Error('raw activation secret');
    });
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      ledger: createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter({
        environment: 'branch',
        attemptSha256: 'a'.repeat(64),
        ledger: v11.ledger,
        manifest: v11RunnerManifest(),
      }),
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');

    expect(diagnostics.publishFailure).toHaveBeenCalledTimes(1);
    expect(v11.failures).toBe(1);
    expect(v11.success).toBeUndefined();
    expect(v11.slotResults).toHaveLength(0);
  });

  it('publishes one V11 failure when the adapter success seal rejects asynchronously', async () => {
    const fixture = createFixture();
    const v11 = createV11RunnerLedgerFixture({ finalizeRejects: true });
    const legacyRoots = await createLegacyProductAcceptanceRootSnapshot();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(() => v11.recordFailure()),
    };
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      ledger: createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter({
        environment: 'branch',
        attemptSha256: 'a'.repeat(64),
        ledger: v11.ledger,
        manifest: v11RunnerManifest(),
      }),
      diagnostics,
    });

    try {
      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');

      expect(v11.order).toContain('cleanup');
      expect(v11.order).toContain('acceptance');
      expect(v11.order).not.toContain('success');
      expect(v11.failures).toBe(1);
      expect(v11.success).toBeUndefined();
      expect(diagnostics.publishFailure).toHaveBeenCalledTimes(1);
      await legacyRoots.expectUnchanged();
    } finally {
      await legacyRoots.dispose();
    }
  });

  it('detects a new legacy V8 public-ledger leaf after a V11 adapter run', async () => {
    const legacyRoots = await createLegacyProductAcceptanceRootSnapshot();

    try {
      await writeFile(
        join(
          legacyRoots.root,
          ...REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
            'branch',
          ),
          '.forged-v8-leaf.json',
        ),
        'forged',
        'utf8',
      );

      await expect(legacyRoots.expectUnchanged()).rejects.toThrow(
        'V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED',
      );
    } finally {
      await legacyRoots.dispose();
    }
  });

  it.each([
    {
      label: 'unknown empty directory',
      mutate: async (root: string, legacyRoot: string) => {
        await mkdir(join(legacyRoot, '.unexpected-empty-directory'));
      },
    },
    {
      label: 'deleted legacy leaf',
      mutate: async (_root: string, legacyRoot: string) => {
        await rm(join(legacyRoot, 'legacy-sentinel.json'));
      },
    },
    {
      label: 'replacement legacy leaf',
      mutate: async (_root: string, legacyRoot: string) => {
        await writeFile(
          join(legacyRoot, 'legacy-sentinel.json'),
          'replacement',
          'utf8',
        );
      },
    },
    {
      label: 'unsupported reparse entry',
      mutate: async (root: string, legacyRoot: string) => {
        const target = join(root, 'reparse-target');
        await mkdir(target);
        await symlink(
          target,
          join(legacyRoot, '.unexpected-reparse-entry'),
          process.platform === 'win32' ? 'junction' : 'dir',
        );
      },
    },
  ])('rejects a legacy-root %s mutation', async ({ mutate }) => {
    const legacyRoots = await createLegacyProductAcceptanceRootSnapshot();

    try {
      const legacyRoot = join(
        legacyRoots.root,
        ...REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          'branch',
        ),
      );
      await mutate(legacyRoots.root, legacyRoot);

      await expect(legacyRoots.expectUnchanged()).rejects.toThrow(
        'V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED',
      );
    } finally {
      await legacyRoots.dispose();
    }
  });

  it('removes the temporary root when legacy snapshot initialization fails', async () => {
    let createdRoot = '';

    await expect(
      createLegacyProductAcceptanceRootSnapshot({
        onRootCreatedForTest(root) {
          createdRoot = root;
          throw new Error('forced initialization failure');
        },
      }),
    ).rejects.toThrow('forced initialization failure');

    await expect(lstat(createdRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each([
    ['review_api_trace_baseline', 'capture'],
    ['review_api_dispatch', 'dispatch'],
    ['review_api_observation', 'observation'],
    ['review_api_trace_wait', 'trace-wait'],
    ['review_api_trace_canonicalize', 'trace-canonicalize'],
    ['review_api_slot_record', 'slot-record'],
    ['review_browser_trace_baseline', 'browser-baseline'],
    ['review_browser_launch', 'browser-launch'],
    ['review_browser_dispatch', 'browser-dispatch'],
    ['review_browser_observation', 'browser-observation'],
    ['review_browser_default_off', 'browser-default-off'],
    ['review_browser_trace_wait', 'browser-trace-wait'],
    ['review_browser_trace_canonicalize', 'browser-trace-canonicalize'],
    ['review_browser_slot_record', 'browser-slot-record'],
  ] as const)(
    'publishes one safe V11 failure and stops later effects when %s cannot checkpoint',
    async (checkpoint, stage) => {
      const fixture = createFixture();
      const diagnostics = {
        checkpoint: jest.fn((value: string) => {
          if (value === checkpoint)
            throw new Error('checkpoint persistence raw secret');
        }),
        publishFailure: jest.fn(),
      };
      Object.assign(fixture.input, {
        profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
        diagnostics,
      });

      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).rejects.toThrow(
        stage === 'browser-dispatch'
          ? 'PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID'
          : stage === 'browser-default-off'
            ? 'PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED'
            : 'PRODUCT_ACCEPTANCE_OPERATION_FAILED',
      );

      expect(diagnostics.publishFailure).toHaveBeenCalledTimes(1);
      expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
      if (stage === 'capture') {
        expect(fixture.dependencies.dispatchApi).not.toHaveBeenCalled();
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'dispatch') {
        expect(fixture.dependencies.dispatchApi).not.toHaveBeenCalled();
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'observation' || stage === 'trace-wait') {
        expect(fixture.dependencies.readPersistedTraces).not.toHaveBeenCalled();
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'trace-canonicalize' || stage === 'slot-record') {
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'browser-launch') {
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'browser-baseline') {
        expect(fixture.dependencies.runBrowser).not.toHaveBeenCalled();
      }
      if (stage === 'browser-dispatch') {
        expect(
          fixture.routes.continueWithAcceptanceCapability,
        ).not.toHaveBeenCalled();
      }
      if (stage === 'browser-observation' || stage === 'browser-trace-wait') {
        expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(
          1,
        );
      }
      if (
        stage === 'browser-trace-canonicalize' ||
        stage === 'browser-slot-record'
      ) {
        expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(
          2,
        );
      }
      if (stage === 'browser-slot-record') {
        expect(fixture.ledger.recordScreenshot).toHaveBeenCalledTimes(0);
      }
      if (stage === 'browser-default-off') {
        expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(
          1,
        );
      }
    },
  );

  it.each([
    ['clone', { ...REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE }],
    [
      'hostile proxy',
      new Proxy(REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE, {
        get() {
          throw new Error('profile getter must not run');
        },
      }),
    ],
  ])('rejects a non-canonical V10 profile %s', async (_label, profile) => {
    const fixture = createFixture();

    await expect(
      runReviewPlannerV8ProductAcceptance({ ...fixture.input, profile }),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_INPUT_INVALID');
    expect(fixture.ledger.claimSlot).not.toHaveBeenCalled();
    expect(fixture.dependencies.cleanup).not.toHaveBeenCalled();
  });

  it.each([
    ['clone', { ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE }],
    [
      'hostile proxy',
      new Proxy(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE, {
        get() {
          throw new Error('profile getter must not run');
        },
      }),
    ],
  ])(
    'rejects a non-canonical V11 profile %s before an external action',
    async (_label, profile) => {
      const fixture = createFixture();

      await expect(
        runReviewPlannerV8ProductAcceptance({
          ...fixture.input,
          profile,
          diagnostics: {
            checkpoint: jest.fn(),
            publishFailure: jest.fn(),
          },
        }),
      ).rejects.toThrow('PRODUCT_ACCEPTANCE_INPUT_INVALID');
      expect(fixture.dependencies.activateComponent).not.toHaveBeenCalled();
      expect(fixture.dependencies.cleanup).not.toHaveBeenCalled();
    },
  );

  it('does not read a V11 diagnostics port for a V10 run', async () => {
    const fixture = createFixture();
    fixture.dependencies.restoreDefaultOff = jest.fn(async (component) => ({
      ...defaultOffReceipt(component),
      schemaVersion:
        REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    }));
    fixture.dependencies.cleanup = jest.fn(async () => ({
      ...cleanupReceipt(),
      schemaVersion:
        REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    }));
    const diagnostics = new Proxy(
      {},
      {
        get() {
          throw new Error('V11 diagnostics must remain unread');
        },
      },
    );

    await expect(
      runReviewPlannerV8ProductAcceptance({
        ...fixture.input,
        profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        diagnostics,
      }),
    ).resolves.toMatchObject({ environment: 'branch' });
  });

  it('publishes a V11 operation failure without raw error, capability, or token data', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn(),
    };
    fixture.dependencies.dispatchApi = jest.fn(async () => {
      throw new Error('sk-secret capability-v8-token raw failure');
    });
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    const failure = runReviewPlannerV8ProductAcceptance(fixture.input);
    await expect(failure).rejects.toThrow(
      'PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
    await expect(failure).rejects.not.toThrow(
      /sk-secret|capability|token|raw/i,
    );
    expect(diagnostics.publishFailure).toHaveBeenCalledTimes(1);
    expect(diagnostics.publishFailure).toHaveBeenCalledWith();
    expect(JSON.stringify(diagnostics.publishFailure.mock.calls)).not.toMatch(
      /sk-secret|capability|token|raw/i,
    );
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cleanup', 'PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED'],
    ['cleanup-record', 'PRODUCT_ACCEPTANCE_OPERATION_FAILED'],
    ['evidence-finalize', 'PRODUCT_ACCEPTANCE_OPERATION_FAILED'],
  ] as const)(
    'publishes a V11 failure before returning a %s terminal error',
    async (stage, expectedError) => {
      const fixture = createFixture();
      const diagnostics = {
        checkpoint: jest.fn(),
        publishFailure: jest.fn(),
      };
      Object.assign(fixture.input, {
        profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
        diagnostics,
      });
      if (stage === 'cleanup') {
        fixture.dependencies.cleanup = jest.fn(async () => {
          throw new Error('cleanup raw secret');
        });
      }
      if (stage === 'cleanup-record') {
        fixture.ledger.recordCleanup.mockImplementation(() => {
          throw new Error('cleanup record raw secret');
        });
      }
      if (stage === 'evidence-finalize') {
        fixture.ledger.finalizeSuccess.mockImplementation(() => {
          throw new Error('finalize raw secret');
        });
      }

      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).rejects.toThrow(expectedError);
      expect(diagnostics.publishFailure).toHaveBeenCalledTimes(1);
    },
  );

  it('retries V11 failure publication when the first publisher attempt fails', async () => {
    const fixture = createFixture();
    const diagnostics = {
      checkpoint: jest.fn(),
      publishFailure: jest.fn().mockImplementationOnce(() => {
        throw new Error('first failure publication raw secret');
      }),
    };
    fixture.dependencies.dispatchApi = jest.fn(async () => {
      throw new Error('dispatch raw secret');
    });
    Object.assign(fixture.input, {
      profile: REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
      diagnostics,
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
    expect(diagnostics.publishFailure).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['V8', undefined],
    ['V10', REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE],
  ] as const)(
    'does not require or call captureTraceBaseline for a legacy %s run',
    async (_label, profile) => {
      const fixture = createFixture();
      fixture.dependencies.captureTraceBaseline = jest.fn(async () => {
        throw new Error('legacy baseline must remain adapter-owned');
      });
      if (profile) {
        fixture.dependencies.restoreDefaultOff = jest.fn(async (component) => ({
          ...defaultOffReceipt(component),
          schemaVersion: profile.schemas.defaultOff,
        }));
        fixture.dependencies.cleanup = jest.fn(async () => ({
          ...cleanupReceipt(),
          schemaVersion: profile.schemas.cleanup,
        }));
      }

      await expect(
        runReviewPlannerV8ProductAcceptance({
          ...fixture.input,
          ...(profile ? { profile } : {}),
        }),
      ).resolves.toMatchObject({ environment: 'branch' });
      expect(fixture.dependencies.captureTraceBaseline).not.toHaveBeenCalled();
    },
  );

  it('durably claims the browser slot before browser launch can fail', async () => {
    const fixture = createFixture();
    fixture.dependencies.runBrowser = jest.fn(async () => {
      fixture.order.push('browser-start:review');
      throw new Error('launch failed with raw secret');
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
    expect(fixture.order.slice(0, 9)).toEqual([
      'ledger-environment',
      'activate:review',
      'facts-before:review',
      'ledger-claim:review-api',
      'api:review',
      'trace:review-api',
      'ledger-result:review-api',
      'ledger-claim:review-browser',
      'browser-start:review',
    ]);
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
  });

  it('rejects a zero-duration attempted live candidate while accepting a zero-duration inactive observation', async () => {
    const fixture = createFixture();
    fixture.dependencies.dispatchApi = jest.fn(async ({ component }) => ({
      ...requestResult(component, 'api'),
      target: {
        attempted: true,
        degraded: false,
        disposition: 'candidate_applied',
        provenance: 'live_candidate',
        durationMs: 0,
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      inactive: {
        attempted: false,
        degraded: true,
        disposition: 'not_eligible',
        provenance: 'local_deterministic',
        durationMs: 0,
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    }));

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OBSERVATION_INVALID');
    expect(fixture.ledger.recordSlotResult).not.toHaveBeenCalled();
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
  });

  it('passes raw component capability only to API and the exact continued route', async () => {
    const fixture = createFixture();

    await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect(fixture.apiCapabilitySha256).toEqual([
      sha(reviewCapability),
      sha(plannerCapability),
    ]);
    expect(
      () =>
        fixture.dependencies.dispatchApi.mock.calls[0][0].acceptanceCapability,
    ).toThrow('PRODUCT_ACCEPTANCE_CAPABILITY_UNAVAILABLE');
    expect(
      fixture.routes.continueWithAcceptanceCapability.mock.calls.map(
        ([capability]) => sha(capability),
      ),
    ).toEqual([sha(reviewCapability), sha(plannerCapability)]);
    expect(fixture.routes.continue).not.toHaveBeenCalled();
  });

  it('revokes the private capability lease after a failed run without leaking it', async () => {
    const fixture = createFixture();
    let captured:
      | Parameters<
          ReviewPlannerV8ProductAcceptanceRunnerDependencies['dispatchApi']
        >[0]
      | undefined;
    fixture.dependencies.dispatchApi = jest.fn(async (input) => {
      captured = input;
      expect(sha(input.acceptanceCapability)).toBe(sha(reviewCapability));
      throw new Error('raw dependency failure');
    });

    const failure = runReviewPlannerV8ProductAcceptance(fixture.input);
    await expect(failure).rejects.toThrow(
      'PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
    await expect(failure).rejects.not.toThrow(new RegExp(reviewCapability));
    expect(() => captured?.acceptanceCapability).toThrow(
      'PRODUCT_ACCEPTANCE_CAPABILITY_UNAVAILABLE',
    );
    expect(
      JSON.stringify(fixture.ledger.recordSlotResult.mock.calls),
    ).not.toContain(reviewCapability);
  });

  it('copies safe persisted trace details into ledger results and run summaries', async () => {
    const fixture = createFixture();

    const result = await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect(fixture.ledger.recordSlotResult.mock.calls[0][0]).toMatchObject({
      pricingKnown: false,
      costEstimateUsd: 0,
      steps: traceSteps('review'),
    });
    expect(result).toHaveProperty('traceSummaries');
  });

  it('reads every persisted trace field once into a canonical snapshot', async () => {
    const fixture = createFixture();
    const counts = new Map<string, number>();
    const source = trace('review', 'api');
    const hostileUsage = getterRecord(source.usage, 'usage', counts);
    const hostileSteps = source.steps.map((step, index) =>
      getterRecord(step, `step${index}`, counts),
    );
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      Object.defineProperty(hostile, key, {
        enumerable: true,
        get() {
          const count = (counts.get(key) ?? 0) + 1;
          counts.set(key, count);
          if (key === 'traceId' && count > 1) return 'changed-trace-id';
          if (key === 'usage') return hostileUsage;
          if (key === 'steps') return hostileSteps;
          return source[key as keyof typeof source];
        },
      });
    }
    fixture.dependencies.readPersistedTraces = jest.fn(
      async ({ component, slot }) =>
        component === 'review' && slot === 'api'
          ? [hostile as never]
          : [trace(component, slot)],
    );

    await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect(Object.fromEntries(counts)).toEqual(
      Object.fromEntries([
        ...Object.keys(source).map((key) => [key, 1]),
        ...Object.keys(source.usage).map((key) => [`usage.${key}`, 1]),
        ...source.steps.flatMap((step, index) =>
          Object.keys(step).map((key) => [`step${index}.${key}`, 1]),
        ),
      ]),
    );
  });

  it('deep-freezes canonical trace evidence against delayed and post-run mutation', async () => {
    const fixture = createFixture();
    const rawTrace = structuredClone(trace('review', 'api')) as MutableTrace;
    fixture.dependencies.readPersistedTraces = jest.fn(
      async ({ component, slot }) =>
        component === 'review' && slot === 'api'
          ? [rawTrace]
          : [trace(component, slot)],
    );
    const originalRestore = fixture.dependencies.restoreDefaultOff;
    fixture.dependencies.restoreDefaultOff = jest.fn(async (component) => {
      if (component === 'review') {
        rawTrace.traceId = 'mutated-during-await';
        rawTrace.usage.inputTokens = 999;
        rawTrace.steps[1].disposition = 'mutated';
      }
      return originalRestore(component);
    });

    const result = await runReviewPlannerV8ProductAcceptance(fixture.input);
    const ledgerRecord = fixture.ledger.recordSlotResult.mock.calls[0][0];
    expect(ledgerRecord).toMatchObject({
      traceIdSha256: sha('review-api-trace'),
      usage: { inputTokens: 100, outputTokens: 20 },
      steps: traceSteps('review'),
    });
    expect(result.traceSummaries[0]).toEqual(traceSummary('review', 'api'));

    const serialized = JSON.stringify(result);
    rawTrace.usage.inputTokens = 1_777;
    rawTrace.steps[1].provenance = 'mutated-again';
    expect(JSON.stringify(result)).toBe(serialized);
  });

  it('snapshots hostile metadata before any dependency or ledger method call', async () => {
    const fixture = createFixture();
    fixture.order.length = 0;
    const input = { ...fixture.input } as Record<string, unknown>;
    Object.defineProperty(input, 'commitSha', {
      enumerable: true,
      get() {
        throw new Error('raw capability=v8-secret token=jwt-secret');
      },
    });

    await expect(runReviewPlannerV8ProductAcceptance(input)).rejects.toThrow(
      'PRODUCT_ACCEPTANCE_INPUT_INVALID',
    );
    expect(fixture.order).toEqual([]);
    expect(fixture.dependencies.activateComponent).not.toHaveBeenCalled();
    expect(fixture.ledger.claimSlot).not.toHaveBeenCalled();
  });

  it.each([
    ['environment', 'staging'],
    ['commitSha', 'b'.repeat(39)],
    ['pairedEvidenceSha256', 'c'.repeat(63)],
    ['accountIdSha256', { review: 'd'.repeat(64), planner: 'd'.repeat(64) }],
    ['capabilities', { review: reviewCapability, planner: reviewCapability }],
    ['webOrigin', 'http://localhost:3000'],
    ['apiOrigin', 'http://localhost:3001'],
  ])(
    'rejects invalid snapshot field %s with zero side effects',
    async (key, value) => {
      const fixture = createFixture();
      fixture.order.length = 0;

      await expect(
        runReviewPlannerV8ProductAcceptance({
          ...fixture.input,
          [key]: value,
        }),
      ).rejects.toThrow('PRODUCT_ACCEPTANCE_INPUT_INVALID');
      expect(fixture.order).toEqual([]);
    },
  );

  it('folds a hostile dependency port getter without leaking it or calling the ledger', async () => {
    const fixture = createFixture();
    fixture.order.length = 0;
    const dependencies = new Proxy(fixture.dependencies, {
      get(target, property, receiver) {
        if (property === 'activateComponent') {
          throw new Error('raw provider key sk-secret capability-v8-secret');
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const promise = runReviewPlannerV8ProductAcceptance({
      ...fixture.input,
      dependencies,
    });
    await expect(promise).rejects.toThrow('PRODUCT_ACCEPTANCE_INPUT_INVALID');
    await expect(promise).rejects.not.toThrow(/sk-secret|capability-v8-secret/);
    expect(fixture.order).toEqual([]);
  });

  it('reads dependency and ledger methods exactly once before side effects', async () => {
    const fixture = createFixture();
    const dependencyReads = new Map<PropertyKey, number>();
    const ledgerReads = new Map<PropertyKey, number>();
    const dependencies = new Proxy(fixture.dependencies, {
      get(target, property, receiver) {
        dependencyReads.set(property, (dependencyReads.get(property) ?? 0) + 1);
        return Reflect.get(target, property, receiver);
      },
    });
    const ledger = new Proxy(fixture.ledger, {
      get(target, property, receiver) {
        ledgerReads.set(property, (ledgerReads.get(property) ?? 0) + 1);
        return Reflect.get(target, property, receiver);
      },
    });

    await runReviewPlannerV8ProductAcceptance({
      ...fixture.input,
      dependencies,
      ledger,
    });

    for (const method of [
      'activateComponent',
      'readFactsDigest',
      'dispatchApi',
      'runBrowser',
      'readPersistedTraces',
      'restoreDefaultOff',
      'verifyOwnerIsolation',
      'cleanup',
    ]) {
      expect(dependencyReads.get(method)).toBe(1);
    }
    for (const method of [
      'environment',
      'claimSlot',
      'recordSlotResult',
      'recordDefaultOff',
      'recordScreenshot',
      'recordOwnerIsolation',
      'recordCleanup',
      'finalizeSuccess',
    ]) {
      expect(ledgerReads.get(method)).toBe(1);
    }
  });

  it('rejects a duplicate raw trace id globally before writing the duplicate result', async () => {
    const fixture = createFixture();
    fixture.dependencies.readPersistedTraces = jest.fn(
      async ({ component, slot }) => [
        trace(component, slot, { traceId: 'duplicate-trace-id' }),
      ],
    );

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
    expect(fixture.ledger.recordSlotResult).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.ledger.recordCleanup).not.toHaveBeenCalled();
  });

  it.each([
    ['provider', { provider: 'openai' }],
    ['model', { model: 'deepseek-v4-flash' }],
    ['steps', { steps: traceSteps('planner') }],
    ['usage', { usage: { inputTokens: 999, outputTokens: 20 } }],
    ['duration', { durationMs: 999 }],
  ])('rejects persisted trace %s mismatches', async (_label, override) => {
    const fixture = createFixture();
    fixture.dependencies.readPersistedTraces = jest.fn(
      async ({ component, slot }) => [trace(component, slot, override)],
    );

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_TRACE_IDENTITY_INVALID');
    expect(fixture.ledger.recordSlotResult).not.toHaveBeenCalled();
  });

  it.each([
    'http://127.0.0.1:3001/review-agent/suggestions',
    'http://localhost:3001/review-agent/suggestions',
    'http://127.0.0.1:3002/review-agent/suggestions',
    'https://127.0.0.1:3001/review-agent/suggestions',
    'http://127.0.0.1:3001/review-agent/suggestions?x=1',
    'http://127.0.0.1:3001/review-agent/suggestions#x',
    'http://user:pass@127.0.0.1:3001/review-agent/suggestions',
    'http://127.0.0.1:3001/review-agent/suggestions/',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&days=8',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&extra=1',
    'http://127.0.0.1:3001/review-agent/suggestions?days=0',
    'http://127.0.0.1:3001/review-agent/suggestions?days=15',
    'http://127.0.0.1:3001/review-agent/suggestions?days=07',
    'http://127.0.0.1:3001/review-agent/suggestions?days=+7',
    'http://127.0.0.1:3001/review-agent/suggestions?days=-1',
    'http://127.0.0.1:3001/review-agent/suggestions?days=',
    'http://127.0.0.1:3001/review-agent/suggestions?days=1e1',
    'http://127.0.0.1:3001/review-agent/suggestions?days=%37',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&startDate=2026-02-30',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&startDate=',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-841',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=841',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=%2B480',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=0480',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=',
    'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-0',
  ])('aborts the non-exact browser API URL %s', async (url) => {
    const fixture = createFixture({ browserUrl: url });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID');
    expect(fixture.routes.continue).not.toHaveBeenCalled();
    expect(
      fixture.routes.continueWithAcceptanceCapability,
    ).not.toHaveBeenCalled();
    expect(fixture.routes.abort).toHaveBeenCalledTimes(1);
    expect(fixture.ledger.claimSlot).toHaveBeenCalledTimes(2);
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
  });

  it('accepts canonical query parameters in any order', async () => {
    const fixture = createFixture({
      browserUrl:
        'http://127.0.0.1:3001/review-agent/suggestions?timezoneOffsetMinutes=-480&days=7&startDate=2026-07-18',
    });

    await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect(
      fixture.routes.continueWithAcceptanceCapability,
    ).toHaveBeenCalledTimes(2);
  });

  it('rejects a non-GET suggestion request without exposing capability', async () => {
    const fixture = createFixture({ browserMethod: 'POST' });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID');
    expect(
      fixture.routes.continueWithAcceptanceCapability,
    ).not.toHaveBeenCalled();
    expect(fixture.routes.abort).toHaveBeenCalledTimes(1);
  });

  it('folds a hostile method getter without exposing capability or raw error', async () => {
    const fixture = createFixture();
    fixture.dependencies.runBrowser = jest.fn(async (input) => {
      await input.onRoute(fixture.routes, {
        url: () => canonicalSuggestionUrl,
        method: () => {
          throw new Error('raw method credential secret');
        },
      });
      return browserResult(input.component);
    });

    const failure = runReviewPlannerV8ProductAcceptance(fixture.input);
    await expect(failure).rejects.toThrow(
      'PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID',
    );
    await expect(failure).rejects.not.toThrow(/raw|credential|secret/i);
    expect(
      fixture.routes.continueWithAcceptanceCapability,
    ).not.toHaveBeenCalled();
    expect(fixture.routes.abort).toHaveBeenCalledTimes(1);
  });

  it('snapshots route url and method getters once before continuing', async () => {
    const fixture = createFixture();
    let urlReads = 0;
    let methodReads = 0;
    fixture.dependencies.runBrowser = jest.fn(async (input) => {
      await input.onRoute(fixture.routes, {
        url: () => {
          urlReads += 1;
          return urlReads <= 2
            ? canonicalSuggestionUrl
            : 'http://hostile.invalid';
        },
        method: () => {
          methodReads += 1;
          return methodReads <= 2 ? 'GET' : 'POST';
        },
      });
      return browserResult(input.component);
    });

    await runReviewPlannerV8ProductAcceptance(fixture.input);

    expect({ urlReads, methodReads }).toEqual({ urlReads: 2, methodReads: 2 });
  });

  it('detects and aborts a late second request after the browser adapter resolves', async () => {
    const fixture = createFixture();
    let routeCallback: ReviewPlannerV8ProductAcceptanceRunnerDependencies['runBrowser'] extends (
      input: infer T,
    ) => unknown
      ? T extends { onRoute: infer R }
        ? R
        : never
      : never;
    fixture.dependencies.runBrowser = jest.fn(async (input) => {
      routeCallback = input.onRoute;
      await input.onRoute(fixture.routes, exactRequest());
      return browserResult(input.component);
    });
    const originalRestore = fixture.dependencies.restoreDefaultOff;
    fixture.dependencies.restoreDefaultOff = jest.fn(async (component) => {
      await routeCallback(fixture.routes, exactRequest());
      return originalRestore(component);
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_ROUTE_REJECTED');
    expect(
      fixture.routes.continueWithAcceptanceCapability,
    ).toHaveBeenCalledTimes(1);
    expect(fixture.routes.continue).not.toHaveBeenCalled();
    expect(fixture.routes.abort).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['context open', { contextClosed: false }],
    ['callbacks pending', { routeCallbacksSettled: false }],
    ['pending callbacks', { noPendingCallbacks: false }],
    ['wrong continued count', { continuedRequests: 2 }],
    ['reported late abort', { abortedLateRequests: 1 }],
  ])('rejects browser receipt with %s', async (_label, override) => {
    const fixture = createFixture({ browserReceiptOverride: override });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID');
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['void', undefined],
    ['wrong component', defaultOffReceipt('planner')],
    [
      'non deterministic probe',
      {
        ...defaultOffReceipt('review'),
        deterministicProbe: { passed: false, provenance: 'live_candidate' },
      },
    ],
  ])(
    'rejects %s restore and retries only because no receipt was verified',
    async (_label, value) => {
      const fixture = createFixture();
      fixture.dependencies.restoreDefaultOff = jest.fn(async () => value);

      await expect(
        runReviewPlannerV8ProductAcceptance(fixture.input),
      ).rejects.toThrow('PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
      expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(2);
      expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
      expect(fixture.ledger.recordDefaultOff).not.toHaveBeenCalled();
      expect(fixture.dependencies.readPersistedTraces).toHaveBeenCalledTimes(1);
    },
  );

  it('restores once on success and only once as a fail-safe after browser failure', async () => {
    const success = createFixture();
    await runReviewPlannerV8ProductAcceptance(success.input);
    expect(success.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(2);

    const failure = createFixture();
    failure.dependencies.runBrowser = jest.fn(async () => {
      throw new Error('raw browser token');
    });
    await expect(
      runReviewPlannerV8ProductAcceptance(failure.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
    expect(failure.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
    expect(failure.dependencies.activateComponent).toHaveBeenCalledTimes(1);
  });

  it('restores before browser trace, screenshot, result or facts-after', async () => {
    const fixture = createFixture();
    await runReviewPlannerV8ProductAcceptance(fixture.input);
    const restoreIndex = fixture.order.indexOf('restore:review');
    expect(restoreIndex).toBeLessThan(
      fixture.order.indexOf('trace:review-browser'),
    );
    expect(restoreIndex).toBeLessThan(
      fixture.order.indexOf('ledger-screenshot:review'),
    );
    expect(restoreIndex).toBeLessThan(
      fixture.order.indexOf('facts-after:review'),
    );
  });

  it.each([
    'activate',
    'facts-before',
    'api-claim',
    'api',
    'api-trace',
    'api-result',
    'browser',
    'restore',
    'browser-trace',
    'facts-after',
    'owner-isolation',
    'owner-record',
    'cleanup',
    'cleanup-record',
    'evidence-finalize',
  ])('stops without a second dispatch after %s failure', async (stage) => {
    const fixture = createFixture();
    injectFailure(fixture, stage);

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow(
      stage === 'restore' || stage === 'cleanup'
        ? 'PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED'
        : 'PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
    const dispatches = fixture.dependencies.dispatchApi.mock.calls.length;
    if (
      ![
        'owner-isolation',
        'owner-record',
        'cleanup',
        'cleanup-record',
        'evidence-finalize',
      ].includes(stage)
    ) {
      expect(dispatches).toBeLessThanOrEqual(1);
    } else {
      expect(dispatches).toBe(2);
    }
    expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
    if (!['cleanup-record', 'evidence-finalize'].includes(stage)) {
      expect(fixture.ledger.recordCleanup).not.toHaveBeenCalled();
    }
    expect(fixture.ledger.finalizeSuccess).toHaveBeenCalledTimes(
      stage === 'evidence-finalize' ? 1 : 0,
    );
  });

  it('requires recovery when cleanup fails after an earlier primary failure', async () => {
    const fixture = createFixture();
    fixture.dependencies.activateComponent = jest.fn(async () => {
      throw new Error('raw primary secret');
    });
    fixture.dependencies.cleanup = jest.fn(async () => {
      throw new Error('raw cleanup secret');
    });

    const failure = runReviewPlannerV8ProductAcceptance(fixture.input);
    await expect(failure).rejects.toThrow(
      'PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED',
    );
    await expect(failure).rejects.not.toThrow(/raw|secret/i);
    expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.ledger.recordCleanup).not.toHaveBeenCalled();
    expect(fixture.ledger.finalizeSuccess).not.toHaveBeenCalled();
  });

  it('requires recovery when restore and the primary operation both fail', async () => {
    const fixture = createFixture();
    fixture.dependencies.runBrowser = jest.fn(async () => {
      throw new Error('raw browser secret');
    });
    fixture.dependencies.restoreDefaultOff = jest.fn(async () => {
      throw new Error('raw restore secret');
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
    expect(fixture.dependencies.cleanup).toHaveBeenCalledTimes(1);
    expect(fixture.ledger.recordCleanup).not.toHaveBeenCalled();
    expect(fixture.ledger.finalizeSuccess).not.toHaveBeenCalled();
  });

  it('ignores caller-authored provider/model fields and records only persisted identity', async () => {
    const fixture = createFixture();
    const result = await runReviewPlannerV8ProductAcceptance({
      ...fixture.input,
      provider: 'caller-forged-provider',
      model: 'caller-forged-model',
    });

    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-v4-pro');
    for (const [record] of fixture.ledger.recordSlotResult.mock.calls) {
      expect(record).toMatchObject({
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
      });
    }
  });
});

function createFixture(
  options: {
    browserUrl?: string;
    browserMethod?: string;
    browserReceiptOverride?: Record<string, unknown>;
  } = {},
) {
  const order: string[] = [];
  const apiCapabilitySha256: string[] = [];
  const routes = {
    continueWithAcceptanceCapability: jest.fn(async (capability: string) => {
      void capability;
    }),
    continue: jest.fn(async () => undefined),
    abort: jest.fn(async () => undefined),
  };
  const ledger = {
    environment: jest.fn(() => {
      order.push('ledger-environment');
      return 'branch' as const;
    }),
    writeManifest: jest.fn(),
    claimSlot: jest.fn((slot: string) => order.push(`ledger-claim:${slot}`)),
    recordSlotResult: jest.fn((value: { slot: string }) =>
      order.push(`ledger-result:${value.slot}`),
    ),
    recordDefaultOff: jest.fn((value: { component: string }) =>
      order.push(`ledger-restore:${value.component}`),
    ),
    recordScreenshot: jest.fn((component: string) =>
      order.push(`ledger-screenshot:${component}`),
    ),
    recordOwnerIsolation: jest.fn(() => order.push('ledger-owner-isolation')),
    recordCleanup: jest.fn(() => order.push('ledger-cleanup')),
    finalizeSuccess: jest.fn(() => order.push('ledger-finalize')),
    close: jest.fn(),
  };
  const dependencies = {
    activateComponent: jest.fn(async ({ component }) => {
      order.push(`activate:${component}`);
    }),
    readFactsDigest: jest.fn(async ({ component, phase }) => {
      order.push(`facts-${phase}:${component}`);
      return component === 'review' ? '3'.repeat(64) : '4'.repeat(64);
    }),
    captureTraceBaseline: jest.fn(async ({ component, slot }) => {
      order.push(`trace-baseline:${component}-${slot}`);
    }),
    dispatchApi: jest.fn(async (input) => {
      const { component } = input;
      apiCapabilitySha256.push(sha(input.acceptanceCapability));
      order.push(`api:${component}`);
      return requestResult(component, 'api');
    }),
    runBrowser: jest.fn(async (input) => {
      order.push(`browser-start:${input.component}`);
      await input.onRoute(
        {
          continueWithAcceptanceCapability: async (capability: string) => {
            order.push(`browser-continue:${input.component}`);
            await routes.continueWithAcceptanceCapability(capability);
          },
          continue: async () => {
            await routes.continue();
          },
          abort: routes.abort,
        },
        {
          url: () => options.browserUrl ?? canonicalSuggestionUrl,
          method: () => options.browserMethod ?? 'GET',
        },
      );
      order.push(`browser-end:${input.component}`);
      return browserResult(input.component, options.browserReceiptOverride);
    }),
    readPersistedTraces: jest.fn(async ({ component, slot }) => {
      order.push(`trace:${component}-${slot}`);
      return [trace(component, slot)];
    }),
    restoreDefaultOff: jest.fn(async (component) => {
      order.push(`restore:${component}`);
      return defaultOffReceipt(component);
    }),
    verifyOwnerIsolation: jest.fn(async () => {
      order.push('owner-isolation');
      return { crossAccountInvisible: true, businessWrites: 0 };
    }),
    cleanup: jest.fn(async () => {
      order.push('cleanup');
      return cleanupReceipt();
    }),
  } as unknown as MutableDependencies;
  const input = {
    environment: 'branch',
    commitSha: 'b'.repeat(40),
    pairedEvidenceSha256: 'c'.repeat(64),
    accountIdSha256: { review: 'd'.repeat(64), planner: 'e'.repeat(64) },
    capabilities: { review: reviewCapability, planner: plannerCapability },
    webOrigin: 'http://127.0.0.1:3000',
    apiOrigin: 'http://127.0.0.1:3001',
    ledger: ledger as unknown as ReviewPlannerV8ProductAcceptanceLedger,
    dependencies,
  };
  return {
    input,
    order,
    routes,
    ledger,
    dependencies,
    apiCapabilitySha256,
  };
}

function createV11RunnerLedgerFixture(
  options: Readonly<{ finalizeRejects?: boolean }> = {},
) {
  const order: string[] = [];
  const slotResults: Array<Record<string, unknown>> = [];
  const defaultOff: Array<Record<string, unknown>> = [];
  let ownerIsolation: Record<string, unknown> | undefined;
  let cleanup: Record<string, unknown> | undefined;
  let acceptance: Record<string, unknown> | undefined;
  let success: Record<string, unknown> | undefined;
  let failures = 0;

  const ledger = {
    writeExecutionManifest: jest.fn(async () => undefined),
    writeManifest: jest.fn(() => undefined),
    claimSlot: jest.fn((slot: string) => order.push(`claim:${slot}`)),
    recordSlotResult: jest.fn((value: Record<string, unknown>) => {
      slotResults.push(value);
      order.push(`slot:${String(value.slot)}`);
    }),
    recordDefaultOff: jest.fn((value: Record<string, unknown>) => {
      defaultOff.push(value);
      order.push(`default-off:${String(value.component)}`);
    }),
    recordOwnerIsolation: jest.fn((value: Record<string, unknown>) => {
      ownerIsolation = value;
      order.push('owner-isolation');
    }),
    recordCleanup: jest.fn((value: Record<string, unknown>) => {
      cleanup = value;
      order.push('cleanup');
    }),
    recordAcceptance: jest.fn((value: Record<string, unknown>) => {
      acceptance = value;
      order.push('acceptance');
    }),
    finalizeSuccess: jest.fn(async () => {
      if (options.finalizeRejects) {
        throw new Error('raw finalization secret');
      }
      success = {
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-success-v1',
      };
      order.push('success');
    }),
    recordFailure: jest.fn(() => undefined),
    close: jest.fn(),
  };

  return {
    ledger: ledger as never,
    order,
    slotResults,
    defaultOff,
    get ownerIsolation() {
      return ownerIsolation;
    },
    get cleanup() {
      return cleanup;
    },
    get acceptance() {
      return acceptance;
    },
    get success() {
      return success;
    },
    get failures() {
      return failures;
    },
    recordFailure() {
      failures += 1;
    },
  };
}

async function createLegacyProductAcceptanceRootSnapshot(
  options: Readonly<{
    onRootCreatedForTest?(root: string): void;
  }> = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v11-legacy-'));
  try {
    options.onRootCreatedForTest?.(root);
    const roots = [] as Array<
      Readonly<{
        directory: string;
        snapshot: readonly LegacyProductAcceptanceRootEntry[];
      }>
    >;
    for (const profile of [
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
    ]) {
      const directory = join(root, ...profile.publicLedgerSegments('branch'));
      const leaf = join(directory, 'legacy-sentinel.json');
      const contents = `${profile.schemas.manifest}\n`;
      await mkdir(directory, { recursive: true });
      await writeFile(leaf, contents, 'utf8');
      roots.push(
        Object.freeze({
          directory,
          snapshot: await snapshotLegacyProductAcceptanceRoot(directory),
        }),
      );
    }
    return Object.freeze({
      root,
      async expectUnchanged() {
        try {
          const current = await Promise.all(
            roots.map(({ directory }) =>
              snapshotLegacyProductAcceptanceRoot(directory),
            ),
          );
          if (
            JSON.stringify(current) !==
            JSON.stringify(roots.map(({ snapshot }) => snapshot))
          ) {
            throw new Error('V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED');
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED'
          ) {
            throw error;
          }
          throw new Error('V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED');
        }
      },
      async dispose() {
        await rm(root, { recursive: true, force: true });
      },
    });
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

type LegacyProductAcceptanceRootEntry = Readonly<
  | { path: string; type: 'directory' }
  | { path: string; type: 'file'; sha256: string }
>;

async function snapshotLegacyProductAcceptanceRoot(
  directory: string,
  relativePath = '',
): Promise<readonly LegacyProductAcceptanceRootEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const snapshots = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const nextRelative = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;
        const absolute = join(directory, entry.name);
        const metadata = await lstat(absolute);
        if (entry.isSymbolicLink() || metadata.isSymbolicLink()) {
          throw new Error('V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED');
        }
        if (entry.isDirectory() && metadata.isDirectory()) {
          return [
            Object.freeze({
              path: nextRelative,
              type: 'directory' as const,
            }),
            ...(await snapshotLegacyProductAcceptanceRoot(
              absolute,
              nextRelative,
            )),
          ];
        }
        if (entry.isFile() && metadata.isFile()) {
          return [
            Object.freeze({
              path: nextRelative,
              type: 'file' as const,
              sha256: sha(await readFile(absolute)),
            }),
          ];
        }
        throw new Error('V11_PRODUCT_ACCEPTANCE_LEGACY_ROOT_CHANGED');
      }),
  );
  return Object.freeze(snapshots.flat());
}

function v11RunnerManifest() {
  return {
    schemaVersion: 'phase-6.9.5-v11-product-acceptance-manifest-v1',
    environment: 'branch' as const,
    attemptSha256: 'a'.repeat(64),
    commitSha: 'b'.repeat(40),
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro' as const,
    accountSha256: { review: 'c'.repeat(64), planner: 'd'.repeat(64) },
    fixtureSha256: { review: 'e'.repeat(64), planner: 'f'.repeat(64) },
  };
}

type MutableDependencies = {
  -readonly [Key in keyof ReviewPlannerV8ProductAcceptanceRunnerDependencies]: jest.MockedFunction<
    ReviewPlannerV8ProductAcceptanceRunnerDependencies[Key]
  >;
};

function createCleanupOnlyPrisma() {
  const transaction = {
    agentTraceRun: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    user: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  };
  return {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    ),
    $disconnect: jest.fn(async () => undefined),
    agentTraceRun: { count: jest.fn(async () => 0) },
    user: { count: jest.fn(async () => 0) },
    wrongQuestion: { count: jest.fn(async () => 0) },
  };
}

function requestResult(
  component: 'review' | 'planner',
  slot: 'api' | 'browser',
) {
  const usage =
    slot === 'api'
      ? { inputTokens: 100, outputTokens: 20 }
      : { inputTokens: 110, outputTokens: 21 };
  const durationMs = slot === 'api' ? 1000 : 1100;
  return {
    target: {
      attempted: true,
      degraded: false,
      disposition: 'candidate_applied',
      provenance: 'live_candidate',
      durationMs,
      usage,
    },
    inactive: {
      attempted: false,
      degraded: true,
      disposition: 'not_eligible',
      provenance: 'local_deterministic',
      durationMs: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
    },
    component,
  };
}

function browserResult(
  component: 'review' | 'planner',
  receiptOverride: Record<string, unknown> = {},
) {
  return {
    ...requestResult(component, 'browser'),
    screenshot: validPngScreenshot(),
    receipt: {
      headed: true,
      contextClosed: true,
      routeCallbacksSettled: true,
      continuedRequests: 1,
      abortedLateRequests: 0,
      noPendingCallbacks: true,
      ...receiptOverride,
    },
  };
}

function trace(
  component: 'review' | 'planner',
  slot: 'api' | 'browser',
  override: Partial<ReviewPlannerV8ProductAcceptancePersistedTrace> = {},
): ReviewPlannerV8ProductAcceptancePersistedTrace {
  const result = requestResult(component, slot);
  return {
    traceId: `${component}-${slot}-trace`,
    component,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    pricingKnown: false,
    costEstimateUsd: 0,
    steps: traceSteps(component),
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
    durationMs: result.target.durationMs,
    usage: result.target.usage,
    ...override,
  };
}

function traceSummary(
  component: 'review' | 'planner',
  slot: 'api' | 'browser',
) {
  const { traceId, ...safeTrace } = trace(component, slot);
  return {
    ...safeTrace,
    slot,
    traceIdSha256: sha(traceId),
  };
}

function getterRecord(
  source: Readonly<Record<string, unknown>>,
  prefix: string,
  counts: Map<string, number>,
) {
  const record = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    Object.defineProperty(record, key, {
      enumerable: true,
      get() {
        const counter = `${prefix}.${key}`;
        counts.set(counter, (counts.get(counter) ?? 0) + 1);
        return source[key];
      },
    });
  }
  return record;
}

function traceSteps(component: 'review' | 'planner') {
  return [
    localStep('deterministic_review'),
    component === 'review'
      ? liveStep('review_candidate')
      : localStep('review_candidate'),
    localStep('deterministic_planner'),
    component === 'planner'
      ? liveStep('planner_candidate')
      : localStep('planner_candidate'),
  ] as const;
}

function localStep(
  name:
    | 'deterministic_review'
    | 'review_candidate'
    | 'deterministic_planner'
    | 'planner_candidate',
) {
  return {
    name,
    attempted: false,
    disposition: 'not_eligible',
    provenance: 'local_deterministic',
  } as const;
}

function liveStep(name: 'review_candidate' | 'planner_candidate') {
  return {
    name,
    attempted: true,
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
  } as const;
}

function defaultOffReceipt(component: 'review' | 'planner') {
  const previous = sha(`${component}-previous`);
  const next = sha(`${component}-next`);
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2',
    component,
    container: { previousIdSha256: previous, newIdSha256: next },
    inspected: {
      aiProviderMode: 'mock',
      liveCallsEnabled: false,
      reviewAgentModelEnabled: false,
      plannerAgentModelEnabled: false,
      acceptanceEnabled: false,
      acceptanceComponent: '',
      capabilitySha256: '',
      maxRequests: 0,
      deepseekCredentialPresent: false,
      openaiCredentialPresent: false,
    },
    binding: { port: 3001, healthContainerIdSha256: next },
    deterministicProbe: { passed: true, provenance: 'local_deterministic' },
    providerInvocations: 0,
  };
}

function cleanupReceipt() {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-cleanup-v1' as const,
    syntheticAccounts: 0 as const,
    fixtures: 0 as const,
    traces: 0 as const,
    browserProfiles: 0 as const,
    capabilities: 0 as const,
  };
}

function validPngScreenshot() {
  return new Uint8Array(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
}

function exactRequest() {
  return { url: () => canonicalSuggestionUrl, method: () => 'GET' };
}

function injectFailure(
  fixture: ReturnType<typeof createFixture>,
  stage: string,
) {
  const boom = () => {
    throw new Error(`raw-${stage}-secret`);
  };
  if (stage === 'activate')
    fixture.dependencies.activateComponent = jest.fn(boom);
  if (stage === 'facts-before')
    fixture.dependencies.readFactsDigest = jest.fn(boom);
  if (stage === 'api-claim') fixture.ledger.claimSlot.mockImplementation(boom);
  if (stage === 'api') fixture.dependencies.dispatchApi = jest.fn(boom);
  if (stage === 'api-trace')
    fixture.dependencies.readPersistedTraces = jest.fn(boom);
  if (stage === 'api-result')
    fixture.ledger.recordSlotResult.mockImplementation(boom);
  if (stage === 'browser') fixture.dependencies.runBrowser = jest.fn(boom);
  if (stage === 'restore')
    fixture.dependencies.restoreDefaultOff = jest.fn(boom);
  if (stage === 'browser-trace') {
    fixture.dependencies.readPersistedTraces = jest.fn(
      async ({ component, slot }) => {
        if (slot === 'browser') boom();
        return [trace(component, slot)];
      },
    );
  }
  if (stage === 'facts-after') {
    fixture.dependencies.readFactsDigest = jest.fn(
      async ({ component, phase }) => {
        if (phase === 'after') boom();
        return component === 'review' ? '3'.repeat(64) : '4'.repeat(64);
      },
    );
  }
  if (stage === 'owner-isolation')
    fixture.dependencies.verifyOwnerIsolation = jest.fn(boom);
  if (stage === 'owner-record')
    fixture.ledger.recordOwnerIsolation.mockImplementation(boom);
  if (stage === 'cleanup') fixture.dependencies.cleanup = jest.fn(boom);
  if (stage === 'cleanup-record')
    fixture.ledger.recordCleanup.mockImplementation(boom);
  if (stage === 'evidence-finalize')
    fixture.ledger.finalizeSuccess.mockImplementation(boom);
}
