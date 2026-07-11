import {
  assertSafeSummaryOutput,
  redactSummaryCredentials,
} from './conversation-summary-safety';

describe('conversation summary safety', () => {
  it('redacts credential-like input before provider calls', () => {
    const redacted = redactSummaryCredentials(
      [
        'Authorization: Bearer example-secret-token-value',
        'Cookie: sid=private',
        'DEEPSEEK_API_KEY=secret',
        'raw sk-live-secret',
        'client_secret=oauth-private',
        'password: database-private',
        '-----BEGIN PRIVATE KEY----- private-material -----END PRIVATE KEY-----',
      ].join('\n'),
    );
    expect(redacted).not.toContain('example-secret-token-value');
    expect(redacted).not.toContain('sid=private');
    expect(redacted).not.toContain('secret');
    expect(redacted).not.toContain('sk-live-secret');
    expect(redacted).not.toContain('oauth-private');
    expect(redacted).not.toContain('database-private');
    expect(redacted).not.toContain('private-material');
    expect(redacted).toContain('[REDACTED]');
  });

  it('rejects credential-like model output with a fixed safe error', () => {
    expect(() =>
      assertSafeSummaryOutput('用户的 OPENAI_API_KEY=should-not-persist'),
    ).toThrow('CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED');
    for (const unsafe of [
      'raw sk-live-secret',
      'client_secret=oauth-private',
      'password: database-private',
      '-----BEGIN PRIVATE KEY----- private-material -----END PRIVATE KEY-----',
    ]) {
      expect(() => assertSafeSummaryOutput(unsafe)).toThrow(
        'CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED',
      );
    }
    expect(() => assertSafeSummaryOutput('用户正在复习导数。')).not.toThrow();
  });
});
