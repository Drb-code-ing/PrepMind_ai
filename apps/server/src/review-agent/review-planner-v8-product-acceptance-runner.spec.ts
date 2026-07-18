/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { createHash } from 'node:crypto';

import {
  createReviewPlannerV8ProductAcceptanceRunnerControl,
  runReviewPlannerV8ProductAcceptance,
  type ReviewPlannerV8ProductAcceptanceRunnerDependencies,
} from './review-planner-v8-product-acceptance-runner';

const reviewCapability = 'review-capability-v8';
const plannerCapability = 'planner-capability-v8';
const sha = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

describe('Review Planner V8 product acceptance runner', () => {
  it('claims the four branch slots synchronously in exact order', () => {
    const control = createReviewPlannerV8ProductAcceptanceRunnerControl({
      environment: 'branch',
      capabilitySha256: {
        review: sha(reviewCapability),
        planner: sha(plannerCapability),
      },
    });

    expect(control.claim('planner', 'api', plannerCapability)).toBe(false);
    expect(control.claim('review', 'browser', reviewCapability)).toBe(false);
    expect(control.claim('review', 'api', 'wrong')).toBe(false);
    expect(control.claim('review', 'api', reviewCapability)).toBe(true);
    expect(control.claim('review', 'api', reviewCapability)).toBe(false);
    expect(control.claim('review', 'browser', reviewCapability)).toBe(true);
    expect(control.claim('review', 'browser', reviewCapability)).toBe(false);
    expect(control.claim('planner', 'api', plannerCapability)).toBe(true);
    expect(control.claim('planner', 'browser', plannerCapability)).toBe(true);
    expect(control.claim('planner', 'browser', plannerCapability)).toBe(false);
    expect(control.isComplete()).toBe(true);
  });

  it('runs API and browser claims before dispatch and derives identity from traces', async () => {
    const order: string[] = [];
    const { dependencies, evidenceWrites } =
      createSuccessfulDependencies(order);

    const result = await runReviewPlannerV8ProductAcceptance({
      environment: 'branch',
      commitSha: 'b'.repeat(40),
      pairedEvidenceSha256: 'c'.repeat(64),
      accountIdSha256: {
        review: 'd'.repeat(64),
        planner: 'e'.repeat(64),
      },
      capabilities: {
        review: reviewCapability,
        planner: plannerCapability,
      },
      dependencies,
    });

    expect(order).toEqual([
      'activate:review',
      'facts-before:review',
      'api:review',
      'browser:review',
      'trace:review',
      'facts-after:review',
      'restore:review',
      'activate:planner',
      'facts-before:planner',
      'api:planner',
      'browser:planner',
      'trace:planner',
      'facts-after:planner',
      'restore:planner',
      'owner-isolation',
      'cleanup',
      'write-evidence',
    ]);
    expect(result).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      totals: { requests: 4, inputTokens: 7000, outputTokens: 1400 },
      trace: { targetCandidateAttempts: 4 },
    });
    expect(evidenceWrites).toEqual([result]);
  });

  it('aborts a second suggestions route and fails the run without another dispatch', async () => {
    const { dependencies } = createSuccessfulDependencies([]);
    let continued = 0;
    let aborted = 0;
    dependencies.runBrowser = async (input) => {
      const request = {
        url: () => 'http://localhost:3001/review-agent/suggestions',
      };
      const route = {
        continue: () => {
          continued += 1;
        },
        abort: () => {
          aborted += 1;
        },
      };
      await input.onRoute(route, request);
      await input.onRoute(route, request);
      return browserResult(input.component);
    };

    await expect(
      runReviewPlannerV8ProductAcceptance(baseRunInput(dependencies)),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_BROWSER_ROUTE_REJECTED');
    expect(continued).toBe(1);
    expect(aborted).toBe(1);
    expect(dependencies.dispatchApi).toHaveBeenCalledTimes(1);
    expect(dependencies.readPersistedTraces).not.toHaveBeenCalled();
  });

  it.each([
    'activateComponent',
    'readFactsDigest',
    'dispatchApi',
    'runBrowser',
    'readPersistedTraces',
    'restoreDefaultOff',
    'verifyOwnerIsolation',
    'cleanup',
    'writeEvidence',
  ] as const)(
    'stops after a %s failure without issuing extra model dispatches',
    async (failure) => {
      const { dependencies } = createSuccessfulDependencies([]);
      const original = dependencies[failure];
      dependencies[failure] = jest.fn(async (...args: never[]) => {
        if (failure === 'dispatchApi' || failure === 'runBrowser') {
          const component = (args[0] as { component?: 'review' | 'planner' })
            ?.component;
          if (component === 'review') throw new Error(`injected-${failure}`);
        } else {
          throw new Error(`injected-${failure}`);
        }
        return (original as (...inner: never[]) => unknown)(...args);
      }) as never;

      await expect(
        runReviewPlannerV8ProductAcceptance(baseRunInput(dependencies)),
      ).rejects.toThrow();

      const dispatchCount = (dependencies.dispatchApi as jest.Mock).mock.calls
        .length;
      expect(dispatchCount).toBeLessThanOrEqual(2);
      if (failure === 'activateComponent' || failure === 'readFactsDigest') {
        expect(dispatchCount).toBe(0);
        expect(dependencies.restoreDefaultOff).toHaveBeenCalledWith('review');
      }
      if (
        failure === 'dispatchApi' ||
        failure === 'runBrowser' ||
        failure === 'readPersistedTraces' ||
        failure === 'restoreDefaultOff'
      ) {
        expect(dispatchCount).toBe(1);
      }
    },
  );

  it('rejects trace provider or model mismatches instead of trusting evidence input', async () => {
    const { dependencies, evidenceWrites } = createSuccessfulDependencies([]);
    dependencies.readPersistedTraces = jest.fn(async (component) => [
      traceResult(component, {
        modelName: 'deepseek-v4-flash',
        inputTokens: 1700,
        outputTokens: 350,
      }),
      traceResult(component, {
        modelName: 'deepseek-v4-flash',
        inputTokens: 1800,
        outputTokens: 350,
      }),
    ]);

    await expect(
      runReviewPlannerV8ProductAcceptance(baseRunInput(dependencies)),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_TRACE_IDENTITY_INVALID');
    expect(evidenceWrites).toHaveLength(0);
  });

  it('folds hostile dependency errors into a fixed safe code', async () => {
    const { dependencies } = createSuccessfulDependencies([]);
    dependencies.activateComponent = jest.fn(async () => {
      throw new Error(
        'raw provider response with capability=v8-secret and key=sk-secret',
      );
    });

    await expect(
      runReviewPlannerV8ProductAcceptance(baseRunInput(dependencies)),
    ).rejects.toThrow('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
    await expect(
      runReviewPlannerV8ProductAcceptance(baseRunInput(dependencies)),
    ).rejects.not.toThrow(/v8-secret|sk-secret|raw provider/i);
  });
});

function baseRunInput(
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies,
) {
  return {
    environment: 'branch' as const,
    commitSha: 'b'.repeat(40),
    pairedEvidenceSha256: 'c'.repeat(64),
    accountIdSha256: { review: 'd'.repeat(64), planner: 'e'.repeat(64) },
    capabilities: { review: reviewCapability, planner: plannerCapability },
    dependencies,
  };
}

function createSuccessfulDependencies(order: string[]) {
  const evidenceWrites: unknown[] = [];
  const dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies = {
    activateComponent: jest.fn(async ({ component }) => {
      order.push(`activate:${component}`);
    }),
    readFactsDigest: jest.fn(async ({ component, phase }) => {
      order.push(`facts-${phase}:${component}`);
      return `facts-${component}`;
    }),
    dispatchApi: jest.fn(async ({ component, assertClaimed }) => {
      assertClaimed();
      order.push(`api:${component}`);
      return apiResult(component);
    }),
    runBrowser: jest.fn(async (input) => {
      const route = {
        continue: jest.fn(async () => undefined),
        abort: jest.fn(async () => undefined),
      };
      await input.onRoute(route, {
        url: () => 'http://localhost:3001/review-agent/suggestions',
      });
      expect(route.continue).toHaveBeenCalledTimes(1);
      expect(route.abort).not.toHaveBeenCalled();
      order.push(`browser:${input.component}`);
      return browserResult(input.component);
    }),
    readPersistedTraces: jest.fn(async (component) => {
      order.push(`trace:${component}`);
      return [
        traceResult(component, { inputTokens: 1700, outputTokens: 350 }),
        traceResult(component, { inputTokens: 1800, outputTokens: 350 }),
      ];
    }),
    restoreDefaultOff: jest.fn(async (component) => {
      order.push(`restore:${component}`);
    }),
    verifyOwnerIsolation: jest.fn(async () => {
      order.push('owner-isolation');
      return true;
    }),
    cleanup: jest.fn(async () => {
      order.push('cleanup');
      return true;
    }),
    writeEvidence: jest.fn(async (evidence) => {
      order.push('write-evidence');
      evidenceWrites.push(evidence);
    }),
  };
  return { dependencies, evidenceWrites };
}

function apiResult(component: 'review' | 'planner') {
  return componentResult(component, 1700, 350);
}

function browserResult(component: 'review' | 'planner') {
  return {
    ...componentResult(component, 1800, 350),
    screenshotSha256: component === 'review' ? '1'.repeat(64) : '2'.repeat(64),
  };
}

function componentResult(
  component: 'review' | 'planner',
  inputTokens: number,
  outputTokens: number,
) {
  const live = {
    attempted: true,
    degraded: false,
    disposition: 'candidate_applied' as const,
    provenance: 'live_candidate' as const,
    durationMs: 3000,
    usage: { inputTokens, outputTokens },
  };
  const deterministic = {
    attempted: false,
    degraded: true,
    disposition: 'not_eligible' as const,
    provenance: 'local_deterministic' as const,
    durationMs: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
  return component === 'review'
    ? { target: live, inactive: deterministic }
    : { target: live, inactive: deterministic };
}

function traceResult(
  component: 'review' | 'planner',
  override: Partial<{
    modelProvider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
  }> = {},
) {
  return {
    component,
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-pro',
    pricingKnown: false,
    costEstimateUsd: 0,
    steps: [
      'deterministic_review',
      'review_candidate',
      'deterministic_planner',
      'planner_candidate',
    ] as const,
    candidateDisposition: 'candidate_applied' as const,
    inputTokens: 1700,
    outputTokens: 350,
    ...override,
  };
}
