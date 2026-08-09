import { buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1 } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.ts';

/** Zero-provider SR4 checkpoint. Live/seal/validate arguments are rejected. */
export async function runPhase698RetrieverSchemaRecoverySr4ReviewedMockCli(
  args: readonly string[] = [],
) {
  if (args.length !== 1 || args[0] !== 'mock') {
    throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_ONLY_MOCK');
  }
  const bundle = await buildPhase698RetrieverSchemaRecoverySr4ReviewedMockStaticV1();
  process.stdout.write(bundle.canonicalBytes);
  return bundle;
}

if (import.meta.main) {
  await runPhase698RetrieverSchemaRecoverySr4ReviewedMockCli(process.argv.slice(2));
}
