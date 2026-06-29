import { describe, expect, it } from 'bun:test';

import { InMemoryAgentRunRecorder } from '../src/recorder';
import { runAgentRuntime } from '../src/runtime';

describe('runAgentRuntime', () => {
  it('returns a structured chat result and records run steps', async () => {
    const recorder = new InMemoryAgentRunRecorder();

    const result = await runAgentRuntime(
      {
        runId: 'run_1',
        userId: 'user_1',
        text: '你好',
      },
      { recorder },
    );

    expect(result.state.route?.name).toBe('chat');
    expect(result.state.finalResponse?.markdown).toContain('你好');
    expect(result.state.proposals).toEqual([]);
    expect(recorder.getRuns()).toHaveLength(1);
    expect(recorder.getSteps('run_1').map((step) => step.node)).toContain('RouterAgent');
  });

  it('routes tutor requests and returns a tutor placeholder response', async () => {
    const result = await runAgentRuntime({
      runId: 'run_2',
      userId: 'user_1',
      text: '这道题为什么这样做？',
    });

    expect(result.state.route?.name).toBe('tutor');
    expect(result.state.finalResponse?.markdown).toContain('我们先看题目条件');
  });

  it('uses the runtime start time for loop control metadata', async () => {
    const startedAt = new Date('2026-06-29T00:00:00.000Z');
    const finishedAt = new Date('2026-06-29T00:00:01.000Z');
    const nowValues = [startedAt, finishedAt, finishedAt];

    const result = await runAgentRuntime(
      {
        runId: 'run_time',
        userId: 'user_1',
        text: 'hello',
      },
      {
        now: () => nowValues.shift() ?? finishedAt,
      },
    );

    expect(result.state.loopControl?.startedAt).toBe('2026-06-29T00:00:00.000Z');
  });

  it('degrades to chat when router throws', async () => {
    const result = await runAgentRuntime(
      {
        runId: 'run_3',
        userId: 'user_1',
        text: '制定学习计划',
      },
      {
        router: () => {
          throw new Error('router failed');
        },
      },
    );

    expect(result.state.route?.name).toBe('chat');
    expect(result.state.errors[0]?.node).toBe('RouterAgent');
    expect(result.state.finalResponse?.markdown).toContain('我先按普通问题回答');
  });
});
