import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import * as V6MockPublic from '@repo/agent/phase-6-9-7-v6-mock';

import { executePhase697TutorOrganizerV6Cli } from '../scripts/phase-6-9-7-tutor-wrong-question-v6-cli.ts';
import {
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import { validatePhase697TutorOrganizerV4EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';
import { validatePhase697TutorOrganizerV5EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';
import {
  validatePhase697TutorOrganizerV6EvidenceBundle,
  validatePhase697TutorOrganizerV6EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v6-evidence.ts';
import { PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_MARKER_PATH,
  PHASE_6_9_7_V6_RECOVERY_CLAIM_PATH,
  buildPhase697V6EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import { phase697V6JournalPath } from '../src/evals/phase-6-9-tutor-wrong-question-v6-durability-contract.ts';
import {
  createPhase697TutorOrganizerV6MockHarness,
  type Phase697V6MockRequestAudit,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-mock.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from '../src/evals/phase-6-9-tutor-wrong-question-v6-policy.ts';
import { runPhase697TutorOrganizerPairedEvalV6 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Phase 6.9.7 V6 R4 reviewed Mock factory', () => {
  test('is publicly exported and exercises all frozen cases through real V6 candidates', async () => {
    expect(V6MockPublic.createPhase697TutorOrganizerV6MockHarness).toBe(
      createPhase697TutorOrganizerV6MockHarness,
    );
    const requests: Phase697V6MockRequestAudit[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697TutorOrganizerV6MockHarness({
        runId: '00000000-0000-4000-8000-000000000641',
        runScope: 'branch',
        onRequest: (request) => requests.push(request),
      }),
    );

    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.safety).toEqual({
      verifiedZeroCalls: 24,
      criticalFailures: 0,
      providerFailures: 0,
      permissionFailures: 0,
      mutationFailures: 0,
      broaderFallbacks: 0,
    });
    expect(report.metrics).toEqual({
      complete: true,
      strictRuntimeSuccesses: 48,
      tutorSemanticScore: 1,
      organizerSemanticScore: 1,
      combinedSemanticScore: 1,
    });
    expect(report.modelOwnedMetrics).toEqual({
      tutorIntent: { correct: 24, denominator: 24, accuracy: 1, complete: true, passed: true },
      organizerSubjectDecision: {
        correct: 32,
        denominator: 32,
        accuracy: 1,
        complete: true,
        passed: true,
      },
      organizerDeckAction: {
        correct: 32,
        denominator: 32,
        accuracy: 1,
        complete: true,
        passed: true,
      },
      organizerTargetOrdinal: {
        correct: 32,
        denominator: 32,
        accuracy: 1,
        complete: true,
        passed: true,
      },
      qualityGatePassed: true,
    });
    expect(report.latency.complete).toBe(true);
    expect(report.latency.tutorCandidateP95Ms).not.toBeNull();
    expect(report.latency.organizerCandidateP95Ms).not.toBeNull();
    expect(report.latency.pairedCandidateP95Ms).not.toBeNull();
    expect(report.latency.tutorOrchestrationP95Ms).not.toBeNull();
    expect(report.latency.tutorCandidateP95Ms!).toBeLessThanOrEqual(
      PHASE_6_9_7_V6_EVAL_POLICY.latency.tutorCandidateP95Max,
    );
    expect(report.latency.organizerCandidateP95Ms!).toBeLessThanOrEqual(
      PHASE_6_9_7_V6_EVAL_POLICY.latency.organizerCandidateP95Max,
    );
    expect(report.latency.pairedCandidateP95Ms!).toBeLessThanOrEqual(
      PHASE_6_9_7_V6_EVAL_POLICY.latency.pairedCandidateP95Max,
    );
    expect(report.latency.tutorOrchestrationP95Ms!).toBeLessThanOrEqual(
      PHASE_6_9_7_V6_EVAL_POLICY.latency.tutorOrchestrationP95Max,
    );
    expect(report.usage).toMatchObject({
      complete: true,
      providerInvocations: 48,
      verifiedRuntimeCases: 48,
      estimatedCostCny: 0,
    });
    expect(report.usage.inputTokens).toBeGreaterThan(0);
    expect(report.usage.outputTokens).toBeGreaterThan(0);
    expect(requests).toHaveLength(48);
    expect(requests.filter((request) => request.agent === 'tutor')).toHaveLength(24);
    expect(requests.filter((request) => request.agent === 'wrong_question_organizer')).toHaveLength(
      24,
    );
    expect(report.gate).toBe('mock_quality_not_evidence');
  });

  test('keeps oracle fields, raw case ids, and V1-V5 identities out of actual prompts', async () => {
    const requests: Phase697V6MockRequestAudit[] = [];
    await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697TutorOrganizerV6MockHarness({
        runId: '00000000-0000-4000-8000-000000000642',
        runScope: 'branch',
        onRequest: (request) => requests.push(request),
      }),
    );
    const forbidden = [
      'expected',
      'oracle',
      'acceptedTopicLabels',
      'canonicalTopicLabel',
      'topicCandidateIndex',
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      ...[1, 2, 3, 4, 5].flatMap((version) => [
        'tutor-model-candidate-v' + version,
        'wrong-question-organizer-model-candidate-v' + version,
      ]),
      ...PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((entry) => entry.id),
    ];
    for (const request of requests) {
      const prompt = request.systemPrompt + '\n' + request.userPrompt;
      expect(
        forbidden.filter((token) => token.length > 1 && prompt.includes(token)),
        request.caseId,
      ).toEqual([]);
    }
  });

  test('publishes default Mock evidence, validates V6 lineage, and leaves Live state absent', async () => {
    const root = await temporaryRoot();
    const runId = '00000000-0000-4000-8000-000000000643';
    const result = await executePhase697TutorOrganizerV6Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId,
    });
    expect(result).toMatchObject({
      ok: true,
      gate: 'mock_quality_not_evidence',
      disposition: 'mock_direct',
      counts: { cases: 72, zeroCallCases: 24, runtimeCases: 48 },
      usage: { providerInvocations: 48, verifiedRuntimeCases: 48 },
    });
    if (!result.ok) throw new Error('default V6 Mock CLI failed');
    const evidencePath = resolve(root, result.evidencePath);
    expect(await validatePhase697TutorOrganizerV6EvidenceBundle({ root, evidencePath })).toEqual({
      ok: true,
    });
    const envelope = JSON.parse(await Bun.file(evidencePath).text());
    expect(validatePhase697TutorOrganizerV6EvidenceValue(envelope)).toEqual({ ok: true });
    for (const validateHistorical of [
      validatePhase697TutorOrganizerEvidenceValue,
      validatePhase697TutorOrganizerV2EvidenceValue,
      validatePhase697TutorOrganizerV3EvidenceValue,
      validatePhase697TutorOrganizerV4EvidenceValue,
      validatePhase697TutorOrganizerV5EvidenceValue,
    ]) {
      expect(validateHistorical(envelope)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
    }
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V6_MARKER_PATH)).exists()).toBe(false);
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V6_RECOVERY_CLAIM_PATH)).exists()).toBe(false);
    expect(await Bun.file(resolve(root, phase697V6JournalPath(runId))).exists()).toBe(false);

    await rm(evidencePath);
    expect(await Bun.file(evidencePath).exists()).toBe(false);
    expect(await readdir(resolve(root, '.tmp'))).toEqual([]);
  });

  test('builds a native V6 Mock envelope without any Live durability binding', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697TutorOrganizerV6MockHarness({
        runId: '00000000-0000-4000-8000-000000000644',
        runScope: 'branch',
      }),
    );
    const envelope = buildPhase697V6EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    expect(envelope).not.toBeNull();
    expect(validatePhase697TutorOrganizerV6EvidenceValue(envelope)).toEqual({ ok: true });
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'phase-697-v6-r4-mock-'));
  temporaryRoots.push(root);
  return root;
}
