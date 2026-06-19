# Phase 5.6 Knowledge Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/knowledge` page so users can upload, process, delete, and test-search their RAG documents from the frontend.

**Architecture:** Keep the backend unchanged and build a frontend-only integration layer. Add a focused `knowledge-api` client, TanStack Query hooks, small view helpers, a mobile-first `/knowledge` page, and a sidebar entry. Knowledge document management remains online-only and does not enter Dexie `mutationQueue`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, TanStack Query, shadcn/ui primitives, lucide-react, `@repo/types/api/knowledge`, Bun workspace.

---

## File Map

- Create `apps/web/src/lib/knowledge-api.ts`: frontend API client for `/knowledge/documents` and `/knowledge/search`.
- Create `apps/web/src/lib/knowledge-api.test.mts`: request/response tests for the API client.
- Create `apps/web/src/lib/knowledge-view.ts`: pure formatting helpers for document status, file size, dates, and search hit summaries.
- Create `apps/web/src/lib/knowledge-view.test.mts`: tests for view helper behavior.
- Create `apps/web/src/hooks/use-knowledge.ts`: TanStack Query hooks and query keys.
- Create `apps/web/src/app/(main)/knowledge/page.tsx`: user-facing knowledge workspace.
- Modify `apps/web/src/components/chat/chat-sidebar.tsx`: add the Knowledge entry.
- Update docs after implementation: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/data-flow.md`, `docs/roadmap.md`, `DEVLOG.md`.

---

## Task 1: Knowledge API Client

**Files:**

- Create: `apps/web/src/lib/knowledge-api.ts`
- Create: `apps/web/src/lib/knowledge-api.test.mts`

- [ ] **Step 1: Write failing API client tests**

Create `apps/web/src/lib/knowledge-api.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { createApiClient } from './api-client.ts';
import { createKnowledgeApi } from './knowledge-api.ts';

test('uploads a knowledge document with multipart form data and bearer token', async () => {
  const requests: CapturedRequest[] = [];
  const api = createKnowledgeApi({
    client: createTestClient(requests, createDocumentPayload({ id: 'doc_upload' })),
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        contentType: new Headers(init?.headers).get('content-type'),
        body: init?.body,
      });

      return jsonResponse({
        success: true,
        data: createDocumentPayload({ id: 'doc_upload' }),
        requestId: 'req_1',
      });
    },
  });

  const file = new File(['# calculus'], 'calculus.md', { type: 'text/markdown' });
  const result = await api.uploadDocument('token_1', file);

  assert.equal(requests[0]?.input, 'http://localhost:3001/knowledge/documents');
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.authorization, 'Bearer token_1');
  assert.equal(requests[0]?.contentType, null);
  assert.ok(requests[0]?.body instanceof FormData);
  assert.equal(result.id, 'doc_upload');
  assert.equal(result.status, 'PENDING');
});

test('lists documents with filters and cursor', async () => {
  const requests: CapturedRequest[] = [];
  const api = createKnowledgeApi({
    client: createTestClient(requests, {
      items: [createDocumentPayload({ status: 'DONE', chunkCount: 3 })],
      nextCursor: 'doc_next',
    }),
    baseUrl: 'http://localhost:3001',
  });

  const result = await api.listDocuments('token_1', {
    status: 'DONE',
    sourceType: 'UPLOAD',
    limit: 10,
    cursor: 'doc_cursor',
  });

  assert.equal(
    requests[0]?.input,
    'http://localhost:3001/knowledge/documents?status=DONE&sourceType=UPLOAD&limit=10&cursor=doc_cursor',
  );
  assert.equal(requests[0]?.method, 'GET');
  assert.equal(requests[0]?.authorization, 'Bearer token_1');
  assert.equal(result.items[0]?.chunkCount, 3);
  assert.equal(result.nextCursor, 'doc_next');
});

test('gets, processes, deletes, and searches knowledge documents', async () => {
  const detailRequests: CapturedRequest[] = [];
  const detailApi = createKnowledgeApi({
    client: createTestClient(detailRequests, createDocumentPayload({ id: 'doc_1' })),
    baseUrl: 'http://localhost:3001',
  });

  await detailApi.getDocument('token_1', 'doc_1');
  assert.equal(detailRequests[0]?.input, 'http://localhost:3001/knowledge/documents/doc_1');
  assert.equal(detailRequests[0]?.method, 'GET');

  const processRequests: CapturedRequest[] = [];
  const processApi = createKnowledgeApi({
    client: createTestClient(processRequests, createDocumentPayload({ status: 'DONE' })),
    baseUrl: 'http://localhost:3001',
  });

  const processed = await processApi.processDocument('token_1', 'doc_1', { force: true });
  assert.equal(
    processRequests[0]?.input,
    'http://localhost:3001/knowledge/documents/doc_1/process',
  );
  assert.equal(processRequests[0]?.method, 'POST');
  assert.deepEqual(processRequests[0]?.jsonBody, { force: true });
  assert.equal(processed.status, 'DONE');

  const deleteRequests: CapturedRequest[] = [];
  const deleteApi = createKnowledgeApi({
    client: createTestClient(deleteRequests, { ok: true }),
    baseUrl: 'http://localhost:3001',
  });

  const deleted = await deleteApi.deleteDocument('token_1', 'doc_1');
  assert.equal(deleteRequests[0]?.input, 'http://localhost:3001/knowledge/documents/doc_1');
  assert.equal(deleteRequests[0]?.method, 'DELETE');
  assert.deepEqual(deleted, { ok: true });

  const searchRequests: CapturedRequest[] = [];
  const searchApi = createKnowledgeApi({
    client: createTestClient(searchRequests, {
      hits: [
        {
          chunkId: 'chunk_1',
          documentId: 'doc_1',
          documentName: 'calculus.md',
          content: 'Green theorem reference',
          score: 0.86,
          metadata: { chunkIndex: 2 },
        },
      ],
    }),
    baseUrl: 'http://localhost:3001',
  });

  const searched = await searchApi.search('token_1', {
    query: 'Green theorem',
    topK: 5,
    minScore: 0.7,
  });

  assert.equal(searchRequests[0]?.input, 'http://localhost:3001/knowledge/search');
  assert.equal(searchRequests[0]?.method, 'POST');
  assert.deepEqual(searchRequests[0]?.jsonBody, {
    query: 'Green theorem',
    topK: 5,
    minScore: 0.7,
  });
  assert.equal(searched.hits[0]?.documentName, 'calculus.md');
});

function createTestClient(requests: CapturedRequest[], data: unknown) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        contentType: new Headers(init?.headers).get('content-type'),
        jsonBody: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return jsonResponse({
        success: true,
        data,
        requestId: 'req_1',
      });
    },
  });
}

function createDocumentPayload(input: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc_1',
    name: 'calculus.md',
    type: 'MD',
    size: 1024,
    mimeType: 'text/markdown',
    status: 'PENDING',
    sourceType: 'UPLOAD',
    errorMessage: null,
    contentHash: 'hash_1',
    chunkCount: 0,
    processedAt: null,
    createdAt: '2026-06-19T08:00:00.000Z',
    updatedAt: '2026-06-19T08:00:00.000Z',
    ...input,
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  body?: unknown;
  jsonBody?: unknown;
};
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/knowledge-api.test.mts
```

Expected: fail with module not found for `./knowledge-api.ts`.

- [ ] **Step 3: Implement API client**

Create `apps/web/src/lib/knowledge-api.ts`:

```ts
import {
  knowledgeDocumentDeleteResponseSchema,
  knowledgeDocumentDetailResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentProcessRequestSchema,
  knowledgeDocumentProcessResponseSchema,
  knowledgeDocumentUploadResponseSchema,
  knowledgeSearchRequestSchema,
  knowledgeSearchResponseSchema,
  type KnowledgeDocumentListQuery,
  type KnowledgeDocumentProcessRequest,
  type KnowledgeSearchRequest,
} from '@repo/types/api/knowledge';

import { ApiClientError, apiClient } from './api-client.ts';

type FetchLike = typeof fetch;

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

type CreateKnowledgeApiOptions = {
  client: ApiClient;
  baseUrl?: string;
  fetchImpl?: FetchLike;
};

type ApiFailureBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
};

type ApiSuccessBody<T> = {
  success: true;
  data: T;
  requestId?: string;
};

export function createKnowledgeApi({
  client,
  baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  fetchImpl = fetch,
}: CreateKnowledgeApiOptions) {
  return {
    async uploadDocument(accessToken: string, file: File) {
      const body = new FormData();
      body.append('file', file);

      let response: Response;
      try {
        response = await fetchImpl(toUrl(baseUrl, '/knowledge/documents'), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body,
        });
      } catch {
        throw new ApiClientError('网络连接失败，请稍后重试', {
          status: 0,
          code: 'NETWORK_ERROR',
        });
      }

      const payload = await parseJson(response);
      if (isApiSuccess<unknown>(payload)) {
        return knowledgeDocumentUploadResponseSchema.parse(payload.data);
      }
      if (isApiFailure(payload)) {
        throw new ApiClientError(payload.error.message, {
          status: response.status,
          code: payload.error.code,
          requestId: payload.requestId,
        });
      }

      throw new ApiClientError('服务响应格式异常', {
        status: response.status,
        code: 'INVALID_API_RESPONSE',
      });
    },

    async listDocuments(accessToken: string, query: KnowledgeDocumentListQuery) {
      const params = new URLSearchParams();
      if (query.status) params.set('status', query.status);
      if (query.sourceType) params.set('sourceType', query.sourceType);
      params.set('limit', String(query.limit));
      if (query.cursor) params.set('cursor', query.cursor);

      return knowledgeDocumentListResponseSchema.parse(
        await client.get<unknown>(`/knowledge/documents?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getDocument(accessToken: string, documentId: string) {
      return knowledgeDocumentDetailResponseSchema.parse(
        await client.get<unknown>(`/knowledge/documents/${documentId}`, { accessToken }),
      );
    },

    async processDocument(
      accessToken: string,
      documentId: string,
      request: KnowledgeDocumentProcessRequest,
    ) {
      const body = knowledgeDocumentProcessRequestSchema.parse(request);
      return knowledgeDocumentProcessResponseSchema.parse(
        await client.post<unknown>(`/knowledge/documents/${documentId}/process`, body, {
          accessToken,
        }),
      );
    },

    async deleteDocument(accessToken: string, documentId: string) {
      return knowledgeDocumentDeleteResponseSchema.parse(
        await client.delete<unknown>(`/knowledge/documents/${documentId}`, { accessToken }),
      );
    },

    async search(accessToken: string, request: KnowledgeSearchRequest) {
      const body = knowledgeSearchRequestSchema.parse(request);
      return knowledgeSearchResponseSchema.parse(
        await client.post<unknown>('/knowledge/search', body, { accessToken }),
      );
    },
  };
}

async function parseJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ApiClientError('服务响应格式异常', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
    });
  }
}

function isApiSuccess<T>(value: unknown): value is ApiSuccessBody<T> {
  return isRecord(value) && value.success === true && 'data' in value;
}

function isApiFailure(value: unknown): value is ApiFailureBody {
  return (
    isRecord(value) &&
    value.success === false &&
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const knowledgeApi = createKnowledgeApi({
  client: apiClient,
});
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/knowledge-api.test.mts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/knowledge-api.ts apps/web/src/lib/knowledge-api.test.mts
git commit -m "feat: add knowledge api client"
```

---

## Task 2: Knowledge View Helpers

**Files:**

- Create: `apps/web/src/lib/knowledge-view.ts`
- Create: `apps/web/src/lib/knowledge-view.test.mts`

- [ ] **Step 1: Write failing view helper tests**

Create `apps/web/src/lib/knowledge-view.test.mts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatKnowledgeDateTime,
  formatKnowledgeFileSize,
  getKnowledgeDocumentAction,
  getKnowledgeDocumentStatusMeta,
  getKnowledgeSearchHitSummary,
} from './knowledge-view.ts';

test('formats file sizes for compact document cards', () => {
  assert.equal(formatKnowledgeFileSize(0), '0 B');
  assert.equal(formatKnowledgeFileSize(512), '512 B');
  assert.equal(formatKnowledgeFileSize(2048), '2 KB');
  assert.equal(formatKnowledgeFileSize(2_621_440), '2.5 MB');
});

test('maps document statuses to stable labels and actions', () => {
  assert.equal(getKnowledgeDocumentStatusMeta('PENDING').label, '待处理');
  assert.equal(getKnowledgeDocumentStatusMeta('PROCESSING').label, '处理中');
  assert.equal(getKnowledgeDocumentStatusMeta('DONE').label, '已入库');
  assert.equal(getKnowledgeDocumentStatusMeta('FAILED').label, '处理失败');

  assert.deepEqual(getKnowledgeDocumentAction('PENDING'), {
    label: '开始处理',
    force: false,
    disabled: false,
  });
  assert.deepEqual(getKnowledgeDocumentAction('PROCESSING'), {
    label: '处理中',
    force: false,
    disabled: true,
  });
  assert.deepEqual(getKnowledgeDocumentAction('DONE'), {
    label: '重新处理',
    force: true,
    disabled: false,
  });
  assert.deepEqual(getKnowledgeDocumentAction('FAILED'), {
    label: '重新处理',
    force: true,
    disabled: false,
  });
});

test('summarizes search hits with chunk index and score', () => {
  assert.equal(
    getKnowledgeSearchHitSummary({
      chunkId: 'chunk_1',
      documentId: 'doc_1',
      documentName: 'calculus.md',
      content: 'Green theorem '.repeat(20),
      score: 0.864,
      metadata: { chunkIndex: 3 },
    }),
    '《calculus.md》 · 片段 3 · 相似度 0.86',
  );

  assert.equal(
    getKnowledgeSearchHitSummary({
      chunkId: 'chunk_2',
      documentId: 'doc_2',
      documentName: 'notes.txt',
      content: 'short note',
      score: 0.7,
      metadata: {},
    }),
    '《notes.txt》 · 片段 ? · 相似度 0.70',
  );
});

test('formats nullable date time values', () => {
  assert.equal(formatKnowledgeDateTime(null), '未处理');
  assert.match(formatKnowledgeDateTime('2026-06-19T08:00:00.000Z'), /\d{2}\/\d{2}/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/knowledge-view.test.mts
```

Expected: fail with module not found for `./knowledge-view.ts`.

- [ ] **Step 3: Implement view helpers**

Create `apps/web/src/lib/knowledge-view.ts`:

```ts
import type {
  KnowledgeDocumentStatus,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';

export function formatKnowledgeFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${formatDecimal(size / 1024)} KB`;
  }

  return `${formatDecimal(size / (1024 * 1024))} MB`;
}

export function formatKnowledgeDateTime(value: string | null) {
  if (!value) {
    return '未处理';
  }

  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getKnowledgeDocumentStatusMeta(status: KnowledgeDocumentStatus) {
  switch (status) {
    case 'PENDING':
      return {
        label: '待处理',
        className: 'bg-[#fff7d6] text-[#7c5b10] ring-[#f3e6a8]',
      };
    case 'PROCESSING':
      return {
        label: '处理中',
        className: 'bg-[#eef7ff] text-[#315f86] ring-[#cfe5f8]',
      };
    case 'DONE':
      return {
        label: '已入库',
        className: 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]',
      };
    case 'FAILED':
      return {
        label: '处理失败',
        className: 'bg-red-50 text-red-600 ring-red-100',
      };
  }
}

export function getKnowledgeDocumentAction(status: KnowledgeDocumentStatus) {
  switch (status) {
    case 'PENDING':
      return { label: '开始处理', force: false, disabled: false };
    case 'PROCESSING':
      return { label: '处理中', force: false, disabled: true };
    case 'DONE':
    case 'FAILED':
      return { label: '重新处理', force: true, disabled: false };
  }
}

export function getKnowledgeSearchHitSummary(hit: KnowledgeSearchHit) {
  const chunkIndex =
    typeof hit.metadata.chunkIndex === 'number' || typeof hit.metadata.chunkIndex === 'string'
      ? String(hit.metadata.chunkIndex)
      : '?';

  return `《${hit.documentName}》 · 片段 ${chunkIndex} · 相似度 ${hit.score.toFixed(2)}`;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/knowledge-view.test.mts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/lib/knowledge-view.ts apps/web/src/lib/knowledge-view.test.mts
git commit -m "feat: add knowledge page view helpers"
```

---

## Task 3: Knowledge Query Hooks

**Files:**

- Create: `apps/web/src/hooks/use-knowledge.ts`

- [ ] **Step 1: Implement hooks**

Create `apps/web/src/hooks/use-knowledge.ts`:

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  KnowledgeDocumentListQuery,
  KnowledgeDocumentProcessRequest,
  KnowledgeSearchRequest,
} from '@repo/types/api/knowledge';

import { knowledgeApi } from '@/lib/knowledge-api';
import { useUserStore } from '@/stores/userStore';

export const knowledgeQueryKeys = {
  all: ['knowledge'] as const,
  documents: () => [...knowledgeQueryKeys.all, 'documents'] as const,
  documentList: (query: KnowledgeDocumentListQuery) =>
    [...knowledgeQueryKeys.documents(), 'list', query] as const,
  documentDetail: (documentId: string) =>
    [...knowledgeQueryKeys.documents(), 'detail', documentId] as const,
  search: () => [...knowledgeQueryKeys.all, 'search'] as const,
};

export function useKnowledgeDocumentList(query: KnowledgeDocumentListQuery) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: knowledgeQueryKeys.documentList(query),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.listDocuments(accessToken, query);
    },
    enabled: sessionHydrated && !!accessToken,
    retry: false,
  });
}

export function useKnowledgeDocumentDetail(documentId: string | null) {
  const accessToken = useUserStore((state) => state.accessToken);
  const sessionHydrated = useUserStore((state) => state.sessionHydrated);

  return useQuery({
    queryKey: knowledgeQueryKeys.documentDetail(documentId ?? ''),
    queryFn: async () => {
      if (!accessToken || !documentId) {
        throw new Error('Missing knowledge document context');
      }
      return knowledgeApi.getDocument(accessToken, documentId);
    },
    enabled: sessionHydrated && !!accessToken && !!documentId,
    retry: false,
  });
}

export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (file: File) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.uploadDocument(accessToken, file);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
    },
  });
}

export function useProcessKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async ({
      documentId,
      request,
    }: {
      documentId: string;
      request: KnowledgeDocumentProcessRequest;
    }) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.processDocument(accessToken, documentId, request);
    },
    onSuccess: (document) => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({
        queryKey: knowledgeQueryKeys.documentDetail(document.id),
      });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.search() });
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationFn: async (documentId: string) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.deleteDocument(accessToken, documentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.documents() });
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKeys.search() });
    },
  });
}

export function useSearchKnowledge() {
  const accessToken = useUserStore((state) => state.accessToken);

  return useMutation({
    mutationKey: knowledgeQueryKeys.search(),
    mutationFn: async (request: KnowledgeSearchRequest) => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }
      return knowledgeApi.search(accessToken, request);
    },
  });
}
```

- [ ] **Step 2: Run existing web tests**

Run:

```powershell
bun --filter @repo/web test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```powershell
git add apps/web/src/hooks/use-knowledge.ts
git commit -m "feat: add knowledge query hooks"
```

---

## Task 4: Knowledge Page UI

**Files:**

- Create: `apps/web/src/app/(main)/knowledge/page.tsx`

- [ ] **Step 1: Implement `/knowledge` page**

Create `apps/web/src/app/(main)/knowledge/page.tsx` with these component boundaries:

```tsx
'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  KnowledgeDocumentResponse,
  KnowledgeDocumentStatus,
  KnowledgeSearchHit,
} from '@repo/types/api/knowledge';
import {
  ArrowLeft,
  BookMarked,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';

import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocumentList,
  useProcessKnowledgeDocument,
  useSearchKnowledge,
  useUploadKnowledgeDocument,
} from '@/hooks/use-knowledge';
import {
  formatKnowledgeDateTime,
  formatKnowledgeFileSize,
  getKnowledgeDocumentAction,
  getKnowledgeDocumentStatusMeta,
  getKnowledgeSearchHitSummary,
} from '@/lib/knowledge-view';

const defaultDocumentQuery = {
  limit: 50,
};

export default function KnowledgePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const documentsQuery = useKnowledgeDocumentList(defaultDocumentQuery);
  const uploadDocument = useUploadKnowledgeDocument();
  const processDocument = useProcessKnowledgeDocument();
  const deleteDocument = useDeleteKnowledgeDocument();
  const searchKnowledge = useSearchKnowledge();
  const documents = documentsQuery.data?.items ?? [];
  const summary = useMemo(() => buildDocumentSummary(documents), [documents]);

  const handleUpload = async () => {
    if (!selectedFile) {
      setFeedback('请选择一份 PDF、DOCX、Markdown 或 TXT 资料。');
      return;
    }

    try {
      const uploaded = await uploadDocument.mutateAsync(selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFeedback(`已上传《${uploaded.name}》，可以开始处理。`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '上传失败，请稍后重试。');
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setFeedback('请输入要测试检索的问题。');
      return;
    }

    try {
      await searchKnowledge.mutateAsync({ query, topK: 5, minScore: 0.7 });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '检索失败，请稍后重试。');
    }
  };

  return (
    <div className="pm-anime-bg min-h-[100dvh] text-[var(--pm-ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--pm-line)] bg-white/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/chat"
            aria-label="返回聊天"
            className="tap-target flex h-10 w-10 items-center justify-center rounded-full bg-white/75 text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] transition-all hover:bg-[#eafff9] active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--pm-muted)]">Knowledge base</p>
            <h1 className="text-lg font-semibold leading-tight">知识库</h1>
            <p className="mt-0.5 text-xs text-[var(--pm-muted)]">
              上传资料，让 AI 回答有据可查
            </p>
          </div>
          <div className="pm-mascot-float flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
            <BookMarked className="h-5 w-5" />
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-3xl">
        <KnowledgeSummary summary={summary} />

        <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
          <SectionTitle
            icon={UploadCloud}
            title="上传学习资料"
            subtitle="支持 PDF / DOCX / Markdown / TXT"
          />
          <div className="mt-3 rounded-[1.25rem] bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.md,.markdown,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/x-markdown,text/plain"
              onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
              className="block w-full text-sm text-[var(--pm-muted)] file:mr-3 file:min-h-10 file:rounded-2xl file:border-0 file:bg-[#eafff9] file:px-4 file:text-sm file:font-bold file:text-[#247269]"
            />
            {selectedFile ? (
              <p className="mt-2 text-xs font-medium text-[var(--pm-muted)]">
                已选择：{selectedFile.name} · {formatKnowledgeFileSize(selectedFile.size)}
              </p>
            ) : null}
            <button
              type="button"
              disabled={uploadDocument.isPending}
              onClick={handleUpload}
              className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white transition-all hover:bg-[#3a3047] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadDocument.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploadDocument.isPending ? '上传中...' : '上传资料'}
            </button>
          </div>
          <FeedbackMessage value={feedback} onClear={() => setFeedback(null)} />
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">资料列表</h2>
            <button
              type="button"
              onClick={() => void documentsQuery.refetch()}
              className="tap-target inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/70 px-3 text-xs font-bold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </div>

          {documentsQuery.isLoading ? (
            <LoadingCard label="正在读取知识库资料..." />
          ) : documentsQuery.isError ? (
            <ErrorCard label="资料列表读取失败，请稍后重试。" onRetry={() => void documentsQuery.refetch()} />
          ) : documents.length === 0 ? (
            <EmptyDocuments />
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <KnowledgeDocumentCard
                  key={document.id}
                  document={document}
                  isProcessing={processDocument.isPending}
                  isDeleting={deleteDocument.isPending}
                  onProcess={async (request) => {
                    try {
                      const updated = await processDocument.mutateAsync({
                        documentId: document.id,
                        request,
                      });
                      setFeedback(`《${updated.name}》处理完成，当前 ${updated.chunkCount} 个片段。`);
                    } catch (error) {
                      setFeedback(error instanceof Error ? error.message : '处理失败，请稍后重试。');
                    }
                  }}
                  onDelete={async () => {
                    try {
                      await deleteDocument.mutateAsync(document.id);
                      setFeedback(`已删除《${document.name}》。`);
                    } catch (error) {
                      setFeedback(error instanceof Error ? error.message : '删除失败，请稍后重试。');
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <KnowledgeSearchTest
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSearch={handleSearch}
          isPending={searchKnowledge.isPending}
          hits={searchKnowledge.data?.hits ?? []}
          hasSearched={searchKnowledge.isSuccess}
        />
      </main>
    </div>
  );
}

function buildDocumentSummary(documents: KnowledgeDocumentResponse[]) {
  return {
    total: documents.length,
    done: documents.filter((item) => item.status === 'DONE').length,
    processing: documents.filter((item) => item.status === 'PROCESSING').length,
    failed: documents.filter((item) => item.status === 'FAILED').length,
  };
}

function KnowledgeSummary({ summary }: { summary: ReturnType<typeof buildDocumentSummary> }) {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.6rem] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--pm-muted)]">资料状态</p>
          <p className="mt-1 text-3xl font-black leading-none text-[var(--pm-ink)]">
            {summary.total}
          </p>
          <p className="mt-1 text-xs text-[var(--pm-muted)]">当前知识库资料</p>
        </div>
        <span className="rounded-full bg-[#eafff9] px-3 py-1 text-xs font-bold text-[#247269] ring-1 ring-[#bdeee5]">
          Chat RAG 已接入
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="已入库" value={`${summary.done} 份`} />
        <MiniStat label="处理中" value={`${summary.processing} 份`} />
        <MiniStat label="失败" value={`${summary.failed} 份`} />
        <MiniStat label="待处理" value={`${Math.max(0, summary.total - summary.done - summary.processing - summary.failed)} 份`} />
      </div>
    </section>
  );
}

function KnowledgeDocumentCard({
  document,
  isProcessing,
  isDeleting,
  onProcess,
  onDelete,
}: {
  document: KnowledgeDocumentResponse;
  isProcessing: boolean;
  isDeleting: boolean;
  onProcess: (request: { force: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const statusMeta = getKnowledgeDocumentStatusMeta(document.status);
  const action = getKnowledgeDocumentAction(document.status);
  const busy = isProcessing || isDeleting || document.status === 'PROCESSING';

  return (
    <article className="pm-enter rounded-[1.35rem] bg-white/72 p-3 ring-1 ring-[var(--pm-line)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full truncate text-sm font-semibold">{document.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--pm-muted)]">
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              {document.type}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              {formatKnowledgeFileSize(document.size)}
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              {document.chunkCount} 个片段
            </span>
            <span className="rounded-full bg-white/70 px-2 py-1 ring-1 ring-[var(--pm-line)]">
              {formatKnowledgeDateTime(document.processedAt)}
            </span>
          </div>
          {document.errorMessage ? (
            <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-600 ring-1 ring-red-100">
              {document.errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || action.disabled}
          onClick={() => onProcess({ force: action.force })}
          className="tap-target inline-flex min-h-10 items-center gap-2 rounded-2xl bg-[#2b2335] px-3 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && document.status === 'PROCESSING' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {action.label}
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onDelete}
              className="tap-target inline-flex min-h-10 items-center gap-2 rounded-2xl bg-red-600 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              确认删除
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirmingDelete(false)}
              className="tap-target inline-flex min-h-10 items-center rounded-2xl bg-white/75 px-3 text-xs font-bold text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]"
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setConfirmingDelete(true)}
            className="tap-target inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white/75 px-3 text-xs font-bold text-red-600 ring-1 ring-red-100"
          >
            <Trash2 className="h-4 w-4" />
            删除
          </button>
        )}
      </div>
    </article>
  );
}

function KnowledgeSearchTest({
  query,
  onQueryChange,
  onSearch,
  isPending,
  hits,
  hasSearched,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  isPending: boolean;
  hits: KnowledgeSearchHit[];
  hasSearched: boolean;
}) {
  return (
    <section className="pm-glass-card pm-enter mt-4 rounded-[1.5rem] p-4">
      <SectionTitle
        icon={Search}
        title="检索测试"
        subtitle="先确认资料能否被 RAG 找到"
      />
      <div className="mt-3 flex gap-2">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder="例如：格林公式的使用条件"
          className="min-h-11 min-w-0 flex-1 rounded-2xl bg-white/80 px-3 text-sm text-[var(--pm-ink)] ring-1 ring-[var(--pm-line)] focus:outline-none focus:ring-2 focus:ring-[#9ee8dd]"
        />
        <button
          type="button"
          disabled={isPending}
          onClick={onSearch}
          className="tap-target inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#2b2335] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          搜索
        </button>
      </div>
      {hasSearched ? (
        hits.length > 0 ? (
          <div className="mt-3 space-y-2">
            {hits.map((hit) => (
              <article key={hit.chunkId} className="rounded-2xl bg-white/70 p-3 ring-1 ring-[var(--pm-line)]">
                <p className="text-xs font-bold text-[#247269]">{getKnowledgeSearchHitSummary(hit)}</p>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-[var(--pm-muted)]">
                  {hit.content}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl bg-white/70 px-3 py-3 text-sm leading-6 text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
            没有命中资料。Chat 仍会按普通 AI 能力回答。
          </p>
        )
      ) : null}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-[var(--pm-muted)]">{subtitle}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-[var(--pm-line)]">
      <p className="text-xs font-medium text-[var(--pm-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--pm-ink)]">{value}</p>
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex min-h-20 items-center gap-2 rounded-2xl bg-white/70 px-3 py-3 text-sm text-[var(--pm-muted)] ring-1 ring-[var(--pm-line)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function ErrorCard({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <section className="rounded-2xl bg-red-50/85 px-4 py-4 text-sm leading-6 text-red-600 ring-1 ring-red-100">
      <p className="font-semibold">{label}</p>
      <button
        type="button"
        onClick={onRetry}
        className="tap-target mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-red-600 ring-1 ring-red-100 transition-all hover:bg-red-50 active:scale-[0.98]"
      >
        <RefreshCw className="h-4 w-4" />
        重新读取
      </button>
    </section>
  );
}

function EmptyDocuments() {
  return (
    <section className="pm-glass-card pm-enter rounded-[1.5rem] p-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-3xl bg-[#eef7ff] text-[#315f86] ring-1 ring-[#cfe5f8]">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-base font-semibold">还没有学习资料</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--pm-muted)]">
        先上传一份笔记或资料，处理完成后 Chat 就可以在回答中参考它。
      </p>
    </section>
  );
}

function FeedbackMessage({
  value,
  onClear,
}: {
  value: string | null;
  onClear: () => void;
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#eafff9] px-3 py-2 text-xs leading-5 text-[#247269] ring-1 ring-[#bdeee5]">
      <span className="min-w-0 flex-1">{value}</span>
      <button type="button" onClick={onClear} className="shrink-0 rounded-full p-1">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run web lint/build**

Run:

```powershell
bun --filter @repo/web lint
bun --filter @repo/web build
```

Expected: both pass. If lint reports line length or import order issues, fix only those issues in the page.

- [ ] **Step 3: Commit**

```powershell
git add "apps/web/src/app/(main)/knowledge/page.tsx"
git commit -m "feat: add knowledge workspace page"
```

---

## Task 5: Sidebar Entry

**Files:**

- Modify: `apps/web/src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Add Knowledge icon import**

Add `BookMarked` to the `lucide-react` import list:

```ts
import {
  BarChart3,
  BookMarked,
  BookOpen,
  CalendarClock,
  CalendarDays,
  LogOut,
  MessageCircle,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
```

- [ ] **Step 2: Add nav item**

Insert the knowledge entry after the chat entry:

```ts
const navItems = [
  { href: '/chat', label: 'AI 对话', hint: '拍照识题与追问', icon: MessageCircle },
  { href: '/knowledge', label: '知识库', hint: '资料入库与检索测试', icon: BookMarked },
  { href: '/today', label: '今日任务', hint: '轻学习手账', icon: CalendarDays },
  { href: '/plan', label: '复习计划', hint: '未来到期与复习压力', icon: CalendarClock },
  { href: '/stats', label: '学习统计', hint: '复习趋势与记录', icon: BarChart3 },
  { href: '/error-book', label: '错题本', hint: '复盘和标记掌握', icon: BookOpen },
  { href: '/profile', label: '我的档案', hint: '偏好与账号资料', icon: UserRound },
];
```

Keep existing active path logic because it already handles non-chat routes via `pathname.startsWith(item.href)`.

- [ ] **Step 3: Run lint**

Run:

```powershell
bun --filter @repo/web lint
```

Expected: pass.

- [ ] **Step 4: Commit**

```powershell
git add apps/web/src/components/chat/chat-sidebar.tsx
git commit -m "feat: add knowledge navigation entry"
```

---

## Task 6: Documentation And Verification

**Files:**

- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/data-flow.md`
- Modify: `docs/roadmap.md`
- Modify: `DEVLOG.md`

- [ ] **Step 1: Update docs**

Update the current phase references:

- Mark Phase 5.6 as completed only after the implementation verification passes.
- Record that `/knowledge` supports upload, list, process, delete, and search testing.
- Keep Phase 6 `KnowledgeVerifierAgent` as future work.
- Keep the non-blocking RAG boundary: Chat still works without docs, hits, or retrieval success.

- [ ] **Step 2: Full verification**

Run:

```powershell
node --experimental-strip-types --test apps/web/src/lib/knowledge-api.test.mts
node --experimental-strip-types --test apps/web/src/lib/knowledge-view.test.mts
bun --filter @repo/web test
bun --filter @repo/web lint
bun --filter @repo/web build
bun --filter @repo/server test -- knowledge-search.service.spec.ts
bun --filter @repo/server test:e2e -- --runInBand knowledge-documents.e2e-spec.ts
git diff --check
```

Expected:

- `knowledge-api.test.mts` passes 3 tests.
- `knowledge-view.test.mts` passes 4 tests.
- `@repo/web test` passes all tests.
- `@repo/web lint` exits 0.
- `@repo/web build` exits 0.
- server knowledge search unit test exits 0.
- server knowledge documents e2e exits 0.
- `git diff --check` exits 0. Windows line-ending warnings are acceptable when exit code is 0.

- [ ] **Step 3: Browser smoke validation**

Start services if they are not running:

```powershell
$env:POSTGRES_PORT='5433'
docker compose -f docker/docker-compose.dev.yml up -d postgres redis minio
bun --filter @repo/server start:dev
bun --filter @repo/web dev
```

Validate in browser:

1. Open `/knowledge`.
2. Confirm the sidebar contains “知识库”.
3. Upload a small `.txt` or `.md` document.
4. Confirm the document appears as `PENDING`.
5. Click “开始处理”.
6. Confirm the document becomes `DONE` and chunk count is greater than 0.
7. Search for a phrase from the document.
8. Confirm at least one hit appears with document name and score.
9. Delete the document through the inline confirmation.
10. Confirm `/chat` still loads.

- [ ] **Step 4: Commit docs**

```powershell
git add AGENTS.md CLAUDE.md README.md docs/data-flow.md docs/roadmap.md DEVLOG.md
git commit -m "docs: mark phase 5.6 knowledge page complete"
```
