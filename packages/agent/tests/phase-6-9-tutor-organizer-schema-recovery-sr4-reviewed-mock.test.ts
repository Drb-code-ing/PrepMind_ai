import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  buildPhase697FullGateDeterministicBaseline,
  validatePhase697FullGateBaselineFile,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts';
import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
  PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA,
  buildPhase697FullGateReport,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts';
import { computePhase697FullGateCanonicalSha256 } from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
  PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA,
  parsePhase697SchemaRecoveryReport,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH,
  reservePhase697SchemaRecoverySyntheticAttemptForTest,
  schemaRecoveryJournalRelativePath,
  validatePhase697SchemaRecoveryBundle,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS,
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_SHA256,
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_VERSION,
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_CHECKPOINT_SHA256,
  PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_SHA256,
  createPhase697SchemaRecoveryReviewedMockHarness,
  type Phase697SchemaRecoveryReviewedMockInput,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-mock.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';
import type { Phase697FullGateReviewedMockRequestAudit } from '../src/evals/phase-6-9-tutor-organizer-full-gate-mock.ts';
import {
  createSr3MemoryLifecycle,
  createSr3Source,
} from './phase-6-9-tutor-organizer-schema-recovery-sr3-helpers.ts';

const roots: string[] = [];
const REPOSITORY_ROOT = resolve(import.meta.dir, '../../..');

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 Schema Recovery SR4 reviewed Mock/static', () => {
  test('rebuilds the frozen deterministic baseline and pins the independent SR4 identities', () => {
    const fresh = buildPhase697FullGateDeterministicBaseline();
    const validation = validatePhase697FullGateBaselineFile(
      PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES,
    );

    expect(computePhase697FullGateCanonicalSha256(fresh.authority)).toBe(
      PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
    );
    expect(computePhase697FullGateCanonicalSha256(fresh)).toBe(
      PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
    );
    expect(validation).toEqual({
      ok: true,
      reportLogicalSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
      physicalFileSha256: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
    });
    expect(fresh.authority.providerInvocations).toBe(0);
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-schema-recovery-reviewed-mock-v1',
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FACTORY_SHA256).toBe(
      PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_SHA256,
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_CHECKPOINT_SHA256).toBe(
      PHASE_6_9_7_SCHEMA_RECOVERY_REVIEWED_MOCK_FROZEN_CHECKPOINT_SHA256,
    );
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS).toEqual([
      'tutor-v2-runtime-04',
      'tutor-v2-runtime-08',
      'tutor-v2-runtime-12',
      'tutor-v2-runtime-16',
      'tutor-v2-runtime-20',
      'tutor-v2-runtime-24',
    ]);
  });

  test('crosses recovery Tutor, Organizer V9, first-party adapters and the SR3 fixed-denominator runner', async () => {
    const requests: Phase697FullGateReviewedMockRequestAudit[] = [];
    let globalFetchCalls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      globalFetchCalls += 1;
      return Promise.reject(new Error('SR4_GLOBAL_FETCH_FORBIDDEN'));
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
      schemaAccounting: {
        complete: true,
        canonical: 42,
        extensionFieldsDiscarded: 6,
        rejected: 0,
        notObserved: 0,
      },
      metrics: {
        complete: true,
        tutorSemanticScore: 1,
        organizerSemanticScore: 0.9968750000000001,
        combinedSemanticScore: 0.9984375000000001,
        tutorInvalidCases: 0,
        organizerInvalidDecisions: 0,
        strictRuntimeSuccesses: 48,
        l2AnchorSubset: { complete: true, combinedSemanticScore: 1, passed: true },
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
      gate: 'schema_recovery_mock_quality_not_evidence',
      qualityAuthority: 'none',
    });
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
    expect(report.usage).toMatchObject({
      complete: true,
      providerInvocations: 48,
      verifiedRuntimeCases: 48,
    });
    expect(report.usage.inputTokens).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.inputTokensMax,
    );
    expect(report.usage.outputTokens).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.outputTokensMax,
    );
    expect(report.usage.estimatedCostCny).toBeLessThanOrEqual(
      PHASE_6_9_7_FULL_GATE_EVAL_POLICY.budget.totalCostCnyMax,
    );

    expect(requests).toHaveLength(48);
    expect(requests.filter((request) => request.agent === 'tutor')).toHaveLength(24);
    expect(requests.filter((request) => request.agent === 'wrong_question_organizer')).toHaveLength(
      24,
    );
    for (const request of requests) {
      expect(request.url).toBe('https://api.deepseek.com/v1/chat/completions');
      expect(request.maxOutputTokens).toBe(request.agent === 'tutor' ? 300 : 800);
      const promptBytes = `${request.systemPrompt}\n${request.userPrompt}`;
      for (const forbidden of [
        request.caseId,
        'expectedIntent',
        'expectedDepth',
        'acceptedTopicLabels',
        'pairedRunIndex',
        'PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR5_DEEPSEEK_API_KEY',
      ]) {
        expect(promptBytes).not.toContain(forbidden);
      }
    }

    const extensions = report.caseEntries.filter(
      (entry) => entry.schema.outcome === 'extension_fields_discarded',
    );
    expect(extensions.map((entry) => entry.base.caseId)).toEqual(
      PHASE_6_9_7_SCHEMA_RECOVERY_EXTENSION_TUTOR_CASE_IDS,
    );
    expect(
      extensions.every(
        (entry) =>
          entry.schema.diagnostic?.stage === 'applied' &&
          entry.schema.diagnostic.rawDataRetained === false,
      ),
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain('schema-recovery-sr4-extension-must-not-escape');
    expect(memory.trace.filter((event) => event.startsWith('guard:'))).toHaveLength(24);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.endsWith(':started'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.endsWith(':succeeded'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.startsWith('terminal:'))).toHaveLength(48);
    expect(memory.trace.filter((event) => event.startsWith('pair:'))).toHaveLength(24);
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA.safeParse(report).success).toBe(true);
  });

  test('publishes only in an isolated temp root and passes strict SR3 bundle recomputation', async () => {
    const root = await temporaryRoot();
    const runId = randomUUID();
    const source = createSr3Source();
    const reservation = await reservePhase697SchemaRecoverySyntheticAttemptForTest({
      root,
      runId,
      runScope: 'branch',
      mode: 'mock',
      executorProvenance: 'mock_synthetic',
      createdAt: '2026-08-02T12:00:00.000Z',
      source,
    });
    const report = await runPhase697TutorOrganizerSchemaRecovery({
      runId,
      runScope: 'branch',
      source,
      harness: createPhase697SchemaRecoveryReviewedMockHarness({ runId, runScope: 'branch' }),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const published = await reservation.publishArtifact(report);
    const validation = await validatePhase697SchemaRecoveryBundle({ root });

    expect(validation).toMatchObject({
      ok: true,
      runId,
      gate: 'schema_recovery_mock_quality_not_evidence',
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
    });
    expect(validation.physicalArtifactSha256).toBe(published.evidenceSha256);
    const journal = (
      await readFile(resolve(root, schemaRecoveryJournalRelativePath(runId)), 'utf8')
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { event: string });
    const events = journal.map((record) => record.event);
    expect(events.filter((event) => event === 'guard_terminal')).toHaveLength(24);
    expect(events.filter((event) => event === 'lane_reserved')).toHaveLength(48);
    expect(events.filter((event) => event === 'schema_stage_started')).toHaveLength(48);
    expect(events.filter((event) => event === 'wire_stage')).toHaveLength(384);
    expect(events.filter((event) => event === 'schema_stage_succeeded')).toHaveLength(48);
    expect(events.filter((event) => event === 'schema_stage_failed')).toHaveLength(0);
    expect(events.filter((event) => event === 'lane_terminal')).toHaveLength(48);
    expect(events.filter((event) => event === 'pair_terminal')).toHaveLength(24);
    expect(events.slice(-3)).toEqual(['run_terminal', 'publication_started', 'evidence_published']);
  });

  test.each([
    ['tutor-v2-runtime-01', 'malformed_completion_json', 'schema', 'rejected', 1, 46],
    ['tutor-v2-runtime-01', 'usage_missing', 'usage', 'rejected', 1, 46],
    ['tutor-v2-runtime-01', 'fetch_reject', 'transport', 'not_observed', 0, 47],
    ['organizer-v2-runtime-01', 'selection_numeric_string', 'schema', 'rejected', 1, 46],
  ] as const)(
    'fails %s/%s closed, settles its sibling once, and keeps fixed denominator accounting',
    async (caseId, fault, expectedCategory, expectedSchema, rejected, notObserved) => {
      const requests: Phase697FullGateReviewedMockRequestAudit[] = [];
      const { report, memory } = await runReviewedMock({
        faults: { [caseId]: fault },
        onRequest: (request) => requests.push(request),
      });
      const failed = report.caseEntries.find((entry) => entry.base.caseId === caseId);
      const siblingCaseId = caseId.startsWith('tutor')
        ? 'organizer-v2-runtime-01'
        : 'tutor-v2-runtime-01';
      const sibling = report.caseEntries.find((entry) => entry.base.caseId === siblingCaseId);

      expect(failed).toMatchObject({
        base: {
          disposition: 'attempted_failed',
          failureCategory: expectedCategory,
          strictRuntimeSuccess: false,
          usage: null,
          semantic: null,
        },
        schema: { outcome: expectedSchema },
      });
      expect(sibling?.base.disposition).toBe('succeeded');
      expect(report.runtimeAccounting).toEqual({
        reservedEntries: 2,
        terminalEntries: 2,
        orphanedEntries: 0,
        notStartedEntries: 46,
      });
      expect(report.schemaAccounting).toMatchObject({
        complete: false,
        rejected,
        notObserved,
      });
      expect(report.metrics.combinedSemanticScore).toBeNull();
      expect(report.latency.pairedCandidateP95Ms).toBeNull();
      expect(report.usage.estimatedCostCny).toBeNull();
      expect(report.breaker).toEqual({ opened: true, reason: expectedCategory });
      expect(report.gate).toBe('schema_recovery_mock_quality_not_evidence');
      expect(report.qualityAuthority).toBe('none');
      expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(2);
      expect(requests).toHaveLength(2);
    },
  );

  test('keeps pre-abort at zero runtime dispatch with all schema observations not observed', async () => {
    const controller = new AbortController();
    controller.abort('synthetic-sr4-pre-abort');
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
    expect(report.schemaAccounting).toEqual({
      complete: false,
      canonical: 0,
      extensionFieldsDiscarded: 0,
      rejected: 0,
      notObserved: 48,
    });
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.usage.estimatedCostCny).toBeNull();
    expect(requests).toHaveLength(0);
    expect(memory.trace.filter((event) => event.startsWith('reserve:'))).toHaveLength(0);
  });

  test('keeps the responder anti-oracle, formal SR5 files absent, and old/new lineages mutually rejecting', async () => {
    const source = await readFile(
      resolve(
        REPOSITORY_ROOT,
        'packages/agent/src/evals/phase-6-9-tutor-organizer-schema-recovery-mock.ts',
      ),
      'utf8',
    );
    const responder = source.slice(
      source.indexOf('function createTutorSyntheticFetch'),
      source.indexOf('function parseTutorDirectRequest'),
    );
    for (const forbidden of [
      '.expected',
      'oracle',
      'scorer',
      'phase697V2TutorCases',
      'PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES',
    ]) {
      expect(responder).not.toContain(forbidden);
    }
    for (const forbidden of [
      'process.env',
      'Bun.env',
      'globalThis.fetch',
      'createPhase697FullGateLiveHarness',
      'reservePhase697SchemaRecoverySyntheticAttemptForTest',
      'runPhase697TutorOrganizerSchemaRecovery(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    for (const required of [
      'runTutorSchemaRecoveryModelCandidate',
      'createPhase697FullGateReviewedMockHarness',
      'createFirstPartyDeepSeekV4ProDirectAdapter',
      "executorProvenance: 'mock_synthetic'",
      "authority: 'schema_recovery_mock_quality_not_evidence'",
      "qualityAuthority: 'none'",
      'providerCalls: 0',
    ]) {
      expect(source).toContain(required);
    }

    const tmpEntries = await readdir(resolve(REPOSITORY_ROOT, '.tmp')).catch(() => [] as string[]);
    const formal = tmpEntries.filter((entry) =>
      /^phase-6-9-7-tutor-organizer-schema-recovery-sr5-/u.test(entry),
    );
    expect(formal).toHaveLength(0);
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_MARKER_RELATIVE_PATH).toContain(
      'schema-recovery-sr5-controlled-live.marker',
    );

    const { report } = await runReviewedMock();
    const oldReport = buildPhase697FullGateReport({
      runId: report.runId,
      runScope: report.runScope,
      mode: report.mode,
      executorProvenance: report.executorProvenance,
      approvedRunnableSourceCommit: report.approvedRunnableSourceCommit,
      caseEntries: report.caseEntries.map((entry) => entry.base),
    });
    expect(PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.safeParse(report).success).toBe(false);
    expect(parsePhase697SchemaRecoveryReport(oldReport)).toBeNull();
    expect(parsePhase697SchemaRecoveryReport(report)).toEqual(report);
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED).toEqual({
      outcome: 'not_observed',
      diagnostic: null,
    });
  });
});

async function runReviewedMock(
  input: Partial<
    Pick<Phase697SchemaRecoveryReviewedMockInput, 'faults' | 'contractFaults' | 'onRequest'>
  > & { signal?: AbortSignal } = {},
) {
  const runId = randomUUID();
  const source = createSr3Source();
  const memory = createSr3MemoryLifecycle();
  const report = await runPhase697TutorOrganizerSchemaRecovery({
    runId,
    runScope: 'branch',
    source,
    harness: createPhase697SchemaRecoveryReviewedMockHarness({
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

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), 'phase-6-9-7-schema-recovery-sr4-'));
  roots.push(root);
  return root;
}
