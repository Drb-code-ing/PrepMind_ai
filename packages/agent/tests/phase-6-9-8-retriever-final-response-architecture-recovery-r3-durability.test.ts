import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, test } from 'bun:test';

import {
  artifactPhase698ArchitectureRecoveryRelativePath,
  isPhase698ArchitectureRecoveryWritableRelativePathForTest,
  journalPhase698ArchitectureRecoveryRelativePath,
  recoveryClaimPhase698ArchitectureRecoveryRelativePath,
  reservePhase698ArchitectureRecoveryAttempt,
  sealPhase698ArchitectureRecoveryInterruptedAttemptForTest,
  validatePhase698ArchitectureRecoveryBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';
import {
  calculatePhase698ArchitectureRecoveryCostCny,
  canonicalPhase698ArchitectureRecoveryJson,
  sha256Phase698ArchitectureRecovery,
  type Phase698ArchitectureRecoveryCallIdentity,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import {
  createPhase698ArchitectureRecoverySyntheticOutcomeForTest,
  runPhase698ArchitectureRecoveryR3,
  type Phase698ArchitectureRecoveryHarness,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import { createPhase698ArchitectureRecoverySyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import { architectureRecoveryDiagnosticSequence } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.8 Architecture Recovery R3 durability', () => {
  test('publishes and independently recomputes a canonical synthetic bundle', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const reservation = await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });
    const report = await runPhase698ArchitectureRecoveryR3({
      runId,
      authority: 'synthetic_test',
      runMode: 'synthetic_fault',
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: harness(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const published = await reservation.publishArtifact(report);
    const validation = await validatePhase698ArchitectureRecoveryBundle({ root });

    expect(validation).toMatchObject({
      ok: true,
      runId,
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
      physicalArtifactSha256: published.evidenceSha256,
    });
    expect(validation.journalRecords).toBeGreaterThan(64 * 8);
    const artifact = JSON.parse(
      await readFile(join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId)), 'utf8'),
    );
    expect(artifact.report.gate.status).toBe('architecture_recovery_synthetic_contract_passed');
    expect(artifact.durability.publicationStrategy).toBe('exclusive_temp_hard_link');
  });

  test('rejects tampered journal bytes, duplicate reservation, and publication conflict', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const reservation = await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });
    await expect(
      reservePhase698ArchitectureRecoveryAttempt({
        root,
        runId: randomUUID(),
        createdAt: new Date().toISOString(),
        reservationCapability:
          createPhase698ArchitectureRecoverySyntheticAdmissionForTest().reservationCapability,
      }),
    ).rejects.toThrow('PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_INVALID');

    const report = await runPhase698ArchitectureRecoveryR3({
      runId,
      authority: 'synthetic_test',
      runMode: 'synthetic_fault',
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: harness(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    await writeFile(join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId)), '{}\n', {
      flag: 'wx',
    });
    await expect(reservation.publishArtifact(report)).rejects.toThrow(
      'PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_INVALID',
    );
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(false);

    const journalPath = join(
      root,
      '.tmp',
      `phase-6-9-8-retriever-final-response-architecture-recovery-${runId}.journal.jsonl`,
    );
    await writeFile(journalPath, `${await readFile(journalPath, 'utf8')}{}\n`);
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(false);
  });

  test('crash-only seal closes the durable prefix without invoking Provider work', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });

    const sealed = await sealPhase698ArchitectureRecoveryInterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    expect(sealed).toMatchObject({ ok: true, runId, disposition: 'crash_only_sealed' });
    const validation = await validatePhase698ArchitectureRecoveryBundle({ root });
    expect(validation).toMatchObject({
      ok: true,
      runId,
      qualityAuthority: 'none',
      finalJournalEvent: 'evidence_published',
    });
    const artifact = JSON.parse(
      await readFile(join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId)), 'utf8'),
    );
    expect(artifact.report.completionMode).toBe('recovery');
    expect(artifact.report.execution.providerExecutions).toBe(0);
    expect(
      artifact.report.callEntries.every((entry: { disposition: string }) =>
        entry.disposition.startsWith('not_started_'),
      ),
    ).toBe(true);
    expect(
      await sealPhase698ArchitectureRecoveryInterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      }),
    ).toEqual({ ok: false, code: 'already_published' });
  });

  test('recovers a complete runtime that crashed after run_terminal but before publication', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const reservation = await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });
    const report = await runPhase698ArchitectureRecoveryR3({
      runId,
      authority: 'synthetic_test',
      runMode: 'synthetic_fault',
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: harness(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    expect(report.completionMode).toBe('runtime');

    const sealed = await sealPhase698ArchitectureRecoveryInterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    expect(sealed).toMatchObject({
      ok: true,
      runId,
      disposition: 'terminal_publication_recovered',
    });
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(true);
    const artifact = JSON.parse(
      await readFile(join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId)), 'utf8'),
    );
    expect(artifact.report.completionMode).toBe('runtime');
    expect(artifact.report.execution.providerExecutions).toBe(64);
    expect(artifact.durability.publicationMode).toBe('recovery');
  });

  test('recovers after publication_started when no artifact was linked', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const reservation = await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });
    const report = await runPhase698ArchitectureRecoveryR3({
      runId,
      authority: 'synthetic_test',
      runMode: 'synthetic_fault',
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: harness(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const artifactPath = join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId));
    await writeFile(artifactPath, '{}\n', { flag: 'wx' });
    await expect(reservation.publishArtifact(report)).rejects.toThrow(
      'PHASE_6_9_8_ARCHITECTURE_RECOVERY_DURABILITY_INVALID',
    );
    await rm(artifactPath);

    const sealed = await sealPhase698ArchitectureRecoveryInterruptedAttemptForTest({
      root,
      isProcessAlive: () => false,
    });
    expect(sealed).toMatchObject({
      ok: true,
      runId,
      disposition: 'terminal_publication_recovered',
    });
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(true);
  });

  test('rejects recovery-claim tail drift even when every downstream hash is recomputed', async () => {
    const root = await tempRoot();
    const runId = randomUUID();
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    await reservePhase698ArchitectureRecoveryAttempt({
      root,
      runId,
      createdAt: new Date().toISOString(),
      reservationCapability: admission.reservationCapability,
    });
    expect(
      await sealPhase698ArchitectureRecoveryInterruptedAttemptForTest({
        root,
        isProcessAlive: () => false,
      }),
    ).toMatchObject({ ok: true, runId, disposition: 'crash_only_sealed' });
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(true);

    await rewriteRecoveryClaimTailAndRehashBundle(root, runId);
    expect((await validatePhase698ArchitectureRecoveryBundle({ root })).ok).toBe(false);
  });

  test('keeps the sealed Task 9C namespace read-only and rejects traversal/foreign lineage paths', async () => {
    expect(
      isPhase698ArchitectureRecoveryWritableRelativePathForTest(
        '.tmp/phase-6-9-8-retriever-final-response-task9c-controlled-live.marker',
      ),
    ).toBe(false);
    expect(
      isPhase698ArchitectureRecoveryWritableRelativePathForTest(
        '.tmp/phase-6-9-8-retriever-final-response-task9c-branch-controlled-live-28b5f92f-7b16-4ec7-b9fa-7a51aa0c2ff2.json',
      ),
    ).toBe(false);
    expect(isPhase698ArchitectureRecoveryWritableRelativePathForTest('../escape.json')).toBe(false);
    expect(
      isPhase698ArchitectureRecoveryWritableRelativePathForTest('.tmp/phase-6-9-7-foreign.marker'),
    ).toBe(false);
    expect(
      isPhase698ArchitectureRecoveryWritableRelativePathForTest(
        `.tmp/phase-6-9-8-retriever-final-response-architecture-recovery-${randomUUID()}.journal.jsonl`,
      ),
    ).toBe(true);
  });
});

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'phase-698-architecture-recovery-r3-'));
  roots.push(root);
  return root;
}

function harness(): Phase698ArchitectureRecoveryHarness {
  return Object.freeze({
    runMode: 'synthetic_fault' as const,
    transportAuthority: 'synthetic_injected' as const,
    async runGuard(testCase) {
      return Object.freeze({
        observedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      });
    },
    async invokeCall({ identity }) {
      return outcome(identity);
    },
  });
}

function outcome(identity: Phase698ArchitectureRecoveryCallIdentity) {
  const usage =
    identity.provider === 'qwen'
      ? { inputTokens: 8, outputTokens: 0 }
      : { inputTokens: 80, outputTokens: 8 };
  const diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic = Object.freeze({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase: identity.phase,
    stage: 'applied',
    reasonCode: 'applied',
    providerBoundary: 'response_and_usage_observed',
    topLevelTypeBucket: 'object',
    fieldCountBucket: '1',
    terminalCountBucket: identity.phase === 'final_response_model' ? '1' : 'not_applicable',
    rawDataRetained: false,
  });
  const result =
    identity.phase === 'rewrite_candidate_model'
      ? {
          phase: identity.phase,
          executedQuery: 'synthetic bounded query',
          intentPreserved: true,
          unsafeRewrite: false,
        }
      : identity.phase === 'final_response_model'
        ? {
            phase: identity.phase,
            responseTextHash: `sha256:${'b'.repeat(64)}`,
            terminal: 'response_completed' as const,
            terminalCount: 1 as const,
            terminalLast: true as const,
            grounded: true,
            noticeSatisfied: true,
            requiredCitationCount: 1,
            observedCitationCount: 1,
            citationTruePositiveCount: 1,
            falseToolSuccess: false,
            falseCitation: false,
            ttftMs: 5,
            totalMs: 10,
            endToEndMs: 15,
          }
        : {
            phase: identity.phase,
            targetRank: 1,
            recallAt5: 1,
            ndcgAt5: identity.phase === 'rewrite_original_retrieval' ? 0.8 : 1,
          };
  return createPhase698ArchitectureRecoverySyntheticOutcomeForTest({
    identity,
    diagnostic,
    diagnosticStages: architectureRecoveryDiagnosticSequence(identity.phase),
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    usage,
    verifiedCostCny: calculatePhase698ArchitectureRecoveryCostCny(identity.provider, usage)!,
    result,
  });
}

async function rewriteRecoveryClaimTailAndRehashBundle(root: string, runId: string) {
  const claimPath = join(root, recoveryClaimPhase698ArchitectureRecoveryRelativePath(runId));
  const journalPath = join(root, journalPhase698ArchitectureRecoveryRelativePath(runId));
  const artifactPath = join(root, artifactPhase698ArchitectureRecoveryRelativePath(runId));
  const claim = JSON.parse(await readFile(claimPath, 'utf8')) as Record<string, unknown>;
  const records = (await readFile(journalPath, 'utf8'))
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8')) as Record<string, unknown> & {
    durability: {
      recoveryClaimSha256: string;
      terminalRecordHash: string;
    };
  };
  const claimIndex = records.findIndex((record) => record.event === 'recovery_claimed');
  const terminalIndex = records.findIndex((record) => record.event === 'run_terminal');
  const evidenceIndex = records.findIndex((record) => record.event === 'evidence_published');
  if (claimIndex < 1 || terminalIndex < claimIndex || evidenceIndex < terminalIndex) {
    throw new Error('TEST_RECOVERY_BUNDLE_INVALID');
  }

  claim.journalTailRecordHash = 'f'.repeat(64);
  const claimBytes = `${JSON.stringify(claim)}\n`;
  const claimSha256 = sha256Bytes(claimBytes);
  records[claimIndex]!.claimSha256 = claimSha256;
  rehashRecords(records, claimIndex);

  artifact.durability.recoveryClaimSha256 = claimSha256;
  artifact.durability.terminalRecordHash = records[terminalIndex]!.recordHash;
  const artifactBytes = `${JSON.stringify(artifact)}\n`;
  records[evidenceIndex]!.evidenceSha256 = sha256Bytes(artifactBytes);
  rehashRecords(records, evidenceIndex);

  await writeFile(claimPath, claimBytes);
  await writeFile(artifactPath, artifactBytes);
  await writeFile(journalPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
}

function rehashRecords(records: Array<Record<string, unknown>>, startIndex: number) {
  for (let index = startIndex; index < records.length; index += 1) {
    const record = records[index]!;
    record.previousHash = index === 0 ? null : records[index - 1]!.recordHash;
    const { recordHash: _recordHash, ...unsigned } = record;
    record.recordHash = sha256Phase698ArchitectureRecovery(
      canonicalPhase698ArchitectureRecoveryJson(unsigned),
    );
  }
}

function sha256Bytes(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
