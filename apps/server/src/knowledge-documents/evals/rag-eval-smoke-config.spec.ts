import {
  RAG_EVAL_SMOKE_CASE_IDS,
  RagEvalSmokeFailureError,
  assertRagEvalSmokeBackgroundJobStatus,
  assertRagEvalSmokeEvidence,
  fetchRagEvalSmokeResponse,
  formatRagEvalSmokeFailure,
  resolveRagEvalSmokeQuery,
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

describe('resolveRagEvalSmokeQuery', () => {
  it('uses only the exact English term for the keyword smoke case', () => {
    expect(
      resolveRagEvalSmokeQuery(
        testCase('exact-blue-lantern', 'blue lantern theorem 是什么？'),
      ),
    ).toBe('blue lantern theorem');
  });

  it.each([
    ['semantic-review-pressure', '复习压力和每日卡片上限应该怎么安排？'],
    ['cross-language-weak-points', '薄弱知识点复习顺序'],
  ])('preserves the configured query for %s', (id, query) => {
    expect(resolveRagEvalSmokeQuery(testCase(id, query))).toBe(query);
  });
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
      'RAG_EVAL_SMOKE_EVIDENCE_RETRIEVAL_METADATA_MISSING',
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
      'RAG_EVAL_SMOKE_EVIDENCE_RETRIEVAL_MODE_INVALID',
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
        'RAG_EVAL_SMOKE_EVIDENCE_RETRIEVAL_SCORE_INVALID',
      );
    },
  );

  it('returns a specific safe failure for missing exact keyword evidence', () => {
    const hits = validHits();
    hits['exact-blue-lantern'] = [
      {
        ...hybridHit('chunk_keyword_zero', 0.123456, 0),
        content:
          'private chunk content https://secret.example.com/key=canary sk-canary',
      },
    ];

    const error = capturedError(() => assertRagEvalSmokeEvidence(hits));
    expect(error).toBeInstanceOf(RagEvalSmokeFailureError);
    expect(error).toMatchObject({
      failure: {
        stage: 'EVIDENCE',
        reason: 'EXACT_KEYWORD_SCORE_MISSING',
        code: 'RAG_EVAL_SMOKE_EVIDENCE_EXACT_KEYWORD_SCORE_MISSING',
        message: 'RAG_EVAL_SMOKE_EVIDENCE_EXACT_KEYWORD_SCORE_MISSING',
      },
    });
    const serialized = JSON.stringify(error);
    expect(serialized).not.toContain('private chunk content');
    expect(serialized).not.toContain('https://secret.example.com/key=canary');
    expect(serialized).not.toContain('sk-canary');
    expect(serialized).not.toContain('0.123456');
  });

  it.each([
    ['semantic-review-pressure', 'SEMANTIC_VECTOR_SCORE_MISSING'],
    ['cross-language-weak-points', 'CROSS_LANGUAGE_VECTOR_SCORE_MISSING'],
  ] as const)(
    'requires positive vector evidence for %s',
    (caseId, errorCode) => {
      const hits = validHits();
      hits[caseId] = [hybridHit(`chunk_${caseId}`, 0, 0.5)];

      expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
        `RAG_EVAL_SMOKE_EVIDENCE_${errorCode}`,
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
      'RAG_EVAL_SMOKE_EVIDENCE_DUPLICATE_CHUNK_ID',
    );
  });

  it('fails closed when a hit field getter throws', () => {
    const hits = validHits();
    const hostileHit = {} as RagEvalHit;
    Object.defineProperty(hostileHit, 'chunkId', {
      get() {
        throw new Error(
          'private chunk content https://secret.example.com/key=canary sk-canary',
        );
      },
    });
    hits['semantic-review-pressure'] = [hostileHit];

    const message = errorMessage(() => assertRagEvalSmokeEvidence(hits));
    expect(message).toBe('RAG_EVAL_SMOKE_EVIDENCE_HIT_UNREADABLE');
    expect(message).not.toContain('private chunk content');
    expect(message).not.toContain('https://secret.example.com/key=canary');
    expect(message).not.toContain('sk-canary');
  });

  it('fails closed for a revoked hit proxy', () => {
    const hits = validHits();
    const revoked = Proxy.revocable(hybridHit('revoked_chunk', 0.7, 0), {});
    revoked.revoke();
    hits['semantic-review-pressure'] = [revoked.proxy];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG_EVAL_SMOKE_EVIDENCE_HIT_UNREADABLE',
    );
  });

  it('fails closed for an undefined hit', () => {
    const hits = validHits();
    hits['semantic-review-pressure'] = [undefined as unknown as RagEvalHit];

    expect(() => assertRagEvalSmokeEvidence(hits)).toThrow(
      'RAG_EVAL_SMOKE_EVIDENCE_HIT_INVALID',
    );
  });
});

describe('formatRagEvalSmokeFailure', () => {
  it('distinguishes allowlisted stages and reasons without unsafe detail', () => {
    const unsafeError = new Error(
      'fetch https://secret.example.com/key=canary failed with sk-canary',
    );
    const unsafeApiDetail = {
      message:
        'private chunk content from https://secret.example.com/key=canary',
      key: 'sk-canary',
    };

    const formatted = [
      formatRagEvalSmokeFailure('REGISTER', 'HTTP', unsafeApiDetail),
      formatRagEvalSmokeFailure('SEARCH', 'TIMEOUT', unsafeError),
      formatRagEvalSmokeFailure('DELETE', 'NETWORK', unsafeError),
      formatRagEvalSmokeFailure('PROCESS', 'INVALID_MODE', unsafeApiDetail),
    ];

    expect(formatted).toEqual([
      {
        stage: 'REGISTER',
        reason: 'HTTP',
        code: 'RAG_EVAL_SMOKE_REGISTER_HTTP',
        message: 'RAG_EVAL_SMOKE_REGISTER_HTTP',
      },
      {
        stage: 'SEARCH',
        reason: 'TIMEOUT',
        code: 'RAG_EVAL_SMOKE_SEARCH_TIMEOUT',
        message: 'RAG_EVAL_SMOKE_SEARCH_TIMEOUT',
      },
      {
        stage: 'DELETE',
        reason: 'NETWORK',
        code: 'RAG_EVAL_SMOKE_DELETE_NETWORK',
        message: 'RAG_EVAL_SMOKE_DELETE_NETWORK',
      },
      {
        stage: 'PROCESS',
        reason: 'INVALID_MODE',
        code: 'RAG_EVAL_SMOKE_PROCESS_INVALID_MODE',
        message: 'RAG_EVAL_SMOKE_PROCESS_INVALID_MODE',
      },
    ]);
    const serialized = JSON.stringify(formatted);
    expect(serialized).not.toContain('https://secret.example.com/key=canary');
    expect(serialized).not.toContain('sk-canary');
    expect(serialized).not.toContain('private chunk content');
  });
});

describe('fetchRagEvalSmokeResponse', () => {
  it('aborts hanging run and cleanup requests at their own bounded deadlines', async () => {
    jest.useFakeTimers();
    try {
      const observedSignals: AbortSignal[] = [];
      const fetchImpl = jest.fn((_url: unknown, init?: RequestInit) => {
        const signal = init?.signal;
        if (!(signal instanceof AbortSignal)) {
          throw new Error('missing AbortSignal');
        }
        observedSignals.push(signal);
        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () =>
              reject(
                new Error(
                  'https://secret.example.com/key=canary sk-canary private chunk content',
                ),
              ),
            { once: true },
          );
        });
      }) as unknown as typeof fetch;
      const now = Date.now();
      const runRequest = fetchRagEvalSmokeResponse({
        stage: 'SEARCH',
        url: 'https://secret.example.com/key=canary',
        init: {},
        deadlineAt: now + 1_000,
        requestTimeoutMs: 50,
        fetchImpl,
      });
      const cleanupRequest = fetchRagEvalSmokeResponse({
        stage: 'DELETE',
        url: 'https://secret.example.com/key=canary',
        init: {},
        deadlineAt: now + 25,
        requestTimeoutMs: 100,
        fetchImpl,
      });
      const runExpectation = expect(runRequest).rejects.toMatchObject({
        failure: {
          stage: 'SEARCH',
          reason: 'TIMEOUT',
          code: 'RAG_EVAL_SMOKE_SEARCH_TIMEOUT',
        },
      });
      const cleanupExpectation = expect(cleanupRequest).rejects.toMatchObject({
        failure: {
          stage: 'DELETE',
          reason: 'TIMEOUT',
          code: 'RAG_EVAL_SMOKE_DELETE_TIMEOUT',
        },
      });

      await jest.advanceTimersByTimeAsync(25);
      await cleanupExpectation;
      await jest.advanceTimersByTimeAsync(25);
      await runExpectation;

      expect(observedSignals).toHaveLength(2);
      expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('assertRagEvalSmokeBackgroundJobStatus', () => {
  it('fails fast with a fixed CANCELLED classification', () => {
    expect(() => assertRagEvalSmokeBackgroundJobStatus('CANCELLED')).toThrow(
      'RAG_EVAL_SMOKE_JOB_POLL_CANCELLED',
    );
  });
});

function testCase(id: string, query = id): RagEvalCase {
  return {
    id,
    name: id,
    query,
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

function capturedError(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
  throw new Error('Expected function to throw.');
}
