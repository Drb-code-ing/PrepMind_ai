import { PHASE_6_9_7_V5_DETERMINISTIC_BASELINE } from '../src/evals/phase-6-9-tutor-wrong-question-v2-baseline.ts';

const report = PHASE_6_9_7_V5_DETERMINISTIC_BASELINE;

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.metrics.ok) process.exitCode = 1;
