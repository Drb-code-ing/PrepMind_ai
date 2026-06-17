import { Injectable } from '@nestjs/common';
import {
  reviewPreferencePatchSchema,
  type ReviewPlanWindowDays,
  ReviewPreferencePatchRequest,
  ReviewPreferenceResponse,
} from '@repo/types/api/review-preference';

import { PrismaService } from '../database/prisma.service';
import {
  defaultReviewPreference,
  normalizeReviewWeekendMode,
} from './review-preference-defaults';

@Injectable()
export class ReviewPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getByUserId(userId: string): Promise<ReviewPreferenceResponse> {
    const preference = await this.prisma.reviewPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return {
        ...defaultReviewPreference,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return this.toResponse(preference);
  }

  async patch(
    userId: string,
    input: ReviewPreferencePatchRequest,
  ): Promise<ReviewPreferenceResponse> {
    const patch = reviewPreferencePatchSchema.parse(input);
    const preference = await this.prisma.reviewPreference.upsert({
      where: { userId },
      update: patch,
      create: {
        userId,
        ...defaultReviewPreference,
        ...patch,
      },
    });

    return this.toResponse(preference);
  }

  private toResponse(
    preference: ReviewPreferenceRecord,
  ): ReviewPreferenceResponse {
    return {
      dailyMinutes: preference.dailyMinutes,
      dailyCardLimit: preference.dailyCardLimit,
      preferredReviewTime: preference.preferredReviewTime,
      reminderEnabled: preference.reminderEnabled,
      reminderLeadMinutes: preference.reminderLeadMinutes,
      weekendMode: normalizeReviewWeekendMode(preference.weekendMode),
      planWindowDays: normalizePlanWindowDays(preference.planWindowDays),
      updatedAt: preference.updatedAt.toISOString(),
    };
  }
}

function normalizePlanWindowDays(value: number): ReviewPlanWindowDays {
  return Math.abs(value - 14) < Math.abs(value - 7) ? 14 : 7;
}

type ReviewPreferenceRecord = {
  dailyMinutes: number;
  dailyCardLimit: number;
  preferredReviewTime: string;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  weekendMode: string;
  planWindowDays: number;
  updatedAt: Date;
};
