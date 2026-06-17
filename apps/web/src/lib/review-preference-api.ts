import {
  reviewPreferencePatchSchema,
  reviewPreferenceSchema,
  type ReviewPreferencePatchRequest,
  type ReviewPreferenceResponse,
} from '@repo/types/api/review-preference';

type ApiClient = {
  get: <T>(path: string, options?: { accessToken?: string | null }) => Promise<T>;
  patch: <T>(
    path: string,
    body?: unknown,
    options?: { accessToken?: string | null },
  ) => Promise<T>;
};

export function createReviewPreferenceApi(client: ApiClient) {
  return {
    async get(accessToken: string): Promise<ReviewPreferenceResponse> {
      return reviewPreferenceSchema.parse(
        await client.get<unknown>('/review-preferences', { accessToken }),
      );
    },

    async patch(
      accessToken: string,
      request: ReviewPreferencePatchRequest,
    ): Promise<ReviewPreferenceResponse> {
      const body = reviewPreferencePatchSchema.parse(request);
      return reviewPreferenceSchema.parse(
        await client.patch<unknown>('/review-preferences', body, { accessToken }),
      );
    },
  };
}
