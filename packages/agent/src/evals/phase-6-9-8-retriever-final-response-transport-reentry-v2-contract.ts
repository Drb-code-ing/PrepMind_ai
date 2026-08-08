import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-c1-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_AUTHORITY =
  'zero_provider_transport_reentry_v2_c1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_GATE = 'transport_reentry_v2_c1_ready' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_GATE_FAILED =
  'transport_reentry_v2_c1_blocked' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_BRANCH =
  'drb/phase-6-9-8-retriever-final-response-contract' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING =
  'transport_evidence_t2_zero_provider_passed' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING =
  'zero_provider_transport_evidence_t3_configuration_guard' as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER_ARGUMENT =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_APPROVAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_APPROVED' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_REENTRY_V2_CONTROLLED_CANARY_ONCE' as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_GENERIC_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY',
  'QWEN_API_KEY',
] as const);
export type Phase698TransportReentryV2GenericKey =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_GENERIC_KEYS)[number];

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_FAMILIES = Object.freeze([
  'rewrite',
  'qwen',
  'final_response',
] as const);
export type Phase698TransportReentryV2Family =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_FAMILIES)[number];

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_DEDICATED_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-dedicated-capability-v1' as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_PREFLIGHT_CAPABILITY_VERSION =
  'phase-6.9.8-retriever-final-response-transport-reentry-v2-preflight-capability-v1' as const;

export type Phase698TransportReentryV2FailureCode =
  | 'invalid_input'
  | 'unsupported_encoding'
  | 'invalid_line'
  | 'line_too_long'
  | 'unknown_key'
  | 'duplicate_key'
  | 'empty_value'
  | 'interpolation'
  | 'multiline'
  | 'non_ascii'
  | 'credential_missing'
  | 'credential_shape_invalid'
  | 'alias_conflict'
  | 'accessor_input'
  | 'extra_field'
  | 'root_not_found'
  | 'env_read_failed'
  | 'gate_invalid'
  | 'capability_invalid'
  | 'capability_reused'
  | 'family_mismatch'
  | 'call_mismatch';

export type Phase698TransportReentryV2Failure = Readonly<{
  ok: false;
  reasonCode: Phase698TransportReentryV2FailureCode;
}>;

export type Phase698TransportReentryV2ParseResult =
  | Readonly<{
      ok: true;
      values: Readonly<Partial<Record<Phase698TransportReentryV2GenericKey, string>>>;
    }>
  | Phase698TransportReentryV2Failure;

export type Phase698TransportReentryV2GenericCredentials = Readonly<{
  DEEPSEEK_API_KEY: string;
  QWEN_API_KEY: string;
}>;

export type Phase698TransportReentryV2CallIds = Readonly<{
  rewrite: string;
  qwen: string;
  final_response: string;
}>;

export type Phase698TransportReentryV2SourceFixture = Readonly<{
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
  branch: string;
  commit: string;
  trackingCommit: string;
  remoteCommit: string;
  approvedSourceCommit: string;
  workingTreeClean: true;
  formalArtifactCount: 0;
  t2Gate: string;
  t3cGate: string;
}>;

export type Phase698TransportReentryV2PreflightInput = Readonly<{
  args: readonly string[];
  source: Phase698TransportReentryV2SourceFixture;
  proxy: Readonly<{
    code: 'direct_ready' | 'loopback_proxy_ready';
    providerCalls: 0;
    listenerProbeCalls: 0 | 1;
  }>;
  dataBoundary: string;
  authorization: string;
}>;

export type Phase698TransportReentryV2PreflightResult =
  | Readonly<{
      ok: true;
      authority: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_AUTHORITY;
      gate: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_GATE;
      providerCalls: 0;
      credentialReads: 0;
      formalEvidence: 0;
      capability: Phase698TransportReentryV2PreflightCapability;
    }>
  | Phase698TransportReentryV2Failure;

export type Phase698TransportReentryV2PreflightCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_PREFLIGHT_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
}>;

export type Phase698TransportReentryV2DedicatedCapability = Readonly<{
  version: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_DEDICATED_CAPABILITY_VERSION;
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
  family: Phase698TransportReentryV2Family;
  callId: string;
}>;

export type Phase698TransportReentryV2Projection = Readonly<{
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
  rewrite: Phase698TransportReentryV2DedicatedCapability;
  qwen: Phase698TransportReentryV2DedicatedCapability;
  final_response: Phase698TransportReentryV2DedicatedCapability;
}>;

export type Phase698TransportReentryV2ProjectionResult =
  | Readonly<{
      ok: true;
      projection: Phase698TransportReentryV2Projection;
    }>
  | Phase698TransportReentryV2Failure;

export type Phase698TransportReentryV2DedicatedCapabilityReceipt = Readonly<{
  lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
  family: Phase698TransportReentryV2Family;
  callId: string;
  credentialAvailable: true;
}>;
/** @deprecated C1 returns an opaque receipt; raw credential material is never exposed. */
export type Phase698TransportReentryV2ConsumedCredential =
  Phase698TransportReentryV2DedicatedCapabilityReceipt;

const ALLOWED_KEY_SET = new Set<string>(PHASE_6_9_8_TRANSPORT_REENTRY_V2_GENERIC_KEYS);
/**
 * The repository root .env is shared by the local application.  It contains
 * many non-provider settings, so the launcher uses this separate, selective
 * allowlist instead of feeding the whole file to the strict synthetic parser.
 * Qwen_API_KEY and DASHSCOPE_API_KEY are existing host-compatible aliases used
 * by the server's production config; they are normalized to QWEN_API_KEY here.
 */
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_ROOT_COMPATIBLE_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY',
  'QWEN_API_KEY',
  'Qwen_API_KEY',
  'DASHSCOPE_API_KEY',
] as const);
const ROOT_COMPATIBLE_KEY_SET = new Set<string>(
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_ROOT_COMPATIBLE_KEYS,
);
const FAMILY_SET = new Set<string>(PHASE_6_9_8_TRANSPORT_REENTRY_V2_FAMILIES);
const MAX_LINE_LENGTH = 1024;
const MAX_VALUE_LENGTH = 512;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const CALL_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;

const preflightStates = new WeakMap<object, Phase698TransportReentryV2PreflightInput>();
const consumedPreflights = new WeakSet<object>();
const dedicatedStates = new WeakMap<
  object,
  Readonly<{
    lineage: typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE;
    family: Phase698TransportReentryV2Family;
    callId: string;
    apiKey: string;
  }>
>();
const consumedDedicated = new WeakSet<object>();

function failure(
  reasonCode: Phase698TransportReentryV2FailureCode,
): Phase698TransportReentryV2Failure {
  return Object.freeze({ ok: false as const, reasonCode });
}

function isObject(value: unknown): value is object {
  return (typeof value === 'object' || typeof value === 'function') && value !== null;
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (!isObject(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function hasOnlyAscii(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) return false;
  }
  return true;
}

function validCredentialValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_VALUE_LENGTH &&
    value === value.trim() &&
    hasOnlyAscii(value) &&
    !/[\u0000-\u001f\u007f]/u.test(value) &&
    !value.includes('$') &&
    !value.includes('\\')
  );
}

function ownDataValue(
  input: object,
  key: PropertyKey,
): Readonly<{ ok: true; value: unknown }> | Phase698TransportReentryV2Failure {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) return failure('accessor_input');
    const value: unknown = descriptor.value;
    return Object.freeze({ ok: true as const, value });
  } catch {
    return failure('accessor_input');
  }
}

/**
 * Parse only the two operator-facing keys. The parser deliberately has no
 * process/env dependency and never returns raw source or error details.
 */
export function parsePhase698TransportReentryV2DotEnv(
  input: unknown,
): Phase698TransportReentryV2ParseResult {
  if (typeof input !== 'string') return failure('invalid_input');
  let source = input;
  if (source.startsWith('\uFEFF')) source = source.slice(1);
  if (source.includes('\u0000')) return failure('invalid_input');
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\r' && source[index + 1] !== '\n') return failure('multiline');
  }
  if (!hasOnlyAscii(source.replace(/\r?\n/gu, ''))) return failure('non_ascii');

  const lines = source.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const values: Partial<Record<Phase698TransportReentryV2GenericKey, string>> = {};

  for (const originalLine of lines) {
    if (originalLine.length > MAX_LINE_LENGTH) return failure('line_too_long');
    if (originalLine.includes('\r') && !originalLine.endsWith('\r')) return failure('multiline');
    const line = originalLine.endsWith('\r') ? originalLine.slice(0, -1) : originalLine;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) return failure('invalid_line');
    const key = line.slice(0, separator);
    const rawValue = line.slice(separator + 1);
    if (!/^[A-Z][A-Z0-9_]{0,63}$/u.test(key)) return failure('invalid_line');
    if (!ALLOWED_KEY_SET.has(key)) return failure('unknown_key');
    if (Object.prototype.hasOwnProperty.call(values, key)) return failure('duplicate_key');
    if (rawValue.length === 0) return failure('empty_value');
    if (rawValue.includes('$')) return failure('interpolation');
    if (rawValue.endsWith('\\')) return failure('multiline');

    let value: string;
    if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
      const quote = rawValue[0];
      if (rawValue.length < 2 || rawValue[rawValue.length - 1] !== quote)
        return failure('multiline');
      value = rawValue.slice(1, -1);
      if (
        value.includes(quote) ||
        value.includes('\\') ||
        value.includes('\n') ||
        value.includes('\r')
      ) {
        return failure('invalid_line');
      }
    } else {
      if (rawValue !== rawValue.trim() || rawValue.includes('"') || rawValue.includes("'")) {
        return failure('invalid_line');
      }
      value = rawValue;
    }
    if (!validCredentialValue(value))
      return failure(value === '' ? 'empty_value' : 'credential_shape_invalid');
    values[key as Phase698TransportReentryV2GenericKey] = value;
  }

  return Object.freeze({ ok: true as const, values: deepFreeze(values) });
}

/**
 * Parse the shared repository .env without importing unrelated application
 * settings into the transport launcher.  The strict parser above remains the
 * fixture/credential-object contract and deliberately rejects unknown fields;
 * this root selector instead ignores non-credential settings, while applying
 * the same bounded value rules to the four supported host credential names.
 * Qwen aliases are accepted at this boundary and normalized to QWEN_API_KEY.
 */
export function parsePhase698TransportReentryV2RootDotEnv(
  input: unknown,
): Phase698TransportReentryV2ParseResult {
  if (typeof input !== 'string') return failure('invalid_input');
  let source = input;
  if (source.startsWith('\uFEFF')) source = source.slice(1);
  if (source.includes('\u0000')) return failure('invalid_input');
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\r' && source[index + 1] !== '\n') return failure('multiline');
  }

  const lines = source.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  const values: Partial<Record<Phase698TransportReentryV2GenericKey, string>> = {};
  let deepseekSeen = false;
  let qwenSeen = false;

  for (const originalLine of lines) {
    if (originalLine.length > MAX_LINE_LENGTH) return failure('line_too_long');
    if (originalLine.includes('\r') && !originalLine.endsWith('\r')) return failure('multiline');
    const line = originalLine.endsWith('\r') ? originalLine.slice(0, -1) : originalLine;
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) return failure('invalid_line');
    const key = line.slice(0, separator);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key)) return failure('invalid_line');

    // Non-credential project settings stay inside the file and never enter
    // the projection. Their values are intentionally not interpreted here.
    if (!ROOT_COMPATIBLE_KEY_SET.has(key)) continue;

    const rawValue = line.slice(separator + 1);
    const parsedValue = parseBoundedRootCredentialValue(rawValue);
    if (!parsedValue.ok) return parsedValue;

    if (key === 'DEEPSEEK_API_KEY') {
      if (deepseekSeen) return failure('duplicate_key');
      deepseekSeen = true;
      values.DEEPSEEK_API_KEY = parsedValue.value;
      continue;
    }

    if (qwenSeen) return failure('alias_conflict');
    qwenSeen = true;
    values.QWEN_API_KEY = parsedValue.value;
  }

  if (!deepseekSeen || !qwenSeen) return failure('credential_missing');
  return Object.freeze({ ok: true as const, values: deepFreeze(values) });
}

export function parsePhase698TransportReentryV2RootDotEnvBytes(
  input: unknown,
): Phase698TransportReentryV2ParseResult {
  if (!(input instanceof Uint8Array)) return failure('invalid_input');
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(input);
    return parsePhase698TransportReentryV2RootDotEnv(decoded);
  } catch {
    return failure('unsupported_encoding');
  }
}

function parseBoundedRootCredentialValue(
  rawValue: string,
): Readonly<{ ok: true; value: string }> | Phase698TransportReentryV2Failure {
  if (rawValue.length === 0) return failure('empty_value');
  if (rawValue.includes('$')) return failure('interpolation');
  if (rawValue.endsWith('\\')) return failure('multiline');

  let value: string;
  if (rawValue.startsWith("'") || rawValue.startsWith('"')) {
    const quote = rawValue[0];
    if (rawValue.length < 2 || rawValue[rawValue.length - 1] !== quote) return failure('multiline');
    value = rawValue.slice(1, -1);
    if (
      value.includes(quote) ||
      value.includes('\\') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return failure('invalid_line');
    }
  } else {
    if (rawValue !== rawValue.trim() || rawValue.includes('"') || rawValue.includes("'")) {
      return failure('invalid_line');
    }
    value = rawValue;
  }
  if (!validCredentialValue(value))
    return failure(value === '' ? 'empty_value' : 'credential_shape_invalid');
  return Object.freeze({ ok: true as const, value });
}

export function parsePhase698TransportReentryV2DotEnvBytes(
  input: unknown,
): Phase698TransportReentryV2ParseResult {
  if (!(input instanceof Uint8Array)) return failure('invalid_input');
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(input);
    return parsePhase698TransportReentryV2DotEnv(decoded);
  } catch {
    return failure('unsupported_encoding');
  }
}

/**
 * Read a shared root .env using launcher location only; cwd and ambient
 * variables are ignored. Non-credential application settings are skipped by
 * the selective root parser and never enter the dedicated projection.
 */
export function readPhase698TransportReentryV2RootDotEnv(
  launcherLocation: string | URL,
  readBytes: (path: string) => Uint8Array = (path) => readFileSync(path),
): Phase698TransportReentryV2ParseResult | Phase698TransportReentryV2Failure {
  const root = resolvePhase698TransportReentryV2RepositoryRoot(launcherLocation);
  if (root === null) return failure('root_not_found');
  try {
    return parsePhase698TransportReentryV2RootDotEnvBytes(readBytes(join(root, '.env')));
  } catch {
    return failure('env_read_failed');
  }
}

/** Resolve repo root from the launcher file, never from cwd. */
export function resolvePhase698TransportReentryV2RepositoryRoot(
  launcherLocation: string | URL,
): string | null {
  try {
    let supplied: string;
    if (launcherLocation instanceof URL) supplied = fileURLToPath(launcherLocation);
    else if (launcherLocation.startsWith('file:')) supplied = fileURLToPath(launcherLocation);
    else {
      if (!isAbsolute(launcherLocation)) return null;
      supplied = launcherLocation;
    }
    let current = supplied;
    try {
      if (statSync(current).isFile()) current = dirname(current);
    } catch {
      current = dirname(current);
    }
    for (let depth = 0; depth < 12; depth += 1) {
      if (existsSync(join(current, 'package.json')) && existsSync(join(current, '.git'))) {
        return realpathSync(current);
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  } catch {
    return null;
  }
}

/** Read a strict, own-data-only object; accessor-backed and extra fields fail closed. */
export function readPhase698TransportReentryV2GenericCredentials(
  input: unknown,
):
  | Readonly<{ ok: true; credentials: Phase698TransportReentryV2GenericCredentials }>
  | Phase698TransportReentryV2Failure {
  if (!isPlainRecord(input)) return failure('credential_shape_invalid');
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    return failure('accessor_input');
  }
  if (keys.some((key) => typeof key !== 'string' || !ALLOWED_KEY_SET.has(key))) {
    return failure('extra_field');
  }
  if (keys.length !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_GENERIC_KEYS.length) {
    return failure('credential_missing');
  }

  const deepseek = ownDataValue(input, 'DEEPSEEK_API_KEY');
  const qwen = ownDataValue(input, 'QWEN_API_KEY');
  if (!deepseek.ok || !qwen.ok) return failure('accessor_input');
  if (!validCredentialValue(deepseek.value) || !validCredentialValue(qwen.value)) {
    return failure('credential_shape_invalid');
  }
  return Object.freeze({
    ok: true as const,
    credentials: Object.freeze({
      DEEPSEEK_API_KEY: deepseek.value,
      QWEN_API_KEY: qwen.value,
    }),
  });
}

function validCallId(value: unknown): value is string {
  return typeof value === 'string' && CALL_ID_PATTERN.test(value);
}

function validSourceFixture(value: unknown): value is Phase698TransportReentryV2SourceFixture {
  if (!isPlainRecord(value)) return false;
  const required = [
    'lineage',
    'branch',
    'commit',
    'trackingCommit',
    'remoteCommit',
    'approvedSourceCommit',
    'workingTreeClean',
    'formalArtifactCount',
    't2Gate',
    't3cGate',
  ] as const;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return false;
  }
  if (
    keys.length !== required.length ||
    keys.some(
      (key) => typeof key !== 'string' || !required.includes(key as (typeof required)[number]),
    )
  )
    return false;
  const read = (key: string) => ownDataValue(value, key);
  const lineage = read('lineage');
  const branch = read('branch');
  const commit = read('commit');
  const tracking = read('trackingCommit');
  const remote = read('remoteCommit');
  const approved = read('approvedSourceCommit');
  const clean = read('workingTreeClean');
  const artifact = read('formalArtifactCount');
  const t2 = read('t2Gate');
  const t3c = read('t3cGate');
  return (
    lineage.ok &&
    lineage.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE &&
    branch.ok &&
    typeof branch.value === 'string' &&
    branch.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_BRANCH &&
    commit.ok &&
    typeof commit.value === 'string' &&
    COMMIT_PATTERN.test(commit.value) &&
    tracking.ok &&
    typeof tracking.value === 'string' &&
    COMMIT_PATTERN.test(tracking.value) &&
    remote.ok &&
    typeof remote.value === 'string' &&
    COMMIT_PATTERN.test(remote.value) &&
    approved.ok &&
    typeof approved.value === 'string' &&
    COMMIT_PATTERN.test(approved.value) &&
    commit.value === tracking.value &&
    commit.value === remote.value &&
    commit.value === approved.value &&
    clean.ok &&
    clean.value === true &&
    artifact.ok &&
    artifact.value === 0 &&
    t2.ok &&
    typeof t2.value === 'string' &&
    t2.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING &&
    t3c.ok &&
    typeof t3c.value === 'string' &&
    t3c.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING
  );
}

function validPreflightInput(value: unknown): value is Phase698TransportReentryV2PreflightInput {
  if (!isPlainRecord(value)) return false;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    return false;
  }
  const required = ['args', 'source', 'proxy', 'dataBoundary', 'authorization'] as const;
  if (
    keys.length !== required.length ||
    keys.some(
      (key) => typeof key !== 'string' || !required.includes(key as (typeof required)[number]),
    )
  ) {
    return false;
  }
  const args = ownDataValue(value, 'args');
  const source = ownDataValue(value, 'source');
  const proxy = ownDataValue(value, 'proxy');
  const dataBoundary = ownDataValue(value, 'dataBoundary');
  const authorization = ownDataValue(value, 'authorization');
  if (!args.ok || !source.ok || !proxy.ok || !dataBoundary.ok || !authorization.ok) return false;
  if (
    !Array.isArray(args.value) ||
    args.value.length !== 1 ||
    args.value[0] !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER_ARGUMENT
  )
    return false;
  if (!validSourceFixture(source.value) || !isPlainRecord(proxy.value)) return false;
  let proxyKeys: readonly PropertyKey[];
  try {
    proxyKeys = Reflect.ownKeys(proxy.value);
  } catch {
    return false;
  }
  const proxyRequired = ['code', 'providerCalls', 'listenerProbeCalls'] as const;
  if (
    proxyKeys.length !== proxyRequired.length ||
    proxyKeys.some(
      (key) =>
        typeof key !== 'string' || !proxyRequired.includes(key as (typeof proxyRequired)[number]),
    )
  ) {
    return false;
  }
  const proxyCode = ownDataValue(proxy.value, 'code');
  const calls = ownDataValue(proxy.value, 'providerCalls');
  const probes = ownDataValue(proxy.value, 'listenerProbeCalls');
  if (!proxyCode.ok || !calls.ok || !probes.ok) return false;
  const proxyReady =
    (proxyCode.value === 'direct_ready' && probes.value === 0) ||
    (proxyCode.value === 'loopback_proxy_ready' && probes.value === 1);
  return (
    proxyReady &&
    calls.value === 0 &&
    dataBoundary.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE &&
    authorization.value === PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION
  );
}

export function inspectPhase698TransportReentryV2Preflight(
  input: unknown,
): Phase698TransportReentryV2PreflightResult {
  if (!validPreflightInput(input)) return failure('gate_invalid');
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_PREFLIGHT_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  });
  preflightStates.set(capability, input);
  return Object.freeze({
    ok: true as const,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_AUTHORITY,
    gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_GATE,
    providerCalls: 0 as const,
    credentialReads: 0 as const,
    formalEvidence: 0 as const,
    capability,
  });
}

function consumePreflightCapability(
  capability: unknown,
):
  | Readonly<{ ok: true; input: Phase698TransportReentryV2PreflightInput }>
  | Phase698TransportReentryV2Failure {
  if (!isObject(capability)) return failure('capability_invalid');
  const input = preflightStates.get(capability);
  if (!input) return failure('capability_invalid');
  if (consumedPreflights.has(capability)) return failure('capability_reused');
  consumedPreflights.add(capability);
  return Object.freeze({ ok: true as const, input });
}

function issueDedicated(
  family: Phase698TransportReentryV2Family,
  callId: string,
  apiKey: string,
): Phase698TransportReentryV2DedicatedCapability {
  const capability = Object.freeze({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_DEDICATED_CAPABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    family,
    callId,
  });
  dedicatedStates.set(
    capability,
    Object.freeze({ lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE, family, callId, apiKey }),
  );
  return capability;
}

export function projectPhase698TransportReentryV2DedicatedCapabilities(
  preflightCapability: unknown,
  genericInput: unknown,
  callIds: Phase698TransportReentryV2CallIds,
): Phase698TransportReentryV2ProjectionResult {
  const consumed = consumePreflightCapability(preflightCapability);
  if (!consumed.ok) return consumed;
  if (!isPlainRecord(callIds)) return failure('invalid_input');
  const ids = ['rewrite', 'qwen', 'final_response'] as const;
  if (Reflect.ownKeys(callIds).length !== ids.length) {
    return failure('invalid_input');
  }
  const callIdValues = ids.map((id) => ownDataValue(callIds, id));
  if (callIdValues.some((item) => !item.ok || !validCallId(item.value))) {
    return failure('accessor_input');
  }
  const parsed = readPhase698TransportReentryV2GenericCredentials(genericInput);
  if (!parsed.ok) return parsed;
  const projection = Object.freeze({
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    rewrite: issueDedicated('rewrite', callIds.rewrite, parsed.credentials.DEEPSEEK_API_KEY),
    qwen: issueDedicated('qwen', callIds.qwen, parsed.credentials.QWEN_API_KEY),
    final_response: issueDedicated(
      'final_response',
      callIds.final_response,
      parsed.credentials.DEEPSEEK_API_KEY,
    ),
  });
  return Object.freeze({ ok: true as const, projection });
}

export function consumePhase698TransportReentryV2DedicatedCapability(
  capability: unknown,
  expectedFamily: Phase698TransportReentryV2Family,
  expectedCallId: string,
): Phase698TransportReentryV2DedicatedCapabilityReceipt | Phase698TransportReentryV2Failure {
  if (!FAMILY_SET.has(expectedFamily) || !validCallId(expectedCallId) || !isObject(capability)) {
    return failure('capability_invalid');
  }
  const state = dedicatedStates.get(capability);
  if (!state) return failure('capability_invalid');
  if (state.lineage !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE)
    return failure('capability_invalid');
  if (consumedDedicated.has(capability)) return failure('capability_reused');
  if (state.family !== expectedFamily) return failure('family_mismatch');
  if (state.callId !== expectedCallId) return failure('call_mismatch');
  consumedDedicated.add(capability);
  return Object.freeze({
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    family: state.family,
    callId: state.callId,
    credentialAvailable: true as const,
  });
}

/**
 * Validate a dedicated capability without consuming it. This is the
 * pre-marker configuration check; the capability is handed to a first-party
 * adapter only after the durable reservation exists.
 */
export function inspectPhase698TransportReentryV2DedicatedCapability(
  capability: unknown,
  expectedFamily: Phase698TransportReentryV2Family,
  expectedCallId: string,
): Phase698TransportReentryV2DedicatedCapabilityReceipt | Phase698TransportReentryV2Failure {
  if (!FAMILY_SET.has(expectedFamily) || !validCallId(expectedCallId) || !isObject(capability))
    return failure('capability_invalid');
  const state = dedicatedStates.get(capability);
  if (!state) return failure('capability_invalid');
  if (state.lineage !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE)
    return failure('capability_invalid');
  if (consumedDedicated.has(capability)) return failure('capability_reused');
  if (state.family !== expectedFamily) return failure('family_mismatch');
  if (state.callId !== expectedCallId) return failure('call_mismatch');
  return Object.freeze({
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    family: state.family,
    callId: state.callId,
    credentialAvailable: true as const,
  });
}

/**
 * L1-only secret handoff. The credential remains owned by this module's
 * WeakMap and is available to a trusted first-party adapter constructor only
 * for the duration of the callback. The raw key is never returned as a value,
 * receipt, diagnostic, or evidence field. Calling this function also consumes
 * the capability, so a second handoff (including a forged/cross-family one)
 * fails closed.
 */
export function withPhase698TransportReentryV2DedicatedApiKey<T>(
  capability: unknown,
  expectedFamily: Phase698TransportReentryV2Family,
  expectedCallId: string,
  consumer: (apiKey: string) => T,
): T | Phase698TransportReentryV2Failure {
  if (
    !FAMILY_SET.has(expectedFamily) ||
    !validCallId(expectedCallId) ||
    typeof consumer !== 'function' ||
    !isObject(capability)
  ) {
    return failure('capability_invalid');
  }
  const state = dedicatedStates.get(capability);
  if (!state) return failure('capability_invalid');
  if (state.lineage !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE)
    return failure('capability_invalid');
  if (consumedDedicated.has(capability)) return failure('capability_reused');
  if (state.family !== expectedFamily) return failure('family_mismatch');
  if (state.callId !== expectedCallId) return failure('call_mismatch');
  consumedDedicated.add(capability);
  try {
    return consumer(state.apiKey);
  } catch {
    return failure('credential_shape_invalid');
  }
}

export function makePhase698TransportReentryV2SyntheticPreflightInput(
  overrides: Partial<Phase698TransportReentryV2PreflightInput> = {},
): Phase698TransportReentryV2PreflightInput {
  const source: Phase698TransportReentryV2SourceFixture = {
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    branch: PHASE_6_9_8_TRANSPORT_REENTRY_V2_BRANCH,
    commit: '0'.repeat(40),
    trackingCommit: '0'.repeat(40),
    remoteCommit: '0'.repeat(40),
    approvedSourceCommit: '0'.repeat(40),
    workingTreeClean: true,
    formalArtifactCount: 0,
    t2Gate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T2_GATE_BINDING,
    t3cGate: PHASE_6_9_8_TRANSPORT_REENTRY_V2_T3C_GATE_BINDING,
  };
  const proxy = {
    code: 'direct_ready' as const,
    providerCalls: 0 as const,
    listenerProbeCalls: 0 as const,
  };
  return Object.freeze({
    args: [PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_ZERO_PROVIDER_ARGUMENT],
    source,
    proxy,
    dataBoundary: PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
    authorization: PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
    ...overrides,
  });
}
