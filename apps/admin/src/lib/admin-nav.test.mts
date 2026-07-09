import assert from 'node:assert/strict';

import { getAdminNavItems } from './admin-nav.ts';

const items = getAdminNavItems();

assert.deepEqual(
  items.map((item) => item.href),
  ['/', '/outbox', '/audit', '/worker'],
);
assert.equal(items.find((item) => item.href === '/outbox')?.label, 'Outbox Ops');
assert.equal(items.every((item) => item.adminOnly), true);
