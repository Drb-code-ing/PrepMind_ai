import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runPhase698RetrieverPartialQualityClosure,
  serializePhase698RetrieverPartialClosureSummary,
} from '../src/evals/phase-6-9-8-retriever-final-response-partial-quality-closure.ts';

const summary = await runPhase698RetrieverPartialQualityClosure({
  argv: process.argv.slice(2),
  repositoryRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../../../'),
});

process.stdout.write(serializePhase698RetrieverPartialClosureSummary(summary));
if (summary.status !== 'partial_completion_closed') process.exitCode = 1;
