import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'bun:test';

import { parseTutorSchemaRecoveryProviderContent } from '../src/model-candidates/tutor-schema-recovery-contract.ts';
import { runTutorSchemaRecoveryModelCandidate } from '../src/model-candidates/tutor-schema-recovery-model-candidate.ts';
import {
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256,
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256,
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES,
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES,
} from './fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts';
import {
  createSr2CandidateInput,
  createSr2ProviderResponse,
  createSr2TrackedRuntime,
} from './tutor-schema-recovery-sr2-helpers.ts';

const TEXT = '我写完这一行了，但不确定推导是否接得上。';
const CONTEXT = '合成代数题：正在检查方程变形与等价关系。';

describe('Phase 6.9.7 Tutor Schema Recovery SR2 provider robustness', () => {
  test('freezes the independent fixture and all prompt/parser/projection/diagnostic/merger identities', async () => {
    expect(PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256).toBe(
      PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256,
    );
    const files = {
      promptSourceSha256: '../src/model-candidates/tutor-v6-model-contract.ts',
      parserDiagnosticSourceSha256: '../src/model-candidates/tutor-schema-recovery-contract.ts',
      projectionSourceSha256: '../src/model-candidates/tutor-v6-model-projection.ts',
      mergerSourceSha256: '../src/model-candidates/tutor-v6-model-candidate.ts',
      recoveryAdapterSourceSha256:
        '../src/model-candidates/tutor-schema-recovery-model-candidate.ts',
    } as const;
    for (const [identity, path] of Object.entries(files)) {
      const bytes = await readFile(fileURLToPath(new URL(path, import.meta.url)));
      expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, identity).toBe(
        PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES[
          identity as keyof typeof PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES
        ],
      );
    }
  });

  test('accepts provider-like JSON metamorphs and discards bounded scalar/object/array extensions', async () => {
    let canonicalResult: unknown = null;
    for (const shape of PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
      (entry) => entry.resultKind === 'applied',
    )) {
      const tracked = createSr2TrackedRuntime({
        fetch: async () => createSr2ProviderResponse(shape.content),
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(TEXT, CONTEXT, tracked.runtime),
      );

      expect(tracked.provenance, shape.id).toBe('synthetic_test');
      expect(tracked.fetchCalls(), shape.id).toBe(1);
      expect(result.observation.disposition, shape.id).toBe('candidate_applied');
      expect(result.schemaDiagnostic?.reasonCode ?? null, shape.id).toBe(shape.diagnosticReason);
      expect(JSON.stringify(result), shape.id).not.toContain('sr2-private-shape-sentinel');
      if (shape.metamorphicGroup === 'intent-index-zero') {
        canonicalResult ??= result.result;
        expect(result.result, shape.id).toEqual(canonicalResult);
      }
    }
  });

  test('fails every schema-negative shape after exactly one dispatch without retry or raw leakage', async () => {
    for (const shape of PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES.filter(
      (entry) => entry.resultKind === 'rejected',
    )) {
      const tracked = createSr2TrackedRuntime({
        fetch: async () => createSr2ProviderResponse(shape.content),
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(TEXT, CONTEXT, tracked.runtime),
      );

      expect(tracked.fetchCalls(), shape.id).toBe(1);
      expect(tracked.runtimeRequests, shape.id).toHaveLength(1);
      expect(result.observation.disposition, shape.id).toBe('fallback_runtime_error');
      expect(result.schemaDiagnostic?.reasonCode, shape.id).toBe(shape.diagnosticReason);
      expect(result.schemaDiagnostic?.rawDataRetained, shape.id).toBe(false);
      expect(JSON.stringify(result), shape.id).not.toContain(shape.content);
    }
  });

  test('enforces Unicode byte, depth, node, and key bounds through the direct adapter', async () => {
    const limits = [
      `{"intentIndex":0,"x":"${'值'.repeat(8_192)}"}`,
      `{"intentIndex":0,"x":${'['.repeat(10)}0${']'.repeat(10)}}`,
      `{"intentIndex":0,"x":[${Array.from({ length: 130 }, () => '0').join(',')}]}`,
      `{${['"intentIndex":0', ...Array.from({ length: 66 }, (_, index) => `"k${index}":0`)].join(
        ',',
      )}}`,
    ];
    for (const content of limits) {
      const parsed = parseTutorSchemaRecoveryProviderContent(content);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error('SR2_LIMIT_CASE_UNEXPECTEDLY_PASSED');
      expect(parsed.diagnostic.reasonCode).toBe('structure_limit');

      const tracked = createSr2TrackedRuntime({
        fetch: async () => createSr2ProviderResponse(content),
      });
      const result = await runTutorSchemaRecoveryModelCandidate(
        createSr2CandidateInput(TEXT, CONTEXT, tracked.runtime),
      );
      expect(tracked.fetchCalls()).toBe(1);
      expect(result.observation.disposition).toBe('fallback_runtime_error');
      expect(result.schemaDiagnostic).toMatchObject({
        reasonCode: 'structure_limit',
        rawDataRetained: false,
      });
    }
  });
});
