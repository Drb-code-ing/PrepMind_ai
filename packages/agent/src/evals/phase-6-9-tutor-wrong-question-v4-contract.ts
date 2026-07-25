import { createHash } from 'node:crypto';

import { z } from 'zod';

import { PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256 } from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3,
  PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
  PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
  PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3,
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  runtimeContractSuccess,
  type Phase697TutorOrganizerV3Report,
  type Phase697V3CaseEntry,
} from './phase-6-9-tutor-wrong-question-v3-contract.ts';
import {
  PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA,
  buildPhase697V4DiagnosticReport,
  projectPhase697V4CaseDiagnostic,
  type Phase697V4CaseDiagnostic,
  type Phase697V4DiagnosticReport,
  type Phase697V4SemanticObservation,
} from './phase-6-9-tutor-wrong-question-v4-diagnostics.ts';
import { clonePlainEvidenceData } from '../model-candidates/model-projection-safety.ts';

export const PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4 =
  'phase-6.9.7-tutor-organizer-runner-v4' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4 = 'tutor-model-candidate-v4' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4 =
  'wrong-question-organizer-model-candidate-v4' as const;
export const PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4 =
  'sha256:20ac5a1a60d9c900027eac4ad3a55cb4de341c0e1a27f319c8b086864d5e2c14' as const;
export const PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4 =
  'sha256:972e1cca6cc53a651b7ee2eb32fa72046ea18a92fc4bd55da12ef1d699cb2364' as const;
export const PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION =
  'phase-6.9.7-v4-runtime-evidence-v1' as const;
export const PHASE_6_9_7_V4_MARKER_VERSION = 'phase-6.9.7-v4-live-marker-v1' as const;
export const PHASE_6_9_7_V4_JOURNAL_VERSION = 'phase-6.9.7-v4-journal-v1' as const;
export const PHASE_6_9_7_V4_EVIDENCE_VERSION = 'phase-6.9.7-v4-evidence-envelope-v1' as const;
export const PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION = 'phase-6.9.7-v4-recovery-claim-v1' as const;
export const PHASE_6_9_7_V4_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v4' as const;
export const PHASE_6_9_7_V4_APPROVAL_ENV = 'PHASE_6_9_7_V4_CONTROLLED_LIVE_APPROVED' as const;
export const PHASE_6_9_7_V4_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_V4_CONTROLLED_LIVE_ONCE' as const;
export const PHASE_6_9_7_V4_MARKER_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live.marker' as const;
export const PHASE_6_9_7_V4_RECOVERY_CLAIM_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live.recovery.claim' as const;

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();

export const PHASE_6_9_7_V4_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_V4_MARKER_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.literal('live'),
    executorProvenance: z.enum(['deepseek_network', 'synthetic_test']),
    ownerProcessId: z.number().int().safe().positive(),
    state: z.literal('attempt_reserved'),
  })
  .strict();

export type Phase697V4Marker = z.infer<typeof PHASE_6_9_7_V4_MARKER_SCHEMA>;

export const PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4),
    runId: runIdSchema,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: z.string().uuid(),
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697V4RecoveryClaimRecord = z.infer<typeof PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA>;

const V3_REPORT_KEYS = [
  'runId',
  'runScope',
  'mode',
  'runnerVersion',
  'datasetVersion',
  'datasetSha256',
  'identities',
  'provider',
  'model',
  'counts',
  'metrics',
  'latency',
  'usage',
  'safety',
  'execution',
  'scheduler',
  'ledger',
  'lanes',
  'caseEntries',
  'gate',
] as const;

type V4Identities = Omit<
  Phase697TutorOrganizerV3Report['identities'],
  | 'tutorPromptVersion'
  | 'organizerPromptVersion'
  | 'tutorPromptContentSha256'
  | 'organizerPromptContentSha256'
> &
  Readonly<{
    tutorPromptVersion: typeof PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4;
    organizerPromptVersion: typeof PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4;
    tutorPromptContentSha256: typeof PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4;
    organizerPromptContentSha256: typeof PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4;
  }>;

export type Phase697V4CaseEntry = Omit<Phase697V3CaseEntry, 'runtimeEvidenceVersion'> &
  Readonly<{
    runtimeEvidenceVersion: typeof PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION;
    v4Diagnostic: Readonly<Phase697V4CaseDiagnostic>;
  }>;

export const PHASE_6_9_7_V4_CASE_ENTRY_SCHEMA = z
  .unknown()
  .transform((value, context): Phase697V4CaseEntry => {
    const parsed = parsePhase697V4CaseEntry(value);
    if (parsed === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid V4 case entry' });
      return z.NEVER;
    }
    return parsed;
  });

export type Phase697TutorOrganizerV4Report = Omit<
  Phase697TutorOrganizerV3Report,
  'runnerVersion' | 'identities' | 'caseEntries'
> &
  Readonly<{
    runnerVersion: typeof PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4;
    identities: V4Identities;
    caseEntries: readonly Phase697V4CaseEntry[];
    v4Diagnostics: Readonly<Phase697V4DiagnosticReport>;
  }>;

export const PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA = z
  .unknown()
  .transform((value, context): Phase697TutorOrganizerV4Report => {
    const parsed = parsePhase697TutorOrganizerV4Report(value);
    if (parsed === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid V4 paired report' });
      return z.NEVER;
    }
    return parsed;
  });

const v4DurabilitySchema = z
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

export const PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA = z
  .object({
    evidenceVersion: z.literal(PHASE_6_9_7_V4_EVIDENCE_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    durability: v4DurabilitySchema,
    reportSha256: sha256Schema,
    report: PHASE_6_9_7_TUTOR_ORGANIZER_V4_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.runId !== value.report.runId ||
      value.runScope !== value.report.runScope ||
      value.mode !== value.report.mode ||
      value.reportSha256 !== sha256Phase697V4Stable(value.report)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V4 evidence identity mismatch' });
    }
    if (value.durability.disposition === 'mock_direct') {
      if (
        value.mode !== 'mock' ||
        value.durability.markerSha256 !== null ||
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'V4 mock durability mismatch' });
      }
      return;
    }
    if (value.mode !== 'live' || value.durability.markerSha256 === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V4 live durability mismatch' });
    }
    if (value.durability.disposition === 'journal_missing_sealed') {
      if (
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null ||
        value.report.gate !== 'quality_gate_failed'
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'V4 missing journal mismatch' });
      }
      return;
    }
    if (
      value.durability.journalTailSha256 === null ||
      value.durability.journalSequence === null ||
      (value.durability.disposition === 'orphan_sealed' &&
        value.report.gate !== 'quality_gate_failed')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V4 journal durability mismatch' });
    }
  });

export type Phase697V4EvidenceEnvelope = z.infer<typeof PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA>;

export function buildPhase697V4EvidenceEnvelope(input: {
  report: Readonly<Phase697TutorOrganizerV4Report>;
  disposition: Phase697V4EvidenceEnvelope['durability']['disposition'];
  markerSha256: string | null;
  journalTailSha256: string | null;
  journalSequence: number | null;
}): Readonly<Phase697V4EvidenceEnvelope> | null {
  const parsed = PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA.safeParse({
    evidenceVersion: PHASE_6_9_7_V4_EVIDENCE_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
    runId: input.report.runId,
    runScope: input.report.runScope,
    mode: input.report.mode,
    durability: {
      disposition: input.disposition,
      markerSha256: input.markerSha256,
      journalTailSha256: input.journalTailSha256,
      journalSequence: input.journalSequence,
    },
    reportSha256: sha256Phase697V4Stable(input.report),
    report: input.report,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function buildPhase697TutorOrganizerV4Report(
  v3Report: Readonly<Phase697TutorOrganizerV3Report>,
): Readonly<Phase697TutorOrganizerV4Report> | null {
  const validatedV3 = PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse(v3Report);
  if (!validatedV3.success) return null;
  const caseEntries: Phase697V4CaseEntry[] = [];
  for (const entry of validatedV3.data.caseEntries) {
    const diagnostic = buildPhase697V4CaseDiagnostic(entry);
    if (diagnostic === null) return null;
    caseEntries.push(
      deepFreeze({
        ...entry,
        runtimeEvidenceVersion: PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
        v4Diagnostic: diagnostic,
      }),
    );
  }
  const v4Diagnostics = buildPhase697V4DiagnosticReport(
    caseEntries.map((entry) => entry.v4Diagnostic),
  );
  if (v4Diagnostics === null) return null;
  return parsePhase697TutorOrganizerV4Report({
    ...validatedV3.data,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
    identities: {
      ...validatedV3.data.identities,
      tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4,
      organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4,
      tutorPromptContentSha256: PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4,
      organizerPromptContentSha256: PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4,
    },
    caseEntries,
    v4Diagnostics,
  });
}

export function buildPhase697V4CaseEntry(
  entry: Readonly<Phase697V3CaseEntry>,
): Readonly<Phase697V4CaseEntry> | null {
  const validated = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse(entry);
  if (!validated.success) return null;
  const diagnostic = buildPhase697V4CaseDiagnostic(validated.data);
  if (diagnostic === null) return null;
  return deepFreeze({
    ...validated.data,
    runtimeEvidenceVersion: PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
    v4Diagnostic: diagnostic,
  });
}

export function parsePhase697V4CaseEntry(input: unknown): Readonly<Phase697V4CaseEntry> | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok || !isPlainRecord(cloned.value)) return null;
  const { v4Diagnostic, ...v3Fields } = cloned.value;
  if (!isPlainRecord(v4Diagnostic)) return null;
  const parsedV3 = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse({
    ...v3Fields,
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  });
  if (!parsedV3.success) return null;
  const canonical = buildPhase697V4CaseEntry(parsedV3.data);
  return canonical !== null && sameJson(canonical, cloned.value) ? canonical : null;
}

export function toPhase697V3CaseEntry(
  entry: Readonly<Phase697V4CaseEntry>,
): Readonly<Phase697V3CaseEntry> | null {
  const { v4Diagnostic: _diagnostic, ...v3Fields } = entry;
  void _diagnostic;
  const parsed = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse({
    ...v3Fields,
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  });
  return parsed.success ? deepFreeze(parsed.data) : null;
}

export function runtimeContractSuccessV4(entry: Readonly<Phase697V4CaseEntry>): boolean {
  const v3Entry = toPhase697V3CaseEntry(entry);
  return v3Entry !== null && runtimeContractSuccess(v3Entry);
}

export function parsePhase697TutorOrganizerV4Report(
  input: unknown,
): Readonly<Phase697TutorOrganizerV4Report> | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok || !isPlainRecord(cloned.value)) return null;
  const report = cloned.value;
  if (!hasExactKeys(report, [...V3_REPORT_KEYS, 'v4Diagnostics'])) return null;
  if (
    report.runnerVersion !== PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4 ||
    !isPlainRecord(report.identities) ||
    report.identities.tutorPromptVersion !== PHASE_6_9_7_TUTOR_PROMPT_VERSION_V4 ||
    report.identities.organizerPromptVersion !== PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V4 ||
    report.identities.tutorPromptContentSha256 !== PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4 ||
    report.identities.organizerPromptContentSha256 !==
      PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4 ||
    !Array.isArray(report.caseEntries)
  ) {
    return null;
  }
  const diagnostics = PHASE_6_9_7_V4_DIAGNOSTIC_REPORT_SCHEMA.safeParse(report.v4Diagnostics);
  if (!diagnostics.success) return null;

  const v3CaseEntries: Record<string, unknown>[] = [];
  const canonicalDiagnostics: Phase697V4CaseDiagnostic[] = [];
  for (const rawEntry of report.caseEntries) {
    if (!isPlainRecord(rawEntry) || !isPlainRecord(rawEntry.v4Diagnostic)) return null;
    if (rawEntry.runtimeEvidenceVersion !== PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION) return null;
    const { v4Diagnostic, ...v3Entry } = rawEntry;
    const candidateV3 = {
      ...v3Entry,
      runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    };
    const parsedV3Entry = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.safeParse(candidateV3);
    if (!parsedV3Entry.success) return null;
    const diagnostic = buildPhase697V4CaseDiagnostic(parsedV3Entry.data);
    if (diagnostic === null || !sameJson(diagnostic, v4Diagnostic)) return null;
    v3CaseEntries.push(parsedV3Entry.data);
    canonicalDiagnostics.push(diagnostic);
  }
  const canonicalReportDiagnostics = buildPhase697V4DiagnosticReport(canonicalDiagnostics);
  if (
    canonicalReportDiagnostics === null ||
    !sameJson(canonicalReportDiagnostics, diagnostics.data)
  ) {
    return null;
  }

  const v3Report = {
    ...report,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
    identities: {
      ...report.identities,
      tutorPromptVersion: PHASE_6_9_7_TUTOR_PROMPT_VERSION_V3,
      organizerPromptVersion: PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V3,
      tutorPromptContentSha256: PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V3,
      organizerPromptContentSha256: PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V3,
    },
    caseEntries: v3CaseEntries,
  } as Record<string, unknown>;
  delete v3Report.v4Diagnostics;
  if (!PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA.safeParse(v3Report).success) return null;
  return deepFreeze(report as unknown as Phase697TutorOrganizerV4Report);
}

export function phase697V4JournalPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live-${runId}.journal.jsonl`
    : null;
}

export function phase697V4RecoveryClaimPath(runId: string): string | null {
  return isUuid(runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v4-controlled-live-${runId}.recovery.claim`
    : null;
}

export function phase697V4EvidencePath(input: {
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
}): string | null {
  return isUuid(input.runId)
    ? `.tmp/phase-6-9-7-tutor-organizer-v4-${input.runScope}-${input.mode}-${input.runId}.json`
    : null;
}

export function buildPhase697V4CaseDiagnostic(entry: Readonly<Phase697V3CaseEntry>) {
  const notStartedReason = mapNotStartedReason(entry);
  const strict =
    entry.executionKind === 'runtime' && notStartedReason === null
      ? runtimeContractSuccess(entry)
      : null;
  const semanticObservation = strict ? buildSemanticObservation(entry) : null;
  return projectPhase697V4CaseDiagnostic({
    caseId: entry.caseId,
    agent: entry.agent,
    notStartedReason,
    runtimeContractSuccess: strict,
    contractFailureStage:
      strict === false && notStartedReason === null ? contractFailureStage(entry) : null,
    semanticObservation,
    organizerDynamicFailure: null,
  });
}

function buildSemanticObservation(
  entry: Readonly<Phase697V3CaseEntry>,
): Phase697V4SemanticObservation | null {
  if (entry.agent === 'tutor') {
    if (!entry.tutorExpected || !entry.tutorActual) return null;
    const intentMatch = entry.tutorExpected.intent === entry.tutorActual.intent;
    return {
      agent: 'tutor',
      axes: {
        intent: intentMatch,
        depth: entry.tutorExpected.depth === entry.tutorActual.depth,
        evidenceAssociation: true,
        contextUse: entry.tutorExpected.contextUse === entry.tutorActual.contextUse,
        guidingPolicy: entry.tutorExpected.guidingQuestion === entry.tutorActual.guidingQuestion,
        finalAnswerBoundary: entry.tutorExpected.finalAnswer === entry.tutorActual.finalAnswer,
        answerStructure: sameJson(
          entry.tutorExpected.answerStructure,
          entry.tutorActual.answerStructure,
        ),
      },
      moreSpecificPrimaryEvidenceSuppressed:
        !intentMatch && entry.tutorActual.intent === 'general_follow_up',
    };
  }
  if (entry.organizerDecisions.length === 0) return null;
  return {
    agent: 'wrong_question_organizer',
    axes: {
      subject: entry.organizerDecisions.every(
        (decision) => decision.expectedSubject === decision.actualSubject,
      ),
      deck: entry.organizerDecisions.every(
        (decision) =>
          decision.expectedDeckAction === decision.actualDeckAction &&
          decision.expectedDeckIndex === decision.actualDeckIndex,
      ),
      topic: entry.organizerDecisions.every(
        (decision) => decision.canonicalTopicLabel === decision.actualTopicLabelClass,
      ),
      evidence: entry.organizerDecisions.every(
        (decision) =>
          decision.requiredEvidenceCodes.every((code) =>
            decision.actualEvidenceCodes.includes(code),
          ) &&
          decision.actualEvidenceCodes.every((code) =>
            decision.allowedEvidenceCodes.includes(code),
          ),
      ),
      confidence: entry.organizerDecisions.every(
        (decision) => decision.expectedConfidence === decision.actualConfidence,
      ),
    },
  };
}

function contractFailureStage(entry: Readonly<Phase697V3CaseEntry>) {
  if (entry.criticalFailure || entry.permissionFailure || entry.mutationFailure)
    return 'safety' as const;
  if (entry.canonicalValidationStage === 'raw_schema') return 'raw_schema' as const;
  if (entry.canonicalValidationStage === 'dynamic_contract') return 'dynamic_contract' as const;
  if (entry.canonicalValidationStage === 'local_merger') return 'local_merger' as const;
  if (entry.runtimeInvocations === 1 && entry.usageDisposition !== 'verified')
    return 'usage' as const;
  if (entry.latencyMs === null) return 'latency' as const;
  return 'provider_runtime' as const;
}

function mapNotStartedReason(entry: Readonly<Phase697V3CaseEntry>) {
  if (entry.executionOutcome === 'not_started_case_guard') {
    return entry.executionKind === 'zero_call'
      ? ('case_guard' as const)
      : ('quality_breaker' as const);
  }
  if (entry.executionOutcome === 'not_started_quality_breaker') return 'quality_breaker' as const;
  if (entry.executionOutcome === 'not_started_parent_abort') return 'parent_abort' as const;
  if (entry.executionOutcome === 'not_started_orphaned') return 'orphaned' as const;
  return null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return sameJson(actual, expected);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: object | null = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sha256Phase697V4Stable(value: unknown): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortStableValue(value)), 'utf8')
    .digest('hex')}`;
}

function sortStableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
