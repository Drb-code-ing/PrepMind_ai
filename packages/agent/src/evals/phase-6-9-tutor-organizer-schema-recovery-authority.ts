import { z } from 'zod';

import {
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
  PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import {
  PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256,
  PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
  PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
  computePhase697FullGateCanonicalSha256,
} from './phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION,
  TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
} from '../model-candidates/tutor-schema-recovery-contract.ts';
import { TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION } from '../model-candidates/tutor-schema-recovery-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
} from '../model-candidates/wrong-question-organizer-v9-option-authority.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE =
  'phase-6.9.7-tutor-organizer-full-gate-schema-recovery-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-source-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-source-manifest-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_CONTROLLED_BRANCH =
  'codex/phase-6-9-7-tutor-wrong-question-agents' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_APPROVED_SOURCE_REF =
  'refs/tags/phase-6-9-7-tutor-organizer-schema-recovery-sr4-approved' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_APPROVAL_IDENTITY =
  'phase-6.9.7-tutor-organizer-schema-recovery-sr5-approval-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_CONFIRMATION_STATUS = 'not_frozen_before_sr5' as const;

export const PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST = deepFreeze({
  manifestVersion: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_VERSION,
  lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
  baseManifestVersion: PHASE_6_9_7_FULL_GATE_MANIFEST_VERSION,
  baseManifestSha256: PHASE_6_9_7_FULL_GATE_FROZEN_MANIFEST_SHA256,
  sourceDatasetVersion: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_VERSION,
  sourceDatasetSha256: PHASE_6_9_7_FULL_GATE_SOURCE_DATASET_SHA256,
  evalPolicyVersion: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_VERSION,
  evalPolicySha256: PHASE_6_9_7_FULL_GATE_EVAL_POLICY_SHA256,
  baseSourceHashes: PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
  tutorRecoveryContractVersion: TUTOR_SCHEMA_RECOVERY_CONTRACT_VERSION,
  tutorRecoveryContractSha256: TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  tutorRecoveryDiagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  tutorRecoveryCandidateVersion: TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION,
  organizerOptionAuthorityVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
  organizerOptionAuthorityRulesSha256:
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256,
  approvalIdentity: PHASE_6_9_7_SCHEMA_RECOVERY_APPROVAL_IDENTITY,
  futureConfirmationStatus: PHASE_6_9_7_SCHEMA_RECOVERY_CONFIRMATION_STATUS,
});

export const PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256 =
  computePhase697FullGateCanonicalSha256(PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST);

const COMMIT = z.string().regex(/^[0-9a-f]{40}$/u);

export const PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_SCHEMA = z
  .object({
    sourceVersion: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_VERSION),
    lineage: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE),
    branch: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_CONTROLLED_BRANCH),
    commit: COMMIT,
    trackingCommit: COMMIT,
    remoteCommit: COMMIT,
    approvedRunnableSourceRef: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_APPROVED_SOURCE_REF),
    approvedRunnableSourceCommit: COMMIT,
    trackedWorktreeClean: z.boolean(),
    formalArtifactCount: z.number().int().safe().nonnegative(),
    sourceManifestSha256: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.commit !== value.trackingCommit ||
      value.commit !== value.remoteCommit ||
      value.commit !== value.approvedRunnableSourceCommit
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_commit_parity_mismatch' });
    }
    if (!value.trackedWorktreeClean) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_worktree_not_clean' });
    }
    if (value.formalArtifactCount !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'source_formal_artifact_exists' });
    }
  });

export type Phase697SchemaRecoverySource = z.infer<
  typeof PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_SCHEMA
>;

/** Synthetic-only source for zero-provider SR3/SR4 tests. It is not an approved tag claim. */
export function createPhase697SchemaRecoverySyntheticSourceForTest(
  commit = 'a'.repeat(40),
): Phase697SchemaRecoverySource {
  return PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_SCHEMA.parse({
    sourceVersion: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_VERSION,
    lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
    branch: PHASE_6_9_7_SCHEMA_RECOVERY_CONTROLLED_BRANCH,
    commit,
    trackingCommit: commit,
    remoteCommit: commit,
    approvedRunnableSourceRef: PHASE_6_9_7_SCHEMA_RECOVERY_APPROVED_SOURCE_REF,
    approvedRunnableSourceCommit: commit,
    trackedWorktreeClean: true,
    formalArtifactCount: 0,
    sourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
  });
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
