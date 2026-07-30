import type { StructuredModelExecutor } from './model-agent-contract.ts';
import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type FirstPartyDeepSeekV4ProDirectConfig,
} from './first-party-deepseek-v4-pro-direct.ts';
import type { Phase697V7WireCapability } from './phase-6-9-7-v7-wire-diagnostics.ts';

export const FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION =
  'first-party-deepseek-v4-pro-transport-diagnostic-adapter-v1' as const;
export const FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION =
  'first-party-deepseek-v4-pro-transport-diagnostic-v1' as const;
export const FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES = Object.freeze([
  'aborted',
  'timeout',
  'dns',
  'tls',
  'proxy',
  'connection_refused',
  'connection_reset',
  'network_unreachable',
  'unknown',
] as const);

export type FirstPartyDeepSeekV4ProTransportDiagnosticSubtype =
  (typeof FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_SUBTYPES)[number];

export type FirstPartyDeepSeekV4ProTransportDiagnostic = Readonly<{
  version: typeof FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION;
  subtype: FirstPartyDeepSeekV4ProTransportDiagnosticSubtype;
}>;

export type FirstPartyDeepSeekV4ProTransportDiagnosticDependencies = Readonly<{
  fetch: typeof fetch;
}>;

export type FirstPartyDeepSeekV4ProTransportDiagnosticAdapter = Readonly<{
  version: typeof FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION;
  provenance: 'first_party_deepseek_v4_pro_transport_diagnostic' | 'synthetic_test';
  executor: StructuredModelExecutor;
  readTransportDiagnostic(): FirstPartyDeepSeekV4ProTransportDiagnostic | null;
}>;

const INVALID_CONFIG = 'INVALID_DEEPSEEK_TRANSPORT_DIAGNOSTIC_CONFIG';
const MAX_ERROR_CHAIN_DEPTH = 4;
const MAX_CLASSIFICATION_TOKEN_LENGTH = 128;
const DEFAULT_DEPENDENCIES: FirstPartyDeepSeekV4ProTransportDiagnosticDependencies = Object.freeze({
  fetch: (input, init) => globalThis.fetch(input, init),
});

const ABORT_TOKENS = new Set(['ABORT_ERR', 'ABORTERROR', 'ERR_ABORTED']);
const TIMEOUT_TOKENS = new Set([
  'ETIMEDOUT',
  'TIMEOUTERROR',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
]);
const DNS_TOKENS = new Set(['DNSERROR', 'EAI_AGAIN', 'EAI_FAIL', 'EAI_NODATA', 'ENOTFOUND']);
const TLS_TOKENS = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);
const PROXY_TOKENS = new Set([
  'ERR_PROXY_CONNECTION_FAILED',
  'PROXYERROR',
  'PROXY_CONNECTION_FAILED',
  'UND_ERR_PROXY',
]);
const CONNECTION_REFUSED_TOKENS = new Set(['CONNECTIONREFUSED', 'ECONNREFUSED']);
const CONNECTION_RESET_TOKENS = new Set([
  'CONNECTIONCLOSED',
  'CONNECTIONRESET',
  'ECONNRESET',
  'EPIPE',
  'UND_ERR_SOCKET',
]);
const NETWORK_UNREACHABLE_TOKENS = new Set([
  'EADDRNOTAVAIL',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'NETWORKUNREACHABLE',
]);

/**
 * Adds a bounded, in-memory diagnostic around the sealed V1 direct adapter.
 * The V1 adapter, public provider failure category, wire schema, and historical
 * evidence remain unchanged. Only a fixed subtype can cross this new boundary;
 * raw errors, messages, stacks, URLs, headers, bodies, and credentials cannot.
 */
export function createFirstPartyDeepSeekV4ProTransportDiagnosticAdapter(
  config: FirstPartyDeepSeekV4ProDirectConfig,
  wireCapability: Phase697V7WireCapability,
  dependencies: FirstPartyDeepSeekV4ProTransportDiagnosticDependencies = DEFAULT_DEPENDENCIES,
): FirstPartyDeepSeekV4ProTransportDiagnosticAdapter {
  const resolvedDependencies = normalizeDependencies(dependencies);
  let diagnostic: FirstPartyDeepSeekV4ProTransportDiagnostic | null = null;
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(config, wireCapability, {
    fetch: async (input, init) => {
      try {
        return await resolvedDependencies.fetch(input, init);
      } catch (error) {
        diagnostic ??= classifyTransportFailure(error, readRequestSignal(init));
        throw error;
      }
    },
  });

  return Object.freeze({
    version: FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_ADAPTER_VERSION,
    provenance:
      dependencies === DEFAULT_DEPENDENCIES
        ? 'first_party_deepseek_v4_pro_transport_diagnostic'
        : 'synthetic_test',
    executor: adapter.executor,
    readTransportDiagnostic: () => diagnostic,
  });
}

function normalizeDependencies(
  input: unknown,
): FirstPartyDeepSeekV4ProTransportDiagnosticDependencies {
  if (input === DEFAULT_DEPENDENCIES) return DEFAULT_DEPENDENCIES;
  try {
    if (!isPlainRecord(input)) throw new Error();
    const keys = Reflect.ownKeys(input);
    if (keys.length !== 1 || keys[0] !== 'fetch') throw new Error();
    const descriptor = Reflect.getOwnPropertyDescriptor(input, 'fetch');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'function') {
      throw new Error();
    }
    return Object.freeze({ fetch: descriptor.value as typeof fetch });
  } catch {
    throw new Error(INVALID_CONFIG);
  }
}

function classifyTransportFailure(
  error: unknown,
  signal: AbortSignal | null,
): FirstPartyDeepSeekV4ProTransportDiagnostic {
  if (isSignalAborted(signal)) return diagnostic('aborted');

  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < MAX_ERROR_CHAIN_DEPTH; depth += 1) {
    if (!isObjectLike(current) || seen.has(current)) break;
    seen.add(current);

    for (const token of [
      readOwnDataString(current, 'code'),
      readOwnDataString(current, 'name'),
      readBuiltinDomExceptionName(current),
    ]) {
      const subtype = classifyToken(token);
      if (subtype !== 'unknown') return diagnostic(subtype);
    }

    const cause = readOwnDataValue(current, 'cause');
    if (cause === null) break;
    current = cause.value;
  }
  return diagnostic('unknown');
}

function classifyToken(token: string | null): FirstPartyDeepSeekV4ProTransportDiagnosticSubtype {
  if (token === null || token.length === 0 || token.length > MAX_CLASSIFICATION_TOKEN_LENGTH) {
    return 'unknown';
  }
  const normalized = token.toUpperCase();
  if (ABORT_TOKENS.has(normalized)) return 'aborted';
  if (TIMEOUT_TOKENS.has(normalized)) return 'timeout';
  if (DNS_TOKENS.has(normalized) || normalized.startsWith('ERR_DNS_')) return 'dns';
  if (
    TLS_TOKENS.has(normalized) ||
    normalized.startsWith('ERR_TLS_') ||
    normalized.startsWith('ERR_SSL_') ||
    normalized.startsWith('ERR_CERT_')
  ) {
    return 'tls';
  }
  if (PROXY_TOKENS.has(normalized) || normalized.startsWith('UND_ERR_PROXY_')) return 'proxy';
  if (CONNECTION_REFUSED_TOKENS.has(normalized)) return 'connection_refused';
  if (CONNECTION_RESET_TOKENS.has(normalized)) return 'connection_reset';
  if (NETWORK_UNREACHABLE_TOKENS.has(normalized)) return 'network_unreachable';
  return 'unknown';
}

function diagnostic(
  subtype: FirstPartyDeepSeekV4ProTransportDiagnosticSubtype,
): FirstPartyDeepSeekV4ProTransportDiagnostic {
  return Object.freeze({
    version: FIRST_PARTY_DEEPSEEK_V4_PRO_TRANSPORT_DIAGNOSTIC_VERSION,
    subtype,
  });
}

function readRequestSignal(init: RequestInit | undefined): AbortSignal | null {
  try {
    return init?.signal instanceof AbortSignal ? init.signal : null;
  } catch {
    return null;
  }
}

function isSignalAborted(signal: AbortSignal | null) {
  try {
    return signal?.aborted === true;
  } catch {
    return false;
  }
}

function readOwnDataString(value: object, key: string): string | null {
  const resolved = readOwnDataValue(value, key);
  return resolved !== null && typeof resolved.value === 'string' ? resolved.value : null;
}

function readOwnDataValue(value: object, key: string): Readonly<{ value: unknown }> | null {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? { value: descriptor.value } : null;
  } catch {
    return null;
  }
}

function readBuiltinDomExceptionName(value: object): string | null {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(DOMException.prototype, 'name');
    if (!descriptor || typeof descriptor.get !== 'function') return null;
    const name: unknown = descriptor.get.call(value);
    return typeof name === 'string' ? name : null;
  } catch {
    return null;
  }
}

function isObjectLike(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) === Object.prototype
    );
  } catch {
    return false;
  }
}
