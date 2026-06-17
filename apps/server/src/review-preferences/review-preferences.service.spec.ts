import { PrismaService } from '../database/prisma.service';
import { ReviewPreferencesService } from './review-preferences.service';

describe('ReviewPreferencesService', () => {
  const updatedAt = new Date('2026-06-17T12:00:00.000Z');
  const defaultResponse = {
    dailyMinutes: 25,
    dailyCardLimit: 12,
    preferredReviewTime: '20:30',
    reminderEnabled: true,
    reminderLeadMinutes: 30,
    weekendMode: 'same' as const,
    planWindowDays: 7,
    updatedAt: new Date(0).toISOString(),
  };
  const row = {
    id: 'pref_1',
    userId: 'user_1',
    dailyMinutes: 40,
    dailyCardLimit: 16,
    preferredReviewTime: '19:00',
    reminderEnabled: false,
    reminderLeadMinutes: 10,
    weekendMode: 'lighter',
    planWindowDays: 10,
    createdAt: updatedAt,
    updatedAt,
  };
  const prisma = {
    reviewPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createService() {
    return new ReviewPreferencesService(prisma as unknown as PrismaService);
  }

  it('returns default preferences when the user has no row yet', async () => {
    prisma.reviewPreference.findUnique.mockResolvedValue(null);

    const result = await createService().getByUserId('user_1');

    expect(prisma.reviewPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
    });
    expect(result).toEqual(defaultResponse);
  });

  it('patches only provided fields and preserves the rest', async () => {
    prisma.reviewPreference.upsert.mockResolvedValue({
      ...row,
      dailyMinutes: 35,
      reminderEnabled: true,
    });

    const result = await createService().patch('user_1', {
      dailyMinutes: 35,
      reminderEnabled: true,
    });

    expect(prisma.reviewPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      update: {
        dailyMinutes: 35,
        reminderEnabled: true,
      },
      create: {
        userId: 'user_1',
        dailyMinutes: 35,
        dailyCardLimit: 12,
        preferredReviewTime: '20:30',
        reminderEnabled: true,
        reminderLeadMinutes: 30,
        weekendMode: 'same',
        planWindowDays: 7,
      },
    });
    expect(result).toEqual({
      dailyMinutes: 35,
      dailyCardLimit: 16,
      preferredReviewTime: '19:00',
      reminderEnabled: true,
      reminderLeadMinutes: 10,
      weekendMode: 'lighter',
      planWindowDays: 10,
      updatedAt: updatedAt.toISOString(),
    });
  });

  it('upserts by userId so each user has one preference row', async () => {
    prisma.reviewPreference.upsert.mockResolvedValue(row);

    await createService().patch('user_2', {
      preferredReviewTime: '21:15',
    });

    expect(prisma.reviewPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_2' },
      update: {
        preferredReviewTime: '21:15',
      },
      create: {
        userId: 'user_2',
        dailyMinutes: 25,
        dailyCardLimit: 12,
        preferredReviewTime: '21:15',
        reminderEnabled: true,
        reminderLeadMinutes: 30,
        weekendMode: 'same',
        planWindowDays: 7,
      },
    });
  });

  it('normalizes invalid persisted weekendMode to same', async () => {
    prisma.reviewPreference.findUnique.mockResolvedValue({
      ...row,
      weekendMode: 'invalid',
    });

    const result = await createService().getByUserId('user_1');

    expect(result.weekendMode).toBe('same');
  });
});
