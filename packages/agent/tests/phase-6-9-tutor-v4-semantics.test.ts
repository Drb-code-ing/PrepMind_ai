import { describe, expect, test } from 'bun:test';

import {
  TUTOR_MODEL_INTENT_POLICY,
  formatTutorModelIntentPolicyForPrompt,
  selectTutorModelIntentFromEvidence,
  validateTutorModelDecision,
} from '../src/model-candidates/tutor-model-contract.ts';
import { mergeTutorModelDecision } from '../src/model-candidates/tutor-model-candidate.ts';
import {
  buildTutorStrategy,
  buildTutorStrategyFromIntent,
  type TutorStrategy,
} from '../src/nodes/tutor.ts';

const ACTIVE_CONTEXT = '当前题目上下文仅用于补充条件，不能改变用户的教学意图。';

describe('Phase 6.9.7 Tutor V4 semantic authority', () => {
  test.each([
    ['step_check', '我把 x 移到左边得到 2x=6，这一步对吗？'],
    ['explain_solution', '请完整讲解这道题怎么做。'],
    ['concept_bridge', '这个概念和前面公式有什么联系？'],
    ['socratic_hint', '先给我一个提示，告诉我下一步该怎么想。'],
  ] as const)('keeps %s stable when active context is added', (intent, text) => {
    const withoutContext = buildTutorStrategy({ latestUserText: text });
    const withContext = buildTutorStrategy({
      latestUserText: text,
      activeStudyContext: ACTIVE_CONTEXT,
    });

    expect(withoutContext.intent).toBe(intent);
    expect(withContext.intent).toBe(intent);
  });

  test('resolves conflicting primary evidence by the frozen V4 precedence', () => {
    expect(
      selectTutorModelIntentFromEvidence([
        'implicit_hint_request',
        'concept_gap',
        'full_explanation_request',
        'submitted_step',
      ]),
    ).toBe('step_check');
    expect(
      selectTutorModelIntentFromEvidence([
        'implicit_hint_request',
        'concept_gap',
        'full_explanation_request',
      ]),
    ).toBe('explain_solution');
    expect(selectTutorModelIntentFromEvidence(['concept_gap', 'implicit_hint_request'])).toBe(
      'concept_bridge',
    );
    expect(selectTutorModelIntentFromEvidence(['contextual_reference'])).toBe('general_follow_up');
  });

  test('allows general_follow_up only when no specific primary signal is present', () => {
    expect(
      buildTutorStrategy({
        latestUserText: '那接下来呢？',
        activeStudyContext: ACTIVE_CONTEXT,
      }).intent,
    ).toBe('general_follow_up');

    expect(
      validateTutorModelDecision({
        intent: 'socratic_hint',
        depth: 'standard',
        confidence: 'medium',
        evidenceCodes: ['contextual_reference'],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_evidence_association' });
  });

  test.each([
    ['不要直接给答案，解释一下这个概念为什么成立。', 'concept_bridge'],
    ["Don't just give me the answer; explain the concept behind this theorem.", 'concept_bridge'],
  ] as const)('does not turn a negated final-answer phrase into answer_direct', (text, intent) => {
    const strategy = buildTutorStrategy({
      latestUserText: text,
      activeStudyContext: ACTIVE_CONTEXT,
    });
    expect(strategy.intent).toBe(intent);
    expect(strategy.intent).not.toBe('answer_direct');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
  });

  test('derives depth, context, guiding, final-answer, and structure invariants from one policy', () => {
    for (const policy of TUTOR_MODEL_INTENT_POLICY) {
      for (const hasActiveStudyContext of [false, true]) {
        const depth = hasActiveStudyContext
          ? policy.localStrategy.activeContextDepth
          : policy.localStrategy.defaultDepth;
        const strategy = buildTutorStrategyFromIntent({
          intent: policy.intent,
          depth,
          hasActiveStudyContext,
          debug: { reason: 'synthetic-v4-policy-check', matchedSignals: [] },
        });

        expect(strategy.depth, policy.intent).toBe(depth);
        expect(strategy.shouldUseActiveStudyContext, policy.intent).toBe(hasActiveStudyContext);
        expect(strategy.shouldAskGuidingQuestion, policy.intent).toBe(
          policy.localStrategy.shouldAskGuidingQuestion,
        );
        expect(strategy.shouldGiveFinalAnswer, policy.intent).toBe(
          policy.localStrategy.shouldGiveFinalAnswer,
        );
        expect(strategy.answerStructure, policy.intent).toEqual(
          hasActiveStudyContext
            ? policy.localStrategy.activeContextAnswerStructure
            : policy.localStrategy.answerStructure,
        );
      }
    }
  });

  test('fails closed when a model decision downgrades a more specific local authority', () => {
    const local = buildTutorStrategy({
      latestUserText: '先给我一个提示，告诉我下一步怎么想。',
      activeStudyContext: ACTIVE_CONTEXT,
    });
    expect(local.intent).toBe('socratic_hint');

    expect(
      mergeTutorModelDecision(local, {
        intent: 'general_follow_up',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['contextual_reference'],
      }),
    ).toBeNull();

    const promoted = mergeTutorModelDecision(local, {
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['submitted_step'],
    });
    expect((promoted as TutorStrategy | null)?.intent).toBe('step_check');
  });

  test('keeps the generic V4 policy free of eval ids and answer or routing capabilities', () => {
    const prompt = formatTutorModelIntentPolicyForPrompt();
    expect(prompt).toContain(
      'precedence=step_check > explain_solution > concept_bridge > socratic_hint > general_follow_up',
    );
    expect(prompt).not.toMatch(/tutor-(?:zero|runtime)-\d+/u);
    expect(prompt).not.toMatch(/expected(?:Output|Intent|Depth)|canonicalTopicLabel/iu);
    expect(prompt).not.toMatch(/execute tools|alter routing|create permissions/iu);
  });
});
