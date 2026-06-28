import assert from 'node:assert/strict';

import { memoryAgentQueryKeys } from './memory-agent-query-keys.ts';

assert.deepEqual(memoryAgentQueryKeys.candidates('user_1', { status: 'PENDING', limit: 20 }), [
  'memory-agent',
  'user_1',
  'candidates',
  { status: 'PENDING', limit: 20 },
]);

assert.deepEqual(memoryAgentQueryKeys.memories('user_1', { status: 'ACTIVE' }), [
  'memory-agent',
  'user_1',
  'memories',
  { status: 'ACTIVE', type: undefined },
]);

assert.notDeepEqual(
  memoryAgentQueryKeys.candidates('user_1', { status: 'PENDING', limit: 20 }),
  memoryAgentQueryKeys.candidates('user_2', { status: 'PENDING', limit: 20 }),
);

assert.deepEqual(memoryAgentQueryKeys.candidates('user_1', {}), [
  'memory-agent',
  'user_1',
  'candidates',
  { status: 'PENDING', limit: 20 },
]);

assert.deepEqual(memoryAgentQueryKeys.memories('user_1', {}), [
  'memory-agent',
  'user_1',
  'memories',
  { status: 'ACTIVE', type: undefined },
]);
