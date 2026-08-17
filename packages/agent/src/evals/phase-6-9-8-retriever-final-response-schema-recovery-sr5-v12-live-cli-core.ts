import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
  type Phase697ArchitectureRecoveryProxyPreflightResult,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVAL_ENV,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_CREDENTIAL_ENV,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_BASE_URL,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_CREDENTIAL_ENV,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVER_ARGUMENT,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_CREDENTIAL_ENV,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-contract.ts';
import {
  admitPhase698RetrieverSchemaRecoverySr5ControlledLive,
  type Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability,
  type Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord,
  type Phase698RetrieverSchemaRecoverySr5LiveReservationCapability,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-source-admission.ts';
import type { Phase698RetrieverSchemaRecoverySr5LiveSource as Phase698RetrieverSchemaRecoverySr5Source } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-source-schema.ts';
import {
  reservePhase698RetrieverSchemaRecoverySr5LiveAttempt,
  sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttempt,
  validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
  type Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult,
  type Phase698RetrieverSchemaRecoverySr5LiveReservation,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-durability.ts';
import {
  createPhase698Task9LiveHarness,
  type Phase698Task9LiveCredentials,
} from './phase-6-9-8-retriever-final-response-task9-live.ts';
import {
  runPhase698RetrieverSchemaRecoverySr5ControlledLive,
  type Phase698RetrieverSchemaRecoverySr5LiveHarness,
  type RunPhase698RetrieverSchemaRecoverySr5LiveInput,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-v12-live-runner.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-cli-v3' as const;

const PROXY_PREFLIGHT_RESULT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION),
    ok: z.boolean(),
    code: z.enum(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_CODES),
    mode: z.enum(['direct', 'loopback_proxy', 'undetermined']),
    configuredProxyVariables: z.number().int().min(0).max(6),
    listener: z.enum(['not_required', 'listening', 'unavailable', 'probe_failed', 'aborted']),
    listenerProbeCalls: z.union([z.literal(0), z.literal(1)]),
    providerCalls: z.literal(0),
  })
  .strict();

export type Phase698RetrieverSchemaRecoverySr5LiveCliInput = Readonly<{
  args: readonly string[];
  root: string;
  proxyEnv: Readonly<Record<string, unknown>>;
  authorizationEnv: Readonly<Record<string, string | undefined>>;
  signal: AbortSignal;
}>;

type LiveAdmission = Readonly<{
  source: Phase698RetrieverSchemaRecoverySr5Source;
  admission: Phase698RetrieverSchemaRecoverySr5LiveAdmissionRecord;
  capability: Phase698RetrieverSchemaRecoverySr5LiveAdmissionCapability;
  reservationCapability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability;
}>;

export type Phase698RetrieverSchemaRecoverySr5LiveCliPorts = Readonly<{
  authority: 'controlled_live';
  runProxyPreflight(input: {
    env: Readonly<Record<string, unknown>>;
    signal: AbortSignal;
  }): Promise<unknown>;
  readAdmission(input: {
    root: string;
    dataBoundaryConfirmation: string;
    authorizationConfirmation: string;
  }): LiveAdmission;
  loadCredentialEnv(root: string): Promise<Readonly<Record<string, string | undefined>>>;
  readCredential(env: Readonly<Record<string, string | undefined>>, key: string): string;
  reserve(input: {
    root: string;
    runId: string;
    createdAt: string;
    admissionAuthority: 'git_verified_live';
    reservationCapability: Phase698RetrieverSchemaRecoverySr5LiveReservationCapability;
  }): Promise<Phase698RetrieverSchemaRecoverySr5LiveReservation>;
  createHarness(input: {
    runId: string;
    credentials: Phase698Task9LiveCredentials;
  }): Phase698RetrieverSchemaRecoverySr5LiveHarness;
  run(input: RunPhase698RetrieverSchemaRecoverySr5LiveInput): Promise<unknown>;
  validate(input: {
    root: string;
  }): ReturnType<typeof validatePhase698RetrieverSchemaRecoverySr5LiveBundle>;
  recover(input: { root: string }): Promise<Phase698RetrieverSchemaRecoverySr5LiveCrashSealResult>;
  randomUUID(): string;
  now(): number;
  write(line: string): void;
}>;

export async function executePhase698RetrieverSchemaRecoverySr5LiveCliCore(
  rawInput: Phase698RetrieverSchemaRecoverySr5LiveCliInput,
  rawPorts?: Partial<Phase698RetrieverSchemaRecoverySr5LiveCliPorts>,
): Promise<0 | 1 | 2> {
  const input = normalizeInput(rawInput);
  if (!input) return 2;
  const ports = createPorts(rawPorts);
  const blocked = (code: string, details: Record<string, unknown> = {}) => {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION,
        ok: false,
        authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
        qualityAuthority: 'none',
        providerCalls: 0,
        credentialReads: 0,
        businessWrites: 0,
        formalEvidence: 0,
        ...details,
        code,
      }),
    );
    return 1 as const;
  };

  if (input.args.length === 1 && input.args[0] === '--help') {
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION,
        mode: 'controlled_live',
        live: true,
        commands: [
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT,
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT,
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVER_ARGUMENT,
        ],
        retry: false,
        replay: false,
        backfill: false,
      }),
    );
    return 0;
  }
  if (
    input.args.length === 1 &&
    input.args[0] === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT
  ) {
    try {
      const result = await ports.validate({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION,
          operation: 'validate',
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('bundle_validation_failed');
    }
  }
  if (
    input.args.length === 1 &&
    input.args[0] === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RECOVER_ARGUMENT
  ) {
    try {
      const result = await ports.recover({ root: input.root });
      safeWrite(
        ports.write,
        JSON.stringify({
          version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION,
          operation: 'recover',
          authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
          ...result,
        }),
      );
      return result.ok ? 0 : 1;
    } catch {
      return blocked('crash_only_recovery_failed');
    }
  }
  if (
    input.args.length !== 1 ||
    input.args[0] !== PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT
  ) {
    return blocked('cli_argument_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_before_admission');

  const boundary = readEnv(
    input.authorizationEnv,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_ENV,
  );
  const approval = readEnv(
    input.authorizationEnv,
    PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVAL_ENV,
  );
  if (boundary !== PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_DATA_BOUNDARY_CONFIRMATION) {
    return blocked('data_boundary_not_accepted');
  }
  if (approval !== PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORIZATION_CONFIRMATION) {
    return blocked('live_not_authorized');
  }
  let admission: LiveAdmission;
  try {
    admission = ports.readAdmission({
      root: input.root,
      dataBoundaryConfirmation: boundary,
      authorizationConfirmation: approval,
    });
  } catch {
    return blocked('source_admission_invalid');
  }
  if (input.signal.aborted) return blocked('aborted_after_source');

  let proxyResult: Phase697ArchitectureRecoveryProxyPreflightResult;
  try {
    proxyResult = PROXY_PREFLIGHT_RESULT_SCHEMA.parse(
      await ports.runProxyPreflight({ env: input.proxyEnv, signal: input.signal }),
    );
  } catch {
    return blocked('proxy_preflight_not_ready');
  }
  if (!proxyResult.ok) {
    return blocked('proxy_preflight_not_ready', {
      proxy: projectProxyPreflightDiagnostic(proxyResult),
    });
  }
  let proxy: Readonly<{ code: 'direct_ready' | 'loopback_proxy_ready'; listenerProbeCalls: 0 | 1 }>;
  try {
    proxy = parseReadyProxy(proxyResult);
  } catch {
    return blocked('proxy_preflight_not_ready');
  }
  if (input.signal.aborted) return blocked('aborted_after_proxy_preflight');

  let credentials: Phase698Task9LiveCredentials;
  let credentialReads = 0;
  try {
    const credentialEnv = await ports.loadCredentialEnv(input.root);
    const rewriteDeepseekApiKey = ports.readCredential(
      credentialEnv,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_CREDENTIAL_ENV,
    );
    credentialReads += 1;
    const finalResponseDeepseekApiKey = ports.readCredential(
      credentialEnv,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_CREDENTIAL_ENV,
    );
    credentialReads += 1;
    const qwenApiKey = ports.readCredential(
      credentialEnv,
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_CREDENTIAL_ENV,
    );
    credentialReads += 1;
    credentials = Object.freeze({
      rewriteDeepseekApiKey,
      finalResponseDeepseekApiKey,
      qwenApiKey,
      qwenBaseURL: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_QWEN_BASE_URL,
    });
  } catch {
    return blocked('live_configuration_invalid', { credentialReads });
  }
  if (input.signal.aborted) return blocked('aborted_before_reservation', { credentialReads });

  let runId: string;
  let reservation: Phase698RetrieverSchemaRecoverySr5LiveReservation;
  try {
    runId = z.string().uuid().parse(ports.randomUUID());
    const createdAt = z
      .string()
      .datetime({ offset: true })
      .parse(new Date(ports.now()).toISOString());
    reservation = await ports.reserve({
      root: input.root,
      runId,
      createdAt,
      admissionAuthority: 'git_verified_live',
      reservationCapability: admission.reservationCapability,
    });
  } catch {
    return blocked('live_once_already_consumed_or_evidence_io', {
      credentialReads,
      reservationRunId: runId!,
      reservationState: 'indeterminate',
      crashOnlySealRequired: true,
      formalEvidence: null,
    });
  }

  try {
    const harness = ports.createHarness({ runId, credentials });
    if (harness.transportAuthority !== 'external_provider')
      throw new Error('harness_authority_mismatch');
    const report = PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA.parse(
      await ports.run({
        runId,
        repositoryRoot: input.root,
        admissionAuthority: 'git_verified_live',
        admissionCapability: admission.capability,
        harness,
        lifecycle: reservation.lifecycle,
        signal: input.signal,
      }),
    );
    const published = await reservation.publishArtifact(report);
    const validation = await ports.validate({ root: input.root });
    if (!validation.ok || validation.runId !== runId) throw new Error('bundle_invalid');
    safeWrite(
      ports.write,
      JSON.stringify({
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CLI_VERSION,
        ok: report.gate.passed,
        evidenceSealed: true,
        authority: report.authority,
        qualityAuthority: report.qualityAuthority,
        runId,
        gate: report.gate,
        execution: report.execution,
        caseCounts: report.caseCounts,
        providers: report.providers,
        rewrite: report.rewrite,
        finalResponse: report.finalResponse,
        budget: report.budget,
        proxy: {
          code: proxy.code,
          listenerProbeCalls: proxy.listenerProbeCalls,
          providerCalls: 0,
        },
        journalRecords: validation.journalRecords,
        reportLogicalSha256: validation.reportLogicalSha256,
        artifactSha256: published.evidenceSha256,
      }),
    );
    return report.gate.passed ? 0 : 1;
  } catch {
    return blocked('live_runtime_or_evidence_io', {
      credentialReads,
      reservationConsumed: true,
      reservationRunId: runId,
      crashOnlySealRequired: true,
      formalEvidence: 1,
    });
  }
}

function createPorts(
  overrides: Partial<Phase698RetrieverSchemaRecoverySr5LiveCliPorts> | undefined,
): Phase698RetrieverSchemaRecoverySr5LiveCliPorts {
  return Object.freeze({
    authority: 'controlled_live' as const,
    runProxyPreflight:
      overrides?.runProxyPreflight ??
      (async () => {
        throw new Error('PROXY_PREFLIGHT_PORT_NOT_BOUND');
      }),
    readAdmission:
      overrides?.readAdmission ??
      ((value: Parameters<Phase698RetrieverSchemaRecoverySr5LiveCliPorts['readAdmission']>[0]) => {
        const result = admitPhase698RetrieverSchemaRecoverySr5ControlledLive({
          repositoryRoot: value.root,
          dataBoundaryConfirmation: value.dataBoundaryConfirmation,
          authorizationConfirmation: value.authorizationConfirmation,
        });
        if (!result.ok) throw new Error(result.reasonCode);
        return result;
      }),
    loadCredentialEnv:
      overrides?.loadCredentialEnv ?? readPhase698RetrieverSchemaRecoverySr5RootCredentialEnv,
    readCredential: overrides?.readCredential ?? readCredential,
    reserve: overrides?.reserve ?? reservePhase698RetrieverSchemaRecoverySr5LiveAttempt,
    createHarness: overrides?.createHarness ?? createPhase698Task9LiveHarness,
    run: overrides?.run ?? runPhase698RetrieverSchemaRecoverySr5ControlledLive,
    validate: overrides?.validate ?? validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
    recover: overrides?.recover ?? sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttempt,
    randomUUID: overrides?.randomUUID ?? randomUUID,
    now: overrides?.now ?? Date.now,
    write: overrides?.write ?? ((line: string) => process.stdout.write(`${line}\n`)),
  });
}

function normalizeInput(value: unknown): Phase698RetrieverSchemaRecoverySr5LiveCliInput | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const args = Reflect.getOwnPropertyDescriptor(value, 'args');
  const root = Reflect.getOwnPropertyDescriptor(value, 'root');
  const proxyEnv = Reflect.getOwnPropertyDescriptor(value, 'proxyEnv');
  const authorizationEnv = Reflect.getOwnPropertyDescriptor(value, 'authorizationEnv');
  const signal = Reflect.getOwnPropertyDescriptor(value, 'signal');
  if (
    !args ||
    !('value' in args) ||
    !Array.isArray(args.value) ||
    args.value.some((v) => typeof v !== 'string')
  )
    return null;
  if (!root || !('value' in root) || typeof root.value !== 'string' || root.value.length === 0)
    return null;
  if (
    !proxyEnv ||
    !('value' in proxyEnv) ||
    typeof proxyEnv.value !== 'object' ||
    proxyEnv.value === null
  )
    return null;
  if (
    !authorizationEnv ||
    !('value' in authorizationEnv) ||
    typeof authorizationEnv.value !== 'object' ||
    authorizationEnv.value === null
  )
    return null;
  if (!signal || !('value' in signal) || !isAbortSignal(signal.value)) return null;
  return Object.freeze({
    args: Object.freeze(args.value.slice()),
    root: root.value,
    proxyEnv: proxyEnv.value as Record<string, unknown>,
    authorizationEnv: authorizationEnv.value as Record<string, string | undefined>,
    signal: signal.value,
  });
}

function parseReadyProxy(value: Phase697ArchitectureRecoveryProxyPreflightResult): Readonly<{
  code: 'direct_ready' | 'loopback_proxy_ready';
  listenerProbeCalls: 0 | 1;
}> {
  if (
    value.ok !== true ||
    (value.code !== 'direct_ready' && value.code !== 'loopback_proxy_ready') ||
    (value.code === 'direct_ready' &&
      (value.mode !== 'direct' ||
        value.configuredProxyVariables !== 0 ||
        value.listener !== 'not_required' ||
        value.listenerProbeCalls !== 0)) ||
    (value.code === 'loopback_proxy_ready' &&
      (value.mode !== 'loopback_proxy' ||
        value.configuredProxyVariables < 1 ||
        value.listener !== 'listening' ||
        value.listenerProbeCalls !== 1))
  )
    throw new Error('proxy_invalid');
  return Object.freeze({
    code: value.code,
    listenerProbeCalls: value.listenerProbeCalls,
  });
}

function projectProxyPreflightDiagnostic(value: Phase697ArchitectureRecoveryProxyPreflightResult) {
  return Object.freeze({
    code: value.code,
    mode: value.mode,
    configuredProxyVariables: value.configuredProxyVariables,
    listener: value.listener,
    listenerProbeCalls: value.listenerProbeCalls,
    providerCalls: 0 as const,
  });
}

/**
 * Selectively reads only the SR5 credential aliases after all admission gates.
 * Bun's automatic dotenv loading is disabled by the package script; this
 * explicit parser is the sole production root-.env access for the Live path.
 */
export async function readPhase698RetrieverSchemaRecoverySr5RootCredentialEnv(
  repositoryRoot: string,
): Promise<Readonly<Record<string, string | undefined>>> {
  const text = await readFile(resolve(repositoryRoot, '.env'), 'utf8');
  const allowed = new Set([
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY',
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY',
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_QWEN_API_KEY',
    'DEEPSEEK_API_KEY',
    'QWEN_API_KEY',
    'Qwen_API_KEY',
    'DASHSCOPE_API_KEY',
  ]);
  const values = new Map<string, string>();
  for (const rawLine of text.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match || !allowed.has(match[1])) continue;
    const value = unquote(match[2]);
    if (!validCredential(value)) throw new Error('credential_configuration_invalid');
    if (values.has(match[1])) throw new Error('credential_conflict');
    values.set(match[1], value);
  }
  const deepseek =
    values.get(
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY',
    ) ?? values.get('DEEPSEEK_API_KEY');
  const finalDeepseek =
    values.get(
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY',
    ) ?? values.get('DEEPSEEK_API_KEY');
  const qwenAliases = ['QWEN_API_KEY', 'Qwen_API_KEY', 'DASHSCOPE_API_KEY']
    .map((key) => values.get(key))
    .filter((value): value is string => value !== undefined);
  const qwenDedicated = values.get(
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_QWEN_API_KEY',
  );
  const qwen = qwenDedicated ?? qwenAliases[0];
  const deepseekGeneric = values.get('DEEPSEEK_API_KEY');
  const rewriteDedicated = values.get(
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY',
  );
  const finalDedicated = values.get(
    'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY',
  );
  if (
    !deepseek ||
    !finalDeepseek ||
    !qwen ||
    new Set(qwenAliases).size > 1 ||
    (qwenDedicated !== undefined && qwenAliases.length > 0) ||
    (rewriteDedicated !== undefined && deepseekGeneric !== undefined) ||
    (finalDedicated !== undefined && deepseekGeneric !== undefined)
  ) {
    throw new Error('credential_missing_or_conflict');
  }
  return Object.freeze({
    PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY: deepseek,
    PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY:
      finalDeepseek,
    PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_QWEN_API_KEY: qwen,
  });
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  )
    return trimmed.slice(1, -1);
  return trimmed;
}

function validCredential(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 512 &&
    value === value.trim() &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function readCredential(env: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = readEnv(env, key);
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    value.length < 1 ||
    value.length > 512 ||
    !/^[\x21-\x7e]+$/u.test(value)
  ) {
    throw new Error('credential_invalid');
  }
  return value;
}

function readEnv(env: Readonly<Record<string, string | undefined>>, key: string) {
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function safeWrite(write: (line: string) => void, line: string) {
  try {
    write(line);
  } catch {
    // Do not leak or alter a sealed result when stdout is unavailable.
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  try {
    return value instanceof AbortSignal;
  } catch {
    return false;
  }
}
