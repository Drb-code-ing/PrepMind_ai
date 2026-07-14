import { describe, expect, test } from 'bun:test';

import {
  MODEL_CANDIDATE_DISPOSITIONS,
  runKnowledgeVerifierModelCandidate,
  runRouterModelCandidate,
} from '@repo/agent/model-candidates';

describe('production model candidate exports', () => {
  test('publishes the production runners and stable dispositions', () => {
    expect(runRouterModelCandidate).toBeFunction();
    expect(runKnowledgeVerifierModelCandidate).toBeFunction();
    expect(MODEL_CANDIDATE_DISPOSITIONS).toContain('candidate_applied');
    expect(MODEL_CANDIDATE_DISPOSITIONS).toContain('safety_blocked');
  });
});
