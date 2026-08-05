import { fileURLToPath } from 'node:url';

import {
  executePhase698ArchitectureRecoveryCliCore,
  type Phase698ArchitectureRecoveryCliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-cli-core.ts';
import {
  sealPhase698ArchitectureRecoveryInterruptedAttempt,
  validatePhase698ArchitectureRecoveryBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PRODUCTION_PORTS: Phase698ArchitectureRecoveryCliCorePorts = Object.freeze({
  validate: validatePhase698ArchitectureRecoveryBundle,
  seal: sealPhase698ArchitectureRecoveryInterruptedAttempt,
  write: (line) => process.stdout.write(`${line}\n`),
});

/** Fixed zero-provider maintenance entry. Callers can provide argv only. */
export function runPhase698ArchitectureRecoveryCli(args: readonly string[]) {
  return executePhase698ArchitectureRecoveryCliCore(
    { args, root: REPOSITORY_ROOT },
    PRODUCTION_PORTS,
  );
}

if (import.meta.main) {
  process.exitCode = await runPhase698ArchitectureRecoveryCli(process.argv.slice(2));
}
