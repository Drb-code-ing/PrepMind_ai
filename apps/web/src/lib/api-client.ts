type FetchLike = typeof fetch;

interface CreateApiClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
}

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  accessToken?: string | null;
  body?: unknown;
  expectedStatus?: number | readonly number[];
}

interface ApiFailureBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
  requestId?: string;
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
  requestId?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, options: { status: number; code: string; requestId?: string }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export function createApiClient({ baseUrl, fetchImpl = fetch }: CreateApiClientOptions) {
  async function request<T>(method: string, path: string, options: ApiRequestOptions = {}) {
    const headers = new Headers(options.headers);
    const { accessToken, body: requestBody, expectedStatus, ...fetchOptions } = options;

    if (requestBody !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (accessToken) {
      headers.set('authorization', `Bearer ${accessToken}`);
    }

    let response: Response;
    try {
      response = await fetchImpl(toUrl(baseUrl, path), {
        ...fetchOptions,
        method,
        headers,
        credentials: fetchOptions.credentials ?? 'include',
        body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
      });
    } catch (error) {
      if (fetchOptions.signal?.aborted || isAbortError(error)) {
        throw requestAbortedError();
      }
      throw new ApiClientError('网络连接失败，请稍后重试', {
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }

    const body = await parseJson(response, fetchOptions.signal);

    if (isApiFailure(body)) {
      throw new ApiClientError(body.error.message, {
        status: response.status,
        code: body.error.code,
        requestId: body.requestId,
      });
    }

    if (expectedStatus !== undefined && !matchesExpectedStatus(response.status, expectedStatus)) {
      throw new ApiClientError('服务响应状态异常', {
        status: response.status,
        code: 'UNEXPECTED_STATUS',
      });
    }

    if (isApiSuccess<T>(body)) {
      return body.data;
    }

    throw new ApiClientError('服务响应格式异常', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
    });
  }

  return {
    get: <T>(path: string, options?: ApiRequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    delete: <T>(path: string, options?: ApiRequestOptions) => request<T>('DELETE', path, options),
  };
}

function matchesExpectedStatus(status: number, expectedStatus: number | readonly number[]) {
  return Array.isArray(expectedStatus)
    ? expectedStatus.includes(status)
    : status === expectedStatus;
}

function isAbortError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

function requestAbortedError() {
  return new ApiClientError('请求已取消', {
    status: 0,
    code: 'REQUEST_ABORTED',
  });
}

export function resolveApiClientBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  location: Pick<Location, 'hostname'> | URL | undefined = typeof window === 'undefined'
    ? undefined
    : window.location,
) {
  const baseUrl =
    env.PREPMIND_INTERNAL_API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

  return alignLoopbackHost(baseUrl, location);
}

function alignLoopbackHost(
  baseUrl: string,
  location: Pick<Location, 'hostname'> | URL | undefined,
) {
  if (!location || !isLoopbackHost(location.hostname)) return baseUrl;

  try {
    const url = new URL(baseUrl);
    if (!isLoopbackHost(url.hostname)) return baseUrl;

    url.hostname = location.hostname;
    return url.toString().replace(/\/$/, '');
  } catch {
    return baseUrl;
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function parseJson(response: Response, signal?: AbortSignal | null) {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      throw requestAbortedError();
    }
    throw new ApiClientError('服务响应格式异常', {
      status: response.status,
      code: 'INVALID_API_RESPONSE',
    });
  }
}

function isApiSuccess<T>(body: unknown): body is ApiSuccessBody<T> {
  return isRecord(body) && body.success === true && 'data' in body;
}

function isApiFailure(body: unknown): body is ApiFailureBody {
  if (!isRecord(body) || body.success !== false || !isRecord(body.error)) {
    return false;
  }

  return typeof body.error.code === 'string' && typeof body.error.message === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const apiClient = createApiClient({
  baseUrl: resolveApiClientBaseUrl(),
});
