import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pageSource = readFileSync(
  fileURLToPath(new URL('../app/worker/page.tsx', import.meta.url)),
  'utf8',
);

assert.match(pageSource, /title="Knowledge Queue"/);
assert.match(pageSource, /title="Audit Export Queue"/);
assert.match(pageSource, /title="Audit Maintenance Queue"/);
assert.match(pageSource, /title="Audit Maintenance Freshness"/);
assert.match(pageSource, /aria-label={`\$\{title\} status \$\{check\.status\}`}/);
assert.doesNotMatch(pageSource, /证据包管理|Evidence Package/);
