import { createHash, timingSafeEqual } from 'node:crypto';

import type { ReviewPlannerV8ProductAcceptanceEvidence } from './review-planner-v8-product-acceptance-evidence';
import {
  calculateReviewPlannerV8ProductAcceptanceCost,
  reviewPlannerV8ProductAcceptanceEvidenceSchema,
} from './review-planner-v8-product-acceptance-evidence';

type Component = 'review' | 'planner';
type Slot = 'api' | 'browser';
type Environment = 'branch' | 'main';

const EXACT_PROVIDER = 'deepseek';
const EXACT_MODEL = 'deepseek-v4-pro';
const EXACT_STEPS = [
  'deterministic_review',
  'review_candidate',
  'deterministic_planner',
  'planner_candidate',
] as const;
const SLOT_ORDER = [
  ['review', 'api'],
  ['review', 'browser'],
  ['planner', 'api'],
  ['planner', 'browser'],
] as const satisfies readonly (readonly [Component, Slot])[];
const SHA256 = /^[a-f0-9]{64}$/;

class ProductAcceptanceControlError extends Error {}

export type ReviewPlannerV8ProductAcceptanceRunnerControl = Readonly<{
  claim(component: Component, slot: Slot, rawCapability: unknown): boolean;
  isComplete(): boolean;
}>;

export type ReviewPlannerV8ProductAcceptanceObservation = Readonly<{
  attempted: boolean;
  degraded: boolean;
  disposition: string;
  provenance: string;
  durationMs: number;
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
}>;

export type ReviewPlannerV8ProductAcceptanceRequestResult = Readonly<{
  target: ReviewPlannerV8ProductAcceptanceObservation;
  inactive: ReviewPlannerV8ProductAcceptanceObservation;
}>;

export type ReviewPlannerV8ProductAcceptanceBrowserResult =
  ReviewPlannerV8ProductAcceptanceRequestResult &
    Readonly<{ screenshotSha256: string }>;

export type ReviewPlannerV8ProductAcceptancePersistedTrace = Readonly<{
  component: Component;
  modelProvider: string;
  modelName: string;
  pricingKnown: boolean;
  costEstimateUsd: number;
  steps: readonly string[];
  candidateDisposition: string;
  inputTokens: number;
  outputTokens: number;
}>;

export type ReviewPlannerV8ProductAcceptanceRoute = Readonly<{
  continue(): void | Promise<void>;
  abort(): void | Promise<void>;
}>;

export type ReviewPlannerV8ProductAcceptanceRequest = Readonly<{
  url(): string;
}>;

export interface ReviewPlannerV8ProductAcceptanceRunnerDependencies {
  activateComponent(input: {
    component: Component;
    capabilitySha256: string;
  }): Promise<void>;
  readFactsDigest(input: {
    component: Component;
    phase: 'before' | 'after';
  }): Promise<string>;
  dispatchApi(input: {
    component: Component;
    rawCapability: string;
    assertClaimed(): void;
  }): Promise<ReviewPlannerV8ProductAcceptanceRequestResult>;
  runBrowser(input: {
    component: Component;
    rawCapability: string;
    onRoute(
      route: ReviewPlannerV8ProductAcceptanceRoute,
      request: ReviewPlannerV8ProductAcceptanceRequest,
    ): Promise<void>;
  }): Promise<ReviewPlannerV8ProductAcceptanceBrowserResult>;
  readPersistedTraces(
    component: Component,
  ): Promise<readonly ReviewPlannerV8ProductAcceptancePersistedTrace[]>;
  restoreDefaultOff(component: Component): Promise<void>;
  verifyOwnerIsolation(): Promise<boolean>;
  cleanup(): Promise<boolean>;
  writeEvidence(
    evidence: ReviewPlannerV8ProductAcceptanceEvidence,
  ): Promise<void>;
}

export function createReviewPlannerV8ProductAcceptanceRunnerControl(input: {
  environment: Environment;
  capabilitySha256: Readonly<Record<Component, string>>;
}): ReviewPlannerV8ProductAcceptanceRunnerControl {
  if (
    (input.environment !== 'branch' && input.environment !== 'main') ||
    !SHA256.test(input.capabilitySha256.review) ||
    !SHA256.test(input.capabilitySha256.planner) ||
    input.capabilitySha256.review === input.capabilitySha256.planner
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_RUNNER_CONFIG_INVALID');
  }
  const expected = {
    review: Buffer.from(input.capabilitySha256.review, 'hex'),
    planner: Buffer.from(input.capabilitySha256.planner, 'hex'),
  };
  let cursor = 0;
  let claimInProgress = false;

  return Object.freeze({
    claim(component, slot, rawCapability): boolean {
      const next = SLOT_ORDER[cursor];
      if (
        claimInProgress ||
        !next ||
        next[0] !== component ||
        next[1] !== slot ||
        typeof rawCapability !== 'string' ||
        rawCapability.length === 0
      ) {
        return false;
      }
      claimInProgress = true;
      try {
        const actual = createHash('sha256')
          .update(rawCapability, 'utf8')
          .digest();
        if (!timingSafeEqual(expected[component], actual)) return false;
        cursor += 1;
        return true;
      } finally {
        claimInProgress = false;
      }
    },
    isComplete(): boolean {
      return cursor === SLOT_ORDER.length;
    },
  });
}

export async function runReviewPlannerV8ProductAcceptance(input: {
  environment: Environment;
  commitSha: string;
  pairedEvidenceSha256: string;
  accountIdSha256: Readonly<Record<Component, string>>;
  capabilities: Readonly<Record<Component, string>>;
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}): Promise<ReviewPlannerV8ProductAcceptanceEvidence> {
  const capabilitySha256 = {
    review: sha256(input.capabilities.review),
    planner: sha256(input.capabilities.planner),
  };
  const control = createReviewPlannerV8ProductAcceptanceRunnerControl({
    environment: input.environment,
    capabilitySha256,
  });
  const componentResults = {} as Record<
    Component,
    Awaited<ReturnType<typeof runComponent>>
  >;
  let ownerIsolation = false;
  let cleanup = false;
  let primaryError: unknown;

  try {
    componentResults.review = await runComponent({
      component: 'review',
      rawCapability: input.capabilities.review,
      capabilitySha256: capabilitySha256.review,
      control,
      dependencies: input.dependencies,
    });
    componentResults.planner = await runComponent({
      component: 'planner',
      rawCapability: input.capabilities.planner,
      capabilitySha256: capabilitySha256.planner,
      control,
      dependencies: input.dependencies,
    });
    ownerIsolation = await input.dependencies.verifyOwnerIsolation();
    if (!ownerIsolation) {
      throw controlError('PRODUCT_ACCEPTANCE_OWNER_ISOLATION_INVALID');
    }
  } catch (error) {
    primaryError = error;
  }

  try {
    cleanup = await input.dependencies.cleanup();
    if (!cleanup) throw controlError('PRODUCT_ACCEPTANCE_CLEANUP_INVALID');
  } catch (cleanupError) {
    if (primaryError === undefined) primaryError = cleanupError;
  }
  if (primaryError !== undefined) throw normalizeError(primaryError);
  if (!control.isComplete()) {
    throw controlError('PRODUCT_ACCEPTANCE_RUNNER_SLOTS_INCOMPLETE');
  }

  const review = componentResults.review;
  const planner = componentResults.planner;
  const inputTokens = review.usage.inputTokens + planner.usage.inputTokens;
  const outputTokens = review.usage.outputTokens + planner.usage.outputTokens;
  const cost = calculateReviewPlannerV8ProductAcceptanceCost(
    inputTokens,
    outputTokens,
  );
  const evidence = reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
    schemaVersion: 'phase-6.9.5-review-planner-v8-product-acceptance-v1',
    environment: input.environment,
    commitSha: input.commitSha,
    provider: review.identity.provider,
    model: review.identity.model,
    components: {
      review: toComponentEvidence('review', review),
      planner: toComponentEvidence('planner', planner),
    },
    trace: {
      status: 'persisted',
      steps: [...EXACT_STEPS],
      pricingKnown: false,
      costEstimateUsd: 0,
      targetCandidateAttempts: 4,
    },
    accountIdSha256: input.accountIdSha256,
    ownerIsolation,
    factsUnchanged: review.factsUnchanged && planner.factsUnchanged,
    gateRestored: review.gateRestored && planner.gateRestored,
    cleanup,
    totals: {
      requests: 4,
      inputTokens,
      outputTokens,
      costCny: cost.costCny,
    },
    pricing: {
      priceProfileId:
        'deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance',
      inputRateCnyPerMillion: 3,
      outputRateCnyPerMillion: 6,
      snapshotDate: '2026-07-18',
      source: 'user-provided-deepseek-official-price-screenshot',
      rounding: 'ROUND_HALF_UP_8DP',
      hardCapCny: '0.10000000',
    },
    pairedEvidenceSha256: input.pairedEvidenceSha256,
    planScreenshotSha256: review.screenshotSha256,
    todayScreenshotSha256: planner.screenshotSha256,
  });
  try {
    await input.dependencies.writeEvidence(evidence);
  } catch {
    throw controlError('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
  }
  return evidence;
}

async function runComponent(input: {
  component: Component;
  rawCapability: string;
  capabilitySha256: string;
  control: ReviewPlannerV8ProductAcceptanceRunnerControl;
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}) {
  let gateRestored = false;
  try {
    await input.dependencies.activateComponent({
      component: input.component,
      capabilitySha256: input.capabilitySha256,
    });
    const beforeFacts = await input.dependencies.readFactsDigest({
      component: input.component,
      phase: 'before',
    });
    claimOrThrow(input.control, input.component, 'api', input.rawCapability);
    let apiClaimObserved = false;
    const api = await input.dependencies.dispatchApi({
      component: input.component,
      rawCapability: input.rawCapability,
      assertClaimed: () => {
        apiClaimObserved = true;
        if (input.control.claim(input.component, 'api', input.rawCapability)) {
          throw controlError('PRODUCT_ACCEPTANCE_API_CLAIM_NOT_ATOMIC');
        }
      },
    });
    if (!apiClaimObserved) {
      throw controlError('PRODUCT_ACCEPTANCE_API_CLAIM_UNVERIFIED');
    }
    assertRequestResult(api);

    const browserGuard = createBrowserRouteGuard({
      component: input.component,
      rawCapability: input.rawCapability,
      control: input.control,
    });
    const browser = await input.dependencies.runBrowser({
      component: input.component,
      rawCapability: input.rawCapability,
      onRoute: browserGuard.onRoute,
    });
    browserGuard.assertComplete();
    assertRequestResult(browser);
    if (!SHA256.test(browser.screenshotSha256)) {
      throw controlError('PRODUCT_ACCEPTANCE_SCREENSHOT_SHA_INVALID');
    }

    const traces = await input.dependencies.readPersistedTraces(
      input.component,
    );
    const usage = sumRequestUsage(api, browser);
    assertPersistedTraces(input.component, traces, usage);
    const afterFacts = await input.dependencies.readFactsDigest({
      component: input.component,
      phase: 'after',
    });
    if (beforeFacts !== afterFacts) {
      throw controlError('PRODUCT_ACCEPTANCE_FACTS_CHANGED');
    }
    return {
      usage,
      durationMs: api.target.durationMs + browser.target.durationMs,
      screenshotSha256: browser.screenshotSha256,
      identity: { provider: EXACT_PROVIDER, model: EXACT_MODEL },
      factsUnchanged: true,
      get gateRestored() {
        return gateRestored;
      },
    };
  } finally {
    await input.dependencies.restoreDefaultOff(input.component);
    gateRestored = true;
  }
}

function createBrowserRouteGuard(input: {
  component: Component;
  rawCapability: string;
  control: ReviewPlannerV8ProductAcceptanceRunnerControl;
}) {
  let suggestionsRequests = 0;
  let rejected = false;
  return {
    onRoute: async (
      route: ReviewPlannerV8ProductAcceptanceRoute,
      request: ReviewPlannerV8ProductAcceptanceRequest,
    ) => {
      if (!isSuggestionsUrl(request.url()) || suggestionsRequests > 0) {
        rejected = true;
        await route.abort();
        return;
      }
      if (
        !input.control.claim(input.component, 'browser', input.rawCapability)
      ) {
        rejected = true;
        await route.abort();
        return;
      }
      suggestionsRequests += 1;
      await route.continue();
    },
    assertComplete: () => {
      if (rejected || suggestionsRequests !== 1) {
        throw controlError('PRODUCT_ACCEPTANCE_BROWSER_ROUTE_REJECTED');
      }
    },
  };
}

function assertRequestResult(
  result: ReviewPlannerV8ProductAcceptanceRequestResult,
): void {
  const target = result.target;
  const inactive = result.inactive;
  if (
    target.attempted !== true ||
    target.degraded !== false ||
    target.disposition !== 'candidate_applied' ||
    target.provenance !== 'live_candidate' ||
    !positiveUsage(target.usage) ||
    inactive.attempted !== false ||
    inactive.disposition !== 'not_eligible' ||
    inactive.provenance !== 'local_deterministic' ||
    inactive.usage.inputTokens !== 0 ||
    inactive.usage.outputTokens !== 0
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_OBSERVATION_INVALID');
  }
}

function assertPersistedTraces(
  component: Component,
  traces: readonly ReviewPlannerV8ProductAcceptancePersistedTrace[],
  usage: { inputTokens: number; outputTokens: number },
) {
  if (
    traces.length !== 2 ||
    traces.some(
      (trace) =>
        trace.component !== component ||
        trace.modelProvider !== EXACT_PROVIDER ||
        trace.modelName !== EXACT_MODEL ||
        trace.pricingKnown !== false ||
        trace.costEstimateUsd !== 0 ||
        trace.candidateDisposition !== 'candidate_applied' ||
        !arraysEqual(trace.steps, EXACT_STEPS) ||
        !positiveUsage(trace),
    )
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_IDENTITY_INVALID');
  }
  const traceUsage = traces.reduce(
    (total, trace) => ({
      inputTokens: total.inputTokens + trace.inputTokens,
      outputTokens: total.outputTokens + trace.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  if (
    traceUsage.inputTokens !== usage.inputTokens ||
    traceUsage.outputTokens !== usage.outputTokens
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_USAGE_INVALID');
  }
}

function toComponentEvidence(
  component: Component,
  result: Awaited<ReturnType<typeof runComponent>>,
) {
  return {
    component,
    observation: { attempted: true, degraded: false },
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
    durationMs: result.durationMs,
    usage: result.usage,
    requestCount: 2,
  };
}

function sumRequestUsage(
  api: ReviewPlannerV8ProductAcceptanceRequestResult,
  browser: ReviewPlannerV8ProductAcceptanceRequestResult,
) {
  return {
    inputTokens:
      api.target.usage.inputTokens + browser.target.usage.inputTokens,
    outputTokens:
      api.target.usage.outputTokens + browser.target.usage.outputTokens,
  };
}

function positiveUsage(value: { inputTokens: number; outputTokens: number }) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0
  );
}

function claimOrThrow(
  control: ReviewPlannerV8ProductAcceptanceRunnerControl,
  component: Component,
  slot: Slot,
  rawCapability: string,
) {
  if (!control.claim(component, slot, rawCapability)) {
    throw controlError('PRODUCT_ACCEPTANCE_RUNNER_CLAIM_REJECTED');
  }
}

function isSuggestionsUrl(value: string) {
  try {
    return new URL(value).pathname === '/review-agent/suggestions';
  } catch {
    return false;
  }
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeError(value: unknown): Error {
  return value instanceof ProductAcceptanceControlError
    ? value
    : controlError('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
}

function controlError(code: string) {
  return new ProductAcceptanceControlError(code);
}
