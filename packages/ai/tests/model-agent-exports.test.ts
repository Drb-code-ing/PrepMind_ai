import { describe, expect, it } from 'bun:test';

describe('@repo/ai public model agent runtime exports', () => {
  it('exports the shared runtime and removes non-working placeholders', async () => {
    const module = await import('@repo/ai');

    expect(typeof module.createModelAgentBudget).toBe('function');
    expect(typeof module.createModelAgentRuntime).toBe('function');
    expect(typeof module.createOpenAICompatibleStructuredExecutor).toBe('function');
    expect(typeof module.createFirstPartyDeepSeekV4Runtime).toBe('function');
    expect(typeof module.createFirstPartyDeepSeekV4ProDirectAdapter).toBe('function');
    expect(typeof module.createQwenTextEmbeddingV4Provider).toBe('function');
    expect(module.QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE).toBe(
      'qwen-text-embedding-v4-cn-beijing-cny-2026-08-05',
    );
    expect(typeof module.createPhase697V7WireDiagnostics).toBe('function');
    expect(module.FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION).toBe(
      'first-party-deepseek-v4-pro-direct-v1',
    );
    expect('advancePhase697V7WireStage' in module).toBe(false);
    expect('abortPhase697V7Wire' in module).toBe(false);
    expect('completePhase697V7Wire' in module).toBe(false);
    expect('projectPhase697V7WireFailure' in module).toBe(false);
    expect('createTrustedDeepSeekV4JsonExecutor' in module).toBe(false);
    expect('createLLM' in module).toBe(false);
    expect('streamText' in module).toBe(false);
    expect('generateObject' in module).toBe(false);
  });
});
