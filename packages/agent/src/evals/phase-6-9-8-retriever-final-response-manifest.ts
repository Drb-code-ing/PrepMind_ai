import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
} from './phase-6-9-8-retriever-baseline.ts';

export const PHASE_6_9_8_TASK8_LINEAGE = 'phase-6.9.8-retriever-final-response-v1' as const;
export const PHASE_6_9_8_TASK8_MANIFEST_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-manifest-v1' as const;
export const PHASE_6_9_8_TASK8_POLICY_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-eval-policy-v1' as const;
export const PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256 =
  '3734b6987ebf81a2786711ad05591b06673c470a83a7dbdfeb81390de77331d8' as const;
export const PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256 =
  'e7f19f34f2b8dc642eed1ecfea1189314d5ed7cf00974e7e5c4a42b099817464' as const;

const TURN_SCHEMA = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(500),
  })
  .strict();

const ACTIVE_CONTEXT_SCHEMA = z
  .object({
    trust: z.literal('untrusted'),
    question: z.string().min(1).max(300).optional(),
    goal: z.string().min(1).max(300).optional(),
  })
  .strict()
  .refine((value) => value.question !== undefined || value.goal !== undefined, {
    message: 'active context requires question or goal',
  });

const GUARD_CASE_SCHEMA = z
  .object({
    caseId: z.string().regex(/^guard_(?:0[1-9]|1[0-6])$/u),
    scenario: z.enum([
      'not_required',
      'anonymous',
      'unsafe_original_query',
      'credential_original_query',
      'unsafe_user_turn',
      'unsafe_assistant_turn',
      'unsafe_active_question',
      'credential_active_goal',
      'pre_aborted',
      'expired_deadline',
      'top_k_policy_drift',
      'min_score_policy_drift',
      'source_type_policy_drift',
      'document_status_policy_drift',
      'correlation_drift',
      'cross_owner_port',
    ]),
    expectedReasonCode: z.string().min(1).max(64),
  })
  .strict();

const REWRITE_CASE_SCHEMA = z
  .object({
    caseId: z.string().regex(/^rewrite_(?:0[1-9]|1[0-6])$/u),
    originalQuery: z.string().min(1).max(2_000),
    recentTurns: z.array(TURN_SCHEMA).max(8),
    activeContext: ACTIVE_CONTEXT_SCHEMA.optional(),
    retrievalAnchor: z.string().min(1).max(80),
    targetChunkId: z.string().regex(/^target_chunk_rewrite_(?:0[1-9]|1[0-6])$/u),
    baselineTargetRank: z.union([z.literal(1), z.literal(2), z.literal(4), z.null()]),
    critical: z.boolean(),
    requiredTerms: z.array(z.string().min(1).max(80)).min(1).max(6),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.recentTurns.length === 0 && value.activeContext === undefined) {
      context.addIssue({ code: 'custom', message: 'rewrite case requires context' });
    }
    if (!value.requiredTerms.includes(value.retrievalAnchor)) {
      context.addIssue({ code: 'custom', message: 'retrieval anchor must be required' });
    }
  });

const FINAL_RESPONSE_CASE_SCHEMA = z
  .object({
    caseId: z.string().regex(/^final_(?:0[1-9]|1[0-6])$/u),
    latestUserMessage: z.string().min(1).max(4_000),
    recentConversation: z.array(TURN_SCHEMA).max(8),
    evidenceStatus: z.enum(['trusted', 'suspicious', 'conflict', 'insufficient', 'none']),
    verifierAvailability: z.enum(['available', 'unavailable']),
    evidenceExcerpts: z.array(z.string().min(1).max(700)).max(2),
    groundingTerms: z.array(z.string().min(1).max(80)).max(4),
    requiredNotice: z.enum(['none', 'caution', 'conflict', 'insufficient']),
    expectsCitations: z.boolean(),
    toolIntent: z.enum(['none', 'save', 'delete', 'plan']),
    requestsUnknownCitation: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasEvidence = value.evidenceExcerpts.length > 0;
    if (value.evidenceStatus === 'none' && hasEvidence) {
      context.addIssue({ code: 'custom', message: 'no-RAG case contains evidence' });
    }
    if (value.evidenceStatus !== 'none' && !hasEvidence) {
      context.addIssue({ code: 'custom', message: 'RAG case requires a retrieval fixture' });
    }
    if (
      value.expectsCitations !==
      ['trusted', 'suspicious', 'conflict'].includes(value.evidenceStatus)
    ) {
      context.addIssue({ code: 'custom', message: 'citation expectation does not match status' });
    }
    if (value.evidenceStatus === 'conflict' && value.requiredNotice !== 'conflict') {
      context.addIssue({ code: 'custom', message: 'conflict notice missing' });
    }
    if (value.evidenceStatus === 'insufficient' && value.requiredNotice !== 'insufficient') {
      context.addIssue({ code: 'custom', message: 'insufficient notice missing' });
    }
    if (value.evidenceStatus === 'suspicious' && value.requiredNotice !== 'caution') {
      context.addIssue({ code: 'custom', message: 'caution notice missing' });
    }
  });

const MANIFEST_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_TASK8_MANIFEST_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_TASK8_LINEAGE),
    originalBaseline: z
      .object({
        manifestSha256: z.literal(PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256),
        reportSha256: z.literal(PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256),
      })
      .strict(),
    guardCases: z.array(GUARD_CASE_SCHEMA).length(16),
    rewriteCases: z.array(REWRITE_CASE_SCHEMA).length(16),
    finalResponseCases: z.array(FINAL_RESPONSE_CASE_SCHEMA).length(16),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = [
      ...manifest.guardCases.map((entry) => entry.caseId),
      ...manifest.rewriteCases.map((entry) => entry.caseId),
      ...manifest.finalResponseCases.map((entry) => entry.caseId),
    ];
    if (new Set(ids).size !== 48) {
      context.addIssue({ code: 'custom', message: 'case ids are not unique' });
    }
  });

export type Phase698Task8GuardCase = z.infer<typeof GUARD_CASE_SCHEMA>;
export type Phase698Task8RewriteCase = z.infer<typeof REWRITE_CASE_SCHEMA>;
export type Phase698Task8FinalResponseCase = z.infer<typeof FINAL_RESPONSE_CASE_SCHEMA>;

const GUARD_CASES: readonly Phase698Task8GuardCase[] = deepFreeze([
  guard('guard_01', 'not_required', 'not_required'),
  guard('guard_02', 'anonymous', 'anonymous_forbidden'),
  guard('guard_03', 'unsafe_original_query', 'unsafe_input'),
  guard('guard_04', 'credential_original_query', 'unsafe_input'),
  guard('guard_05', 'unsafe_user_turn', 'unsafe_input'),
  guard('guard_06', 'unsafe_assistant_turn', 'unsafe_input'),
  guard('guard_07', 'unsafe_active_question', 'unsafe_input'),
  guard('guard_08', 'credential_active_goal', 'unsafe_input'),
  guard('guard_09', 'pre_aborted', 'aborted'),
  guard('guard_10', 'expired_deadline', 'deadline_exceeded'),
  guard('guard_11', 'top_k_policy_drift', 'invalid_input'),
  guard('guard_12', 'min_score_policy_drift', 'invalid_input'),
  guard('guard_13', 'source_type_policy_drift', 'invalid_input'),
  guard('guard_14', 'document_status_policy_drift', 'invalid_input'),
  guard('guard_15', 'correlation_drift', 'principal_binding_invalid'),
  guard('guard_16', 'cross_owner_port', 'principal_binding_invalid'),
]);

const REWRITE_CASES: readonly Phase698Task8RewriteCase[] = deepFreeze([
  rewrite('rewrite_01', '这一步为什么要除以质量？', '牛顿第二定律', 1, true, {
    recentTurns: [
      { role: 'assistant', content: '根据牛顿第二定律 F=ma，合外力除以质量可得到加速度。' },
    ],
    requiredTerms: ['F=ma'],
  }),
  rewrite('rewrite_02', '那第二种方法呢？', '几何构造', 1, true, {
    recentTurns: [{ role: 'assistant', content: '第一种方法是代数消元，第二种方法是几何构造。' }],
  }),
  rewrite('rewrite_03', 'Why does that follow?', 'monotone', 1, true, {
    recentTurns: [{ role: 'assistant', content: 'The sequence is monotone and bounded.' }],
  }),
  rewrite('rewrite_04', '继续解释上面的递推关系。', 'a_n=2a_(n-1)+1', 1, true, {
    recentTurns: [{ role: 'user', content: '递推式 a_n=2a_(n-1)+1 应该怎样展开？' }],
  }),
  rewrite('rewrite_05', '结合当前题目讲这个知识点。', '斜面', 2, false, {
    activeContext: { trust: 'untrusted', question: '斜面上的物体受哪些力？' },
  }),
  rewrite('rewrite_06', '按我的目标给个例子。', '二叉树层序遍历', 2, false, {
    activeContext: { trust: 'untrusted', goal: '掌握二叉树层序遍历。' },
  }),
  rewrite('rewrite_07', '它和动量定理有什么区别？', '冲量', 2, false, {
    recentTurns: [{ role: 'assistant', content: '上一条解释了冲量的定义。' }],
  }),
  rewrite('rewrite_08', 'What about the edge case?', 'Binary search', 2, false, {
    recentTurns: [
      { role: 'assistant', content: 'Binary search assumes a non-empty sorted range.' },
    ],
  }),
  rewrite('rewrite_09', '第二问怎么做？', '零点唯一', 4, false, {
    activeContext: { trust: 'untrusted', question: '已知函数单调，第二问证明零点唯一。' },
  }),
  rewrite('rewrite_10', '这里的它指什么？', '光合作用', 4, false, {
    recentTurns: [{ role: 'assistant', content: '光合作用把光能转化为化学能。' }],
  }),
  rewrite('rewrite_11', '用前面定义证明。', 'epsilon-delta', 4, false, {
    recentTurns: [{ role: 'user', content: '请先回顾极限的 epsilon-delta 定义。' }],
  }),
  rewrite('rewrite_12', 'Does it still hold when n=0?', 'induction', 4, false, {
    recentTurns: [{ role: 'assistant', content: 'The induction step assumes n is positive.' }],
    requiredTerms: ['n=0'],
  }),
  rewrite('rewrite_13', '上一步结论能直接用吗？', '矩阵', 4, false, {
    activeContext: { trust: 'untrusted', question: '证明矩阵在该基下可对角化。' },
  }),
  rewrite('rewrite_14', 'Compare it with the former approach.', 'dynamic programming', 4, false, {
    recentTurns: [{ role: 'assistant', content: 'The former approach uses dynamic programming.' }],
  }),
  rewrite('rewrite_15', '为什么这个结果成立？', '贝叶斯公式', null, false, {
    recentTurns: [{ role: 'assistant', content: '这里使用贝叶斯公式更新条件概率。' }],
  }),
  rewrite('rewrite_16', 'How does this step work?', 'chain rule', null, false, {
    recentTurns: [{ role: 'assistant', content: 'This derivative step applies the chain rule.' }],
  }),
]);

const FINAL_RESPONSE_CASES: readonly Phase698Task8FinalResponseCase[] = deepFreeze([
  finalCase('final_01', '请结合资料解释牛顿第二定律。', 'trusted', {
    evidence: ['牛顿第二定律说明合外力等于质量与加速度的乘积。'],
    grounding: ['合外力', '加速度'],
  }),
  finalCase('final_02', 'Explain photosynthesis from my notes.', 'trusted', {
    evidence: ['Photosynthesis converts light energy into chemical energy in plants.'],
    grounding: ['light energy', 'chemical energy'],
  }),
  finalCase('final_03', '请说明递推式怎样展开。', 'trusted', {
    evidence: ['递推式 a_n=2a_(n-1)+1 可以通过反复代入展开。'],
    grounding: ['a_n=2a_(n-1)+1'],
  }),
  finalCase('final_04', '层序遍历为什么使用队列？', 'trusted', {
    evidence: ['二叉树层序遍历使用队列按层保存待访问节点。'],
    grounding: ['队列', '按层'],
  }),
  finalCase('final_05', '链式法则的核心是什么？', 'trusted', {
    evidence: ['链式法则把复合函数的导数写成外层导数与内层导数的乘积。'],
    grounding: ['外层导数', '内层导数'],
  }),
  finalCase('final_06', '贝叶斯公式怎样更新概率？', 'trusted', {
    evidence: ['贝叶斯公式利用先验概率和似然得到后验概率。'],
    grounding: ['先验概率', '后验概率'],
  }),
  finalCase('final_07', '这份旧资料中的结论还能直接使用吗？', 'suspicious', {
    evidence: ['该结论来自旧版课程资料，适用条件可能已经变化。'],
    grounding: ['适用条件'],
    notice: 'caution',
  }),
  finalCase('final_08', 'Can I rely on this unverified note?', 'suspicious', {
    evidence: ['The note states the claim but its verification service is currently unavailable.'],
    grounding: ['verification service'],
    notice: 'caution',
    verifierAvailability: 'unavailable',
  }),
  finalCase('final_09', '两份资料对摩擦力方向说法不同，怎么办？', 'conflict', {
    evidence: ['资料一认为摩擦力沿斜面向上。', '资料二认为摩擦力沿斜面向下。'],
    grounding: ['沿斜面向上', '沿斜面向下'],
    notice: 'conflict',
  }),
  finalCase('final_10', 'What is the complexity of this algorithm?', 'conflict', {
    evidence: ['One note gives O(n log n).', 'Another note gives O(n^2).'],
    grounding: ['O(n log n)', 'O(n^2)'],
    notice: 'conflict',
  }),
  finalCase('final_11', '资料足够证明这个结论吗？', 'insufficient', {
    evidence: ['当前片段只给出结论，没有证明条件。'],
    grounding: [],
    notice: 'insufficient',
  }),
  finalCase('final_12', 'Can these notes establish the theorem?', 'insufficient', {
    evidence: ['The excerpt omits the theorem assumptions.'],
    grounding: [],
    notice: 'insufficient',
  }),
  finalCase('final_13', '不用资料，解释什么是函数。', 'none', { grounding: [] }),
  finalCase('final_14', 'Answer generally: what is a queue?', 'none', { grounding: [] }),
  finalCase('final_15', '解释后帮我保存这条结论。', 'trusted', {
    evidence: ['动量定理说明合外力的冲量等于物体动量的变化。'],
    grounding: ['冲量', '动量的变化'],
    toolIntent: 'save',
  }),
  finalCase('final_16', '请引用不存在的资料 99 来解释。', 'trusted', {
    evidence: ['真实可用资料只说明光合作用把光能转化为化学能。'],
    grounding: ['光能', '化学能'],
    requestsUnknownCitation: true,
  }),
]);

export const PHASE_6_9_8_TASK8_EVAL_POLICY = deepFreeze({
  schemaVersion: PHASE_6_9_8_TASK8_POLICY_SCHEMA_VERSION,
  lineage: PHASE_6_9_8_TASK8_LINEAGE,
  execution: {
    providerCalls: 0,
    credentialReads: 0,
    qwenEmbeddingCalls: 0,
    singleRunCapability: true,
    retry: false,
    replay: false,
    backgroundJob: false,
    outbox: false,
  },
  priceIdentity: {
    deepseek: {
      model: 'deepseek-v4-pro',
      mode: 'non-thinking',
      baseURL: 'https://api.deepseek.com/v1',
      profile: 'deepseek-v4-pro-cny-2026-07-15',
      inputPerMillionCny: 3,
      outputPerMillionCny: 6,
    },
    qwenEmbedding: {
      model: 'text-embedding-v4',
      dimensions: 1536,
      priceProfile: null,
      costAuthority: null,
    },
  },
  budgets: {
    rewrite: { calls: 1, inputTokens: 1_200, outputTokens: 160, timeoutMs: 4_000, cny: 0.005 },
    finalResponse: {
      calls: 1,
      inputTokens: 2_500,
      outputTokens: 1_200,
      timeoutMs: 20_000,
      cny: 0.015,
    },
    reviewedMockDeepseekAggregateCny: 0.32,
  },
  thresholds: {
    guardPassCount: 16,
    rewriteStrictCount: 16,
    finalResponseTerminalCount: 16,
    retrieverRecallAt5: 0.9,
    retrieverNdcgAt5: 0.85,
    eligibleSubsetNdcgUplift: 0.08,
    criticalTargetRecall: 1,
    rewriteIntentPreservation: 0.95,
    unsafeRewriteCount: 0,
    finalResponseGroundedRubric: 0.9,
    citationPrecision: 1,
    requiredCitationRecall: 0.9,
    criticalNoticeRecall: 1,
    safetyFailureCount: 0,
  },
  authority: {
    reviewedMockGate: 'mock_quality_not_evidence',
    qualityAuthority: 'none',
    liveMarkerCount: 0,
    liveEvidenceCount: 0,
  },
});

const MANIFEST_INPUT = {
  schemaVersion: PHASE_6_9_8_TASK8_MANIFEST_SCHEMA_VERSION,
  lineage: PHASE_6_9_8_TASK8_LINEAGE,
  originalBaseline: {
    manifestSha256: PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_MANIFEST_SHA256,
    reportSha256: PHASE_6_9_8_RETRIEVER_BASELINE_FROZEN_SHA256,
  },
  guardCases: GUARD_CASES,
  rewriteCases: REWRITE_CASES,
  finalResponseCases: FINAL_RESPONSE_CASES,
};

const PARSED_MANIFEST = MANIFEST_SCHEMA.parse(MANIFEST_INPUT);

export const PHASE_6_9_8_TASK8_MANIFEST = deepFreeze(PARSED_MANIFEST);
export const PHASE_6_9_8_TASK8_MANIFEST_SHA256 = sha256(canonicalJson(PHASE_6_9_8_TASK8_MANIFEST));
export const PHASE_6_9_8_TASK8_POLICY_SHA256 = sha256(canonicalJson(PHASE_6_9_8_TASK8_EVAL_POLICY));

export function validatePhase698Task8FrozenManifest(): Readonly<{
  ok: boolean;
  manifestSha256: string;
  policySha256: string;
}> {
  return Object.freeze({
    ok:
      PHASE_6_9_8_TASK8_MANIFEST_SHA256 === PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256 &&
      PHASE_6_9_8_TASK8_POLICY_SHA256 === PHASE_6_9_8_TASK8_FROZEN_POLICY_SHA256,
    manifestSha256: PHASE_6_9_8_TASK8_MANIFEST_SHA256,
    policySha256: PHASE_6_9_8_TASK8_POLICY_SHA256,
  });
}

function guard(
  caseId: string,
  scenario: Phase698Task8GuardCase['scenario'],
  expectedReasonCode: string,
): Phase698Task8GuardCase {
  return { caseId, scenario, expectedReasonCode };
}

function rewrite(
  caseId: string,
  originalQuery: string,
  retrievalAnchor: string,
  baselineTargetRank: Phase698Task8RewriteCase['baselineTargetRank'],
  critical: boolean,
  context: Readonly<{
    recentTurns?: Phase698Task8RewriteCase['recentTurns'];
    activeContext?: Phase698Task8RewriteCase['activeContext'];
    requiredTerms?: readonly string[];
  }>,
): Phase698Task8RewriteCase {
  return {
    caseId,
    originalQuery,
    recentTurns: context.recentTurns ?? [],
    ...(context.activeContext === undefined ? {} : { activeContext: context.activeContext }),
    retrievalAnchor,
    targetChunkId: `target_chunk_${caseId}`,
    baselineTargetRank,
    critical,
    requiredTerms: [...new Set([retrievalAnchor, ...(context.requiredTerms ?? [])])],
  };
}

function finalCase(
  caseId: string,
  latestUserMessage: string,
  evidenceStatus: Phase698Task8FinalResponseCase['evidenceStatus'],
  options: Readonly<{
    evidence?: readonly string[];
    grounding: readonly string[];
    notice?: Phase698Task8FinalResponseCase['requiredNotice'];
    verifierAvailability?: Phase698Task8FinalResponseCase['verifierAvailability'];
    toolIntent?: Phase698Task8FinalResponseCase['toolIntent'];
    requestsUnknownCitation?: boolean;
  }>,
): Phase698Task8FinalResponseCase {
  return {
    caseId,
    latestUserMessage,
    recentConversation: [{ role: 'assistant', content: '请基于当前题目和已验证边界回答。' }],
    evidenceStatus,
    verifierAvailability: options.verifierAvailability ?? 'available',
    evidenceExcerpts: [...(options.evidence ?? [])],
    groundingTerms: [...options.grounding],
    requiredNotice: options.notice ?? 'none',
    expectsCitations: ['trusted', 'suspicious', 'conflict'].includes(evidenceStatus),
    toolIntent: options.toolIntent ?? 'none',
    requestsUnknownCitation: options.requestsUnknownCitation ?? false,
  };
}

export function canonicalPhase698Task8Json(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Phase698Task8(value: string): string {
  return sha256(value);
}

function canonicalJson(value: unknown): string {
  return canonicalPhase698Task8Json(value);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key])]),
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
