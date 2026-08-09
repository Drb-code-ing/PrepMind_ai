import { describe, expect, test } from 'bun:test';

import {
  parseRetrieverSchemaRecoveryProviderContent,
  RETRIEVER_SCHEMA_RECOVERY_LIMITS,
} from '../src/model-candidates/retriever-schema-recovery-contract.ts';
import { runRetrieverQueryRewriteModelCandidateV1 } from '../src/model-candidates/retriever-query-rewrite-model-candidate.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES,
} from './fixtures/phase-6-9-8-retriever-schema-recovery-sr2-robustness-v1.ts';
import {
  createRetrieverSr2AuthenticatedContext,
  createRetrieverSr2Request,
  createRetrieverSr2TrackedRuntime,
  RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
} from './retriever-schema-recovery-sr2-helpers.ts';

const ORIGINAL_QUERY = 'Why does that follow?';
const RECENT_TURNS = [
  { role: 'assistant' as const, content: 'The sequence is monotone and bounded.' },
];

describe('Phase 6.9.8 Retriever Schema Recovery SR2 provider robustness', () => {
  test('freezes an independent fixture and pins the SR1 contract identity', () => {
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256).toBe(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256,
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES).toMatchObject({
      contractSha256: '4248db580e60ccf4b851d46ab692c867b04ba23c4bdb4b86e64bcb3b99fecf4e',
      diagnosticVersion: 'phase-6.9.8-retriever-schema-diagnostic-v1',
      candidateVersion: 'retriever-query-rewrite-model-candidate-v1',
      model: 'deepseek-v4-pro',
      limits: RETRIEVER_SCHEMA_RECOVERY_LIMITS,
    });
    expect(Object.isFrozen(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES)).toBe(true);
    expect(Object.isFrozen(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES)).toBe(
      true,
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES).toHaveLength(24);
    expect(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
        (entry) => entry.resultKind === 'applied',
      ),
    ).toHaveLength(5);
    expect(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
        (entry) => entry.resultKind === 'rejected',
      ),
    ).toHaveLength(19);
  });

  test('accepts provider-like canonical metamorphs and discards Unicode extensions without raw leakage', async () => {
    let canonicalQuery: string | null = null;
    for (const shape of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
      (entry) => entry.resultKind === 'applied',
    )) {
      const context = createRetrieverSr2AuthenticatedContext(`shape_${shape.id}`);
      const tracked = createRetrieverSr2TrackedRuntime({ content: shape.content });
      const result = await runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

      expect(tracked.invokes(), shape.id).toBe(1);
      expect(tracked.requests, shape.id).toHaveLength(1);
      expect(result.rewrite.disposition, shape.id).toBe('candidate_applied');
      expect(result.schemaRecoveryDiagnostic?.reasonCode ?? null, shape.id).toBe(
        shape.diagnosticReason,
      );
      if (canonicalQuery === null) canonicalQuery = result.executedQuery;
      expect(result.executedQuery, shape.id).toBe(canonicalQuery);
      expect(JSON.stringify(result), shape.id).not.toContain('SR2_PRIVATE_');
      if (shape.leakSentinel !== null) {
        expect(JSON.stringify(result), shape.id).not.toContain(shape.leakSentinel);
      }
    }
  });

  test('rejects every negative shape after one dispatch with bounded reason and no retry', async () => {
    for (const shape of PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
      (entry) => entry.resultKind === 'rejected',
    )) {
      const context = createRetrieverSr2AuthenticatedContext(`negative_${shape.id}`);
      const tracked = createRetrieverSr2TrackedRuntime({ content: shape.content });
      const result = await runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

      expect(tracked.invokes(), shape.id).toBe(1);
      expect(tracked.requests, shape.id).toHaveLength(1);
      expect(result.rewrite.disposition, shape.id).toBe('failed_fallback_original');
      expect(result.schemaRecoveryDiagnostic?.reasonCode, shape.id).toBe(shape.diagnosticReason);
      expect(result.schemaRecoveryDiagnostic?.rawDataRetained, shape.id).toBe(false);
      expect(result.executedQuery, shape.id).toBe(ORIGINAL_QUERY);
      expect(JSON.stringify(result), shape.id).not.toContain('SR2_PRIVATE_');
      if (shape.leakSentinel !== null) {
        expect(JSON.stringify(result), shape.id).not.toContain(shape.leakSentinel);
      }
    }
  });

  test('keeps byte, depth, node, key, and UTF-16 limits aligned between parser and candidate', async () => {
    const limits = [
      `{"rewrittenQuery":"${'值'.repeat(5_000)}"}`,
      `{"rewrittenQuery":"valid","x":${'{"x":'.repeat(9)}0${'}'.repeat(9)}}`,
      `{"rewrittenQuery":"valid","x":[${Array.from({ length: 130 }, () => '0').join(',')}]}`,
      `{${['"rewrittenQuery":"valid"', ...Array.from({ length: 65 }, (_, index) => `"k${index}":0`)].join(',')}}`,
      JSON.stringify({
        rewrittenQuery: 'a'.repeat(
          RETRIEVER_SCHEMA_RECOVERY_LIMITS.maxRewrittenQueryUtf16CodeUnits + 1,
        ),
      }),
    ];

    for (const content of limits) {
      const parsed = parseRetrieverSchemaRecoveryProviderContent(content);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error('SR2_LIMIT_UNEXPECTEDLY_ACCEPTED');

      const context = createRetrieverSr2AuthenticatedContext('limit_case');
      const tracked = createRetrieverSr2TrackedRuntime({ content });
      const result = await runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

      expect(tracked.invokes()).toBe(1);
      expect(result.rewrite.disposition).toBe('failed_fallback_original');
      expect(result.schemaRecoveryDiagnostic?.reasonCode).toBe(parsed.diagnostic.reasonCode);
      expect(result.schemaRecoveryDiagnostic?.rawDataRetained).toBe(false);
    }
  });

  test('creates an isolated collector schema for every eligible dispatch', async () => {
    const firstContext = createRetrieverSr2AuthenticatedContext('fresh_one');
    const secondContext = createRetrieverSr2AuthenticatedContext('fresh_two');
    const tracked = createRetrieverSr2TrackedRuntime({
      content:
        '{"rewrittenQuery":"Why does convergence follow from the sequence being monotone and bounded?"}',
    });
    const run = (context: ReturnType<typeof createRetrieverSr2AuthenticatedContext>) =>
      runRetrieverQueryRewriteModelCandidateV1({
        request: createRetrieverSr2Request(context, {
          originalQuery: ORIGINAL_QUERY,
          recentTurns: RECENT_TURNS,
        }),
        context,
        config: RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG,
        now: () => Date.parse('2026-08-09T12:00:00.000Z'),
        createRuntime: () => tracked.runtime,
      });

    await run(firstContext);
    await run(secondContext);
    expect(tracked.invokes()).toBe(2);
    expect(tracked.schemas).toHaveLength(2);
    expect(tracked.schemas[0]).not.toBe(tracked.schemas[1]);
  });
});
