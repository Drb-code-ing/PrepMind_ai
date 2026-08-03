import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA,
  PHASE_6_9_7_V8_APPROVAL_ENV,
  PHASE_6_9_7_V8_CONFIRMATION,
  buildPhase697V8EvidenceEnvelope,
  buildPhase697V8Marker,
  type Phase697TutorOrganizerV8Report,
  type Phase697V8EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-contract.ts';
import {
  buildPhase697V8SealedReport,
  phase697V8EvidencePath as phase697V8DurableEvidencePath,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-durability-contract.ts';
import {
  createPhase697TutorOrganizerV8LiveHarness,
  resolvePhase697V8LiveConfiguration,
  type Phase697V8LiveConfiguration,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-live.ts';
import { createPhase697TutorOrganizerV8MockHarness } from '../src/evals/phase-6-9-tutor-wrong-question-v8-mock.ts';
import {
  runPhase697TutorOrganizerPairedEvalV8,
  type Phase697V8Harness,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import {
  acquirePhase697V8RecoveryClaim,
  createPhase697V8Journal,
  openPhase697V8JournalAppender,
  publishPhase697V8Evidence,
  readPhase697V8Journal,
  readPhase697V8Marker,
  reservePhase697V8Marker,
  type Phase697V8DurabilityFsOverrides,
  type Phase697V8RecoveryClaim,
} from './phase-6-9-7-tutor-wrong-question-v8-durability.ts';
import { createPhase697V8JournalLifecycle } from './phase-6-9-7-tutor-wrong-question-v8-journal-lifecycle.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  validatePhase697TutorOrganizerV8EvidenceBundle,
  validatePhase697TutorOrganizerV8EvidenceValue,
} from './validate-phase-6-9-7-tutor-wrong-question-v8-evidence.ts';

export type Phase697TutorOrganizerV8CliParseResult =
  | Readonly<{ ok: true; mode: 'mock' | 'live'; runScope: 'branch' | 'main' }>
  | Readonly<{ ok: true; mode: 'seal' }>
  | Readonly<{ ok: false; code: 'cli_invalid' | 'live_authorization_required' }>;

export type Phase697TutorOrganizerV8CliResult =
  | Readonly<{
      ok: true;
      runId: string;
      gate: Phase697TutorOrganizerV8Report['gate'];
      evidencePath: string;
      disposition: Phase697V8EvidenceEnvelope['durability']['disposition'];
      counts: Phase697TutorOrganizerV8Report['counts'];
      scheduler: Phase697TutorOrganizerV8Report['scheduler'];
      wire: Phase697TutorOrganizerV8Report['wire'];
      usage: Phase697TutorOrganizerV8Report['usage'];
    }>
  | Readonly<{ ok: false; code: string }>;

export type Phase697V8HarnessFactory = (
  input: Readonly<{
    mode: 'mock' | 'live';
    runScope: 'branch' | 'main';
    runId: string;
  }>,
) => Promise<Readonly<Phase697V8Harness>> | Readonly<Phase697V8Harness>;

export type Phase697TutorOrganizerV8CliInput = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
  harnessFactory?: Phase697V8HarnessFactory;
  durabilityOverrides?: Phase697V8DurabilityFsOverrides;
  processAlive?: (processId: number) => boolean;
  afterRecoveryClaimAcquiredForTest?: () => Promise<void> | void;
}>;

export function parsePhase697TutorOrganizerV8Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerV8CliParseResult {
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
      input.argv[1] !== PHASE_6_9_7_V8_CONFIRMATION ||
      !approvalEnabled(input.env)
    ) {
      return { ok: false, code: 'live_authorization_required' };
    }
    const runScope = parseRunScope(input.argv[2]);
    return runScope ? { ok: true, mode: 'live', runScope } : { ok: false, code: 'cli_invalid' };
  }
  if (mode === 'seal' && input.argv.length === 1) return { ok: true, mode: 'seal' };
  return { ok: false, code: 'cli_invalid' };
}

export async function executePhase697TutorOrganizerV8Cli(
  input: Phase697TutorOrganizerV8CliInput,
): Promise<Phase697TutorOrganizerV8CliResult> {
  const parsed = parsePhase697TutorOrganizerV8Cli(input);
  if (!parsed.ok) return parsed;
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  if (parsed.mode === 'seal') {
    return sealPhase697TutorOrganizerV8Orphan({
      root,
      processAlive: input.processAlive,
      durabilityOverrides: input.durabilityOverrides,
      afterRecoveryClaimAcquiredForTest: input.afterRecoveryClaimAcquiredForTest,
    });
  }

  const runId = input.runId ?? randomUUID();
  const injectedHarnessFactory = input.harnessFactory !== undefined;
  let liveConfiguration: Phase697V8LiveConfiguration | null = null;
  if (parsed.mode === 'live') {
    const resolved = resolvePhase697V8LiveConfiguration(input.env);
    if (!resolved.ok) return resolved;
    liveConfiguration = resolved.value;
  }

  let harnessFactory = input.harnessFactory;
  if (!harnessFactory && parsed.mode === 'mock') {
    harnessFactory = ({ runId: factoryRunId, runScope }) =>
      createPhase697TutorOrganizerV8MockHarness({
        runId: factoryRunId,
        runScope,
      });
  }
  if (!harnessFactory && parsed.mode === 'live') {
    const configuration = liveConfiguration;
    if (configuration === null) return { ok: false, code: 'live_configuration_invalid' };
    harnessFactory = ({ runId: factoryRunId, runScope }) =>
      createPhase697TutorOrganizerV8LiveHarness({
        configuration,
        runId: factoryRunId,
        runScope,
      });
  }
  if (!harnessFactory) return { ok: false, code: 'runtime_factory_unavailable' };

  if (parsed.mode === 'mock') {
    let report: Readonly<Phase697TutorOrganizerV8Report>;
    try {
      const harness = await harnessFactory({
        mode: 'mock',
        runScope: parsed.runScope,
        runId,
      });
      report = await runPhase697TutorOrganizerPairedEvalV8(harness);
    } catch {
      return { ok: false, code: 'execution_failed' };
    }
    const envelope = buildPhase697V8EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope || !validatePhase697TutorOrganizerV8EvidenceValue(envelope).ok) {
      return { ok: false, code: 'evidence_contract_invalid' };
    }
    const evidencePath = phase697V8DurableEvidencePath({
      runId,
      runScope: parsed.runScope,
      mode: 'mock',
    });
    const published = await publishPhase697V8Evidence({
      root,
      evidencePath,
      envelope,
      overrides: input.durabilityOverrides,
    });
    return published.ok ? summarizeEnvelope(envelope, evidencePath) : published;
  }

  const marker = buildPhase697V8Marker({
    runId,
    runScope: parsed.runScope,
    executorProvenance: injectedHarnessFactory
      ? 'synthetic_test'
      : 'first_party_deepseek_v4_pro_direct',
  });
  const reserved = await reservePhase697V8Marker({
    root,
    marker,
    overrides: input.durabilityOverrides,
  });
  if (!reserved.ok) return reserved;
  const journal = await createPhase697V8Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
    overrides: input.durabilityOverrides,
  });
  if (!journal.ok) return journal;

  let report: Readonly<Phase697TutorOrganizerV8Report>;
  try {
    // Marker and initial journal bytes are fsynced before a harness can create
    // the direct adapter or enter either runtime lane.
    const harness = await harnessFactory({
      mode: 'live',
      runScope: parsed.runScope,
      runId,
    });
    if (
      harness.mode !== 'live' ||
      harness.provider !== 'deepseek' ||
      harness.model !== 'deepseek-v4-pro' ||
      harness.structuredOutputMode !== 'deepseek_v4_pro_direct_json' ||
      harness.executorProvenance !== marker.executorProvenance
    ) {
      await journal.writer.close().catch(() => undefined);
      return { ok: false, code: 'runtime_factory_identity_invalid' };
    }
    report = await runPhase697TutorOrganizerPairedEvalV8(harness, {
      lifecycle: createPhase697V8JournalLifecycle(journal.writer),
    });
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'execution_failed' };
  }
  if (
    hasSensitivePhase697Evidence(report) ||
    !PHASE_6_9_7_TUTOR_ORGANIZER_V8_REPORT_SCHEMA.safeParse(report).success
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
  const envelope = buildPhase697V8EvidenceEnvelope({
    report,
    disposition: 'completed_run',
    markerSha256: reserved.markerSha256,
    journalTailSha256: snapshot.tailSha256,
    journalSequence: snapshot.lastSequence,
  });
  if (!envelope || !validatePhase697TutorOrganizerV8EvidenceValue(envelope).ok) {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const evidencePath = phase697V8DurableEvidencePath({
    runId,
    runScope: parsed.runScope,
    mode: 'live',
  });
  const published = await publishPhase697V8Evidence({
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
  const bundle = await validatePhase697TutorOrganizerV8EvidenceBundle({
    root,
    evidencePath: resolve(root, evidencePath),
  });
  return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
}

export async function sealPhase697TutorOrganizerV8Orphan(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
  durabilityOverrides?: Phase697V8DurabilityFsOverrides;
  afterRecoveryClaimAcquiredForTest?: () => Promise<void> | void;
}): Promise<Phase697TutorOrganizerV8CliResult> {
  let marker = await readPhase697V8Marker({
    root: input.root,
    overrides: input.durabilityOverrides,
  });
  if (!marker.ok) return marker;
  let journalRead = await readPhase697V8Journal({
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
  let claim: Phase697V8RecoveryClaim | null = null;
  if (!journal?.sealed) {
    const claimedJournalTailSha256 = journal?.tailSha256 ?? null;
    const claimed = await acquirePhase697V8RecoveryClaim({
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
    const currentMarker = await readPhase697V8Marker({
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
    journalRead = await readPhase697V8Journal({
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
    const report = buildPhase697V8SealedReport({
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journal,
    });
    if (!report) return { ok: false, code: 'journal_contract_invalid' };
    const alreadySealed = journal?.sealed ?? null;
    const disposition: Phase697V8EvidenceEnvelope['durability']['disposition'] =
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
    const envelope = buildPhase697V8EvidenceEnvelope({
      report,
      disposition,
      markerSha256: marker.markerSha256,
      journalTailSha256: tail,
      journalSequence: sequence,
    });
    if (!envelope || !validatePhase697TutorOrganizerV8EvidenceValue(envelope).ok) {
      return { ok: false, code: 'evidence_contract_invalid' };
    }
    const evidencePath = phase697V8DurableEvidencePath({
      runId: marker.marker.runId,
      runScope: marker.marker.runScope,
      mode: 'live',
    });
    if (claim && !(await claim.assertOwned())) return { ok: false, code: 'recovery_claim_lost' };
    const published = await publishPhase697V8Evidence({
      root: input.root,
      evidencePath,
      envelope,
      overrides: input.durabilityOverrides,
    });
    if (!published.ok) return published;
    if (journal && !alreadySealed) {
      if (!claim) return { ok: false, code: 'recovery_claim_lost' };
      if (disposition === 'journal_missing_sealed') {
        return { ok: false, code: 'durability_identity_invalid' };
      }
      const appender = await openPhase697V8JournalAppender({
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
    const bundle = await validatePhase697TutorOrganizerV8EvidenceBundle({
      root: input.root,
      evidencePath: resolve(input.root, evidencePath),
    });
    return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
  } finally {
    await claim?.release().catch(() => undefined);
  }
}

function summarizeEnvelope(
  envelope: Readonly<Phase697V8EvidenceEnvelope>,
  evidencePath: string,
): Extract<Phase697TutorOrganizerV8CliResult, { ok: true }> {
  return {
    ok: true,
    runId: envelope.runId,
    gate: envelope.report.gate,
    evidencePath,
    disposition: envelope.durability.disposition,
    counts: envelope.report.counts,
    scheduler: envelope.report.scheduler,
    wire: envelope.report.wire,
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
    throw new Error('PHASE_6_9_7_V8_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

function approvalEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    return safeReadEnv(env, PHASE_6_9_7_V8_APPROVAL_ENV) === 'true';
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const result = await executePhase697TutorOrganizerV8Cli({
    argv: process.argv.slice(2),
    env: process.env,
  }).catch(() => ({ ok: false as const, code: 'execution_failed' }));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
