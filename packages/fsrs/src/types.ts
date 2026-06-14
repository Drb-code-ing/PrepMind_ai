export type Rating = 1 | 2 | 3 | 4;

export type FsrsCardStateValue = 'NEW' | 'LEARNING' | 'REVIEW' | 'RELEARNING';

export interface FsrsCardState {
  difficulty: number;
  stability: number;
  retrievability: number;
  lastReview?: Date | null;
  nextReview: Date;
  reviewCount: number;
  lapses: number;
  state: FsrsCardStateValue;
}

export interface ScheduleReviewInput {
  card: FsrsCardState;
  rating: Rating;
  reviewedAt: Date;
}

export interface ScheduleReviewResult {
  card: FsrsCardState;
  log: {
    scheduledDays: number;
    elapsedDays: number;
    stabilityBefore: number;
    stabilityAfter: number;
    difficultyBefore: number;
    difficultyAfter: number;
  };
}
