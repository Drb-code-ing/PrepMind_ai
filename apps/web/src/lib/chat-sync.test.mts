import assert from 'node:assert/strict';
import test from 'node:test';

import { beginChatServerSync, buildChatSyncSignature } from './chat-sync.ts';

const baseMessages = [
  {
    id: 'msg-1',
    userId: 'user-1',
    role: 'user' as const,
    content: '解释这道题',
    order: 0,
    createdAt: 1_718_169_600_000,
  },
  {
    id: 'msg-2',
    userId: 'user-1',
    role: 'assistant' as const,
    content: '先看条件。',
    order: 1,
    createdAt: 1_718_169_601_000,
  },
];

test('builds the same chat sync signature for the same local snapshot', () => {
  assert.equal(
    buildChatSyncSignature(baseMessages, 'conv-1'),
    buildChatSyncSignature([...baseMessages], 'conv-1'),
  );
});

test('changes chat sync signature when assistant content changes', () => {
  const changedMessages = baseMessages.map((message) =>
    message.id === 'msg-2' ? { ...message, content: '先看条件，再列公式。' } : message,
  );

  assert.notEqual(
    buildChatSyncSignature(baseMessages, 'conv-1'),
    buildChatSyncSignature(changedMessages, 'conv-1'),
  );
});

test('uses server conversation id in chat sync signature after creation', () => {
  assert.notEqual(
    buildChatSyncSignature(baseMessages, null),
    buildChatSyncSignature(baseMessages, 'conv-1'),
  );
});

test('starts exactly one sync for the first completed change after server hydration', () => {
  const hydratedSignature = buildChatSyncSignature(baseMessages, 'conv-1');
  const changedMessages = [
    ...baseMessages,
    {
      id: 'msg-3',
      userId: 'user-1',
      role: 'user' as const,
      content: 'Continue after refresh',
      order: 2,
      createdAt: 1_718_169_602_000,
    },
    {
      id: 'msg-4',
      userId: 'user-1',
      role: 'assistant' as const,
      content: 'Continue with the derivative example.',
      order: 3,
      createdAt: 1_718_169_603_000,
    },
  ];
  const changedSignature = buildChatSyncSignature(changedMessages, 'conv-1');
  const unchanged = beginChatServerSync({
    syncKey: hydratedSignature,
    lastServerSyncKey: hydratedSignature,
    inFlightServerSyncKey: '',
  });
  const firstChanged = beginChatServerSync({
    syncKey: changedSignature,
    lastServerSyncKey: hydratedSignature,
    inFlightServerSyncKey: '',
  });
  const duplicateChanged = beginChatServerSync({
    syncKey: changedSignature,
    lastServerSyncKey: hydratedSignature,
    inFlightServerSyncKey: firstChanged.nextInFlightServerSyncKey,
  });

  assert.equal(unchanged.shouldSync, false);
  assert.equal(firstChanged.shouldSync, true);
  assert.equal(firstChanged.nextInFlightServerSyncKey, changedSignature);
  assert.equal(duplicateChanged.shouldSync, false);
});
