import {
  createWrongQuestionRequestSchema,
  wrongQuestionListResponseSchema,
  wrongQuestionSchema,
  type CreateWrongQuestionRequest,
  type ListWrongQuestionsQuery,
  type UpdateWrongQuestionRequest,
  type WrongQuestionResponse,
  type WrongQuestionSource,
  type WrongQuestionStatus,
} from '@repo/types/api/wrong-question';

import type { WrongQuestionRecord, WrongQuestionStatus as LocalWrongQuestionStatus } from './db';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  post: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  patch: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
  delete: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
};
type LocalWrongQuestionSource = WrongQuestionRecord['source'];

export type WrongQuestionListFilters = {
  page?: number;
  pageSize?: number;
  status?: LocalWrongQuestionStatus;
  subject?: string;
  keyword?: string;
};

export type UpdateLocalWrongQuestionRequest = Partial<
  Pick<
    WrongQuestionRecord,
    | 'questionText'
    | 'subject'
    | 'category'
    | 'knowledgePoints'
    | 'analysis'
    | 'answer'
    | 'errorType'
    | 'userNote'
    | 'status'
  >
>;

export function createWrongQuestionApi(client: ApiClient) {
  return {
    async list(accessToken: string, filters: WrongQuestionListFilters = {}) {
      const response = wrongQuestionListResponseSchema.parse(
        await client.get<unknown>(`/wrong-questions${toQueryString(filters)}`, {
          accessToken,
        }),
      );

      return {
        ...response,
        items: response.items.map(mapWrongQuestionResponseToLocalRecord),
      };
    },

    async getById(accessToken: string, id: string) {
      return mapWrongQuestionResponseToLocalRecord(
        wrongQuestionSchema.parse(
          await client.get<unknown>(`/wrong-questions/${id}`, {
            accessToken,
          }),
        ),
      );
    },

    async create(accessToken: string, record: WrongQuestionRecord) {
      const request = mapLocalWrongQuestionToCreateRequest(record);
      return mapWrongQuestionResponseToLocalRecord(
        wrongQuestionSchema.parse(
          await client.post<unknown>('/wrong-questions', request, {
            accessToken,
          }),
        ),
      );
    },

    async update(accessToken: string, id: string, patch: UpdateLocalWrongQuestionRequest) {
      const request = mapLocalPatchToUpdateRequest(patch);
      return mapWrongQuestionResponseToLocalRecord(
        wrongQuestionSchema.parse(
          await client.patch<unknown>(`/wrong-questions/${id}`, request, {
            accessToken,
          }),
        ),
      );
    },

    async delete(accessToken: string, id: string) {
      return client.delete<{ ok: true }>(`/wrong-questions/${id}`, {
        accessToken,
      });
    },
  };
}

export function mapWrongQuestionResponseToLocalRecord(
  response: WrongQuestionResponse,
): WrongQuestionRecord {
  return {
    id: response.id,
    userId: response.userId,
    source: mapWrongQuestionSourceToLocal(response.source),
    sourceRecordId: response.sourceRecordId ?? undefined,
    sourceGroupId: response.sourceGroupId ?? undefined,
    imageUrl: response.imageUrl ?? undefined,
    questionText: response.questionText,
    subject: response.subject,
    category: response.category,
    knowledgePoints: response.knowledgePoints,
    analysis: response.analysis,
    answer: response.answer,
    errorType: response.errorType ?? '',
    userNote: response.userNote ?? '',
    rawContent: response.rawContent ?? '',
    status: mapWrongQuestionStatusToLocal(response.status),
    createdAt: Date.parse(response.createdAt),
    updatedAt: Date.parse(response.updatedAt),
  };
}

export function mapLocalWrongQuestionToCreateRequest(
  record: WrongQuestionRecord,
): CreateWrongQuestionRequest {
  const request = createWrongQuestionRequestSchema.parse({
    source: mapWrongQuestionSourceToApi(record.source),
    sourceRecordId: nonEmpty(record.sourceRecordId),
    sourceGroupId: nonEmpty(record.sourceGroupId),
    imageUrl: toServerImageUrl(record.imageUrl),
    questionText: record.questionText,
    subject: record.subject,
    category: record.category,
    knowledgePoints: record.knowledgePoints,
    analysis: record.analysis,
    answer: record.answer,
    errorType: nonEmpty(record.errorType),
    userNote: nonEmpty(record.userNote),
    rawContent: nonEmpty(record.rawContent),
  });

  return stripUndefined(request);
}

export function mapWrongQuestionStatusToApi(
  status: LocalWrongQuestionStatus,
): WrongQuestionStatus {
  return status === 'resolved' ? 'RESOLVED' : 'UNRESOLVED';
}

export function mapWrongQuestionStatusToLocal(
  status: WrongQuestionStatus,
): LocalWrongQuestionStatus {
  return status === 'RESOLVED' ? 'resolved' : 'unresolved';
}

function mapWrongQuestionSourceToApi(source: LocalWrongQuestionSource): WrongQuestionSource {
  const values: Record<LocalWrongQuestionSource, WrongQuestionSource> = {
    ocr: 'OCR',
    manual: 'MANUAL',
    chat: 'CHAT',
  };
  return values[source];
}

function mapWrongQuestionSourceToLocal(source: WrongQuestionSource): LocalWrongQuestionSource {
  const values: Record<WrongQuestionSource, LocalWrongQuestionSource> = {
    OCR: 'ocr',
    MANUAL: 'manual',
    CHAT: 'chat',
  };
  return values[source];
}

function mapLocalPatchToUpdateRequest(
  patch: UpdateLocalWrongQuestionRequest,
): UpdateWrongQuestionRequest {
  const request: Record<string, unknown> = {};

  if (patch.questionText !== undefined) request.questionText = patch.questionText;
  if (patch.subject !== undefined) request.subject = patch.subject;
  if (patch.category !== undefined) request.category = patch.category;
  if (patch.knowledgePoints !== undefined) request.knowledgePoints = patch.knowledgePoints;
  if (patch.analysis !== undefined) request.analysis = patch.analysis;
  if (patch.answer !== undefined) request.answer = patch.answer;
  if (patch.errorType !== undefined) request.errorType = patch.errorType || null;
  if (patch.userNote !== undefined) request.userNote = patch.userNote || null;
  if (patch.status !== undefined) request.status = mapWrongQuestionStatusToApi(patch.status);

  return request as UpdateWrongQuestionRequest;
}

function toQueryString(filters: WrongQuestionListFilters) {
  const query: Partial<ListWrongQuestionsQuery> = {};

  if (filters.page !== undefined) query.page = filters.page;
  if (filters.pageSize !== undefined) query.pageSize = filters.pageSize;
  if (filters.status !== undefined) query.status = mapWrongQuestionStatusToApi(filters.status);
  if (filters.subject) query.subject = filters.subject;
  if (filters.keyword) query.keyword = filters.keyword;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    search.set(key, String(value));
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

function nonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toServerImageUrl(value: string | undefined) {
  const imageUrl = nonEmpty(value);
  if (!imageUrl || imageUrl.startsWith('data:')) return undefined;
  return imageUrl;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
