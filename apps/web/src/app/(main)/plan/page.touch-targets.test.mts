import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('review plan window buttons keep 44px touch targets', () => {
  const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const planWindowBlock = pageSource.match(
    /<div className="col-span-2[^"]*">\s*[^<]*\s*<div className="[^"]*">\s*{\(\[7, 14\] as const\)\.map[\s\S]*?<\/div>\s*<\/div>/,
  );

  assert.ok(planWindowBlock, 'expected to find the 7/14 day plan window control');
  assert.match(
    planWindowBlock[0],
    /className={`[^`]*\bmin-h-11\b/,
    'expected each plan window button to keep at least a 44px touch target',
  );
});
