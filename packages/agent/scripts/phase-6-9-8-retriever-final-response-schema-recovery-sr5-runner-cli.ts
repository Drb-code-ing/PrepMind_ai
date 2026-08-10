import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  executePhase698RetrieverSchemaRecoverySr5RunnerCliCore,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runner-cli-core.ts';

const args = process.argv.slice(2);
const usesSyntheticRoot =
  args.length === 0 || args[0] === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT;
const root = usesSyntheticRoot
  ? await mkdtemp(join(tmpdir(), 'prepmind-sr5-runner-'))
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const controller = new AbortController();
const abort = () => controller.abort();
process.once('SIGINT', abort);
process.once('SIGTERM', abort);

try {
  process.exitCode = await executePhase698RetrieverSchemaRecoverySr5RunnerCliCore({
    args:
      usesSyntheticRoot && args.length === 0
        ? [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RUNNER_RUN_ARGUMENT]
        : args,
    root,
    signal: controller.signal,
  });
} finally {
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
  if (usesSyntheticRoot) await rm(root, { recursive: true, force: true });
}
