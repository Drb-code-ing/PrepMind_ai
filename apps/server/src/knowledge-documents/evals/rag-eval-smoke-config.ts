import type { RagEvalCase, RagEvalHit } from './rag-eval.types';

export const RAG_EVAL_SMOKE_CASE_IDS = [
  'exact-blue-lantern',
  'semantic-review-pressure',
  'cross-language-weak-points',
] as const;

type RagEvalSmokeCaseId = (typeof RAG_EVAL_SMOKE_CASE_IDS)[number];

type RagEvalSmokeEnv = {
  RAG_EVAL_SMOKE_KEEP_DATA?: string;
};

type RagEvalCaseWithSmokeId = RagEvalCase & {
  id: RagEvalSmokeCaseId;
};

type RagEvalSmokeEvidenceSummary = {
  mode: 'hybrid';
  checkedHitCount: number;
};

type RetrievalEvidence = {
  mode: 'hybrid';
  vectorScore: number;
  keywordScore: number;
};

const RAG_EVAL_SMOKE_FAILURE_MESSAGES = {
  FETCH_FAILED: 'RAG eval smoke request transport failed.',
  API_REQUEST_FAILED: 'RAG eval smoke API request failed.',
  DOCUMENT_PROCESSING_FAILED: 'RAG eval smoke document processing failed.',
  CLEANUP_FAILED: 'RAG eval smoke cleanup failed.',
  UNEXPECTED_FAILURE: 'RAG eval smoke failed.',
} as const;

type RagEvalSmokeFailureCode = keyof typeof RAG_EVAL_SMOKE_FAILURE_MESSAGES;

export function selectRagEvalSmokeCases(
  cases: RagEvalCase[],
): RagEvalCaseWithSmokeId[] {
  const casesById = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const selected = RAG_EVAL_SMOKE_CASE_IDS.map((caseId) =>
    casesById.get(caseId),
  );
  const missingIds = RAG_EVAL_SMOKE_CASE_IDS.filter(
    (_caseId, index) => !selected[index],
  );

  if (missingIds.length > 0) {
    throw new Error(
      `RAG eval smoke cases are missing required ids: ${missingIds.join(', ')}`,
    );
  }

  return selected as RagEvalCaseWithSmokeId[];
}

export function shouldKeepRagEvalSmokeData(env: RagEvalSmokeEnv) {
  const value = env.RAG_EVAL_SMOKE_KEEP_DATA?.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function formatRagEvalSmokeFailure(
  code: RagEvalSmokeFailureCode,
  unsafeDetail?: unknown,
) {
  void unsafeDetail;
  return { code, message: RAG_EVAL_SMOKE_FAILURE_MESSAGES[code] };
}

export function assertRagEvalSmokeEvidence(
  hitsByCaseId: Record<string, RagEvalHit[]>,
): RagEvalSmokeEvidenceSummary {
  const retrievalByCaseId = new Map<RagEvalSmokeCaseId, RetrievalEvidence[]>();
  let checkedHitCount = 0;

  for (const caseId of RAG_EVAL_SMOKE_CASE_IDS) {
    const seenChunkIds = new Set<string>();
    const retrievalEvidence: RetrievalEvidence[] = [];

    for (const hit of hitsByCaseId[caseId] ?? []) {
      if (seenChunkIds.has(hit.chunkId)) {
        failEvidence('duplicate_chunk_id');
      }
      seenChunkIds.add(hit.chunkId);
      retrievalEvidence.push(assertHybridRetrieval(hit.metadata));
      checkedHitCount += 1;
    }

    retrievalByCaseId.set(caseId, retrievalEvidence);
  }

  if (
    !retrievalByCaseId
      .get('exact-blue-lantern')
      ?.some((retrieval) => retrieval.keywordScore > 0)
  ) {
    failEvidence('exact_keyword_score_missing');
  }

  if (
    !retrievalByCaseId
      .get('semantic-review-pressure')
      ?.some((retrieval) => retrieval.vectorScore > 0)
  ) {
    failEvidence('semantic_vector_score_missing');
  }

  if (
    !retrievalByCaseId
      .get('cross-language-weak-points')
      ?.some((retrieval) => retrieval.vectorScore > 0)
  ) {
    failEvidence('cross_language_vector_score_missing');
  }

  return { mode: 'hybrid', checkedHitCount };
}

function assertHybridRetrieval(metadata: unknown): RetrievalEvidence {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    failEvidence('retrieval_metadata_missing');
  }

  const retrieval = (metadata as Record<string, unknown>).retrieval;
  if (
    typeof retrieval !== 'object' ||
    retrieval === null ||
    Array.isArray(retrieval)
  ) {
    failEvidence('retrieval_metadata_missing');
  }

  const candidate = retrieval as Record<string, unknown>;
  if (candidate.mode !== 'hybrid') {
    failEvidence('retrieval_mode_invalid');
  }
  if (
    typeof candidate.vectorScore !== 'number' ||
    !Number.isFinite(candidate.vectorScore) ||
    typeof candidate.keywordScore !== 'number' ||
    !Number.isFinite(candidate.keywordScore)
  ) {
    failEvidence('retrieval_score_invalid');
  }

  return candidate as RetrievalEvidence;
}

function failEvidence(code: string): never {
  throw new Error(`RAG eval smoke evidence failed: ${code}.`);
}
