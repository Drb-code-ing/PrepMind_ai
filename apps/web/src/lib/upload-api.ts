import {
  uploadImageResponseSchema,
  type UploadImagePurpose,
  type UploadImageResponse,
} from '@repo/types/api/upload';

import { ApiClientError } from './api-client.ts';

type FetchLike = typeof fetch;

type CreateUploadApiOptions = {
  baseUrl: string;
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

export function createUploadApi({
  baseUrl,
  fetchImpl = fetch,
}: CreateUploadApiOptions) {
  return {
    async uploadImage(
      accessToken: string,
      file: File,
      options: { purpose: UploadImagePurpose; groupId?: string },
    ) {
      const body = new FormData();
      body.append('file', file);
      body.append('purpose', options.purpose);
      if (options.groupId) {
        body.append('groupId', options.groupId);
      }

      let response: Response;
      try {
        response = await fetchImpl(toUrl(baseUrl, '/uploads/images'), {
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
        return uploadImageResponseSchema.parse(payload.data);
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

export const uploadApi = createUploadApi({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
});

export type { UploadImageResponse };
