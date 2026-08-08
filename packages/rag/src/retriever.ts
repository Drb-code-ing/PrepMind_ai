export const RETRIEVER_SEARCH_PORT_VERSION = 'retriever-search-port-v1' as const;
export const RETRIEVER_SEARCH_PORT_REQUEST_VERSION = 'retriever-search-port-request-v1' as const;

export const RETRIEVER_SEARCH_PORT_FAILURE_CODES = [
  'aborted',
  'deadline_exceeded',
  'unauthorized',
  'http_error',
  'schema_invalid',
  'transport_error',
] as const;

export type RetrieverSearchPortFailureCode = (typeof RETRIEVER_SEARCH_PORT_FAILURE_CODES)[number];

export type RetrieverSearchPortRequestV1 = Readonly<{
  schemaVersion: typeof RETRIEVER_SEARCH_PORT_REQUEST_VERSION;
  runId: string;
  requestId: string;
  deadlineAt: string;
  query: string;
  topK: number;
  minScore: number;
  sourceTypes: readonly ['knowledge_document'];
  documentStatuses: readonly ['DONE'];
  signal: AbortSignal;
}>;

export type RetrieverSearchPortOutcomeV1 =
  | Readonly<{ ok: true; response: unknown }>
  | Readonly<{ ok: false; reasonCode: RetrieverSearchPortFailureCode }>;

export type RetrieverSearchPortExecutorV1 = (
  request: RetrieverSearchPortRequestV1,
) => Promise<RetrieverSearchPortOutcomeV1>;

export type RetrieverSearchPortV1 = Readonly<{
  schemaVersion: typeof RETRIEVER_SEARCH_PORT_VERSION;
}>;

export type CreateRetrieverSearchPortResultV1 =
  | Readonly<{ ok: true; port: RetrieverSearchPortV1 }>
  | Readonly<{ ok: false; reasonCode: 'invalid_port_binding' }>;

export type InvokeRetrieverSearchPortResultV1 =
  | Readonly<{ ok: true; outcome: RetrieverSearchPortOutcomeV1 }>
  | Readonly<{ ok: false; reasonCode: 'port_binding_invalid' }>;

type RetrieverSearchPortBinding = Readonly<{
  scope: object;
  execute: RetrieverSearchPortExecutorV1;
}>;

const retrieverSearchPortBindings = new WeakMap<
  RetrieverSearchPortV1,
  RetrieverSearchPortBinding
>();

export function createRetrieverSearchPortV1(input: {
  scope: object;
  execute: RetrieverSearchPortExecutorV1;
}): CreateRetrieverSearchPortResultV1 {
  if (!isObjectReference(input.scope) || typeof input.execute !== 'function') {
    return Object.freeze({ ok: false, reasonCode: 'invalid_port_binding' });
  }

  const port = Object.freeze({
    schemaVersion: RETRIEVER_SEARCH_PORT_VERSION,
  });
  retrieverSearchPortBindings.set(
    port,
    Object.freeze({ scope: input.scope, execute: input.execute }),
  );
  return Object.freeze({ ok: true, port });
}

export async function invokeRetrieverSearchPortV1(input: {
  port: RetrieverSearchPortV1;
  scope: object;
  request: RetrieverSearchPortRequestV1;
}): Promise<InvokeRetrieverSearchPortResultV1> {
  if (!isObjectReference(input.port) || !isObjectReference(input.scope)) {
    return Object.freeze({ ok: false, reasonCode: 'port_binding_invalid' });
  }

  const binding = retrieverSearchPortBindings.get(input.port);
  if (binding === undefined || binding.scope !== input.scope) {
    return Object.freeze({ ok: false, reasonCode: 'port_binding_invalid' });
  }

  const outcome = await binding.execute(input.request);
  return Object.freeze({ ok: true, outcome });
}

function isObjectReference(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
