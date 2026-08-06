import { fileURLToPath } from 'node:url';

import { sealPhase698TransportEvidenceT3ControlledInterruptedAttempt } from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-durability.ts';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ARGUMENT =
  'I_SEAL_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_TRANSPORT_EVIDENCE_T3_CONTROLLED_CRASH_ONLY_ONCE';
const VERSION = 'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-seal-cli-v1';

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] !== ARGUMENT) {
  process.stdout.write(
    `${JSON.stringify({
      version: VERSION,
      operation: 'crash_only_seal',
      ok: false,
      code: 'seal_argument_invalid',
      providerCalls: 0,
      credentialReads: 0,
    })}\n`,
  );
  process.exitCode = 1;
} else {
  const result = await sealPhase698TransportEvidenceT3ControlledInterruptedAttempt({ root: ROOT });
  process.stdout.write(
    `${JSON.stringify({
      version: VERSION,
      operation: 'crash_only_seal',
      ...result,
      providerCalls: 0,
      credentialReads: 0,
    })}\n`,
  );
  process.exitCode = result.ok ? 0 : 1;
}
