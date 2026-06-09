import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const apiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    requestId: z.string().min(1),
  });

export const apiFailureSchema = z.object({
  success: z.literal(false),
  error: apiErrorSchema,
  requestId: z.string().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiFailure = z.infer<typeof apiFailureSchema>;
export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId: string;
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
