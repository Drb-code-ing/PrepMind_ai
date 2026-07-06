import { ragEvalCases } from '../src/knowledge-documents/evals/rag-eval-cases';
import { formatRagEvalSmokeReport } from '../src/knowledge-documents/evals/rag-eval-report';
import { runRagEval } from '../src/knowledge-documents/evals/rag-eval-runner';
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

type KnowledgeDocument = {
  id: string;
  name: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  chunkCount?: number;
  errorMessage?: string | null;
};

type KnowledgeSearchResponse = {
  hits: RagEvalHit[];
};

type SmokeCaseHitSummary = {
  hitCount: number;
  topScore?: number;
  topDocumentName?: string;
};

const SMOKE_CASE_IDS = [
  'exact-blue-lantern',
  'semantic-review-pressure',
  'cross-language-weak-points',
];

const smokeCases = ragEvalCases.filter((testCase) =>
  SMOKE_CASE_IDS.includes(testCase.id),
);

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
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const email = `rag-eval-smoke-${stamp}@example.com`;
  const documentName = `prepmind-rag-eval-smoke-${stamp}.txt`;
  let accessToken = '';
  let documentId = '';

  try {
    accessToken = await register(baseUrl, email, password);
    const document = await uploadDocument(baseUrl, accessToken, documentName);
    documentId = document.id;
    await processDocument(baseUrl, accessToken, documentId);
    const processedDocument = await waitForDocumentDone({
      baseUrl,
      accessToken,
      documentId,
      timeoutMs,
      pollIntervalMs,
    });

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

    const summary = runRagEval({
      cases: smokeCases,
      hitsByCaseId,
    });

    process.stdout.write(
      formatRagEvalSmokeReport({
        title: 'PrepMind RAG Eval Smoke',
        baseUrl,
        documentName: processedDocument.name,
        documentId: processedDocument.id,
        durationMs: Date.now() - startedAt,
        caseHits,
        summary,
      }),
    );

    if (summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (accessToken && documentId) {
      await deleteDocument(baseUrl, accessToken, documentId).catch((error) => {
        process.stderr.write(
          `Warning: failed to delete smoke document: ${messageOf(error)}\n`,
        );
      });
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

  return request<KnowledgeDocument>(baseUrl, '/knowledge/documents', {
    method: 'POST',
    body: form,
    headers: authorization(accessToken),
  });
}

async function processDocument(
  baseUrl: string,
  accessToken: string,
  documentId: string,
) {
  await request<unknown>(baseUrl, `/knowledge/documents/${documentId}/process`, {
    method: 'POST',
    body: JSON.stringify({ force: true }),
    headers: {
      ...authorization(accessToken),
      'content-type': 'application/json',
    },
  });
}

async function waitForDocumentDone(input: {
  baseUrl: string;
  accessToken: string;
  documentId: string;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const document = await request<KnowledgeDocument>(
      input.baseUrl,
      `/knowledge/documents/${input.documentId}`,
      {
        method: 'GET',
        headers: authorization(input.accessToken),
      },
    );
    if (document.status === 'DONE') return document;
    if (document.status === 'FAILED') {
      throw new Error(
        `Document processing failed: ${document.errorMessage ?? 'unknown error'}`,
      );
    }
    await sleep(input.pollIntervalMs);
  }
  throw new Error(`Document processing timed out after ${input.timeoutMs}ms.`);
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
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const parsed = parseJson<Envelope<T>>(text);
  if (!response.ok || !parsed.success) {
    const detail = parsed.error?.message ?? response.statusText ?? 'request failed';
    throw new Error(`${init.method ?? 'GET'} ${path} failed: ${detail}`);
  }
  if (parsed.data === undefined) {
    throw new Error(`${init.method ?? 'GET'} ${path} did not return data.`);
  }
  return parsed.data;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('API returned non-JSON response.');
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

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  process.stderr.write(`RAG eval smoke failed: ${messageOf(error)}\n`);
  process.exitCode = 1;
});
