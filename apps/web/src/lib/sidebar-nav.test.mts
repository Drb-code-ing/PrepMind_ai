import assert from 'node:assert/strict';

import { getSidebarNavItems } from './sidebar-nav.ts';

const studentItems = getSidebarNavItems('STUDENT');
assert.equal(
  studentItems.some((item) => item.href === '/operator-audit'),
  false,
);
assert.equal(
  studentItems.some((item) => item.href === 'http://127.0.0.1:3100'),
  false,
);

const anonymousItems = getSidebarNavItems(undefined);
assert.equal(
  anonymousItems.some((item) => item.href === '/operator-audit'),
  false,
);
assert.equal(
  anonymousItems.some((item) => item.href === 'http://127.0.0.1:3100'),
  false,
);

const adminItems = getSidebarNavItems('ADMIN');
assert.equal(
  adminItems.some((item) => item.href === '/operator-audit'),
  true,
);
assert.equal(
  adminItems.some((item) => item.href === 'http://127.0.0.1:3100'),
  true,
);

const auditItem = adminItems.find((item) => item.href === '/operator-audit');
assert.equal(auditItem?.label, '审计');
assert.equal(auditItem?.adminOnly, true);

const adminConsoleItem = adminItems.find((item) => item.href === 'http://127.0.0.1:3100');
assert.equal(adminConsoleItem?.label, '后台管理');
assert.equal(adminConsoleItem?.adminOnly, true);
assert.equal(adminConsoleItem?.desktopOnly, undefined);
assert.equal(adminConsoleItem?.external, true);
