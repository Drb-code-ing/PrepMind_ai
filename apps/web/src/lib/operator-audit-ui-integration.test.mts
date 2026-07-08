import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(
  join(currentDir, '../app/(main)/operator-audit/page.tsx'),
  'utf8',
);

assert.match(pageSource, /currentUser\?\.role === 'ADMIN'/);
assert.match(pageSource, /useOperatorAuditLogs/);
assert.match(pageSource, /NoPermissionState/);
assert.match(pageSource, /setCursor\(null\)/);
assert.match(pageSource, /FilterSelect/);
assert.match(pageSource, /role="listbox"/);
assert.doesNotMatch(pageSource, /chat-sidebar/);
assert.doesNotMatch(pageSource, /<select/);
