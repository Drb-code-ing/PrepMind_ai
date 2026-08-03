import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report,
  phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation,
  type Phase697ArchitectureRecoveryProviderCanaryV2C2Source,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import {
  reservePhase697ArchitectureRecoveryProviderCanaryV2C2,
  sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt,
  validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts';
import type { Phase697V7WireStage } from '../src/phase-6-9-7-v7-wire-diagnostics.ts';

const RUN_ID = '33333333-3333-4333-8333-333333333333';
const GENERATED_AT = '2026-07-30T10:00:00.000Z';
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 Provider Canary V2 C2 durability', () => {
  test('normalizes the root and permits exactly one exclusive marker reservation', async () => {
    const root = await tempRoot();
    const input = reservationInput(`${root}${sep}`);
    const settled = await Promise.allSettled([
      reservePhase697ArchitectureRecoveryProviderCanaryV2C2(input),
      reservePhase697ArchitectureRecoveryProviderCanaryV2C2(input),
    ]);
    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const winner = settled.find((item) => item.status === 'fulfilled');
    if (!winner || winner.status !== 'fulfilled') throw new Error('missing reservation winner');
    expect(winner.value.markerRelativePath).toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
    );
    expect(winner.value.markerRelativePath).not.toContain(RUN_ID);
    expect(winner.value.markerRelativePath).not.toMatch(/recovery-r3|tutor-organizer-v[1-9]/u);
  });

  test('fsyncs a monotonic wire prefix and publishes one strict hard-link artifact', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryProviderCanaryV2C2(
      reservationInput(root),
    );
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminal = await reservation.appendTerminal(report);
    const artifact = reservation.buildArtifact({ generatedAt: GENERATED_AT, report, terminal });
    const published = await reservation.publishArtifact(artifact);

    expect(published.relativePath).toContain(RUN_ID);
    expect(published.evidenceSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root })).toEqual({
      ok: true,
      evidenceCount: 1,
      runId: RUN_ID,
      journalRecords: 12,
      finalJournalEvent: 'evidence_published',
      outcome: 'complete',
      providerHealth: 'strict_response_with_verified_usage',
      responseObserved: true,
      completionMode: 'runtime',
      publicationMode: 'runtime',
      attemptDisposition: 'response_observed',
    });
    const events = await journalEvents(root);
    expect(events).toEqual([
      'attempt_reserved',
      ...Array.from({ length: 8 }, () => 'wire_stage'),
      'runtime_terminal',
      'publication_started',
      'evidence_published',
    ]);
    await expect(reservation.appendTerminal(report)).rejects.toThrow('C2_DURABILITY_REJECTED');
    await expect(reservation.publishArtifact(artifact)).rejects.toThrow('C2_DURABILITY_REJECTED');
  });

  test('rejects out-of-order stages and serializes terminal/publication to one winner', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryProviderCanaryV2C2(
      reservationInput(root),
    );
    await expect(reservation.appendWireStage('provider_dispatch_started')).rejects.toThrow(
      'C2_DURABILITY_REJECTED',
    );
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminals = await Promise.allSettled([
      reservation.appendTerminal(report),
      reservation.appendTerminal(report),
    ]);
    expect(terminals.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const terminal = terminals.find((item) => item.status === 'fulfilled');
    if (!terminal || terminal.status !== 'fulfilled') throw new Error('missing terminal winner');
    const artifact = reservation.buildArtifact({
      generatedAt: GENERATED_AT,
      report,
      terminal: terminal.value,
    });
    const publications = await Promise.allSettled([
      reservation.publishArtifact(artifact),
      reservation.publishArtifact(artifact),
    ]);
    expect(publications.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(publications.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect((await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root })).ok).toBe(
      true,
    );
  });

  test('leaves the marker consumed when journal creation fails', async () => {
    const root = await tempRoot();
    await writeFile(
      join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH),
      'existing-journal\n',
      'utf8',
    );
    await expect(
      reservePhase697ArchitectureRecoveryProviderCanaryV2C2(reservationInput(root)),
    ).rejects.toThrow('C2_DURABILITY_REJECTED');
    expect(
      JSON.parse(
        await readFile(
          join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH),
          'utf8',
        ),
      ),
    ).toMatchObject({ runId: RUN_ID, maxProviderCalls: 1 });
    expect(
      await readFile(
        join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH),
        'utf8',
      ),
    ).toBe('existing-journal\n');
  });

  test('blocks a live owner and lets exactly one dead-owner zero-provider sealer win', async () => {
    const liveRoot = await tempRoot();
    await reservePhase697ArchitectureRecoveryProviderCanaryV2C2(reservationInput(liveRoot));
    expect(
      await sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt({
        root: liveRoot,
      }),
    ).toEqual({ ok: false, code: 'c2_seal_live_owner' });

    const deadRoot = await tempRoot();
    await createInterruptedReservationInChild(deadRoot, stages().slice(0, 3));
    const results = await Promise.all([
      sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt({ root: deadRoot }),
      sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt({ root: deadRoot }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => result.ok)).toMatchObject({
      disposition: 'crash_only_sealed',
      attemptDisposition: 'dispatched_no_response',
    });
    expect(
      await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root: deadRoot }),
    ).toMatchObject({
      ok: true,
      outcome: 'harness_internal',
      providerHealth: 'unknown',
      completionMode: 'recovery',
      publicationMode: 'recovery',
      attemptDisposition: 'dispatched_no_response',
    });
  });

  test('recovers an existing terminal without changing its report', async () => {
    const root = await tempRoot();
    await createInterruptedReservationInChild(root, stages(), true);
    expect(
      await sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt({ root }),
    ).toMatchObject({
      ok: true,
      disposition: 'terminal_publication_recovered',
      attemptDisposition: 'response_observed',
    });
    expect(
      await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root }),
    ).toMatchObject({
      ok: true,
      outcome: 'complete',
      providerHealth: 'strict_response_with_verified_usage',
      completionMode: 'runtime',
      publicationMode: 'recovery',
    });
  });

  test('makes publication_started failure permanently fail closed', async () => {
    const root = await tempRoot();
    const finalPath = join(
      root,
      phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath({ runId: RUN_ID }),
    );
    await writeFile(finalPath, 'existing-final', 'utf8');
    await createInterruptedReservationInChild(root, stages(), true, true);
    expect((await journalEvents(root)).at(-1)).toBe('publication_started');
    expect(await readFile(finalPath, 'utf8')).toBe('existing-final');
    expect(
      await sealPhase697ArchitectureRecoveryProviderCanaryV2C2InterruptedAttempt({ root }),
    ).toEqual({ ok: false, code: 'c2_seal_evidence_io' });
    expect((await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root })).ok).toBe(
      false,
    );
    expect((await readdir(join(root, '.tmp'))).filter((name) => name.includes('.tmp-'))).toEqual(
      [],
    );
  });

  test('detects journal drift and rejects R3-only roots as V2 bundles', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryProviderCanaryV2C2(
      reservationInput(root),
    );
    await reservation.appendWireStage('executor_entered');
    const journalPath = join(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
    );
    await writeFile(journalPath, `${await readFile(journalPath, 'utf8')}tamper\n`, 'utf8');
    expect((await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root })).ok).toBe(
      false,
    );

    const r3OnlyRoot = await tempRoot();
    await writeFile(
      join(r3OnlyRoot, '.tmp', 'phase-6-9-7-architecture-recovery-r3-provider-canary.once.json'),
      '{}\n',
      'utf8',
    );
    expect(
      (await validatePhase697ArchitectureRecoveryProviderCanaryV2C2Bundle({ root: r3OnlyRoot })).ok,
    ).toBe(false);
  });
});

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-provider-canary-v2-c2-'));
  roots.push(root);
  await Bun.write(join(root, '.tmp', '.keep'), '');
  await rm(join(root, '.tmp', '.keep'));
  return root;
}

function reservationInput(root: string) {
  return {
    root,
    runId: RUN_ID,
    createdAt: GENERATED_AT,
    source: sourceState(),
    proxyAttestation: proxyState(),
  };
}

function sourceState(): Phase697ArchitectureRecoveryProviderCanaryV2C2Source {
  return {
    version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-source-v1',
    branch: 'codex/phase-6-9-7-tutor-wrong-question-agents',
    commit: 'a'.repeat(40),
    trackingCommit: 'a'.repeat(40),
    remoteCommit: 'a'.repeat(40),
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    r3BundleValid: true,
    r3RunId: '253a5df5-c443-4950-b517-849efb941728',
    r3MarkerSha256: '6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a',
    r3JournalSha256: '426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b',
    r3ArtifactSha256: '56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4',
  };
}

function proxyState(): Phase697ArchitectureRecoveryProviderCanaryV2C2ProxyAttestation {
  return {
    version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-proxy-attestation-v1',
    preflightVersion: 'phase-6.9.7-architecture-recovery-proxy-preflight-v1',
    mode: 'direct',
    configuredProxyVariables: 0,
    listener: 'not_required',
    listenerProbeCalls: 0,
    providerCalls: 0,
  };
}

function controlledReport() {
  return buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
    authority: 'controlled_live',
    executorProvenance: 'deepseek_network',
    outcome: 'complete',
    responseObserved: true,
    strictResponseObserved: true,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: {
      version: 'phase-6.9.7-v7-wire-diagnostics-v1',
      state: 'succeeded',
      lastCompletedStage: 'usage_validated',
      failureCategory: null,
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    },
    usage: { inputTokens: 32, outputTokens: 4 },
  });
}

function stages(): readonly Phase697V7WireStage[] {
  return [
    'executor_entered',
    'request_validated',
    'provider_dispatch_started',
    'provider_response_received',
    'response_audit_passed',
    'content_parsed',
    'schema_validated',
    'usage_validated',
  ];
}

async function journalEvents(root: string) {
  return (
    await readFile(
      join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH),
      'utf8',
    )
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line).event as string);
}

async function createInterruptedReservationInChild(
  root: string,
  wireStages: readonly Phase697V7WireStage[],
  appendTerminal = false,
  attemptPublication = false,
) {
  const durabilityUrl = pathToFileURL(
    join(
      import.meta.dir,
      '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-durability.ts',
    ),
  ).href;
  const contractUrl = pathToFileURL(
    join(
      import.meta.dir,
      '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts',
    ),
  ).href;
  const code = `
    import { reservePhase697ArchitectureRecoveryProviderCanaryV2C2 } from ${JSON.stringify(
      durabilityUrl,
    )};
    import { buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report } from ${JSON.stringify(
      contractUrl,
    )};
    const reservation = await reservePhase697ArchitectureRecoveryProviderCanaryV2C2(${JSON.stringify(
      reservationInput(root),
    )});
    for (const stage of ${JSON.stringify(wireStages)}) await reservation.appendWireStage(stage);
    if (${JSON.stringify(appendTerminal)}) {
      const report = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report(${JSON.stringify({
        authority: 'controlled_live',
        executorProvenance: 'deepseek_network',
        outcome: 'complete',
        responseObserved: true,
        strictResponseObserved: true,
        providerFailureCategory: null,
        structuredOutputStage: null,
        transportSubtype: null,
        wire: controlledReport().wire,
        usage: controlledReport().usage,
      })});
      const terminal = await reservation.appendTerminal(report);
      if (${JSON.stringify(attemptPublication)}) {
        const artifact = reservation.buildArtifact({
          generatedAt: ${JSON.stringify(GENERATED_AT)},
          report,
          terminal,
        });
        await reservation.publishArtifact(artifact).catch(() => undefined);
      }
    }
  `;
  const child = Bun.spawn([process.execPath, '-e', code], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exitCode !== 0) throw new Error(`child reservation failed: ${stderr}`);
}
