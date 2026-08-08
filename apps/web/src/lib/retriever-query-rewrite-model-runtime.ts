import 'server-only';

import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type CreateModelAgentRuntimeInput,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  RETRIEVER_QUERY_REWRITE_MODEL,
  RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  resolveRetrieverQueryRewriteLiveExecutorConfig,
  resolveRetrieverQueryRewriteModelConfig,
  type RetrieverQueryRewriteModelConfig,
} from './retriever-query-rewrite-model-config.ts';

export type RetrieverQueryRewriteModelRuntimeBundle = Readonly<{
  config: RetrieverQueryRewriteModelConfig;
  createRuntime: () => ModelAgentRuntime;
}>;

export type RetrieverQueryRewriteModelRuntimeDependencies = Readonly<{
  env?: Record<string, unknown>;
  createExecutor?: (config: OpenAICompatibleExecutorConfig) => StructuredModelExecutor;
  createRuntime?: (input: CreateModelAgentRuntimeInput) => ModelAgentRuntime;
}>;

export function createRetrieverQueryRewriteModelRuntimeBundle(
  dependencies: RetrieverQueryRewriteModelRuntimeDependencies = {},
): RetrieverQueryRewriteModelRuntimeBundle {
  const env = readDependency(dependencies, 'env') ?? process.env;
  const createExecutor =
    readDependency(dependencies, 'createExecutor') ?? createOpenAICompatibleStructuredExecutor;
  const createRuntime = readDependency(dependencies, 'createRuntime') ?? createModelAgentRuntime;
  const config = resolveRetrieverQueryRewriteModelConfig(env);
  let consumed = false;

  return Object.freeze({
    config,
    createRuntime() {
      if (consumed) throw new Error('RETRIEVER_QUERY_REWRITE_RUNTIME_ALREADY_CONSUMED');
      consumed = true;
      if (!config.enabled || config.runtimeAuthority !== 'production_live') {
        throw new Error('RETRIEVER_QUERY_REWRITE_RUNTIME_DISABLED');
      }
      const executorConfig = resolveRetrieverQueryRewriteLiveExecutorConfig(env);
      if (executorConfig === null) {
        throw new Error('RETRIEVER_QUERY_REWRITE_RUNTIME_CONFIG_INVALID');
      }
      const executor = createExecutor(executorConfig);
      return createRuntime({
        mode: 'live',
        provider: 'deepseek',
        model: RETRIEVER_QUERY_REWRITE_MODEL,
        liveCallsEnabled: true,
        timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
        executor,
      });
    },
  });
}

function readDependency<K extends keyof RetrieverQueryRewriteModelRuntimeDependencies>(
  dependencies: RetrieverQueryRewriteModelRuntimeDependencies,
  key: K,
): RetrieverQueryRewriteModelRuntimeDependencies[K] | undefined {
  if (typeof dependencies !== 'object' || dependencies === null) {
    throw new Error('INVALID_RETRIEVER_QUERY_REWRITE_RUNTIME_DEPENDENCIES');
  }
  const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) {
    throw new Error('INVALID_RETRIEVER_QUERY_REWRITE_RUNTIME_DEPENDENCIES');
  }
  return descriptor.value as RetrieverQueryRewriteModelRuntimeDependencies[K];
}
