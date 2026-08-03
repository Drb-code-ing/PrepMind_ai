import { describe, expect, test } from 'bun:test';

import * as TutorSchemaRecoveryPublic from '@repo/agent/tutor-schema-recovery';

import {
  TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION,
  TUTOR_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
  TUTOR_SCHEMA_RECOVERY_LIMITS,
  parseTutorSchemaRecoveryProviderContent,
  validateTutorSchemaRecoveryProjectedDecision,
} from '../src/model-candidates/tutor-schema-recovery-contract.ts';

describe('Phase 6.9.7 Tutor Schema Recovery SR1 contract', () => {
  test('freezes an independent public contract identity without changing Tutor V6', () => {
    expect(TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION).toBe(
      'phase-6.9.7-tutor-schema-recovery-contract-v1',
    );
    expect(TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256).toBe(
      TUTOR_SCHEMA_RECOVERY_FROZEN_CONTRACT_SHA256,
    );
    expect(TutorSchemaRecoveryPublic.TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256).toBe(
      TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
    );
    expect(TutorSchemaRecoveryPublic.parseTutorSchemaRecoveryProviderContent).toBe(
      parseTutorSchemaRecoveryProviderContent,
    );
  });

  test('accepts canonical JSON, whitespace, key order, escaped keys, and bounded extensions', () => {
    const canonical = [
      '{"intentIndex":0}',
      ' \r\n { "intentIndex" : 1 } \t ',
      '{"\\u0069ntentIndex":2}',
      '{"note":{"safe":[true,null,"值"]},"intentIndex":3}',
    ];
    for (const [index, content] of canonical.entries()) {
      const parsed = parseTutorSchemaRecoveryProviderContent(content);
      expect(parsed.ok, content).toBe(true);
      if (!parsed.ok) throw new Error(parsed.diagnostic.reasonCode);
      expect(parsed.decision).toEqual({ intentIndex: index });
      expect(Object.isFrozen(parsed.decision)).toBe(true);
      if (index < 3) {
        expect(parsed.diagnostic).toBeNull();
      } else {
        expect(parsed.diagnostic).toMatchObject({
          stage: 'selection_projection',
          reasonCode: 'extension_fields_discarded',
          projectionDisposition: 'extensions_discarded',
          topLevelType: 'object',
          intentIndexType: 'number',
          extraFieldCountBucket: '1',
          rawDataRetained: false,
        });
      }
    }
  });

  test('rejects syntax, top-level, missing, alias, type, integer, and range drift without coercion', () => {
    const cases = [
      ['not-json', 'malformed_json', 'provider_json_parse'],
      ['```json\\n{"intentIndex":0}\\n```', 'malformed_json', 'provider_json_parse'],
      ['﻿{"intentIndex":0}', 'malformed_json', 'provider_json_parse'],
      ['{"intentIndex":0} trailing', 'multiple_top_level_values', 'provider_json_parse'],
      ['{"intentIndex":0}{"intentIndex":1}', 'multiple_top_level_values', 'provider_json_parse'],
      ['[]', 'top_level_not_object', 'provider_type_validation'],
      ['null', 'top_level_not_object', 'provider_type_validation'],
      ['"object"', 'top_level_not_object', 'provider_type_validation'],
      ['{}', 'intent_index_missing', 'provider_type_validation'],
      ['{"decision":{"intentIndex":0}}', 'intent_index_missing', 'provider_type_validation'],
      ['{"intent_index":0}', 'selection_ambiguous', 'provider_type_validation'],
      ['{"intentIndex":0,"IntentIndex":1}', 'selection_ambiguous', 'provider_type_validation'],
      ['{"intentIndex":"0"}', 'intent_index_type', 'provider_type_validation'],
      ['{"intentIndex":null}', 'intent_index_type', 'provider_type_validation'],
      ['{"intentIndex":true}', 'intent_index_type', 'provider_type_validation'],
      ['{"intentIndex":1.5}', 'intent_index_non_integer', 'provider_type_validation'],
      ['{"intentIndex":-0}', 'intent_index_out_of_range', 'provider_type_validation'],
      ['{"intentIndex":5}', 'intent_index_out_of_range', 'provider_type_validation'],
    ] as const;
    for (const [content, reasonCode, providerStage] of cases) {
      const parsed = parseTutorSchemaRecoveryProviderContent(content);
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
      '{"intentIndex":0,"intentIndex":1}',
      '{"intentIndex":0,"\\u0069ntentIndex":1}',
      '{"intentIndex":0,"meta":{"a":1,"a":2}}',
    ]) {
      const parsed = parseTutorSchemaRecoveryProviderContent(content);
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

  test('enforces byte, depth, node, and key limits before projection', () => {
    const overBytes = `{"intentIndex":0,"x":"${'值'.repeat(TUTOR_SCHEMA_RECOVERY_LIMITS.maxBytes)}"}`;
    const overDepth = `{"intentIndex":0,"x":${'['.repeat(
      TUTOR_SCHEMA_RECOVERY_LIMITS.maxDepth + 1,
    )}0${']'.repeat(TUTOR_SCHEMA_RECOVERY_LIMITS.maxDepth + 1)}}`;
    const overNodes = `{"intentIndex":0,"x":[${Array.from(
      { length: TUTOR_SCHEMA_RECOVERY_LIMITS.maxNodes + 1 },
      () => '0',
    ).join(',')}]}`;
    const overKeys = `{${[
      '"intentIndex":0',
      ...Array.from(
        { length: TUTOR_SCHEMA_RECOVERY_LIMITS.maxKeys + 1 },
        (_, index) => `"k${index}":0`,
      ),
    ].join(',')}}`;
    for (const content of [overBytes, overDepth, overNodes, overKeys]) {
      const parsed = parseTutorSchemaRecoveryProviderContent(content);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error('limit unexpectedly passed');
      expect(parsed.diagnostic.reasonCode).toBe('structure_limit');
      expect(parsed.diagnostic.rawDataRetained).toBe(false);
    }
  });

  test('fingerprints only bounded shape enums and never raw extension values or keys', () => {
    const first = parseTutorSchemaRecoveryProviderContent(
      '{"intentIndex":0,"privateNote":"raw-secret-alpha"}',
    );
    const second = parseTutorSchemaRecoveryProviderContent(
      '{"intentIndex":0,"differentKey":"raw-secret-beta"}',
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
        'intentIndexType',
        'projectionDisposition',
        'rawDataRetained',
        'reasonCode',
        'shapeFingerprint',
        'stage',
        'topLevelType',
      ].sort(),
    );
    expect(
      TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.safeParse(first.diagnostic).success,
    ).toBe(true);
  });

  test('rejects hostile or already-parsed projected decisions without executing accessors', () => {
    let reads = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'intentIndex', {
      get() {
        reads += 1;
        throw new Error('hostile getter');
      },
    });
    expect(validateTutorSchemaRecoveryProjectedDecision(hostile)).toEqual({
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
    expect(validateTutorSchemaRecoveryProjectedDecision(proxy)).toEqual({
      ok: false,
      reasonCode: 'projected_schema_invalid',
    });
    expect(reads).toBe(1);
    expect(parseTutorSchemaRecoveryProviderContent(hostile)).toMatchObject({
      ok: false,
      diagnostic: { stage: 'response_content', rawDataRetained: false },
    });
    expect(reads).toBe(1);
  });
});
