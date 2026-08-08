import 'server-only';

import type { FinalResponseStreamExecutor } from '@repo/ai';
import {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  type FinalResponseAgentConfigV1,
} from '@repo/agent/final-response';

import { createFinalResponseModelRuntimeBundle } from './final-response-model-runtime.ts';

export type ChatFinalResponseRuntimeV1 = Readonly<{
  config: FinalResponseAgentConfigV1;
  executor?: FinalResponseStreamExecutor;
}>;

export function createChatFinalResponseRuntimeV1(
  input: Readonly<{
    mode: 'mock' | 'live';
    mockText: string;
    env?: Record<string, unknown>;
  }>,
): ChatFinalResponseRuntimeV1 {
  if (input.mode === 'mock') {
    return Object.freeze({
      config: reviewedMockConfig(),
      executor: createReviewedMockExecutor(input.mockText),
    });
  }

  const bundle = createFinalResponseModelRuntimeBundle({ env: input.env ?? process.env });
  if (!bundle.config.enabled || bundle.config.runtimeAuthority !== 'production_live') {
    return Object.freeze({ config: bundle.config });
  }
  const executor: FinalResponseStreamExecutor = (request) => bundle.createExecutor()(request);
  return Object.freeze({ config: bundle.config, executor });
}

function reviewedMockConfig(): FinalResponseAgentConfigV1 {
  return Object.freeze({
    schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
    enabled: true,
    runtimeAuthority: 'reviewed_mock',
    mode: 'mock',
    provider: 'mock',
    modelRef: 'mock-local-v1',
    executorProvenance: 'mock_synthetic',
    timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
    maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
    maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
    priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
    inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
    outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
    requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  });
}

function createReviewedMockExecutor(text: string): FinalResponseStreamExecutor {
  const chunks = splitText(text);
  const outputTokens = Math.max(1, Math.min(1_200, Math.ceil(text.length / 4)));
  return async function* reviewedMockExecutor({ signal }) {
    for (const chunk of chunks) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      yield Object.freeze({ type: 'text_delta' as const, text: chunk });
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    yield Object.freeze({
      type: 'finish' as const,
      finishReason: 'stop' as const,
      usage: Object.freeze({ inputTokens: 256, outputTokens }),
    });
  };
}

function splitText(text: string): readonly string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 18) {
    chunks.push(text.slice(index, index + 18));
  }
  return Object.freeze(chunks.length === 0 ? ['暂时无法生成回答。'] : chunks);
}
