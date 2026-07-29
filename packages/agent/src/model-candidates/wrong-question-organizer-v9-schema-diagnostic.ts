import { createHash } from 'node:crypto';

import { z } from 'zod';

import { deepFreezeModelValue } from './model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
  type WrongQuestionOrganizerV9DecisionFailureCode,
  type WrongQuestionOrganizerV9ModelDecision,
} from './wrong-question-organizer-v9-model-contract.ts';

export const WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION =
  'phase-6.9.7-v9-bounded-schema-diagnostic-v1' as const;

export const WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_REASONS = [
  'top_level_shape',
  'top_level_keys',
  'decisions_type',
  'decisions_count',
  'decision_shape',
  'decision_keys',
  'question_index',
  'option_index',
  'selection_coverage',
  'selection_authority',
  'option_authority',
  'unknown',
] as const;

export const WRONG_QUESTION_ORGANIZER_V9_TOP_LEVEL_SHAPES = [
  'plain_object',
  'other_object',
  'array',
  'null',
  'string',
  'number',
  'boolean',
  'undefined',
  'bigint',
  'symbol',
  'function',
  'unknown',
] as const;

export const WRONG_QUESTION_ORGANIZER_V9_DECISION_COUNT_BUCKETS = [
  'not_array',
  'zero',
  'one',
  'two_to_twelve',
  'over_twelve',
  'unknown',
] as const;

export const WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION),
    reason: z.enum(WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_REASONS),
    topLevelShape: z.enum(WRONG_QUESTION_ORGANIZER_V9_TOP_LEVEL_SHAPES),
    missingRequiredFieldCount: z.number().int().safe().min(0).max(50),
    unexpectedFieldCount: z.number().int().safe().min(0).max(4_096),
    invalidFieldTypeCount: z.number().int().safe().min(0).max(50),
    decisionCountBucket: z.enum(WRONG_QUESTION_ORGANIZER_V9_DECISION_COUNT_BUCKETS),
    shapeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    rawDataRetained: z.literal(false),
  })
  .strict();

export type WrongQuestionOrganizerV9BoundedSchemaDiagnostic = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA
>;

export type WrongQuestionOrganizerV9SchemaDiagnosticCollector = Readonly<{
  schema: z.ZodType<WrongQuestionOrganizerV9ModelDecision>;
  recordSelectionFailure(value: unknown, reason: WrongQuestionOrganizerV9DecisionFailureCode): void;
  recordOptionAuthorityFailure(): void;
  recordUnknownFailure(): void;
  read(): WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null;
}>;

type DiagnosticReason = (typeof WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_REASONS)[number];
type TopLevelShape = (typeof WRONG_QUESTION_ORGANIZER_V9_TOP_LEVEL_SHAPES)[number];
type DecisionCountBucket = (typeof WRONG_QUESTION_ORGANIZER_V9_DECISION_COUNT_BUCKETS)[number];

type ShapeSnapshot = Readonly<{
  topLevelShape: TopLevelShape;
  missingRequiredFieldCount: number;
  unexpectedFieldCount: number;
  invalidFieldTypeCount: number;
  decisionCountBucket: DecisionCountBucket;
  fingerprintTokens: readonly string[];
}>;

export function diagnoseWrongQuestionOrganizerV9Schema(
  input: unknown,
  reasonOverride?: 'selection_coverage' | 'selection_authority' | 'option_authority',
): WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null {
  try {
    const snapshot = buildShapeSnapshot(input);
    const reason = reasonOverride ?? classifyStaticFailure(input);
    return reason === null ? null : buildDiagnostic(reason, snapshot);
  } catch {
    return unknownDiagnostic('unknown');
  }
}

export function createWrongQuestionOrganizerV9SchemaDiagnosticCollector(): WrongQuestionOrganizerV9SchemaDiagnosticCollector {
  let diagnostic: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null = null;
  const record = (next: WrongQuestionOrganizerV9BoundedSchemaDiagnostic | null) => {
    if (diagnostic === null && next !== null) diagnostic = next;
  };
  const observedSchema = z.preprocess((value) => {
    try {
      record(diagnoseWrongQuestionOrganizerV9Schema(value));
    } catch {
      record(unknownDiagnostic('unknown'));
    }
    return value;
  }, WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA);

  return Object.freeze({
    schema: Object.freeze(
      observedSchema as unknown as z.ZodType<WrongQuestionOrganizerV9ModelDecision>,
    ),
    recordSelectionFailure(value: unknown, reason: WrongQuestionOrganizerV9DecisionFailureCode) {
      try {
        record(diagnoseWrongQuestionOrganizerV9Schema(value, mapSelectionReason(reason)));
      } catch {
        record(unknownDiagnostic('unknown'));
      }
    },
    recordOptionAuthorityFailure() {
      record(diagnoseWrongQuestionOrganizerV9Schema({}, 'option_authority'));
    },
    recordUnknownFailure() {
      record(unknownDiagnostic('unknown'));
    },
    read() {
      return diagnostic;
    },
  });
}

function mapSelectionReason(
  reason: WrongQuestionOrganizerV9DecisionFailureCode,
): 'selection_coverage' | 'selection_authority' | 'option_authority' {
  switch (reason) {
    case 'option_authority_invalid':
      return 'option_authority';
    case 'question_count_mismatch':
    case 'duplicate_question_index':
      return 'selection_coverage';
    case 'question_index_out_of_range':
    case 'option_index_out_of_range':
    case 'selection_authority_invalid':
    case 'schema_invalid':
      return 'selection_authority';
  }
}

function classifyStaticFailure(
  input: unknown,
): Exclude<
  DiagnosticReason,
  'selection_coverage' | 'selection_authority' | 'option_authority'
> | null {
  if (!isPlainRecord(input)) return 'top_level_shape';
  const topKeys = safeOwnKeys(input);
  if (topKeys === null) return 'unknown';
  if (!hasExactKeys(topKeys, ['decisions'])) return 'top_level_keys';
  const decisions = readDataProperty(input, 'decisions');
  if (!decisions.ok || !Array.isArray(decisions.value)) return 'decisions_type';
  if (decisions.value.length < 1 || decisions.value.length > 12) return 'decisions_count';
  for (const entry of decisions.value) {
    if (!isPlainRecord(entry)) return 'decision_shape';
    const keys = safeOwnKeys(entry);
    if (keys === null) return 'unknown';
    if (!hasExactKeys(keys, ['questionIndex', 'optionIndex'])) return 'decision_keys';
    const questionIndex = readDataProperty(entry, 'questionIndex');
    if (!questionIndex.ok || !isBoundedSafeInteger(questionIndex.value, 0, 11)) {
      return 'question_index';
    }
    const optionIndex = readDataProperty(entry, 'optionIndex');
    if (!optionIndex.ok || !isBoundedSafeInteger(optionIndex.value, 0, 23)) {
      return 'option_index';
    }
  }
  return WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA.safeParse(input).success
    ? null
    : 'unknown';
}

function buildShapeSnapshot(value: unknown): ShapeSnapshot {
  const topLevelShape = safeTopLevelShape(value);
  if (!isPlainRecord(value)) {
    return {
      topLevelShape,
      missingRequiredFieldCount: 1,
      unexpectedFieldCount: 0,
      invalidFieldTypeCount: 1,
      decisionCountBucket: 'not_array',
      fingerprintTokens: [`top:${topLevelShape}`, 'decisions:not_array'],
    };
  }
  const topKeys = safeOwnKeys(value);
  if (topKeys === null) throw new Error('V9_DIAGNOSTIC_KEYS_UNAVAILABLE');
  const decisionsRead = readDataProperty(value, 'decisions');
  const decisions = decisionsRead.ok ? decisionsRead.value : undefined;
  const decisionArray = Array.isArray(decisions) ? decisions : null;
  let missing = countMissingKeys(topKeys, ['decisions']);
  let unexpected = countUnexpectedKeys(topKeys, ['decisions']);
  let invalidTypes = decisionArray === null ? 1 : 0;
  const tokens = [
    `top:${topLevelShape}`,
    `top_missing:${missing}`,
    `top_unexpected:${bucketCount(unexpected)}`,
    `decisions:${decisionArray === null ? 'not_array' : bucketDecisionCount(decisionArray.length)}`,
  ];
  if (decisionArray !== null) {
    for (const [index, entry] of decisionArray.slice(0, 12).entries()) {
      if (!isPlainRecord(entry)) {
        invalidTypes += 1;
        tokens.push(`entry:${index}:shape:${safeTopLevelShape(entry)}`);
        continue;
      }
      const keys = safeOwnKeys(entry);
      if (keys === null) throw new Error('V9_DIAGNOSTIC_ENTRY_KEYS_UNAVAILABLE');
      missing += countMissingKeys(keys, ['questionIndex', 'optionIndex']);
      unexpected += countUnexpectedKeys(keys, ['questionIndex', 'optionIndex']);
      const question = readDataProperty(entry, 'questionIndex');
      const option = readDataProperty(entry, 'optionIndex');
      const questionType = question.ok ? primitiveType(question.value) : 'accessor';
      const optionType = option.ok ? primitiveType(option.value) : 'accessor';
      if (!question.ok || !isBoundedSafeInteger(question.value, 0, 11)) invalidTypes += 1;
      if (!option.ok || !isBoundedSafeInteger(option.value, 0, 23)) invalidTypes += 1;
      tokens.push(
        `entry:${index}:keys:${keys.length}:unexpected:${bucketCount(countUnexpectedKeys(keys, ['questionIndex', 'optionIndex']))}`,
        `entry:${index}:question_type:${questionType}`,
        `entry:${index}:option_type:${optionType}`,
      );
    }
  }
  if (missing > 50 || unexpected > 4_096 || invalidTypes > 50) {
    throw new Error('V9_BOUNDED_SCHEMA_DIAGNOSTIC_LIMIT_EXCEEDED');
  }
  return {
    topLevelShape,
    missingRequiredFieldCount: missing,
    unexpectedFieldCount: unexpected,
    invalidFieldTypeCount: invalidTypes,
    decisionCountBucket:
      decisionArray === null ? 'not_array' : bucketDecisionCount(decisionArray.length),
    fingerprintTokens: tokens,
  };
}

function buildDiagnostic(
  reason: DiagnosticReason,
  snapshot: ShapeSnapshot,
): WrongQuestionOrganizerV9BoundedSchemaDiagnostic {
  const parsed = WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse({
    version: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
    reason,
    topLevelShape: snapshot.topLevelShape,
    missingRequiredFieldCount: snapshot.missingRequiredFieldCount,
    unexpectedFieldCount: snapshot.unexpectedFieldCount,
    invalidFieldTypeCount: snapshot.invalidFieldTypeCount,
    decisionCountBucket: snapshot.decisionCountBucket,
    shapeFingerprint: `sha256:${createHash('sha256')
      .update(snapshot.fingerprintTokens.join('|'))
      .digest('hex')}`,
    rawDataRetained: false,
  });
  return parsed.success ? deepFreezeModelValue(parsed.data) : unknownDiagnostic('unknown');
}

function unknownDiagnostic(topLevelShape: TopLevelShape) {
  return deepFreezeModelValue({
    version: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
    reason: 'unknown' as const,
    topLevelShape,
    missingRequiredFieldCount: 0,
    unexpectedFieldCount: 0,
    invalidFieldTypeCount: 0,
    decisionCountBucket: 'unknown' as const,
    shapeFingerprint: `sha256:${createHash('sha256')
      .update(`top:${topLevelShape}|diagnostic:unknown`)
      .digest('hex')}`,
    rawDataRetained: false as const,
  });
}

function safeTopLevelShape(value: unknown): TopLevelShape {
  try {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    switch (typeof value) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'undefined':
        return 'undefined';
      case 'bigint':
        return 'bigint';
      case 'symbol':
        return 'symbol';
      case 'function':
        return 'function';
      case 'object': {
        const prototype = Reflect.getPrototypeOf(value);
        return prototype === Object.prototype || prototype === null
          ? 'plain_object'
          : 'other_object';
      }
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

function primitiveType(value: unknown) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function bucketDecisionCount(length: number): DecisionCountBucket {
  if (!Number.isSafeInteger(length) || length < 0) return 'unknown';
  if (length === 0) return 'zero';
  if (length === 1) return 'one';
  if (length <= 12) return 'two_to_twelve';
  return 'over_twelve';
}

function bucketCount(value: number) {
  if (value <= 0) return 'zero';
  if (value === 1) return 'one';
  if (value <= 4) return 'two_to_four';
  if (value <= 12) return 'five_to_twelve';
  return 'over_twelve';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null)
    );
  } catch {
    return false;
  }
}

function safeOwnKeys(value: object) {
  try {
    const keys = Reflect.ownKeys(value);
    return keys.every((key): key is string => typeof key === 'string') ? keys : null;
  } catch {
    return null;
  }
}

function readDataProperty(
  value: object,
  key: string,
): Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }> {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor
      ? ({ ok: true, value: descriptor.value as unknown } as const)
      : ({ ok: false } as const);
  } catch {
    return { ok: false } as const;
  }
}

function hasExactKeys(keys: readonly string[], expected: readonly string[]) {
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function countMissingKeys(keys: readonly string[], expected: readonly string[]) {
  return expected.filter((key) => !keys.includes(key)).length;
}

function countUnexpectedKeys(keys: readonly string[], expected: readonly string[]) {
  return keys.filter((key) => !expected.includes(key)).length;
}

function isBoundedSafeInteger(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
