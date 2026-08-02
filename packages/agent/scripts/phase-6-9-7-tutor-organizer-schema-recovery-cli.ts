import { fileURLToPath } from 'node:url';

import {
  executePhase697SchemaRecoveryCliCore,
  type Phase697SchemaRecoveryCliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-cli-core.ts';
import {
  sealPhase697SchemaRecoveryInterruptedAttempt,
  validatePhase697SchemaRecoveryBundle,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';

export type Phase697SchemaRecoveryCliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ZERO_PROVIDER_PORTS: Phase697SchemaRecoveryCliCorePorts = Object.freeze({
  validate: validatePhase697SchemaRecoveryBundle,
  seal: sealPhase697SchemaRecoveryInterruptedAttempt,
  write: (line) => process.stdout.write(`${line}\n`),
});

/** Fixed zero-provider entry: callers may supply only argv and AbortSignal. */
export function runPhase697SchemaRecoveryCli(rawInput: Phase697SchemaRecoveryCliInput) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase697SchemaRecoveryCliCore(
    { args: input.args, root: REPOSITORY_ROOT, signal: input.signal },
    ZERO_PROVIDER_PORTS,
  );
}

function readInput(value: unknown): Phase697SchemaRecoveryCliInput | null {
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
  process.exitCode = await runPhase697SchemaRecoveryCli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
