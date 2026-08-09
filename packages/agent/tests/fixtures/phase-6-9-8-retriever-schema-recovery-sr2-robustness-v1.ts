import { createHash } from 'node:crypto';

import {
  RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
  RETRIEVER_QUERY_REWRITE_MODEL,
} from '../../src/model-candidates/retriever-query-rewrite-model-candidate.ts';
import {
  RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256,
  RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  RETRIEVER_SCHEMA_RECOVERY_LIMITS,
} from '../../src/model-candidates/retriever-schema-recovery-contract.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_VERSION =
  'phase-6.9.8-retriever-schema-recovery-sr2-robustness-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION =
  'phase-6.9.8-retriever-schema-recovery-sr2-prompt-derived-responder-v1' as const;

const sourceIdentities = {
  contractSha256: RETRIEVER_SCHEMA_RECOVERY_CONTRACT_SHA256,
  diagnosticVersion: RETRIEVER_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
  model: RETRIEVER_QUERY_REWRITE_MODEL,
  limits: RETRIEVER_SCHEMA_RECOVERY_LIMITS,
} as const;

const heldOutInputs = [
  {
    id: 'held-out-physics-zh',
    originalQuery: '这一步为什么成立？',
    recentTurns: [{ role: 'assistant', content: '牛顿第二定律 F=ma，合外力除以质量得到加速度。' }],
  },
  {
    id: 'held-out-calculus-en',
    originalQuery: 'Why does that follow?',
    recentTurns: [
      {
        role: 'assistant',
        content: 'The sequence is monotone and bounded, so convergence follows.',
      },
    ],
  },
  {
    id: 'held-out-probability-zh',
    originalQuery: '这个等号能直接用吗？',
    recentTurns: [{ role: 'assistant', content: '全概率公式按事件 B 与非 B 拆分样本空间。' }],
  },
  {
    id: 'held-out-reading-en',
    originalQuery: 'What does it modify here?',
    recentTurns: [
      {
        role: 'assistant',
        content: 'The relative clause modifies the noun phrase before the comma.',
      },
    ],
  },
  {
    id: 'held-out-algorithm-mixed',
    originalQuery: '按这个目标怎么继续？',
    recentTurns: [],
    activeContext: { trust: 'untrusted', goal: '掌握二叉树层序遍历与 queue 的复杂度。' },
  },
] as const;

const validRewrite = 'Why does convergence follow from the sequence being monotone and bounded?';

const providerShapeCases = [
  {
    id: 'canonical',
    content: `{"rewrittenQuery":"${validRewrite}"}`,
    resultKind: 'applied',
    diagnosticReason: null,
    group: 'canonical',
    leakSentinel: null,
  },
  {
    id: 'whitespace',
    content: ` \r\n { "rewrittenQuery" : "${validRewrite}" } \t `,
    resultKind: 'applied',
    diagnosticReason: null,
    group: 'canonical',
    leakSentinel: null,
  },
  {
    id: 'escaped-key',
    content: `{"\\u0072ewrittenQuery":"${validRewrite}"}`,
    resultKind: 'applied',
    diagnosticReason: null,
    group: 'canonical',
    leakSentinel: null,
  },
  {
    id: 'scalar-extension',
    content: `{"rewrittenQuery":"${validRewrite}","score":0.75,"enabled":true,"private":"SR2_PRIVATE_SCALAR"}`,
    resultKind: 'applied',
    diagnosticReason: 'extension_fields_discarded',
    group: 'canonical',
    leakSentinel: 'SR2_PRIVATE_SCALAR',
  },
  {
    id: 'nested-unicode-extension',
    content: `{"meta":{"path":["cafe\u0301","🙂",2,false,null],"nested":{"private":"SR2_PRIVATE_NESTED"}},"rewrittenQuery":"${validRewrite}"}`,
    resultKind: 'applied',
    diagnosticReason: 'extension_fields_discarded',
    group: 'canonical',
    leakSentinel: 'SR2_PRIVATE_NESTED',
  },
  {
    id: 'top-level-array',
    content: `[ {"rewrittenQuery":"${validRewrite}"} ]`,
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'top-level-null',
    content: 'null',
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'top-level-string',
    content: JSON.stringify(JSON.stringify({ rewrittenQuery: validRewrite })),
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'top-level-boolean',
    content: 'true',
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'missing',
    content: '{}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_missing',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'alias',
    content: `{"rewritten_query":"${validRewrite}"}`,
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_alias_ambiguous',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'alias-and-canonical',
    content: `{"rewrittenQuery":"${validRewrite}","rewritten_query":"${validRewrite}"}`,
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_alias_ambiguous',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'wrong-type',
    content: '{"rewrittenQuery":42}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_type',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'array-type',
    content: '{"rewrittenQuery":[]}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_type',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'object-type',
    content: '{"rewrittenQuery":{}}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_type',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'null-type',
    content: '{"rewrittenQuery":null}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_type',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'boolean-type',
    content: '{"rewrittenQuery":false}',
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_type',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'empty',
    content: '{"rewrittenQuery":""}',
    resultKind: 'rejected',
    diagnosticReason: 'rewrite_empty',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'wrapper',
    content: `{"data":{"rewrittenQuery":"${validRewrite}"}}`,
    resultKind: 'rejected',
    diagnosticReason: 'rewritten_query_missing',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'prose',
    content: `prefix {"rewrittenQuery":"${validRewrite}"}`,
    resultKind: 'rejected',
    diagnosticReason: 'malformed_json',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'fence',
    content: `\`\`\`json\n{"rewrittenQuery":"${validRewrite}"}\n\`\`\``,
    resultKind: 'rejected',
    diagnosticReason: 'malformed_json',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'trailing',
    content: `{"rewrittenQuery":"${validRewrite}"} trailing`,
    resultKind: 'rejected',
    diagnosticReason: 'multiple_top_level_values',
    group: null,
    leakSentinel: null,
  },
  {
    id: 'duplicate-escaped',
    content: `{"rewrittenQuery":"${validRewrite}","\\u0072ewrittenQuery":"other"}`,
    resultKind: 'rejected',
    diagnosticReason: 'duplicate_key',
    group: null,
    leakSentinel: 'other',
  },
  {
    id: 'bom',
    content: `\uFEFF{"rewrittenQuery":"${validRewrite}"}`,
    resultKind: 'rejected',
    diagnosticReason: 'malformed_json',
    group: null,
    leakSentinel: null,
  },
] as const;

const faultCases = [
  { id: 'transport', kind: 'provider_failure', category: 'transport' },
  { id: 'http-rate-limit', kind: 'provider_failure', category: 'http_rate_limit' },
  { id: 'invalid-response', kind: 'provider_failure', category: 'invalid_response' },
  { id: 'usage-mismatch', kind: 'usage_mismatch', category: null },
  { id: 'trace-mismatch', kind: 'trace_mismatch', category: null },
  { id: 'timeout', kind: 'timeout', category: null },
  { id: 'in-flight-abort', kind: 'in_flight_abort', category: null },
] as const;

const metamorphicCases = [
  { id: 'recent-turn-reorder', transform: 'recent_turn_reorder' },
  { id: 'irrelevant-turn-insertion', transform: 'irrelevant_turn_insertion' },
  { id: 'active-context-key-reorder', transform: 'active_context_key_reorder' },
  { id: 'unicode-nfc-nfd-extension', transform: 'unicode_extension_normalization' },
] as const;

const fixtureSource = {
  version: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_VERSION,
  responderVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION,
  sourceIdentities,
  heldOutInputs,
  providerShapeCases,
  faultCases,
  metamorphicCases,
};

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256 = `sha256:${createHash('sha256').update(JSON.stringify(fixtureSource), 'utf8').digest('hex')}`;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256 =
  'sha256:59010e16fd665df6d497517276dbeacb3f5973036a07e8cf00010569da171505' as const;

if (
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256 !==
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256
) {
  throw new Error('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FIXTURE_SHA_MISMATCH');
}

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES =
  deepFreeze(sourceIdentities);
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_HELD_OUT_INPUTS = deepFreeze(heldOutInputs);
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES =
  deepFreeze(providerShapeCases);
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_FAULT_CASES = deepFreeze(faultCases);
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR2_METAMORPHIC_CASES =
  deepFreeze(metamorphicCases);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
