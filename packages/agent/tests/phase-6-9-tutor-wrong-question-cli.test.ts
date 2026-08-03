import { describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_LIVE_CONFIRMATION,
  executePhase697TutorOrganizerCli,
  executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest,
  parsePhase697TutorOrganizerCli,
} from '../scripts/phase-6-9-7-tutor-wrong-question-cli.ts';
import {
  containsSensitivePhase697EvidenceKey,
  validatePhase697TutorOrganizerEvidenceBundle,
  validatePhase697TutorOrganizerEvidenceFile,
  validatePhase697TutorOrganizerEvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  phase69TutorCases,
  phase69WrongQuestionOrganizerCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

describe('phase 6.9.7 Tutor/Organizer CLI and evidence validator', () => {
  test('requires exact fresh controlled-Live authorization', () => {
    expect(parsePhase697TutorOrganizerCli({ argv: ['live'], env: {} })).toEqual({
      ok: false,
      code: 'live_authorization_required',
    });
    expect(
      parsePhase697TutorOrganizerCli({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: {},
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerCli({
        argv: ['live', 'wrong-confirmation'],
        env: { PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerCli({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toMatchObject({ ok: true, mode: 'live', runScope: 'branch' });
  });

  test('rejects sensitive evidence and recomputes strict usage provenance', async () => {
    for (const key of [
      'prompt',
      'questionText',
      'providerResponse',
      'credential',
      'apiKey',
      'rawError',
      'ownerId',
    ]) {
      expect(containsSensitivePhase697EvidenceKey(key)).toBe(true);
    }
    expect(containsSensitivePhase697EvidenceKey('tutorPromptVersion')).toBe(false);

    const report = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness(),
    );
    expect(validatePhase697TutorOrganizerEvidenceValue(report)).toEqual({ ok: true });
    expect(
      validatePhase697TutorOrganizerEvidenceValue({
        ...report,
        apiKey: 'forbidden',
      }),
    ).toEqual({ ok: false, code: 'sensitive_evidence' });
    const runtimeIndex = report.caseEntries.findIndex((entry) => entry.executionKind === 'runtime');
    const zeroUsage = report.caseEntries.map((entry, index) =>
      index === runtimeIndex && entry.usage
        ? {
            ...entry,
            usage: { ...entry.usage, inputTokens: 0, outputTokens: 0 },
          }
        : entry,
    );
    expect(
      validatePhase697TutorOrganizerEvidenceValue({
        ...report,
        caseEntries: zeroUsage,
      }),
    ).toEqual({ ok: false, code: 'report_contract_invalid' });

    const v2Report = {
      ...report,
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
      identities: {
        ...report.identities,
        tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
        organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
      },
      caseEntries: report.caseEntries.map((entry) => ({
        ...entry,
        canonicalValidationStage:
          entry.executionKind === 'zero_call' ? null : ('applied' as const),
        canonicalFailureReason: null,
      })),
    };
    expect(validatePhase697TutorOrganizerEvidenceValue(v2Report)).toEqual({
      ok: false,
      code: 'report_contract_invalid',
    });
  });

  test('rejects duplicate run identity across branch and main reports', async () => {
    const branch = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness(),
    );
    const main = { ...branch, runScope: 'main' as const };
    expect(validatePhase697TutorOrganizerEvidenceBundle([branch, main])).toEqual({
      ok: false,
      code: 'run_identity_invalid',
    });
  });

  test('rejects incomplete Live configuration before marker or executor use', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-invalid-live-'));
    let invocations = 0;
    try {
      const result = await executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true' },
        repositoryRoot: root,
        tutorExecutor: async () => {
          invocations += 1;
          throw new Error('must not invoke');
        },
        organizerExecutor: async () => {
          invocations += 1;
          throw new Error('must not invoke');
        },
      });
      expect(result).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(invocations).toBe(0);
      await expect(
        access(resolve(root, '.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker')),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('does not let a generic key replace either component credential or coexist with another product gate', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-key-boundary-'));
    let invocations = 0;
    const neverInvoke = async () => {
      invocations += 1;
      throw new Error('must not invoke');
    };
    try {
      const genericOnly = await executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: {
          ...completeLiveEnv(),
          TUTOR_AGENT_DEEPSEEK_API_KEY: '',
          DEEPSEEK_API_KEY: 'generic-key-must-not-authorize-tutor',
        },
        repositoryRoot: root,
        tutorExecutor: neverInvoke,
        organizerExecutor: neverInvoke,
      });
      expect(genericOnly).toEqual({
        ok: false,
        code: 'live_configuration_invalid',
      });
      for (const gate of [
        'ROUTER_MODEL_ENABLED',
        'KNOWLEDGE_VERIFIER_MODEL_ENABLED',
        'REVIEW_AGENT_MODEL_ENABLED',
        'PLANNER_AGENT_MODEL_ENABLED',
        'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED',
        'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED',
      ] as const) {
        const otherGate = await executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest({
          argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
          env: {
            ...completeLiveEnv(),
            [gate]: 'true',
          },
          repositoryRoot: root,
          tutorExecutor: neverInvoke,
          organizerExecutor: neverInvoke,
        });
        expect(otherGate).toEqual({
          ok: false,
          code: 'live_configuration_invalid',
        });
      }
      expect(invocations).toBe(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('publishes two immutable Mock reports and validates exact filenames', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-mock-cli-'));
    try {
      const first = await executePhase697TutorOrganizerCli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
      });
      const second = await executePhase697TutorOrganizerCli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
      });
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) throw new Error('mock execution failed');
      expect(first.runId).not.toBe(second.runId);
      expect(
        await validatePhase697TutorOrganizerEvidenceFile({
          path: resolve(root, first.evidencePath),
        }),
      ).toEqual({ ok: true });

      const report = JSON.parse(
        await readFile(resolve(root, first.evidencePath), 'utf8'),
      ) as Record<string, unknown>;
      const wrongName = resolve(root, `phase-6-9-7-tutor-organizer-main-mock-${first.runId}.json`);
      await writeFile(wrongName, `${JSON.stringify(report)}\n`, 'utf8');
      expect(await validatePhase697TutorOrganizerEvidenceFile({ path: wrongName })).toEqual({
        ok: false,
        code: 'evidence_filename_invalid',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('keeps Live output aggregate-only and blocks a second marker attempt', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-live-cli-'));
    let invocations = 0;
    const executors = createSyntheticExecutors(() => {
      invocations += 1;
    });
    try {
      const first = await executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: completeLiveEnv(),
        repositoryRoot: root,
        ...executors,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(Object.keys(first).sort()).toEqual([
        'counts',
        'evidencePath',
        'gate',
        'latency',
        'metrics',
        'ok',
        'runId',
        'usage',
        'versions',
      ]);
      expect(first.versions.executorProvenance).toBe('synthetic_test');
      expect(first.gate).toBe('quality_gate_failed');
      expect(invocations).toBe(48);
      expect(first.evidencePath).toMatch(
        /^\.tmp\/phase-6-9-7-tutor-organizer-branch-live-[0-9a-f-]{36}\.json$/,
      );
      const names = await readdir(resolve(root, '.tmp'));
      expect(names.some((name) => name.includes('.tmp-'))).toBe(false);

      const second = await executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_LIVE_CONFIRMATION],
        env: completeLiveEnv(),
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

function completeLiveEnv(): Readonly<Record<string, string>> {
  return {
    PHASE_6_9_7_CONTROLLED_LIVE_APPROVED: 'true',
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
                : {
                    action: 'create_topic',
                    topicLabel: decision.canonicalTopicLabel,
                  },
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
