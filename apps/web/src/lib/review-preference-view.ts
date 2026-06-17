import type { ReviewPreferencePatchRequest } from '@repo/types/api/review-preference';
import type { ReviewTaskPlanCapacityStatus } from '@repo/types/api/review-task';

const capacityStatusLabels: Record<ReviewTaskPlanCapacityStatus, string> = {
  under: '容量充足',
  near: '接近上限',
  over: '超过容量',
};

const defaultPreferenceForm: Required<ReviewPreferencePatchRequest> = {
  dailyMinutes: 25,
  dailyCardLimit: 12,
  preferredReviewTime: '20:30',
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  weekendMode: 'same',
  planWindowDays: 7,
};

const validReviewTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function getCapacityStatusLabel(status: ReviewTaskPlanCapacityStatus): string {
  return capacityStatusLabels[status];
}

export function normalizeReviewPreferenceForm(input: unknown): ReviewPreferencePatchRequest {
  const values = isRecord(input) ? input : {};

  return {
    dailyMinutes: normalizeInteger(values.dailyMinutes, 5, 240, defaultPreferenceForm.dailyMinutes),
    dailyCardLimit: normalizeInteger(
      values.dailyCardLimit,
      1,
      200,
      defaultPreferenceForm.dailyCardLimit,
    ),
    preferredReviewTime:
      typeof values.preferredReviewTime === 'string' &&
      validReviewTimePattern.test(values.preferredReviewTime)
        ? values.preferredReviewTime
        : defaultPreferenceForm.preferredReviewTime,
    reminderEnabled: normalizeBoolean(
      values.reminderEnabled,
      defaultPreferenceForm.reminderEnabled,
    ),
    reminderLeadMinutes: normalizeInteger(
      values.reminderLeadMinutes,
      0,
      720,
      defaultPreferenceForm.reminderLeadMinutes,
    ),
    weekendMode:
      values.weekendMode === 'same' ||
      values.weekendMode === 'lighter' ||
      values.weekendMode === 'off'
        ? values.weekendMode
        : defaultPreferenceForm.weekendMode,
    planWindowDays: normalizeInteger(
      values.planWindowDays,
      7,
      14,
      defaultPreferenceForm.planWindowDays,
    ),
  };
}

function normalizeInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numericValue = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  const integerValue = Number.isFinite(numericValue) ? Math.round(numericValue) : fallback;
  return Math.min(max, Math.max(min, integerValue));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }
  return value === undefined || value === null ? fallback : Boolean(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
