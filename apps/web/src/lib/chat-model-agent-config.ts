import 'server-only';

import { isSafeModelName } from '@repo/ai';

export type ChatModelAgentConfig = {
  mode: 'mock' | 'live';
  liveCallsEnabled: boolean;
  routerEnabled: boolean;
  verifierEnabled: boolean;
  routerTimeoutMs: number;
  verifierTimeoutMs: number;
  provider: 'mock' | 'deepseek' | 'openai';
  model: string;
  credentialSource: 'none' | 'deepseek' | 'openai';
  configured: boolean;
  disabledReason?:
    | 'mock_mode'
    | 'global_live_disabled'
    | 'agent_gates_disabled'
    | 'invalid_provider_config';
};

type Environment = Record<string, unknown>;

const MOCK_MODEL = 'mock-agent-candidate';
const DEFAULT_ROUTER_TIMEOUT_MS = 5_000;
const DEFAULT_VERIFIER_TIMEOUT_MS = 4_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 10_000;
const DEEPSEEK_HOST_FAMILY = 'deepseek.com';
const OPENAI_HOST_FAMILY = 'openai.com';

const INVALID_CONFIG: ChatModelAgentConfig = Object.freeze({
  mode: 'mock',
  liveCallsEnabled: false,
  routerEnabled: false,
  verifierEnabled: false,
  routerTimeoutMs: DEFAULT_ROUTER_TIMEOUT_MS,
  verifierTimeoutMs: DEFAULT_VERIFIER_TIMEOUT_MS,
  provider: 'mock',
  model: MOCK_MODEL,
  credentialSource: 'none',
  configured: false,
  disabledReason: 'invalid_provider_config',
});

export function resolveChatModelAgentConfig(
  env: Environment = process.env,
): ChatModelAgentConfig {
  try {
    return resolveConfigUnchecked(env);
  } catch {
    return { ...INVALID_CONFIG };
  }
}

function resolveConfigUnchecked(env: Environment): ChatModelAgentConfig {
  if (typeof env !== 'object' || env === null) return { ...INVALID_CONFIG };

  const values = readEnvironment(env);
  const routerTimeoutMs = parseTimeout(
    values.ROUTER_MODEL_TIMEOUT_MS,
    DEFAULT_ROUTER_TIMEOUT_MS,
  );
  const verifierTimeoutMs = parseTimeout(
    values.KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS,
    DEFAULT_VERIFIER_TIMEOUT_MS,
  );
  if (routerTimeoutMs === null || verifierTimeoutMs === null) {
    return { ...INVALID_CONFIG };
  }

  const mode = values.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock';
  const routerRequested = values.ROUTER_MODEL_ENABLED === 'true';
  const verifierRequested = values.KNOWLEDGE_VERIFIER_MODEL_ENABLED === 'true';
  const anyAgentRequested = routerRequested || verifierRequested;

  if (!anyAgentRequested) {
    return {
      mode,
      liveCallsEnabled: false,
      routerEnabled: false,
      verifierEnabled: false,
      routerTimeoutMs,
      verifierTimeoutMs,
      provider: 'mock',
      model: MOCK_MODEL,
      credentialSource: 'none',
      configured: true,
      disabledReason: 'agent_gates_disabled',
    };
  }

  if (mode === 'mock') {
    return {
      mode,
      liveCallsEnabled: false,
      routerEnabled: false,
      verifierEnabled: false,
      routerTimeoutMs,
      verifierTimeoutMs,
      provider: 'mock',
      model: MOCK_MODEL,
      credentialSource: 'none',
      configured: true,
      disabledReason: 'mock_mode',
    };
  }

  if (values.AI_ENABLE_LIVE_CALLS !== 'true') {
    return {
      mode,
      liveCallsEnabled: false,
      routerEnabled: false,
      verifierEnabled: false,
      routerTimeoutMs,
      verifierTimeoutMs,
      provider: 'mock',
      model: MOCK_MODEL,
      credentialSource: 'none',
      configured: true,
      disabledReason: 'global_live_disabled',
    };
  }

  const providerConfig = resolveProviderConfig(values);
  if (providerConfig === null) return { ...INVALID_CONFIG };

  return {
    mode,
    liveCallsEnabled: true,
    routerEnabled: routerRequested,
    verifierEnabled: verifierRequested,
    routerTimeoutMs,
    verifierTimeoutMs,
    provider: providerConfig.provider,
    model: providerConfig.model,
    credentialSource: providerConfig.credentialSource,
    configured: true,
  };
}

type SafeEnvironmentSnapshot = ReturnType<typeof readEnvironment>;

function readEnvironment(env: Environment) {
  const snapshot = {
    AI_PROVIDER_MODE: env.AI_PROVIDER_MODE,
    AI_ENABLE_LIVE_CALLS: env.AI_ENABLE_LIVE_CALLS,
    ROUTER_MODEL_ENABLED: env.ROUTER_MODEL_ENABLED,
    KNOWLEDGE_VERIFIER_MODEL_ENABLED: env.KNOWLEDGE_VERIFIER_MODEL_ENABLED,
    ROUTER_MODEL_TIMEOUT_MS: env.ROUTER_MODEL_TIMEOUT_MS,
    KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS:
      env.KNOWLEDGE_VERIFIER_MODEL_TIMEOUT_MS,
    DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    AI_BASE_URL: env.AI_BASE_URL,
    AI_MODEL: env.AI_MODEL,
  };
  for (const value of Object.values(snapshot)) {
    if (value !== undefined && typeof value !== 'string') {
      throw new Error('INVALID_MODEL_AGENT_ENVIRONMENT');
    }
  }
  return snapshot as Record<keyof typeof snapshot, string | undefined>;
}

function resolveProviderConfig(values: SafeEnvironmentSnapshot): {
  provider: 'deepseek' | 'openai';
  credentialSource: 'deepseek' | 'openai';
  model: string;
} | null {
  const deepseekKey = values.DEEPSEEK_API_KEY?.trim() ?? '';
  const openaiKey = values.OPENAI_API_KEY?.trim() ?? '';
  const explicitBaseURL = values.AI_BASE_URL?.trim() ?? '';
  const exactlyOneKey = Boolean(deepseekKey) !== Boolean(openaiKey);
  const baseURL =
    explicitBaseURL ||
    (exactlyOneKey
      ? deepseekKey
        ? 'https://api.deepseek.com'
        : 'https://api.openai.com/v1'
      : '');
  const url = parseSafeHttpsUrl(baseURL);
  if (url === null) return null;
  const hostname = normalizeProviderHostname(url.hostname);

  let credentialSource: 'deepseek' | 'openai';
  if (isVendorHostname(hostname, DEEPSEEK_HOST_FAMILY)) {
    if (!deepseekKey) return null;
    credentialSource = 'deepseek';
  } else if (isVendorHostname(hostname, OPENAI_HOST_FAMILY)) {
    if (!openaiKey) return null;
    credentialSource = 'openai';
  } else {
    if (!exactlyOneKey) return null;
    credentialSource = deepseekKey ? 'deepseek' : 'openai';
  }

  const defaultModel =
    credentialSource === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4o-mini';
  const model = values.AI_MODEL?.trim() || defaultModel;
  if (!isSafeModelName(model)) return null;

  return {
    provider: credentialSource,
    credentialSource,
    model,
  };
}

function normalizeProviderHostname(hostname: string): string {
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function isVendorHostname(hostname: string, family: string): boolean {
  return hostname === family || hostname.endsWith(`.${family}`);
}

function parseSafeHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function parseTimeout(value: string | undefined, fallback: number): number | null {
  if (value === undefined || value === '') return fallback;
  if (!/^[0-9]+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) &&
    parsed >= MIN_TIMEOUT_MS &&
    parsed <= MAX_TIMEOUT_MS
    ? parsed
    : null;
}
