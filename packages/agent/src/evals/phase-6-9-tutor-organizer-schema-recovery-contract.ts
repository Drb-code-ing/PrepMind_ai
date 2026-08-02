import { z } from 'zod';

import {
  PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA,
  buildPhase697FullGateReport,
  type Phase697FullGateCaseEntry,
  type Phase697FullGateReport,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import { canonicalPhase697FullGateJson } from './phase-6-9-tutor-organizer-full-gate-manifest.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
  PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
} from './phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import {
  TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA,
  TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
  TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
  type TutorSchemaRecoveryBoundedDiagnostic,
} from '../model-candidates/tutor-schema-recovery-contract.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_ENTRY_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-entry-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-report-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_CONTRACT_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-report-contract-v1' as const;
export const PHASE_6_9_7_SCHEMA_RECOVERY_CHECKPOINT_AUTHORITY =
  'zero_provider_full_gate_schema_recovery_runner_durability' as const;

export const PHASE_6_9_7_SCHEMA_RECOVERY_OUTCOMES = [
  'canonical',
  'extension_fields_discarded',
  'rejected',
  'not_observed',
] as const;

export const PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION = z
  .object({
    outcome: z.enum(PHASE_6_9_7_SCHEMA_RECOVERY_OUTCOMES),
    diagnostic: TUTOR_SCHEMA_RECOVERY_BOUNDED_DIAGNOSTIC_SCHEMA.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    const reason = value.diagnostic?.reasonCode ?? null;
    const valid =
      (value.outcome === 'canonical' && value.diagnostic === null) ||
      (value.outcome === 'extension_fields_discarded' &&
        reason === 'extension_fields_discarded' &&
        value.diagnostic?.rawDataRetained === false) ||
      (value.outcome === 'rejected' &&
        value.diagnostic !== null &&
        reason !== 'extension_fields_discarded' &&
        value.diagnostic.rawDataRetained === false) ||
      (value.outcome === 'not_observed' && value.diagnostic === null);
    if (!valid) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'schema_observation_mismatch' });
    }
  });

export type Phase697SchemaRecoverySchemaObservation = z.infer<
  typeof PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION
>;

const caseEntryBaseSchema = z
  .object({
    entryVersion: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_ENTRY_VERSION),
    base: PHASE_6_9_7_FULL_GATE_CASE_ENTRY_SCHEMA,
    schema: PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION,
  })
  .strict();

export type Phase697SchemaRecoveryCaseEntry = z.infer<typeof caseEntryBaseSchema>;

export const PHASE_6_9_7_SCHEMA_RECOVERY_CASE_ENTRY_SCHEMA = caseEntryBaseSchema.superRefine(
  (value, context) => {
    const base = value.base;
    if (
      (base.executionKind === 'guard' || base.disposition.startsWith('not_started_')) &&
      value.schema.outcome !== 'not_observed'
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'inactive_schema_observed' });
    }
    if (
      base.executionKind === 'runtime' &&
      base.disposition === 'succeeded' &&
      !['canonical', 'extension_fields_discarded'].includes(value.schema.outcome)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'successful_schema_not_observed' });
    }
    if (
      base.executionKind === 'runtime' &&
      ['schema', 'dynamic_authority', 'usage'].includes(base.failureCategory) &&
      value.schema.outcome !== 'rejected'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'contract_failure_schema_not_rejected',
      });
    }
    if (
      base.wire.verifiedUsageObserved === 1 &&
      value.schema.outcome === 'not_observed' &&
      base.disposition !== 'attempted_aborted'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'verified_usage_without_schema_terminal',
      });
    }
  },
);

const schemaAccountingSchema = z
  .object({
    complete: z.boolean(),
    canonical: z.number().int().safe().min(0).max(48),
    extensionFieldsDiscarded: z.number().int().safe().min(0).max(48),
    rejected: z.number().int().safe().min(0).max(48),
    notObserved: z.number().int().safe().min(0).max(48),
  })
  .strict();

const reportBaseSchema = z
  .object({
    reportVersion: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_VERSION),
    reportContractVersion: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_CONTRACT_VERSION),
    lineage: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE),
    checkpointAuthority: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_CHECKPOINT_AUTHORITY),
    runId: z.string().uuid(),
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    executorProvenance: z.enum(['deepseek_network', 'mock_synthetic', 'synthetic_test']),
    approvedRunnableSourceCommit: z.string().regex(/^[0-9a-f]{40}$/u),
    identities: z
      .object({
        sourceManifestSha256: z.literal(PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256),
        tutorRecoveryContractSha256: z.literal(TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256),
        tutorRecoveryDiagnosticVersion: z.literal(TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION),
      })
      .strict(),
    counts: z
      .object({
        cases: z.literal(72),
        guards: z.literal(24),
        runtimePairs: z.literal(24),
        runtimeLanes: z.literal(48),
        organizerDecisionUnits: z.literal(32),
      })
      .strict(),
    caseEntries: z.array(PHASE_6_9_7_SCHEMA_RECOVERY_CASE_ENTRY_SCHEMA).length(72),
    runtimeAccounting: z.custom<Phase697FullGateReport['runtimeAccounting']>(),
    wire: z.custom<Phase697FullGateReport['wire']>(),
    schemaAccounting: schemaAccountingSchema,
    metrics: z.custom<Phase697FullGateReport['metrics']>(),
    latency: z.custom<Phase697FullGateReport['latency']>(),
    usage: z.custom<Phase697FullGateReport['usage']>(),
    safety: z.custom<Phase697FullGateReport['safety']>(),
    breaker: z.custom<Phase697FullGateReport['breaker']>(),
    gate: z.enum([
      'schema_recovery_mock_quality_not_evidence',
      'schema_recovery_quality_gate_passed',
      'schema_recovery_quality_gate_failed',
    ]),
    qualityAuthority: z.enum(['none', 'schema_recovery_full_gate_semantic_gate']),
  })
  .strict();

export type Phase697SchemaRecoveryReport = z.infer<typeof reportBaseSchema>;

export const PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA = reportBaseSchema.superRefine(
  (value, context) => {
    let expected: Phase697SchemaRecoveryReport;
    try {
      expected = deriveReport({
        runId: value.runId,
        runScope: value.runScope,
        mode: value.mode,
        executorProvenance: value.executorProvenance,
        approvedRunnableSourceCommit: value.approvedRunnableSourceCommit,
        caseEntries: value.caseEntries,
      });
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_recompute_failed' });
      return;
    }
    if (canonical(expected) !== canonical(value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'report_recompute_mismatch' });
    }
  },
);

export type Phase697SchemaRecoveryReportInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  approvedRunnableSourceCommit: string;
  caseEntries: readonly Phase697SchemaRecoveryCaseEntry[];
}>;

export function buildPhase697SchemaRecoveryReport(
  input: Phase697SchemaRecoveryReportInput,
): Readonly<Phase697SchemaRecoveryReport> {
  const derived = deriveReport(input);
  const parsed = PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA.parse(derived);
  return deepFreeze(parsed);
}

export function parsePhase697SchemaRecoveryReport(
  value: unknown,
): Readonly<Phase697SchemaRecoveryReport> | null {
  try {
    const cloned = JSON.parse(canonicalPhase697FullGateJson(value)) as unknown;
    const parsed = PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA.safeParse(cloned);
    return parsed.success ? deepFreeze(parsed.data) : null;
  } catch {
    return null;
  }
}

export function createPhase697SchemaRecoveryCaseEntry(
  base: Phase697FullGateCaseEntry,
  schema: Phase697SchemaRecoverySchemaObservation,
): Readonly<Phase697SchemaRecoveryCaseEntry> {
  return deepFreeze(
    PHASE_6_9_7_SCHEMA_RECOVERY_CASE_ENTRY_SCHEMA.parse({
      entryVersion: PHASE_6_9_7_SCHEMA_RECOVERY_ENTRY_VERSION,
      base,
      schema,
    }),
  );
}

export const PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED = Object.freeze({
  outcome: 'not_observed' as const,
  diagnostic: null,
});

export function createPhase697SchemaRecoveryRejectedObservation(
  diagnostic: TutorSchemaRecoveryBoundedDiagnostic,
) {
  return deepFreeze(
    PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse({
      outcome: 'rejected',
      diagnostic,
    }),
  );
}

function deriveReport(input: Phase697SchemaRecoveryReportInput): Phase697SchemaRecoveryReport {
  const caseEntries = input.caseEntries.map((entry) =>
    PHASE_6_9_7_SCHEMA_RECOVERY_CASE_ENTRY_SCHEMA.parse(entry),
  );
  const base = buildPhase697FullGateReport({
    runId: input.runId,
    runScope: input.runScope,
    mode: input.mode,
    executorProvenance: input.executorProvenance,
    approvedRunnableSourceCommit: input.approvedRunnableSourceCommit,
    caseEntries: caseEntries.map((entry) => entry.base),
  });
  const schemaAccounting = deriveSchemaAccounting(caseEntries);
  const gate = mapGate(base.gate);
  const qualityAuthority =
    base.qualityAuthority === 'full_gate_semantic_gate' &&
    input.executorProvenance === 'deepseek_network'
      ? ('schema_recovery_full_gate_semantic_gate' as const)
      : ('none' as const);
  return {
    reportVersion: PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_VERSION,
    reportContractVersion: PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_CONTRACT_VERSION,
    lineage: PHASE_6_9_7_SCHEMA_RECOVERY_FULL_GATE_LINEAGE,
    checkpointAuthority: PHASE_6_9_7_SCHEMA_RECOVERY_CHECKPOINT_AUTHORITY,
    runId: input.runId,
    runScope: input.runScope,
    mode: input.mode,
    executorProvenance: input.executorProvenance,
    approvedRunnableSourceCommit: input.approvedRunnableSourceCommit,
    identities: {
      sourceManifestSha256: PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_MANIFEST_SHA256,
      tutorRecoveryContractSha256: TUTOR_SCHEMA_RECOVERY_CONTRACT_SHA256,
      tutorRecoveryDiagnosticVersion: TUTOR_SCHEMA_RECOVERY_DIAGNOSTIC_VERSION,
    },
    counts: base.counts,
    caseEntries,
    runtimeAccounting: base.runtimeAccounting,
    wire: base.wire,
    schemaAccounting,
    metrics: base.metrics,
    latency: base.latency,
    usage: base.usage,
    safety: base.safety,
    breaker: base.breaker,
    gate,
    qualityAuthority,
  };
}

function deriveSchemaAccounting(entries: readonly Phase697SchemaRecoveryCaseEntry[]) {
  const runtime = entries.filter((entry) => entry.base.executionKind === 'runtime');
  const count = (outcome: Phase697SchemaRecoverySchemaObservation['outcome']) =>
    runtime.filter((entry) => entry.schema.outcome === outcome).length;
  const canonicalCount = count('canonical');
  const extensionFieldsDiscarded = count('extension_fields_discarded');
  const rejected = count('rejected');
  const notObserved = count('not_observed');
  return {
    complete:
      runtime.length === 48 &&
      notObserved === 0 &&
      canonicalCount + extensionFieldsDiscarded + rejected === 48,
    canonical: canonicalCount,
    extensionFieldsDiscarded,
    rejected,
    notObserved,
  };
}

function mapGate(gate: Phase697FullGateReport['gate']): Phase697SchemaRecoveryReport['gate'] {
  switch (gate) {
    case 'full_gate_mock_quality_not_evidence':
      return 'schema_recovery_mock_quality_not_evidence';
    case 'full_gate_quality_gate_passed':
      return 'schema_recovery_quality_gate_passed';
    case 'full_gate_quality_gate_failed':
      return 'schema_recovery_quality_gate_failed';
  }
}

function canonical(value: unknown) {
  return canonicalPhase697FullGateJson(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
