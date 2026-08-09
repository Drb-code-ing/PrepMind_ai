import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  requireModelAgentBoundedJsonContentParser,
  type ModelAgentBoundedJsonContentParseResult,
} from '@repo/ai';

import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';

/**
 * The Retriever schema-recovery contract is deliberately independent from the
 * older P1/L2 and Transport Evidence lineages.  It is a parser capability, not
 * a quality or product authority.
 */
export const RETRIEVER_SCHEMA_RECOVERY_CONTRACT_VERSION =
  'phase-6.9.8-retriever-schema-recovery-contract-v1' as const;
export const RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION =
  'phase-6.9.8-retriever-schema-diagnostic-v1' as const;

export const RETRIEVER_SCHEMA_RECOVERY_LIMITS = deepFreezeModelValue({
  maxBytes: 8_192,
  maxDepth: 8,
  maxNodes: 128,
  maxKeys: 64,
  maxRewrittenQueryUtf16CodeUnits: 2_000,
});

export const RETRIEVER_SCHEMA_RECOVERY_STAGES = [
  'response_content',
  'json_syntax',
  'provider_envelope',
  'rewrite_projection',
  'projected_schema',
  'local_safety',
  'local_authority',
  'usage',
  'applied',
] as const;

export const RETRIEVER_SCHEMA_RECOVERY_REASON_CODES = [
  'content_missing',
  'content_limit',
  'malformed_json',
  'multiple_top_level_values',
  'duplicate_key',
  'structure_limit',
  'top_level_not_object',
  'rewritten_query_missing',
  'rewritten_query_alias_ambiguous',
  'rewritten_query_type',
  'projected_schema_invalid',
  'extension_fields_discarded',
  'rewrite_empty',
  'rewrite_safety_invalid',
  'rewrite_unchanged',
  'protected_terms_drift',
  'usage_invalid',
  'unknown',
] as const;

export const RETRIEVER_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS = [
  'not_attempted',
  'canonical',
  'extensions_discarded',
  'rejected',
] as const;

export const RETRIEVER_SCHEMA_RECOVERY_TOP_LEVEL_TYPES = [
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
  'unknown',
] as const;

export const RETRIEVER_SCHEMA_RECOVERY_REWRITTEN_QUERY_TYPES = [
  'missing',
  'object',
  'array',
  'string',
  'number',
  'boolean',
  'null',
  'unknown',
] as const;

export const RETRIEVER_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS = [
  '0',
  '1',
  '2_4',
  '5_plus',
] as const;

/** Exact, module-owned projected schema identity used by first-party adapters. */
export const RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA = z
  .object({
    rewrittenQuery: z
      .string()
      .min(1)
      .max(RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxRewrittenQueryUtf16CodeUnits),
  })
  .strict();

export const RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA = z
  .object({
    diagnosticVersion: z.literal(RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION),
    stage: z.enum(RETRIEVER_SCHEMA_RECOVERY_STAGES),
    reasonCode: z.enum(RETRIEVER_SCHEMA_RECOVERY_REASON_CODES),
    projectionDisposition: z.enum(RETRIEVER_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS),
    topLevelType: z.enum(RETRIEVER_SCHEMA_RECOVERY_TOP_LEVEL_TYPES),
    rewrittenQueryType: z.enum(RETRIEVER_SCHEMA_RECOVERY_REWRITTEN_QUERY_TYPES),
    extraFieldCountBucket: z.enum(RETRIEVER_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS),
    shapeFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    rawDataRetained: z.literal(false),
  })
  .strict();

export type RetrieverSchemaRecoveryProjectedRewrite = z.infer<
  typeof RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA
>;
export type RetrieverSchemaRecoveryBoundedDiagnostic = z.infer<
  typeof RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA
>;

export type RetrieverSchemaRecoveryProviderContentResult =
  | Readonly<{
      ok: true;
      value: RetrieverSchemaRecoveryProjectedRewrite;
      diagnostic: RetrieverSchemaRecoveryBoundedDiagnostic | null;
    }>
  | Readonly<{
      ok: false;
      providerStage: 'provider_json_parse' | 'provider_type_validation';
      diagnostic: RetrieverSchemaRecoveryBoundedDiagnostic;
    }>;

export type RetrieverSchemaRecoveryProjectedRewriteValidationResult =
  | Readonly<{ ok: true; value: RetrieverSchemaRecoveryProjectedRewrite }>
  | Readonly<{ ok: false; reasonCode: 'projected_schema_invalid' }>;

export type RetrieverSchemaRecoveryDiagnosticCollector = Readonly<{
  schema: z.ZodType<RetrieverSchemaRecoveryProjectedRewrite>;
  recordProjectedSchemaFailure(): void;
  recordProviderJsonParseFailure(): void;
  recordProviderObjectMissingFailure(): void;
  recordLocalSafetyFailure(): void;
  recordRewriteUnchanged(): void;
  recordProtectedTermsDrift(): void;
  recordLocalAuthorityFailure(): void;
  recordUsageFailure(): void;
  recordApplied(): void;
  recordUnknownFailure(): void;
  read(): RetrieverSchemaRecoveryBoundedDiagnostic | null;
}>;

type Stage = (typeof RETRIEVER_SCHEMA_RECOVERY_STAGES)[number];
type ReasonCode = (typeof RETRIEVER_SCHEMA_RECOVERY_REASON_CODES)[number];
type ProjectionDisposition = (typeof RETRIEVER_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS)[number];
type TopLevelType = (typeof RETRIEVER_SCHEMA_RECOVERY_TOP_LEVEL_TYPES)[number];
type RewrittenQueryType = (typeof RETRIEVER_SCHEMA_RECOVERY_REWRITTEN_QUERY_TYPES)[number];
type ExtraFieldCountBucket = (typeof RETRIEVER_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS)[number];

type SafeShapeSnapshot = Readonly<{
  projectionDisposition: ProjectionDisposition;
  topLevelType: TopLevelType;
  rewrittenQueryType: RewrittenQueryType;
  extraFieldCountBucket: ExtraFieldCountBucket;
}>;

type InternalInspection =
  | Readonly<{
      ok: true;
      value: RetrieverSchemaRecoveryProjectedRewrite;
      diagnostic: RetrieverSchemaRecoveryBoundedDiagnostic | null;
      snapshot: SafeShapeSnapshot;
    }>
  | Readonly<{
      ok: false;
      providerStage: 'provider_json_parse' | 'provider_type_validation';
      diagnostic: RetrieverSchemaRecoveryBoundedDiagnostic;
      snapshot: SafeShapeSnapshot;
    }>;

const CONTRACT_SOURCE = deepFreezeModelValue({
  version: RETRIEVER_SCHEMA_RECOVERY_CONTRACT_VERSION,
  diagnosticVersion: RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  limits: RETRIEVER_SCHEMA_RECOVERY_LIMITS,
  stages: RETRIEVER_SCHEMA_RECOVERY_STAGES,
  reasonCodes: RETRIEVER_SCHEMA_RECOVERY_REASON_CODES,
  projectionDispositions: RETRIEVER_SCHEMA_RECOVERY_PROJECTION_DISPOSITIONS,
  topLevelTypes: RETRIEVER_SCHEMA_RECOVERY_TOP_LEVEL_TYPES,
  rewrittenQueryTypes: RETRIEVER_SCHEMA_RECOVERY_REWRITTEN_QUERY_TYPES,
  extraFieldCountBuckets: RETRIEVER_SCHEMA_RECOVERY_EXTRA_FIELD_COUNT_BUCKETS,
  projectedFields: ['rewrittenQuery'],
  parserRules: [
    'single_native_json_object',
    'duplicate_keys_rejected_before_json_parse',
    'canonical_ascii_case_sensitive_rewritten_query_only',
    'unknown_extensions_discarded_after_bounded_audit',
    'no_coercion_default_clamp_retry',
    'diagnostic_hashes_enums_only',
    'raw_data_retained_false',
  ],
});

export const RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256 = sha256Canonical(CONTRACT_SOURCE);
// Kept as a named parity value so later runner stages can pin the contract in a manifest.
export const RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256 =
  '4248db580e60ccf4b851d46ab692c867b04ba23c4bdb4b86e64bcb3b99fecf4e' as const;

if (
  RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256 !== RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256
) {
  throw new Error('RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA_MISMATCH');
}

/**
 * Parse the adapter's raw completion content without ever exposing the raw
 * value in a returned diagnostic.  This is intentionally independent of the
 * generic runtime-result sanitizer, which only sees a post-adapter object.
 */
export function parseRetrieverSchemaRecoveryProviderContent(
  content: unknown,
): RetrieverSchemaRecoveryProviderContentResult {
  const inspected = inspectRetrieverSchemaRecoveryProviderContent(content);
  return inspected.ok
    ? deepFreezeModelValue({
        ok: true,
        value: inspected.value,
        diagnostic: inspected.diagnostic,
      })
    : deepFreezeModelValue({
        ok: false,
        providerStage: inspected.providerStage,
        diagnostic: inspected.diagnostic,
      });
}

export function validateRetrieverSchemaRecoveryProjectedRewrite(
  value: unknown,
): RetrieverSchemaRecoveryProjectedRewriteValidationResult {
  try {
    const cloned = clonePlainModelData(value);
    if (!cloned.ok) return { ok: false, reasonCode: 'projected_schema_invalid' };
    const parsed = RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA.safeParse(cloned.value);
    return parsed.success
      ? deepFreezeModelValue({ ok: true, value: parsed.data })
      : ({ ok: false, reasonCode: 'projected_schema_invalid' } as const);
  } catch {
    return { ok: false, reasonCode: 'projected_schema_invalid' };
  }
}

/**
 * A local collector is used by later candidate/runner stages.  It never stores
 * a provider object; only the last bounded enum/bucket diagnostic is retained.
 */
export function createRetrieverSchemaRecoveryDiagnosticCollector(): RetrieverSchemaRecoveryDiagnosticCollector {
  let diagnostic: RetrieverSchemaRecoveryBoundedDiagnostic | null = null;
  let snapshot: SafeShapeSnapshot = unknownSnapshot();
  let parserFailed = false;
  const schema = createProjectedSchema();

  requireModelAgentBoundedJsonContentParser(schema, (content) => {
    const inspected = inspectRetrieverSchemaRecoveryProviderContent(content);
    snapshot = inspected.snapshot;
    diagnostic = inspected.diagnostic;
    parserFailed = !inspected.ok;
    return inspected.ok
      ? ({ ok: true, value: inspected.value } as const)
      : ({ ok: false, stage: inspected.providerStage } as const);
  });

  const record = (stage: Stage, reasonCode: ReasonCode) => {
    if (parserFailed) return;
    diagnostic = buildDiagnostic(stage, reasonCode, snapshot);
  };

  return Object.freeze({
    schema,
    recordProjectedSchemaFailure: () => record('projected_schema', 'projected_schema_invalid'),
    recordProviderJsonParseFailure: () => record('json_syntax', 'malformed_json'),
    recordProviderObjectMissingFailure: () => record('provider_envelope', 'content_missing'),
    recordLocalSafetyFailure: () => record('local_safety', 'rewrite_safety_invalid'),
    recordRewriteUnchanged: () => record('local_authority', 'rewrite_unchanged'),
    recordProtectedTermsDrift: () => record('local_authority', 'protected_terms_drift'),
    recordLocalAuthorityFailure: () => record('local_authority', 'unknown'),
    recordUsageFailure: () => record('usage', 'usage_invalid'),
    recordApplied() {
      if (parserFailed || diagnostic?.reasonCode !== 'extension_fields_discarded') return;
      diagnostic = buildDiagnostic('applied', 'extension_fields_discarded', snapshot);
    },
    recordUnknownFailure: () => record('projected_schema', 'unknown'),
    read: () => diagnostic,
  });
}

function createProjectedSchema() {
  return z
    .object({
      rewrittenQuery: z
        .string()
        .min(1)
        .max(RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxRewrittenQueryUtf16CodeUnits),
    })
    .strict();
}

function inspectRetrieverSchemaRecoveryProviderContent(content: unknown): InternalInspection {
  if (typeof content !== 'string' || content.length === 0) {
    return failureInspection(
      'response_content',
      'content_missing',
      'provider_type_validation',
      unknownSnapshot(),
    );
  }
  if (!hasWellFormedUtf16(content)) {
    return failureInspection(
      'response_content',
      'malformed_json',
      'provider_json_parse',
      unknownSnapshot(),
    );
  }
  if (Buffer.byteLength(content, 'utf8') > RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxBytes) {
    return failureInspection(
      'response_content',
      'content_limit',
      'provider_json_parse',
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
  private rewrittenQueryType: RewrittenQueryType = 'missing';
  private extraFieldCount = 0;
  private rewrittenQuerySeen = false;
  private aliasSeen = false;
  private rewrittenQueryValue: string | null = null;

  constructor(private readonly content: string) {}

  parse(): InternalInspection {
    if (this.content.startsWith('\uFEFF')) {
      this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
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
      this.fail(
        'rewrite_projection',
        'rewritten_query_alias_ambiguous',
        'provider_type_validation',
      );
    }
    if (!this.rewrittenQuerySeen) {
      this.fail('rewrite_projection', 'rewritten_query_missing', 'provider_type_validation');
    }
    if (this.rewrittenQueryType !== 'string') {
      this.fail('rewrite_projection', 'rewritten_query_type', 'provider_type_validation');
    }
    const rewrittenQuery = this.rewrittenQueryValue;
    if (rewrittenQuery === null) {
      this.fail('projected_schema', 'projected_schema_invalid', 'provider_type_validation');
    }
    if (rewrittenQuery.length === 0) {
      this.fail('projected_schema', 'rewrite_empty', 'provider_type_validation');
    }
    if (rewrittenQuery.length > RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxRewrittenQueryUtf16CodeUnits) {
      this.fail('projected_schema', 'projected_schema_invalid', 'provider_type_validation');
    }

    // Construct a new object and validate it; never return a Provider-owned object.
    const projected = RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA.safeParse({ rewrittenQuery });
    if (!projected.success) {
      this.fail('projected_schema', 'projected_schema_invalid', 'provider_type_validation');
    }

    const disposition: ProjectionDisposition =
      this.extraFieldCount === 0 ? 'canonical' : 'extensions_discarded';
    const snapshot = this.snapshot(disposition);
    return deepFreezeModelValue({
      ok: true,
      value: projected.data,
      diagnostic:
        this.extraFieldCount === 0
          ? null
          : buildDiagnostic('rewrite_projection', 'extension_fields_discarded', snapshot),
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
      const stringValue = this.parseString();
      return { type: 'string', stringValue };
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
      if (this.keys > RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxKeys) {
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

  private parseString(): string {
    let decoded = '';
    this.expect('"');
    while (this.index < this.content.length) {
      const character = this.content.charAt(this.index);
      if (character === '"') {
        this.index += 1;
        if (!hasWellFormedUtf16(decoded)) {
          this.fail('json_syntax', 'malformed_json', 'provider_json_parse');
        }
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
          if (!/^[0-9a-fA-F]{4}$/u.test(hex)) {
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

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(
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
    if (key === 'rewrittenQuery') {
      this.rewrittenQuerySeen = true;
      this.rewrittenQueryType = value.type;
      this.rewrittenQueryValue = value.type === 'string' ? (value.stringValue ?? null) : null;
      return;
    }
    this.extraFieldCount += 1;
    if (isForbiddenRewriteAlias(key)) this.aliasSeen = true;
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
      depth > RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxDepth ||
      this.nodes > RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxNodes
    ) {
      this.fail('provider_envelope', 'structure_limit', 'provider_json_parse');
    }
  }

  private snapshot(projectionDisposition: ProjectionDisposition): SafeShapeSnapshot {
    return deepFreezeModelValue({
      projectionDisposition,
      topLevelType: this.topLevelType,
      rewrittenQueryType: this.rewrittenQueryType,
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
  type: RewrittenQueryType;
  stringValue?: string;
  numberValue?: number;
}>;

class BoundedJsonEnvelopeFailure extends Error {
  constructor(
    readonly stage: Stage,
    readonly reasonCode: ReasonCode,
    readonly providerStage: 'provider_json_parse' | 'provider_type_validation',
    readonly snapshot: SafeShapeSnapshot,
  ) {
    super('RETRIEVER_SCHEMA_RECOVERY_PROVIDER_CONTENT_REJECTED');
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
): RetrieverSchemaRecoveryBoundedDiagnostic {
  const boundedShape = {
    stage,
    reasonCode,
    projectionDisposition: snapshot.projectionDisposition,
    topLevelType: snapshot.topLevelType,
    rewrittenQueryType: snapshot.rewrittenQueryType,
    extraFieldCountBucket: snapshot.extraFieldCountBucket,
  } as const;
  const parsed = RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse({
    diagnosticVersion: RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
    ...boundedShape,
    shapeFingerprint: `sha256:${sha256Canonical(boundedShape)}`,
    rawDataRetained: false,
  });
  return parsed.success ? deepFreezeModelValue(parsed.data) : unknownDiagnostic();
}

function unknownDiagnostic(): RetrieverSchemaRecoveryBoundedDiagnostic {
  const shape = unknownSnapshot();
  const boundedShape = {
    stage: 'response_content' as const,
    reasonCode: 'unknown' as const,
    ...shape,
  };
  return deepFreezeModelValue({
    diagnosticVersion: RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
    ...boundedShape,
    shapeFingerprint: `sha256:${sha256Canonical(boundedShape)}`,
    rawDataRetained: false as const,
  });
}

function unknownSnapshot(): SafeShapeSnapshot {
  return deepFreezeModelValue({
    projectionDisposition: 'not_attempted' as const,
    topLevelType: 'unknown' as const,
    rewrittenQueryType: 'unknown' as const,
    extraFieldCountBucket: '0' as const,
  });
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

function isForbiddenRewriteAlias(key: string): boolean {
  if (key === 'rewritten_query' || key === 'rewritten-query') return true;
  if (key === 'query' || key === 'rewrite' || key === 'rewritten') return true;
  if (key === 'RewrittenQuery' || key === 'REWRITTENQUERY') return true;
  return key.replaceAll('_', '').replaceAll('-', '').toLowerCase() === 'rewrittenquery';
}

function bucketExtraFields(value: number): ExtraFieldCountBucket {
  if (value <= 0) return '0';
  if (value === 1) return '1';
  if (value <= 4) return '2_4';
  return '5_plus';
}

function isDigit(value: string | undefined): boolean {
  return value !== undefined && value >= '0' && value <= '9';
}

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

function sha256Canonical(value: unknown): string {
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

// Compile-time shape check for the opaque adapter seam.
const _boundedParserResultTypeCheck: ModelAgentBoundedJsonContentParseResult = Object.freeze({
  ok: false,
  stage: 'provider_type_validation',
});
void _boundedParserResultTypeCheck;

// Bind the parser to this exact schema identity.  The capability is private to
// this module and cannot be supplied by a caller or another package.
requireModelAgentBoundedJsonContentParser(RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA, (content) => {
  const inspected = inspectRetrieverSchemaRecoveryProviderContent(content);
  return inspected.ok
    ? ({ ok: true, value: inspected.value } as const)
    : ({ ok: false, stage: inspected.providerStage } as const);
});
