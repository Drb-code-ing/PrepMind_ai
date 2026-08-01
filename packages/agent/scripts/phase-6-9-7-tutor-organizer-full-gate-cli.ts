import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  consumePhase697FullGateProxyAttestation,
  readPhase697FullGateApproval,
  readPhase697FullGateCredential,
  readPhase697FullGateSource,
  runPhase697FullGateProductionProxyPreflight,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-authority.ts';
import {
  executePhase697FullGateCliCore,
  type Phase697FullGateCliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-cli-core.ts';
import {
  reservePhase697FullGateAttempt,
  sealPhase697FullGateInterruptedAttempt,
  validatePhase697FullGateBundle,
} from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';
import { createPhase697FullGateLiveHarness } from '../src/evals/phase-6-9-tutor-organizer-full-gate-live.ts';
import { runPhase697TutorOrganizerFullGate } from '../src/evals/run-phase-6-9-tutor-organizer-full-gate.ts';

export type Phase697FullGateCliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase697FullGateCliCorePorts = Object.freeze({
  authority: 'controlled_live' as const,
  preflight: runPhase697FullGateProductionProxyPreflight,
  consumeProxyAttestation: (value) =>
    consumePhase697FullGateProxyAttestation(value, 'controlled_live'),
  readSource: readPhase697FullGateSource,
  readApproval: readPhase697FullGateApproval,
  readCredential: readPhase697FullGateCredential,
  reserve: reservePhase697FullGateAttempt,
  createHarness: ({ runId, credential }) =>
    createPhase697FullGateLiveHarness({ runId, apiKey: credential }),
  run: runPhase697TutorOrganizerFullGate,
  validate: validatePhase697FullGateBundle,
  seal: sealPhase697FullGateInterruptedAttempt,
  randomUUID,
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * Fixed production entry: callers may supply only argv and an AbortSignal.
 * Root/env/clock/UUID/writer/model/URL/fetch/retry/resume ports are closed.
 */
export function runPhase697FullGateCli(rawInput: Phase697FullGateCliInput) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase697FullGateCliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase697FullGateCliInput | null {
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
  process.exitCode = await runPhase697FullGateCli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
