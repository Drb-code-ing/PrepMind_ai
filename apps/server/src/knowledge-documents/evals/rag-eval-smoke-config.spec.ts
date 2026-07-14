import {
  RAG_EVAL_SMOKE_CASE_IDS,
  assertRagEvalSmokeEvidence,
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from './rag-eval-smoke-config';
import type { RagEvalCase, RagEvalHit } from './rag-eval.types';

describe('selectRagEvalSmokeCases', () => {
  it('returns required smoke cases in configured order', () => {
    const cases = selectRagEvalSmokeCases([
      testCase('cross-language-weak-points'),
      testCase('exact-blue-lantern'),
      testCase('semantic-review-pressure'),
      testCase('unused-case'),
    ]);

    expect(cases.map((testCase) => testCase.id)).toEqual(
      RAG_EVAL_SMOKE_CASE_IDS,
    );
  });

  it('throws when a required smoke case is missing', () => {
    expect(() =>
      selectRagEvalSmokeCases([
        testCase('exact-blue-lantern'),
        testCase('semantic-review-pressure'),
      ]),
    ).toThrow(
      'RAG eval smoke cases are missing required ids: cross-language-weak-points',
    );
  });
});

describe('shouldKeepRagEvalSmokeData', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'YES'])(
    'enables keep-data for %s',
    (value) => {
      expect(
        shouldKeepRagEvalSmokeData({ RAG_EVAL_SMOKE_KEEP_DATA: value }),
      ).toBe(true);
    },
  );

  it.each([undefined, '', 'false', '0', 'no', 'anything-else'])(
    'disables keep-data for %s',
    (value) => {
      expect(
        shouldKeepRagEvalSmokeData({ RAG_EVAL_SMOKE_KEEP_DATA: value }),
      ).toBe(false);
    },
  );
});

describe('assertRagEvalSmokeEvidence', () => {
  it('returns a safe hybrid evidence summary for valid smoke hits', () => {
    expect(
      assertRagEvalSmokeEvidence({
        'exact-blue-lantern': [hybridHit('shared_chunk', 0.2, 0.9)],
        'semantic-review-pressure': [hybridHit('shared_chunk', 0.8, 0)],
        'cross-language-weak-points': [
          hybridHit('cross_language_chunk', 0.7, 0),
        ],
      }),
    ).toEqual({ mode: 'hybrid', checkedHitCount: 3 });
  });

  it('rejects a hit without retrieval metadata using a fixed safe error', () => {
    const hits = validHits();
    hits['exact-blue-lantern'] = [
      hit(
        'chunk_missing_metadata',
        undefined as unknown as RagEvalHit['metadata'],
      ),
    ];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG eval smoke evidence failed: retrieval_metadata_missing.',
    );
    expect(errorMessage(() => assertRagEvalSmokeEvidence(hits))).not.toContain(
      'sensitive hit content',
    );
  });

  it('rejects a non-hybrid retrieval mode using a fixed safe error', () => {
    const hits = validHits();
    hits['exact-blue-lantern'] = [
      hit('chunk_wrong_mode', {
        retrieval: { mode: 'vector', vectorScore: 0.8, keywordScore: 0.4 },
      }),
    ];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG eval smoke evidence failed: retrieval_mode_invalid.',
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite retrieval scores using a fixed safe error (%s)',
    (invalidScore) => {
      const hits = validHits();
      hits['semantic-review-pressure'] = [
        hybridHit('chunk_invalid_score', invalidScore, 0),
      ];

      expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
        'RAG eval smoke evidence failed: retrieval_score_invalid.',
      );
    },
  );

  it('requires positive keyword evidence for the exact-term case', () => {
    const hits = validHits();
    hits['exact-blue-lantern'] = [hybridHit('chunk_keyword_zero', 0.8, 0)];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG eval smoke evidence failed: exact_keyword_score_missing.',
    );
  });

  it.each([
    ['semantic-review-pressure', 'semantic_vector_score_missing'],
    ['cross-language-weak-points', 'cross_language_vector_score_missing'],
  ] as const)(
    'requires positive vector evidence for %s',
    (caseId, errorCode) => {
      const hits = validHits();
      hits[caseId] = [hybridHit(`chunk_${caseId}`, 0, 0.5)];

      expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
        `RAG eval smoke evidence failed: ${errorCode}.`,
      );
    },
  );

  it('rejects duplicate chunk ids within one query result', () => {
    const hits = validHits();
    hits['semantic-review-pressure'] = [
      hybridHit('duplicate_chunk', 0.8, 0),
      hybridHit('duplicate_chunk', 0.7, 0),
    ];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG eval smoke evidence failed: duplicate_chunk_id.',
    );
  });
});

function testCase(id: string): RagEvalCase {
  return {
    id,
    name: id,
    query: id,
    topK: 5,
    shouldHaveHit: true,
  };
}

function validHits(): Record<string, RagEvalHit[]> {
  return {
    'exact-blue-lantern': [hybridHit('exact_chunk', 0.2, 0.9)],
    'semantic-review-pressure': [hybridHit('semantic_chunk', 0.8, 0)],
    'cross-language-weak-points': [hybridHit('cross_chunk', 0.7, 0)],
  };
}

function hybridHit(
  chunkId: string,
  vectorScore: number,
  keywordScore: number,
): RagEvalHit {
  return hit(chunkId, {
    retrieval: { mode: 'hybrid', vectorScore, keywordScore },
  });
}

function hit(chunkId: string, metadata: RagEvalHit['metadata']): RagEvalHit {
  return {
    chunkId,
    documentId: 'document_safe_id',
    documentName: 'safe.txt',
    content: 'sensitive hit content',
    score: 0.8,
    metadata,
  };
}

function errorMessage(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return '';
}
