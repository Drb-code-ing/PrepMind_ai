import { formatRagEvalSmokeReport } from './rag-eval-report';
import type { RagEvalSummary } from './rag-eval.types';

describe('formatRagEvalSmokeReport', () => {
  it('formats a passing smoke report with metrics and top hit overview', () => {
    const report = formatRagEvalSmokeReport({
      title: 'RAG Eval Smoke',
      baseUrl: 'http://localhost:3001',
      documentName: 'prepmind-rag-eval-smoke.txt',
      documentId: 'doc_1',
      durationMs: 1234,
      caseHits: {
        'exact-blue-lantern': {
          hitCount: 1,
          topScore: 0.91,
          topDocumentName: 'prepmind-rag-eval-smoke.txt',
        },
      },
      summary: summary({
        passed: 1,
        failed: 0,
        recallAtK: 1,
        top1Accuracy: 1,
      }),
    });

    expect(report).toContain('RAG Eval Smoke');
    expect(report).toContain('Status: PASS');
    expect(report).toContain('Base URL: http://localhost:3001');
    expect(report).toContain('Document: prepmind-rag-eval-smoke.txt (doc_1)');
    expect(report).toContain('Recall@K: 100.0%');
    expect(report).toContain('Top1 Accuracy: 100.0%');
    expect(report).toContain('exact-blue-lantern: hits=1 topScore=0.910000');
  });

  it('formats failed cases with reasons', () => {
    const report = formatRagEvalSmokeReport({
      title: 'RAG Eval Smoke',
      baseUrl: 'http://localhost:3001',
      documentName: 'prepmind-rag-eval-smoke.txt',
      documentId: 'doc_1',
      durationMs: 100,
      caseHits: {
        'semantic-review-pressure': {
          hitCount: 0,
        },
      },
      summary: summary({
        passed: 0,
        failed: 1,
        recallAtK: 0,
        top1Accuracy: 0,
        resultPassed: false,
        reason: 'Expected hit was not found in topK results.',
      }),
    });

    expect(report).toContain('Status: FAIL');
    expect(report).toContain('Failed Cases');
    expect(report).toContain('semantic-review-pressure');
    expect(report).toContain('Expected hit was not found in topK results.');
    expect(report).not.toContain('undefined');
  });
});

function summary(input: {
  passed: number;
  failed: number;
  recallAtK: number;
  top1Accuracy: number;
  resultPassed?: boolean;
  reason?: string;
}): RagEvalSummary {
  return {
    total: input.passed + input.failed,
    passed: input.passed,
    failed: input.failed,
    recallAtK: input.recallAtK,
    top1Accuracy: input.top1Accuracy,
    safetyPassRate: 1,
    noHitPassRate: 1,
    results: [
      {
        caseId: input.failed
          ? 'semantic-review-pressure'
          : 'exact-blue-lantern',
        name: input.failed
          ? 'Semantic rewrite retrieval'
          : 'Exact term retrieval',
        passed: input.resultPassed ?? true,
        hitCount: input.failed ? 0 : 1,
        topHitMatched: !input.failed,
        expectedHitFound: !input.failed,
        forbiddenHitFound: false,
        safetyPassed: true,
        noHitPassed: true,
        reasons: input.reason ? [input.reason] : [],
      },
    ],
  };
}
