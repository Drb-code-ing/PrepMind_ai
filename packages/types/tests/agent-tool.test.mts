import assert from 'node:assert/strict';

import { agentToolResultSchema } from '../src/api/agent-tool.ts';

const success = agentToolResultSchema.parse({
  ok: true,
  toolName: 'knowledge.search',
  data: { hitCount: 2 },
  retryable: false,
});

assert.deepEqual(success, {
  ok: true,
  toolName: 'knowledge.search',
  data: { hitCount: 2 },
  retryable: false,
});

const failure = agentToolResultSchema.parse({
  ok: false,
  toolName: 'knowledge.search',
  error: {
    code: 'VALIDATION_ERROR',
    message: 'limit must be <= 10',
    issues: [{ path: 'limit', message: 'Expected number <= 10' }],
  },
  retryable: true,
});

assert.equal(failure.ok, false);
assert.equal(failure.retryable, true);

assert.throws(() =>
  agentToolResultSchema.parse({
    ok: false,
    toolName: 'knowledge.search',
    error: {
      code: 'UNKNOWN',
      message: 'not allowed',
    },
    retryable: true,
  }),
);

assert.throws(() =>
  agentToolResultSchema.parse({
    ok: true,
    toolName: 'knowledge.search',
    data: { hitCount: 2 },
    error: {
      code: 'VALIDATION_ERROR',
      message: 'mixed envelope should fail',
    },
    retryable: false,
  }),
);

assert.throws(() =>
  agentToolResultSchema.parse({
    ok: false,
    toolName: 'knowledge.search',
    data: { hitCount: 2 },
    error: {
      code: 'VALIDATION_ERROR',
      message: 'mixed envelope should fail',
    },
    retryable: true,
  }),
);
