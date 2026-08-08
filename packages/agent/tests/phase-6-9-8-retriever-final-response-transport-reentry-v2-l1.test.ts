import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
  preparePhase698TransportReentryV2C1Projection,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';
import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA,
  phase698TransportReentryV2L1Canonical,
  phase698TransportReentryV2L1Sha256,
  type Phase698TransportReentryV2L1Source,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts';
import {
  inspectPhase698TransportReentryV2DedicatedCapability,
  makePhase698TransportReentryV2SyntheticPreflightInput as makeC1Input,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';
import { createPhase698TransportReentryV2C2SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  createPhase698TransportReentryV2L1LivePorts,
  createPhase698TransportReentryV2L1SyntheticRootForTest,
  Phase698TransportReentryV2L1PortFailure,
  recoverPhase698TransportReentryV2L1InterruptedAttempt,
  removePhase698TransportReentryV2L1SyntheticRootForTest,
  reservePhase698TransportReentryV2L1SyntheticAttemptForTest,
  runPhase698TransportReentryV2L1,
  validatePhase698TransportReentryV2L1Bundle,
  type Phase698TransportReentryV2L1Ports,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1.ts';
import { executePhase698TransportReentryV2L1CliCore } from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-cli-core.ts';

async function withRoot<T>(task: (root: string) => Promise<T>) {
  const root = await createPhase698TransportReentryV2L1SyntheticRootForTest();
  try {
    return await task(root);
  } finally {
    await removePhase698TransportReentryV2L1SyntheticRootForTest(root);
  }
}

function sourceFor(
  admission: ReturnType<typeof createPhase698TransportReentryV2C2SyntheticAdmissionForTest>,
) {
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SOURCE_SCHEMA.parse({
    version: 'phase-6.9.8-retriever-final-response-transport-reentry-v2-l1-v1-source',
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    branch: 'drb/phase-6-9-8-retriever-final-response-contract',
    commit: admission.source.commit,
    trackingCommit: admission.source.trackingCommit,
    remoteCommit: admission.source.remoteCommit,
    approvedSourceCommit: admission.source.approvedSourceCommit,
    workingTreeClean: true,
    formalArtifactCount: 0,
    sourceBundleSha256: '1'.repeat(64),
    c2SourceBundleSha256: admission.source.sourceBundleSha256,
    t2Gate: admission.source.t2Gate,
    t3cGate: admission.source.t3cGate,
  });
}

function successPorts(calls: string[], failure?: Phase698TransportReentryV2L1PortFailure | null) {
  const success = (slot: 'rewrite' | 'qwen' | 'final_response') => async () => {
    calls.push(slot);
    if (failure && slot === 'rewrite') throw failure;
    const usage =
      slot === 'qwen'
        ? { inputTokens: 200, outputTokens: 0, totalTokens: 200 }
        : { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
    return {
      usage,
      verifiedCostCny: slot === 'qwen' ? 0.0001 : 0.001,
      durationMs: 1,
    };
  };
  return Object.freeze({
    rewrite: success('rewrite'),
    qwen: success('qwen'),
    final_response: success('final_response'),
  }) satisfies Phase698TransportReentryV2L1Ports;
}

async function rewriteJournal(
  path: string,
  transform: (records: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
) {
  const parsed = (await readFile(path, 'utf8'))
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const transformed = transform(parsed);
  let previousHash: string | null = null;
  const lines = transformed.map((record, sequence) => {
    const { recordHash: _ignored, ...unsigned } = { ...record, sequence, previousHash };
    const recordHash = phase698TransportReentryV2L1Sha256(
      phase698TransportReentryV2L1Canonical(unsigned),
    );
    previousHash = recordHash;
    return JSON.stringify({ ...unsigned, recordHash });
  });
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
}

async function runSynthetic(
  root: string,
  options: Readonly<{
    failure?: Phase698TransportReentryV2L1PortFailure | null;
    signal?: AbortSignal;
  }> = {},
) {
  const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
  const calls: string[] = [];
  const reservation = await reservePhase698TransportReentryV2L1SyntheticAttemptForTest({
    root,
    admissionCapability: admission.capability,
    source: sourceFor(admission),
  });
  const result = await runPhase698TransportReentryV2L1({
    reservation,
    ports: successPorts(calls, options.failure),
    signal: options.signal ?? new AbortController().signal,
  });
  return { result, calls, reservation };
}

describe('Phase 6.9.8 Transport Re-entry V2 L1 zero-provider runner', () => {
  test('seals the fixed three-slot success path with strict accounting', async () => {
    await withRoot(async (root) => {
      const { result, calls } = await runSynthetic(root);
      expect(calls).toEqual(['rewrite', 'qwen', 'final_response']);
      expect(result.ok).toBe(true);
      expect(result.report.providerCalls).toBe(3);
      expect(result.report.credentialReads).toBe(3);
      expect(result.report.verifiedUsageSlots).toBe(3);
      expect(result.report.slots.every((slot) => slot.disposition === 'completed')).toBe(true);
      expect(result.validation).toMatchObject({
        ok: true,
        finalJournalEvent: 'evidence_published',
        formalEvidence: 1,
      });
    });
  });

  test('opens the first-fault breaker and never dispatches the suffix', async () => {
    await withRoot(async (root) => {
      const { result, calls } = await runSynthetic(root, {
        failure: new Phase698TransportReentryV2L1PortFailure('transport'),
      });
      expect(calls).toEqual(['rewrite']);
      expect(result.ok).toBe(false);
      expect(result.report.breaker).toMatchObject({
        open: true,
        reason: 'transport',
        openedAtSequence: 1,
      });
      expect(result.report.slots.map((slot) => slot.disposition)).toEqual([
        'executed_failure',
        'not_started_quality_breaker',
        'not_started_quality_breaker',
      ]);
      expect(result.report.providerCalls).toBe(1);
      expect(result.report.credentialReads).toBe(1);
    });
  });

  test('records external abort before dispatch without any port call', async () => {
    await withRoot(async (root) => {
      const controller = new AbortController();
      controller.abort();
      const { result, calls } = await runSynthetic(root, { signal: controller.signal });
      expect(calls).toEqual([]);
      expect(result.report.providerCalls).toBe(0);
      expect(result.report.slots.map((slot) => slot.disposition)).toEqual([
        'attempted_aborted',
        'not_started_external_abort',
        'not_started_external_abort',
      ]);
      expect(result.validation.ok).toBe(true);
    });
  });

  test('seals a reserved-only crash prefix without replaying a Provider call', async () => {
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      await reservePhase698TransportReentryV2L1SyntheticAttemptForTest({
        root,
        admissionCapability: admission.capability,
        source: sourceFor(admission),
      });
      const recovered = await recoverPhase698TransportReentryV2L1InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovered.ok).toBe(true);
      expect(recovered.ok && recovered.disposition).toBe('crash_only_sealed');
      const validation = await validatePhase698TransportReentryV2L1Bundle(root);
      expect(validation).toMatchObject({ ok: true, providerCalls: 0, credentialReads: 0 });
    });
  });

  test('converts a dispatch-only crash into one terminal failure and does not replay', async () => {
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const reservation = await reservePhase698TransportReentryV2L1SyntheticAttemptForTest({
        root,
        admissionCapability: admission.capability,
        source: sourceFor(admission),
      });
      await reservation.appendSlotDispatchStarted('rewrite');
      const recovered = await recoverPhase698TransportReentryV2L1InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovered.ok).toBe(true);
      const validation = await validatePhase698TransportReentryV2L1Bundle(root);
      expect(validation).toMatchObject({ ok: true, providerCalls: 1, credentialReads: 1 });
      const report = JSON.parse(
        await readFile(
          resolve(
            root,
            '.tmp',
            `phase-6-9-8-retriever-final-response-transport-reentry-v2-${validation.runId}.report.json`,
          ),
          'utf8',
        ),
      ) as { slots: Array<{ runnerWire: { dispatches: number }; slot: string }> };
      expect(report.slots[0]).toMatchObject({ slot: 'rewrite', runnerWire: { dispatches: 1 } });
    });
  });

  test('rejects a hash-valid journal with a broken event prefix', async () => {
    await withRoot(async (root) => {
      await runSynthetic(root);
      const path = resolve(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE);
      const records = (await readFile(path, 'utf8'))
        .trimEnd()
        .split('\n')
        .map((line) => PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA.parse(JSON.parse(line)));
      const dispatchIndex = records.findIndex((record) => record.event === 'slot_dispatch_started');
      const responseIndex = records.findIndex(
        (record) => record.event === 'slot_response_observed',
      );
      const dispatch = records[dispatchIndex]!;
      const response = records[responseIndex]!;
      records[dispatchIndex] = { ...dispatch, event: 'slot_response_observed' };
      records[responseIndex] = { ...response, event: 'slot_dispatch_started' };
      let previousHash: string | null = null;
      const lines = records.map((record, sequence) => {
        const { recordHash: _ignored, ...unsigned } = { ...record, sequence, previousHash };
        const recordHash = phase698TransportReentryV2L1Sha256(
          phase698TransportReentryV2L1Canonical(unsigned),
        );
        previousHash = recordHash;
        return JSON.stringify({ ...unsigned, recordHash });
      });
      await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
      expect((await validatePhase698TransportReentryV2L1Bundle(root)).ok).toBe(false);
    });
  });

  test('rejects lineage temp files left beside a published artifact', async () => {
    await withRoot(async (root) => {
      await runSynthetic(root);
      await writeFile(
        resolve(root, 'phase-6-9-8-retriever-final-response-transport-reentry-v2-orphan.tmp'),
        'orphan',
      );
      expect((await validatePhase698TransportReentryV2L1Bundle(root)).ok).toBe(false);
    });
  });

  test('recovers an existing hard-linked artifact without replaying slots', async () => {
    await withRoot(async (root) => {
      const { result } = await runSynthetic(root);
      expect(result.validation.ok).toBe(true);
      const journalPath = resolve(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE);
      await rewriteJournal(journalPath, (records) =>
        records.filter((record) => record.event !== 'evidence_published'),
      );
      const recovered = await recoverPhase698TransportReentryV2L1InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovered).toMatchObject({ ok: true, disposition: 'terminal_publication_recovered' });
      expect((await validatePhase698TransportReentryV2L1Bundle(root)).ok).toBe(true);
    });
  });

  test('rejects a tampered or orphan recovery claim', async () => {
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      await reservePhase698TransportReentryV2L1SyntheticAttemptForTest({
        root,
        admissionCapability: admission.capability,
        source: sourceFor(admission),
      });
      const recovered = await recoverPhase698TransportReentryV2L1InterruptedAttempt({
        root,
        isProcessAlive: () => false,
      });
      expect(recovered.ok).toBe(true);
      const recoveryPath = resolve(
        root,
        '.tmp',
        'phase-6-9-8-retriever-final-response-transport-reentry-v2.recovery.json',
      );
      await writeFile(recoveryPath, '{}', 'utf8');
      expect((await validatePhase698TransportReentryV2L1Bundle(root)).ok).toBe(false);
    });
    await withRoot(async (root) => {
      await runSynthetic(root);
      const recoveryPath = resolve(
        root,
        '.tmp',
        'phase-6-9-8-retriever-final-response-transport-reentry-v2.recovery.json',
      );
      await writeFile(recoveryPath, '{}', 'utf8');
      expect((await validatePhase698TransportReentryV2L1Bundle(root)).ok).toBe(false);
    });
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 L1 capability and CLI gates', () => {
  test('keeps live adapter composition deferred until after reservation', () => {
    const preparation = preparePhase698TransportReentryV2C1Projection(
      makeC1Input(),
      { DEEPSEEK_API_KEY: 'synthetic-deepseek-key', QWEN_API_KEY: 'synthetic-qwen-key' },
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS,
    );
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    const composed = createPhase698TransportReentryV2L1LivePorts(preparation.projection);
    expect(composed.ok).toBe(true);
    expect(JSON.stringify(composed)).not.toContain('synthetic-');
    expect(
      inspectPhase698TransportReentryV2DedicatedCapability(
        preparation.projection.rewrite,
        'rewrite',
        PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.rewrite,
      ),
    ).toMatchObject({ family: 'rewrite', credentialAvailable: true });
  });

  test('fails closed before source/proxy/credential work on bad argv and source', async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const basePorts = {
      readSource: () => {
        calls.push('source');
        throw new Error('source');
      },
      runProxyPreflight: async () => {
        calls.push('proxy');
        return { ok: true, code: 'direct_ready', providerCalls: 0, listenerProbeCalls: 0 };
      },
      readDataBoundary: () => {
        calls.push('boundary');
        return true;
      },
      readAuthorization: () => {
        calls.push('authorization');
        return true;
      },
      prepareProjection: async () => {
        calls.push('projection');
        return {};
      },
      composePorts: () => {
        calls.push('compose');
        return { ok: false, reasonCode: 'configuration' as const };
      },
      reserve: async () => {
        calls.push('reserve');
        throw new Error('reserve');
      },
      runLive: async () => {
        calls.push('run');
        throw new Error('run');
      },
      validate: async () => ({
        ok: false,
        journalRecords: 0,
        reportLogicalSha256: null,
        physicalArtifactSha256: null,
      }),
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
      write: (line: string) => calls.push(`write:${line}`),
    };
    const invalidArgCode = await executePhase698TransportReentryV2L1CliCore(
      { args: ['wrong'], root: 'synthetic', proxyEnv: {}, signal: controller.signal },
      basePorts,
    );
    expect(invalidArgCode).toBe(1);
    expect(calls[0]?.startsWith('write:')).toBe(true);
    expect(calls).not.toContain('source');
    calls.length = 0;
    const sourceCode = await executePhase698TransportReentryV2L1CliCore(
      {
        args: [PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_EXACT_ARGUMENT],
        root: 'synthetic',
        proxyEnv: {},
        signal: controller.signal,
      },
      basePorts,
    );
    expect(sourceCode).toBe(1);
    expect(calls).toContain('source');
    expect(calls).not.toContain('proxy');
    expect(calls).not.toContain('projection');
  });

  test('uses the exact data-boundary and authorization constants', () => {
    expect(PHASE_6_9_8_TRANSPORT_REENTRY_V2_DATA_BOUNDARY_ACCEPTANCE).toContain(
      'DEEPSEEK_AND_QWEN',
    );
    expect(PHASE_6_9_8_TRANSPORT_REENTRY_V2_EXACT_AUTHORIZATION).toContain(
      'CONTROLLED_CANARY_ONCE',
    );
  });
});
