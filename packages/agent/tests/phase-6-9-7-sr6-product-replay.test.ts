import { describe, expect, test } from 'bun:test';

import { createModelAgentBudget } from '@repo/ai';
import {
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256,
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL,
  createPhase697Sr6ProductReplayRuntime,
  isPhase697Sr6ProductReplayTrace,
  resolvePhase697Sr6ProductReplayConfig,
} from '@repo/agent/model-candidates';
import { z } from 'zod';

import { projectTutorV6ModelInput } from '../src/model-candidates/tutor-v6-model-projection.ts';

const BASE_ENV = Object.freeze({
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED: 'true',
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENT: 'both',
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIOR: 'success',
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256: PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256,
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_MAX_REQUESTS: '2',
  AI_PROVIDER_MODE: 'mock',
  AI_ENABLE_LIVE_CALLS: 'false',
  TUTOR_AGENT_MODEL_ENABLED: 'false',
  WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'false',
});

describe('Phase 6.9.7 SR6 sealed-authority product replay', () => {
  test('admits only the exact default-off zero-provider capability', () => {
    expect(resolvePhase697Sr6ProductReplayConfig(BASE_ENV, 'tutor')).toMatchObject({
      enabled: true,
      component: 'both',
      behavior: 'success',
      maxRequests: 1,
      totalMaxRequests: 2,
    });
    expect(
      resolvePhase697Sr6ProductReplayConfig({ ...BASE_ENV, AI_ENABLE_LIVE_CALLS: 'true' }, 'tutor')
        .enabled,
    ).toBe(false);
    expect(
      resolvePhase697Sr6ProductReplayConfig(
        {
          ...BASE_ENV,
          PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256: '0'.repeat(64),
        },
        'organizer',
      ).enabled,
    ).toBe(false);
    for (const override of [
      { DEEPSEEK_API_KEY: 'configured' },
      { TUTOR_AGENT_DEEPSEEK_API_KEY: 'configured' },
      { WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'configured' },
      { KNOWLEDGE_AGENT_DEEPSEEK_API_KEY: 'configured' },
      { OPENAI_API_KEY: 'configured' },
      { QWEN_API_KEY: 'configured' },
      { DASHSCOPE_API_KEY: 'configured' },
      { ROUTER_MODEL_ENABLED: 'true' },
      { KNOWLEDGE_VERIFIER_MODEL_ENABLED: 'true' },
      { REVIEW_AGENT_MODEL_ENABLED: 'true' },
      { PLANNER_AGENT_MODEL_ENABLED: 'true' },
      { KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED: 'true' },
      { KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED: 'true' },
      { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true' },
      { RAG_EMBEDDING_PROVIDER: 'qwen' },
      { SERVER_ROLE: 'worker' },
      { AI_ENABLE_LIVE_CALLS: 'TRUE' },
    ]) {
      expect(
        resolvePhase697Sr6ProductReplayConfig({ ...BASE_ENV, ...override }, 'tutor').enabled,
      ).toBe(false);
    }
    expect(
      resolvePhase697Sr6ProductReplayConfig(
        { ...BASE_ENV, PHASE_6_9_7_SR6_PRODUCT_REPLAY_MAX_REQUESTS: '1' },
        'tutor',
      ).enabled,
    ).toBe(false);
    expect(
      resolvePhase697Sr6ProductReplayConfig(
        {
          ...BASE_ENV,
          PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENT: 'tutor',
        },
        'organizer',
      ).enabled,
    ).toBe(false);
  });

  test('replays one Tutor ordinal as an explicit mock trace without a Provider', async () => {
    const projection = projectTutorV6ModelInput({
      latestUserText: '我写到 x=2 这一步了，想确认推导是否正确。',
      safety: { latestUserText: 'safe_for_model' },
    });
    expect(projection.ok).toBe(true);
    if (!projection.ok) throw new Error(projection.reasonCode);
    const selected = projection.value.prompt.eligibleIntents[0];
    if (!selected) throw new Error('SR6_TUTOR_TEST_INTENT_MISSING');
    const runtime = createPhase697Sr6ProductReplayRuntime({
      component: 'tutor',
      behavior: 'success',
      maxRequests: 1,
    });
    const result = await runtime.invokeStructured({
      runId: 'sr6_tutor_replay_1',
      task: 'tutor_strategy',
      schema: z.object({ intentIndex: z.number().int() }).strict(),
      systemPrompt: 'Tutor V6 bounded policy.',
      userPrompt: JSON.stringify(projection.value.prompt),
      estimatedInputTokens: 120,
      maxOutputTokens: 300,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: 1_200,
        maxOutputTokens: 300,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      data: { intentIndex: selected.intentIndex },
      usage: { inputTokens: 120 },
      trace: {
        mode: 'mock',
        provider: 'mock',
        model: PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL,
        status: 'succeeded',
      },
    });
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(isPhase697Sr6ProductReplayTrace(result.trace, 'tutor_strategy')).toBe(true);
    expect(
      isPhase697Sr6ProductReplayTrace(
        { ...result.trace, model: 'phase-6.9.7-sr6-sealed-replay' },
        'tutor_strategy',
      ),
    ).toBe(false);
  });

  test('replays one locally exposed Organizer option per question', async () => {
    const runtime = createPhase697Sr6ProductReplayRuntime({
      component: 'organizer',
      behavior: 'success',
      maxRequests: 1,
    });
    const result = await runtime.invokeStructured({
      runId: 'sr6_organizer_replay_1',
      task: 'wrong_question_organization',
      schema: z
        .object({
          decisions: z
            .array(
              z
                .object({
                  questionIndex: z.number().int(),
                  optionIndex: z.number().int(),
                })
                .strict(),
            )
            .min(1),
        })
        .strict(),
      systemPrompt: 'Organizer V9 bounded policy.',
      userPrompt: JSON.stringify({
        version: 'wrong-question-organizer-model-projection-v9',
        questions: [
          {
            questionIndex: 0,
            fields: {},
            options: [
              {
                optionIndex: 4,
                subjectLabel: 'math',
                actionLabel: 'create_topic',
                sourceLabel: 'question_semantic',
                targetLabel: '函数极限',
              },
            ],
          },
          {
            questionIndex: 1,
            fields: {},
            options: [
              {
                optionIndex: 7,
                subjectLabel: 'computer',
                actionLabel: 'create_topic',
                sourceLabel: 'knowledge_point',
                targetLabel: '进程同步',
              },
            ],
          },
        ],
      }),
      estimatedInputTokens: 280,
      maxOutputTokens: 800,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: 3_500,
        maxOutputTokens: 800,
      }),
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        decisions: [
          { questionIndex: 0, optionIndex: 4 },
          { questionIndex: 1, optionIndex: 7 },
        ],
      },
      trace: { mode: 'mock', provider: 'mock' },
    });
  });

  test('forced failure is bounded, traceable, and never retries past the cap', async () => {
    const runtime = createPhase697Sr6ProductReplayRuntime({
      component: 'tutor',
      behavior: 'forced_failure',
      maxRequests: 1,
    });
    const request = {
      runId: 'sr6_tutor_replay_failure',
      task: 'tutor_strategy' as const,
      schema: z.object({ intentIndex: z.number().int() }).strict(),
      systemPrompt: 'Tutor V6 bounded policy.',
      userPrompt: '{}',
      estimatedInputTokens: 10,
      maxOutputTokens: 300,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: 1_200,
        maxOutputTokens: 300,
      }),
    };

    await expect(runtime.invokeStructured(request)).resolves.toMatchObject({
      ok: false,
      error: { code: 'PROVIDER_ERROR' },
      trace: { mode: 'mock', provider: 'mock', status: 'failed' },
    });
    await expect(runtime.invokeStructured(request)).rejects.toThrow(
      'PHASE_6_9_7_SR6_PRODUCT_REPLAY_REQUEST_LIMIT',
    );
  });
});
