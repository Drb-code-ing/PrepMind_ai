import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA,
  phase697V5EvidencePath,
  type Phase697V5EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import { PHASE_6_9_7_V5_MARKER_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts';
import {
  readPhase697V5EvidenceBytes,
  readPhase697V5Journal,
  readPhase697V5Marker,
} from './phase-6-9-7-tutor-wrong-question-v5-durability.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

const LEGACY_LINEAGE_TOKENS = Object.freeze([
  'phase-6.9.7-tutor-organizer-runner-v1',
  'phase-6.9.7-tutor-organizer-runner-v2',
  'phase-6.9.7-tutor-organizer-runner-v3',
  'phase-6.9.7-tutor-organizer-runner-v4',
  'phase-6.9.7-v1-runtime-evidence',
  'phase-6.9.7-v2-runtime-evidence',
  'phase-6.9.7-v3-runtime-evidence',
  'phase-6.9.7-v4-runtime-evidence',
  'phase-6.9-tutor-wrong-question-v1',
  '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
  '39a62241',
  '67ce18dd',
  'ff2e1a54-0cbd-494c-96b7-a0f366c6c3dc',
  '0fb47591-5ff4-4e46-bcf3-2cd267d1fb2f',
]);

const LEGACY_KEY_PATTERN =
  /^(?:sourceV[1-4]CaseId|sourceV[1-4].*|partialMetrics|partialUsage|partialCost|legacy.*)$/u;
const LEGACY_PATH_PATTERN = /(?:^|[\\/.-])phase-6-9-7-tutor-organizer-v[1-4](?:[\\/.-]|$)/u;

export type Phase697V5EvidenceValidationResult =
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
        | 'durability_identity_invalid'
        | 'legacy_lineage_detected';
    }>;

export function validatePhase697TutorOrganizerV5EvidenceValue(
  value: unknown,
): Phase697V5EvidenceValidationResult {
  if (hasLegacyPhase697V5Lineage(value)) {
    return { ok: false, code: 'legacy_lineage_detected' };
  }
  if (hasSensitivePhase697Evidence(value)) return { ok: false, code: 'sensitive_evidence' };
  return PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value).success
    ? { ok: true }
    : { ok: false, code: 'report_contract_invalid' };
}

export function hasLegacyPhase697V5Lineage(value: unknown): boolean {
  const seen = new Set<object>();
  const visit = (current: unknown): boolean => {
    if (typeof current === 'string') {
      return (
        LEGACY_LINEAGE_TOKENS.some((token) => current.includes(token)) ||
        LEGACY_PATH_PATTERN.test(current)
      );
    }
    if (current === null || typeof current !== 'object') return false;
    if (seen.has(current)) return true;
    seen.add(current);
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(current);
    } catch {
      return true;
    }
    for (const key of keys) {
      if (typeof key !== 'string' || LEGACY_KEY_PATTERN.test(key)) return true;
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(current, key);
      } catch {
        return true;
      }
      if (!descriptor || !('value' in descriptor) || visit(descriptor.value)) return true;
    }
    return false;
  };
  return visit(value);
}

export async function validatePhase697TutorOrganizerV5EvidenceFile(input: {
  path: string;
}): Promise<Phase697V5EvidenceValidationResult> {
  const read = await readPhase697V5Evidence(input.path);
  if (!read.ok) return read;
  const expectedPath = phase697V5EvidencePath({
    runId: read.envelope.runId,
    runScope: read.envelope.runScope,
    mode: read.envelope.mode,
  });
  if (expectedPath === null || basename(input.path) !== basename(expectedPath)) {
    return { ok: false, code: 'evidence_filename_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerV5EvidenceBundle(input: {
  root: string;
  evidencePath: string;
}): Promise<Phase697V5EvidenceValidationResult> {
  const filename = await validatePhase697TutorOrganizerV5EvidenceFile({ path: input.evidencePath });
  if (!filename.ok) return filename;
  const evidenceFile = await readPhase697V5EvidenceBytes({ path: input.evidencePath });
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

  const marker = await readPhase697V5Marker({ root: input.root });
  if (!marker.ok) return { ok: false, code: 'marker_contract_invalid' };
  if (
    marker.markerSha256 !== envelope.durability.markerSha256 ||
    marker.marker.runId !== envelope.runId ||
    marker.marker.runScope !== envelope.runScope ||
    marker.marker.executorProvenance !== envelope.report.executorProvenance ||
    !PHASE_6_9_7_V5_MARKER_SCHEMA.safeParse(marker.marker).success
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }

  const journal = await readPhase697V5Journal({ root: input.root, runId: envelope.runId });
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

export async function validatePhase697TutorOrganizerV5EvidenceFiles(
  paths: readonly string[],
): Promise<Phase697V5EvidenceValidationResult> {
  if (paths.length === 0) return { ok: false, code: 'evidence_read_failed' };
  const runIds: string[] = [];
  for (const path of paths) {
    const valid = await validatePhase697TutorOrganizerV5EvidenceFile({ path });
    if (!valid.ok) return valid;
    const read = await readPhase697V5Evidence(path);
    if (!read.ok) return read;
    runIds.push(read.envelope.runId);
  }
  return new Set(runIds).size === runIds.length
    ? { ok: true }
    : { ok: false, code: 'run_identity_invalid' };
}

async function readPhase697V5Evidence(
  path: string,
): Promise<
  | Readonly<{ ok: true; envelope: Phase697V5EvidenceEnvelope }>
  | Exclude<Phase697V5EvidenceValidationResult, Readonly<{ ok: true }>>
> {
  try {
    const bytes = await readFile(path);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EVIDENCE_BYTES) {
      return { ok: false, code: 'evidence_read_failed' };
    }
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    const valid = validatePhase697TutorOrganizerV5EvidenceValue(value);
    if (!valid.ok) return valid;
    const parsed = PHASE_6_9_7_V5_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value);
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
      : await validatePhase697TutorOrganizerV5EvidenceFiles(paths);
  process.stdout.write(
    `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}
