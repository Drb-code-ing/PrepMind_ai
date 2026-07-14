import { describe, expect, test } from 'bun:test';
import { z } from 'zod';

import {
  createModelAgentRuntime,
  hashModelAgentRunId,
  reserveModelAgentBudget,
  type ModelAgentProviderFailureCategory,
  type ModelAgentRequest,
  type ModelAgentResult,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  PHASE_6943_DATASET_DIGEST,
  PHASE_6943_RUNNER_VERSION,
  PHASE_6943_STRUCTURED_OUTPUT_MODE,
  calculatePhase6943DatasetDigest,
  parsePhase6943Output,
  validatePhase6943Dataset,
  type Phase6943PricingSnapshot,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';
import {
  phase6941RouterCases,
  phase6941VerifierCases,
} from '../src/evals/phase-6-9-router-verifier-cases.ts';
import {
  canAdmit,
  estimatePhase6943CostUsd,
  runPhase6943PairedEval,
  type Phase6943Clocks,
  type Phase6943LiveDependencies,
} from '../src/evals/run-phase-6-9-router-verifier-paired.ts';
import { KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/knowledge-verifier-model-candidate.ts';
import { ROUTER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/router-model-candidate.ts';

const ROUTER_CANDIDATES = {
  router_ambiguous_notes_tutor_01: 'tutor',
  router_ambiguous_rag_explain_02: 'rag_answer',
  router_ambiguous_plan_review_03: 'review_analysis',
  router_ambiguous_review_plan_04: 'review_analysis',
  router_ambiguous_short_continue_05: 'tutor',
  router_ambiguous_short_why_06: 'tutor',
  router_ambiguous_pronoun_07: 'tutor',
  router_ambiguous_no_context_08: 'chat',
  router_ambiguous_material_general_09: 'rag_answer',
  router_ambiguous_today_review_10: 'review_analysis',
  router_ambiguous_question_deck_11: 'tutor',
  router_ambiguous_plan_question_12: 'chat',
  router_ambiguous_rewrite_rag_13: 'rag_answer',
  router_ambiguous_rewrite_tutor_14: 'tutor',
  router_ambiguous_mixed_review_15: 'review_analysis',
  router_ambiguous_mixed_chat_16: 'chat',
} as const;

const VERIFIER_CANDIDATES = {
  verifier_conflict_derivative_sign_01: 'conflict',
  verifier_conflict_matrix_rank_02: 'conflict',
  verifier_conflict_probability_value_03: 'conflict',
  verifier_conflict_law_version_04: 'conflict',
  verifier_conflict_physics_unit_05: 'conflict',
  verifier_conflict_history_date_06: 'conflict',
  verifier_conflict_english_condition_07: 'conflict',
  verifier_conflict_premise_scope_08: 'conflict',
  verifier_uncertain_possible_error_01: 'suspicious',
  verifier_uncertain_needs_check_02: 'suspicious',
  verifier_uncertain_stale_version_03: 'suspicious',
  verifier_uncertain_unknown_date_04: 'suspicious',
} as const;

type Candidate =
  | z.infer<typeof ROUTER_MODEL_CANDIDATE_SCHEMA>
  | z.infer<typeof KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA>;

function testCandidateForCase(caseId: string): Candidate {
  if (caseId in ROUTER_CANDIDATES) {
    return {
      route: ROUTER_CANDIDATES[caseId as keyof typeof ROUTER_CANDIDATES],
      confidence: 0.9,
      reasonCode: 'ambiguous_intent_resolved',
    };
  }
  if (caseId in VERIFIER_CANDIDATES) {
    const status = VERIFIER_CANDIDATES[caseId as keyof typeof VERIFIER_CANDIDATES];
    return status === 'conflict'
      ? { status, evidenceCodes: ['condition_conflict'] }
      : { status, evidenceCodes: ['stale_or_uncertain'] };
  }
  throw new Error('TEST_RUNTIME_REQUESTED_FOR_INELIGIBLE_CASE');
}

function createTestMockRuntime(input: {
  caseId: string;
  agent: 'router' | 'verifier';
  now?: () => number;
}): Pick<ModelAgentRuntime, 'invokeStructured'> {
  const candidate = testCandidateForCase(input.caseId);
  return createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-4-3-test-fixture-v1',
    liveCallsEnabled: false,
    timeoutMs: 100,
    mockResponder: () => candidate,
    ...(input.now ? { now: input.now } : {}),
  });
}

function fakeClocks(): Phase6943Clocks {
  let epoch = Date.UTC(2026, 6, 13);
  let monotonic = 0;
  return {
    epochMs: () => epoch++,
    monotonicMs: () => monotonic++,
  };
}

const pricing: Phase6943PricingSnapshot = Object.freeze({
  currency: 'USD',
  unitTokens: 1_000_000,
  inputUsdPerMillion: 0.2,
  outputUsdPerMillion: 0.4,
  inputPriceBasis: 'non_cached_highest_applicable',
  capturedAt: '2026-07-13T00:00:00.000Z',
  cliMaxCostUsd: 0.1,
  effectiveMaxCostUsd: 0.1,
});

describe('Phase 6.9.4.3 paired runner', () => {
  test('runs fresh deterministic and Mock lanes through dependency injection', async () => {
    const report = await runPhase6943PairedEval({
      runId: 'phase6943-test-run',
      runKind: 'mock',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
    });

    expect(report.kind).toBe('report');
    if (report.kind !== 'report') throw new Error('expected report');
    expect(report).toMatchObject({
      runKind: 'mock',
      runStatus: 'complete',
      datasetDigest: PHASE_6943_DATASET_DIGEST,
      runIdHash: hashModelAgentRunId('phase6943-test-run'),
      qualityEvidence: false,
      usage: { inputTokens: 0, outputTokens: 0, providerReported: false },
      estimatedCostUsd: 0,
      decisions: [
        { agent: 'router', enabled: false, reason: 'paired_candidate_not_run' },
        { agent: 'verifier', enabled: false, reason: 'paired_candidate_not_run' },
      ],
    });
    expect(report.lanes.deterministic.entries).toHaveLength(100);
    expect(report.lanes.mock.entries).toHaveLength(100);
    expect(report.lanes.live).toEqual({ status: 'not_applicable' });
    expect(report.lanes.mock.counters).toEqual({
      caseEntries: 100,
      adapterExecutions: 100,
      runtimeInvocations: 28,
      providerAttempts: 0,
      strictSuccesses: 28,
      zeroCallCases: 72,
    });
    expect(parsePhase6943Output(report)).toEqual({ ok: true, output: report });
  });

  test('recomputes the historical 74/26 baseline and two critical failures', async () => {
    const output = await runMock();
    if (output.kind !== 'report') throw new Error('expected report');
    const entries = output.lanes.deterministic.entries;
    const passed = entries.filter((entry) => {
      if (entry.entryStatus !== 'observed') return false;
      if (entry.agent === 'router') {
        return entry.expectedCode === entry.actualCode &&
          entry.expectedPermissions.requiresRag === entry.actualPermissions.requiresRag &&
          entry.expectedPermissions.requiresHumanApproval === entry.actualPermissions.requiresHumanApproval;
      }
      return entry.expectedCode === entry.actualCode;
    }).length;
    expect({ passed, failed: 100 - passed }).toEqual({ passed: 74, failed: 26 });
    expect(
      output.lanes.deterministic.metrics.router.criticalFailures +
        output.lanes.deterministic.metrics.verifier.criticalFailures,
    ).toBe(2);
  });

  test('never requests a runtime for the 72 ineligible cases', async () => {
    const requested: string[] = [];
    const report = await runPhase6943PairedEval({
      runId: 'zero-call-test',
      runKind: 'mock',
      clocks: fakeClocks(),
      createMockRuntime(input) {
        requested.push(input.caseId);
        return createTestMockRuntime(input);
      },
    });
    expect(report.kind).toBe('report');
    expect(requested).toHaveLength(28);
    expect(requested).toEqual([
      ...phase6941RouterCases,
      ...phase6941VerifierCases,
    ].filter((item) => item.candidateEligible).map((item) => item.id));
  });

  test('checks dataset integrity at startup, around every lane, and before every Live call', async () => {
    const mockEvents: string[] = [];
    const mock = await runPhase6943PairedEval({
      runId: 'mock-digest-checkpoints',
      runKind: 'mock',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      validateDataset() {
        mockEvents.push('validate');
        return validatePhase6943Dataset();
      },
      calculateDatasetDigest() {
        mockEvents.push('digest');
        return calculatePhase6943DatasetDigest();
      },
    });
    expect(mock.kind).toBe('report');
    expect(mockEvents).toEqual(Array.from({ length: 6 }, () => ['validate', 'digest']).flat());

    const liveEvents: string[] = [];
    const live = successfulLiveDependencies();
    const output = await runPhase6943PairedEval({
      runId: 'live-digest-checkpoints',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
      validateDataset() {
        liveEvents.push('validate');
        return validatePhase6943Dataset();
      },
      calculateDatasetDigest() {
        liveEvents.push('digest');
        return calculatePhase6943DatasetDigest();
      },
    });
    expect(output.kind).toBe('report');
    expect(live.requested).toHaveLength(28);
    expect(liveEvents).toEqual(Array.from({ length: 36 }, () => ['validate', 'digest']).flat());
  });

  test('stops Live before the next call when an injected digest checkpoint mismatches', async () => {
    const live = successfulLiveDependencies();
    let digestCalls = 0;
    const output = await runPhase6943PairedEval({
      runId: 'live-digest-mismatch',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
      validateDataset: validatePhase6943Dataset,
      calculateDatasetDigest() {
        digestCalls += 1;
        return digestCalls === 8 ? 'sha256:tampered' : PHASE_6943_DATASET_DIGEST;
      },
    });
    expect(output).toMatchObject({
      kind: 'invalid_run',
      runStatus: 'invalid',
      errorCode: 'dataset_mismatch',
    });
    expect(live.requested).toHaveLength(1);
  });

  test('marks Mock incomplete on one strict failure and continues later cases', async () => {
    let eligibleIndex = 0;
    const requested: string[] = [];
    const report = await runPhase6943PairedEval({
      runId: 'mock-failure-test',
      runKind: 'mock',
      clocks: orderedLatencyClocks(),
      createMockRuntime(input) {
        requested.push(input.caseId);
        eligibleIndex += 1;
        if (eligibleIndex === 16) {
          return createModelAgentRuntime({
            mode: 'mock', provider: 'mock', model: 'phase-6-9-4-3-test-fixture-v1',
            liveCallsEnabled: false, timeoutMs: 100, mockResponder: () => ({ malformed: true }),
          });
        }
        return createTestMockRuntime(input);
      },
    });
    expect(report.kind).toBe('report');
    if (report.kind !== 'report') throw new Error('expected report');
    expect(report.runStatus).toBe('incomplete');
    expect(report.lanes.mock.counters).toMatchObject({
      caseEntries: 100, runtimeInvocations: 28, strictSuccesses: 27, zeroCallCases: 72,
    });
    expect(report.lanes.mock.coverage.runtimeFailureCount).toBe(1);
    expect(report.lanes.mock.latency.router.totalP95Ms).toBe(16);
    expect(requested).toHaveLength(28);
    expect(report.decisions.every((item) => item.reason === 'run_incomplete')).toBe(true);
    expect(parsePhase6943Output(report).ok).toBe(true);
  });

  test('isolates timeout, schema, abort, budget, throw, and malformed telemetry fallbacks', async () => {
    const variants: ((request: ModelAgentRequest<unknown>) => unknown | Promise<unknown>)[] = [
      (request) => structuredFailure(request, 'TIMEOUT', true),
      () => ({ ok: true, data: { malformed: true } }),
      (request) => structuredFailure(request, 'ABORTED', false),
      (request) => structuredFailure(request, 'CALL_BUDGET_EXCEEDED', false),
      () => Promise.reject(new Error('RAW_THROW_CANARY')),
      () => Object.defineProperty({}, 'ok', { get() { throw new Error('RAW_GETTER_CANARY'); } }),
    ];
    for (const [index, responder] of variants.entries()) {
      let first = true;
      let calls = 0;
      const report = await runPhase6943PairedEval({
        runId: `mock-fallback-${index}`,
        runKind: 'mock', clocks: fakeClocks(),
        createMockRuntime(input) {
          if (!first) return createTestMockRuntime(input);
          first = false;
          return { invokeStructured(request) { calls += 1; return Promise.resolve(responder(request)) as never; } };
        },
      });
      expect(report.kind).toBe('report');
      if (report.kind !== 'report') throw new Error('expected report');
      expect(report.runStatus).toBe('incomplete');
      expect(report.lanes.mock.entries).toHaveLength(100);
      expect(report.lanes.mock.counters.strictSuccesses).toBe(27);
      expect(calls).toBe(1);
      expect(JSON.stringify(report)).not.toContain('RAW_');
    }
  });

  test('uses ordered Router n16 and Verifier n12 samples with legal negative additional clamp', async () => {
    const report = await runPhase6943PairedEval({
      runId: 'latency-clamp-test', runKind: 'mock',
      clocks: orderedLatencyClocks(), createMockRuntime: createTestMockRuntime,
    });
    expect(report.kind).toBe('report');
    if (report.kind !== 'report') throw new Error('expected report');
    expect(report.lanes.mock.latency.router).toEqual({
      totalP50Ms: 8, totalP95Ms: 16, additionalP50Ms: 0, additionalP95Ms: 0,
    });
    expect(report.lanes.mock.latency.verifier).toEqual({
      totalP50Ms: 6, totalP95Ms: 12, additionalP50Ms: 0, additionalP95Ms: 0,
    });
  });

  test('fails closed when the monotonic clock moves backwards within a sample', async () => {
    const output = await runPhase6943PairedEval({
      runId: 'backward-clock-test',
      runKind: 'mock',
      clocks: backwardClocks(),
      createMockRuntime: createTestMockRuntime,
    });
    expect(output).toMatchObject({
      kind: 'invalid_run',
      runStatus: 'invalid',
      errorCode: 'report_contract_invalid',
    });
  });

  test('runs Live in frozen order, serially, once per eligible case with complete counters', async () => {
    const live = successfulLiveDependencies();
    const budgetBefore = structuredClone(live.dependencies.budgetState);
    const output = await runPhase6943PairedEval({
      runId: 'live-complete-test', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('complete');
    expect(output).toMatchObject({
      runnerVersion: PHASE_6943_RUNNER_VERSION,
      structuredOutputMode: PHASE_6943_STRUCTURED_OUTPUT_MODE,
    });
    expect(output.lanes.live.counters).toEqual({
      caseEntries: 100, adapterExecutions: 100, runtimeInvocations: 28,
      providerAttempts: 28, strictSuccesses: 28, zeroCallCases: 72,
    });
    expect(live.requested).toEqual(eligibleCaseIds());
    expect(new Set(live.requested).size).toBe(28);
    expect(live.maxConcurrency()).toBe(1);
    expect(live.dependencies.budgetState).toEqual(budgetBefore);
    expect(output.usage).toEqual({ inputTokens: 28_000, outputTokens: 280, providerReported: true });
    expect(output.estimatedCostUsd).toBe(estimatePhase6943CostUsd(output.usage, pricing));
    expect(parsePhase6943Output(output).ok).toBe(true);
  });

  test('admits the 28th exact global token boundary and rejects an additional call', async () => {
    const live = successfulLiveDependencies({
      usageForCase: ({ agent }) => agent === 'router'
        ? { inputTokens: 2_400, outputTokens: 400 }
        : { inputTokens: 4_800, outputTokens: 400 },
    });
    const output = await runPhase6943PairedEval({
      runId: 'live-global-token-equality',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('complete');
    expect(output.usage).toEqual({
      inputTokens: 96_000,
      outputTokens: 11_200,
      providerReported: true,
    });
    expect(live.requested).toHaveLength(28);
    expect(canAdmit({ current: 28, reservation: 1, cap: 28 })).toBe(false);
  });

  for (const scenario of [
    { name: 'Router', cap: 0.000_7, requested: 1, agent: 'router' as const },
    { name: 'Verifier', cap: 0.004, requested: 16, agent: 'verifier' as const },
  ]) {
    test(`emits canonical ${scenario.name} cost pre-admission stop evidence`, async () => {
      const costPricing = {
        ...pricing,
        cliMaxCostUsd: scenario.cap,
        effectiveMaxCostUsd: scenario.cap,
      };
      const live = successfulLiveDependencies({ pricing: costPricing });
      const output = await runPhase6943PairedEval({
        runId: `cost-stop-${scenario.agent}`,
        runKind: 'live',
        clocks: fakeClocks(),
        createMockRuntime: createTestMockRuntime,
        live: live.dependencies,
      });
      expect(output.kind).toBe('report');
      if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
      expect(output.runStatus).toBe('incomplete');
      expect(live.requested).toHaveLength(scenario.requested);
      expect(output.decisions.every((item) => item.reason === 'cost_budget_exceeded')).toBe(true);
      expect(output.stopEvidence).toEqual({
        code: 'cost_budget_exceeded',
        currentCostUsd: output.estimatedCostUsd,
        reservationCostUsd: scenario.agent === 'router'
          ? estimateCost({ inputTokens: 2_400, outputTokens: 400 }, costPricing)
          : estimateCost({ inputTokens: 4_800, outputTokens: 400 }, costPricing),
        effectiveCapUsd: scenario.cap,
      });
      const firstNotRun = output.lanes.live.entries.find(
        (entry) => entry.entryStatus === 'not_run',
      );
      expect(firstNotRun).toMatchObject({
        agent: scenario.agent,
        reason: 'budget_exceeded',
      });
      expect(parsePhase6943Output(output).ok).toBe(true);
    });
  }

  test('allows exact cost equality then blocks the next strict crossing without another provider call', async () => {
    const reservation = estimateCost({ inputTokens: 2_400, outputTokens: 400 }, pricing);
    const equalityPricing = {
      ...pricing,
      cliMaxCostUsd: reservation,
      effectiveMaxCostUsd: reservation,
    };
    const live = successfulLiveDependencies({ pricing: equalityPricing });
    const output = await runPhase6943PairedEval({
      runId: 'cost-equality-stop', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(live.requested).toHaveLength(1);
    expect(output.stopEvidence).toMatchObject({
      code: 'cost_budget_exceeded',
      reservationCostUsd: reservation,
    });
  });

  test('stops after a strict provider success when injected cost accumulation is unverifiable', async () => {
    const live = successfulLiveDependencies();
    const output = await runPhase6943PairedEval({
      runId: 'cost-unverifiable-stop', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
      calculateCostUsd() {
        throw new Error('RAW_COST_CALCULATOR_CANARY');
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(1);
    expect(output.stopEvidence).toEqual({
      code: 'cost_unverifiable',
      costVerified: false,
    });
    expect(output.decisions.every((item) => item.reason === 'cost_unverifiable')).toBe(true);
    expect(output.lanes.live.entries.slice(37).every(
      (entry) => entry.entryStatus === 'not_run' && entry.reason === 'prior_live_failure',
    )).toBe(true);
    expect(JSON.stringify(output)).not.toContain('RAW_COST_CALCULATOR_CANARY');
    expect(parsePhase6943Output(output).ok).toBe(true);
  });

  test('passes the Router latency gate at exact equality and fails one millisecond above', async () => {
    const decisions: Array<{ maxAdditional: number; enabled: boolean; reason: string }> = [
      { maxAdditional: 2_500, enabled: true, reason: 'quality_gate_passed' },
      { maxAdditional: 2_501, enabled: false, reason: 'latency_budget_exceeded' },
    ];
    for (const expected of decisions) {
      const live = successfulLiveDependencies();
      const output = await runPhase6943PairedEval({
        runId: `router-latency-${expected.maxAdditional}`,
        runKind: 'live',
        clocks: liveLatencyClocks(expected.maxAdditional),
        createMockRuntime: createTestMockRuntime,
        live: live.dependencies,
      });
      expect(output.kind).toBe('report');
      if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
      expect(output.runStatus).toBe('complete');
      expect(output.lanes.live.latency.router.additionalP95Ms).toBe(expected.maxAdditional);
      expect(output.decisions[0]).toEqual({
        agent: 'router', enabled: expected.enabled, reason: expected.reason,
      });
      expect(parsePhase6943Output(output).ok).toBe(true);
    }
  });

  test('enables Verifier at two of eight conflict hits and disables it at one', async () => {
    for (const expected of [
      { hits: 2, enabled: true, reason: 'quality_gate_passed' },
      { hits: 1, enabled: false, reason: 'insufficient_quality_gain' },
    ]) {
      const live = successfulLiveDependencies({
        candidateForCase: (caseId) => verifierConflictCandidate(caseId, expected.hits),
      });
      const output = await runPhase6943PairedEval({
        runId: `verifier-conflict-${expected.hits}`,
        runKind: 'live', clocks: fakeClocks(),
        createMockRuntime: createTestMockRuntime, live: live.dependencies,
      });
      expect(output.kind).toBe('report');
      if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
      expect(output.runStatus).toBe('complete');
      expect(output.lanes.live.metrics.verifier.complexConflictRecall).toBe(expected.hits / 8);
      expect(output.decisions[0]).toEqual({
        agent: 'router', enabled: true, reason: 'quality_gate_passed',
      });
      expect(output.decisions[1]).toEqual({
        agent: 'verifier', enabled: expected.enabled, reason: expected.reason,
      });
    }
  });

  test('keeps Verifier enabled independently when Router quality fails', async () => {
    const live = successfulLiveDependencies({
      candidateForCase(caseId) {
        const candidate = testCandidateForCase(caseId);
        return caseId.startsWith('router_')
          ? { route: 'chat', confidence: 0.9, reasonCode: 'insufficient_context' }
          : candidate;
      },
    });
    const output = await runPhase6943PairedEval({
      runId: 'independent-router-fail', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('complete');
    expect(output.decisions).toEqual([
      { agent: 'router', enabled: false, reason: 'insufficient_quality_gain' },
      { agent: 'verifier', enabled: true, reason: 'quality_gate_passed' },
    ]);
  });

  test('stops Live after an attempted failure and fills a prior_live_failure tail', async () => {
    const live = successfulLiveDependencies({ failAt: 3 });
    let costCalls = 0;
    const output = await runPhase6943PairedEval({
      runId: 'live-stop-test', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
      calculateCostUsd(usage, snapshot) {
        costCalls += 1;
        if (costCalls >= 3) throw new Error('RAW_USAGE_COST_CANARY');
        return estimateCost(usage, snapshot);
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(3);
    const failureIndex = output.lanes.live.entries.findIndex(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeInvoked && !entry.strictSuccess,
    );
    expect(failureIndex).toBeGreaterThanOrEqual(0);
    expect(output.lanes.live.entries[failureIndex]).toMatchObject({
      entryStatus: 'observed',
      lane: 'live',
      providerAttempted: true,
      strictSuccess: false,
      runtimeErrorCode: 'PROVIDER_ERROR',
      providerFailureCategory: 'http_rate_limit',
    });
    expect(output.lanes.live.entries.slice(failureIndex + 1).every(
      (entry) => entry.entryStatus === 'not_run' && entry.reason === 'prior_live_failure',
    )).toBe(true);
    expect(output.decisions.every((item) => item.reason === 'usage_unverifiable')).toBe(true);
    expect(output.stopEvidence).toBeUndefined();
    expect(JSON.stringify(output)).not.toContain('RAW_USAGE_COST_CANARY');
    expect(JSON.stringify(output)).not.toContain('RAW_PROVIDER_SECRET_CANARY');
  });

  test('classifies a provenance-valid per-case token overage as token_budget_exceeded', async () => {
    const live = successfulLiveDependencies({
      usageForCase: ({ ordinal }) => ordinal === 1
        ? { inputTokens: 2_401, outputTokens: 120 }
        : { inputTokens: 1_000, outputTokens: 10 },
    });
    const output = await runPhase6943PairedEval({
      runId: 'live-token-overage',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
      calculateCostUsd() {
        throw new Error('RAW_TOKEN_COST_CANARY');
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(1);
    expect(output.usage).toEqual({
      inputTokens: 2_401,
      outputTokens: 120,
      providerReported: true,
    });
    expect(output.decisions.every((item) => item.reason === 'token_budget_exceeded')).toBe(true);
    expect(output.stopEvidence).toBeUndefined();
    expect(output.lanes.live.entries.slice(37).every(
      (entry) => entry.entryStatus === 'not_run' && entry.reason === 'budget_exceeded',
    )).toBe(true);
    expect(JSON.stringify(output)).not.toContain('RAW_TOKEN_COST_CANARY');
  });

  test('fails closed when runtime telemetry reports output just above the 400-token ceiling', async () => {
    const live = successfulLiveDependencies({
      usageForCase: ({ ordinal }) => ordinal === 1
        ? { inputTokens: 2_400, outputTokens: 401 }
        : { inputTokens: 1_000, outputTokens: 10 },
    });
    const output = await runPhase6943PairedEval({
      runId: 'live-output-token-overage',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
      calculateCostUsd() {
        throw new Error('RAW_OUTPUT_TOKEN_COST_CANARY');
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(1);
    expect(output.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      providerReported: false,
    });
    expect(output.decisions.every((item) => item.reason === 'usage_unverifiable')).toBe(true);
    expect(output.stopEvidence).toBeUndefined();
    expect(output.lanes.live.entries.slice(37).every(
      (entry) => entry.entryStatus === 'not_run' && entry.reason === 'prior_live_failure',
    )).toBe(true);
    expect(JSON.stringify(output)).not.toContain('RAW_OUTPUT_TOKEN_COST_CANARY');
  });

  test('rejects a strict Live success whose trace belongs to a different run', async () => {
    const live = successfulLiveDependencies({
      traceRunIdHash: `sha256:${'f'.repeat(64)}`,
    });
    const output = await runPhase6943PairedEval({
      runId: 'live-provenance-test',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: live.dependencies,
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(1);
    expect(output.lanes.live.counters).toMatchObject({
      runtimeInvocations: 1,
      providerAttempts: 1,
      strictSuccesses: 0,
    });
    expect(output.decisions.every((item) => item.reason === 'usage_unverifiable')).toBe(true);
  });

  test('contains an unreadable post-call provider counter as usage_unverifiable', async () => {
    const live = successfulLiveDependencies();
    let reads = 0;
    const output = await runPhase6943PairedEval({
      runId: 'live-counter-unavailable',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: {
        ...live.dependencies,
        readProviderAttempts() {
          reads += 1;
          if (reads === 3) throw new Error('RAW_COUNTER_CANARY');
          return live.dependencies.readProviderAttempts();
        },
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
    expect(output.runStatus).toBe('incomplete');
    expect(live.requested).toHaveLength(1);
    expect(output.decisions.every((item) => item.reason === 'usage_unverifiable')).toBe(true);
    expect(JSON.stringify(output)).not.toContain('RAW_COUNTER_CANARY');
  });

  test('distinguishes preflight, pre-provider, provider failure, and strict success boundaries', async () => {
    const scenarios = [
      { kind: 'preflight', runtime: () => ({ invokeStructured() { throw new Error('must not run'); } }), signal: abortedSignal(), expected: [0, 0, 0], category: undefined },
      { kind: 'pre_provider', runtime: () => ({ invokeStructured(request: ModelAgentRequest<unknown>) { return Promise.resolve(structuredFailure(request, 'EXECUTOR_UNAVAILABLE', false)); } }), expected: [1, 0, 0], category: undefined },
      { kind: 'provider_failure', runtime: counterRuntime('failure'), expected: [1, 1, 0], category: 'transport' },
      { kind: 'success', runtime: counterRuntime('success'), expected: [1, 1, 1], category: undefined },
    ] as const;
    for (const scenario of scenarios) {
      let runtimeCalls = 0;
      let providerAttempts = 0;
      const dependencies: Phase6943LiveDependencies = {
        createRuntime(input) {
          const runtime = scenario.runtime(input.caseId, () => { providerAttempts += 1; });
          return { invokeStructured(request) { runtimeCalls += 1; return runtime.invokeStructured(request); } };
        },
        readProviderAttempts: () => providerAttempts,
        pricing,
        budgetState: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      };
      const output = await runPhase6943PairedEval({
        runId: `boundary-${scenario.kind}`, runKind: 'live', clocks: fakeClocks(),
        createMockRuntime: createTestMockRuntime, live: dependencies,
        ...(scenario.signal ? { signal: scenario.signal } : {}),
      });
      expect(output.kind).toBe('report');
      if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
      const firstEligible = output.lanes.live.entries.find(
        (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
          entry.caseId === eligibleCaseIds()[0],
      );
      const observed = firstEligible?.entryStatus === 'observed' && firstEligible.lane === 'live'
        ? [Number(firstEligible.runtimeInvoked), Number(firstEligible.providerAttempted), Number(firstEligible.strictSuccess)]
        : [0, 0, 0];
      expect(observed).toEqual(scenario.expected);
      if (firstEligible?.entryStatus === 'observed' && firstEligible.lane === 'live') {
        if (scenario.category) {
          expect(firstEligible).toMatchObject({ providerFailureCategory: scenario.category });
        } else {
          expect('providerFailureCategory' in firstEligible).toBe(false);
        }
      }
      expect(runtimeCalls).toBe(scenario.kind === 'success' ? 28 : scenario.expected[0]);
      if (scenario.kind === 'preflight') {
        expect(output.decisions.every((item) => item.reason === 'run_incomplete')).toBe(true);
      }
    }
  });

  test('removes provider failure categories at invalid boundaries and from Mock and tail entries', async () => {
    const mismatch = successfulLiveDependencies({
      failAt: 1,
      failureCategory: 'http_server',
    });
    const counterMismatch = await runPhase6943PairedEval({
      runId: 'category-counter-mismatch',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: { ...mismatch.dependencies, readProviderAttempts: () => 0 },
    });
    expect(counterMismatch.kind).toBe('report');
    if (counterMismatch.kind !== 'report' || counterMismatch.runKind !== 'live') {
      throw new Error('expected live counter mismatch');
    }
    expect(counterMismatch.lanes.live.entries.every(
      (entry) => !('providerFailureCategory' in entry),
    )).toBe(true);

    const invalidTrace = successfulLiveDependencies({
      failAt: 1,
      failureCategory: 'transport',
      traceRunIdHash: `sha256:${'f'.repeat(64)}`,
    });
    const invalidSummary = await runPhase6943PairedEval({
      runId: 'category-invalid-summary',
      runKind: 'live',
      clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: invalidTrace.dependencies,
    });
    expect(invalidSummary.kind).toBe('report');
    if (invalidSummary.kind !== 'report' || invalidSummary.runKind !== 'live') {
      throw new Error('expected invalid summary report');
    }
    expect(invalidSummary.lanes.live.entries.every(
      (entry) => !('providerFailureCategory' in entry),
    )).toBe(true);

    let firstMockFailure = true;
    const mock = await runPhase6943PairedEval({
      runId: 'category-mock-strip',
      runKind: 'mock',
      clocks: fakeClocks(),
      createMockRuntime(input) {
        if (!firstMockFailure) return createTestMockRuntime(input);
        firstMockFailure = false;
        return {
          invokeStructured(request) {
            return Promise.resolve(
              structuredFailure(request, 'PROVIDER_ERROR', true, 'http_rate_limit'),
            ) as never;
          },
        };
      },
    });
    expect(mock.kind).toBe('report');
    if (mock.kind !== 'report') throw new Error('expected mock report');
    expect(mock.lanes.mock.entries.every(
      (entry) => !('providerFailureCategory' in entry),
    )).toBe(true);
    expect(JSON.stringify(counterMismatch)).not.toContain('RAW_PROVIDER_SECRET_CANARY');
    expect(JSON.stringify(invalidSummary)).not.toContain('RAW_PROVIDER_SECRET_CANARY');
    expect(JSON.stringify(mock)).not.toContain('RAW_PROVIDER_SECRET_CANARY');
  });

  test('allows exact admission equality and rejects one representable step above', () => {
    expect(canAdmit({ current: 0.09, reservation: 0.01, cap: 0.1 })).toBe(true);
    expect(canAdmit({ current: 0.090000001, reservation: 0.01, cap: 0.1 })).toBe(false);
    expect(canAdmit({ current: 0.09000000000000002, reservation: 0.01, cap: 0.1 })).toBe(false);
    expect(canAdmit({ current: Number.NaN, reservation: 0.01, cap: 0.1 })).toBe(false);
    expect(canAdmit({ current: 0, reservation: Number.POSITIVE_INFINITY, cap: 0.1 })).toBe(false);
    expect(canAdmit({ current: 27, reservation: 1, cap: 28 })).toBe(true);
    expect(canAdmit({ current: 28, reservation: 1, cap: 28 })).toBe(false);
    expect(estimatePhase6943CostUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, pricing)).toBeCloseTo(0.6, 12);
  });

  test('uses cancelled and budget_exceeded not_run reasons without making another Live call', async () => {
    const cancelledLive = successfulLiveDependencies();
    const cancelled = await runPhase6943PairedEval({
      runId: 'cancelled-live', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: cancelledLive.dependencies,
      signal: abortedSignal(),
    });
    expect(cancelled.kind).toBe('report');
    if (cancelled.kind !== 'report' || cancelled.runKind !== 'live') throw new Error('expected live');
    expect(cancelledLive.requested).toHaveLength(0);
    expect(cancelled.lanes.live.entries.every(
      (entry) => entry.entryStatus === 'not_run' && entry.reason === 'cancelled',
    )).toBe(true);

    const budgetedLive = successfulLiveDependencies({
      budgetState: { calls: 28, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    });
    const budgeted = await runPhase6943PairedEval({
      runId: 'budgeted-live', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: budgetedLive.dependencies,
    });
    expect(budgeted).toMatchObject({
      kind: 'invalid_run', errorCode: 'live_config_invalid', runStatus: 'invalid',
    });
    expect(budgetedLive.requested).toHaveLength(0);
  });

  test('rejects every non-zero Live carry-in and initial provider attempt before runtime', async () => {
    const states: Phase6943LiveDependencies['budgetState'][] = [
      { calls: 1, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      { calls: 0, inputTokens: 1, outputTokens: 0, estimatedCostUsd: 0 },
      { calls: 0, inputTokens: 0, outputTokens: 1, estimatedCostUsd: 0 },
      { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.0999 },
    ];
    for (const budgetState of states) {
      const live = successfulLiveDependencies({ budgetState });
      const output = await runPhase6943PairedEval({
        runId: 'non-zero-carry-in', runKind: 'live', clocks: fakeClocks(),
        createMockRuntime: createTestMockRuntime, live: live.dependencies,
      });
      expect(output).toMatchObject({
        kind: 'invalid_run', errorCode: 'live_config_invalid', runStatus: 'invalid',
      });
      expect(live.requested).toHaveLength(0);
    }

    const attempted = successfulLiveDependencies({ initialProviderAttempts: 1 });
    const output = await runPhase6943PairedEval({
      runId: 'provider-carry-in', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: attempted.dependencies,
    });
    expect(output).toMatchObject({
      kind: 'invalid_run', errorCode: 'live_config_invalid', runStatus: 'invalid',
    });
    expect(attempted.requested).toHaveLength(0);

    let runtimeCreations = 0;
    const hostileCounter = await runPhase6943PairedEval({
      runId: 'hostile-provider-counter', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: {
        ...successfulLiveDependencies().dependencies,
        createRuntime() {
          runtimeCreations += 1;
          return createTestMockRuntime({ caseId: eligibleCaseIds()[0]!, agent: 'router' });
        },
        readProviderAttempts() {
          throw new Error('RAW_INITIAL_COUNTER_CANARY');
        },
      },
    });
    expect(hostileCounter).toMatchObject({
      kind: 'invalid_run', errorCode: 'live_config_invalid', runStatus: 'invalid',
    });
    expect(runtimeCreations).toBe(0);
    expect(JSON.stringify(hostileCounter)).not.toContain('RAW_INITIAL_COUNTER_CANARY');
  });

  test('snapshots top-level and nested Live budget getters exactly once', async () => {
    const topLevel = successfulLiveDependencies();
    let topLevelReads = 0;
    const topLevelDependencies = {
      createRuntime: topLevel.dependencies.createRuntime,
      readProviderAttempts: topLevel.dependencies.readProviderAttempts,
      pricing: topLevel.dependencies.pricing,
    } as Phase6943LiveDependencies;
    Object.defineProperty(topLevelDependencies, 'budgetState', {
      enumerable: true,
      get() {
        topLevelReads += 1;
        return topLevelReads === 1
          ? { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
          : { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0.0999 };
      },
    });
    const topLevelOutput = await runPhase6943PairedEval({
      runId: 'stateful-top-level-budget', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: topLevelDependencies,
    });
    expect(topLevelOutput).toMatchObject({ kind: 'report', runStatus: 'complete' });
    expect(topLevelReads).toBe(1);
    expect(topLevel.requested).toHaveLength(28);

    const nested = successfulLiveDependencies();
    const nestedReads = {
      calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
    };
    const nestedBudget = {} as Phase6943LiveDependencies['budgetState'];
    for (const field of Object.keys(nestedReads) as (keyof typeof nestedReads)[]) {
      Object.defineProperty(nestedBudget, field, {
        enumerable: true,
        get() {
          nestedReads[field] += 1;
          return nestedReads[field] === 1 ? 0 : 1;
        },
      });
    }
    const nestedOutput = await runPhase6943PairedEval({
      runId: 'stateful-nested-budget', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: { ...nested.dependencies, budgetState: nestedBudget },
    });
    expect(nestedOutput).toMatchObject({ kind: 'report', runStatus: 'complete' });
    expect(nestedReads).toEqual({
      calls: 1, inputTokens: 1, outputTokens: 1, estimatedCostUsd: 1,
    });
    expect(nested.requested).toHaveLength(28);
  });

  test('snapshots Live method identities without rereading hostile getters', async () => {
    const live = successfulLiveDependencies();
    const reads = { createRuntime: 0, readProviderAttempts: 0 };
    const dependencies = {
      pricing: live.dependencies.pricing,
      budgetState: live.dependencies.budgetState,
    } as Phase6943LiveDependencies;
    for (const method of ['createRuntime', 'readProviderAttempts'] as const) {
      Object.defineProperty(dependencies, method, {
        enumerable: true,
        get() {
          reads[method] += 1;
          if (reads[method] > 1) {
            throw new Error(`RAW_LIVE_METHOD_${method.toUpperCase()}_CANARY`);
          }
          return live.dependencies[method];
        },
      });
    }

    const output = await runPhase6943PairedEval({
      runId: 'stateful-live-methods', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: dependencies,
    });

    expect(output).toMatchObject({ kind: 'report', runStatus: 'complete' });
    expect(reads).toEqual({ createRuntime: 1, readProviderAttempts: 1 });
    expect(live.requested).toHaveLength(28);
    expect(JSON.stringify(output)).not.toContain('RAW_LIVE_METHOD_');
  });

  test('fails closed for invalid clocks, live config, hostile factories, and raw run IDs', async () => {
    const invalidClock = await runPhase6943PairedEval({
      runId: 'clock-invalid', runKind: 'mock',
      clocks: { epochMs: () => Number.NaN, monotonicMs: () => 0 },
      createMockRuntime: createTestMockRuntime,
    });
    expect(invalidClock).toMatchObject({ kind: 'invalid_run', runStatus: 'invalid' });

    const noLive = await runPhase6943PairedEval({
      runId: 'missing-live', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
    });
    expect(noLive).toMatchObject({ kind: 'invalid_run', errorCode: 'live_config_invalid' });

    const hostile = await runPhase6943PairedEval(new Proxy({}, {
      get() { throw new Error('RAW_PROXY_CANARY'); },
    }) as never);
    expect(hostile).toMatchObject({ kind: 'invalid_run', runStatus: 'invalid' });

    const report = await runMock('RAW_UUID_CANARY');
    expect(JSON.stringify(report)).not.toContain('RAW_UUID_CANARY');
  });

  test('does not mutate caller pricing, global budget, or runtime request budgets', async () => {
    const live = successfulLiveDependencies({ mutateRequestBudget: true });
    const pricingBefore = structuredClone(live.dependencies.pricing);
    const budgetBefore = structuredClone(live.dependencies.budgetState);
    await runPhase6943PairedEval({
      runId: 'immutability-test', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: live.dependencies,
    });
    expect(live.dependencies.pricing).toEqual(pricingBefore);
    expect(live.dependencies.budgetState).toEqual(budgetBefore);
    expect(live.requested).toHaveLength(28);
  });

  test('contains nested hostile pricing and runtime getters without leaking canaries', async () => {
    const hostilePricing = Object.defineProperty({}, 'currency', {
      get() { throw new Error('RAW_NESTED_PRICING_CANARY'); },
    });
    const invalid = await runPhase6943PairedEval({
      runId: 'hostile-pricing', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: {
        createRuntime: () => createTestMockRuntime({ caseId: eligibleCaseIds()[0]!, agent: 'router' }),
        readProviderAttempts: () => 0,
        pricing: hostilePricing as Phase6943PricingSnapshot,
        budgetState: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
      },
    });
    expect(invalid).toMatchObject({ kind: 'invalid_run', errorCode: 'live_config_invalid' });
    expect(JSON.stringify(invalid)).not.toContain('RAW_NESTED_PRICING_CANARY');

    const live = successfulLiveDependencies();
    const output = await runPhase6943PairedEval({
      runId: 'hostile-runtime', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: {
        ...live.dependencies,
        createRuntime() {
          return new Proxy({}, {
            get() { throw new Error('RAW_NESTED_RUNTIME_CANARY'); },
          }) as Pick<ModelAgentRuntime, 'invokeStructured'>;
        },
      },
    });
    expect(output.kind).toBe('report');
    if (output.kind === 'report' && output.runKind === 'live') {
      expect(output.decisions.every((item) => item.reason === 'call_boundary_failed')).toBe(true);
    }
    expect(JSON.stringify(output)).not.toContain('RAW_NESTED_RUNTIME_CANARY');
  });

  test('contains NaN, Infinity, and hostile cost seams after strict success', async () => {
    for (const calculateCostUsd of [
      () => Number.NaN,
      () => Number.POSITIVE_INFINITY,
      () => 0,
      (usage: { inputTokens: number; outputTokens: number }, snapshot: Phase6943PricingSnapshot) =>
        estimateCost(usage, snapshot) * 2,
      () => { throw new Error('RAW_COST_THROW_CANARY'); },
    ]) {
      const live = successfulLiveDependencies();
      const output = await runPhase6943PairedEval({
        runId: 'hostile-cost-seam', runKind: 'live', clocks: fakeClocks(),
        createMockRuntime: createTestMockRuntime, live: live.dependencies,
        calculateCostUsd,
      });
      expect(output.kind).toBe('report');
      if (output.kind !== 'report' || output.runKind !== 'live') throw new Error('expected live');
      expect(output.stopEvidence).toEqual({ code: 'cost_unverifiable', costVerified: false });
      expect(output.decisions.every((item) => item.reason === 'cost_unverifiable')).toBe(true);
      expect(JSON.stringify(output)).not.toContain('RAW_COST_THROW_CANARY');
    }

    const hostileInput = Object.defineProperty({
      runId: 'hostile-cost-getter', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: successfulLiveDependencies().dependencies,
    }, 'calculateCostUsd', {
      get() { throw new Error('RAW_COST_GETTER_CANARY'); },
    });
    const invalid = await runPhase6943PairedEval(hostileInput as never);
    expect(invalid).toMatchObject({ kind: 'invalid_run', runStatus: 'invalid' });
    expect(JSON.stringify(invalid)).not.toContain('RAW_COST_GETTER_CANARY');
  });

  test('contains nested hostile global budget state and preserves dataset fixtures', async () => {
    const datasetBefore = JSON.stringify([...phase6941RouterCases, ...phase6941VerifierCases]);
    const fixtureBefore = JSON.stringify({ ROUTER_CANDIDATES, VERIFIER_CANDIDATES });
    const live = successfulLiveDependencies();
    const hostileBudget = new Proxy({}, {
      get() { throw new Error('RAW_BUDGET_PROXY_CANARY'); },
    });
    const output = await runPhase6943PairedEval({
      runId: 'hostile-budget', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime,
      live: {
        ...live.dependencies,
        budgetState: hostileBudget as Phase6943LiveDependencies['budgetState'],
      },
    });
    expect(output).toMatchObject({ kind: 'invalid_run', errorCode: 'live_config_invalid' });
    expect(live.requested).toHaveLength(0);
    expect(JSON.stringify(output)).not.toContain('RAW_BUDGET_PROXY_CANARY');
    expect(JSON.stringify([...phase6941RouterCases, ...phase6941VerifierCases])).toBe(datasetBefore);
    expect(JSON.stringify({ ROUTER_CANDIDATES, VERIFIER_CANDIDATES })).toBe(fixtureBefore);
  });

  test('produces all five top-level runner variants with strict parsing', async () => {
    const mockComplete = await runMock('variant-mock-complete');
    const mockIncomplete = await runPhase6943PairedEval({
      runId: 'variant-mock-incomplete', runKind: 'mock', clocks: fakeClocks(),
      createMockRuntime(input) {
        if (input.caseId === eligibleCaseIds()[0]) {
          return createModelAgentRuntime({
            mode: 'mock', provider: 'mock', model: 'phase-6-9-4-3-test-fixture-v1',
            liveCallsEnabled: false, timeoutMs: 100, mockResponder: () => ({ malformed: true }),
          });
        }
        return createTestMockRuntime(input);
      },
    });
    const liveCompleteFixture = successfulLiveDependencies();
    const liveComplete = await runPhase6943PairedEval({
      runId: 'variant-live-complete', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: liveCompleteFixture.dependencies,
    });
    const liveIncompleteFixture = successfulLiveDependencies();
    const liveIncomplete = await runPhase6943PairedEval({
      runId: 'variant-live-incomplete', runKind: 'live', clocks: fakeClocks(),
      createMockRuntime: createTestMockRuntime, live: liveIncompleteFixture.dependencies,
      calculateCostUsd: () => Number.NaN,
    });
    const invalidRun = await runPhase6943PairedEval({
      runId: '', runKind: 'mock', clocks: fakeClocks(), createMockRuntime: createTestMockRuntime,
    });
    expect([mockComplete, mockIncomplete, liveComplete, liveIncomplete, invalidRun].map((item) =>
      item.kind === 'invalid_run' ? 'invalid' : `${item.runKind}:${item.runStatus}`,
    )).toEqual(['mock:complete', 'mock:incomplete', 'live:complete', 'live:incomplete', 'invalid']);
    for (const output of [mockComplete, mockIncomplete, liveComplete, liveIncomplete, invalidRun]) {
      expect(parsePhase6943Output(output).ok).toBe(true);
    }
  });
});

async function runMock(runId = 'phase6943-test-run') {
  return runPhase6943PairedEval({
    runId, runKind: 'mock', clocks: fakeClocks(), createMockRuntime: createTestMockRuntime,
  });
}

function eligibleCaseIds() {
  return [...phase6941RouterCases, ...phase6941VerifierCases]
    .filter((item) => item.candidateEligible)
    .map((item) => item.id);
}

function orderedLatencyClocks(): Phase6943Clocks {
  let epoch = Date.UTC(2026, 6, 13);
  let calls = 0;
  let monotonic = 0;
  let routerEligible = 0;
  let verifierEligible = 0;
  const candidateDurations = [
    ...phase6941RouterCases,
    ...phase6941VerifierCases,
  ].map((item) => {
    if (!item.candidateEligible) return 1;
    if (item.agent === 'router') return ++routerEligible;
    return ++verifierEligible;
  });
  return {
    epochMs: () => epoch++,
    monotonicMs() {
      calls += 1;
      const value = monotonic;
      if (calls >= 2 && calls <= 201 && calls % 2 === 0) monotonic += 20;
      if (calls >= 202 && calls <= 401 && calls % 2 === 0) {
        const caseIndex = (calls - 202) / 2;
        monotonic += candidateDurations[caseIndex] ?? 0;
      }
      return value;
    },
  };
}

function backwardClocks(): Phase6943Clocks {
  let epoch = Date.UTC(2026, 6, 13);
  let calls = 0;
  return {
    epochMs: () => epoch++,
    monotonicMs() {
      calls += 1;
      if (calls === 1) return 0;
      if (calls === 2) return 10;
      if (calls === 3) return 9;
      return 100 + calls;
    },
  };
}

function abortedSignal() {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
}

function structuredFailure(
  request: ModelAgentRequest<unknown>,
  code: 'TIMEOUT' | 'ABORTED' | 'CALL_BUDGET_EXCEEDED' | 'EXECUTOR_UNAVAILABLE' | 'PROVIDER_ERROR',
  reserved: boolean,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ModelAgentResult<never> {
  const reservation = reserveModelAgentBudget(request.budget, {
    inputTokens: request.estimatedInputTokens,
    outputTokens: request.maxOutputTokens,
  });
  if (!reservation.ok) throw new Error('expected reservation');
  const budget = reserved ? reservation.budget : request.budget;
  return {
    ok: false,
    error: {
      code,
      message: providerFailureCategory
        ? 'RAW_PROVIDER_SECRET_CANARY'
        : 'sanitized failure',
      retryable: code === 'TIMEOUT' || code === 'PROVIDER_ERROR',
      ...(code === 'PROVIDER_ERROR' && providerFailureCategory
        ? { providerFailureCategory }
        : {}),
    },
    budget,
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash: hashModelAgentRunId(request.runId), task: request.task, mode: 'mock', provider: 'mock',
      model: 'phase-6-9-4-3-test-fixture-v1', status: 'failed', inputTokens: 0, outputTokens: 0,
      maxOutputTokens: request.maxOutputTokens, durationMs: 0, degraded: true, errorCode: code,
      ...(code === 'PROVIDER_ERROR' && providerFailureCategory
        ? { providerFailureCategory }
        : {}),
    },
  };
}

function successfulLiveDependencies(options: {
  failAt?: number;
  failureCategory?: ModelAgentProviderFailureCategory;
  budgetState?: Phase6943LiveDependencies['budgetState'];
  mutateRequestBudget?: boolean;
  traceRunIdHash?: string;
  usageForCase?: (input: {
    caseId: string;
    agent: 'router' | 'verifier';
    ordinal: number;
  }) => { inputTokens: number; outputTokens: number };
  pricing?: Phase6943PricingSnapshot;
  candidateForCase?: (caseId: string) => Candidate;
  initialProviderAttempts?: number;
} = {}) {
  let providerAttempts = options.initialProviderAttempts ?? 0;
  let active = 0;
  let maxActive = 0;
  const requested: string[] = [];
  const dependencies: Phase6943LiveDependencies = {
    createRuntime(input) {
      requested.push(input.caseId);
      const ordinal = requested.length;
      return {
        async invokeStructured(request) {
          active += 1;
          maxActive = Math.max(maxActive, active);
          try {
            providerAttempts += 1;
            const reservation = reserveModelAgentBudget(request.budget, {
              inputTokens: request.estimatedInputTokens,
              outputTokens: request.maxOutputTokens,
            });
            if (!reservation.ok) throw new Error('expected reservation');
            if (options.mutateRequestBudget) request.budget.usedCalls = 99;
            if (ordinal === options.failAt) {
              const failure = structuredFailure(
                { ...request, budget: options.mutateRequestBudget ? { ...request.budget, usedCalls: 0 } : request.budget },
                'PROVIDER_ERROR', true, options.failureCategory ?? 'http_rate_limit',
              );
              return {
                ...failure,
                trace: {
                  ...failure.trace,
                  ...(options.traceRunIdHash ? { runIdHash: options.traceRunIdHash } : {}),
                  mode: 'live',
                  provider: 'deepseek',
                  model: 'deepseek-v4-flash',
                },
              } as never;
            }
            const usage = options.usageForCase?.({
              caseId: input.caseId,
              agent: input.agent,
              ordinal,
            }) ?? { inputTokens: 1_000, outputTokens: 10 };
            return {
              ok: true,
              data: options.candidateForCase?.(input.caseId) ?? testCandidateForCase(input.caseId),
              budget: reservation.budget,
              usage,
              trace: {
                runIdHash: options.traceRunIdHash ?? hashModelAgentRunId(request.runId), task: request.task, mode: 'live', provider: 'deepseek',
                model: 'deepseek-v4-flash', status: 'succeeded', ...usage,
                maxOutputTokens: request.maxOutputTokens, durationMs: 1, degraded: false,
              },
            } as never;
          } finally {
            active -= 1;
          }
        },
      };
    },
    readProviderAttempts: () => providerAttempts,
    pricing: options.pricing ?? pricing,
    budgetState: options.budgetState ?? {
      calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0,
    },
  };
  return { dependencies, requested, maxConcurrency: () => maxActive };
}

function estimateCost(
  usage: { inputTokens: number; outputTokens: number },
  snapshot: Phase6943PricingSnapshot,
) {
  return (usage.inputTokens / snapshot.unitTokens) * snapshot.inputUsdPerMillion +
    (usage.outputTokens / snapshot.unitTokens) * snapshot.outputUsdPerMillion;
}

function verifierConflictCandidate(caseId: string, hits: number): Candidate {
  if (!caseId.startsWith('verifier_conflict_')) return testCandidateForCase(caseId);
  const conflictIds = Object.keys(VERIFIER_CANDIDATES)
    .filter((id) => id.startsWith('verifier_conflict_'));
  return conflictIds.indexOf(caseId) < hits
    ? { status: 'conflict', evidenceCodes: ['condition_conflict'] }
    : { status: 'suspicious', evidenceCodes: ['stale_or_uncertain'] };
}

function liveLatencyClocks(routerP95: number): Phase6943Clocks {
  let epoch = Date.UTC(2026, 6, 13);
  let calls = 0;
  let monotonic = 0;
  let routerEligible = 0;
  const liveDurations = [...phase6941RouterCases, ...phase6941VerifierCases].map((item) => {
    if (!item.candidateEligible) return 0;
    if (item.agent === 'router') {
      routerEligible += 1;
      return routerEligible === 16 ? routerP95 : 1;
    }
    return 1;
  });
  return {
    epochMs: () => epoch++,
    monotonicMs() {
      calls += 1;
      const value = monotonic;
      if (calls >= 402 && calls <= 601 && calls % 2 === 0) {
        monotonic += liveDurations[(calls - 402) / 2] ?? 0;
      }
      return value;
    },
  };
}

function counterRuntime(mode: 'success' | 'failure') {
  return (caseId: string, onProvider: () => void): Pick<ModelAgentRuntime, 'invokeStructured'> => ({
    invokeStructured(request) {
      onProvider();
      const reservation = reserveModelAgentBudget(request.budget, {
        inputTokens: request.estimatedInputTokens, outputTokens: request.maxOutputTokens,
      });
      if (!reservation.ok) throw new Error('expected reservation');
      if (mode === 'failure') {
        const failure = structuredFailure(request, 'PROVIDER_ERROR', true, 'transport');
        return Promise.resolve({
          ...failure,
          trace: { ...failure.trace, mode: 'live', provider: 'deepseek', model: 'deepseek-v4-flash' },
        }) as never;
      }
      const usage = { inputTokens: 1_000, outputTokens: 10 };
      return Promise.resolve({
        ok: true, data: testCandidateForCase(caseId), budget: reservation.budget, usage,
        trace: {
          runIdHash: hashModelAgentRunId(request.runId), task: request.task, mode: 'live', provider: 'deepseek',
          model: 'deepseek-v4-flash', status: 'succeeded', ...usage,
          maxOutputTokens: request.maxOutputTokens, durationMs: 1, degraded: false,
        },
      }) as never;
    },
  });
}
