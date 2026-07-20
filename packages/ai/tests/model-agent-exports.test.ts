import { describe, expect, it } from 'bun:test';

describe('@repo/ai public model agent runtime exports', () => {
  it('exports the shared runtime and removes non-working placeholders', async () => {
    const module = await import('@repo/ai');

    expect(typeof module.createModelAgentBudget).toBe('function');
    expect(typeof module.createModelAgentRuntime).toBe('function');
    expect(typeof module.createOpenAICompatibleStructuredExecutor).toBe('function');
    expect(typeof module.createFirstPartyDeepSeekV4Runtime).toBe('function');
    expect('createTrustedDeepSeekV4JsonExecutor' in module).toBe(false);
    expect('createLLM' in module).toBe(false);
    expect('streamText' in module).toBe(false);
    expect('generateObject' in module).toBe(false);
  });
});
