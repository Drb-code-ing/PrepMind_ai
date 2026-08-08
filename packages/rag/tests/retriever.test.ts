import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';

import {
  createRetrieverSearchPortV1,
  invokeRetrieverSearchPortV1,
  RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
  type RetrieverSearchPortRequestV1,
} from '../src/retriever.ts';

const require = createRequire(import.meta.url);

function request(): RetrieverSearchPortRequestV1 {
  const value = {
    schemaVersion: RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
    runId: 'run_1',
    requestId: 'request_1',
    deadlineAt: '2026-08-04T12:00:10.000Z',
    query: 'bounded private query',
    topK: 8,
    minScore: 0.72,
    sourceTypes: ['knowledge_document'] as const,
    documentStatuses: ['DONE'] as const,
  } as RetrieverSearchPortRequestV1;
  Object.defineProperty(value, 'signal', {
    value: new AbortController().signal,
    enumerable: false,
  });
  return Object.freeze(value);
}

describe('Retriever search composition port', () => {
  test('publishes the Retriever runtime surface through the CommonJS package entry', () => {
    const entry = require('../index.cjs') as Record<string, unknown>;
    expect(entry.RETRIEVER_SEARCH_PORT_REQUEST_VERSION).toBe(RETRIEVER_SEARCH_PORT_REQUEST_VERSION);
    expect(entry.createRetrieverSearchPortV1).toBe(createRetrieverSearchPortV1);
    expect(entry.invokeRetrieverSearchPortV1).toBe(invokeRetrieverSearchPortV1);
  });

  test('binds an opaque immutable port to one exact execution scope', async () => {
    const scope = {};
    let calls = 0;
    const created = createRetrieverSearchPortV1({
      scope,
      execute: async (input) => {
        calls += 1;
        expect(input.query).toBe('bounded private query');
        expect(input.signal).toBeInstanceOf(AbortSignal);
        return { ok: true, response: { hits: [] } };
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(Object.isFrozen(created.port)).toBe(true);
    expect(JSON.stringify(created.port)).toBe('{"schemaVersion":"retriever-search-port-v1"}');
    expect(JSON.stringify(created.port)).not.toContain('private query');

    const invoked = await invokeRetrieverSearchPortV1({
      port: created.port,
      scope,
      request: request(),
    });
    expect(invoked).toEqual({
      ok: true,
      outcome: { ok: true, response: { hits: [] } },
    });
    expect(calls).toBe(1);
  });

  test('rejects cloned, forged, and cross-scope ports before executor dispatch', async () => {
    const scope = {};
    let calls = 0;
    const created = createRetrieverSearchPortV1({
      scope,
      execute: async () => {
        calls += 1;
        return { ok: true, response: { hits: [] } };
      },
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    for (const input of [
      { port: created.port, scope: {} },
      { port: { ...created.port }, scope },
      { port: Object.freeze({ schemaVersion: 'retriever-search-port-v1' as const }), scope },
    ]) {
      expect(
        await invokeRetrieverSearchPortV1({
          ...input,
          request: request(),
        }),
      ).toEqual({ ok: false, reasonCode: 'port_binding_invalid' });
    }
    expect(calls).toBe(0);
  });

  test('fails closed when a composition attempts to create an invalid binding', () => {
    expect(
      createRetrieverSearchPortV1({
        scope: null as unknown as object,
        execute: async () => ({ ok: true, response: { hits: [] } }),
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_port_binding' });
    expect(
      createRetrieverSearchPortV1({
        scope: {},
        execute: null as unknown as never,
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_port_binding' });
  });
});
