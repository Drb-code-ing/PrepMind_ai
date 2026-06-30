import { z } from 'zod';

export const ragSafetyRiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const ragSafetyCategorySchema = z.enum([
  'instruction_override',
  'secret_exfiltration',
  'tool_or_data_write',
  'deception_or_hidden_behavior',
  'identity_or_policy_claim',
]);

export const ragSafetyClassificationSchema = z.object({
  riskLevel: ragSafetyRiskLevelSchema,
  categories: z.array(ragSafetyCategorySchema),
  matchedPatterns: z.array(z.string().min(1)).max(20),
  safeForPrompt: z.boolean(),
});

export type RagSafetyRiskLevel = z.infer<typeof ragSafetyRiskLevelSchema>;
export type RagSafetyCategory = z.infer<typeof ragSafetyCategorySchema>;
export type RagSafetyClassification = z.infer<
  typeof ragSafetyClassificationSchema
>;
