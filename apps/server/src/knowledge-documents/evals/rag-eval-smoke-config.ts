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

export type RagEvalSmokeFailureStage =
  | 'REGISTER'
  | 'UPLOAD'
  | 'PROCESS'
  | 'DOCUMENT_POLL'
  | 'JOB_POLL'
  | 'SEARCH'
  | 'DELETE'
  | 'SMOKE';

export type RagEvalSmokeFailureReason =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'HTTP'
  | 'NON_JSON'
  | 'MISSING_DATA'
  | 'INVALID_MODE'
  | 'TERMINAL_FAILED'
  | 'CANCELLED'
  | 'UNEXPECTED';

type RagEvalSmokeFailureCode =
  `RAG_EVAL_SMOKE_${RagEvalSmokeFailureStage}_${RagEvalSmokeFailureReason}`;

export type RagEvalSmokeFailure = {
  stage: RagEvalSmokeFailureStage;
  reason: RagEvalSmokeFailureReason;
  code: RagEvalSmokeFailureCode;
  message: RagEvalSmokeFailureCode;
};

type FetchRagEvalSmokeResponseInput = {
  stage: RagEvalSmokeFailureStage;
  url: string;
  init: RequestInit;
  deadlineAt: number;
  requestTimeoutMs: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

type EvidenceHitSnapshot = {
  chunkId: unknown;
  metadataIsRecord: boolean;
  retrievalIsRecord: boolean;
  mode: unknown;
  vectorScore: unknown;
  keywordScore: unknown;
};

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
  stage: RagEvalSmokeFailureStage,
  reason: RagEvalSmokeFailureReason,
  unsafeDetail?: unknown,
): RagEvalSmokeFailure {
  void unsafeDetail;
  const code = `RAG_EVAL_SMOKE_${stage}_${reason}` as const;
  return { stage, reason, code, message: code };
}

export class RagEvalSmokeFailureError extends Error {
  constructor(readonly failure: RagEvalSmokeFailure) {
    super(failure.message);
    this.name = 'RagEvalSmokeFailureError';
  }
}

export function createRagEvalSmokeFailureError(
  stage: RagEvalSmokeFailureStage,
  reason: RagEvalSmokeFailureReason,
  unsafeDetail?: unknown,
) {
  return new RagEvalSmokeFailureError(
    formatRagEvalSmokeFailure(stage, reason, unsafeDetail),
  );
}

export async function fetchRagEvalSmokeResponse(
  input: FetchRagEvalSmokeResponseInput,
): Promise<{ response: Response; text: string }> {
  const now = input.now ?? Date.now;
  const remainingMs = Math.floor(input.deadlineAt - now());
  if (remainingMs <= 0 || !Number.isFinite(remainingMs)) {
    throw createRagEvalSmokeFailureError(input.stage, 'TIMEOUT');
  }
  if (input.signal?.aborted) {
    throw createRagEvalSmokeFailureError(input.stage, 'CANCELLED');
  }

  const timeoutMs = Math.max(
    1,
    Math.min(Math.floor(input.requestTimeoutMs), remainingMs),
  );
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(createRagEvalSmokeFailureError(input.stage, 'TIMEOUT'));
    }, timeoutMs);
  });
  const cancellation = new Promise<never>((_resolve, reject) => {
    if (!input.signal) return;
    abortListener = () => {
      cancelled = true;
      controller.abort();
      reject(createRagEvalSmokeFailureError(input.stage, 'CANCELLED'));
    };
    input.signal.addEventListener('abort', abortListener, { once: true });
  });
  const operation = (async () => {
    const response = await (input.fetchImpl ?? fetch)(input.url, {
      ...input.init,
      signal: controller.signal,
    });
    const text = await response.text();
    return { response, text };
  })();

  try {
    return await Promise.race([operation, timeout, cancellation]);
  } catch (error) {
    if (timedOut) {
      throw createRagEvalSmokeFailureError(input.stage, 'TIMEOUT');
    }
    if (cancelled || input.signal?.aborted) {
      throw createRagEvalSmokeFailureError(input.stage, 'CANCELLED');
    }
    throw createRagEvalSmokeFailureError(input.stage, 'NETWORK', error);
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    if (input.signal && abortListener) {
      input.signal.removeEventListener('abort', abortListener);
    }
  }
}

export function assertRagEvalSmokeBackgroundJobStatus(status: unknown) {
  if (status === 'SUCCEEDED') return 'succeeded' as const;
  if (status === 'QUEUED' || status === 'ACTIVE') return 'pending' as const;
  if (status === 'CANCELLED') {
    throw createRagEvalSmokeFailureError('JOB_POLL', 'CANCELLED', status);
  }
  throw createRagEvalSmokeFailureError('JOB_POLL', 'TERMINAL_FAILED', status);
}

export function assertRagEvalSmokeEvidence(
  hitsByCaseId: Record<string, RagEvalHit[]>,
): RagEvalSmokeEvidenceSummary {
  const retrievalByCaseId = new Map<RagEvalSmokeCaseId, RetrievalEvidence[]>();
  let checkedHitCount = 0;

  for (const caseId of RAG_EVAL_SMOKE_CASE_IDS) {
    const seenChunkIds = new Set<string>();
    const retrievalEvidence: RetrievalEvidence[] = [];

    for (const hit of snapshotCaseHits(hitsByCaseId, caseId)) {
      const snapshot = snapshotEvidenceHit(hit);
      if (seenChunkIds.has(snapshot.chunkId)) {
        failEvidence('duplicate_chunk_id');
      }
      seenChunkIds.add(snapshot.chunkId);
      retrievalEvidence.push(assertHybridRetrieval(snapshot));
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

function snapshotCaseHits(
  hitsByCaseId: Record<string, RagEvalHit[]>,
  caseId: RagEvalSmokeCaseId,
): unknown[] {
  let candidate: unknown;
  try {
    candidate = hitsByCaseId[caseId];
  } catch {
    failEvidence('case_hits_unreadable');
  }
  if (candidate === undefined) return [];

  let isArray = false;
  try {
    isArray = Array.isArray(candidate);
  } catch {
    failEvidence('case_hits_unreadable');
  }
  if (!isArray) failEvidence('case_hits_invalid');

  const snapshots: unknown[] = [];
  try {
    const hits = candidate as unknown[];
    for (let index = 0; index < hits.length; index += 1) {
      snapshots.push(hits[index]);
    }
  } catch {
    failEvidence('case_hits_unreadable');
  }
  return snapshots;
}

function snapshotEvidenceHit(hit: unknown): EvidenceHitSnapshot & {
  chunkId: string;
} {
  if (typeof hit !== 'object' || hit === null) {
    failEvidence('hit_invalid');
  }

  let snapshot: EvidenceHitSnapshot;
  try {
    const record = hit as Record<string, unknown>;
    const metadata = record.metadata;
    const metadataIsRecord = isRecord(metadata);
    const retrieval = metadataIsRecord
      ? (metadata as Record<string, unknown>).retrieval
      : undefined;
    const retrievalIsRecord = isRecord(retrieval);
    const retrievalRecord = retrievalIsRecord
      ? (retrieval as Record<string, unknown>)
      : undefined;
    snapshot = {
      chunkId: record.chunkId,
      metadataIsRecord,
      retrievalIsRecord,
      mode: retrievalRecord?.mode,
      vectorScore: retrievalRecord?.vectorScore,
      keywordScore: retrievalRecord?.keywordScore,
    };
  } catch {
    failEvidence('hit_unreadable');
  }

  if (typeof snapshot.chunkId !== 'string') {
    failEvidence('hit_invalid');
  }
  return snapshot as EvidenceHitSnapshot & { chunkId: string };
}

function assertHybridRetrieval(
  snapshot: EvidenceHitSnapshot,
): RetrievalEvidence {
  if (!snapshot.metadataIsRecord || !snapshot.retrievalIsRecord) {
    failEvidence('retrieval_metadata_missing');
  }
  if (snapshot.mode !== 'hybrid') {
    failEvidence('retrieval_mode_invalid');
  }
  if (
    typeof snapshot.vectorScore !== 'number' ||
    !Number.isFinite(snapshot.vectorScore) ||
    typeof snapshot.keywordScore !== 'number' ||
    !Number.isFinite(snapshot.keywordScore)
  ) {
    failEvidence('retrieval_score_invalid');
  }

  return snapshot as RetrievalEvidence;
}

function isRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failEvidence(code: string): never {
  throw new Error(`RAG eval smoke evidence failed: ${code}.`);
}
