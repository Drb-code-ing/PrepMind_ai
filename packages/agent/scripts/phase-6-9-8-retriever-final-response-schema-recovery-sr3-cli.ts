import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT,
  executePhase698RetrieverSchemaRecoverySr3CliCore,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-cli-core.ts';
import { createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

const args = process.argv.slice(2);
const command = args[0] ?? PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT;
const usesSyntheticRoot = command === PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT;
const root = usesSyntheticRoot
  ? await mkdtemp(join(tmpdir(), 'prepmind-sr3-'))
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const controller = new AbortController();
const abort = () => controller.abort();
process.once('SIGINT', abort);
process.once('SIGTERM', abort);
try {
  const code = await executePhase698RetrieverSchemaRecoverySr3CliCore(
    {
      args: args.length === 0 ? [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MOCK_ARGUMENT] : args,
      root,
      signal: controller.signal,
    },
    usesSyntheticRoot
      ? {
          readSource: () => createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest(),
        }
      : undefined,
  );
  process.exitCode = code;
} finally {
  process.removeListener('SIGINT', abort);
  process.removeListener('SIGTERM', abort);
  if (usesSyntheticRoot) await rm(root, { recursive: true, force: true });
}
