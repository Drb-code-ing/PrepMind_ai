import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import {
  PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA,
  phase697V8EvidencePath,
  sha256Phase697V8Stable,
  type Phase697V8EvidenceEnvelope,
} from '../src/evals/phase-6-9-tutor-wrong-question-v8-contract.ts';
import { PHASE_6_9_7_V8_MARKER_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v8-durability-contract.ts';
import {
  readPhase697V8EvidenceBytes,
  readPhase697V8Journal,
  readPhase697V8Marker,
} from './phase-6-9-7-tutor-wrong-question-v8-durability.ts';
import { hasSensitivePhase697Evidence } from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

const PRIOR_ARTIFACT_TOKENS = Object.freeze([
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-tutor-organizer-runner-v${index + 1}`),
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-v${index + 1}-runtime-evidence`),
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-v${index + 1}-live-marker`),
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-v${index + 1}-journal`),
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-v${index + 1}-evidence-envelope`),
  ...Array.from({ length: 7 }, (_, index) => `phase-6.9.7-v${index + 1}-recovery-claim`),
]);

const PRIOR_ARTIFACT_PATH = /(?:^|[\\/.-])phase-6-9-7-tutor-organizer-v[1-7](?:[\\/.-]|$)/u;
const PRIOR_ARTIFACT_KEY = /^(?:sourceV[1-7].*|partialMetrics|partialUsage|partialCost|legacy.*)$/u;

export type Phase697V8EvidenceValidationResult =
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
        | 'prior_lineage_detected';
    }>;

export function validatePhase697TutorOrganizerV8EvidenceValue(
  value: unknown,
): Phase697V8EvidenceValidationResult {
  if (hasPriorPhase697V8ArtifactLineage(value)) {
    return { ok: false, code: 'prior_lineage_detected' };
  }
  if (hasSensitivePhase697Evidence(value)) return { ok: false, code: 'sensitive_evidence' };
  return PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value).success
    ? { ok: true }
    : { ok: false, code: 'report_contract_invalid' };
}

export function hasPriorPhase697V8ArtifactLineage(value: unknown): boolean {
  const seen = new Set<object>();
  const visit = (current: unknown): boolean => {
    if (typeof current === 'string') {
      return (
        PRIOR_ARTIFACT_TOKENS.some((token) => current.includes(token)) ||
        PRIOR_ARTIFACT_PATH.test(current)
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
      if (typeof key !== 'string' || PRIOR_ARTIFACT_KEY.test(key)) return true;
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

export async function validatePhase697TutorOrganizerV8EvidenceFile(input: {
  path: string;
}): Promise<Phase697V8EvidenceValidationResult> {
  const read = await readPhase697V8Evidence(input.path);
  if (!read.ok) return read;
  const expectedPath = phase697V8EvidencePath({
    runId: read.envelope.runId,
    runScope: read.envelope.runScope,
    mode: read.envelope.mode,
  });
  if (expectedPath === null || basename(input.path) !== basename(expectedPath)) {
    return { ok: false, code: 'evidence_filename_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerV8EvidenceBundle(input: {
  root: string;
  evidencePath: string;
}): Promise<Phase697V8EvidenceValidationResult> {
  const filename = await validatePhase697TutorOrganizerV8EvidenceFile({ path: input.evidencePath });
  if (!filename.ok) return filename;
  const evidenceFile = await readPhase697V8EvidenceBytes({ path: input.evidencePath });
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
  const valueValidation = validatePhase697TutorOrganizerV8EvidenceValue(envelope);
  if (!valueValidation.ok) return valueValidation;
  const expectedPath = phase697V8EvidencePath({
    runId: envelope.runId,
    runScope: envelope.runScope,
    mode: envelope.mode,
  });
  if (expectedPath === null || resolve(input.evidencePath) !== resolve(input.root, expectedPath)) {
    return { ok: false, code: 'evidence_filename_invalid' };
  }
  if (envelope.durability.disposition === 'mock_direct') return { ok: true };

  const marker = await readPhase697V8Marker({ root: input.root });
  if (!marker.ok) return { ok: false, code: 'marker_contract_invalid' };
  if (
    marker.markerSha256 !== envelope.durability.markerSha256 ||
    marker.marker.runId !== envelope.runId ||
    marker.marker.runScope !== envelope.runScope ||
    marker.marker.executorProvenance !== envelope.report.executorProvenance ||
    !PHASE_6_9_7_V8_MARKER_SCHEMA.safeParse(marker.marker).success
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }

  const journal = await readPhase697V8Journal({ root: input.root, runId: envelope.runId });
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
  const completed = journal.journal.runCompleted;
  const sealed = journal.journal.sealed;
  if (
    sealed === null ||
    (envelope.durability.disposition === 'completed_run' && completed === null) ||
    (envelope.durability.disposition === 'orphan_sealed' && completed !== null) ||
    (completed !== null &&
      (completed.reportSha256 !== sha256Phase697V8Stable(envelope.report) ||
        completed.gate !== envelope.report.gate))
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  const expectedTail = sealed.sealedFromJournalSha256;
  const expectedSequence = journal.journal.lastSequence - 1;
  if (
    envelope.durability.journalTailSha256 !== expectedTail ||
    envelope.durability.journalSequence !== expectedSequence ||
    sealed.evidenceSha256 !== evidenceFile.evidenceSha256 ||
    sealed.disposition !== envelope.durability.disposition
  ) {
    return { ok: false, code: 'durability_identity_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerV8EvidenceFiles(
  paths: readonly string[],
): Promise<Phase697V8EvidenceValidationResult> {
  if (paths.length === 0) return { ok: false, code: 'evidence_read_failed' };
  const runIds: string[] = [];
  for (const path of paths) {
    const valid = await validatePhase697TutorOrganizerV8EvidenceFile({ path });
    if (!valid.ok) return valid;
    const read = await readPhase697V8Evidence(path);
    if (!read.ok) return read;
    runIds.push(read.envelope.runId);
  }
  return new Set(runIds).size === runIds.length
    ? { ok: true }
    : { ok: false, code: 'run_identity_invalid' };
}

async function readPhase697V8Evidence(
  path: string,
): Promise<
  | Readonly<{ ok: true; envelope: Phase697V8EvidenceEnvelope }>
  | Exclude<Phase697V8EvidenceValidationResult, Readonly<{ ok: true }>>
> {
  try {
    const bytes = await readFile(path);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_EVIDENCE_BYTES) {
      return { ok: false, code: 'evidence_read_failed' };
    }
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    const valid = validatePhase697TutorOrganizerV8EvidenceValue(value);
    if (!valid.ok) return valid;
    const parsed = PHASE_6_9_7_V8_EVIDENCE_ENVELOPE_SCHEMA.safeParse(value);
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
      : await validatePhase697TutorOrganizerV8EvidenceFiles(paths);
  process.stdout.write(
    `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}
