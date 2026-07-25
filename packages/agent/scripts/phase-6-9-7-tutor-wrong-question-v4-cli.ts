import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_V4_APPROVAL_ENV,
  PHASE_6_9_7_V4_CONFIRMATION,
  buildPhase697V4EvidenceEnvelope,
  phase697V4EvidencePath,
  type Phase697TutorOrganizerV4Report,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import {
  buildPhase697V4SealedReport,
  phase697V4EvidencePath as phase697V4DurableEvidencePath,
  type Phase697V4EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts';
import { runPhase697TutorOrganizerPairedEvalV4 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v4-paired.ts';
import { createPhase697TutorOrganizerV4MockHarness } from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  acquirePhase697V4RecoveryClaim,
  openPhase697V4JournalAppender,
  publishPhase697V4Evidence,
  readPhase697V4Journal,
  readPhase697V4Marker,
  type Phase697V4RecoveryClaim,
} from './phase-6-9-7-tutor-wrong-question-v4-durability.ts';
import {
  validatePhase697TutorOrganizerV4EvidenceBundle,
  validatePhase697TutorOrganizerV4EvidenceValue,
} from './validate-phase-6-9-7-tutor-wrong-question-v4-evidence.ts';

export type Phase697TutorOrganizerV4CliParseResult =
  | Readonly<{ ok: true; mode: 'mock' | 'live'; runScope: 'branch' | 'main' }>
  | Readonly<{ ok: false; code: 'cli_invalid' | 'live_authorization_required' }>;

export type Phase697TutorOrganizerV4CliResult =
  | Readonly<{
      ok: true;
      runId: string;
      gate: Phase697TutorOrganizerV4Report['gate'];
      evidencePath: string;
      disposition: 'mock_direct' | 'completed_run' | 'orphan_sealed' | 'journal_missing_sealed';
      counts: Phase697TutorOrganizerV4Report['counts'];
      execution: Phase697TutorOrganizerV4Report['execution'];
      usage: Phase697TutorOrganizerV4Report['usage'];
    }>
  | Readonly<{ ok: false; code: string }>;

export function parsePhase697TutorOrganizerV4Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerV4CliParseResult {
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
      input.argv[1] !== PHASE_6_9_7_V4_CONFIRMATION ||
      safeReadEnv(input.env, PHASE_6_9_7_V4_APPROVAL_ENV) !== 'true'
    ) {
      return { ok: false, code: 'live_authorization_required' };
    }
    const runScope = parseRunScope(input.argv[2]);
    return runScope ? { ok: true, mode: 'live', runScope } : { ok: false, code: 'cli_invalid' };
  }
  return { ok: false, code: 'cli_invalid' };
}

export async function sealPhase697TutorOrganizerV4Orphan(input: {
  root: string;
  processAlive?: (processId: number) => boolean;
}): Promise<Phase697TutorOrganizerV4CliResult> {
  let marker = await readPhase697V4Marker({ root: input.root });
  if (!marker.ok) return marker;
  let journalRead = await readPhase697V4Journal({
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
  let recoveryClaim: Phase697V4RecoveryClaim | null = null;
  if (!validatedJournal?.sealed) {
    const claimed = await acquirePhase697V4RecoveryClaim({
      root: input.root,
      marker: marker.marker,
      ...(input.processAlive ? { overrides: { processAlive: input.processAlive } } : {}),
    });
    if (!claimed.ok) return claimed;
    recoveryClaim = claimed.claim;
    const currentMarker = await readPhase697V4Marker({ root: input.root });
    if (
      !currentMarker.ok ||
      currentMarker.markerSha256 !== marker.markerSha256 ||
      currentMarker.marker.runId !== marker.marker.runId
    ) {
      await recoveryClaim.release().catch(() => undefined);
      return { ok: false, code: 'durability_identity_invalid' };
    }
    marker = currentMarker;
    journalRead = await readPhase697V4Journal({
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
    const report = buildPhase697V4SealedReport({
      marker: marker.marker,
      markerSha256: marker.markerSha256,
      journal: validatedJournal,
    });
    if (!report) return { ok: false, code: 'journal_contract_invalid' };
    const sealed = validatedJournal?.sealed ?? null;
    const disposition: Phase697V4EvidenceEnvelope['durability']['disposition'] =
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
    const envelope = buildPhase697V4EvidenceEnvelope({
      report,
      disposition,
      markerSha256: marker.markerSha256,
      journalTailSha256,
      journalSequence,
    });
    if (envelope === null) return { ok: false, code: 'evidence_contract_invalid' };
    const evidencePath = phase697V4DurableEvidencePath({
      runScope: marker.marker.runScope,
      mode: 'live',
      runId: marker.marker.runId,
    });
    if (recoveryClaim && !(await recoveryClaim.assertOwned())) {
      return { ok: false, code: 'recovery_claim_lost' };
    }
    const published = await publishPhase697V4Evidence({
      root: input.root,
      evidencePath,
      envelope,
    });
    if (!published.ok) return published;
    if (validatedJournal && !sealed) {
      if (!recoveryClaim) return { ok: false, code: 'recovery_claim_lost' };
      const appender = await openPhase697V4JournalAppender({
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
    const bundle = await validatePhase697TutorOrganizerV4EvidenceBundle({
      root: input.root,
      evidencePath: resolve(input.root, evidencePath),
    });
    return bundle.ok ? summarizeEnvelope(envelope, evidencePath) : bundle;
  } finally {
    await recoveryClaim?.release().catch(() => undefined);
  }
}

export async function executePhase697TutorOrganizerV4Cli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
}): Promise<Phase697TutorOrganizerV4CliResult> {
  const parsed = parsePhase697TutorOrganizerV4Cli(input);
  if (!parsed.ok) return parsed;
  if (parsed.mode === 'live') return { ok: false, code: 'live_not_available_before_r6' };

  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  let report: Phase697TutorOrganizerV4Report;
  try {
    report = await runPhase697TutorOrganizerPairedEvalV4(
      createPhase697TutorOrganizerV4MockHarness({
        runScope: parsed.runScope,
        ...(input.runId === undefined ? {} : { runId: input.runId }),
      }),
    );
  } catch {
    return { ok: false, code: 'execution_failed' };
  }
  const envelope = buildPhase697V4EvidenceEnvelope({
    report,
    disposition: 'mock_direct',
    markerSha256: null,
    journalTailSha256: null,
    journalSequence: null,
  });
  if (envelope === null || !validatePhase697TutorOrganizerV4EvidenceValue(envelope).ok) {
    return { ok: false, code: 'evidence_contract_invalid' };
  }
  const relativePath = phase697V4EvidencePath({
    runId: report.runId,
    runScope: report.runScope,
    mode: report.mode,
  });
  if (relativePath === null) return { ok: false, code: 'evidence_contract_invalid' };
  const evidencePath = resolve(root, relativePath);
  const published = await publishExclusive(evidencePath, `${JSON.stringify(envelope, null, 2)}\n`);
  if (!published.ok) return published;
  return {
    ok: true,
    runId: report.runId,
    gate: report.gate,
    evidencePath,
    disposition: 'mock_direct',
    counts: report.counts,
    execution: report.execution,
    usage: report.usage,
  };
}

function parseRunScope(value: string | undefined): 'branch' | 'main' | null {
  if (value === undefined || value === 'branch') return 'branch';
  return value === 'main' ? 'main' : null;
}

function summarizeEnvelope(
  envelope: Readonly<Phase697V4EvidenceEnvelope>,
  evidencePath: string,
): Extract<Phase697TutorOrganizerV4CliResult, { ok: true }> {
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

function safeReadEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
    ? descriptor.value
    : undefined;
}

async function publishExclusive(
  path: string,
  contents: string,
): Promise<
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; code: 'evidence_already_exists' | 'evidence_io_failed' }>
> {
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    await mkdir(dirname(path), { recursive: true });
    handle = await open(path, 'wx', 0o600);
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    return { ok: true };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    return isErrorCode(error, 'EEXIST')
      ? { ok: false, code: 'evidence_already_exists' }
      : { ok: false, code: 'evidence_io_failed' };
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

if (import.meta.main) {
  try {
    const result = await executePhase697TutorOrganizerV4Cli({
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
