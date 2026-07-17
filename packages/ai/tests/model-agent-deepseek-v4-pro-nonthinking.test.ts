import { describe, expect, it } from 'bun:test';

const MODULE_PATH = '../src/model-agent-deepseek-v4-pro-nonthinking';
const COMPLETIONS_URL = 'https://api.deepseek.com/v1/chat/completions';
const RAW_RESPONSE_CANARY = 'V6_RAW_RESPONSE_CANARY_MUST_NOT_ESCAPE';

type Audit = {
  reasoning: string;
  reasoningContentPresent: boolean;
  reportedReasoningTokens?: number;
  usageState: 'missing' | 'invalid' | 'positive';
};

type CreateTransport = (delegate: typeof fetch, onAudit?: (audit: Audit) => void) => typeof fetch;

async function loadCreateTransport(): Promise<CreateTransport | null> {
  const loaded = await import(MODULE_PATH).catch(() => null);
  const createTransport = loaded?.createDeepSeekV4ProNonThinkingFetch;
  return typeof createTransport === 'function' ? (createTransport as CreateTransport) : null;
}

function validRequestBody() {
  return {
    model: 'deepseek-v4-pro',
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: 'safe fixture' }],
  };
}

function successfulResponse(input: unknown = {}) {
  return new Response(
    JSON.stringify({
      id: 'unit-completion',
      choices: [
        {
          message: {
            role: 'assistant',
            content: RAW_RESPONSE_CANARY,
            ...(input as object),
          },
        },
      ],
      usage: { completion_tokens_details: {} },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function responseWithUsage(usage?: unknown) {
  return new Response(
    JSON.stringify({
      id: 'unit-completion',
      choices: [
        {
          message: {
            role: 'assistant',
            content: RAW_RESPONSE_CANARY,
          },
        },
      ],
      ...(usage === undefined ? {} : { usage }),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('DeepSeek V4 Pro non-thinking transport', () => {
  it('injects the exact non-thinking field into the canonical JSON request', async () => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    let delegateCalls = 0;
    let capturedBody: Record<string, unknown> | undefined;
    const transport = createTransport(async (_input, init) => {
      delegateCalls += 1;
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return successfulResponse();
    });

    await transport(COMPLETIONS_URL, {
      method: 'POST',
      body: JSON.stringify(validRequestBody()),
    });

    expect(delegateCalls).toBe(1);
    expect(capturedBody).toMatchObject({
      model: 'deepseek-v4-pro',
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
    });
    expect(capturedBody?.tools).toBeUndefined();
    expect(capturedBody?.tool_choice).toBeUndefined();
    expect(capturedBody?.functions).toBeUndefined();
    expect(capturedBody?.function_call).toBeUndefined();
    expect(capturedBody?.json_schema).toBeUndefined();
  });

  it.each([
    'http://api.deepseek.com/v1/chat/completions',
    'https://api.deepseek.com/v1/chat/completions?debug=1',
    'https://api.deepseek.com/v1/responses',
  ])('rejects an untrusted request URL before delegate: %s', async (url) => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    let delegateCalls = 0;
    const transport = createTransport(async () => {
      delegateCalls += 1;
      return successfulResponse();
    });

    await expect(
      transport(url, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).rejects.toThrow('DEEPSEEK_V4_PRO_NONTHINKING_REQUEST_INVALID');
    expect(delegateCalls).toBe(0);
  });

  it.each([
    { label: 'method', init: { method: 'GET', body: JSON.stringify(validRequestBody()) } },
    {
      label: 'model',
      init: {
        method: 'POST',
        body: JSON.stringify({ ...validRequestBody(), model: 'deepseek-v4-flash' }),
      },
    },
    {
      label: 'schema',
      init: {
        method: 'POST',
        body: JSON.stringify({ ...validRequestBody(), response_format: { type: 'json_schema' } }),
      },
    },
    {
      label: 'thinking',
      init: {
        method: 'POST',
        body: JSON.stringify({ ...validRequestBody(), thinking: { type: 'enabled' } }),
      },
    },
    {
      label: 'tools',
      init: { method: 'POST', body: JSON.stringify({ ...validRequestBody(), tools: [] }) },
    },
    {
      label: 'tool choice',
      init: {
        method: 'POST',
        body: JSON.stringify({ ...validRequestBody(), tool_choice: 'auto' }),
      },
    },
    {
      label: 'functions',
      init: { method: 'POST', body: JSON.stringify({ ...validRequestBody(), functions: [] }) },
    },
    {
      label: 'function call',
      init: {
        method: 'POST',
        body: JSON.stringify({ ...validRequestBody(), function_call: 'auto' }),
      },
    },
    {
      label: 'top-level json schema',
      init: { method: 'POST', body: JSON.stringify({ ...validRequestBody(), json_schema: {} }) },
    },
  ])('rejects a %s contract violation before delegate', async ({ init }) => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    let delegateCalls = 0;
    const transport = createTransport(async () => {
      delegateCalls += 1;
      return successfulResponse();
    });

    await expect(transport(COMPLETIONS_URL, init)).rejects.toThrow(
      'DEEPSEEK_V4_PRO_NONTHINKING_REQUEST_INVALID',
    );
    expect(delegateCalls).toBe(0);
  });

  it('reduces a non-thinking response violation to safe audit data before rejecting it', async () => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    const audits: Audit[] = [];
    const transport = createTransport(
      async () =>
        successfulResponse({
          reasoning_content: RAW_RESPONSE_CANARY,
          completion_tokens_details: undefined,
        }),
      (audit) => audits.push(audit),
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).rejects.toThrow('DEEPSEEK_V4_PRO_NONTHINKING_RESPONSE_INVALID');
    expect(audits).toEqual([
      {
        reasoning: 'not_reported',
        reasoningContentPresent: true,
        usageState: 'missing',
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain(RAW_RESPONSE_CANARY);
  });

  it('fails closed when a malformed response exposes a non-string reasoning field', async () => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    const audits: Audit[] = [];
    const transport = createTransport(
      async () =>
        successfulResponse({
          reasoning_content: { unexpected: true },
        }),
      (audit) => audits.push(audit),
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).rejects.toThrow('DEEPSEEK_V4_PRO_NONTHINKING_RESPONSE_INVALID');
    expect(audits).toEqual([
      {
        reasoning: 'not_reported',
        reasoningContentPresent: true,
        usageState: 'missing',
      },
    ]);
  });

  it('keeps an aggregate response with reported zero reasoning tokens eligible', async () => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    const audits: Audit[] = [];
    const transport = createTransport(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: RAW_RESPONSE_CANARY,
                },
              },
            ],
            usage: {
              completion_tokens: 8,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      (audit) => audits.push(audit),
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).resolves.toBeInstanceOf(Response);
    expect(audits).toEqual([
      {
        reasoning: 'reported_zero',
        reasoningContentPresent: false,
        reportedReasoningTokens: 0,
        usageState: 'missing',
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain(RAW_RESPONSE_CANARY);
  });

  it.each([
    {
      label: 'positive reported reasoning tokens',
      detail: 7,
      expected: {
        reasoning: 'reported_positive',
        reasoningContentPresent: false,
        reportedReasoningTokens: 7,
        usageState: 'missing',
      },
    },
    {
      label: 'an invalid reported reasoning detail',
      detail: -1,
      expected: {
        reasoning: 'invalid_detail',
        reasoningContentPresent: false,
        usageState: 'missing',
      },
    },
  ])('fails closed for $label without retaining response content', async ({ detail, expected }) => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    const audits: Audit[] = [];
    const transport = createTransport(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: RAW_RESPONSE_CANARY,
                },
              },
            ],
            usage: {
              completion_tokens_details: { reasoning_tokens: detail },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      (audit) => audits.push(audit),
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).rejects.toThrow('DEEPSEEK_V4_PRO_NONTHINKING_RESPONSE_INVALID');
    expect(audits).toEqual([expected]);
    expect(JSON.stringify(audits)).not.toContain(RAW_RESPONSE_CANARY);
  });

  it.each([
    {
      label: 'missing usage object',
      usage: undefined,
      expected: 'missing' as const,
    },
    {
      label: 'missing prompt token field',
      usage: { completion_tokens: 4 },
      expected: 'missing' as const,
    },
    {
      label: 'missing completion token field',
      usage: { prompt_tokens: 97 },
      expected: 'missing' as const,
    },
    {
      label: 'zero prompt tokens',
      usage: { prompt_tokens: 0, completion_tokens: 4 },
      expected: 'invalid' as const,
    },
    {
      label: 'negative completion tokens',
      usage: { prompt_tokens: 97, completion_tokens: -1 },
      expected: 'invalid' as const,
    },
    {
      label: 'fractional prompt tokens',
      usage: { prompt_tokens: 97.5, completion_tokens: 4 },
      expected: 'invalid' as const,
    },
    {
      label: 'unsafe completion tokens',
      usage: {
        prompt_tokens: 97,
        completion_tokens: Number.MAX_SAFE_INTEGER + 1,
      },
      expected: 'invalid' as const,
    },
    {
      label: 'positive safe usage',
      usage: { prompt_tokens: 731, completion_tokens: 19 },
      expected: 'positive' as const,
    },
  ])('classifies $label without retaining token values', async ({ usage, expected }) => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    const audits: Audit[] = [];
    const transport = createTransport(
      async () => responseWithUsage(usage),
      (audit) => audits.push(audit),
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).resolves.toBeInstanceOf(Response);
    expect(audits).toEqual([
      {
        reasoning: 'not_reported',
        reasoningContentPresent: false,
        usageState: expected,
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain(RAW_RESPONSE_CANARY);
    expect(Object.keys(audits[0] ?? {})).not.toContain('prompt_tokens');
    expect(Object.keys(audits[0] ?? {})).not.toContain('completion_tokens');
  });

  it('prevents a hostile callback from mutating an audit violation into an allowed response', async () => {
    const createTransport = await loadCreateTransport();
    expect(createTransport).toBeTypeOf('function');
    if (!createTransport) return;

    let observedFrozen = false;
    const transport = createTransport(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: RAW_RESPONSE_CANARY,
                  reasoning_content: RAW_RESPONSE_CANARY,
                },
              },
            ],
            usage: {
              prompt_tokens: 97,
              completion_tokens: 4,
              completion_tokens_details: { reasoning_tokens: 7 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      (audit) => {
        observedFrozen = Object.isFrozen(audit);
        const hostile = audit as unknown as Record<string, unknown>;
        try {
          hostile.reasoning = 'reported_zero';
          hostile.reasoningContentPresent = false;
          hostile.reportedReasoningTokens = 0;
        } catch {
          // A frozen audit may reject assignment in strict mode.
        }
      },
    );

    await expect(
      transport(COMPLETIONS_URL, {
        method: 'POST',
        body: JSON.stringify(validRequestBody()),
      }),
    ).rejects.toThrow('DEEPSEEK_V4_PRO_NONTHINKING_RESPONSE_INVALID');
    expect(observedFrozen).toBe(true);
  });
});
