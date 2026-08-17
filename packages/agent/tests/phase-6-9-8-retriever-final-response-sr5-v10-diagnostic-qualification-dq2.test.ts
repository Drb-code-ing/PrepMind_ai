import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_8_TASK8_MANIFEST } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import { qualifyPhase698Task9RewriteDiagnosticForTest } from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';

const CASE = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases[0]!;
const SENTINEL_PREFIX = 'dq2-raw-provider-secret';

type DiagnosticCase = Readonly<{
  name: string;
  payload(sentinel: string): Record<string, unknown>;
  expectedReason: 'schema_invalid' | 'response_invalid' | 'usage_invalid';
  expectedCategory:
    | 'provider_json_parse'
    | 'provider_object_missing'
    | 'provider_type_validation'
    | 'response_audit'
    | 'usage_validation';
  expectedStage:
    'provider_json_parse' | 'provider_object_missing' | 'provider_type_validation' | null;
}>;

const CASES: readonly DiagnosticCase[] = Object.freeze([
  ...[
    { name: 'choices-empty', choices: [] },
    { name: 'choices-multiple', choices: [{ message: {} }, { message: {} }] },
    { name: 'choice-null', choices: [null] },
    { name: 'message-null', choices: [{ message: null }] },
    { name: 'content-number', choices: [{ message: { content: 42 } }] },
  ].map(({ name, choices }): DiagnosticCase => ({
    name: `object-missing-${name}`,
    payload: (sentinel) => ({
      choices,
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: sentinel,
    }),
    expectedReason: 'schema_invalid',
    expectedCategory: 'provider_object_missing',
    expectedStage: 'provider_object_missing',
  })),
  ...[
    ['plain-prose', (sentinel: string) => `not-json:${sentinel}`],
    ['uppercase-fence', () => '```JSON\n{"rewrittenQuery":"safe"}\n```'],
    ['crlf-fence', () => '```json\r\n{"rewrittenQuery":"safe"}\r\n```'],
    ['trailing-text', () => '{"rewrittenQuery":"safe"} trailing'],
    ['truncated-array', () => '[1,'],
  ].map(([name, content]): DiagnosticCase => ({
    name: `json-parse-${name as string}`,
    payload: (sentinel) => ({
      choices: [{ message: { content: (content as (value: string) => string)(sentinel) } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: sentinel,
    }),
    expectedReason: 'schema_invalid',
    expectedCategory: 'provider_json_parse',
    expectedStage: 'provider_json_parse',
  })),
  ...[
    ['null', () => 'null'],
    ['array', () => '[]'],
    ['numeric-query', () => '{"rewrittenQuery":1}'],
    ['object-query', (sentinel: string) => JSON.stringify({ rewrittenQuery: { raw: sentinel } })],
    ['empty-query', () => '{"rewrittenQuery":""}'],
    ['wrapper', () => '{"wrapper":{"rewrittenQuery":"safe"}}'],
  ].map(([name, content]): DiagnosticCase => ({
    name: `type-validation-${name as string}`,
    payload: (sentinel) => ({
      choices: [{ message: { content: (content as (value: string) => string)(sentinel) } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
      provider_secret: sentinel,
    }),
    expectedReason: 'schema_invalid',
    expectedCategory: 'provider_type_validation',
    expectedStage: 'provider_type_validation',
  })),
  ...[
    {
      name: 'reasoning-string',
      message: (sentinel: string) => ({
        content: '{"rewrittenQuery":"safe"}',
        reasoning_content: sentinel,
      }),
      usage: () => ({ prompt_tokens: 2, completion_tokens: 1 }),
    },
    {
      name: 'reasoning-null',
      message: () => ({ content: '{"rewrittenQuery":"safe"}', reasoning_content: null }),
      usage: () => ({ prompt_tokens: 2, completion_tokens: 1 }),
    },
    {
      name: 'positive-reasoning-tokens',
      message: () => ({ content: '{"rewrittenQuery":"safe"}' }),
      usage: () => ({
        prompt_tokens: 2,
        completion_tokens: 1,
        completion_tokens_details: { reasoning_tokens: 1 },
      }),
    },
    {
      name: 'malformed-reasoning-details',
      message: () => ({ content: '{"rewrittenQuery":"safe"}' }),
      usage: (sentinel: string) => ({
        prompt_tokens: 2,
        completion_tokens: 1,
        completion_tokens_details: sentinel,
      }),
    },
  ].map(({ name, message, usage }): DiagnosticCase => ({
    name: `response-audit-${name}`,
    payload: (sentinel) => ({
      choices: [{ message: message(sentinel) }],
      usage: usage(sentinel),
      provider_secret: sentinel,
    }),
    expectedReason: 'response_invalid',
    expectedCategory: 'response_audit',
    expectedStage: null,
  })),
  ...[
    ['prompt-missing', { completion_tokens: 1 }],
    ['completion-missing', { prompt_tokens: 1 }],
    ['prompt-negative', { prompt_tokens: -1, completion_tokens: 1 }],
    ['prompt-fractional', { prompt_tokens: 1.5, completion_tokens: 1 }],
    ['prompt-unsafe', { prompt_tokens: Number.MAX_SAFE_INTEGER + 1, completion_tokens: 1 }],
    ['prompt-string', { prompt_tokens: '1', completion_tokens: 1 }],
    ['completion-zero', { prompt_tokens: 1, completion_tokens: 0 }],
  ].map(([name, usage]): DiagnosticCase => ({
    name: `usage-validation-${name as string}`,
    payload: (sentinel) => ({
      choices: [{ message: { content: '{"rewrittenQuery":"safe"}' } }],
      usage,
      provider_secret: sentinel,
    }),
    expectedReason: 'usage_invalid',
    expectedCategory: 'usage_validation',
    expectedStage: null,
  })),
]);

describe('SR5 v10 DQ2 zero-provider diagnostic robustness', () => {
  test('keeps held-out Provider shapes in their bounded failure categories', async () => {
    expect(CASES).toHaveLength(27);
    const observedNames = new Set<string>();

    for (const item of CASES) {
      expect(observedNames.has(item.name), item.name).toBeFalse();
      observedNames.add(item.name);
      const sentinel = `${SENTINEL_PREFIX}-${item.name}`;
      let fetchCalls = 0;
      const error = await qualifyPhase698Task9RewriteDiagnosticForTest({
        testCase: CASE,
        fetch: async () => {
          fetchCalls += 1;
          return new Response(JSON.stringify(item.payload(sentinel)), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      });

      expect(fetchCalls, item.name).toBe(1);
      expect(error.reason, item.name).toBe(item.expectedReason);
      expect(error.diagnostic, item.name).toEqual({
        adapterFailureCategory: item.expectedCategory,
        structuredOutputStage: item.expectedStage,
        providerWire: { dispatches: 1, responses: 1, verifiedUsage: 0 },
        rewriteFailureBoundary: 'adapter_state_mismatch',
      });
      expect(Object.isFrozen(error.diagnostic), item.name).toBeTrue();
      expect(JSON.stringify(error), item.name).not.toContain(SENTINEL_PREFIX);
      expect(JSON.stringify(error), item.name).not.toContain('provider_secret');
    }
  });
});
