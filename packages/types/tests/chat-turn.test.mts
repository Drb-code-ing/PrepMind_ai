import assert from 'node:assert/strict';

import {
  chatTurnEnqueueRequestSchema,
  chatTurnEnqueueResponseSchema,
} from '../src/api/chat-turn.ts';

const request = chatTurnEnqueueRequestSchema.parse({
  conversationId: ' conversation_1 ',
  clientRequestId: ' request_1 ',
  inputHash: `sha256:${'a'.repeat(64)}`,
  inputMessageIds: [' message_1 ', 'message_2'],
  budgetPolicyVersion: ' chat-budget-v1 ',
});

assert.equal(request.conversationId, 'conversation_1');
assert.equal(request.clientRequestId, 'request_1');
assert.deepEqual(request.inputMessageIds, ['message_1', 'message_2']);
assert.equal(request.budgetPolicyVersion, 'chat-budget-v1');

for (const invalid of [
  { ...request, extra: true },
  { ...request, inputHash: 'sha256:ABC' },
  { ...request, inputMessageIds: ['message_1', 'message_1'] },
  { ...request, inputMessageIds: [] },
  { ...request, clientRequestId: 'x'.repeat(121) },
]) {
  assert.throws(() => chatTurnEnqueueRequestSchema.parse(invalid));
}

const response = chatTurnEnqueueResponseSchema.parse({
  kind: 'created',
  turn: {
    id: 'turn_1',
    conversationId: 'conversation_1',
    status: 'QUEUED',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  },
  backgroundJob: {
    id: 'job_1',
    status: 'QUEUED',
    attempt: 0,
    maxAttempts: 3,
    progress: 0,
    requestedAt: '2026-09-04T00:00:00.000Z',
  },
});

assert.equal(response.kind, 'created');
assert.equal(response.turn.status, 'QUEUED');
assert.equal('outboxEvent' in response, false);
assert.throws(() =>
  chatTurnEnqueueResponseSchema.parse({
    ...response,
    turn: { ...response.turn, inputHash: request.inputHash },
  }),
);
assert.throws(() =>
  chatTurnEnqueueResponseSchema.parse({
    ...response,
    backgroundJob: { ...response.backgroundJob, progress: 101 },
  }),
);
assert.throws(() =>
  chatTurnEnqueueResponseSchema.parse({
    ...response,
    turn: { ...response.turn, status: 'UNKNOWN' },
  }),
);
