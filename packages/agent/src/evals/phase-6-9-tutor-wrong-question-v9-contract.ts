import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION,
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION as PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_FAILURE_CATEGORIES as PHASE_6_9_7_V9_WIRE_FAILURE_CATEGORIES,
  PHASE_6_9_7_V7_WIRE_STAGES as PHASE_6_9_7_V9_WIRE_STAGES,
  type Phase697V7WireSnapshot as Phase697V9WireSnapshot,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
} from './phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA,
  PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V6_EXECUTION_OUTCOMES,
  PHASE_6_9_7_V6_FAILURE_CATEGORIES,
  PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA,
  PHASE_6_9_7_V6_RUNTIME_DURATION_EVIDENCE_SCHEMA,
  PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
  PHASE_6_9_7_V6_USAGE_DISPOSITIONS,
  phase697V6IdentitySnapshot,
  type Phase697TutorOrganizerV6Report,
  type Phase697V6CaseEntry,
} from './phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  PHASE_6_9_7_V6_EVAL_POLICY,
  PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
} from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import { buildPhase697TutorOrganizerV6Report } from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import { MODEL_CANDIDATE_DISPOSITIONS } from '../model-candidates/model-candidate-policy.ts';
import { clonePlainEvidenceData } from '../model-candidates/model-projection-safety.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
} from '../model-candidates/wrong-question-organizer-v9-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
} from '../model-candidates/wrong-question-organizer-v9-option-authority.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_REASONS,
  WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
  type WrongQuestionOrganizerV9BoundedSchemaDiagnostic,
} from '../model-candidates/wrong-question-organizer-v9-schema-diagnostic.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9 =
  'phase-6.9.7-tutor-organizer-runner-v9' as const;
export const PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION =
  'phase-6.9.7-v9-runtime-evidence-v1' as const;
export const PHASE_6_9_7_V9_MARKER_VERSION = 'phase-6.9.7-v9-live-marker-v1' as const;
export const PHASE_6_9_7_V9_JOURNAL_VERSION = 'phase-6.9.7-v9-journal-v1' as const;
export const PHASE_6_9_7_V9_EVIDENCE_VERSION = 'phase-6.9.7-v9-evidence-envelope-v1' as const;
export const PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION = 'phase-6.9.7-v9-recovery-claim-v1' as const;
export const PHASE_6_9_7_V9_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v9' as const;
export const PHASE_6_9_7_V9_APPROVAL_ENV = 'PHASE_6_9_7_V9_CONTROLLED_LIVE_APPROVED' as const;
export const PHASE_6_9_7_V9_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V9_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_V9_MARKER_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live.marker' as const;
export const PHASE_6_9_7_V9_RECOVERY_CLAIM_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live.recovery.claim' as const;
export const PHASE_6_9_7_V9_EVAL_POLICY_VERSION = 'phase-6.9.7-v9-eval-policy-v1' as const;
export const PHASE_6_9_7_V9_SOURCE_MANIFEST_VERSION = 'phase-6.9.7-v9-source-manifest-v1' as const;
export const PHASE_6_9_7_V9_SELECTION_CONTRACT_VERSION =
  'phase-6.9.7-v9-selection-contract-v1' as const;
export const PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_VERSION =
  'phase-6.9.7-v9-runner-runtime-contract-v1' as const;
export const PHASE_6_9_7_V9_WIRE_ALIAS_VERSION = 'phase-6.9.7-v9-wire-alias-v1' as const;
export const PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION =
  'phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1' as const;
export const PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256 =
  'sha256:0870799257dcd2b88841b286b9cc64e6410702fe2bcbe86c6e153d8af88a4200' as const;

export const PHASE_6_9_7_V9_EVAL_POLICY = deepFreeze({
  version: PHASE_6_9_7_V9_EVAL_POLICY_VERSION,
  inheritedPolicyVersion: PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
  inheritedPolicySha256: PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
  policy: PHASE_6_9_7_V6_EVAL_POLICY,
  wire: {
    executorInvocations: 48,
    providerDispatches: 48,
    providerResponses: 48,
    verifiedUsages: 48,
    successStages: PHASE_6_9_7_V9_WIRE_STAGES,
  },
  incompleteFormalAggregates: 'null',
  retry: false,
});

export const PHASE_6_9_7_V9_EVAL_POLICY_SHA256 = sha256Stable(PHASE_6_9_7_V9_EVAL_POLICY);

export const PHASE_6_9_7_V9_SEMANTIC_AUTHORITY_SHA256 = sha256Stable(phase697V6IdentitySnapshot());

export const PHASE_6_9_7_V9_SELECTION_CONTRACT = deepFreeze({
  version: PHASE_6_9_7_V9_SELECTION_CONTRACT_VERSION,
  schema: '{decisions:[{questionIndex,optionIndex}]}',
  topLevelKeys: ['decisions'],
  decisionKeys: ['questionIndex', 'optionIndex'],
  questionIndex: { type: 'safe_integer', min: 0, max: 11 },
  optionIndex: { type: 'safe_integer', min: 0, max: 23 },
  decisions: { min: 1, max: 12, completeCoverage: true, duplicateQuestionIndex: false },
  strictJsonContent: true,
  coercion: false,
  repair: false,
  schemaIdentity: 'WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA',
});

export const PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256 = sha256Stable(
  PHASE_6_9_7_V9_SELECTION_CONTRACT,
);

export const PHASE_6_9_7_V9_WIRE_ALIAS = deepFreeze({
  version: PHASE_6_9_7_V9_WIRE_ALIAS_VERSION,
  capabilityVersion: PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION,
  diagnosticsVersion: PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
  stages: PHASE_6_9_7_V9_WIRE_STAGES,
  ownership: 'inherited_v7_ai_wire_protocol',
  newAiWireExport: false,
});

export const PHASE_6_9_7_V9_WIRE_ALIAS_SHA256 = sha256Stable(PHASE_6_9_7_V9_WIRE_ALIAS);

export const PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT = deepFreeze({
  version: PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_VERSION,
  denominators: {
    cases: 72,
    zeroCallCases: 24,
    runtimeCases: 48,
    pairedRequests: 24,
    organizerDecisionUnits: 32,
  },
  scheduler: {
    guardFirst: true,
    pairSerial: true,
    lanesPerPair: 2,
    singleDispatch: true,
    retry: false,
    firstRuntimeContractFailureBreaker: true,
  },
  durability: {
    laneReservedBeforeExecutor: true,
    appendAndFsync: true,
    runtimeTerminalPerNormalReservation: 1,
    orphanRecovery: 'zero_provider_seal_only',
    evidencePublish: 'fsync_temp_then_hard_link',
  },
  incompleteFormalAggregates: 'null',
  wireAliasSha256: PHASE_6_9_7_V9_WIRE_ALIAS_SHA256,
});

export const PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256 = sha256Stable(
  PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT,
);

export const PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT = deepFreeze({
  version: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
  reasons: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_REASONS,
  rawDataRetained: false,
  fields: [
    'version',
    'reason',
    'topLevelShape',
    'missingRequiredFieldCount',
    'unexpectedFieldCount',
    'invalidFieldTypeCount',
    'decisionCountBucket',
    'shapeFingerprint',
    'rawDataRetained',
  ],
});

export const PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256 = sha256Stable(
  PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT,
);

export const PHASE_6_9_7_V9_SOURCE_MANIFEST = deepFreeze({
  version: PHASE_6_9_7_V9_SOURCE_MANIFEST_VERSION,
  runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
  runtimeEvidenceVersion: PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION,
  adapterVersion: FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
  wireDiagnosticsVersion: PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
  datasetBindingVersion: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
  datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  evalPolicyVersion: PHASE_6_9_7_V9_EVAL_POLICY_VERSION,
  evalPolicySha256: PHASE_6_9_7_V9_EVAL_POLICY_SHA256,
  runnerRuntimeContractVersion: PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_VERSION,
  runnerRuntimeContractSha256: PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256,
  wireAliasVersion: PHASE_6_9_7_V9_WIRE_ALIAS_VERSION,
  wireAliasSha256: PHASE_6_9_7_V9_WIRE_ALIAS_SHA256,
  organizerPromptVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  organizerPromptSha256: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256,
  organizerProjectionVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
  organizerSelectionContractVersion: PHASE_6_9_7_V9_SELECTION_CONTRACT_VERSION,
  organizerSelectionContractSha256: PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256,
  organizerOptionAuthorityVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
  organizerOptionRulesVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
  organizerOptionRulesSha256: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
  organizerInputEstimatorVersion: WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION,
  organizerInputEstimatorSha256: WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256,
  boundedSchemaDiagnosticVersion: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
  boundedSchemaDiagnosticSha256: PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256,
  robustnessFixtureVersion: PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION,
  robustnessFixtureSha256: PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256,
  markerVersion: PHASE_6_9_7_V9_MARKER_VERSION,
  journalVersion: PHASE_6_9_7_V9_JOURNAL_VERSION,
  evidenceVersion: PHASE_6_9_7_V9_EVIDENCE_VERSION,
  recoveryClaimVersion: PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION,
  semanticAuthority: phase697V6IdentitySnapshot(),
});

if (
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256 ||
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256 ||
  WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_OPTION_AUTHORITY_RULES_SHA256
) {
  throw new Error('PHASE_6_9_7_V9_SOURCE_IDENTITY_DRIFT');
}

export const PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256 = sha256Stable(PHASE_6_9_7_V9_SOURCE_MANIFEST);

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);
const nonNegativeFinite = z.number().finite().nonnegative();
const v6ReportShape = PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.innerType().shape;

const tutorSemanticAxesSchema = z
  .object({
    agent: z.literal('tutor'),
    intent: z.boolean(),
    depth: z.boolean(),
    contextUse: z.boolean(),
    guidingPolicy: z.boolean(),
    finalAnswerBoundary: z.boolean(),
    answerStructure: z.boolean(),
  })
  .strict();

const organizerSemanticAxesSchema = z
  .object({
    agent: z.literal('wrong_question_organizer'),
    decisionUnits: z.number().int().min(1).max(12),
    subject: z.boolean(),
    deck: z.boolean(),
    topic: z.boolean(),
    confidence: z.boolean(),
  })
  .strict();

const usageSchema = z
  .object({
    inputTokens: z.number().int().safe().nonnegative(),
    outputTokens: z.number().int().safe().nonnegative(),
    estimatedCostCny: nonNegativeFinite,
  })
  .strict();

const safetySchema = z
  .object({
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
  })
  .strict();

export const PHASE_6_9_7_V9_WIRE_SNAPSHOT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION),
    state: z.enum(['active', 'succeeded', 'failed']),
    stages: z.array(z.enum(PHASE_6_9_7_V9_WIRE_STAGES)).max(PHASE_6_9_7_V9_WIRE_STAGES.length),
    lastCompletedStage: z.enum(PHASE_6_9_7_V9_WIRE_STAGES).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V9_WIRE_FAILURE_CATEGORIES).nullable(),
    usageDisposition: z.enum(['not_observed', 'invalid', 'verified']),
    counters: z
      .object({
        executorInvocations: z.union([z.literal(0), z.literal(1)]),
        providerDispatches: z.union([z.literal(0), z.literal(1)]),
        providerResponses: z.union([z.literal(0), z.literal(1)]),
        verifiedUsages: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const expectedPrefix = PHASE_6_9_7_V9_WIRE_STAGES.slice(0, value.stages.length);
    if (JSON.stringify(value.stages) !== JSON.stringify(expectedPrefix)) {
      issue('V9 wire stage prefix mismatch');
    }
    if (value.lastCompletedStage !== (value.stages.at(-1) ?? null)) {
      issue('V9 wire last stage mismatch');
    }
    const expectedCounters = wireCountersForStages(value.stages);
    if (JSON.stringify(value.counters) !== JSON.stringify(expectedCounters)) {
      issue('V9 wire counter mismatch');
    }
    if (
      (value.state === 'failed') !== (value.failureCategory !== null) ||
      (value.state === 'succeeded' &&
        (value.stages.length !== PHASE_6_9_7_V9_WIRE_STAGES.length ||
          value.usageDisposition !== 'verified')) ||
      (value.usageDisposition === 'verified') !== (value.counters.verifiedUsages === 1) ||
      (value.usageDisposition === 'invalid' && value.failureCategory !== 'usage_validation')
    ) {
      issue('V9 wire terminal mismatch');
    }
  });

export const PHASE_6_9_7_V9_WIRE_EVIDENCE_SCHEMA = z.discriminatedUnion('disposition', [
  z.object({ disposition: z.literal('not_observed'), snapshot: z.null() }).strict(),
  z.object({ disposition: z.literal('missing_after_attempt'), snapshot: z.null() }).strict(),
  z
    .object({
      disposition: z.literal('observed'),
      snapshot: PHASE_6_9_7_V9_WIRE_SNAPSHOT_SCHEMA,
    })
    .strict(),
]);

export type Phase697V9WireEvidence = z.infer<typeof PHASE_6_9_7_V9_WIRE_EVIDENCE_SCHEMA>;

export const PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION),
    caseId: caseIdSchema,
    agent: agentSchema,
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: pairedRunIndexSchema.nullable(),
    executionOutcome: z.enum(PHASE_6_9_7_V6_EXECUTION_OUTCOMES),
    candidateDisposition: z.enum(MODEL_CANDIDATE_DISPOSITIONS).nullable(),
    failureCategory: z.enum(PHASE_6_9_7_V6_FAILURE_CATEGORIES),
    providerFailureCategory: z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).nullable(),
    structuredOutputStage: z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES).nullable(),
    strictRuntimeSuccess: z.boolean(),
    zeroCallVerified: z.boolean(),
    semanticAxes: z
      .discriminatedUnion('agent', [tutorSemanticAxesSchema, organizerSemanticAxesSchema])
      .nullable(),
    modelOwnedDecision: PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA.nullable(),
    durationEvidence: PHASE_6_9_7_V6_RUNTIME_DURATION_EVIDENCE_SCHEMA,
    latencyMs: nonNegativeFinite.nullable(),
    orchestrationLatencyMs: nonNegativeFinite.nullable(),
    usageDisposition: z.enum(PHASE_6_9_7_V6_USAGE_DISPOSITIONS),
    usage: usageSchema.nullable(),
    safety: safetySchema,
    wireEvidence: PHASE_6_9_7_V9_WIRE_EVIDENCE_SCHEMA,
    boundedSchemaDiagnostic:
      WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const v6Projection = projectPhase697V9EntryToV6Unchecked(value);
    if (!PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA.safeParse(v6Projection).success) {
      issue('V9 semantic entry projection mismatch');
    }
    const snapshot = value.wireEvidence.snapshot;
    const notStarted = value.executionOutcome.startsWith('not_started_');
    const missingAfterAttempt = value.wireEvidence.disposition === 'missing_after_attempt';
    if (
      (notStarted && value.wireEvidence.disposition !== 'not_observed') ||
      (value.zeroCallVerified && value.wireEvidence.disposition !== 'not_observed') ||
      (missingAfterAttempt &&
        (value.executionKind !== 'runtime' ||
          notStarted ||
          value.zeroCallVerified ||
          value.strictRuntimeSuccess ||
          value.usageDisposition === 'verified' ||
          ![
            'executed_failure',
            'attempted_aborted',
            'attempted_orphaned',
            'harness_internal_error',
          ].includes(value.executionOutcome))) ||
      (snapshot?.state === 'active' && value.executionOutcome !== 'attempted_orphaned') ||
      (snapshot?.state === 'failed' && value.strictRuntimeSuccess) ||
      (value.strictRuntimeSuccess &&
        (value.wireEvidence.disposition !== 'observed' ||
          snapshot?.state !== 'succeeded' ||
          !wireSnapshotIsCompleteSuccess(snapshot))) ||
      (value.usageDisposition === 'verified' &&
        (value.wireEvidence.disposition !== 'observed' || snapshot?.counters.verifiedUsages !== 1))
    ) {
      issue('V9 entry wire disposition mismatch');
    }
    const wireFailureCategory = snapshot?.state === 'failed' ? snapshot.failureCategory : null;
    if (wireFailureCategory !== null && value.providerFailureCategory !== null) {
      const projected = projectWireFailure(wireFailureCategory);
      if (
        projected.category !== value.providerFailureCategory ||
        (projected.structuredOutputStage ?? null) !== value.structuredOutputStage
      ) {
        issue('V9 entry provider failure projection mismatch');
      }
    }
    const diagnostic = value.boundedSchemaDiagnostic;
    const staticDiagnosticRequired =
      value.agent === 'wrong_question_organizer' &&
      value.executionKind === 'runtime' &&
      !notStarted &&
      !value.strictRuntimeSuccess &&
      value.candidateDisposition === 'fallback_schema_invalid' &&
      value.failureCategory === 'structured_output' &&
      value.structuredOutputStage === 'provider_type_validation';
    const dynamicDiagnosticRequired =
      value.agent === 'wrong_question_organizer' &&
      value.executionKind === 'runtime' &&
      !notStarted &&
      !value.strictRuntimeSuccess &&
      value.candidateDisposition === 'fallback_schema_invalid' &&
      (value.failureCategory === 'dynamic_contract' || value.failureCategory === 'local_merger');
    if ((staticDiagnosticRequired || dynamicDiagnosticRequired) && diagnostic === null) {
      issue('V9 required bounded schema diagnostic missing');
    }
    if (
      diagnostic !== null &&
      (value.agent !== 'wrong_question_organizer' ||
        value.executionKind !== 'runtime' ||
        notStarted ||
        value.zeroCallVerified ||
        value.strictRuntimeSuccess ||
        value.candidateDisposition !== 'fallback_schema_invalid' ||
        (!staticDiagnosticRequired && !dynamicDiagnosticRequired))
    ) {
      issue('V9 bounded schema diagnostic scope mismatch');
    }
    const selectionDiagnostic =
      diagnostic?.reason === 'selection_coverage' ||
      diagnostic?.reason === 'selection_authority' ||
      diagnostic?.reason === 'option_authority';
    if (staticDiagnosticRequired && diagnostic !== null && selectionDiagnostic) {
      issue('V9 static diagnostic stage mismatch');
    }
    if (
      dynamicDiagnosticRequired &&
      diagnostic !== null &&
      !selectionDiagnostic &&
      diagnostic.reason !== 'unknown'
    ) {
      issue('V9 dynamic diagnostic disposition mismatch');
    }
  });

export type Phase697V9CaseEntry = z.infer<typeof PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA>;

const identitiesSchema = z
  .object({
    sourceManifestVersion: z.literal(PHASE_6_9_7_V9_SOURCE_MANIFEST_VERSION),
    sourceManifestSha256: z.literal(PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256),
    adapterVersion: z.literal(FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION),
    wireDiagnosticsVersion: z.literal(PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION),
    datasetBindingVersion: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_VERSION),
    datasetBindingSha256: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_SHA256),
    datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicyVersion: z.literal(PHASE_6_9_7_V9_EVAL_POLICY_VERSION),
    evalPolicySha256: z.literal(PHASE_6_9_7_V9_EVAL_POLICY_SHA256),
    runnerRuntimeContractVersion: z.literal(PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_VERSION),
    runnerRuntimeContractSha256: z.literal(PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256),
    wireAliasVersion: z.literal(PHASE_6_9_7_V9_WIRE_ALIAS_VERSION),
    wireAliasSha256: z.literal(PHASE_6_9_7_V9_WIRE_ALIAS_SHA256),
    organizerPromptVersion: z.literal(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION),
    organizerPromptSha256: z.literal(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256),
    organizerProjectionVersion: z.literal(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION),
    organizerSelectionContractVersion: z.literal(PHASE_6_9_7_V9_SELECTION_CONTRACT_VERSION),
    organizerSelectionContractSha256: z.literal(PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256),
    organizerOptionAuthorityVersion: z.literal(
      WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
    ),
    organizerOptionRulesVersion: z.literal(
      WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
    ),
    organizerOptionRulesSha256: z.literal(
      WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
    ),
    organizerInputEstimatorVersion: z.literal(WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION),
    organizerInputEstimatorSha256: z.literal(WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256),
    boundedSchemaDiagnosticVersion: z.literal(
      WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
    ),
    boundedSchemaDiagnosticSha256: z.literal(PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256),
    robustnessFixtureVersion: z.literal(PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION),
    robustnessFixtureSha256: z.literal(PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256),
    semanticAuthoritySha256: z.literal(PHASE_6_9_7_V9_SEMANTIC_AUTHORITY_SHA256),
  })
  .strict();

const wireAggregateSchema = z
  .object({
    complete: z.boolean(),
    executorInvocations: z.number().int().min(0).max(48),
    providerDispatches: z.number().int().min(0).max(48),
    providerResponses: z.number().int().min(0).max(48),
    verifiedUsages: z.number().int().min(0).max(48),
  })
  .strict();

const usageAggregateSchema = z
  .object({
    complete: z.boolean(),
    executorInvocations: z.number().int().min(0).max(48),
    providerDispatches: z.number().int().min(0).max(48),
    providerResponses: z.number().int().min(0).max(48),
    verifiedUsages: z.number().int().min(0).max(48),
    verifiedRuntimeCases: z.number().int().min(0).max(48),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    estimatedCostCny: nonNegativeFinite.nullable(),
  })
  .strict();

const runtimeAccountingSchema = z
  .object({
    reservedEntries: z.number().int().min(0).max(48),
    terminalEntries: z.number().int().min(0).max(48),
    orphanedEntries: z.number().int().min(0).max(48),
    notStartedEntries: z.number().int().min(0).max(48),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.terminalEntries > value.reservedEntries ||
      value.orphanedEntries > value.reservedEntries ||
      value.terminalEntries + value.orphanedEntries !== value.reservedEntries ||
      value.reservedEntries + value.notStartedEntries !== 48
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V9 runtime accounting mismatch',
      });
    }
  });

export const PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA = z
  .object({
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9),
    identities: identitiesSchema,
    provider: z.enum(['mock', 'deepseek']),
    model: z.enum(['mock', 'deepseek-v4-pro']),
    structuredOutputMode: z.enum(['mock_json_v9', 'deepseek_v4_pro_direct_json']),
    executorProvenance: z.enum([
      'mock_synthetic',
      'first_party_deepseek_v4_pro_direct',
      'synthetic_test',
    ]),
    lanePolicy: v6ReportShape.lanePolicy,
    counts: v6ReportShape.counts,
    scheduler: v6ReportShape.scheduler,
    ledger: v6ReportShape.ledger,
    runtimeAccounting: runtimeAccountingSchema,
    pairedDurationEvidence: v6ReportShape.pairedDurationEvidence,
    pairedLatencySamplesMs: v6ReportShape.pairedLatencySamplesMs,
    caseEntries: z.array(PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA).length(72),
    wire: wireAggregateSchema,
    metrics: v6ReportShape.metrics,
    modelOwnedMetrics: v6ReportShape.modelOwnedMetrics,
    latency: v6ReportShape.latency,
    usage: usageAggregateSchema,
    safety: v6ReportShape.safety,
    gate: z.enum(['mock_quality_not_evidence', 'quality_gate_passed', 'quality_gate_failed']),
  })
  .strict()
  .superRefine((value, context) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const projected = projectPhase697V9ReportToV6(value);
    if (projected === null) {
      issue('V9 semantic report projection mismatch');
      return;
    }
    const expectedWire = aggregateWire(value.caseEntries);
    const formalComplete = formalAggregatesComplete(projected, value.caseEntries, expectedWire);
    const expectedMetrics = formalComplete
      ? projected.metrics
      : {
          complete: false,
          strictRuntimeSuccesses: projected.metrics.strictRuntimeSuccesses,
          tutorSemanticScore: null,
          organizerSemanticScore: null,
          combinedSemanticScore: null,
        };
    const expectedLatency = formalComplete
      ? projected.latency
      : {
          complete: false,
          tutorCandidateP95Ms: null,
          organizerCandidateP95Ms: null,
          pairedCandidateP95Ms: null,
          tutorOrchestrationP95Ms: null,
        };
    const expectedUsage = buildUsageAggregate(projected, expectedWire, formalComplete);
    const expectedRuntimeAccounting = buildRuntimeAccounting(projected, value.caseEntries);
    const expectedGate =
      value.mode === 'mock'
        ? 'mock_quality_not_evidence'
        : formalComplete &&
            projected.gate === 'quality_gate_passed' &&
            expectedWire.executorInvocations === 48 &&
            expectedWire.providerDispatches === 48 &&
            expectedWire.providerResponses === 48 &&
            expectedWire.verifiedUsages === 48 &&
            value.executorProvenance === 'first_party_deepseek_v4_pro_direct'
          ? 'quality_gate_passed'
          : 'quality_gate_failed';
    const expectedIds = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((entry) => entry.id).sort();
    const actualIds = value.caseEntries.map((entry) => entry.caseId).sort();
    if (
      JSON.stringify(value.identities) !== JSON.stringify(phase697V9IdentitySnapshot()) ||
      JSON.stringify(actualIds) !== JSON.stringify(expectedIds) ||
      JSON.stringify(value.wire) !== JSON.stringify(expectedWire) ||
      JSON.stringify(value.runtimeAccounting) !== JSON.stringify(expectedRuntimeAccounting) ||
      JSON.stringify(value.metrics) !== JSON.stringify(expectedMetrics) ||
      JSON.stringify(value.modelOwnedMetrics) !== JSON.stringify(projected.modelOwnedMetrics) ||
      JSON.stringify(value.latency) !== JSON.stringify(expectedLatency) ||
      JSON.stringify(value.usage) !== JSON.stringify(expectedUsage) ||
      JSON.stringify(value.safety) !== JSON.stringify(projected.safety) ||
      value.gate !== expectedGate
    ) {
      issue('V9 derived aggregate mismatch');
    }
    if (
      (value.mode === 'mock' &&
        (value.provider !== 'mock' ||
          value.model !== 'mock' ||
          value.structuredOutputMode !== 'mock_json_v9' ||
          value.executorProvenance !== 'mock_synthetic')) ||
      (value.mode === 'live' &&
        (value.provider !== 'deepseek' ||
          value.model !== 'deepseek-v4-pro' ||
          value.structuredOutputMode !== 'deepseek_v4_pro_direct_json' ||
          value.executorProvenance === 'mock_synthetic'))
    ) {
      issue('V9 mode identity mismatch');
    }
  });

export type Phase697TutorOrganizerV9Report = z.infer<
  typeof PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA
>;

export const PHASE_6_9_7_V9_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_V9_MARKER_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9),
    sourceManifestSha256: z.literal(PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256),
    datasetBindingSha256: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_SHA256),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
    evalPolicySha256: z.literal(PHASE_6_9_7_V9_EVAL_POLICY_SHA256),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.literal('live'),
    executorProvenance: z.enum(['first_party_deepseek_v4_pro_direct', 'synthetic_test']),
    ownerProcessId: z.number().int().safe().positive(),
    state: z.literal('attempt_reserved'),
  })
  .strict();

export type Phase697V9Marker = z.infer<typeof PHASE_6_9_7_V9_MARKER_SCHEMA>;

export const PHASE_6_9_7_V9_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9),
    runId: runIdSchema,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: z.string().uuid(),
    markerSha256: sha256Schema,
    journalTailSha256: sha256Schema.nullable(),
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697V9RecoveryClaimRecord = z.infer<typeof PHASE_6_9_7_V9_RECOVERY_CLAIM_SCHEMA>;

const durabilitySchema = z
  .object({
    disposition: z.enum([
      'mock_direct',
      'completed_run',
      'orphan_sealed',
      'journal_missing_sealed',
    ]),
    markerSha256: sha256Schema.nullable(),
    journalTailSha256: sha256Schema.nullable(),
    journalSequence: z.number().int().safe().nonnegative().nullable(),
  })
  .strict();

export const PHASE_6_9_7_V9_EVIDENCE_ENVELOPE_SCHEMA = z
  .object({
    evidenceVersion: z.literal(PHASE_6_9_7_V9_EVIDENCE_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    durability: durabilitySchema,
    reportSha256: sha256Schema,
    report: PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.runId !== value.report.runId ||
      value.runScope !== value.report.runScope ||
      value.mode !== value.report.mode ||
      value.reportSha256 !== sha256Phase697V9Stable(value.report) ||
      (value.durability.disposition === 'mock_direct' &&
        (value.mode !== 'mock' ||
          value.durability.markerSha256 !== null ||
          value.durability.journalTailSha256 !== null ||
          value.durability.journalSequence !== null)) ||
      (value.durability.disposition !== 'mock_direct' &&
        (value.mode !== 'live' || value.durability.markerSha256 === null)) ||
      (value.durability.disposition === 'journal_missing_sealed' &&
        (value.durability.journalTailSha256 !== null ||
          value.durability.journalSequence !== null ||
          value.report.gate !== 'quality_gate_failed')) ||
      (!['mock_direct', 'journal_missing_sealed'].includes(value.durability.disposition) &&
        (value.durability.journalTailSha256 === null ||
          value.durability.journalSequence === null)) ||
      (value.durability.disposition === 'orphan_sealed' &&
        value.report.gate !== 'quality_gate_failed')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V9 evidence identity mismatch' });
    }
  });

export type Phase697V9EvidenceEnvelope = z.infer<typeof PHASE_6_9_7_V9_EVIDENCE_ENVELOPE_SCHEMA>;

export function phase697V9IdentitySnapshot() {
  return deepFreeze({
    sourceManifestVersion: PHASE_6_9_7_V9_SOURCE_MANIFEST_VERSION,
    sourceManifestSha256: PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256,
    adapterVersion: FIRST_PARTY_DEEPSEEK_V4_PRO_DIRECT_ADAPTER_VERSION,
    wireDiagnosticsVersion: PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
    datasetBindingVersion: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicyVersion: PHASE_6_9_7_V9_EVAL_POLICY_VERSION,
    evalPolicySha256: PHASE_6_9_7_V9_EVAL_POLICY_SHA256,
    runnerRuntimeContractVersion: PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_VERSION,
    runnerRuntimeContractSha256: PHASE_6_9_7_V9_RUNNER_RUNTIME_CONTRACT_SHA256,
    wireAliasVersion: PHASE_6_9_7_V9_WIRE_ALIAS_VERSION,
    wireAliasSha256: PHASE_6_9_7_V9_WIRE_ALIAS_SHA256,
    organizerPromptVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
    organizerPromptSha256: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256,
    organizerProjectionVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
    organizerSelectionContractVersion: PHASE_6_9_7_V9_SELECTION_CONTRACT_VERSION,
    organizerSelectionContractSha256: PHASE_6_9_7_V9_SELECTION_CONTRACT_SHA256,
    organizerOptionAuthorityVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_VERSION,
    organizerOptionRulesVersion: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_VERSION,
    organizerOptionRulesSha256: WRONG_QUESTION_ORGANIZER_V9_OPTION_AUTHORITY_RULES_SHA256,
    organizerInputEstimatorVersion: WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION,
    organizerInputEstimatorSha256: WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256,
    boundedSchemaDiagnosticVersion: WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DIAGNOSTIC_VERSION,
    boundedSchemaDiagnosticSha256: PHASE_6_9_7_V9_DIAGNOSTIC_CONTRACT_SHA256,
    robustnessFixtureVersion: PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION,
    robustnessFixtureSha256: PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256,
    semanticAuthoritySha256: PHASE_6_9_7_V9_SEMANTIC_AUTHORITY_SHA256,
  });
}

export function buildPhase697V9Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'first_party_deepseek_v4_pro_direct' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V9Marker {
  return PHASE_6_9_7_V9_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V9_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
    sourceManifestSha256: PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256,
    datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicySha256: PHASE_6_9_7_V9_EVAL_POLICY_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'first_party_deepseek_v4_pro_direct',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function buildPhase697TutorOrganizerV9Report(input: {
  v6Report: Readonly<Phase697TutorOrganizerV6Report>;
  wireSnapshots: ReadonlyMap<string, Readonly<Phase697V9WireSnapshot>>;
  boundedSchemaDiagnostics: ReadonlyMap<
    string,
    Readonly<WrongQuestionOrganizerV9BoundedSchemaDiagnostic>
  >;
  executorProvenance: 'mock_synthetic' | 'first_party_deepseek_v4_pro_direct' | 'synthetic_test';
}): Readonly<Phase697TutorOrganizerV9Report> {
  const caseEntries = input.v6Report.caseEntries.map((entry) =>
    buildPhase697V9CaseEntry(
      entry,
      input.wireSnapshots.get(entry.caseId) ?? null,
      input.boundedSchemaDiagnostics.get(entry.caseId) ?? null,
    ),
  );
  const wire = aggregateWire(caseEntries);
  const formalComplete = formalAggregatesComplete(input.v6Report, caseEntries, wire);
  const metrics = formalComplete
    ? input.v6Report.metrics
    : {
        complete: false,
        strictRuntimeSuccesses: input.v6Report.metrics.strictRuntimeSuccesses,
        tutorSemanticScore: null,
        organizerSemanticScore: null,
        combinedSemanticScore: null,
      };
  const latency = formalComplete
    ? input.v6Report.latency
    : {
        complete: false,
        tutorCandidateP95Ms: null,
        organizerCandidateP95Ms: null,
        pairedCandidateP95Ms: null,
        tutorOrchestrationP95Ms: null,
      };
  const report = {
    runId: input.v6Report.runId,
    runScope: input.v6Report.runScope,
    mode: input.v6Report.mode,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
    identities: phase697V9IdentitySnapshot(),
    provider: input.v6Report.provider,
    model: input.v6Report.model,
    structuredOutputMode:
      input.v6Report.mode === 'mock' ? 'mock_json_v9' : 'deepseek_v4_pro_direct_json',
    executorProvenance: input.executorProvenance,
    lanePolicy: input.v6Report.lanePolicy,
    counts: input.v6Report.counts,
    scheduler: input.v6Report.scheduler,
    ledger: input.v6Report.ledger,
    runtimeAccounting: buildRuntimeAccounting(input.v6Report, caseEntries),
    pairedDurationEvidence: input.v6Report.pairedDurationEvidence,
    pairedLatencySamplesMs: input.v6Report.pairedLatencySamplesMs,
    caseEntries,
    wire,
    metrics,
    modelOwnedMetrics: input.v6Report.modelOwnedMetrics,
    latency,
    usage: buildUsageAggregate(input.v6Report, wire, formalComplete),
    safety: input.v6Report.safety,
    gate:
      input.v6Report.mode === 'mock'
        ? 'mock_quality_not_evidence'
        : formalComplete &&
            input.v6Report.gate === 'quality_gate_passed' &&
            wire.executorInvocations === 48 &&
            wire.providerDispatches === 48 &&
            wire.providerResponses === 48 &&
            wire.verifiedUsages === 48 &&
            input.executorProvenance === 'first_party_deepseek_v4_pro_direct'
          ? 'quality_gate_passed'
          : 'quality_gate_failed',
  };
  return deepFreeze(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.parse(report));
}

export function buildPhase697V9CaseEntry(
  entry: Readonly<Phase697V6CaseEntry>,
  snapshot: Readonly<Phase697V9WireSnapshot> | null,
  boundedSchemaDiagnostic: Readonly<WrongQuestionOrganizerV9BoundedSchemaDiagnostic> | null = null,
): Readonly<Phase697V9CaseEntry> {
  const canonicalSnapshot = snapshot ? PHASE_6_9_7_V9_WIRE_SNAPSHOT_SCHEMA.parse(snapshot) : null;
  const wireEvidence: Phase697V9WireEvidence = canonicalSnapshot
    ? { disposition: 'observed', snapshot: canonicalSnapshot }
    : entry.runtimeInvocations === 1
      ? { disposition: 'missing_after_attempt', snapshot: null }
      : { disposition: 'not_observed', snapshot: null };
  return deepFreeze(
    PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA.parse({
      runtimeEvidenceVersion: PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION,
      caseId: entry.caseId,
      agent: entry.agent,
      executionKind: entry.executionKind,
      pairedRunIndex: entry.pairedRunIndex,
      executionOutcome: entry.executionOutcome,
      candidateDisposition: entry.candidateDisposition,
      failureCategory: entry.failureCategory,
      providerFailureCategory: entry.providerFailureCategory,
      structuredOutputStage: entry.structuredOutputStage,
      strictRuntimeSuccess: entry.strictRuntimeSuccess,
      zeroCallVerified: entry.zeroCallVerified,
      semanticAxes: entry.semanticAxes,
      modelOwnedDecision: entry.modelOwnedDecision,
      durationEvidence: entry.durationEvidence,
      latencyMs: entry.latencyMs,
      orchestrationLatencyMs: entry.orchestrationLatencyMs,
      usageDisposition: entry.usageDisposition,
      usage: entry.usage,
      safety: entry.safety,
      wireEvidence,
      boundedSchemaDiagnostic,
    }),
  );
}

export function projectPhase697V9EntryToV6(
  entry: Readonly<Phase697V9CaseEntry>,
): Readonly<Phase697V6CaseEntry> | null {
  const parsed = PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA.safeParse(
    projectPhase697V9EntryToV6Unchecked(entry),
  );
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function buildPhase697V9EvidenceEnvelope(input: {
  report: Readonly<Phase697TutorOrganizerV9Report>;
  disposition: Phase697V9EvidenceEnvelope['durability']['disposition'];
  markerSha256: string | null;
  journalTailSha256: string | null;
  journalSequence: number | null;
}): Readonly<Phase697V9EvidenceEnvelope> | null {
  const parsed = PHASE_6_9_7_V9_EVIDENCE_ENVELOPE_SCHEMA.safeParse({
    evidenceVersion: PHASE_6_9_7_V9_EVIDENCE_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
    runId: input.report.runId,
    runScope: input.report.runScope,
    mode: input.report.mode,
    durability: {
      disposition: input.disposition,
      markerSha256: input.markerSha256,
      journalTailSha256: input.journalTailSha256,
      journalSequence: input.journalSequence,
    },
    reportSha256: sha256Phase697V9Stable(input.report),
    report: input.report,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function parsePhase697TutorOrganizerV9Report(
  input: unknown,
): Readonly<Phase697TutorOrganizerV9Report> | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok || containsLegacyArtifactIdentity(cloned.value)) return null;
  const parsed = PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(cloned.value);
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function phase697V9JournalPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live-${runId}.journal.jsonl`
    : null;
}

export function phase697V9RecoveryClaimPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v9-controlled-live-${runId}.recovery.claim`
    : null;
}

export function phase697V9EvidencePath(input: {
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
}): string | null {
  return isUuid(input.runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v9-${input.runScope}-${input.mode}-${input.runId}.json`
    : null;
}

export function phase697V9DispatchKeySha256(input: {
  runId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
}): `sha256:${string}` | null {
  if (
    !isUuid(input.runId) ||
    !Number.isSafeInteger(input.pairedRunIndex) ||
    input.pairedRunIndex < 0 ||
    input.pairedRunIndex > 23
  ) {
    return null;
  }
  return sha256Stable({
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
    runId: input.runId,
    agent: input.agent,
    pairedRunIndex: input.pairedRunIndex,
  });
}

export function sha256Phase697V9Stable(value: unknown): `sha256:${string}` {
  return sha256Stable(value);
}

function projectPhase697V9ReportToV6(
  report: Readonly<Phase697TutorOrganizerV9Report>,
): Readonly<Phase697TutorOrganizerV6Report> | null {
  try {
    const entries = report.caseEntries.map(projectPhase697V9EntryToV6);
    if (entries.some((entry) => entry === null)) return null;
    return buildPhase697TutorOrganizerV6Report({
      runId: report.runId,
      runScope: report.runScope,
      mode: report.mode,
      provider: report.provider,
      model: report.model,
      structuredOutputMode:
        report.mode === 'mock' ? 'mock_json_v6' : 'deepseek_v4_pro_nonthinking_json',
      executorProvenance:
        report.executorProvenance === 'first_party_deepseek_v4_pro_direct'
          ? 'deepseek_network'
          : report.executorProvenance,
      caseEntries: entries as readonly Phase697V6CaseEntry[],
      pairedDurations: new Map(
        report.pairedDurationEvidence.flatMap((entry, pairedRunIndex) =>
          entry === null ? [] : [[pairedRunIndex, entry] as const],
        ),
      ),
      scheduler: report.scheduler,
      ledger: report.ledger,
    });
  } catch {
    return null;
  }
}

function projectPhase697V9EntryToV6Unchecked(
  entry: Phase697V9CaseEntry | z.input<typeof PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA>,
) {
  const runtimeAttempted =
    entry.executionKind === 'runtime' && !entry.executionOutcome.startsWith('not_started_');
  return {
    runtimeEvidenceVersion: PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
    caseId: entry.caseId,
    agent: entry.agent,
    executionKind: entry.executionKind,
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: runtimeAttempted ? 1 : 0,
    executionOutcome: entry.executionOutcome,
    candidateDisposition: entry.candidateDisposition,
    failureCategory: entry.failureCategory,
    providerFailureCategory: entry.providerFailureCategory,
    structuredOutputStage: entry.structuredOutputStage,
    strictRuntimeSuccess: entry.strictRuntimeSuccess,
    zeroCallVerified: entry.zeroCallVerified,
    semanticAxes: entry.semanticAxes,
    modelOwnedDecision: entry.modelOwnedDecision,
    durationEvidence: entry.durationEvidence,
    latencyMs: entry.latencyMs,
    orchestrationLatencyMs: entry.orchestrationLatencyMs,
    usageDisposition: entry.usageDisposition,
    usage: entry.usage,
    safety: entry.safety,
    dispatchRecorded: runtimeAttempted,
    runtimeTerminalRecorded: runtimeAttempted,
  };
}

function aggregateWire(entries: readonly Phase697V9CaseEntry[]) {
  const runtime = entries.filter((entry) => entry.executionKind === 'runtime');
  const counters = runtime.reduce(
    (total, entry) => {
      const current = entry.wireEvidence.snapshot?.counters;
      return {
        executorInvocations: total.executorInvocations + (current?.executorInvocations ?? 0),
        providerDispatches: total.providerDispatches + (current?.providerDispatches ?? 0),
        providerResponses: total.providerResponses + (current?.providerResponses ?? 0),
        verifiedUsages: total.verifiedUsages + (current?.verifiedUsages ?? 0),
      };
    },
    { executorInvocations: 0, providerDispatches: 0, providerResponses: 0, verifiedUsages: 0 },
  );
  return {
    complete: runtime.every(
      (entry) =>
        entry.wireEvidence.disposition === 'observed' &&
        entry.wireEvidence.snapshot.state !== 'active',
    ),
    ...counters,
  };
}

function formalAggregatesComplete(
  report: Readonly<Phase697TutorOrganizerV6Report>,
  entries: readonly Phase697V9CaseEntry[],
  wire: ReturnType<typeof aggregateWire>,
) {
  return (
    report.metrics.complete &&
    report.latency.complete &&
    report.usage.complete &&
    wire.complete &&
    entries
      .filter((entry) => entry.executionKind === 'runtime')
      .every(
        (entry) =>
          entry.strictRuntimeSuccess &&
          entry.wireEvidence.disposition === 'observed' &&
          wireSnapshotIsCompleteSuccess(entry.wireEvidence.snapshot),
      )
  );
}

function buildUsageAggregate(
  report: Readonly<Phase697TutorOrganizerV6Report>,
  wire: ReturnType<typeof aggregateWire>,
  formalComplete: boolean,
) {
  return {
    complete: formalComplete,
    executorInvocations: wire.executorInvocations,
    providerDispatches: wire.providerDispatches,
    providerResponses: wire.providerResponses,
    verifiedUsages: wire.verifiedUsages,
    verifiedRuntimeCases: wire.verifiedUsages,
    inputTokens: formalComplete ? report.usage.inputTokens : null,
    outputTokens: formalComplete ? report.usage.outputTokens : null,
    estimatedCostCny: formalComplete ? report.usage.estimatedCostCny : null,
  };
}

function buildRuntimeAccounting(
  report: Pick<Phase697TutorOrganizerV6Report, 'ledger'>,
  entries: readonly Phase697V9CaseEntry[],
) {
  const runtimeEntries = entries.filter((entry) => entry.executionKind === 'runtime');
  const reservedEntries = report.ledger.reservedEntries;
  const terminalEntries = report.ledger.terminalEntries;
  const orphanedEntries = runtimeEntries.filter(
    (entry) => entry.executionOutcome === 'attempted_orphaned',
  ).length;
  const notStartedEntries = runtimeEntries.filter((entry) =>
    entry.executionOutcome.startsWith('not_started_'),
  ).length;
  return {
    reservedEntries,
    terminalEntries,
    orphanedEntries,
    notStartedEntries,
  };
}

function wireSnapshotIsCompleteSuccess(snapshot: Readonly<Phase697V9WireSnapshot>) {
  return (
    snapshot.state === 'succeeded' &&
    snapshot.stages.length === PHASE_6_9_7_V9_WIRE_STAGES.length &&
    snapshot.counters.executorInvocations === 1 &&
    snapshot.counters.providerDispatches === 1 &&
    snapshot.counters.providerResponses === 1 &&
    snapshot.counters.verifiedUsages === 1 &&
    snapshot.usageDisposition === 'verified'
  );
}

function wireCountersForStages(stages: readonly string[]) {
  return {
    executorInvocations: stages.includes('executor_entered') ? 1 : 0,
    providerDispatches: stages.includes('provider_dispatch_started') ? 1 : 0,
    providerResponses: stages.includes('provider_response_received') ? 1 : 0,
    verifiedUsages: stages.includes('usage_validated') ? 1 : 0,
  } as const;
}

function projectWireFailure(category: NonNullable<Phase697V9WireSnapshot['failureCategory']>): {
  category: (typeof MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES)[number];
  structuredOutputStage?: (typeof MODEL_AGENT_STRUCTURED_OUTPUT_STAGES)[number];
} {
  switch (category) {
    case 'transport':
    case 'http_auth':
    case 'http_rate_limit':
    case 'http_client':
    case 'http_server':
      return { category };
    case 'response_audit':
    case 'invalid_response':
      return { category: 'invalid_response' };
    case 'provider_json_parse':
    case 'provider_type_validation':
    case 'provider_object_missing':
      return { category: 'structured_output', structuredOutputStage: category };
    default:
      return { category: 'unknown' };
  }
}

const LEGACY_ARTIFACT_IDENTITIES = Object.freeze([
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-tutor-organizer-runner-v${index + 1}`),
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-v${index + 1}-runtime-evidence-v1`),
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-v${index + 1}-live-marker-v1`),
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-v${index + 1}-journal-v1`),
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-v${index + 1}-evidence-envelope-v1`),
  ...Array.from({ length: 8 }, (_, index) => `phase-6.9.7-v${index + 1}-recovery-claim-v1`),
]);

function containsLegacyArtifactIdentity(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return LEGACY_ARTIFACT_IDENTITIES.includes(value);
  if (value === null || typeof value !== 'object') return false;
  if (seen.has(value)) return true;
  seen.add(value);
  try {
    return Reflect.ownKeys(value).some((key) => {
      if (typeof key !== 'string') return true;
      const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
      return (
        !descriptor ||
        !('value' in descriptor) ||
        containsLegacyArtifactIdentity(descriptor.value, seen)
      );
    });
  } catch {
    return true;
  }
}

function sha256Stable(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortStableValue(value)), 'utf8')
    .digest('hex')}`;
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V9_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V9_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V9_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
