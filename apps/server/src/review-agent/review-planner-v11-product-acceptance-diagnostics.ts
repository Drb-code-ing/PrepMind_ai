import { z } from 'zod';

import { REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS = [
  'review_api_activate',
  'review_api_facts_before',
  'review_api_trace_baseline',
  'review_api_dispatch',
  'review_api_observation',
  'review_api_trace_wait',
  'review_api_trace_canonicalize',
  'review_api_slot_record',
  'review_browser_trace_baseline',
  'review_browser_launch',
  'review_browser_dispatch',
  'review_browser_observation',
  'review_browser_default_off',
  'review_browser_trace_wait',
  'review_browser_trace_canonicalize',
  'review_browser_slot_record',
  'planner_api_activate',
  'planner_api_facts_before',
  'planner_api_trace_baseline',
  'planner_api_dispatch',
  'planner_api_observation',
  'planner_api_trace_wait',
  'planner_api_trace_canonicalize',
  'planner_api_slot_record',
  'planner_browser_trace_baseline',
  'planner_browser_launch',
  'planner_browser_dispatch',
  'planner_browser_observation',
  'planner_browser_default_off',
  'planner_browser_trace_wait',
  'planner_browser_trace_canonicalize',
  'planner_browser_slot_record',
] as const;

export type ReviewPlannerV11ProductAcceptanceCheckpoint =
  (typeof REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS)[number];

export type ReviewPlannerV11ProductAcceptanceComponent = 'review' | 'planner';
export type ReviewPlannerV11ProductAcceptanceSlot = 'api' | 'browser';
export type ReviewPlannerV11ProviderCallState = 'not_started' | 'indeterminate';

const checkpointSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
    ),
    component: z.enum(['review', 'planner']),
    slot: z.enum(['api', 'browser']),
    checkpoint: z.enum(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict()
  .superRefine((value, context) => {
    if (!checkpointMatchesBoundary(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkpoint'],
        message: 'CHECKPOINT_BOUNDARY_INVALID',
      });
    }
    if (providerCallStateIsImpossible(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['providerCallState'],
        message: 'PROVIDER_CALL_STATE_INVALID',
      });
    }
  });

export const reviewPlannerV11ProductAcceptanceCheckpointSchema =
  checkpointSchema;

export type ReviewPlannerV11ProductAcceptanceCheckpointRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceCheckpointSchema
>;

export const reviewPlannerV11ProductAcceptanceFailureSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
    ),
    environment: z.enum(['branch', 'main']),
    component: z.enum(['review', 'planner']),
    slot: z.enum(['api', 'browser']),
    checkpoint: z.enum(REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS),
    terminal: z.literal('operation_failed'),
    providerCallState: z.enum(['not_started', 'indeterminate']),
  })
  .strict()
  .superRefine((value, context) => {
    if (!checkpointMatchesBoundary(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checkpoint'],
        message: 'CHECKPOINT_BOUNDARY_INVALID',
      });
    }
    if (providerCallStateIsImpossible(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['providerCallState'],
        message: 'PROVIDER_CALL_STATE_INVALID',
      });
    }
  });

export type ReviewPlannerV11ProductAcceptanceFailureRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceFailureSchema
>;

export function parseReviewPlannerV11ProductAcceptanceFailure(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceFailureRecord {
  if (containsForbiddenDiagnosticKey(value)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  }
  const parsed =
    reviewPlannerV11ProductAcceptanceFailureSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export function serializeReviewPlannerV11ProductAcceptanceFailure(
  value: unknown,
): string {
  return `${JSON.stringify(
    parseReviewPlannerV11ProductAcceptanceFailure(value),
  )}\n`;
}

export function readReviewPlannerV11ProductAcceptanceCheckpoints(
  values: readonly unknown[],
): readonly ReviewPlannerV11ProductAcceptanceCheckpointRecord[] {
  if (!Array.isArray(values)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  }
  const records: ReviewPlannerV11ProductAcceptanceCheckpointRecord[] = [];
  const nextCheckpointIndex = new Map<string, number>();
  for (const value of values) {
    const record = parseReviewPlannerV11ProductAcceptanceCheckpoint(value);
    const boundary = `${record.component}_${record.slot}`;
    const slotCheckpoints =
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter((checkpoint) =>
        checkpoint.startsWith(`${boundary}_`),
      );
    const expectedIndex = nextCheckpointIndex.get(boundary) ?? 0;
    if (record.checkpoint !== slotCheckpoints[expectedIndex]) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
    }
    nextCheckpointIndex.set(boundary, expectedIndex + 1);
    records.push(record);
  }
  return Object.freeze(records);
}

export function parseReviewPlannerV11ProductAcceptanceCheckpoint(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceCheckpointRecord {
  if (containsForbiddenDiagnosticKey(value)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  }
  const parsed =
    reviewPlannerV11ProductAcceptanceCheckpointSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_DIAGNOSTIC_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

function checkpointMatchesBoundary(value: {
  component: ReviewPlannerV11ProductAcceptanceComponent;
  slot: ReviewPlannerV11ProductAcceptanceSlot;
  checkpoint: ReviewPlannerV11ProductAcceptanceCheckpoint;
}) {
  return value.checkpoint.startsWith(`${value.component}_${value.slot}_`);
}

function providerCallStateIsImpossible(value: {
  component: ReviewPlannerV11ProductAcceptanceComponent;
  slot: ReviewPlannerV11ProductAcceptanceSlot;
  checkpoint: ReviewPlannerV11ProductAcceptanceCheckpoint;
  providerCallState: ReviewPlannerV11ProviderCallState;
}) {
  const slotCheckpoints =
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_CHECKPOINTS.filter((checkpoint) =>
      checkpoint.startsWith(`${value.component}_${value.slot}_`),
    );
  const dispatch =
    `${value.component}_${value.slot}_dispatch` as ReviewPlannerV11ProductAcceptanceCheckpoint;
  const dispatchIndex = slotCheckpoints.indexOf(dispatch);
  const checkpointIndex = slotCheckpoints.indexOf(value.checkpoint);
  if (checkpointIndex < 0 || dispatchIndex < 0) return true;
  return checkpointIndex < dispatchIndex
    ? value.providerCallState !== 'not_started'
    : value.providerCallState !== 'indeterminate';
}

function containsForbiddenDiagnosticKey(value: unknown) {
  const seen = new Set<object>();
  const visit = (candidate: unknown): boolean => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    try {
      for (const key of Object.keys(candidate)) {
        if (
          /raw.?error|prompt|response|url|header|token|credential|user.?fact|usage/i.test(
            key,
          )
        ) {
          return true;
        }
        if (visit((candidate as Record<string, unknown>)[key])) return true;
      }
      return false;
    } catch {
      return true;
    }
  };
  return visit(value);
}
