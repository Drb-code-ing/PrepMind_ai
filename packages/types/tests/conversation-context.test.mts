import assert from 'node:assert/strict';

import {
  conversationContextPrepareRequestSchema,
  conversationContextPrepareResponseSchema,
  conversationStateSchema,
  conversationSummaryStatusSchema,
  conversationSummaryTriggerReasonSchema,
} from '../src/api/conversation-context.ts';

const request = conversationContextPrepareRequestSchema.parse({
  conversationId: 'conv_1',
  maxInputTokens: 2500,
  statePatch: { activeGoal: '复习导数', activeQuestionId: 'question_1' },
});
assert.equal(request.conversationId, 'conv_1');

const response = conversationContextPrepareResponseSchema.parse({
  conversationId: 'conv_1',
  summaryBuffer: '用户正在复习导数。',
  coveredThroughOrder: 11,
  summaryVersion: 1,
  summaryStatus: 'generated',
  state: {
    conversationId: 'conv_1',
    activeGoal: '复习导数',
    activeQuestionId: 'question_1',
    stateVersion: 1,
    expiresAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  debug: {
    uncoveredMessageCount: 12,
    triggerReason: 'message_count',
    modelMode: 'mock',
    errorCode: null,
  },
});
assert.equal(response.summaryVersion, 1);

assert.deepEqual(conversationSummaryStatusSchema.options, [
  'not_needed',
  'reused',
  'generated',
  'degraded',
  'stale_snapshot',
  'cas_conflict',
]);
assert.deepEqual(conversationSummaryTriggerReasonSchema.options, [
  'message_count',
  'token_pressure',
  'none',
]);

assert.throws(() =>
  conversationContextPrepareRequestSchema.parse({
    ...request,
    pendingActionProposal: { type: 'SAVE_MEMORY' },
  }),
);
assert.throws(() =>
  conversationContextPrepareRequestSchema.parse({
    ...request,
    statePatch: { ...request.statePatch, lastToolNames: ['search'] },
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    sourceHash: 'must-not-be-public',
  }),
);
assert.throws(() =>
  conversationStateSchema.parse({
    ...response.state,
    summary: 'must-not-be-public',
  }),
);
assert.throws(() =>
  conversationStateSchema.parse({
    ...response.state,
    pendingActionProposal: { type: 'SAVE_MEMORY' },
  }),
);
assert.throws(() =>
  conversationStateSchema.parse({
    ...response.state,
    lastToolNames: ['search'],
  }),
);

assert.throws(() =>
  conversationContextPrepareRequestSchema.parse({ ...request, maxInputTokens: 199 }),
);
assert.throws(() =>
  conversationContextPrepareRequestSchema.parse({ ...request, maxInputTokens: 12_001 }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    summaryBuffer: 'x'.repeat(4_001),
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    debug: { ...response.debug, errorCode: 'x'.repeat(121) },
  }),
);

assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    summaryBuffer: null,
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    summaryBuffer: null,
    coveredThroughOrder: null,
    summaryVersion: null,
    summaryStatus: 'generated',
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    state: { ...response.state, conversationId: 'conv_2' },
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    state: {
      ...response.state,
      expiresAt: response.state?.updatedAt,
    },
  }),
);
assert.throws(() =>
  conversationContextPrepareResponseSchema.parse({
    ...response,
    coveredThroughOrder: Number.MAX_SAFE_INTEGER + 1,
  }),
);
