import { createHash } from 'node:crypto';

import { PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256 } from '../../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
} from '../../src/model-candidates/tutor-schema-recovery-contract.ts';
import { TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256 } from '../../src/model-candidates/tutor-v6-model-contract.ts';
import { TUTOR_V6_MODEL_PROJECTION_VERSION } from '../../src/model-candidates/tutor-v6-model-projection.ts';
import { TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256 } from '../../src/model-candidates/tutor-v6-preferred-depth-authority.ts';

export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_VERSION =
  'phase-6.9.7-tutor-schema-recovery-sr2-robustness-v1' as const;
export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION =
  'phase-6.9.7-tutor-schema-recovery-sr2-prompt-hash-responder-v1' as const;

const sourceIdentities = {
  datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_FROZEN_DATASET_SHA256,
  promptLogicalSha256: TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256,
  parserLogicalSha256: TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  diagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  projectionVersion: TUTOR_V6_MODEL_PROJECTION_VERSION,
  preferredDepthRulesSha256: TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
  promptSourceSha256: 'sha256:441793e5ce76b27e35661263ab0b843d77d12e74f40646fecc22e84f3e392f70',
  parserDiagnosticSourceSha256:
    'sha256:e0b777836a33a18eff84cbb8ba77a36897213ca70899daba96bec8cd974fc720',
  projectionSourceSha256: 'sha256:72fe93b2408a0b587c07cb4845159e009ef4a1bcd911a61b20b7677fb267d406',
  mergerSourceSha256: 'sha256:e2d181ae9b34740cd43c0070ad041ea0f06f647b0352a6cc4f1afc6f3721ba4a',
  recoveryAdapterSourceSha256:
    'sha256:845ac00c33e3fabcf1e667877f2260275f18b12cf56e56f1f0b7ea2ce4221b49',
} as const;

const heldOutInputs = [
  {
    id: 'held-out-algebra-continuation-zh',
    latestUserText: '我卡在配方法第二行，先别揭晓结论，接下来应关注哪个量？',
    activeStudyContext: '合成二次方程：正在把 x²+6x+5 改写为顶点形式。',
  },
  {
    id: 'held-out-calculus-connection-en',
    latestUserText:
      'I can perform the substitution, but I cannot connect it to the target expression.',
    activeStudyContext:
      'Synthetic integral exercise: substitute u=x²+1 and inspect the transformed bounds.',
  },
  {
    id: 'held-out-probability-proof-zh',
    latestUserText: '我把全概率公式展开到这一行了，这个等号成立吗？',
    activeStudyContext: '合成全概率题：已按事件 B 与非 B 拆分样本空间。',
  },
  {
    id: 'held-out-reading-clause-en',
    latestUserText:
      'I found the clause, but the modifier relationship remains unclear in this new sentence.',
    activeStudyContext:
      'Synthetic reading exercise: the main clause is marked before a relative clause.',
  },
  {
    id: 'held-out-linear-algebra-mixed',
    latestUserText: '矩阵秩我会算，但不明白它为什么决定 solution space 的维数。',
    activeStudyContext: '合成 linear algebra：比较齐次方程组的秩、未知数个数与解空间维数。',
  },
] as const;

const providerShapeCases = [
  {
    id: 'canonical',
    content: '{"intentIndex":0}',
    resultKind: 'applied',
    diagnosticReason: null,
    metamorphicGroup: 'intent-index-zero',
  },
  {
    id: 'whitespace',
    content: ' \r\n { "intentIndex" : 0 } \t ',
    resultKind: 'applied',
    diagnosticReason: null,
    metamorphicGroup: 'intent-index-zero',
  },
  {
    id: 'escaped-key',
    content: '{"\\u0069ntentIndex":0}',
    resultKind: 'applied',
    diagnosticReason: null,
    metamorphicGroup: 'intent-index-zero',
  },
  {
    id: 'scalar-extensions',
    content: '{"label":"扩展值","score":0.75,"enabled":true,"empty":null,"intentIndex":0}',
    resultKind: 'applied',
    diagnosticReason: 'extension_fields_discarded',
    metamorphicGroup: 'intent-index-zero',
  },
  {
    id: 'object-array-extensions',
    content:
      '{"meta":{"path":["甲",2,false,null],"nested":{"safe":"sr2-private-shape-sentinel"}},"intentIndex":0}',
    resultKind: 'applied',
    diagnosticReason: 'extension_fields_discarded',
    metamorphicGroup: 'intent-index-zero',
  },
  {
    id: 'top-level-array',
    content: '[{"intentIndex":0}]',
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
  },
  {
    id: 'double-encoded',
    content: '"{\\"intentIndex\\":0}"',
    resultKind: 'rejected',
    diagnosticReason: 'top_level_not_object',
  },
  {
    id: 'missing',
    content: '{}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_missing',
  },
  {
    id: 'alias',
    content: '{"intent_index":0}',
    resultKind: 'rejected',
    diagnosticReason: 'selection_ambiguous',
  },
  {
    id: 'string',
    content: '{"intentIndex":"0"}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_type',
  },
  {
    id: 'null',
    content: '{"intentIndex":null}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_type',
  },
  {
    id: 'fraction',
    content: '{"intentIndex":0.5}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_non_integer',
  },
  {
    id: 'range',
    content: '{"intentIndex":5}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_out_of_range',
  },
  {
    id: 'wrapper',
    content: '{"data":{"intentIndex":0}}',
    resultKind: 'rejected',
    diagnosticReason: 'intent_index_missing',
  },
  {
    id: 'fence',
    content: '```json\n{"intentIndex":0}\n```',
    resultKind: 'rejected',
    diagnosticReason: 'malformed_json',
  },
  {
    id: 'bom',
    content: '\uFEFF{"intentIndex":0}',
    resultKind: 'rejected',
    diagnosticReason: 'malformed_json',
  },
  {
    id: 'trailing',
    content: '{"intentIndex":0} trailing',
    resultKind: 'rejected',
    diagnosticReason: 'multiple_top_level_values',
  },
  {
    id: 'duplicate',
    content: '{"intentIndex":0,"\\u0069ntentIndex":1}',
    resultKind: 'rejected',
    diagnosticReason: 'duplicate_key',
  },
] as const;

const faultCases = [
  { id: 'transport', wireCategory: 'transport', publicCategory: 'transport' },
  {
    id: 'http-rate-limit',
    wireCategory: 'http_rate_limit',
    publicCategory: 'http_rate_limit',
  },
  { id: 'response-audit', wireCategory: 'response_audit', publicCategory: 'invalid_response' },
  { id: 'usage-missing', wireCategory: 'usage_validation', publicCategory: 'unknown' },
] as const;

const robustnessSource = {
  version: PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_VERSION,
  responderVersion: PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION,
  sourceIdentities,
  heldOutInputs,
  providerShapeCases,
  faultCases,
};

export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256 =
  'sha256:' + createHash('sha256').update(JSON.stringify(robustnessSource), 'utf8').digest('hex');
export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256 =
  'sha256:43248bfa7156c29eafa110b475a8998611209dd808847be79dacd1c02460d41e' as const;

if (
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_SHA256 !==
  PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FROZEN_FIXTURE_SHA256
) {
  throw new Error('PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FIXTURE_SHA_MISMATCH');
}

export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_SOURCE_IDENTITIES = deepFreeze(sourceIdentities);
export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_HELD_OUT_INPUTS = deepFreeze(heldOutInputs);
export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_PROVIDER_SHAPE_CASES =
  deepFreeze(providerShapeCases);
export const PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_FAULT_CASES = deepFreeze(faultCases);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
