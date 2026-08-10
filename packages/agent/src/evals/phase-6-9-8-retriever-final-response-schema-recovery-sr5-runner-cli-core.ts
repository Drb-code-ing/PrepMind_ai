import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_REPORT_SCHEMA,
  type Phase698RetrieverSchemaRecoverySr5RunnerReport,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-contract.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5Runner,
  type Phase698RetrieverSchemaRecoverySr5RunnerHarness,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner.ts';
import {
  reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt,
  sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttempt,
  validatePhase698RetrieverSchemaRecoverySr5RunnerBundle,
  type Phase698RetrieverSchemaRecoverySr5RunnerReservation,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-durability.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest,
  type Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr5BoundReservationCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';
import { createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-runner-cli-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT =
  'RUN_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_ZERO_PROVIDER_ONCE' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_VALIDATE_ARGUMENT =
  'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_BUNDLE_ZERO_PROVIDER' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RECOVER_ARGUMENT =
  'RECOVER_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_RUNNER_CRASH_ONLY_ONCE' as const;

export type Phase698RetrieverSchemaRecoverySr5RunnerCliInput = Readonly<{
  args: readonly string[];
  root: string;
  signal: AbortSignal;
}>;

type SyntheticBoundAdmission = Readonly<{
  capability: Phase698RetrieverSchemaRecoverySr5BoundAdmissionCapability;
  reservationCapability: Phase698RetrieverSchemaRecoverySr5BoundReservationCapability;
}>;

export type Phase698RetrieverSchemaRecoverySr5RunnerCliPorts = Readonly<{
  authority: 'zero_provider';
  randomUUID(): string;
  now(): number;
  createAdmission(): SyntheticBoundAdmission;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    reservationCapability: Phase698RetrieverSchemaRecoverySr5BoundReservationCapability;
  }): Promise<Phase698RetrieverSchemaRecoverySr5RunnerReservation>;
  createHarness(): Phase698RetrieverSchemaRecoverySr5RunnerHarness;
  run(
    input: Parameters<typeof runPhase698RetrieverSchemaRecoverySr5Runner>[0],
  ): Promise<Readonly<Phase698RetrieverSchemaRecoverySr5RunnerReport>>;
  validate(input: {
    root: string;
  }): ReturnType<typeof validatePhase698RetrieverSchemaRecoverySr5RunnerBundle>;
  recover(input: {
    root: string;
  }): ReturnType<typeof sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttempt>;
  write(line: string): void;
}>;

export async function executePhase698RetrieverSchemaRecoverySr5RunnerCliCore(
  rawInput: Phase698RetrieverSchemaRecoverySr5RunnerCliInput,
  rawPorts?: Partial<Phase698RetrieverSchemaRecoverySr5RunnerCliPorts>,
): Promise<0 | 1 | 2> {
  const input = normalizeInput(rawInput);
  if (!input) return 2;
  const ports = createPorts(rawPorts);
  const blocked = (code: string, details: Record<string, unknown> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION,
        ok: false,
        authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_AUTHORITY,
        qualityAuthority: 'none',
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        formalEvidence: 0,
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (input.args.length === 1 && input.args[0] === '--help') {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION,
        commands: [
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT,
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_VALIDATE_ARGUMENT,
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RECOVER_ARGUMENT,
        ],
        mode: 'zero_provider_reviewed_mock_only',
        providerCalls: 0,
        credentialReads: 0,
        live: false,
        replay: false,
      }),
    );
    return 0;
  }

  if (
    hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_VALIDATE_ARGUMENT)
  ) {
    try {
      const result = await ports.validate({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION,
          operation: 'validate',
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_AUTHORITY,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('bundle_validation_failed');
    }
  }

  if (
    hasExactArgument(input.args, PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RECOVER_ARGUMENT)
  ) {
    try {
      const result = await ports.recover({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION,
          operation: 'recover',
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_AUTHORITY,
          providerCalls: 0,
          credentialReads: 0,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_recovery_failed');
    }
  }

  if (
    input.args.length > 1 ||
    (input.args.length === 1 &&
      input.args[0] !== PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT)
  ) {
    return blocked('cli_argument_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_before_admission');

  let admission: SyntheticBoundAdmission;
  let runId: string;
  let reservation: Phase698RetrieverSchemaRecoverySr5RunnerReservation;
  try {
    admission = ports.createAdmission();
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
  if (input.signal.aborted) return blocked('aborted_after_reservation');

  try {
    const report = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        runMode: 'reviewed_mock',
        repositoryRoot: input.root,
        admissionAuthority: 'synthetic_test',
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
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_CLI_VERSION,
        ok: report.gate.passed,
        authority: report.authority,
        qualityAuthority: report.qualityAuthority,
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        formalEvidence: 0,
        temporarySyntheticEvidence: 1,
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
  overrides: Partial<Phase698RetrieverSchemaRecoverySr5RunnerCliPorts> | undefined,
): Phase698RetrieverSchemaRecoverySr5RunnerCliPorts {
  const write = overrides?.write ?? ((line: string) => process.stdout.write(`${line}\n`));
  return Object.freeze({
    authority: 'zero_provider' as const,
    randomUUID: overrides?.randomUUID ?? randomUUID,
    now: overrides?.now ?? Date.now,
    createAdmission:
      overrides?.createAdmission ??
      (() => {
        const bound = createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(
          createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput(),
        );
        return Object.freeze({
          capability: bound.capability,
          reservationCapability: bound.reservationCapability,
        });
      }),
    reserve: overrides?.reserve ?? reservePhase698RetrieverSchemaRecoverySr5RunnerAttempt,
    createHarness:
      overrides?.createHarness ??
      createPhase698RetrieverSchemaRecoverySr5RunnerReviewedMockHarnessForTest,
    run: overrides?.run ?? runPhase698RetrieverSchemaRecoverySr5Runner,
    validate: overrides?.validate ?? validatePhase698RetrieverSchemaRecoverySr5RunnerBundle,
    recover: overrides?.recover ?? sealPhase698RetrieverSchemaRecoverySr5RunnerInterruptedAttempt,
    write,
  });
}

function normalizeInput(value: unknown): Phase698RetrieverSchemaRecoverySr5RunnerCliInput | null {
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
  } catch {
    // A broken output pipe must not expose an exception or alter the gate.
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}
