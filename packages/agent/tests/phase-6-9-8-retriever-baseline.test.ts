import { describe, expect, test } from 'bun:test';

import {
  buildPhase698RetrieverOriginalQueryBaselineV1,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
  PHASE_6_9_8_RETRIEVER_BASELINE_MANIFEST_SHA256,
  validatePhase698RetrieverBaselineBytes,
} from '../src/evals/phase-6-9-8-retriever-baseline.ts';

describe('Phase 6.9.8 Retriever original-query deterministic baseline', () => {
  test('runs 16 guards and 16 original-query runtime cases with zero Provider calls', async () => {
    const bundle = await buildPhase698RetrieverOriginalQueryBaselineV1();

    expect(bundle.report.caseCounts).toEqual({ guards: 16, runtime: 16, total: 32 });
    expect(bundle.report.guardPassCount).toBe(16);
    expect(bundle.report.runtimeCompleteCount).toBe(16);
    expect(bundle.report.complete).toBe(true);
    expect(bundle.report.counters).toEqual({
      guardFakeSearchPortCalls: 0,
      runtimeFakeSearchPortCalls: 16,
      qwenEmbeddingCalls: 0,
      queryRewriteModelCalls: 0,
      finalResponseModelCalls: 0,
      providerCalls: 0,
    });
    expect(bundle.report.guardEntries.every((entry) => entry.passed)).toBe(true);
    expect(bundle.report.runtimeEntries.every((entry) => entry.complete)).toBe(true);
  });

  test('publishes fail-closed Recall, nDCG, Top1, no-hit and critical-target metrics', async () => {
    const { report } = await buildPhase698RetrieverOriginalQueryBaselineV1();

    expect(report.metrics).toEqual({
      runtimeCases: 16,
      relevanceMetricCases: 14,
      expectedNoHitCases: 2,
      recallAt5: 1,
      ndcgAt5: 0.813219437888,
      top1Accuracy: 0.571428571429,
      expectedNoHitAccuracy: 1,
      criticalTargetRecall: 1,
    });
    expect(report.runtimeEntries.filter((entry) => entry.expectedNoHit)).toHaveLength(2);
    expect(report.runtimeEntries.filter((entry) => entry.noHitObserved)).toHaveLength(2);
    expect(report.runtimeEntries.filter((entry) => entry.critical)).toHaveLength(4);
  });

  test('is byte-for-byte reproducible and contains no query, chunk content, owner, or token', async () => {
    const first = await buildPhase698RetrieverOriginalQueryBaselineV1();
    const second = await buildPhase698RetrieverOriginalQueryBaselineV1();

    expect(second.canonicalBytes).toBe(first.canonicalBytes);
    expect(second.sha256).toBe(first.sha256);
    expect(first.report.manifestSha256).toBe(PHASE_6_9_8_RETRIEVER_BASELINE_MANIFEST_SHA256);
    expect(PHASE_6_9_8_RETRIEVER_BASELINE_MANIFEST_SHA256).toBe(
      PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
    );
    expect(first.sha256).toBe(PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256);
    expect(first.canonicalBytes).not.toMatch(
      /牛顿|photosynthesis|Deterministic synthetic retrieval evidence|owner_baseline|Bearer|authorization|api_key|sk-/iu,
    );
    expect(
      first.report.runtimeEntries.every((entry) => entry.originalQueryHash.startsWith('sha256:')),
    ).toBe(true);
    expect(
      first.report.runtimeEntries
        .flatMap((entry) => entry.rankedCandidateRefs)
        .every((reference) => /^sha256:[0-9a-f]{64}$/u.test(reference)),
    ).toBe(true);
  });

  test('strict validator rejects any physical-byte drift', async () => {
    const bundle = await buildPhase698RetrieverOriginalQueryBaselineV1();
    expect(await validatePhase698RetrieverBaselineBytes(bundle.canonicalBytes)).toEqual({
      ok: true,
      sha256: bundle.sha256,
    });
    expect(
      await validatePhase698RetrieverBaselineBytes(
        bundle.canonicalBytes.replace('runtime_01', 'runtime_99'),
      ),
    ).toEqual({ ok: false, reasonCode: 'bytes_mismatch' });
    expect(await validatePhase698RetrieverBaselineBytes(new Uint8Array([0xff]))).toEqual({
      ok: false,
      reasonCode: 'invalid_utf8',
    });
  });
});
