import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS,
  runPhase697ArchitectureRecoveryProxyPreflight,
} from '@repo/ai';
import { runPhase698TransportEvidenceT2Static } from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
  inspectPhase698TransportEvidenceT3SourceAdmission,
  readPhase698TransportEvidenceT3Approval,
  readPhase698TransportEvidenceT3DataBoundary,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';
import {
  executePhase698TransportEvidenceT3ControlledCliCore,
  type Phase698TransportEvidenceT3ControlledCliPorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-cli-core.ts';
import {
  reservePhase698TransportEvidenceT3ControlledAttempt,
  validatePhase698TransportEvidenceT3ControlledBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-durability.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_QWEN_BASE_URL,
  runPhase698TransportEvidenceT3ControlledLive,
  type Phase698TransportEvidenceT3ControlledCredentials,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-live.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const REWRITE_KEY =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_REWRITE_DEEPSEEK_API_KEY';
const FINAL_KEY =
  'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_FINAL_RESPONSE_DEEPSEEK_API_KEY';
const QWEN_KEY = 'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_QWEN_API_KEY';

const PRODUCTION_PORTS: Phase698TransportEvidenceT3ControlledCliPorts = Object.freeze({
  readSource(root) {
    return inspectPhase698TransportEvidenceT3SourceAdmission(root);
  },
  readT2Gate() {
    return runPhase698TransportEvidenceT2Static();
  },
  runProxyPreflight: async ({ env, signal, nonce }) => {
    const result = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: snapshotProxyEnv(env), signal },
      { probeLoopbackListener },
    );
    return Object.freeze({
      nonce,
      ok: result.ok,
      code: result.code,
      mode: result.mode,
      listener: result.listener,
      listenerProbeCalls: result.listenerProbeCalls,
      providerCalls: result.providerCalls,
    });
  },
  readDataBoundary: readPhase698TransportEvidenceT3DataBoundary,
  readApproval: readPhase698TransportEvidenceT3Approval,
  readCredentials: readCredentialsFromRootEnv,
  reserve: reservePhase698TransportEvidenceT3ControlledAttempt,
  runLive: runPhase698TransportEvidenceT3ControlledLive,
  validate: validatePhase698TransportEvidenceT3ControlledBundle,
  randomUUID: () => crypto.randomUUID(),
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

export async function runPhase698TransportEvidenceT3ControlledCli(
  input: Readonly<{ args: readonly string[]; signal: AbortSignal }>,
) {
  if (!readCliInput(input)) return 1 as const;
  return executePhase698TransportEvidenceT3ControlledCliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      proxyEnv: snapshotProxyEnv(process.env),
      authorizationEnv: authorizationEnvironment(),
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function authorizationEnvironment(): Readonly<Record<string, string | undefined>> {
  return Object.freeze({
    [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV]:
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE,
    [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV]:
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
    [REWRITE_KEY]: process.env[REWRITE_KEY],
    [FINAL_KEY]: process.env[FINAL_KEY],
    [QWEN_KEY]: process.env[QWEN_KEY],
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    Qwen_API_KEY: process.env.Qwen_API_KEY,
    QWEN_API_KEY: process.env.QWEN_API_KEY,
  });
}

function readCredentialsFromRootEnv(
  env: Readonly<Record<string, string | undefined>>,
): Phase698TransportEvidenceT3ControlledCredentials {
  const rewriteDeepseekApiKey = readCredential(env, REWRITE_KEY, ['DEEPSEEK_API_KEY']);
  const finalResponseDeepseekApiKey = readCredential(env, FINAL_KEY, ['DEEPSEEK_API_KEY']);
  const qwenApiKey = readCredential(env, QWEN_KEY, ['Qwen_API_KEY', 'QWEN_API_KEY']);
  return Object.freeze({
    rewriteDeepseekApiKey,
    finalResponseDeepseekApiKey,
    qwenApiKey,
    qwenBaseURL: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_QWEN_BASE_URL,
  });
}

function readCredential(
  env: Readonly<Record<string, string | undefined>>,
  preferred: string,
  fallbacks: readonly string[],
) {
  const candidates = [preferred, ...fallbacks];
  for (const key of candidates) {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    const value = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    if (
      typeof value === 'string' &&
      value === value.trim() &&
      value.length >= 1 &&
      value.length <= 512 &&
      /^[\x21-\x7e]+$/u.test(value)
    ) {
      return value;
    }
  }
  throw new Error('T3_CREDENTIAL_INVALID');
}

function snapshotProxyEnv(env: Readonly<Record<string, unknown>>) {
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
    const descriptor = Reflect.getOwnPropertyDescriptor(env, key);
    if (descriptor && 'value' in descriptor) result[key] = descriptor.value;
  }
  return Object.freeze(result);
}

async function probeLoopbackListener(input: {
  host: '127.0.0.1' | '::1';
  port: number;
  timeoutMs: typeof PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_TIMEOUT_MS;
  signal: AbortSignal;
}) {
  if (input.signal.aborted) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const socket = connect({ host: input.host, port: input.port });
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.signal.removeEventListener('abort', abort);
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), input.timeoutMs);
    const abort = () => finish(false);
    input.signal.addEventListener('abort', abort, { once: true });
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function readCliInput(
  value: unknown,
): value is Readonly<{ args: readonly string[]; signal: AbortSignal }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2 ||
    keys.some((key) => typeof key !== 'string' || !['args', 'signal'].includes(key))
  )
    return false;
  const args = Reflect.getOwnPropertyDescriptor(value, 'args');
  const signal = Reflect.getOwnPropertyDescriptor(value, 'signal');
  return (
    !!args &&
    'value' in args &&
    Array.isArray(args.value) &&
    args.value.every((item) => typeof item === 'string') &&
    !!signal &&
    'value' in signal &&
    signal.value instanceof AbortSignal
  );
}

if (import.meta.main) {
  process.exitCode = await runPhase698TransportEvidenceT3ControlledCli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
