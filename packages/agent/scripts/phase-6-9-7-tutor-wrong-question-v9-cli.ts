import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA,
  PHASE_6_9_7_V9_APPROVAL_ENV,
  PHASE_6_9_7_V9_CONFIRMATION,
  buildPhase697V9EvidenceEnvelope,
  buildPhase697V9Marker,
  type Phase697TutorOrganizerV9Report,
  type Phase697V9EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  buildPhase697V9SealedReport,
  phase697V9EvidencePath as phase697V9DurableEvidencePath,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-durability-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV9,
  type Phase697V9Harness,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import {
  acquirePhase697V9RecoveryClaim,
  createPhase697V9Journal,
  openPhase697V9JournalAppender,
  publishPhase697V9Evidence,
  readPhase697V9Journal,
  readPhase697V9Marker,
  reservePhase697V9Marker,
  type Phase697V9DurabilityFsOverrides,
  type Phase697V9RecoveryClaim,
} from './phase-6-9-7-tutor-wrong-question-v9-durability.ts';
import { createPhase697V9JournalLifecycle } from './phase-6-9-7-tutor-wrong-question-v9-journal-lifecycle.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';
import {
  validatePhase697TutorOrganizerV9EvidenceBundle,
  validatePhase697TutorOrganizerV9EvidenceValue,
} from './validate-phase-6-9-7-tutor-wrong-question-v9-evidence.ts';

export type Phase697TutorOrganizerV9CliParseResult =
  | Readonly<{ ok: true; mode: 'mock' | 'live'; runScope: 'branch' | 'main' }>
  | Readonly<{ ok: true; mode: 'seal' }>
  | Readonly<{ ok: false; code: 'cli_invalid' | 'live_authorization_required' }>;

export type Phase697TutorOrganizerV9CliResult =
  | Readonly<{
      ok: true;
      runId: string;
      gate: Phase697TutorOrganizerV9Report['gate'];
      evidencePath: string;
      disposition: Phase697V9EvidenceEnvelope['durability']['disposition'];
      counts: Phase697TutorOrganizerV9Report['counts'];
      scheduler: Phase697TutorOrganizerV9Report['scheduler'];
      wire: Phase697TutorOrganizerV9Report['wire'];
      usage: Phase697TutorOrganizerV9Report['usage'];
    }>
  | Readonly<{ ok: false; code: string }>;

export type Phase697V9HarnessFactory = (
  input: Readonly<{
    mode: 'mock' | 'live';
    runScope: 'branch' | 'main';
    runId: string;
  }>,
) => Promise<Readonly<Phase697V9Harness>> | Readonly<Phase697V9Harness>;

export type Phase697TutorOrganizerV9CliInput = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
  harnessFactory?: Phase697V9HarnessFactory;
  durabilityOverrides?: Phase697V9DurabilityFsOverrides;
  processAlive?: (processId: number) => boolean;
  afterRecoveryClaimAcquiredForTest?: () => Promise<void> | void;
}>;

export function parsePhase697TutorOrganizerV9Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerV9CliParseResult {
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
      input.argv[1] !== PHASE_6_9_7_V9_CONFIRMATION ||
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

export async function executePhase697TutorOrganizerV9Cli(
  input: Phase697TutorOrganizerV9CliInput,
): Promise<Phase697TutorOrganizerV9CliResult> {
  const parsed = parsePhase697TutorOrganizerV9Cli(input);
  if (!parsed.ok) return parsed;
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  if (parsed.mode === 'seal') {
    return sealPhase697TutorOrganizerV9Orphan({
      root,
      processAlive: input.processAlive,
      durabilityOverrides: input.durabilityOverrides,
      afterRecoveryClaimAcquiredForTest: input.afterRecoveryClaimAcquiredForTest,
    });
  }

  const runId = input.runId ?? randomUUID();
  const injectedHarnessFactory = input.harnessFactory !== undefined;
  if (parsed.mode === 'live' && !syntheticLiveConfigurationValid(input.env)) {
    return { ok: false, code: 'live_configuration_invalid' };
  }
  const harnessFactory = input.harnessFactory;
  if (!harnessFactory) {
    return {
      ok: false,
      code:
        parsed.mode === 'mock'
          ? 'mock_runtime_unavailable_until_r4'
          : 'live_runtime_unavailable_until_r5',
    };
  }

  if (parsed.mode === 'mock') {
    let report: Readonly<Phase697TutorOrganizerV9Report>;
    try {
      const harness = await harnessFactory({
        mode: 'mock',
        runScope: parsed.runScope,
        runId,
      });
      report = await runPhase697TutorOrganizerPairedEvalV9(harness);
    } catch {
      return { ok: false, code: 'execution_failed' };
    }
    const envelope = buildPhase697V9EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope || !validatePhase697TutorOrganizerV9EvidenceValue(envelope).ok) {
      return { ok: false, code: 'evidence_contract_invalid' };
    }
    const evidencePath = phase697V9DurableEvidencePath({
      runId,
      runScope: parsed.runScope,
      mode: 'mock',
    });
    const published = await publishPhase697V9Evidence({
      root,
      evidencePath,
      envelope,
      overrides: input.durabilityOverrides,
    });
    return published.ok ? summarizeEnvelope(envelope, evidencePath) : published;
  }

  const marker = buildPhase697V9Marker({
    runId,
    runScope: parsed.runScope,
    executorProvenance: injectedHarnessFactory
      ? 'synthetic_test'
      : 'first_party_deepseek_v4_pro_direct',
  });
  const reserved = await reservePhase697V9Marker({
    root,
    marker,
    overrides: input.durabilityOverrides,
  });
  if (!reserved.ok) return reserved;
  const journal = await createPhase697V9Journal({
    root,
    marker,
    markerSha256: reserved.markerSha256,
    overrides: input.durabilityOverrides,
  });
  if (!journal.ok) return journal;

  let report: Readonly<Phase697TutorOrganizerV9Report>;
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
    report = await runPhase697TutorOrganizerPairedEvalV9(harness, {
      lifecycle: createPhase697V9JournalLifecycle(journal.writer),
    });
  } catch {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'execution_failed' };
  }
  if (
    hasSensitivePhase697Evidence(report) ||
    !PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(report).success
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
  const envelope = buildPhase697V9EvidenceEnvelope({
    report,
    disposition: 'completed_run',
    markerSha256: reserved.markerSha256,
    journalTailSha256: snapshot.tailSha256,
    journalSequence: snapshot.lastSequence,
  });
  if (!envelope || !validatePhase697TutorOrganizerV9EvidenceValue(envelope).ok) {
    await journal.writer.close().catch(() => undefined);
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const evidencePath = phase697V9DurableEvidencePath({
    runId,
    runScope: parsed.runScope,
    mode: 'live',
  });
  const published = await publishPhase697V9Evidence({
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
  const bundle = await validatePhase697TutorOrganizerV9EvidenceBundle({
    root,
    evidencePath: resolve(root, evidencePath),
  });
  return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
}

export async function sealPhase697TutorOrganizerV9Orphan(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
  durabilityOverrides?: Phase697V9DurabilityFsOverrides;
  afterRecoveryClaimAcquiredForTest?: () => Promise<void> | void;
}): Promise<Phase697TutorOrganizerV9CliResult> {
  let marker = await readPhase697V9Marker({
    root: input.root,
    overrides: input.durabilityOverrides,
  });
  if (!marker.ok) return marker;
  let journalRead = await readPhase697V9Journal({
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
  let claim: Phase697V9RecoveryClaim | null = null;
  if (!journal?.sealed) {
    const claimedJournalTailSha256 = journal?.tailSha256 ?? null;
    const claimed = await acquirePhase697V9RecoveryClaim({
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
    const currentMarker = await readPhase697V9Marker({
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
    journalRead = await readPhase697V9Journal({
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
    const report = buildPhase697V9SealedReport({
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journal,
    });
    if (!report) return { ok: false, code: 'journal_contract_invalid' };
    const alreadySealed = journal?.sealed ?? null;
    const disposition: Phase697V9EvidenceEnvelope['durability']['disposition'] =
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
    const envelope = buildPhase697V9EvidenceEnvelope({
      report,
      disposition,
      markerSha256: marker.markerSha256,
      journalTailSha256: tail,
      journalSequence: sequence,
    });
    if (!envelope || !validatePhase697TutorOrganizerV9EvidenceValue(envelope).ok) {
      return { ok: false, code: 'evidence_contract_invalid' };
    }
    const evidencePath = phase697V9DurableEvidencePath({
      runId: marker.marker.runId,
      runScope: marker.marker.runScope,
      mode: 'live',
    });
    if (claim && !(await claim.assertOwned())) return { ok: false, code: 'recovery_claim_lost' };
    const published = await publishPhase697V9Evidence({
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
      const appender = await openPhase697V9JournalAppender({
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
    const bundle = await validatePhase697TutorOrganizerV9EvidenceBundle({
      root: input.root,
      evidencePath: resolve(input.root, evidencePath),
    });
    return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
  } finally {
    await claim?.release().catch(() => undefined);
  }
}

function summarizeEnvelope(
  envelope: Readonly<Phase697V9EvidenceEnvelope>,
  evidencePath: string,
): Extract<Phase697TutorOrganizerV9CliResult, { ok: true }> {
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
    throw new Error('PHASE_6_9_7_V9_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

function approvalEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    return safeReadEnv(env, PHASE_6_9_7_V9_APPROVAL_ENV) === 'true';
  } catch {
    return false;
  }
}

function syntheticLiveConfigurationValid(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  try {
    const required = {
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: 'true',
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      TUTOR_AGENT_MODEL_ENABLED: 'true',
      TUTOR_AGENT_MODEL_TIMEOUT_MS: '3500',
      WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
      WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
    } as const;
    for (const [key, expected] of Object.entries(required)) {
      if (safeReadEnv(env, key) !== expected) return false;
    }
    const tutorKey = safeReadEnv(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY');
    const organizerKey = safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY');
    return (
      typeof tutorKey === 'string' &&
      tutorKey.trim().length > 0 &&
      typeof organizerKey === 'string' &&
      organizerKey.trim().length > 0
    );
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const result = await executePhase697TutorOrganizerV9Cli({
    argv: process.argv.slice(2),
    env: process.env,
  }).catch(() => ({ ok: false as const, code: 'execution_failed' }));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
