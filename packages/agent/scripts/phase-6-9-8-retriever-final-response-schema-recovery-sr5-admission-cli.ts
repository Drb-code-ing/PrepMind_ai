import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parsePhase698RetrieverSchemaRecoverySr5CliArgs,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CLI_VERSION,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';

const intent = parsePhase698RetrieverSchemaRecoverySr5CliArgs(process.argv.slice(2));
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

if (intent.kind === 'help') {
  console.log(
    JSON.stringify(
      {
        version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CLI_VERSION,
        commands: [
          'ADMIT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_ZERO_PROVIDER',
          'VALIDATE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_ZERO_PROVIDER',
        ],
        providerCalls: 0,
        credentialReads: 0,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (intent.kind === 'rejected') {
  console.error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CLI_ARGUMENTS_REJECTED');
  process.exit(2);
}

// This CLI is deliberately source-only.  Boundary/auth/budget input is kept
// in the typed API so a shell command cannot accidentally turn a status probe
// into a live authorization; the future runner must call the source-bound
// composition function with a fresh, exact receipt.
const result = inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission(root);
if (!result.ok) {
  console.error(result.reasonCode);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      kind: intent.kind,
      admissionStage: 'source_only_zero_provider',
      source: result.source,
      boundCapabilityIssued: false,
      boundaryAuthorizationBudget: 'deferred_to_source_bound_api',
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      providerDispatchAllowed: false,
    },
    null,
    2,
  ),
);
