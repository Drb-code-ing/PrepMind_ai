import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEChartInitOptions } from './echart-rendering.ts';

test('uses svg renderer for sharper chart text and lines', () => {
  const options = buildEChartInitOptions(1.5);

  assert.equal(options.renderer, 'svg');
  assert.equal(options.devicePixelRatio, 1.5);
});

test('normalizes invalid device pixel ratio values', () => {
  assert.equal(buildEChartInitOptions(0).devicePixelRatio, 1);
  assert.equal(buildEChartInitOptions(Number.NaN).devicePixelRatio, 1);
});
