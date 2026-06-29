import { getAiProviderStatus } from './ai-provider.ts';
import { getDevAiModeOverride } from './dev-ai-mode.ts';

export function resolveChatProviderStatus(env: NodeJS.ProcessEnv = process.env) {
  return getAiProviderStatus(env, {
    modeOverride: getDevAiModeOverride(env),
  });
}
