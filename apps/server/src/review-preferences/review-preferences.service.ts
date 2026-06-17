import { Injectable } from '@nestjs/common';
import type {
  ReviewPreferencePatchRequest,
  ReviewPreferenceResponse,
  ReviewWeekendMode,
} from '@repo/types/api/review-preference';

import { PrismaService } from '../database/prisma.service';

const defaultReviewPreference = {
  dailyMinutes: 25,
  dailyCardLimit: 12,
  preferredReviewTime: '20:30',
  reminderEnabled: true,
  reminderLeadMinutes: 30,
  weekendMode: 'same' as const,
  planWindowDays: 7,
};

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
    const preference = await this.prisma.reviewPreference.upsert({
      where: { userId },
      update: input,
      create: {
        userId,
        ...defaultReviewPreference,
        ...input,
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
      weekendMode: preference.weekendMode as ReviewWeekendMode,
      planWindowDays: preference.planWindowDays,
      updatedAt: preference.updatedAt.toISOString(),
    };
  }
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
