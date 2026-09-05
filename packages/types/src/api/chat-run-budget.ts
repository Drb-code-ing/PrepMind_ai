import { z } from 'zod';

const boundedId = z.string().trim().min(1).max(128);
const isoDate = z.string().datetime();
const safeNonNegativeInt = z.number().int().safe().min(0);

export const chatRunBudgetStageSchema = z.enum([
  'ROUTER',
  'TUTOR',
  'RETRIEVER',
  'VERIFIER',
  'FINAL_RESPONSE',
  'WORKER',
]);

export const chatRunBudgetReservationStatusSchema = z.enum([
  'RESERVED',
  'DISPATCHED',
  'SETTLED',
  'RELEASED',
  'UNCERTAIN',
]);

/** Immutable limits selected by the server for one ChatTurn run. */
export const chatRunBudgetPolicySchema = z
  .object({
    policyVersion: z.string().trim().min(1).max(80),
    maxCalls: z.number().int().safe().min(1).max(64),
    maxInputTokens: z.number().int().safe().min(1).max(1_000_000),
    maxOutputTokens: z.number().int().safe().min(1).max(1_000_000),
    maxCostMicros: safeNonNegativeInt.max(2_000_000_000),
  })
  .strict();

/** Run-level counters. `held*` covers reservations not yet settled/released. */
export const chatRunBudgetLedgerSchema = z
  .object({
    id: boundedId,
    ownerId: boundedId,
    turnId: boundedId,
    policy: chatRunBudgetPolicySchema,
    usedCalls: safeNonNegativeInt,
    usedInputTokens: safeNonNegativeInt,
    usedOutputTokens: safeNonNegativeInt,
    usedCostMicros: safeNonNegativeInt,
    heldCalls: safeNonNegativeInt,
    heldInputTokens: safeNonNegativeInt,
    heldOutputTokens: safeNonNegativeInt,
    heldCostMicros: safeNonNegativeInt,
    cancelledAt: isoDate.nullable(),
    createdAt: isoDate,
    updatedAt: isoDate,
  })
  .strict()
  .superRefine((ledger, context) => {
    const addIssue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message });
    if (ledger.usedCalls + ledger.heldCalls > ledger.policy.maxCalls) {
      addIssue('used and held calls exceed policy');
    }
    if (ledger.usedInputTokens + ledger.heldInputTokens > ledger.policy.maxInputTokens) {
      addIssue('used and held input tokens exceed policy');
    }
    if (ledger.usedOutputTokens + ledger.heldOutputTokens > ledger.policy.maxOutputTokens) {
      addIssue('used and held output tokens exceed policy');
    }
    if (ledger.usedCostMicros + ledger.heldCostMicros > ledger.policy.maxCostMicros) {
      addIssue('used and held cost exceed policy');
    }
  });

/** A single idempotent, owner-bound stage reservation. */
export const chatRunBudgetReservationSchema = z
  .object({
    id: boundedId,
    ownerId: boundedId,
    turnId: boundedId,
    ledgerId: boundedId,
    stage: chatRunBudgetStageSchema,
    status: chatRunBudgetReservationStatusSchema,
    inputTokens: z.number().int().safe().min(0).max(1_000_000),
    outputTokens: z.number().int().safe().min(0).max(1_000_000),
    costMicros: safeNonNegativeInt.max(2_000_000_000),
    usageInputTokens: safeNonNegativeInt,
    usageOutputTokens: safeNonNegativeInt,
    usageCostMicros: safeNonNegativeInt,
    createdAt: isoDate,
    dispatchedAt: isoDate.nullable(),
    settledAt: isoDate.nullable(),
    releasedAt: isoDate.nullable(),
  })
  .strict()
  .superRefine((reservation, context) => {
    const addIssue = (message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, message });
    const createdAt = Date.parse(reservation.createdAt);
    const dispatchedAt =
      reservation.dispatchedAt === null ? null : Date.parse(reservation.dispatchedAt);
    const settledAt = reservation.settledAt === null ? null : Date.parse(reservation.settledAt);
    const releasedAt = reservation.releasedAt === null ? null : Date.parse(reservation.releasedAt);
    if (dispatchedAt !== null && dispatchedAt < createdAt)
      addIssue('dispatchedAt precedes createdAt');
    if (settledAt !== null && settledAt < createdAt) addIssue('settledAt precedes createdAt');
    if (releasedAt !== null && releasedAt < createdAt) addIssue('releasedAt precedes createdAt');
    if (settledAt !== null && dispatchedAt !== null && settledAt < dispatchedAt) {
      addIssue('settledAt precedes dispatchedAt');
    }
    if (reservation.status === 'RESERVED' && reservation.dispatchedAt !== null) {
      addIssue('reserved reservation cannot be dispatched');
    }
    if (
      reservation.status === 'RESERVED' &&
      (reservation.settledAt !== null || reservation.releasedAt !== null)
    ) {
      addIssue('reserved reservation cannot be terminal');
    }
    if (
      reservation.status === 'DISPATCHED' &&
      (reservation.dispatchedAt === null ||
        reservation.settledAt !== null ||
        reservation.releasedAt !== null)
    ) {
      addIssue('dispatched reservation has an invalid lifecycle');
    }
    if (
      reservation.status === 'UNCERTAIN' &&
      (reservation.dispatchedAt === null ||
        reservation.settledAt !== null ||
        reservation.releasedAt !== null)
    ) {
      addIssue('uncertain reservation must retain a dispatched attempt');
    }
    if (
      reservation.status === 'RELEASED' &&
      (reservation.dispatchedAt !== null || reservation.settledAt !== null)
    ) {
      addIssue('dispatched reservation cannot be released');
    }
    if (reservation.status === 'RELEASED' && reservation.releasedAt === null) {
      addIssue('released reservation requires releasedAt');
    }
    if (reservation.status === 'SETTLED' && reservation.settledAt === null) {
      addIssue('settled reservation requires settledAt');
    }
    if (
      reservation.status === 'SETTLED' &&
      (reservation.dispatchedAt === null || reservation.releasedAt !== null)
    ) {
      addIssue('settled reservation has an invalid lifecycle');
    }
    if (
      reservation.status !== 'SETTLED' &&
      (reservation.usageInputTokens !== 0 ||
        reservation.usageOutputTokens !== 0 ||
        reservation.usageCostMicros !== 0)
    ) {
      addIssue('usage is only allowed on a settled reservation');
    }
    if (
      reservation.status === 'SETTLED' &&
      (reservation.usageInputTokens > reservation.inputTokens ||
        reservation.usageOutputTokens > reservation.outputTokens ||
        reservation.usageCostMicros > reservation.costMicros)
    ) {
      addIssue('settled usage cannot exceed the reservation');
    }
  });

export const chatRunBudgetReservationRequestSchema = z
  .object({
    ownerId: boundedId,
    turnId: boundedId,
    ledgerId: boundedId,
    reservationId: boundedId,
    stage: chatRunBudgetStageSchema,
    inputTokens: z.number().int().safe().min(0).max(1_000_000),
    outputTokens: z.number().int().safe().min(0).max(1_000_000),
    costMicros: safeNonNegativeInt.max(2_000_000_000),
  })
  .strict();

export const chatRunBudgetUsageSchema = z
  .object({
    inputTokens: z.number().int().safe().min(0).max(1_000_000),
    outputTokens: z.number().int().safe().min(0).max(1_000_000),
    costMicros: safeNonNegativeInt.max(2_000_000_000),
  })
  .strict();

export const chatRunBudgetLedgerEventTypeSchema = z.enum([
  'RESERVED',
  'DISPATCHED',
  'SETTLED',
  'RELEASED',
  'UNCERTAIN',
  'CANCELLED',
]);

/** Bounded audit fact; never contains prompt, provider response, or credentials. */
export const chatRunBudgetLedgerEventSchema = z
  .object({
    id: boundedId,
    ownerId: boundedId,
    turnId: boundedId,
    ledgerId: boundedId,
    reservationId: boundedId.nullable(),
    stage: chatRunBudgetStageSchema.nullable(),
    type: chatRunBudgetLedgerEventTypeSchema,
    usage: chatRunBudgetUsageSchema.nullable(),
    createdAt: isoDate,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.type === 'CANCELLED') {
      if (event.reservationId !== null || event.stage !== null || event.usage !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'cancelled event must be run-scoped and have no usage',
        });
      }
      return;
    }
    if (event.reservationId === null || event.stage === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reservation event requires reservation and stage',
      });
    }
    if (event.type === 'SETTLED' && event.usage === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'settled event requires usage',
      });
    }
    if (event.type !== 'SETTLED' && event.usage !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'only settled event may contain usage',
      });
    }
  });

export type ChatRunBudgetStage = z.infer<typeof chatRunBudgetStageSchema>;
export type ChatRunBudgetReservationStatus = z.infer<typeof chatRunBudgetReservationStatusSchema>;
export type ChatRunBudgetPolicy = z.infer<typeof chatRunBudgetPolicySchema>;
export type ChatRunBudgetLedger = z.infer<typeof chatRunBudgetLedgerSchema>;
export type ChatRunBudgetReservation = z.infer<typeof chatRunBudgetReservationSchema>;
export type ChatRunBudgetReservationRequest = z.infer<typeof chatRunBudgetReservationRequestSchema>;
export type ChatRunBudgetUsage = z.infer<typeof chatRunBudgetUsageSchema>;
export type ChatRunBudgetLedgerEvent = z.infer<typeof chatRunBudgetLedgerEventSchema>;
