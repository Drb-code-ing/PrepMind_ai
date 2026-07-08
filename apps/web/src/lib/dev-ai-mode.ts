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
      status: 400 | 404 | 409;
      error: string;
    };

let requestedMode: DevAiMode = 'mock';

function resolveEnvMode(env: NodeJS.ProcessEnv): DevAiMode {
  return env.AI_PROVIDER_MODE === 'live' ? 'live' : 'mock';
}

function isDevAiMode(value: unknown): value is DevAiMode {
  return value === 'mock' || value === 'live';
}

function getLiveAvailability(env: NodeJS.ProcessEnv) {
  const liveStatus = getAiProviderStatus(env, { modeOverride: 'live' });

  return {
    allowed: liveStatus.configured,
    message: liveStatus.configured ? null : liveStatus.message,
  };
}

export function isDevAiModeSwitchEnabled(env: NodeJS.ProcessEnv = process.env) {
  const isLocalDevRuntime =
    env.NODE_ENV !== 'production' || env.PREPMIND_LOCAL_DEV_TOOLS_ENABLED === 'true';

  return isLocalDevRuntime && env.AI_DEV_MODE_SWITCH_ENABLED === 'true';
}

export function getDevAiModeOverride(env: NodeJS.ProcessEnv = process.env): DevAiMode | null {
  if (!isDevAiModeSwitchEnabled(env)) return null;

  return resolveActiveDevAiMode(env, getLiveAvailability(env));
}

export function buildDevAiModeStatus(
  env: NodeJS.ProcessEnv = process.env,
): DevAiModeStatus {
  const enabled = isDevAiModeSwitchEnabled(env);
  const liveAvailability = getLiveAvailability(env);
  const envMode = resolveEnvMode(env);

  return {
    enabled,
    envMode,
    activeMode: enabled ? resolveActiveDevAiMode(env, liveAvailability) : envMode,
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

  if (mode === 'live') {
    const liveAvailability = getLiveAvailability(env);
    if (!liveAvailability.allowed) {
      return {
        ok: false,
        status: 409,
        error: liveAvailability.message ?? 'Live mode is not available.',
      };
    }
  }

  requestedMode = mode;
  return { ok: true };
}

export function resetDevAiModeForTest() {
  requestedMode = 'mock';
}

function resolveActiveDevAiMode(
  env: NodeJS.ProcessEnv,
  liveAvailability = getLiveAvailability(env),
): DevAiMode {
  if (requestedMode === 'live' && !liveAvailability.allowed) {
    return 'mock';
  }

  return requestedMode;
}
