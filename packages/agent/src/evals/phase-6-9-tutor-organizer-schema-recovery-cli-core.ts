import {
  PHASE_6_9_7_SCHEMA_RECOVERY_CONFIRMATION_STATUS,
  PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
} from './phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import type { Phase697SchemaRecoveryCrashSealResult } from './phase-6-9-tutor-organizer-schema-recovery-durability.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-cli-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION =
  'VALIDATE_PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR3_BUNDLE_ZERO_PROVIDER' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_7_TUTOR_ORGANIZER_SCHEMA_RECOVERY_SR3_CRASH_ONLY_ONCE' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;
const VALIDATION_GATES = [
  'schema_recovery_mock_quality_not_evidence',
  'schema_recovery_quality_gate_passed',
  'schema_recovery_quality_gate_failed',
] as const;
const QUALITY_AUTHORITIES = ['none', 'schema_recovery_full_gate_semantic_gate'] as const;
const SEAL_FAILURE_CODES = [
  'attempt_missing_or_invalid',
  'live_attempt_in_progress',
  'attempt_already_complete',
  'publication_permanently_failed',
  'recovery_claim_io',
  'journal_drift',
  'recovery_evidence_io',
] as const;

export type Phase697SchemaRecoveryCliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  signal: AbortSignal;
}>;

export type Phase697SchemaRecoveryCliCorePorts = Readonly<{
  validate(input: { root: string }): Promise<
    Readonly<{
      ok: boolean;
      runId: string | null;
      gate?: string | null;
      qualityAuthority?: string | null;
      journalRecords?: number;
      finalJournalEvent?: string | null;
      reportLogicalSha256?: string | null;
      physicalArtifactSha256?: string | null;
    }>
  >;
  seal(input: { root: string }): Promise<Phase697SchemaRecoveryCrashSealResult>;
  write(line: string): void;
}>;

/**
 * SR3 exposes only zero-provider validation and crash-only seal. No live
 * confirmation, approval env, credential, source admission, marker reservation,
 * harness, executor, fetch, retry, resume, or replay port exists before SR5.
 */
export async function executePhase697SchemaRecoveryCliCore(
  rawInput: Phase697SchemaRecoveryCliCoreInput,
  rawPorts: Phase697SchemaRecoveryCliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;

  const blocked = (code: string) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION,
        lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
        ok: false,
        evidenceSealed: false,
        qualityAuthority: 'none',
        providerCalls: 0,
        code,
      }),
    );
    return 1 as const;
  };

  if (isAborted(input.signal)) return blocked('zero_provider_operation_aborted');
  if (hasExactArgument(input.args, PHASE_6_9_7_SCHEMA_RECOVERY_VALIDATE_CONFIRMATION)) {
    try {
      const result = sanitizeValidationResult(await ports.validate({ root: input.root }));
      if (!result) return blocked('bundle_validation_failed');
      if (
        !safeWrite(
          ports.write,
          JSON.stringify({
            ...result,
            version: PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION,
            lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
            operation: 'validate',
            providerCalls: 0,
          }),
        )
      ) {
        return 1;
      }
      return result.ok ? 0 : 1;
    } catch {
      return blocked('bundle_validation_failed');
    }
  }
  if (hasExactArgument(input.args, PHASE_6_9_7_SCHEMA_RECOVERY_CRASH_SEAL_CONFIRMATION)) {
    try {
      const result = sanitizeSealResult(await ports.seal({ root: input.root }));
      if (!result) return blocked('crash_only_seal_failed');
      if (
        !safeWrite(
          ports.write,
          JSON.stringify({
            ...result,
            version: PHASE_6_9_7_SCHEMA_RECOVERY_CLI_VERSION,
            lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
            operation: 'crash_only_seal',
            evidenceSealed: result.ok,
            qualityAuthority: 'none',
            providerCalls: 0,
          }),
        )
      ) {
        return 1;
      }
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_seal_failed');
    }
  }

  return blocked(PHASE_6_9_7_SCHEMA_RECOVERY_CONFIRMATION_STATUS);
}

function sanitizeValidationResult(value: unknown) {
  const fields = readExactOwnData(value, [
    'ok',
    'runId',
    'gate',
    'qualityAuthority',
    'journalRecords',
    'finalJournalEvent',
    'reportLogicalSha256',
    'physicalArtifactSha256',
  ]);
  if (!fields || typeof fields.ok !== 'boolean') return null;
  if (!fields.ok) {
    if (
      fields.runId !== null ||
      fields.gate !== null ||
      fields.qualityAuthority !== null ||
      fields.journalRecords !== 0 ||
      fields.finalJournalEvent !== null ||
      fields.reportLogicalSha256 !== null ||
      fields.physicalArtifactSha256 !== null
    ) {
      return null;
    }
    return Object.freeze({
      ok: false as const,
      runId: null,
      gate: null,
      qualityAuthority: null,
      journalRecords: 0,
      finalJournalEvent: null,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
    });
  }
  if (
    typeof fields.runId !== 'string' ||
    !UUID.test(fields.runId) ||
    !isEnum(fields.gate, VALIDATION_GATES) ||
    !isEnum(fields.qualityAuthority, QUALITY_AUTHORITIES) ||
    !Number.isSafeInteger(fields.journalRecords) ||
    Number(fields.journalRecords) <= 0 ||
    fields.finalJournalEvent !== 'evidence_published' ||
    !isSha256(fields.reportLogicalSha256) ||
    !isSha256(fields.physicalArtifactSha256)
  ) {
    return null;
  }
  return Object.freeze({
    ok: true as const,
    runId: fields.runId,
    gate: fields.gate,
    qualityAuthority: fields.qualityAuthority,
    journalRecords: fields.journalRecords as number,
    finalJournalEvent: fields.finalJournalEvent,
    reportLogicalSha256: fields.reportLogicalSha256,
    physicalArtifactSha256: fields.physicalArtifactSha256,
  });
}

function sanitizeSealResult(value: unknown): Phase697SchemaRecoveryCrashSealResult | null {
  const success = readExactOwnData(value, ['ok', 'runId', 'disposition', 'gate', 'evidenceSha256']);
  if (success) {
    if (
      success.ok !== true ||
      typeof success.runId !== 'string' ||
      !UUID.test(success.runId) ||
      !isEnum(success.disposition, ['crash_only_sealed', 'terminal_publication_recovered']) ||
      !isEnum(success.gate, VALIDATION_GATES) ||
      !isSha256(success.evidenceSha256)
    ) {
      return null;
    }
    return Object.freeze({
      ok: true,
      runId: success.runId,
      disposition: success.disposition,
      gate: success.gate,
      evidenceSha256: success.evidenceSha256,
    });
  }
  const failure = readExactOwnData(value, ['ok', 'code']);
  if (!failure || failure.ok !== false || !isEnum(failure.code, SEAL_FAILURE_CODES)) return null;
  return Object.freeze({ ok: false, code: failure.code });
}

function readInput(value: unknown): Phase697SchemaRecoveryCliCoreInput | null {
  const fields = readExactOwnData(value, ['args', 'root', 'signal']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(fields.args.map((entry) => String(entry))),
    root: fields.root,
    signal: fields.signal,
  });
}

function readPorts(value: unknown): Phase697SchemaRecoveryCliCorePorts | null {
  const fields = readExactOwnData(value, ['seal', 'validate', 'write']);
  if (!fields || Object.values(fields).some((field) => typeof field !== 'function')) return null;
  return Object.freeze(fields as unknown as Phase697SchemaRecoveryCliCorePorts);
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    return null;
  }
}

function hasExactArgument(args: readonly string[], expected: string) {
  try {
    return args.length === 1 && args[0] === expected;
  } catch {
    return false;
  }
}

function isEnum<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && SHA256.test(value);
}

function safeWrite(write: (line: string) => void, line: string) {
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}
