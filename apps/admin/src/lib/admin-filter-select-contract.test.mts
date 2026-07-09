import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const componentSource = readFileSync(
  resolve(process.cwd(), 'apps/admin/src/components/admin-filter-select.tsx'),
  'utf8',
);

const auditPageSource = readFileSync(
  resolve(process.cwd(), 'apps/admin/src/app/audit/page.tsx'),
  'utf8',
);

test('admin filter select is a custom popover rather than native select', () => {
  assert.match(componentSource, /role="combobox"/);
  assert.match(componentSource, /role="listbox"/);
  assert.match(componentSource, /role="option"/);
  assert.match(componentSource, /aria-selected/);
  assert.match(componentSource, /pm-scrollbar/);
  assert.match(componentSource, /admin-filter-select/);
  assert.doesNotMatch(componentSource, /<select/);
});

test('operator audit page also uses the custom admin filter select', () => {
  assert.match(auditPageSource, /AdminFilterSelect/);
  assert.doesNotMatch(auditPageSource, /<select/);
});
