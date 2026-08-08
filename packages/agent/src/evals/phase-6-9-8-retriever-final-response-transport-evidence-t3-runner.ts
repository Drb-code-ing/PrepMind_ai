import { z } from 'zod';

import { deepFreezeModelValue } from '../model-candidates/model-projection-safety.ts';
import {
  parsePhase698TransportEvidenceDiagnostic,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  type Phase698TransportEvidenceDiagnostic,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  createPhase698TransportEvidenceFinalResponseCapability,
  recordPhase698TransportEvidenceFinalResponseObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-final-response.ts';
import {
  createPhase698TransportEvidenceQwenCapability,
  recordPhase698TransportEvidenceQwenObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-qwen.ts';
import {
  createPhase698TransportEvidenceRewriteCapability,
  recordPhase698TransportEvidenceRewriteObservation,
} from './phase-6-9-8-retriever-final-response-transport-evidence-rewrite.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_PROVIDER_CALLS,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_VERSION,
  type Phase698TransportEvidenceT3Slot,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_OUTCOMES = Object.freeze([
  'pass',
  'failure',
  'timeout',
  'abort',
] as const);
export type Phase698TransportEvidenceT3SlotOutcome =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_OUTCOMES)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BREAKER_REASONS = Object.freeze([
  'none',
  'synthetic_failure',
  'synthetic_timeout',
  'external_abort',
  'budget_exceeded',
  'input_invalid',
] as const);
export type Phase698TransportEvidenceT3BreakerReason =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BREAKER_REASONS)[number];

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_SPECS = deepFreezeModelValue([
  {
    slot: 'rewrite' as const,
    provider: 'deepseek' as const,
    maxInputTokens: 1_200,
    maxOutputTokens: 160,
    maxCostCny: 0.005,
    hardTimeoutMs: 4_000,
  },
  {
    slot: 'qwen' as const,
    provider: 'qwen' as const,
    maxInputTokens: 8_192,
    maxOutputTokens: 0,
    maxCostCny: 0.004096,
    hardTimeoutMs: 5_500,
  },
  {
    slot: 'final_response' as const,
    provider: 'deepseek' as const,
    maxInputTokens: 2_500,
    maxOutputTokens: 1_200,
    maxCostCny: 0.015,
    hardTimeoutMs: 20_000,
  },
] as const);

const ZERO_WIRE = Object.freeze({
  reservations: 0 as const,
  dispatches: 0 as const,
  harnessReturns: 0 as const,
  verifiedResults: 0 as const,
});
const ZERO_PROVIDER_WIRE = Object.freeze({
  executions: 0 as const,
  dispatches: 0 as const,
  responses: 0 as const,
  verifiedUsage: 0 as const,
});
const ATTEMPTED_RUNNER_WIRE = Object.freeze({
  reservations: 1 as const,
  dispatches: 0 as const,
  harnessReturns: 0 as const,
  verifiedResults: 0 as const,
});

const SLOT_RESULT_SCHEMA = z
  .object({
    slot: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER),
    sequence: z.number().int().min(1).max(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_PROVIDER_CALLS),
    outcome: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_OUTCOMES),
    disposition: z.enum([
      'synthetic_checked',
      'synthetic_failed',
      'not_started_quality_breaker',
      'not_started_external_abort',
    ]),
    failureCode: z.enum(['synthetic_failure', 'synthetic_timeout', 'aborted']).nullable(),
    diagnostic: PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA.nullable(),
    runnerWire: z
      .object({
        reservations: z.union([z.literal(0), z.literal(1)]),
        dispatches: z.union([z.literal(0), z.literal(1)]),
        harnessReturns: z.union([z.literal(0), z.literal(1)]),
        verifiedResults: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    providerWire: z
      .object({
        executions: z.union([z.literal(0), z.literal(1)]),
        dispatches: z.union([z.literal(0), z.literal(1)]),
        responses: z.union([z.literal(0), z.literal(1)]),
        verifiedUsage: z.union([z.literal(0), z.literal(1)]),
      })
      .strict(),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    rawDataRetained: z.literal(false),
  })
  .strict();
const OUTCOME_SCHEMA = z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_OUTCOMES);

export type Phase698TransportEvidenceT3SlotResult = z.infer<typeof SLOT_RESULT_SCHEMA>;

const BREAKER_SCHEMA = z
  .object({
    open: z.boolean(),
    reason: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_BREAKER_REASONS),
    openedAtSequence: z.number().int().min(1).max(3).nullable(),
  })
  .strict();

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY),
    qualityAuthority: z.literal('none'),
    gate: z.enum([
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
    ]),
    passed: z.boolean(),
    slotCount: z.literal(3),
    startedSlots: z.number().int().min(0).max(3),
    completedSlots: z.number().int().min(0).max(3),
    notStartedQualityBreaker: z.number().int().min(0).max(3),
    notStartedExternalAbort: z.number().int().min(0).max(3),
    syntheticCalls: z.number().int().min(0).max(3),
    providerCalls: z.literal(0),
    credentialReads: z.literal(0),
    formalEvidence: z.literal(0),
    productWrites: z.literal(0),
    traceWrites: z.literal(0),
    requestedBudgetCny: z.number().nonnegative().finite().nullable(),
    budgetCnyMax: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY),
    breaker: BREAKER_SCHEMA,
    slotOrder: z.array(z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER)).length(3),
    slots: z.array(SLOT_RESULT_SCHEMA).length(3),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((report, context) => {
    if (
      report.slotOrder.some(
        (slot, index) => slot !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER[index],
      )
    ) {
      context.addIssue({ code: 'custom', message: 'slot order mismatch' });
    }
    if (
      report.slots.some(
        (slot, index) => slot.slot !== report.slotOrder[index] || slot.sequence !== index + 1,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'slot sequence mismatch' });
    }
    const started = report.slots.filter(
      (slot) => slot.disposition === 'synthetic_checked' || slot.disposition === 'synthetic_failed',
    ).length;
    const completed = report.slots.filter(
      (slot) =>
        slot.disposition !== 'not_started_quality_breaker' &&
        slot.disposition !== 'not_started_external_abort',
    ).length;
    if (
      report.startedSlots !== started ||
      report.completedSlots !== completed ||
      report.syntheticCalls !== started
    ) {
      context.addIssue({ code: 'custom', message: 'slot accounting mismatch' });
    }
    if (
      report.slots.some(
        (slot) =>
          slot.providerCalls !== 0 ||
          slot.credentialReads !== 0 ||
          Object.values(slot.providerWire).some(Boolean),
      )
    ) {
      context.addIssue({ code: 'custom', message: 'provider boundary crossed' });
    }
    if (report.passed !== (report.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE)) {
      context.addIssue({ code: 'custom', message: 'gate mismatch' });
    }
  });
export type Phase698TransportEvidenceT3Report = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_REPORT_SCHEMA
>;

export type Phase698TransportEvidenceT3ZeroProviderInput = Readonly<{
  signal?: AbortSignal;
  outcomes?: readonly Phase698TransportEvidenceT3SlotOutcome[];
  requestedBudgetCny?: number;
}>;

/**
 * Runs only the local admission/ordering simulation. There is deliberately no
 * fetch, credential, model adapter, persistence, or injectable executor in
 * this function. A synthetic failure opens the breaker and leaves the fixed
 * three-slot denominator intact.
 */
export function runPhase698TransportEvidenceT3ZeroProvider(
  rawInput: Phase698TransportEvidenceT3ZeroProviderInput = {},
): Phase698TransportEvidenceT3Report {
  const input = readInput(rawInput);
  if (!input) return blockedReport('input_invalid', null);
  if (isAborted(input.signal)) return abortedReport(input.requestedBudgetCny ?? null);
  if (
    input.requestedBudgetCny !== null &&
    input.requestedBudgetCny > PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY
  ) {
    return budgetReport(input.requestedBudgetCny);
  }

  const outcomes =
    input.outcomes ?? PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.map(() => 'pass' as const);
  const slots: Phase698TransportEvidenceT3SlotResult[] = [];
  let breaker: {
    open: boolean;
    reason: Phase698TransportEvidenceT3BreakerReason;
    openedAtSequence: number | null;
  } = {
    open: false,
    reason: 'none',
    openedAtSequence: null,
  };
  for (let index = 0; index < PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.length; index += 1) {
    const slot = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER[index];
    if (!slot) throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_MISSING');
    const sequence = index + 1;
    if (breaker.open) {
      slots.push(
        notStartedSlot(
          slot,
          sequence,
          breaker.reason === 'external_abort'
            ? 'not_started_external_abort'
            : 'not_started_quality_breaker',
        ),
      );
      continue;
    }
    const outcome = outcomes[index] ?? 'pass';
    const diagnostic = buildSyntheticDiagnostic(slot, `${slot}-${sequence}`, outcome);
    const recorded = recordSyntheticObservation(slot, diagnostic);
    if (!recorded) {
      breaker = { open: true, reason: 'synthetic_failure', openedAtSequence: sequence };
      slots.push(
        startedSlot(slot, sequence, outcome, 'synthetic_failed', 'synthetic_failure', null),
      );
      continue;
    }
    if (outcome === 'pass') {
      slots.push(startedSlot(slot, sequence, outcome, 'synthetic_checked', null, recorded));
      continue;
    }
    const failureCode =
      outcome === 'timeout'
        ? 'synthetic_timeout'
        : outcome === 'abort'
          ? 'aborted'
          : 'synthetic_failure';
    breaker = {
      open: true,
      reason:
        outcome === 'abort'
          ? 'external_abort'
          : outcome === 'timeout'
            ? 'synthetic_timeout'
            : 'synthetic_failure',
      openedAtSequence: sequence,
    };
    slots.push(startedSlot(slot, sequence, outcome, 'synthetic_failed', failureCode, recorded));
  }
  return makeReport({
    requestedBudgetCny: input.requestedBudgetCny,
    slots,
    breaker,
  });
}

function readInput(value: unknown): Readonly<{
  signal: AbortSignal;
  outcomes: readonly Phase698TransportEvidenceT3SlotOutcome[] | null;
  requestedBudgetCny: number | null;
}> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  try {
    const keys = Reflect.ownKeys(value);
    const allowed = ['signal', 'outcomes', 'requestedBudgetCny'];
    if (keys.some((key) => typeof key !== 'string' || !allowed.includes(key))) return null;
    const signal = (value as Record<string, unknown>).signal;
    if (signal !== undefined && !(signal instanceof AbortSignal)) return null;
    const outcomesValue = (value as Record<string, unknown>).outcomes;
    let outcomes: readonly Phase698TransportEvidenceT3SlotOutcome[] | null = null;
    if (outcomesValue !== undefined) {
      if (!Array.isArray(outcomesValue) || outcomesValue.length > 3) return null;
      const parsedOutcomes: Phase698TransportEvidenceT3SlotOutcome[] = [];
      for (const item of outcomesValue) {
        const parsed = OUTCOME_SCHEMA.safeParse(item);
        if (!parsed.success) return null;
        parsedOutcomes.push(parsed.data);
      }
      outcomes = Object.freeze(parsedOutcomes);
    }
    const requestedBudgetCny = (value as Record<string, unknown>).requestedBudgetCny;
    if (
      requestedBudgetCny !== undefined &&
      (typeof requestedBudgetCny !== 'number' ||
        !Number.isFinite(requestedBudgetCny) ||
        requestedBudgetCny < 0)
    )
      return null;
    return Object.freeze({
      signal: signal ?? new AbortController().signal,
      outcomes,
      requestedBudgetCny: requestedBudgetCny === undefined ? null : requestedBudgetCny,
    });
  } catch {
    return null;
  }
}

function buildSyntheticDiagnostic(
  slot: Phase698TransportEvidenceT3Slot,
  callId: string,
  outcome: Phase698TransportEvidenceT3SlotOutcome,
): Phase698TransportEvidenceDiagnostic {
  const value = {
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    callId,
    family: slot,
    phase: slot,
    stage: 'preflight' as const,
    reasonCode: outcome === 'abort' ? ('aborted' as const) : ('unknown' as const),
    providerBoundary: 'unknown' as const,
    runnerWire: ATTEMPTED_RUNNER_WIRE,
    providerWire: ZERO_PROVIDER_WIRE,
    diagnosticStages: [] as const,
    rawDataRetained: false as const,
  };
  const parsed = parsePhase698TransportEvidenceDiagnostic(value);
  if (!parsed) throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SYNTHETIC_DIAGNOSTIC_INVALID');
  return parsed;
}

function recordSyntheticObservation(
  slot: Phase698TransportEvidenceT3Slot,
  diagnostic: Phase698TransportEvidenceDiagnostic,
) {
  switch (slot) {
    case 'rewrite': {
      const capability = createPhase698TransportEvidenceRewriteCapability(diagnostic.callId);
      return recordPhase698TransportEvidenceRewriteObservation(capability, diagnostic);
    }
    case 'qwen': {
      const capability = createPhase698TransportEvidenceQwenCapability(diagnostic.callId);
      return recordPhase698TransportEvidenceQwenObservation(capability, diagnostic);
    }
    case 'final_response': {
      const capability = createPhase698TransportEvidenceFinalResponseCapability(diagnostic.callId);
      return recordPhase698TransportEvidenceFinalResponseObservation(capability, diagnostic);
    }
  }
}

function startedSlot(
  slot: Phase698TransportEvidenceT3Slot,
  sequence: number,
  outcome: Phase698TransportEvidenceT3SlotOutcome,
  disposition: 'synthetic_checked' | 'synthetic_failed',
  failureCode: 'synthetic_failure' | 'synthetic_timeout' | 'aborted' | null,
  diagnostic: Phase698TransportEvidenceDiagnostic | null,
): Phase698TransportEvidenceT3SlotResult {
  return SLOT_RESULT_SCHEMA.parse({
    slot,
    sequence,
    outcome,
    disposition,
    failureCode,
    diagnostic,
    runnerWire: ATTEMPTED_RUNNER_WIRE,
    providerWire: ZERO_PROVIDER_WIRE,
    providerCalls: 0,
    credentialReads: 0,
    rawDataRetained: false,
  });
}

function notStartedSlot(
  slot: Phase698TransportEvidenceT3Slot,
  sequence: number,
  disposition: 'not_started_quality_breaker' | 'not_started_external_abort',
): Phase698TransportEvidenceT3SlotResult {
  return SLOT_RESULT_SCHEMA.parse({
    slot,
    sequence,
    outcome: disposition === 'not_started_external_abort' ? 'abort' : 'failure',
    disposition,
    failureCode: disposition === 'not_started_external_abort' ? 'aborted' : 'synthetic_failure',
    diagnostic: null,
    runnerWire: ZERO_WIRE,
    providerWire: ZERO_PROVIDER_WIRE,
    providerCalls: 0,
    credentialReads: 0,
    rawDataRetained: false,
  });
}

function makeReport(input: {
  requestedBudgetCny: number | null;
  slots: readonly Phase698TransportEvidenceT3SlotResult[];
  breaker: {
    open: boolean;
    reason: Phase698TransportEvidenceT3BreakerReason;
    openedAtSequence: number | null;
  };
}): Phase698TransportEvidenceT3Report {
  const startedSlots = input.slots.filter(
    (slot) => slot.disposition === 'synthetic_checked' || slot.disposition === 'synthetic_failed',
  ).length;
  const completedSlots = input.slots.filter(
    (slot) =>
      slot.disposition !== 'not_started_quality_breaker' &&
      slot.disposition !== 'not_started_external_abort',
  ).length;
  const notStartedQualityBreaker = input.slots.filter(
    (slot) => slot.disposition === 'not_started_quality_breaker',
  ).length;
  const notStartedExternalAbort = input.slots.filter(
    (slot) => slot.disposition === 'not_started_external_abort',
  ).length;
  const passed =
    !input.breaker.open && startedSlots === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_PROVIDER_CALLS;
  return PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_REPORT_SCHEMA.parse(
    deepFreezeModelValue({
      version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_VERSION,
      lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
      authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
      qualityAuthority: 'none',
      gate: passed
        ? PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE
        : PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
      passed,
      slotCount: 3,
      startedSlots,
      completedSlots,
      notStartedQualityBreaker,
      notStartedExternalAbort,
      syntheticCalls: startedSlots,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      productWrites: 0,
      traceWrites: 0,
      requestedBudgetCny: input.requestedBudgetCny,
      budgetCnyMax: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY,
      breaker: input.breaker,
      slotOrder: [...PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER],
      slots: [...input.slots],
      rawDataRetained: false,
    }),
  );
}

function blockedReport(
  reason: 'input_invalid',
  requestedBudgetCny: number | null,
): Phase698TransportEvidenceT3Report {
  return makeReport({
    requestedBudgetCny,
    slots: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.map((slot, index) =>
      notStartedSlot(slot, index + 1, 'not_started_quality_breaker'),
    ),
    breaker: { open: true, reason, openedAtSequence: null },
  });
}

function budgetReport(requestedBudgetCny: number): Phase698TransportEvidenceT3Report {
  return makeReport({
    requestedBudgetCny,
    slots: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.map((slot, index) =>
      notStartedSlot(slot, index + 1, 'not_started_quality_breaker'),
    ),
    breaker: { open: true, reason: 'budget_exceeded', openedAtSequence: null },
  });
}

function abortedReport(requestedBudgetCny: number | null): Phase698TransportEvidenceT3Report {
  return makeReport({
    requestedBudgetCny,
    slots: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.map((slot, index) =>
      notStartedSlot(slot, index + 1, 'not_started_external_abort'),
    ),
    breaker: { open: true, reason: 'external_abort', openedAtSequence: null },
  });
}

function isAborted(signal: AbortSignal) {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}
