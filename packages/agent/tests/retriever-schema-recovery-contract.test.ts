import { describe, expect, test } from 'bun:test';

import {
  parseModelAgentJsonContentWithPolicy,
  requiresModelAgentStrictJsonContent,
} from '../../ai/src/model-agent-structured-output-policy.ts';
import * as RetrieverSchemaRecoveryPublic from '@repo/agent/retriever-schema-recovery';

import {
  RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256,
  RETRIEVER_SCHEMA_RECOVERY_CONTRACT_VERSION,
  RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
  RETRIEVER_SCHEMA_RECOVERY_LIMITS,
  RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA,
  createRetrieverSchemaRecoveryDiagnosticCollector,
  parseRetrieverSchemaRecoveryProviderContent,
  validateRetrieverSchemaRecoveryProjectedRewrite,
} from '../src/model-candidates/retriever-schema-recovery-contract.ts';
import { RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA } from '../src/model-candidates/retriever-query-rewrite-model-candidate.ts';

describe('Phase 6.9.8 Retriever Schema Recovery SR1 contract', () => {
  test('freezes an independent schema identity and exposes the package subpath', () => {
    expect(RETRIEVER_SCHEMA_RECOVERY_CONTRACT_VERSION).toBe(
      'phase-6.9.8-retriever-schema-recovery-contract-v1',
    );
    expect(RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION).toBe(
      'phase-6.9.8-retriever-schema-diagnostic-v1',
    );
    expect(RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256).toBe(
      RETRIEVER_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
    );
    expect(RetrieverSchemaRecoveryPublic.RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256).toBe(
      RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256,
    );
    expect(RetrieverSchemaRecoveryPublic.parseRetrieverSchemaRecoveryProviderContent).toBe(
      parseRetrieverSchemaRecoveryProviderContent,
    );
    expect(RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA).not.toBe(
      RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA,
    );
    expect(requiresModelAgentStrictJsonContent(RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA)).toBe(
      true,
    );
  });

  test('accepts canonical JSON, key order, whitespace, escapes, and bounded extensions', () => {
    const cases = [
      ['{"rewrittenQuery":"独立检索问题"}', '独立检索问题', null],
      [' \r\n { "rewrittenQuery" : "Why does it converge?" } \t ', 'Why does it converge?', null],
      ['{"\\u0072ewrittenQuery":"escaped key"}', 'escaped key', null],
      [
        '{"privateNote":{"safe":[true,null,"秘密"]},"rewrittenQuery":"bounded extension"}',
        'bounded extension',
        'extension_fields_discarded',
      ],
    ] as const;
    for (const [content, expected, reasonCode] of cases) {
      const parsed = parseRetrieverSchemaRecoveryProviderContent(content);
      expect(parsed.ok, content).toBe(true);
      if (!parsed.ok) throw new Error(content);
      expect(parsed.value).toEqual({ rewrittenQuery: expected });
      expect(Object.isFrozen(parsed.value)).toBe(true);
      if (reasonCode === null) {
        expect(parsed.diagnostic).toBeNull();
      } else {
        expect(parsed.diagnostic).toMatchObject({
          stage: 'rewrite_projection',
          reasonCode,
          projectionDisposition: 'extensions_discarded',
          topLevelType: 'object',
          rewrittenQueryType: 'string',
          extraFieldCountBucket: '1',
          rawDataRetained: false,
        });
      }
    }
  });

  test('rejects syntax, wrappers, top-level drift, missing fields, aliases, types, and empty values', () => {
    const cases = [
      ['not-json', 'malformed_json', 'provider_json_parse'],
      ['```json\n{"rewrittenQuery":"x"}\n```', 'malformed_json', 'provider_json_parse'],
      ['﻿{"rewrittenQuery":"x"}', 'malformed_json', 'provider_json_parse'],
      ['{"rewrittenQuery":"x"} trailing', 'multiple_top_level_values', 'provider_json_parse'],
      [
        '{"rewrittenQuery":"x"}{"rewrittenQuery":"y"}',
        'multiple_top_level_values',
        'provider_json_parse',
      ],
      ['[]', 'top_level_not_object', 'provider_type_validation'],
      ['null', 'top_level_not_object', 'provider_type_validation'],
      ['"object"', 'top_level_not_object', 'provider_type_validation'],
      ['{"other":"x"}', 'rewritten_query_missing', 'provider_type_validation'],
      ['{"query":"x"}', 'rewritten_query_alias_ambiguous', 'provider_type_validation'],
      [
        '{"rewritten_query":"x","rewrittenQuery":"y"}',
        'rewritten_query_alias_ambiguous',
        'provider_type_validation',
      ],
      ['{"rewrittenQuery":0}', 'rewritten_query_type', 'provider_type_validation'],
      ['{"rewrittenQuery":null}', 'rewritten_query_type', 'provider_type_validation'],
      ['{"rewrittenQuery":[]}', 'rewritten_query_type', 'provider_type_validation'],
      ['{"rewrittenQuery":""}', 'rewrite_empty', 'provider_type_validation'],
      ['{"rewrittenQuery":"x" ,}', 'malformed_json', 'provider_json_parse'],
    ] as const;
    for (const [content, reasonCode, providerStage] of cases) {
      const parsed = parseRetrieverSchemaRecoveryProviderContent(content);
      expect(parsed.ok, content).toBe(false);
      if (parsed.ok) throw new Error(content);
      expect(parsed.providerStage, content).toBe(providerStage);
      expect(parsed.diagnostic.reasonCode, content).toBe(reasonCode);
      expect(parsed.diagnostic.projectionDisposition, content).toBe('rejected');
      expect(parsed.diagnostic.rawDataRetained, content).toBe(false);
    }
  });

  test('rejects duplicate keys before JSON.parse, including escaped and nested duplicates', () => {
    for (const content of [
      '{"rewrittenQuery":"x","rewrittenQuery":"y"}',
      '{"rewrittenQuery":"x","\\u0072ewrittenQuery":"y"}',
      '{"rewrittenQuery":"x","meta":{"a":1,"a":2}}',
    ]) {
      const parsed = parseRetrieverSchemaRecoveryProviderContent(content);
      expect(parsed.ok, content).toBe(false);
      if (parsed.ok) throw new Error(content);
      expect(parsed.providerStage).toBe('provider_json_parse');
      expect(parsed.diagnostic).toMatchObject({
        stage: 'json_syntax',
        reasonCode: 'duplicate_key',
        rawDataRetained: false,
      });
    }
  });

  test('enforces byte, depth, node, key, UTF-16, and structural limits before projection', () => {
    const overBytes = `{"rewrittenQuery":"${'值'.repeat(RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxBytes)}"}`;
    const overDepth = `{"rewrittenQuery":"x","meta":${'['.repeat(
      RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxDepth + 1,
    )}0${']'.repeat(RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxDepth + 1)}}`;
    const overNodes = `{"rewrittenQuery":"x","meta":[${Array.from(
      { length: RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxNodes + 1 },
      () => '0',
    ).join(',')}]}`;
    const overKeys = `{${[
      '"rewrittenQuery":"x"',
      ...Array.from(
        { length: RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxKeys + 1 },
        (_, index) => `"k${index}":0`,
      ),
    ].join(',')}}`;
    const overUtf16 = `{"rewrittenQuery":"${'改'.repeat(
      RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxRewrittenQueryUtf16CodeUnits + 1,
    )}"}`;
    for (const content of [overBytes, overDepth, overNodes, overKeys, overUtf16]) {
      const parsed = parseRetrieverSchemaRecoveryProviderContent(content);
      expect(parsed.ok, content.slice(0, 80)).toBe(false);
      if (parsed.ok) throw new Error('limit unexpectedly passed');
      expect(['content_limit', 'structure_limit', 'projected_schema_invalid']).toContain(
        parsed.diagnostic.reasonCode,
      );
      expect(parsed.diagnostic.rawDataRetained).toBe(false);
    }
    const loneSurrogate = parseRetrieverSchemaRecoveryProviderContent(
      '{"rewrittenQuery":"\\ud800"}',
    );
    expect(loneSurrogate.ok).toBe(false);
    if (!loneSurrogate.ok) expect(loneSurrogate.diagnostic.reasonCode).toBe('malformed_json');
  });

  test('fingerprints only bounded shape enums and never extension keys or values', () => {
    const first = parseRetrieverSchemaRecoveryProviderContent(
      '{"rewrittenQuery":"x","privateNote":"raw-secret-alpha"}',
    );
    const second = parseRetrieverSchemaRecoveryProviderContent(
      '{"rewrittenQuery":"x","differentKey":"raw-secret-beta"}',
    );
    if (!first.ok || !second.ok || !first.diagnostic || !second.diagnostic) {
      throw new Error('expected extension diagnostics');
    }
    expect(first.diagnostic.shapeFingerprint).toBe(second.diagnostic.shapeFingerprint);
    const serialized = JSON.stringify(first.diagnostic);
    for (const forbidden of [
      'privateNote',
      'differentKey',
      'raw-secret-alpha',
      'raw-secret-beta',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(first.diagnostic).sort()).toEqual(
      [
        'diagnosticVersion',
        'extraFieldCountBucket',
        'projectionDisposition',
        'rawDataRetained',
        'reasonCode',
        'rewrittenQueryType',
        'shapeFingerprint',
        'stage',
        'topLevelType',
      ].sort(),
    );
    expect(
      RETRIEVER_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse(first.diagnostic).success,
    ).toBe(true);
  });

  test('validates projected data without invoking getters and copies provider objects', () => {
    let reads = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'rewrittenQuery', {
      get() {
        reads += 1;
        throw new Error('hostile getter');
      },
    });
    expect(validateRetrieverSchemaRecoveryProjectedRewrite(hostile)).toEqual({
      ok: false,
      reasonCode: 'projected_schema_invalid',
    });
    expect(reads).toBe(0);

    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          reads += 1;
          throw new Error('hostile proxy');
        },
      },
    );
    expect(validateRetrieverSchemaRecoveryProjectedRewrite(proxy)).toEqual({
      ok: false,
      reasonCode: 'projected_schema_invalid',
    });
    expect(reads).toBe(1);

    const provider = { rewrittenQuery: 'copied' };
    const parsed = parseRetrieverSchemaRecoveryProviderContent(JSON.stringify(provider));
    if (!parsed.ok) throw new Error('expected valid projection');
    expect(parsed.value).not.toBe(provider);
    expect(Object.isFrozen(parsed.value)).toBe(true);
    expect(Reflect.set(parsed.value, 'rewrittenQuery', 'mutated')).toBe(false);
  });

  test('binds the exact schema to the first-party raw-content policy and collector stays bounded', () => {
    expect(
      parseModelAgentJsonContentWithPolicy(
        RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA,
        '{"rewrittenQuery":"policy path"}',
      ),
    ).toEqual({
      handled: true,
      result: { ok: true, value: { rewrittenQuery: 'policy path' } },
    });
    expect(
      parseModelAgentJsonContentWithPolicy(
        RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA,
        '```json\n{"rewrittenQuery":"must reject"}\n```',
      ),
    ).toEqual({
      handled: true,
      result: { ok: false, stage: 'provider_json_parse' },
    });

    const collector = createRetrieverSchemaRecoveryDiagnosticCollector();
    expect(collector.schema).not.toBe(RETRIEVER_SCHEMA_RECOVERY_PROJECTED_SCHEMA);
    expect(
      parseModelAgentJsonContentWithPolicy(
        collector.schema,
        '{"rewrittenQuery":"x","extension-key-that-was-discarded":1}',
      ),
    ).toEqual({
      handled: true,
      result: { ok: true, value: { rewrittenQuery: 'x' } },
    });
    expect(collector.read()).toMatchObject({
      stage: 'rewrite_projection',
      reasonCode: 'extension_fields_discarded',
      rawDataRetained: false,
    });
    collector.recordApplied();
    expect(collector.read()).toMatchObject({ stage: 'applied', rawDataRetained: false });
    const serialized = JSON.stringify(collector.read());
    expect(serialized).not.toContain('extension-key-that-was-discarded');
  });

  test('records usage failures as bounded enums without retaining provider details', () => {
    const collector = createRetrieverSchemaRecoveryDiagnosticCollector();
    collector.recordUsageFailure();
    expect(collector.read()).toMatchObject({
      stage: 'usage',
      reasonCode: 'usage_invalid',
      projectionDisposition: 'not_attempted',
      rawDataRetained: false,
    });
    const before = JSON.stringify(collector.read());
    collector.recordApplied();
    expect(JSON.stringify(collector.read())).toBe(before);
    expect(Object.isFrozen(collector.read())).toBe(true);
  });
});
