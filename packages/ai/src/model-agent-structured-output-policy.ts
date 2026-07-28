import type { z } from 'zod';

const STRICT_JSON_CONTENT_SCHEMAS = new WeakSet<object>();

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
