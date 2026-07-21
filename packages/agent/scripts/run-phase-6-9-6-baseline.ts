import { runKnowledgeAgentDeterministicBaseline } from '../src/evals/phase-6-9-knowledge-agent-baseline.ts';

const report = runKnowledgeAgentDeterministicBaseline();

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.metrics.ok) {
  process.exitCode = 1;
}
