import assert from 'node:assert/strict';

import { agentTraceQueryKeys } from './agent-trace-query-keys.ts';

assert.deepEqual(agentTraceQueryKeys.all, ['agent-traces']);
assert.deepEqual(agentTraceQueryKeys.user('user_1'), ['agent-traces', 'user_1']);
assert.deepEqual(agentTraceQueryKeys.summary('user_1', 14), [
  'agent-traces',
  'user_1',
  'summary',
  { days: 14 },
]);
assert.deepEqual(agentTraceQueryKeys.runs('user_1', { limit: 10, mode: 'live' }), [
  'agent-traces',
  'user_1',
  'runs',
  { limit: 10, mode: 'live', route: undefined, status: undefined },
]);
assert.deepEqual(agentTraceQueryKeys.detail('user_1', 'run_1'), [
  'agent-traces',
  'user_1',
  'detail',
  'run_1',
]);
