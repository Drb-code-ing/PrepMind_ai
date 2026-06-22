import assert from 'node:assert/strict';

const reviewAgentModule = await import('../src/api/review-agent.ts');

assert.equal(reviewAgentModule.reviewAgentPrioritySchema.parse('high'), 'high');
