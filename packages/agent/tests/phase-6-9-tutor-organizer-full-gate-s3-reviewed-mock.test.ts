import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  buildPhase697FullGateDeterministicBaseline,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts';
import {
  consumePhase697FullGateProxyAttestation,
  createPhase697FullGateSyntheticProxyAttestationForTest,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-authority.ts';
import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
  PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  journalRelativePath,
  reservePhase697FullGateAttempt,
  validatePhase697FullGateBundle,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import {
  computePhase697FullGateCanonicalSha256,
  PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION,
  PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FROZEN_SHA256,
  createPhase697FullGateReviewedMockHarness,
  type Phase697FullGateReviewedMockContractFault,
  type Phase697FullGateReviewedMockFault,
  type Phase697FullGateReviewedMockRequestAudit,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-mock.ts';
import type { Phase697FullGateHarness } from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';
import { runPhase697TutorOrganizerFullGate } from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';
import { phase697V2OrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  createF2MemoryLifecycle,
  createF2Source,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';

const FROZEN_MANIFEST_SHA = 'e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78';
const FROZEN_BASELINE_AUTHORITY_SHA =
  '2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2';
const FROZEN_BASELINE_REPORT_SHA =
  '16c574b1cf9f22beace9ac4c60fb098989795752fb57421ef957795b5f4782c9';
const FROZEN_BASELINE_FILE_SHA = '16aa1773d3774380eac7e7379601c1f812d9c920ef8f81e6f91a6ab5ae8a6f73';
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 full-gate S3 reviewed Mock', () => {
  test('pins the full manifest, baseline, source hashes and reviewed factory identity', () => {
    const fresh = buildPhase697FullGateDeterministicBaseline();

    expect(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256).toBe(FROZEN_MANIFEST_SHA);
    expect(computePhase697FullGateCanonicalSha256(fresh.authority)).toBe(
      FROZEN_BASELINE_AUTHORITY_SHA,
    );
    expect(computePhase697FullGateCanonicalSha256(fresh)).toBe(FROZEN_BASELINE_REPORT_SHA);
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256).toBe(FROZEN_BASELINE_AUTHORITY_SHA);
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256).toBe(FROZEN_BASELINE_REPORT_SHA);
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256).toBe(FROZEN_BASELINE_FILE_SHA);
    expect(PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-full-gate-reviewed-mock-v1',
    );
    expect(PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FACTORY_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FROZEN_SHA256,
    );
    expect(Object.keys(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES)).toHaveLength(7);
    expect(fresh.authority.providerInvocations).toBe(0);
  });

  test('crosses both production candidates, strict validators, local mergers, adapter and F2 runner', async () => {
    const requests: Phase697FullGateReviewedMockRequestAudit[] = [];
    let globalFetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      globalFetchCalls += 1;
      return Promise.reject(new Error('S3_GLOBAL_FETCH_FORBIDDEN'));
    }) as typeof fetch;
    let result: Awaited<ReturnType<typeof runReviewedMock>>;
    try {
      result = await runReviewedMock({ onRequest: (request) => requests.push(request) });
    } finally {
      globalThis.fetch = originalFetch;
    }
    const { report, memory } = result;

    expect(globalFetchCalls).toBe(0);
    expect(report).toMatchObject({
      mode: 'mock',
      executorProvenance: 'mock_synthetic',
      counts: {
        cases: 72,
        guards: 24,
        runtimePairs: 24,
        runtimeLanes: 48,
        organizerDecisionUnits: 32,
      },
      runtimeAccounting: {
        reservedEntries: 48,
        terminalEntries: 48,
        orphanedEntries: 0,
        notStartedEntries: 0,
      },
      wire: {
        complete: true,
        executorEntered: 48,
        providerDispatchStarted: 48,
        providerResponseReceived: 48,
        verifiedUsageObserved: 48,
      },
      metrics: {
        complete: true,
        tutorSemanticScore: 1,
        organizerSemanticScore: 0.9968750000000001,
        combinedSemanticScore: 0.9984375000000001,
        tutorInvalidCases: 0,
        organizerInvalidDecisions: 0,
        tutorFullMatches: 24,
        organizerFullMatches: 31,
        strictRuntimeSuccesses: 48,
        l2AnchorSubset: {
          complete: true,
          tutorSemanticScore: 1,
          organizerSemanticScore: 1,
          combinedSemanticScore: 1,
          tutorInvalidCases: 0,
          organizerInvalidDecisions: 0,
          passed: true,
        },
      },
      safety: {
        guardVerifiedZeroCalls: 24,
        criticalFailures: 0,
        permissionFailures: 0,
        mutationFailures: 0,
        broaderFallbacks: 0,
        lockedNameChanges: 0,
        writeCommandLeaks: 0,
      },
      breaker: { opened: false, reason: null },
      gate: 'full_gate_mock_quality_not_evidence',
      qualityAuthority: 'none',
    });
    expect(report.metrics.tutorAbsoluteImprovement).toBeGreaterThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.semantic.tutorAbsoluteImprovementMin,
    );
    expect(report.metrics.organizerAbsoluteImprovement).toBeGreaterThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.semantic.organizerAbsoluteImprovementMin,
    );
    expect(report.latency).toMatchObject({
      complete: true,
      tutorSampleCount: 24,
      organizerSampleCount: 24,
      pairedSampleCount: 24,
      tutorOrchestrationSampleCount: 24,
    });
    expect(report.latency.tutorCandidateP95Ms).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorCandidateP95MaxMs,
    );
    expect(report.latency.organizerCandidateP95Ms).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.organizerCandidateP95MaxMs,
    );
    expect(report.latency.pairedCandidateP95Ms).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.pairedCandidateP95MaxMs,
    );
    expect(report.latency.tutorOrchestrationP95Ms).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.latency.tutorOrchestrationP95MaxMs,
    );
    expect(report.usage.complete).toBe(true);
    expect(report.usage.providerInvocations).toBe(48);
    expect(report.usage.verifiedRuntimeCases).toBe(48);
    expect(report.usage.inputTokens).toBeGreaterThan(0);
    expect(report.usage.inputTokens).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.inputTokensMax,
    );
    expect(report.usage.outputTokens).toBeGreaterThan(0);
    expect(report.usage.outputTokens).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.outputTokensMax,
    );
    expect(report.usage.estimatedCostCny).toBeGreaterThan(0);
    expect(report.usage.estimatedCostCny).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.totalCostCnyMax,
    );

    expect(requests).toHaveLength(48);
    expect(new Set(requests.map((request) => request.caseId))).toEqual(
      new Set(
        report.caseEntries
          .filter((entry) => entry.executionKind === 'runtime')
          .map((entry) => entry.caseId),
      ),
    );
    for (const request of requests) {
      expect(request.url).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(request.maxOutputTokens).toBe(request.agent === 'tutor' ? 300 : 800);
      expect(request.systemPrompt).toContain(
        request.agent === 'tutor'
          ? 'policyVersion=tutor-model-candidate-v6'
          : 'policyVersion=wrong-question-organizer-model-candidate-v9',
      );
      const promptBytes = `${request.systemPrompt}\n${request.userPrompt}`;
      for (const forbidden of [
        request.caseId,
        'acceptedTopicLabels',
        'expectedIntent',
        'expectedDepth',
        'owner-a',
        'PHASE_6_9_7_TUTOR_ORGANIZER_FULL_GATE_L3_DEEPSEEK_API_KEY',
      ]) {
        expect(promptBytes).not.toContain(forbidden);
      }
    }
    expect(memory.trace.filter((event) => event.startsWith('guard:'))).toHaveLength(24);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.startsWith('terminal:'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.startsWith('pair:'))).toHaveLength(24);

    const lockedSource = phase697V2OrganizerCases.find(
      (entry) => entry.id === 'organizer-v2-runtime-23',
    );
    const lockedEntry = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-23',
    );
    expect(lockedSource?.input.existingDecks.some((deck) => deck.nameLocked)).toBe(true);
    expect(lockedEntry?.safety).toMatchObject({
      criticalFailure: false,
      lockedNameChanged: false,
      writeCommandLeaked: false,
    });
  });

  test('publishes only into an isolated temp root and passes strict bundle recomputation', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const source = createF2Source();
    const reservation = await reserveS3SyntheticAttempt(root, runId);
    const report = await runPhase697TutorOrganizerFullGate({
      runId,
      runScope: 'branch',
      approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
      sourceHashes: source.sourceHashes,
      harness: createPhase697FullGateReviewedMockHarness({ runId, runScope: 'branch' }),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const published = await reservation.publishArtifact(report);
    const validation = await validatePhase697FullGateBundle({ root });

    expect(report.gate).toBe('full_gate_mock_quality_not_evidence');
    expect(report.qualityAuthority).toBe('none');
    expect(validation).toMatchObject({
      ok: true,
      runId,
      gate: 'full_gate_mock_quality_not_evidence',
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
    });
    expect(validation.physicalArtifactSha256).toBe(published.evidenceSha256);
    const events = (await readFile(resolve(root, journalRelativePath(runId)), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { event: string })
      .map((record) => record.event);
    expect(events.filter((event) => event === 'guard_terminal')).toHaveLength(24);
    expect(events.filter((event) => event === 'lane_reserved')).toHaveLength(48);
    expect(events.filter((event) => event === 'wire_stage')).toHaveLength(384);
    expect(events.filter((event) => event === 'lane_terminal')).toHaveLength(48);
    expect(events.filter((event) => event === 'pair_terminal')).toHaveLength(24);
    expect(events.slice(-3)).toEqual(['run_terminal', 'publication_started', 'evidence_published']);
  });

  test.each([
    ['fetch_sync_throw', 'transport', 1],
    ['http_rate_limit', 'http', 2],
    ['malformed_completion_json', 'schema', 2],
    ['selection_numeric_string', 'schema', 2],
    ['usage_zero', 'usage', 2],
  ] as const)(
    'maps the reviewed Organizer %s fault, closes its sibling, and opens the fixed breaker',
    async (fault, expectedCategory, expectedRequests) => {
      const requests: Phase697FullGateReviewedMockRequestAudit[] = [];
      const { report, memory } = await runReviewedMock({
        faults: { 'organizer-v2-runtime-01': fault },
        onRequest: (request) => requests.push(request),
      });
      const organizer = report.caseEntries.find(
        (entry) => entry.caseId === 'organizer-v2-runtime-01',
      );
      const tutor = report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01');

      expect(organizer).toMatchObject({
        disposition: 'attempted_failed',
        failureCategory: expectedCategory,
        strictRuntimeSuccess: false,
        durationMs: null,
        orchestrationDurationMs: null,
        usage: null,
        semantic: null,
      });
      expect(tutor).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expect(report.wire.complete).toBe(false);
      expect(report.metrics.complete).toBe(false);
      expect(report.metrics.combinedSemanticScore).toBeNull();
      expect(report.latency.complete).toBe(false);
      expect(report.usage.complete).toBe(false);
      expect(report.breaker).toEqual({ opened: true, reason: expectedCategory });
      expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(2);
      expect(requests).toHaveLength(expectedRequests);
    },
  );

  test.each([
    ['semantic_axes_drift', false],
    ['write_command_leak', true],
  ] as const)(
    'fails closed on the post-candidate %s contract fault',
    async (fault, writeCommandLeaked) => {
      const { report } = await runReviewedMock({
        contractFaults: { 'organizer-v2-runtime-01': fault },
      });
      const organizer = report.caseEntries.find(
        (entry) => entry.caseId === 'organizer-v2-runtime-01',
      );

      expect(organizer).toMatchObject({
        disposition: 'attempted_failed',
        failureCategory: 'dynamic_authority',
        strictRuntimeSuccess: false,
        semantic: null,
        usage: null,
        safety: { criticalFailure: true, writeCommandLeaked },
      });
      expect(report.breaker).toEqual({ opened: true, reason: 'dynamic_authority' });
      expect(report.runtimeAccounting.notStartedEntries).toBe(46);
      expect(report.gate).toBe('full_gate_mock_quality_not_evidence');
      expect(report.qualityAuthority).toBe('none');
    },
  );

  test('keeps an ordinary semantic mismatch on the fixed denominator without opening the breaker', async () => {
    const runId = randomUUID();
    const base = createPhase697FullGateReviewedMockHarness({ runId, runScope: 'branch' });
    const harness: Phase697FullGateHarness = Object.freeze({
      ...base,
      async runTutor(entry, signal, wireCapability) {
        const result = await base.runTutor(entry, signal, wireCapability);
        if (entry.id !== 'tutor-v2-runtime-01' || result.semantic?.agent !== 'tutor') return result;
        return Object.freeze({
          ...result,
          semantic: Object.freeze({
            agent: 'tutor' as const,
            observation: Object.freeze({
              ...result.semantic.observation,
              actualDepth:
                result.semantic.observation.expectedDepth === 'brief'
                  ? ('deep' as const)
                  : ('brief' as const),
            }),
          }),
        });
      },
    });
    const { report } = await runReviewedMock({ runId, harness });

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      orphanedEntries: 0,
      notStartedEntries: 0,
    });
    expect(report.metrics.complete).toBe(true);
    expect(report.metrics.tutorSemanticScore).toBeLessThan(1);
    expect(report.metrics.tutorSemanticScore).toBeGreaterThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.semantic.tutorMin,
    );
    expect(report.breaker).toEqual({ opened: false, reason: null });
    expect(report.gate).toBe('full_gate_mock_quality_not_evidence');
    expect(report.qualityAuthority).toBe('none');
  });

  test('keeps a pre-aborted run at zero runtime dispatch and fixed external-abort accounting', async () => {
    const controller = new AbortController();
    controller.abort('synthetic-s3-pre-abort');
    const requests: Phase697FullGateReviewedMockRequestAudit[] = [];
    const { report, memory } = await runReviewedMock({
      signal: controller.signal,
      onRequest: (request) => requests.push(request),
    });

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 48,
    });
    expect(report.wire).toEqual({
      complete: false,
      executorEntered: 0,
      providerDispatchStarted: 0,
      providerResponseReceived: 0,
      verifiedUsageObserved: 0,
    });
    expect(report.breaker).toEqual({ opened: true, reason: 'external_abort' });
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.latency.tutorCandidateP95Ms).toBeNull();
    expect(report.usage.estimatedCostCny).toBeNull();
    expect(requests).toHaveLength(0);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(0);
  });

  test('rejects unknown cases, unknown faults, and agent-incompatible fault shapes', () => {
    const base = { runId: randomUUID(), runScope: 'branch' as const };
    expect(() =>
      createPhase697FullGateReviewedMockHarness({
        ...base,
        faults: { 'organizer-v2-runtime-99': 'fetch_reject' },
      }),
    ).toThrow('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FAULT_INVALID');
    expect(() =>
      createPhase697FullGateReviewedMockHarness({
        ...base,
        faults: {
          'organizer-v2-runtime-01': 'misspelled_fault' as Phase697FullGateReviewedMockFault,
        },
      }),
    ).toThrow('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FAULT_INVALID');
    expect(() =>
      createPhase697FullGateReviewedMockHarness({
        ...base,
        faults: { 'tutor-v2-runtime-01': 'selection_wrapper' },
      }),
    ).toThrow('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_FAULT_INVALID');
    expect(() =>
      createPhase697FullGateReviewedMockHarness({
        ...base,
        contractFaults: { 'tutor-v2-runtime-01': 'write_command_leak' },
      }),
    ).toThrow('PHASE_6_9_7_FULL_GATE_REVIEWED_MOCK_CONTRACT_FAULT_INVALID');
  });

  test('keeps the reviewed composition isolated from Live authority, credentials and answer oracles', async () => {
    const [fullMockSource, liveSource, smallMockSource, v9ResponderSource, v7ResponderSource] =
      await Promise.all([
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-organizer-full-gate-mock.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-organizer-full-gate-live.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-organizer-small-sample-mock.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-wrong-question-v7-mock.ts', import.meta.url),
        ).text(),
      ]);

    for (const forbidden of [
      'process.env',
      'createPhase697FullGateLiveHarness',
      'deepseek_network',
      'controlled_live',
      '.expected',
    ]) {
      expect(fullMockSource).not.toContain(forbidden);
    }
    for (const responderSource of [v9ResponderSource, v7ResponderSource]) {
      expect(responderSource).not.toContain('.expected');
      expect(responderSource).not.toContain('PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES');
    }
    for (const required of [
      'createPhase697SmallSampleReviewedMockHarness',
      'mock_quality_not_evidence',
      'qualityAuthority',
      'faultAdmission',
    ]) {
      expect(fullMockSource).toContain(required);
    }
    for (const required of [
      'rebuildTutorActual',
      'rebuildOrganizerActual',
      'detectLockedNameChange',
      'PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA',
    ]) {
      expect(smallMockSource).toContain(required);
    }
    expect(liveSource).not.toContain('createPhase697FullGateReviewedMockHarness');
  });
});

async function runReviewedMock(
  input: {
    runId?: string;
    harness?: Phase697FullGateHarness;
    faults?: Readonly<Record<string, Phase697FullGateReviewedMockFault | undefined>>;
    contractFaults?: Readonly<
      Record<string, Phase697FullGateReviewedMockContractFault | undefined>
    >;
    onRequest?: (request: Phase697FullGateReviewedMockRequestAudit) => void;
    signal?: AbortSignal;
  } = {},
) {
  const runId = input.runId ?? randomUUID();
  const source = createF2Source();
  const memory = createF2MemoryLifecycle();
  const report = await runPhase697TutorOrganizerFullGate({
    runId,
    runScope: 'branch',
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: source.sourceHashes,
    harness:
      input.harness ??
      createPhase697FullGateReviewedMockHarness({
        runId,
        runScope: 'branch',
        faults: input.faults,
        contractFaults: input.contractFaults,
        onRequest: input.onRequest,
      }),
    lifecycle: memory.lifecycle,
    signal: input.signal ?? new AbortController().signal,
  });
  return { report, memory };
}

async function reserveS3SyntheticAttempt(root: string, runId: string) {
  const attestation = createPhase697FullGateSyntheticProxyAttestationForTest();
  const consumed = consumePhase697FullGateProxyAttestation(attestation, 'synthetic_test');
  return reservePhase697FullGateAttempt({
    root,
    runId,
    runScope: 'branch',
    authority: 'synthetic_test',
    mode: 'mock',
    executorProvenance: 'mock_synthetic',
    createdAt: '2026-08-01T10:00:00.000Z',
    source: createF2Source(),
    proxyAttestation: consumed,
  });
}

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'phase-6-9-7-full-gate-s3-'));
  roots.push(root);
  return root;
}
