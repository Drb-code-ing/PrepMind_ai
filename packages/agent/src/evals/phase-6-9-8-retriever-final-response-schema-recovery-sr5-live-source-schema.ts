import { z } from 'zod';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
} from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr4-reviewed-mock.ts';
import { PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256 } from './phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-manifest.ts';

/** Independent source identity for the versioned controlled-Live tag. */
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v1' as const;
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA_VERSION =
  'phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-source-v2' as const;

const SHA256_REF = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);
const SAFE_PATH = z.string().regex(/^[a-zA-Z0-9_./-]{1,240}$/u);

/**
 * This schema deliberately does not reuse the historical SR5 source schema:
 * the approved tag and source-manifest binding are different identities.
 */
export const PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA = z
  .object({
    schemaVersion: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA_VERSION),
    lineage: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE),
    mode: z.literal('controlled_live'),
    branch: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH),
    head: COMMIT,
    upstream: COMMIT,
    origin: COMMIT,
    approvedTag: z
      .object({
        name: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG),
        ref: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF),
        commit: COMMIT,
        objectId: COMMIT,
        objectKind: z.literal('tag'),
      })
      .strict(),
    clean: z.literal(true),
    formalEvidencePaths: z.array(SAFE_PATH).length(0),
    oldLineagePaths: z.array(SAFE_PATH).length(0),
    sourceBundleSha256: SHA256_REF,
    admissionManifestSha256: z.literal(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
    ),
    historicalAdmissionManifestSha256: z.literal(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    ),
    identities: z
      .object({
        sr3ManifestSha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256),
        sr3PolicySha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256),
        sr4FactorySha256: z.literal(
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
        ),
        sr4CheckpointSha256: z.literal(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256),
      })
      .strict(),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.head !== source.upstream || source.head !== source.origin) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_parity_invalid' });
    }
    if (source.approvedTag.commit !== source.head) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'approved_tag_mismatch' });
    }
  });

export type Phase698RetrieverSchemaRecoverySr5LiveSource = z.infer<
  typeof PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA
>;

export function createPhase698RetrieverSchemaRecoverySr5LiveSyntheticSourceFixture(
  commit = '0'.repeat(40),
  sourceBundleSha256 = `sha256:${'0'.repeat(64)}`,
  approvedTagObjectId = 'b'.repeat(40),
): Phase698RetrieverSchemaRecoverySr5LiveSource {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA.parse({
    schemaVersion: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_SCHEMA_VERSION,
    lineage: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_LINEAGE,
    mode: 'controlled_live',
    branch: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_BRANCH,
    head: commit,
    upstream: commit,
    origin: commit,
    approvedTag: {
      name: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
      ref: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
      commit,
      objectId: approvedTagObjectId,
      objectKind: 'tag',
    },
    clean: true,
    formalEvidencePaths: [],
    oldLineagePaths: [],
    sourceBundleSha256,
    admissionManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
    historicalAdmissionManifestSha256:
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    identities: {
      sr3ManifestSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST_SHA256,
      sr3PolicySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY_SHA256,
      sr4FactorySha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_FROZEN_FACTORY_SHA256,
      sr4CheckpointSha256: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR4_CHECKPOINT_SHA256,
    },
  });
}
