import {
  moveWrongQuestionToDeckRequestSchema,
  organizeWrongQuestionBatchRequestSchema,
  organizeWrongQuestionBatchResponseSchema,
  organizeWrongQuestionRequestSchema,
  organizeWrongQuestionResponseSchema,
  removeWrongQuestionDeckItemResponseSchema,
  updateWrongQuestionDeckRequestSchema,
  wrongQuestionDeckItemSchema,
  wrongQuestionDeckListResponseSchema,
  wrongQuestionDeckQuestionListQuerySchema,
  wrongQuestionDeckQuestionListResponseSchema,
  wrongQuestionGroupListResponseSchema,
  wrongQuestionDeckSchema,
  type MoveWrongQuestionToDeckRequest,
  type OrganizeWrongQuestionBatchRequest,
  type OrganizeWrongQuestionRequest,
  type UpdateWrongQuestionDeckRequest,
  type WrongQuestionDeckQuestionListQuery,
} from '@repo/types/api/wrong-question-organizer';

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

export type WrongQuestionDeckQuestionListQueryInput =
  Partial<WrongQuestionDeckQuestionListQuery>;

export function createWrongQuestionOrganizerApi(client: ApiClient) {
  return {
    async listGroups(accessToken: string) {
      return wrongQuestionGroupListResponseSchema.parse(
        await client.get<unknown>('/wrong-question-groups', { accessToken }),
      );
    },

    async listDecks(accessToken: string, subjectGroupId: string) {
      return wrongQuestionDeckListResponseSchema.parse(
        await client.get<unknown>(
          `/wrong-question-groups/${encodeURIComponent(subjectGroupId)}/decks`,
          { accessToken },
        ),
      );
    },

    async listDeckQuestions(
      accessToken: string,
      deckId: string,
      query: WrongQuestionDeckQuestionListQueryInput = {},
    ) {
      const parsedQuery = wrongQuestionDeckQuestionListQuerySchema.parse(query);
      return wrongQuestionDeckQuestionListResponseSchema.parse(
        await client.get<unknown>(
          `/wrong-question-decks/${encodeURIComponent(deckId)}/questions${toQueryString(
            parsedQuery,
          )}`,
          { accessToken },
        ),
      );
    },

    async organizeOne(
      accessToken: string,
      wrongQuestionId: string,
      request: OrganizeWrongQuestionRequest,
    ) {
      const body = organizeWrongQuestionRequestSchema.parse(request);
      return organizeWrongQuestionResponseSchema.parse(
        await client.post<unknown>(
          `/wrong-question-organizer/organize/${encodeURIComponent(wrongQuestionId)}`,
          body,
          { accessToken },
        ),
      );
    },

    async organizeBatch(accessToken: string, request: OrganizeWrongQuestionBatchRequest) {
      const body = organizeWrongQuestionBatchRequestSchema.parse(request);
      return organizeWrongQuestionBatchResponseSchema.parse(
        await client.post<unknown>('/wrong-question-organizer/organize-batch', body, {
          accessToken,
        }),
      );
    },

    async updateDeck(
      accessToken: string,
      deckId: string,
      request: UpdateWrongQuestionDeckRequest,
    ) {
      const body = updateWrongQuestionDeckRequestSchema.parse(request);
      return wrongQuestionDeckSchema.parse(
        await client.patch<unknown>(
          `/wrong-question-decks/${encodeURIComponent(deckId)}`,
          body,
          { accessToken },
        ),
      );
    },

    async moveToDeck(
      accessToken: string,
      deckId: string,
      request: MoveWrongQuestionToDeckRequest,
    ) {
      const body = moveWrongQuestionToDeckRequestSchema.parse(request);
      return wrongQuestionDeckItemSchema.parse(
        await client.post<unknown>(
          `/wrong-question-decks/${encodeURIComponent(deckId)}/items`,
          body,
          { accessToken },
        ),
      );
    },

    async removeDeckItem(accessToken: string, deckId: string, wrongQuestionId: string) {
      return removeWrongQuestionDeckItemResponseSchema.parse(
        await client.delete<unknown>(
          `/wrong-question-decks/${encodeURIComponent(deckId)}/items/${encodeURIComponent(
            wrongQuestionId,
          )}`,
          { accessToken },
        ),
      );
    },
  };
}

function toQueryString(query: WrongQuestionDeckQuestionListQuery) {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  return `?${params.toString()}`;
}
