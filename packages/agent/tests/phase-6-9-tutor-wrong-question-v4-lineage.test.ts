import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256 } from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
  PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import { PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import {
  PHASE_6_9_7_V3_JOURNAL_VERSION,
  PHASE_6_9_7_V3_MARKER_SCHEMA,
  PHASE_6_9_7_V3_MARKER_VERSION,
  buildPhase697V3EvidenceEnvelope,
  buildPhase697V3Marker,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
  PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA,
  PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4,
  PHASE_6_9_7_V4_APPROVAL_ENV,
  PHASE_6_9_7_V4_CONFIRMATION,
  PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V4_EVIDENCE_VERSION,
  PHASE_6_9_7_V4_JOURNAL_VERSION,
  PHASE_6_9_7_V4_MARKER_PATH,
  PHASE_6_9_7_V4_MARKER_SCHEMA,
  PHASE_6_9_7_V4_MARKER_VERSION,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_PATH,
  PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
  buildPhase697V4EvidenceEnvelope,
  phase697V4EvidencePath,
  phase697V4JournalPath,
  phase697V4RecoveryClaimPath,
  sha256Phase697V4Stable,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV3 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import { runPhase697TutorOrganizerPairedEvalV4 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v4-paired.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  createPhase697TutorOrganizerV4MockHarness,
  runPhase697TutorOrganizerPairedEval,
  runPhase697TutorOrganizerPairedEvalV2,
  type Phase697TutorEvalResult,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  executePhase697TutorOrganizerV4Cli,
  parsePhase697TutorOrganizerV4Cli,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v4-cli.ts';
import {
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import {
  validatePhase697TutorOrganizerV4EvidenceFile,
  validatePhase697TutorOrganizerV4EvidenceFiles,
  validatePhase697TutorOrganizerV4EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000481';

describe('Phase 6.9.7 V4 independent runner and evidence lineage', () => {
  test('builds a strict fixed-denominator V4 report from the shared guarded scheduler', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV4(
      createPhase697TutorOrganizerV4MockHarness({ runId: RUN_ID }),
    );
    expect(report.runnerVersion).toBe(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4);
    expect(report.identities).toMatchObject({
      tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4,
      organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4,
      tutorPromptContentSha256: PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4,
      organizerPromptContentSha256: PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4,
    });
    expect(report.caseEntries).toHaveLength(72);
    expect(report.counts).toMatchObject({ cases: 72, zeroCall: 24, runtime: 48 });
    expect(report.safety).toMatchObject({ zeroCallVerified: 24, strictRuntimeSuccesses: 48 });
    expect(report.scheduler).toMatchObject({
      guardPhasePassed: true,
      breakerState: 'closed',
      dispatchedPairs: 24,
      completedPairs: 24,
      maxConcurrentPairs: 1,
      maxConcurrentLaneOperations: 2,
    });
    expect(report.ledger).toEqual({ reservedEntries: 48, terminalEntries: 48 });
    expect(report.v4Diagnostics.counts).toEqual({
      notStarted: 24,
      executedContractFailures: 0,
      executedSemanticMismatches: 0,
      executedSemanticMatches: 48,
    });
    expect(
      report.caseEntries.every(
        (entry) => entry.runtimeEvidenceVersion === PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
      ),
    ).toBe(true);
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA.safeParse(report).success).toBe(true);
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse(report).success).toBe(false);
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse(report).success).toBe(false);
  });

  test('preserves 72/24/48 under guard failure and opens the breaker after one failed pair', async () => {
    const guardBase = createPhase697TutorOrganizerV4MockHarness({
      runId: '00000000-0000-4000-8000-000000000482',
    });
    let changed = false;
    let runtimeCalls = 0;
    const guardReport = await runPhase697TutorOrganizerPairedEvalV4({
      ...guardBase,
      async runZeroCall(entry, recorder) {
        const result = await guardBase.runZeroCall(entry, recorder);
        if (changed) return result;
        changed = true;
        return { ...result, observedReason: 'guard_mismatch' };
      },
      async runTutor(entry, recorder, signal) {
        runtimeCalls += 1;
        return guardBase.runTutor(entry, recorder, signal);
      },
      async runOrganizer(entry, recorder, signal) {
        runtimeCalls += 1;
        return guardBase.runOrganizer(entry, recorder, signal);
      },
    });
    expect(runtimeCalls).toBe(0);
    expect(guardReport.caseEntries).toHaveLength(72);
    expect(guardReport.scheduler).toMatchObject({
      breakerState: 'guard_failed',
      dispatchedPairs: 0,
      completedPairs: 0,
    });
    expect(guardReport.execution).toMatchObject({ executorStartedCases: 0, notStartedCases: 72 });

    const breakerBase = createPhase697TutorOrganizerV4MockHarness({
      runId: '00000000-0000-4000-8000-000000000483',
    });
    let tutorCalls = 0;
    let organizerCalls = 0;
    const breakerReport = await runPhase697TutorOrganizerPairedEvalV4({
      ...breakerBase,
      async runTutor(entry, recorder, signal) {
        tutorCalls += 1;
        const result = await breakerBase.runTutor(entry, recorder, signal);
        return entry.pairedRunIndex === 0 ? tutorSchemaFailure(result) : result;
      },
      async runOrganizer(entry, recorder, signal) {
        organizerCalls += 1;
        return breakerBase.runOrganizer(entry, recorder, signal);
      },
    });
    expect(tutorCalls).toBe(1);
    expect(organizerCalls).toBe(1);
    expect(breakerReport.caseEntries).toHaveLength(72);
    expect(breakerReport.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      triggerAgent: 'tutor',
      triggerPairedRunIndex: 0,
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    expect(
      breakerReport.caseEntries.filter(
        (entry) => entry.executionOutcome === 'not_started_quality_breaker',
      ),
    ).toHaveLength(46);
    expect(breakerReport.ledger).toEqual({ reservedEntries: 2, terminalEntries: 2 });
    expect(breakerReport.v4Diagnostics.counts).toEqual({
      notStarted: 70,
      executedContractFailures: 1,
      executedSemanticMismatches: 0,
      executedSemanticMatches: 1,
    });
  });

  test('rejects report and evidence tampering instead of repairing derived fields', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV4(
      createPhase697TutorOrganizerV4MockHarness({
        runId: '00000000-0000-4000-8000-000000000484',
      }),
    );
    const envelope = buildPhase697V4EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    expect(envelope).not.toBeNull();
    expect(PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse(envelope).success).toBe(true);
    expect(validatePhase697TutorOrganizerV4EvidenceValue(envelope)).toEqual({ ok: true });
    for (const tamperedReport of [
      { ...report, runnerVersion: 'phase-6.9.7-tutor-organizer-runner-v3' },
      { ...report, counts: { ...report.counts, totalCases: 71 } },
      {
        ...report,
        caseEntries: report.caseEntries.map((entry, index) =>
          index === 0
            ? { ...entry, runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1' }
            : entry,
        ),
      },
      {
        ...report,
        v4Diagnostics: {
          ...report.v4Diagnostics,
          counts: { ...report.v4Diagnostics.counts, notStarted: 23 },
        },
      },
      { ...report, rawProviderBody: 'forbidden' },
    ]) {
      expect(PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA.safeParse(tamperedReport).success).toBe(
        false,
      );
    }
    if (envelope === null) throw new Error('missing envelope');
    expect(
      validatePhase697TutorOrganizerV4EvidenceValue({
        ...envelope,
        reportSha256: `sha256:${'0'.repeat(64)}`,
      }),
    ).toEqual({ ok: false, code: 'report_contract_invalid' });
    expect(
      validatePhase697TutorOrganizerV4EvidenceValue({
        ...envelope,
        apiKey: 'sk-synthetic-sensitive-canary',
      }),
    ).toEqual({ ok: false, code: 'sensitive_evidence' });
  });

  test('keeps V1/V2/V3 report, validator, marker, and artifact identities bidirectionally isolated', async () => {
    expect(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2).toBe(
      'wrong-question-organizer-model-candidate-v2',
    );
    const v1 = await runPhase697TutorOrganizerPairedEval(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000485',
      }),
    );
    const v2 = await runPhase697TutorOrganizerPairedEvalV2(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000486',
      }),
    );
    const v3 = await runPhase697TutorOrganizerPairedEvalV3(
      createPhase697TutorOrganizerMockHarness({
        runId: '00000000-0000-4000-8000-000000000487',
      }),
    );
    const historyBefore = [v1, v2, v3].map(stableSha256);
    const v4 = await runPhase697TutorOrganizerPairedEvalV4(
      createPhase697TutorOrganizerV4MockHarness({
        runId: '00000000-0000-4000-8000-000000000488',
      }),
    );
    const v4Envelope = buildPhase697V4EvidenceEnvelope({
      report: v4,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    const v3Envelope = buildPhase697V3EvidenceEnvelope({
      report: v3,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    expect(v4Envelope).not.toBeNull();
    expect(v3Envelope).not.toBeNull();
    expect(validatePhase697TutorOrganizerEvidenceValue(v4)).not.toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerV2EvidenceValue(v4)).not.toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerV3EvidenceValue(v4Envelope)).not.toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerV4EvidenceValue(v1)).not.toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerV4EvidenceValue(v2)).not.toEqual({ ok: true });
    expect(validatePhase697TutorOrganizerV4EvidenceValue(v3Envelope)).not.toEqual({ ok: true });
    expect([v1, v2, v3].map(stableSha256)).toEqual(historyBefore);

    const v3Marker = buildPhase697V3Marker({
      runId: '00000000-0000-4000-8000-000000000489',
      runScope: 'branch',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 12345,
    });
    const v4Marker = {
      markerVersion: PHASE_6_9_7_V4_MARKER_VERSION,
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
      datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
      runId: '00000000-0000-4000-8000-000000000490',
      runScope: 'branch',
      mode: 'live',
      executorProvenance: 'synthetic_test',
      ownerProcessId: 12345,
      state: 'attempt_reserved',
    };
    expect(PHASE_6_9_7_V4_MARKER_SCHEMA.safeParse(v4Marker).success).toBe(true);
    expect(PHASE_6_9_7_V3_MARKER_SCHEMA.safeParse(v4Marker).success).toBe(false);
    expect(PHASE_6_9_7_V4_MARKER_SCHEMA.safeParse(v3Marker).success).toBe(false);
    expect(PHASE_6_9_7_V4_MARKER_VERSION).not.toBe(PHASE_6_9_7_V3_MARKER_VERSION);
    expect(PHASE_6_9_7_V4_JOURNAL_VERSION).not.toBe(PHASE_6_9_7_V3_JOURNAL_VERSION);
    expect(PHASE_6_9_7_V4_MARKER_PATH).not.toContain('v3');
    expect(PHASE_6_9_7_V4_RECOVERY_CLAIM_PATH).not.toContain('v3');
    expect(phase697V4JournalPath(v4Marker.runId)).not.toContain('v3');
    expect(phase697V4RecoveryClaimPath(v4Marker.runId)).not.toContain('v3');
    expect(phase697V4JournalPath('invalid')).toBeNull();
    expect(
      phase697V4EvidencePath({ runId: 'invalid', runScope: 'branch', mode: 'mock' }),
    ).toBeNull();
  });

  test('uses only the new approval pair and keeps Live fail-closed before R6', async () => {
    expect(
      parsePhase697TutorOrganizerV4Cli({
        argv: ['live', 'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V3_CONTROLLED_LIVE_ONCE'],
        env: { PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV4Cli({
        argv: ['live', PHASE_6_9_7_V4_CONFIRMATION, 'branch'],
        env: { [PHASE_6_9_7_V4_APPROVAL_ENV]: 'true' },
      }),
    ).toEqual({ ok: true, mode: 'live', runScope: 'branch' });
    expect(
      await executePhase697TutorOrganizerV4Cli({
        argv: ['live', PHASE_6_9_7_V4_CONFIRMATION, 'branch'],
        env: { [PHASE_6_9_7_V4_APPROVAL_ENV]: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_configuration_invalid' });
  });

  test('publishes one exclusive Mock artifact, validates its filename, and rejects duplicate run identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-v4-lineage-'));
    try {
      const input = {
        argv: ['mock', 'branch'],
        env: {},
        repositoryRoot: root,
        runId: '00000000-0000-4000-8000-000000000491',
      } as const;
      const results = await Promise.all([
        executePhase697TutorOrganizerV4Cli(input),
        executePhase697TutorOrganizerV4Cli(input),
      ]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual([
        { ok: false, code: 'evidence_already_exists' },
      ]);
      const success = results.find((result) => result.ok);
      if (!success?.ok) throw new Error('missing Mock evidence success');
      expect(basename(success.evidencePath)).toBe(
        `phase-6-9-7-tutor-organizer-v4-branch-mock-${input.runId}.json`,
      );
      expect(
        await validatePhase697TutorOrganizerV4EvidenceFile({ path: success.evidencePath }),
      ).toEqual({ ok: true });
      expect(await validatePhase697TutorOrganizerV4EvidenceFiles([success.evidencePath])).toEqual({
        ok: true,
      });
      expect(
        await validatePhase697TutorOrganizerV4EvidenceFiles([
          success.evidencePath,
          success.evidencePath,
        ]),
      ).toEqual({ ok: false, code: 'run_identity_invalid' });
      expect(await validatePhase697TutorOrganizerV4EvidenceFiles([])).toEqual({
        ok: false,
        code: 'evidence_read_failed',
      });

      const envelope = JSON.parse(await readFile(success.evidencePath, 'utf8')) as unknown;
      expect(validatePhase697TutorOrganizerV4EvidenceValue(envelope)).toEqual({ ok: true });
      const wrongName = join(root, '.tmp', 'wrong-v4-evidence.json');
      await writeFile(wrongName, `${JSON.stringify(envelope)}\n`, 'utf8');
      expect(await validatePhase697TutorOrganizerV4EvidenceFile({ path: wrongName })).toEqual({
        ok: false,
        code: 'evidence_filename_invalid',
      });
      expect(await readdir(join(root, '.tmp'))).toEqual(
        expect.arrayContaining([basename(success.evidencePath), basename(wrongName)]),
      );
      expect(JSON.stringify(envelope)).toContain(PHASE_6_9_7_V4_EVIDENCE_VERSION);
      expect(sha256Phase697V4Stable((envelope as { report: unknown }).report)).toBe(
        (envelope as { reportSha256: string }).reportSha256,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function tutorSchemaFailure(result: Phase697TutorEvalResult): Phase697TutorEvalResult {
  return {
    ...result,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_schema_invalid',
    canonicalSchemaSuccess: false,
    canonicalDiagnostic: {
      canonicalValidationStage: 'raw_schema',
      canonicalFailureReason: 'schema_invalid',
    },
    observation: { ...result.observation, validOutput: false },
    v3RuntimeEvidence: {
      runtimeEvidenceVersion: 'phase-6.9.7-v3-runtime-evidence-v1',
      runtimeInvocations: 1,
      providerFailureCategory: 'structured_output',
      structuredOutputStage: 'provider_type_validation',
      lastCompletedStage: 'structured_object_captured',
      executionOutcome: 'executed_failure',
      usageDisposition: 'verified',
    },
  };
}

function stableSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
