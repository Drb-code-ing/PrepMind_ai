import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getDisplayKnowledgePoints } from './knowledge-points.ts';

describe('getDisplayKnowledgePoints', () => {
  it('trims, removes empty values, deduplicates, and limits display points', () => {
    assert.deepEqual(
      getDisplayKnowledgePoints([' 函数 ', '', '函数', '导数', '导数 ', '极限'], 3),
      ['函数', '导数', '极限'],
    );
  });
});
