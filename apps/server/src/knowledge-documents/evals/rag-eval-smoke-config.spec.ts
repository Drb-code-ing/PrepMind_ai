import {
  RAG_EVAL_SMOKE_CASE_IDS,
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from './rag-eval-smoke-config';
import type { RagEvalCase } from './rag-eval.types';

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

function testCase(id: string): RagEvalCase {
  return {
    id,
    name: id,
    query: id,
    topK: 5,
    shouldHaveHit: true,
  };
}
