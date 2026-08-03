import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  reserveModelAgentBudget,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  mergeTutorModelDecision,
  runTutorModelCandidate,
  type TutorModelCandidateInput,
} from '../src/model-candidates/tutor-model-candidate.ts';
import {
  TUTOR_MODEL_DEPTHS,
  TUTOR_MODEL_INTENT_POLICY,
  TUTOR_MODEL_PROMPT_VERSION,
  formatTutorModelIntentPolicyForPrompt,
  validateTutorModelDecision,
} from '../src/model-candidates/tutor-model-contract.ts';
import { phase69TutorCases } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';

const DEFAULT_TEXT = '我有点卡住，能不能别一下说完，带我往下走？';
const DEFAULT_CONTEXT = '合成代数题：已知 3x+2=11，继续判断移项步骤。';

function candidateBudget() {
  return createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 1_200,
    maxOutputTokens: 300,
  });
}

function createTrackedMockRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'tutor-candidate-test',
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => output,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return { requests, runtime };
}

function candidateInput(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<TutorModelCandidateInput> = {},
): TutorModelCandidateInput {
  const latestUserText = overrides.latestUserText ?? DEFAULT_TEXT;
  const activeStudyContext = Object.prototype.hasOwnProperty.call(
    overrides,
    'activeStudyContext',
  )
    ? overrides.activeStudyContext
    : DEFAULT_CONTEXT;
  const deterministic =
    overrides.deterministic ??
    buildTutorStrategy({
      latestUserText,
      ...(activeStudyContext !== undefined ? { activeStudyContext } : {}),
    });

  return {
    runId: overrides.runId ?? 'tutor-candidate-test-run',
    finalRoute: overrides.finalRoute ?? 'tutor',
    latestUserText,
    ...(activeStudyContext !== undefined ? { activeStudyContext } : {}),
    deterministic,
    safety:
      overrides.safety ??
      ({
        latestUserText: 'safe_for_model',
        ...(activeStudyContext !== undefined
          ? { activeStudyContext: 'safe_for_model' }
          : {}),
      } as const),
    runtime,
    budget: overrides.budget ?? candidateBudget(),
    ...(overrides.signal !== undefined ? { signal: overrides.signal } : {}),
  };
}

describe('Phase 6.9.7 Tutor governed model candidate', () => {
  test.each([
    ['直接给我答案。', 'answer_direct'],
    ['先给我一个提示。', 'socratic_hint'],
    ['帮我检查这一步对吗？', 'step_check'],
    ['解释这里的概念。', 'concept_bridge'],
    ['完整讲一下怎么做。', 'explain_solution'],
  ] as const)(
    'keeps a single explicit %s instruction provider-zero-call',
    async (latestUserText, expectedIntent) => {
      const { requests, runtime } = createTrackedMockRuntime({
        intent: 'general_follow_up',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['contextual_reference'],
      });
      const input = candidateInput(runtime, { latestUserText });

      const result = await runTutorModelCandidate(input);

      expect(requests).toHaveLength(0);
      expect(result.result).toEqual(input.deterministic);
      expect(result.result.intent).toBe(expectedIntent);
      expect(result.observation).toMatchObject({
        attempted: false,
        disposition: 'not_eligible',
        usage: { inputTokens: 0, outputTokens: 0 },
      });
    },
  );

  test('honors all frozen 12 zero-call and 24 runtime Tutor eligibility cases', async () => {
    for (const fixture of phase69TutorCases) {
      const output =
        fixture.subset === 'runtime'
          ? {
              intent: fixture.expected.intent,
              depth: fixture.expected.depth,
              confidence: 'high' as const,
              evidenceCodes:
                fixture.expected.intent === 'socratic_hint'
                  ? ['implicit_hint_request']
                  : fixture.expected.intent === 'step_check'
                    ? [
                        'submitted_step',
                        ...(fixture.tags.includes('conflicting_signals')
                          ? ['ambiguous_intent' as const]
                          : []),
                      ]
                    : fixture.expected.intent === 'concept_bridge'
                      ? [
                          'concept_gap',
                          ...(fixture.tags.includes('conflicting_signals')
                            ? ['ambiguous_intent' as const]
                            : []),
                        ]
                      : fixture.expected.intent === 'explain_solution'
                        ? [
                            'full_explanation_request',
                            ...(fixture.tags.includes('conflicting_signals')
                              ? ['ambiguous_intent' as const]
                              : []),
                          ]
                        : ['contextual_reference']
            }
          : {
              intent: 'general_follow_up' as const,
              depth: 'standard' as const,
              confidence: 'high' as const,
              evidenceCodes: ['contextual_reference'] as const,
            };
      const { requests, runtime } = createTrackedMockRuntime(output);
      const abortController = new AbortController();
      if (fixture.input.requestAborted) abortController.abort();
      const input = candidateInput(runtime, {
        runId: fixture.id,
        finalRoute: fixture.input.finalRoute === 'tutor' ? 'tutor' : 'chat',
        latestUserText: fixture.input.latestUserText,
        activeStudyContext: fixture.input.activeStudyContext,
        safety: {
          latestUserText:
            fixture.input.safetyScenario === 'safe' ? 'safe_for_model' : 'unsafe',
          ...(fixture.input.activeStudyContext !== undefined
            ? { activeStudyContext: 'safe_for_model' }
            : {}),
        },
        ...(fixture.input.requestAborted ? { signal: abortController.signal } : {}),
        ...(!fixture.input.budgetAvailable
          ? {
              budget: createModelAgentBudget({
                maxCalls: 1,
                maxInputTokens: 1,
                maxOutputTokens: 300,
              }),
            }
          : {}),
      });
      if (fixture.expected.zeroCallReason === 'hostile_accessor') {
        Object.defineProperty(input, 'latestUserText', {
          enumerable: true,
          get() {
            throw new Error('must not read hostile fixture');
          },
        });
      }

      const result = await runTutorModelCandidate(input);

      expect(requests, fixture.id).toHaveLength(fixture.expectedRuntimeInvocations);
      if (fixture.subset === 'runtime') {
        expect(result.observation.disposition, fixture.id).toBe('candidate_applied');
        expect(
          {
            intent: result.result.intent,
            depth: result.result.depth,
            contextUse: result.result.shouldUseActiveStudyContext,
            guidingQuestion: result.result.shouldAskGuidingQuestion,
            finalAnswer: result.result.shouldGiveFinalAnswer,
            answerStructure: result.result.answerStructure,
          },
          fixture.id,
        ).toEqual(fixture.expected);
      }
    }
  });

  test('zero-calls for a non-tutor route, empty input, pre-abort, and insufficient budget', async () => {
    const { requests, runtime } = createTrackedMockRuntime({
      intent: 'socratic_hint',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['implicit_hint_request'],
    });
    const abortController = new AbortController();
    abortController.abort();

    const inputs = [
      candidateInput(runtime, { finalRoute: 'chat' }),
      candidateInput(runtime, {
        latestUserText: '   ',
        activeStudyContext: undefined,
      }),
      candidateInput(runtime, { signal: abortController.signal }),
      candidateInput(runtime, {
        budget: createModelAgentBudget({
          maxCalls: 1,
          maxInputTokens: 1,
          maxOutputTokens: 300,
        }),
      }),
    ];

    const results = await Promise.all(inputs.map((input) => runTutorModelCandidate(input)));

    expect(requests).toHaveLength(0);
    expect(results.map((result) => result.result)).toEqual(
      inputs.map((input) => input.deterministic),
    );
    expect(results.map((result) => result.observation.disposition)).toEqual([
      'not_eligible',
      'not_eligible',
      'fallback_aborted',
      'fallback_budget_exceeded',
    ]);
  });

  test('blocks unsafe text and hostile accessors before the runtime', async () => {
    const { requests, runtime } = createTrackedMockRuntime({
      intent: 'general_follow_up',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['contextual_reference'],
    });
    const unsafe = candidateInput(runtime, {
      latestUserText:
        '我还是没跟上。api_key=sk-1234567890abcdef1234567890abcdef',
    });
    let getterCalls = 0;
    const hostile = candidateInput(runtime) as unknown as Record<string, unknown>;
    Object.defineProperty(hostile, 'latestUserText', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return DEFAULT_TEXT;
      },
    });
    let safetyGetterCalls = 0;
    const hostileSafety = candidateInput(runtime);
    Object.defineProperty(hostileSafety.safety, 'latestUserText', {
      enumerable: true,
      get() {
        safetyGetterCalls += 1;
        return 'safe_for_model';
      },
    });

    const unsafeResult = await runTutorModelCandidate(unsafe);
    const hostileResult = await runTutorModelCandidate(
      hostile as unknown as TutorModelCandidateInput,
    );
    const hostileSafetyResult = await runTutorModelCandidate(hostileSafety);

    expect(requests).toHaveLength(0);
    expect(getterCalls).toBe(0);
    expect(safetyGetterCalls).toBe(0);
    expect(unsafeResult.observation.disposition).toBe('safety_blocked');
    expect(hostileResult.observation.disposition).toBe('fallback_invalid_input');
    expect(hostileSafetyResult.observation.disposition).toBe('fallback_invalid_input');
  });

  test.each([
    {
      text: '我有点卡住，能不能别一下说完，带我往下走？',
      intent: 'socratic_hint' as const,
      depth: 'standard' as const,
      evidenceCodes: ['implicit_hint_request'] as const,
      expectedSignal: 'implicit_learning_request',
    },
    {
      text: '这一步对吗？我又想知道为什么会这样。',
      intent: 'step_check' as const,
      depth: 'standard' as const,
      evidenceCodes: ['submitted_step', 'ambiguous_intent'] as const,
      expectedSignal: 'conflicting_intent_signals',
    },
    {
      text: '那接下来呢？',
      intent: 'general_follow_up' as const,
      depth: 'standard' as const,
      evidenceCodes: ['contextual_reference'] as const,
      expectedSignal: 'general_follow_up',
    },
  ])(
    'invokes exactly once for governed implicit/contextual/conflicting intent: $intent',
    async ({ text, intent, depth, evidenceCodes, expectedSignal }) => {
      const { requests, runtime } = createTrackedMockRuntime({
        intent,
        depth,
        confidence: 'high',
        evidenceCodes,
      });
      const input = candidateInput(runtime, { latestUserText: text });

      const result = await runTutorModelCandidate(input);

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        task: 'tutor_strategy',
        maxOutputTokens: 300,
      });
      expect(requests[0]?.systemPrompt).toContain(TUTOR_MODEL_PROMPT_VERSION);
      expect(requests[0]?.systemPrompt).toContain(formatTutorModelIntentPolicyForPrompt());
      expect(requests[0]?.estimatedInputTokens).toBeLessThanOrEqual(1_200);
      expect(requests[0]?.budget).toMatchObject({
        usedCalls: 0,
        usedInputTokens: 0,
        usedOutputTokens: 0,
      });
      expect(requests[0]?.userPrompt).toContain(expectedSignal);
      expect(result.observation.disposition).toBe('candidate_applied');
      expect(result.observation.attempted).toBe(true);
      expect(result.observation.budget).toMatchObject({
        usedCalls: 1,
        usedInputTokens: requests[0]?.estimatedInputTokens,
        usedOutputTokens: 300,
      });
      expect(result.result.intent).toBe(intent);
      expect(JSON.stringify(result.observation)).not.toMatch(
        /latestUserText|activeStudyContext|userPrompt|api[_-]?key|cookie/i,
      );
    },
  );

  test('rebuilds hint pedagogy locally and never admits a final answer section', async () => {
    const { runtime } = createTrackedMockRuntime({
      intent: 'socratic_hint',
      depth: 'brief',
      confidence: 'high',
      evidenceCodes: ['implicit_hint_request'],
    });
    const input = candidateInput(runtime);

    const result = await runTutorModelCandidate(input);

    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.result).toMatchObject({
      intent: 'socratic_hint',
      depth: 'brief',
      shouldAskGuidingQuestion: true,
      shouldGiveFinalAnswer: false,
      shouldUseActiveStudyContext: true,
    });
    expect(result.result.answerStructure).toEqual([
      'known_conditions',
      'concept',
      'reasoning_steps',
      'guiding_question',
    ]);
    expect(result.result.answerStructure).not.toContain('final_answer');
    expect(result.result.promptAddition).toContain('TutorAgent strategy: socratic_hint');
    expect(result.result.promptAddition).not.toContain(DEFAULT_TEXT);
    expect(result.result.debug.reason).toBe('Governed Tutor candidate selected a bounded strategy.');
    expect(result.result.debug.matchedSignals).toEqual([
      'model:implicit_hint_request',
    ]);
  });

  test('keeps incompatible depth rejection in the local merger for every intent', () => {
    const deterministic = buildTutorStrategy({
      latestUserText: DEFAULT_TEXT,
      activeStudyContext: DEFAULT_CONTEXT,
    });

    for (const policy of TUTOR_MODEL_INTENT_POLICY) {
      for (const depth of TUTOR_MODEL_DEPTHS) {
        if (policy.compatibleDepths.includes(depth)) continue;
        const validated = validateTutorModelDecision({
          intent: policy.intent,
          depth,
          confidence: 'high',
          evidenceCodes: [policy.primaryEvidenceCodes[0]],
        });

        expect(validated.ok, `${policy.intent}:${depth}:contract`).toBe(true);
        if (!validated.ok) continue;
        expect(
          mergeTutorModelDecision(deterministic, validated.value),
          `${policy.intent}:${depth}:local_merger`,
        ).toBeNull();
      }
    }
  });

  test('rejects answer_direct, invalid evidence association, and incompatible depth', async () => {
    const cases = [
      {
        intent: 'answer_direct',
        depth: 'brief',
        confidence: 'high',
        evidenceCodes: ['implicit_hint_request'],
      },
      {
        intent: 'step_check',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['concept_gap'],
      },
      {
        intent: 'socratic_hint',
        depth: 'deep',
        confidence: 'high',
        evidenceCodes: ['implicit_hint_request'],
      },
    ];

    for (const output of cases) {
      const { requests, runtime } = createTrackedMockRuntime(output);
      const input = candidateInput(runtime);
      const result = await runTutorModelCandidate(input);

      expect(requests).toHaveLength(1);
      expect(result.result).toEqual(input.deterministic);
      expect(result.observation.disposition).toBe('fallback_schema_invalid');
    }
  });

  test('returns the deterministic strategy for timeout, malformed usage, and thrown runtime', async () => {
    const timeoutRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const reservation = reserveModelAgentBudget(request.budget, {
          inputTokens: request.estimatedInputTokens,
          outputTokens: request.maxOutputTokens,
        });
        if (!reservation.ok) throw new Error(reservation.code);
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'unsafe raw timeout', retryable: true },
          budget: reservation.budget,
          usage: { inputTokens: 0, outputTokens: 0 },
          trace: {
            runIdHash: `sha256:${'0'.repeat(64)}`,
            task: 'tutor_strategy',
            mode: 'mock',
            provider: 'mock',
            model: 'tutor-timeout-test',
            status: 'failed',
            inputTokens: 0,
            outputTokens: 0,
            maxOutputTokens: 300,
            durationMs: 1,
            degraded: true,
            errorCode: 'TIMEOUT',
          },
        };
      },
    };
    const malformedUsageRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const reservation = reserveModelAgentBudget(request.budget, {
          inputTokens: request.estimatedInputTokens,
          outputTokens: request.maxOutputTokens,
        });
        if (!reservation.ok) throw new Error(reservation.code);
        return {
          ok: true,
          data: {
            intent: 'socratic_hint',
            depth: 'standard',
            confidence: 'high',
            evidenceCodes: ['implicit_hint_request'],
          } as T,
          budget: reservation.budget,
          usage: { inputTokens: 1, outputTokens: 301 },
          trace: {
            runIdHash: `sha256:${'1'.repeat(64)}`,
            task: 'tutor_strategy',
            mode: 'mock',
            provider: 'mock',
            model: 'tutor-usage-test',
            status: 'succeeded',
            inputTokens: 1,
            outputTokens: 301,
            maxOutputTokens: 300,
            durationMs: 1,
            degraded: false,
          },
        };
      },
    };
    const thrownRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        throw new Error('unsafe raw provider error');
      },
    };

    const inputs = [timeoutRuntime, malformedUsageRuntime, thrownRuntime].map((runtime) =>
      candidateInput(runtime),
    );
    const results = await Promise.all(inputs.map((input) => runTutorModelCandidate(input)));

    expect(results.map((result) => result.result)).toEqual(
      inputs.map((input) => input.deterministic),
    );
    expect(results.map((result) => result.observation.disposition)).toEqual([
      'fallback_timeout',
      'fallback_runtime_error',
      'fallback_runtime_error',
    ]);
    expect(results[1]?.observation).toMatchObject({
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
    });
    expect(results[2]?.observation).toMatchObject({
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
    });
  });

  test('discards a successful runtime result when the request aborts during the call', async () => {
    const abortController = new AbortController();
    const inner = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'tutor-post-abort-test',
      liveCallsEnabled: false,
      timeoutMs: 500,
      mockResponder: () => ({
        intent: 'socratic_hint',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['implicit_hint_request'],
      }),
    });
    const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const result = await inner.invokeStructured(request);
        abortController.abort();
        return result;
      },
    };
    const input = candidateInput(runtime, { signal: abortController.signal });

    const result = await runTutorModelCandidate(input);

    expect(result.result).toEqual(input.deterministic);
    expect(result.observation).toMatchObject({
      attempted: true,
      disposition: 'fallback_aborted',
    });
  });

  test('merger accepts only locally compatible strategy combinations', () => {
    const deterministic = buildTutorStrategy({
      latestUserText: DEFAULT_TEXT,
      activeStudyContext: DEFAULT_CONTEXT,
    });
    expect(
      mergeTutorModelDecision(deterministic, {
        intent: 'concept_bridge',
        depth: 'deep',
        confidence: 'medium',
        evidenceCodes: ['concept_gap'],
      }),
    ).toMatchObject({
      intent: 'concept_bridge',
      depth: 'deep',
      shouldGiveFinalAnswer: false,
    });
    expect(
      mergeTutorModelDecision(deterministic, {
        intent: 'step_check',
        depth: 'deep',
        confidence: 'high',
        evidenceCodes: ['submitted_step'],
      }),
    ).toBeNull();
    const explicitAnswer = buildTutorStrategy({
      latestUserText: '直接给我答案。',
      activeStudyContext: DEFAULT_CONTEXT,
    });
    expect(
      mergeTutorModelDecision(explicitAnswer, {
        intent: 'socratic_hint',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['implicit_hint_request'],
      }),
    ).toBeNull();
  });
});
