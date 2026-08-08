import { z } from 'zod';

import type {
  Phase698ArchitectureRecoveryCrashSealResult,
  Phase698ArchitectureRecoveryReservation,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';
import type { Phase698ArchitectureRecoveryR5LiveCredentials } from './phase-6-9-8-retriever-final-response-architecture-recovery-r5-live.ts';
import type {
  Phase698ArchitectureRecoveryHarness,
  RunPhase698ArchitectureRecoveryInput,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA,
  canonicalPhase698ArchitectureRecoveryJson,
  type Phase698ArchitectureRecoveryReport,
  type Phase698ArchitectureRecoverySource,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import type {
  Phase698ArchitectureRecoveryAdmissionCapability,
  Phase698ArchitectureRecoveryReservationAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';

export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-architecture-recovery-r5-cli-v1' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_CRASH_ONLY_ONCE' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTANCE =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_APPROVAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_APPROVED' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_REWRITE_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_REWRITE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_ARCHITECTURE_RECOVERY_R5_QWEN_API_KEY' as const;
export const PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1' as const;

type SourceAdmission = Readonly<{
  source: Phase698ArchitectureRecoverySource;
  capability: Phase698ArchitectureRecoveryAdmissionCapability;
  reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
}>;

export type Phase698ArchitectureRecoveryR5CliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  authorizationEnv: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}>;

export type Phase698ArchitectureRecoveryR5CliCorePorts = Readonly<{
  authority: 'controlled_live' | 'synthetic_test';
  readSource(root: string): SourceAdmission;
  readDataBoundary(env: Readonly<Record<string, string | undefined>>): true;
  readApproval(env: Readonly<Record<string, string | undefined>>): true;
  readRewriteCredential(env: Readonly<Record<string, string | undefined>>): string;
  readFinalResponseCredential(env: Readonly<Record<string, string | undefined>>): string;
  readQwenCredential(env: Readonly<Record<string, string | undefined>>): string;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    runMode: 'controlled_live';
    reservationCapability: Phase698ArchitectureRecoveryReservationAdmissionCapability;
  }): Promise<Phase698ArchitectureRecoveryReservation>;
  createHarness(input: {
    runId: string;
    credentials: Phase698ArchitectureRecoveryR5LiveCredentials;
  }): Phase698ArchitectureRecoveryHarness;
  run(
    input: RunPhase698ArchitectureRecoveryInput,
  ): Promise<Readonly<Phase698ArchitectureRecoveryReport>>;
  validate(input: { root: string }): Promise<
    Readonly<{
      ok: boolean;
      runId: string | null;
      qualityAuthority?: string | null;
      journalRecords?: number;
      finalJournalEvent?: string | null;
      reportLogicalSha256?: string | null;
      physicalArtifactSha256?: string | null;
    }>
  >;
  seal(input: { root: string }): Promise<Phase698ArchitectureRecoveryCrashSealResult>;
  randomUUID(): string;
  now(): number;
  write(line: string): void;
}>;

export async function executePhase698ArchitectureRecoveryR5CliCore(
  rawInput: Phase698ArchitectureRecoveryR5CliCoreInput,
  rawPorts: Phase698ArchitectureRecoveryR5CliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;
  const blocked = (code: string, details: Readonly<Record<string, unknown>> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CLI_VERSION,
        ok: false,
        evidenceSealed: false,
        qualityAuthority: 'none',
        providerCalls: 0,
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (hasExactArgument(input.args, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CRASH_SEAL_CONFIRMATION)) {
    try {
      const result = await ports.seal({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CLI_VERSION,
          operation: 'crash_only_seal',
          qualityAuthority: 'none',
          providerCalls: 0,
          evidenceSealed: result.ok,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_seal_failed');
    }
  }
  if (!hasExactArgument(input.args, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION)) {
    return blocked('cli_argument_invalid', { credentialReads: 0 });
  }
  if (isAborted(input.signal)) return blocked('live_aborted_before_source', { credentialReads: 0 });

  let admission: SourceAdmission;
  try {
    admission = readSourceAdmission(ports.readSource(input.root));
  } catch {
    return blocked('source_admission_invalid', { credentialReads: 0 });
  }
  if (isAborted(input.signal)) return blocked('live_aborted_after_source', { credentialReads: 0 });
  try {
    ports.readDataBoundary(input.authorizationEnv);
  } catch {
    return blocked('data_boundary_not_accepted', { credentialReads: 0 });
  }
  try {
    ports.readApproval(input.authorizationEnv);
  } catch {
    return blocked('live_not_authorized', { credentialReads: 0 });
  }

  let credentials: Phase698ArchitectureRecoveryR5LiveCredentials;
  let credentialReads = 0;
  try {
    const rewriteDeepseekApiKey = ports.readRewriteCredential(input.authorizationEnv);
    credentialReads += 1;
    const finalResponseDeepseekApiKey = ports.readFinalResponseCredential(input.authorizationEnv);
    credentialReads += 1;
    const qwenApiKey = ports.readQwenCredential(input.authorizationEnv);
    credentialReads += 1;
    credentials = Object.freeze({
      rewriteDeepseekApiKey,
      finalResponseDeepseekApiKey,
      qwenApiKey,
      qwenBaseURL: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_BASE_URL,
    });
  } catch {
    return blocked('live_configuration_invalid', { credentialReads });
  }
  if (isAborted(input.signal))
    return blocked('live_aborted_before_reservation', { credentialReads: 3 });

  let runId: string;
  let createdAt: string;
  try {
    runId = z.string().uuid().parse(ports.randomUUID());
    createdAt = z.string().datetime({ offset: true }).parse(new Date(ports.now()).toISOString());
  } catch {
    return blocked('live_preflight_invalid', { credentialReads: 3 });
  }

  let reservation: Phase698ArchitectureRecoveryReservation;
  try {
    if (ports.authority !== 'controlled_live') throw new Error('authority');
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt,
      runMode: 'controlled_live',
      reservationCapability: admission.reservationCapability,
    });
  } catch {
    return blocked('live_once_already_consumed_or_evidence_io', { credentialReads: 3 });
  }

  let report: Phase698ArchitectureRecoveryReport;
  try {
    const harness = ports.createHarness({ runId, credentials });
    if (
      harness.transportAuthority !== 'external_provider' ||
      harness.runMode !== 'controlled_live'
    ) {
      throw new Error('harness_authority');
    }
    report = PHASE_6_9_8_ARCHITECTURE_RECOVERY_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        authority: 'controlled_live',
        runMode: 'controlled_live',
        credentialReads: 3,
        admissionCapability: admission.capability,
        harness,
        lifecycle: reservation.lifecycle,
        signal: input.signal,
      }),
    );
    if (
      report.runId !== runId ||
      report.authority !== 'controlled_live' ||
      report.execution.mode !== 'controlled_live' ||
      report.execution.credentialReads !== 3 ||
      canonicalPhase698ArchitectureRecoveryJson(report.source) !==
        canonicalPhase698ArchitectureRecoveryJson(admission.source)
    ) {
      throw new Error('report_authority');
    }
  } catch {
    return blocked('live_runtime_or_evidence_io', {
      credentialReads: 3,
      providerCalls: null,
      reservationConsumed: true,
      crashOnlySealRequired: true,
      reservationRunId: runId,
    });
  }

  try {
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error('bundle_invalid');
    const result = {
      version: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_CLI_VERSION,
      operation: 'controlled_live',
      ok: report.gate.passed,
      evidenceSealed: true,
      authority: 'controlled_live',
      qualityAuthority: report.qualityAuthority,
      runId,
      gate: report.gate,
      execution: report.execution,
      providers: report.providers,
      rewrite: report.rewrite,
      finalResponse: report.finalResponse,
      latency: report.latency,
      safety: report.safety,
      journalRecords: validation.journalRecords ?? null,
      finalJournalEvent: validation.finalJournalEvent ?? null,
      reportLogicalSha256: validation.reportLogicalSha256 ?? null,
      artifactSha256: published.evidenceSha256,
    };
    if (!safeWrite(ports.write, JSON.stringify(result))) return 1;
    return report.gate.passed ? 0 : 1;
  } catch {
    return blocked('live_evidence_io', {
      credentialReads: 3,
      providerCalls: null,
      reservationConsumed: true,
      crashOnlySealRequired: true,
      reservationRunId: runId,
    });
  }
}

export function readPhase698ArchitectureRecoveryR5DataBoundary(
  env: Readonly<Record<string, string | undefined>>,
): true {
  if (
    readEnv(env, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ENV) !==
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_DATA_BOUNDARY_ACCEPTANCE
  ) {
    throw new Error('R5_DATA_BOUNDARY_INVALID');
  }
  return true;
}

export function readPhase698ArchitectureRecoveryR5Approval(
  env: Readonly<Record<string, string | undefined>>,
): true {
  if (
    readEnv(env, PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_APPROVAL_ENV) !==
    PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_EXACT_CONFIRMATION
  ) {
    throw new Error('R5_APPROVAL_INVALID');
  }
  return true;
}

export function readPhase698ArchitectureRecoveryR5Credential(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
) {
  const value = readEnv(env, key);
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[\x21-\x7e]+$/u.test(value)
  ) {
    throw new Error('R5_CREDENTIAL_INVALID');
  }
  return value;
}

function readInput(value: unknown): Phase698ArchitectureRecoveryR5CliCoreInput | null {
  const fields = readExactOwnData(value, ['args', 'authorizationEnv', 'root', 'signal']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    !isRecord(fields.authorizationEnv) ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isAbortSignal(fields.signal)
  )
    return null;
  return Object.freeze({
    args: Object.freeze(fields.args.map(String)),
    authorizationEnv: fields.authorizationEnv as Record<string, string | undefined>,
    root: fields.root,
    signal: fields.signal,
  });
}

function readPorts(value: unknown): Phase698ArchitectureRecoveryR5CliCorePorts | null {
  const fields = readExactOwnData(value, [
    'authority',
    'createHarness',
    'now',
    'randomUUID',
    'readApproval',
    'readDataBoundary',
    'readFinalResponseCredential',
    'readQwenCredential',
    'readRewriteCredential',
    'readSource',
    'reserve',
    'run',
    'seal',
    'validate',
    'write',
  ]);
  if (
    !fields ||
    (fields.authority !== 'controlled_live' && fields.authority !== 'synthetic_test') ||
    Object.entries(fields).some(
      ([key, field]) => key !== 'authority' && typeof field !== 'function',
    )
  )
    return null;
  return Object.freeze(fields as unknown as Phase698ArchitectureRecoveryR5CliCorePorts);
}

function readSourceAdmission(value: unknown): SourceAdmission {
  const fields = readExactOwnData(value, ['capability', 'reservationCapability', 'source']);
  if (
    !fields ||
    !readCapability(
      fields.capability,
      'phase-6.9.8-retriever-final-response-architecture-recovery-admission-capability-v1',
    ) ||
    !readCapability(
      fields.reservationCapability,
      'phase-6.9.8-retriever-final-response-architecture-recovery-reservation-admission-capability-v1',
    )
  )
    throw new Error('R5_SOURCE_ADMISSION_INVALID');
  return Object.freeze({
    source: PHASE_6_9_8_ARCHITECTURE_RECOVERY_SOURCE_SCHEMA.parse(fields.source),
    capability: fields.capability as Phase698ArchitectureRecoveryAdmissionCapability,
    reservationCapability:
      fields.reservationCapability as Phase698ArchitectureRecoveryReservationAdmissionCapability,
  });
}

function readCapability(value: unknown, version: string) {
  return isRecord(value) && Reflect.ownKeys(value).length === 1 && value.version === version;
}

function readEnv(env: Readonly<Record<string, string | undefined>>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function hasExactArgument(args: readonly string[], expected: string) {
  return args.length === 1 && args[0] === expected;
}

function safeWrite(write: (line: string) => void, line: string) {
  try {
    if (line.length > 16_384) return false;
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (
      !isRecord(value) ||
      Reflect.ownKeys(value).length !== expectedKeys.length ||
      Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    )
      return null;
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
