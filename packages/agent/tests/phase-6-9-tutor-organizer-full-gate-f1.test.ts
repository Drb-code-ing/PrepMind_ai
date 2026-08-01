import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA } from '../../ai/src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA } from '../../ai/src/phase-6-9-7-architecture-recovery-r3-canary-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_RELATIVE_PATH,
  PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT,
  PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
  PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_AUTHORITY_SHA256,
  PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_FILE_SHA256,
  PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_REPORT_SHA256,
  PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256,
  buildPhase697FullGateDeterministicBaseline,
  validatePhase697FullGateBaselineFile,
  validatePhase697FullGateSourceCoverage,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts';
import {
  PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_FULL_GATE_ENTRY_VERSION,
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY,
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
  PHASE_6_9_7_FULL_GATE_FROZEN_EVAL_POLICY_SHA256,
  PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA,
  PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
  calculatePhase697FullGateCostCny,
  calculatePhase697FullGateNearestRankP95,
  buildPhase697FullGateReport,
  parsePhase697FullGateReport,
  type Phase697FullGateCaseEntry,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES,
  PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_7_FULL_GATE_LINEAGE,
  PHASE_6_9_7_FULL_GATE_MANIFEST,
  PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256,
  canonicalPhase697FullGateJson,
  validatePhase697FullGateManifest,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import { PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT } from '../src/evals/phase-6-9-tutor-organizer-small-sample-baseline.ts';
import { parsePhase697SmallSampleReport } from '../src/evals/phase-6-9-tutor-organizer-small-sample-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v8-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  runPhase697V2DeterministicOrganizerCase,
  runPhase697V2DeterministicTutorCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  phase697V2OrganizerCases,
  phase697V2TutorCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  type Phase697FullGateBaselineFileSystem,
  writePhase697FullGateBaseline,
} from '../scripts/phase-6-9-7-tutor-organizer-full-gate-baseline.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000f01';
const SOURCE_COMMIT = '1111111111111111111111111111111111111111';
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
const CLEAR_SAFETY = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
  lockedNameChanged: false,
  writeCommandLeaked: false,
});
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 F1 full-gate zero-provider contracts', () => {
  test('reconstructs the exact full manifest and frozen source coverage', () => {
    expect(PHASE_6_9_7_FULL_GATE_LINEAGE).toBe('phase-6.9.7-tutor-organizer-full-gate-v1');
    expect(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256,
    );
    expect(PHASE_6_9_7_FULL_GATE_MANIFEST_SHA256).toBe(
      'e68e6e27211f4fdfb4a0ac35d4295693b33466163b0aefa4aa14b3b97ae12c78',
    );
    expect(validatePhase697FullGateManifest(PHASE_6_9_7_FULL_GATE_MANIFEST)).toEqual({
      ok: true,
    });
    expect(validatePhase697FullGateSourceCoverage()).toEqual({ ok: true });
    expect(PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES).toHaveLength(72);
    expect(new Set(PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.map((entry) => entry.caseId)).size).toBe(
      72,
    );
    expect(PHASE_6_9_7_FULL_GATE_MANIFEST.runtimePairs.map((pair) => pair.pairedRunIndex)).toEqual(
      Array.from({ length: 24 }, (_, index) => index),
    );
    expect(Object.isFrozen(PHASE_6_9_7_FULL_GATE_MANIFEST)).toBe(true);
  });

  test('recomputes and freezes distinct authority, logical report, and physical file hashes', () => {
    const fresh = buildPhase697FullGateDeterministicBaseline();
    expect(fresh).toEqual(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT);
    expect(PHASE_6_9_7_FULL_GATE_SOURCE_DETERMINISTIC_BASELINE_SHA256).toBe(
      '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca',
    );
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_AUTHORITY_SHA256,
    );
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_AUTHORITY_SHA256).toBe(
      '2ab1030f352096d995527e85b415a33c2111576aee3a786f8958593ecc5ba5f2',
    );
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_REPORT_SHA256,
    );
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_FROZEN_BASELINE_FILE_SHA256,
    );
    expect(PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256).not.toBe(
      PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
    );
    expect(validatePhase697FullGateBaselineFile(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES)).toEqual(
      {
        ok: true,
        reportLogicalSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
        physicalFileSha256: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
      },
    );
    expect(Object.isFrozen(fresh)).toBe(true);
  });

  test('rejects baseline byte, CRLF, logical payload, and source coverage drift', () => {
    expect(
      validatePhase697FullGateBaselineFile(
        PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES.replace(/\n/g, '\r\n'),
      ),
    ).toEqual({ ok: false, code: 'authority_mismatch' });
    const canonicalBytes = new TextEncoder().encode(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES);
    const bytesWithBom = new Uint8Array(canonicalBytes.length + 3);
    bytesWithBom.set([0xef, 0xbb, 0xbf]);
    bytesWithBom.set(canonicalBytes, 3);
    expect(validatePhase697FullGateBaselineFile(bytesWithBom)).toEqual({
      ok: false,
      code: 'authority_mismatch',
    });
    const tampered = JSON.parse(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES) as {
      report: { authority: { providerInvocations: number } };
    };
    tampered.report.authority.providerInvocations = 1;
    expect(validatePhase697FullGateBaselineFile(`${JSON.stringify(tampered, null, 2)}\n`).ok).toBe(
      false,
    );
    expect(
      validatePhase697FullGateSourceCoverage({ tutorCases: phase697V2TutorCases.slice(1) }),
    ).toEqual({ ok: false, issues: expect.arrayContaining(['case_count_mismatch']) });
  });

  test('freezes the exact policy, P95 rank, model, budgets, and no-retry execution boundary', () => {
    expect(PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256).toBe(
      PHASE_6_9_7_FULL_GATE_FROZEN_EVAL_POLICY_SHA256,
    );
    expect(PHASE_6_9_7_FULL_GATE_EVAL_POLICY).toMatchObject({
      counts: { guards: 24, runtimePairs: 24, runtimeLanes: 48, organizerDecisionUnits: 32 },
      model: {
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        thinking: false,
        structuredOutput: 'json_object',
        tools: false,
        retries: 0,
      },
      latency: {
        samplesPerSeries: 24,
        requiredNearestRankOneBased: 23,
        tutorCandidateP95MaxMs: 2500,
        organizerCandidateP95MaxMs: 4500,
        pairedCandidateP95MaxMs: 4500,
        tutorOrchestrationP95MaxMs: 6500,
        tutorHardTimeoutMs: 3500,
        organizerHardTimeoutMs: 5000,
      },
      budget: {
        providerCallsMax: 48,
        inputTokensMax: 112800,
        outputTokensMax: 26400,
        totalCostCnyMax: 0.55,
      },
      execution: { retry: 0, resume: 0, replay: 0, backfill: 0 },
    });
    expect(
      calculatePhase697FullGateNearestRankP95(Array.from({ length: 24 }, (_, i) => i + 1)),
    ).toBe(23);
    expect(() =>
      calculatePhase697FullGateNearestRankP95(Array.from({ length: 23 }, (_, i) => i)),
    ).toThrow('PHASE_6_9_7_FULL_GATE_P95_INPUT_INVALID');
    expect(Object.isFrozen(PHASE_6_9_7_FULL_GATE_EVAL_POLICY)).toBe(true);
    expect(Object.isFrozen(PHASE_6_9_7_FULL_GATE_SOURCE_HASHES)).toBe(true);
  });

  test('derives complete full and L2-anchor semantic gates plus exact 24-sample P95', () => {
    const report = passingReport('live', 'deepseek_network');
    expect(report.gate).toBe('full_gate_quality_gate_passed');
    expect(report.qualityAuthority).toBe('full_gate_semantic_gate');
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      orphanedEntries: 0,
      notStartedEntries: 0,
    });
    expect(report.wire).toEqual({
      complete: true,
      executorEntered: 48,
      providerDispatchStarted: 48,
      providerResponseReceived: 48,
      verifiedUsageObserved: 48,
    });
    expect(report.metrics).toMatchObject({
      complete: true,
      strictRuntimeSuccesses: 48,
      tutorSemanticScore: 1,
      organizerSemanticScore: 1,
      combinedSemanticScore: 1,
      tutorInvalidCases: 0,
      organizerInvalidDecisions: 0,
      l2AnchorSubset: {
        complete: true,
        tutorSemanticScore: 1,
        organizerSemanticScore: 1,
        combinedSemanticScore: 1,
        passed: true,
      },
    });
    expect(report.latency).toEqual({
      complete: true,
      tutorSampleCount: 24,
      organizerSampleCount: 24,
      pairedSampleCount: 24,
      tutorOrchestrationSampleCount: 24,
      tutorCandidateP95Ms: 122,
      organizerCandidateP95Ms: 222,
      pairedCandidateP95Ms: 222,
      tutorOrchestrationP95Ms: 322,
    });
    expect(report.usage).toMatchObject({
      complete: true,
      providerInvocations: 48,
      verifiedRuntimeCases: 48,
      inputTokens: 4800,
      outputTokens: 960,
      estimatedCostCny: 0.02016,
    });
    expect(parsePhase697FullGateReport(report)).toEqual(report);
    expect(Object.isFrozen(report)).toBe(true);
  });

  test('never upgrades Mock or synthetic provenance into quality authority', () => {
    const mock = passingReport('mock', 'mock_synthetic');
    expect(mock.gate).toBe('full_gate_mock_quality_not_evidence');
    expect(mock.qualityAuthority).toBe('none');
    expect(mock.metrics.complete).toBe(true);
    const synthetic = passingReport('live', 'synthetic_test');
    expect(synthetic.gate).toBe('full_gate_quality_gate_failed');
    expect(synthetic.qualityAuthority).toBe('none');
  });

  test('nulls semantic, anchor, P95, token, and CNY aggregates on an incomplete denominator', () => {
    const entries = breakAfterFirstPair(passingEntries());
    const report = buildPhase697FullGateReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: SOURCE_COMMIT,
      caseEntries: entries,
    });
    expect(report.gate).toBe('full_gate_quality_gate_failed');
    expect(report.qualityAuthority).toBe('none');
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(report.metrics).toMatchObject({
      complete: false,
      tutorSemanticScore: null,
      organizerSemanticScore: null,
      combinedSemanticScore: null,
      tutorAbsoluteImprovement: null,
      organizerAbsoluteImprovement: null,
      l2AnchorSubset: {
        complete: false,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
        passed: false,
      },
    });
    expect(report.latency).toMatchObject({
      complete: false,
      tutorCandidateP95Ms: null,
      organizerCandidateP95Ms: null,
      pairedCandidateP95Ms: null,
      tutorOrchestrationP95Ms: null,
    });
    expect(report.usage).toMatchObject({
      complete: false,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCny: null,
    });
    expect(report.breaker).toEqual({ opened: true, reason: 'transport' });
  });

  test('keeps semantic mismatches non-breaking while failing both the full and anchor-aware quality decision', () => {
    const entries = passingEntries();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (
        entry?.agent === 'tutor' &&
        entry.pairedRunIndex !== null &&
        [0, 7, 9, 11, 14, 18, 22, 23].includes(entry.pairedRunIndex) &&
        entry.semantic?.agent === 'tutor'
      ) {
        const observation = entry.semantic.observation;
        const actualIntent =
          observation.expectedIntent === 'explain_solution' ? 'socratic_hint' : 'explain_solution';
        entries[index] = PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
          ...entry,
          semantic: {
            agent: 'tutor',
            observation: { ...observation, actualIntent },
          },
        });
      }
    }
    const report = buildPhase697FullGateReport({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'deepseek_network',
      approvedRunnableSourceCommit: SOURCE_COMMIT,
      caseEntries: entries,
    });
    expect(report.gate).toBe('full_gate_quality_gate_failed');
    expect(report.metrics.l2AnchorSubset.passed).toBe(false);
    expect(report.breaker).toEqual({ opened: false, reason: null });
  });

  test('rejects aggregate self-reporting, lane caps, source identity drift, and mode mismatch', () => {
    const report = passingReport('live', 'deepseek_network');
    const aggregateTamper = structuredClone(report);
    aggregateTamper.latency.tutorCandidateP95Ms = 1;
    expect(PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.safeParse(aggregateTamper).success).toBe(false);

    const sourceTamper = structuredClone(report);
    sourceTamper.sourceHashes.adapterSha256 = '0'.repeat(64);
    expect(PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.safeParse(sourceTamper).success).toBe(false);

    expect(() =>
      buildPhase697FullGateReport({
        runId: RUN_ID,
        runScope: 'branch',
        mode: 'mock',
        executorProvenance: 'deepseek_network',
        approvedRunnableSourceCommit: SOURCE_COMMIT,
        caseEntries: passingEntries(),
      }),
    ).toThrow();

    const tutor = passingEntries().find((entry) => entry.caseId === 'tutor-v2-runtime-01');
    expect(tutor).toBeDefined();
    expect(
      PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.safeParse({
        ...tutor,
        usage: {
          inputTokens: 1201,
          outputTokens: 20,
          estimatedCostCny: calculatePhase697FullGateCostCny(1201, 20),
          pricingProfile: 'deepseek-v4-pro-cny-2026-07-15',
        },
      }).success,
    ).toBe(false);
  });

  test('enforces bidirectional rejection against V1-V9, recovery, canary, and small-sample lineages', () => {
    const full = passingReport('mock', 'mock_synthetic');
    const oldSchemas = [
      PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA,
      PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA,
    ];
    for (const schema of oldSchemas) expect(schema.safeParse(full).success).toBe(false);
    expect(parsePhase697SmallSampleReport(full)).toBeNull();
    expect(parsePhase697FullGateReport(PHASE_6_9_7_SMALL_SAMPLE_BASELINE_REPORT)).toBeNull();
    expect(
      parsePhase697FullGateReport({
        reportVersion: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-report-v1',
        runId: 'dc09214c-0300-4153-8273-e548ac768d20',
      }),
    ).toBeNull();
    const priorRun = structuredClone(full);
    priorRun.runId = '6918df4f-a4ae-4de0-aa21-c7614ed5861d';
    expect(PHASE_6_9_7_FULL_GATE_REPORT_SCHEMA.safeParse(priorRun).success).toBe(false);
    expect(parsePhase697FullGateReport(priorRun)).toBeNull();
  });

  test('writes only exact baseline bytes, reuses them, and fails closed on conflict', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-full-gate-f1-'));
    roots.push(root);
    const created = await writePhase697FullGateBaseline(root);
    expect(created).toEqual({
      disposition: 'created',
      relativePath: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_RELATIVE_PATH,
      reportLogicalSha256: PHASE_6_9_7_FULL_GATE_BASELINE_REPORT_SHA256,
      physicalFileSha256: PHASE_6_9_7_FULL_GATE_BASELINE_FILE_SHA256,
    });
    const path = join(root, PHASE_6_9_7_FULL_GATE_BASELINE_FILE_RELATIVE_PATH);
    expect(await readFile(path, 'utf8')).toBe(PHASE_6_9_7_FULL_GATE_BASELINE_FILE_BYTES);
    expect((await writePhase697FullGateBaseline(root)).disposition).toBe('same_bytes');
    await writeFile(path, '{}\n', 'utf8');
    await expect(writePhase697FullGateBaseline(root)).rejects.toThrow(
      'PHASE_6_9_7_FULL_GATE_BASELINE_CONFLICT',
    );
  });

  test('fails closed when the writer observes a parent identity change', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-full-gate-f1-race-'));
    roots.push(root);
    const baseFs = await import('node:fs/promises');
    let parentChecks = 0;
    const fs: Phase697FullGateBaselineFileSystem = {
      realpath: async (path) => {
        const resolved = await baseFs.realpath(path);
        if (path.endsWith('.tmp')) {
          parentChecks += 1;
          if (parentChecks >= 2) return `${resolved}-changed`;
        }
        return resolved;
      },
      async mkdir(path) {
        await baseFs.mkdir(path, { recursive: true });
      },
      lstat: (path) => baseFs.lstat(path),
      async openExclusive(path) {
        const handle = await baseFs.open(path, 'wx', 0o600);
        return {
          stat: () => handle.stat(),
          readFile: () => handle.readFile(),
          writeFile: async (contents) => {
            await handle.writeFile(contents, 'utf8');
          },
          sync: () => handle.sync(),
          close: () => handle.close(),
        };
      },
      async openReadOnly(path) {
        const handle = await baseFs.open(path, 'r');
        return {
          stat: () => handle.stat(),
          readFile: () => handle.readFile(),
          writeFile: async (contents) => {
            await handle.writeFile(contents, 'utf8');
          },
          sync: () => handle.sync(),
          close: () => handle.close(),
        };
      },
    };
    await expect(writePhase697FullGateBaseline(root, { fs })).rejects.toThrow(
      'PHASE_6_9_7_FULL_GATE_BASELINE_PARENT_CHANGED',
    );
  });

  test('keeps F1 sources free of credential, Provider execution, and formal Live durability paths', async () => {
    const allowedImports = new Map<string, readonly string[]>([
      ['../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts', ['node:crypto', 'zod']],
      [
        '../src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts',
        [
          './phase-6-9-tutor-organizer-full-gate-manifest.ts',
          './phase-6-9-tutor-wrong-question-v2-baseline.ts',
          './phase-6-9-tutor-wrong-question-v2-cases.ts',
          './phase-6-9-tutor-wrong-question-v5-policy.ts',
          'node:crypto',
          'zod',
        ],
      ],
      [
        '../src/evals/phase-6-9-tutor-organizer-full-gate-contract.ts',
        [
          './phase-6-9-tutor-organizer-full-gate-baseline.ts',
          './phase-6-9-tutor-organizer-full-gate-manifest.ts',
          './phase-6-9-tutor-wrong-question-metrics.ts',
          './phase-6-9-tutor-wrong-question-v2-cases.ts',
          'zod',
        ],
      ],
      [
        '../scripts/phase-6-9-7-tutor-organizer-full-gate-baseline.ts',
        [
          '../src/evals/phase-6-9-tutor-organizer-full-gate-baseline.ts',
          'node:fs/promises',
          'node:path',
          'node:url',
        ],
      ],
    ]);
    for (const [relativePath, expectedImports] of allowedImports) {
      const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
      expect(source).not.toMatch(
        /process\.env|DEEPSEEK_API_KEY|globalThis\.fetch|fetch\s*\(|node:https?|import\s*\(|import\s+['"]|require\s*\(|controlled-live\.marker|journal\.jsonl|recovery\.claim/u,
      );
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/gu)]
        .map((match) => match[1] ?? '')
        .sort();
      expect(imports).toEqual([...expectedImports].sort());
    }

    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('F1_NETWORK_FORBIDDEN');
    }) as typeof fetch;
    try {
      buildPhase697FullGateDeterministicBaseline();
      passingReport('mock', 'mock_synthetic');
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(fetchCalls).toBe(0);
  });
});

function passingReport(
  mode: 'mock' | 'live',
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test',
) {
  return buildPhase697FullGateReport({
    runId: RUN_ID,
    runScope: 'branch',
    mode,
    executorProvenance,
    approvedRunnableSourceCommit: SOURCE_COMMIT,
    caseEntries: passingEntries(),
  });
}

function passingEntries(): Phase697FullGateCaseEntry[] {
  return PHASE_6_9_7_FULL_GATE_EXPECTED_ENTRIES.map((expected) => {
    if (expected.kind === 'guard') {
      return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
        entryVersion: PHASE_6_9_7_FULL_GATE_ENTRY_VERSION,
        caseId: expected.caseId,
        agent: expected.agent,
        executionKind: 'guard',
        pairedRunIndex: null,
        disposition: 'not_started_guard',
        failureCategory: 'none',
        strictRuntimeSuccess: false,
        zeroCallVerified: true,
        wire: ZERO_WIRE,
        durationMs: null,
        orchestrationDurationMs: null,
        usage: null,
        semantic: null,
        safety: CLEAR_SAFETY,
      });
    }
    const pairedRunIndex = expected.pairedRunIndex ?? 0;
    const inputTokens = 100;
    const outputTokens = 20;
    const semantic =
      expected.agent === 'tutor'
        ? buildPerfectTutorSemantic(expected.caseId)
        : buildPerfectOrganizerSemantic(expected.caseId);
    return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
      entryVersion: PHASE_6_9_7_FULL_GATE_ENTRY_VERSION,
      caseId: expected.caseId,
      agent: expected.agent,
      executionKind: 'runtime',
      pairedRunIndex,
      disposition: 'succeeded',
      failureCategory: 'none',
      strictRuntimeSuccess: true,
      zeroCallVerified: false,
      wire: FULL_WIRE,
      durationMs: (expected.agent === 'tutor' ? 100 : 200) + pairedRunIndex,
      orchestrationDurationMs: expected.agent === 'tutor' ? 300 + pairedRunIndex : null,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostCny: calculatePhase697FullGateCostCny(inputTokens, outputTokens),
        pricingProfile: 'deepseek-v4-pro-cny-2026-07-15',
      },
      semantic,
      safety: CLEAR_SAFETY,
    });
  });
}

function buildPerfectTutorSemantic(caseId: string) {
  const testCase = phase697V2TutorCases.find((candidate) => candidate.id === caseId);
  if (!testCase || testCase.expectedRuntimeInvocations !== 1) throw new Error('missing tutor case');
  const observation = runPhase697V2DeterministicTutorCase(testCase).observation;
  return {
    agent: 'tutor' as const,
    observation: {
      ...observation,
      actualIntent: observation.expectedIntent,
      actualDepth: observation.expectedDepth,
      actualContextUse: observation.expectedContextUse,
      actualGuidingQuestion: observation.expectedGuidingQuestion,
      actualFinalAnswer: observation.expectedFinalAnswer,
      actualAnswerStructure: [...observation.expectedAnswerStructure],
      validOutput: true,
    },
  };
}

function buildPerfectOrganizerSemantic(caseId: string) {
  const testCase = phase697V2OrganizerCases.find((candidate) => candidate.id === caseId);
  if (!testCase || testCase.expectedRuntimeInvocations !== 1)
    throw new Error('missing organizer case');
  const observations = runPhase697V2DeterministicOrganizerCase(testCase).observations.map(
    (observation) => ({
      ...observation,
      actualSubject: observation.expectedSubject,
      actualDeckAction: observation.expectedDeckAction,
      actualDeckIndex: observation.expectedDeckIndex,
      actualTopicLabel: observation.canonicalTopicLabel,
      actualConfidence: observation.expectedConfidence,
      actualEvidenceCodes: [...observation.requiredEvidenceCodes],
      validOutput: true,
    }),
  );
  return { agent: 'wrong_question_organizer' as const, observations };
}

function breakAfterFirstPair(
  input: readonly Phase697FullGateCaseEntry[],
): Phase697FullGateCaseEntry[] {
  return input.map((entry) => {
    if (entry.executionKind !== 'runtime') return entry;
    if (entry.pairedRunIndex === 0 && entry.agent === 'tutor') {
      return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
        ...entry,
        disposition: 'attempted_failed',
        failureCategory: 'transport',
        strictRuntimeSuccess: false,
        wire: {
          executorEntered: 1,
          providerDispatchStarted: 1,
          providerResponseReceived: 0,
          verifiedUsageObserved: 0,
        },
        usage: null,
        semantic: null,
      });
    }
    if ((entry.pairedRunIndex ?? 0) > 0) {
      return PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA.parse({
        ...entry,
        disposition: 'not_started_quality_breaker',
        failureCategory: 'quality_breaker',
        strictRuntimeSuccess: false,
        wire: ZERO_WIRE,
        durationMs: null,
        orchestrationDurationMs: null,
        usage: null,
        semantic: null,
      });
    }
    return entry;
  });
}

test('canonical full-gate JSON preserves arrays and rejects unsupported roots', () => {
  expect(canonicalPhase697FullGateJson({ z: 1, a: [2, 1] })).toBe('{"a":[2,1],"z":1}');
});
