import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
  buildPhase697SmallSampleDeterministicBaseline,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts';
import { computePhase697SmallSampleCanonicalSha256 } from '../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts';
import { PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import { phase697V2OrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION,
  PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FROZEN_SHA256,
  createPhase697SmallSampleReviewedMockHarness,
  type Phase697SmallSampleReviewedMockContractFault,
  type Phase697SmallSampleReviewedMockFault,
  type Phase697SmallSampleReviewedMockRequestAudit,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-mock.ts';
import { runPhase697TutorOrganizerSmallSample } from '../src/evals/run-phase-6-9-tutor-organizer-small-sample.ts';
import {
  createG2MemoryLifecycle,
  createG2Source,
} from './phase-6-9-tutor-organizer-small-sample-g2-helpers.ts';

const FROZEN_BASELINE_AUTHORITY_SHA =
  'd36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e';
const FROZEN_BASELINE_REPORT_SHA =
  'ad3aa54d61a5890c777358edebdfd3a65c6faa2ba7f68ff562afbad09259d002';
const FROZEN_BASELINE_FILE_SHA = 'e8bcbcb57afd23b9ec3dd8f3614550a13df629bd8105a4d350b5ada4b0aa658b';

describe('Phase 6.9.7 small-sample S2 reviewed Mock', () => {
  test('recomputes the frozen deterministic baseline before the reviewed Mock checkpoint', () => {
    const fresh = buildPhase697SmallSampleDeterministicBaseline();

    expect(computePhase697SmallSampleCanonicalSha256(fresh.authority)).toBe(
      FROZEN_BASELINE_AUTHORITY_SHA,
    );
    expect(computePhase697SmallSampleCanonicalSha256(fresh)).toBe(FROZEN_BASELINE_REPORT_SHA);
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256).toBe(FROZEN_BASELINE_AUTHORITY_SHA);
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256).toBe(FROZEN_BASELINE_REPORT_SHA);
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256).toBe(FROZEN_BASELINE_FILE_SHA);
    expect(fresh.authority.providerInvocations).toBe(0);
  });

  test('crosses both reviewed candidates, validators, local mergers, adapter and G2 runner', async () => {
    const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
    const { report, memory } = await runReviewedMock({
      onRequest: (request) => requests.push(request),
    });

    expect(PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-small-sample-reviewed-mock-v1',
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FROZEN_SHA256,
    );
    expect(report).toMatchObject({
      mode: 'mock',
      executorProvenance: 'mock_synthetic',
      counts: {
        guards: 8,
        runtimePairs: 8,
        runtimeLanes: 16,
        organizerDecisionUnits: 12,
      },
      runtimeAccounting: {
        reservedEntries: 16,
        terminalEntries: 16,
        orphanedEntries: 0,
        notStartedEntries: 0,
      },
      wire: {
        complete: true,
        executorEntered: 16,
        providerDispatchStarted: 16,
        providerResponseReceived: 16,
        verifiedUsageObserved: 16,
      },
      metrics: {
        complete: true,
        strictRuntimeSuccesses: 16,
        tutorSemanticScore: 1,
        organizerSemanticScore: 1,
        combinedSemanticScore: 1,
        tutorInvalidCases: 0,
        organizerInvalidDecisions: 0,
      },
      safety: {
        guardVerifiedZeroCalls: 8,
        criticalFailures: 0,
        permissionFailures: 0,
        mutationFailures: 0,
        broaderFallbacks: 0,
        lockedNameChanges: 0,
        writeCommandLeaks: 0,
      },
      gate: 'mock_quality_not_evidence',
    });
    expect(report.usage.complete).toBe(true);
    expect(report.usage.verifiedRuntimeCases).toBe(16);
    expect(report.usage.inputTokens).toBeGreaterThan(0);
    expect(report.usage.outputTokens).toBeGreaterThan(0);
    expect(report.latency).toMatchObject({
      complete: true,
      tutorSampleCount: 8,
      organizerSampleCount: 8,
      tutorP95Ms: null,
      organizerP95Ms: null,
      pairedP95Ms: null,
      p95Reason: 'insufficient_sample_size_8',
    });

    expect(requests).toHaveLength(16);
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
        'shortlistFingerprint',
        'optionSetFingerprint',
        'owner-a',
        'synthetic-v9-r4-key',
        'PHASE_6_9_7_TUTOR_ORGANIZER_SMALL_SAMPLE_L2_DEEPSEEK_API_KEY',
      ]) {
        expect(promptBytes).not.toContain(forbidden);
      }
    }
    expect(memory.trace.filter((event) => event.startsWith('guard:'))).toHaveLength(8);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(16);
    expect(memory.trace.filter((event) => event.startsWith('terminal:'))).toHaveLength(16);

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
    expect(lockedEntry?.semantic?.agent).toBe('wrong_question_organizer');
    if (lockedEntry?.semantic?.agent === 'wrong_question_organizer') {
      const reused = lockedEntry.semantic.observations.find(
        (observation) => observation.actualDeckAction === 'reuse_existing',
      );
      expect(reused?.actualTopicLabel).toBe('信号与系统');
    }
  });

  test.each([
    ['fetch_sync_throw', 'transport', 1],
    ['fetch_reject', 'transport', 2],
    ['http_auth', 'http', 2],
    ['http_rate_limit', 'http', 2],
    ['http_client', 'http', 2],
    ['http_server', 'http', 2],
    ['abnormal_status', 'schema', 2],
    ['empty_response', 'schema', 2],
    ['malformed_response_json', 'schema', 2],
    ['reasoning_content', 'schema', 2],
    ['positive_reasoning_tokens', 'schema', 2],
    ['missing_completion', 'schema', 2],
    ['malformed_completion_json', 'schema', 2],
    ['schema_mismatch', 'schema', 2],
    ['selection_wrapper', 'schema', 2],
    ['selection_extra_field', 'schema', 2],
    ['selection_numeric_string', 'schema', 2],
    ['selection_missing_option', 'schema', 2],
    ['selection_question_out_of_range', 'schema', 2],
    ['selection_option_out_of_range', 'schema', 2],
    ['usage_missing', 'usage', 2],
    ['usage_zero', 'usage', 2],
    ['usage_negative', 'usage', 2],
    ['usage_fractional', 'usage', 2],
    ['usage_overflow', 'usage', 2],
  ] as const)(
    'maps the reviewed Organizer %s fault without retry, backfill, or aggregate invention',
    async (fault, expectedCategory, expectedRequests) => {
      const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
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
        usage: null,
        semantic: null,
      });
      expect(tutor).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 14,
      });
      expect(report.metrics.complete).toBe(false);
      expect(report.metrics.tutorSemanticScore).toBeNull();
      expect(report.metrics.organizerSemanticScore).toBeNull();
      expect(report.metrics.combinedSemanticScore).toBeNull();
      expect(report.usage.complete).toBe(false);
      expect(report.usage.inputTokens).toBeNull();
      expect(report.breaker).toEqual({ opened: true, reason: expectedCategory });
      expect(
        memory.trace.filter((event) => event === 'reserve:organizer-v2-runtime-01'),
      ).toHaveLength(1);
      expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(2);
      expect(requests).toHaveLength(expectedRequests);
    },
  );

  test('fails closed when post-candidate semantic axes drift from the rebuilt local result', async () => {
    const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
    const { report, memory } = await runReviewedMock({
      contractFaults: { 'organizer-v2-runtime-01': 'semantic_axes_drift' },
      onRequest: (request) => requests.push(request),
    });
    const organizer = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-01',
    );

    expect(organizer).toMatchObject({
      disposition: 'attempted_failed',
      failureCategory: 'dynamic_authority',
      strictRuntimeSuccess: false,
      usage: null,
      semantic: null,
    });
    expect(report.breaker).toEqual({ opened: true, reason: 'dynamic_authority' });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 14,
    });
    expect(report.metrics.complete).toBe(false);
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.usage.complete).toBe(false);
    expect(report.usage.estimatedCostCny).toBeNull();
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(2);
    expect(requests).toHaveLength(2);
  });

  test('turns a post-candidate write-command shape into an explicit safety failure', async () => {
    const { report } = await runReviewedMock({
      contractFaults: { 'organizer-v2-runtime-01': 'write_command_leak' },
    });
    const organizer = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-01',
    );

    expect(organizer).toMatchObject({
      disposition: 'attempted_failed',
      failureCategory: 'dynamic_authority',
      safety: {
        criticalFailure: true,
        writeCommandLeaked: true,
      },
      semantic: null,
      usage: null,
    });
    expect(report.safety.writeCommandLeaks).toBe(1);
    expect(report.gate).toBe('mock_quality_not_evidence');
  });

  test('keeps a pre-aborted run at zero runtime dispatch', async () => {
    const controller = new AbortController();
    controller.abort('synthetic-s2-pre-abort');
    const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
    const { report, memory } = await runReviewedMock({
      signal: controller.signal,
      onRequest: (request) => requests.push(request),
    });

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 16,
    });
    expect(report.wire).toEqual({
      complete: false,
      executorEntered: 0,
      providerDispatchStarted: 0,
      providerResponseReceived: 0,
      verifiedUsageObserved: 0,
    });
    expect(report.breaker).toEqual({ opened: true, reason: 'external_abort' });
    expect(requests).toHaveLength(0);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(0);
  });

  test('closes both admitted lanes locally when the parent aborts mid-pair', async () => {
    const controller = new AbortController();
    const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
    const { report } = await runReviewedMock({
      signal: controller.signal,
      onRequest: (request) => {
        requests.push(request);
        if (requests.length === 2) controller.abort('synthetic-s2-mid-pair-abort');
      },
    });

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 14,
    });
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'attempted_aborted'),
    ).toHaveLength(2);
    expect(
      report.caseEntries.filter((entry) => entry.disposition === 'not_started_external_abort'),
    ).toHaveLength(14);
    expect(report.breaker).toEqual({ opened: true, reason: 'external_abort' });
    expect(requests).toHaveLength(2);
  });

  test('uses the Tutor hard timeout and preserves the completed Organizer sibling', async () => {
    const startedAt = performance.now();
    const { report } = await runReviewedMock({
      faults: { 'tutor-v2-runtime-01': 'ignore_abort' },
    });
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(3_400);
    expect(elapsed).toBeLessThan(4_500);
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01'),
    ).toMatchObject({ disposition: 'attempted_failed', failureCategory: 'timeout' });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 14,
    });
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.usage.estimatedCostCny).toBeNull();
  });

  test('uses the Organizer hard timeout and preserves the completed Tutor sibling', async () => {
    const requests: Phase697SmallSampleReviewedMockRequestAudit[] = [];
    const startedAt = performance.now();
    const { report } = await runReviewedMock({
      faults: { 'organizer-v2-runtime-01': 'ignore_abort' },
      onRequest: (request) => requests.push(request),
    });
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(4_900);
    expect(elapsed).toBeLessThan(6_000);
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ disposition: 'attempted_failed', failureCategory: 'timeout' });
    expect(
      report.caseEntries.find((entry) => entry.caseId === 'tutor-v2-runtime-01'),
    ).toMatchObject({ disposition: 'succeeded', strictRuntimeSuccess: true });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 14,
    });
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.usage.estimatedCostCny).toBeNull();
    expect(report.latency.complete).toBe(false);
    expect(report.latency.pairedP95Ms).toBeNull();
    expect(requests).toHaveLength(2);
  }, 7_000);

  test('rejects write-command-shaped model decisions before they can enter scorer safety', () => {
    expect(
      PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA.safeParse({
        agent: 'tutor',
        intent: 'socratic_hint',
        writeCommand: 'UPDATE wrong_questions SET subject = other',
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA.safeParse({
        agent: 'wrong_question_organizer',
        decisions: [
          {
            decisionId: 'organizer-v2-runtime-01:q0',
            subjectDecision: { action: 'keep_local' },
            deckAction: 'create_topic',
            targetOrdinal: 0,
            writeCommand: { action: 'rename_locked_deck' },
          },
        ],
      }).success,
    ).toBe(false);
  });

  test('keeps the reviewed Mock composition isolated from Live authority and oracle responders', async () => {
    const [smallSampleSource, liveSource, v9ResponderSource, v7ResponderSource] = await Promise.all(
      [
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-organizer-small-sample-mock.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-organizer-small-sample-live.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-wrong-question-v9-mock.ts', import.meta.url),
        ).text(),
        Bun.file(
          new URL('../src/evals/phase-6-9-tutor-wrong-question-v7-mock.ts', import.meta.url),
        ).text(),
      ],
    );

    for (const forbidden of [
      'process.env',
      'readPhase697SmallSampleCredential',
      'createPhase697SmallSampleLiveHarness',
      'deepseek_network',
      'controlled_live',
    ]) {
      expect(smallSampleSource).not.toContain(forbidden);
    }
    for (const responderSource of [v9ResponderSource, v7ResponderSource]) {
      expect(responderSource).not.toContain('.expected');
      expect(responderSource).not.toContain('PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES');
    }
    for (const forbidden of ['alternateDepth', 'alternateSubject', 'alternateConfidence']) {
      expect(smallSampleSource).not.toContain(forbidden);
    }
    for (const required of [
      'rebuildTutorActual',
      'rebuildOrganizerActual',
      'detectLockedNameChange',
      'PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA',
    ]) {
      expect(smallSampleSource).toContain(required);
    }
    for (const evidenceSignal of ['question_semantic', 'v6LocalShortlist', 'error_type']) {
      expect(smallSampleSource).toContain(evidenceSignal);
      expect(liveSource).toContain(evidenceSignal);
    }
  });
});

async function runReviewedMock(
  input: {
    faults?: Readonly<Record<string, Phase697SmallSampleReviewedMockFault | undefined>>;
    contractFaults?: Readonly<
      Record<string, Phase697SmallSampleReviewedMockContractFault | undefined>
    >;
    onRequest?: (request: Phase697SmallSampleReviewedMockRequestAudit) => void;
    signal?: AbortSignal;
  } = {},
) {
  const runId = randomUUID();
  const source = createG2Source();
  const memory = createG2MemoryLifecycle();
  const report = await runPhase697TutorOrganizerSmallSample({
    runId,
    runScope: 'branch',
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: source.sourceHashes,
    harness: createPhase697SmallSampleReviewedMockHarness({
      runId,
      runScope: 'branch',
      ...input,
    }),
    lifecycle: memory.lifecycle,
    signal: input.signal ?? new AbortController().signal,
  });
  return { report, memory };
}
