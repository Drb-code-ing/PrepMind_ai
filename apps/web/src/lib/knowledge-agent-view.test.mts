import assert from 'node:assert/strict';

import {
  getKnowledgeAgentEmptyMessage,
  getKnowledgeAgentSourceView,
  getKnowledgeDedupTone,
  getKnowledgeOrganizerCollectionSummary,
  hasKnowledgeAgentSuggestions,
} from './knowledge-agent-view.ts';

assert.match(getKnowledgeAgentEmptyMessage(), /处理更多资料/);

assert.equal(
  getKnowledgeDedupTone({
    severity: 'warning',
  }),
  'warning',
);

assert.equal(
  getKnowledgeOrganizerCollectionSummary({
    name: '数学资料',
    documentIds: ['doc_1', 'doc_2'],
  }),
  '数学资料 · 2 份资料',
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: { summary: '', items: [], signals: [] },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  false,
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: {
      summary: '',
      items: [
        {
          kind: 'insufficient_signal',
          severity: 'info',
          documentIds: ['doc_1'],
          title: '资料关系信号不足',
          reason: '资料数量、处理状态或内容摘要不足。',
          recommendation: 'review_manually',
          confidence: 0.35,
          signals: ['insufficientSignal'],
        },
      ],
      signals: ['insufficientSignal'],
    },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  false,
);

assert.equal(
  hasKnowledgeAgentSuggestions({
    dedup: {
      summary: '',
      items: [
        {
          kind: 'complementary',
          severity: 'info',
          documentIds: ['doc_1', 'doc_2'],
          title: '同主题互补资料',
          reason: '主题相近。',
          recommendation: 'keep_both',
          confidence: 0.7,
          signals: [],
        },
      ],
      signals: [],
    },
    organizer: { summary: '', collections: [], tags: [], signals: [] },
  }),
  true,
);

assert.deepEqual(getKnowledgeAgentSourceView(createResponse('hybrid')), {
  tone: 'semantic',
  label: '语义建议',
  description: '已结合资料语义生成只读整理建议。',
});

assert.deepEqual(getKnowledgeAgentSourceView(createResponse('local')), {
  tone: 'local',
  label: '本地规则建议',
  description: '当前使用本地规则，资料功能不受影响。',
});

assert.deepEqual(getKnowledgeAgentSourceView(createResponse('degraded')), {
  tone: 'degraded',
  label: '本地规则建议',
  description: '语义判断暂不可用，已安全回退；上传、处理与检索不受影响。',
});

const mixedResponse = createResponse('hybrid');
mixedResponse.organizer.runtime = createResponse('degraded').dedup.runtime;
assert.deepEqual(getKnowledgeAgentSourceView(mixedResponse), {
  tone: 'degraded',
  label: '本地规则建议',
  description: '语义判断暂不可用，已安全回退；上传、处理与检索不受影响。',
});

function createResponse(mode: 'hybrid' | 'local' | 'degraded') {
  const localRuntime = {
    source: 'local_deterministic' as const,
    disposition: 'gate_disabled' as const,
    reasonCode: 'gate_disabled',
    attempted: false,
    degraded: false,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      pricingKnown: false,
      estimatedCostCny: null,
    },
    traceId: null,
  };
  const runtime =
    mode === 'hybrid'
      ? {
          source: 'hybrid_model' as const,
          disposition: 'candidate_applied' as const,
          reasonCode: 'candidate_applied',
          attempted: true,
          degraded: false,
          usage: {
            inputTokens: 320,
            outputTokens: 96,
            pricingKnown: true,
            estimatedCostCny: 0.0012,
          },
          traceId: 'trace_1',
        }
      : mode === 'degraded'
        ? {
            ...localRuntime,
            disposition: 'fallback_runtime_error' as const,
            reasonCode: 'fallback_runtime_error',
            attempted: true,
            degraded: true,
          }
        : localRuntime;

  return {
    generatedAt: '2026-07-21T00:00:00.000Z',
    dedup: { summary: '', items: [], signals: [], runtime },
    organizer: {
      summary: '',
      collections: [],
      tags: [],
      signals: [],
      runtime: localRuntime,
    },
  };
}
