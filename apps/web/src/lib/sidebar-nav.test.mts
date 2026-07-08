import assert from 'node:assert/strict';

import { getSidebarNavItems } from './sidebar-nav.ts';

const studentItems = getSidebarNavItems('STUDENT');
assert.equal(
  studentItems.some((item) => item.href === '/operator-audit'),
  false,
);

const anonymousItems = getSidebarNavItems(undefined);
assert.equal(
  anonymousItems.some((item) => item.href === '/operator-audit'),
  false,
);

const adminItems = getSidebarNavItems('ADMIN');
assert.equal(
  adminItems.some((item) => item.href === '/operator-audit'),
  true,
);

const auditItem = adminItems.find((item) => item.href === '/operator-audit');
assert.equal(auditItem?.label, '审计');
assert.equal(auditItem?.adminOnly, true);
