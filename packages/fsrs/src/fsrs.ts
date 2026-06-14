import type {
  FsrsCardState,
  FsrsCardStateValue,
  Rating,
  ScheduleReviewInput,
  ScheduleReviewResult,
} from './types';

export type {
  FsrsCardState,
  FsrsCardStateValue,
  Rating,
  ScheduleReviewInput,
  ScheduleReviewResult,
};

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function scheduleReview(input: ScheduleReviewInput): ScheduleReviewResult {
  const { card, rating, reviewedAt } = input;
  assertRating(rating);

  const elapsedDays = calculateElapsedDays(card.lastReview, reviewedAt);
  const stabilityBefore = normalizeNumber(card.stability, 0);
  const difficultyBefore = normalizeNumber(card.difficulty, 5);
  const nextReviewCount = card.reviewCount + 1;
  const nextLapses = rating === 1 ? card.lapses + 1 : card.lapses;
  const nextDifficulty = clampDifficulty(calculateDifficulty(difficultyBefore, rating));
  const nextStability = clampStability(calculateStability(stabilityBefore, rating, card.state));
  const nextState = calculateState(card.state, rating);
  const scheduledDays = calculateScheduledDays(rating, nextStability, nextReviewCount);
  const nextReview = addInterval(reviewedAt, rating, scheduledDays);

  return {
    card: {
      difficulty: nextDifficulty,
      stability: nextStability,
      retrievability: calculateRetrievability(reviewedAt, nextReview),
      lastReview: reviewedAt,
      nextReview,
      reviewCount: nextReviewCount,
      lapses: nextLapses,
      state: nextState,
    },
    log: {
      scheduledDays,
      elapsedDays,
      stabilityBefore,
      stabilityAfter: nextStability,
      difficultyBefore,
      difficultyAfter: nextDifficulty,
    },
  };
}

export function fsrs() {
  return {
    schedule: (card: FsrsCardState, rating: Rating, reviewedAt = new Date()) =>
      scheduleReview({ card, rating, reviewedAt }).card,
  };
}

function assertRating(rating: Rating) {
  if (![1, 2, 3, 4].includes(rating)) {
    throw new Error(`Invalid FSRS rating: ${rating}`);
  }
}

function calculateElapsedDays(lastReview: Date | null | undefined, reviewedAt: Date) {
  if (!lastReview) return 0;
  return Math.max(0, Math.floor((reviewedAt.getTime() - lastReview.getTime()) / DAY));
}

function calculateDifficulty(current: number, rating: Rating) {
  const deltaByRating: Record<Rating, number> = {
    1: 0.8,
    2: 0.3,
    3: -0.15,
    4: -0.45,
  };
  return current + deltaByRating[rating];
}

function calculateStability(current: number, rating: Rating, state: FsrsCardStateValue) {
  const base = current > 0 ? current : 1;
  if (rating === 1) return Math.max(0.2, base * 0.45);
  if (rating === 2) return state === 'NEW' ? 0.5 : base * 1.2;
  if (rating === 3) return state === 'NEW' ? 1 : base * 2.3;
  return state === 'NEW' ? 4 : base * 3.2;
}

function calculateState(current: FsrsCardStateValue, rating: Rating): FsrsCardStateValue {
  if (rating === 1) return current === 'NEW' ? 'LEARNING' : 'RELEARNING';
  if (rating === 2) return current === 'NEW' ? 'LEARNING' : 'REVIEW';
  return 'REVIEW';
}

function calculateScheduledDays(rating: Rating, stability: number, reviewCount: number) {
  if (rating === 1) return 0;
  if (rating === 2) return reviewCount <= 1 ? 0 : Math.max(1, Math.round(stability));
  if (rating === 3) return Math.max(1, Math.round(stability));
  return Math.max(4, Math.round(stability));
}

function addInterval(reviewedAt: Date, rating: Rating, scheduledDays: number) {
  if (rating === 1) return new Date(reviewedAt.getTime() + 10 * MINUTE);
  if (rating === 2 && scheduledDays === 0) return new Date(reviewedAt.getTime() + 30 * MINUTE);
  return new Date(reviewedAt.getTime() + scheduledDays * DAY);
}

function calculateRetrievability(reviewedAt: Date, nextReview: Date) {
  return nextReview.getTime() <= reviewedAt.getTime() ? 1 : 0.9;
}

function clampDifficulty(value: number) {
  return roundToTwo(Math.min(10, Math.max(1, value)));
}

function clampStability(value: number) {
  return roundToTwo(Math.max(0.1, value));
}

function normalizeNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
