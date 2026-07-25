import { basename, resolve } from 'node:path';

import {
  PHASE_6_9_7_V3_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V3_MARKER_SCHEMA,
  phase697V3EvidencePath,
  type Phase697V3EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import {
  readPhase697V3EvidenceBytes,
  readPhase697V3Journal,
  readPhase697V3Marker,
} from './phase-6-9-7-tutor-wrong-question-v3-durability.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

export type Phase697V3EvidenceValidationResult =
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

export function validatePhase697TutorOrganizerV3EvidenceValue(
  value: unknown,
): Phase697V3EvidenceValidationResult {
  if (hasSensitivePhase697Evidence(value)) return { ok: false, code: 'sensitive_evidence' };
  return PHASE_6_9_7_V3_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value).success
    ? { ok: true }
    : { ok: false, code: 'report_contract_invalid' };
}

export async function validatePhase697TutorOrganizerV3EvidenceFile(input: {
  path: string;
}): Promise<Phase697V3EvidenceValidationResult> {
  const evidence = await readPhase697V3EvidenceBytes({ path: input.path });
  if (!evidence.ok) {
    return {
      ok: false,
      code:
        evidence.code === 'evidence_contract_invalid'
          ? 'report_contract_invalid'
          : 'evidence_read_failed',
    };
  }
  const expected = basename(
    phase697V3EvidencePath({
      runScope: evidence.envelope.runScope,
      mode: evidence.envelope.mode,
      runId: evidence.envelope.runId,
    }),
  );
  return basename(input.path) === expected
    ? { ok: true }
    : { ok: false, code: 'evidence_filename_invalid' };
}

export async function validatePhase697TutorOrganizerV3EvidenceBundle(input: {
  root: string;
  evidencePath: string;
}): Promise<Phase697V3EvidenceValidationResult> {
  const evidenceFile = await readPhase697V3EvidenceBytes({ path: input.evidencePath });
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
  const filename = await validatePhase697TutorOrganizerV3EvidenceFile({ path: input.evidencePath });
  if (!filename.ok) return filename;
  if (envelope.durability.disposition === 'mock_direct') return { ok: true };

  const marker = await readPhase697V3Marker({ root: input.root });
  if (!marker.ok) return { ok: false, code: 'marker_contract_invalid' };
  if (
    marker.markerSha256 !== envelope.durability.markerSha256 ||
    marker.marker.runId !== envelope.runId ||
    marker.marker.runScope !== envelope.runScope ||
    !PHASE_6_9_7_V3_MARKER_SCHEMA.safeParse(marker.marker).success
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }

  const journal = await readPhase697V3Journal({ root: input.root, runId: envelope.runId });
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

export async function validatePhase697TutorOrganizerV3EvidenceFiles(
  paths: readonly string[],
): Promise<Phase697V3EvidenceValidationResult> {
  const envelopes: Phase697V3EvidenceEnvelope[] = [];
  for (const path of paths) {
    const file = await validatePhase697TutorOrganizerV3EvidenceFile({ path });
    if (!file.ok) return file;
    const read = await readPhase697V3EvidenceBytes({ path });
    if (!read.ok) return { ok: false, code: 'evidence_read_failed' };
    envelopes.push(read.envelope);
  }
  const runIds = envelopes.map((entry) => entry.runId);
  return new Set(runIds).size === runIds.length
    ? { ok: true }
    : { ok: false, code: 'run_identity_invalid' };
}

if (import.meta.main) {
  const paths = process.argv.slice(2).map((path) => resolve(path));
  const result =
    paths.length === 0
      ? ({ ok: false, code: 'evidence_read_failed' } as const)
      : await validatePhase697TutorOrganizerV3EvidenceFiles(paths);
  process.stdout.write(
    `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}
