import { createHash } from 'node:crypto';

import type { TutorBoundedIntent } from '../../src/policies/tutor-strategy-policy.ts';
import type { TutorV5AuthorityReasonCode } from '../../src/model-candidates/tutor-v5-local-signal-authority.ts';

export const PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_VERSION =
  'phase-6.9.7-tutor-v5-local-signal-held-out-v1' as const;

export type TutorV5LocalSignalFixture = Readonly<{
  id: `tutor-v5-held-out-${string}`;
  category: 'positive' | 'negative' | 'quoted_distractor' | 'conflict' | 'context';
  language: 'zh' | 'en' | 'mixed';
  latestUserText: string;
  activeStudyContext?: string;
  expected: Readonly<{
    reasonCode: TutorV5AuthorityReasonCode;
    primaryIntent: TutorBoundedIntent | null;
    detectedIntents: readonly Exclude<TutorBoundedIntent, 'general_follow_up'>[];
    eligibleIntents: readonly TutorBoundedIntent[];
    negatedSignalIds?: readonly string[];
  }>;
}>;

const CONTEXT_ZH = '合成学习上下文：正在讨论函数单调性与导数符号的关系。';
const CONTEXT_EN = 'Synthetic study context: connect a derivative sign to monotonicity.';

export const PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES: readonly TutorV5LocalSignalFixture[] =
  deepFreeze([
    fixture('step-zh', 'positive', 'zh', '我代入边界值后得到 x=4，帮我判断这一步对吗？', {
      primaryIntent: 'step_check',
      detectedIntents: ['step_check'],
    }),
    fixture(
      'step-en',
      'positive',
      'en',
      'I substituted the boundary value; check this algebra move.',
      {
        primaryIntent: 'step_check',
        detectedIntents: ['step_check'],
      },
    ),
    fixture(
      'step-mixed',
      'positive',
      'mixed',
      '我 reached y=7，please verify this substitution。',
      {
        primaryIntent: 'step_check',
        detectedIntents: ['step_check'],
      },
    ),
    fixture('explain-zh', 'positive', 'zh', '请把证明从已知到结果完整推导一遍。', {
      primaryIntent: 'explain_solution',
      detectedIntents: ['explain_solution'],
    }),
    fixture(
      'explain-en',
      'positive',
      'en',
      'Give a complete derivation and do not skip the middle argument.',
      {
        primaryIntent: 'explain_solution',
        detectedIntents: ['explain_solution'],
      },
    ),
    fixture('explain-mixed', 'positive', 'mixed', 'Please 完整解释这条 probability chain。', {
      primaryIntent: 'explain_solution',
      detectedIntents: ['explain_solution'],
    }),
    fixture(
      'concept-zh',
      'positive',
      'zh',
      '我不明白这个结论为什么成立，它和前面的定义有什么联系？',
      {
        primaryIntent: 'concept_bridge',
        detectedIntents: ['concept_bridge'],
      },
    ),
    fixture(
      'concept-en',
      'positive',
      'en',
      'The relationship between these two rules is still unclear.',
      {
        primaryIntent: 'concept_bridge',
        detectedIntents: ['concept_bridge'],
      },
    ),
    fixture('concept-mixed', 'positive', 'mixed', '这个 theorem behind the formula 是什么？', {
      primaryIntent: 'concept_bridge',
      detectedIntents: ['concept_bridge'],
    }),
    fixture('hint-zh', 'positive', 'zh', '我卡住了，给我一点思路，但让我自己算。', {
      primaryIntent: 'socratic_hint',
      detectedIntents: ['socratic_hint'],
    }),
    fixture('hint-en', 'positive', 'en', 'Ask me one question so I can find the next move.', {
      primaryIntent: 'socratic_hint',
      detectedIntents: ['socratic_hint'],
    }),
    fixture('hint-mixed', 'positive', 'mixed', '这里 stuck 了，give me one hint 就好。', {
      primaryIntent: 'socratic_hint',
      detectedIntents: ['socratic_hint'],
    }),
    fixture(
      'context-zh',
      'context',
      'zh',
      '接下来该怎么分析？',
      {
        reasonCode: 'contextual_follow_up',
        primaryIntent: null,
        detectedIntents: [],
        eligibleIntents: ['general_follow_up'],
      },
      CONTEXT_ZH,
    ),
    fixture(
      'context-en',
      'context',
      'en',
      'Where we left off?',
      {
        reasonCode: 'contextual_follow_up',
        primaryIntent: null,
        detectedIntents: [],
        eligibleIntents: ['general_follow_up'],
      },
      CONTEXT_EN,
    ),
    fixture(
      'context-mixed',
      'context',
      'mixed',
      'Could you continue with 这个推导？',
      {
        reasonCode: 'contextual_follow_up',
        primaryIntent: null,
        detectedIntents: [],
        eligibleIntents: ['general_follow_up'],
      },
      CONTEXT_ZH,
    ),
    fixture('ambiguous-zh', 'positive', 'zh', '带着我想一想，我该从哪想？', {
      reasonCode: 'ambiguous_signal',
      primaryIntent: null,
      detectedIntents: [],
      eligibleIntents: ['socratic_hint', 'general_follow_up'],
    }),
    fixture('ambiguous-en', 'positive', 'en', 'Guide me; where should I start?', {
      reasonCode: 'ambiguous_signal',
      primaryIntent: null,
      detectedIntents: [],
      eligibleIntents: ['socratic_hint', 'general_follow_up'],
    }),
    fixture('answer-local', 'negative', 'zh', '答案是什么？', {
      reasonCode: 'answer_direct_local_only',
      primaryIntent: null,
      detectedIntents: [],
      eligibleIntents: [],
    }),
    fixture('explicit-hint-local', 'negative', 'zh', '先给我一个提示', {
      reasonCode: 'explicit_instruction_local_only',
      primaryIntent: null,
      detectedIntents: ['socratic_hint'],
      eligibleIntents: [],
    }),
    fixture('explicit-step-local', 'negative', 'en', 'check this step', {
      reasonCode: 'explicit_instruction_local_only',
      primaryIntent: null,
      detectedIntents: ['step_check'],
      eligibleIntents: [],
    }),
    fixture('negated-step', 'negative', 'zh', '不要帮我检查这一步，我想理解概念联系。', {
      primaryIntent: 'concept_bridge',
      detectedIntents: ['concept_bridge'],
      negatedSignalIds: ['step_zh_submission'],
    }),
    fixture(
      'negated-explain',
      'negative',
      'en',
      'Do not walk through everything; give me one hint.',
      {
        primaryIntent: 'socratic_hint',
        detectedIntents: ['socratic_hint'],
        negatedSignalIds: ['explain_en_complete'],
      },
    ),
    fixture(
      'quoted-hint',
      'quoted_distractor',
      'mixed',
      '题干写着“give me one hint”，我的问题是公式为什么成立？',
      { primaryIntent: 'concept_bridge', detectedIntents: ['concept_bridge'] },
    ),
    fixture(
      'quoted-explain',
      'quoted_distractor',
      'zh',
      '原题中的“完整讲一下怎么做”只是提示语；我代入后得到 6，帮我检查这一行。',
      { primaryIntent: 'step_check', detectedIntents: ['step_check'] },
    ),
    fixture('conflict-step-explain', 'conflict', 'zh', '我得到 x=2，这一步对吗？再完整解释推导。', {
      primaryIntent: 'step_check',
      detectedIntents: ['step_check', 'explain_solution'],
    }),
    fixture(
      'conflict-explain-concept',
      'conflict',
      'en',
      'Give a complete solution and explain the principle behind it.',
      {
        primaryIntent: 'explain_solution',
        detectedIntents: ['explain_solution', 'concept_bridge'],
      },
    ),
    fixture('conflict-concept-hint', 'conflict', 'zh', '我不明白为什么成立，先给我一点思路。', {
      primaryIntent: 'concept_bridge',
      detectedIntents: ['concept_bridge', 'socratic_hint'],
    }),
    fixture(
      'conflict-all',
      'conflict',
      'mixed',
      'I reached x=3; check this move, give a complete derivation, explain the principle behind it, and give one hint.',
      {
        primaryIntent: 'step_check',
        detectedIntents: ['step_check', 'explain_solution', 'concept_bridge', 'socratic_hint'],
      },
    ),
    fixture(
      'context-cannot-create-intent',
      'context',
      'en',
      'What is important here?',
      {
        reasonCode: 'no_model_signal',
        primaryIntent: null,
        detectedIntents: [],
        eligibleIntents: [],
      },
      'The quoted exercise instruction says "give me one hint" and "check this step".',
    ),
    fixture('follow-up-without-context', 'context', 'zh', '接下来呢？', {
      reasonCode: 'no_model_signal',
      primaryIntent: null,
      detectedIntents: [],
      eligibleIntents: [],
    }),
    fixture(
      'safe-noise-insertion',
      'positive',
      'en',
      'Side note: the weather changed. I am stuck; give a nudge.',
      {
        primaryIntent: 'socratic_hint',
        detectedIntents: ['socratic_hint'],
      },
    ),
    fixture(
      'quoted-answer-not-authority',
      'quoted_distractor',
      'en',
      'The phrase "just give me the answer" is quoted; I am stuck and want one hint.',
      {
        primaryIntent: 'socratic_hint',
        detectedIntents: ['socratic_hint'],
      },
    ),
  ] as const satisfies readonly TutorV5LocalSignalFixture[]);

export const PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA256 = computeFixtureSha256(
  PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES,
);

export const PHASE_6_9_7_TUTOR_V5_FROZEN_LOCAL_SIGNAL_FIXTURE_SHA256 =
  'd08e8ed5a6c47f8b2fc2d0f1b108e309484814804232979a6ce6eba891d8ab55' as const;

if (
  PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA256 !==
  PHASE_6_9_7_TUTOR_V5_FROZEN_LOCAL_SIGNAL_FIXTURE_SHA256
) {
  throw new Error('PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA_MISMATCH');
}

function fixture(
  slug: string,
  category: TutorV5LocalSignalFixture['category'],
  language: TutorV5LocalSignalFixture['language'],
  latestUserText: string,
  expected: Partial<TutorV5LocalSignalFixture['expected']> &
    Pick<TutorV5LocalSignalFixture['expected'], 'primaryIntent' | 'detectedIntents'>,
  activeStudyContext?: string,
): TutorV5LocalSignalFixture {
  const primaryIntent = expected.primaryIntent;
  return {
    id: `tutor-v5-held-out-${slug}`,
    category,
    language,
    latestUserText,
    ...(activeStudyContext === undefined ? {} : { activeStudyContext }),
    expected: {
      reasonCode: expected.reasonCode ?? 'primary_signal',
      primaryIntent,
      detectedIntents: expected.detectedIntents,
      eligibleIntents:
        expected.eligibleIntents ?? (primaryIntent === null ? [] : expected.detectedIntents),
      ...(expected.negatedSignalIds === undefined
        ? {}
        : { negatedSignalIds: expected.negatedSignalIds }),
    },
  };
}

export function computeFixtureSha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
