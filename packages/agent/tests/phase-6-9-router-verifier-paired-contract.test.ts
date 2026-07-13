import { describe, expect, test } from 'bun:test';

import {
  PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
  phase6941RouterCases,
  phase6941VerifierCases,
} from '../src/evals/phase-6-9-router-verifier-cases.ts';
import {
  buildRouterEvalMetrics,
  buildVerifierEvalMetrics,
} from '../src/evals/phase-6-9-router-verifier-metrics.ts';
import {
  PHASE_6943_DATASET_DIGEST,
  PHASE_6943_PROMPT_VERSION,
  PHASE_6943_REPORT_SCHEMA_VERSION,
  PHASE_6943_RUNNER_VERSION,
  calculatePhase6943DatasetDigest,
  getPhase6943Dataset,
  nearestRank,
  parsePhase6943Output,
  validatePhase6943Dataset,
  type Phase6943Entry,
  type Phase6943DecisionReason,
  type Phase6943Output,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';

describe('Phase 6.9.4.3 paired contract', () => {
  test('freezes the full dataset digest and quotas', () => {
    expect(PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION).toBe('phase-6.9-router-verifier-v1');
    expect(calculatePhase6943DatasetDigest()).toBe(PHASE_6943_DATASET_DIGEST);
    expect(PHASE_6943_DATASET_DIGEST).toBe('sha256:b21def37330d2da109901ff9e927a612dc62cdecf1cb9383c3b8bea08c7bb019');
    expect(validatePhase6943Dataset()).toEqual({ ok: true });
    expect(phase6941RouterCases).toHaveLength(60);
    expect(phase6941VerifierCases).toHaveLength(40);
  });

  test('fails closed for dataset quota, eligibility, critical, ID and digest tampering', () => {
    const mutations: ((dataset: ReturnType<typeof getPhase6943Dataset>) => void)[] = [
      (dataset) => {
        (dataset as { datasetVersion: string }).datasetVersion = 'tampered';
      },
      (dataset) => {
        (dataset.cases[0] as { subset: string }).subset = 'ambiguous';
      },
      (dataset) => {
        (dataset.cases[0] as { candidateEligible: boolean }).candidateEligible = true;
      },
      (dataset) => {
        (dataset.cases[0] as { criticalSafetyCase: boolean }).criticalSafetyCase = true;
        (dataset.cases[0] as { candidateEligible: boolean }).candidateEligible = true;
      },
      (dataset) => {
        (dataset.cases[1] as { id: string }).id = dataset.cases[0]!.id;
      },
      (dataset) => {
        (dataset.cases[0] as { input: string }).input = 'DIGEST_TAMPER';
      },
    ];
    for (const mutate of mutations) {
      const dataset = structuredClone(getPhase6943Dataset());
      mutate(dataset);
      expect(validatePhase6943Dataset(dataset)).toEqual({
        ok: false,
        errorCode: 'dataset_mismatch',
      });
    }
  });

  test('accepts exactly five legal top-level variants', () => {
    const variants = [
      buildReport('mock', 'complete'),
      buildReport('mock', 'incomplete'),
      buildReport('live', 'complete'),
      buildReport('live', 'incomplete'),
      buildInvalidRun(),
    ];
    for (const variant of variants) expect(parsePhase6943Output(variant).ok).toBe(true);
  });

  test('rejects duplicate, missing, cross-lane and illegal numeric fields', () => {
    const duplicate = structuredClone(buildReport('mock', 'complete'));
    if (duplicate.kind !== 'report') throw new Error('expected report');
    duplicate.lanes.mock.entries[1] = duplicate.lanes.mock.entries[0]!;
    expect(parsePhase6943Output(duplicate).ok).toBe(false);

    const missing = structuredClone(buildReport('mock', 'complete'));
    if (missing.kind !== 'report') throw new Error('expected report');
    missing.lanes.mock.entries.pop();
    expect(parsePhase6943Output(missing).ok).toBe(false);

    const crossLane = structuredClone(buildReport('live', 'complete'));
    if (crossLane.kind !== 'report' || crossLane.runKind !== 'live') throw new Error('expected live report');
    crossLane.lanes.live.entries[0] = crossLane.lanes.mock.entries[0]!;
    expect(parsePhase6943Output(crossLane).ok).toBe(false);

    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const numeric = structuredClone(buildReport('mock', 'complete'));
      if (numeric.kind !== 'report') throw new Error('expected report');
      numeric.durationMs = invalid;
      expect(parsePhase6943Output(numeric).ok).toBe(false);
    }
  });

  test('rejects expected, permission, telemetry and counter tampering', () => {
    const expected = structuredClone(buildReport('mock', 'complete'));
    if (expected.kind !== 'report') throw new Error('expected report');
    const expectedEntry = expected.lanes.mock.entries[0];
    if (expectedEntry?.entryStatus !== 'observed' || expectedEntry.agent !== 'router') {
      throw new Error('expected router observation');
    }
    expectedEntry.expectedCode = 'study_plan';
    expect(parsePhase6943Output(expected).ok).toBe(false);

    const permission = structuredClone(buildReport('live', 'complete'));
    if (permission.kind !== 'report' || permission.runKind !== 'live') {
      throw new Error('expected live report');
    }
    const permissionEntry = permission.lanes.live.entries[0];
    if (permissionEntry?.entryStatus !== 'observed' || permissionEntry.agent !== 'router') {
      throw new Error('expected router observation');
    }
    permissionEntry.actualPermissions.requiresHumanApproval =
      !permissionEntry.actualPermissions.requiresHumanApproval;
    expect(parsePhase6943Output(permission).ok).toBe(false);

    const telemetry = structuredClone(buildReport('live', 'complete'));
    if (telemetry.kind !== 'report' || telemetry.runKind !== 'live') {
      throw new Error('expected live report');
    }
    const telemetryEntry = telemetry.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' && entry.strictSuccess,
    );
    if (telemetryEntry?.entryStatus !== 'observed' || telemetryEntry.lane !== 'live') {
      throw new Error('expected successful live observation');
    }
    telemetryEntry.providerReported = false;
    expect(parsePhase6943Output(telemetry).ok).toBe(false);

    const counter = structuredClone(buildReport('mock', 'complete'));
    if (counter.kind !== 'report') throw new Error('expected report');
    counter.lanes.mock.counters.runtimeInvocations += 1;
    expect(parsePhase6943Output(counter).ok).toBe(false);
  });

  test('rejects free text reasons, invalid extras and not_run usage', () => {
    const freeReason = structuredClone(buildInvalidRun()) as Record<string, unknown>;
    freeReason.decisions = [
      { agent: 'router', enabled: false, reason: 'free text' },
      { agent: 'verifier', enabled: false, reason: 'free text' },
    ];
    expect(parsePhase6943Output(freeReason).ok).toBe(false);

    const invalidExtra = { ...buildInvalidRun(), metrics: {} };
    expect(parsePhase6943Output(invalidExtra).ok).toBe(false);

    const report = structuredClone(buildReport('mock', 'incomplete'));
    if (report.kind !== 'report') throw new Error('expected report');
    report.lanes.mock.entries[99] = {
      ...report.lanes.mock.entries[99]!,
      inputTokens: 1,
    } as Phase6943Entry;
    expect(parsePhase6943Output(report).ok).toBe(false);
  });

  test('does not mutate callers and catches hostile inputs', () => {
    const report = buildReport('mock', 'complete');
    const before = JSON.stringify(report);
    Object.freeze(report);
    expect(parsePhase6943Output(report).ok).toBe(true);
    expect(JSON.stringify(report)).toBe(before);
    const hostile = new Proxy({}, { get() { throw new Error('RAW_CANARY'); } });
    expect(parsePhase6943Output(hostile)).toEqual({ ok: false, errorCode: 'report_contract_invalid' });
    const getter = Object.defineProperty({}, 'kind', { get() { throw new Error('RAW_CANARY'); } });
    expect(parsePhase6943Output(getter)).toEqual({ ok: false, errorCode: 'report_contract_invalid' });
  });

  test('contains no sensitive canary in legal serialization', () => {
    const serialized = JSON.stringify(buildReport('live', 'complete'));
    for (const canary of ['QUERY_CANARY', 'CHUNK_CANARY', 'PROMPT_CANARY', 'PROVIDER_OUTPUT_CANARY', 'RAW_ERROR_CANARY', 'API_KEY_CANARY', 'BASE_URL_CANARY', 'COOKIE_CANARY', 'TOKEN_CANARY', 'EMAIL_CANARY', 'PRIVATE_KEY_CANARY']) {
      expect(serialized).not.toContain(canary);
    }
  });

  test('recomputes metrics and latency instead of trusting finite report values', () => {
    const mutations: ((report: Extract<Phase6943Output, { kind: 'report'; runKind: 'live' }>) => void)[] = [
      (report) => { report.lanes.live.metrics.router.overallAccuracy = 0.999; },
      (report) => { report.lanes.live.metrics.router.ambiguousMacroF1 = 0.999; },
      (report) => { report.lanes.live.metrics.verifier.complexConflictRecall = 0.999; },
      (report) => { report.lanes.live.latency.router.totalP50Ms = 2; },
      (report) => { report.lanes.live.latency.verifier.additionalP95Ms = 2; },
    ];
    for (const mutate of mutations) {
      const report = structuredClone(buildReport('live', 'complete'));
      if (report.kind !== 'report' || report.runKind !== 'live') throw new Error('expected live');
      mutate(report);
      expect(parsePhase6943Output(report)).toEqual({
        ok: false,
        errorCode: 'report_contract_invalid',
      });
    }
  });

  test('accepts canonical not_run tails and derives partial evidence from observed entries only', () => {
    const report = buildCanonicalPartialLiveReport();
    if (report.kind !== 'report' || report.runKind !== 'live') {
      throw new Error('expected partial live report');
    }
    const live = report.lanes.live;
    const observed = live.entries.filter((entry) => entry.entryStatus === 'observed');
    const notRun = live.entries.filter((entry) => entry.entryStatus === 'not_run');
    const observedRuntime = observed.filter(
      (entry) => entry.lane !== 'deterministic' && entry.runtimeInvoked,
    );

    expect(parsePhase6943Output(report).ok).toBe(true);
    expect(notRun.length).toBeGreaterThan(0);
    expect(live.status).toBe('partial');
    expect(live.metricsStatus).toBe('partial');
    expect(live.counters.adapterExecutions).toBe(observed.length);
    expect(live.coverage).toMatchObject({
      observedCount: observed.length,
      notRunCount: notRun.length,
      runtimeInvocationCount: observedRuntime.length,
    });
    expect(notRun.every((entry) => !('actualCode' in entry))).toBe(true);
    expect(notRun.every((entry) => !('durationMs' in entry))).toBe(true);
    expect(live.latency.router.totalP95Ms).toBe(1);
    expect(live.latency.verifier.totalP95Ms).toBe(1);

    const metricsTamper = structuredClone(report);
    metricsTamper.lanes.live.metrics.verifier.overallAccuracy = 0;
    expect(parsePhase6943Output(metricsTamper)).toEqual({
      ok: false,
      errorCode: 'report_contract_invalid',
    });

    const coverageTamper = structuredClone(report);
    coverageTamper.lanes.live.coverage.observedCount += 1;
    expect(parsePhase6943Output(coverageTamper)).toEqual({
      ok: false,
      errorCode: 'report_contract_invalid',
    });

    const latencyTamper = structuredClone(report);
    latencyTamper.lanes.live.latency.verifier.totalP95Ms = 9_999;
    expect(parsePhase6943Output(latencyTamper)).toEqual({
      ok: false,
      errorCode: 'report_contract_invalid',
    });
  });

  test('derives complete Live decisions from paired metrics with canonical precedence', () => {
    const disabled = buildReport('live', 'complete');
    expect(parsePhase6943Output(disabled).ok).toBe(true);

    const falseEnable = structuredClone(disabled);
    if (falseEnable.kind !== 'report' || falseEnable.runKind !== 'live') {
      throw new Error('expected live report');
    }
    falseEnable.decisions = [
      { agent: 'router', enabled: true, reason: 'quality_gate_passed' },
      { agent: 'verifier', enabled: true, reason: 'quality_gate_passed' },
    ];
    expect(parsePhase6943Output(falseEnable).ok).toBe(false);

    const precedence = structuredClone(disabled);
    if (precedence.kind !== 'report' || precedence.runKind !== 'live') {
      throw new Error('expected live report');
    }
    const routerCritical = precedence.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.agent === 'router' &&
        entry.subset === 'safety_boundary',
    );
    const routerRuntime = precedence.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.agent === 'router' &&
        entry.lane === 'live' && entry.runtimeInvoked,
    );
    const verifierCritical = precedence.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.agent === 'verifier' &&
        entry.subset === 'prompt_injection',
    );
    const verifierConservative = precedence.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.agent === 'verifier' &&
        entry.subset === 'uncertain_or_stale',
    );
    const verifierConflict = precedence.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.agent === 'verifier' &&
        entry.subset === 'complex_conflict',
    );
    if (!routerCritical || routerCritical.entryStatus !== 'observed' || routerCritical.agent !== 'router' ||
        !routerRuntime || routerRuntime.entryStatus !== 'observed' || routerRuntime.agent !== 'router' || routerRuntime.lane !== 'live' ||
        !verifierCritical || verifierCritical.entryStatus !== 'observed' || verifierCritical.agent !== 'verifier' ||
        !verifierConservative || verifierConservative.entryStatus !== 'observed' || verifierConservative.agent !== 'verifier' ||
        !verifierConflict || verifierConflict.entryStatus !== 'observed' || verifierConflict.agent !== 'verifier') {
      throw new Error('missing precedence fixtures');
    }
    routerCritical.actualCode = routerCritical.expectedCode === 'chat' ? 'tutor' : 'chat';
    routerCritical.actualPermissions = { requiresRag: false, requiresHumanApproval: false };
    routerRuntime.durationMs = 3_002;
    routerRuntime.additionalLatencyMs = 3_001;
    verifierCritical.actualCode = 'trusted';
    verifierConservative.actualCode = 'trusted';
    verifierConflict.actualCode = 'suspicious';
    precedence.lanes.live = buildTestLane(precedence.lanes.live.entries, true);
    precedence.decisions = [
      { agent: 'router', enabled: false, reason: 'critical_failure' },
      { agent: 'verifier', enabled: false, reason: 'critical_failure' },
    ];
    expect(parsePhase6943Output(precedence).ok).toBe(true);

    const wrongPrecedence = structuredClone(precedence);
    wrongPrecedence.decisions = [
      { agent: 'router', enabled: false, reason: 'latency_budget_exceeded' },
      { agent: 'verifier', enabled: false, reason: 'conservative_fallback_failed' },
    ];
    expect(parsePhase6943Output(wrongPrecedence).ok).toBe(false);
  });

  test('validates per-case additional latency against deterministic duration with zero clamp', () => {
    const forged = buildReport('live', 'complete');
    if (forged.kind !== 'report' || forged.runKind !== 'live') throw new Error('expected live');
    const forgedEntry = forged.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeInvoked,
    );
    if (!forgedEntry || forgedEntry.entryStatus !== 'observed' || forgedEntry.lane !== 'live') {
      throw new Error('missing live candidate');
    }
    forgedEntry.durationMs = 50;
    forgedEntry.additionalLatencyMs = 0;
    forged.lanes.live = buildTestLane(forged.lanes.live.entries, true);
    expect(parsePhase6943Output(forged).ok).toBe(false);

    const clamped = buildReport('live', 'complete');
    if (clamped.kind !== 'report' || clamped.runKind !== 'live') throw new Error('expected live');
    const clampedEntry = clamped.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeInvoked,
    );
    if (!clampedEntry || clampedEntry.entryStatus !== 'observed' || clampedEntry.lane !== 'live') {
      throw new Error('missing live candidate');
    }
    clampedEntry.durationMs = 0;
    clampedEntry.additionalLatencyMs = 0;
    clamped.lanes.live = buildTestLane(clamped.lanes.live.entries, true);
    expect(parsePhase6943Output(clamped).ok).toBe(true);
  });

  test('requires the canonical effective cost cap and fixes nearest-rank boundaries', () => {
    const report = buildReport('live', 'complete');
    if (report.kind !== 'report' || report.runKind !== 'live') throw new Error('expected live');
    report.pricingSnapshot.effectiveMaxCostUsd = 0.05;
    expect(parsePhase6943Output(report).ok).toBe(false);

    expect(nearestRank([], 0.95)).toBeNull();
    expect(nearestRank([4, 1, 3, 2], 0.5)).toBe(2);
    expect(nearestRank([4, 1, 3, 2], 0.95)).toBe(4);
    expect(nearestRank([12, 1, 11, 2, 10, 3, 9, 4, 8, 5, 7, 6], 0.5)).toBe(6);
    expect(nearestRank([12, 1, 11, 2, 10, 3, 9, 4, 8, 5, 7, 6], 0.95)).toBe(12);
    expect(nearestRank([16, 1, 15, 2, 14, 3, 13, 4, 12, 5, 11, 6, 10, 7, 9, 8], 0.5)).toBe(8);
    expect(nearestRank([16, 1, 15, 2, 14, 3, 13, 4, 12, 5, 11, 6, 10, 7, 9, 8], 0.95)).toBe(16);
  });

  test('derives incomplete Live reasons from stopping evidence with fixed precedence', () => {
    const stopped = buildCanonicalPartialLiveReport();
    expect(parsePhase6943Output(stopped).ok).toBe(true);
    const falseUsage = withIncompleteReason(stopped, 'usage_unverifiable');
    expect(parsePhase6943Output(falseUsage).ok).toBe(false);

    const usage = buildUsageUnverifiableBudgetStoppedReport();
    if (usage.kind !== 'report' || usage.runKind !== 'live') throw new Error('expected live');
    expect(usage.usage.providerReported).toBe(false);
    expect(usage.usage.inputTokens).toBeGreaterThan(96_000);
    expect(parsePhase6943Output(usage).ok).toBe(true);
    expect(parsePhase6943Output(withIncompleteReason(usage, 'cost_budget_exceeded')).ok).toBe(false);

    const token = buildTokenBudgetStoppedReport();
    if (token.kind !== 'report' || token.runKind !== 'live') throw new Error('expected live');
    expect(token.usage.inputTokens).toBeGreaterThan(96_000);
    expect(token.estimatedCostUsd).toBeGreaterThan(
      token.pricingSnapshot.effectiveMaxCostUsd,
    );
    expect(parsePhase6943Output(token).ok).toBe(true);
    expect(parsePhase6943Output(withIncompleteReason(token, 'cost_budget_exceeded')).ok).toBe(false);

    const boundary = buildCallBoundaryFailedReport();
    expect(parsePhase6943Output(boundary).ok).toBe(true);
    expect(parsePhase6943Output(withIncompleteReason(boundary, 'run_incomplete')).ok).toBe(false);

    const preProviderFailure = buildPreProviderRuntimeFailureReport();
    expect(parsePhase6943Output(preProviderFailure).ok).toBe(true);
    expect(
      parsePhase6943Output(
        withIncompleteReason(preProviderFailure, 'call_boundary_failed'),
      ).ok,
    ).toBe(false);
  });

  test('rejects zero Live usage and pricing or cost cap tampering', () => {
    const zeroUsage = structuredClone(buildReport('live', 'complete'));
    if (zeroUsage.kind !== 'report' || zeroUsage.runKind !== 'live') throw new Error('expected live');
    const entry = zeroUsage.lanes.live.entries.find(
      (item) => item.entryStatus === 'observed' && item.lane === 'live' && item.strictSuccess,
    );
    if (!entry || entry.entryStatus !== 'observed' || entry.lane !== 'live') throw new Error('missing live entry');
    zeroUsage.usage.inputTokens -= entry.inputTokens;
    zeroUsage.usage.outputTokens -= entry.outputTokens;
    entry.inputTokens = 0;
    entry.outputTokens = 0;
    zeroUsage.estimatedCostUsd =
      (zeroUsage.usage.inputTokens + zeroUsage.usage.outputTokens) / 1_000_000;
    expect(parsePhase6943Output(zeroUsage).ok).toBe(false);

    const crossCap = structuredClone(buildReport('live', 'complete'));
    if (crossCap.kind !== 'report' || crossCap.runKind !== 'live') throw new Error('expected live');
    crossCap.pricingSnapshot.cliMaxCostUsd = 0.05;
    crossCap.pricingSnapshot.effectiveMaxCostUsd = 0.1;
    expect(parsePhase6943Output(crossCap).ok).toBe(false);

    const costCap = structuredClone(buildReport('live', 'complete'));
    if (costCap.kind !== 'report' || costCap.runKind !== 'live') throw new Error('expected live');
    costCap.pricingSnapshot.effectiveMaxCostUsd = 0.000_001;
    expect(costCap.estimatedCostUsd).toBeGreaterThan(costCap.pricingSnapshot.effectiveMaxCostUsd);
    expect(parsePhase6943Output(costCap).ok).toBe(false);
  });
});

function buildInvalidRun(): Phase6943Output {
  return {
    kind: 'invalid_run',
    schemaVersion: PHASE_6943_REPORT_SCHEMA_VERSION,
    runKind: 'live',
    runStatus: 'invalid',
    errorCode: 'dataset_mismatch',
    decisions: [
      { agent: 'router', enabled: false, reason: 'dataset_mismatch' },
      { agent: 'verifier', enabled: false, reason: 'dataset_mismatch' },
    ],
  };
}
function buildReport(runKind: 'mock' | 'live', runStatus: 'complete' | 'incomplete'): Phase6943Output {
  const deterministicEntries = entries('deterministic', false);
  const mockEntries = entries('mock', runStatus === 'incomplete');
  const liveEntries = entries('live', runStatus === 'incomplete');
  const lane = (laneEntries: Phase6943Entry[], candidate: boolean) => buildTestLane(laneEntries, candidate);
  const liveProviderEntries = liveEntries.filter(
    (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' && entry.providerReported,
  );
  const liveInputTokens = liveProviderEntries.reduce((sum, entry) => sum + entry.inputTokens, 0);
  const liveOutputTokens = liveProviderEntries.reduce((sum, entry) => sum + entry.outputTokens, 0);
  const base = {
    kind: 'report' as const,
    schemaVersion: PHASE_6943_REPORT_SCHEMA_VERSION,
    datasetVersion: PHASE_6941_ROUTER_VERIFIER_DATASET_VERSION,
    datasetDigest: PHASE_6943_DATASET_DIGEST,
    runnerVersion: PHASE_6943_RUNNER_VERSION,
    promptVersion: PHASE_6943_PROMPT_VERSION,
    runIdHash: `sha256:${'a'.repeat(64)}`,
    startedAt: '2026-07-13T00:00:00.000Z',
    finishedAt: '2026-07-13T00:00:01.000Z',
    durationMs: 1_000,
    runStatus,
    estimatedCostUsd: runKind === 'mock' ? 0 : (liveInputTokens + liveOutputTokens) / 1_000_000,
    usage: {
      inputTokens: runKind === 'mock' ? 0 : liveInputTokens,
      outputTokens: runKind === 'mock' ? 0 : liveOutputTokens,
      providerReported: runKind === 'live' && runStatus === 'complete',
    },
    decisions: runKind === 'mock'
      ? [
          { agent: 'router' as const, enabled: false, reason: runStatus === 'complete' ? 'paired_candidate_not_run' as const : 'run_incomplete' as const },
          { agent: 'verifier' as const, enabled: false, reason: runStatus === 'complete' ? 'paired_candidate_not_run' as const : 'run_incomplete' as const },
        ]
      : [
          { agent: 'router' as const, enabled: false, reason: runStatus === 'complete' ? 'insufficient_quality_gain' as const : 'usage_unverifiable' as const },
          { agent: 'verifier' as const, enabled: false, reason: runStatus === 'complete' ? 'insufficient_quality_gain' as const : 'usage_unverifiable' as const },
        ],
  };
  if (runKind === 'mock') {
    return { ...base, runKind, qualityEvidence: false, provider: 'mock', model: 'phase-6-9-4-3-test-fixture-v1', lanes: { deterministic: lane(deterministicEntries, false), mock: lane(mockEntries, true), live: { status: 'not_applicable' } } } as Phase6943Output;
  }
  return {
    ...base,
    runKind,
    qualityEvidence: true,
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    pricingSnapshot: { currency: 'USD', unitTokens: 1_000_000, inputUsdPerMillion: 1, outputUsdPerMillion: 1, inputPriceBasis: 'non_cached_highest_applicable', capturedAt: '2026-07-13T00:00:00.000Z', cliMaxCostUsd: 0.1, effectiveMaxCostUsd: 0.1 },
    runtimeMetadata: { liveCaseTimeoutMs: 10_000, providerInputTolerance: 3 },
    lanes: { deterministic: lane(deterministicEntries, false), mock: lane(mockEntries, true), live: lane(liveEntries, true) },
  } as Phase6943Output;
}

function buildCanonicalPartialLiveReport(): Phase6943Output {
  const report = structuredClone(buildReport('live', 'complete'));
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected complete live report');
  }
  const canonicalCases = [...phase6941RouterCases, ...phase6941VerifierCases];
  let firstNotRunIndex = -1;
  for (let index = canonicalCases.length - 1; index >= 0; index -= 1) {
    if (canonicalCases[index]?.candidateEligible) {
      firstNotRunIndex = index;
      break;
    }
  }
  if (firstNotRunIndex < 0) throw new Error('missing candidate tail');

  const entries: Phase6943Entry[] = report.lanes.live.entries.map((entry, index) => {
    if (index < firstNotRunIndex) return entry;
    const testCase = canonicalCases[index];
    if (!testCase) throw new Error('missing canonical case');
    return {
      caseId: testCase.id,
      agent: testCase.agent,
      subset: testCase.subset,
      lane: 'live',
      entryStatus: 'not_run',
      reason: 'runner_stopped',
    };
  });
  report.lanes.live = buildTestLane(entries, true);
  report.runStatus = 'incomplete';
  report.decisions = [
    { agent: 'router', enabled: false, reason: 'run_incomplete' },
    { agent: 'verifier', enabled: false, reason: 'run_incomplete' },
  ];
  let inputTokens = 0;
  let outputTokens = 0;
  let providerAttempts = 0;
  let providerReportedAttempts = 0;
  for (const entry of entries) {
    if (entry.entryStatus !== 'observed' || entry.lane !== 'live') continue;
    if (entry.providerAttempted) providerAttempts += 1;
    if (entry.providerReported) {
      providerReportedAttempts += 1;
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
    }
  }
  report.usage = {
    inputTokens,
    outputTokens,
    providerReported:
      providerAttempts > 0 && providerAttempts === providerReportedAttempts,
  };
  report.estimatedCostUsd =
    (inputTokens / report.pricingSnapshot.unitTokens) *
      report.pricingSnapshot.inputUsdPerMillion +
    (outputTokens / report.pricingSnapshot.unitTokens) *
      report.pricingSnapshot.outputUsdPerMillion;
  return report;
}

function withIncompleteReason(
  input: Phase6943Output,
  reason: Phase6943DecisionReason,
): Phase6943Output {
  const report = structuredClone(input);
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected live report');
  }
  report.decisions = [
    { agent: 'router', enabled: false, reason },
    { agent: 'verifier', enabled: false, reason },
  ];
  return report;
}

function buildUsageUnverifiableBudgetStoppedReport(): Phase6943Output {
  const report = structuredClone(buildReport('live', 'incomplete'));
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected live report');
  }
  const canonicalCases = [...phase6941RouterCases, ...phase6941VerifierCases];
  let failedIndex = -1;
  for (let index = 0; index < report.lanes.live.entries.length; index += 1) {
    const entry = report.lanes.live.entries[index];
    if (entry?.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeInvoked && !entry.strictSuccess) {
      failedIndex = index;
      break;
    }
  }
  if (failedIndex < 0 || failedIndex + 1 >= canonicalCases.length) {
    throw new Error('missing failure tail');
  }
  const overCap = report.lanes.live.entries.find(
    (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
      entry.strictSuccess,
  );
  if (!overCap || overCap.entryStatus !== 'observed' || overCap.lane !== 'live') {
    throw new Error('missing over-cap entry');
  }
  overCap.inputTokens = 200_000;
  report.lanes.live.entries = report.lanes.live.entries.map((entry, index) => {
    if (index <= failedIndex) return entry;
    const testCase = canonicalCases[index];
    if (!testCase) throw new Error('missing canonical case');
    return {
      caseId: testCase.id,
      agent: testCase.agent,
      subset: testCase.subset,
      lane: 'live',
      entryStatus: 'not_run',
      reason: 'budget_exceeded',
    };
  });
  refreshIncompleteLiveReport(report);
  report.decisions = [
    { agent: 'router', enabled: false, reason: 'usage_unverifiable' },
    { agent: 'verifier', enabled: false, reason: 'usage_unverifiable' },
  ];
  return report;
}

function buildTokenBudgetStoppedReport(): Phase6943Output {
  const report = structuredClone(buildReport('live', 'complete'));
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected live report');
  }
  const canonicalCases = [...phase6941RouterCases, ...phase6941VerifierCases];
  let lastEligibleIndex = -1;
  for (let index = 0; index < canonicalCases.length; index += 1) {
    if (canonicalCases[index]?.candidateEligible) lastEligibleIndex = index;
  }
  const firstNotRunIndex = lastEligibleIndex + 1;
  if (lastEligibleIndex < 0 || firstNotRunIndex >= canonicalCases.length) {
    throw new Error('missing budget tail');
  }
  report.lanes.live.entries = report.lanes.live.entries.map((entry, index) => {
    if (index >= firstNotRunIndex) {
      const testCase = canonicalCases[index];
      if (!testCase) throw new Error('missing canonical case');
      return {
        caseId: testCase.id,
        agent: testCase.agent,
        subset: testCase.subset,
        lane: 'live',
        entryStatus: 'not_run',
        reason: 'budget_exceeded',
      };
    }
    if (index === lastEligibleIndex && entry.entryStatus === 'observed' &&
        entry.lane === 'live' && entry.strictSuccess) {
      entry.inputTokens = 200_000;
    }
    return entry;
  });
  refreshIncompleteLiveReport(report);
  report.decisions = [
    { agent: 'router', enabled: false, reason: 'token_budget_exceeded' },
    { agent: 'verifier', enabled: false, reason: 'token_budget_exceeded' },
  ];
  return report;
}

function buildCallBoundaryFailedReport(): Phase6943Output {
  const report = structuredClone(buildReport('live', 'complete'));
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected live report');
  }
  const canonicalCases = [...phase6941RouterCases, ...phase6941VerifierCases];
  let boundaryIndex = -1;
  for (let index = 0; index < report.lanes.live.entries.length; index += 1) {
    const item = report.lanes.live.entries[index];
    if (item?.entryStatus === 'observed' && item.lane === 'live' && item.runtimeInvoked) {
      boundaryIndex = index;
    }
  }
  const entry = report.lanes.live.entries[boundaryIndex];
  if (!entry || entry.entryStatus !== 'observed' || entry.lane !== 'live') {
    throw new Error('missing boundary entry');
  }
  entry.disposition = 'fallback_runtime_error';
  entry.runtimeInvoked = false;
  entry.providerAttempted = false;
  entry.strictSuccess = false;
  delete entry.runtimeErrorCode;
  entry.inputTokens = 0;
  entry.outputTokens = 0;
  entry.providerReported = false;
  report.lanes.live.entries = report.lanes.live.entries.map((item, index) => {
    if (index <= boundaryIndex) return item;
    const testCase = canonicalCases[index];
    if (!testCase) throw new Error('missing canonical case');
    return {
      caseId: testCase.id,
      agent: testCase.agent,
      subset: testCase.subset,
      lane: 'live',
      entryStatus: 'not_run',
      reason: 'prior_live_failure',
    };
  });
  refreshIncompleteLiveReport(report);
  report.decisions = [
    { agent: 'router', enabled: false, reason: 'call_boundary_failed' },
    { agent: 'verifier', enabled: false, reason: 'call_boundary_failed' },
  ];
  return report;
}

function buildPreProviderRuntimeFailureReport(): Phase6943Output {
  const report = structuredClone(buildCallBoundaryFailedReport());
  if (report.kind !== 'report' || report.runKind !== 'live') {
    throw new Error('expected live report');
  }
  const entry = report.lanes.live.entries.find(
    (item) => item.entryStatus === 'observed' && item.lane === 'live' &&
      !item.runtimeInvoked && item.disposition === 'fallback_runtime_error' &&
      item.inputTokens === 0 && item.outputTokens === 0,
  );
  if (!entry || entry.entryStatus !== 'observed' || entry.lane !== 'live') {
    throw new Error('missing pre-provider entry');
  }
  entry.disposition = 'fallback_runtime_error';
  entry.runtimeInvoked = true;
  entry.providerAttempted = false;
  entry.strictSuccess = false;
  entry.runtimeErrorCode = 'EXECUTOR_UNAVAILABLE';
  entry.providerReported = false;
  refreshIncompleteLiveReport(report);
  report.decisions = [
    { agent: 'router', enabled: false, reason: 'usage_unverifiable' },
    { agent: 'verifier', enabled: false, reason: 'usage_unverifiable' },
  ];
  return report;
}

function refreshIncompleteLiveReport(
  report: Extract<Phase6943Output, { kind: 'report'; runKind: 'live' }>,
) {
  report.runStatus = 'incomplete';
  report.lanes.live = buildTestLane(report.lanes.live.entries, true);
  report.lanes.live.status = 'partial';
  report.lanes.live.metricsStatus = 'partial';
  let inputTokens = 0;
  let outputTokens = 0;
  let providerAttempts = 0;
  let reportedAttempts = 0;
  for (const entry of report.lanes.live.entries) {
    if (entry.entryStatus !== 'observed' || entry.lane !== 'live') continue;
    if (entry.providerAttempted) providerAttempts += 1;
    if (entry.providerReported) {
      reportedAttempts += 1;
      inputTokens += entry.inputTokens;
      outputTokens += entry.outputTokens;
    }
  }
  report.usage = {
    inputTokens,
    outputTokens,
    providerReported:
      providerAttempts > 0 && providerAttempts === reportedAttempts,
  };
  report.estimatedCostUsd =
    (inputTokens / report.pricingSnapshot.unitTokens) *
      report.pricingSnapshot.inputUsdPerMillion +
    (outputTokens / report.pricingSnapshot.unitTokens) *
      report.pricingSnapshot.outputUsdPerMillion;
}

function entries(lane: 'deterministic' | 'mock' | 'live', incomplete: boolean): Phase6943Entry[] {
  const cases = [...phase6941RouterCases, ...phase6941VerifierCases];
  const failingCaseId = [...cases].reverse().find((item) => item.candidateEligible)?.id;
  return cases.map((item, index) => {
    if (item.agent === 'router') {
      const base = { caseId: item.id, agent: item.agent, subset: item.subset, lane, entryStatus: 'observed' as const, expectedCode: item.expected.route, actualCode: item.expected.route, expectedPermissions: { requiresRag: item.expected.requiresRag, requiresHumanApproval: item.expected.requiresHumanApproval }, actualPermissions: { requiresRag: item.expected.requiresRag, requiresHumanApproval: item.expected.requiresHumanApproval }, durationMs: 1 };
      if (lane === 'deterministic') return base;
      const failed = incomplete && item.id === failingCaseId;
      return { ...base, disposition: failed ? 'fallback_runtime_error' as const : item.candidateEligible ? 'candidate_applied' as const : 'not_eligible' as const, runtimeInvoked: item.candidateEligible, providerAttempted: lane === 'live' && item.candidateEligible, strictSuccess: item.candidateEligible && !failed, ...(failed ? { runtimeErrorCode: 'PROVIDER_ERROR' as const } : {}), additionalLatencyMs: 0, inputTokens: failed || !item.candidateEligible ? 0 : 10, outputTokens: failed || !item.candidateEligible ? 0 : 1, providerReported: lane === 'live' && item.candidateEligible && !failed, provider: lane === 'live' ? 'deepseek' as const : 'mock' as const, model: lane === 'live' ? 'deepseek-v4-flash' as const : 'phase-6-9-4-3-test-fixture-v1' as const, promptVersion: PHASE_6943_PROMPT_VERSION };
    }
    const base = { caseId: item.id, agent: item.agent, subset: item.subset, lane, entryStatus: 'observed' as const, expectedCode: item.expectedStatus, actualCode: item.expectedStatus, durationMs: 1 };
    if (lane === 'deterministic') return base;
    const failed = incomplete && item.id === failingCaseId;
    return { ...base, disposition: failed ? 'fallback_runtime_error' as const : item.candidateEligible ? 'candidate_applied' as const : 'not_eligible' as const, runtimeInvoked: item.candidateEligible, providerAttempted: lane === 'live' && item.candidateEligible, strictSuccess: item.candidateEligible && !failed, ...(failed ? { runtimeErrorCode: 'PROVIDER_ERROR' as const } : {}), additionalLatencyMs: 0, inputTokens: failed || !item.candidateEligible ? 0 : 10, outputTokens: failed || !item.candidateEligible ? 0 : 1, providerReported: lane === 'live' && item.candidateEligible && !failed, provider: lane === 'live' ? 'deepseek' as const : 'mock' as const, model: lane === 'live' ? 'deepseek-v4-flash' as const : 'phase-6-9-4-3-test-fixture-v1' as const, promptVersion: PHASE_6943_PROMPT_VERSION };
  });
}

function buildTestLane(laneEntries: Phase6943Entry[], candidate: boolean) {
  const observed = laneEntries.filter((entry) => entry.entryStatus === 'observed');
  const candidateEntries = observed.filter((entry) => entry.lane !== 'deterministic');
  const runtimeEntries = candidateEntries.filter((entry) => entry.runtimeInvoked);
  const failures = runtimeEntries.filter((entry) => !entry.strictSuccess);
  const router = buildRouterEvalMetrics(phase6941RouterCases.flatMap((testCase) => {
    const entry = observed.find((item) => item.caseId === testCase.id && item.agent === 'router');
    if (!entry || entry.entryStatus !== 'observed' || entry.agent !== 'router') return [];
    return [{ caseId: testCase.id, subset: testCase.subset, expectedRoute: testCase.expected.route, actualRoute: entry.actualCode, expectedRequiresRag: testCase.expected.requiresRag, actualRequiresRag: entry.actualPermissions.requiresRag, expectedRequiresHumanApproval: testCase.expected.requiresHumanApproval, actualRequiresHumanApproval: entry.actualPermissions.requiresHumanApproval, criticalSafetyCase: testCase.criticalSafetyCase }];
  }));
  const verifier = buildVerifierEvalMetrics(phase6941VerifierCases.flatMap((testCase) => {
    const entry = observed.find((item) => item.caseId === testCase.id && item.agent === 'verifier');
    if (!entry || entry.entryStatus !== 'observed' || entry.agent !== 'verifier') return [];
    return [{ caseId: testCase.id, subset: testCase.subset, expectedStatus: testCase.expectedStatus, actualStatus: entry.actualCode, criticalSafetyCase: testCase.criticalSafetyCase, candidateAttempted: entry.lane === 'live' && entry.runtimeInvoked, runtimeFailed: entry.lane !== 'deterministic' && entry.runtimeInvoked && !entry.strictSuccess }];
  }));
  if (!router.ok || !verifier.ok) throw new Error('metrics failure');
  const latency = (agent: 'router' | 'verifier') => {
    const samples = runtimeEntries.filter((entry) => entry.agent === agent);
    const rank = (field: 'durationMs' | 'additionalLatencyMs', percentile: 0.5 | 0.95) => {
      if (samples.length === 0) return null;
      const values = samples.map((entry) => entry[field]).sort((left, right) => left - right);
      return values[Math.ceil(percentile * values.length) - 1] ?? null;
    };
    return { totalP50Ms: rank('durationMs', 0.5), totalP95Ms: rank('durationMs', 0.95), additionalP50Ms: rank('additionalLatencyMs', 0.5), additionalP95Ms: rank('additionalLatencyMs', 0.95) };
  };
  const strictSuccesses = candidateEntries.filter((entry) => entry.strictSuccess).length;
  const zeroCallCases = candidateEntries.filter((entry) => {
    const testCase = [...phase6941RouterCases, ...phase6941VerifierCases].find((item) => item.id === entry.caseId);
    return testCase !== undefined && !testCase.candidateEligible && !entry.runtimeInvoked && !entry.providerAttempted;
  }).length;
  const status = failures.length === 0 && observed.length === laneEntries.length
    ? 'complete' as const
    : 'partial' as const;
  return {
    status,
    metricsStatus: status,
    entries: laneEntries,
    counters: { caseEntries: 100, adapterExecutions: candidate ? observed.length : 0, runtimeInvocations: runtimeEntries.length, providerAttempts: candidateEntries.filter((entry) => entry.providerAttempted).length, strictSuccesses, zeroCallCases: candidate ? zeroCallCases : 0 },
    coverage: { observedCount: observed.length, notRunCount: laneEntries.length - observed.length, runtimeInvocationCount: runtimeEntries.length, providerAttemptCount: candidateEntries.filter((entry) => entry.providerAttempted).length, strictSuccessCount: strictSuccesses, runtimeFailureCount: failures.length },
    metrics: { router: router.metrics, verifier: verifier.metrics },
    latency: { router: latency('router'), verifier: latency('verifier') },
  };
}
