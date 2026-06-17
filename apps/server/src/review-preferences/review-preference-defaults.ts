import type {
  ReviewPreferenceResponse,
  ReviewWeekendMode,
} from '@repo/types/api/review-preference';

export type ReviewPreferenceDefaults = Omit<
  ReviewPreferenceResponse,
  'updatedAt'
>;

export const defaultReviewPreference: ReviewPreferenceDefaults = {
  dailyMinutes: 25,
  dailyCardLimit: 12,
  preferredReviewTime: '20:30',
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  weekendMode: 'same',
  planWindowDays: 7,
};

export function normalizeReviewWeekendMode(value: string): ReviewWeekendMode {
  if (value === 'lighter' || value === 'off') return value;
  return 'same';
}
