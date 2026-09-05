import { getAiProviderStatus } from './ai-provider.ts';
import { resolveDevAiModeRuntimeEnvironment } from './dev-ai-mode.ts';

export function resolveChatProviderRuntime(env: NodeJS.ProcessEnv = process.env) {
  const environment = resolveDevAiModeRuntimeEnvironment(env);
  return {
    environment,
    status: getAiProviderStatus(environment),
  };
}

export function resolveChatProviderStatus(env: NodeJS.ProcessEnv = process.env) {
  return resolveChatProviderRuntime(env).status;
}
