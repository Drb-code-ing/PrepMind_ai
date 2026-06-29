import { describe, expect, it } from 'bun:test';

import { evaluateCriticRubric } from '../src/evals/critic-rubric';

describe('critic rubric', () => {
  it('passes a RAG answer with citations and verifier notice', () => {
    expect(
      evaluateCriticRubric({
        route: 'rag_answer',
        userPrompt: 'Use my notes to answer this.',
        assistantText: '先按资料回答。\n\n参考资料：\n- 讲义 A\n\n资料核对提示：请核对原文。',
        verifierStatus: 'suspicious',
        ragHitCount: 1,
      }),
    ).toEqual({ passed: true, failures: [] });
  });

  it('passes an English RAG answer with sources and caution wording', () => {
    expect(
      evaluateCriticRubric({
        route: 'rag_answer',
        userPrompt: 'Use my notes to answer this.',
        assistantText: 'Based on your notes, check this carefully.\n\nSources:\n- Note A\n\nCaution: verify the original material.',
        verifierStatus: 'conflict',
        ragHitCount: 1,
      }),
    ).toEqual({ passed: true, failures: [] });
  });

  it('fails a RAG answer with hits but no citations', () => {
    const result = evaluateCriticRubric({
      route: 'rag_answer',
      userPrompt: 'Use my notes to answer this.',
      assistantText: 'According to your notes, the answer is B.',
      verifierStatus: 'trusted',
      ragHitCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('rag_answer_missing_citations');
  });

  it('does not treat a no-reference sentence as a citation block', () => {
    const result = evaluateCriticRubric({
      route: 'rag_answer',
      userPrompt: 'Use my notes to answer this.',
      assistantText: '没有参考资料可列出，所以我先按通用知识回答。',
      verifierStatus: 'trusted',
      ragHitCount: 1,
    });

    expect(result.failures).toContain('rag_answer_missing_citations');
  });

  it('fails a suspicious RAG answer without a verification notice', () => {
    const result = evaluateCriticRubric({
      route: 'rag_answer',
      userPrompt: 'Use my notes to answer this.',
      assistantText: '参考资料：讲义 A。答案是 B。',
      verifierStatus: 'conflict',
      ragHitCount: 1,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('verifier_notice_missing');
  });

  it('fails an insufficient RAG answer without a verification notice', () => {
    const result = evaluateCriticRubric({
      route: 'rag_answer',
      userPrompt: 'Use my notes to answer this.',
      assistantText: '参考资料：讲义 A。资料比较少，但答案是 B。',
      verifierStatus: 'insufficient',
      ragHitCount: 1,
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('verifier_notice_missing');
  });

  it('fails a socratic hint response that only gives the final answer', () => {
    const result = evaluateCriticRubric({
      route: 'tutor',
      userPrompt: 'Give me a hint only.',
      assistantText: '最终答案：x = 2',
      tutorIntent: 'socratic_hint',
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('socratic_hint_gave_final_answer');
  });

  it('fails a socratic hint response that disguises the final answer after a hint label', () => {
    const result = evaluateCriticRubric({
      route: 'tutor',
      userPrompt: 'Give me a hint only.',
      assistantText: '提示：最终答案是 x = 2。',
      tutorIntent: 'socratic_hint',
    });

    expect(result.failures).toContain('socratic_hint_gave_final_answer');
  });

  it('fails advisory routes that claim they wrote data', () => {
    const result = evaluateCriticRubric({
      route: 'study_plan',
      userPrompt: 'Make a plan for me.',
      assistantText: '我已经创建了明天的复习任务。',
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toContain('advisory_route_claimed_write');
  });

  it('fails advisory routes that claim they generated tasks', () => {
    const result = evaluateCriticRubric({
      route: 'study_plan',
      userPrompt: 'Make a plan for me.',
      assistantText: '我已经生成了明天的复习任务。',
    });

    expect(result.failures).toContain('advisory_route_claimed_write');
  });

  it('does not fail advisory routes when write wording is clearly negated', () => {
    const result = evaluateCriticRubric({
      route: 'study_plan',
      userPrompt: 'Make a plan for me.',
      assistantText: 'No tasks were saved. I can only suggest a study plan for your review.',
    });

    expect(result.failures).not.toContain('advisory_route_claimed_write');
  });

  it('fails memory and knowledge advisory routes that claim they wrote data', () => {
    const memoryResult = evaluateCriticRubric({
      route: 'memory_reflection',
      userPrompt: 'Remember that I like short explanations.',
      assistantText: 'Saved this preference to your long-term memory.',
    });
    const knowledgeResult = evaluateCriticRubric({
      route: 'knowledge_dedup',
      userPrompt: 'Check duplicate knowledge docs.',
      assistantText: '我已保存资料合并结果。',
    });

    expect(memoryResult.failures).toContain('advisory_route_claimed_write');
    expect(knowledgeResult.failures).toContain('advisory_route_claimed_write');
  });

  it('exports the critic rubric from the package subpath', async () => {
    const subpath = await import('@repo/agent/critic-rubric');

    expect(typeof subpath.evaluateCriticRubric).toBe('function');
  });
});
