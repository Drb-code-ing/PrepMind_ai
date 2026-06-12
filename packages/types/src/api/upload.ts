import { z } from 'zod';

export const uploadImagePurposeSchema = z.enum(['ocr', 'wrong-question', 'profile']);

export const uploadImageMimeTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);

export const uploadImageResponseSchema = z.object({
  objectKey: z.string().min(1).max(512),
  imageUrl: z.string().url().max(2_048),
  mimeType: uploadImageMimeTypeSchema,
  size: z.number().int().positive(),
});

export const uploadImageFormSchema = z.object({
  purpose: uploadImagePurposeSchema.default('ocr'),
  groupId: z.string().min(1).max(100).optional(),
});

export type UploadImagePurpose = z.infer<typeof uploadImagePurposeSchema>;
export type UploadImageMimeType = z.infer<typeof uploadImageMimeTypeSchema>;
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;
export type UploadImageForm = z.infer<typeof uploadImageFormSchema>;
