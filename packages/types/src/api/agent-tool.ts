import { z } from 'zod';

export const agentToolErrorSchema = z.object({
  code: z.enum([
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
  ]),
  message: z.string().min(1),
  issues: z
    .array(
      z.object({
        path: z.string().min(1),
        message: z.string().min(1),
      }),
    )
    .optional(),
});

export const agentToolResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      toolName: z.string().min(1),
      data: z.record(z.unknown()),
      retryable: z.boolean(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      toolName: z.string().min(1),
      error: agentToolErrorSchema,
      retryable: z.boolean(),
    })
    .strict(),
]);

export type AgentToolError = z.infer<typeof agentToolErrorSchema>;
export type AgentToolResult = z.infer<typeof agentToolResultSchema>;
