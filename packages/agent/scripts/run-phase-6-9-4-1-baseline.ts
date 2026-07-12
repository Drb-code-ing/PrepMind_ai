import { runPhase6941RouterVerifierBaseline } from '../src/evals/run-phase-6-9-router-verifier-baseline.ts';

const report = runPhase6941RouterVerifierBaseline();

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.routerMetrics.ok || !report.verifierMetrics.ok) {
  process.exitCode = 1;
}
