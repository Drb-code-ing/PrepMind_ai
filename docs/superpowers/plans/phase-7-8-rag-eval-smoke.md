# Phase 7.8.3 RAG Eval Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local API-level RAG Eval smoke script that verifies upload, processing, hybrid search, and eval metrics against a running PrepMind server.

**Architecture:** Keep metric calculation in existing `runRagEval()`. Add a pure reporter with Jest coverage, then add a local `apps/server/scripts/rag-eval-smoke.ts` orchestration script that calls the real REST API and prints a safe report.

**Tech Stack:** TypeScript, NestJS API over HTTP, Node 20+ native `fetch`, `FormData`, `Blob`, Jest, existing RAG Eval types and runner.

---

## File Structure

- Create `apps/server/src/knowledge-documents/evals/rag-eval-report.ts`
  - Formats `RagEvalSummary` plus per-case smoke metadata into readable terminal text.
- Create `apps/server/src/knowledge-documents/evals/rag-eval-report.spec.ts`
  - Tests report text for passed and failed summaries without network or database.
- Create `apps/server/scripts/rag-eval-smoke.ts`
  - Runs local API smoke: register, upload, process, poll, search, eval, cleanup.
- Modify `apps/server/package.json`
  - Adds `smoke:rag-eval`.

---

## Task 1: Add RAG Eval Report Formatter

**Files:**
- Create: `apps/server/src/knowledge-documents/evals/rag-eval-report.spec.ts`
- Create: `apps/server/src/knowledge-documents/evals/rag-eval-report.ts`

- [ ] **Step 1: Write the failing reporter tests**

Create `apps/server/src/knowledge-documents/evals/rag-eval-report.spec.ts`:

```ts
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
        caseId: input.failed ? 'semantic-review-pressure' : 'exact-blue-lantern',
        name: input.failed ? 'Semantic rewrite retrieval' : 'Exact term retrieval',
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
```

- [ ] **Step 2: Run RED verification**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-report
```

Expected: FAIL because `./rag-eval-report` does not exist.

- [ ] **Step 3: Implement the formatter**

Create `apps/server/src/knowledge-documents/evals/rag-eval-report.ts`:

```ts
import type { RagEvalSummary } from './rag-eval.types';

export type RagEvalSmokeCaseHitSummary = {
  hitCount: number;
  topScore?: number;
  topDocumentName?: string;
};

export type FormatRagEvalSmokeReportInput = {
  title: string;
  baseUrl: string;
  documentName: string;
  documentId: string;
  durationMs: number;
  caseHits: Record<string, RagEvalSmokeCaseHitSummary>;
  summary: RagEvalSummary;
};

export function formatRagEvalSmokeReport(
  input: FormatRagEvalSmokeReportInput,
) {
  const lines = [
    input.title,
    '',
    `Status: ${input.summary.failed === 0 ? 'PASS' : 'FAIL'}`,
    `Base URL: ${input.baseUrl}`,
    `Document: ${input.documentName} (${input.documentId})`,
    `Duration: ${input.durationMs}ms`,
    '',
    'Metrics',
    `- Passed: ${input.summary.passed}/${input.summary.total}`,
    `- Recall@K: ${formatPercent(input.summary.recallAtK)}`,
    `- Top1 Accuracy: ${formatPercent(input.summary.top1Accuracy)}`,
    `- Safety Pass Rate: ${formatPercent(input.summary.safetyPassRate)}`,
    `- No-hit Pass Rate: ${formatPercent(input.summary.noHitPassRate)}`,
    '',
    'Case Hits',
    ...input.summary.results.map((result) => formatCaseHit(input.caseHits, result.caseId)),
  ];

  const failedResults = input.summary.results.filter((result) => !result.passed);
  if (failedResults.length > 0) {
    lines.push('', 'Failed Cases');
    for (const result of failedResults) {
      lines.push(`- ${result.caseId} (${result.name})`);
      for (const reason of result.reasons) {
        lines.push(`  - ${reason}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatCaseHit(
  caseHits: Record<string, RagEvalSmokeCaseHitSummary>,
  caseId: string,
) {
  const hit = caseHits[caseId] ?? { hitCount: 0 };
  const score = hit.topScore === undefined ? 'n/a' : hit.topScore.toFixed(6);
  const document = hit.topDocumentName ?? 'n/a';
  return `- ${caseId}: hits=${hit.hitCount} topScore=${score} topDocument=${document}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
```

- [ ] **Step 4: Run GREEN verification**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-report
```

Expected: PASS.

- [ ] **Step 5: Commit reporter**

Run:

```powershell
git add apps/server/src/knowledge-documents/evals/rag-eval-report.ts apps/server/src/knowledge-documents/evals/rag-eval-report.spec.ts
git commit -m "feat(server): add rag eval smoke reporter"
```

Expected: commit succeeds.

---

## Task 2: Add Local RAG Eval Smoke Script

**Files:**
- Create: `apps/server/scripts/rag-eval-smoke.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add package script**

Modify `apps/server/package.json` scripts:

```json
"smoke:rag-eval": "ts-node -r tsconfig-paths/register scripts/rag-eval-smoke.ts"
```

- [ ] **Step 2: Create smoke script**

Create `apps/server/scripts/rag-eval-smoke.ts`:

```ts
import { ragEvalCases } from '../src/knowledge-documents/evals/rag-eval-cases';
import { formatRagEvalSmokeReport } from '../src/knowledge-documents/evals/rag-eval-report';
import { runRagEval } from '../src/knowledge-documents/evals/rag-eval-runner';
import type { RagEvalCase, RagEvalHit } from '../src/knowledge-documents/evals/rag-eval.types';

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

const smokeCases = ragEvalCases.filter((testCase) =>
  ['exact-blue-lantern', 'semantic-review-pressure', 'cross-language-weak-points'].includes(
    testCase.id,
  ),
);

async function main() {
  const startedAt = Date.now();
  const baseUrl = stripTrailingSlash(process.env.RAG_EVAL_SMOKE_BASE_URL ?? 'http://localhost:3001');
  const password = process.env.RAG_EVAL_SMOKE_PASSWORD ?? 'Password123!';
  const timeoutMs = readPositiveInteger('RAG_EVAL_SMOKE_TIMEOUT_MS', 120000);
  const pollIntervalMs = readPositiveInteger('RAG_EVAL_SMOKE_POLL_INTERVAL_MS', 1500);
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
    const caseHits: Record<string, { hitCount: number; topScore?: number; topDocumentName?: string }> = {};

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
        process.stderr.write(`Warning: failed to delete smoke document: ${messageOf(error)}\n`);
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

async function uploadDocument(baseUrl: string, accessToken: string, documentName: string) {
  const form = new FormData();
  form.set('file', new Blob([smokeDocumentContent()], { type: 'text/plain' }), documentName);
  return request<KnowledgeDocument>(baseUrl, '/knowledge/documents', {
    method: 'POST',
    body: form,
    headers: authorization(accessToken),
  });
}

async function processDocument(baseUrl: string, accessToken: string, documentId: string) {
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
      throw new Error(`Document processing failed: ${document.errorMessage ?? 'unknown error'}`);
    }
    await sleep(input.pollIntervalMs);
  }
  throw new Error(`Document processing timed out after ${input.timeoutMs}ms.`);
}

async function search(baseUrl: string, accessToken: string, testCase: RagEvalCase) {
  const response = await request<KnowledgeSearchResponse>(baseUrl, '/knowledge/search', {
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
  });
  return response.hits;
}

async function deleteDocument(baseUrl: string, accessToken: string, documentId: string) {
  await request<unknown>(baseUrl, `/knowledge/documents/${documentId}`, {
    method: 'DELETE',
    headers: authorization(accessToken),
  });
}

async function request<T>(baseUrl: string, path: string, init: RequestInit): Promise<T> {
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
```

- [ ] **Step 3: Type/build verification**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS. If Node global `RequestInit`, `FormData`, or `Blob` types are unavailable, use Node-compatible imports or adjust server tsconfig-compatible types without changing runtime behavior.

- [ ] **Step 4: Commit script**

Run:

```powershell
git add apps/server/package.json apps/server/scripts/rag-eval-smoke.ts
git commit -m "feat(server): add rag eval smoke script"
```

Expected: commit succeeds.

---

## Task 3: Run Verification and Optional Real Smoke

**Files:**
- No source edits expected unless verification reveals a real defect.

- [ ] **Step 1: Run reporter tests**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-report
```

Expected: PASS.

- [ ] **Step 2: Run existing eval runner tests**

Run:

```powershell
bun --filter @repo/server test -- rag-eval-runner
```

Expected: PASS.

- [ ] **Step 3: Run server build**

Run:

```powershell
bun --filter @repo/server build
```

Expected: PASS.

- [ ] **Step 4: Check diff whitespace**

Run:

```powershell
git diff --check
```

Expected: no output and exit code 0.

- [ ] **Step 5: Run local smoke when server is already running**

Precondition: local API is listening on `RAG_EVAL_SMOKE_BASE_URL` or `http://localhost:3001`, and `.env` has a working embedding provider.

Run:

```powershell
bun --filter @repo/server smoke:rag-eval
```

Expected: report prints `Status: PASS`, document processing reaches `DONE`, and all smoke cases pass. If the API is not running, record that code verification passed and smoke is blocked by runtime availability.

- [ ] **Step 6: Commit any verification-driven fixes**

Only if verification required source changes:

```powershell
git add <changed-files>
git commit -m "fix(server): stabilize rag eval smoke"
```

Expected: commit succeeds or no commit is needed.

---

## Self-Review

- Spec coverage: The plan implements reporter, local API script, package entry, non-CI boundary, safe output, and verification.
- Placeholder scan: No open placeholders remain; every source edit includes exact file paths and concrete code.
- Type consistency: `RagEvalSummary`, `RagEvalCase`, and `RagEvalHit` are reused from the existing eval module; reporter input types are local to the reporter.
- Scope check: The plan does not add DB persistence, frontend UI, live Chat, reranker, or query rewrite.
