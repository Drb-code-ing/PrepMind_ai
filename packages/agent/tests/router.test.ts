import { describe, expect, it } from 'bun:test';

import { routeAgentRequest } from '../src/router';
import { createInitialAgentState } from '../src/state';

describe('routeAgentRequest', () => {
  it('routes obvious question explanation requests to tutor', () => {
    const state = createInitialAgentState({
      runId: 'run_1',
      userId: 'user_1',
      text: '这道题为什么要这样做？',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('tutor');
    expect(result.requiresRag).toBe(false);
    expect(result.requiresHumanApproval).toBe(false);
  });

  it('routes knowledge-base requests to rag_answer', () => {
    const state = createInitialAgentState({
      runId: 'run_2',
      userId: 'user_1',
      text: '根据我上传的笔记，格林公式怎么用？',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('rag_answer');
    expect(result.requiresRag).toBe(true);
  });

  it('routes plan requests to study_plan and requires approval for writes', () => {
    const state = createInitialAgentState({
      runId: 'run_3',
      userId: 'user_1',
      text: '帮我制定下周学习计划',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('study_plan');
    expect(result.requiresHumanApproval).toBe(true);
  });

  it('falls back to chat for general messages', () => {
    const state = createInitialAgentState({
      runId: 'run_4',
      userId: 'user_1',
      text: '你好',
    });

    const result = routeAgentRequest(state);

    expect(result.name).toBe('chat');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
