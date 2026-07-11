import type { StructuredModelExecutor } from '@repo/ai';

import { parseEnv } from '../config/env';
import { conversationSummaryOutputSchema } from './conversation-summary-contract';
import { createConversationSummaryRuntime } from './conversation-summary-runtime.factory';

describe('conversation summary runtime factory', () => {
  const requiredEnv = {
    DATABASE_URL: 'postgresql://prepmind:devpass@127.0.0.1:5433/prepmind',
    JWT_SECRET: 'dev-secret-change-me',
  };

  it('uses the conversation_summary task and strict schema in Mock', async () => {
    const bundle = createConversationSummaryRuntime(parseEnv(requiredEnv));
    const result = await bundle.runtime.invokeStructured({
      runId: 'summary_run_1',
      task: 'conversation_summary',
      schema: conversationSummaryOutputSchema,
      systemPrompt: 'fixed summary instruction',
      userPrompt: 'synthetic redacted conversation',
      estimatedInputTokens: 120,
      maxOutputTokens: 80,
      budget: bundle.createBudget(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected mock summary');
    expect(result.data.summary).toEqual(expect.any(String));
    expect(result.budget).toMatchObject({ usedCalls: 1, usedInputTokens: 120 });
    expect(result.trace).toMatchObject({
      task: 'conversation_summary',
      mode: 'mock',
      provider: 'mock',
    });
  });

  it('blocks Live before budget reservation when the live gate is disabled', async () => {
    let calls = 0;
    const executor: StructuredModelExecutor = () => {
      calls += 1;
      return Promise.resolve({ object: { summary: 'must not run' } });
    };
    const bundle = createConversationSummaryRuntime(
      parseEnv({ ...requiredEnv, AI_PROVIDER_MODE: 'live' }),
      { createExecutor: () => executor },
    );
    const result = await bundle.runtime.invokeStructured({
      runId: 'summary_run_2',
      task: 'conversation_summary',
      schema: conversationSummaryOutputSchema,
      systemPrompt: 'fixed summary instruction',
      userPrompt: 'synthetic redacted conversation',
      estimatedInputTokens: 120,
      maxOutputTokens: 80,
      budget: bundle.createBudget(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected live guard');
    expect(result.error.code).toBe('LIVE_CALLS_DISABLED');
    expect(result.budget.usedCalls).toBe(0);
    expect(calls).toBe(0);
  });

  it('creates a bounded Live executor without returning credentials or base URL', () => {
    const executor: StructuredModelExecutor = () =>
      Promise.resolve({
        object: { summary: 'safe live summary' },
        usage: { inputTokens: 10, outputTokens: 4 },
      });
    const createExecutor = jest.fn(() => executor);
    const bundle = createConversationSummaryRuntime(
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        DEEPSEEK_API_KEY: 'private-summary-key',
      }),
      { createExecutor },
    );

    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'deepseek',
      apiKey: 'private-summary-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
    });
    expect(JSON.stringify(bundle)).not.toContain('private-summary-key');
    expect(JSON.stringify(bundle)).not.toContain('api.deepseek.com');
    expect(bundle.createBudget()).toEqual({
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: 1600,
      usedInputTokens: 0,
      maxOutputTokens: 400,
      usedOutputTokens: 0,
    });
  });

  it('uses the OpenAI official base URL when only the OpenAI key is configured', () => {
    const executor: StructuredModelExecutor = () =>
      Promise.resolve({ object: { summary: 'safe summary' } });
    const createExecutor = jest.fn(() => executor);

    createConversationSummaryRuntime(
      parseEnv({
        ...requiredEnv,
        AI_PROVIDER_MODE: 'live',
        AI_ENABLE_LIVE_CALLS: 'true',
        OPENAI_API_KEY: 'private-openai-key',
        AI_MODEL: 'gpt-4o-mini',
      }),
      { createExecutor },
    );

    expect(createExecutor).toHaveBeenCalledWith({
      provider: 'openai',
      apiKey: 'private-openai-key',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });
  });
});
