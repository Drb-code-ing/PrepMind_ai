import {
  hashSummarySource,
  resolveSummaryTrigger,
  selectCompleteSummaryTarget,
} from './conversation-summary-policy';

describe('conversation summary policy', () => {
  it('prefers the 12-message trigger before 70 percent token pressure', () => {
    expect(
      resolveSummaryTrigger({
        uncoveredMessageCount: 12,
        estimatedFullContextTokens: 2000,
        maxInputTokens: 2500,
      }),
    ).toBe('message_count');
    expect(
      resolveSummaryTrigger({
        uncoveredMessageCount: 2,
        estimatedFullContextTokens: 1750,
        maxInputTokens: 2500,
      }),
    ).toBe('token_pressure');
    expect(
      resolveSummaryTrigger({
        uncoveredMessageCount: 2,
        estimatedFullContextTokens: 1749,
        maxInputTokens: 2500,
      }),
    ).toBe('none');
  });

  it('fails closed to no trigger for unsafe numeric input', () => {
    expect(
      resolveSummaryTrigger({
        uncoveredMessageCount: Number.NaN,
        estimatedFullContextTokens: 1800,
        maxInputTokens: 2500,
      }),
    ).toBe('none');
  });

  it('never covers a user-only tail', () => {
    expect(
      selectCompleteSummaryTarget([
        { id: 'u1', order: 0, role: 'USER', content: 'question' },
        { id: 'a1', order: 1, role: 'ASSISTANT', content: 'answer' },
        { id: 'u2', order: 2, role: 'USER', content: 'unfinished' },
      ]),
    ).toEqual({ coveredThroughOrder: 1, sourceMessageCount: 2 });
  });

  it('hashes stable message identity, order, role and content', () => {
    const messages = [
      { id: 'u1', order: 0, role: 'USER' as const, content: 'question' },
      { id: 'a1', order: 1, role: 'ASSISTANT' as const, content: 'answer' },
    ];
    const hash = hashSummarySource(messages);
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hash).toBe(hashSummarySource([...messages].reverse()));
    expect(hash).not.toBe(
      hashSummarySource([{ ...messages[0], content: 'changed' }, messages[1]]),
    );
  });
});
