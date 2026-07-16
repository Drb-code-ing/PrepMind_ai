import { REVIEW_MODEL_CANDIDATE_SCHEMA } from '@repo/agent';

import {
  createReviewPlannerControlledLiveV4JsonExecutor,
  type ReviewPlannerControlledLiveV4Fetch,
} from './review-planner-controlled-live-eval-v4-json';

const validJson = JSON.stringify({
  focusIndexes: [0],
  diagnosis: 'review_pressure',
});
const rawCanary = 'RAW_DEEPSEEK_V4_FENCED_CONTENT_CANARY';

describe('review planner controlled Live v4 JSON executor', () => {
  it('accepts only an exact lower-case json fence and submits JSON-object mode through injected fetch', async () => {
    const fetch = fakeFetch({
      choices: [{ message: { content: `\`\`\`json\n${validJson}\n\`\`\`` } }],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    });
    const executor = createReviewPlannerControlledLiveV4JsonExecutor(
      validConfig(),
      { fetch },
    );

    await expect(invoke(executor)).resolves.toEqual({
      object: { focusIndexes: [0], diagnosis: 'review_pressure' },
      usage: { inputTokens: 12, outputTokens: 4 },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.requests[0] ?? [];
    expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(init?.headers['content-type']).toBe('application/json');
    expect(String(init?.body)).toBe(
      JSON.stringify({
        model: 'deepseek-v4-flash',
        response_format: { type: 'json_object' },
        max_tokens: 32,
        stream: false,
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
      }),
    );
  });

  it('accepts ordinary JSON only when JSON itself accepts its surrounding whitespace', async () => {
    const executor = createReviewPlannerControlledLiveV4JsonExecutor(
      validConfig(),
      { fetch: fakeFetch(responseFor(` \n\t${validJson}\r\n `)) },
    );

    await expect(invoke(executor)).resolves.toMatchObject({
      object: { focusIndexes: [0], diagnosis: 'review_pressure' },
    });
  });

  it.each([
    ['unlabelled fence', `\`\`\`\n${validJson}\n\`\`\``],
    ['upper-case fence label', `\`\`\`JSON\n${validJson}\n\`\`\``],
    [
      'leading whitespace before fence',
      ` ${`\`\`\`json\n${validJson}\n\`\`\``}`,
    ],
    [
      'multiple fenced documents',
      `\`\`\`json\n${validJson}\n\`\`\`\n\`\`\`json\n${validJson}\n\`\`\``,
    ],
    ['prose prefix', `Here is the result:\n${validJson}`],
    ['fence suffix', `\`\`\`json\n${validJson}\n\`\`\`\nthanks`],
    ['concatenated JSON', `${validJson}${validJson}`],
    ['JSON array', `[${validJson}]`],
    [
      'strict schema extra field',
      JSON.stringify({
        focusIndexes: [0],
        diagnosis: 'review_pressure',
        [rawCanary]: true,
      }),
    ],
  ])(
    'rejects %s without exposing raw model content',
    async (_label, content) => {
      const executor = createReviewPlannerControlledLiveV4JsonExecutor(
        validConfig(),
        { fetch: fakeFetch(responseFor(content)) },
      );

      const error = await rejected(invoke(executor));

      expect(error.message).toBe('MODEL_AGENT_V4_RESPONSE_INVALID');
      expect(JSON.stringify(error)).not.toContain(rawCanary);
      expect(error.message).not.toContain(content);
    },
  );

  it('rejects reasoning-content fallback instead of treating it as JSON content', async () => {
    const executor = createReviewPlannerControlledLiveV4JsonExecutor(
      validConfig(),
      {
        fetch: fakeFetch({
          choices: [{ message: { reasoning_content: validJson } }],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        }),
      },
    );

    const error = await rejected(invoke(executor));
    expect(error.message).toBe('MODEL_AGENT_V4_RESPONSE_INVALID');
    expect(JSON.stringify(error)).not.toContain(validJson);
  });

  it('normalizes a rejecting injected fetch without exposing its raw rejection canary', async () => {
    const rawCanary = 'RAW_V4_FAKE_FETCH_REJECTION_CANARY';
    const fetch = jest.fn(() =>
      Promise.reject(new Error(rawCanary)),
    ) as jest.MockedFunction<ReviewPlannerControlledLiveV4Fetch>;
    const executor = createReviewPlannerControlledLiveV4JsonExecutor(
      validConfig(),
      { fetch },
    );

    const error = await rejected(invoke(executor));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(error.message).toBe('MODEL_AGENT_V4_TRANSPORT_FAILED');
    expect(error.message).not.toContain(rawCanary);
    expect(JSON.stringify(error)).not.toContain(rawCanary);
  });
});

function validConfig() {
  return {
    provider: 'deepseek' as const,
    apiKey: 'test-only-private-key',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
  };
}

function responseFor(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 12, completion_tokens: 4 },
  };
}

type FakeFetch = jest.MockedFunction<ReviewPlannerControlledLiveV4Fetch> & {
  requests: Parameters<ReviewPlannerControlledLiveV4Fetch>[];
};

function fakeFetch(payload: unknown): FakeFetch {
  const requests: Parameters<ReviewPlannerControlledLiveV4Fetch>[] = [];
  const fetch = jest.fn(
    (...input: Parameters<ReviewPlannerControlledLiveV4Fetch>) => {
      requests.push(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      });
    },
  );
  return Object.assign(fetch, { requests }) as FakeFetch;
}

function invoke(
  executor: ReturnType<typeof createReviewPlannerControlledLiveV4JsonExecutor>,
) {
  return executor({
    schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
    systemPrompt: 'system prompt',
    userPrompt: 'user prompt',
    maxOutputTokens: 32,
    signal: new AbortController().signal,
  });
}

async function rejected(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected rejection');
}
