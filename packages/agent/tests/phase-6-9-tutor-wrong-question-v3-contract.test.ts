import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentProviderDependencies,
  type ModelAgentTrace,
} from '@repo/ai';

import {
  PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
  PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3,
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA,
  projectPhase697V3RuntimeEvidence,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import { PHASE_6_9_TUTOR_WRONG_QUESTION_CASES } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  createPhase697TutorOrganizerLiveHarness,
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
  runPhase697TutorOrganizerPairedEvalV2,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import type { ModelCandidateObservation } from '../src/model-candidates/model-candidate-policy.ts';

const V3_FIELDS = [
  'runtimeEvidenceVersion',
  'providerFailureCategory',
  'structuredOutputStage',
  'lastCompletedStage',
  'executionOutcome',
  'usageDisposition',
] as const;

describe('Phase 6.9.7 Tutor/Organizer V3 bounded runtime contract', () => {
  test('freezes a separate V3 identity without changing the V2 prompt bytes', async () => {
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3).toBe(
      'phase-6.9.7-tutor-organizer-runner-v3',
    );
    expect(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3).toBe('tutor-model-candidate-v3');
    expect(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3).toBe(
      'wrong-question-organizer-model-candidate-v3',
    );

    const tutorPrompts: string[] = [];
    const organizerPrompts: string[] = [];
    const harness = createPhase697TutorOrganizerLiveHarness({
      runScope: 'branch',
      runId: '00000000-0000-4000-8000-000000000301',
      executorProvenance: 'synthetic_test',
      tutorExecutor: async (request) => {
        tutorPrompts.push(request.systemPrompt);
        return { object: {}, usage: { inputTokens: 5, outputTokens: 3 } };
      },
      organizerExecutor: async (request) => {
        organizerPrompts.push(request.systemPrompt);
        return { object: {}, usage: { inputTokens: 7, outputTokens: 4 } };
      },
    });
    const tutorCases = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.filter(
      (entry) => entry.agent === 'tutor' && entry.expectedRuntimeInvocations === 1,
    );
    const organizerCases = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.filter(
      (entry) =>
        entry.agent === 'wrong_question_organizer' && entry.expectedRuntimeInvocations === 1,
    );
    const tutorA = tutorCases[0];
    const tutorB = tutorCases[1];
    const organizerA = organizerCases[0];
    const organizerB = organizerCases[1];
    if (!tutorA || !tutorB || !organizerA || !organizerB) {
      throw new Error('expected frozen runtime fixtures');
    }

    const tutorResult = await harness.runTutor(tutorA);
    await harness.runTutor(tutorB);
    const organizerResult = await harness.runOrganizer(organizerA);
    await harness.runOrganizer(organizerB);

    expect(new Set(tutorPrompts).size).toBe(1);
    expect(new Set(organizerPrompts).size).toBe(1);
    expect(sha256(tutorPrompts[0]!)).toBe(PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3);
    expect(sha256(organizerPrompts[0]!)).toBe(PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3);
    expect(tutorPrompts[0]).not.toContain(tutorA.id);
    expect(organizerPrompts[0]).not.toContain(organizerA.id);
    expect(tutorResult.v3RuntimeEvidence).toMatchObject({
      executionOutcome: 'executed_failure',
      usageDisposition: 'unknown_after_attempt',
      lastCompletedStage: 'structured_object_captured',
    });
    expect(organizerResult.v3RuntimeEvidence).toMatchObject({
      executionOutcome: 'executed_failure',
      usageDisposition: 'unknown_after_attempt',
      lastCompletedStage: 'structured_object_captured',
    });
  });

  test('carries an opaque provider failure from runtime trace into the V3 eval result', async () => {
    const dependencies: ModelAgentProviderDependencies = {
      createProvider: () =>
        (() => ({ provider: 'local-fixture-model' })) as ReturnType<
          ModelAgentProviderDependencies['createProvider']
        >,
      generateStructured: async () => {
        throw new Error('RAW_PROVIDER_FAILURE_CANARY Authorization: Bearer secret');
      },
    };
    const executor = createOpenAICompatibleStructuredExecutor(
      {
        provider: 'deepseek',
        apiKey: 'sentinel-component-key',
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      },
      dependencies,
    );
    const harness = createPhase697TutorOrganizerLiveHarness({
      runScope: 'branch',
      runId: '00000000-0000-4000-8000-000000000302',
      executorProvenance: 'synthetic_test',
      tutorExecutor: executor,
      organizerExecutor: executor,
    });
    const tutorCase = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
      (entry) => entry.agent === 'tutor' && entry.expectedRuntimeInvocations === 1,
    );
    if (!tutorCase) throw new Error('expected Tutor runtime fixture');

    const result = await harness.runTutor(tutorCase);

    expect(result.v3RuntimeEvidence).toEqual({
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: 'unknown',
      structuredOutputStage: null,
      lastCompletedStage: 'delegate_started',
      executionOutcome: 'executed_failure',
      usageDisposition: 'unknown_after_attempt',
    });
    expect(JSON.stringify(result.v3RuntimeEvidence)).not.toContain('RAW_PROVIDER_FAILURE_CANARY');
    expect(JSON.stringify(result.v3RuntimeEvidence)).not.toContain('Bearer secret');
  });

  test.each([...MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES])(
    'projects only the trusted bounded provider category: %s',
    (category) => {
      const structuredOutputStage =
        category === 'structured_output' ? 'provider_json_parse' : undefined;
      const evidence = projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 1,
        executionOutcome: 'executed_failure',
        usageDisposition: 'unknown_after_attempt',
        lastCompletedStage: 'delegate_started',
        observation: attemptedObservation(category, structuredOutputStage),
      });

      expect(evidence).toEqual({
        runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
        runtimeInvocations: 1,
        providerFailureCategory: category,
        structuredOutputStage: structuredOutputStage ?? null,
        lastCompletedStage: 'delegate_started',
        executionOutcome: 'executed_failure',
        usageDisposition: 'unknown_after_attempt',
      });
      expect(Object.isFrozen(evidence)).toBe(true);
    },
  );

  test.each([...MODEL_AGENT_STRUCTURED_OUTPUT_STAGES])(
    'preserves a fixed structured-output stage: %s',
    (stage) => {
      expect(
        projectPhase697V3RuntimeEvidence({
          runtimeInvocations: 1,
          executionOutcome: 'executed_failure',
          usageDisposition: 'unknown_after_attempt',
          lastCompletedStage: 'delegate_returned',
          observation: attemptedObservation('structured_output', stage),
        })?.structuredOutputStage,
      ).toBe(stage);
    },
  );

  test('keeps outer harness failures local and requires the actual invocation count', () => {
    const beforeDispatch = projectPhase697V3RuntimeEvidence({
      runtimeInvocations: 0,
      executionOutcome: 'harness_internal_error',
      usageDisposition: 'absent_not_attempted',
      lastCompletedStage: null,
      observation: null,
    });
    const afterDispatch = projectPhase697V3RuntimeEvidence({
      runtimeInvocations: 1,
      executionOutcome: 'harness_internal_error',
      usageDisposition: 'unknown_after_attempt',
      lastCompletedStage: 'delegate_started',
      observation: null,
    });

    expect(beforeDispatch?.providerFailureCategory).toBeNull();
    expect(afterDispatch?.providerFailureCategory).toBeNull();
    expect(beforeDispatch?.runtimeInvocations).toBe(0);
    expect(afterDispatch?.runtimeInvocations).toBe(1);
    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 0,
        executionOutcome: 'harness_internal_error',
        usageDisposition: 'absent_not_attempted',
        lastCompletedStage: 'request_validated',
        observation: null,
      })?.lastCompletedStage,
    ).toBe('request_validated');
  });

  test('records post-runtime usage verification failure after applied as a bounded harness failure', () => {
    const evidence = projectPhase697V3RuntimeEvidence({
      runtimeInvocations: 1,
      executionOutcome: 'harness_internal_error',
      usageDisposition: 'unknown_after_attempt',
      lastCompletedStage: 'applied',
      observation: null,
    });

    expect(evidence).toEqual({
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: null,
      structuredOutputStage: null,
      lastCompletedStage: 'applied',
      executionOutcome: 'harness_internal_error',
      usageDisposition: 'unknown_after_attempt',
    });
    expect(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse(evidence).success).toBe(true);
  });

  test('accepts strict success and genuine not-started states but rejects contradictory evidence', () => {
    const success = projectPhase697V3RuntimeEvidence({
      runtimeInvocations: 1,
      executionOutcome: 'executed_success',
      usageDisposition: 'verified',
      lastCompletedStage: 'applied',
      observation: attemptedObservation(),
    });
    const notStarted = projectPhase697V3RuntimeEvidence({
      runtimeInvocations: 0,
      executionOutcome: 'not_started_quality_breaker',
      usageDisposition: 'absent_not_attempted',
      lastCompletedStage: null,
      observation: null,
    });

    expect(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse(success).success).toBe(true);
    expect(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse(notStarted).success).toBe(true);
    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 0,
        executionOutcome: 'executed_success',
        usageDisposition: 'verified',
        lastCompletedStage: 'applied',
        observation: attemptedObservation(),
      }),
    ).toBeNull();
    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 1,
        executionOutcome: 'attempted_aborted',
        usageDisposition: 'verified',
        lastCompletedStage: 'delegate_started',
        observation: attemptedObservation(),
      }),
    ).toBeNull();
    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 1,
        executionOutcome: 'attempted_aborted',
        usageDisposition: 'unknown_after_attempt',
        lastCompletedStage: null,
        observation: attemptedObservation(),
      }),
    ).toBeNull();
    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 1,
        executionOutcome: 'executed_failure',
        usageDisposition: 'unknown_after_attempt',
        lastCompletedStage: 'executor_ready',
        observation: attemptedObservation(),
      }),
    ).toBeNull();
    expect(
      PHASE_6_9_7_V3_RUNTIME_EVIDENCE_SCHEMA.safeParse({
        ...success,
        rawError: 'RAW_ERROR_CANARY Authorization: Bearer secret',
      }).success,
    ).toBe(false);
  });

  test('rejects a provider category that is not backed by a failed provider trace', () => {
    const attempted = attemptedObservation('transport');
    if (!('trace' in attempted) || attempted.trace === undefined) {
      throw new Error('expected attempted trace');
    }
    const forged = {
      ...attempted,
      trace: {
        ...attempted.trace,
        status: 'succeeded' as const,
      },
    } as ModelCandidateObservation<string>;

    expect(
      projectPhase697V3RuntimeEvidence({
        runtimeInvocations: 1,
        executionOutcome: 'executed_failure',
        usageDisposition: 'unknown_after_attempt',
        lastCompletedStage: 'delegate_started',
        observation: forged,
      }),
    ).toBeNull();
  });

  test('keeps every V3 runtime field completely absent from V1 and V2 reports', async () => {
    const v1 = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000311',
      }),
    );
    const v2 = await runPhase697TutorOrganizerPairedEvalV2(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000312',
      }),
    );

    for (const report of [v1, v2]) {
      expect(
        report.caseEntries.every((entry) =>
          V3_FIELDS.every((field) => !Object.hasOwn(entry, field)),
        ),
      ).toBe(true);
      expect(
        PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse({
          ...report,
          caseEntries: report.caseEntries.map((entry, index) =>
            index === 0
              ? {
                  ...entry,
                  runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
                  providerFailureCategory: null,
                  structuredOutputStage: null,
                  lastCompletedStage: null,
                  executionOutcome: 'not_started_quality_breaker',
                  usageDisposition: 'absent_not_attempted',
                }
              : entry,
          ),
        }).success,
      ).toBe(false);
    }
  });
});

function attemptedObservation(
  providerFailureCategory?: ModelAgentTrace['providerFailureCategory'],
  structuredOutputStage?: ModelAgentTrace['structuredOutputStage'],
): ModelCandidateObservation<string> {
  const failed = providerFailureCategory !== undefined;
  return {
    attempted: true,
    disposition: failed ? 'fallback_runtime_error' : 'candidate_applied',
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 1_200,
      usedInputTokens: 80,
      maxOutputTokens: 300,
      usedOutputTokens: 40,
    },
    usage: { inputTokens: 80, outputTokens: 40 },
    trace: {
      runIdHash: `sha256:${'a'.repeat(64)}`,
      task: 'tutor_strategy',
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      status: failed ? 'failed' : 'succeeded',
      inputTokens: 80,
      outputTokens: 40,
      maxOutputTokens: 300,
      durationMs: 10,
      degraded: failed,
      ...(failed ? { errorCode: 'PROVIDER_ERROR' as const } : {}),
      ...(providerFailureCategory ? { providerFailureCategory } : {}),
      ...(structuredOutputStage ? { structuredOutputStage } : {}),
    },
    reasonCodes: [failed ? 'fallback_runtime_error' : 'candidate_applied'],
  } as ModelCandidateObservation<string>;
}

function sha256(value: string) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
