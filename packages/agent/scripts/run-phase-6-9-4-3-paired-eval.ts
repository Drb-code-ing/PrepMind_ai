import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPhase6943InvalidRun,
  calculatePhase6943DatasetDigest,
  validatePhase6943Dataset,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';
import { createPhase6943MockRuntime } from '../src/evals/phase-6-9-router-verifier-mock-fixtures.ts';
import { runPhase6943PairedEval } from '../src/evals/run-phase-6-9-router-verifier-paired.ts';
import {
  createPhase6943LiveDependencies,
  executePhase6943Cli,
} from './phase-6-9-4-3-paired-cli.ts';

const [rawCommand, ...argv] = process.argv.slice(2);
const command =
  rawCommand === 'mock' ||
  rawCommand === 'mock-evidence' ||
  rawCommand === 'live'
    ? rawCommand
    : null;

if (command === null) {
  process.stdout.write(
    `${JSON.stringify(buildPhase6943InvalidRun('live', 'live_config_invalid'))}\n`,
  );
  process.exitCode = 3;
} else {
  const result = await executePhase6943Cli({
    command,
    argv,
    env: process.env,
    root: resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
    randomUUID,
    epochMs: Date.now,
    clocks: {
      epochMs: Date.now,
      monotonicMs: () => Math.floor(performance.now()),
    },
    fs,
    dependencies: {
      runPairedEval: runPhase6943PairedEval,
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: createPhase6943LiveDependencies,
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    },
  });
  process.stdout.write(`${JSON.stringify(result.output)}\n`);
  process.exitCode = result.exitCode;
}
