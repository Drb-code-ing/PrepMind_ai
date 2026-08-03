import { describe, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_LIVE_CONFIRMATION,
  PHASE_6_9_7_V2_LIVE_CONFIRMATION,
  executePhase697TutorOrganizerV2Cli,
  executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest,
  parsePhase697TutorOrganizerCli,
  parsePhase697TutorOrganizerV2Cli,
  publishPhase697TutorOrganizerEvidenceForTest,
} from '../scripts/phase-6-9-7-tutor-wrong-question-cli.ts';
import {
  validatePhase697TutorOrganizerEvidenceFile,
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceBundle,
  validatePhase697TutorOrganizerV2EvidenceFile,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  phase69TutorCases,
  phase69WrongQuestionOrganizerCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
  runPhase697TutorOrganizerPairedEvalV2,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

const V1_MARKER_PATH = '.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker';
const V2_MARKER_PATH = '.tmp/phase-6-9-7-tutor-organizer-v2-controlled-live.marker';
const MOCK_RUN_ID = '11111111-1111-4111-8111-111111111111';
const LIVE_RUN_ID = '22222222-2222-4222-8222-222222222222';

describe('phase 6.9.7 Tutor/Organizer V2 CLI and evidence isolation', () => {
  test('requires a V2-only confirmation and approval variable in both directions', () => {
    expect(
      parsePhase697TutorOrganizerV2Cli({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV2Cli({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV2Cli({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV2Cli({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toMatchObject({ ok: true, mode: 'live', runScope: 'branch' });
    expect(
      parsePhase697TutorOrganizerCli({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
  });

  test('emits strict V2 identities and diagnostics without weakening the V1 validator', async () => {
    const v1 = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness({ runId: MOCK_RUN_ID }),
    );
    const v2 = await runPhase697TutorOrganizerPairedEvalV2(
      createPhase697TutorOrganizerMockHarness({ runId: MOCK_RUN_ID }),
    );

    expect(v1.runnerVersion).toBe(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1);
    expect(v1.identities.tutorPromptVersion).toBe(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1);
    expect(v1.identities.organizerPromptVersion).toBe(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1);
    expect(v1.caseEntries.every((entry) => !Object.hasOwn(entry, 'canonicalValidationStage'))).toBe(
      true,
    );
    expect(validatePhase697TutorOrganizerEvidenceValue(v1)).toEqual({ ok: true });

    expect(v2.runnerVersion).toBe(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2);
    expect(v2.identities.tutorPromptVersion).toBe(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2);
    expect(v2.identities.organizerPromptVersion).toBe(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2);
    expect(v2.caseEntries.every((entry) => Object.hasOwn(entry, 'canonicalValidationStage'))).toBe(
      true,
    );
    expect(v2.caseEntries.every((entry) => Object.hasOwn(entry, 'canonicalFailureReason'))).toBe(
      true,
    );
    expect(v2.gate).toBe('quality_gate_failed');
    expect(validatePhase697TutorOrganizerV2EvidenceValue(v2)).toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerEvidenceValue(v2)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });

    const missingDiagnostics = {
      ...v2,
      caseEntries: v2.caseEntries.map((entry, index) => {
        if (index !== 0) return entry;
        const {
          canonicalValidationStage: _stage,
          canonicalFailureReason: _reason,
          ...withoutDiagnostics
        } = entry;
        return withoutDiagnostics;
      }),
    };
    expect(validatePhase697TutorOrganizerV2EvidenceValue(missingDiagnostics)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
    expect(
      validatePhase697TutorOrganizerV2EvidenceValue({
        ...v2,
        identities: {
          ...v2.identities,
          tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1,
        },
      }),
    ).toEqual({ ok: false, code: 'report_contract_invalid' });
    expect(
      validatePhase697TutorOrganizerV2EvidenceBundle([v2, { ...v2, runScope: 'main' }]),
    ).toEqual({ ok: false, code: 'run_identity_invalid' });
  });

  test('publishes only the V2 filename contract and refuses evidence replacement', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-mock-cli-'));
    try {
      const first = await executePhase697TutorOrganizerV2Cli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
        runId: MOCK_RUN_ID,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(first.evidencePath).toBe(
        `.tmp/phase-6-9-7-tutor-organizer-v2-branch-mock-${MOCK_RUN_ID}.json`,
      );
      expect(
        await validatePhase697TutorOrganizerV2EvidenceFile({
          path: resolve(root, first.evidencePath),
        }),
      ).toEqual({ ok: true });
      expect(
        await validatePhase697TutorOrganizerEvidenceFile({
          path: resolve(root, first.evidencePath),
        }),
      ).toEqual({ ok: false, code: 'report_contract_invalid' });

      const report = await readFile(resolve(root, first.evidencePath), 'utf8');
      const legacyName = resolve(
        root,
        `.tmp/phase-6-9-7-tutor-organizer-branch-mock-${MOCK_RUN_ID}.json`,
      );
      await writeFile(legacyName, report, 'utf8');
      expect(await validatePhase697TutorOrganizerV2EvidenceFile({ path: legacyName })).toEqual({
        ok: false,
        code: 'evidence_filename_invalid',
      });

      const duplicate = await executePhase697TutorOrganizerV2Cli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
        runId: MOCK_RUN_ID,
      });
      expect(duplicate).toEqual({ ok: false, code: 'evidence_target_exists' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('recovers from an orphan temporary file and treats the linked evidence as authoritative', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-evidence-recovery-'));
    try {
      const report = await runPhase697TutorOrganizerPairedEvalV2(
        createPhase697TutorOrganizerMockHarness({ runId: MOCK_RUN_ID }),
      );
      const evidencePath = `.tmp/phase-6-9-7-tutor-organizer-v2-branch-mock-${MOCK_RUN_ID}.json`;
      const absolutePath = resolve(root, evidencePath);
      await mkdir(resolve(root, '.tmp'), { recursive: true });
      await writeFile(`${absolutePath}.tmp-${process.pid}-${report.runId}`, 'orphan\n', {
        encoding: 'utf8',
        flag: 'wx',
      });

      const published = await publishPhase697TutorOrganizerEvidenceForTest(
        { root, evidencePath, report },
        {
          temporaryId: () => 'recovered-attempt',
          unlink: async () => {
            throw new Error('simulated cleanup failure');
          },
        },
      );

      expect(published).toEqual({ ok: true });
      expect(await validatePhase697TutorOrganizerV2EvidenceFile({ path: absolutePath })).toEqual({
        ok: true,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects invalid V2 Live config before reserving its marker', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-invalid-live-'));
    let invocations = 0;
    const neverInvoke = async () => {
      invocations += 1;
      throw new Error('must not invoke');
    };
    try {
      const result = await executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true' },
        repositoryRoot: root,
        tutorExecutor: neverInvoke,
        organizerExecutor: neverInvoke,
      });
      expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(invocations).toBe(0);
      await expect(access(resolve(root, V2_MARKER_PATH))).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('distinguishes marker storage failure from an already reserved V2 run', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-marker-io-'));
    let invocations = 0;
    const executors = createSyntheticExecutors(() => {
      invocations += 1;
    });
    try {
      await mkdir(resolve(root, V2_MARKER_PATH), { recursive: true });

      const result = await executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: completeV2LiveEnv(),
        repositoryRoot: root,
        runId: LIVE_RUN_ID,
        ...executors,
      });

      expect(result).toEqual({ ok: false, code: 'evidence_io_failed' });
      expect(invocations).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('allows exactly one concurrent V2 Live reservation', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-marker-race-'));
    let invocations = 0;
    try {
      const attempts = [
        {
          runId: LIVE_RUN_ID,
          ...createSyntheticExecutors(() => {
            invocations += 1;
          }),
        },
        {
          runId: '33333333-3333-4333-8333-333333333333',
          ...createSyntheticExecutors(() => {
            invocations += 1;
          }),
        },
      ] as const;

      const results = await Promise.all(
        attempts.map((attempt) =>
          executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest({
            argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
            env: completeV2LiveEnv(),
            repositoryRoot: root,
            ...attempt,
          }),
        ),
      );

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, code: 'live_already_attempted' },
      ]);
      expect(invocations).toBe(48);
      const successful = results.find((result) => result.ok);
      if (!successful?.ok) throw new Error('expected one successful reservation');
      const marker = JSON.parse(await readFile(resolve(root, V2_MARKER_PATH), 'utf8')) as {
        runId: string;
        state: string;
      };
      expect(marker).toMatchObject({
        runId: successful.runId,
        state: 'attempt_reserved',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('ignores the immutable V1 marker, blocks a second V2 marker, and keeps synthetic Live closed', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v2-live-cli-'));
    const v1MarkerBytes = '{"history":"v1-immutable"}\n';
    let invocations = 0;
    const executors = createSyntheticExecutors(() => {
      invocations += 1;
    });
    try {
      await mkdir(resolve(root, '.tmp'), { recursive: true });
      await writeFile(resolve(root, V1_MARKER_PATH), v1MarkerBytes, {
        encoding: 'utf8',
        flag: 'wx',
      });

      const first = await executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: completeV2LiveEnv(),
        repositoryRoot: root,
        runId: LIVE_RUN_ID,
        ...executors,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(first.versions.runner).toBe(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2);
      expect(first.versions.executorProvenance).toBe('synthetic_test');
      expect(first.gate).toBe('quality_gate_failed');
      expect(invocations).toBe(48);
      expect(first.evidencePath).toBe(
        `.tmp/phase-6-9-7-tutor-organizer-v2-branch-live-${LIVE_RUN_ID}.json`,
      );
      expect(await readFile(resolve(root, V1_MARKER_PATH), 'utf8')).toBe(v1MarkerBytes);
      const v2Marker = JSON.parse(await readFile(resolve(root, V2_MARKER_PATH), 'utf8')) as {
        runnerVersion: string;
        runId: string;
      };
      expect(v2Marker).toMatchObject({
        runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
        runId: LIVE_RUN_ID,
      });

      const second = await executePhase697TutorOrganizerV2CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V2_LIVE_CONFIRMATION],
        env: completeV2LiveEnv(),
        repositoryRoot: root,
        ...executors,
      });
      expect(second).toEqual({ ok: false, code: 'live_already_attempted' });
      expect(invocations).toBe(48);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function completeV2LiveEnv(): Readonly<Record<string, string>> {
  return {
    PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'synthetic-tutor-key',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-key',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
  };
}

function createSyntheticExecutors(onInvoke: () => void): {
  tutorExecutor: StructuredModelExecutor;
  organizerExecutor: StructuredModelExecutor;
} {
  const tutorCases = phase69TutorCases.filter((entry) => entry.expectedRuntimeInvocations === 1);
  const organizerCases = phase69WrongQuestionOrganizerCases.filter(
    (entry) => entry.expectedRuntimeInvocations === 1,
  );
  let tutorIndex = 0;
  let organizerIndex = 0;
  return {
    tutorExecutor: async () => {
      onInvoke();
      const entry = tutorCases[tutorIndex++]!;
      return {
        object: {
          intent: entry.expected.intent,
          depth: entry.expected.depth,
          confidence: 'high',
          evidenceCodes: [tutorEvidence(entry.expected.intent)],
        },
        usage: { inputTokens: 420, outputTokens: 90 },
      };
    },
    organizerExecutor: async (request) => {
      onInvoke();
      const entry = organizerCases[organizerIndex++]!;
      const projection = JSON.parse(request.userPrompt) as {
        questions: Array<{ subjectHint: string }>;
      };
      return {
        object: {
          decisions: entry.expected.decisions.map((decision) => ({
            questionIndex: decision.questionIndex,
            subject:
              projection.questions[decision.questionIndex]?.subjectHint === 'unknown'
                ? decision.subject
                : 'keep_local',
            deck:
              decision.deckAction === 'reuse_existing'
                ? { action: 'reuse_existing', deckIndex: decision.deckIndex }
                : { action: 'create_topic', topicLabel: decision.canonicalTopicLabel },
            confidence: decision.confidence,
            evidenceCodes: decision.requiredEvidenceCodes,
          })),
        },
        usage: { inputTokens: 760, outputTokens: 180 },
      };
    },
  };
}

function tutorEvidence(
  intent:
    | 'explain_solution'
    | 'socratic_hint'
    | 'step_check'
    | 'concept_bridge'
    | 'general_follow_up',
) {
  switch (intent) {
    case 'explain_solution':
      return 'full_explanation_request';
    case 'socratic_hint':
      return 'implicit_hint_request';
    case 'step_check':
      return 'submitted_step';
    case 'concept_bridge':
      return 'concept_gap';
    case 'general_follow_up':
      return 'contextual_reference';
  }
}
