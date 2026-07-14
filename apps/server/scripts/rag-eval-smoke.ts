import type { BackgroundJobResponse } from '@repo/types/api/background-job';
import type {
  KnowledgeDocumentProcessResponse,
  KnowledgeDocumentProcessingMetadata,
  KnowledgeDocumentResponse,
} from '@repo/types/api/knowledge';

import { ragEvalCases } from '../src/knowledge-documents/evals/rag-eval-cases';
import { formatRagEvalSmokeReport } from '../src/knowledge-documents/evals/rag-eval-report';
import { runRagEval } from '../src/knowledge-documents/evals/rag-eval-runner';
import {
  assertRagEvalSmokeEvidence,
  formatRagEvalSmokeFailure,
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from '../src/knowledge-documents/evals/rag-eval-smoke-config';
import type {
  RagEvalCase,
  RagEvalHit,
} from '../src/knowledge-documents/evals/rag-eval.types';

type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  requestId?: string;
};

type AuthResponse = {
  accessToken: string;
};

type KnowledgeSearchResponse = {
  hits: RagEvalHit[];
};

type QueuedKnowledgeDocumentProcessResponse =
  KnowledgeDocumentProcessResponse & {
    processing: KnowledgeDocumentProcessingMetadata;
  };

type RagEvalSmokeFailure = ReturnType<typeof formatRagEvalSmokeFailure>;

type SmokeCaseHitSummary = {
  hitCount: number;
  topScore?: number;
  topDocumentName?: string;
};

const smokeCases = selectRagEvalSmokeCases(ragEvalCases);

async function main() {
  const startedAt = Date.now();
  const baseUrl = stripTrailingSlash(
    process.env.RAG_EVAL_SMOKE_BASE_URL ?? 'http://localhost:3001',
  );
  const password = process.env.RAG_EVAL_SMOKE_PASSWORD ?? 'Password123!';
  const timeoutMs = readPositiveInteger('RAG_EVAL_SMOKE_TIMEOUT_MS', 120000);
  const pollIntervalMs = readPositiveInteger(
    'RAG_EVAL_SMOKE_POLL_INTERVAL_MS',
    1500,
  );
  const keepData = shouldKeepRagEvalSmokeData(process.env);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const email = `rag-eval-smoke-${stamp}@example.com`;
  const documentName = `prepmind-rag-eval-smoke-${stamp}.txt`;
  let accessToken = '';
  let documentId = '';

  try {
    accessToken = await register(baseUrl, email, password);
    const document = await uploadDocument(baseUrl, accessToken, documentName);
    documentId = document.id;
    const processResponse = await processDocument(
      baseUrl,
      accessToken,
      documentId,
    );
    await waitForBackgroundJobSucceeded({
      baseUrl,
      accessToken,
      backgroundJobId: processResponse.processing.backgroundJobId,
      timeoutMs,
      pollIntervalMs,
    });
    const processedDocument = await getProcessedDocument(
      baseUrl,
      accessToken,
      documentId,
    );

    const hitsByCaseId: Record<string, RagEvalHit[]> = {};
    const caseHits: Record<string, SmokeCaseHitSummary> = {};

    for (const testCase of smokeCases) {
      const hits = await search(baseUrl, accessToken, testCase);
      hitsByCaseId[testCase.id] = hits;
      caseHits[testCase.id] = {
        hitCount: hits.length,
        topScore: hits[0]?.score,
        topDocumentName: hits[0]?.documentName,
      };
    }

    const runtimeEvidence = assertRagEvalSmokeEvidence(hitsByCaseId);

    const summary = runRagEval({
      cases: smokeCases,
      hitsByCaseId,
    });

    process.stdout.write(
      formatRagEvalSmokeReport({
        title: 'PrepMind RAG Eval Smoke',
        baseUrl: '[redacted]',
        documentName: processedDocument.name,
        documentId: processedDocument.id,
        durationMs: Date.now() - startedAt,
        caseHits,
        summary,
      }),
    );
    process.stdout.write(
      `Runtime evidence: mode=${runtimeEvidence.mode} checkedHits=${runtimeEvidence.checkedHitCount}\n`,
    );

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (accessToken && documentId) {
      if (keepData) {
        process.stderr.write(
          `RAG eval smoke kept document ${documentId} for local inspection because RAG_EVAL_SMOKE_KEEP_DATA=true.\n`,
        );
      } else {
        await deleteDocument(baseUrl, accessToken, documentId).catch(
          (error) => {
            const failure = formatRagEvalSmokeFailure('CLEANUP_FAILED', error);
            process.stderr.write(`Warning: ${formatFailureLine(failure)}\n`);
          },
        );
      }
    }
  }
}

async function register(baseUrl: string, email: string, password: string) {
  const response = await request<AuthResponse>(baseUrl, '/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: 'RAG Eval Smoke' }),
    headers: { 'content-type': 'application/json' },
  });
  if (!response.accessToken) {
    throw new Error('Register response did not include accessToken.');
  }
  return response.accessToken;
}

async function uploadDocument(
  baseUrl: string,
  accessToken: string,
  documentName: string,
) {
  const form = new FormData();
  form.set(
    'file',
    new Blob([smokeDocumentContent()], { type: 'text/plain' }),
    documentName,
  );

  return request<KnowledgeDocumentResponse>(baseUrl, '/knowledge/documents', {
    method: 'POST',
    body: form,
    headers: authorization(accessToken),
  });
}

async function processDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
): Promise<QueuedKnowledgeDocumentProcessResponse> {
  const response = await request<KnowledgeDocumentProcessResponse>(
    baseUrl,
    `/knowledge/documents/${documentId}/process`,
    {
      method: 'POST',
      body: JSON.stringify({ force: true }),
      headers: {
        ...authorization(accessToken),
        'content-type': 'application/json',
      },
    },
  );
  if (
    response.processing?.mode !== 'queue' ||
    !response.processing.backgroundJobId
  ) {
    throw smokeFailureError('DOCUMENT_PROCESSING_FAILED', response);
  }
  return response as QueuedKnowledgeDocumentProcessResponse;
}

async function waitForBackgroundJobSucceeded(input: {
  baseUrl: string;
  accessToken: string;
  backgroundJobId: string;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const backgroundJob = await request<BackgroundJobResponse>(
      input.baseUrl,
      `/background-jobs/${input.backgroundJobId}`,
      {
        method: 'GET',
        headers: authorization(input.accessToken),
      },
    );
    if (backgroundJob.status === 'SUCCEEDED') return backgroundJob;
    if (
      backgroundJob.status === 'FAILED' ||
      backgroundJob.status === 'STALE_SKIPPED'
    ) {
      throw smokeFailureError('DOCUMENT_PROCESSING_FAILED', backgroundJob);
    }
    await sleep(input.pollIntervalMs);
  }
  throw smokeFailureError('DOCUMENT_PROCESSING_FAILED', input.timeoutMs);
}

async function getProcessedDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
) {
  const document = await request<KnowledgeDocumentResponse>(
    baseUrl,
    `/knowledge/documents/${documentId}`,
    {
      method: 'GET',
      headers: authorization(accessToken),
    },
  );
  if (document.status !== 'DONE') {
    throw smokeFailureError('DOCUMENT_PROCESSING_FAILED', document);
  }
  return document;
}

async function search(
  baseUrl: string,
  accessToken: string,
  testCase: RagEvalCase,
) {
  const response = await request<KnowledgeSearchResponse>(
    baseUrl,
    '/knowledge/search',
    {
      method: 'POST',
      body: JSON.stringify({
        query: testCase.query,
        topK: testCase.topK,
        minScore: 0,
      }),
      headers: {
        ...authorization(accessToken),
        'content-type': 'application/json',
      },
    },
  );
  return response.hits;
}

async function deleteDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
) {
  await request<unknown>(baseUrl, `/knowledge/documents/${documentId}`, {
    method: 'DELETE',
    headers: authorization(accessToken),
  });
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
    text = await response.text();
  } catch (error) {
    throw smokeFailureError('FETCH_FAILED', error);
  }
  const parsed = parseJson<Envelope<T>>(text);
  if (!response.ok || !parsed.success) {
    throw smokeFailureError('API_REQUEST_FAILED', {
      apiDetail: parsed.error,
      method: init.method,
      path,
      status: response.status,
      statusText: response.statusText,
    });
  }
  if (parsed.data === undefined) {
    throw smokeFailureError('API_REQUEST_FAILED', {
      method: init.method,
      path,
      reason: 'data_missing',
    });
  }
  return parsed.data;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw smokeFailureError('API_REQUEST_FAILED', { error, text });
  }
}

function authorization(accessToken: string) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

function smokeDocumentContent() {
  return [
    'PrepMind RAG Eval Smoke Document.',
    '',
    'Exact keyword section:',
    'The unique retrieval answer is: blue lantern theorem.',
    'This line is designed to prove keyword retrieval can rescue exact terms.',
    '',
    'Semantic review section:',
    'The review algorithm uses spaced repetition and scheduling pressure.',
    'Students should review weak knowledge points before increasing daily card limits.',
    '',
    'Safety section:',
    'This document is normal study material and contains no tool instructions.',
  ].join('\n');
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class RagEvalSmokeFailureError extends Error {
  constructor(readonly failure: RagEvalSmokeFailure) {
    super(failure.message);
    this.name = 'RagEvalSmokeFailureError';
  }
}

function smokeFailureError(
  code: Parameters<typeof formatRagEvalSmokeFailure>[0],
  unsafeDetail?: unknown,
) {
  return new RagEvalSmokeFailureError(
    formatRagEvalSmokeFailure(code, unsafeDetail),
  );
}

function formatFailureLine(failure: RagEvalSmokeFailure) {
  return `[${failure.code}] ${failure.message}`;
}

main().catch((error) => {
  const failure =
    error instanceof RagEvalSmokeFailureError
      ? error.failure
      : formatRagEvalSmokeFailure('UNEXPECTED_FAILURE', error);
  process.stderr.write(`${formatFailureLine(failure)}\n`);
  process.exitCode = 1;
});
