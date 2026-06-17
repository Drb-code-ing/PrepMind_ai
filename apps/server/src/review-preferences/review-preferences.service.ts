import { Injectable } from '@nestjs/common';
import type {
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
      weekendMode: normalizeReviewWeekendMode(preference.weekendMode),
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
