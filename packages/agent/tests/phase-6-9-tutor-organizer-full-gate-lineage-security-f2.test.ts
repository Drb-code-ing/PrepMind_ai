import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA,
} from '@repo/ai';
import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA,
  PHASE_6_9_7_FULL_GATE_ARTIFACT_VERSION,
  PHASE_6_9_7_FULL_GATE_DURABILITY_VERSION,
  PHASE_6_9_7_FULL_GATE_MARKER_SCHEMA,
  PHASE_6_9_7_FULL_GATE_MARKER_VERSION,
  recoveryClaimRelativePath,
  sealPhase697FullGateInterruptedAttemptForTest,
  validatePhase697FullGateBundle,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import {
  PHASE_6_9_7_FULL_GATE_LINEAGE,
  computePhase697FullGateCanonicalSha256,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-manifest.ts';
import { runPhase697TutorOrganizerFullGate } from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';
import {
  F2_CREATED_AT,
  F2_RUN_ID,
  createF2PassingEntries,
  createF2PassingReport,
  createF2Source,
  createF2SuccessHarness,
  reserveF2SyntheticAttempt,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';

describe('Phase 6.9.7 full-gate F2 crash and lineage isolation', () => {
  test('binds marker authority, provenance, and quality authority without cross-upgrade', () => {
    const source = createF2Source();
    const marker = {
      markerVersion: PHASE_6_9_7_FULL_GATE_MARKER_VERSION,
      durabilityVersion: PHASE_6_9_7_FULL_GATE_DURABILITY_VERSION,
      lineage: PHASE_6_9_7_FULL_GATE_LINEAGE,
      authority: 'synthetic_test' as const,
      mode: 'live' as const,
      executorProvenance: 'synthetic_test' as const,
      runId: F2_RUN_ID,
      runScope: 'branch' as const,
      createdAt: F2_CREATED_AT,
      ownerProcessId: 999_971,
      ownerToken: '11111111-1111-4111-8111-111111111111',
      source,
      proxy: {
        version: 'phase-6.9.7-tutor-organizer-full-gate-proxy-attestation-v1' as const,
        status: 'direct_ready' as const,
        providerCalls: 0 as const,
      },
    };
    expect(PHASE_6_9_7_FULL_GATE_MARKER_SCHEMA.safeParse(marker).success).toBe(true);
    expect(
      PHASE_6_9_7_FULL_GATE_MARKER_SCHEMA.safeParse({
        ...marker,
        executorProvenance: 'deepseek_network',
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_FULL_GATE_MARKER_SCHEMA.safeParse({
        ...marker,
        authority: 'controlled_live',
      }).success,
    ).toBe(false);

    const artifact = validSyntheticArtifact();
    expect(artifact.qualityAuthority).toBe('none');
    expect(
      PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA.safeParse({
        ...artifact,
        qualityAuthority: 'full_gate_semantic_gate',
      }).success,
    ).toBe(false);
  });

  test('is rejected by R3 and Canary V2 artifacts and rejects their lineage tokens', () => {
    const artifact = validSyntheticArtifact();

    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA.safeParse(artifact).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.safeParse(artifact)
        .success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA.safeParse({
        ...artifact,
        lineage: 'phase-6.9.7-tutor-organizer-v9',
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA.safeParse({
        ...artifact,
        report: {
          ...artifact.report,
          lineage: 'phase-6.9.7-architecture-recovery-provider-canary-v2',
        },
      }).success,
    ).toBe(false);
  });

  test('ignores unrelated historical filenames but rejects a claim tail rewrite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-full-gate-f2-lineage-'));
    try {
      const reservation = await reserveF2SyntheticAttempt(root);
      const source = createF2Source();
      const report = await runPhase697TutorOrganizerFullGate({
        runId: F2_RUN_ID,
        runScope: 'branch',
        approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
        sourceHashes: source.sourceHashes,
        harness: createF2SuccessHarness(),
        lifecycle: reservation.lifecycle,
        signal: new AbortController().signal,
      });
      await reservation.publishArtifact(report);
      await writeFile(
        resolve(
          root,
          '.tmp',
          'phase-6-9-7-tutor-organizer-v9-branch-controlled-live-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
        ),
        '{}\n',
        'utf8',
      );
      await writeFile(
        resolve(
          root,
          '.tmp',
          'phase-6-9-7-architecture-recovery-provider-canary-v2-branch-controlled-live-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json',
        ),
        '{}\n',
        'utf8',
      );
      expect((await validatePhase697FullGateBundle({ root })).ok).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    const recoveryRoot = await mkdtemp(join(tmpdir(), 'prepmind-full-gate-f2-tail-'));
    try {
      const reservation = await reserveF2SyntheticAttempt(recoveryRoot);
      for (const entry of createF2PassingEntries().filter(
        (candidate) => candidate.executionKind === 'guard',
      )) {
        await reservation.lifecycle.appendGuardTerminal(entry);
      }
      const sealed = await sealPhase697FullGateInterruptedAttemptForTest({
        root: recoveryRoot,
        processAlive: () => false,
      });
      expect(sealed.ok).toBe(true);
      expect((await validatePhase697FullGateBundle({ root: recoveryRoot })).ok).toBe(true);

      const claimPath = resolve(recoveryRoot, recoveryClaimRelativePath(F2_RUN_ID));
      const claim = JSON.parse(await readFile(claimPath, 'utf8')) as Record<string, unknown>;
      claim.journalTailRecordHash = '0'.repeat(64);
      await writeFile(claimPath, `${JSON.stringify(claim)}\n`, 'utf8');
      expect((await validatePhase697FullGateBundle({ root: recoveryRoot })).ok).toBe(false);
    } finally {
      await rm(recoveryRoot, { recursive: true, force: true });
    }
  });

  test('keeps crash-only seal source free of env, credential, transport, retry, and Provider calls', async () => {
    const source = await readFile(
      new URL('../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts', import.meta.url),
      'utf8',
    );
    const start = source.indexOf('async function sealInterruptedAttempt(');
    const end = source.indexOf('\nfunction recoveryState(', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const crashSeal = source.slice(start, end);
    for (const forbidden of [
      'process.env',
      'readCredential',
      'readApproval',
      'runPhase697FullGateProductionProxyPreflight',
      'createPhase697FullGateLiveHarness',
      'fetch(',
      'retry',
      'resume',
      'replayProvider',
    ]) {
      expect(crashSeal).not.toContain(forbidden);
    }
  });
});

function validSyntheticArtifact() {
  const report = createF2PassingReport();
  return PHASE_6_9_7_FULL_GATE_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_7_FULL_GATE_ARTIFACT_VERSION,
    lineage: PHASE_6_9_7_FULL_GATE_LINEAGE,
    authority: 'synthetic_test',
    qualityAuthority: 'none',
    runId: F2_RUN_ID,
    runScope: 'branch',
    generatedAt: F2_CREATED_AT,
    source: createF2Source(),
    proxy: {
      version: 'phase-6.9.7-tutor-organizer-full-gate-proxy-attestation-v1',
      status: 'direct_ready',
      providerCalls: 0,
    },
    reportLogicalSha256: computePhase697FullGateCanonicalSha256(report),
    report,
    durability: {
      version: PHASE_6_9_7_FULL_GATE_DURABILITY_VERSION,
      completionMode: 'runtime',
      publicationMode: 'runtime',
      markerSha256: '3'.repeat(64),
      terminalSequence: 42,
      terminalRecordHash: '4'.repeat(64),
      journalRecordsBeforePublication: 43,
      recoveryClaimSha256: null,
    },
  });
}
