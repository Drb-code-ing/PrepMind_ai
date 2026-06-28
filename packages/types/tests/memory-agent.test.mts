import assert from 'node:assert/strict';

import {
  generateMemoryCandidatesRequestSchema,
  memoryCandidateListQuerySchema,
  memoryCandidateSchema,
  memoryCandidateStatusSchema,
  userMemoryListQuerySchema,
  userMemorySchema,
  userMemoryTypeSchema,
} from '../src/api/memory-agent';

testEnums();
testQueryDefaults();
testCandidatePayload();
testMemoryPayload();

function testEnums() {
  assert.equal(userMemoryTypeSchema.parse('WEAK_POINT'), 'WEAK_POINT');
  assert.equal(memoryCandidateStatusSchema.parse('PENDING'), 'PENDING');
  assert.throws(() => userMemoryTypeSchema.parse('RANDOM_NOTE'));
}

function testQueryDefaults() {
  assert.deepEqual(memoryCandidateListQuerySchema.parse({}), {
    status: 'PENDING',
    limit: 20,
  });
  assert.deepEqual(userMemoryListQuerySchema.parse({}), {
    status: 'ACTIVE',
  });
  assert.deepEqual(generateMemoryCandidatesRequestSchema.parse({}), {
    source: 'profile',
    force: false,
  });
  assert.throws(() => memoryCandidateListQuerySchema.parse({ limit: 0 }));
  assert.throws(() => memoryCandidateListQuerySchema.parse({ limit: 51 }));
}

function testCandidatePayload() {
  const parsed = memoryCandidateSchema.parse({
    id: 'candidate_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先提示再给完整答案。',
    reason: '用户在聊天中明确表达了这个偏好。',
    evidence: [{ sourceType: 'chat', sourceId: 'msg_1', summary: '以后先给我提示' }],
    confidence: 0.86,
    status: 'PENDING',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    decidedAt: null,
  });

  assert.equal(parsed.type, 'EXPLANATION_PREFERENCE');
  assert.equal(parsed.evidence[0]?.sourceType, 'chat');
}

function testMemoryPayload() {
  const parsed = userMemorySchema.parse({
    id: 'memory_1',
    userId: 'user_1',
    type: 'WEAK_POINT',
    title: '导数应用薄弱',
    content: '用户在导数应用题中多次出现审题错误。',
    status: 'ACTIVE',
    confidence: 0.82,
    lastUsedAt: null,
    archivedAt: null,
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  });

  assert.equal(parsed.status, 'ACTIVE');
}
