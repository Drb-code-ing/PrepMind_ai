import { fileURLToPath } from 'node:url';

import { validatePhase697FullGateBundle } from '../src/evals/phase-6-9-tutor-organizer-full-gate-durability.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export async function runPhase697FullGateBundleValidator() {
  const result = await validatePhase697FullGateBundle({ root: REPOSITORY_ROOT });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? (0 as const) : (1 as const);
}

if (import.meta.main) {
  process.exitCode = await runPhase697FullGateBundleValidator();
}
