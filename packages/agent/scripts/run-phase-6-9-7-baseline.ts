import { runTutorWrongQuestionDeterministicBaseline } from '../src/evals/phase-6-9-tutor-wrong-question-baseline.ts';

const report = runTutorWrongQuestionDeterministicBaseline();

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.metrics.ok) {
  process.exitCode = 1;
}
