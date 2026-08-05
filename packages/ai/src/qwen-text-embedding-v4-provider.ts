export const QWEN_TEXT_EMBEDDING_V4_PROVIDER_VERSION =
  'qwen-text-embedding-v4-provider-v1' as const;
export const QWEN_TEXT_EMBEDDING_V4_MODEL = 'text-embedding-v4' as const;
export const QWEN_TEXT_EMBEDDING_V4_DIMENSIONS = 1_536 as const;
export const QWEN_TEXT_EMBEDDING_V4_MAX_BATCH_SIZE = 10 as const;
export const QWEN_TEXT_EMBEDDING_V4_MAX_INPUT_TOKENS_PER_TEXT = 8_192 as const;
export const QWEN_TEXT_EMBEDDING_V4_MAX_INPUT_UTF16_PER_TEXT = 2_000 as const;
export const QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE =
  'qwen-text-embedding-v4-cn-beijing-cny-2026-08-05' as const;
export const QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY = 0.5 as const;
export const QWEN_TEXT_EMBEDDING_V4_PRICE_SOURCE_URLS = Object.freeze([
  'https://help.aliyun.com/zh/model-studio/text-embedding-v4',
  'https://help.aliyun.com/zh/model-studio/embedding-interfaces-compatible-with-openai',
] as const);
export const QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE =
  'aliyun-bailian-openai-compatible-cn-beijing-v1' as const;

export const QWEN_TEXT_EMBEDDING_V4_FAILURE_CODES = [
  'aborted',
  'invalid_config',
  'invalid_request',
  'provider_unavailable',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'response_invalid',
  'usage_invalid',
] as const;

export type QwenTextEmbeddingV4FailureCode = (typeof QWEN_TEXT_EMBEDDING_V4_FAILURE_CODES)[number];

export type QwenTextEmbeddingV4ProviderConfig = Readonly<{
  apiKey: string;
  baseURL: string;
  model: typeof QWEN_TEXT_EMBEDDING_V4_MODEL;
  dimensions: typeof QWEN_TEXT_EMBEDDING_V4_DIMENSIONS;
  priceProfile: typeof QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE;
}>;

export type QwenTextEmbeddingV4Request = Readonly<{
  inputs: readonly string[];
  dimensions: typeof QWEN_TEXT_EMBEDDING_V4_DIMENSIONS;
  signal: AbortSignal;
}>;

export type QwenTextEmbeddingV4Result = Readonly<{
  embeddings: readonly (readonly number[])[];
  usage: Readonly<{
    inputTokens: number;
    totalTokens: number;
  }>;
  billing: Readonly<{
    priceProfile: typeof QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE;
    inputPerMillionCny: typeof QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY;
    verifiedCostCny: number;
  }>;
}>;

export type QwenTextEmbeddingV4Executor = (
  request: QwenTextEmbeddingV4Request,
) => Promise<QwenTextEmbeddingV4Result>;

export type QwenTextEmbeddingV4ProviderDependencies = Readonly<{
  fetch: typeof fetch;
}>;

export type QwenTextEmbeddingV4Provider = Readonly<{
  version: typeof QWEN_TEXT_EMBEDDING_V4_PROVIDER_VERSION;
  provenance: 'first_party_qwen_text_embedding_v4_direct' | 'synthetic_test';
  endpointProfile: typeof QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE;
  executor: QwenTextEmbeddingV4Executor;
}>;

export type QwenTextEmbeddingV4DiagnosticProvider = QwenTextEmbeddingV4Provider &
  Readonly<{
    wireCapability: Phase698ProviderWireCapability;
  }>;

export class QwenTextEmbeddingV4ProviderError extends Error {
  readonly code: QwenTextEmbeddingV4FailureCode;

  constructor(code: QwenTextEmbeddingV4FailureCode) {
    super(`QWEN_TEXT_EMBEDDING_V4_${code.toUpperCase()}`);
    this.name = 'QwenTextEmbeddingV4ProviderError';
    this.code = code;
  }
}

export function isQwenTextEmbeddingV4ProviderError(
  value: unknown,
): value is QwenTextEmbeddingV4ProviderError {
  return (
    value instanceof QwenTextEmbeddingV4ProviderError &&
    QWEN_TEXT_EMBEDDING_V4_FAILURE_CODES.includes(value.code)
  );
}

const CONFIG_KEYS = ['apiKey', 'baseURL', 'dimensions', 'model', 'priceProfile'] as const;
const REQUEST_KEYS = ['dimensions', 'inputs', 'signal'] as const;
const PAYLOAD_KEYS = ['data', 'id', 'model', 'object', 'usage'] as const;
const DATA_ITEM_KEYS = ['embedding', 'index', 'object'] as const;
const USAGE_KEYS = ['prompt_tokens', 'total_tokens'] as const;
const MAX_CREDENTIAL_LENGTH = 512;
const MAX_RESPONSE_UTF16 = 2_000_000;
const VISIBLE_ASCII = /^[\x21-\x7e]+$/u;
const WORKSPACE_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cn-beijing\.maas\.aliyuncs\.com$/u;
const LEGACY_BEIJING_HOST = 'dashscope.aliyuncs.com';
const OPENAI_COMPATIBLE_PATH = '/compatible-mode/v1';

const DEFAULT_DEPENDENCIES: QwenTextEmbeddingV4ProviderDependencies = Object.freeze({
  fetch: (input, init) => globalThis.fetch(input, init),
});

type NormalizedConfig = Readonly<{
  apiKey: string;
  embeddingsURL: string;
}>;

type NormalizedRequest = Readonly<{
  inputs: readonly string[];
  signal: AbortSignal;
}>;

/**
 * Creates the strict OpenAI-compatible Qwen embedding transport used by the
 * Phase 6.9.8 evaluator. It never reads environment variables, retries, logs
 * provider payloads, or owns run-level admission/durability.
 */
export function createQwenTextEmbeddingV4Provider(
  configInput: QwenTextEmbeddingV4ProviderConfig,
  dependenciesInput?: QwenTextEmbeddingV4ProviderDependencies,
): QwenTextEmbeddingV4Provider {
  return createQwenTextEmbeddingV4ProviderInternal(configInput, dependenciesInput, null);
}

/**
 * Binds one Qwen executor to a module-owned Phase 6.9.8 wire capability.
 * Only the first-party provider path can advance that capability.
 */
export function createQwenTextEmbeddingV4DiagnosticProvider(
  configInput: QwenTextEmbeddingV4ProviderConfig,
  wireCapability: Phase698ProviderWireCapability,
  dependenciesInput?: QwenTextEmbeddingV4ProviderDependencies,
): QwenTextEmbeddingV4DiagnosticProvider {
  const provider = createQwenTextEmbeddingV4ProviderInternal(
    configInput,
    dependenciesInput,
    wireCapability,
  );
  return Object.freeze({ ...provider, wireCapability });
}

function createQwenTextEmbeddingV4ProviderInternal(
  configInput: QwenTextEmbeddingV4ProviderConfig,
  dependenciesInput: QwenTextEmbeddingV4ProviderDependencies | undefined,
  wireCapability: Phase698ProviderWireCapability | null,
): QwenTextEmbeddingV4Provider {
  const config = normalizeConfig(configInput);
  const dependencies = normalizeDependencies(dependenciesInput);

  const executor: QwenTextEmbeddingV4Executor = async (requestInput) => {
    if (
      wireCapability !== null &&
      !claimPhase698ProviderWireCapability(wireCapability, 'qwen_retrieval')
    ) {
      throw failure('provider_unavailable');
    }
    let request: NormalizedRequest;
    try {
      request = normalizeRequest(requestInput);
    } catch (error) {
      failWire(wireCapability, 'request_contract');
      throw error;
    }
    requireWireAdvance(wireCapability, 'request_validated');
    if (request.signal.aborted) {
      failWire(wireCapability, 'pre_dispatch_abort');
      throw failure('aborted');
    }

    let response: Response;
    requireWireAdvance(wireCapability, 'provider_dispatch_started');
    try {
      const candidate = await dependencies.fetch(config.embeddingsURL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: QWEN_TEXT_EMBEDDING_V4_MODEL,
          input: request.inputs,
          dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
          encoding_format: 'float',
        }),
        signal: request.signal,
        redirect: 'error',
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!(candidate instanceof Response)) {
        failWire(wireCapability, 'response_not_observed');
        throw failure('response_invalid');
      }
      response = candidate;
    } catch (error) {
      if (isQwenTextEmbeddingV4ProviderError(error)) throw error;
      failWire(wireCapability, request.signal.aborted ? 'post_dispatch_abort' : 'transport');
      throw failure(request.signal.aborted ? 'aborted' : 'provider_unavailable');
    }

    requireWireAdvance(wireCapability, 'provider_response_received');
    if (request.signal.aborted) {
      failWire(wireCapability, 'post_dispatch_abort');
      throw failure('aborted');
    }
    const status = readStatus(response);
    if (status !== 200) {
      const code = classifyHttpStatus(status);
      failWire(wireCapability, wireFailureForQwenCode(code));
      throw failure(code);
    }
    if (!isJsonContentType(response)) {
      failWire(wireCapability, 'provider_envelope_invalid');
      throw failure('response_invalid');
    }

    let rawPayload: string;
    try {
      rawPayload = await response.text();
    } catch {
      failWire(
        wireCapability,
        request.signal.aborted ? 'post_dispatch_abort' : 'provider_envelope_invalid',
      );
      throw failure(request.signal.aborted ? 'aborted' : 'response_invalid');
    }
    if (request.signal.aborted) {
      failWire(wireCapability, 'post_dispatch_abort');
      throw failure('aborted');
    }
    if (rawPayload.length < 1 || rawPayload.length > MAX_RESPONSE_UTF16) {
      failWire(wireCapability, 'provider_envelope_invalid');
      throw failure('response_invalid');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      failWire(wireCapability, 'provider_envelope_invalid');
      throw failure('response_invalid');
    }
    setWireShape(wireCapability, payload);
    const result = parseProviderPayload(payload, request.inputs.length, wireCapability);
    if (wireCapability !== null && !completePhase698ProviderWire(wireCapability)) {
      throw failure('provider_unavailable');
    }
    return result;
  };

  return Object.freeze({
    version: QWEN_TEXT_EMBEDDING_V4_PROVIDER_VERSION,
    provenance:
      dependenciesInput === undefined
        ? 'first_party_qwen_text_embedding_v4_direct'
        : 'synthetic_test',
    endpointProfile: QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE,
    executor,
  });
}

export function calculateQwenTextEmbeddingV4CostCny(inputTokens: number): number {
  if (!Number.isSafeInteger(inputTokens) || inputTokens < 0) throw failure('usage_invalid');
  return Number(
    ((inputTokens * QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY) / 1_000_000).toFixed(9),
  );
}

function normalizeConfig(input: unknown): NormalizedConfig {
  try {
    const values = readExactOwnDataValues(input, CONFIG_KEYS);
    if (
      !values ||
      !isValidCredential(values.apiKey) ||
      values.model !== QWEN_TEXT_EMBEDDING_V4_MODEL ||
      values.dimensions !== QWEN_TEXT_EMBEDDING_V4_DIMENSIONS ||
      values.priceProfile !== QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE ||
      typeof values.baseURL !== 'string'
    ) {
      throw new Error();
    }
    return Object.freeze({
      apiKey: values.apiKey,
      embeddingsURL: parseBeijingEmbeddingsURL(values.baseURL),
    });
  } catch {
    throw failure('invalid_config');
  }
}

function normalizeDependencies(
  input: QwenTextEmbeddingV4ProviderDependencies | undefined,
): QwenTextEmbeddingV4ProviderDependencies {
  if (input === undefined) return DEFAULT_DEPENDENCIES;
  try {
    const values = readExactOwnDataValues(input, ['fetch']);
    if (!values || typeof values.fetch !== 'function') throw new Error();
    return Object.freeze({ fetch: values.fetch as typeof fetch });
  } catch {
    throw failure('invalid_config');
  }
}

function normalizeRequest(input: unknown): NormalizedRequest {
  try {
    const values = readExactOwnDataValues(input, REQUEST_KEYS);
    if (
      !values ||
      values.dimensions !== QWEN_TEXT_EMBEDDING_V4_DIMENSIONS ||
      !isNativeAbortSignal(values.signal) ||
      !Array.isArray(values.inputs) ||
      values.inputs.length < 1 ||
      values.inputs.length > QWEN_TEXT_EMBEDDING_V4_MAX_BATCH_SIZE
    ) {
      throw new Error();
    }
    const inputs = values.inputs.map((value) => {
      if (
        typeof value !== 'string' ||
        value.length < 1 ||
        value.length > QWEN_TEXT_EMBEDDING_V4_MAX_INPUT_UTF16_PER_TEXT ||
        value !== value.trim()
      ) {
        throw new Error();
      }
      return value;
    });
    return Object.freeze({ inputs: Object.freeze(inputs), signal: values.signal });
  } catch {
    throw failure('invalid_request');
  }
}

function parseBeijingEmbeddingsURL(baseURL: string): string {
  if (baseURL !== baseURL.trim() || baseURL.endsWith('/')) throw new Error();
  const parsed = new URL(baseURL);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.port !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    parsed.pathname !== OPENAI_COMPATIBLE_PATH ||
    parsed.href !== baseURL
  ) {
    throw new Error();
  }
  const hostname = parsed.hostname;
  if (hostname !== LEGACY_BEIJING_HOST && !WORKSPACE_HOST.test(hostname)) throw new Error();
  return `${baseURL}/embeddings`;
}

function parseProviderPayload(
  payload: unknown,
  expectedCount: number,
  wireCapability: Phase698ProviderWireCapability | null,
): QwenTextEmbeddingV4Result {
  const values = readExactOwnDataValues(payload, PAYLOAD_KEYS);
  if (
    !values ||
    values.object !== 'list' ||
    values.model !== QWEN_TEXT_EMBEDDING_V4_MODEL ||
    !isBoundedVisibleAscii(values.id, 1, 200) ||
    !Array.isArray(values.data)
  ) {
    failWire(wireCapability, 'provider_envelope_invalid');
    throw failure('response_invalid');
  }
  requireWireAdvance(wireCapability, 'provider_envelope_validated');
  if (values.data.length !== expectedCount) {
    failWire(wireCapability, 'embedding_count_invalid');
    throw failure('response_invalid');
  }

  const ordered: (readonly number[] | undefined)[] = Array.from(
    { length: expectedCount },
    () => undefined,
  );
  for (const rawItem of values.data) {
    const item = readExactOwnDataValues(rawItem, DATA_ITEM_KEYS);
    if (
      !item ||
      item.object !== 'embedding' ||
      !Number.isSafeInteger(item.index) ||
      (item.index as number) < 0 ||
      (item.index as number) >= expectedCount ||
      ordered[item.index as number] !== undefined
    ) {
      failWire(wireCapability, 'embedding_count_invalid');
      throw failure('response_invalid');
    }
    if (
      !Array.isArray(item.embedding) ||
      item.embedding.length !== QWEN_TEXT_EMBEDDING_V4_DIMENSIONS
    ) {
      failWire(wireCapability, 'embedding_dimension_invalid');
      throw failure('response_invalid');
    }
    let normSquared = 0;
    const embedding = item.embedding.map((component) => {
      if (typeof component !== 'number' || !Number.isFinite(component)) {
        failWire(wireCapability, 'embedding_value_invalid');
        throw failure('response_invalid');
      }
      normSquared += component * component;
      return component;
    });
    if (!Number.isFinite(normSquared) || normSquared <= 0) {
      failWire(wireCapability, 'embedding_value_invalid');
      throw failure('response_invalid');
    }
    ordered[item.index as number] = Object.freeze(embedding);
  }
  if (ordered.some((embedding) => embedding === undefined)) {
    failWire(wireCapability, 'embedding_count_invalid');
    throw failure('response_invalid');
  }
  requireWireAdvance(wireCapability, 'embedding_validated');

  const usage = readExactOwnDataValues(values.usage, USAGE_KEYS);
  const inputTokens = usage?.prompt_tokens;
  const totalTokens = usage?.total_tokens;
  if (
    !isPositiveSafeInteger(inputTokens) ||
    !isPositiveSafeInteger(totalTokens) ||
    inputTokens !== totalTokens ||
    inputTokens > expectedCount * QWEN_TEXT_EMBEDDING_V4_MAX_INPUT_TOKENS_PER_TEXT
  ) {
    failWire(wireCapability, 'usage_invalid');
    throw failure('usage_invalid');
  }
  requireWireAdvance(wireCapability, 'usage_validated');

  return Object.freeze({
    embeddings: Object.freeze(ordered as readonly (readonly number[])[]),
    usage: Object.freeze({ inputTokens, totalTokens }),
    billing: Object.freeze({
      priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
      inputPerMillionCny: QWEN_TEXT_EMBEDDING_V4_INPUT_PRICE_PER_MILLION_CNY,
      verifiedCostCny: calculateQwenTextEmbeddingV4CostCny(inputTokens),
    }),
  });
}

function requireWireAdvance(
  capability: Phase698ProviderWireCapability | null,
  stage:
    | 'request_validated'
    | 'provider_dispatch_started'
    | 'provider_response_received'
    | 'provider_envelope_validated'
    | 'embedding_validated'
    | 'usage_validated',
) {
  if (capability !== null && !advancePhase698ProviderWireStage(capability, stage)) {
    throw failure('provider_unavailable');
  }
}

function failWire(
  capability: Phase698ProviderWireCapability | null,
  category: Phase698ProviderWireFailureCategory,
) {
  if (capability !== null) failPhase698ProviderWire(capability, category);
}

function wireFailureForQwenCode(
  code: QwenTextEmbeddingV4FailureCode,
): Phase698ProviderWireFailureCategory {
  switch (code) {
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
      return code;
    case 'aborted':
      return 'post_dispatch_abort';
    case 'provider_unavailable':
      return 'transport';
    default:
      return 'provider_envelope_invalid';
  }
}

function setWireShape(capability: Phase698ProviderWireCapability | null, value: unknown) {
  if (capability === null) return;
  const shape = readWireShape(value);
  if (!setPhase698ProviderWireShapeBuckets(capability, shape)) {
    failPhase698ProviderWire(capability, 'unknown');
  }
}

function readWireShape(value: unknown): Readonly<{
  topLevelTypeBucket: Phase698ProviderWireTopLevelTypeBucket;
  fieldCountBucket: Phase698ProviderWireFieldCountBucket;
}> {
  if (value === null) return { topLevelTypeBucket: 'null', fieldCountBucket: '0' };
  if (Array.isArray(value)) return { topLevelTypeBucket: 'array', fieldCountBucket: '0' };
  const primitive = typeof value;
  if (primitive === 'string' || primitive === 'number' || primitive === 'boolean') {
    return { topLevelTypeBucket: primitive, fieldCountBucket: '0' };
  }
  if (primitive !== 'object') {
    return { topLevelTypeBucket: 'unknown', fieldCountBucket: 'unknown' };
  }
  try {
    const count = Reflect.ownKeys(value as object).length;
    return {
      topLevelTypeBucket: 'object',
      fieldCountBucket: bucketFieldCount(count),
    };
  } catch {
    return { topLevelTypeBucket: 'unknown', fieldCountBucket: 'unknown' };
  }
}

function bucketFieldCount(value: number): Phase698ProviderWireFieldCountBucket {
  if (value === 0) return '0';
  if (value === 1) return '1';
  if (value <= 4) return '2_4';
  return '5_plus';
}

function readStatus(response: Response): number {
  try {
    const status = response.status;
    return Number.isSafeInteger(status) && status >= 100 && status <= 599 ? status : 0;
  } catch {
    return 0;
  }
}

function classifyHttpStatus(status: number): QwenTextEmbeddingV4FailureCode {
  if (status === 401 || status === 403) return 'http_auth';
  if (status === 429) return 'http_rate_limit';
  if (status >= 400 && status <= 499) return 'http_client';
  if (status >= 500 && status <= 599) return 'http_server';
  return 'response_invalid';
}

function isJsonContentType(response: Response): boolean {
  try {
    const value = response.headers.get('content-type');
    return typeof value === 'string' && /^application\/json(?:\s*;|$)/iu.test(value);
  } catch {
    return false;
  }
}

function readExactOwnDataValues(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  try {
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isValidCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= MAX_CREDENTIAL_LENGTH &&
    value === value.trim() &&
    VISIBLE_ASCII.test(value)
  );
}

function isBoundedVisibleAscii(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimumLength &&
    value.length <= maximumLength &&
    VISIBLE_ASCII.test(value)
  );
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function failure(code: QwenTextEmbeddingV4FailureCode): QwenTextEmbeddingV4ProviderError {
  return new QwenTextEmbeddingV4ProviderError(code);
}
import {
  advancePhase698ProviderWireStage,
  claimPhase698ProviderWireCapability,
  completePhase698ProviderWire,
  failPhase698ProviderWire,
  setPhase698ProviderWireShapeBuckets,
  type Phase698ProviderWireCapability,
  type Phase698ProviderWireFailureCategory,
  type Phase698ProviderWireFieldCountBucket,
  type Phase698ProviderWireTopLevelTypeBucket,
} from './phase-6-9-8-provider-wire-diagnostics.ts';
