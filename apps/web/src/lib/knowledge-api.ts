import {
  knowledgeDocumentDeleteResponseSchema,
  knowledgeDocumentDetailResponseSchema,
  knowledgeDocumentListResponseSchema,
  knowledgeDocumentProcessRequestSchema,
  knowledgeDocumentProcessResponseSchema,
  knowledgeDocumentUploadResponseSchema,
  knowledgeSearchRequestSchema,
  knowledgeSearchResponseSchema,
  type KnowledgeDocumentDeleteResponse,
  type KnowledgeDocumentDetailResponse,
  type KnowledgeDocumentListQuery,
  type KnowledgeDocumentListResponse,
  type KnowledgeDocumentProcessRequest,
  type KnowledgeDocumentProcessResponse,
  type KnowledgeDocumentUploadResponse,
  type KnowledgeSearchRequest,
  type KnowledgeSearchResponse,
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
    async uploadDocument(
      accessToken: string,
      file: File,
    ): Promise<KnowledgeDocumentUploadResponse> {
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
        throw new ApiClientError('缃戠粶杩炴帴澶辫触锛岃绋嶅悗閲嶈瘯', {
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

      throw new ApiClientError('鏈嶅姟鍝嶅簲鏍煎紡寮傚父', {
        status: response.status,
        code: 'INVALID_API_RESPONSE',
      });
    },

    async listDocuments(
      accessToken: string,
      query: KnowledgeDocumentListQuery,
    ): Promise<KnowledgeDocumentListResponse> {
      const params = new URLSearchParams();
      if (query.status) {
        params.set('status', query.status);
      }
      if (query.sourceType) {
        params.set('sourceType', query.sourceType);
      }
      params.set('limit', String(query.limit));
      if (query.cursor) {
        params.set('cursor', query.cursor);
      }

      return knowledgeDocumentListResponseSchema.parse(
        await client.get<unknown>(`/knowledge/documents?${params.toString()}`, {
          accessToken,
        }),
      );
    },

    async getDocument(
      accessToken: string,
      documentId: string,
    ): Promise<KnowledgeDocumentDetailResponse> {
      return knowledgeDocumentDetailResponseSchema.parse(
        await client.get<unknown>(`/knowledge/documents/${documentId}`, { accessToken }),
      );
    },

    async processDocument(
      accessToken: string,
      documentId: string,
      request: KnowledgeDocumentProcessRequest,
    ): Promise<KnowledgeDocumentProcessResponse> {
      const body = knowledgeDocumentProcessRequestSchema.parse(request);
      return knowledgeDocumentProcessResponseSchema.parse(
        await client.post<unknown>(`/knowledge/documents/${documentId}/process`, body, {
          accessToken,
        }),
      );
    },

    async deleteDocument(
      accessToken: string,
      documentId: string,
    ): Promise<KnowledgeDocumentDeleteResponse> {
      return knowledgeDocumentDeleteResponseSchema.parse(
        await client.delete<unknown>(`/knowledge/documents/${documentId}`, { accessToken }),
      );
    },

    async search(
      accessToken: string,
      request: KnowledgeSearchRequest,
    ): Promise<KnowledgeSearchResponse> {
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
    throw new ApiClientError('鏈嶅姟鍝嶅簲鏍煎紡寮傚父', {
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
