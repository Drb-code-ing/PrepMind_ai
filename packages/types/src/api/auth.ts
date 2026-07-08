import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(['STUDENT', 'ADMIN']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(50).optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const authResponseSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
});

export const updateMeRequestSchema = z.object({
  name: z.string().min(1).max(50).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;
