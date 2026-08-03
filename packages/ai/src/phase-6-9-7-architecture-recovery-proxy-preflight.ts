export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION =
  'phase-6.9.7-architecture-recovery-proxy-preflight-v1' as const;
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS = 250 as const;

export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES = Object.freeze([
  'direct_ready',
  'loopback_proxy_ready',
  'aborted',
  'proxy_environment_invalid',
  'no_proxy_unsupported',
  'proxy_url_invalid',
  'proxy_credentials_forbidden',
  'proxy_scheme_unsupported',
  'proxy_host_unsupported',
  'proxy_port_invalid',
  'proxy_config_conflict',
  'loopback_proxy_unavailable',
  'listener_probe_failed',
] as const);

export type Phase697ArchitectureRecoveryProxyPreflightCode =
  (typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES)[number];

export type Phase697ArchitectureRecoveryProxyPreflightResult = Readonly<{
  version: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION;
  ok: boolean;
  code: Phase697ArchitectureRecoveryProxyPreflightCode;
  mode: 'direct' | 'loopback_proxy' | 'undetermined';
  configuredProxyVariables: number;
  listener: 'not_required' | 'listening' | 'unavailable' | 'probe_failed' | 'aborted';
  listenerProbeCalls: 0 | 1;
  providerCalls: 0;
}>;

export type Phase697ArchitectureRecoveryProxyPreflightProbeInput = Readonly<{
  host: '127.0.0.1' | '::1';
  port: number;
  timeoutMs: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS;
  signal: AbortSignal;
}>;

export type Phase697ArchitectureRecoveryProxyPreflightDependencies = Readonly<{
  probeLoopbackListener(
    input: Phase697ArchitectureRecoveryProxyPreflightProbeInput,
  ): Promise<boolean>;
}>;

export type Phase697ArchitectureRecoveryProxyPreflightInput = Readonly<{
  env: Record<string, unknown>;
  signal: AbortSignal;
}>;

const PROXY_ENV_KEYS = Object.freeze([
  'HTTPS_PROXY',
  'https_proxy',
  'HTTP_PROXY',
  'http_proxy',
  'ALL_PROXY',
  'all_proxy',
] as const);
const NO_PROXY_ENV_KEYS = Object.freeze(['NO_PROXY', 'no_proxy'] as const);
export const PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS = Object.freeze([
  ...NO_PROXY_ENV_KEYS,
  ...PROXY_ENV_KEYS,
] as const);
const MAX_ENV_VALUE_LENGTH = 2_048;

type LoopbackProxy = Readonly<{
  canonical: string;
  host: Phase697ArchitectureRecoveryProxyPreflightProbeInput['host'];
  port: number;
}>;

type EnvironmentResolution =
  | Readonly<{
      ok: true;
      mode: 'direct';
      configuredProxyVariables: 0;
    }>
  | Readonly<{
      ok: true;
      mode: 'loopback_proxy';
      configuredProxyVariables: number;
      proxy: LoopbackProxy;
    }>
  | Readonly<{
      ok: false;
      code: Exclude<
        Phase697ArchitectureRecoveryProxyPreflightCode,
        | 'direct_ready'
        | 'loopback_proxy_ready'
        | 'aborted'
        | 'loopback_proxy_unavailable'
        | 'listener_probe_failed'
      >;
      configuredProxyVariables: number;
    }>;

type EnvironmentValue = Readonly<{ ok: true; value: string | null }> | Readonly<{ ok: false }>;

type ListenerProbeOutcome =
  | Readonly<{ type: 'resolved'; value: unknown }>
  | Readonly<{ type: 'failed' }>
  | Readonly<{ type: 'timed_out' }>
  | Readonly<{ type: 'aborted' }>;

/**
 * Resolves ambient proxy authority before any credential, reservation, or
 * Provider work. The function never reads process.env itself and never calls
 * fetch. Only a fixed loopback TCP-listener probe may be supplied by a
 * server-only composition root.
 */
export async function runPhase697ArchitectureRecoveryProxyPreflight(
  rawInput: Phase697ArchitectureRecoveryProxyPreflightInput,
  rawDependencies: Phase697ArchitectureRecoveryProxyPreflightDependencies,
): Promise<Phase697ArchitectureRecoveryProxyPreflightResult> {
  const input = readInput(rawInput);
  const dependencies = readDependencies(rawDependencies);
  if (!input || !dependencies) return result(false, 'proxy_environment_invalid');
  if (isAborted(input.signal)) return result(false, 'aborted', 'undetermined', 0, 'aborted');

  const environment = resolveEnvironment(input.env);
  if (!environment.ok) {
    return result(false, environment.code, 'undetermined', environment.configuredProxyVariables);
  }
  if (environment.mode === 'direct') return result(true, 'direct_ready', 'direct');

  const probe = await runBoundedListenerProbe(environment.proxy, input.signal, dependencies);
  if (isAborted(input.signal) || probe.type === 'aborted') {
    return result(
      false,
      'aborted',
      'loopback_proxy',
      environment.configuredProxyVariables,
      'aborted',
      1,
    );
  }
  if (probe.type === 'failed') {
    return result(
      false,
      'listener_probe_failed',
      'loopback_proxy',
      environment.configuredProxyVariables,
      'probe_failed',
      1,
    );
  }
  if (probe.type === 'timed_out') {
    return result(
      false,
      'loopback_proxy_unavailable',
      'loopback_proxy',
      environment.configuredProxyVariables,
      'unavailable',
      1,
    );
  }
  if (probe.value === true) {
    return result(
      true,
      'loopback_proxy_ready',
      'loopback_proxy',
      environment.configuredProxyVariables,
      'listening',
      1,
    );
  }
  if (probe.value === false) {
    return result(
      false,
      'loopback_proxy_unavailable',
      'loopback_proxy',
      environment.configuredProxyVariables,
      'unavailable',
      1,
    );
  }
  return result(
    false,
    'listener_probe_failed',
    'loopback_proxy',
    environment.configuredProxyVariables,
    'probe_failed',
    1,
  );
}

async function runBoundedListenerProbe(
  proxy: LoopbackProxy,
  signal: AbortSignal,
  dependencies: Phase697ArchitectureRecoveryProxyPreflightDependencies,
): Promise<ListenerProbeOutcome> {
  const probeController = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const aborted = new Promise<ListenerProbeOutcome>((resolve) => {
      onAbort = () => {
        resolve(Object.freeze({ type: 'aborted' }));
        abortSafely(probeController);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      if (isAborted(signal)) onAbort();
    });
    const timedOut = new Promise<ListenerProbeOutcome>((resolve) => {
      timeout = setTimeout(() => {
        resolve(Object.freeze({ type: 'timed_out' }));
        abortSafely(probeController);
      }, PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS);
    });
    const probed = Promise.resolve()
      .then(() =>
        dependencies.probeLoopbackListener({
          host: proxy.host,
          port: proxy.port,
          timeoutMs: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
          signal: probeController.signal,
        }),
      )
      .then<ListenerProbeOutcome, ListenerProbeOutcome>(
        (value) => Object.freeze({ type: 'resolved', value }),
        () => Object.freeze({ type: 'failed' }),
      );
    return await Promise.race([probed, timedOut, aborted]);
  } catch {
    return Object.freeze({ type: isAborted(signal) ? 'aborted' : 'failed' });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    if (onAbort) {
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {
        // The result is already fail-closed; never expose a hostile listener error.
      }
    }
    abortSafely(probeController);
  }
}

function abortSafely(controller: AbortController) {
  try {
    controller.abort();
  } catch {
    // The watchdog result remains bounded even if a listener is hostile.
  }
}

function resolveEnvironment(env: Record<string, unknown>): EnvironmentResolution {
  try {
    for (const key of NO_PROXY_ENV_KEYS) {
      const resolved = readEnvironmentValue(env, key);
      if (!resolved.ok) {
        return Object.freeze({
          ok: false,
          code: 'proxy_environment_invalid',
          configuredProxyVariables: 0,
        });
      }
      if (resolved.value !== null) {
        return Object.freeze({
          ok: false,
          code: 'no_proxy_unsupported',
          configuredProxyVariables: 0,
        });
      }
    }

    const proxies: LoopbackProxy[] = [];
    for (const key of PROXY_ENV_KEYS) {
      const resolved = readEnvironmentValue(env, key);
      if (!resolved.ok) {
        return Object.freeze({
          ok: false,
          code: 'proxy_environment_invalid',
          configuredProxyVariables: proxies.length,
        });
      }
      if (resolved.value === null) continue;
      const proxy = parseLoopbackProxy(resolved.value);
      if (!proxy.ok) {
        return Object.freeze({
          ok: false,
          code: proxy.code,
          configuredProxyVariables: proxies.length + 1,
        });
      }
      proxies.push(proxy.value);
    }
    if (proxies.length === 0) {
      return Object.freeze({ ok: true, mode: 'direct', configuredProxyVariables: 0 });
    }
    const first = proxies[0];
    if (!first || proxies.some((proxy) => proxy.canonical !== first.canonical)) {
      return Object.freeze({
        ok: false,
        code: 'proxy_config_conflict',
        configuredProxyVariables: proxies.length,
      });
    }
    return Object.freeze({
      ok: true,
      mode: 'loopback_proxy',
      configuredProxyVariables: proxies.length,
      proxy: first,
    });
  } catch {
    return Object.freeze({
      ok: false,
      code: 'proxy_environment_invalid',
      configuredProxyVariables: 0,
    });
  }
}

function parseLoopbackProxy(raw: string):
  | Readonly<{ ok: true; value: LoopbackProxy }>
  | Readonly<{
      ok: false;
      code:
        | 'proxy_url_invalid'
        | 'proxy_credentials_forbidden'
        | 'proxy_scheme_unsupported'
        | 'proxy_host_unsupported'
        | 'proxy_port_invalid';
    }> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return Object.freeze({ ok: false, code: 'proxy_url_invalid' });
  }
  if (parsed.protocol !== 'http:') {
    return Object.freeze({ ok: false, code: 'proxy_scheme_unsupported' });
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return Object.freeze({ ok: false, code: 'proxy_credentials_forbidden' });
  }
  let host: LoopbackProxy['host'];
  if (parsed.hostname === '127.0.0.1') host = '127.0.0.1';
  else if (parsed.hostname === '[::1]' || parsed.hostname === '::1') host = '::1';
  else return Object.freeze({ ok: false, code: 'proxy_host_unsupported' });

  if (parsed.port.length === 0 || !/^\d{1,5}$/u.test(parsed.port)) {
    return Object.freeze({ ok: false, code: 'proxy_port_invalid' });
  }
  const port = Number(parsed.port);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    return Object.freeze({ ok: false, code: 'proxy_port_invalid' });
  }
  const canonicalUrl = host === '::1' ? `http://[::1]:${port}` : `http://127.0.0.1:${port}`;
  if (
    parsed.pathname !== '/' ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    (raw !== canonicalUrl && raw !== `${canonicalUrl}/`)
  ) {
    return Object.freeze({ ok: false, code: 'proxy_url_invalid' });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({ canonical: canonicalUrl, host, port }),
  });
}

function readEnvironmentValue(env: Record<string, unknown>, key: string): EnvironmentValue {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    if (!descriptor) return Object.freeze({ ok: true, value: null });
    if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
      return Object.freeze({ ok: false });
    }
    const value = descriptor.value;
    if (value.length === 0) return Object.freeze({ ok: true, value: null });
    if (
      value.length > MAX_ENV_VALUE_LENGTH ||
      value !== value.trim() ||
      hasAsciiControlCharacter(value)
    ) {
      return Object.freeze({ ok: false });
    }
    return Object.freeze({ ok: true, value });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function hasAsciiControlCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 31 || codeUnit === 127) return true;
  }
  return false;
}

function readInput(value: unknown): Phase697ArchitectureRecoveryProxyPreflightInput | null {
  const resolved = readExactOwnDataValues(value, ['env', 'signal']);
  if (
    !resolved ||
    typeof resolved.env !== 'object' ||
    resolved.env === null ||
    Array.isArray(resolved.env) ||
    !isAbortSignal(resolved.signal)
  ) {
    return null;
  }
  return Object.freeze({
    env: resolved.env as Record<string, unknown>,
    signal: resolved.signal,
  });
}

function readDependencies(
  value: unknown,
): Phase697ArchitectureRecoveryProxyPreflightDependencies | null {
  const resolved = readExactOwnDataValues(value, ['probeLoopbackListener']);
  if (!resolved || typeof resolved.probeLoopbackListener !== 'function') return null;
  return Object.freeze({
    probeLoopbackListener:
      resolved.probeLoopbackListener as Phase697ArchitectureRecoveryProxyPreflightDependencies['probeLoopbackListener'],
  });
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const resolved = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      resolved[key] = descriptor.value;
    }
    return resolved;
  } catch {
    return null;
  }
}

function result(
  ok: boolean,
  code: Phase697ArchitectureRecoveryProxyPreflightCode,
  mode: Phase697ArchitectureRecoveryProxyPreflightResult['mode'] = 'undetermined',
  configuredProxyVariables = 0,
  listener: Phase697ArchitectureRecoveryProxyPreflightResult['listener'] = 'not_required',
  listenerProbeCalls: Phase697ArchitectureRecoveryProxyPreflightResult['listenerProbeCalls'] = 0,
): Phase697ArchitectureRecoveryProxyPreflightResult {
  return Object.freeze({
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
    ok,
    code,
    mode,
    configuredProxyVariables,
    listener,
    listenerProbeCalls,
    providerCalls: 0,
  });
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}
