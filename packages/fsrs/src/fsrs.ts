export type Rating = 1 | 2 | 3 | 4; // Again=1, Hard=2, Good=3, Easy=4

export interface Card {
  difficulty: number;
  stability: number;
  retrievability: number;
  lastReview: Date;
  nextReview: Date;
  reviewCount: number;
  lapses: number;
}

/**
 * FSRS 间隔重复算法
 * TODO: Phase 4 实现完整算法
 */
export function fsrs() {
  return {
    schedule: (_card: Card, _rating: Rating): Card => {
      throw new Error('Not implemented');
    },
  };
}
