import { createHash } from 'node:crypto';

import { z } from 'zod';

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH = 'main' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG =
  'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v11-approved' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF =
  `refs/tags/${PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG}` as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v11' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256 =
  'sha256:f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256 =
  '73f0648549e02ec02de2907718d27b71fded2b76e91ac153e7df312a40951ef8' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V11_DEEPSEEK_AND_QWEN_DATA_BOUNDARY' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION =
  'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V11_CONTROLLED_LIVE_ONCE' as const;

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET = Object.freeze({
  maxCandidateInvocations: 12,
  maxInputTokens: 37_600,
  maxOutputTokens: 8_800,
  maxCostMicrosCny: 176_000,
  priceProfileSha256:
    'sha256:0120020c004d2ca4cecd3beaee6f9030d130d7799943ba36152eb314961ce18e' as const,
});

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET_SCHEMA = z
  .object({
    maxCandidateInvocations: z.literal(12),
    maxInputTokens: z.literal(37_600),
    maxOutputTokens: z.literal(8_800),
    maxCostMicrosCny: z.literal(176_000),
    priceProfileSha256: z.literal(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BUDGET.priceProfileSha256,
    ),
  })
  .strict();

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_SCHEMA = z
  .object({
    accepted: z.literal(true),
    confirmation: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION),
    providers: z.tuple([z.literal('deepseek'), z.literal('qwen')]),
    scope: z.literal('current_account'),
  })
  .strict();

export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST = Object.freeze({
  execution: Object.freeze({
    maximumConcurrency: 1,
    pairSerial: true,
    singleDispatchPerLane: true,
    retry: false,
    resume: false,
    replay: false,
    backfill: false,
    backgroundJob: false,
    outbox: false,
  }),
});

export function canonicalPhase698RetrieverSchemaRecoverySr5Json(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalPhase698RetrieverSchemaRecoverySr5Json(entry)).join(',')}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalPhase698RetrieverSchemaRecoverySr5Json(object[key])}`,
    )
    .join(',')}}`;
}

export function sha256Phase698RetrieverSchemaRecoverySr5(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
