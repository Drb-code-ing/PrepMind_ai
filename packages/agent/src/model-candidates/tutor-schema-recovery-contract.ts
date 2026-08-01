import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  requireModelAgentBoundedJsonContentParser,
  type ModelAgentBoundedJsonContentParseResult,
} from '@repo/ai';

import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';

export const TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION =
  'phase-6.9.7-tutor-schema-recovery-contract-v1' as const;
export const TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION =
  'phase-6.9.7-tutor-schema-diagnostic-v1' as const;

export const TUTOR_SCHEMA_RECOVERY_LIMITS = deepFreezeModelValue({
  maxBytes: 8_192,
  maxDepth: 8,
  maxNodes: 128,
  maxKeys: 64,
});

export const TUTOR_SCHEMA_RECOVERY_STAGES = [
  'response_content',
  'json_syntax',
  'provider_envelope',
  'selection_projection',
  'projected_schema',
  'local_authority',
  'local_merger',
  'usage',
  'applied',
] as const;

export const TUTOR_SCHEMA_RECOVERY_REASON_CODES = [
  'malformed_json',
  'multiple_top_level_values',
  'duplicate_key',
  'structure_limit',
  'top_level_not_object',
  'intent_index_missing',
  'intent_index_type',
  'intent_index_non_integer',
  'intent_index_out_of_range',
  'selection_ambiguous',
  'projected_schema_invalid',
  'local_authority_invalid',
  'local_merger_invalid',
  'usage_invalid',
  'extension_fields_discarded',
  'unknown',
] as const;

export const TUTOR_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS = [
  'not_attempted',
  'canonical',
  'extensions_discarded',
  'rejected',
] as const;

export const TUTOR_SCHEMA_RECOVERY_TOP_LEVEL_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
  'unknown',
] as const;

export const TUTOR_SCHEMA_RECOVERY_INTENT_INDEX_TYPES = [
  'missing',
  'number',
  'string',
  'boolean',
  'null',
  'array',
  'object',
  'unknown',
] as const;

export const TUTOR_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS = ['0', '1', '2_4', '5_plus'] as const;

export const TUTOR_SCHEMA_RECOVERY_PROJECTED_DECISION_SCHEMA = createProjectedDecisionSchema();

export type TutorSchemaRecoveryProjectedDecision = z.infer<
  typeof TUTOR_SCHEMA_RECOVERY_PROJECTED_DECISION_SCHEMA
>;

export const TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA = z
  .object({
    diagnosticVersion: z.literal(TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION),
    stage: z.enum(TUTOR_SCHEMA_RECOVERY_STAGES),
    reasonCode: z.enum(TUTOR_SCHEMA_RECOVERY_REASON_CODES),
    projectionDisposition: z.enum(TUTOR_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS),
    topLevelType: z.enum(TUTOR_SCHEMA_RECOVERY_TOP_LEVEL_TYPES),
    intentIndexType: z.enum(TUTOR_SCHEMA_RECOVERY_INTENT_INDEX_TYPES),
    extraFieldCountBucket: z.enum(TUTOR_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS),
    shapeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    rawDataRetained: z.literal(false),
  })
  .strict();

export type TutorSchemaRecoveryBoundedDiagnostic = z.infer<
  typeof TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA
>;

export type TutorSchemaRecoveryProviderContentResult =
  | Readonly<{
      ok: true;
      decision: TutorSchemaRecoveryProjectedDecision;
      diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null;
    }>
  | Readonly<{
      ok: false;
      providerStage: 'provider_json_parse' | 'provider_type_validation';
      diagnostic: TutorSchemaRecoveryBoundedDiagnostic;
    }>;

export type TutorSchemaRecoveryProjectedDecisionValidationResult =
  | Readonly<{ ok: true; value: TutorSchemaRecoveryProjectedDecision }>
  | Readonly<{ ok: false; reasonCode: 'projected_schema_invalid' }>;

export type TutorSchemaRecoveryDiagnosticCollector = Readonly<{
  schema: z.ZodType<TutorSchemaRecoveryProjectedDecision>;
  recordProjectedSchemaFailure(): void;
  recordLocalAuthorityFailure(): void;
  recordLocalMergerFailure(): void;
  recordUsageFailure(): void;
  recordApplied(): void;
  recordUnknownFailure(): void;
  read(): TutorSchemaRecoveryBoundedDiagnostic | null;
}>;

type Stage = (typeof TUTOR_SCHEMA_RECOVERY_STAGES)[number];
type ReasonCode = (typeof TUTOR_SCHEMA_RECOVERY_REASON_CODES)[number];
type ProjectionDisposition = (typeof TUTOR_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS)[number];
type TopLevelType = (typeof TUTOR_SCHEMA_RECOVERY_TOP_LEVEL_TYPES)[number];
type IntentIndexType = (typeof TUTOR_SCHEMA_RECOVERY_INTENT_INDEX_TYPES)[number];
type ExtraFieldCountBucket = (typeof TUTOR_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS)[number];

type SafeShapeSnapshot = Readonly<{
  projectionDisposition: ProjectionDisposition;
  topLevelType: TopLevelType;
  intentIndexType: IntentIndexType;
  extraFieldCountBucket: ExtraFieldCountBucket;
}>;

type InternalInspection =
  | Readonly<{
      ok: true;
      decision: TutorSchemaRecoveryProjectedDecision;
      diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null;
      snapshot: SafeShapeSnapshot;
    }>
  | Readonly<{
      ok: false;
      providerStage: 'provider_json_parse' | 'provider_type_validation';
      diagnostic: TutorSchemaRecoveryBoundedDiagnostic;
      snapshot: SafeShapeSnapshot;
    }>;

const CONTRACT_SOURCE = deepFreezeModelValue({
  version: TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION,
  diagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  limits: TUTOR_SCHEMA_RECOVERY_LIMITS,
  stages: TUTOR_SCHEMA_RECOVERY_STAGES,
  reasonCodes: TUTOR_SCHEMA_RECOVERY_REASON_CODES,
  projectionDispositions: TUTOR_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS,
  topLevelTypes: TUTOR_SCHEMA_RECOVERY_TOP_LEVEL_TYPES,
  intentIndexTypes: TUTOR_SCHEMA_RECOVERY_INTENT_INDEX_TYPES,
  extraFieldCountBuckets: TUTOR_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS,
  projectedDecisionFields: ['intentIndex'],
  intentIndexRange: [0, 4],
  parserRules: [
    'single_native_json_object',
    'duplicate_keys_rejected_before_json_parse',
    'canonical_ascii_intent_index_only',
    'unknown_extensions_discarded_after_bounded_audit',
    'no_coercion_default_clamp_retry',
    'diagnostic_hashes_enums_only',
    'raw_data_retained_false',
  ],
});

export const TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256 = sha256Canonical(CONTRACT_SOURCE);
export const TUTOR_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256 =
  'e2453faeb077faa76ab018a038790cd5a7e73f617be800c0958c098361511579' as const;

if (TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256 !== TUTOR_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256) {
  throw new Error('TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA_MISMATCH');
}

export function parseTutorSchemaRecoveryProviderContent(
  content: unknown,
): TutorSchemaRecoveryProviderContentResult {
  const inspected = inspectTutorSchemaRecoveryProviderContent(content);
  return inspected.ok
    ? deepFreezeModelValue({
        ok: true,
        decision: inspected.decision,
        diagnostic: inspected.diagnostic,
      })
    : deepFreezeModelValue({
        ok: false,
        providerStage: inspected.providerStage,
        diagnostic: inspected.diagnostic,
      });
}

export function validateTutorSchemaRecoveryProjectedDecision(
  value: unknown,
): TutorSchemaRecoveryProjectedDecisionValidationResult {
  try {
    const cloned = clonePlainModelData(value);
    if (!cloned.ok) return { ok: false, reasonCode: 'projected_schema_invalid' };
    const parsed = TUTOR_SCHEMA_RECOVERY_PROJECTED_DECISION_SCHEMA.safeParse(cloned.value);
    return parsed.success
      ? deepFreezeModelValue({ ok: true, value: parsed.data })
      : ({ ok: false, reasonCode: 'projected_schema_invalid' } as const);
  } catch {
    return { ok: false, reasonCode: 'projected_schema_invalid' };
  }
}

export function createTutorSchemaRecoveryDiagnosticCollector(): TutorSchemaRecoveryDiagnosticCollector {
  let diagnostic: TutorSchemaRecoveryBoundedDiagnostic | null = null;
  let snapshot: SafeShapeSnapshot = unknownSnapshot();
  let parserFailed = false;
  const schema = createProjectedDecisionSchema();
  requireModelAgentBoundedJsonContentParser(schema, (content) => {
    const inspected = inspectTutorSchemaRecoveryProviderContent(content);
    snapshot = inspected.snapshot;
    diagnostic = inspected.diagnostic;
    parserFailed = !inspected.ok;
    return inspected.ok
      ? ({ ok: true, value: inspected.decision } as const)
      : ({ ok: false, stage: inspected.providerStage } as const);
  });

  const record = (stage: Stage, reasonCode: ReasonCode) => {
    if (parserFailed) return;
    diagnostic = buildDiagnostic(stage, reasonCode, snapshot);
  };

  return Object.freeze({
    schema,
    recordProjectedSchemaFailure: () => record('projected_schema', 'projected_schema_invalid'),
    recordLocalAuthorityFailure: () => record('local_authority', 'local_authority_invalid'),
    recordLocalMergerFailure: () => record('local_merger', 'local_merger_invalid'),
    recordUsageFailure: () => record('usage', 'usage_invalid'),
    recordApplied() {
      if (parserFailed || diagnostic?.reasonCode !== 'extension_fields_discarded') return;
      diagnostic = buildDiagnostic('applied', 'extension_fields_discarded', snapshot);
    },
    recordUnknownFailure: () => record('projected_schema', 'unknown'),
    read: () => diagnostic,
  });
}

function inspectTutorSchemaRecoveryProviderContent(content: unknown): InternalInspection {
  if (typeof content !== 'string') {
    return failureInspection(
      'response_content',
      'unknown',
      'provider_type_validation',
      unknownSnapshot(),
    );
  }
  const parser = new BoundedJsonEnvelopeParser(content);
  try {
    return parser.parse();
  } catch (error) {
    if (error instanceof BoundedJsonEnvelopeFailure) {
      return failureInspection(error.stage, error.reasonCode, error.providerStage, error.snapshot);
    }
    return failureInspection('json_syntax', 'unknown', 'provider_json_parse', unknownSnapshot());
  }
}

class BoundedJsonEnvelopeParser {
  private index = 0;
  private nodes = 0;
  private keys = 0;
  private topLevelType: TopLevelType = 'unknown';
  private intentIndexType: IntentIndexType = 'missing';
  private extraFieldCount = 0;
  private intentIndexSeen = false;
  private aliasSeen = false;
  private intentIndexValue: number | null = null;

  constructor(private readonly content: string) {}

  parse(): InternalInspection {
    if (this.content.startsWith('\uFEFF')) {
      this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
    }
    if (Buffer.byteLength(this.content, 'utf8') > TUTOR_SCHEMA_RECOVERY_LIMITS.maxBytes) {
      this.fail('provider_envelope', 'structure_limit', 'provider_json_parse');
    }
    this.skipWhitespace();
    if (this.index >= this.content.length) {
      this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
    }
    this.topLevelType = classifyToken(this.content[this.index]);
    if (this.topLevelType !== 'object') {
      this.parseValue(1);
      this.finishDocument();
      this.fail('provider_envelope', 'top_level_not_object', 'provider_type_validation');
    }

    this.enterNode(1);
    this.parseObjectBody(1, true);
    this.finishDocument();
    if (this.aliasSeen) {
      this.fail('selection_projection', 'selection_ambiguous', 'provider_type_validation');
    }
    if (!this.intentIndexSeen) {
      this.fail('selection_projection', 'intent_index_missing', 'provider_type_validation');
    }
    if (this.intentIndexType !== 'number') {
      this.fail('selection_projection', 'intent_index_type', 'provider_type_validation');
    }
    const intentIndex = this.intentIndexValue;
    if (intentIndex === null || !Number.isSafeInteger(intentIndex)) {
      this.fail('selection_projection', 'intent_index_non_integer', 'provider_type_validation');
    }
    if (Object.is(intentIndex, -0) || intentIndex < 0 || intentIndex > 4) {
      this.fail('selection_projection', 'intent_index_out_of_range', 'provider_type_validation');
    }
    const projected = TUTOR_SCHEMA_RECOVERY_PROJECTED_DECISION_SCHEMA.safeParse({ intentIndex });
    if (!projected.success) {
      this.fail('projected_schema', 'projected_schema_invalid', 'provider_type_validation');
    }
    const snapshot = this.snapshot(
      this.extraFieldCount === 0 ? 'canonical' : 'extensions_discarded',
    );
    return deepFreezeModelValue({
      ok: true,
      decision: projected.data,
      diagnostic:
        this.extraFieldCount === 0
          ? null
          : buildDiagnostic('selection_projection', 'extension_fields_discarded', snapshot),
      snapshot,
    });
  }

  private parseValue(depth: number): ValueObservation {
    this.enterNode(depth);
    const token = this.content[this.index];
    if (token === '{') {
      this.parseObjectBody(depth, false);
      return { type: 'object' };
    }
    if (token === '[') {
      this.parseArrayBody(depth);
      return { type: 'array' };
    }
    if (token === '"') {
      this.parseString();
      return { type: 'string' };
    }
    if (token === 't') {
      this.parseLiteral('true');
      return { type: 'boolean' };
    }
    if (token === 'f') {
      this.parseLiteral('false');
      return { type: 'boolean' };
    }
    if (token === 'n') {
      this.parseLiteral('null');
      return { type: 'null' };
    }
    if (token === '-' || isDigit(token)) {
      return { type: 'number', numberValue: this.parseNumber() };
    }
    this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
  }

  private parseObjectBody(depth: number, topLevel: boolean) {
    this.expect('{');
    this.skipWhitespace();
    const seen = new Set<string>();
    if (this.consume('}')) return;
    while (true) {
      if (this.content[this.index] !== '"') {
        this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
      }
      const key = this.parseString();
      this.keys += 1;
      if (this.keys > TUTOR_SCHEMA_RECOVERY_LIMITS.maxKeys) {
        this.fail('provider_envelope', 'structure_limit', 'provider_json_parse');
      }
      if (seen.has(key)) this.fail('json_syntax', 'duplicate_key', 'provider_json_parse');
      seen.add(key);
      this.skipWhitespace();
      this.expect(':');
      this.skipWhitespace();
      const value = this.parseValue(depth + 1);
      if (topLevel) this.observeTopLevelField(key, value);
      this.skipWhitespace();
      if (this.consume('}')) return;
      this.expect(',');
      this.skipWhitespace();
    }
  }

  private parseArrayBody(depth: number) {
    this.expect('[');
    this.skipWhitespace();
    if (this.consume(']')) return;
    while (true) {
      this.parseValue(depth + 1);
      this.skipWhitespace();
      if (this.consume(']')) return;
      this.expect(',');
      this.skipWhitespace();
    }
  }

  private parseString() {
    let decoded = '';
    this.expect('"');
    while (this.index < this.content.length) {
      const character = this.content.charAt(this.index);
      if (character === '"') {
        this.index += 1;
        return decoded;
      }
      if (character.charCodeAt(0) < 0x20) {
        this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
      }
      if (character === '\\') {
        this.index += 1;
        const escape = this.content.charAt(this.index);
        if (escape === 'u') {
          const hex = this.content.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
          }
          decoded += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 5;
          continue;
        }
        switch (escape) {
          case '"':
          case '\\':
          case '/':
            decoded += escape;
            break;
          case 'b':
            decoded += '\b';
            break;
          case 'f':
            decoded += '\f';
            break;
          case 'n':
            decoded += '\n';
            break;
          case 'r':
            decoded += '\r';
            break;
          case 't':
            decoded += '\t';
            break;
          default:
            this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
        }
        this.index += 1;
        continue;
      }
      decoded += character;
      this.index += 1;
    }
    this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
  }

  private parseNumber() {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      this.content.slice(this.index),
    );
    if (!match) this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      this.fail('provider_envelope', 'structure_limit', 'provider_json_parse');
    }
    return value;
  }

  private parseLiteral(literal: 'true' | 'false' | 'null') {
    if (this.content.slice(this.index, this.index + literal.length) !== literal) {
      this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
    }
    this.index += literal.length;
  }

  private observeTopLevelField(key: string, value: ValueObservation) {
    if (key === 'intentIndex') {
      this.intentIndexSeen = true;
      this.intentIndexType = value.type;
      this.intentIndexValue =
        value.type === 'number' && typeof value.numberValue === 'number' ? value.numberValue : null;
      return;
    }
    this.extraFieldCount += 1;
    if (isForbiddenIntentAlias(key)) this.aliasSeen = true;
  }

  private finishDocument() {
    this.skipWhitespace();
    if (this.index !== this.content.length) {
      this.fail('json_syntax', 'multiple_top_level_values', 'provider_json_parse');
    }
  }

  private enterNode(depth: number) {
    this.nodes += 1;
    if (
      depth > TUTOR_SCHEMA_RECOVERY_LIMITS.maxDepth ||
      this.nodes > TUTOR_SCHEMA_RECOVERY_LIMITS.maxNodes
    ) {
      this.fail('provider_envelope', 'structure_limit', 'provider_json_parse');
    }
  }

  private snapshot(projectionDisposition: ProjectionDisposition): SafeShapeSnapshot {
    return deepFreezeModelValue({
      projectionDisposition,
      topLevelType: this.topLevelType,
      intentIndexType: this.intentIndexType,
      extraFieldCountBucket: bucketExtraFields(this.extraFieldCount),
    });
  }

  private skipWhitespace() {
    while (
      this.index < this.content.length &&
      (this.content[this.index] === ' ' ||
        this.content[this.index] === '\n' ||
        this.content[this.index] === '\r' ||
        this.content[this.index] === '\t')
    ) {
      this.index += 1;
    }
  }

  private consume(character: string) {
    if (this.content[this.index] !== character) return false;
    this.index += 1;
    return true;
  }

  private expect(character: string) {
    if (!this.consume(character)) {
      this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
    }
  }

  private fail(
    stage: Stage,
    reasonCode: ReasonCode,
    providerStage: 'provider_json_parse' | 'provider_type_validation',
  ): never {
    throw new BoundedJsonEnvelopeFailure(
      stage,
      reasonCode,
      providerStage,
      this.snapshot('rejected'),
    );
  }
}

type ValueObservation = Readonly<{
  type: IntentIndexType;
  numberValue?: number;
}>;

class BoundedJsonEnvelopeFailure extends Error {
  constructor(
    readonly stage: Stage,
    readonly reasonCode: ReasonCode,
    readonly providerStage: 'provider_json_parse' | 'provider_type_validation',
    readonly snapshot: SafeShapeSnapshot,
  ) {
    super('TUTOR_SCHEMA_RECOVERY_PROVIDER_CONTENT_REJECTED');
  }
}

function failureInspection(
  stage: Stage,
  reasonCode: ReasonCode,
  providerStage: 'provider_json_parse' | 'provider_type_validation',
  snapshot: SafeShapeSnapshot,
): InternalInspection {
  return deepFreezeModelValue({
    ok: false,
    providerStage,
    diagnostic: buildDiagnostic(stage, reasonCode, snapshot),
    snapshot,
  });
}

function buildDiagnostic(
  stage: Stage,
  reasonCode: ReasonCode,
  snapshot: SafeShapeSnapshot,
): TutorSchemaRecoveryBoundedDiagnostic {
  const boundedShape = {
    stage,
    reasonCode,
    projectionDisposition: snapshot.projectionDisposition,
    topLevelType: snapshot.topLevelType,
    intentIndexType: snapshot.intentIndexType,
    extraFieldCountBucket: snapshot.extraFieldCountBucket,
  } as const;
  const parsed = TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse({
    diagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
    ...boundedShape,
    shapeFingerprint: `sha256:${sha256Canonical(boundedShape)}`,
    rawDataRetained: false,
  });
  return parsed.success ? deepFreezeModelValue(parsed.data) : unknownDiagnostic();
}

function unknownDiagnostic(): TutorSchemaRecoveryBoundedDiagnostic {
  const shape = unknownSnapshot();
  const boundedShape = {
    stage: 'response_content' as const,
    reasonCode: 'unknown' as const,
    ...shape,
  };
  return deepFreezeModelValue({
    diagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
    ...boundedShape,
    shapeFingerprint: `sha256:${sha256Canonical(boundedShape)}`,
    rawDataRetained: false as const,
  });
}

function unknownSnapshot(): SafeShapeSnapshot {
  return deepFreezeModelValue({
    projectionDisposition: 'not_attempted' as const,
    topLevelType: 'unknown' as const,
    intentIndexType: 'unknown' as const,
    extraFieldCountBucket: '0' as const,
  });
}

function createProjectedDecisionSchema() {
  return z
    .object({
      intentIndex: z.number().int().safe().min(0).max(4),
    })
    .strict();
}

function classifyToken(token: string | undefined): TopLevelType {
  if (token === '{') return 'object';
  if (token === '[') return 'array';
  if (token === '"') return 'string';
  if (token === '-' || isDigit(token)) return 'number';
  if (token === 't' || token === 'f') return 'boolean';
  if (token === 'n') return 'null';
  return 'unknown';
}

function isForbiddenIntentAlias(key: string) {
  if (key === 'intent') return true;
  const normalized = key.replaceAll('_', '').replaceAll('-', '').toLowerCase();
  return normalized === 'intentindex';
}

function bucketExtraFields(value: number): ExtraFieldCountBucket {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 4) return '2_4';
  return '5_plus';
}

function isDigit(value: string | undefined) {
  return value !== undefined && value >= '0' && value <= '9';
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

const _boundedParserResultTypeCheck: ModelAgentBoundedJsonContentParseResult = Object.freeze({
  ok: false,
  stage: 'provider_type_validation',
});
void _boundedParserResultTypeCheck;
