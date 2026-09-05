import { getAiProviderStatus } from './ai-provider.ts';

export type DevAiMode = 'mock' | 'live';

export type DevAiModeStatus = {
  enabled: boolean;
  envMode: DevAiMode;
  activeMode: DevAiMode;
  requestedMode: DevAiMode;
  liveAllowedByEnv: boolean;
  message: string | null;
};

type SetDevAiModeResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 400 | 404;
      error: string;
    };

let requestedMode: DevAiMode = 'mock';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const LOCAL_CHAT_MODEL_GATES = [
  'ROUTER_MODEL_ENABLED',
  'KNOWLEDGE_VERIFIER_MODEL_ENABLED',
  'TUTOR_AGENT_MODEL_ENABLED',
  'RETRIEVER_QUERY_REWRITE_MODEL_ENABLED',
  'FINAL_RESPONSE_AGENT_MODEL_ENABLED',
] as const;
const DEEPSEEK_COMPONENT_KEYS = [
  'TUTOR_AGENT_DEEPSEEK_API_KEY',
  'RETRIEVER_QUERY_REWRITE_DEEPSEEK_API_KEY',
  'FINAL_RESPONSE_AGENT_DEEPSEEK_API_KEY',
] as const;

function resolveEnvMode(env: NodeJS.ProcessEnv): DevAiMode {
  return env.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock';
}

function isDevAiMode(value: unknown): value is DevAiMode {
  return value === 'mock' || value === 'live';
}

function getLiveAvailability(env: NodeJS.ProcessEnv) {
  const liveStatus = getAiProviderStatus(buildLocalLiveEnvironment(env));

  return {
    allowed: liveStatus.configured,
    message: liveStatus.configured ? null : liveStatus.message,
  };
}

export function isDevAiModeSwitchEnabled(env: NodeJS.ProcessEnv = process.env) {
  const isLocalDevRuntime =
    env.NODE_ENV !== 'production' || env.PREPMIND_LOCAL_DEV_TOOLS_ENABLED === 'true';

  return isLocalDevRuntime && env.AI_DEV_MODE_SWITCH_ENABLED !== 'false';
}

export function getDevAiModeOverride(env: NodeJS.ProcessEnv = process.env): DevAiMode | null {
  if (!isDevAiModeSwitchEnabled(env)) return null;

  return requestedMode;
}

export function resolveDevAiModeRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  if (!isDevAiModeSwitchEnabled(env)) return env;

  return requestedMode === 'live'
    ? buildLocalLiveEnvironment(env)
    : { ...env, AI_PROVIDER_MODE: 'mock' };
}

export function buildDevAiModeStatus(env: NodeJS.ProcessEnv = process.env): DevAiModeStatus {
  const enabled = isDevAiModeSwitchEnabled(env);
  const liveAvailability = getLiveAvailability(env);
  const envMode = resolveEnvMode(env);

  return {
    enabled,
    envMode,
    activeMode: enabled ? requestedMode : envMode,
    requestedMode,
    liveAllowedByEnv: liveAvailability.allowed,
    message: liveAvailability.message,
  };
}

export function setDevAiMode(
  mode: unknown,
  env: NodeJS.ProcessEnv = process.env,
): SetDevAiModeResult {
  if (!isDevAiModeSwitchEnabled(env)) {
    return {
      ok: false,
      status: 404,
      error: 'Dev AI mode switch is disabled.',
    };
  }

  if (!isDevAiMode(mode)) {
    return {
      ok: false,
      status: 400,
      error: 'Mode must be mock or live.',
    };
  }

  requestedMode = mode;
  return { ok: true };
}

export function resetDevAiModeForTest() {
  requestedMode = 'mock';
}

function buildLocalLiveEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const runtimeEnv: NodeJS.ProcessEnv = {
    ...env,
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_BASE_URL: resolveLocalLiveBaseUrl(env),
  };

  for (const gate of LOCAL_CHAT_MODEL_GATES) {
    runtimeEnv[gate] = env[gate] === undefined || env[gate] === '' ? 'true' : env[gate];
  }

  const deepseekKey = env.DEEPSEEK_API_KEY;
  if (deepseekKey !== undefined && deepseekKey !== '') {
    for (const componentKey of DEEPSEEK_COMPONENT_KEYS) {
      if (env[componentKey] === undefined || env[componentKey] === '') {
        runtimeEnv[componentKey] = deepseekKey;
      }
    }
  }

  return runtimeEnv;
}

function resolveLocalLiveBaseUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.AI_BASE_URL?.trim();
  if (!explicit) {
    return env.DEEPSEEK_API_KEY?.trim() ? DEEPSEEK_BASE_URL : OPENAI_BASE_URL;
  }
  return /^https:\/\/api\.deepseek\.com\/?$/u.test(explicit) ? DEEPSEEK_BASE_URL : explicit;
}
