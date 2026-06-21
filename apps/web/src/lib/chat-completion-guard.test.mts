import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChatCompletionSignature,
  CHAT_EMPTY_ASSISTANT_MESSAGE,
  getChatCompletionGuard,
  getChatSyncSettleMs,
} from './chat-completion-guard.ts';

const baseMessages = [
  {
    id: 'msg-1',
    role: 'user' as const,
    content: 'Explain Green theorem.',
  },
  {
    id: 'msg-2',
    role: 'assistant' as const,
    content: 'Green theorem converts a line integral to a double integral.',
  },
];

test('allows syncing when the latest completed message is from assistant', () => {
  assert.deepEqual(getChatCompletionGuard({ isLoading: false, messages: baseMessages }), {
    canSync: true,
    emptyAssistantReply: false,
    userMessageId: null,
    message: null,
  });
});

test('blocks completed chat sync when the latest message is still user-only', () => {
  assert.deepEqual(
    getChatCompletionGuard({
      isLoading: false,
      streamStarted: true,
      messages: [
        ...baseMessages,
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Why is the derivative a tangent slope?',
        },
      ],
    }),
    {
      canSync: false,
      emptyAssistantReply: true,
      userMessageId: 'msg-3',
      message: CHAT_EMPTY_ASSISTANT_MESSAGE,
    },
  );
});

test('does not report empty reply before a generation stream has started', () => {
  assert.deepEqual(
    getChatCompletionGuard({
      isLoading: false,
      streamStarted: false,
      messages: [
        ...baseMessages,
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Why is the derivative a tangent slope?',
        },
      ],
    }),
    {
      canSync: false,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    },
  );
});

test('does not flag user-only latest message while stream is still loading', () => {
  assert.deepEqual(
    getChatCompletionGuard({
      isLoading: true,
      streamStarted: true,
      messages: [
        ...baseMessages,
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Why is the derivative a tangent slope?',
        },
      ],
    }),
    {
      canSync: false,
      emptyAssistantReply: false,
      userMessageId: null,
      message: null,
    },
  );
});

test('blocks syncing empty assistant replies after loading completes', () => {
  assert.deepEqual(
    getChatCompletionGuard({
      isLoading: false,
      streamStarted: true,
      messages: [
        ...baseMessages,
        {
          id: 'msg-3',
          role: 'user' as const,
          content: 'Why is the derivative a tangent slope?',
        },
        {
          id: 'msg-4',
          role: 'assistant' as const,
          content: '   ',
        },
      ],
    }),
    {
      canSync: false,
      emptyAssistantReply: true,
      userMessageId: 'msg-3',
      message: CHAT_EMPTY_ASSISTANT_MESSAGE,
    },
  );
});

test('chat completion signature changes when assistant content changes without length changes', () => {
  const partial = buildChatCompletionSignature([
    baseMessages[0],
    {
      id: 'msg-2',
      role: 'assistant' as const,
      content: '$$f',
    },
  ]);
  const complete = buildChatCompletionSignature([
    baseMessages[0],
    {
      id: 'msg-2',
      role: 'assistant' as const,
      content: "$$f'(x)=2x$$",
    },
  ]);

  assert.notEqual(partial, complete);
});

test('waits longer than the stream UI throttle before syncing completed streams', () => {
  assert.equal(getChatSyncSettleMs({ streamStarted: false, throttleMs: 80 }), 0);
  assert.ok(getChatSyncSettleMs({ streamStarted: true, throttleMs: 80 }) > 80);
});
