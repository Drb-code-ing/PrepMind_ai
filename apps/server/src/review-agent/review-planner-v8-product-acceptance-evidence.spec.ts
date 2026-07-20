import {
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION,
  calculateReviewPlannerV8ProductAcceptanceCost,
  reviewPlannerV8ProductAcceptanceEvidenceSchema,
  serializeReviewPlannerV8ProductAcceptanceEvidence,
  sha256ReviewPlannerV8ProductAcceptanceArtifact,
} from './review-planner-v8-product-acceptance-evidence';

const sha = 'a'.repeat(64);
const fixture = {
  schemaVersion: 'phase-6.9.5-review-planner-v8-product-acceptance-v1',
  environment: 'branch',
  commitSha: 'b'.repeat(40),
  provider: 'deepseek',
  model: 'deepseek-v4-pro',
  components: {
    review: {
      component: 'review',
      observation: { attempted: true, degraded: false },
      disposition: 'candidate_applied',
      provenance: 'live_candidate',
      durationMs: 3200,
      usage: { inputTokens: 4000, outputTokens: 800 },
      requestCount: 2,
    },
    planner: {
      component: 'planner',
      observation: { attempted: true, degraded: false },
      disposition: 'candidate_applied',
      provenance: 'live_candidate',
      durationMs: 3000,
      usage: { inputTokens: 3800, outputTokens: 960 },
      requestCount: 2,
    },
  },
  trace: {
    status: 'persisted',
    steps: [
      'deterministic_review',
      'review_candidate',
      'deterministic_planner',
      'planner_candidate',
    ],
    pricingKnown: false,
    costEstimateUsd: 0,
    targetCandidateAttempts: 4,
  },
  accountIdSha256: { review: sha, planner: 'c'.repeat(64) },
  ownerIsolation: true,
  factsUnchanged: true,
  gateRestored: true,
  cleanup: true,
  totals: {
    requests: 4,
    inputTokens: 7800,
    outputTokens: 1760,
    costCny: '0.03396000',
  },
  pricing: REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE,
  pairedEvidenceSha256: sha,
  planScreenshotSha256: 'd'.repeat(64),
  todayScreenshotSha256: 'e'.repeat(64),
} as const;

describe('Review Planner V8 product acceptance evidence', () => {
  it('freezes the exact price profile, reservation, and worst-case cost', () => {
    expect(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE).toEqual({
      priceProfileId:
        'deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance',
      inputRateCnyPerMillion: 3,
      outputRateCnyPerMillion: 6,
      snapshotDate: '2026-07-18',
      source: 'user-provided-deepseek-official-price-screenshot',
      rounding: 'ROUND_HALF_UP_8DP',
      hardCapCny: '0.10000000',
    });
    expect(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION).toEqual({
      inputTokens: 15600,
      outputTokens: 3520,
      worstCaseCostCny: '0.06792000',
    });
    expect(REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT).toEqual({
      inputTokens: 7800,
      outputTokens: 1760,
      worstCaseCostCny: '0.03396000',
    });
    expect(calculateReviewPlannerV8ProductAcceptanceCost(15600, 3520)).toEqual({
      costCny: '0.06792000',
      withinHardCap: true,
    });
  });

  it('makes two maximum branch/main records stay within the frozen total reservation', () => {
    const maximumEnvironment = {
      ...fixture,
      components: {
        review: {
          ...fixture.components.review,
          usage: { inputTokens: 3900, outputTokens: 880 },
        },
        planner: {
          ...fixture.components.planner,
          usage: { inputTokens: 3900, outputTokens: 880 },
        },
      },
      totals: {
        requests: 4,
        inputTokens: 7800,
        outputTokens: 1760,
        costCny: '0.03396000',
      },
    };
    const branch = reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
      ...maximumEnvironment,
      environment: 'branch',
    });
    const main = reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
      ...maximumEnvironment,
      environment: 'main',
    });

    expect(branch.totals.inputTokens + main.totals.inputTokens).toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.inputTokens,
    );
    expect(branch.totals.outputTokens + main.totals.outputTokens).toBe(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.outputTokens,
    );
    expect(
      calculateReviewPlannerV8ProductAcceptanceCost(
        branch.totals.inputTokens + main.totals.inputTokens,
        branch.totals.outputTokens + main.totals.outputTokens,
      ),
    ).toEqual({ costCny: '0.06792000', withinHardCap: true });
  });

  it('rejects a single environment using any of the other environment reservation', () => {
    expect(() =>
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
        ...fixture,
        components: {
          ...fixture.components,
          review: {
            ...fixture.components.review,
            usage: { inputTokens: 3901, outputTokens: 800 },
          },
        },
        totals: {
          ...fixture.totals,
          inputTokens: 7801,
          costCny: '0.02820300',
        },
      }),
    ).toThrow();
  });

  it('requires positive verified integer usage and exact rational totals', () => {
    expect(
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse(fixture),
    ).toEqual(fixture);
    expect(() =>
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
        ...fixture,
        totals: { ...fixture.totals, inputTokens: 7800.5 },
      }),
    ).toThrow();
    expect(() =>
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
        ...fixture,
        totals: { ...fixture.totals, costCny: '0.03395999' },
      }),
    ).toThrow();
  });

  it('rejects over-reservation and unrounded hard-cap violations', () => {
    expect(calculateReviewPlannerV8ProductAcceptanceCost(33334, 0)).toEqual({
      costCny: '0.10000200',
      withinHardCap: false,
    });
    expect(() =>
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
        ...fixture,
        components: {
          ...fixture.components,
          review: {
            ...fixture.components.review,
            usage: { inputTokens: 11801, outputTokens: 800 },
          },
        },
        totals: {
          ...fixture.totals,
          inputTokens: 15601,
          costCny: '0.05736300',
        },
      }),
    ).toThrow();
  });

  it('serializes one strict newline-terminated JSON record without a self hash', () => {
    const serialized =
      serializeReviewPlannerV8ProductAcceptanceEvidence(fixture);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(JSON.parse(serialized)).toEqual(fixture);
    expect(serialized).not.toContain('evidenceSha256');
    expect(sha256ReviewPlannerV8ProductAcceptanceArtifact('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it.each([
    'email',
    'jwt',
    'cookie',
    'prompt',
    'response',
    'facts',
    'rawTrace',
    'key',
    'url',
    'header',
    'rawError',
    'stack',
    'evidenceSha256',
    'unknownField',
  ])('strictly rejects forbidden or unknown field %s', (field) => {
    expect(() =>
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
        ...fixture,
        [field]: 'forbidden',
      }),
    ).toThrow();
  });
});
