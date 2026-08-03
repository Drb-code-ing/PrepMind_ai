import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA,
  phase697V4EvidencePath,
  type Phase697V4EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import { PHASE_6_9_7_V4_MARKER_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts';
import {
  readPhase697V4EvidenceBytes,
  readPhase697V4Journal,
  readPhase697V4Marker,
} from './phase-6-9-7-tutor-wrong-question-v4-durability.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

export type Phase697V4EvidenceValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code:
        | 'sensitive_evidence'
        | 'report_contract_invalid'
        | 'evidence_read_failed'
        | 'evidence_filename_invalid'
        | 'run_identity_invalid'
        | 'marker_contract_invalid'
        | 'journal_contract_invalid'
        | 'durability_identity_invalid';
    }>;

export function validatePhase697TutorOrganizerV4EvidenceValue(
  value: unknown,
): Phase697V4EvidenceValidationResult {
  if (hasSensitivePhase697Evidence(value)) return { ok: false, code: 'sensitive_evidence' };
  return PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value).success
    ? { ok: true }
    : { ok: false, code: 'report_contract_invalid' };
}

export async function validatePhase697TutorOrganizerV4EvidenceFile(input: {
  path: string;
}): Promise<Phase697V4EvidenceValidationResult> {
  const read = await readPhase697V4Evidence(input.path);
  if (!read.ok) return read;
  const expectedPath = phase697V4EvidencePath({
    runId: read.envelope.runId,
    runScope: read.envelope.runScope,
    mode: read.envelope.mode,
  });
  if (expectedPath === null || basename(input.path) !== basename(expectedPath)) {
    return { ok: false, code: 'evidence_filename_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerV4EvidenceBundle(input: {
  root: string;
  evidencePath: string;
}): Promise<Phase697V4EvidenceValidationResult> {
  const filename = await validatePhase697TutorOrganizerV4EvidenceFile({ path: input.evidencePath });
  if (!filename.ok) return filename;
  const evidenceFile = await readPhase697V4EvidenceBytes({ path: input.evidencePath });
  if (!evidenceFile.ok) {
    return {
      ok: false,
      code:
        evidenceFile.code === 'evidence_contract_invalid'
          ? 'report_contract_invalid'
          : 'evidence_read_failed',
    };
  }
  const envelope = evidenceFile.envelope;
  if (envelope.durability.disposition === 'mock_direct') return { ok: true };

  const marker = await readPhase697V4Marker({ root: input.root });
  if (!marker.ok) return { ok: false, code: 'marker_contract_invalid' };
  if (
    marker.markerSha256 !== envelope.durability.markerSha256 ||
    marker.marker.runId !== envelope.runId ||
    marker.marker.runScope !== envelope.runScope ||
    !PHASE_6_9_7_V4_MARKER_SCHEMA.safeParse(marker.marker).success
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }

  const journal = await readPhase697V4Journal({ root: input.root, runId: envelope.runId });
  if (envelope.durability.disposition === 'journal_missing_sealed') {
    return !journal.ok && journal.code === 'journal_missing'
      ? { ok: true }
      : { ok: false, code: 'journal_contract_invalid' };
  }
  if (!journal.ok) return { ok: false, code: 'journal_contract_invalid' };
  if (
    journal.journal.runId !== envelope.runId ||
    journal.journal.runScope !== envelope.runScope ||
    journal.journal.markerSha256 !== marker.markerSha256
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  const sealed = journal.journal.sealed;
  const expectedTail = sealed?.sealedFromJournalSha256 ?? journal.journal.tailSha256;
  const expectedSequence = sealed ? journal.journal.lastSequence - 1 : journal.journal.lastSequence;
  if (
    envelope.durability.journalTailSha256 !== expectedTail ||
    envelope.durability.journalSequence !== expectedSequence ||
    (sealed !== null &&
      (sealed.evidenceSha256 !== evidenceFile.evidenceSha256 ||
        sealed.disposition !== envelope.durability.disposition))
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerV4EvidenceFiles(
  paths: readonly string[],
): Promise<Phase697V4EvidenceValidationResult> {
  if (paths.length === 0) return { ok: false, code: 'evidence_read_failed' };
  const runIds: string[] = [];
  for (const path of paths) {
    const valid = await validatePhase697TutorOrganizerV4EvidenceFile({ path });
    if (!valid.ok) return valid;
    const read = await readPhase697V4Evidence(path);
    if (!read.ok) return read;
    runIds.push(read.envelope.runId);
  }
  return new Set(runIds).size === runIds.length
    ? { ok: true }
    : { ok: false, code: 'run_identity_invalid' };
}

async function readPhase697V4Evidence(
  path: string,
): Promise<
  | Readonly<{ ok: true; envelope: Phase697V4EvidenceEnvelope }>
  | Exclude<Phase697V4EvidenceValidationResult, Readonly<{ ok: true }>>
> {
  try {
    const bytes = await readFile(path);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EVIDENCE_BYTES) {
      return { ok: false, code: 'evidence_read_failed' };
    }
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    const valid = validatePhase697TutorOrganizerV4EvidenceValue(value);
    if (!valid.ok) return valid;
    const parsed = PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value);
    return parsed.success
      ? { ok: true, envelope: parsed.data }
      : { ok: false, code: 'report_contract_invalid' };
  } catch {
    return { ok: false, code: 'evidence_read_failed' };
  }
}

if (import.meta.main) {
  const paths = process.argv.slice(2).map((path) => resolve(path));
  const result =
    paths.length === 0
      ? ({ ok: false, code: 'evidence_read_failed' } as const)
      : await validatePhase697TutorOrganizerV4EvidenceFiles(paths);
  process.stdout.write(
    `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}
