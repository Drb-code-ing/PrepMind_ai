import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

import { readReviewPlannerControlledLiveV10SemanticQualityEvidence } from '../src/review-agent/review-planner-controlled-live-eval-v10-semantic-quality.evidence';

const fallback = Object.freeze({
  status: 'invalid_attempted',
  gate: 'closed',
  diagnosticCode: 'evidence_io',
});

async function main() {
  try {
    const root = realpathSync(resolve(__dirname, '../../..'));
    const [requestedRoot, ...unexpected] = process.argv.slice(2);
    if (
      unexpected.length !== 0 ||
      typeof requestedRoot !== 'string' ||
      realpathSync(resolve(requestedRoot)) !== root ||
      realpathSync(process.cwd()) !== root
    ) {
      return fallback;
    }
    return projectSafeEvidence(
      await readReviewPlannerControlledLiveV10SemanticQualityEvidence(root),
    );
  } catch {
    return fallback;
  }
}

function projectSafeEvidence(value: Record<string, unknown>) {
  const attempts = value.attempts;
  if (
    value.schemaVersion !==
      'phase-6.9.5-review-planner-v10-semantic-quality-v1' ||
    value.state !== 'finalized' ||
    value.status !== 'complete' ||
    value.gate !== 'closed' ||
    value.terminalReason !== 'passed' ||
    !attempts ||
    typeof attempts !== 'object' ||
    Array.isArray(attempts) ||
    (attempts as Record<string, unknown>).providerCount !== 23 ||
    (attempts as Record<string, unknown>).pairedAdmissionCount !== 22 ||
    typeof value.evidenceSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.evidenceSha256)
  ) {
    return fallback;
  }
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    state: 'finalized',
    status: 'complete',
    gate: 'closed',
    terminalReason: 'passed',
    attempts: Object.freeze({
      providerCount: 23,
      pairedAdmissionCount: 22,
    }),
    evidenceSha256: value.evidenceSha256,
  });
}

void main().then((result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
});
