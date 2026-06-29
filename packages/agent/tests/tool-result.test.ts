import { describe, expect, it } from 'bun:test';

import { createToolFailure, createToolSuccess } from '../src/tools/tool-result';

describe('agent tool result helpers', () => {
  it('creates successful tool result envelopes', () => {
    expect(createToolSuccess('knowledge.search', { hitCount: 2 })).toEqual({
      ok: true,
      toolName: 'knowledge.search',
      data: { hitCount: 2 },
      retryable: false,
    });
  });

  it('creates retryable validation failure envelopes', () => {
    expect(
      createToolFailure({
        toolName: 'knowledge.search',
        code: 'VALIDATION_ERROR',
        message: 'limit must be <= 10',
        retryable: true,
        issues: [{ path: 'limit', message: 'Expected number <= 10' }],
      }),
    ).toEqual({
      ok: false,
      toolName: 'knowledge.search',
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must be <= 10',
        issues: [{ path: 'limit', message: 'Expected number <= 10' }],
      },
      retryable: true,
    });
  });

  it('omits issues on failures that do not include issue details', () => {
    const result = createToolFailure({
      toolName: 'memory.save',
      code: 'FORBIDDEN',
      message: 'approval required',
      retryable: false,
    });

    expect(result).toEqual({
      ok: false,
      toolName: 'memory.save',
      error: {
        code: 'FORBIDDEN',
        message: 'approval required',
      },
      retryable: false,
    });
    expect('issues' in result.error).toBe(false);
  });
});
