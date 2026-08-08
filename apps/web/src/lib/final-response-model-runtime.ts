import 'server-only';

import {
  createFinalResponseStreamExecutor,
  type FinalResponseStreamExecutor,
  type FinalResponseStreamProviderConfig,
} from '@repo/ai';
import type { FinalResponseAgentConfigV1 } from '@repo/agent/final-response';

import {
  resolveFinalResponseLiveExecutorConfig,
  resolveFinalResponseModelConfig,
} from './final-response-model-config.ts';

export type FinalResponseModelRuntimeBundle = Readonly<{
  config: FinalResponseAgentConfigV1;
  createExecutor: () => FinalResponseStreamExecutor;
}>;

export type FinalResponseModelRuntimeDependencies = Readonly<{
  env?: Record<string, unknown>;
  createExecutor?: (config: FinalResponseStreamProviderConfig) => FinalResponseStreamExecutor;
}>;

export function createFinalResponseModelRuntimeBundle(
  dependencies: FinalResponseModelRuntimeDependencies = {},
): FinalResponseModelRuntimeBundle {
  const env = readDependency(dependencies, 'env') ?? process.env;
  const createExecutor =
    readDependency(dependencies, 'createExecutor') ?? createFinalResponseStreamExecutor;
  const config = resolveFinalResponseModelConfig(env);
  let consumed = false;

  return Object.freeze({
    config,
    createExecutor() {
      if (consumed) throw new Error('FINAL_RESPONSE_EXECUTOR_ALREADY_CONSUMED');
      consumed = true;
      if (!config.enabled || config.runtimeAuthority !== 'production_live') {
        throw new Error('FINAL_RESPONSE_RUNTIME_DISABLED');
      }
      const executorConfig = resolveFinalResponseLiveExecutorConfig(env);
      if (executorConfig === null) {
        throw new Error('FINAL_RESPONSE_RUNTIME_CONFIG_INVALID');
      }
      return createExecutor(executorConfig);
    },
  });
}

function readDependency<K extends keyof FinalResponseModelRuntimeDependencies>(
  dependencies: FinalResponseModelRuntimeDependencies,
  key: K,
): FinalResponseModelRuntimeDependencies[K] | undefined {
  if (typeof dependencies !== 'object' || dependencies === null) {
    throw new Error('INVALID_FINAL_RESPONSE_RUNTIME_DEPENDENCIES');
  }
  const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) {
    throw new Error('INVALID_FINAL_RESPONSE_RUNTIME_DEPENDENCIES');
  }
  return descriptor.value as FinalResponseModelRuntimeDependencies[K];
}
