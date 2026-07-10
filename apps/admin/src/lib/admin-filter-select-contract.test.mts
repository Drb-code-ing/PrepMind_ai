import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const componentSource = readFileSync(
  resolve(__dirname, '../components/admin-filter-select.tsx'),
  'utf8',
);

const auditPageSource = readFileSync(
  resolve(__dirname, '../app/audit/page.tsx'),
  'utf8',
);

test('admin filter select is a custom popover rather than native select', () => {
  assert.match(componentSource, /role="combobox"/);
  assert.match(componentSource, /role="listbox"/);
  assert.match(componentSource, /role="option"/);
  assert.match(componentSource, /aria-selected/);
  assert.match(componentSource, /aria-labelledby/);
  assert.match(componentSource, /aria-activedescendant/);
  assert.match(componentSource, /ArrowDown/);
  assert.match(componentSource, /ArrowUp/);
  assert.match(componentSource, /pm-scrollbar/);
  assert.match(componentSource, /admin-filter-select/);
  assert.doesNotMatch(componentSource, /<select/);
});

test('operator audit page also uses the custom admin filter select', () => {
  assert.match(auditPageSource, /AdminFilterSelect/);
  assert.doesNotMatch(auditPageSource, /<select/);
});
