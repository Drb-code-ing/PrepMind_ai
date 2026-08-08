import { fileURLToPath } from 'node:url';

import { validatePhase698Task9Bundle } from '../src/evals/phase-6-9-8-retriever-final-response-task9-durability.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export async function runPhase698Task9EvidenceValidator(args: readonly string[]) {
  if (args.length !== 0) {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'validator_argument_invalid' })}\n`);
    return 1 as const;
  }
  const result = await validatePhase698Task9Bundle({ root: REPOSITORY_ROOT });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.ok ? (0 as const) : (1 as const);
}

if (import.meta.main) {
  process.exitCode = await runPhase698Task9EvidenceValidator(process.argv.slice(2));
}
