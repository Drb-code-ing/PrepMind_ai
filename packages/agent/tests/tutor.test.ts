import { describe, expect, it } from 'bun:test';

import { buildGenericTutorPrompt, buildTutorStrategy } from '../src/nodes/tutor';

describe('buildTutorStrategy', () => {
  it('classifies direct solving requests as explain_solution', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Please explain how to solve this derivative problem.',
      activeStudyContext: 'Find the derivative of f(x)=x^2.',
    });

    expect(strategy.intent).toBe('explain_solution');
    expect(strategy.depth).toBe('deep');
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.shouldUseActiveStudyContext).toBe(true);
    expect(strategy.answerStructure).toContain('known_conditions');
    expect(strategy.answerStructure).toContain('reasoning_steps');
    expect(strategy.answerStructure).toContain('final_answer');
    expect(strategy.promptAddition).toContain('TutorAgent strategy: explain_solution');
    expect(strategy.promptAddition).toContain('Answer in Chinese');
  });

  it('classifies why follow-ups as socratic_hint', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Why can this step be done like this?',
      activeStudyContext: 'Use Green theorem to compute a line integral.',
    });

    expect(strategy.intent).toBe('socratic_hint');
    expect(strategy.depth).toBe('standard');
    expect(strategy.shouldAskGuidingQuestion).toBe(true);
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toContain('guiding_question');
    expect(strategy.debug.matchedSignals).toContain('why');
  });

  it('classifies user submitted steps as step_check', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'I wrote this step. Is it correct?',
      activeStudyContext: 'Solve an integration problem.',
    });

    expect(strategy.intent).toBe('step_check');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toEqual([
      'known_conditions',
      'reasoning_steps',
      'common_mistake',
      'guiding_question',
    ]);
    expect(strategy.promptAddition).toContain('judge the submitted step first');
  });

  it('classifies concept questions as concept_bridge', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'What is the key theorem behind this formula?',
      activeStudyContext: 'A line integral problem.',
    });

    expect(strategy.intent).toBe('concept_bridge');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toContain('concept');
    expect(strategy.promptAddition).toContain('connect the concept back to the active problem');
  });

  it('classifies answer-only requests as answer_direct', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Just give me the final answer.',
      activeStudyContext: 'Find a limit.',
    });

    expect(strategy.intent).toBe('answer_direct');
    expect(strategy.depth).toBe('brief');
    expect(strategy.shouldAskGuidingQuestion).toBe(false);
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.answerStructure[0]).toBe('final_answer');
  });

  it('classifies answer wording as answer_direct instead of concept_bridge', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'What is the answer?',
      activeStudyContext: 'Find a limit.',
    });

    expect(strategy.intent).toBe('answer_direct');
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
  });

  it('falls back to general_follow_up for unknown text', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '',
      activeStudyContext: undefined,
    });

    expect(strategy.intent).toBe('general_follow_up');
    expect(strategy.depth).toBe('standard');
    expect(strategy.shouldUseActiveStudyContext).toBe(false);
    expect(strategy.promptAddition).toContain('TutorAgent strategy: general_follow_up');
  });

  it('classifies Chinese direct solving requests as explain_solution', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '请讲一下这道导数题怎么做。',
      activeStudyContext: '求 f(x)=x^2 的导数。',
    });

    expect(strategy.intent).toBe('explain_solution');
    expect(strategy.depth).toBe('deep');
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.shouldUseActiveStudyContext).toBe(true);
    expect(strategy.answerStructure).toContain('known_conditions');
    expect(strategy.answerStructure).toContain('reasoning_steps');
    expect(strategy.answerStructure).toContain('final_answer');
  });

  it('classifies Chinese why follow-ups as socratic_hint', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '为什么这一步可以这样变形？',
      activeStudyContext: '用格林公式计算曲线积分。',
    });

    expect(strategy.intent).toBe('socratic_hint');
    expect(strategy.depth).toBe('standard');
    expect(strategy.shouldAskGuidingQuestion).toBe(true);
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toContain('guiding_question');
  });

  it('classifies Chinese submitted steps as step_check', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '我写的这一步对吗？',
      activeStudyContext: '解一道积分题。',
    });

    expect(strategy.intent).toBe('step_check');
    expect(strategy.shouldGiveFinalAnswer).toBe(false);
    expect(strategy.answerStructure).toEqual([
      'known_conditions',
      'reasoning_steps',
      'common_mistake',
      'guiding_question',
    ]);
  });

  it('classifies Chinese answer-only requests as answer_direct', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '直接给我答案。',
      activeStudyContext: '求一个极限。',
    });

    expect(strategy.intent).toBe('answer_direct');
    expect(strategy.depth).toBe('brief');
    expect(strategy.shouldAskGuidingQuestion).toBe(false);
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
    expect(strategy.answerStructure[0]).toBe('final_answer');
  });

  it('classifies Chinese answer wording as answer_direct instead of concept_bridge', () => {
    const strategy = buildTutorStrategy({
      latestUserText: '答案是什么？',
      activeStudyContext: '求一个极限。',
    });

    expect(strategy.intent).toBe('answer_direct');
    expect(strategy.shouldGiveFinalAnswer).toBe(true);
  });

  it('does not classify checklist planning as submitted-step verification', () => {
    const strategy = buildTutorStrategy({
      latestUserText: 'Can you make a checklist for solving limits?',
      activeStudyContext: 'Limit practice.',
    });

    expect(strategy.intent).not.toBe('step_check');
    expect(['explain_solution', 'general_follow_up']).toContain(strategy.intent);
    expect(strategy.shouldAskGuidingQuestion).toBe(false);
  });
});

describe('buildGenericTutorPrompt', () => {
  it('returns a compact fallback prompt for policy degradation', () => {
    const prompt = buildGenericTutorPrompt();

    expect(prompt).toContain('TutorAgent generic fallback');
    expect(prompt).toContain('Answer in Chinese');
    expect(prompt.length).toBeLessThan(500);
  });
});
