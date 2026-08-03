import { createHash } from 'node:crypto';

export const PHASE_6_9_7_V8_R2_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v8-r2-provider-shapes-v1' as const;

const heldOutSource = {
  ownerDomain: `hmac-sha256:${'8'.repeat(64)}`,
  ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
  ownerSnapshotFingerprint: `sha256:${'2'.repeat(64)}`,
  safety: 'safe_for_model',
  questions: [
    {
      id: 'v8-r2-heldout-question-calculus-bilingual',
      subject: '数学',
      category: 'Calculus 函数极限',
      knowledgePoints: ['limit transformation', '等价无穷小'],
      errorType: 'concept boundary',
      questionText: 'Compare the limit transformation 与等价无穷小的适用条件。',
      analysis: 'The local rule must keep the structured math subject authoritative.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-28T12:00:00.000Z',
    },
    {
      id: 'v8-r2-heldout-question-taxonomy-mixed',
      subject: null,
      category: null,
      knowledgePoints: [],
      errorType: null,
      questionText:
        'Infer the author attitude in a passage that compares a database index ordering mistake.',
      analysis: 'Use the contrast evidence and do not invent a free subject label.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-28T12:00:01.000Z',
    },
    {
      id: 'v8-r2-heldout-question-database-unicode',
      subject: 'computer',
      category: '数据库索引',
      knowledgePoints: ['联合索引', 'leftmost-prefix'],
      errorType: 'ordering',
      questionText: '为什么 composite index 必须遵守最左匹配？',
      analysis: 'The locked local deck name and real identifier remain local.',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-28T12:00:02.000Z',
    },
  ],
  decks: [
    {
      id: 'v8-r2-heldout-deck-math-private',
      subject: 'math',
      name: '用户锁定的极限专题',
      nameLocked: true,
      keywords: ['函数极限', 'limit transformation'],
      updatedAt: '2026-07-28T12:01:00.000Z',
    },
    {
      id: 'v8-r2-heldout-deck-english-private',
      subject: 'english',
      name: '作者态度与阅读推断',
      nameLocked: false,
      keywords: ['author attitude', 'contrast evidence'],
      updatedAt: '2026-07-28T12:01:01.000Z',
    },
    {
      id: 'v8-r2-heldout-deck-computer-private',
      subject: 'computer',
      name: '数据库索引边界',
      nameLocked: true,
      keywords: ['database index', 'leftmost-prefix'],
      updatedAt: '2026-07-28T12:01:02.000Z',
    },
  ],
} as const;

const canonicalProviderPayload = {
  shortlistFingerprint: 'sha256:5d117443c7b8cd358a28305c6fc07299d53054364e2fd5e4eba06fef2879d4df',
  decisions: [
    {
      questionIndex: 0,
      subjectIndex: null,
      deckAction: 'reuse_existing',
      targetIndex: 0,
    },
    {
      questionIndex: 1,
      subjectIndex: null,
      deckAction: 'create_topic',
      targetIndex: 0,
    },
    {
      questionIndex: 2,
      subjectIndex: 0,
      deckAction: 'reuse_existing',
      targetIndex: 1,
    },
  ],
} as const;

const firstDecision = canonicalProviderPayload.decisions[0];
if (!firstDecision) throw new Error('V8_R2_CANONICAL_DECISION_MISSING');

function providerCaseWithDecisionPatch<const TId extends string>(
  id: TId,
  decisionIndex: number,
  patch: Readonly<Record<string, unknown>>,
) {
  return {
    id,
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === decisionIndex ? { ...decision, ...patch } : decision,
      ),
    }),
  } as const;
}

const providerShapeCases = [
  { id: 'canonical', content: JSON.stringify(canonicalProviderPayload) },
  {
    id: 'unicode-escaped-canonical',
    content: JSON.stringify(canonicalProviderPayload).replace(
      /[^\x00-\x7F]/gu,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
    ),
  },
  {
    id: 'decision-order-reversed',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [...canonicalProviderPayload.decisions].reverse(),
    }),
  },
  { id: 'wrapper-data', content: JSON.stringify({ data: canonicalProviderPayload }) },
  { id: 'wrapper-output', content: JSON.stringify({ output: canonicalProviderPayload }) },
  { id: 'top-level-array', content: JSON.stringify([canonicalProviderPayload]) },
  { id: 'top-level-null', content: 'null' },
  { id: 'double-encoded-json', content: JSON.stringify(JSON.stringify(canonicalProviderPayload)) },
  {
    id: 'markdown-fence',
    content: `\`\`\`json\n${JSON.stringify(canonicalProviderPayload)}\n\`\`\``,
  },
  { id: 'prose-prefix', content: `Result: ${JSON.stringify(canonicalProviderPayload)}` },
  { id: 'bom-prefix', content: `\uFEFF${JSON.stringify(canonicalProviderPayload)}` },
  { id: 'trailing-comma', content: `${JSON.stringify(canonicalProviderPayload).slice(0, -1)},}` },
  {
    id: 'single-quoted-json',
    content: JSON.stringify(canonicalProviderPayload).replaceAll('"', "'"),
  },
  {
    id: 'missing-fingerprint',
    content: JSON.stringify({ decisions: canonicalProviderPayload.decisions }),
  },
  {
    id: 'fingerprint-number',
    content: JSON.stringify({ ...canonicalProviderPayload, shortlistFingerprint: 7 }),
  },
  {
    id: 'fingerprint-uppercase',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      shortlistFingerprint: canonicalProviderPayload.shortlistFingerprint.toUpperCase(),
    }),
  },
  {
    id: 'decisions-null',
    content: JSON.stringify({ ...canonicalProviderPayload, decisions: null }),
  },
  {
    id: 'decisions-empty',
    content: JSON.stringify({ ...canonicalProviderPayload, decisions: [] }),
  },
  {
    id: 'decisions-over-limit',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: Array.from({ length: 13 }, (_, questionIndex) => ({
        ...firstDecision,
        questionIndex: questionIndex % 12,
      })),
    }),
  },
  {
    id: 'decision-null',
    content: JSON.stringify({ ...canonicalProviderPayload, decisions: [null] }),
  },
  {
    id: 'decision-null-middle',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? null : decision,
      ),
    }),
  },
  {
    id: 'decision-null-last',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? null : decision,
      ),
    }),
  },
  {
    id: 'decision-extra-key-alpha',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, opaqueAlpha: 'private-shape-value-a' }],
    }),
  },
  {
    id: 'decision-extra-key-beta',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, opaqueBeta: 'private-shape-value-b' }],
    }),
  },
  {
    id: 'decision-extra-key-middle',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? { ...decision, opaqueMiddle: 'private-shape-value-middle' } : decision,
      ),
    }),
  },
  {
    id: 'decision-extra-key-last',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, opaqueLast: 'private-shape-value-last' } : decision,
      ),
    }),
  },
  {
    id: 'legacy-v6-nested-shape',
    content: JSON.stringify({
      shortlistFingerprint: canonicalProviderPayload.shortlistFingerprint,
      decisions: [
        {
          questionIndex: 0,
          subjectDecision: { action: 'keep_local' },
          deckDecision: { action: 'reuse_existing', deckIndex: 0 },
        },
      ],
    }),
  },
  {
    id: 'snake-case-decision',
    content: JSON.stringify({
      shortlistFingerprint: canonicalProviderPayload.shortlistFingerprint,
      decisions: [
        {
          question_index: 0,
          subject_index: null,
          deck_action: 'reuse_existing',
          target_index: 0,
        },
      ],
    }),
  },
  {
    id: 'question-index-string',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, questionIndex: '0' }],
    }),
  },
  providerCaseWithDecisionPatch('question-index-string-middle', 1, { questionIndex: '0' }),
  providerCaseWithDecisionPatch('question-index-string-last', 2, { questionIndex: '0' }),
  {
    id: 'question-index-float',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, questionIndex: 0.5 }],
    }),
  },
  providerCaseWithDecisionPatch('question-index-float-middle', 1, { questionIndex: 0.5 }),
  providerCaseWithDecisionPatch('question-index-float-last', 2, { questionIndex: 0.5 }),
  {
    id: 'question-index-negative',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, questionIndex: -1 }],
    }),
  },
  providerCaseWithDecisionPatch('question-index-negative-middle', 1, { questionIndex: -1 }),
  providerCaseWithDecisionPatch('question-index-negative-last', 2, { questionIndex: -1 }),
  providerCaseWithDecisionPatch('question-index-over-limit', 0, { questionIndex: 12 }),
  providerCaseWithDecisionPatch('question-index-over-limit-middle', 1, { questionIndex: 12 }),
  providerCaseWithDecisionPatch('question-index-over-limit-last', 2, { questionIndex: 12 }),
  {
    id: 'subject-index-string',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, subjectIndex: '0' }],
    }),
  },
  providerCaseWithDecisionPatch('subject-index-string-middle', 1, { subjectIndex: '0' }),
  providerCaseWithDecisionPatch('subject-index-string-last', 2, { subjectIndex: '0' }),
  providerCaseWithDecisionPatch('subject-index-float', 0, { subjectIndex: 0.5 }),
  providerCaseWithDecisionPatch('subject-index-float-middle', 1, { subjectIndex: 0.5 }),
  providerCaseWithDecisionPatch('subject-index-float-last', 2, { subjectIndex: 0.5 }),
  providerCaseWithDecisionPatch('subject-index-negative', 0, { subjectIndex: -1 }),
  providerCaseWithDecisionPatch('subject-index-negative-middle', 1, { subjectIndex: -1 }),
  providerCaseWithDecisionPatch('subject-index-negative-last', 2, { subjectIndex: -1 }),
  {
    id: 'subject-index-over-limit',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, subjectIndex: 6 }],
    }),
  },
  providerCaseWithDecisionPatch('subject-index-over-limit-middle', 1, { subjectIndex: 6 }),
  providerCaseWithDecisionPatch('subject-index-over-limit-last', 2, { subjectIndex: 6 }),
  {
    id: 'deck-action-unknown',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, deckAction: 'rename_and_write' }],
    }),
  },
  {
    id: 'deck-action-unknown-middle',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? { ...decision, deckAction: 'rename_and_write' } : decision,
      ),
    }),
  },
  {
    id: 'deck-action-unknown-last',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, deckAction: 'rename_and_write' } : decision,
      ),
    }),
  },
  {
    id: 'target-index-string',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, targetIndex: '0' }],
    }),
  },
  {
    id: 'target-index-string-middle',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? { ...decision, targetIndex: '0' } : decision,
      ),
    }),
  },
  {
    id: 'target-index-string-last',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, targetIndex: '0' } : decision,
      ),
    }),
  },
  {
    id: 'target-index-float',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, targetIndex: 0.5 }],
    }),
  },
  providerCaseWithDecisionPatch('target-index-float-middle', 1, { targetIndex: 0.5 }),
  providerCaseWithDecisionPatch('target-index-float-last', 2, { targetIndex: 0.5 }),
  {
    id: 'target-index-negative',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, targetIndex: -1 }],
    }),
  },
  providerCaseWithDecisionPatch('target-index-negative-middle', 1, { targetIndex: -1 }),
  providerCaseWithDecisionPatch('target-index-negative-last', 2, { targetIndex: -1 }),
  {
    id: 'target-index-over-limit',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: [{ ...firstDecision, targetIndex: 20 }],
    }),
  },
  providerCaseWithDecisionPatch('target-index-over-limit-middle', 1, { targetIndex: 20 }),
  providerCaseWithDecisionPatch('target-index-over-limit-last', 2, { targetIndex: 20 }),
  {
    id: 'dynamic-fingerprint-mutation',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      shortlistFingerprint: `sha256:${'f'.repeat(64)}`,
    }),
  },
  {
    id: 'dynamic-question-count-missing',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.slice(0, 2),
    }),
  },
  {
    id: 'dynamic-question-index-duplicate',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision) => ({
        ...decision,
        questionIndex: 0,
      })),
    }),
  },
  {
    id: 'dynamic-question-index-out-of-range',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, questionIndex: 11 } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-structured-subject-override',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 0 ? { ...decision, subjectIndex: 0 } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-taxonomy-subject-null',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, subjectIndex: null } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-deck-action-ineligible',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, deckAction: 'create_topic', targetIndex: 0 } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-cross-subject-deck',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 2 ? { ...decision, targetIndex: 2 } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-topic-index-out-of-range',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 1 ? { ...decision, targetIndex: 19 } : decision,
      ),
    }),
  },
  {
    id: 'dynamic-deck-index-out-of-range',
    content: JSON.stringify({
      ...canonicalProviderPayload,
      decisions: canonicalProviderPayload.decisions.map((decision, index) =>
        index === 0 ? { ...decision, targetIndex: 19 } : decision,
      ),
    }),
  },
] as const;

const robustnessSource = {
  version: PHASE_6_9_7_V8_R2_ROBUSTNESS_VERSION,
  heldOutSource,
  canonicalProviderPayload,
  providerShapeCases,
};

export const PHASE_6_9_7_V8_R2_ROBUSTNESS_SHA256 = `sha256:${createHash('sha256')
  .update(JSON.stringify(robustnessSource), 'utf8')
  .digest('hex')}`;
export const PHASE_6_9_7_V8_R2_FROZEN_ROBUSTNESS_SHA256 =
  'sha256:f0a93a83000cb1f3515057482eca7ebbbb0ce0ef441cfd1cb7075073e000793f' as const;

if (PHASE_6_9_7_V8_R2_ROBUSTNESS_SHA256 !== PHASE_6_9_7_V8_R2_FROZEN_ROBUSTNESS_SHA256) {
  throw new Error('PHASE_6_9_7_V8_R2_ROBUSTNESS_SHA_MISMATCH');
}

export const PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE = deepFreeze(heldOutSource);
export const PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD = deepFreeze(canonicalProviderPayload);
export const PHASE_6_9_7_V8_R2_PROVIDER_SHAPE_CASES = deepFreeze(providerShapeCases);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
