/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { createHash } from 'node:crypto';

import type { ReviewPlannerV8ProductAcceptanceLedger } from './review-planner-v8-product-acceptance-ledger';
import {
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptancePersistedTrace,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
} from './review-planner-v8-product-acceptance-runner';

const reviewCapability = 'review-capability-v8';
const plannerCapability = 'planner-capability-v8';
const sha = (value: string | Uint8Array) =>
  createHash('sha256').update(value).digest('hex');

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
      'browser-start:review',
      'ledger-claim:review-browser',
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
      'browser-start:planner',
      'ledger-claim:planner-browser',
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
    expect(fixture.ledger.recordSlotResult).toHaveBeenCalledTimes(4);
    expect(fixture.ledger.finalizeSuccess).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify(fixture.ledger.recordSlotResult.mock.calls),
    ).not.toContain(reviewCapability);
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
    expect(fixture.dependencies.cleanup).not.toHaveBeenCalled();
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
    'http://localhost:3001/review-agent/suggestions',
    'http://127.0.0.1:3002/review-agent/suggestions',
    'https://127.0.0.1:3001/review-agent/suggestions',
    'http://127.0.0.1:3001/review-agent/suggestions?x=1',
    'http://127.0.0.1:3001/review-agent/suggestions#x',
    'http://user:pass@127.0.0.1:3001/review-agent/suggestions',
    'http://127.0.0.1:3001/review-agent/suggestions/',
  ])('aborts the non-exact browser API URL %s', async (url) => {
    const fixture = createFixture({ browserUrl: url });

    await expect(
      runReviewPlannerV8ProductAcceptance(fixture.input),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID');
    expect(fixture.routes.continue).not.toHaveBeenCalled();
    expect(fixture.routes.abort).toHaveBeenCalledTimes(1);
    expect(fixture.ledger.claimSlot).toHaveBeenCalledTimes(1);
    expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(1);
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
    expect(fixture.routes.continue).toHaveBeenCalledTimes(1);
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
      ).rejects.toThrow('PRODUCT_ACCEPTANCE_DEFAULT_OFF_INVALID');
      expect(fixture.dependencies.restoreDefaultOff).toHaveBeenCalledTimes(2);
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
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
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
      expect(fixture.dependencies.cleanup).not.toHaveBeenCalled();
    } else {
      expect(dispatches).toBe(2);
    }
    expect(fixture.ledger.finalizeSuccess).toHaveBeenCalledTimes(
      stage === 'evidence-finalize' ? 1 : 0,
    );
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
    browserReceiptOverride?: Record<string, unknown>;
  } = {},
) {
  const order: string[] = [];
  const routes = {
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
    dispatchApi: jest.fn(async ({ component }) => {
      order.push(`api:${component}`);
      return requestResult(component, 'api');
    }),
    runBrowser: jest.fn(async (input) => {
      order.push(`browser-start:${input.component}`);
      await input.onRoute(
        {
          continue: async () => {
            order.push(`browser-continue:${input.component}`);
            await routes.continue();
          },
          abort: routes.abort,
        },
        {
          url: () =>
            options.browserUrl ??
            'http://127.0.0.1:3001/review-agent/suggestions',
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
  return { input, order, routes, ledger, dependencies };
}

type MutableDependencies = {
  -readonly [Key in keyof ReviewPlannerV8ProductAcceptanceRunnerDependencies]: jest.MockedFunction<
    ReviewPlannerV8ProductAcceptanceRunnerDependencies[Key]
  >;
};

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
    screenshot: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1]),
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

function exactRequest() {
  return { url: () => 'http://127.0.0.1:3001/review-agent/suggestions' };
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
