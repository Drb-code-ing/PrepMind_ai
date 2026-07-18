import { createHash } from 'node:crypto';

import type { ReviewPlannerV8ProductAcceptanceLedger } from './review-planner-v8-product-acceptance-ledger';
import {
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
  type ReviewPlannerV8ProductAcceptanceEnvironment,
} from './review-planner-v8-product-acceptance-recovery';

type Component = 'review' | 'planner';
type RequestSlot = 'api' | 'browser';
type LedgerSlot = `${Component}-${RequestSlot}`;
type RunnerLedgerPort = Readonly<
  Pick<
    ReviewPlannerV8ProductAcceptanceLedger,
    | 'environment'
    | 'claimSlot'
    | 'recordSlotResult'
    | 'recordDefaultOff'
    | 'recordScreenshot'
    | 'recordOwnerIsolation'
    | 'recordCleanup'
    | 'finalizeSuccess'
  >
>;

const COMPONENTS = ['review', 'planner'] as const;
const EXACT_PROVIDER = 'deepseek';
const EXACT_MODEL = 'deepseek-v4-pro';
const EXACT_WEB_ORIGIN = 'http://127.0.0.1:3000';
const EXACT_API_ORIGIN = 'http://127.0.0.1:3001';
const EXACT_STEPS = [
  'deterministic_review',
  'review_candidate',
  'deterministic_planner',
  'planner_candidate',
] as const;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;

class ProductAcceptanceControlError extends Error {}

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

export type ReviewPlannerV8ProductAcceptanceTraceStep = Readonly<{
  name: (typeof EXACT_STEPS)[number];
  attempted: boolean;
  disposition: string;
  provenance: string;
}>;

export type ReviewPlannerV8ProductAcceptancePersistedTrace = Readonly<{
  traceId: string;
  component: Component;
  provider: string;
  model: string;
  pricingKnown: boolean;
  costEstimateUsd: number;
  steps: readonly ReviewPlannerV8ProductAcceptanceTraceStep[];
  disposition: string;
  provenance: string;
  durationMs: number;
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
}>;

export type ReviewPlannerV8ProductAcceptanceBrowserReceipt = Readonly<{
  headed: true;
  contextClosed: true;
  routeCallbacksSettled: true;
  continuedRequests: 1;
  abortedLateRequests: 0;
  noPendingCallbacks: true;
}>;

export type ReviewPlannerV8ProductAcceptanceBrowserResult =
  ReviewPlannerV8ProductAcceptanceRequestResult &
    Readonly<{
      screenshot: Uint8Array;
      receipt: ReviewPlannerV8ProductAcceptanceBrowserReceipt;
    }>;

export type ReviewPlannerV8ProductAcceptanceRoute = Readonly<{
  continue(): void | Promise<void>;
  abort(): void | Promise<void>;
}>;

export type ReviewPlannerV8ProductAcceptanceRequest = Readonly<{
  url(): string;
}>;

type CleanupReceipt = Readonly<{
  schemaVersion: 'phase-6.9.5-v8-product-acceptance-cleanup-v1';
  syntheticAccounts: 0;
  fixtures: 0;
  traces: 0;
  browserProfiles: 0;
  capabilities: 0;
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
    capabilitySha256: string;
  }): Promise<ReviewPlannerV8ProductAcceptanceRequestResult>;
  runBrowser(input: {
    component: Component;
    webOrigin: typeof EXACT_WEB_ORIGIN;
    capabilitySha256: string;
    onRoute(
      route: ReviewPlannerV8ProductAcceptanceRoute,
      request: ReviewPlannerV8ProductAcceptanceRequest,
    ): Promise<void>;
  }): Promise<ReviewPlannerV8ProductAcceptanceBrowserResult>;
  readPersistedTraces(input: {
    component: Component;
    slot: RequestSlot;
  }): Promise<readonly ReviewPlannerV8ProductAcceptancePersistedTrace[]>;
  restoreDefaultOff(component: Component): Promise<unknown>;
  verifyOwnerIsolation(input: {
    accountIdSha256: Readonly<Record<Component, string>>;
    traceIdSha256: readonly string[];
  }): Promise<
    Readonly<{ crossAccountInvisible: boolean; businessWrites: number }>
  >;
  cleanup(): Promise<CleanupReceipt>;
}

export type ReviewPlannerV8ProductAcceptanceRunResult = Readonly<{
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  provider: string;
  model: string;
  traceIdSha256: readonly string[];
  screenshotSha256: Readonly<Record<Component, string>>;
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
  durationMs: number;
}>;

type SafeSnapshot = Readonly<{
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  commitSha: string;
  pairedEvidenceSha256: string;
  accountIdSha256: Readonly<Record<Component, string>>;
  capabilitySha256: Readonly<Record<Component, string>>;
  webOrigin: typeof EXACT_WEB_ORIGIN;
  apiOrigin: typeof EXACT_API_ORIGIN;
  ledger: RunnerLedgerPort;
  dependencies: ReviewPlannerV8ProductAcceptanceRunnerDependencies;
}>;

type ComponentResult = Readonly<{
  factsBeforeSha256: string;
  factsAfterSha256: string;
  traces: readonly ReviewPlannerV8ProductAcceptancePersistedTrace[];
  traceIdSha256: readonly string[];
  screenshotSha256: string;
}>;

export async function runReviewPlannerV8ProductAcceptance(
  input: unknown,
): Promise<ReviewPlannerV8ProductAcceptanceRunResult> {
  const snapshot = createSafeSnapshot(input);
  const traceIds = new Set<string>();
  const componentResults = {} as Record<Component, ComponentResult>;

  try {
    for (const component of COMPONENTS) {
      componentResults[component] = await runComponent({
        component,
        snapshot,
        traceIds,
      });
    }

    const allTraceIdSha256 = COMPONENTS.flatMap(
      (component) => componentResults[component].traceIdSha256,
    );
    const isolation = await snapshot.dependencies.verifyOwnerIsolation({
      accountIdSha256: snapshot.accountIdSha256,
      traceIdSha256: allTraceIdSha256,
    });
    if (
      !isExactRecord(isolation, ['crossAccountInvisible', 'businessWrites']) ||
      isolation.crossAccountInvisible !== true ||
      isolation.businessWrites !== 0
    ) {
      throw controlError('PRODUCT_ACCEPTANCE_OWNER_ISOLATION_INVALID');
    }
    snapshot.ledger.recordOwnerIsolation({
      schemaVersion: 'phase-6.9.5-v8-product-acceptance-owner-isolation-v1',
      reviewFactsBeforeSha256: componentResults.review.factsBeforeSha256,
      reviewFactsAfterSha256: componentResults.review.factsAfterSha256,
      plannerFactsBeforeSha256: componentResults.planner.factsBeforeSha256,
      plannerFactsAfterSha256: componentResults.planner.factsAfterSha256,
      traceIdSha256: allTraceIdSha256,
      crossAccountInvisible: true,
      businessWrites: 0,
    });

    const cleanup = await snapshot.dependencies.cleanup();
    assertCleanupReceipt(cleanup);
    snapshot.ledger.recordCleanup(cleanup);
    snapshot.ledger.finalizeSuccess();

    const traces = COMPONENTS.flatMap(
      (component) => componentResults[component].traces,
    );
    return Object.freeze({
      environment: snapshot.environment,
      provider: traces[0].provider,
      model: traces[0].model,
      traceIdSha256: Object.freeze([...allTraceIdSha256]),
      screenshotSha256: Object.freeze({
        review: componentResults.review.screenshotSha256,
        planner: componentResults.planner.screenshotSha256,
      }),
      usage: Object.freeze({
        inputTokens: traces.reduce(
          (total, trace) => total + trace.usage.inputTokens,
          0,
        ),
        outputTokens: traces.reduce(
          (total, trace) => total + trace.usage.outputTokens,
          0,
        ),
      }),
      durationMs: traces.reduce((total, trace) => total + trace.durationMs, 0),
    });
  } catch (error) {
    throw normalizeError(error);
  }
}

async function runComponent(input: {
  component: Component;
  snapshot: SafeSnapshot;
  traceIds: Set<string>;
}): Promise<ComponentResult> {
  const { component, snapshot } = input;
  let restoreVerified = false;
  let browserClaimed = false;
  let primaryError: unknown;
  let result: ComponentResult | undefined;

  try {
    await snapshot.dependencies.activateComponent({
      component,
      capabilitySha256: snapshot.capabilitySha256[component],
    });
    const factsBeforeSha256 = assertDigest(
      await snapshot.dependencies.readFactsDigest({
        component,
        phase: 'before',
      }),
    );

    snapshot.ledger.claimSlot(toLedgerSlot(component, 'api'));
    const api = await snapshot.dependencies.dispatchApi({
      component,
      capabilitySha256: snapshot.capabilitySha256[component],
    });
    assertRequestResult(api);
    const apiTrace = await readUniqueTrace({
      component,
      slot: 'api',
      response: api,
      snapshot,
      traceIds: input.traceIds,
    });
    const apiTraceIdSha256 = sha256(apiTrace.traceId);
    snapshot.ledger.recordSlotResult(
      toLedgerSlotResult(component, 'api', apiTrace, apiTraceIdSha256),
    );

    const browserGuard = createBrowserRouteGuard({
      expectedUrl: `${snapshot.apiOrigin}/review-agent/suggestions`,
      claim: () => {
        snapshot.ledger.claimSlot(toLedgerSlot(component, 'browser'));
        browserClaimed = true;
      },
    });
    const browser = await snapshot.dependencies.runBrowser({
      component,
      webOrigin: snapshot.webOrigin,
      capabilitySha256: snapshot.capabilitySha256[component],
      onRoute: browserGuard.onRoute,
    });
    browserGuard.closeAndAssert(browser.receipt);
    assertRequestResult(browser);
    if (
      !(browser.screenshot instanceof Uint8Array) ||
      browser.screenshot.length === 0
    ) {
      throw controlError('PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
    }

    const restoreReceipt = await restoreAndVerify(component, snapshot);
    restoreVerified = true;
    snapshot.ledger.recordDefaultOff(restoreReceipt);
    browserGuard.assertNoLateRequest();

    const browserTrace = await readUniqueTrace({
      component,
      slot: 'browser',
      response: browser,
      snapshot,
      traceIds: input.traceIds,
    });
    const browserTraceIdSha256 = sha256(browserTrace.traceId);
    const screenshotSha256 = sha256(browser.screenshot);
    snapshot.ledger.recordScreenshot(component, browser.screenshot);
    snapshot.ledger.recordSlotResult({
      ...toLedgerSlotResult(
        component,
        'browser',
        browserTrace,
        browserTraceIdSha256,
      ),
      screenshotSha256,
    });

    const factsAfterSha256 = assertDigest(
      await snapshot.dependencies.readFactsDigest({
        component,
        phase: 'after',
      }),
    );
    if (factsBeforeSha256 !== factsAfterSha256) {
      throw controlError('PRODUCT_ACCEPTANCE_FACTS_CHANGED');
    }
    result = Object.freeze({
      factsBeforeSha256,
      factsAfterSha256,
      traces: Object.freeze([apiTrace, browserTrace]),
      traceIdSha256: Object.freeze([apiTraceIdSha256, browserTraceIdSha256]),
      screenshotSha256,
    });
  } catch (error) {
    primaryError = error;
  } finally {
    if (!restoreVerified) {
      try {
        const receipt = await restoreAndVerify(component, snapshot);
        restoreVerified = true;
        if (browserClaimed) snapshot.ledger.recordDefaultOff(receipt);
      } catch (restoreError) {
        if (primaryError === undefined) primaryError = restoreError;
      }
    }
  }

  if (primaryError !== undefined) throw normalizeError(primaryError);
  if (!restoreVerified || result === undefined) {
    throw controlError('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
  }
  return result;
}

async function restoreAndVerify(component: Component, snapshot: SafeSnapshot) {
  const value = await snapshot.dependencies.restoreDefaultOff(component);
  const parsed =
    reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.component !== component) {
    throw controlError('PRODUCT_ACCEPTANCE_DEFAULT_OFF_INVALID');
  }
  return parsed.data;
}

async function readUniqueTrace(input: {
  component: Component;
  slot: RequestSlot;
  response: ReviewPlannerV8ProductAcceptanceRequestResult;
  snapshot: SafeSnapshot;
  traceIds: Set<string>;
}) {
  const traces: unknown = await input.snapshot.dependencies.readPersistedTraces(
    {
      component: input.component,
      slot: input.slot,
    },
  );
  if (!Array.isArray(traces) || traces.length !== 1) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_COUNT_INVALID');
  }
  const trace: unknown = (traces as unknown[])[0];
  if (!isPersistedTrace(input.component, trace, input.response)) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_IDENTITY_INVALID');
  }
  if (input.traceIds.has(trace.traceId)) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
  }
  input.traceIds.add(trace.traceId);
  return trace;
}

function isPersistedTrace(
  component: Component,
  value: unknown,
  response: ReviewPlannerV8ProductAcceptanceRequestResult,
): value is ReviewPlannerV8ProductAcceptancePersistedTrace {
  if (
    !isExactRecord(value, [
      'traceId',
      'component',
      'provider',
      'model',
      'pricingKnown',
      'costEstimateUsd',
      'steps',
      'disposition',
      'provenance',
      'durationMs',
      'usage',
    ]) ||
    typeof value.traceId !== 'string' ||
    value.traceId.length === 0 ||
    value.traceId.length > 256 ||
    value.component !== component ||
    value.provider !== EXACT_PROVIDER ||
    value.model !== EXACT_MODEL ||
    value.pricingKnown !== false ||
    value.costEstimateUsd !== 0 ||
    value.disposition !== 'candidate_applied' ||
    value.provenance !== 'live_candidate' ||
    typeof value.durationMs !== 'number' ||
    !Number.isSafeInteger(value.durationMs) ||
    value.durationMs <= 0 ||
    !isUsage(value.usage) ||
    value.durationMs !== response.target.durationMs ||
    value.usage.inputTokens !== response.target.usage.inputTokens ||
    value.usage.outputTokens !== response.target.usage.outputTokens ||
    !validTraceSteps(component, value.steps)
  ) {
    return false;
  }
  return true;
}

function validTraceSteps(component: Component, value: unknown) {
  if (!Array.isArray(value) || value.length !== EXACT_STEPS.length) {
    return false;
  }
  const steps = value as unknown[];
  const targetCandidate = component === 'review' ? 1 : 3;
  return steps.every((step, index) => {
    if (
      !isExactRecord(step, [
        'name',
        'attempted',
        'disposition',
        'provenance',
      ]) ||
      step.name !== EXACT_STEPS[index]
    )
      return false;
    if (index === targetCandidate) {
      return (
        step.attempted === true &&
        step.disposition === 'candidate_applied' &&
        step.provenance === 'live_candidate'
      );
    }
    return (
      step.attempted === false &&
      step.disposition === 'not_eligible' &&
      step.provenance === 'local_deterministic'
    );
  });
}

function createBrowserRouteGuard(input: {
  expectedUrl: string;
  claim(): void;
}) {
  let continued = 0;
  let rejected = false;
  let closed = false;
  let lateRequest = false;
  return Object.freeze({
    onRoute: async (
      route: ReviewPlannerV8ProductAcceptanceRoute,
      request: ReviewPlannerV8ProductAcceptanceRequest,
    ) => {
      let url: unknown;
      try {
        url = request.url();
      } catch {
        rejected = true;
        await route.abort();
        return;
      }
      if (closed) {
        lateRequest = true;
        rejected = true;
        await route.abort();
        return;
      }
      if (continued !== 0 || !isExactUrl(url, input.expectedUrl)) {
        rejected = true;
        await route.abort();
        return;
      }
      input.claim();
      continued += 1;
      await route.continue();
    },
    closeAndAssert(receipt: unknown) {
      closed = true;
      if (rejected || continued !== 1 || !isBrowserReceipt(receipt)) {
        throw controlError('PRODUCT_ACCEPTANCE_BROWSER_RECEIPT_INVALID');
      }
    },
    assertNoLateRequest() {
      if (lateRequest || rejected || continued !== 1) {
        throw controlError('PRODUCT_ACCEPTANCE_BROWSER_ROUTE_REJECTED');
      }
    },
  });
}

function createSafeSnapshot(input: unknown): SafeSnapshot {
  try {
    if (!input || typeof input !== 'object') throw new Error();
    const source = input as Record<string, unknown>;
    const environment = source.environment;
    const commitSha = source.commitSha;
    const pairedEvidenceSha256 = source.pairedEvidenceSha256;
    const accountSource = source.accountIdSha256 as Record<string, unknown>;
    const capabilitySource = source.capabilities as Record<string, unknown>;
    const accountReview = accountSource?.review;
    const accountPlanner = accountSource?.planner;
    const capabilityReview = capabilitySource?.review;
    const capabilityPlanner = capabilitySource?.planner;
    const webOrigin = source.webOrigin;
    const apiOrigin = source.apiOrigin;

    if (
      (environment !== 'branch' && environment !== 'main') ||
      typeof commitSha !== 'string' ||
      !COMMIT_SHA.test(commitSha) ||
      typeof pairedEvidenceSha256 !== 'string' ||
      !SHA256.test(pairedEvidenceSha256) ||
      typeof accountReview !== 'string' ||
      typeof accountPlanner !== 'string' ||
      !SHA256.test(accountReview) ||
      !SHA256.test(accountPlanner) ||
      accountReview === accountPlanner ||
      typeof capabilityReview !== 'string' ||
      typeof capabilityPlanner !== 'string' ||
      capabilityReview.length === 0 ||
      capabilityPlanner.length === 0 ||
      capabilityReview === capabilityPlanner ||
      webOrigin !== EXACT_WEB_ORIGIN ||
      apiOrigin !== EXACT_API_ORIGIN
    ) {
      throw new Error();
    }
    const capabilitySha256 = Object.freeze({
      review: sha256(capabilityReview),
      planner: sha256(capabilityPlanner),
    });

    const ledger = snapshotLedgerPort(source.ledger);
    const dependencies = snapshotDependencyPort(source.dependencies);
    if (ledger.environment() !== environment) throw new Error();

    return Object.freeze({
      environment,
      commitSha,
      pairedEvidenceSha256,
      accountIdSha256: Object.freeze({
        review: accountReview,
        planner: accountPlanner,
      }),
      capabilitySha256,
      webOrigin,
      apiOrigin,
      ledger,
      dependencies,
    });
  } catch {
    throw controlError('PRODUCT_ACCEPTANCE_INPUT_INVALID');
  }
}

/* eslint-disable @typescript-eslint/unbound-method -- methods are read once, then invoked with their original receiver */
function snapshotLedgerPort(value: unknown): RunnerLedgerPort {
  if (!value || typeof value !== 'object') throw new Error();
  const source = value as ReviewPlannerV8ProductAcceptanceLedger;
  const environment = source.environment;
  const claimSlot = source.claimSlot;
  const recordSlotResult = source.recordSlotResult;
  const recordDefaultOff = source.recordDefaultOff;
  const recordScreenshot = source.recordScreenshot;
  const recordOwnerIsolation = source.recordOwnerIsolation;
  const recordCleanup = source.recordCleanup;
  const finalizeSuccess = source.finalizeSuccess;
  if (
    typeof environment !== 'function' ||
    typeof claimSlot !== 'function' ||
    typeof recordSlotResult !== 'function' ||
    typeof recordDefaultOff !== 'function' ||
    typeof recordScreenshot !== 'function' ||
    typeof recordOwnerIsolation !== 'function' ||
    typeof recordCleanup !== 'function' ||
    typeof finalizeSuccess !== 'function'
  ) {
    throw new Error();
  }
  return Object.freeze({
    environment: () => environment.call(source),
    claimSlot: (slot) => claimSlot.call(source, slot),
    recordSlotResult: (record) => recordSlotResult.call(source, record),
    recordDefaultOff: (record) => recordDefaultOff.call(source, record),
    recordScreenshot: (component, contents) =>
      recordScreenshot.call(source, component, contents),
    recordOwnerIsolation: (record) => recordOwnerIsolation.call(source, record),
    recordCleanup: (record) => recordCleanup.call(source, record),
    finalizeSuccess: () => finalizeSuccess.call(source),
  });
}

function snapshotDependencyPort(
  value: unknown,
): ReviewPlannerV8ProductAcceptanceRunnerDependencies {
  if (!value || typeof value !== 'object') throw new Error();
  const source = value as ReviewPlannerV8ProductAcceptanceRunnerDependencies;
  const activateComponent = source.activateComponent;
  const readFactsDigest = source.readFactsDigest;
  const dispatchApi = source.dispatchApi;
  const runBrowser = source.runBrowser;
  const readPersistedTraces = source.readPersistedTraces;
  const restoreDefaultOff = source.restoreDefaultOff;
  const verifyOwnerIsolation = source.verifyOwnerIsolation;
  const cleanup = source.cleanup;
  if (
    typeof activateComponent !== 'function' ||
    typeof readFactsDigest !== 'function' ||
    typeof dispatchApi !== 'function' ||
    typeof runBrowser !== 'function' ||
    typeof readPersistedTraces !== 'function' ||
    typeof restoreDefaultOff !== 'function' ||
    typeof verifyOwnerIsolation !== 'function' ||
    typeof cleanup !== 'function'
  ) {
    throw new Error();
  }
  const port: ReviewPlannerV8ProductAcceptanceRunnerDependencies = {
    activateComponent: (request) => activateComponent.call(source, request),
    readFactsDigest: (request) => readFactsDigest.call(source, request),
    dispatchApi: (request) => dispatchApi.call(source, request),
    runBrowser: (request) => runBrowser.call(source, request),
    readPersistedTraces: (request) => readPersistedTraces.call(source, request),
    restoreDefaultOff: (component) => restoreDefaultOff.call(source, component),
    verifyOwnerIsolation: (request) =>
      verifyOwnerIsolation.call(source, request),
    cleanup: () => cleanup.call(source),
  };
  return Object.freeze(port);
}
/* eslint-enable @typescript-eslint/unbound-method */

function assertRequestResult(
  result: ReviewPlannerV8ProductAcceptanceRequestResult,
): void {
  if (
    !result ||
    result.target?.attempted !== true ||
    result.target.degraded !== false ||
    result.target.disposition !== 'candidate_applied' ||
    result.target.provenance !== 'live_candidate' ||
    !Number.isSafeInteger(result.target.durationMs) ||
    result.target.durationMs <= 0 ||
    !positiveUsage(result.target.usage) ||
    result.inactive?.attempted !== false ||
    result.inactive.degraded !== true ||
    result.inactive.disposition !== 'not_eligible' ||
    result.inactive.provenance !== 'local_deterministic' ||
    result.inactive.durationMs !== 0 ||
    result.inactive.usage.inputTokens !== 0 ||
    result.inactive.usage.outputTokens !== 0
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_OBSERVATION_INVALID');
  }
}

function toLedgerSlot(component: Component, slot: RequestSlot): LedgerSlot {
  return `${component}-${slot}`;
}

function toLedgerSlotResult(
  component: Component,
  slot: RequestSlot,
  trace: ReviewPlannerV8ProductAcceptancePersistedTrace,
  traceIdSha256: string,
) {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-slot-result-v1',
    slot: toLedgerSlot(component, slot),
    provider: trace.provider,
    model: trace.model,
    usage: trace.usage,
    durationMs: trace.durationMs,
    disposition: trace.disposition,
    provenance: trace.provenance,
    traceIdSha256,
  };
}

function assertCleanupReceipt(value: CleanupReceipt) {
  if (
    !isExactRecord(value, [
      'schemaVersion',
      'syntheticAccounts',
      'fixtures',
      'traces',
      'browserProfiles',
      'capabilities',
    ]) ||
    value.schemaVersion !== 'phase-6.9.5-v8-product-acceptance-cleanup-v1' ||
    value.syntheticAccounts !== 0 ||
    value.fixtures !== 0 ||
    value.traces !== 0 ||
    value.browserProfiles !== 0 ||
    value.capabilities !== 0
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_CLEANUP_INVALID');
  }
}

function assertDigest(value: unknown): string {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    throw controlError('PRODUCT_ACCEPTANCE_FACTS_INVALID');
  }
  return value;
}

function isBrowserReceipt(
  value: unknown,
): value is ReviewPlannerV8ProductAcceptanceBrowserReceipt {
  return (
    isExactRecord(value, [
      'headed',
      'contextClosed',
      'routeCallbacksSettled',
      'continuedRequests',
      'abortedLateRequests',
      'noPendingCallbacks',
    ]) &&
    value.headed === true &&
    value.contextClosed === true &&
    value.routeCallbacksSettled === true &&
    value.continuedRequests === 1 &&
    value.abortedLateRequests === 0 &&
    value.noPendingCallbacks === true
  );
}

function isExactRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const actual = Object.keys(value);
    return (
      actual.length === keys.length && keys.every((key) => actual.includes(key))
    );
  } catch {
    return false;
  }
}

function isExactUrl(value: unknown, expected: string) {
  if (typeof value !== 'string') return false;
  try {
    const actual = new URL(value);
    const target = new URL(expected);
    return (
      actual.href === target.href &&
      actual.protocol === 'http:' &&
      actual.hostname === '127.0.0.1' &&
      actual.port === '3001' &&
      actual.pathname === '/review-agent/suggestions' &&
      actual.username === '' &&
      actual.password === '' &&
      actual.search === '' &&
      actual.hash === ''
    );
  } catch {
    return false;
  }
}

function positiveUsage(value: { inputTokens: number; outputTokens: number }) {
  return (
    Number.isSafeInteger(value?.inputTokens) &&
    value.inputTokens > 0 &&
    Number.isSafeInteger(value?.outputTokens) &&
    value.outputTokens > 0
  );
}

function isUsage(
  value: unknown,
): value is Readonly<{ inputTokens: number; outputTokens: number }> {
  return (
    isExactRecord(value, ['inputTokens', 'outputTokens']) &&
    typeof value.inputTokens === 'number' &&
    typeof value.outputTokens === 'number' &&
    positiveUsage(value as { inputTokens: number; outputTokens: number })
  );
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeError(value: unknown): Error {
  return value instanceof ProductAcceptanceControlError
    ? value
    : controlError('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
}

function controlError(code: string) {
  return new ProductAcceptanceControlError(code);
}
