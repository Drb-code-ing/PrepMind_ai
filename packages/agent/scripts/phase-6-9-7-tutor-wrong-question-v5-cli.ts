import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenAICompatibleStructuredExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA,
  PHASE_6_9_7_V5_APPROVAL_ENV,
  PHASE_6_9_7_V5_CONFIRMATION,
  buildPhase697V5EvidenceEnvelope,
  type Phase697TutorOrganizerV5Report,
  type Phase697V5EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import { createPhase697TutorOrganizerV5MockHarness } from '../src/evals/phase-6-9-tutor-wrong-question-v5-mock.ts';
import {
  PHASE_6_9_7_V5_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
  PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
  createPhase697TutorOrganizerV5LiveHarness,
  resolvePhase697V5LiveConfiguration,
  type Phase697V5LiveConfiguration,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-live.ts';
import {
  buildPhase697V5Marker,
  buildPhase697V5SealedReport,
  phase697V5EvidencePath as phase697V5DurableEvidencePath,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV5,
  type Phase697V5Harness,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import {
  acquirePhase697V5RecoveryClaim,
  createPhase697V5Journal,
  openPhase697V5JournalAppender,
  publishPhase697V5Evidence,
  readPhase697V5Journal,
  readPhase697V5Marker,
  reservePhase697V5Marker,
  type Phase697V5DurabilityFsOverrides,
  type Phase697V5RecoveryClaim,
} from './phase-6-9-7-tutor-wrong-question-v5-durability.ts';
import { createPhase697V5JournalLifecycle } from './phase-6-9-7-tutor-wrong-question-v5-journal-lifecycle.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  validatePhase697TutorOrganizerV5EvidenceBundle,
  validatePhase697TutorOrganizerV5EvidenceValue,
} from './validate-phase-6-9-7-tutor-wrong-question-v5-evidence.ts';

export type Phase697TutorOrganizerV5CliParseResult =
  | Readonly<{ ok: true; mode: 'mock' | 'live'; runScope: 'branch' | 'main' }>
  | Readonly<{ ok: false; code: 'cli_invalid' | 'live_authorization_required' }>;

export type Phase697TutorOrganizerV5CliResult =
  | Readonly<{
      ok: true;
      runId: string;
      gate: Phase697TutorOrganizerV5Report['gate'];
      evidencePath: string;
      disposition: Phase697V5EvidenceEnvelope['durability']['disposition'];
      counts: Phase697TutorOrganizerV5Report['counts'];
      scheduler: Phase697TutorOrganizerV5Report['scheduler'];
      usage: Phase697TutorOrganizerV5Report['usage'];
    }>
  | Readonly<{ ok: false; code: string }>;

export type Phase697V5HarnessFactory = (
  input: Readonly<{
    mode: 'mock' | 'live';
    runScope: 'branch' | 'main';
    runId: string;
  }>,
) => Promise<Readonly<Phase697V5Harness>> | Readonly<Phase697V5Harness>;

export type Phase697TutorOrganizerV5CliInput = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
  harnessFactory?: Phase697V5HarnessFactory;
  durabilityOverrides?: Phase697V5DurabilityFsOverrides;
}>;

export function parsePhase697TutorOrganizerV5Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerV5CliParseResult {
  const mode = input.argv[0];
  if (mode === 'mock') {
    if (input.argv.length > 2) return { ok: false, code: 'cli_invalid' };
    const runScope = parseRunScope(input.argv[1]);
    return runScope ? { ok: true, mode: 'mock', runScope } : { ok: false, code: 'cli_invalid' };
  }
  if (mode === 'live') {
    if (
      input.argv.length < 2 ||
      input.argv.length > 3 ||
      input.argv[1] !== PHASE_6_9_7_V5_CONFIRMATION ||
      !approvalEnabled(input.env)
    ) {
      return { ok: false, code: 'live_authorization_required' };
    }
    const runScope = parseRunScope(input.argv[2]);
    return runScope ? { ok: true, mode: 'live', runScope } : { ok: false, code: 'cli_invalid' };
  }
  return { ok: false, code: 'cli_invalid' };
}

export async function executePhase697TutorOrganizerV5Cli(
  input: Phase697TutorOrganizerV5CliInput,
): Promise<Phase697TutorOrganizerV5CliResult> {
  const parsed = parsePhase697TutorOrganizerV5Cli(input);
  if (!parsed.ok) return parsed;
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  const runId = input.runId ?? randomUUID();
  const injectedHarnessFactory = input.harnessFactory !== undefined;
  let liveConfiguration: Phase697V5LiveConfiguration | null = null;
  if (parsed.mode === 'live') {
    const resolved = resolvePhase697V5LiveConfiguration(input.env);
    if (!resolved.ok) return resolved;
    liveConfiguration = resolved.value;
  }
  const harnessFactory =
    input.harnessFactory ??
    (parsed.mode === 'mock'
      ? ({ runId: factoryRunId, runScope }: Parameters<Phase697V5HarnessFactory>[0]) =>
          createPhase697TutorOrganizerV5MockHarness({ runId: factoryRunId, runScope })
      : ({ runId: factoryRunId, runScope }: Parameters<Phase697V5HarnessFactory>[0]) => {
          if (liveConfiguration === null) {
            throw new Error('PHASE_6_9_7_V5_LIVE_CONFIGURATION_UNAVAILABLE');
          }
          // The closure is created before marker reservation, but network executors
          // are allocated only when invoked after marker+journal fsync.
          const tutorExecutor = createOpenAICompatibleStructuredExecutor({
            provider: 'deepseek',
            apiKey: liveConfiguration.tutorApiKey,
            baseURL: PHASE_6_9_7_V5_DEEPSEEK_BASE_URL,
            model: 'deepseek-v4-pro',
            structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
          });
          const organizerExecutor = createOpenAICompatibleStructuredExecutor({
            provider: 'deepseek',
            apiKey: liveConfiguration.organizerApiKey,
            baseURL: PHASE_6_9_7_V5_DEEPSEEK_BASE_URL,
            model: 'deepseek-v4-pro',
            structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
          });
          return createPhase697TutorOrganizerV5LiveHarness({
            tutorExecutor,
            organizerExecutor,
            runId: factoryRunId,
            runScope,
            tutorTimeoutMs: PHASE_6_9_7_V5_TUTOR_TIMEOUT_MS,
            organizerTimeoutMs: PHASE_6_9_7_V5_ORGANIZER_TIMEOUT_MS,
            executorProvenance: 'deepseek_network',
          });
        });
  if (parsed.mode === 'mock') {
    let report: Readonly<Phase697TutorOrganizerV5Report>;
    try {
      const harness = await harnessFactory({
        mode: 'mock',
        runScope: parsed.runScope,
        runId,
      });
      report = await runPhase697TutorOrganizerPairedEvalV5(harness);
    } catch {
      return { ok: false, code: 'execution_failed' };
    }
    const envelope = buildPhase697V5EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope || !validatePhase697TutorOrganizerV5EvidenceValue(envelope).ok) {
      return { ok: false, code: 'evidence_contract_invalid' };
    }
    const evidencePath = phase697V5DurableEvidencePath({
      runId,
      runScope: parsed.runScope,
      mode: 'mock',
    });
    const published = await publishPhase697V5Evidence({
      root,
      evidencePath,
      envelope,
      overrides: input.durabilityOverrides,
    });
    return published.ok ? summarizeEnvelope(envelope, evidencePath) : published;
  }

  const marker = buildPhase697V5Marker({
    runId,
    runScope: parsed.runScope,
    executorProvenance: injectedHarnessFactory ? 'synthetic_test' : 'deepseek_network',
  });
  const reserved = await reservePhase697V5Marker({
    root,
    marker,
    overrides: input.durabilityOverrides,
  });
  if (!reserved.ok) return reserved;
  const journal = await createPhase697V5Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
    overrides: input.durabilityOverrides,
  });
  if (!journal.ok) return journal;

  let report: Readonly<Phase697TutorOrganizerV5Report>;
  try {
    // Marker and journal initialization are both fsynced before the injected
    // factory can allocate a network executor or enter either lane.
    const harness = await harnessFactory({
      mode: 'live',
      runScope: parsed.runScope,
      runId,
    });
    if (
      harness.mode !== 'live' ||
      harness.provider !== 'deepseek' ||
      harness.model !== 'deepseek-v4-pro' ||
      harness.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json' ||
      harness.executorProvenance !== marker.executorProvenance
    ) {
      await journal.writer.close().catch(() => undefined);
      return { ok: false, code: 'runtime_factory_identity_invalid' };
    }
    report = await runPhase697TutorOrganizerPairedEvalV5(harness, {
      lifecycle: createPhase697V5JournalLifecycle(journal.writer, runId),
    });
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'execution_failed' };
  }
  if (
    hasSensitivePhase697Evidence(report) ||
    !PHASE_6_9_7_TUTOR_ORGANIZER_V5_REPORT_SCHEMA.safeParse(report).success
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
  const envelope = buildPhase697V5EvidenceEnvelope({
    report,
    disposition: 'completed_run',
    markerSha256: reserved.markerSha256,
    journalTailSha256: snapshot.tailSha256,
    journalSequence: snapshot.lastSequence,
  });
  if (!envelope) {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const evidencePath = phase697V5DurableEvidencePath({
    runId,
    runScope: parsed.runScope,
    mode: 'live',
  });
  const published = await publishPhase697V5Evidence({
    root,
    evidencePath,
    envelope,
    overrides: input.durabilityOverrides,
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
  const bundle = await validatePhase697TutorOrganizerV5EvidenceBundle({
    root,
    evidencePath: resolve(root, evidencePath),
  });
  return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
}

export async function sealPhase697TutorOrganizerV5Orphan(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
  durabilityOverrides?: Phase697V5DurabilityFsOverrides;
  afterRecoveryClaimAcquiredForTest?: () => Promise<void> | void;
}): Promise<Phase697TutorOrganizerV5CliResult> {
  let marker = await readPhase697V5Marker({
    root: input.root,
    overrides: input.durabilityOverrides,
  });
  if (!marker.ok) return marker;
  let journalRead = await readPhase697V5Journal({
    root: input.root,
    runId: marker.marker.runId,
    overrides: input.durabilityOverrides,
  });
  if (!journalRead.ok && journalRead.code !== 'journal_missing') return journalRead;
  let journal = journalRead.ok ? journalRead.journal : null;
  if (
    journal &&
    (journal.runId !== marker.marker.runId ||
      journal.runScope !== marker.marker.runScope ||
      journal.markerSha256 !== marker.markerSha256)
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  let claim: Phase697V5RecoveryClaim | null = null;
  if (!journal?.sealed) {
    const claimedJournalTailSha256 = journal?.tailSha256 ?? null;
    const claimed = await acquirePhase697V5RecoveryClaim({
      root: input.root,
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journalTailSha256: claimedJournalTailSha256,
      overrides: {
        ...input.durabilityOverrides,
        ...(input.processAlive ? { processAlive: input.processAlive } : {}),
      },
    });
    if (!claimed.ok) return claimed;
    claim = claimed.claim;
    await input.afterRecoveryClaimAcquiredForTest?.();
    const currentMarker = await readPhase697V5Marker({
      root: input.root,
      overrides: input.durabilityOverrides,
    });
    if (
      !currentMarker.ok ||
      currentMarker.markerSha256 !== marker.markerSha256 ||
      currentMarker.marker.runId !== marker.marker.runId
    ) {
      await claim.release().catch(() => undefined);
      return { ok: false, code: 'durability_identity_invalid' };
    }
    marker = currentMarker;
    journalRead = await readPhase697V5Journal({
      root: input.root,
      runId: marker.marker.runId,
      overrides: input.durabilityOverrides,
    });
    if (!journalRead.ok && journalRead.code !== 'journal_missing') {
      await claim.release().catch(() => undefined);
      return journalRead;
    }
    journal = journalRead.ok ? journalRead.journal : null;
    if (
      (journal?.tailSha256 ?? null) !== claimedJournalTailSha256 ||
      (journal &&
        (journal.runId !== marker.marker.runId ||
          journal.runScope !== marker.marker.runScope ||
          journal.markerSha256 !== marker.markerSha256))
    ) {
      await claim.release().catch(() => undefined);
      return { ok: false, code: 'durability_identity_invalid' };
    }
  }

  try {
    if (claim && !(await claim.assertOwned())) return { ok: false, code: 'recovery_claim_lost' };
    const report = buildPhase697V5SealedReport({
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journal,
    });
    if (!report) return { ok: false, code: 'journal_contract_invalid' };
    const alreadySealed = journal?.sealed ?? null;
    const disposition: Phase697V5EvidenceEnvelope['durability']['disposition'] =
      alreadySealed?.disposition ??
      (journal === null
        ? 'journal_missing_sealed'
        : journal.runCompleted
          ? 'completed_run'
          : 'orphan_sealed');
    const tail =
      journal === null ? null : (alreadySealed?.sealedFromJournalSha256 ?? journal.tailSha256);
    const sequence =
      journal === null ? null : alreadySealed ? journal.lastSequence - 1 : journal.lastSequence;
    const envelope = buildPhase697V5EvidenceEnvelope({
      report,
      disposition,
      markerSha256: marker.markerSha256,
      journalTailSha256: tail,
      journalSequence: sequence,
    });
    if (!envelope) return { ok: false, code: 'evidence_contract_invalid' };
    const evidencePath = phase697V5DurableEvidencePath({
      runId: marker.marker.runId,
      runScope: marker.marker.runScope,
      mode: 'live',
    });
    if (claim && !(await claim.assertOwned())) return { ok: false, code: 'recovery_claim_lost' };
    const published = await publishPhase697V5Evidence({
      root: input.root,
      evidencePath,
      envelope,
      overrides: input.durabilityOverrides,
    });
    if (!published.ok) return published;
    if (journal && !alreadySealed) {
      if (!claim) return { ok: false, code: 'recovery_claim_lost' };
      const appender = await openPhase697V5JournalAppender({
        root: input.root,
        journal,
        claim,
        overrides: input.durabilityOverrides,
      });
      if (!appender.ok) return appender;
      try {
        await appender.writer.append({
          kind: 'evidence_sealed',
          disposition,
          sealedFromJournalSha256: journal.tailSha256,
          evidenceSha256: published.evidenceSha256,
        });
        await appender.writer.close();
      } catch {
        await appender.writer.close().catch(() => undefined);
        return { ok: false, code: 'journal_io_failed' };
      }
    }
    const bundle = await validatePhase697TutorOrganizerV5EvidenceBundle({
      root: input.root,
      evidencePath: resolve(input.root, evidencePath),
    });
    return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
  } finally {
    await claim?.release().catch(() => undefined);
  }
}

function summarizeEnvelope(
  envelope: Readonly<Phase697V5EvidenceEnvelope>,
  evidencePath: string,
): Extract<Phase697TutorOrganizerV5CliResult, { ok: true }> {
  return {
    ok: true,
    runId: envelope.runId,
    gate: envelope.report.gate,
    evidencePath,
    disposition: envelope.durability.disposition,
    counts: envelope.report.counts,
    scheduler: envelope.report.scheduler,
    usage: envelope.report.usage,
  };
}

function parseRunScope(value: string | undefined): 'branch' | 'main' | null {
  if (value === undefined || value === 'branch') return 'branch';
  return value === 'main' ? 'main' : null;
}

function safeReadEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
    throw new Error('PHASE_6_9_7_V5_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

function approvalEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    return safeReadEnv(env, PHASE_6_9_7_V5_APPROVAL_ENV) === 'true';
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const result = await executePhase697TutorOrganizerV5Cli({
    argv: process.argv.slice(2),
    env: process.env,
  }).catch(() => ({ ok: false as const, code: 'execution_failed' }));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
