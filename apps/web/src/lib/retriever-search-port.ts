import 'server-only';

import {
  createRetrieverSearchPortV1,
  RETRIEVER_AGENT_POLICY_V1,
  RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
  type RetrieverSearchPortOutcomeV1,
  type RetrieverSearchPortRequestV1,
  type RetrieverSearchPortV1,
} from '@repo/agent/retriever';
import { knowledgeSearchResponseSchema } from '@repo/types/api/knowledge';

import {
  readCanonicalChatBearerToken,
  type CanonicalChatAgentAccess,
} from './chat-agent-access.ts';
import { resolveApiClientBaseUrl } from './api-client.ts';

type FetchLike = typeof fetch;

export type CreateChatKnowledgeRetrieverPortResultV1 =
  | Readonly<{ ok: true; port: RetrieverSearchPortV1 }>
  | Readonly<{ ok: false; reasonCode: 'principal_binding_invalid' }>;

export function createChatKnowledgeRetrieverSearchPortV1(
  input: Readonly<{
    access: CanonicalChatAgentAccess;
    request: Request;
    executionContext: CanonicalChatAgentAccess['executionContext'];
    fetchImpl?: FetchLike;
  }>,
): CreateChatKnowledgeRetrieverPortResultV1 {
  if (
    input.access.executionContext !== input.executionContext ||
    input.executionContext.principal.kind !== 'authenticated'
  ) {
    return principalBindingFailure();
  }
  const token = readCanonicalChatBearerToken({
    access: input.access,
    request: input.request,
    executionContext: input.executionContext,
  });
  if (!token.ok || token.accessToken === null) return principalBindingFailure();

  const created = createRetrieverSearchPortV1({
    scope: input.executionContext,
    execute: async (request) =>
      executeKnowledgeSearch({
        request,
        access: input.access,
        sourceRequest: input.request,
        executionContext: input.executionContext,
        fetchImpl: input.fetchImpl,
      }),
  });
  return created.ok
    ? Object.freeze({ ok: true as const, port: created.port })
    : principalBindingFailure();
}

async function executeKnowledgeSearch(input: {
  request: RetrieverSearchPortRequestV1;
  access: CanonicalChatAgentAccess;
  sourceRequest: Request;
  executionContext: CanonicalChatAgentAccess['executionContext'];
  fetchImpl?: FetchLike;
}): Promise<RetrieverSearchPortOutcomeV1> {
  if (
    input.executionContext.principal.kind !== 'authenticated' ||
    input.request.runId !== input.executionContext.runId ||
    input.request.requestId !== input.executionContext.requestId ||
    input.request.deadlineAt !== input.executionContext.deadlineAt
  ) {
    return portFailure('unauthorized');
  }
  if (!isNativeAbortSignal(input.request.signal)) return portFailure('schema_invalid');
  if (input.request.signal.aborted) return portFailure('aborted');
  if (!hasFrozenSearchPolicy(input.request)) return portFailure('schema_invalid');

  const token = readCanonicalChatBearerToken({
    access: input.access,
    request: input.sourceRequest,
    executionContext: input.executionContext,
  });
  if (!token.ok || token.accessToken === null) return portFailure('unauthorized');
  const accessToken = token.accessToken;

  const baseUrl = resolveApiClientBaseUrl(process.env, undefined);
  const endpoint = resolveKnowledgeSearchEndpoint(baseUrl);
  if (endpoint === null) return portFailure('transport_error');

  try {
    const response = await (input.fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + accessToken,
      },
      body: JSON.stringify({
        query: input.request.query,
        topK: input.request.topK,
        minScore: input.request.minScore,
      }),
      signal: input.request.signal,
    });
    if (input.request.signal.aborted) return portFailure('aborted');
    if (!response.ok) {
      return portFailure(
        response.status === 401 || response.status === 403 ? 'unauthorized' : 'http_error',
      );
    }

    const body = await response.json();
    if (input.request.signal.aborted) return portFailure('aborted');
    const data = snapshotSuccessEnvelopeData(body, input.request.requestId);
    if (!data.ok) return portFailure('schema_invalid');
    const parsed = knowledgeSearchResponseSchema.safeParse(data.value);
    if (!parsed.success) return portFailure('schema_invalid');
    return Object.freeze({ ok: true, response: parsed.data });
  } catch {
    return portFailure(input.request.signal.aborted ? 'aborted' : 'transport_error');
  }
}

function hasFrozenSearchPolicy(request: RetrieverSearchPortRequestV1): boolean {
  return (
    request.schemaVersion === RETRIEVER_SEARCH_PORT_REQUEST_VERSION &&
    request.topK === RETRIEVER_AGENT_POLICY_V1.topK &&
    request.minScore === RETRIEVER_AGENT_POLICY_V1.minScore &&
    request.sourceTypes.length === 1 &&
    request.sourceTypes[0] === RETRIEVER_AGENT_POLICY_V1.sourceTypes[0] &&
    request.documentStatuses.length === 1 &&
    request.documentStatuses[0] === RETRIEVER_AGENT_POLICY_V1.documentStatuses[0]
  );
}

function snapshotSuccessEnvelopeData(
  input: unknown,
  expectedRequestId: string,
): Readonly<{ ok: true; value: unknown }> | Readonly<{ ok: false }> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return Object.freeze({ ok: false });
  }
  try {
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) {
      return Object.freeze({ ok: false });
    }
    const keys = Reflect.ownKeys(input);
    if (
      keys.some(
        (key) =>
          typeof key !== 'string' || (key !== 'success' && key !== 'data' && key !== 'requestId'),
      )
    ) {
      return Object.freeze({ ok: false });
    }
    const success = Object.getOwnPropertyDescriptor(input, 'success');
    const data = Object.getOwnPropertyDescriptor(input, 'data');
    const requestId = Object.getOwnPropertyDescriptor(input, 'requestId');
    if (
      success === undefined ||
      !('value' in success) ||
      success.value !== true ||
      data === undefined ||
      !('value' in data) ||
      (requestId !== undefined &&
        (!('value' in requestId) ||
          typeof requestId.value !== 'string' ||
          requestId.value.length > 128 ||
          requestId.value !== expectedRequestId))
    ) {
      return Object.freeze({ ok: false });
    }
    return Object.freeze({ ok: true, value: data.value });
  } catch {
    return Object.freeze({ ok: false });
  }
}

function resolveKnowledgeSearchEndpoint(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.toString().replace(/\/+$/u, '') + '/knowledge/search';
  } catch {
    return null;
  }
}

function portFailure(
  reasonCode: Exclude<RetrieverSearchPortOutcomeV1, { ok: true }>['reasonCode'],
): RetrieverSearchPortOutcomeV1 {
  return Object.freeze({ ok: false, reasonCode });
}

function principalBindingFailure(): CreateChatKnowledgeRetrieverPortResultV1 {
  return Object.freeze({ ok: false, reasonCode: 'principal_binding_invalid' });
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  try {
    return typeof AbortSignal !== 'undefined' && value instanceof AbortSignal;
  } catch {
    return false;
  }
}
