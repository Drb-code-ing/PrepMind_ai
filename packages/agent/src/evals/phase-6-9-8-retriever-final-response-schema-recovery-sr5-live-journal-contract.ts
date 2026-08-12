import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-contract.ts';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-journal-record-v1' as const;

const UUID = z.string().uuid();
const SHA256 = z.string().regex(/^[0-9a-f]{64}$/u);
const DATETIME = z.string().datetime({ offset: true });
const RECORD_BASE = {
  recordVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_VERSION),
  lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
  runId: UUID,
  sequence: z.number().int().positive(),
  recordedAt: DATETIME,
  markerSha256: SHA256,
  previousHash: SHA256.nullable(),
  recordHash: SHA256,
} as const;

const IDENTITY_SCHEMA = z
  .object({
    callId: z.string().min(1).max(128),
    caseId: z.string().min(1).max(64),
    phase: z.enum([
      'rewrite_original_retrieval',
      'rewrite_candidate_model',
      'rewrite_candidate_retrieval',
      'final_response_model',
    ]),
    provider: z.enum(['deepseek', 'qwen']),
    model: z.enum(['deepseek-v4-pro', 'text-embedding-v4']),
    priceProfile: z.enum([
      'deepseek-v4-pro-cny-2026-07-15',
      'qwen-text-embedding-v4-cn-beijing-cny-2026-08-05',
    ]),
  })
  .strict();

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_SCHEMA =
  z.discriminatedUnion('event', [
    z.object({ ...RECORD_BASE, event: z.literal('attempt_reserved') }).strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('guard_terminal'),
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_GUARD_ENTRY_SCHEMA,
      })
      .strict(),
    z
      .object({ ...RECORD_BASE, event: z.literal('call_reserved'), identity: IDENTITY_SCHEMA })
      .strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('wire_stage'),
        identity: IDENTITY_SCHEMA,
        stage: z.enum(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_WIRE_STAGES),
        preparedSuccess:
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA.nullable(),
      })
      .strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('call_terminal'),
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_CALL_ENTRY_SCHEMA,
      })
      .strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('rewrite_terminal'),
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REWRITE_ENTRY_SCHEMA,
      })
      .strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('final_terminal'),
        entry: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_FINAL_ENTRY_SCHEMA,
      })
      .strict(),
    z
      .object({ ...RECORD_BASE, event: z.literal('recovery_claimed'), claimSha256: SHA256 })
      .strict(),
    z
      .object({
        ...RECORD_BASE,
        event: z.literal('run_terminal'),
        report: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_REPORT_SCHEMA,
        reportLogicalSha256: SHA256,
        completionMode: z.enum(['runtime', 'recovery']),
      })
      .strict(),
    z.object({ ...RECORD_BASE, event: z.literal('publication_started') }).strict(),
    z
      .object({ ...RECORD_BASE, event: z.literal('evidence_published'), evidenceSha256: SHA256 })
      .strict(),
  ]);

export type Phase698RetrieverSchemaRecoverySr5LiveJournalRecord = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_JOURNAL_RECORD_SCHEMA
>;
