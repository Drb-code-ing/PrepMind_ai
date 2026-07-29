import { createHash } from 'node:crypto';

export const PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1' as const;

const heldOutSource = {
  ownerDomain: 'hmac-sha256:' + '9'.repeat(64),
  ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
  ownerSnapshotFingerprint: 'sha256:' + '7'.repeat(64),
  safety: 'safe_for_model',
  questions: [
    {
      id: 'v9-r2-heldout-question-reading-taxonomy',
      subject: '英语',
      category: 'Reading inference 阅读推断',
      knowledgePoints: ['author attitude', 'contrast evidence'],
      errorType: 'evidence boundary',
      questionText: 'How does the contrast signal reveal 作者态度？',
      analysis: 'Keep the structured English subject and choose only a local option.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T10:00:02.000Z',
    },
    {
      id: 'v9-r2-heldout-question-algebra-bilingual',
      subject: '数学',
      category: 'Linear Algebra 线性代数',
      knowledgePoints: ['eigenvalue', '矩阵特征值'],
      errorType: 'concept boundary',
      questionText: 'Compare eigenvalue multiplicity 与矩阵秩的约束。',
      analysis: 'The locked deck name and all real identifiers remain local.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T10:00:00.000Z',
    },
    {
      id: 'v9-r2-heldout-question-database-unicode',
      subject: 'computer',
      category: '数据库　事务',
      knowledgePoints: ['MVCC', '数据库 事务', 'serializable'],
      errorType: 'ordering',
      questionText: 'Why can snapshot isolation still permit write skew？',
      analysis: 'Use the bounded prompt and never infer owner or write authority.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T10:00:01.000Z',
    },
  ],
  decks: [
    {
      id: 'v9-r2-heldout-deck-reading-private',
      subject: 'english',
      name: '阅读证据链',
      nameLocked: false,
      keywords: ['contrast evidence', 'author attitude'],
      updatedAt: '2026-07-29T10:01:02.000Z',
    },
    {
      id: 'v9-r2-heldout-deck-computer-b-private',
      subject: 'computer',
      name: '数据库 事务',
      nameLocked: true,
      keywords: ['serializable', 'MVCC'],
      updatedAt: '2026-07-29T10:01:01.000Z',
    },
    {
      id: 'v9-r2-heldout-deck-algebra-private',
      subject: 'math',
      name: '矩阵秩与特征值',
      nameLocked: true,
      keywords: ['eigenvalue', '矩阵秩'],
      updatedAt: '2026-07-29T10:01:00.000Z',
    },
    {
      id: 'v9-r2-heldout-deck-computer-a-private',
      subject: 'computer',
      name: '数据库　事务',
      nameLocked: false,
      keywords: ['数据库事务', 'write skew'],
      updatedAt: '2026-07-29T10:01:03.000Z',
    },
  ],
} as const;

const canonicalProviderPayload = {
  decisions: [
    { questionIndex: 0, optionIndex: 0 },
    { questionIndex: 1, optionIndex: 0 },
    { questionIndex: 2, optionIndex: 0 },
  ],
} as const;

function providerCaseWithDecisionPatch<const TId extends string>(
  id: TId,
  decisionIndex: number,
  patch: Readonly<Record<string, unknown>>,
) {
  return {
    id,
    content: JSON.stringify({
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === decisionIndex ? { ...decision, ...patch } : decision,
      ),
    }),
  } as const;
}

const providerShapeCases = [
  { id: 'canonical', content: JSON.stringify(canonicalProviderPayload) },
  {
    id: 'decision-order-reversed',
    content: JSON.stringify({
      decisions: [...canonicalProviderPayload.decisions].reverse(),
    }),
  },
  {
    id: 'whitespace-json',
    content: JSON.stringify(canonicalProviderPayload, null, 2),
  },
  { id: 'wrapper-data', content: JSON.stringify({ data: canonicalProviderPayload }) },
  { id: 'wrapper-output', content: JSON.stringify({ output: canonicalProviderPayload }) },
  { id: 'top-level-array', content: JSON.stringify([canonicalProviderPayload]) },
  { id: 'top-level-null', content: 'null' },
  { id: 'double-encoded-json', content: JSON.stringify(JSON.stringify(canonicalProviderPayload)) },
  {
    id: 'markdown-fence',
    content:
      String.fromCharCode(96).repeat(3) +
      'json\n' +
      JSON.stringify(canonicalProviderPayload) +
      '\n' +
      String.fromCharCode(96).repeat(3),
  },
  { id: 'prose-prefix', content: 'Result: ' + JSON.stringify(canonicalProviderPayload) },
  { id: 'bom-prefix', content: '\uFEFF' + JSON.stringify(canonicalProviderPayload) },
  {
    id: 'top-level-extra-key',
    content: JSON.stringify({ ...canonicalProviderPayload, extra: true }),
  },
  { id: 'decisions-null', content: JSON.stringify({ decisions: null }) },
  { id: 'decisions-string', content: JSON.stringify({ decisions: 'three' }) },
  { id: 'decisions-empty', content: JSON.stringify({ decisions: [] }) },
  {
    id: 'decisions-over-limit',
    content: JSON.stringify({
      decisions: Array.from({ length: 13 }, (_, questionIndex) => ({
        questionIndex: questionIndex % 12,
        optionIndex: 0,
      })),
    }),
  },
  {
    id: 'decision-null-first',
    content: JSON.stringify({
      decisions: [null, ...canonicalProviderPayload.decisions.slice(1)],
    }),
  },
  {
    id: 'decision-null-middle',
    content: JSON.stringify({
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? null : decision,
      ),
    }),
  },
  {
    id: 'decision-null-last',
    content: JSON.stringify({
      decisions: [...canonicalProviderPayload.decisions.slice(0, 2), null],
    }),
  },
  providerCaseWithDecisionPatch('decision-extra-key', 1, {
    credential: 'private-shape-value',
  }),
  {
    id: 'snake-case-decision',
    content: JSON.stringify({
      decisions: [
        { question_index: 0, option_index: 0 },
        ...canonicalProviderPayload.decisions.slice(1),
      ],
    }),
  },
  {
    id: 'decision-missing-question-index',
    content: JSON.stringify({
      decisions: [{ optionIndex: 0 }, ...canonicalProviderPayload.decisions.slice(1)],
    }),
  },
  {
    id: 'decision-missing-option-index',
    content: JSON.stringify({
      decisions: [{ questionIndex: 0 }, ...canonicalProviderPayload.decisions.slice(1)],
    }),
  },
  providerCaseWithDecisionPatch('question-index-string', 0, { questionIndex: '0' }),
  providerCaseWithDecisionPatch('question-index-fraction', 1, { questionIndex: 0.5 }),
  providerCaseWithDecisionPatch('question-index-negative', 2, { questionIndex: -1 }),
  providerCaseWithDecisionPatch('question-index-null', 0, { questionIndex: null }),
  providerCaseWithDecisionPatch('option-index-string', 0, { optionIndex: '0' }),
  providerCaseWithDecisionPatch('option-index-fraction', 1, { optionIndex: 0.5 }),
  providerCaseWithDecisionPatch('option-index-negative', 2, { optionIndex: -1 }),
  providerCaseWithDecisionPatch('option-index-null', 0, { optionIndex: null }),
  {
    id: 'selection-missing-question',
    content: JSON.stringify({
      decisions: canonicalProviderPayload.decisions.slice(0, 2),
    }),
  },
  {
    id: 'selection-extra-question',
    content: JSON.stringify({
      decisions: [...canonicalProviderPayload.decisions, { questionIndex: 3, optionIndex: 0 }],
    }),
  },
  {
    id: 'selection-duplicate-question',
    content: JSON.stringify({
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, questionIndex: 1 } : decision,
      ),
    }),
  },
  providerCaseWithDecisionPatch('selection-question-out-of-range', 2, { questionIndex: 11 }),
  providerCaseWithDecisionPatch('selection-option-out-of-range', 1, { optionIndex: 23 }),
] as const;

const robustnessSource = {
  version: PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION,
  heldOutSource,
  canonicalProviderPayload,
  providerShapeCases,
};

export const PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256 =
  'sha256:' + createHash('sha256').update(JSON.stringify(robustnessSource), 'utf8').digest('hex');
export const PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256 =
  'sha256:0870799257dcd2b88841b286b9cc64e6410702fe2bcbe86c6e153d8af88a4200' as const;

if (PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256 !== PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256) {
  throw new Error('PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA_MISMATCH');
}

export const PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE = deepFreeze(heldOutSource);
export const PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD = deepFreeze(canonicalProviderPayload);
export const PHASE_6_9_7_V9_R2_PROVIDER_SHAPE_CASES = deepFreeze(providerShapeCases);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
