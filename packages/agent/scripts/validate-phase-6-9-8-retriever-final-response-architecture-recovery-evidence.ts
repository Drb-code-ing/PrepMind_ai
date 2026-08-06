import { fileURLToPath } from 'node:url';

import { validatePhase698ArchitectureRecoveryBundle } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-durability.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export async function runPhase698ArchitectureRecoveryEvidenceValidator(args: readonly string[]) {
  if (args.length !== 0) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, providerCalls: 0, code: 'validator_argument_invalid' })}\n`,
    );
    return 1 as const;
  }
  const result = await validatePhase698ArchitectureRecoveryBundle({ root: REPOSITORY_ROOT });
  process.stdout.write(
    `${JSON.stringify({
      ok: result.ok,
      providerCalls: 0,
      qualityAuthority: result.ok ? result.qualityAuthority : 'none',
      code: result.ok ? 'bundle_valid' : 'bundle_invalid',
    })}\n`,
  );
  return result.ok ? (0 as const) : (1 as const);
}

if (import.meta.main) {
  process.exitCode = await runPhase698ArchitectureRecoveryEvidenceValidator(process.argv.slice(2));
}
