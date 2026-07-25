import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
  type Phase697TutorOrganizerReport,
  type Phase697TutorOrganizerRunnerVersion,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';

export const PHASE_6_9_7_V1_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer' as const;
export const PHASE_6_9_7_V2_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v2' as const;

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
    key === 'tutorPromptContentSha256' ||
    key === 'organizerPromptContentSha256' ||
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
  return validateEvidenceValueForVersion(value, PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1);
}

export function validatePhase697TutorOrganizerV2EvidenceValue(
  value: unknown,
): Phase697EvidenceValidationResult {
  return validateEvidenceValueForVersion(value, PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2);
}

function validateEvidenceValueForVersion(
  value: unknown,
  runnerVersion: Phase697TutorOrganizerRunnerVersion,
): Phase697EvidenceValidationResult {
  if (hasSensitivePhase697Evidence(value)) {
    return { ok: false, code: 'sensitive_evidence' };
  }
  const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.safeParse(value);
  return parsed.success && parsed.data.runnerVersion === runnerVersion
    ? { ok: true }
    : { ok: false, code: 'report_contract_invalid' };
}

export function validatePhase697TutorOrganizerEvidenceBundle(
  values: readonly unknown[],
): Phase697EvidenceValidationResult {
  return validateEvidenceBundleForVersion(values, PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1);
}

export function validatePhase697TutorOrganizerV2EvidenceBundle(
  values: readonly unknown[],
): Phase697EvidenceValidationResult {
  return validateEvidenceBundleForVersion(values, PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2);
}

function validateEvidenceBundleForVersion(
  values: readonly unknown[],
  runnerVersion: Phase697TutorOrganizerRunnerVersion,
): Phase697EvidenceValidationResult {
  const reports: Phase697TutorOrganizerReport[] = [];
  for (const value of values) {
    const validated = validateEvidenceValueForVersion(value, runnerVersion);
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
  return validateEvidenceFileForVersion(
    input,
    PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
    PHASE_6_9_7_V1_EVIDENCE_PREFIX,
  );
}

export async function validatePhase697TutorOrganizerV2EvidenceFile(input: {
  path: string;
}): Promise<Phase697EvidenceValidationResult> {
  return validateEvidenceFileForVersion(
    input,
    PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
    PHASE_6_9_7_V2_EVIDENCE_PREFIX,
  );
}

async function validateEvidenceFileForVersion(
  input: { path: string },
  runnerVersion: Phase697TutorOrganizerRunnerVersion,
  evidencePrefix: string,
): Promise<Phase697EvidenceValidationResult> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(input.path, 'utf8')) as unknown;
  } catch {
    return { ok: false, code: 'evidence_read_failed' };
  }
  const validated = validateEvidenceValueForVersion(value, runnerVersion);
  if (!validated.ok) return validated;
  const report = PHASE_6_9_7_TUTOR_ORGANIZER_REPORT_SCHEMA.parse(value);
  const expectedName = `${evidencePrefix}-${report.runScope}-${report.mode}-${report.runId}.json`;
  return basename(input.path) === expectedName
    ? { ok: true }
    : { ok: false, code: 'evidence_filename_invalid' };
}

export async function validatePhase697TutorOrganizerEvidenceFiles(
  paths: readonly string[],
): Promise<Phase697EvidenceValidationResult> {
  return validateEvidenceFilesForVersion(
    paths,
    PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
    PHASE_6_9_7_V1_EVIDENCE_PREFIX,
  );
}

export async function validatePhase697TutorOrganizerV2EvidenceFiles(
  paths: readonly string[],
): Promise<Phase697EvidenceValidationResult> {
  return validateEvidenceFilesForVersion(
    paths,
    PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
    PHASE_6_9_7_V2_EVIDENCE_PREFIX,
  );
}

async function validateEvidenceFilesForVersion(
  paths: readonly string[],
  runnerVersion: Phase697TutorOrganizerRunnerVersion,
  evidencePrefix: string,
): Promise<Phase697EvidenceValidationResult> {
  const values: unknown[] = [];
  for (const path of paths) {
    const fileResult = await validateEvidenceFileForVersion(
      { path },
      runnerVersion,
      evidencePrefix,
    );
    if (!fileResult.ok) return fileResult;
    try {
      values.push(JSON.parse(await readFile(path, 'utf8')) as unknown);
    } catch {
      return { ok: false, code: 'evidence_read_failed' };
    }
  }
  return validateEvidenceBundleForVersion(values, runnerVersion);
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
