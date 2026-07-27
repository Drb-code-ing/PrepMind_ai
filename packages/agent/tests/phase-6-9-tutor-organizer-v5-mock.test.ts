import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, test } from 'bun:test';

import * as V5MockPublic from '@repo/agent/phase-6-9-7-v5-mock';

import { executePhase697TutorOrganizerV5Cli } from '../scripts/phase-6-9-7-tutor-wrong-question-v5-cli.ts';
import { PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  createPhase697TutorOrganizerV5MockHarness,
  type Phase697V5MockRequestAudit,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-mock.ts';
import { runPhase697TutorOrganizerPairedEvalV5 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import { PHASE_6_9_7_V5_MARKER_PATH } from '../src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts';
import { validatePhase697TutorOrganizerV5EvidenceBundle } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Phase 6.9.7 V5 R5 reviewed Mock factory', () => {
  test('is publicly exported and exercises all frozen cases through the real V5 candidates', async () => {
    expect(V5MockPublic.createPhase697TutorOrganizerV5MockHarness).toBe(
      createPhase697TutorOrganizerV5MockHarness,
    );
    const requests: Phase697V5MockRequestAudit[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV5(
      createPhase697TutorOrganizerV5MockHarness({
        runId: '00000000-0000-4000-8000-000000000551',
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
    expect(report.safety.verifiedZeroCalls).toBe(24);
    expect(report.metrics).toEqual({
      complete: true,
      strictRuntimeSuccesses: 48,
      tutorSemanticScore: 1,
      organizerSemanticScore: 1,
      combinedSemanticScore: 1,
    });
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: true,
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
      maxConcurrentPairs: 1,
      maxConcurrentLaneOperations: 2,
    });
    expect(report.ledger).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      duplicateDispatchRejected: 0,
    });
    expect(report.usage).toMatchObject({
      complete: true,
      providerInvocations: 48,
      verifiedRuntimeCases: 48,
      outputTokens: 0,
      estimatedCostCny: 0,
    });
    expect(requests).toHaveLength(48);
    expect(requests.filter((request) => request.agent === 'tutor')).toHaveLength(24);
    expect(requests.filter((request) => request.agent === 'wrong_question_organizer')).toHaveLength(
      24,
    );
    expect(report.gate).toBe('mock_quality_not_evidence');
  });

  test('keeps frozen oracle fields, raw case ids, and V1-V4 identities out of actual prompts', async () => {
    const requests: Phase697V5MockRequestAudit[] = [];
    await runPhase697TutorOrganizerPairedEvalV5(
      createPhase697TutorOrganizerV5MockHarness({
        runId: '00000000-0000-4000-8000-000000000552',
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
      'tutor-model-candidate-v1',
      'tutor-model-candidate-v2',
      'tutor-model-candidate-v3',
      'tutor-model-candidate-v4',
      'wrong-question-organizer-model-candidate-v1',
      'wrong-question-organizer-model-candidate-v2',
      'wrong-question-organizer-model-candidate-v3',
      'wrong-question-organizer-model-candidate-v4',
      ...PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((entry) => entry.id),
    ];
    for (const request of requests) {
      const prompt = `${request.systemPrompt}\n${request.userPrompt}`;
      expect(
        forbidden.filter((token) => token.length > 1 && prompt.includes(token)),
        request.caseId,
      ).toEqual([]);
    }
  });

  test('is byte-stable apart from the caller-owned run id', async () => {
    const first = await runPhase697TutorOrganizerPairedEvalV5(
      createPhase697TutorOrganizerV5MockHarness({
        runId: '00000000-0000-4000-8000-000000000553',
        runScope: 'branch',
      }),
    );
    const second = await runPhase697TutorOrganizerPairedEvalV5(
      createPhase697TutorOrganizerV5MockHarness({
        runId: '00000000-0000-4000-8000-000000000554',
        runScope: 'branch',
      }),
    );
    expect({ ...second, runId: first.runId }).toEqual(first);
  });

  test('lets the public CLI publish Mock evidence by default without reserving Live state', async () => {
    const root = await temporaryRoot();
    const result = await executePhase697TutorOrganizerV5Cli({
      argv: ['mock'],
      env: {},
      repositoryRoot: root,
      runId: '00000000-0000-4000-8000-000000000555',
    });
    expect(result).toMatchObject({
      ok: true,
      gate: 'mock_quality_not_evidence',
      disposition: 'mock_direct',
      counts: { cases: 72, zeroCallCases: 24, runtimeCases: 48 },
      usage: { providerInvocations: 48, verifiedRuntimeCases: 48 },
    });
    if (!result.ok) throw new Error('default V5 Mock CLI failed');
    expect(await Bun.file(resolve(root, PHASE_6_9_7_V5_MARKER_PATH)).exists()).toBe(false);
    expect(
      await validatePhase697TutorOrganizerV5EvidenceBundle({
        root,
        evidencePath: resolve(root, result.evidencePath),
      }),
    ).toEqual({ ok: true });
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'phase-697-v5-r5-mock-'));
  temporaryRoots.push(root);
  return root;
}
