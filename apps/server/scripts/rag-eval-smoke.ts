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
  RagEvalSmokeFailureError,
  assertRagEvalSmokeBackgroundJobStatus,
  assertRagEvalSmokeEvidence,
  createRagEvalSmokeFailureError,
  fetchRagEvalSmokeResponse,
  formatRagEvalSmokeFailure,
  selectRagEvalSmokeCases,
  shouldKeepRagEvalSmokeData,
} from '../src/knowledge-documents/evals/rag-eval-smoke-config';
import type {
  RagEvalSmokeFailure,
  RagEvalSmokeFailureStage,
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

type SmokeCaseHitSummary = {
  hitCount: number;
  topScore?: number;
  topDocumentName?: string;
};

type SmokeRequestContext = {
  deadlineAt: number;
  requestTimeoutMs: number;
  signal: AbortSignal;
};

const smokeCases = selectRagEvalSmokeCases(ragEvalCases);

async function main() {
  const startedAt = Date.now();
  const baseUrl = stripTrailingSlash(
    process.env.RAG_EVAL_SMOKE_BASE_URL ?? 'http://localhost:3001',
  );
  const password = process.env.RAG_EVAL_SMOKE_PASSWORD ?? 'Password123!';
  const timeoutMs = readPositiveInteger('RAG_EVAL_SMOKE_TIMEOUT_MS', 120000);
  const requestTimeoutMs = readPositiveInteger(
    'RAG_EVAL_SMOKE_REQUEST_TIMEOUT_MS',
    Math.min(timeoutMs, 15000),
  );
  const cleanupTimeoutMs = readPositiveInteger(
    'RAG_EVAL_SMOKE_CLEANUP_TIMEOUT_MS',
    10000,
  );
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
  const runController = new AbortController();
  const runContext: SmokeRequestContext = {
    deadlineAt: startedAt + timeoutMs,
    requestTimeoutMs,
    signal: runController.signal,
  };

  try {
    accessToken = await register(baseUrl, email, password, runContext);
    const document = await uploadDocument(
      baseUrl,
      accessToken,
      documentName,
      runContext,
    );
    documentId = document.id;
    const processResponse = await processDocument(
      baseUrl,
      accessToken,
      documentId,
      runContext,
    );
    await waitForBackgroundJobSucceeded({
      baseUrl,
      accessToken,
      backgroundJobId: processResponse.processing.backgroundJobId,
      pollIntervalMs,
      context: runContext,
    });
    const processedDocument = await getProcessedDocument(
      baseUrl,
      accessToken,
      documentId,
      runContext,
    );

    const hitsByCaseId: Record<string, RagEvalHit[]> = {};
    const caseHits: Record<string, SmokeCaseHitSummary> = {};

    for (const testCase of smokeCases) {
      const hits = await search(baseUrl, accessToken, testCase, runContext);
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
        const cleanupController = new AbortController();
        const cleanupContext: SmokeRequestContext = {
          deadlineAt: Date.now() + cleanupTimeoutMs,
          requestTimeoutMs: cleanupTimeoutMs,
          signal: cleanupController.signal,
        };
        await deleteDocument(
          baseUrl,
          accessToken,
          documentId,
          cleanupContext,
        ).catch((error) => {
          const failure =
            error instanceof RagEvalSmokeFailureError
              ? error.failure
              : formatRagEvalSmokeFailure('DELETE', 'UNEXPECTED', error);
          process.stderr.write(`Warning: ${formatFailureLine(failure)}\n`);
        });
      }
    }
  }
}

async function register(
  baseUrl: string,
  email: string,
  password: string,
  context: SmokeRequestContext,
) {
  const response = await request<AuthResponse>(
    baseUrl,
    '/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, name: 'RAG Eval Smoke' }),
      headers: { 'content-type': 'application/json' },
    },
    'REGISTER',
    context,
  );
  if (!response.accessToken) {
    throw createRagEvalSmokeFailureError('REGISTER', 'MISSING_DATA', response);
  }
  return response.accessToken;
}

async function uploadDocument(
  baseUrl: string,
  accessToken: string,
  documentName: string,
  context: SmokeRequestContext,
) {
  const form = new FormData();
  form.set(
    'file',
    new Blob([smokeDocumentContent()], { type: 'text/plain' }),
    documentName,
  );

  return request<KnowledgeDocumentResponse>(
    baseUrl,
    '/knowledge/documents',
    {
      method: 'POST',
      body: form,
      headers: authorization(accessToken),
    },
    'UPLOAD',
    context,
  );
}

async function processDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
  context: SmokeRequestContext,
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
    'PROCESS',
    context,
  );
  if (
    response.processing?.mode !== 'queue' ||
    !response.processing.backgroundJobId
  ) {
    throw createRagEvalSmokeFailureError('PROCESS', 'INVALID_MODE', response);
  }
  return response as QueuedKnowledgeDocumentProcessResponse;
}

async function waitForBackgroundJobSucceeded(input: {
  baseUrl: string;
  accessToken: string;
  backgroundJobId: string;
  pollIntervalMs: number;
  context: SmokeRequestContext;
}) {
  while (true) {
    const backgroundJob = await request<BackgroundJobResponse>(
      input.baseUrl,
      `/background-jobs/${input.backgroundJobId}`,
      {
        method: 'GET',
        headers: authorization(input.accessToken),
      },
      'JOB_POLL',
      input.context,
    );
    if (
      assertRagEvalSmokeBackgroundJobStatus(backgroundJob.status) ===
      'succeeded'
    ) {
      return backgroundJob;
    }
    await sleepWithinDeadline(input.pollIntervalMs, input.context, 'JOB_POLL');
  }
}

async function getProcessedDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
  context: SmokeRequestContext,
) {
  const document = await request<KnowledgeDocumentResponse>(
    baseUrl,
    `/knowledge/documents/${documentId}`,
    {
      method: 'GET',
      headers: authorization(accessToken),
    },
    'DOCUMENT_POLL',
    context,
  );
  if (document.status !== 'DONE') {
    throw createRagEvalSmokeFailureError(
      'DOCUMENT_POLL',
      'TERMINAL_FAILED',
      document,
    );
  }
  return document;
}

async function search(
  baseUrl: string,
  accessToken: string,
  testCase: RagEvalCase,
  context: SmokeRequestContext,
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
    'SEARCH',
    context,
  );
  return response.hits;
}

async function deleteDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
  context: SmokeRequestContext,
) {
  await request<unknown>(
    baseUrl,
    `/knowledge/documents/${documentId}`,
    {
      method: 'DELETE',
      headers: authorization(accessToken),
    },
    'DELETE',
    context,
  );
}

async function request<T>(
  baseUrl: string,
  path: string,
  init: RequestInit,
  stage: RagEvalSmokeFailureStage,
  context: SmokeRequestContext,
): Promise<T> {
  const { response, text } = await fetchRagEvalSmokeResponse({
    stage,
    url: `${baseUrl}${path}`,
    init,
    deadlineAt: context.deadlineAt,
    requestTimeoutMs: context.requestTimeoutMs,
    signal: context.signal,
  });
  const parsed = parseJson<Envelope<T>>(text, stage);
  if (!response.ok || !parsed.success) {
    throw createRagEvalSmokeFailureError(stage, 'HTTP', {
      apiDetail: parsed.error,
      method: init.method,
      path,
      status: response.status,
      statusText: response.statusText,
    });
  }
  if (parsed.data === undefined) {
    throw createRagEvalSmokeFailureError(stage, 'MISSING_DATA', {
      method: init.method,
      path,
      reason: 'data_missing',
    });
  }
  return parsed.data;
}

function parseJson<T>(text: string, stage: RagEvalSmokeFailureStage): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw createRagEvalSmokeFailureError(stage, 'NON_JSON', { error, text });
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

async function sleepWithinDeadline(
  ms: number,
  context: SmokeRequestContext,
  stage: RagEvalSmokeFailureStage,
) {
  const remainingMs = Math.floor(context.deadlineAt - Date.now());
  if (remainingMs <= 0) {
    throw createRagEvalSmokeFailureError(stage, 'TIMEOUT');
  }
  if (context.signal.aborted) {
    throw createRagEvalSmokeFailureError(stage, 'CANCELLED');
  }

  await new Promise<void>((resolve, reject) => {
    const delayMs = Math.min(ms, remainingMs);
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const cleanup = () =>
      context.signal.removeEventListener('abort', abortListener);
    const abortListener = () => {
      clearTimeout(timeoutHandle);
      cleanup();
      reject(createRagEvalSmokeFailureError(stage, 'CANCELLED'));
    };
    timeoutHandle = setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);
    context.signal.addEventListener('abort', abortListener, { once: true });
  });

  if (Date.now() >= context.deadlineAt) {
    throw createRagEvalSmokeFailureError(stage, 'TIMEOUT');
  }
}

function formatFailureLine(failure: RagEvalSmokeFailure) {
  return failure.message;
}

main().catch((error) => {
  const failure =
    error instanceof RagEvalSmokeFailureError
      ? error.failure
      : formatRagEvalSmokeFailure('SMOKE', 'UNEXPECTED', error);
  process.stderr.write(`${formatFailureLine(failure)}\n`);
  process.exitCode = 1;
});
