import {
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE,
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-baseline.ts';
import {
  PHASE_6_9_7_V6_DATASET_BINDING,
  PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256,
  PHASE_6_9_7_V6_SOURCE_DATASET_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';

const report = PHASE_6_9_7_V5_DETERMINISTIC_BASELINE;

if (
  PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 !== PHASE_6_9_7_V6_SOURCE_BASELINE_SHA256 ||
  PHASE_6_9_7_V6_DATASET_BINDING.source.datasetSha256 !== PHASE_6_9_7_V6_SOURCE_DATASET_SHA256 ||
  PHASE_6_9_7_V6_DATASET_BINDING.source.expectedBytesPolicy !== 'reuse_without_modification'
) {
  throw new Error('PHASE_6_9_7_V6_BASELINE_BINDING_INVALID');
}

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!report.metrics.ok) process.exitCode = 1;
