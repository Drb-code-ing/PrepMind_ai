import { sanitizeJobError } from './job-error-sanitizer';

describe('sanitizeJobError', () => {
  it('redacts common API key, token, and cookie shapes', () => {
    const result = sanitizeJobError(
      [
        'Bearer bearer-secret',
        'access_token=access-secret',
        'refresh_token=refresh-secret',
        'api_key=api-secret',
        'x-api-key: x-secret',
        'QWEN_API_KEY=qwen-secret',
        'DASHSCOPE_API_KEY=dashscope-secret',
        'OPENAI_API_KEY=sk-openai-secret',
        'Set-Cookie: session=cookie-secret; HttpOnly',
        'raw sk-live-secret',
      ].join(' '),
    );

    expect(result).not.toContain('bearer-secret');
    expect(result).not.toContain('access-secret');
    expect(result).not.toContain('refresh-secret');
    expect(result).not.toContain('api-secret');
    expect(result).not.toContain('x-secret');
    expect(result).not.toContain('qwen-secret');
    expect(result).not.toContain('dashscope-secret');
    expect(result).not.toContain('sk-openai-secret');
    expect(result).not.toContain('cookie-secret');
    expect(result).not.toContain('sk-live-secret');
  });

  it('redacts JSON-shaped secrets from object errors', () => {
    const result = sanitizeJobError({
      access_token: 'json-access-secret',
      refresh_token: 'json-refresh-secret',
      api_key: 'json-api-secret',
      cookie: 'session=json-cookie-secret',
      nested: {
        QWEN_API_KEY: 'json-qwen-secret',
      },
    });

    expect(result).not.toContain('json-access-secret');
    expect(result).not.toContain('json-refresh-secret');
    expect(result).not.toContain('json-api-secret');
    expect(result).not.toContain('json-cookie-secret');
    expect(result).not.toContain('json-qwen-secret');
  });
});
