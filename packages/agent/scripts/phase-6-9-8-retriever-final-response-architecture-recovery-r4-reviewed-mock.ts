import { buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1 } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.ts';

/** Zero-provider R4 checkpoint. Any Live/seal/validate argv is rejected. */
export async function runPhase698ArchitectureRecoveryR4ReviewedMockCli(
  args: readonly string[] = [],
) {
  if (args.length !== 1 || args[0] !== 'mock') {
    throw new Error('PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_ONLY_MOCK');
  }
  const bundle = await buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1();
  process.stdout.write(`${bundle.canonicalBytes}`);
  return bundle;
}

if (import.meta.main) {
  await runPhase698ArchitectureRecoveryR4ReviewedMockCli(process.argv.slice(2));
}
