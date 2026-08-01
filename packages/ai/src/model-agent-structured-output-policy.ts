import type { z } from 'zod';

import type { ModelAgentStructuredOutputStage } from './model-agent-contract.ts';

const STRICT_JSON_CONTENT_SCHEMAS = new WeakSet<object>();
const BOUNDED_JSON_CONTENT_PARSERS = new WeakMap<object, ModelAgentBoundedJsonContentParser>();

export type ModelAgentBoundedJsonContentParseResult =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{
      ok: false;
      stage: Extract<
        ModelAgentStructuredOutputStage,
        'provider_json_parse' | 'provider_type_validation'
      >;
    }>;

export type ModelAgentBoundedJsonContentParser = (
  content: string,
) => ModelAgentBoundedJsonContentParseResult;

export type ModelAgentJsonContentPolicyResult =
  | Readonly<{ handled: false }>
  | Readonly<{ handled: true; result: ModelAgentBoundedJsonContentParseResult }>;

/**
 * Marks one in-process schema identity as requiring the Provider message content to be exact JSON.
 * The marker is opaque, non-serializable, and does not mutate the schema object.
 */
export function requireModelAgentStrictJsonContent<T>(schema: z.ZodType<T>): z.ZodType<T> {
  if ((typeof schema !== 'object' && typeof schema !== 'function') || schema === null) {
    throw new Error('MODEL_AGENT_STRICT_JSON_SCHEMA_INVALID');
  }
  STRICT_JSON_CONTENT_SCHEMAS.add(schema);
  return schema;
}

export function requiresModelAgentStrictJsonContent(schema: unknown): boolean {
  try {
    return (
      (typeof schema === 'object' || typeof schema === 'function') &&
      schema !== null &&
      STRICT_JSON_CONTENT_SCHEMAS.has(schema)
    );
  } catch {
    return false;
  }
}

/**
 * Binds one trusted, in-process raw JSON parser to one exact schema identity.
 * The parser capability is opaque, single-registration, non-serializable, and
 * automatically preserves the strict-content marker used by first-party adapters.
 */
export function requireModelAgentBoundedJsonContentParser<T>(
  schema: z.ZodType<T>,
  parser: ModelAgentBoundedJsonContentParser,
): z.ZodType<T> {
  if ((typeof schema !== 'object' && typeof schema !== 'function') || schema === null) {
    throw new Error('MODEL_AGENT_BOUNDED_JSON_SCHEMA_INVALID');
  }
  if (typeof parser !== 'function') {
    throw new Error('MODEL_AGENT_BOUNDED_JSON_PARSER_INVALID');
  }
  if (BOUNDED_JSON_CONTENT_PARSERS.has(schema)) {
    throw new Error('MODEL_AGENT_BOUNDED_JSON_PARSER_ALREADY_REGISTERED');
  }
  STRICT_JSON_CONTENT_SCHEMAS.add(schema);
  BOUNDED_JSON_CONTENT_PARSERS.set(schema, parser);
  return schema;
}

/** Internal first-party adapter dispatch. It never returns or stores raw content. */
export function parseModelAgentJsonContentWithPolicy(
  schema: unknown,
  content: string,
): ModelAgentJsonContentPolicyResult {
  let parser: ModelAgentBoundedJsonContentParser | undefined;
  try {
    if (
      (typeof schema !== 'object' && typeof schema !== 'function') ||
      schema === null ||
      typeof content !== 'string'
    ) {
      return Object.freeze({ handled: false });
    }
    parser = BOUNDED_JSON_CONTENT_PARSERS.get(schema);
  } catch {
    return Object.freeze({ handled: false });
  }
  if (!parser) return Object.freeze({ handled: false });
  try {
    return Object.freeze({ handled: true, result: normalizeParserResult(parser(content)) });
  } catch {
    return parserFailure();
  }
}

function normalizeParserResult(value: unknown): ModelAgentBoundedJsonContentParseResult {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return parserFailureResult();
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return parserFailureResult();
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== 'string')) return parserFailureResult();
    const ok = readDataProperty(value, 'ok');
    if (!ok.found || typeof ok.value !== 'boolean') return parserFailureResult();
    if (ok.value) {
      if (!hasExactKeys(keys, ['ok', 'value'])) return parserFailureResult();
      const result = readDataProperty(value, 'value');
      return result.found
        ? Object.freeze({ ok: true, value: result.value })
        : parserFailureResult();
    }
    if (!hasExactKeys(keys, ['ok', 'stage'])) return parserFailureResult();
    const stage = readDataProperty(value, 'stage');
    return stage.found &&
      (stage.value === 'provider_json_parse' || stage.value === 'provider_type_validation')
      ? Object.freeze({ ok: false, stage: stage.value })
      : parserFailureResult();
  } catch {
    return parserFailureResult();
  }
}

function parserFailure(): ModelAgentJsonContentPolicyResult {
  return Object.freeze({ handled: true, result: parserFailureResult() });
}

function parserFailureResult(): ModelAgentBoundedJsonContentParseResult {
  return Object.freeze({ ok: false, stage: 'provider_type_validation' });
}

function readDataProperty(value: object, key: string) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor
      ? ({ found: true, value: descriptor.value as unknown } as const)
      : ({ found: false } as const);
  } catch {
    return { found: false } as const;
  }
}

function hasExactKeys(keys: readonly PropertyKey[], expected: readonly string[]) {
  return keys.length === expected.length && keys.every((key) => expected.includes(String(key)));
}
