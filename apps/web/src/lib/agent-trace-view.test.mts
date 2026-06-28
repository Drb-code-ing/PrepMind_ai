import assert from 'node:assert/strict';

import {
  formatAgentTraceCost,
  formatAgentTraceDateTime,
  formatAgentTraceDuration,
  formatAgentTracePricingStatus,
  getAgentTraceModeLabel,
  getAgentTraceRouteLabel,
  getAgentTraceStatusLabel,
  getAgentTraceVerifierStatusLabel,
} from './agent-trace-view.ts';

assert.equal(getAgentTraceModeLabel('mock'), 'Mock');
assert.equal(getAgentTraceModeLabel('live'), 'Live');
assert.equal(getAgentTraceStatusLabel('completed'), '已完成');
assert.equal(getAgentTraceStatusLabel('degraded'), '已降级');
assert.equal(getAgentTraceStatusLabel('failed'), '失败');
assert.equal(getAgentTraceRouteLabel('tutor'), 'Tutor');
assert.equal(getAgentTraceRouteLabel(null), '未路由');
assert.equal(getAgentTraceVerifierStatusLabel('trusted'), '可信');
assert.equal(getAgentTraceVerifierStatusLabel(undefined), '未执行');
assert.equal(formatAgentTraceDuration(1234), '1.23s');
assert.equal(formatAgentTraceDuration(940), '940ms');
assert.equal(formatAgentTraceDuration(null), '未知');
assert.equal(formatAgentTraceCost(0), '0');
assert.equal(formatAgentTraceCost(0.004321), '0.004321');
assert.equal(formatAgentTracePricingStatus(true), '已配置单价');
assert.equal(formatAgentTracePricingStatus(false), '未配置单价');
assert.equal(formatAgentTraceDateTime('2026-06-28T08:00:00.000Z').includes('2026'), true);
