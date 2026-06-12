import {
  createOcrRecordRequestSchema,
  ocrRecordListResponseSchema,
  ocrRecordSchema,
  type CreateOcrRecordRequest,
  type ListOcrRecordsQuery,
  type OcrParsedPayload,
  type OcrRecordResponse,
  type OcrRecordStatus,
} from '@repo/types/api/ocr-record';

import type { OcrRecord } from './db';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};

export type OcrRecordListFilters = {
  page?: number;
  pageSize?: number;
  status?: OcrRecordStatus;
  keyword?: string;
  isQuestion?: boolean;
};

export function createOcrRecordApi(client: ApiClient) {
  return {
    async list(accessToken: string, filters: OcrRecordListFilters = {}) {
      const response = ocrRecordListResponseSchema.parse(
        await client.get<unknown>(`/ocr-records${toQueryString(filters)}`, {
          accessToken,
        }),
      );

      return {
        ...response,
        items: response.items.map(mapOcrRecordResponseToLocalRecord),
      };
    },

    async getById(accessToken: string, id: string) {
      return mapOcrRecordResponseToLocalRecord(
        ocrRecordSchema.parse(
          await client.get<unknown>(`/ocr-records/${id}`, {
            accessToken,
          }),
        ),
      );
    },

    async create(
      accessToken: string,
      record: OcrRecord,
      parsedJson: OcrParsedPayload,
    ) {
      const request = mapLocalOcrRecordToCreateRequest(record, parsedJson);
      return mapOcrRecordResponseToLocalRecord(
        ocrRecordSchema.parse(
          await client.post<unknown>('/ocr-records', request, {
            accessToken,
          }),
        ),
      );
    },

    async delete(accessToken: string, id: string) {
      return client.delete<{ ok: true }>(`/ocr-records/${id}`, {
        accessToken,
      });
    },
  };
}

export function mapOcrRecordResponseToLocalRecord(
  response: OcrRecordResponse,
): OcrRecord {
  return {
    id: response.id,
    userId: response.userId,
    type: 'ocr-result',
    groupId: response.groupId,
    content: response.rawText,
    imageUrl: response.imageUrl ?? undefined,
    createdAt: Date.parse(response.createdAt),
  };
}

export function mapLocalOcrRecordToCreateRequest(
  record: OcrRecord,
  parsedJson: OcrParsedPayload,
): CreateOcrRecordRequest {
  const request = createOcrRecordRequestSchema.parse({
    groupId: record.groupId ?? record.id,
    rawText: record.content,
    parsedJson,
    imageUrl: toServerImageUrl(record.imageUrl),
    status: record.content.trim() ? 'DONE' : 'FAILED',
  });

  return stripUndefined(request);
}

function toQueryString(filters: OcrRecordListFilters) {
  const query: Partial<ListOcrRecordsQuery> = {};

  if (filters.page !== undefined) query.page = filters.page;
  if (filters.pageSize !== undefined) query.pageSize = filters.pageSize;
  if (filters.status !== undefined) query.status = filters.status;
  if (filters.keyword) query.keyword = filters.keyword;
  if (filters.isQuestion !== undefined) query.isQuestion = filters.isQuestion;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    search.set(key, String(value));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

function toServerImageUrl(value: string | undefined) {
  const imageUrl = value?.trim();
  if (!imageUrl || imageUrl.startsWith('data:')) return undefined;
  return imageUrl;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
