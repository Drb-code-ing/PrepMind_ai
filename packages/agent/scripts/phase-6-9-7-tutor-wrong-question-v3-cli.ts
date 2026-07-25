import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenAICompatibleStructuredExecutor, type StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
  type Phase697TutorOrganizerV3Report,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-contract.ts';
import {
  buildPhase697V3EvidenceEnvelope,
  buildPhase697V3Marker,
  buildPhase697V3SealedReport,
  phase697V3DispatchKeySha256,
  phase697V3EvidencePath,
  projectPhase697V3TerminalEntry,
  sha256Stable,
  type Phase697V3EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV3,
  type Phase697V3RunnerLifecycle,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import {
  createPhase697TutorOrganizerLiveHarness,
  createPhase697TutorOrganizerMockHarness,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  acquirePhase697V3RecoveryClaim,
  createPhase697V3Journal,
  openPhase697V3JournalAppender,
  publishPhase697V3Evidence,
  readPhase697V3Journal,
  readPhase697V3Marker,
  reservePhase697V3Marker,
  type Phase697V3JournalWriter,
  type Phase697V3RecoveryClaim,
} from './phase-6-9-7-tutor-wrong-question-v3-durability.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import { validatePhase697TutorOrganizerV3EvidenceBundle } from './validate-phase-6-9-7-tutor-wrong-question-v3-evidence.ts';

export const PHASE_6_9_7_V3_LIVE_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V3_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_V3_LIVE_APPROVAL_ENV = 'PHASE_6_9_7_V3_CONTROLLED_LIVE_APPROVED' as const;

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
const TUTOR_TIMEOUT_MS = 3_000 as const;
const ORGANIZER_TIMEOUT_MS = 5_000 as const;
const OTHER_AGENT_GATES = [
  'ROUTER_MODEL_ENABLED',
  'KNOWLEDGE_VERIFIER_MODEL_ENABLED',
  'REVIEW_AGENT_MODEL_ENABLED',
  'PLANNER_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED',
] as const;

export type Phase697TutorOrganizerV3CliParseResult =
  | Readonly<{ ok: true; command: 'run'; mode: 'mock' | 'live'; runScope: 'branch' | 'main' }>
  | Readonly<{ ok: true; command: 'seal' }>
  | Readonly<{ ok: false; code: 'cli_invalid' | 'live_authorization_required' }>;

export type Phase697TutorOrganizerV3CliResult =
  | Readonly<{
      ok: true;
      runId: string;
      gate: Phase697TutorOrganizerV3Report['gate'];
      evidencePath: string;
      disposition: 'mock_direct' | 'completed_run' | 'orphan_sealed' | 'journal_missing_sealed';
      counts: Phase697TutorOrganizerV3Report['counts'];
      execution: Phase697TutorOrganizerV3Report['execution'];
      usage: Phase697TutorOrganizerV3Report['usage'];
    }>
  | Readonly<{ ok: false; code: string }>;

export type Phase697TutorOrganizerV3CliInput = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
}>;

type SyntheticTestExecutors = Readonly<{
  tutorExecutor: StructuredModelExecutor;
  organizerExecutor: StructuredModelExecutor;
}>;

export function parsePhase697TutorOrganizerV3Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerV3CliParseResult {
  const command = input.argv[0];
  if (command === 'seal') {
    return input.argv.length === 1
      ? { ok: true, command: 'seal' }
      : { ok: false, code: 'cli_invalid' };
  }
  if (command === 'mock') {
    if (input.argv.length > 2) return { ok: false, code: 'cli_invalid' };
    const runScope = parseScope(input.argv[1]);
    return runScope
      ? { ok: true, command: 'run', mode: 'mock', runScope }
      : { ok: false, code: 'cli_invalid' };
  }
  if (command === 'live') {
    if (input.argv.length < 2 || input.argv.length > 3) {
      return { ok: false, code: 'live_authorization_required' };
    }
    if (
      input.argv[1] !== PHASE_6_9_7_V3_LIVE_CONFIRMATION ||
      safeReadEnv(input.env, PHASE_6_9_7_V3_LIVE_APPROVAL_ENV) !== 'true'
    ) {
      return { ok: false, code: 'live_authorization_required' };
    }
    const runScope = parseScope(input.argv[2]);
    return runScope
      ? { ok: true, command: 'run', mode: 'live', runScope }
      : { ok: false, code: 'cli_invalid' };
  }
  return { ok: false, code: 'cli_invalid' };
}

export async function executePhase697TutorOrganizerV3Cli(
  input: Phase697TutorOrganizerV3CliInput,
): Promise<Phase697TutorOrganizerV3CliResult> {
  return executePhase697TutorOrganizerV3CliInternal(input);
}

export async function executePhase697TutorOrganizerV3CliWithSyntheticExecutorsForTest(
  input: Phase697TutorOrganizerV3CliInput & SyntheticTestExecutors,
): Promise<Phase697TutorOrganizerV3CliResult> {
  return executePhase697TutorOrganizerV3CliInternal(input, {
    tutorExecutor: input.tutorExecutor,
    organizerExecutor: input.organizerExecutor,
  });
}

async function executePhase697TutorOrganizerV3CliInternal(
  input: Phase697TutorOrganizerV3CliInput,
  syntheticExecutors?: SyntheticTestExecutors,
): Promise<Phase697TutorOrganizerV3CliResult> {
  const parsed = parsePhase697TutorOrganizerV3Cli(input);
  if (!parsed.ok) return parsed;
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  if (parsed.command === 'seal') return sealPhase697TutorOrganizerV3Orphan({ root });
  if (parsed.mode === 'mock') {
    const harness = createPhase697TutorOrganizerMockHarness({
      runScope: parsed.runScope,
      ...(input.runId ? { runId: input.runId } : {}),
    });
    let report: Phase697TutorOrganizerV3Report;
    try {
      report = await runPhase697TutorOrganizerPairedEvalV3(harness);
    } catch {
      return { ok: false, code: 'execution_failed' };
    }
    const envelope = buildPhase697V3EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    return publishAndSummarize({ root, envelope });
  }

  const configuration = resolveLiveConfiguration(input.env);
  if (!configuration.ok) return configuration;
  const runId = input.runId ?? randomUUID();
  const marker = buildPhase697V3Marker({
    runId,
    runScope: parsed.runScope,
    executorProvenance: syntheticExecutors ? 'synthetic_test' : 'deepseek_network',
  });
  const reserved = await reservePhase697V3Marker({ root, marker });
  if (!reserved.ok) return reserved;
  const journal = await createPhase697V3Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
  });
  if (!journal.ok) return journal;

  let report: Phase697TutorOrganizerV3Report;
  try {
    // The durable journal exists and its initial record is fsynced before either
    // real executor factory is created.
    const tutorExecutor =
      syntheticExecutors?.tutorExecutor ??
      createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: configuration.tutorApiKey,
        baseURL: DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      });
    const organizerExecutor =
      syntheticExecutors?.organizerExecutor ??
      createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: configuration.organizerApiKey,
        baseURL: DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      });
    const harness = createPhase697TutorOrganizerLiveHarness({
      tutorExecutor,
      organizerExecutor,
      runScope: parsed.runScope,
      runId,
      tutorTimeoutMs: TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: ORGANIZER_TIMEOUT_MS,
      executorProvenance: syntheticExecutors ? 'synthetic_test' : 'deepseek_network',
    });
    report = await runPhase697TutorOrganizerPairedEvalV3(harness, {
      lifecycle: createJournalLifecycle(journal.writer, runId),
    });
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'execution_failed' };
  }
  if (
    hasSensitivePhase697Evidence(report) ||
    !PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse(report).success
  ) {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  let snapshot: Readonly<{ tailSha256: string; lastSequence: number }>;
  try {
    snapshot = await journal.writer.snapshot();
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'journal_io_failed' };
  }
  const envelope = buildPhase697V3EvidenceEnvelope({
    report,
    disposition: 'completed_run',
    markerSha256: reserved.markerSha256,
    journalTailSha256: snapshot.tailSha256,
    journalSequence: snapshot.lastSequence,
  });
  const published = await publishPhase697V3Evidence({
    root,
    evidencePath: phase697V3EvidencePath({ runScope: parsed.runScope, mode: 'live', runId }),
    envelope,
  });
  if (!published.ok) {
    await journal.writer.close().catch(() => undefined);
    return published;
  }
  try {
    await journal.writer.append({
      kind: 'evidence_sealed',
      disposition: 'completed_run',
      sealedFromJournalSha256: snapshot.tailSha256,
      evidenceSha256: published.evidenceSha256,
    });
    await journal.writer.close();
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'journal_io_failed' };
  }
  const evidencePath = phase697V3EvidencePath({ runScope: parsed.runScope, mode: 'live', runId });
  const bundle = await validatePhase697TutorOrganizerV3EvidenceBundle({
    root,
    evidencePath: resolve(root, evidencePath),
  });
  return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : { ok: false, code: bundle.code };
}

export async function sealPhase697TutorOrganizerV3Orphan(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
}): Promise<Phase697TutorOrganizerV3CliResult> {
  // This path deliberately receives no env, credential, approval or executor.
  let marker = await readPhase697V3Marker({ root: input.root });
  if (!marker.ok) return marker;
  let journalRead = await readPhase697V3Journal({
    root: input.root,
    runId: marker.marker.runId,
  });
  if (!journalRead.ok && journalRead.code !== 'journal_missing') return journalRead;
  let validatedJournal = journalRead.ok ? journalRead.journal : null;
  if (
    validatedJournal &&
    (validatedJournal.runId !== marker.marker.runId ||
      validatedJournal.runScope !== marker.marker.runScope ||
      validatedJournal.markerSha256 !== marker.markerSha256)
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  let recoveryClaim: Phase697V3RecoveryClaim | null = null;
  if (!validatedJournal?.sealed) {
    const claimed = await acquirePhase697V3RecoveryClaim({
      root: input.root,
      marker: marker.marker,
      ...(input.processAlive ? { overrides: { processAlive: input.processAlive } } : {}),
    });
    if (!claimed.ok) return claimed;
    recoveryClaim = claimed.claim;
    const currentMarker = await readPhase697V3Marker({ root: input.root });
    if (
      !currentMarker.ok ||
      currentMarker.markerSha256 !== marker.markerSha256 ||
      currentMarker.marker.runId !== marker.marker.runId
    ) {
      await recoveryClaim.release().catch(() => undefined);
      return { ok: false, code: 'durability_identity_invalid' };
    }
    marker = currentMarker;
    journalRead = await readPhase697V3Journal({
      root: input.root,
      runId: marker.marker.runId,
    });
    if (!journalRead.ok && journalRead.code !== 'journal_missing') {
      await recoveryClaim.release().catch(() => undefined);
      return journalRead;
    }
    validatedJournal = journalRead.ok ? journalRead.journal : null;
    if (
      validatedJournal &&
      (validatedJournal.runId !== marker.marker.runId ||
        validatedJournal.runScope !== marker.marker.runScope ||
        validatedJournal.markerSha256 !== marker.markerSha256)
    ) {
      await recoveryClaim.release().catch(() => undefined);
      return { ok: false, code: 'durability_identity_invalid' };
    }
  }

  try {
    if (recoveryClaim && !(await recoveryClaim.assertOwned())) {
      return { ok: false, code: 'recovery_claim_lost' };
    }
    const report = buildPhase697V3SealedReport({
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journal: validatedJournal,
    });
    if (!report) return { ok: false, code: 'journal_contract_invalid' };
    const sealed = validatedJournal?.sealed ?? null;
    const disposition: Phase697V3EvidenceEnvelope['durability']['disposition'] =
      sealed?.disposition ??
      (validatedJournal === null
        ? 'journal_missing_sealed'
        : validatedJournal.runCompleted
          ? 'completed_run'
          : 'orphan_sealed');
    const journalTailSha256 =
      validatedJournal === null
        ? null
        : (sealed?.sealedFromJournalSha256 ?? validatedJournal.tailSha256);
    const journalSequence =
      validatedJournal === null
        ? null
        : sealed
          ? validatedJournal.lastSequence - 1
          : validatedJournal.lastSequence;
    const envelope = buildPhase697V3EvidenceEnvelope({
      report,
      disposition,
      markerSha256: marker.markerSha256,
      journalTailSha256,
      journalSequence,
    });
    const evidencePath = phase697V3EvidencePath({
      runScope: marker.marker.runScope,
      mode: 'live',
      runId: marker.marker.runId,
    });
    if (recoveryClaim && !(await recoveryClaim.assertOwned())) {
      return { ok: false, code: 'recovery_claim_lost' };
    }
    const published = await publishPhase697V3Evidence({
      root: input.root,
      evidencePath,
      envelope,
    });
    if (!published.ok) return published;
    if (validatedJournal && !sealed) {
      if (!recoveryClaim) return { ok: false, code: 'recovery_claim_lost' };
      const appender = await openPhase697V3JournalAppender({
        root: input.root,
        journal: validatedJournal,
        claim: recoveryClaim,
      });
      if (!appender.ok) return appender;
      try {
        await appender.writer.append({
          kind: 'evidence_sealed',
          disposition,
          sealedFromJournalSha256: validatedJournal.tailSha256,
          evidenceSha256: published.evidenceSha256,
        });
        await appender.writer.close();
      } catch {
        await appender.writer.close().catch(() => undefined);
        return { ok: false, code: 'journal_io_failed' };
      }
    }
    const bundle = await validatePhase697TutorOrganizerV3EvidenceBundle({
      root: input.root,
      evidencePath: resolve(input.root, evidencePath),
    });
    return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : { ok: false, code: bundle.code };
  } finally {
    await recoveryClaim?.release().catch(() => undefined);
  }
}

function createJournalLifecycle(
  writer: Phase697V3JournalWriter,
  runId: string,
): Phase697V3RunnerLifecycle {
  return Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = projectPhase697V3TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V3_GUARD_PROJECTION_INVALID');
      await writer.append({ kind: 'guard_terminal', terminal });
    },
    async recordDispatchStarted(reservation, caseId) {
      await writer.append({
        kind: 'dispatch_started',
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256: phase697V3DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
      });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const terminal = projectPhase697V3TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V3_RUNTIME_PROJECTION_INVALID');
      await writer.append({
        kind: 'runtime_terminal',
        dispatchKeySha256: phase697V3DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
        terminal,
      });
    },
    async recordPairTerminal(pairedRunIndex, latencyMs) {
      await writer.append({ kind: 'pair_terminal', pairedRunIndex, pairedLatencyMs: latencyMs });
    },
    async recordBreakerOpened(entry) {
      await writer.append({
        kind: 'breaker_opened',
        breakerState:
          entry.executionKind === 'zero_call' ? 'guard_failed' : 'quality_gate_impossible',
        triggerCaseId: entry.caseId,
        triggerAgent: entry.agent,
        triggerPairedRunIndex: entry.executionKind === 'runtime' ? entry.pairedRunIndex : null,
      });
    },
    async recordRunCompleted(report) {
      await writer.append({
        kind: 'run_completed',
        reportSha256: sha256Stable(report),
        gate: report.gate,
      });
    },
  });
}

async function publishAndSummarize(input: {
  root: string;
  envelope: Readonly<Phase697V3EvidenceEnvelope>;
}): Promise<Phase697TutorOrganizerV3CliResult> {
  const evidencePath = phase697V3EvidencePath({
    runScope: input.envelope.runScope,
    mode: input.envelope.mode,
    runId: input.envelope.runId,
  });
  const published = await publishPhase697V3Evidence({
    root: input.root,
    evidencePath,
    envelope: input.envelope,
  });
  return published.ok ? summarizeEnvelope(input.envelope, evidencePath) : published;
}

function summarizeEnvelope(
  envelope: Readonly<Phase697V3EvidenceEnvelope>,
  evidencePath: string,
): Extract<Phase697TutorOrganizerV3CliResult, { ok: true }> {
  return {
    ok: true,
    runId: envelope.runId,
    gate: envelope.report.gate,
    evidencePath,
    disposition: envelope.durability.disposition,
    counts: envelope.report.counts,
    execution: envelope.report.execution,
    usage: envelope.report.usage,
  };
}

function parseScope(value: string | undefined): 'branch' | 'main' | null {
  if (value === undefined) return 'branch';
  return value === '--main' ? 'main' : null;
}

function resolveLiveConfiguration(
  env: Readonly<Record<string, string | undefined>>,
):
  | Readonly<{ ok: true; tutorApiKey: string; organizerApiKey: string }>
  | Readonly<{ ok: false; code: 'live_configuration_invalid' }> {
  try {
    const tutorApiKey = validCredential(safeReadEnv(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY'));
    const organizerApiKey = validCredential(
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY'),
    );
    const otherGateEnabled = OTHER_AGENT_GATES.some((key) => safeReadEnv(env, key) === 'true');
    if (
      safeReadEnv(env, 'AI_PROVIDER_MODE') !== 'live' ||
      safeReadEnv(env, 'AI_ENABLE_LIVE_CALLS') !== 'true' ||
      safeReadEnv(env, 'TUTOR_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'AI_BASE_URL') !== DEEPSEEK_BASE_URL ||
      !validFixedTimeout(safeReadEnv(env, 'TUTOR_AGENT_MODEL_TIMEOUT_MS'), TUTOR_TIMEOUT_MS) ||
      !validFixedTimeout(
        safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS'),
        ORGANIZER_TIMEOUT_MS,
      ) ||
      tutorApiKey === null ||
      organizerApiKey === null ||
      otherGateEnabled
    ) {
      return { ok: false, code: 'live_configuration_invalid' };
    }
    return { ok: true, tutorApiKey, organizerApiKey };
  } catch {
    return { ok: false, code: 'live_configuration_invalid' };
  }
}

function validCredential(value: string | undefined): string | null {
  if (value === undefined || value.length < 1 || value.length > 512) return null;
  if (value !== value.trim() || /[\r\n]/.test(value)) return null;
  return value;
}

function validFixedTimeout(value: string | undefined, expected: number): boolean {
  return value === undefined || value === '' || value === String(expected);
}

function safeReadEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
    throw new Error('PHASE_6_9_7_V3_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

if (import.meta.main) {
  try {
    const result = await executePhase697TutorOrganizerV3Cli({
      argv: process.argv.slice(2),
      env: process.env,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'execution_failed' })}\n`);
    process.exitCode = 1;
  }
}
