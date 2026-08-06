import { z } from 'zod';

import {
  PHASE_6_9_8_TASK9_REPORT_SCHEMA,
  PHASE_6_9_8_TASK9_SOURCE_SCHEMA,
  canonicalPhase698Task9Json,
  type Phase698Task9Report,
  type Phase698Task9Source,
} from './phase-6-9-8-retriever-final-response-task9-contract.ts';
import type {
  Phase698Task9CrashSealResult,
  Phase698Task9Reservation,
} from './phase-6-9-8-retriever-final-response-task9-durability.ts';
import type { Phase698Task9LiveCredentials } from './phase-6-9-8-retriever-final-response-task9-live.ts';
import type {
  Phase698Task9Harness,
  RunPhase698Task9Input,
} from './phase-6-9-8-retriever-final-response-task9-runner.ts';
import type {
  Phase698Task9AdmissionCapability,
  Phase698Task9ReservationAdmissionCapability,
} from './phase-6-9-8-retriever-final-response-task9-source-admission.ts';

export const PHASE_6_9_8_TASK9C_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-task9c-cli-v1' as const;
export const PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_8_TASK9C_CRASH_SEAL_CONFIRMATION =
  'I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_CRASH_ONLY_ONCE' as const;
export const PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_DATA_BOUNDARY_ACCEPTED' as const;
export const PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ACCEPTANCE =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_TASK9C_APPROVAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_APPROVED' as const;
export const PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_REWRITE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_FINAL_RESPONSE_DEEPSEEK_API_KEY' as const;
export const PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TASK9C_QWEN_API_KEY' as const;
export const PHASE_6_9_8_TASK9C_QWEN_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1' as const;

type SourceAdmission = Readonly<{
  source: Phase698Task9Source;
  capability: Phase698Task9AdmissionCapability;
  reservationCapability: Phase698Task9ReservationAdmissionCapability;
}>;

export type Phase698Task9CliCoreInput = Readonly<{
  args: readonly string[];
  root: string;
  authorizationEnv: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}>;

export type Phase698Task9CliCorePorts = Readonly<{
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
    reservationCapability: Phase698Task9ReservationAdmissionCapability;
  }): Promise<Phase698Task9Reservation>;
  createHarness(input: {
    runId: string;
    credentials: Phase698Task9LiveCredentials;
  }): Phase698Task9Harness;
  run(input: RunPhase698Task9Input): Promise<Readonly<Phase698Task9Report>>;
  validate(input: { root: string }): Promise<
    Readonly<{
      ok: boolean;
      runId: string | null;
      gate?: Phase698Task9Report['gate'] | null;
      qualityAuthority?: string | null;
      journalRecords?: number;
      finalJournalEvent?: string | null;
      reportLogicalSha256?: string | null;
      physicalArtifactSha256?: string | null;
    }>
  >;
  seal(input: { root: string }): Promise<Phase698Task9CrashSealResult>;
  randomUUID(): string;
  now(): number;
  write(line: string): void;
}>;

export async function executePhase698Task9CliCore(
  rawInput: Phase698Task9CliCoreInput,
  rawPorts: Phase698Task9CliCorePorts,
): Promise<0 | 1> {
  const input = readInput(rawInput);
  const ports = readPorts(rawPorts);
  if (!input || !ports) return 1;

  const blocked = (
    code: string,
    details: Readonly<Record<string, unknown>> = Object.freeze({}),
  ) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_TASK9C_CLI_VERSION,
        ok: false,
        evidenceSealed: false,
        qualityAuthority: 'none',
        code,
        ...details,
      }),
    );
    return 1 as const;
  };

  if (hasExactArgument(input.args, PHASE_6_9_8_TASK9C_CRASH_SEAL_CONFIRMATION)) {
    try {
      const result = await ports.seal({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_TASK9C_CLI_VERSION,
          qualityAuthority: 'none',
          providerCalls: 0,
          evidenceSealed: result.ok,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_seal_failed', { providerCalls: 0 });
    }
  }
  if (!hasExactArgument(input.args, PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION)) {
    return blocked('cli_argument_invalid', { providerCalls: 0, credentialReads: 0 });
  }
  if (isAborted(input.signal)) {
    return blocked('live_aborted_before_source', { providerCalls: 0, credentialReads: 0 });
  }

  let admission: SourceAdmission;
  try {
    admission = readSourceAdmission(ports.readSource(input.root));
  } catch {
    return blocked('source_admission_invalid', { providerCalls: 0, credentialReads: 0 });
  }
  if (isAborted(input.signal)) {
    return blocked('live_aborted_after_source', { providerCalls: 0, credentialReads: 0 });
  }

  try {
    ports.readDataBoundary(input.authorizationEnv);
  } catch {
    return blocked('data_boundary_not_accepted', { providerCalls: 0, credentialReads: 0 });
  }
  try {
    ports.readApproval(input.authorizationEnv);
  } catch {
    return blocked('live_not_authorized', { providerCalls: 0, credentialReads: 0 });
  }

  let credentials: Phase698Task9LiveCredentials;
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
      qwenBaseURL: PHASE_6_9_8_TASK9C_QWEN_BASE_URL,
    });
  } catch {
    return blocked('live_configuration_invalid', { providerCalls: 0, credentialReads });
  }
  if (isAborted(input.signal)) {
    return blocked('live_aborted_before_reservation', { providerCalls: 0, credentialReads: 3 });
  }

  let runId: string;
  let createdAt: string;
  try {
    runId = z.string().uuid().parse(ports.randomUUID());
    createdAt = z.string().datetime({ offset: true }).parse(new Date(ports.now()).toISOString());
  } catch {
    return blocked('live_preflight_invalid', { providerCalls: 0, credentialReads: 3 });
  }

  let reservation: Phase698Task9Reservation;
  try {
    if (ports.authority !== 'controlled_live') throw new Error('production_authority_required');
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt,
      reservationCapability: admission.reservationCapability,
    });
  } catch {
    return blocked('live_once_already_consumed_or_evidence_io', {
      providerCalls: 0,
      credentialReads: 3,
    });
  }

  let report: Phase698Task9Report;
  try {
    const harness = ports.createHarness({ runId, credentials });
    if (harness.transportAuthority !== 'external_provider') {
      throw new Error('harness_authority_mismatch');
    }
    report = PHASE_6_9_8_TASK9_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        authority: 'controlled_live',
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
      report.execution.mode !== 'live' ||
      report.execution.credentialReads !== 3 ||
      canonicalPhase698Task9Json(report.source) !== canonicalPhase698Task9Json(admission.source)
    ) {
      throw new Error('report_authority_mismatch');
    }
  } catch {
    return blocked('live_runtime_or_evidence_io');
  }

  try {
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error('bundle_invalid');
    const passed = report.gate.passed;
    if (
      !safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_TASK9C_CLI_VERSION,
          ok: passed,
          evidenceSealed: true,
          authority: 'controlled_live',
          qualityAuthority: report.qualityAuthority,
          runId,
          gate: report.gate,
          execution: report.execution,
          caseCounts: report.caseCounts,
          guards: report.guards,
          providers: report.providers,
          rewrite: report.rewrite,
          finalResponse: report.finalResponse,
          latency: report.latency,
          safety: report.safety,
          journalRecords: validation.journalRecords ?? null,
          finalJournalEvent: validation.finalJournalEvent ?? null,
          reportLogicalSha256: validation.reportLogicalSha256 ?? null,
          artifactSha256: published.evidenceSha256,
        }),
      )
    ) {
      return 1;
    }
    return passed ? 0 : 1;
  } catch {
    return blocked('live_evidence_io');
  }
}

export function readPhase698Task9DataBoundary(
  env: Readonly<Record<string, string | undefined>>,
): true {
  if (
    readEnv(env, PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ENV) !==
    PHASE_6_9_8_TASK9C_DATA_BOUNDARY_ACCEPTANCE
  ) {
    throw new Error('PHASE_6_9_8_TASK9_DATA_BOUNDARY_INVALID');
  }
  return true;
}

export function readPhase698Task9Approval(env: Readonly<Record<string, string | undefined>>): true {
  if (readEnv(env, PHASE_6_9_8_TASK9C_APPROVAL_ENV) !== PHASE_6_9_8_TASK9C_EXACT_CONFIRMATION) {
    throw new Error('PHASE_6_9_8_TASK9_APPROVAL_INVALID');
  }
  return true;
}

export function readPhase698Task9Credential(
  env: Readonly<Record<string, string | undefined>>,
  key:
    | typeof PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV
    | typeof PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV
    | typeof PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV,
) {
  const value = readEnv(env, key);
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[\x21-\x7e]+$/u.test(value)
  ) {
    throw new Error('PHASE_6_9_8_TASK9_CREDENTIAL_INVALID');
  }
  return value;
}

function readInput(value: unknown): Phase698Task9CliCoreInput | null {
  const fields = readExactOwnData(value, ['args', 'authorizationEnv', 'root', 'signal']);
  if (
    !fields ||
    !Array.isArray(fields.args) ||
    fields.args.some((entry) => typeof entry !== 'string') ||
    !isRecord(fields.authorizationEnv) ||
    typeof fields.root !== 'string' ||
    fields.root.length === 0 ||
    !isAbortSignal(fields.signal)
  ) {
    return null;
  }
  return Object.freeze({
    args: Object.freeze(fields.args.map((entry) => String(entry))),
    authorizationEnv: fields.authorizationEnv as Record<string, string | undefined>,
    root: fields.root,
    signal: fields.signal,
  });
}

function readPorts(value: unknown): Phase698Task9CliCorePorts | null {
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
  ) {
    return null;
  }
  return Object.freeze(fields as unknown as Phase698Task9CliCorePorts);
}

function readSourceAdmission(value: unknown): SourceAdmission {
  const fields = readExactOwnData(value, ['capability', 'reservationCapability', 'source']);
  if (!fields) throw new Error('PHASE_6_9_8_TASK9_SOURCE_ADMISSION_INVALID');
  const capability = readCapability(
    fields.capability,
    'phase-6.9.8-retriever-final-response-task9-admission-capability-v1',
  );
  const reservationCapability = readCapability(
    fields.reservationCapability,
    'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1',
  );
  return Object.freeze({
    source: PHASE_6_9_8_TASK9_SOURCE_SCHEMA.parse(fields.source),
    capability: capability as Phase698Task9AdmissionCapability,
    reservationCapability: reservationCapability as Phase698Task9ReservationAdmissionCapability,
  });
}

function readCapability(value: unknown, version: string) {
  const fields = readExactOwnData(value, ['version']);
  if (!fields || fields.version !== version) {
    throw new Error('PHASE_6_9_8_TASK9_SOURCE_ADMISSION_INVALID');
  }
  return value;
}

function readEnv(env: Readonly<Record<string, string | undefined>>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    if (!descriptor || !('value' in descriptor)) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function readExactOwnData(value: unknown, expectedKeys: readonly string[]) {
  try {
    if (!isRecord(value)) return null;
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

function safeWrite(write: (line: string) => void, line: string) {
  try {
    write(line);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
