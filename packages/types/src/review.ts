export enum CardState {
  NEW = 'NEW',
  LEARNING = 'LEARNING',
  REVIEW = 'REVIEW',
  RELEARNING = 'RELEARNING',
}

export enum ReviewRating {
  AGAIN = 1,
  HARD = 2,
  GOOD = 3,
  EASY = 4,
}

export interface Card {
  id: string;
  userId: string;
  questionId: string;
  difficulty: number;
  stability: number;
  retrievability: number;
  lastReview: Date;
  nextReview: Date;
  reviewCount: number;
  lapses: number;
  state: CardState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  rating: ReviewRating;
  scheduledDays: number;
  stabilityBefore: number;
  stabilityAfter: number;
  difficultyBefore: number;
  difficultyAfter: number;
  reviewedAt: Date;
}
