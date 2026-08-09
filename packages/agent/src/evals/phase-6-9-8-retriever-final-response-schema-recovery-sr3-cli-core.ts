import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA,
  type Phase698RetrieverSchemaRecoverySr3Report,
  type Phase698RetrieverSchemaRecoverySr3Source,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import {
  reservePhase698RetrieverSchemaRecoverySr3Attempt,
  sealPhase698RetrieverSchemaRecoverySr3InterruptedAttempt,
  validatePhase698RetrieverSchemaRecoverySr3Bundle,
  type Phase698RetrieverSchemaRecoverySr3Reservation,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-durability.ts';
import {
  createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr3,
  type Phase698RetrieverSchemaRecoverySr3Harness,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-runner.ts';
import {
  createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest,
  inspectPhase698RetrieverSchemaRecoverySr3SourceAdmission,
  type Phase698RetrieverSchemaRecoverySr3AdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr3-cli-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT =
  'RUN_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR3_ZERO_PROVIDER_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SEAL_ARGUMENT =
  'SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR3_CRASH_ONLY_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_RECOVER_ARGUMENT =
  'RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR3_CRASH_ONLY_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_VALIDATE_ARGUMENT =
  'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR3_BUNDLE_ZERO_PROVIDER' as const;

export type Phase698RetrieverSchemaRecoverySr3CliInput = Readonly<{
  args: readonly string[];
  root: string;
  signal: AbortSignal;
}>;

export type Phase698RetrieverSchemaRecoverySr3CliPorts = Readonly<{
  authority: 'zero_provider';
  randomUUID(): string;
  now(): number;
  readSource(root: string): Readonly<{
    source: Phase698RetrieverSchemaRecoverySr3Source;
    capability: Phase698RetrieverSchemaRecoverySr3AdmissionCapability;
    reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
  }>;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    reservationCapability: Phase698RetrieverSchemaRecoverySr3ReservationAdmissionCapability;
  }): Promise<Phase698RetrieverSchemaRecoverySr3Reservation>;
  createHarness(): Phase698RetrieverSchemaRecoverySr3Harness;
  run(
    input: Parameters<typeof runPhase698RetrieverSchemaRecoverySr3>[0],
  ): Promise<Readonly<Phase698RetrieverSchemaRecoverySr3Report>>;
  validate(input: {
    root: string;
  }): ReturnType<typeof validatePhase698RetrieverSchemaRecoverySr3Bundle>;
  seal(input: {
    root: string;
  }): ReturnType<typeof sealPhase698RetrieverSchemaRecoverySr3InterruptedAttempt>;
  write(line: string): void;
}>;

export async function executePhase698RetrieverSchemaRecoverySr3CliCore(
  rawInput: Phase698RetrieverSchemaRecoverySr3CliInput,
  rawPorts?: Partial<Phase698RetrieverSchemaRecoverySr3CliPorts>,
): Promise<0 | 1> {
  const input = normalizeInput(rawInput);
  if (!input) return 1;
  const ports = createPorts(rawPorts);
  const blocked = (code: string, details: Record<string, unknown> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLI_VERSION,
        ok: false,
        authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        evidenceSealed: false,
        qualityAuthority: 'none',
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_VALIDATE_ARGUMENT)) {
    try {
      const result = await ports.validate({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLI_VERSION,
          operation: 'validate',
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('bundle_validation_failed');
    }
  }
  if (
    hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SEAL_ARGUMENT) ||
    hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_RECOVER_ARGUMENT)
  ) {
    try {
      const result = await ports.seal({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLI_VERSION,
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_AUTHORITY,
          providerCalls: 0,
          credentialReads: 0,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_seal_failed');
    }
  }
  if (!hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT)) {
    return blocked('cli_argument_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_before_source');

  let admission: ReturnType<
    typeof createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest
  >;
  try {
    admission = ports.readSource(input.root);
  } catch {
    return blocked('source_admission_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_after_source');

  let reservation: Phase698RetrieverSchemaRecoverySr3Reservation;
  let runId: string;
  try {
    runId = z.string().uuid().parse(ports.randomUUID());
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt: new Date(ports.now()).toISOString(),
      reservationCapability: admission.reservationCapability,
    });
  } catch {
    return blocked('reservation_invalid');
  }
  try {
    const report = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        runMode: 'reviewed_mock',
        admissionCapability: admission.capability,
        harness: ports.createHarness(),
        lifecycle: reservation.lifecycle,
        signal: input.signal,
      }),
    );
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) return blocked('bundle_invalid');
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_CLI_VERSION,
        ok: report.gate.passed,
        authority: report.authority,
        qualityAuthority: report.qualityAuthority,
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        runId,
        gate: report.gate,
        runtime: report.runtime,
        schema: report.schema,
        journalRecords: validation.journalRecords,
        reportLogicalSha256: validation.reportLogicalSha256,
        artifactSha256: published.artifactSha256,
      }),
    );
    return report.gate.passed ? 0 : 1;
  } catch {
    return blocked('runtime_or_evidence_invalid');
  }
}

function createPorts(
  overrides: Partial<Phase698RetrieverSchemaRecoverySr3CliPorts> | undefined,
): Phase698RetrieverSchemaRecoverySr3CliPorts {
  const write = overrides?.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  return Object.freeze({
    authority: 'zero_provider' as const,
    randomUUID: overrides?.randomUUID ?? randomUUIDFallback,
    now: overrides?.now ?? Date.now,
    readSource:
      overrides?.readSource ??
      ((root: string) => {
        const admission = inspectPhase698RetrieverSchemaRecoverySr3SourceAdmission(root);
        if (!admission.ok)
          throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_INVALID');
        return admission;
      }),
    reserve: overrides?.reserve ?? reservePhase698RetrieverSchemaRecoverySr3Attempt,
    createHarness:
      overrides?.createHarness ??
      createPhase698RetrieverSchemaRecoverySr3ReviewedMockHarnessForTest,
    run: overrides?.run ?? runPhase698RetrieverSchemaRecoverySr3,
    validate: overrides?.validate ?? validatePhase698RetrieverSchemaRecoverySr3Bundle,
    seal: overrides?.seal ?? sealPhase698RetrieverSchemaRecoverySr3InterruptedAttempt,
    write,
  });
}

function normalizeInput(value: unknown): Phase698RetrieverSchemaRecoverySr3CliInput | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as { args?: unknown }).args) ||
    (value as { args: unknown[] }).args.some((arg) => typeof arg !== 'string') ||
    typeof (value as { root?: unknown }).root !== 'string' ||
    !isAbortSignal((value as { signal?: unknown }).signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze((value as { args: string[] }).args.slice()),
    root: (value as { root: string }).root,
    signal: (value as { signal: AbortSignal }).signal,
  });
}

function hasExactArgument(args: readonly string[], expected: string) {
  return args.length === 1 && args[0] === expected;
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

function randomUUIDFallback() {
  return randomUUID();
}
