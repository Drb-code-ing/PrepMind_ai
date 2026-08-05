import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV,
  PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV,
  PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV,
  executePhase698Task9CliCore,
  readPhase698Task9Approval,
  readPhase698Task9Credential,
  readPhase698Task9DataBoundary,
  type Phase698Task9CliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-cli-core.ts';
import {
  reservePhase698Task9Attempt,
  sealPhase698Task9InterruptedAttempt,
  validatePhase698Task9Bundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-durability.ts';
import { createPhase698Task9LiveHarness } from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';
import { runPhase698Task9 } from '../src/evals/phase-6-9-8-retriever-final-response-task9-runner.ts';
import { inspectPhase698Task9SourceAdmission } from '../src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts';

export type Phase698Task9CliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase698Task9CliCorePorts = Object.freeze({
  authority: 'controlled_live' as const,
  readSource(root) {
    const admission = inspectPhase698Task9SourceAdmission(root);
    if (!admission.ok) throw new Error('PHASE_6_9_8_TASK9_SOURCE_ADMISSION_INVALID');
    return Object.freeze({
      source: admission.source,
      capability: admission.capability,
      reservationCapability: admission.reservationCapability,
    });
  },
  readDataBoundary: readPhase698Task9DataBoundary,
  readApproval: readPhase698Task9Approval,
  readRewriteCredential: (env) =>
    readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_REWRITE_CREDENTIAL_ENV),
  readFinalResponseCredential: (env) =>
    readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_FINAL_RESPONSE_CREDENTIAL_ENV),
  readQwenCredential: (env) =>
    readPhase698Task9Credential(env, PHASE_6_9_8_TASK9C_QWEN_CREDENTIAL_ENV),
  reserve: reservePhase698Task9Attempt,
  createHarness: createPhase698Task9LiveHarness,
  run: runPhase698Task9,
  validate: validatePhase698Task9Bundle,
  seal: sealPhase698Task9InterruptedAttempt,
  randomUUID,
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

/** Fixed production entry. Callers can provide argv and AbortSignal only. */
export function runPhase698Task9Cli(rawInput: Phase698Task9CliInput) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase698Task9CliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase698Task9CliInput | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      keys.some((key) => typeof key !== 'string' || (key !== 'args' && key !== 'signal'))
    ) {
      return null;
    }
    const args = Reflect.getOwnPropertyDescriptor(value, 'args');
    const signal = Reflect.getOwnPropertyDescriptor(value, 'signal');
    if (
      !args ||
      !('value' in args) ||
      !Array.isArray(args.value) ||
      args.value.some((entry) => typeof entry !== 'string') ||
      !signal ||
      !('value' in signal) ||
      !isAbortSignal(signal.value)
    ) {
      return null;
    }
    return Object.freeze({
      args: Object.freeze(args.value.map((entry) => String(entry))),
      signal: signal.value,
    });
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

if (import.meta.main) {
  process.exitCode = await runPhase698Task9Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
