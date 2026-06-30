import { z } from 'zod';

export const PROCESS_KNOWLEDGE_DOCUMENT_QUEUE = 'knowledge-document-processing';
export const PROCESS_KNOWLEDGE_DOCUMENT_JOB = 'process-document';

export const processKnowledgeDocumentJobPayloadSchema = z
  .object({
    backgroundJobId: z.string().min(1),
    userId: z.string().min(1),
    documentId: z.string().min(1),
    force: z.boolean().default(false),
    snapshot: z
      .object({
        storageKey: z.string().min(1),
        contentHash: z.string().nullable(),
      })
      .strict(),
    requestedAt: z.string().datetime(),
  })
  .strict();

export type ProcessKnowledgeDocumentJobPayload = z.infer<
  typeof processKnowledgeDocumentJobPayloadSchema
>;
