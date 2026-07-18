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
type CapabilityHandle = Readonly<Record<never, never>>;
const capabilityVault = new WeakMap<
  CapabilityHandle,
  Readonly<Record<Component, string>>
>();

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
  continueWithAcceptanceCapability(
    acceptanceCapability: string,
  ): void | Promise<void>;
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
    acceptanceCapability: string;
  }): Promise<ReviewPlannerV8ProductAcceptanceRequestResult>;
  runBrowser(input: {
    component: Component;
    webOrigin: typeof EXACT_WEB_ORIGIN;
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
  traceSummaries: readonly ReviewPlannerV8ProductAcceptanceTraceSummary[];
}>;

export type ReviewPlannerV8ProductAcceptanceTraceSummary = Readonly<{
  component: Component;
  slot: RequestSlot;
  traceIdSha256: string;
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

type SafeSnapshot = Readonly<{
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  commitSha: string;
  pairedEvidenceSha256: string;
  accountIdSha256: Readonly<Record<Component, string>>;
  capabilitySha256: Readonly<Record<Component, string>>;
  capabilityHandle: CapabilityHandle;
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
  let primaryError: Error | undefined;
  let successCandidate: ReviewPlannerV8ProductAcceptanceRunResult | undefined;
  let cleanupReceipt: CleanupReceipt | undefined;
  let cleanupFailed = false;

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
    successCandidate = buildRunResult(
      snapshot.environment,
      componentResults,
      allTraceIdSha256,
    );
  } catch (error) {
    primaryError = normalizeError(error);
  }

  try {
    const cleanup = await snapshot.dependencies.cleanup();
    assertCleanupReceipt(cleanup);
    cleanupReceipt = cleanup;
  } catch {
    cleanupFailed = true;
  } finally {
    capabilityVault.delete(snapshot.capabilityHandle);
  }

  if (
    cleanupFailed ||
    primaryError?.message === 'PRODUCT_ACCEPTANCE_RESTORE_UNVERIFIED'
  ) {
    throw controlError('PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
  }
  if (primaryError) throw primaryError;
  if (!successCandidate || !cleanupReceipt) {
    throw controlError('PRODUCT_ACCEPTANCE_OPERATION_FAILED');
  }
  try {
    snapshot.ledger.recordCleanup(cleanupReceipt);
    snapshot.ledger.finalizeSuccess();
  } catch (error) {
    throw normalizeError(error);
  }
  return successCandidate;
}

function buildRunResult(
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  componentResults: Record<Component, ComponentResult>,
  allTraceIdSha256: readonly string[],
): ReviewPlannerV8ProductAcceptanceRunResult {
  const traces = COMPONENTS.flatMap(
    (component) => componentResults[component].traces,
  );
  const traceSummaries = COMPONENTS.flatMap((component) =>
    (['api', 'browser'] as const).map((slot, index) =>
      toTraceSummary(
        component,
        slot,
        componentResults[component].traces[index],
        componentResults[component].traceIdSha256[index],
      ),
    ),
  );
  return Object.freeze({
    environment,
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
    traceSummaries: Object.freeze(traceSummaries),
  });
}

async function runComponent(input: {
  component: Component;
  snapshot: SafeSnapshot;
  traceIds: Set<string>;
}): Promise<ComponentResult> {
  const { component, snapshot } = input;
  let restoreVerified = false;
  let restoreFailed = false;
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
    const api = await snapshot.dependencies.dispatchApi(
      createApiDispatchInput(snapshot, component),
    );
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

    snapshot.ledger.claimSlot(toLedgerSlot(component, 'browser'));
    browserClaimed = true;
    const browserGuard = createBrowserRouteGuard({
      expectedUrl: `${snapshot.apiOrigin}/review-agent/suggestions`,
      readAcceptanceCapability: () => readCapability(snapshot, component),
    });
    const browser = await snapshot.dependencies.runBrowser({
      component,
      webOrigin: snapshot.webOrigin,
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

    let restoreReceipt: Awaited<ReturnType<typeof restoreAndVerify>>;
    try {
      restoreReceipt = await restoreAndVerify(component, snapshot);
    } catch (error) {
      restoreFailed = true;
      throw error;
    }
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
        restoreFailed = true;
        if (primaryError === undefined) primaryError = restoreError;
      }
    }
  }

  if (restoreFailed) {
    throw controlError('PRODUCT_ACCEPTANCE_RESTORE_UNVERIFIED');
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
  const trace = canonicalizePersistedTrace(
    input.component,
    (traces as unknown[])[0],
    input.response,
  );
  if (!trace) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_IDENTITY_INVALID');
  }
  if (input.traceIds.has(trace.traceId)) {
    throw controlError('PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
  }
  input.traceIds.add(trace.traceId);
  return trace;
}

function canonicalizePersistedTrace(
  component: Component,
  value: unknown,
  response: ReviewPlannerV8ProductAcceptanceRequestResult,
): ReviewPlannerV8ProductAcceptancePersistedTrace | null {
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
    ])
  )
    return null;
  let traceId: unknown;
  let traceComponent: unknown;
  let provider: unknown;
  let model: unknown;
  let pricingKnown: unknown;
  let costEstimateUsd: unknown;
  let rawSteps: unknown;
  let disposition: unknown;
  let provenance: unknown;
  let durationMs: unknown;
  let rawUsage: unknown;
  try {
    traceId = value.traceId;
    traceComponent = value.component;
    provider = value.provider;
    model = value.model;
    pricingKnown = value.pricingKnown;
    costEstimateUsd = value.costEstimateUsd;
    rawSteps = value.steps;
    disposition = value.disposition;
    provenance = value.provenance;
    durationMs = value.durationMs;
    rawUsage = value.usage;
  } catch {
    return null;
  }
  const usage = canonicalizeUsage(rawUsage);
  const steps = canonicalizeTraceSteps(component, rawSteps);
  if (
    typeof traceId !== 'string' ||
    traceId.length === 0 ||
    traceId.length > 256 ||
    traceComponent !== component ||
    provider !== EXACT_PROVIDER ||
    model !== EXACT_MODEL ||
    pricingKnown !== false ||
    costEstimateUsd !== 0 ||
    disposition !== 'candidate_applied' ||
    provenance !== 'live_candidate' ||
    typeof durationMs !== 'number' ||
    !Number.isSafeInteger(durationMs) ||
    durationMs <= 0 ||
    !usage ||
    !steps ||
    durationMs !== response.target.durationMs ||
    usage.inputTokens !== response.target.usage.inputTokens ||
    usage.outputTokens !== response.target.usage.outputTokens
  )
    return null;
  return Object.freeze({
    traceId,
    component,
    provider,
    model,
    pricingKnown,
    costEstimateUsd,
    steps,
    disposition,
    provenance,
    durationMs,
    usage,
  });
}

function canonicalizeTraceSteps(
  component: Component,
  value: unknown,
): readonly ReviewPlannerV8ProductAcceptanceTraceStep[] | null {
  if (!Array.isArray(value) || value.length !== EXACT_STEPS.length) {
    return null;
  }
  const steps = value as unknown[];
  const targetCandidate = component === 'review' ? 1 : 3;
  const canonical: ReviewPlannerV8ProductAcceptanceTraceStep[] = [];
  for (const [index, step] of steps.entries()) {
    if (
      !isExactRecord(step, ['name', 'attempted', 'disposition', 'provenance'])
    )
      return null;
    let name: unknown;
    let attempted: unknown;
    let disposition: unknown;
    let provenance: unknown;
    try {
      name = step.name;
      attempted = step.attempted;
      disposition = step.disposition;
      provenance = step.provenance;
    } catch {
      return null;
    }
    const expectedName = EXACT_STEPS[index];
    if (!expectedName || name !== expectedName) return null;
    if (index === targetCandidate) {
      if (
        attempted !== true ||
        disposition !== 'candidate_applied' ||
        provenance !== 'live_candidate'
      )
        return null;
    } else if (
      attempted !== false ||
      disposition !== 'not_eligible' ||
      provenance !== 'local_deterministic'
    )
      return null;
    canonical.push(
      Object.freeze({
        name: expectedName,
        attempted,
        disposition,
        provenance,
      }),
    );
  }
  return Object.freeze(canonical);
}

function canonicalizeUsage(
  value: unknown,
): Readonly<{ inputTokens: number; outputTokens: number }> | null {
  if (!isExactRecord(value, ['inputTokens', 'outputTokens'])) return null;
  let inputTokens: unknown;
  let outputTokens: unknown;
  try {
    inputTokens = value.inputTokens;
    outputTokens = value.outputTokens;
  } catch {
    return null;
  }
  if (
    typeof inputTokens !== 'number' ||
    typeof outputTokens !== 'number' ||
    !Number.isSafeInteger(inputTokens) ||
    inputTokens <= 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens <= 0
  )
    return null;
  return Object.freeze({ inputTokens, outputTokens });
}

function createBrowserRouteGuard(input: {
  expectedUrl: string;
  readAcceptanceCapability(): string;
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
      continued += 1;
      await route.continueWithAcceptanceCapability(
        input.readAcceptanceCapability(),
      );
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
  let capabilityHandle: CapabilityHandle | undefined;
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

    capabilityHandle = Object.freeze({});
    capabilityVault.set(
      capabilityHandle,
      Object.freeze({ review: capabilityReview, planner: capabilityPlanner }),
    );
    const snapshot = {
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
    } as Omit<SafeSnapshot, 'capabilityHandle'> & {
      capabilityHandle?: CapabilityHandle;
    };
    Object.defineProperty(snapshot, 'capabilityHandle', {
      value: capabilityHandle,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return Object.freeze(snapshot) as SafeSnapshot;
  } catch {
    if (capabilityHandle) capabilityVault.delete(capabilityHandle);
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
    pricingKnown: trace.pricingKnown,
    costEstimateUsd: trace.costEstimateUsd,
    steps: trace.steps,
    disposition: trace.disposition,
    provenance: trace.provenance,
    traceIdSha256,
  };
}

function toTraceSummary(
  component: Component,
  slot: RequestSlot,
  trace: ReviewPlannerV8ProductAcceptancePersistedTrace,
  traceIdSha256: string,
): ReviewPlannerV8ProductAcceptanceTraceSummary {
  return Object.freeze({
    component,
    slot,
    traceIdSha256,
    provider: trace.provider,
    model: trace.model,
    pricingKnown: trace.pricingKnown,
    costEstimateUsd: trace.costEstimateUsd,
    steps: trace.steps,
    disposition: trace.disposition,
    provenance: trace.provenance,
    durationMs: trace.durationMs,
    usage: trace.usage,
  });
}

function readCapability(snapshot: SafeSnapshot, component: Component) {
  const capabilities = capabilityVault.get(snapshot.capabilityHandle);
  if (!capabilities) {
    throw controlError('PRODUCT_ACCEPTANCE_CAPABILITY_UNAVAILABLE');
  }
  return capabilities[component];
}

function createApiDispatchInput(snapshot: SafeSnapshot, component: Component) {
  const request = { component } as {
    component: Component;
    acceptanceCapability: string;
  };
  Object.defineProperty(request, 'acceptanceCapability', {
    enumerable: false,
    configurable: false,
    get: () => readCapability(snapshot, component),
  });
  return Object.freeze(request);
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
