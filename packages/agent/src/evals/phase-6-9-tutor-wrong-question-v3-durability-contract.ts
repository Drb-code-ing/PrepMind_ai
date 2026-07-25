import { createHash } from 'node:crypto';

import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  type Phase69OrganizerRuntimeCase,
  type Phase69TutorRuntimeCase,
  type Phase69TutorWrongQuestionCase,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_CANONICAL_FAILURE_REASONS,
  PHASE_6_9_7_CANONICAL_VALIDATION_STAGES,
} from './phase-6-9-tutor-wrong-question-bounded-diagnostics.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
  PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
  PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V3_EXECUTION_OUTCOMES,
  PHASE_6_9_7_V3_LAST_COMPLETED_STAGES,
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  PHASE_6_9_7_V3_USAGE_DISPOSITIONS,
  buildPhase697TutorOrganizerV3Report,
  runtimeContractSuccess,
  type Phase697TutorOrganizerV3Report,
  type Phase697V3CaseEntry,
} from './phase-6-9-tutor-wrong-question-v3-contract.ts';

export const PHASE_6_9_7_V3_MARKER_VERSION = 'phase-6.9.7-v3-live-marker-v1' as const;
export const PHASE_6_9_7_V3_JOURNAL_VERSION = 'phase-6.9.7-v3-journal-v1' as const;
export const PHASE_6_9_7_V3_EVIDENCE_VERSION = 'phase-6.9.7-v3-evidence-envelope-v1' as const;
export const PHASE_6_9_7_V3_RECOVERY_CLAIM_VERSION = 'phase-6.9.7-v3-recovery-claim-v1' as const;
export const PHASE_6_9_7_V3_EVIDENCE_PREFIX = 'phase-6-9-7-tutor-organizer-v3' as const;
export const PHASE_6_9_7_V3_MARKER_PATH =
  '.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live.marker' as const;

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);
const finiteNonNegative = z.number().finite().nonnegative();
const safePositiveInteger = z.number().int().safe().positive();

export const PHASE_6_9_7_V3_MARKER_SCHEMA = z
  .object({
    markerVersion: z.literal(PHASE_6_9_7_V3_MARKER_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3),
    datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.literal('live'),
    executorProvenance: z.enum(['deepseek_network', 'synthetic_test']),
    ownerProcessId: z.number().int().safe().positive(),
    state: z.literal('attempt_reserved'),
  })
  .strict();

export type Phase697V3Marker = z.infer<typeof PHASE_6_9_7_V3_MARKER_SCHEMA>;

export const PHASE_6_9_7_V3_RECOVERY_CLAIM_SCHEMA = z
  .object({
    claimVersion: z.literal(PHASE_6_9_7_V3_RECOVERY_CLAIM_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3),
    runId: runIdSchema,
    ownerProcessId: z.number().int().safe().positive(),
    ownerToken: z.string().uuid(),
    state: z.literal('orphan_seal_claimed'),
  })
  .strict();

export type Phase697V3RecoveryClaimRecord = z.infer<typeof PHASE_6_9_7_V3_RECOVERY_CLAIM_SCHEMA>;

const caseUsageSchema = z
  .object({
    inputTokens: safePositiveInteger,
    outputTokens: safePositiveInteger,
    pricingKnown: z.literal(true),
    currency: z.literal('CNY'),
    pricingProfile: z.string().min(1).max(96),
    estimatedCostCny: z.number().finite().positive(),
  })
  .strict();

const tutorActualSchema = z
  .object({
    intent: z.string().min(1).max(48),
    depth: z.string().min(1).max(48),
    contextUse: z.boolean(),
    guidingQuestion: z.boolean(),
    finalAnswer: z.boolean(),
    answerStructure: z.array(z.string().min(1).max(48)).max(6),
  })
  .strict();

const organizerActualSchema = z
  .object({
    decisionIndex: z.number().int().min(0).max(11),
    actualSubject: z.string().min(1).max(48).nullable(),
    actualDeckAction: z.string().min(1).max(48).nullable(),
    actualDeckIndex: z.number().int().min(0).max(19).nullable(),
    actualTopicClass: z.enum(['canonical', 'unexpected']).nullable(),
    actualConfidence: z.string().min(1).max(48).nullable(),
    actualEvidenceCodes: z.array(z.string().min(1).max(64)).max(5),
    validOutput: z.boolean(),
  })
  .strict();

export const PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA = z
  .object({
    caseId: caseIdSchema,
    agent: agentSchema,
    executionKind: z.enum(['zero_call', 'runtime']),
    pairedRunIndex: pairedRunIndexSchema.nullable(),
    runtimeInvocations: z.union([z.literal(0), z.literal(1)]),
    observedZeroCallReason: z.string().min(1).max(64).nullable(),
    zeroCallVerified: z.boolean(),
    rawSchemaValid: z.boolean().nullable(),
    candidateDisposition: z.string().min(1).max(64).nullable(),
    canonicalSchemaSuccess: z.boolean(),
    canonicalValidationStage: z.enum(PHASE_6_9_7_CANONICAL_VALIDATION_STAGES).nullable(),
    canonicalFailureReason: z.enum(PHASE_6_9_7_CANONICAL_FAILURE_REASONS).nullable(),
    strictRuntimeSuccess: z.boolean(),
    criticalFailure: z.boolean(),
    permissionFailure: z.boolean(),
    mutationFailure: z.boolean(),
    broaderThanDeterministicFallback: z.boolean(),
    latencyMs: finiteNonNegative.nullable(),
    tutorOrchestrationLatencyMs: finiteNonNegative.nullable(),
    usage: caseUsageSchema.nullable(),
    tutorActual: tutorActualSchema.nullable(),
    organizerActuals: z.array(organizerActualSchema).max(12),
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION),
    providerFailureCategory: z.enum(MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES).nullable(),
    structuredOutputStage: z.enum(MODEL_AGENT_STRUCTURED_OUTPUT_STAGES).nullable(),
    lastCompletedStage: z.enum(PHASE_6_9_7_V3_LAST_COMPLETED_STAGES).nullable(),
    executionOutcome: z.enum(PHASE_6_9_7_V3_EXECUTION_OUTCOMES),
    usageDisposition: z.enum(PHASE_6_9_7_V3_USAGE_DISPOSITIONS),
    dispatchRecorded: z.boolean(),
    runtimeTerminalRecorded: z.boolean(),
    terminalEntrySha256: sha256Schema,
  })
  .strict();

export type Phase697V3TerminalProjection = z.infer<
  typeof PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA
>;

const journalPayloadSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('journal_initialized'),
      markerSha256: sha256Schema,
      runScope: z.enum(['branch', 'main']),
      mode: z.literal('live'),
      datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guard_terminal'),
      terminal: PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('dispatch_started'),
      caseId: caseIdSchema,
      agent: agentSchema,
      pairedRunIndex: pairedRunIndexSchema,
      dispatchKeySha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('runtime_terminal'),
      dispatchKeySha256: sha256Schema,
      terminal: PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('pair_terminal'),
      pairedRunIndex: pairedRunIndexSchema,
      pairedLatencyMs: finiteNonNegative.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('breaker_opened'),
      breakerState: z.enum(['guard_failed', 'quality_gate_impossible']),
      triggerCaseId: caseIdSchema,
      triggerAgent: agentSchema,
      triggerPairedRunIndex: pairedRunIndexSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('run_completed'),
      reportSha256: sha256Schema,
      gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('evidence_sealed'),
      disposition: z.enum(['completed_run', 'orphan_sealed', 'journal_missing_sealed']),
      sealedFromJournalSha256: sha256Schema.nullable(),
      evidenceSha256: sha256Schema,
    })
    .strict(),
]);

export type Phase697V3JournalPayload = z.infer<typeof journalPayloadSchema>;

export const PHASE_6_9_7_V3_JOURNAL_RECORD_SCHEMA = z
  .object({
    journalVersion: z.literal(PHASE_6_9_7_V3_JOURNAL_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3),
    runId: runIdSchema,
    sequence: z.number().int().safe().nonnegative(),
    previousRecordSha256: sha256Schema.nullable(),
    payload: journalPayloadSchema,
    recordSha256: sha256Schema,
  })
  .strict();

export type Phase697V3JournalRecord = z.infer<typeof PHASE_6_9_7_V3_JOURNAL_RECORD_SCHEMA>;

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

export const PHASE_6_9_7_V3_EVIDENCE_ENVELOPE_SCHEMA = z
  .object({
    evidenceVersion: z.literal(PHASE_6_9_7_V3_EVIDENCE_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3),
    runId: runIdSchema,
    runScope: z.enum(['branch', 'main']),
    mode: z.enum(['mock', 'live']),
    durability: durabilitySchema,
    reportSha256: sha256Schema,
    report: PHASE_6_9_7_TUTOR_ORGANIZER_V3_REPORT_SCHEMA,
  })
  .strict()
  .superRefine((value, context) => {
    const identityMatches =
      value.runId === value.report.runId &&
      value.runScope === value.report.runScope &&
      value.mode === value.report.mode &&
      value.reportSha256 === sha256Stable(value.report);
    if (!identityMatches) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V3 evidence identity mismatch' });
    }
    if (value.durability.disposition === 'mock_direct') {
      if (
        value.mode !== 'mock' ||
        value.durability.markerSha256 !== null ||
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'V3 mock durability mismatch' });
      }
      return;
    }
    if (value.mode !== 'live' || value.durability.markerSha256 === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V3 live durability mismatch' });
    }
    if (value.durability.disposition === 'journal_missing_sealed') {
      if (
        value.durability.journalTailSha256 !== null ||
        value.durability.journalSequence !== null ||
        value.report.gate !== 'quality_gate_failed'
      ) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'V3 missing journal mismatch' });
      }
      return;
    }
    if (
      value.durability.journalTailSha256 === null ||
      value.durability.journalSequence === null ||
      (value.durability.disposition === 'orphan_sealed' &&
        value.report.gate !== 'quality_gate_failed')
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'V3 journal durability mismatch' });
    }
  });

export type Phase697V3EvidenceEnvelope = z.infer<typeof PHASE_6_9_7_V3_EVIDENCE_ENVELOPE_SCHEMA>;

export type Phase697V3ValidatedJournal = Readonly<{
  records: readonly Phase697V3JournalRecord[];
  runId: string;
  runScope: 'branch' | 'main';
  markerSha256: string;
  tailSha256: string;
  lastSequence: number;
  guardTerminals: ReadonlyMap<string, Phase697V3CaseEntry>;
  dispatches: ReadonlyMap<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >;
  runtimeTerminals: ReadonlyMap<string, Phase697V3CaseEntry>;
  pairedLatencies: ReadonlyMap<number, number | null>;
  runCompleted: Readonly<{
    reportSha256: string;
    gate: 'quality_gate_passed' | 'quality_gate_failed';
  }> | null;
  sealed: Extract<Phase697V3JournalPayload, { kind: 'evidence_sealed' }> | null;
}>;

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortStableValue(value));
}

export function sha256Stable(value: unknown): `sha256:${string}` {
  return sha256Bytes(stableJsonStringify(value));
}

export function sha256Bytes(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function buildPhase697V3Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'deepseek_network' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V3Marker {
  return PHASE_6_9_7_V3_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V3_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'deepseek_network',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function phase697V3JournalPath(runId: string): string {
  if (!runIdSchema.safeParse(runId).success) throw new Error('PHASE_6_9_7_V3_RUN_ID_INVALID');
  return `.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live-${runId}.journal.jsonl`;
}

export function phase697V3RecoveryClaimPath(runId: string): string {
  if (!runIdSchema.safeParse(runId).success) throw new Error('PHASE_6_9_7_V3_RUN_ID_INVALID');
  return `.tmp/phase-6-9-7-tutor-organizer-v3-controlled-live-${runId}.recovery.claim`;
}

export function phase697V3EvidencePath(input: {
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  runId: string;
}): string {
  if (!runIdSchema.safeParse(input.runId).success) throw new Error('PHASE_6_9_7_V3_RUN_ID_INVALID');
  return `.tmp/${PHASE_6_9_7_V3_EVIDENCE_PREFIX}-${input.runScope}-${input.mode}-${input.runId}.json`;
}

export function phase697V3DispatchKeySha256(input: {
  runId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
}): `sha256:${string}` {
  return sha256Stable(input);
}

export function projectPhase697V3TerminalEntry(
  entry: Readonly<Phase697V3CaseEntry>,
): Readonly<Phase697V3TerminalProjection> | null {
  const expected = findCanonicalCase(entry.caseId);
  if (!expected) return null;
  const organizerActuals = entry.organizerDecisions.map((decision) => {
    const topicClass =
      decision.actualTopicLabelClass === null
        ? null
        : decision.actualTopicLabelClass === decision.canonicalTopicLabel
          ? ('canonical' as const)
          : decision.actualTopicLabelClass === '__unexpected__'
            ? ('unexpected' as const)
            : undefined;
    if (topicClass === undefined) return null;
    return {
      decisionIndex: decision.decisionIndex,
      actualSubject: decision.actualSubject,
      actualDeckAction: decision.actualDeckAction,
      actualDeckIndex: decision.actualDeckIndex,
      actualTopicClass: topicClass,
      actualConfidence: decision.actualConfidence,
      actualEvidenceCodes: [...decision.actualEvidenceCodes],
      validOutput: decision.validOutput,
    };
  });
  if (organizerActuals.some((entry) => entry === null)) return null;
  const parsed = PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA.safeParse({
    caseId: entry.caseId,
    agent: entry.agent,
    executionKind: entry.executionKind,
    pairedRunIndex: entry.pairedRunIndex,
    runtimeInvocations: entry.runtimeInvocations,
    observedZeroCallReason: entry.observedZeroCallReason,
    zeroCallVerified: entry.zeroCallVerified,
    rawSchemaValid: entry.rawSchemaValid,
    candidateDisposition: entry.candidateDisposition,
    canonicalSchemaSuccess: entry.canonicalSchemaSuccess,
    canonicalValidationStage: entry.canonicalValidationStage,
    canonicalFailureReason: entry.canonicalFailureReason,
    strictRuntimeSuccess: entry.strictRuntimeSuccess,
    criticalFailure: entry.criticalFailure,
    permissionFailure: entry.permissionFailure,
    mutationFailure: entry.mutationFailure,
    broaderThanDeterministicFallback: entry.broaderThanDeterministicFallback,
    latencyMs: entry.latencyMs,
    tutorOrchestrationLatencyMs: entry.tutorOrchestrationLatencyMs,
    usage: entry.usage,
    tutorActual: entry.tutorActual,
    organizerActuals,
    runtimeEvidenceVersion: entry.runtimeEvidenceVersion,
    providerFailureCategory: entry.providerFailureCategory,
    structuredOutputStage: entry.structuredOutputStage,
    lastCompletedStage: entry.lastCompletedStage,
    executionOutcome: entry.executionOutcome,
    usageDisposition: entry.usageDisposition,
    dispatchRecorded: entry.dispatchRecorded,
    runtimeTerminalRecorded: entry.runtimeTerminalRecorded,
    terminalEntrySha256: sha256Stable(entry),
  });
  if (!parsed.success) return null;
  return restorePhase697V3TerminalEntry(parsed.data) ? Object.freeze(parsed.data) : null;
}

export function restorePhase697V3TerminalEntry(
  projection: unknown,
): Readonly<Phase697V3CaseEntry> | null {
  const parsed = PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA.safeParse(projection);
  if (!parsed.success) return null;
  const value = parsed.data;
  const expected = findCanonicalCase(value.caseId);
  if (
    !expected ||
    expected.agent !== value.agent ||
    (expected.expectedRuntimeInvocations === 0) !== (value.executionKind === 'zero_call')
  ) {
    return null;
  }
  const { terminalEntrySha256, organizerActuals, ...bounded } = value;
  let expectedProjection: Readonly<Record<string, unknown>>;
  if (expected.expectedRuntimeInvocations === 0) {
    if (
      value.pairedRunIndex !== null ||
      value.tutorActual !== null ||
      organizerActuals.length !== 0
    ) {
      return null;
    }
    expectedProjection = { tutorExpected: null, organizerDecisions: [] };
  } else if (expected.agent === 'tutor') {
    if (value.pairedRunIndex !== expected.pairedRunIndex || organizerActuals.length !== 0) {
      return null;
    }
    expectedProjection = {
      tutorExpected: {
        ...expected.expected,
        answerStructure: [...expected.expected.answerStructure],
      },
      organizerDecisions: [],
    };
  } else {
    if (
      value.pairedRunIndex !== expected.pairedRunIndex ||
      value.tutorActual !== null ||
      organizerActuals.length !== expected.expected.decisions.length
    ) {
      return null;
    }
    const actualByIndex = new Map(organizerActuals.map((entry) => [entry.decisionIndex, entry]));
    if (actualByIndex.size !== organizerActuals.length) return null;
    expectedProjection = {
      tutorExpected: null,
      organizerDecisions: expected.expected.decisions.map((decision) => {
        const actual = actualByIndex.get(decision.questionIndex);
        if (!actual) throw new Error('PHASE_6_9_7_V3_TERMINAL_DECISION_MISSING');
        return {
          decisionIndex: decision.questionIndex,
          expectedSubject: decision.subject,
          actualSubject: actual.actualSubject,
          expectedDeckAction: decision.deckAction,
          actualDeckAction: actual.actualDeckAction,
          expectedDeckIndex: decision.deckIndex ?? null,
          actualDeckIndex: actual.actualDeckIndex,
          canonicalTopicLabel: decision.canonicalTopicLabel,
          actualTopicLabelClass:
            actual.actualTopicClass === null
              ? null
              : actual.actualTopicClass === 'canonical'
                ? decision.canonicalTopicLabel
                : '__unexpected__',
          expectedConfidence: decision.confidence,
          actualConfidence: actual.actualConfidence,
          requiredEvidenceCodes: [...decision.requiredEvidenceCodes],
          allowedEvidenceCodes: [...decision.allowedEvidenceCodes],
          actualEvidenceCodes: [...actual.actualEvidenceCodes],
          validOutput: actual.validOutput,
        };
      }),
    };
  }
  try {
    const restored = PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse({ ...bounded, ...expectedProjection });
    return sha256Stable(restored) === terminalEntrySha256 ? Object.freeze(restored) : null;
  } catch {
    return null;
  }
}

export function buildPhase697V3JournalRecord(input: {
  runId: string;
  sequence: number;
  previousRecordSha256: string | null;
  payload: Phase697V3JournalPayload;
}): Phase697V3JournalRecord {
  const withoutHash = {
    journalVersion: PHASE_6_9_7_V3_JOURNAL_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
    runId: input.runId,
    sequence: input.sequence,
    previousRecordSha256: input.previousRecordSha256,
    payload: input.payload,
  };
  return PHASE_6_9_7_V3_JOURNAL_RECORD_SCHEMA.parse({
    ...withoutHash,
    recordSha256: sha256Stable(withoutHash),
  });
}

export function parseAndValidatePhase697V3Journal(text: string): Phase697V3ValidatedJournal | null {
  if (typeof text !== 'string' || text.length === 0 || !text.endsWith('\n')) return null;
  const lines = text.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0 || line.length > 65_536))
    return null;
  const records: Phase697V3JournalRecord[] = [];
  try {
    for (const line of lines) {
      const parsed = PHASE_6_9_7_V3_JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line) as unknown);
      const { recordSha256, ...withoutHash } = parsed;
      if (sha256Stable(withoutHash) !== recordSha256) return null;
      records.push(parsed);
    }
  } catch {
    return null;
  }
  const first = records[0];
  if (!first || first.payload.kind !== 'journal_initialized' || first.sequence !== 0) return null;
  const runId = first.runId;
  const guards = new Map<string, Phase697V3CaseEntry>();
  const dispatches = new Map<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >();
  const terminals = new Map<string, Phase697V3CaseEntry>();
  const pairLatencies = new Map<number, number | null>();
  let breaker: Extract<Phase697V3JournalPayload, { kind: 'breaker_opened' }> | null = null;
  let runCompleted: Phase697V3ValidatedJournal['runCompleted'] = null;
  let sealed: Phase697V3ValidatedJournal['sealed'] = null;
  let previous: string | null = null;
  for (const [index, record] of records.entries()) {
    if (
      record.runId !== runId ||
      record.sequence !== index ||
      record.previousRecordSha256 !== previous ||
      (index > 0 && record.payload.kind === 'journal_initialized') ||
      sealed !== null
    ) {
      return null;
    }
    previous = record.recordSha256;
    const payload = record.payload;
    if (payload.kind === 'guard_terminal') {
      const terminal = restorePhase697V3TerminalEntry(payload.terminal);
      if (
        dispatches.size > 0 ||
        breaker !== null ||
        runCompleted !== null ||
        !terminal ||
        terminal.executionKind !== 'zero_call' ||
        terminal.dispatchRecorded ||
        terminal.runtimeTerminalRecorded ||
        guards.has(terminal.caseId)
      ) {
        return null;
      }
      guards.set(terminal.caseId, terminal);
    } else if (payload.kind === 'dispatch_started') {
      const expectedKey = phase697V3DispatchKeySha256({
        runId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
      const expectedCase = findCanonicalRuntimeCase(payload.agent, payload.pairedRunIndex);
      const expectedPairIndex = pairLatencies.size;
      if (
        breaker !== null ||
        runCompleted !== null ||
        guards.size !== 24 ||
        [...guards.values()].some((entry) => !entry.zeroCallVerified) ||
        payload.pairedRunIndex !== expectedPairIndex ||
        payload.dispatchKeySha256 !== expectedKey ||
        payload.caseId !== expectedCase?.id ||
        dispatches.has(expectedKey)
      ) {
        return null;
      }
      dispatches.set(expectedKey, {
        caseId: payload.caseId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
    } else if (payload.kind === 'runtime_terminal') {
      const dispatch = dispatches.get(payload.dispatchKeySha256);
      const terminal = restorePhase697V3TerminalEntry(payload.terminal);
      if (
        breaker !== null ||
        runCompleted !== null ||
        !dispatch ||
        !terminal ||
        terminal.caseId !== dispatch.caseId ||
        !terminal.dispatchRecorded ||
        !terminal.runtimeTerminalRecorded ||
        terminals.has(payload.dispatchKeySha256)
      ) {
        return null;
      }
      terminals.set(payload.dispatchKeySha256, terminal);
    } else if (payload.kind === 'pair_terminal') {
      const pairDispatches = [...dispatches.entries()].filter(
        ([, dispatch]) => dispatch.pairedRunIndex === payload.pairedRunIndex,
      );
      const pairTerminals = pairDispatches.flatMap(([key]) => {
        const terminal = terminals.get(key);
        return terminal ? [terminal] : [];
      });
      const terminalLatencies = pairTerminals.map((entry) => entry.latencyMs);
      const expectedLatencyPresent = terminalLatencies.every((entry) => entry !== null);
      if (
        breaker !== null ||
        runCompleted !== null ||
        payload.pairedRunIndex !== pairLatencies.size ||
        pairLatencies.has(payload.pairedRunIndex) ||
        pairDispatches.length !== 2 ||
        pairTerminals.length !== 2 ||
        (expectedLatencyPresent
          ? payload.pairedLatencyMs === null ||
            payload.pairedLatencyMs < Math.max(...terminalLatencies)
          : payload.pairedLatencyMs !== null)
      ) {
        return null;
      }
      pairLatencies.set(payload.pairedRunIndex, payload.pairedLatencyMs);
    } else if (payload.kind === 'breaker_opened') {
      if (breaker !== null || runCompleted !== null || guards.size !== 24) return null;
      if (payload.breakerState === 'guard_failed') {
        const trigger = guards.get(payload.triggerCaseId);
        if (
          dispatches.size !== 0 ||
          !trigger ||
          trigger.zeroCallVerified ||
          trigger.agent !== payload.triggerAgent ||
          payload.triggerPairedRunIndex !== null
        ) {
          return null;
        }
      } else {
        const trigger = [...terminals.values()].find(
          (entry) => entry.caseId === payload.triggerCaseId,
        );
        if (
          [...guards.values()].some((entry) => !entry.zeroCallVerified) ||
          !trigger ||
          runtimeContractSuccess(trigger) ||
          trigger.agent !== payload.triggerAgent ||
          trigger.pairedRunIndex !== payload.triggerPairedRunIndex ||
          payload.triggerPairedRunIndex === null ||
          !pairLatencies.has(payload.triggerPairedRunIndex)
        ) {
          return null;
        }
      }
      breaker = payload;
    } else if (payload.kind === 'run_completed') {
      const guardFailure = [...guards.values()].some((entry) => !entry.zeroCallVerified);
      const runtimeFailure = [...terminals.values()].some(
        (entry) => !runtimeContractSuccess(entry),
      );
      if (
        runCompleted ||
        guards.size !== 24 ||
        (guardFailure && breaker?.breakerState !== 'guard_failed') ||
        (!guardFailure && runtimeFailure && breaker?.breakerState !== 'quality_gate_impossible') ||
        (!guardFailure &&
          !runtimeFailure &&
          (breaker !== null ||
            dispatches.size !== 48 ||
            terminals.size !== 48 ||
            pairLatencies.size !== 24)) ||
        (!guardFailure && breaker?.breakerState === 'guard_failed')
      ) {
        return null;
      }
      runCompleted = { reportSha256: payload.reportSha256, gate: payload.gate };
    } else if (payload.kind === 'evidence_sealed') {
      if (payload.sealedFromJournalSha256 !== record.previousRecordSha256) return null;
      sealed = payload;
    }
  }
  return Object.freeze({
    records: Object.freeze(records),
    runId,
    runScope: first.payload.runScope,
    markerSha256: first.payload.markerSha256,
    tailSha256: records.at(-1)!.recordSha256,
    lastSequence: records.length - 1,
    guardTerminals: guards,
    dispatches,
    runtimeTerminals: terminals,
    pairedLatencies: pairLatencies,
    runCompleted,
    sealed,
  });
}

export function buildPhase697V3SealedReport(input: {
  marker: Readonly<Phase697V3Marker>;
  markerSha256: string;
  journal: Readonly<Phase697V3ValidatedJournal> | null;
}): Readonly<Phase697TutorOrganizerV3Report> | null {
  if (
    !sha256Schema.safeParse(input.markerSha256).success ||
    (input.journal !== null &&
      (input.journal.runId !== input.marker.runId ||
        input.journal.runScope !== input.marker.runScope ||
        input.journal.markerSha256 !== input.markerSha256))
  ) {
    return null;
  }
  const caseEntries: Phase697V3CaseEntry[] = [];
  const terminalByCaseId = new Map<string, Phase697V3CaseEntry>();
  if (input.journal) {
    for (const terminal of input.journal.guardTerminals.values()) {
      terminalByCaseId.set(terminal.caseId, terminal);
    }
    for (const terminal of input.journal.runtimeTerminals.values()) {
      terminalByCaseId.set(terminal.caseId, terminal);
    }
  }
  const dispatchedCaseIds = new Set(
    [...(input.journal?.dispatches.values() ?? [])].map((dispatch) => dispatch.caseId),
  );
  const canonicalReportOrder = [
    ...PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.filter(
      (entry) => entry.expectedRuntimeInvocations === 0,
    ),
    ...Array.from({ length: 24 }, (_, pairedRunIndex) => [
      findCanonicalRuntimeCase('tutor', pairedRunIndex),
      findCanonicalRuntimeCase('wrong_question_organizer', pairedRunIndex),
    ]).flat(),
  ];
  for (const expected of canonicalReportOrder) {
    if (!expected) return null;
    const terminal = terminalByCaseId.get(expected.id);
    if (terminal) {
      caseEntries.push(terminal);
      continue;
    }
    if (expected.expectedRuntimeInvocations === 0) {
      caseEntries.push(buildMissingGuardEntry(expected));
    } else if (dispatchedCaseIds.has(expected.id)) {
      caseEntries.push(buildOrphanedRuntimeEntry(expected));
    } else {
      caseEntries.push(buildNotStartedOrphanedEntry(expected));
    }
  }
  const firstGuardFailure = caseEntries.find(
    (entry) => entry.executionKind === 'zero_call' && !entry.zeroCallVerified,
  );
  const firstRuntimeFailure = caseEntries.find(
    (entry) => entry.executionKind === 'runtime' && !runtimeContractSuccess(entry),
  );
  const trigger = firstGuardFailure ?? firstRuntimeFailure ?? null;
  const dispatches = [...(input.journal?.dispatches.values() ?? [])];
  const dispatchedPairs = new Set(dispatches.map((entry) => entry.pairedRunIndex));
  const runtimeTerminalCaseIds = new Set(
    [...(input.journal?.runtimeTerminals.values() ?? [])].map((entry) => entry.caseId),
  );
  const completedPairs = new Set(
    [...dispatchedPairs].filter(
      (pairedRunIndex) =>
        dispatches
          .filter((entry) => entry.pairedRunIndex === pairedRunIndex)
          .every((entry) => runtimeTerminalCaseIds.has(entry.caseId)) &&
        dispatches.filter((entry) => entry.pairedRunIndex === pairedRunIndex).length === 2,
    ),
  );
  const pairedCandidateSamplesMs = [...(input.journal?.pairedLatencies.entries() ?? [])]
    .sort(([left], [right]) => left - right)
    .flatMap(([, latency]) => (latency === null ? [] : [latency]));
  try {
    const report = buildPhase697TutorOrganizerV3Report({
      runId: input.marker.runId,
      runScope: input.marker.runScope,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      executorProvenance: input.marker.executorProvenance,
      caseEntries,
      pairedCandidateSamplesMs,
      scheduler: {
        guardPhasePassed: firstGuardFailure === undefined,
        breakerState: firstGuardFailure
          ? 'guard_failed'
          : firstRuntimeFailure
            ? 'quality_gate_impossible'
            : 'closed',
        triggerCaseId: trigger?.caseId ?? null,
        triggerAgent: trigger?.agent ?? null,
        triggerPairedRunIndex: trigger?.executionKind === 'runtime' ? trigger.pairedRunIndex : null,
        dispatchedPairs: dispatchedPairs.size,
        completedPairs: completedPairs.size,
        maxConcurrentPairs: dispatchedPairs.size > 0 ? 1 : 0,
        maxConcurrentLaneOperations:
          dispatchedPairs.size === 0
            ? 0
            : Math.max(
                ...[...dispatchedPairs].map(
                  (index) => dispatches.filter((entry) => entry.pairedRunIndex === index).length,
                ),
              ),
      },
      ledger: {
        reservedEntries: dispatches.length,
        terminalEntries: input.journal?.runtimeTerminals.size ?? 0,
      },
    });
    if (
      input.journal?.runCompleted &&
      (input.journal.runCompleted.reportSha256 !== sha256Stable(report) ||
        input.journal.runCompleted.gate !== report.gate)
    ) {
      return null;
    }
    return report;
  } catch {
    return null;
  }
}

export function buildPhase697V3EvidenceEnvelope(input: {
  report: Readonly<Phase697TutorOrganizerV3Report>;
  disposition: Phase697V3EvidenceEnvelope['durability']['disposition'];
  markerSha256: string | null;
  journalTailSha256: string | null;
  journalSequence: number | null;
}): Readonly<Phase697V3EvidenceEnvelope> {
  return PHASE_6_9_7_V3_EVIDENCE_ENVELOPE_SCHEMA.parse({
    evidenceVersion: PHASE_6_9_7_V3_EVIDENCE_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V3,
    runId: input.report.runId,
    runScope: input.report.runScope,
    mode: input.report.mode,
    durability: {
      disposition: input.disposition,
      markerSha256: input.markerSha256,
      journalTailSha256: input.journalTailSha256,
      journalSequence: input.journalSequence,
    },
    reportSha256: sha256Stable(input.report),
    report: input.report,
  });
}

function buildMissingGuardEntry(
  expected: Extract<Phase69TutorWrongQuestionCase, { expectedRuntimeInvocations: 0 }>,
): Phase697V3CaseEntry {
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse({
    caseId: expected.id,
    agent: expected.agent,
    executionKind: 'zero_call',
    pairedRunIndex: null,
    runtimeInvocations: 0,
    observedZeroCallReason: 'guard_mismatch',
    zeroCallVerified: false,
    rawSchemaValid: null,
    candidateDisposition: null,
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    criticalFailure: true,
    permissionFailure: false,
    mutationFailure: false,
    broaderThanDeterministicFallback: false,
    latencyMs: null,
    tutorOrchestrationLatencyMs: null,
    usage: null,
    tutorExpected: null,
    tutorActual: null,
    organizerDecisions: [],
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: null,
    executionOutcome: 'not_started_case_guard',
    usageDisposition: 'absent_not_attempted',
    dispatchRecorded: false,
    runtimeTerminalRecorded: false,
  });
}

function buildOrphanedRuntimeEntry(
  expected: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
): Phase697V3CaseEntry {
  return buildSyntheticRuntimeEntry(expected, {
    runtimeInvocations: 1,
    rawSchemaValid: false,
    candidateDisposition: 'fallback_runtime_error',
    executionOutcome: 'attempted_orphaned',
    usageDisposition: 'unknown_after_attempt',
    dispatchRecorded: true,
    runtimeTerminalRecorded: false,
  });
}

function buildNotStartedOrphanedEntry(
  expected: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
): Phase697V3CaseEntry {
  return buildSyntheticRuntimeEntry(expected, {
    runtimeInvocations: 0,
    rawSchemaValid: null,
    candidateDisposition: null,
    executionOutcome: 'not_started_orphaned',
    usageDisposition: 'absent_not_attempted',
    dispatchRecorded: false,
    runtimeTerminalRecorded: false,
  });
}

function buildSyntheticRuntimeEntry(
  expected: Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase,
  state: Readonly<{
    runtimeInvocations: 0 | 1;
    rawSchemaValid: boolean | null;
    candidateDisposition: 'fallback_runtime_error' | null;
    executionOutcome: 'attempted_orphaned' | 'not_started_orphaned';
    usageDisposition: 'unknown_after_attempt' | 'absent_not_attempted';
    dispatchRecorded: boolean;
    runtimeTerminalRecorded: boolean;
  }>,
): Phase697V3CaseEntry {
  return PHASE_6_9_7_V3_CASE_ENTRY_SCHEMA.parse({
    caseId: expected.id,
    agent: expected.agent,
    executionKind: 'runtime',
    pairedRunIndex: expected.pairedRunIndex,
    runtimeInvocations: state.runtimeInvocations,
    observedZeroCallReason: null,
    zeroCallVerified: false,
    rawSchemaValid: state.rawSchemaValid,
    candidateDisposition: state.candidateDisposition,
    canonicalSchemaSuccess: false,
    canonicalValidationStage: null,
    canonicalFailureReason: null,
    strictRuntimeSuccess: false,
    criticalFailure: false,
    permissionFailure: false,
    mutationFailure: false,
    broaderThanDeterministicFallback: false,
    latencyMs: null,
    tutorOrchestrationLatencyMs: null,
    usage: null,
    tutorExpected:
      expected.agent === 'tutor'
        ? { ...expected.expected, answerStructure: [...expected.expected.answerStructure] }
        : null,
    tutorActual: null,
    organizerDecisions:
      expected.agent === 'wrong_question_organizer'
        ? expected.expected.decisions.map((decision) => ({
            decisionIndex: decision.questionIndex,
            expectedSubject: decision.subject,
            actualSubject: null,
            expectedDeckAction: decision.deckAction,
            actualDeckAction: null,
            expectedDeckIndex: decision.deckIndex ?? null,
            actualDeckIndex: null,
            canonicalTopicLabel: decision.canonicalTopicLabel,
            actualTopicLabelClass: null,
            expectedConfidence: decision.confidence,
            actualConfidence: null,
            requiredEvidenceCodes: [...decision.requiredEvidenceCodes],
            allowedEvidenceCodes: [...decision.allowedEvidenceCodes],
            actualEvidenceCodes: [],
            validOutput: false,
          }))
        : [],
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    providerFailureCategory: null,
    structuredOutputStage: null,
    lastCompletedStage: null,
    executionOutcome: state.executionOutcome,
    usageDisposition: state.usageDisposition,
    dispatchRecorded: state.dispatchRecorded,
    runtimeTerminalRecorded: state.runtimeTerminalRecorded,
  });
}

function findCanonicalCase(caseId: string): Phase69TutorWrongQuestionCase | null {
  return PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find((entry) => entry.id === caseId) ?? null;
}

function findCanonicalRuntimeCase(
  agent: 'tutor' | 'wrong_question_organizer',
  pairedRunIndex: number,
): Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase | null {
  return (
    PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
      (entry): entry is Phase69TutorRuntimeCase | Phase69OrganizerRuntimeCase =>
        entry.expectedRuntimeInvocations === 1 &&
        entry.agent === agent &&
        entry.pairedRunIndex === pairedRunIndex,
    ) ?? null
  );
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V3_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V3_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V3_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}
