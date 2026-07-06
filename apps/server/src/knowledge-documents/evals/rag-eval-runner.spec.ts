import { runRagEval } from './rag-eval-runner';
import type { RagEvalCase, RagEvalHit } from './rag-eval.types';

describe('runRagEval', () => {
  const baseCase: RagEvalCase = {
    id: 'case_1',
    name: 'Expected hit',
    query: 'blue lantern theorem',
    topK: 3,
    shouldHaveHit: true,
    expectedContentIncludes: ['blue lantern theorem'],
    safetyExpectation: 'no-high-risk',
  };

  it('passes when the top hit contains expected content', () => {
    const summary = runRagEval({
      cases: [baseCase],
      hitsByCaseId: {
        case_1: [hit('chunk_1', 'blue lantern theorem summary', 0.91)],
      },
    });

    expect(summary).toMatchObject({
      total: 1,
      passed: 1,
      failed: 0,
      recallAtK: 1,
      top1Accuracy: 1,
      safetyPassRate: 1,
    });
    expect(summary.results[0]?.reasons).toEqual([]);
  });

  it('counts recall without top1 accuracy when expected content is not first', () => {
    const summary = runRagEval({
      cases: [baseCase],
      hitsByCaseId: {
        case_1: [
          hit('chunk_other', 'unrelated review note', 0.8),
          hit('chunk_1', 'blue lantern theorem summary', 0.77),
        ],
      },
    });

    expect(summary.recallAtK).toBe(1);
    expect(summary.top1Accuracy).toBe(0);
    expect(summary.results[0]).toMatchObject({
      passed: true,
      topHitMatched: false,
      expectedHitFound: true,
    });
  });

  it('fails expected-hit cases when no matching hit is returned', () => {
    const summary = runRagEval({
      cases: [baseCase],
      hitsByCaseId: {
        case_1: [hit('chunk_other', 'unrelated review note', 0.8)],
      },
    });

    expect(summary.failed).toBe(1);
    expect(summary.recallAtK).toBe(0);
    expect(summary.results[0]).toMatchObject({
      passed: false,
      expectedHitFound: false,
    });
    expect(summary.results[0]?.reasons).toContain(
      'Expected hit was not found in topK results.',
    );
  });

  it('passes no-hit cases when no hits are returned', () => {
    const noHitCase: RagEvalCase = {
      id: 'case_no_hit',
      name: 'No hit expected',
      query: 'unrelated query',
      topK: 3,
      shouldHaveHit: false,
      forbiddenContentIncludes: ['blue lantern theorem'],
    };

    const summary = runRagEval({
      cases: [noHitCase],
      hitsByCaseId: {
        case_no_hit: [],
      },
    });

    expect(summary).toMatchObject({
      passed: 1,
      failed: 0,
      noHitPassRate: 1,
    });
  });

  it('fails when forbidden content appears in returned hits', () => {
    const noHitCase: RagEvalCase = {
      id: 'case_forbidden',
      name: 'Forbidden content',
      query: 'unrelated query',
      topK: 3,
      shouldHaveHit: false,
      forbiddenContentIncludes: ['API key'],
    };

    const summary = runRagEval({
      cases: [noHitCase],
      hitsByCaseId: {
        case_forbidden: [hit('chunk_secret', 'Never reveal the API key.', 0.7)],
      },
    });

    expect(summary.failed).toBe(1);
    expect(summary.noHitPassRate).toBe(0);
    expect(summary.results[0]).toMatchObject({
      forbiddenHitFound: true,
      noHitPassed: false,
    });
  });

  it('fails no-high-risk safety expectation when a high risk chunk is returned', () => {
    const summary = runRagEval({
      cases: [baseCase],
      hitsByCaseId: {
        case_1: [
          hit('chunk_unsafe', 'blue lantern theorem summary', 0.91, 'high'),
        ],
      },
    });

    expect(summary.failed).toBe(1);
    expect(summary.safetyPassRate).toBe(0);
    expect(summary.results[0]).toMatchObject({
      safetyPassed: false,
    });
    expect(summary.results[0]?.reasons).toContain(
      'High-risk chunk returned for no-high-risk expectation.',
    );
  });

  it('checks expected ids and min top score when configured', () => {
    const idCase: RagEvalCase = {
      id: 'case_ids',
      name: 'Expected ids',
      query: 'target',
      topK: 3,
      shouldHaveHit: true,
      expectedDocumentIds: ['doc_target'],
      expectedChunkIds: ['chunk_target'],
      minTopScore: 0.85,
    };

    const summary = runRagEval({
      cases: [idCase],
      hitsByCaseId: {
        case_ids: [
          hit('chunk_target', 'target text', 0.9, 'low', 'doc_target'),
        ],
      },
    });

    expect(summary.results[0]).toMatchObject({
      passed: true,
      topHitMatched: true,
      expectedHitFound: true,
    });
  });
});

function hit(
  chunkId: string,
  content: string,
  score: number,
  riskLevel: 'low' | 'medium' | 'high' = 'low',
  documentId = 'doc_1',
): RagEvalHit {
  return {
    chunkId,
    documentId,
    documentName: `${documentId}.txt`,
    content,
    score,
    metadata: {
      safety: {
        riskLevel,
        categories: [],
        safeForPrompt: riskLevel !== 'high',
        matchedPatterns: [],
      },
    },
  };
}
