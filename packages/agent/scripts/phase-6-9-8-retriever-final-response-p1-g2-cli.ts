import {
  executePhase698P1G2CliCore,
  PHASE_6_9_8_P1_G2_RUN_CONFIRMATION,
  PHASE_6_9_8_P1_G2_RECOVER_CONFIRMATION,
  PHASE_6_9_8_P1_G2_VALIDATE_CONFIRMATION,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-g2-cli-core.ts';
import { createPhase698P1G2SyntheticSourceSnapshot } from '../src/evals/phase-6-9-8-retriever-final-response-p1-g2-source-admission.ts';

const args = process.argv.slice(2);
const command = args[0] ?? PHASE_6_9_8_P1_G2_RUN_CONFIRMATION;
const code = await executePhase698P1G2CliCore(
  {
    args: [command],
    root: '',
    signal: new AbortController().signal,
    snapshot: createPhase698P1G2SyntheticSourceSnapshot(),
  },
  {
    write: (line) => process.stdout.write(`${line}\n`),
    snapshot: async () => createPhase698P1G2SyntheticSourceSnapshot(),
    isProcessAlive: (processId) => processId === process.pid,
  },
);

if (
  command === PHASE_6_9_8_P1_G2_VALIDATE_CONFIRMATION ||
  command === PHASE_6_9_8_P1_G2_RECOVER_CONFIRMATION
) {
  process.exitCode = code;
} else {
  process.exitCode = code;
}
