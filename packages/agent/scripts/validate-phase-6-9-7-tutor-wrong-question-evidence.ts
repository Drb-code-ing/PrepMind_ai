import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
  type Phase697TutorOrganizerReport,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';

const SENSITIVE_EVIDENCE_KEY =
  /prompt|question|answer|analysis|filename|provider.*(?:body|header|response)|credential|api.?key|secret|cookie|authorization|raw.*error|stack|owner.?id|user.?id|deck.?id/i;
const SENSITIVE_EVIDENCE_VALUE =
  /(?:api[_-]?key\s*=|sk-[a-z0-9_-]{12,}|bearer\s+[a-z0-9._-]{12,}|https?:\/\/|begin\s+(?:rsa|private)\s+key)/i;

export type Phase697EvidenceValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code:
        | 'sensitive_evidence'
        | 'report_contract_invalid'
        | 'evidence_read_failed'
        | 'evidence_filename_invalid'
        | 'run_identity_invalid';
    }>;

export function containsSensitivePhase697EvidenceKey(key: string): boolean {
  if (
    key === 'tutorPromptVersion' ||
    key === 'organizerPromptVersion' ||
    key === 'finalAnswer' ||
    key === 'answerStructure' ||
    key === 'guidingQuestion' ||
    key.endsWith('SchemaVersion') ||
    key.endsWith('ProjectionVersion')
  ) {
    return false;
  }
  return SENSITIVE_EVIDENCE_KEY.test(key);
}

export function hasSensitivePhase697Evidence(value: unknown): boolean {
  if (typeof value === 'string') return SENSITIVE_EVIDENCE_VALUE.test(value);
  if (Array.isArray(value)) return value.some(hasSensitivePhase697Evidence);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) =>
      containsSensitivePhase697EvidenceKey(key) || hasSensitivePhase697Evidence(child),
  );
}

export function validatePhase697TutorOrganizerEvidenceValue(
  value: unknown,
): Phase697EvidenceValidationResult {
  if (hasSensitivePhase697Evidence(value)) {
    return { ok: false, code: 'sensitive_evidence' };
  }
  const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse(value);
  return parsed.success ? { ok: true } : { ok: false, code: 'report_contract_invalid' };
}

export function validatePhase697TutorOrganizerEvidenceBundle(
  values: readonly unknown[],
): Phase697EvidenceValidationResult {
  const reports: Phase697TutorOrganizerReport[] = [];
  for (const value of values) {
    const validated = validatePhase697TutorOrganizerEvidenceValue(value);
    if (!validated.ok) return validated;
    reports.push(PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.parse(value));
  }
  const runIds = reports.map((report) => report.runId);
  if (new Set(runIds).size !== runIds.length) {
    return { ok: false, code: 'run_identity_invalid' };
  }
  return { ok: true };
}

export async function validatePhase697TutorOrganizerEvidenceFile(input: {
  path: string;
}): Promise<Phase697EvidenceValidationResult> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(input.path, 'utf8')) as unknown;
  } catch {
    return { ok: false, code: 'evidence_read_failed' };
  }
  const validated = validatePhase697TutorOrganizerEvidenceValue(value);
  if (!validated.ok) return validated;
  const report = PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.parse(value);
  const expectedName = `phase-6-9-7-tutor-organizer-${report.runScope}-${report.mode}-${report.runId}.json`;
  return basename(input.path) === expectedName
    ? { ok: true }
    : { ok: false, code: 'evidence_filename_invalid' };
}

export async function validatePhase697TutorOrganizerEvidenceFiles(
  paths: readonly string[],
): Promise<Phase697EvidenceValidationResult> {
  const values: unknown[] = [];
  for (const path of paths) {
    const fileResult = await validatePhase697TutorOrganizerEvidenceFile({ path });
    if (!fileResult.ok) return fileResult;
    try {
      values.push(JSON.parse(await readFile(path, 'utf8')) as unknown);
    } catch {
      return { ok: false, code: 'evidence_read_failed' };
    }
  }
  return validatePhase697TutorOrganizerEvidenceBundle(values);
}

if (import.meta.main) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'evidence_read_failed' })}\n`);
    process.exitCode = 1;
  } else {
    const result = await validatePhase697TutorOrganizerEvidenceFiles(paths);
    process.stdout.write(
      `${JSON.stringify({ ...result, filesChecked: result.ok ? paths.length : 0 })}\n`,
    );
    process.exitCode = result.ok ? 0 : 1;
  }
}
