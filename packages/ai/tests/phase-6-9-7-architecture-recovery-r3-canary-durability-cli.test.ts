import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildPhase697ArchitectureRecoveryR3CanaryReport,
  buildPhase697ArchitectureRecoveryR3CrashSealReport,
  phase697ArchitectureRecoveryR3CanaryArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION,
  reservePhase697ArchitectureRecoveryR3Canary,
  runPhase697ArchitectureRecoveryR3CanaryCli,
  sealPhase697ArchitectureRecoveryR3InterruptedCanary,
  validatePhase697ArchitectureRecoveryR3CanaryBundle,
  type Phase697ArchitectureRecoveryR2CanaryReport,
  type Phase697ArchitectureRecoveryR3CanarySource,
  type Phase697V7WireStage,
} from '../src/index.ts';

const RUN_ID = '11111111-2222-4333-8444-555555555555';
const GENERATED_AT = '2026-07-30T12:00:00.000Z';
const TEST_CREDENTIAL = 'sk-r3-test-only-never-network';
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Phase 6.9.7 Architecture Recovery R3 durability and CLI', () => {
  test('uses one fixed exclusive marker and permits exactly one concurrent reservation', async () => {
    const root = await tempRoot();
    const input = { root, runId: RUN_ID, createdAt: GENERATED_AT, source: sourceState() };
    const settled = await Promise.allSettled([
      reservePhase697ArchitectureRecoveryR3Canary(input),
      reservePhase697ArchitectureRecoveryR3Canary(input),
    ]);
    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter((item) => item.status === 'rejected')).toHaveLength(1);

    const winner = settled.find((item) => item.status === 'fulfilled');
    if (!winner || winner.status !== 'fulfilled') throw new Error('missing winner');
    expect(winner.value.markerRelativePath).toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
    );
    expect(winner.value.markerRelativePath).not.toContain(RUN_ID);
    expect(winner.value.markerRelativePath).not.toMatch(/tutor-organizer-v[1-9]|recovery-claim/u);
  });

  test('fsyncs wire stages before terminal and publishes one strict hard-link artifact', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryR3Canary({
      root,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    });
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminal = await reservation.appendTerminal(report);
    const artifact = reservation.buildArtifact({ generatedAt: GENERATED_AT, report, terminal });
    const published = await reservation.publishArtifact(artifact);

    expect(published.relativePath).toContain(RUN_ID);
    expect(published.evidenceSha256).toMatch(/^[a-f0-9]{64}$/u);
    const validation = await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root });
    expect(validation).toMatchObject({
      ok: true,
      evidenceCount: 1,
      runId: RUN_ID,
      outcome: 'complete',
      responseObserved: true,
      finalJournalEvent: 'evidence_published',
      completionMode: 'runtime_terminal',
      publicationMode: 'runtime',
      attemptDisposition: 'response_observed',
    });
    expect(validation.journalRecords).toBe(12);
    expect(JSON.stringify(validation)).not.toContain(TEST_CREDENTIAL);

    await expect(reservation.appendTerminal(report)).rejects.toThrow(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED',
    );
    await expect(reservation.publishArtifact(artifact)).rejects.toThrow(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED',
    );
  });

  test('blocks before reservation unless args, approval, credential, and source all match', async () => {
    const root = await tempRoot();
    const validEnv = {
      [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV]: 'true',
      [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV]: TEST_CREDENTIAL,
    };

    for (const input of [
      { args: [], env: validEnv },
      { args: ['live'], env: validEnv },
      {
        args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION],
        env: { ...validEnv, [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV]: 'false' },
      },
      {
        args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION],
        env: { ...validEnv, [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV]: '' },
      },
    ]) {
      expect(
        await runPhase697ArchitectureRecoveryR3CanaryCli({
          ...input,
          root,
          signal: new AbortController().signal,
        }),
      ).toBe(1);
    }
    await expect(
      readFile(join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH)),
    ).rejects.toThrow();
  });

  test('does not accept injected CLI authority ports', async () => {
    const root = await tempRoot();
    let injectedCalls = 0;
    const exitCode = await Reflect.apply(runPhase697ArchitectureRecoveryR3CanaryCli, null, [
      {
        args: [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION],
        env: {
          [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV]: 'true',
          [PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV]: TEST_CREDENTIAL,
        },
        root,
        signal: new AbortController().signal,
      },
      {
        readSource: async () => {
          injectedCalls += 1;
          return sourceState();
        },
        runControlledLive: async () => {
          injectedCalls += 1;
          return controlledReport();
        },
      },
    ]);
    expect(exitCode).toBe(1);
    expect(runPhase697ArchitectureRecoveryR3CanaryCli.length).toBe(1);
    expect(injectedCalls).toBe(0);
  });

  test('keeps the once marker when journal creation fails and never re-reserves', async () => {
    const root = await tempRoot();
    await mkdir(join(root, '.tmp'), { recursive: true });
    const journalPath = join(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
    );
    await writeFile(journalPath, 'preexisting-journal\n', 'utf8');
    await expect(
      reservePhase697ArchitectureRecoveryR3Canary({
        root,
        runId: RUN_ID,
        createdAt: GENERATED_AT,
        source: sourceState(),
      }),
    ).rejects.toThrow('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED');
    expect(
      JSON.parse(
        await readFile(
          join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
          'utf8',
        ),
      ),
    ).toMatchObject({ runId: RUN_ID, maxProviderCalls: 1 });
    expect(await readFile(journalPath, 'utf8')).toBe('preexisting-journal\n');
    await expect(
      reservePhase697ArchitectureRecoveryR3Canary({
        root,
        runId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        createdAt: GENERATED_AT,
        source: sourceState(),
      }),
    ).rejects.toThrow('PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED');
  });

  test('makes a failed hard-link publication durably and permanently fail closed', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryR3Canary({
      root,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    });
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminal = await reservation.appendTerminal(report);
    const artifact = reservation.buildArtifact({ generatedAt: GENERATED_AT, report, terminal });
    const finalPath = join(
      root,
      phase697ArchitectureRecoveryR3CanaryArtifactPath({ runId: RUN_ID }),
    );
    await writeFile(finalPath, 'existing-final', 'utf8');

    await expect(reservation.publishArtifact(artifact)).rejects.toThrow(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED',
    );
    expect(await readFile(finalPath, 'utf8')).toBe('existing-final');
    expect((await readdir(join(root, '.tmp'))).filter((name) => name.includes('.tmp-'))).toEqual(
      [],
    );
    const events = (
      await readFile(
        join(root, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
        'utf8',
      )
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).event);
    expect(events.at(-1)).toBe('publication_started');
    expect(events).not.toContain('evidence_published');
    expect((await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root })).ok).toBe(false);
    await expect(reservation.publishArtifact(artifact)).rejects.toThrow(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_DURABILITY_REJECTED',
    );
  });

  test('serializes concurrent terminal and publication attempts to one winner each', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryR3Canary({
      root,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    });
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminals = await Promise.allSettled([
      reservation.appendTerminal(report),
      reservation.appendTerminal(report),
    ]);
    expect(terminals.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    const terminalWinner = terminals.find((item) => item.status === 'fulfilled');
    if (!terminalWinner || terminalWinner.status !== 'fulfilled')
      throw new Error('missing terminal');
    const artifact = reservation.buildArtifact({
      generatedAt: GENERATED_AT,
      report,
      terminal: terminalWinner.value,
    });
    const publications = await Promise.allSettled([
      reservation.publishArtifact(artifact),
      reservation.publishArtifact(artifact),
    ]);
    expect(publications.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(publications.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root })).toMatchObject({
      ok: true,
      journalRecords: 12,
    });
  });

  test('rejects a fully rehashed terminal report that disagrees with the published artifact', async () => {
    const root = await tempRoot();
    const reservation = await reservePhase697ArchitectureRecoveryR3Canary({
      root,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    });
    for (const stage of stages()) await reservation.appendWireStage(stage);
    const report = controlledReport();
    const terminal = await reservation.appendTerminal(report);
    const artifact = reservation.buildArtifact({ generatedAt: GENERATED_AT, report, terminal });
    await reservation.publishArtifact(artifact);

    const journalPath = join(
      root,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
    );
    const records = (await readFile(journalPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const terminalIndex = records.findIndex((record) => record.event === 'runtime_terminal');
    const replacement = buildPhase697ArchitectureRecoveryR3CrashSealReport([]);
    records[terminalIndex].outcome = replacement.providerReport.outcome;
    records[terminalIndex].report = replacement;
    records[terminalIndex].reportSha256 = sha256Json(replacement);
    for (let index = terminalIndex; index < records.length; index += 1) {
      records[index].previousHash = index === 0 ? null : records[index - 1].recordHash;
      const { recordHash: _oldHash, ...payload } = records[index];
      records[index].recordHash = sha256Json(payload);
    }
    await writeFile(
      journalPath,
      `${records.map((record) => JSON.stringify(record)).join('\n')}\n`,
      'utf8',
    );
    expect((await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root })).ok).toBe(false);
  });

  test('zero-provider crash seal blocks live owners and seals dead owners once', async () => {
    const liveRoot = await tempRoot();
    await reservePhase697ArchitectureRecoveryR3Canary({
      root: liveRoot,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    });
    expect(await sealPhase697ArchitectureRecoveryR3InterruptedCanary({ root: liveRoot })).toEqual({
      ok: false,
      code: 'r3_seal_live_owner',
    });

    const dispatchedRoot = await tempRoot();
    await createInterruptedReservationInChild(dispatchedRoot, [
      'executor_entered',
      'request_validated',
      'provider_dispatch_started',
    ]);
    const sealed = await Promise.all([
      sealPhase697ArchitectureRecoveryR3InterruptedCanary({ root: dispatchedRoot }),
      sealPhase697ArchitectureRecoveryR3InterruptedCanary({ root: dispatchedRoot }),
    ]);
    expect(sealed.filter((result) => result.ok)).toHaveLength(1);
    expect(sealed.find((result) => result.ok)).toMatchObject({
      disposition: 'crash_only_sealed',
      attemptDisposition: 'dispatched_no_response',
    });
    expect(
      await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root: dispatchedRoot }),
    ).toMatchObject({
      ok: true,
      outcome: 'harness_internal',
      completionMode: 'crash_only_seal',
      publicationMode: 'recovery',
      attemptDisposition: 'dispatched_no_response',
    });

    const notDispatchedRoot = await tempRoot();
    await createInterruptedReservationInChild(notDispatchedRoot, []);
    const markerBytes = await readFile(
      join(notDispatchedRoot, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH),
      'utf8',
    );
    const journalRecords = (
      await readFile(
        join(notDispatchedRoot, PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH),
        'utf8',
      )
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    await writeFile(
      join(
        notDispatchedRoot,
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
      ),
      `${JSON.stringify({
        version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_VERSION,
        runId: RUN_ID,
        claimedAt: GENERATED_AT,
        ownerProcessId: 2_147_483_647,
        ownerToken: '99999999-8888-4777-8666-555555555555',
        markerSha256: createHash('sha256').update(markerBytes).digest('hex'),
        journalTailRecordHash: journalRecords.at(-1).recordHash,
        state: 'orphan_seal_claimed',
      })}\n`,
      'utf8',
    );
    expect(
      await sealPhase697ArchitectureRecoveryR3InterruptedCanary({ root: notDispatchedRoot }),
    ).toMatchObject({
      ok: true,
      disposition: 'crash_only_sealed',
      attemptDisposition: 'not_dispatched',
    });
  });

  test('recovers publication from an existing durable terminal without changing its report', async () => {
    const root = await tempRoot();
    await createInterruptedReservationInChild(root, stages(), true);
    expect(await sealPhase697ArchitectureRecoveryR3InterruptedCanary({ root })).toMatchObject({
      ok: true,
      disposition: 'terminal_publication_recovered',
      attemptDisposition: 'response_observed',
    });
    expect(await validatePhase697ArchitectureRecoveryR3CanaryBundle({ root })).toMatchObject({
      ok: true,
      outcome: 'complete',
      completionMode: 'runtime_terminal',
      publicationMode: 'recovery',
      attemptDisposition: 'response_observed',
    });
  });
});

async function tempRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-r3-canary-'));
  roots.push(root);
  return root;
}

function sourceState(): Phase697ArchitectureRecoveryR3CanarySource {
  return {
    branch: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH,
    commit: '1'.repeat(40),
    trackingCommit: '1'.repeat(40),
    trackedWorktreeClean: true,
  };
}

function controlledReport() {
  return buildPhase697ArchitectureRecoveryR3CanaryReport(baseReport());
}

function baseReport(): Phase697ArchitectureRecoveryR2CanaryReport {
  return {
    version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1',
    requestVersion: 'phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1',
    authority: 'controlled_live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    timeoutMs: 1_000,
    outcome: 'complete',
    responseObserved: true,
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
    budget: {
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1',
      scope: 'per_invocation',
      maxCalls: 1,
      maxInputTokens: 512,
      maxOutputTokens: 16,
      hardCapCny: '0.00200000',
      reservedCalls: 1,
      reservedInputTokens: 512,
      reservedOutputTokens: 16,
      actualInputTokens: 32,
      actualOutputTokens: 4,
      withinBudget: true,
    },
    usage: { inputTokens: 32, outputTokens: 4 },
  };
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

function sha256Json(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function createInterruptedReservationInChild(
  root: string,
  wireStages: readonly Phase697V7WireStage[],
  appendTerminal = false,
) {
  const moduleUrl = pathToFileURL(join(import.meta.dir, '../src/index.ts')).href;
  const code = `
    import {
      buildPhase697ArchitectureRecoveryR3CanaryReport,
      reservePhase697ArchitectureRecoveryR3Canary,
    } from ${JSON.stringify(moduleUrl)};
    const reservation = await reservePhase697ArchitectureRecoveryR3Canary(${JSON.stringify({
      root,
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      source: sourceState(),
    })});
    for (const stage of ${JSON.stringify(wireStages)}) await reservation.appendWireStage(stage);
    if (${JSON.stringify(appendTerminal)}) {
      await reservation.appendTerminal(
        buildPhase697ArchitectureRecoveryR3CanaryReport(${JSON.stringify(baseReport())}),
      );
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
