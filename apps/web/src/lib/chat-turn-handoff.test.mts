import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasPendingChatTurnHandoff,
  isChatTurnHandoffMessage,
  omitChatTurnHandoffMessages,
} from './chat-turn-handoff.ts';

const handoff = {
  type: 'prepmind-chat-turn-handoff-v1',
  turnId: 'turn_1',
  conversationId: 'conv_1',
  status: 'QUEUED',
  backgroundJobId: 'job_1',
};

test('recognizes only a strict assistant ChatTurn handoff annotation', () => {
  assert.equal(
    isChatTurnHandoffMessage({
      id: 'assistant_1',
      role: 'assistant',
      content: 'Queued',
      annotations: [handoff],
    }),
    true,
  );
  assert.equal(
    isChatTurnHandoffMessage({
      id: 'assistant_1',
      role: 'assistant',
      content: 'Queued',
      annotations: [{ ...handoff, prompt: 'must not pass' }],
    }),
    false,
  );
  assert.equal(
    isChatTurnHandoffMessage({
      id: 'user_1',
      role: 'user',
      content: 'Question',
      annotations: [handoff],
    }),
    false,
  );
});

test('treats only the latest handoff placeholder as a pending turn', () => {
  assert.equal(
    hasPendingChatTurnHandoff([
      { id: 'user_1', role: 'user', content: 'Question' },
      {
        id: 'assistant_1',
        role: 'assistant',
        content: 'Queued',
        annotations: [handoff],
      },
    ]),
    true,
  );
  assert.equal(
    hasPendingChatTurnHandoff([
      {
        id: 'assistant_1',
        role: 'assistant',
        content: 'Queued',
        annotations: [handoff],
      },
      { id: 'user_2', role: 'user', content: 'Next question' },
    ]),
    false,
  );
});

test('removes transport placeholders before local or snapshot persistence', () => {
  const user = { id: 'user_1', role: 'user', content: 'Question' };
  const queued = {
    id: 'assistant_1',
    role: 'assistant',
    content: 'Queued',
    annotations: [handoff],
  };

  assert.deepEqual(omitChatTurnHandoffMessages([user, queued]), [user]);
});
