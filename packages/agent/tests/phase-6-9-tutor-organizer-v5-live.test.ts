import { describe, expect, test } from 'bun:test';

import type { ModelAgentRequest, StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
  PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
  createPhase697TutorOrganizerV5LiveHarness,
  resolvePhase697V5LiveConfiguration,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-live.ts';
import { deriveTutorV5LocalSignalAuthority } from '../src/model-candidates/tutor-v5-local-signal-authority.ts';

function validLiveEnv(overrides?: Readonly<Record<string, string | undefined>>) {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'test-only-tutor-component-key',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'test-only-organizer-component-key',
    ...overrides,
  };
}

function firstTutorRuntimeCase() {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (candidate): candidate is Phase697V2TutorRuntimeCase =>
      candidate.agent === 'tutor' && candidate.expectedRuntimeInvocations === 1,
  );
  if (!entry) throw new Error('V5 Tutor runtime fixture unavailable');
  return entry;
}

function firstOrganizerRuntimeCase() {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (candidate): candidate is Phase697V2OrganizerRuntimeCase =>
      candidate.agent === 'wrong_question_organizer' && candidate.expectedRuntimeInvocations === 1,
  );
  if (!entry) throw new Error('V5 Organizer runtime fixture unavailable');
  return entry;
}

function tutorDecision(entry: Phase697V2TutorRuntimeCase) {
  const authority = deriveTutorV5LocalSignalAuthority({
    latestUserText: entry.input.latestUserText,
    activeStudyContext: entry.input.activeStudyContext,
    safety: { latestUserText: 'safe_for_model', activeStudyContext: 'safe_for_model' },
  });
  if (!authority.ok) throw new Error('V5 Tutor authority unavailable');
  const choice = authority.value.eligibleChoices[0];
  if (!choice) throw new Error('V5 Tutor choice unavailable');
  const depth =
    choice.intent === 'explain_solution' && choice.depths.includes('deep')
      ? 'deep'
      : choice.depths.includes('standard')
        ? 'standard'
        : choice.depths[0];
  if (!depth) throw new Error('V5 Tutor depth unavailable');
  return { intent: choice.intent, depth, confidence: authority.value.confidence } as const;
}

describe('Phase 6.9.7 V5 R6 Live configuration', () => {
  test('requires component credentials and never borrows the generic DeepSeek key', () => {
    expect(resolvePhase697V5LiveConfiguration(validLiveEnv())).toEqual({
      ok: true,
      value: {
        tutorApiKey: 'test-only-tutor-component-key',
        organizerApiKey: 'test-only-organizer-component-key',
      },
    });
    expect(
      resolvePhase697V5LiveConfiguration(
        validLiveEnv({
          TUTOR_AGENT_DEEPSEEK_API_KEY: undefined,
          DEEPSEEK_API_KEY: 'generic-key-must-not-be-used',
        }),
      ),
    ).toEqual({ ok: false, code: 'live_configuration_invalid' });
  });

  test('fails closed for wrong gates, base URL, timeouts and hostile accessors', () => {
    for (const override of [
      { ROUTER_MODEL_ENABLED: 'true' },
      { AI_ENABLE_LIVE_CALLS: 'false' },
      { AI_BASE_URL: 'https://example.invalid/v1' },
      { TUTOR_AGENT_MODEL_TIMEOUT_MS: '2999' },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5001' },
    ]) {
      expect(resolvePhase697V5LiveConfiguration(validLiveEnv(override))).toEqual({
        ok: false,
        code: 'live_configuration_invalid',
      });
    }

    const hostile = Object.create(null) as Record<string, string | undefined>;
    let reads = 0;
    Object.defineProperty(hostile, 'TUTOR_AGENT_DEEPSEEK_API_KEY', {
      enumerable: true,
      get() {
        reads += 1;
        return 'must-not-be-read';
      },
    });
    expect(resolvePhase697V5LiveConfiguration(hostile)).toEqual({
      ok: false,
      code: 'live_configuration_invalid',
    });
    expect(reads).toBe(0);
  });
});

describe('Phase 6.9.7 V5 R6 Live harness', () => {
  test('keeps all 24 guards zero-call and sends one bounded Tutor request without eval leakage', async () => {
    const entry = firstTutorRuntimeCase();
    const requests: ModelAgentRequest<unknown>[] = [];
    let invocations = 0;
    const executor: StructuredModelExecutor = async (request) => {
      invocations += 1;
      requests.push(request as ModelAgentRequest<unknown>);
      return {
        object: tutorDecision(entry),
        usage: { inputTokens: 320, outputTokens: 36 },
      };
    };
    const harness = createPhase697TutorOrganizerV5LiveHarness({
      tutorExecutor: executor,
      organizerExecutor: executor,
      runId: '00000000-0000-4000-8000-000000000601',
      runScope: 'branch',
      tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
      executorProvenance: 'synthetic_test',
    });

    const guards = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.filter(
      (candidate) => candidate.expectedRuntimeInvocations === 0,
    );
    const guardResults = await Promise.all(guards.map((guard) => harness.runZeroCall(guard)));
    expect(guards).toHaveLength(24);
    expect(guardResults.every((result) => result.zeroCallVerified)).toBe(true);
    expect(invocations).toBe(0);

    const result = await harness.runTutor(entry, new AbortController().signal);
    expect(result).toMatchObject({
      runtimeInvocations: 1,
      candidateDisposition: 'candidate_applied',
      strictRuntimeSuccess: true,
      failureCategory: 'none',
      usageDisposition: 'verified',
      usage: { inputTokens: 320, outputTokens: 36, estimatedCostCny: 0.001176 },
    });
    expect(invocations).toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.maxOutputTokens).toBe(300);
    const providerText = `${requests[0]?.systemPrompt}\n${requests[0]?.userPrompt}`;
    expect(providerText).not.toContain(entry.id);
    expect(providerText).not.toContain(JSON.stringify(entry.expected));
    expect(providerText).not.toContain('phase-6.9.7-tutor-organizer-runner-v4');
  });

  test('classifies schema and provider failures with one invocation and no retry', async () => {
    const entry = firstTutorRuntimeCase();
    for (const scenario of ['schema', 'provider'] as const) {
      let invocations = 0;
      const executor: StructuredModelExecutor = async () => {
        invocations += 1;
        if (scenario === 'provider') throw new Error('provider failure canary');
        return { object: { extra: true }, usage: { inputTokens: 100, outputTokens: 10 } };
      };
      const harness = createPhase697TutorOrganizerV5LiveHarness({
        tutorExecutor: executor,
        organizerExecutor: executor,
        runId:
          scenario === 'schema'
            ? '00000000-0000-4000-8000-000000000602'
            : '00000000-0000-4000-8000-000000000603',
        runScope: 'branch',
        tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
        organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
        executorProvenance: 'synthetic_test',
      });
      const result = await harness.runTutor(entry, new AbortController().signal);
      expect(invocations).toBe(1);
      expect(result.runtimeInvocations).toBe(1);
      expect(result.strictRuntimeSuccess).toBe(false);
      expect(result.usage).toBeNull();
      expect(result.usageDisposition).toBe('unknown_after_attempt');
      expect(result.failureCategory).toBe(
        scenario === 'schema' ? 'structured_output' : 'provider_runtime',
      );
      expect(result.providerFailureCategory).toBe(scenario === 'provider' ? 'unknown' : null);
    }
  });

  test('runs the Organizer shortlist path once with the 800-token cap and no eval leakage', async () => {
    const entry = firstOrganizerRuntimeCase();
    const requests: ModelAgentRequest<unknown>[] = [];
    let invocations = 0;
    const executor: StructuredModelExecutor = async (request) => {
      invocations += 1;
      requests.push(request as ModelAgentRequest<unknown>);
      return { object: { invalid: true }, usage: { inputTokens: 400, outputTokens: 40 } };
    };
    const harness = createPhase697TutorOrganizerV5LiveHarness({
      tutorExecutor: executor,
      organizerExecutor: executor,
      runId: '00000000-0000-4000-8000-000000000604',
      runScope: 'branch',
      tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
      executorProvenance: 'synthetic_test',
    });
    const result = await harness.runOrganizer(entry, new AbortController().signal);
    expect(result).toMatchObject({
      runtimeInvocations: 1,
      strictRuntimeSuccess: false,
      failureCategory: 'structured_output',
      usageDisposition: 'unknown_after_attempt',
    });
    expect(invocations).toBe(1);
    expect(requests[0]?.maxOutputTokens).toBe(800);
    const providerText = `${requests[0]?.systemPrompt}\n${requests[0]?.userPrompt}`;
    expect(providerText).not.toContain(entry.id);
    expect(providerText).not.toContain(JSON.stringify(entry.expected));
  });

  test('fails usage over-cap and post-dispatch aborts closed without retry', async () => {
    const entry = firstTutorRuntimeCase();
    let overCapInvocations = 0;
    const overCapHarness = createPhase697TutorOrganizerV5LiveHarness({
      tutorExecutor: async () => {
        overCapInvocations += 1;
        return {
          object: tutorDecision(entry),
          usage: { inputTokens: 1_201, outputTokens: 20 },
        };
      },
      organizerExecutor: async () => {
        throw new Error('unused');
      },
      runId: '00000000-0000-4000-8000-000000000605',
      runScope: 'branch',
      tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
      executorProvenance: 'synthetic_test',
    });
    const overCap = await overCapHarness.runTutor(entry, new AbortController().signal);
    expect(overCapInvocations).toBe(1);
    expect(overCap).toMatchObject({
      strictRuntimeSuccess: false,
      failureCategory: 'usage_unknown',
      usageDisposition: 'unknown_after_attempt',
      usage: null,
    });

    let abortInvocations = 0;
    const abortHarness = createPhase697TutorOrganizerV5LiveHarness({
      tutorExecutor: (request) =>
        new Promise((_, reject) => {
          abortInvocations += 1;
          request.signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
      organizerExecutor: async () => {
        throw new Error('unused');
      },
      runId: '00000000-0000-4000-8000-000000000606',
      runScope: 'branch',
      tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
      executorProvenance: 'synthetic_test',
    });
    const controller = new AbortController();
    const pending = abortHarness.runTutor(entry, controller.signal);
    setTimeout(() => controller.abort('test_abort'), 1);
    const aborted = await pending;
    expect(abortInvocations).toBe(1);
    expect(aborted).toMatchObject({
      runtimeInvocations: 1,
      strictRuntimeSuccess: false,
      failureCategory: 'post_dispatch_abort',
      usageDisposition: 'unknown_after_attempt',
      terminalHint: 'attempted_aborted',
    });
  });
});
