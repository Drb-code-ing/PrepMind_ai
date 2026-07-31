import { readFileSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT,
  PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_FILE_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_REPORT_SHA256,
  buildPhase697SmallSampleDeterministicBaseline,
  validatePhase697SmallSampleBaselineFile,
  validatePhase697SmallSampleSourceCoverage,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY,
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_FROZEN_EVAL_POLICY_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA,
  buildPhase697SmallSampleReport,
  calculatePhase697SmallSampleCostCny,
  parsePhase697SmallSampleReport,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES,
  PHASE_6_9_7_SMALL_SAMPLE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_LINEAGE,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST,
  PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
  PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256,
  computePhase697SmallSampleCanonicalSha256,
  validatePhase697SmallSampleManifest,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v8-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  type Phase697SmallSampleBaselineFileSystem,
  writePhase697SmallSampleBaseline,
} from '../scripts/phase-6-9-7-tutor-organizer-small-sample-baseline.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000971';
const ZERO_WIRE = Object.freeze({
  executorEntered: 0 as const,
  providerDispatchStarted: 0 as const,
  providerResponseReceived: 0 as const,
  verifiedUsageObserved: 0 as const,
});
const FULL_WIRE = Object.freeze({
  executorEntered: 1 as const,
  providerDispatchStarted: 1 as const,
  providerResponseReceived: 1 as const,
  verifiedUsageObserved: 1 as const,
});
const SAFE = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});

describe('Phase 6.9.7 G1 small-sample zero-provider contracts', () => {
  test('freezes the exact P1 manifest and validates live source coverage without oracle fields', () => {
    expect(PHASE_6_9_7_SMALL_SAMPLE_LINEAGE).toBe('phase-6.9.7-tutor-organizer-small-sample-v1');
    expect(PHASE_6_9_7_SMALL_SAMPLE_SOURCE_DATASET_SHA256).toBe(
      PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256).toBe(
      'ae667f1c086ef67d37e5e5570612a21850bca6b10f53ea85b607c150e84edf61',
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_FROZEN_MANIFEST_SHA256,
    );
    expect(computePhase697SmallSampleCanonicalSha256(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST)).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_MANIFEST_SHA256,
    );
    expect(validatePhase697SmallSampleManifest(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST)).toEqual({
      ok: true,
    });
    expect(validatePhase697SmallSampleSourceCoverage()).toEqual({ ok: true });
    expect(PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES).toHaveLength(24);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter((entry) => entry.kind === 'guard'),
    ).toHaveLength(8);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.filter((entry) => entry.kind === 'runtime'),
    ).toHaveLength(16);
    expect(JSON.stringify(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST)).not.toMatch(
      /expected|oracle|answer|userNote|questionText/,
    );
    expect(Object.isFrozen(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST)).toBe(true);
    expect(Object.isFrozen(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST.runtimePairs)).toBe(true);
  });

  test('fails closed on manifest order, pair index, tags, unknown fields, and non-JSON hash input', () => {
    const reordered = structuredClone(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST);
    reordered.runtimePairs.reverse();
    expect(validatePhase697SmallSampleManifest(reordered).ok).toBe(false);

    const wrongPair = structuredClone(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST);
    wrongPair.runtimePairs[0]!.pairedRunIndex = 1;
    expect(validatePhase697SmallSampleManifest(wrongPair).ok).toBe(false);

    const wrongTags = structuredClone(PHASE_6_9_7_SMALL_SAMPLE_MANIFEST);
    wrongTags.runtimePairs[0]!.selectionTags.reverse();
    expect(validatePhase697SmallSampleManifest(wrongTags).ok).toBe(false);

    expect(
      validatePhase697SmallSampleManifest({
        ...PHASE_6_9_7_SMALL_SAMPLE_MANIFEST,
        unexpected: true,
      }).ok,
    ).toBe(false);
    expect(() => computePhase697SmallSampleCanonicalSha256({ invalid: Number.NaN })).toThrow();
    expect(() => computePhase697SmallSampleCanonicalSha256(new Date())).toThrow();
  });

  test('recomputes the frozen deterministic subset baseline with zero provider authority', () => {
    const fresh = buildPhase697SmallSampleDeterministicBaseline();
    expect(fresh).toEqual(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT);
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY).toMatchObject({
      providerInvocations: 0,
      tutor: { scoredCases: 8, fullMatches: 5, semanticScore: 0.7070238095238095 },
      organizer: { scoredDecisions: 12, fullMatches: 0, semanticScore: 0.2375 },
      combinedSemanticScore: 0.47226190476190477,
    });
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256).toBe(
      'd36d0789a19b89f814f66130c6ca8e92ab7eaf76bde597ccba80454e93fd9f4e',
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_AUTHORITY_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_AUTHORITY_SHA256,
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_REPORT_SHA256,
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_FROZEN_BASELINE_FILE_SHA256,
    );
    expect(
      validatePhase697SmallSampleBaselineFile(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES),
    ).toEqual({
      ok: true,
      reportLogicalSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
      physicalFileSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256,
    });
    expect(Object.isFrozen(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT)).toBe(true);
  });

  test('rejects baseline byte tampering and selected source coverage drift', () => {
    const tampered = JSON.parse(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES) as {
      report: { summary: { providerInvocations: number } };
    };
    tampered.report.summary.providerInvocations = 1;
    expect(
      validatePhase697SmallSampleBaselineFile(`${JSON.stringify(tampered, null, 2)}\n`).ok,
    ).toBe(false);
    expect(
      validatePhase697SmallSampleBaselineFile(
        PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES.replace(/\n$/u, '\r\n'),
      ).ok,
    ).toBe(false);

    const tutorDrift = [...phase697V2TutorCases];
    const tutorIndex = tutorDrift.findIndex((entry) => entry.id === 'tutor-v2-runtime-01');
    tutorDrift[tutorIndex] = {
      ...tutorDrift[tutorIndex]!,
      pairedRunIndex: 1,
    } as unknown as (typeof phase697V2TutorCases)[number];
    expect(validatePhase697SmallSampleSourceCoverage({ tutorCases: tutorDrift }).ok).toBe(false);

    const organizerDrift = [...phase697V2OrganizerCases];
    const organizerIndex = organizerDrift.findIndex(
      (entry) => entry.id === 'organizer-v2-runtime-24',
    );
    const organizer = organizerDrift[organizerIndex]!;
    if (organizer.expectedRuntimeInvocations !== 1) throw new Error('missing Organizer runtime');
    organizerDrift[organizerIndex] = {
      ...organizer,
      expected: { decisions: organizer.expected.decisions.slice(0, 2) },
    } as unknown as (typeof phase697V2OrganizerCases)[number];
    expect(validatePhase697SmallSampleSourceCoverage({ organizerCases: organizerDrift }).ok).toBe(
      false,
    );

    const missingTutor = phase697V2TutorCases.filter((entry) => entry.id !== 'tutor-v2-runtime-01');
    expect(validatePhase697SmallSampleSourceCoverage({ tutorCases: missingTutor }).ok).toBe(false);

    const duplicatedOrganizer = [
      ...phase697V2OrganizerCases,
      structuredClone(
        phase697V2OrganizerCases.find((entry) => entry.id === 'organizer-v2-runtime-24')!,
      ),
    ];
    const duplicateCoverage = validatePhase697SmallSampleSourceCoverage({
      organizerCases: duplicatedOrganizer,
    });
    expect(duplicateCoverage.ok).toBe(false);
    if (!duplicateCoverage.ok) {
      expect(duplicateCoverage.issues).toContain('organizer_source_duplicate_id');
    }
  });

  test('freezes G1 denominators, budgets, pricing, sample latency, and lineage policy', () => {
    expect(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY).toMatchObject({
      counts: {
        guards: 8,
        runtimePairs: 8,
        runtimeLanes: 16,
        tutorRuntimeCases: 8,
        organizerRuntimeCases: 8,
        organizerDecisionUnits: 12,
      },
      quality: {
        semanticScoreMin: 0.85,
        tutorAbsoluteImprovementMin: 0.15,
        organizerAbsoluteImprovementMin: 0.15,
      },
      latency: {
        tutorHardTimeoutMs: 3500,
        organizerHardTimeoutMs: 5000,
        p95: null,
        p95Reason: 'insufficient_sample_size_8',
      },
      budget: {
        providerCallsMax: 16,
        inputTokensMax: 37600,
        outputTokensMax: 8800,
        runCnyMax: 0.176,
      },
      pricing: {
        profile: 'deepseek-v4-pro-cny-2026-07-15',
        inputCnyPerMillion: 3,
        outputCnyPerMillion: 6,
      },
    });
    expect(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256).toBe(
      '1cab7786af49a6a6111927f3849b283e9e9c1c143eea6d4fecfd7adb02bf399a',
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY_SHA256).toBe(
      PHASE_6_9_7_SMALL_SAMPLE_FROZEN_EVAL_POLICY_SHA256,
    );
    expect(Object.isFrozen(PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY)).toBe(true);
  });

  test('derives a complete semantic report and never upgrades Mock to quality evidence', () => {
    const live = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: passingEntries(),
    });
    expect(live.gate).toBe('small_sample_quality_gate_passed');
    expect(live.wire).toEqual({
      complete: true,
      executorEntered: 16,
      providerDispatchStarted: 16,
      providerResponseReceived: 16,
      verifiedUsageObserved: 16,
    });
    expect(live.metrics).toMatchObject({
      complete: true,
      strictRuntimeSuccesses: 16,
      tutorSemanticScore: 1,
      organizerSemanticScore: 1,
      combinedSemanticScore: 1,
      tutorAbsoluteImprovement: 1 - 0.7070238095238095,
      organizerAbsoluteImprovement: 1 - 0.2375,
      tutorInvalidCases: 0,
      organizerInvalidDecisions: 0,
    });
    expect(live.latency).toMatchObject({
      complete: true,
      tutorSampleCount: 8,
      organizerSampleCount: 8,
      tutorP95Ms: null,
      organizerP95Ms: null,
      pairedP95Ms: null,
      p95Reason: 'insufficient_sample_size_8',
    });
    expect(live.usage).toMatchObject({
      complete: true,
      verifiedRuntimeCases: 16,
      inputTokens: 1600,
      outputTokens: 320,
    });
    expect(live.limits).toEqual({
      pricing: {
        profile: 'deepseek-v4-pro-cny-2026-07-15',
        inputCnyPerMillion: 3,
        outputCnyPerMillion: 6,
        precisionDecimals: 8,
      },
      laneBudget: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.laneBudget,
      runBudget: PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.budget,
      latency: {
        tutorHardTimeoutMs: 3500,
        organizerHardTimeoutMs: 5000,
        p95: null,
        p95Reason: 'insufficient_sample_size_8',
      },
    });
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(live).success).toBe(true);
    expect(parsePhase697SmallSampleReport(live)).toEqual(live);

    const mock = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'mock',
      executorProvenance: 'mock_synthetic',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: passingEntries(),
    });
    expect(mock.gate).toBe('mock_quality_not_evidence');
  });

  test('nulls every formal aggregate on incomplete runtime evidence and rejects stale lineage', () => {
    const entries = passingEntries();
    const runtimeIndex = entries.findIndex((entry) => entry.executionKind === 'runtime');
    entries[runtimeIndex] = {
      ...entries[runtimeIndex]!,
      disposition: 'attempted_failed',
      failureCategory: 'usage',
      strictRuntimeSuccess: false,
      wire: { ...FULL_WIRE, verifiedUsageObserved: 0 },
      usage: null,
      semantic: null,
    };
    const failedPair = entries[runtimeIndex]!.pairedRunIndex;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (entry.executionKind !== 'runtime' || entry.pairedRunIndex === failedPair) continue;
      entries[index] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
        ...entry,
        disposition: 'not_started_quality_breaker',
        failureCategory: 'quality_breaker',
        strictRuntimeSuccess: false,
        wire: ZERO_WIRE,
        durationMs: null,
        usage: null,
        semantic: null,
      });
    }
    const report = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: entries,
    });
    expect(report.gate).toBe('small_sample_quality_gate_failed');
    expect(report.metrics).toMatchObject({
      complete: false,
      tutorSemanticScore: null,
      organizerSemanticScore: null,
      combinedSemanticScore: null,
      tutorAbsoluteImprovement: null,
      organizerAbsoluteImprovement: null,
    });
    expect(report.latency).toMatchObject({
      complete: false,
      tutorMedianMs: null,
      tutorMaxMs: null,
      organizerMedianMs: null,
      organizerMaxMs: null,
    });
    expect(report.usage).toMatchObject({
      complete: false,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCny: null,
    });

    const stale = structuredClone(report) as Record<string, unknown>;
    stale.nested = { version: 'phase-6.9.7-tutor-organizer-runner-v9' };
    expect(parsePhase697SmallSampleReport(stale)).toBeNull();
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse({ ...report, unknown: true }).success,
    ).toBe(false);
  });

  test('fails closed on missing, asymmetric, or post-terminal pair execution', () => {
    const missingLane = passingEntries();
    missingLane.splice(
      missingLane.findIndex(
        (entry) => entry.executionKind === 'runtime' && entry.pairedRunIndex === 0,
      ),
      1,
    );
    expect(() => buildLiveReport(missingLane)).toThrow();

    const asymmetricPair = passingEntries();
    const asymmetricIndex = asymmetricPair.findIndex(
      (entry) =>
        entry.executionKind === 'runtime' &&
        entry.pairedRunIndex === 0 &&
        entry.agent === 'wrong_question_organizer',
    );
    asymmetricPair[asymmetricIndex] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
      ...asymmetricPair[asymmetricIndex]!,
      disposition: 'not_started_quality_breaker',
      failureCategory: 'quality_breaker',
      strictRuntimeSuccess: false,
      wire: ZERO_WIRE,
      durationMs: null,
      usage: null,
      semantic: null,
    });
    expect(() => buildLiveReport(asymmetricPair)).toThrow();

    const postTerminalExecution = passingEntries();
    const failedIndex = postTerminalExecution.findIndex(
      (entry) =>
        entry.executionKind === 'runtime' && entry.pairedRunIndex === 0 && entry.agent === 'tutor',
    );
    postTerminalExecution[failedIndex] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
      ...postTerminalExecution[failedIndex]!,
      disposition: 'attempted_failed',
      failureCategory: 'usage',
      strictRuntimeSuccess: false,
      wire: { ...FULL_WIRE, verifiedUsageObserved: 0 },
      usage: null,
      semantic: null,
    });
    expect(() => buildLiveReport(postTerminalExecution)).toThrow();
  });

  test('keeps semantic mismatch as a complete failed gate without opening the contract breaker', () => {
    const entries = passingEntries();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (entry.semantic?.agent !== 'tutor') continue;
      entries[index] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
        ...entry,
        semantic: {
          agent: 'tutor',
          observation: {
            ...entry.semantic.observation,
            actualIntent:
              entry.semantic.observation.expectedIntent === 'general_follow_up'
                ? 'socratic_hint'
                : 'general_follow_up',
          },
        },
      });
    }
    const report = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: entries,
    });
    expect(report.metrics.complete).toBe(true);
    expect(report.metrics.tutorSemanticScore).toBeLessThan(0.85);
    expect(report.breaker).toEqual({ opened: false, reason: null });
    expect(report.gate).toBe('small_sample_quality_gate_failed');
  });

  test('binds scorer expectations to the frozen source oracle after response', () => {
    const entry = structuredClone(
      passingEntries().find((candidate) => candidate.semantic?.agent === 'tutor')!,
    );
    if (entry.semantic?.agent !== 'tutor') throw new Error('missing Tutor semantic entry');
    entry.semantic.observation.expectedIntent =
      entry.semantic.observation.expectedIntent === 'general_follow_up'
        ? 'socratic_hint'
        : 'general_follow_up';
    entry.semantic.observation.actualIntent = entry.semantic.observation.expectedIntent;
    expect(PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse(entry).success).toBe(false);

    const organizerEntry = structuredClone(
      passingEntries().find(
        (candidate) => candidate.semantic?.agent === 'wrong_question_organizer',
      )!,
    );
    if (organizerEntry.semantic?.agent !== 'wrong_question_organizer') {
      throw new Error('missing Organizer semantic entry');
    }
    organizerEntry.semantic.observations[0]!.expectedSubject = 'other';
    organizerEntry.semantic.observations[0]!.actualSubject = 'other';
    expect(PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse(organizerEntry).success).toBe(
      false,
    );
  });

  test('records an accidental guard dispatch as a critical failure outside the runtime wire denominator', () => {
    const entries = passingEntries();
    entries[0] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
      ...entries[0]!,
      disposition: 'attempted_failed',
      failureCategory: 'guard',
      zeroCallVerified: false,
      wire: {
        executorEntered: 1,
        providerDispatchStarted: 1,
        providerResponseReceived: 0,
        verifiedUsageObserved: 0,
      },
      durationMs: 5,
      safety: { ...SAFE, criticalFailure: true },
    });
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (entry.executionKind !== 'runtime') continue;
      entries[index] = PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
        ...entry,
        disposition: 'not_started_quality_breaker',
        failureCategory: 'quality_breaker',
        strictRuntimeSuccess: false,
        wire: ZERO_WIRE,
        durationMs: null,
        usage: null,
        semantic: null,
      });
    }
    const report = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: entries,
    });
    expect(report.gate).toBe('small_sample_quality_gate_failed');
    expect(report.safety).toMatchObject({ guardVerifiedZeroCalls: 7, criticalFailures: 1 });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 0,
      terminalEntries: 0,
      orphanedEntries: 0,
      notStartedEntries: 16,
    });
    expect(report.wire).toEqual({
      complete: false,
      executorEntered: 0,
      providerDispatchStarted: 0,
      providerResponseReceived: 0,
      verifiedUsageObserved: 0,
    });
  });

  test('rejects unknown pricing, unverifiable usage, and cost mismatches', () => {
    const runtimeEntry = passingEntries().find((entry) => entry.executionKind === 'runtime')!;
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse({
        ...runtimeEntry,
        usage: { ...runtimeEntry.usage, pricingProfile: 'unknown-price' },
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse({
        ...runtimeEntry,
        usage: {
          ...runtimeEntry.usage,
          estimatedCostCny: (runtimeEntry.usage?.estimatedCostCny ?? 0) + 0.01,
        },
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse({
        ...runtimeEntry,
        usage: null,
      }).success,
    ).toBe(false);
    expect(() => calculatePhase697SmallSampleCostCny(-1, 1)).toThrow();
    expect(() => calculatePhase697SmallSampleCostCny(1.5, 1)).toThrow();
  });

  test('recomputes report-level usage and wire aggregates instead of trusting claimed totals', () => {
    const report = buildLiveReport(passingEntries());
    const entryTamper = structuredClone(report) as unknown as {
      caseEntries: Array<{
        executionKind: string;
        usage: { inputTokens: number; outputTokens: number; estimatedCostCny: number } | null;
      }>;
    };
    const runtimeEntry = entryTamper.caseEntries.find(
      (entry) => entry.executionKind === 'runtime' && entry.usage !== null,
    )!;
    if (runtimeEntry.usage === null) throw new Error('missing runtime usage');
    runtimeEntry.usage.inputTokens += 1;
    runtimeEntry.usage.estimatedCostCny = calculatePhase697SmallSampleCostCny(
      runtimeEntry.usage.inputTokens,
      runtimeEntry.usage.outputTokens,
    );
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(entryTamper).success).toBe(false);

    const aggregateTamper = structuredClone(report) as unknown as {
      usage: { inputTokens: number | null };
    };
    if (aggregateTamper.usage.inputTokens === null) throw new Error('missing aggregate usage');
    aggregateTamper.usage.inputTokens += 1;
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(aggregateTamper).success).toBe(false);

    const usageWithoutWire = structuredClone(
      report.caseEntries.find((entry) => entry.executionKind === 'runtime')!,
    ) as unknown as { wire: { verifiedUsageObserved: number } };
    usageWithoutWire.wire.verifiedUsageObserved = 0;
    expect(PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.safeParse(usageWithoutWire).success).toBe(
      false,
    );
  });

  test('rejects 7/9 sample claims and any non-null P95 authority', () => {
    const report = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: passingEntries(),
    });
    const seven = structuredClone(report) as unknown as {
      latency: { tutorSampleCount: number };
    };
    seven.latency.tutorSampleCount = 7;
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(seven).success).toBe(false);

    const nine = structuredClone(report) as unknown as {
      caseEntries: unknown[];
    };
    nine.caseEntries[9] = structuredClone(nine.caseEntries[8]);
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(nine).success).toBe(false);

    const p95 = structuredClone(report) as unknown as {
      latency: { tutorP95Ms: number | null };
    };
    p95.latency.tutorP95Ms = 1;
    expect(PHASE_6_9_7_SMALL_SAMPLE_REPORT_SCHEMA.safeParse(p95).success).toBe(false);
  });

  test('rejects every prior Live lineage and is rejected by every V1-V9 report validator', () => {
    const report = buildPhase697SmallSampleReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'mock',
      executorProvenance: 'mock_synthetic',
      approvedRunnableSourceCommit: 'a'.repeat(40),
      sourceHashes: sourceHashes(),
      caseEntries: passingEntries(),
    });
    const priorRunIds = [
      '39a62241-0f51-45be-a423-0d13b0b60ae4',
      '67ce18dd-e2ed-4a05-8507-2a98898b8ede',
      'ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc',
      '0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f',
      'aa637d3a-f7c4-4549-a724-9cdbefdd89c8',
      'b18a0a13-a2a0-4cb0-8f9c-296271c0dfa8',
      '81529c2c-79f5-4c21-9cee-e536a2fe78e3',
      '7ff09c36-50f2-445a-b309-dc9500e5e13c',
      'c530ca02-3ece-4f11-898c-5695c8252bd5',
      '253a5df5-c443-4950-b517-849efb941728',
      'dc09214c-0300-4153-8273-e548ac768d20',
    ];
    for (const runId of priorRunIds) {
      expect(parsePhase697SmallSampleReport({ ...report, runId })).toBeNull();
      expect(() =>
        buildPhase697SmallSampleReport({
          runId,
          runScope: 'branch',
          mode: 'mock',
          executorProvenance: 'mock_synthetic',
          approvedRunnableSourceCommit: 'a'.repeat(40),
          sourceHashes: sourceHashes(),
          caseEntries: passingEntries(),
        }),
      ).toThrow();
    }
    const nestedRecovery = structuredClone(report) as unknown as Record<string, unknown>;
    nestedRecovery.recovery = { identity: 'phase-6.9.7-architecture-recovery-r4' };
    expect(parsePhase697SmallSampleReport(nestedRecovery)).toBeNull();

    const oldSchemas = [
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA,
    ];
    for (const schema of oldSchemas) expect(schema.safeParse(report).success).toBe(false);
  });

  test('writes only the fixed baseline path, reuses exact bytes, and rejects conflicts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-small-sample-g1-'));
    try {
      const created = await writePhase697SmallSampleBaseline(root);
      expect(created).toMatchObject({
        disposition: 'created',
        relativePath: '.tmp/phase-6-9-7-tutor-organizer-small-sample-baseline.json',
        reportLogicalSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT_SHA256,
        physicalFileSha256: PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_SHA256,
      });
      const path = join(root, created.relativePath);
      expect(await readFile(path, 'utf8')).toBe(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES);
      expect((await writePhase697SmallSampleBaseline(root)).disposition).toBe('same_bytes');
      await writeFile(path, 'conflict\n', 'utf8');
      await expect(writePhase697SmallSampleBaseline(root)).rejects.toThrow(
        'PHASE_6_9_7_SMALL_SAMPLE_BASELINE_CONFLICT',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('closes the exclusive handle without writing when the parent changes after open', async () => {
    const root = resolve(join(tmpdir(), 'prepmind-small-sample-g1-parent-race'));
    const parent = join(root, '.tmp');
    const output = join(parent, 'phase-6-9-7-tutor-organizer-small-sample-baseline.json');
    let parentRealpathChecks = 0;
    let wrote = false;
    let closed = false;
    const directoryStat = fakeStat('directory', 1, 10);
    const fileStat = fakeStat('file', 1, 11);
    const fs: Phase697SmallSampleBaselineFileSystem = {
      async realpath(path) {
        if (path === parent) {
          parentRealpathChecks += 1;
          return parentRealpathChecks === 1 ? parent : join(dirname(root), 'swapped-parent');
        }
        return path;
      },
      async mkdir() {},
      async lstat(path) {
        return path === parent ? directoryStat : fileStat;
      },
      async openExclusive(path) {
        expect(path).toBe(output);
        return {
          async stat() {
            return fileStat;
          },
          async readFile() {
            return new Uint8Array();
          },
          async writeFile() {
            wrote = true;
          },
          async sync() {},
          async close() {
            closed = true;
          },
        };
      },
      async openReadOnly() {
        throw new Error('unexpected read-only open');
      },
    };

    await expect(writePhase697SmallSampleBaseline(root, { fs })).rejects.toThrow(
      'PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PARENT_CHANGED',
    );
    expect(wrote).toBe(false);
    expect(closed).toBe(true);
  });

  test('does not report created when the fixed path changes after durable handle sync', async () => {
    const root = resolve(join(tmpdir(), 'prepmind-small-sample-g1-post-sync-race'));
    const parent = join(root, '.tmp');
    const directoryStat = fakeStat('directory', 3, 30);
    const fileStat = fakeStat('file', 3, 31);
    let parentRealpathChecks = 0;
    let wrote = false;
    let synced = false;
    let closed = false;
    const fs: Phase697SmallSampleBaselineFileSystem = {
      async realpath(path) {
        if (path === parent) {
          parentRealpathChecks += 1;
          return parentRealpathChecks <= 2 ? parent : join(dirname(root), 'swapped-after-sync');
        }
        return path;
      },
      async mkdir() {},
      async lstat(path) {
        return path === parent ? directoryStat : fileStat;
      },
      async openExclusive() {
        return {
          async stat() {
            return fileStat;
          },
          async readFile() {
            return new Uint8Array();
          },
          async writeFile() {
            wrote = true;
          },
          async sync() {
            synced = true;
          },
          async close() {
            closed = true;
          },
        };
      },
      async openReadOnly() {
        throw new Error('unexpected read-only open');
      },
    };

    await expect(writePhase697SmallSampleBaseline(root, { fs })).rejects.toThrow(
      'PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PARENT_CHANGED',
    );
    expect(wrote).toBe(true);
    expect(synced).toBe(true);
    expect(closed).toBe(true);
  });

  test('rejects an existing symlink identity without reading or writing through it', async () => {
    const root = resolve(join(tmpdir(), 'prepmind-small-sample-g1-existing-symlink'));
    const parent = join(root, '.tmp');
    const directoryStat = fakeStat('directory', 2, 20);
    const pathStat = fakeStat('file', 2, 21, true);
    const handleStat = fakeStat('file', 2, 22);
    let read = false;
    let wrote = false;
    let closed = false;
    const fs: Phase697SmallSampleBaselineFileSystem = {
      async realpath(path) {
        return path;
      },
      async mkdir() {},
      async lstat(path) {
        return path === parent ? directoryStat : pathStat;
      },
      async openExclusive() {
        throw Object.assign(new Error('exists'), { code: 'EEXIST' });
      },
      async openReadOnly() {
        return {
          async stat() {
            return handleStat;
          },
          async readFile() {
            read = true;
            return new TextEncoder().encode(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_FILE_BYTES);
          },
          async writeFile() {
            wrote = true;
          },
          async sync() {},
          async close() {
            closed = true;
          },
        };
      },
    };

    await expect(writePhase697SmallSampleBaseline(root, { fs })).rejects.toThrow(
      'PHASE_6_9_7_SMALL_SAMPLE_BASELINE_PATH_IDENTITY_CHANGED',
    );
    expect(read).toBe(false);
    expect(wrote).toBe(false);
    expect(closed).toBe(true);
  });

  test('keeps the new manifest dependency graph free of oracle, candidate, Mock, Live, or Provider imports', () => {
    const manifestSource = readFileSync(
      new URL('../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts', import.meta.url),
      'utf8',
    );
    const imports = [...manifestSource.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)].map(
      (match) => match[1],
    );
    expect(imports).not.toContainEqual(
      expect.stringMatching(/baseline|contract|candidate|mock|live|provider/),
    );
    expect(manifestSource).not.toMatch(/\.env|process\.env|DEEPSEEK_API_KEY/);

    for (const relativePath of [
      '../src/evals/phase-6-9-tutor-organizer-small-sample-manifest.ts',
      '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts',
      '../src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      const dependencyImports = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)].map(
        (match) => match[1],
      );
      expect(dependencyImports).not.toContainEqual(
        expect.stringMatching(/model-candidates|candidate|provider|runtime/u),
      );
      expect(source).not.toMatch(/\.env|process\.env|DEEPSEEK_API_KEY/);
    }

    const candidateDirectory = new URL('../src/model-candidates/', import.meta.url);
    const candidateSource = readdirSync(candidateDirectory)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(new URL(name, candidateDirectory), 'utf8'))
      .join('\n');
    expect(candidateSource).not.toMatch(/tutor-organizer-small-sample/u);

    const cliSource = readFileSync(
      new URL('../scripts/phase-6-9-7-tutor-organizer-small-sample-baseline.ts', import.meta.url),
      'utf8',
    );
    expect(cliSource).not.toMatch(/process\.env|DEEPSEEK|credential|mock|live|provider|candidate/u);
    expect(cliSource).toContain(
      "from '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts'",
    );
  });
});

function buildLiveReport(caseEntries: ReturnType<typeof passingEntries>) {
  return buildPhase697SmallSampleReport({
    runId: RUN_ID,
    runScope: 'branch',
    mode: 'live',
    executorProvenance: 'deepseek_network',
    approvedRunnableSourceCommit: 'a'.repeat(40),
    sourceHashes: sourceHashes(),
    caseEntries,
  });
}

function fakeStat(kind: 'file' | 'directory', dev: number, ino: number, symbolicLink = false) {
  return {
    dev,
    ino,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
    isSymbolicLink: () => symbolicLink,
  };
}

function sourceHashes() {
  return {
    tutorPromptSha256: 'b'.repeat(64),
    tutorSchemaSha256: 'c'.repeat(64),
    tutorMergerSha256: 'd'.repeat(64),
    organizerPromptSha256: 'e'.repeat(64),
    organizerSchemaSha256: 'f'.repeat(64),
    organizerMergerSha256: '1'.repeat(64),
    adapterSha256: '2'.repeat(64),
  } as const;
}

function passingEntries() {
  const tutorById = new Map(phase697V2TutorCases.map((entry) => [entry.id, entry]));
  const organizerById = new Map(phase697V2OrganizerCases.map((entry) => [entry.id, entry]));
  return PHASE_6_9_7_SMALL_SAMPLE_EXPECTED_ENTRIES.map((entry, index) => {
    if (entry.kind === 'guard') {
      return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
        entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
        caseId: entry.caseId,
        agent: entry.agent,
        executionKind: 'guard',
        pairedRunIndex: null,
        disposition: 'not_started_guard',
        failureCategory: 'none',
        strictRuntimeSuccess: false,
        zeroCallVerified: true,
        wire: ZERO_WIRE,
        durationMs: null,
        usage: null,
        semantic: null,
        safety: SAFE,
      });
    }
    const usage = {
      inputTokens: 100,
      outputTokens: 20,
      estimatedCostCny: calculatePhase697SmallSampleCostCny(100, 20),
      pricingProfile: 'deepseek-v4-pro-cny-2026-07-15' as const,
    };
    if (entry.agent === 'tutor') {
      const testCase = tutorById.get(entry.caseId);
      if (!testCase || testCase.expectedRuntimeInvocations !== 1)
        throw new Error('missing Tutor case');
      return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
        entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
        caseId: entry.caseId,
        agent: 'tutor',
        executionKind: 'runtime',
        pairedRunIndex: entry.pairedRunIndex,
        disposition: 'succeeded',
        failureCategory: 'none',
        strictRuntimeSuccess: true,
        zeroCallVerified: false,
        wire: FULL_WIRE,
        durationMs: 100 + index,
        usage,
        semantic: {
          agent: 'tutor',
          observation: {
            caseId: testCase.id,
            expectedIntent: testCase.expected.intent,
            actualIntent: testCase.expected.intent,
            expectedDepth: testCase.expected.depth,
            actualDepth: testCase.expected.depth,
            expectedContextUse: testCase.expected.contextUse,
            actualContextUse: testCase.expected.contextUse,
            expectedGuidingQuestion: testCase.expected.guidingQuestion,
            actualGuidingQuestion: testCase.expected.guidingQuestion,
            expectedFinalAnswer: testCase.expected.finalAnswer,
            actualFinalAnswer: testCase.expected.finalAnswer,
            expectedAnswerStructure: [...testCase.expected.answerStructure],
            actualAnswerStructure: [...testCase.expected.answerStructure],
            validOutput: true,
          },
        },
        safety: SAFE,
      });
    }
    const testCase = organizerById.get(entry.caseId);
    if (!testCase || testCase.expectedRuntimeInvocations !== 1)
      throw new Error('missing Organizer case');
    return PHASE_6_9_7_SMALL_SAMPLE_CASE_ENTRY_SCHEMA.parse({
      entryVersion: 'phase-6.9.7-tutor-organizer-small-sample-entry-v1',
      caseId: entry.caseId,
      agent: 'wrong_question_organizer',
      executionKind: 'runtime',
      pairedRunIndex: entry.pairedRunIndex,
      disposition: 'succeeded',
      failureCategory: 'none',
      strictRuntimeSuccess: true,
      zeroCallVerified: false,
      wire: FULL_WIRE,
      durationMs: 200 + index,
      usage,
      semantic: {
        agent: 'wrong_question_organizer',
        observations: testCase.expected.decisions.map((decision) => ({
          decisionId: `${testCase.id}:q${decision.questionIndex}`,
          expectedSubject: decision.subject,
          actualSubject: decision.subject,
          expectedDeckAction: decision.deckAction,
          actualDeckAction: decision.deckAction,
          expectedDeckIndex: decision.deckIndex ?? null,
          actualDeckIndex: decision.deckIndex ?? null,
          canonicalTopicLabel: decision.canonicalTopicLabel,
          acceptedTopicLabels: [...decision.acceptedTopicLabels],
          actualTopicLabel: decision.canonicalTopicLabel,
          expectedConfidence: decision.confidence,
          actualConfidence: decision.confidence,
          requiredEvidenceCodes: [...decision.requiredEvidenceCodes],
          allowedEvidenceCodes: [...decision.allowedEvidenceCodes],
          actualEvidenceCodes: [...decision.requiredEvidenceCodes],
          validOutput: true,
        })),
      },
      safety: SAFE,
    });
  });
}
