import { describe, expect, it } from 'bun:test';

import { analyzeReview } from '../src/nodes/review';

describe('analyzeReview', () => {
  it('marks overdue repeated-again low-stability review pressure as high priority', () => {
    const result = analyzeReview({
      now: '2026-06-22T08:00:00.000Z',
      weakKnowledgePoints: [
        {
          label: '导数单调性',
          subject: '数学',
          deckName: '函数与导数',
          wrongCount: 4,
          recentAgainCount: 3,
          averageDifficulty: 4.2,
          averageStability: 1.1,
        },
        {
          label: '圆锥曲线离心率',
          subject: '数学',
          deckName: '解析几何',
          wrongCount: 8,
          recentAgainCount: 1,
          averageDifficulty: 4.8,
          averageStability: 2.8,
        },
        {
          label: '完形填空上下文',
          subject: '英语',
          deckName: '阅读',
          wrongCount: 1,
          recentAgainCount: 0,
          averageDifficulty: 2.3,
          averageStability: 5.5,
        },
      ],
      cardSummary: {
        dueCount: 12,
        overdueCount: 6,
        highDifficultyCount: 3,
        lowStabilityCount: 7,
      },
      recentReviewSummary: {
        totalReviews: 10,
        againCount: 4,
        hardCount: 2,
        goodCount: 3,
        easyCount: 1,
      },
    });

    expect(result.priority).toBe('high');
    expect(result.weakPoints.map((point) => point.label)).toEqual([
      '导数单调性',
      '圆锥曲线离心率',
      '完形填空上下文',
    ]);
    expect(result.weakPoints[0].priority).toBe('high');
    expect(result.actions[0].targetHref).toBe('/today');
    expect(result.signals).toEqual(
      expect.arrayContaining(['overdue', 'recentAgain', 'lowStability']),
    );
  });

  it('returns a low-pressure empty state when there are no weak review signals', () => {
    const result = analyzeReview({
      now: '2026-06-22T08:00:00.000Z',
      weakKnowledgePoints: [],
      cardSummary: {
        dueCount: 0,
        overdueCount: 0,
        highDifficultyCount: 0,
        lowStabilityCount: 0,
      },
      recentReviewSummary: {
        totalReviews: 4,
        againCount: 0,
        hardCount: 0,
        goodCount: 3,
        easyCount: 1,
      },
    });

    expect(result.priority).toBe('low');
    expect(result.weakPoints).toEqual([]);
    expect(result.summary).toContain('复习压力较低');
    expect(result.actions).toEqual([
      {
        title: '整理错题本',
        description: '当前没有明显复习压力，可以补充错题备注或检查专题归档。',
        targetHref: '/error-book',
      },
    ]);
    expect(result.signals).toContain('lowPressure');
  });

  it('uses hidden high weak points outside the returned top five for overall priority', () => {
    const result = analyzeReview({
      now: '2026-06-22T08:00:00.000Z',
      weakKnowledgePoints: [
        {
          label: 'medium-a',
          wrongCount: 4,
          recentAgainCount: 2,
          averageDifficulty: 4.0,
          averageStability: 3.2,
        },
        {
          label: 'medium-b',
          wrongCount: 4,
          recentAgainCount: 2,
          averageDifficulty: 3.9,
          averageStability: 3.2,
        },
        {
          label: 'medium-c',
          wrongCount: 3,
          recentAgainCount: 2,
          averageDifficulty: 3.8,
          averageStability: 3.3,
        },
        {
          label: 'medium-d',
          wrongCount: 3,
          recentAgainCount: 1,
          averageDifficulty: 4.0,
          averageStability: 3.4,
        },
        {
          label: 'medium-e',
          wrongCount: 3,
          recentAgainCount: 1,
          averageDifficulty: 3.9,
          averageStability: 3.5,
        },
        {
          label: 'hidden-low-stability',
          wrongCount: 0,
          recentAgainCount: 0,
          averageDifficulty: 1.5,
          averageStability: 1.5,
        },
      ],
      cardSummary: {
        dueCount: 0,
        overdueCount: 0,
        highDifficultyCount: 0,
        lowStabilityCount: 0,
      },
      recentReviewSummary: {
        totalReviews: 6,
        againCount: 0,
        hardCount: 0,
        goodCount: 6,
        easyCount: 0,
      },
    });

    expect(result.weakPoints).toHaveLength(5);
    expect(result.weakPoints.map((point) => point.label)).not.toContain(
      'hidden-low-stability',
    );
    expect(result.priority).toBe('high');
    expect(result.signals).toContain('highWeakPoint');
  });
});
