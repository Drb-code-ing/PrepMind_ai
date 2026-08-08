import { buildPhase698RetrieverOriginalQueryBaselineV1 } from '../src/evals/phase-6-9-8-retriever-baseline.ts';

if (!import.meta.main || process.argv.length !== 2) {
  process.stderr.write('phase_6_9_8_retriever_baseline_invalid_arguments\n');
  process.exitCode = 2;
} else {
  buildPhase698RetrieverOriginalQueryBaselineV1()
    .then((bundle) => {
      process.stdout.write(
        `${JSON.stringify({
          schemaVersion: bundle.report.schemaVersion,
          authority: bundle.report.authority,
          complete: bundle.report.complete,
          caseCounts: bundle.report.caseCounts,
          counters: bundle.report.counters,
          metrics: bundle.report.metrics,
          sha256: bundle.sha256,
        })}\n`,
      );
    })
    .catch(() => {
      process.stderr.write('phase_6_9_8_retriever_baseline_failed\n');
      process.exitCode = 1;
    });
}
