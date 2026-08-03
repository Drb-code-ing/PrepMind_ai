import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  consumePhase697SmallSampleProxyAttestation,
  readPhase697SmallSampleApproval,
  readPhase697SmallSampleCredential,
  readPhase697SmallSampleSource,
  runPhase697SmallSampleProductionProxyPreflight,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-authority.ts';
import {
  executePhase697SmallSampleCliCore,
  type Phase697SmallSampleCliCorePorts,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-cli-core.ts';
import {
  reservePhase697SmallSampleAttempt,
  sealPhase697SmallSampleInterruptedAttempt,
  validatePhase697SmallSampleBundle,
} from '../src/evals/phase-6-9-tutor-organizer-small-sample-durability.ts';
import { createPhase697SmallSampleLiveHarness } from '../src/evals/phase-6-9-tutor-organizer-small-sample-live.ts';
import { runPhase697TutorOrganizerSmallSample } from '../src/evals/run-phase-6-9-tutor-organizer-small-sample.ts';

export type Phase697SmallSampleCliInput = Readonly<{
  args: readonly string[];
  signal: AbortSignal;
}>;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase697SmallSampleCliCorePorts = Object.freeze({
  authority: 'controlled_live' as const,
  preflight: runPhase697SmallSampleProductionProxyPreflight,
  consumeProxyAttestation: (value) =>
    consumePhase697SmallSampleProxyAttestation(value, 'controlled_live'),
  readSource: readPhase697SmallSampleSource,
  readApproval: readPhase697SmallSampleApproval,
  readCredential: readPhase697SmallSampleCredential,
  reserve: reservePhase697SmallSampleAttempt,
  createHarness: ({ runId, credential }) =>
    createPhase697SmallSampleLiveHarness({ runId, apiKey: credential }),
  run: runPhase697TutorOrganizerSmallSample,
  validate: validatePhase697SmallSampleBundle,
  seal: sealPhase697SmallSampleInterruptedAttempt,
  randomUUID,
  now: Date.now,
  write: (line) => process.stdout.write(`${line}\n`),
});

/**
 * Fixed production entry: callers may supply only argv and an AbortSignal.
 * Root/env/clock/UUID/writer/model/URL/fetch/retry/resume ports are closed.
 */
export function runPhase697SmallSampleCli(rawInput: Phase697SmallSampleCliInput) {
  const input = readInput(rawInput);
  if (!input) return Promise.resolve(1 as const);
  return executePhase697SmallSampleCliCore(
    {
      args: input.args,
      root: REPOSITORY_ROOT,
      authorizationEnv: process.env,
      signal: input.signal,
    },
    PRODUCTION_PORTS,
  );
}

function readInput(value: unknown): Phase697SmallSampleCliInput | null {
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
  process.exitCode = await runPhase697SmallSampleCli({
    args: process.argv.slice(2),
    signal: new AbortController().signal,
  });
}
