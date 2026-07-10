type FetchLike = typeof fetch;

interface CreateApiClientOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
}

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  accessToken?: string | null;
  body?: unknown;
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

    if (options.body !== undefined && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    if (options.accessToken) {
      headers.set('authorization', `Bearer ${options.accessToken}`);
    }

    let response: Response;
    try {
      response = await fetchImpl(toUrl(baseUrl, path), {
        ...options,
        method,
        headers,
        credentials: options.credentials ?? 'include',
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiClientError('网络连接失败，请确认后端服务已启动', {
        status: 0,
        code: 'NETWORK_ERROR',
      });
    }

    const body = await parseJson(response);

    if (isApiSuccess<T>(body)) return body.data;
    if (isApiFailure(body)) {
      throw new ApiClientError(body.error.message, {
        status: response.status,
        code: body.error.code,
        requestId: body.requestId,
      });
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

export function resolveApiClientBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  location: Pick<Location, 'hostname'> | URL | undefined =
    typeof window === 'undefined' ? undefined : window.location,
) {
  const baseUrl =
    env.PREPMIND_INTERNAL_API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001';

  return alignLoopbackHost(baseUrl, location);
}

function alignLoopbackHost(baseUrl: string, location: Pick<Location, 'hostname'> | URL | undefined) {
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

function isApiSuccess<T>(body: unknown): body is ApiSuccessBody<T> {
  return isRecord(body) && body.success === true && 'data' in body;
}

function isApiFailure(body: unknown): body is ApiFailureBody {
  return (
    isRecord(body) &&
    body.success === false &&
    isRecord(body.error) &&
    typeof body.error.code === 'string' &&
    typeof body.error.message === 'string'
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

export const apiClient = createApiClient({
  baseUrl: resolveApiClientBaseUrl(),
});
