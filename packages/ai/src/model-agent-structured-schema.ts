import { zodSchema } from 'ai';
import { z } from 'zod';

export const MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED =
  'MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED' as const;

export type ModelAgentStructuredSchema = z.ZodType<
  unknown,
  z.ZodTypeDef,
  unknown
>;

export type ModelAgentStructuredSchemaProfile = Readonly<{
  name: string;
  schema: ModelAgentStructuredSchema;
}>;

export type CompiledModelAgentStructuredSchemaProfile = Readonly<{
  name: string;
  canonicalSchema: ModelAgentStructuredSchema;
  providerSchema: ReturnType<typeof zodSchema>;
}>;

export type ModelAgentStructuredSchemaRegistry = Readonly<{
  resolve(
    schema: ModelAgentStructuredSchema,
  ): CompiledModelAgentStructuredSchemaProfile | null;
}>;

export function compileDeepSeekStrictToolSchemaProfiles(
  profiles: readonly ModelAgentStructuredSchemaProfile[],
): ModelAgentStructuredSchemaRegistry {
  try {
    if (!Array.isArray(profiles) || profiles.length < 1 || profiles.length > 16) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }

    const names = new Set<string>();
    const schemas = new Set<ModelAgentStructuredSchema>();
    const compiled = new WeakMap<
      object,
      CompiledModelAgentStructuredSchemaProfile
    >();

    for (const rawProfile of profiles as readonly unknown[]) {
      const profile = snapshotProfile(rawProfile);
      if (profile === null) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      const name = profile.name;
      const schema = profile.schema;
      if (
        !/^[a-z][a-z0-9_]{0,63}$/.test(name) ||
        names.has(name) ||
        schemas.has(schema)
      ) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }

      const canonical = zodSchema(schema);
      const jsonSchema = deepFreeze(projectStrictSchema(canonical.jsonSchema));
      const providerSchema = Object.freeze({
        ...canonical,
        jsonSchema,
      }) as ReturnType<typeof zodSchema>;
      const item = Object.freeze({
        name,
        canonicalSchema: schema,
        providerSchema,
      });

      names.add(name);
      schemas.add(schema);
      compiled.set(schema, item);
    }

    return Object.freeze({
      resolve(schema: ModelAgentStructuredSchema) {
        try {
          return isObjectLike(schema) ? (compiled.get(schema) ?? null) : null;
        } catch {
          return null;
        }
      },
    });
  } catch {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
}

const ALLOWED_SCHEMA_KEYS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'enum',
  'anyOf',
  'items',
  'minimum',
  'maximum',
  'description',
]);

const ALLOWED_TYPES = new Set([
  'object',
  'array',
  'string',
  'number',
  'integer',
  'boolean',
]);

type JsonRecord = Record<string, unknown>;
type ProviderJsonSchema = ReturnType<typeof zodSchema>['jsonSchema'];

function projectStrictSchema(value: unknown): ProviderJsonSchema {
  const projected = projectSchemaNode(value, true);
  validateSchemaNode(projected);
  return projected;
}

function projectSchemaNode(value: unknown, root = false): JsonRecord {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }

  const entries: Array<[string, unknown]> = [];
  let sawConst = false;
  let sawEnum = false;
  for (const [key, raw] of Object.entries(value)) {
    if (root && key === '$schema') continue;
    if (key === 'minItems' || key === 'maxItems') continue;
    if (key === 'const') {
      if (sawConst || sawEnum || !isJsonPrimitive(raw)) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      sawConst = true;
      entries.push(['enum', [raw]]);
      continue;
    }
    if (!ALLOWED_SCHEMA_KEYS.has(key)) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }

    switch (key) {
      case 'type':
        if (typeof raw !== 'string' || !ALLOWED_TYPES.has(raw)) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, raw]);
        break;
      case 'properties':
        entries.push([key, projectProperties(raw)]);
        break;
      case 'required':
        entries.push([key, copyStringArray(raw)]);
        break;
      case 'additionalProperties':
        if (raw !== false) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, false]);
        break;
      case 'enum':
        if (sawConst || sawEnum || !isUnknownArray(raw) || raw.length < 1) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        sawEnum = true;
        if (!raw.every(isJsonPrimitive)) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, [...raw]]);
        break;
      case 'anyOf':
        if (!isUnknownArray(raw) || raw.length < 1 || raw.length > 16) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, raw.map((item) => projectSchemaNode(item))]);
        break;
      case 'items': {
        const item = isUnknownArray(raw)
          ? raw.length === 1
            ? raw[0]
            : null
          : raw;
        if (item === null || item === undefined) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, projectSchemaNode(item)]);
        break;
      }
      case 'minimum':
      case 'maximum':
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, raw]);
        break;
      case 'description':
        if (typeof raw !== 'string' || raw.length > 2_000) {
          throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
        }
        entries.push([key, raw]);
        break;
    }
  }
  return Object.fromEntries(entries);
}

function projectProperties(value: unknown): JsonRecord {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 64) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
  return Object.fromEntries(
    entries.map(([key, schema]) => {
      if (!key || key.length > 128) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      return [key, projectSchemaNode(schema)];
    }),
  );
}

function validateSchemaNode(schema: JsonRecord): void {
  const hasType = typeof schema.type === 'string';
  const hasAnyOf = 'anyOf' in schema;
  if (hasType === hasAnyOf) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }

  if (hasAnyOf) {
    const alternatives = schema.anyOf;
    if (!isUnknownArray(alternatives) || alternatives.length < 1) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    for (const alternative of alternatives) {
      if (!isRecord(alternative) || Array.isArray(alternative)) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      validateSchemaNode(alternative);
    }
  }

  if (schema.type === 'object') {
    const properties = schema.properties;
    const required = schema.required;
    if (
      !isRecord(properties) ||
      Array.isArray(properties) ||
      !isUnknownArray(required) ||
      schema.additionalProperties !== false
    ) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    const propertyKeys = Object.keys(properties).sort();
    const requiredKeys = copyStringArray(required).sort();
    if (
      propertyKeys.length !== requiredKeys.length ||
      propertyKeys.some((key, index) => key !== requiredKeys[index]) ||
      new Set(requiredKeys).size !== requiredKeys.length
    ) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    for (const property of Object.values(properties)) {
      if (!isRecord(property) || Array.isArray(property)) {
        throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
      }
      validateSchemaNode(property);
    }
  } else if (
    'properties' in schema ||
    'required' in schema ||
    'additionalProperties' in schema
  ) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }

  if (schema.type === 'array') {
    const items = schema.items;
    if (!isRecord(items) || Array.isArray(items)) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    validateSchemaNode(items);
  } else if (
    'items' in schema
  ) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
}

function copyStringArray(value: unknown): string[] {
  if (!isUnknownArray(value) || value.length < 1) {
    throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.length < 1) {
      throw new Error(MODEL_AGENT_STRUCTURED_SCHEMA_UNSUPPORTED);
    }
    result.push(item);
  }
  return result;
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isObjectLike(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function snapshotProfile(
  value: unknown,
): { name: string; schema: ModelAgentStructuredSchema } | null {
  if (!isRecord(value) || Array.isArray(value)) return null;
  const name = value.name;
  const schema = value.schema;
  return typeof name === 'string' && schema instanceof z.ZodType
    ? { name, schema: schema as ModelAgentStructuredSchema }
    : null;
}
