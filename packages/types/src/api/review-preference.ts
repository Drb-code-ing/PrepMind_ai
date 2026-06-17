import { z } from 'zod';

export const reviewWeekendModeSchema = z.enum(['same', 'lighter', 'off']);
export const reviewPlanWindowDaysSchema = z.union([z.literal(7), z.literal(14)]);

export const reviewPreferenceSchema = z.object({
  dailyMinutes: z.number().int().min(5).max(240),
  dailyCardLimit: z.number().int().min(1).max(200),
  preferredReviewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reminderEnabled: z.boolean(),
  reminderLeadMinutes: z.number().int().min(0).max(720),
  weekendMode: reviewWeekendModeSchema,
  planWindowDays: reviewPlanWindowDaysSchema,
  updatedAt: z.string().datetime(),
});

export const reviewPreferencePatchSchema = z
  .object({
    dailyMinutes: z.number().int().min(5).max(240).optional(),
    dailyCardLimit: z.number().int().min(1).max(200).optional(),
    preferredReviewTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    reminderEnabled: z.boolean().optional(),
    reminderLeadMinutes: z.number().int().min(0).max(720).optional(),
    weekendMode: reviewWeekendModeSchema.optional(),
    planWindowDays: reviewPlanWindowDaysSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one preference field is required');

export type ReviewWeekendMode = z.infer<typeof reviewWeekendModeSchema>;
export type ReviewPlanWindowDays = z.infer<typeof reviewPlanWindowDaysSchema>;
export type ReviewPreferenceResponse = z.infer<typeof reviewPreferenceSchema>;
export type ReviewPreferencePatchRequest = z.infer<typeof reviewPreferencePatchSchema>;
