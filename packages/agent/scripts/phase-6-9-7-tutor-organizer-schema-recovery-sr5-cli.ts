import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  consumePhase697SchemaRecoverySr5ProxyAttestation,
  readPhase697SchemaRecoverySr5Approval,
  readPhase697SchemaRecoverySr5Credential,
  readPhase697SchemaRecoverySr5Source,
  runPhase697SchemaRecoverySr5ProductionProxyPreflight,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-authority.ts';
import {
  executePhase697SchemaRecoverySr5CliCore,
  type Phase697SchemaRecoverySr5CliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-cli-core.ts';
import {
  reservePhase697SchemaRecoveryControlledLiveAttempt,
  sealPhase697SchemaRecoveryInterruptedAttempt,
  validatePhase697SchemaRecoveryBundle,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import { createPhase697SchemaRecoverySr5LiveHarness } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-sr5-live.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';

export type Phase697SchemaRecoverySr5CliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase697SchemaRecoverySr5CliCorePorts = Object.freeze({
  authority: 'controlled_live' as const,
  preflight: runPhase697SchemaRecoverySr5ProductionProxyPreflight,
  consumeProxyAttestation: (value) =>
    consumePhase697SchemaRecoverySr5ProxyAttestation(value, 'controlled_live'),
  readSource: readPhase697SchemaRecoverySr5Source,
  readApproval: readPhase697SchemaRecoverySr5Approval,
  readCredential: readPhase697SchemaRecoverySr5Credential,
  reserve: reservePhase697SchemaRecoveryControlledLiveAttempt,
  createHarness: ({ runId, credential }) =>
    createPhase697SchemaRecoverySr5LiveHarness({ runId, apiKey: credential }),
  run: runPhase697TutorOrganizerSchemaRecovery,
  validate: validatePhase697SchemaRecoveryBundle,
  seal: sealPhase697SchemaRecoveryInterruptedAttempt,
  randomUUID,
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * Fixed production entry. Callers can supply argv and AbortSignal only; all
 * source, credential, model, URL, adapter, fetch and evidence ports are closed.
 */
export function runPhase697SchemaRecoverySr5Cli(rawInput: Phase697SchemaRecoverySr5CliInput) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase697SchemaRecoverySr5CliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase697SchemaRecoverySr5CliInput | null {
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
  process.exitCode = await runPhase697SchemaRecoverySr5Cli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
