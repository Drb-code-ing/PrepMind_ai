import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_CREDENTIAL_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_CREDENTIAL_ENV,
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_REWRITE_CREDENTIAL_ENV,
  executePhase698ArchitectureRecoveryR5CliCore,
  readPhase698ArchitectureRecoveryR5Approval,
  readPhase698ArchitectureRecoveryR5Credential,
  readPhase698ArchitectureRecoveryR5DataBoundary,
  type Phase698ArchitectureRecoveryR5CliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r5-cli-core.ts';
import {
  reservePhase698ArchitectureRecoveryAttempt,
  sealPhase698ArchitectureRecoveryInterruptedAttempt,
  validatePhase698ArchitectureRecoveryBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';
import { createPhase698ArchitectureRecoveryR5LiveHarness } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r5-live.ts';
import { runPhase698ArchitectureRecoveryR3 } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import { inspectPhase698ArchitectureRecoverySourceAdmission } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase698ArchitectureRecoveryR5CliCorePorts = Object.freeze({
  authority: 'controlled_live' as const,
  readSource(root) {
    const admission = inspectPhase698ArchitectureRecoverySourceAdmission(root);
    if (!admission.ok) throw new Error('R5_SOURCE_ADMISSION_INVALID');
    return Object.freeze({
      source: admission.source,
      capability: admission.capability,
      reservationCapability: admission.reservationCapability,
    });
  },
  readDataBoundary: readPhase698ArchitectureRecoveryR5DataBoundary,
  readApproval: readPhase698ArchitectureRecoveryR5Approval,
  readRewriteCredential: (env) =>
    readPhase698ArchitectureRecoveryR5Credential(
      env,
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_REWRITE_CREDENTIAL_ENV,
    ),
  readFinalResponseCredential: (env) =>
    readPhase698ArchitectureRecoveryR5Credential(
      env,
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_FINAL_RESPONSE_CREDENTIAL_ENV,
    ),
  readQwenCredential: (env) =>
    readPhase698ArchitectureRecoveryR5Credential(
      env,
      PHASE_6_9_8_ARCHITECTURE_RECOVERY_R5_QWEN_CREDENTIAL_ENV,
    ),
  reserve: reservePhase698ArchitectureRecoveryAttempt,
  createHarness: createPhase698ArchitectureRecoveryR5LiveHarness,
  run: runPhase698ArchitectureRecoveryR3,
  validate: validatePhase698ArchitectureRecoveryBundle,
  seal: sealPhase698ArchitectureRecoveryInterruptedAttempt,
  randomUUID,
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

export type Phase698ArchitectureRecoveryR5CliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

/** Fixed R5 production entry. It accepts argv and AbortSignal only. */
export function runPhase698ArchitectureRecoveryR5Cli(
  rawInput: Phase698ArchitectureRecoveryR5CliInput,
) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase698ArchitectureRecoveryR5CliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase698ArchitectureRecoveryR5CliInput | null {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      keys.some((key) => typeof key !== 'string' || !['args', 'signal'].includes(key))
    )
      return null;
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
    )
      return null;
    return Object.freeze({ args: Object.freeze(args.value.map(String)), signal: signal.value });
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
  process.exitCode = await runPhase698ArchitectureRecoveryR5Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
