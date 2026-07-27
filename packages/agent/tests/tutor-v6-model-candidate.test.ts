import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import * as TutorV6Public from '@repo/agent/tutor-v6';

import { phase697V2TutorCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  mergeTutorV6ModelDecision,
  runTutorV6ModelCandidate,
  type TutorV6ModelCandidateInput,
} from '../src/model-candidates/tutor-v6-model-candidate.ts';
import {
  TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V6_MODEL_PROMPT_VERSION,
  validateTutorV6ModelDecision,
} from '../src/model-candidates/tutor-v6-model-contract.ts';
import { projectTutorV6ModelInput } from '../src/model-candidates/tutor-v6-model-projection.ts';

describe('Phase 6.9.7 Tutor V6 intent-only candidate', () => {
  test('freezes an independent V6 prompt and public subpath', () => {
    expect(TUTOR_V6_MODEL_PROMPT_VERSION).toBe('tutor-model-candidate-v6');
    expect(TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256).toBe(TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256);
    expect(TutorV6Public.runTutorV6ModelCandidate).toBe(runTutorV6ModelCandidate);
    expect(TutorV6Public.TUTOR_V6_MODEL_PROMPT_VERSION).toBe(TUTOR_V6_MODEL_PROMPT_VERSION);
    expect(TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256).not.toBe(
      '7c7442ffa96f78f23e75a34f8526e65c48f9dce5efe2b344d58cd68d5b6c5f87',
    );
  });

  test('projects only text, context availability, authority hashes, and eligible intent ordinals', () => {
    const projected = projectTutorV6ModelInput({
      latestUserText: '请检查我这一步，再完整解释这道题。',
      activeStudyContext: '当前正在复习一元二次方程。',
      safety: {
        latestUserText: 'safe_for_model',
        activeStudyContext: 'safe_for_model',
      },
    });
    expect(projected.ok).toBe(true);
    if (!projected.ok) throw new Error(projected.reasonCode);
    expect(projected.value.prompt.eligibleIntents.length).toBeGreaterThan(1);
    expect(projected.value.prompt.eligibleIntents[0]).toEqual({
      intentIndex: 0,
      intent: 'step_check',
    });
    const prompt = JSON.stringify(projected.value.prompt);
    for (const forbidden of [
      'preferredDepth',
      'answerStructure',
      'shouldGiveFinalAnswer',
      'primaryIntent',
      'detectedSignals',
      'caseId',
      'expected',
    ]) {
      expect(prompt).not.toContain(forbidden);
    }
    expect(Object.isFrozen(projected.value.prompt)).toBe(true);
  });

  test('applies all 24 frozen V2 runtime intents while rebuilding depth and pedagogy locally', async () => {
    const runtimeCases = phase697V2TutorCases.filter((entry) => entry.subset === 'runtime');
    expect(runtimeCases).toHaveLength(24);
    for (const runtimeCase of runtimeCases) {
      const projected = projectTutorV6ModelInput({
        latestUserText: runtimeCase.input.latestUserText,
        activeStudyContext: runtimeCase.input.activeStudyContext,
        safety: {
          latestUserText: 'safe_for_model',
          activeStudyContext: 'safe_for_model',
        },
      });
      if (!projected.ok) throw new Error(`${runtimeCase.id}:${projected.reasonCode}`);
      const choice = projected.value.prompt.eligibleIntents.find(
        (entry) => entry.intent === runtimeCase.expected.intent,
      );
      if (!choice) throw new Error(`${runtimeCase.id}:expected intent not locally eligible`);
      const tracked = trackedRuntime({ intentIndex: choice.intentIndex });
      const result = await runTutorV6ModelCandidate(
        candidateInput(
          runtimeCase.input.latestUserText,
          runtimeCase.input.activeStudyContext,
          tracked.runtime,
        ),
      );
      expect(tracked.requests, runtimeCase.id).toHaveLength(1);
      expect(result.observation.disposition, runtimeCase.id).toBe('candidate_applied');
      expect(result.result.intent, runtimeCase.id).toBe(runtimeCase.expected.intent);
      expect(result.result.depth, runtimeCase.id).toBe(runtimeCase.expected.depth);
      expect(result.result.shouldUseActiveStudyContext, runtimeCase.id).toBe(
        runtimeCase.expected.contextUse,
      );
      expect(result.result.shouldAskGuidingQuestion, runtimeCase.id).toBe(
        runtimeCase.expected.guidingQuestion,
      );
      expect(result.result.shouldGiveFinalAnswer, runtimeCase.id).toBe(
        runtimeCase.expected.finalAnswer,
      );
      expect(result.result.answerStructure, runtimeCase.id).toEqual(
        runtimeCase.expected.answerStructure,
      );
      expect(tracked.requests[0]!.maxOutputTokens, runtimeCase.id).toBe(300);
      expect(tracked.requests[0]!.estimatedInputTokens, runtimeCase.id).toBeLessThanOrEqual(1_200);
    }
  });

  test('keeps route, safety, explicit instruction, abort, and budget guards at zero calls', async () => {
    const cases: readonly Readonly<{
      input: TutorV6ModelCandidateInput;
      disposition: string;
      reason: string;
    }>[] = [
      {
        input: candidateInput('请给我一个提示。', undefined, neverRuntime(), {
          finalRoute: 'chat',
        }),
        disposition: 'not_eligible',
        reason: 'route_not_tutor',
      },
      {
        input: candidateInput('直接给我答案。', undefined, neverRuntime()),
        disposition: 'not_eligible',
        reason: 'answer_direct_local_only',
      },
      {
        input: candidateInput('请给我一个提示。', undefined, neverRuntime(), {
          safety: { latestUserText: 'unsafe' },
        }),
        disposition: 'safety_blocked',
        reason: 'unsafe_metadata',
      },
      {
        input: candidateInput('请给我一个提示。', undefined, neverRuntime(), {
          signal: AbortSignal.abort(),
        }),
        disposition: 'fallback_aborted',
        reason: 'ABORTED',
      },
      {
        input: candidateInput('请给我一个提示。', undefined, neverRuntime(), {
          budget: exhaustedBudget(1_200, 300),
        }),
        disposition: 'fallback_budget_exceeded',
        reason: 'CALL_BUDGET_EXCEEDED',
      },
    ];
    for (const item of cases) {
      const result = await runTutorV6ModelCandidate(item.input);
      expect(result.observation.attempted).toBe(false);
      expect(result.observation.disposition).toBe(item.disposition);
      expect(result.observation.reasonCodes).toContain(item.reason);
    }
  });

  test('fails closed after one call for extra fields, runtime throw, and post-call abort', async () => {
    const invalid = trackedRuntime({ intentIndex: 0, depth: 'deep' });
    const invalidResult = await runTutorV6ModelCandidate(
      candidateInput('请给我一个提示。', undefined, invalid.runtime),
    );
    expect(invalid.requests).toHaveLength(1);
    expect(invalidResult.observation.disposition).toBe('fallback_schema_invalid');

    let throwCalls = 0;
    const thrown = await runTutorV6ModelCandidate(
      candidateInput('请给我一个提示。', undefined, {
        async invokeStructured() {
          throwCalls += 1;
          throw new Error('synthetic no-network failure');
        },
      }),
    );
    expect(throwCalls).toBe(1);
    expect(thrown.observation.disposition).toBe('fallback_runtime_error');

    const controller = new AbortController();
    const inner = trackedRuntime({ intentIndex: 0 });
    let abortCalls = 0;
    const aborted = await runTutorV6ModelCandidate(
      candidateInput(
        '请给我一个提示。',
        undefined,
        {
          async invokeStructured<T>(request: ModelAgentRequest<T>) {
            abortCalls += 1;
            const response = await inner.runtime.invokeStructured(request);
            controller.abort('after-call');
            return response;
          },
        },
        { signal: controller.signal },
      ),
    );
    expect(abortCalls).toBe(1);
    expect(aborted.observation.disposition).toBe('fallback_aborted');
  });

  test('rejects authority drift and never lets the model supply depth or final-answer fields', () => {
    const projected = projectTutorV6ModelInput({
      latestUserText: '请给我一个提示。',
      safety: { latestUserText: 'safe_for_model' },
    });
    if (!projected.ok) throw new Error(projected.reasonCode);
    expect(
      validateTutorV6ModelDecision({
        decision: { intentIndex: 0, confidence: 'high' },
        signalAuthority: projected.value.signalAuthority,
        preferredDepthAuthority: projected.value.preferredDepthAuthority,
      }),
    ).toEqual({ ok: false, reasonCode: 'schema_invalid' });

    const tampered = structuredClone(projected.value.preferredDepthAuthority);
    tampered.input.eligibleIntents = ['general_follow_up'];
    expect(
      mergeTutorV6ModelDecision({
        deterministic: buildTutorStrategy({ latestUserText: '请给我一个提示。' }),
        signalAuthority: projected.value.signalAuthority,
        preferredDepthAuthority: tampered,
        decision: { intentIndex: 0 },
      }),
    ).toBeNull();
  });

  test('keeps actual request bytes free of frozen cases, oracle fields, and V1-V5 prompt identities', async () => {
    const tracked = trackedRuntime({ intentIndex: 0 });
    const result = await runTutorV6ModelCandidate(
      candidateInput(
        '为什么这里要先约分？请给我一个提示。',
        '当前题目是分式方程。',
        tracked.runtime,
      ),
    );
    expect(result.observation.disposition).toBe('candidate_applied');
    const request = tracked.requests[0]!;
    const bytes = `${request.systemPrompt}\n${request.userPrompt}`;
    const forbidden = [
      'phase-6.9-tutor-wrong-question-v2',
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      'acceptedTopicLabels',
      'canonicalTopicLabel',
      'tutor-model-candidate-v1',
      'tutor-model-candidate-v2',
      'tutor-model-candidate-v3',
      'tutor-model-candidate-v4',
      'tutor-model-candidate-v5',
      ...phase697V2TutorCases.map((entry) => entry.id),
    ];
    expect(forbidden.filter((token) => bytes.includes(token))).toEqual([]);
    expect(request.schema.safeParse({ intentIndex: 0 }).success).toBe(true);
    expect(request.schema.safeParse({ intentIndex: 0, depth: 'deep' }).success).toBe(false);
  });

  test('rejects hostile top-level and runtime accessors without invoking them', async () => {
    let reads = 0;
    const topLevel = candidateInput(
      '为什么这里要先约分？请给我一个提示。',
      undefined,
      neverRuntime(),
    );
    Object.defineProperty(topLevel, 'runtime', {
      get() {
        reads += 1;
        throw new Error('hostile top-level runtime getter');
      },
    });
    const topLevelResult = await runTutorV6ModelCandidate(topLevel);
    expect(reads).toBe(0);
    expect(topLevelResult.observation.attempted).toBe(false);
    expect(topLevelResult.observation.disposition).toBe('fallback_invalid_input');

    const runtime = {} as Pick<ModelAgentRuntime, 'invokeStructured'>;
    Object.defineProperty(runtime, 'invokeStructured', {
      get() {
        reads += 1;
        throw new Error('hostile invoke getter');
      },
    });
    const runtimeResult = await runTutorV6ModelCandidate(
      candidateInput('为什么这里要先约分？请给我一个提示。', undefined, runtime),
    );
    expect(reads).toBe(0);
    expect(runtimeResult.observation.attempted).toBe(false);
    expect(runtimeResult.observation.disposition).toBe('fallback_invalid_input');
  });
});

function candidateInput(
  latestUserText: string,
  activeStudyContext: string | undefined,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<
    Pick<TutorV6ModelCandidateInput, 'finalRoute' | 'safety' | 'budget' | 'signal'>
  > = {},
): TutorV6ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-tutor-v6-r2-no-network',
    finalRoute: overrides.finalRoute ?? 'tutor',
    latestUserText,
    ...(activeStudyContext === undefined ? {} : { activeStudyContext }),
    deterministic: buildTutorStrategy({
      latestUserText,
      ...(activeStudyContext === undefined ? {} : { activeStudyContext }),
    }),
    safety:
      overrides.safety ??
      ({
        latestUserText: 'safe_for_model',
        ...(activeStudyContext === undefined
          ? {}
          : { activeStudyContext: 'safe_for_model' as const }),
      } as const),
    runtime,
    budget: overrides.budget ?? candidateBudget(1_200, 300),
    ...(overrides.signal === undefined ? {} : { signal: overrides.signal }),
  };
}

function candidateBudget(maxInputTokens: number, maxOutputTokens: number) {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens, maxOutputTokens });
}

function exhaustedBudget(maxInputTokens: number, maxOutputTokens: number): ModelAgentRunBudget {
  return Object.freeze({
    maxCalls: 1,
    usedCalls: 1,
    maxInputTokens,
    usedInputTokens: 1,
    maxOutputTokens,
    usedOutputTokens: 1,
  });
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-tutor-v6-r2-no-network',
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

function neverRuntime(): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured() {
      throw new Error('zero-call guard violated');
    },
  };
}
