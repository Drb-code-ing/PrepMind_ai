import { fileURLToPath } from 'node:url';

import { validatePhase698TransportEvidenceT3ControlledBundle } from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-controlled-durability.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const result = await validatePhase698TransportEvidenceT3ControlledBundle({ root });
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.ok ? 0 : 1;
