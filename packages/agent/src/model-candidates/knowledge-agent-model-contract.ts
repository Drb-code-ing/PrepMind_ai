import { z } from 'zod';

export const KNOWLEDGE_DEDUP_RELATIONS = [
  'semantic_duplicate',
  'possible_revision',
  'complementary',
  'unrelated',
] as const;

export const KNOWLEDGE_DEDUP_EVIDENCE_CODES = [
  'semantic_overlap',
  'same_scope',
  'version_signal',
  'newer_timestamp',
  'different_purpose',
  'complementary_coverage',
  'insufficient_version_evidence',
] as const;

const KNOWLEDGE_DEDUP_DECISION_SCHEMA = z
  .object({
    pairIndex: z.number().int().min(0).max(11),
    relation: z.enum(KNOWLEDGE_DEDUP_RELATIONS),
    confidence: z.enum(['medium', 'high']),
    evidenceCodes: z
      .array(z.enum(KNOWLEDGE_DEDUP_EVIDENCE_CODES))
      .min(1)
      .max(4)
      .superRefine((codes, context) => {
        if (new Set(codes).size !== codes.length) {
          context.addIssue({ code: 'custom', message: 'duplicate evidence code' });
        }
      }),
  })
  .strict();

export const KNOWLEDGE_DEDUP_MODEL_SCHEMA = z
  .object({
    decisions: z.array(KNOWLEDGE_DEDUP_DECISION_SCHEMA).max(12),
  })
  .strict();

const SAFE_LABEL_PATTERN = /^[\p{L}\p{N} ·()（）_-]+$/u;
const TOPIC_LABEL_SCHEMA = z.string().min(2).max(12).regex(SAFE_LABEL_PATTERN);
const COLLECTION_NAME_SCHEMA = z.string().min(2).max(20).regex(SAFE_LABEL_PATTERN);

const KNOWLEDGE_ORGANIZER_TAG_SCHEMA = z
  .object({
    documentIndex: z.number().int().min(0).max(19),
    subject: z.enum(['math', 'english', 'politics', 'computer', 'major', 'other']),
    resourceType: z.enum([
      'lecture',
      'notes',
      'past_exam',
      'mistakes',
      'practice',
      'reference',
      'other',
    ]),
    topicLabels: z
      .array(TOPIC_LABEL_SCHEMA)
      .max(2)
      .superRefine((labels, context) => {
        if (new Set(labels).size !== labels.length) {
          context.addIssue({ code: 'custom', message: 'duplicate topic label' });
        }
      }),
  })
  .strict();

const KNOWLEDGE_ORGANIZER_COLLECTION_SCHEMA = z
  .object({
    memberIndexes: z.array(z.number().int().min(0).max(19)).min(2).max(8),
    name: COLLECTION_NAME_SCHEMA,
    theme: z.enum(['subject', 'exam', 'topic', 'project']),
  })
  .strict();

export const KNOWLEDGE_ORGANIZER_MODEL_SCHEMA = z
  .object({
    tags: z.array(KNOWLEDGE_ORGANIZER_TAG_SCHEMA).max(20),
    collections: z.array(KNOWLEDGE_ORGANIZER_COLLECTION_SCHEMA).max(5),
  })
  .strict();

export type KnowledgeDedupModelDecision = z.infer<typeof KNOWLEDGE_DEDUP_MODEL_SCHEMA>;
export type KnowledgeOrganizerModelDecision = z.infer<
  typeof KNOWLEDGE_ORGANIZER_MODEL_SCHEMA
>;

export type KnowledgeDedupDecisionValidationResult =
  | { ok: true; value: KnowledgeDedupModelDecision }
  | {
      ok: false;
      reasonCode:
        | 'schema_invalid'
        | 'duplicate_pair_index'
        | 'pair_index_out_of_range'
        | 'invalid_evidence_association';
    };

export type KnowledgeOrganizerDecisionValidationResult =
  | { ok: true; value: KnowledgeOrganizerModelDecision }
  | {
      ok: false;
      reasonCode:
        | 'schema_invalid'
        | 'duplicate_document_index'
        | 'document_index_out_of_range'
        | 'collection_member_out_of_range'
        | 'collection_members_not_sorted_unique';
    };

export function validateKnowledgeDedupModelDecision(
  input: unknown,
  pairCount: number,
): KnowledgeDedupDecisionValidationResult {
  if (!Number.isSafeInteger(pairCount) || pairCount < 0 || pairCount > 12) {
    return { ok: false, reasonCode: 'pair_index_out_of_range' };
  }

  const parsed = KNOWLEDGE_DEDUP_MODEL_SCHEMA.safeParse(input);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const seen = new Set<number>();
  for (const decision of parsed.data.decisions) {
    if (decision.pairIndex >= pairCount) {
      return { ok: false, reasonCode: 'pair_index_out_of_range' };
    }
    if (seen.has(decision.pairIndex)) {
      return { ok: false, reasonCode: 'duplicate_pair_index' };
    }
    seen.add(decision.pairIndex);
    if (!evidenceMatchesRelation(decision.relation, decision.evidenceCodes)) {
      return { ok: false, reasonCode: 'invalid_evidence_association' };
    }
  }

  return { ok: true, value: parsed.data };
}

export function validateKnowledgeOrganizerModelDecision(
  input: unknown,
  documentCount: number,
): KnowledgeOrganizerDecisionValidationResult {
  if (!Number.isSafeInteger(documentCount) || documentCount < 0 || documentCount > 20) {
    return { ok: false, reasonCode: 'document_index_out_of_range' };
  }

  const parsed = KNOWLEDGE_ORGANIZER_MODEL_SCHEMA.safeParse(input);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const taggedDocuments = new Set<number>();
  for (const tag of parsed.data.tags) {
    if (tag.documentIndex >= documentCount) {
      return { ok: false, reasonCode: 'document_index_out_of_range' };
    }
    if (taggedDocuments.has(tag.documentIndex)) {
      return { ok: false, reasonCode: 'duplicate_document_index' };
    }
    taggedDocuments.add(tag.documentIndex);
  }

  for (const collection of parsed.data.collections) {
    if (collection.memberIndexes.some((index) => index >= documentCount)) {
      return { ok: false, reasonCode: 'collection_member_out_of_range' };
    }
    if (!isStrictlyAscending(collection.memberIndexes)) {
      return { ok: false, reasonCode: 'collection_members_not_sorted_unique' };
    }
  }

  return { ok: true, value: parsed.data };
}

function evidenceMatchesRelation(
  relation: KnowledgeDedupModelDecision['decisions'][number]['relation'],
  evidenceCodes: KnowledgeDedupModelDecision['decisions'][number]['evidenceCodes'],
): boolean {
  const evidence = new Set(evidenceCodes);
  const allowedByRelation = {
    semantic_duplicate: new Set(['semantic_overlap', 'same_scope']),
    possible_revision: new Set([
      'semantic_overlap',
      'version_signal',
      'newer_timestamp',
      'insufficient_version_evidence',
    ]),
    complementary: new Set([
      'semantic_overlap',
      'different_purpose',
      'complementary_coverage',
    ]),
    unrelated: new Set(['different_purpose', 'insufficient_version_evidence']),
  } satisfies Record<typeof relation, ReadonlySet<string>>;

  if (evidenceCodes.some((code) => !allowedByRelation[relation].has(code))) return false;

  switch (relation) {
    case 'semantic_duplicate':
    case 'possible_revision':
      return evidence.has('semantic_overlap');
    case 'complementary':
      return evidence.has('different_purpose') || evidence.has('complementary_coverage');
    case 'unrelated':
      return evidence.has('different_purpose') || evidence.has('insufficient_version_evidence');
  }
}

function isStrictlyAscending(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1] >= values[index]) return false;
  }
  return true;
}
