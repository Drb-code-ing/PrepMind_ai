import { createHash } from 'node:crypto';

import { z } from 'zod';

export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE = Object.freeze(
  {
    priceProfileId:
      'deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance',
    inputRateCnyPerMillion: 3,
    outputRateCnyPerMillion: 6,
    snapshotDate: '2026-07-18',
    source: 'user-provided-deepseek-official-price-screenshot',
    rounding: 'ROUND_HALF_UP_8DP',
    hardCapCny: '0.10000000',
  } as const,
);

export const REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION = Object.freeze({
  inputTokens: 15_600,
  outputTokens: 3_520,
  worstCaseCostCny: '0.06792000',
} as const);

const SCHEMA_VERSION =
  'phase-6.9.5-review-planner-v8-product-acceptance-v1' as const;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const ONE_MILLION = 1_000_000n;
const EIGHT_DECIMAL_SCALE = 100_000_000n;
const INPUT_RATE = 3n;
const OUTPUT_RATE = 6n;
const HARD_CAP_NUMERATOR = 100_000n;

const usageSchema = z
  .object({
    inputTokens: z
      .number()
      .int()
      .positive()
      .max(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.inputTokens),
    outputTokens: z
      .number()
      .int()
      .positive()
      .max(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.outputTokens),
  })
  .strict();

function componentSchema(component: 'review' | 'planner') {
  return z
    .object({
      component: z.literal(component),
      observation: z
        .object({
          attempted: z.literal(true),
          degraded: z.literal(false),
        })
        .strict(),
      disposition: z.literal('candidate_applied'),
      provenance: z.literal('live_candidate'),
      durationMs: z.number().int().nonnegative(),
      usage: usageSchema,
      requestCount: z.literal(2),
    })
    .strict();
}

const pricingSchema = z
  .object({
    priceProfileId: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.priceProfileId,
    ),
    inputRateCnyPerMillion: z.literal(3),
    outputRateCnyPerMillion: z.literal(6),
    snapshotDate: z.literal('2026-07-18'),
    source: z.literal('user-provided-deepseek-official-price-screenshot'),
    rounding: z.literal('ROUND_HALF_UP_8DP'),
    hardCapCny: z.literal('0.10000000'),
  })
  .strict();

export const reviewPlannerV8ProductAcceptanceEvidenceSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    environment: z.enum(['branch', 'main']),
    commitSha: z.string().regex(COMMIT_SHA),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    components: z
      .object({
        review: componentSchema('review'),
        planner: componentSchema('planner'),
      })
      .strict(),
    trace: z
      .object({
        status: z.literal('persisted'),
        steps: z.tuple([
          z.literal('deterministic_review'),
          z.literal('review_candidate'),
          z.literal('deterministic_planner'),
          z.literal('planner_candidate'),
        ]),
        pricingKnown: z.literal(false),
        costEstimateUsd: z.literal(0),
        targetCandidateAttempts: z.literal(4),
      })
      .strict(),
    accountIdSha256: z
      .object({
        review: z.string().regex(SHA256),
        planner: z.string().regex(SHA256),
      })
      .strict(),
    ownerIsolation: z.literal(true),
    factsUnchanged: z.literal(true),
    gateRestored: z.literal(true),
    cleanup: z.literal(true),
    totals: z
      .object({
        requests: z.literal(4),
        inputTokens: z
          .number()
          .int()
          .positive()
          .max(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.inputTokens),
        outputTokens: z
          .number()
          .int()
          .positive()
          .max(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.outputTokens),
        costCny: z.string().regex(/^\d+\.\d{8}$/),
      })
      .strict(),
    pricing: pricingSchema,
    pairedEvidenceSha256: z.string().regex(SHA256),
    planScreenshotSha256: z.string().regex(SHA256),
    todayScreenshotSha256: z.string().regex(SHA256),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedInputTokens =
      value.components.review.usage.inputTokens +
      value.components.planner.usage.inputTokens;
    const expectedOutputTokens =
      value.components.review.usage.outputTokens +
      value.components.planner.usage.outputTokens;
    if (
      value.totals.inputTokens !== expectedInputTokens ||
      value.totals.outputTokens !== expectedOutputTokens
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totals'],
        message: 'PRODUCT_ACCEPTANCE_USAGE_TOTAL_MISMATCH',
      });
    }
    const cost = calculateReviewPlannerV8ProductAcceptanceCost(
      value.totals.inputTokens,
      value.totals.outputTokens,
    );
    if (!cost.withinHardCap || value.totals.costCny !== cost.costCny) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totals', 'costCny'],
        message: 'PRODUCT_ACCEPTANCE_COST_INVALID',
      });
    }
    if (value.accountIdSha256.review === value.accountIdSha256.planner) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountIdSha256'],
        message: 'PRODUCT_ACCEPTANCE_ACCOUNTS_NOT_ISOLATED',
      });
    }
  });

export type ReviewPlannerV8ProductAcceptanceEvidence = Readonly<
  z.infer<typeof reviewPlannerV8ProductAcceptanceEvidenceSchema>
>;

export function calculateReviewPlannerV8ProductAcceptanceCost(
  inputTokens: number,
  outputTokens: number,
): Readonly<{ costCny: string; withinHardCap: boolean }> {
  if (
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  ) {
    throw new Error('PRODUCT_ACCEPTANCE_USAGE_INVALID');
  }
  const numerator =
    BigInt(inputTokens) * INPUT_RATE + BigInt(outputTokens) * OUTPUT_RATE;
  const scaled = roundHalfUp(numerator * EIGHT_DECIMAL_SCALE, ONE_MILLION);
  return Object.freeze({
    costCny: formatEightDecimals(scaled),
    withinHardCap: numerator <= HARD_CAP_NUMERATOR,
  });
}

export function serializeReviewPlannerV8ProductAcceptanceEvidence(
  value: unknown,
): string {
  const parsed = reviewPlannerV8ProductAcceptanceEvidenceSchema.parse(value);
  return `${JSON.stringify(parsed)}\n`;
}

export function sha256ReviewPlannerV8ProductAcceptanceArtifact(
  contents: string | Uint8Array,
): string {
  return createHash('sha256').update(contents).digest('hex');
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

function formatEightDecimals(value: bigint): string {
  const integer = value / EIGHT_DECIMAL_SCALE;
  const fraction = (value % EIGHT_DECIMAL_SCALE).toString().padStart(8, '0');
  return `${integer}.${fraction}`;
}
