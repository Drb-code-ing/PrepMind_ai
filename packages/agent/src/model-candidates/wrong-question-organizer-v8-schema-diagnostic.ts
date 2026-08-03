import { createHash } from 'node:crypto';

import { z } from 'zod';

import { requireModelAgentStrictJsonContent } from '@repo/ai';

import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA,
  type WrongQuestionOrganizerV8ModelDecision,
} from './wrong-question-organizer-v8-model-contract.ts';

export const WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_VERSION =
  'phase-6.9.7-v8-bounded-schema-diagnostic-v1' as const;

export const WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_REASONS = [
  'top_level_shape',
  'top_level_keys',
  'fingerprint_type',
  'fingerprint_format',
  'decisions_type',
  'decisions_count',
  'decision_shape',
  'decision_keys',
  'question_index',
  'subject_index',
  'deck_action',
  'target_index',
  'dynamic_authority',
  'unknown',
] as const;

export const WRONG_QUESTION_ORGANIZER_V8_TOP_LEVEL_SHAPES = [
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

export const WRONG_QUESTION_ORGANIZER_V8_DECISION_COUNT_BUCKETS = [
  'not_array',
  'zero',
  'one',
  'two_to_four',
  'five_to_eight',
  'nine_to_twelve',
  'over_twelve',
  'unknown',
] as const;

export const WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_VERSION),
    reason: z.enum(WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_REASONS),
    topLevelShape: z.enum(WRONG_QUESTION_ORGANIZER_V8_TOP_LEVEL_SHAPES),
    missingRequiredFieldCount: z.number().int().safe().min(0).max(50),
    unexpectedFieldCount: z.number().int().safe().min(0).max(4_096),
    invalidFieldTypeCount: z.number().int().safe().min(0).max(50),
    decisionCountBucket: z.enum(WRONG_QUESTION_ORGANIZER_V8_DECISION_COUNT_BUCKETS),
    shapeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    rawDataRetained: z.literal(false),
  })
  .strict();

export type WrongQuestionOrganizerV8BoundedSchemaDiagnostic = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA
>;

export type WrongQuestionOrganizerV8SchemaDiagnosticCollector = Readonly<{
  schema: z.ZodType<WrongQuestionOrganizerV8ModelDecision>;
  recordDynamicAuthorityFailure(value: unknown): void;
  recordUnknownFailure(): void;
  read(): WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null;
}>;

type DiagnosticReason = (typeof WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_REASONS)[number];
type TopLevelShape = (typeof WRONG_QUESTION_ORGANIZER_V8_TOP_LEVEL_SHAPES)[number];
type DecisionCountBucket = (typeof WRONG_QUESTION_ORGANIZER_V8_DECISION_COUNT_BUCKETS)[number];

type ShapeSnapshot = Readonly<{
  topLevelShape: TopLevelShape;
  missingRequiredFieldCount: number;
  unexpectedFieldCount: number;
  invalidFieldTypeCount: number;
  decisionCountBucket: DecisionCountBucket;
  fingerprintTokens: readonly string[];
}>;

const TOP_LEVEL_KEYS = ['shortlistFingerprint', 'decisions'] as const;
const DECISION_KEYS = ['questionIndex', 'subjectIndex', 'deckAction', 'targetIndex'] as const;
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_STATIC_QUESTION_INDEX = 11;
const MAX_STATIC_SUBJECT_INDEX = 5;
const MAX_STATIC_TARGET_INDEX = 19;

export function diagnoseWrongQuestionOrganizerV8Schema(
  input: unknown,
  reasonOverride?: 'dynamic_authority',
): WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return unknownDiagnostic(safeTopLevelShape(input));
    const snapshot = buildShapeSnapshot(cloned.value);
    const classified = classifyStaticFailure(cloned.value);
    const reason = reasonOverride ?? classified;
    if (reason === null) return null;
    return buildDiagnostic(reason, snapshot);
  } catch {
    return unknownDiagnostic('unknown');
  }
}

export function createWrongQuestionOrganizerV8SchemaDiagnosticCollector(): WrongQuestionOrganizerV8SchemaDiagnosticCollector {
  let diagnostic: WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null = null;
  const record = (next: WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null) => {
    if (diagnostic === null && next !== null) diagnostic = next;
  };
  const observedSchema = z.preprocess((value) => {
    try {
      record(diagnoseWrongQuestionOrganizerV8Schema(value));
    } catch {
      record(unknownDiagnostic('unknown'));
    }
    return value;
  }, WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA);

  return Object.freeze({
    schema: requireModelAgentStrictJsonContent(
      observedSchema as unknown as z.ZodType<WrongQuestionOrganizerV8ModelDecision>,
    ),
    recordDynamicAuthorityFailure(value: unknown) {
      try {
        record(diagnoseWrongQuestionOrganizerV8Schema(value, 'dynamic_authority'));
      } catch {
        record(unknownDiagnostic('unknown'));
      }
    },
    recordUnknownFailure() {
      record(unknownDiagnostic('unknown'));
    },
    read() {
      return diagnostic;
    },
  });
}

function classifyStaticFailure(
  value: unknown,
): Exclude<DiagnosticReason, 'dynamic_authority'> | null {
  if (!isPlainRecord(value)) return 'top_level_shape';
  const topKeys = Object.keys(value);
  if (!hasExactKeys(topKeys, TOP_LEVEL_KEYS)) return 'top_level_keys';
  if (typeof value.shortlistFingerprint !== 'string') return 'fingerprint_type';
  if (!FINGERPRINT_PATTERN.test(value.shortlistFingerprint)) return 'fingerprint_format';
  if (!Array.isArray(value.decisions)) return 'decisions_type';
  if (value.decisions.length < 1 || value.decisions.length > 12) return 'decisions_count';
  if (value.decisions.some((decision) => !isPlainRecord(decision))) return 'decision_shape';
  const decisions = value.decisions as Record<string, unknown>[];
  if (decisions.some((decision) => !hasExactKeys(Object.keys(decision), DECISION_KEYS))) {
    return 'decision_keys';
  }
  if (
    decisions.some(
      (decision) => !isBoundedSafeInteger(decision.questionIndex, 0, MAX_STATIC_QUESTION_INDEX),
    )
  ) {
    return 'question_index';
  }
  if (
    decisions.some(
      (decision) =>
        decision.subjectIndex !== null &&
        !isBoundedSafeInteger(decision.subjectIndex, 0, MAX_STATIC_SUBJECT_INDEX),
    )
  ) {
    return 'subject_index';
  }
  if (
    decisions.some(
      (decision) =>
        decision.deckAction !== 'reuse_existing' && decision.deckAction !== 'create_topic',
    )
  ) {
    return 'deck_action';
  }
  if (
    decisions.some(
      (decision) => !isBoundedSafeInteger(decision.targetIndex, 0, MAX_STATIC_TARGET_INDEX),
    )
  ) {
    return 'target_index';
  }
  return null;
}

function buildShapeSnapshot(value: unknown): ShapeSnapshot {
  const topLevelShape = safeTopLevelShape(value);
  if (!isPlainRecord(value)) {
    return {
      topLevelShape,
      missingRequiredFieldCount: TOP_LEVEL_KEYS.length,
      unexpectedFieldCount: 0,
      invalidFieldTypeCount: 1,
      decisionCountBucket: Array.isArray(value) ? bucketDecisionCount(value.length) : 'not_array',
      fingerprintTokens: [`top:${topLevelShape}`],
    };
  }

  const topKeys = Object.keys(value);
  const missingTop = countMissingKeys(topKeys, TOP_LEVEL_KEYS);
  const unexpectedTop = countUnexpectedKeys(topKeys, TOP_LEVEL_KEYS);
  let missing = missingTop;
  let unexpected = unexpectedTop;
  let invalidTypes = 0;
  const fingerprintTokens = [
    `top:${topLevelShape}`,
    `top.shortlistFingerprint:${hasOwn(value, 'shortlistFingerprint') ? primitiveType(value.shortlistFingerprint) : 'absent'}`,
    `top.decisions:${hasOwn(value, 'decisions') ? primitiveType(value.decisions) : 'absent'}`,
    `top.unknown:${unexpectedTop}`,
  ];

  if (hasOwn(value, 'shortlistFingerprint') && typeof value.shortlistFingerprint !== 'string') {
    invalidTypes += 1;
  }
  if (hasOwn(value, 'decisions') && !Array.isArray(value.decisions)) invalidTypes += 1;
  const decisionCountBucket = Array.isArray(value.decisions)
    ? bucketDecisionCount(value.decisions.length)
    : 'not_array';
  fingerprintTokens.push(`decisions.count:${decisionCountBucket}`);

  if (Array.isArray(value.decisions) && value.decisions.length <= 12) {
    value.decisions.forEach((decision, index) => {
      const shape = safeTopLevelShape(decision);
      if (!isPlainRecord(decision)) {
        invalidTypes += 1;
        fingerprintTokens.push(`decision.${index}:${shape}`);
        return;
      }
      const keys = Object.keys(decision);
      const missingDecision = countMissingKeys(keys, DECISION_KEYS);
      const unexpectedDecision = countUnexpectedKeys(keys, DECISION_KEYS);
      missing += missingDecision;
      unexpected += unexpectedDecision;
      fingerprintTokens.push(
        `decision.${index}:plain_object`,
        `decision.${index}.questionIndex:${hasOwn(decision, 'questionIndex') ? primitiveType(decision.questionIndex) : 'absent'}`,
        `decision.${index}.subjectIndex:${hasOwn(decision, 'subjectIndex') ? primitiveType(decision.subjectIndex) : 'absent'}`,
        `decision.${index}.deckAction:${hasOwn(decision, 'deckAction') ? primitiveType(decision.deckAction) : 'absent'}`,
        `decision.${index}.targetIndex:${hasOwn(decision, 'targetIndex') ? primitiveType(decision.targetIndex) : 'absent'}`,
        `decision.${index}.unknown:${unexpectedDecision}`,
      );
      if (hasOwn(decision, 'questionIndex') && typeof decision.questionIndex !== 'number') {
        invalidTypes += 1;
      }
      if (
        hasOwn(decision, 'subjectIndex') &&
        decision.subjectIndex !== null &&
        typeof decision.subjectIndex !== 'number'
      ) {
        invalidTypes += 1;
      }
      if (hasOwn(decision, 'deckAction') && typeof decision.deckAction !== 'string') {
        invalidTypes += 1;
      }
      if (hasOwn(decision, 'targetIndex') && typeof decision.targetIndex !== 'number') {
        invalidTypes += 1;
      }
    });
  }

  if (missing > 50 || unexpected > 4_096 || invalidTypes > 50) {
    throw new Error('V8_BOUNDED_SCHEMA_DIAGNOSTIC_LIMIT_EXCEEDED');
  }
  return {
    topLevelShape,
    missingRequiredFieldCount: missing,
    unexpectedFieldCount: unexpected,
    invalidFieldTypeCount: invalidTypes,
    decisionCountBucket,
    fingerprintTokens,
  };
}

function buildDiagnostic(
  reason: DiagnosticReason,
  snapshot: ShapeSnapshot,
): WrongQuestionOrganizerV8BoundedSchemaDiagnostic {
  const parsed = WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse({
    version: WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_VERSION,
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
  if (!parsed.success) return unknownDiagnostic('unknown');
  return deepFreezeModelValue(parsed.data);
}

function unknownDiagnostic(topLevelShape: TopLevelShape) {
  const fingerprint = createHash('sha256')
    .update(`top:${topLevelShape}|diagnostic:unknown`)
    .digest('hex');
  return deepFreezeModelValue({
    version: WRONG_QUESTION_ORGANIZER_V8_SCHEMA_DIAGNOSTIC_VERSION,
    reason: 'unknown' as const,
    topLevelShape,
    missingRequiredFieldCount: 0,
    unexpectedFieldCount: 0,
    invalidFieldTypeCount: 0,
    decisionCountBucket: 'unknown' as const,
    shapeFingerprint: `sha256:${fingerprint}`,
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
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function primitiveType(value: unknown) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'non_finite_number';
    return Number.isSafeInteger(value) ? 'safe_integer' : 'number';
  }
  if (typeof value === 'object') return isPlainRecord(value) ? 'plain_object' : 'other_object';
  return typeof value;
}

function bucketDecisionCount(length: number): DecisionCountBucket {
  if (!Number.isSafeInteger(length) || length < 0) return 'unknown';
  if (length === 0) return 'zero';
  if (length === 1) return 'one';
  if (length <= 4) return 'two_to_four';
  if (length <= 8) return 'five_to_eight';
  if (length <= 12) return 'nine_to_twelve';
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

function hasExactKeys(keys: readonly string[], expected: readonly string[]) {
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function countMissingKeys(keys: readonly string[], expected: readonly string[]) {
  return expected.filter((key) => !keys.includes(key)).length;
}

function countUnexpectedKeys(keys: readonly string[], expected: readonly string[]) {
  return keys.filter((key) => !expected.includes(key)).length;
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isBoundedSafeInteger(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
