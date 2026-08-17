import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_8_TASK8_MANIFEST } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import { qualifyPhase698Task9RewriteDiagnosticForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';

const CASE = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[0]!;

describe('SR5 v10 DQ1 zero-provider diagnostic qualification', () => {
  test('distinguishes adapter failure stages through the real adapter/runtime/candidate path', async () => {
    const cases = [
      {
        name: 'provider_json_parse',
        payload: {
          choices: [{ message: { content: '{bad-content' } }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        },
        expectedReason: 'schema_invalid',
        expectedStage: 'provider_json_parse',
      },
      {
        name: 'provider_object_missing',
        payload: {
          choices: [{ message: {} }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        },
        expectedReason: 'schema_invalid',
        expectedStage: 'provider_object_missing',
      },
      {
        name: 'provider_type_validation',
        payload: {
          choices: [{ message: { content: '{"wrong":true}' } }],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        },
        expectedReason: 'schema_invalid',
        expectedStage: 'provider_type_validation',
      },
      {
        name: 'response_audit',
        payload: {
          choices: [
            { message: { content: '{"rewrittenQuery":"safe"}', reasoning_content: 'forbidden' } },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        },
        expectedReason: 'response_invalid',
        expectedStage: null,
      },
      {
        name: 'usage_validation',
        payload: {
          choices: [{ message: { content: '{"rewrittenQuery":"safe"}' } }],
          usage: { prompt_tokens: 0, completion_tokens: 1 },
        },
        expectedReason: 'usage_invalid',
        expectedStage: null,
      },
    ] as const;

    for (const item of cases) {
      const sentinel = `provider-secret-${item.name}`;
      const error = await qualifyPhase698Task9RewriteDiagnosticForTest({
        testCase: CASE,
        fetch: async () =>
          new Response(JSON.stringify({ ...item.payload, provider_secret: sentinel }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      });

      expect(error.reason, item.name).toBe(item.expectedReason);
      expect(error.diagnostic, item.name).toMatchObject({
        adapterFailureCategory: item.name,
        structuredOutputStage: item.expectedStage,
        providerWire: { dispatches: 1, responses: 1, verifiedUsage: 0 },
      });
      expect(String(error), item.name).not.toContain(sentinel);
      expect(JSON.stringify(error), item.name).not.toContain('provider-secret');
    }
  });
});
