import { describe, expect, it } from 'bun:test';

import { analyzeMemory, memoryNode } from '../src/index';

describe('analyzeMemory', () => {
  it('creates an explanation preference from explicit preference text', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [
        {
          conversationId: 'conv_1',
          messageId: 'msg_1',
          text: '以后讲题先给我一点提示，不要直接给完整答案',
          createdAt: '2026-06-28T00:00:00.000Z',
        },
      ],
      weakPointSignals: [],
      reviewSignals: { consecutiveActiveDays: 1, totalReviewsInWindow: 3 },
      existingMemories: [],
    });

    expect(result.candidates[0]?.type).toBe('EXPLANATION_PREFERENCE');
    expect(result.candidates[0]?.content).toContain('先提示');
    expect(result.signals).toContain('explicitPreference');
  });

  it('creates a weak point memory only after repeated signals', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [],
      weakPointSignals: [
        {
          label: '导数应用',
          subject: '数学',
          wrongCount: 4,
          recentAgainCount: 2,
        },
      ],
      reviewSignals: { consecutiveActiveDays: 2, totalReviewsInWindow: 8 },
      existingMemories: [],
    });

    expect(result.candidates[0]?.type).toBe('WEAK_POINT');
    expect(result.candidates[0]?.content).toContain('导数应用');
    expect(result.signals).toContain('repeatedWeakPoint');
  });

  it('skips one-off weak signals and duplicate existing memories', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [
        {
          conversationId: 'conv_1',
          messageId: 'msg_1',
          text: '这题不会',
          createdAt: '2026-06-28T00:00:00.000Z',
        },
      ],
      weakPointSignals: [{ label: '数列', wrongCount: 1, recentAgainCount: 0 }],
      reviewSignals: { consecutiveActiveDays: 1, totalReviewsInWindow: 1 },
      existingMemories: [
        { type: 'WEAK_POINT', content: '用户在导数应用题中多次出现审题错误。' },
      ],
    });

    expect(result.candidates).toEqual([]);
    expect(result.signals).toContain('insufficientSignals');
  });

  it('skips duplicate existing memories', () => {
    const result = analyzeMemory({
      now: '2026-06-28T00:00:00.000Z',
      recentChatSignals: [],
      weakPointSignals: [
        {
          label: '导数应用',
          subject: '数学',
          wrongCount: 4,
          recentAgainCount: 2,
        },
      ],
      reviewSignals: { consecutiveActiveDays: 2, totalReviewsInWindow: 8 },
      existingMemories: [
        {
          type: 'WEAK_POINT',
          content: '用户在数学 导数应用相关题目中反复出错，适合后续优先复盘。',
        },
      ],
    });

    expect(result.candidates).toEqual([]);
    expect(result.signals).toContain('insufficientSignals');
  });

  it('exports memory policy from the package root', () => {
    expect(memoryNode).toBe(analyzeMemory);
  });
});
