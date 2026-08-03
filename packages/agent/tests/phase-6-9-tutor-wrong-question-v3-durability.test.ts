import { describe, expect, test } from 'bun:test';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_V3_LIVE_CONFIRMATION,
  executePhase697TutorOrganizerV3Cli,
  executePhase697TutorOrganizerV3CliWithSyntheticExecutorsForTest,
  parsePhase697TutorOrganizerV3Cli,
  sealPhase697TutorOrganizerV3Orphan,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v3-cli.ts';
import {
  acquirePhase697V3RecoveryClaim,
  createPhase697V3Journal,
  openPhase697V3JournalAppender,
  publishPhase697V3Evidence,
  readPhase697V3Journal,
  reservePhase697V3Marker,
} from '../scripts/phase-6-9-7-tutor-wrong-question-v3-durability.ts';
import {
  validatePhase697TutorOrganizerV3EvidenceBundle,
  validatePhase697TutorOrganizerV3EvidenceFile,
  validatePhase697TutorOrganizerV3EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';
import {
  validatePhase697TutorOrganizerEvidenceValue,
  validatePhase697TutorOrganizerV2EvidenceValue,
} from '../scripts/validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  phase69TutorCases,
  phase69WrongQuestionOrganizerCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  buildPhase697V3EvidenceEnvelope,
  buildPhase697V3JournalRecord,
  buildPhase697V3Marker,
  buildPhase697V3SealedReport,
  parseAndValidatePhase697V3Journal,
  phase697V3DispatchKeySha256,
  phase697V3EvidencePath,
  phase697V3JournalPath,
  phase697V3RecoveryClaimPath,
  projectPhase697V3TerminalEntry,
  sha256Stable,
  stableJsonStringify,
  type Phase697V3JournalPayload,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV3 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import {
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
  runPhase697TutorOrganizerPairedEvalV2,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';

const MOCK_RUN_ID = '11111111-1111-4111-8111-111111111111';
const LIVE_RUN_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_RUN_ID = '33333333-3333-4333-8333-333333333333';
const DEAD_OWNER_PROCESS_ID = 2_147_483_647;

describe('phase 6.9.7 Tutor/Organizer V3 crash-safe evidence', () => {
  test('keeps V3 approval, confirmation, seal command, and older identities mutually isolated', () => {
    expect(
      parsePhase697TutorOrganizerV3Cli({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: {},
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV3Cli({
        argv: ['live', 'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V2_CONTROLLED_LIVE_ONCE'],
        env: { PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV3Cli({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V2_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: false, code: 'live_authorization_required' });
    expect(
      parsePhase697TutorOrganizerV3Cli({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED: 'true' },
      }),
    ).toEqual({ ok: true, command: 'run', mode: 'live', runScope: 'branch' });
    expect(parsePhase697TutorOrganizerV3Cli({ argv: ['seal'], env: hostileEnv() })).toEqual({
      ok: true,
      command: 'seal',
    });
  });

  test('publishes a strict V3 Mock envelope without creating Live durability artifacts', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-mock-'));
    try {
      const result = await executePhase697TutorOrganizerV3Cli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
        runId: MOCK_RUN_ID,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.code);
      expect(result.disposition).toBe('mock_direct');
      expect(result.evidencePath).toBe(
        `.tmp/phase-6-9-7-tutor-organizer-v3-branch-mock-${MOCK_RUN_ID}.json`,
      );
      const evidencePath = resolve(root, result.evidencePath);
      expect(await validatePhase697TutorOrganizerV3EvidenceFile({ path: evidencePath })).toEqual({
        ok: true,
      });
      const envelope = JSON.parse(await readFile(evidencePath, 'utf8')) as unknown;
      expect(validatePhase697TutorOrganizerV3EvidenceValue(envelope)).toEqual({ ok: true });
      expect(validatePhase697TutorOrganizerEvidenceValue(envelope)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
      expect(validatePhase697TutorOrganizerV2EvidenceValue(envelope)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
      await expect(
        access(resolve(root, '.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker')),
      ).rejects.toBeDefined();
      await expect(access(resolve(root, phase697V3JournalPath(MOCK_RUN_ID)))).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fsyncs dispatch records before each synthetic executor and seals a complete journal', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-live-'));
    const journalPath = resolve(root, phase697V3JournalPath(LIVE_RUN_ID));
    const observedDispatches: string[] = [];
    try {
      const executors = createSyntheticExecutors(async (agent, pairedRunIndex) => {
        const text = await readFile(journalPath, 'utf8');
        const key = phase697V3DispatchKeySha256({ runId: LIVE_RUN_ID, agent, pairedRunIndex });
        expect(text).toContain(key);
        expect(text).toContain('dispatch_started');
        observedDispatches.push(key);
      });
      const result = await executePhase697TutorOrganizerV3CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: completeV3LiveEnv(),
        repositoryRoot: root,
        runId: LIVE_RUN_ID,
        ...executors,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.code);
      expect(result.disposition).toBe('completed_run');
      expect(result.gate).toBe('quality_gate_failed');
      expect(observedDispatches).toHaveLength(48);
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(journal.ok).toBe(true);
      if (!journal.ok) throw new Error(journal.code);
      expect(journal.journal.guardTerminals.size).toBe(24);
      expect(journal.journal.dispatches.size).toBe(48);
      expect(journal.journal.runtimeTerminals.size).toBe(48);
      expect(journal.journal.pairedLatencies.size).toBe(24);
      expect(journal.journal.runCompleted).not.toBeNull();
      expect(journal.journal.sealed).toMatchObject({ disposition: 'completed_run' });
      expect(
        await validatePhase697TutorOrganizerV3EvidenceBundle({
          root,
          evidencePath: resolve(root, result.evidencePath),
        }),
      ).toEqual({ ok: true });
      const idempotentSeal = await sealPhase697TutorOrganizerV3Orphan({
        root,
        processAlive: testProcessAlive,
      });
      expect(idempotentSeal.ok).toBe(true);
      if (!idempotentSeal.ok) throw new Error(idempotentSeal.code);
      expect(idempotentSeal.disposition).toBe('completed_run');
      const output = JSON.stringify(result);
      expect(output).not.toContain('synthetic-tutor-key');
      expect(output).not.toContain('synthetic-organizer-key');
      expect(output).not.toMatch(/prompt|questionText|Authorization|Bearer/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('allows exactly one concurrent V3 marker winner', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-marker-race-'));
    try {
      const results = await Promise.all(
        [LIVE_RUN_ID, SECOND_RUN_ID].map((runId) =>
          reservePhase697V3Marker({
            root,
            marker: buildPhase697V3Marker({ runId, runScope: 'branch' }),
          }),
        ),
      );
      expect(results.filter((entry) => entry.ok)).toHaveLength(1);
      expect(results.filter((entry) => !entry.ok)).toEqual([
        { ok: false, code: 'live_already_attempted' },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('refuses to seal while the marker owner is still alive', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-active-owner-'));
    try {
      const marker = buildPhase697V3Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        ownerProcessId: process.pid,
      });
      expect((await reservePhase697V3Marker({ root, marker })).ok).toBe(true);
      expect(
        await sealPhase697TutorOrganizerV3Orphan({ root, processAlive: testProcessAlive }),
      ).toEqual({ ok: false, code: 'live_attempt_in_progress' });
      await expect(
        access(
          resolve(
            root,
            phase697V3EvidencePath({
              runScope: 'branch',
              mode: 'live',
              runId: LIVE_RUN_ID,
            }),
          ),
        ),
      ).rejects.toBeDefined();
      await expect(
        access(resolve(root, phase697V3RecoveryClaimPath(LIVE_RUN_ID))),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('allows exactly one live recovery claim owner and releases it cleanly', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-claim-race-'));
    try {
      const marker = buildPhase697V3Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      expect((await reservePhase697V3Marker({ root, marker })).ok).toBe(true);
      const results = await Promise.all([
        acquirePhase697V3RecoveryClaim({
          root,
          marker,
          overrides: { processAlive: testProcessAlive },
        }),
        acquirePhase697V3RecoveryClaim({
          root,
          marker,
          overrides: { processAlive: testProcessAlive },
        }),
      ]);
      const winners = results.filter((entry) => entry.ok);
      expect(winners).toHaveLength(1);
      expect(results.filter((entry) => !entry.ok)).toEqual([
        { ok: false, code: 'live_attempt_in_progress' },
      ]);
      const winner = winners[0];
      if (!winner?.ok) throw new Error('recovery claim winner missing');
      expect(await winner.claim.assertOwned()).toBe(true);
      await winner.claim.release();
      await expect(
        access(resolve(root, phase697V3RecoveryClaimPath(LIVE_RUN_ID))),
      ).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('takes over a dead recovery owner without letting stale cleanup delete the new claim', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-claim-takeover-'));
    try {
      const { marker, writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      await writer.close();
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      if (!journal.ok) throw new Error(journal.code);
      let staleReleasePhase = false;
      let staleReleaseRenameCalls = 0;
      const first = await acquirePhase697V3RecoveryClaim({
        root,
        marker,
        overrides: {
          processAlive: testProcessAlive,
          rename: async (...args) => {
            if (staleReleasePhase) staleReleaseRenameCalls += 1;
            return rename(...args);
          },
        },
      });
      if (!first.ok) throw new Error(first.code);
      const appenderResults = await Promise.all([
        openPhase697V3JournalAppender({
          root,
          journal: journal.journal,
          claim: first.claim,
        }),
        openPhase697V3JournalAppender({
          root,
          journal: journal.journal,
          claim: first.claim,
        }),
      ]);
      expect(appenderResults.filter((entry) => entry.ok)).toHaveLength(1);
      expect(appenderResults.filter((entry) => !entry.ok)).toEqual([
        { ok: false, code: 'recovery_claim_lost' },
      ]);
      const staleAppender = appenderResults.find((entry) => entry.ok);
      if (!staleAppender?.ok) throw new Error('recovery appender winner missing');
      const takeover = await acquirePhase697V3RecoveryClaim({
        root,
        marker,
        overrides: { processAlive: () => false },
      });
      if (!takeover.ok) throw new Error(takeover.code);
      expect(takeover.claim.ownerToken).not.toBe(first.claim.ownerToken);
      await expect(
        staleAppender.writer.append({
          kind: 'evidence_sealed',
          disposition: 'orphan_sealed',
          sealedFromJournalSha256: journal.journal.tailSha256,
          evidenceSha256: sha256Stable({ stale: true }),
        }),
      ).rejects.toThrow('PHASE_6_9_7_V3_RECOVERY_CLAIM_LOST');
      await staleAppender.writer.close().catch(() => undefined);
      staleReleasePhase = true;
      await expect(first.claim.release()).rejects.toThrow('PHASE_6_9_7_V3_RECOVERY_CLAIM_LOST');
      expect(staleReleaseRenameCalls).toBe(0);
      expect(await takeover.claim.assertOwned()).toBe(true);
      const canonicalClaim = await readFile(
        resolve(root, phase697V3RecoveryClaimPath(LIVE_RUN_ID)),
        'utf8',
      );
      expect(canonicalClaim).toContain(takeover.claim.ownerToken);
      expect(canonicalClaim).not.toContain(first.claim.ownerToken);
      await takeover.claim.release();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('drains accepted journal appends before close', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-close-race-'));
    try {
      const { writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      const mock = await mockV3Report(MOCK_RUN_ID);
      const guards = mock.caseEntries
        .filter((entry) => entry.executionKind === 'zero_call')
        .slice(0, 2)
        .map((entry) => projectPhase697V3TerminalEntry(entry)!);
      const first = writer.append({ kind: 'guard_terminal', terminal: guards[0]! });
      const second = writer.append({ kind: 'guard_terminal', terminal: guards[1]! });
      const closing = writer.close();
      await Promise.all([first, second, closing]);
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(journal.ok).toBe(true);
      if (!journal.ok) throw new Error(journal.code);
      expect(journal.journal.records.map((entry) => entry.sequence)).toEqual([0, 1, 2]);
      expect(journal.journal.guardTerminals.size).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects invalid Live configuration and journal path collisions before any executor call', async () => {
    const invalidRoot = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-invalid-live-'));
    const collisionRoot = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-journal-collision-'));
    let invocations = 0;
    const neverInvoke = createSyntheticExecutors(() => {
      invocations += 1;
    });
    try {
      const invalid = await executePhase697TutorOrganizerV3CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: { PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED: 'true' },
        repositoryRoot: invalidRoot,
        runId: LIVE_RUN_ID,
        ...neverInvoke,
      });
      expect(invalid).toEqual({ ok: false, code: 'live_configuration_invalid' });
      expect(invocations).toBe(0);
      await expect(
        access(resolve(invalidRoot, '.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker')),
      ).rejects.toBeDefined();

      await mkdir(resolve(collisionRoot, phase697V3JournalPath(LIVE_RUN_ID)), {
        recursive: true,
      });
      const collision = await executePhase697TutorOrganizerV3CliWithSyntheticExecutorsForTest({
        argv: ['live', PHASE_6_9_7_V3_LIVE_CONFIRMATION],
        env: completeV3LiveEnv(),
        repositoryRoot: collisionRoot,
        runId: LIVE_RUN_ID,
        ...neverInvoke,
      });
      expect(collision).toEqual({ ok: false, code: 'journal_path_invalid' });
      expect(invocations).toBe(0);
    } finally {
      await rm(invalidRoot, { recursive: true, force: true });
      await rm(collisionRoot, { recursive: true, force: true });
    }
  });

  test('keeps the one-shot marker recoverable when journal creation fails before dispatch', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-journal-io-'));
    try {
      const marker = buildPhase697V3Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      const reserved = await reservePhase697V3Marker({ root, marker });
      if (!reserved.ok) throw new Error(reserved.code);
      expect(
        await createPhase697V3Journal({
          root,
          marker,
          markerSha256: reserved.markerSha256,
          overrides: {
            open: async () => {
              throw Object.assign(new Error('simulated journal open failure'), { code: 'EACCES' });
            },
          },
        }),
      ).toEqual({ ok: false, code: 'journal_io_failed' });
      expect(await access(reserved.markerPath)).toBeNull();
      const sealed = await sealOrphanForTest(root);
      expect(sealed.ok).toBe(true);
      if (!sealed.ok) throw new Error(sealed.code);
      expect(sealed.disposition).toBe('journal_missing_sealed');
      expect(sealed.usage.notStartedCases).toBe(48);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('seals marker-only crash evidence without env, executor, replay, or a second publication', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-marker-only-'));
    try {
      const marker = buildPhase697V3Marker({
        runId: LIVE_RUN_ID,
        runScope: 'branch',
        ownerProcessId: DEAD_OWNER_PROCESS_ID,
      });
      expect((await reservePhase697V3Marker({ root, marker })).ok).toBe(true);
      const first = await sealOrphanForTest(root);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      expect(first.disposition).toBe('journal_missing_sealed');
      expect(first.gate).toBe('quality_gate_failed');
      expect(first.usage.executorStartedCases).toBe(0);
      expect(first.usage.unknownCases).toBe(0);
      expect(first.usage.notStartedCases).toBe(48);
      const firstBytes = await readFile(resolve(root, first.evidencePath), 'utf8');
      const second = await sealOrphanForTest(root);
      expect(second).toEqual(first);
      expect(await readFile(resolve(root, first.evidencePath), 'utf8')).toBe(firstBytes);
      await expect(access(resolve(root, phase697V3JournalPath(LIVE_RUN_ID)))).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('seals a durable dispatch without terminal as attempted orphaned and never starts siblings', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-dispatch-crash-'));
    try {
      const { marker, writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      const mock = await mockV3Report(MOCK_RUN_ID);
      for (const entry of mock.caseEntries.filter((entry) => entry.executionKind === 'zero_call')) {
        const terminal = projectPhase697V3TerminalEntry(entry);
        if (!terminal) throw new Error('terminal projection failed');
        await writer.append({ kind: 'guard_terminal', terminal });
      }
      await writer.append({
        kind: 'dispatch_started',
        caseId: 'tutor-runtime-01',
        agent: 'tutor',
        pairedRunIndex: 0,
        dispatchKeySha256: phase697V3DispatchKeySha256({
          runId: LIVE_RUN_ID,
          agent: 'tutor',
          pairedRunIndex: 0,
        }),
      });
      await writer.close();

      const sealed = await sealOrphanForTest(root);
      expect(sealed.ok).toBe(true);
      if (!sealed.ok) throw new Error(sealed.code);
      expect(sealed.disposition).toBe('orphan_sealed');
      expect(sealed.usage.executorStartedCases).toBe(1);
      expect(sealed.usage.unknownCases).toBe(1);
      expect(sealed.usage.notStartedCases).toBe(47);
      const envelope = JSON.parse(await readFile(resolve(root, sealed.evidencePath), 'utf8')) as {
        report: {
          caseEntries: Array<Record<string, unknown>>;
          scheduler: { dispatchedPairs: number; completedPairs: number };
          ledger: { reservedEntries: number; terminalEntries: number };
        };
      };
      expect(envelope.report.scheduler).toMatchObject({ dispatchedPairs: 1, completedPairs: 0 });
      expect(envelope.report.ledger).toEqual({ reservedEntries: 1, terminalEntries: 0 });
      expect(
        envelope.report.caseEntries.find((entry) => entry.caseId === 'tutor-runtime-01'),
      ).toMatchObject({
        runtimeInvocations: 1,
        executionOutcome: 'attempted_orphaned',
        usageDisposition: 'unknown_after_attempt',
        dispatchRecorded: true,
        lastCompletedStage: null,
      });
      expect(
        envelope.report.caseEntries.find((entry) => entry.caseId === 'organizer-runtime-01'),
      ).toMatchObject({
        runtimeInvocations: 0,
        executionOutcome: 'not_started_orphaned',
        dispatchRecorded: false,
      });
      expect(marker.runId).toBe(LIVE_RUN_ID);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('preserves durable terminal results and appends only one seal record', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-terminal-crash-'));
    try {
      const { writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      const mock = await mockV3Report(MOCK_RUN_ID);
      const guards = mock.caseEntries.filter((entry) => entry.executionKind === 'zero_call');
      for (const entry of guards) {
        const terminal = projectPhase697V3TerminalEntry(entry)!;
        await writer.append({ kind: 'guard_terminal', terminal });
      }
      const pair = mock.caseEntries.filter((entry) => entry.pairedRunIndex === 0);
      for (const entry of pair) {
        const key = phase697V3DispatchKeySha256({
          runId: LIVE_RUN_ID,
          agent: entry.agent,
          pairedRunIndex: 0,
        });
        await writer.append({
          kind: 'dispatch_started',
          caseId: entry.caseId,
          agent: entry.agent,
          pairedRunIndex: 0,
          dispatchKeySha256: key,
        });
        await writer.append({
          kind: 'runtime_terminal',
          dispatchKeySha256: key,
          terminal: projectPhase697V3TerminalEntry(entry)!,
        });
      }
      await writer.append({
        kind: 'pair_terminal',
        pairedRunIndex: 0,
        pairedLatencyMs: Math.max(...pair.map((entry) => entry.latencyMs ?? 0)),
      });
      await writer.close();
      const first = await sealOrphanForTest(root);
      expect(first.ok).toBe(true);
      if (!first.ok) throw new Error(first.code);
      const journalAfterFirst = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(journalAfterFirst.ok).toBe(true);
      if (!journalAfterFirst.ok) throw new Error(journalAfterFirst.code);
      const recordCount = journalAfterFirst.journal.records.length;
      expect(journalAfterFirst.journal.sealed).toMatchObject({ disposition: 'orphan_sealed' });
      const envelope = JSON.parse(await readFile(resolve(root, first.evidencePath), 'utf8')) as {
        report: { caseEntries: Array<Record<string, unknown>> };
      };
      for (const original of pair) {
        expect(
          envelope.report.caseEntries.find((entry) => entry.caseId === original.caseId),
        ).toEqual(original);
      }
      expect((await sealOrphanForTest(root)).ok).toBe(true);
      const journalAfterSecond = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(journalAfterSecond.ok).toBe(true);
      if (!journalAfterSecond.ok) throw new Error(journalAfterSecond.code);
      expect(journalAfterSecond.journal.records).toHaveLength(recordCount);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('serializes concurrent orphan sealers without duplicate journal seals', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-sealer-race-'));
    try {
      const { writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      await writer.close();
      const results = await Promise.all([sealOrphanForTest(root), sealOrphanForTest(root)]);
      expect(results.some((entry) => entry.ok)).toBe(true);
      expect(
        results.every(
          (entry) => entry.ok || (!entry.ok && entry.code === 'live_attempt_in_progress'),
        ),
      ).toBe(true);
      const final = await sealOrphanForTest(root);
      expect(final.ok).toBe(true);
      if (!final.ok) throw new Error(final.code);
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(journal.ok).toBe(true);
      if (!journal.ok) throw new Error(journal.code);
      expect(
        journal.journal.records.filter((entry) => entry.payload.kind === 'evidence_sealed'),
      ).toHaveLength(1);
      expect(
        await validatePhase697TutorOrganizerV3EvidenceBundle({
          root,
          evidencePath: resolve(root, final.evidencePath),
        }),
      ).toEqual({ ok: true });
      await writeFile(resolve(root, final.evidencePath), 'conflicting final evidence\n', 'utf8');
      expect(await sealOrphanForTest(root)).toEqual({
        ok: false,
        code: 'evidence_target_conflict',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('detects sequence/hash tampering and rejects journal sensitive or extra fields', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-journal-tamper-'));
    try {
      const { writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      await expect(
        writer.append({
          kind: 'dispatch_started',
          caseId: 'tutor-runtime-01',
          agent: 'tutor',
          pairedRunIndex: 0,
          dispatchKeySha256: phase697V3DispatchKeySha256({
            runId: LIVE_RUN_ID,
            agent: 'tutor',
            pairedRunIndex: 0,
          }),
          apiKey: 'sk-sensitive-material',
        } as never),
      ).rejects.toBeDefined();
      await writer.close().catch(() => undefined);
      const path = resolve(root, phase697V3JournalPath(LIVE_RUN_ID));
      const lines = (await readFile(path, 'utf8')).trimEnd().split('\n');
      const first = JSON.parse(lines[0]!) as Record<string, unknown>;
      first.sequence = 3;
      expect(parseAndValidatePhase697V3Journal(`${JSON.stringify(first)}\n`)).toBeNull();
      const hashTampered = JSON.parse(lines[0]!) as { recordSha256: string };
      hashTampered.recordSha256 = `${hashTampered.recordSha256.slice(0, -1)}${
        hashTampered.recordSha256.endsWith('0') ? '1' : '0'
      }`;
      expect(parseAndValidatePhase697V3Journal(`${JSON.stringify(hashTampered)}\n`)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects dispatch, pair, and run completion events that violate the journal state machine', async () => {
    const marker = buildPhase697V3Marker({
      runId: LIVE_RUN_ID,
      runScope: 'branch',
      ownerProcessId: DEAD_OWNER_PROCESS_ID,
    });
    const markerSha256 = sha256Stable(marker);
    const initialized: Phase697V3JournalPayload = {
      kind: 'journal_initialized',
      markerSha256,
      runScope: 'branch',
      mode: 'live',
      datasetSha256: marker.datasetSha256,
    };
    const tutorDispatch: Phase697V3JournalPayload = {
      kind: 'dispatch_started',
      caseId: 'tutor-runtime-01',
      agent: 'tutor',
      pairedRunIndex: 0,
      dispatchKeySha256: phase697V3DispatchKeySha256({
        runId: LIVE_RUN_ID,
        agent: 'tutor',
        pairedRunIndex: 0,
      }),
    };
    expect(serializeJournal(LIVE_RUN_ID, [initialized, tutorDispatch])).not.toBeNull();
    expect(
      parseAndValidatePhase697V3Journal(
        serializeJournal(LIVE_RUN_ID, [initialized, tutorDispatch]),
      ),
    ).toBeNull();

    const mock = await mockV3Report(MOCK_RUN_ID);
    const guards: Phase697V3JournalPayload[] = mock.caseEntries
      .filter((entry) => entry.executionKind === 'zero_call')
      .map((entry) => ({
        kind: 'guard_terminal',
        terminal: projectPhase697V3TerminalEntry(entry)!,
      }));
    const organizerDispatch: Phase697V3JournalPayload = {
      kind: 'dispatch_started',
      caseId: 'organizer-runtime-01',
      agent: 'wrong_question_organizer',
      pairedRunIndex: 0,
      dispatchKeySha256: phase697V3DispatchKeySha256({
        runId: LIVE_RUN_ID,
        agent: 'wrong_question_organizer',
        pairedRunIndex: 0,
      }),
    };
    expect(
      parseAndValidatePhase697V3Journal(
        serializeJournal(LIVE_RUN_ID, [
          initialized,
          ...guards,
          tutorDispatch,
          organizerDispatch,
          { kind: 'pair_terminal', pairedRunIndex: 0, pairedLatencyMs: 1 },
        ]),
      ),
    ).toBeNull();
    expect(
      parseAndValidatePhase697V3Journal(
        serializeJournal(LIVE_RUN_ID, [
          initialized,
          ...guards,
          {
            kind: 'run_completed',
            reportSha256: sha256Stable({ incomplete: true }),
            gate: 'quality_gate_failed',
          },
        ]),
      ),
    ).toBeNull();
  });

  test('rejects marker and journal SHA disagreement when reconstructing sealed evidence', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-marker-journal-mismatch-'));
    try {
      const { marker, writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      await writer.close();
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      if (!journal.ok) throw new Error(journal.code);
      expect(
        buildPhase697V3SealedReport({
          marker,
          markerSha256: sha256Stable({ wrong: 'marker' }),
          journal: journal.journal,
        }),
      ).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('publishes via hard link, tolerates orphan temp cleanup, accepts same bytes, and rejects conflicts', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-publisher-'));
    try {
      const report = await mockV3Report(MOCK_RUN_ID);
      const envelope = buildPhase697V3EvidenceEnvelope({
        report,
        disposition: 'mock_direct',
        markerSha256: null,
        journalTailSha256: null,
        journalSequence: null,
      });
      const evidencePath = phase697V3EvidencePath({
        runScope: 'branch',
        mode: 'mock',
        runId: MOCK_RUN_ID,
      });
      expect(
        await publishPhase697V3Evidence({
          root,
          evidencePath: resolve(root, evidencePath),
          envelope,
        }),
      ).toEqual({ ok: false, code: 'evidence_path_invalid' });
      expect(
        await publishPhase697V3Evidence({
          root,
          evidencePath: `../${evidencePath}`,
          envelope,
        }),
      ).toEqual({ ok: false, code: 'evidence_path_invalid' });
      expect(
        await publishPhase697V3Evidence({
          root,
          evidencePath,
          envelope,
          overrides: {
            temporaryId: () => 'open-failure',
            open: async () => {
              throw Object.assign(new Error('simulated open failure'), { code: 'EACCES' });
            },
          },
        }),
      ).toEqual({ ok: false, code: 'evidence_io_failed' });
      expect(
        await publishPhase697V3Evidence({
          root,
          evidencePath,
          envelope,
          overrides: {
            temporaryId: () => 'link-failure',
            link: async () => {
              throw Object.assign(new Error('simulated link failure'), { code: 'EACCES' });
            },
          },
        }),
      ).toEqual({ ok: false, code: 'evidence_io_failed' });
      await expect(access(resolve(root, evidencePath))).rejects.toBeDefined();
      const first = await publishPhase697V3Evidence({
        root,
        evidencePath,
        envelope,
        overrides: {
          temporaryId: () => 'orphan-temp',
          unlink: async () => {
            throw new Error('simulated cleanup failure');
          },
        },
      });
      expect(first).toMatchObject({ ok: true, disposition: 'published' });
      expect(
        await access(resolve(root, `${evidencePath}.tmp-${process.pid}-orphan-temp`)),
      ).toBeNull();
      const second = await publishPhase697V3Evidence({
        root,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'same-bytes' },
      });
      expect(second).toMatchObject({ ok: true, disposition: 'same_bytes' });
      await writeFile(resolve(root, evidencePath), 'conflict\n', 'utf8');
      const conflict = await publishPhase697V3Evidence({
        root,
        evidencePath,
        envelope,
        overrides: { temporaryId: () => 'conflict' },
      });
      expect(conflict).toEqual({ ok: false, code: 'evidence_target_conflict' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('rejects cross-version reports, filenames, durability hashes, and final EEXIST mismatch', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-validator-'));
    try {
      const v1 = await runPhase697TutorOrganizerPairedEval(
        createPhase697TutorOrganizerMockHarness({ runId: MOCK_RUN_ID }),
      );
      const v2 = await runPhase697TutorOrganizerPairedEvalV2(
        createPhase697TutorOrganizerMockHarness({ runId: MOCK_RUN_ID }),
      );
      expect(validatePhase697TutorOrganizerV3EvidenceValue(v1)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
      expect(validatePhase697TutorOrganizerV3EvidenceValue(v2)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
      const result = await executePhase697TutorOrganizerV3Cli({
        argv: ['mock'],
        env: {},
        repositoryRoot: root,
        runId: MOCK_RUN_ID,
      });
      if (!result.ok) throw new Error(result.code);
      const path = resolve(root, result.evidencePath);
      const wrongName = resolve(root, '.tmp/wrong-v3-name.json');
      await writeFile(wrongName, await readFile(path, 'utf8'), 'utf8');
      expect(await validatePhase697TutorOrganizerV3EvidenceFile({ path: wrongName })).toEqual({
        ok: false,
        code: 'evidence_filename_invalid',
      });
      const tampered = JSON.parse(await readFile(path, 'utf8')) as {
        reportSha256: string;
      };
      tampered.reportSha256 = `sha256:${'0'.repeat(64)}`;
      expect(validatePhase697TutorOrganizerV3EvidenceValue(tampered)).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('completes a crash after final hard-link by appending the missing seal only', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-after-final-'));
    try {
      const { marker, markerSha256, writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      await writer.close();
      const journal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      if (!journal.ok) throw new Error(journal.code);
      const report = buildPhase697V3SealedReport({
        marker,
        markerSha256,
        journal: journal.journal,
      });
      if (!report) throw new Error('sealed report failed');
      const envelope = buildPhase697V3EvidenceEnvelope({
        report,
        disposition: 'orphan_sealed',
        markerSha256,
        journalTailSha256: journal.journal.tailSha256,
        journalSequence: journal.journal.lastSequence,
      });
      const evidencePath = phase697V3EvidencePath({
        runScope: 'branch',
        mode: 'live',
        runId: LIVE_RUN_ID,
      });
      expect((await publishPhase697V3Evidence({ root, evidencePath, envelope })).ok).toBe(true);
      const before = await readFile(resolve(root, evidencePath), 'utf8');
      const sealed = await sealOrphanForTest(root);
      expect(sealed.ok).toBe(true);
      expect(await readFile(resolve(root, evidencePath), 'utf8')).toBe(before);
      const afterJournal = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      expect(afterJournal.ok).toBe(true);
      if (!afterJournal.ok) throw new Error(afterJournal.code);
      expect(afterJournal.journal.sealed).toMatchObject({ disposition: 'orphan_sealed' });
      expect(
        await validatePhase697TutorOrganizerV3EvidenceBundle({
          root,
          evidencePath: resolve(root, evidencePath),
        }),
      ).toEqual({ ok: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('seals a fully terminal journal that crashed after report completion but before final publish', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'phase-6-9-7-v3-before-final-'));
    try {
      const { marker, markerSha256, writer } = await reserveWithJournal(root, LIVE_RUN_ID);
      const mock = await mockV3Report(MOCK_RUN_ID);
      for (const entry of mock.caseEntries.filter((entry) => entry.executionKind === 'zero_call')) {
        await writer.append({
          kind: 'guard_terminal',
          terminal: projectPhase697V3TerminalEntry(entry)!,
        });
      }
      for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
        const pair = mock.caseEntries.filter((entry) => entry.pairedRunIndex === pairedRunIndex);
        for (const entry of pair) {
          const dispatchKeySha256 = phase697V3DispatchKeySha256({
            runId: LIVE_RUN_ID,
            agent: entry.agent,
            pairedRunIndex,
          });
          await writer.append({
            kind: 'dispatch_started',
            caseId: entry.caseId,
            agent: entry.agent,
            pairedRunIndex,
            dispatchKeySha256,
          });
          await writer.append({
            kind: 'runtime_terminal',
            dispatchKeySha256,
            terminal: projectPhase697V3TerminalEntry(entry)!,
          });
        }
        await writer.append({
          kind: 'pair_terminal',
          pairedRunIndex,
          pairedLatencyMs: mock.latency.pairedCandidateSamplesMs[pairedRunIndex]!,
        });
      }
      await writer.close();
      const beforeCompleted = await readPhase697V3Journal({ root, runId: LIVE_RUN_ID });
      if (!beforeCompleted.ok) throw new Error(beforeCompleted.code);
      const report = buildPhase697V3SealedReport({
        marker,
        markerSha256,
        journal: beforeCompleted.journal,
      });
      if (!report) throw new Error('report reconstruction failed');
      const claimed = await acquirePhase697V3RecoveryClaim({
        root,
        marker,
        overrides: { processAlive: testProcessAlive },
      });
      if (!claimed.ok) throw new Error(claimed.code);
      const appender = await openPhase697V3JournalAppender({
        root,
        journal: beforeCompleted.journal,
        claim: claimed.claim,
      });
      if (!appender.ok) throw new Error(appender.code);
      await appender.writer.append({
        kind: 'run_completed',
        reportSha256: sha256Stable(report),
        gate: report.gate,
      });
      await appender.writer.close();
      await claimed.claim.release();

      const sealed = await sealOrphanForTest(root);
      expect(sealed.ok).toBe(true);
      if (!sealed.ok) throw new Error(sealed.code);
      expect(sealed.disposition).toBe('completed_run');
      expect(sealed.execution.executorStartedCases).toBe(48);
      expect(sealed.execution.usageVerifiedCases).toBe(48);
      expect(sealed.execution.usageUnknownCases).toBe(0);
      expect(
        await validatePhase697TutorOrganizerV3EvidenceBundle({
          root,
          evidencePath: resolve(root, sealed.evidencePath),
        }),
      ).toEqual({ ok: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function testProcessAlive(processId: number): boolean {
  return processId === process.pid;
}

function sealOrphanForTest(root: string) {
  return sealPhase697TutorOrganizerV3Orphan({ root, processAlive: testProcessAlive });
}

function serializeJournal(runId: string, payloads: readonly Phase697V3JournalPayload[]): string {
  let previousRecordSha256: string | null = null;
  const records = payloads.map((payload, sequence) => {
    const record = buildPhase697V3JournalRecord({
      runId,
      sequence,
      previousRecordSha256,
      payload,
    });
    previousRecordSha256 = record.recordSha256;
    return stableJsonStringify(record);
  });
  return `${records.join('\n')}\n`;
}

async function reserveWithJournal(root: string, runId: string) {
  const marker = buildPhase697V3Marker({
    runId,
    runScope: 'branch',
    executorProvenance: 'synthetic_test',
    ownerProcessId: DEAD_OWNER_PROCESS_ID,
  });
  const reserved = await reservePhase697V3Marker({ root, marker });
  if (!reserved.ok) throw new Error(reserved.code);
  const journal = await createPhase697V3Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
  });
  if (!journal.ok) throw new Error(journal.code);
  return { marker, markerSha256: reserved.markerSha256, writer: journal.writer };
}

async function mockV3Report(runId: string) {
  return runPhase697TutorOrganizerPairedEvalV3(createPhase697TutorOrganizerMockHarness({ runId }));
}

function completeV3LiveEnv(): Readonly<Record<string, string>> {
  return {
    PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED: 'true',
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'synthetic-tutor-key',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'synthetic-organizer-key',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3000',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
  };
}

function hostileEnv(): Readonly<Record<string, string | undefined>> {
  const env = {} as Record<string, string | undefined>;
  Object.defineProperty(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY', {
    enumerable: true,
    get() {
      throw new Error('sealer must not read credentials');
    },
  });
  return env;
}

function createSyntheticExecutors(
  onInvoke: (
    agent: 'tutor' | 'wrong_question_organizer',
    pairedRunIndex: number,
  ) => void | Promise<void>,
): { tutorExecutor: StructuredModelExecutor; organizerExecutor: StructuredModelExecutor } {
  const tutorCases = phase69TutorCases.filter((entry) => entry.expectedRuntimeInvocations === 1);
  const organizerCases = phase69WrongQuestionOrganizerCases.filter(
    (entry) => entry.expectedRuntimeInvocations === 1,
  );
  let tutorIndex = 0;
  let organizerIndex = 0;
  return {
    tutorExecutor: async () => {
      const entry = tutorCases[tutorIndex++]!;
      await onInvoke('tutor', entry.pairedRunIndex);
      return {
        object: {
          intent: entry.expected.intent,
          depth: entry.expected.depth,
          confidence: 'high',
          evidenceCodes: [tutorEvidence(entry.expected.intent)],
        },
        usage: { inputTokens: 420, outputTokens: 90 },
      };
    },
    organizerExecutor: async (request) => {
      const entry = organizerCases[organizerIndex++]!;
      await onInvoke('wrong_question_organizer', entry.pairedRunIndex);
      const projection = JSON.parse(request.userPrompt) as {
        questions: Array<{ subjectHint: string }>;
      };
      return {
        object: {
          decisions: entry.expected.decisions.map((decision) => ({
            questionIndex: decision.questionIndex,
            subject:
              projection.questions[decision.questionIndex]?.subjectHint === 'unknown'
                ? decision.subject
                : 'keep_local',
            deck:
              decision.deckAction === 'reuse_existing'
                ? { action: 'reuse_existing', deckIndex: decision.deckIndex }
                : { action: 'create_topic', topicLabel: decision.canonicalTopicLabel },
            confidence: decision.confidence,
            evidenceCodes: decision.requiredEvidenceCodes,
          })),
        },
        usage: { inputTokens: 760, outputTokens: 180 },
      };
    },
  };
}

function tutorEvidence(
  intent:
    | 'explain_solution'
    | 'socratic_hint'
    | 'step_check'
    | 'concept_bridge'
    | 'general_follow_up',
) {
  switch (intent) {
    case 'explain_solution':
      return 'full_explanation_request';
    case 'socratic_hint':
      return 'implicit_hint_request';
    case 'step_check':
      return 'submitted_step';
    case 'concept_bridge':
      return 'concept_gap';
    case 'general_follow_up':
      return 'contextual_reference';
  }
}
