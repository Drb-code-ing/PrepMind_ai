import assert from 'node:assert/strict';

import {
  chatStreamEventSchema,
  chatStreamEventsQuerySchema,
  chatStreamEventsResponseSchema,
  chatTurnStatusResponseSchema,
} from '../src/api/chat-stream.ts';

const started = chatStreamEventSchema.parse({
  schemaVersion: 'chat-turn-stream-v1',
  turnId: 'turn_1',
  sequence: 0,
  eventId: 'evt_started',
  type: 'response_started',
  mode: 'mock',
  generator: 'deterministic-worker-v1',
});
assert.equal(started.sequence, 0);

const delta = chatStreamEventSchema.parse({
  schemaVersion: 'chat-turn-stream-v1',
  turnId: 'turn_1',
  sequence: 1,
  eventId: 'evt_delta',
  type: 'text_delta',
  text: 'bounded answer',
});
assert.equal(delta.type, 'text_delta');

assert.deepEqual(chatStreamEventsQuerySchema.parse({ limit: '2' }), {
  limit: 2,
});
assert.throws(() => chatStreamEventsQuerySchema.parse({ cursor: 'not-a-redis-id' }));

const response = chatStreamEventsResponseSchema.parse({
  events: [{ cursor: '1-0', event: started }],
  nextCursor: null,
  cursorState: 'initial',
  transport: 'available',
  hasMore: false,
  terminal: false,
});
assert.equal(response.events.length, 1);

const status = chatTurnStatusResponseSchema.parse({
  turn: {
    id: 'turn_1',
    conversationId: 'conversation_1',
    status: 'SUCCEEDED',
    responseMessageId: 'response_1',
    errorCode: null,
    startedAt: '2026-09-02T00:00:00.000Z',
    finishedAt: '2026-09-02T00:00:01.000Z',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:01.000Z',
  },
  backgroundJob: null,
  response: {
    id: 'response_1',
    role: 'ASSISTANT',
    content: 'answer',
    order: 1,
    createdAt: '2026-09-02T00:00:01.000Z',
  },
});
assert.equal(status.turn.status, 'SUCCEEDED');
