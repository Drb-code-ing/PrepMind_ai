import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import * as productionModelCandidates from '@repo/agent/model-candidates';

const EXPECTED_RUNTIME_EXPORTS = [
  'MODEL_CANDIDATE_DISPOSITIONS',
  'decideKnowledgeVerifierModelEligibility',
  'decideRouterModelEligibility',
  'isKnowledgeVerifierModelEligible',
  'isRouterModelEligible',
  'runKnowledgeVerifierModelCandidate',
  'runPlannerModelCandidate',
  'runReviewModelCandidate',
  'runRouterModelCandidate',
];

describe('production model candidate exports', () => {
  test('publishes the production runners and stable dispositions', () => {
    expect(Object.keys(productionModelCandidates).sort()).toEqual(EXPECTED_RUNTIME_EXPORTS);
    expect(productionModelCandidates.runRouterModelCandidate).toBeFunction();
    expect(productionModelCandidates.runKnowledgeVerifierModelCandidate).toBeFunction();
    expect(productionModelCandidates.runReviewModelCandidate).toBeFunction();
    expect(productionModelCandidates.runPlannerModelCandidate).toBeFunction();
    expect(productionModelCandidates.MODEL_CANDIDATE_DISPOSITIONS).toContain(
      'candidate_applied',
    );
    expect(productionModelCandidates.MODEL_CANDIDATE_DISPOSITIONS).toContain(
      'safety_blocked',
    );
  });

  test('loads the package self-reference with native Node ESM', () => {
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        "const module = await import('@repo/agent/model-candidates'); process.stdout.write(JSON.stringify(Object.keys(module).sort()));",
      ],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        encoding: 'utf8',
        windowsHide: true,
      },
    );

    expect(result.error).toBeUndefined();
    expect({
      status: result.status,
      errorCode: result.stderr.match(/\bERR_[A-Z_]+\b/)?.[0] ?? null,
    }).toEqual({ status: 0, errorCode: null });
    expect(JSON.parse(result.stdout)).toEqual(EXPECTED_RUNTIME_EXPORTS);
  });
});
