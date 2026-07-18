import { createHash, timingSafeEqual } from 'node:crypto';

export type ReviewPlannerProductAcceptanceComponent = 'review' | 'planner';

export type ReviewPlannerProductAcceptanceAdmissionConfig = Readonly<{
  enabled?: unknown;
  serverRole?: unknown;
  component?: unknown;
  capabilitySha256?: unknown;
  maxRequests?: unknown;
}>;

export type ReviewPlannerProductAcceptanceAdmission = Readonly<{
  claim(
    component: ReviewPlannerProductAcceptanceComponent,
    rawCapability: unknown,
  ): boolean;
}>;

type ReviewPlannerProductAcceptanceAdmissionDependencies = Readonly<{
  timingSafeEqual?: typeof timingSafeEqual;
}>;

export const REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ADMISSION = Symbol(
  'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ADMISSION',
);
export const REVIEW_PLANNER_PRODUCT_ACCEPTANCE_HEADER =
  'x-prepmind-review-planner-acceptance' as const;

const LOWERCASE_SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_MAX_REQUESTS = 2;

export function createReviewPlannerProductAcceptanceAdmission(
  config: ReviewPlannerProductAcceptanceAdmissionConfig,
  dependencies: ReviewPlannerProductAcceptanceAdmissionDependencies = {},
): ReviewPlannerProductAcceptanceAdmission {
  const configured =
    config.enabled === true &&
    config.serverRole === 'api' &&
    (config.component === 'review' || config.component === 'planner') &&
    typeof config.capabilitySha256 === 'string' &&
    LOWERCASE_SHA256.test(config.capabilitySha256) &&
    config.maxRequests === REQUIRED_MAX_REQUESTS;
  const expectedDigest = configured
    ? Buffer.from(config.capabilitySha256, 'hex')
    : Buffer.alloc(32);
  const configuredComponent = configured ? config.component : null;
  let remainingRequests = configured ? REQUIRED_MAX_REQUESTS : 0;
  let claimInProgress = false;
  const compareDigests = dependencies.timingSafeEqual ?? timingSafeEqual;

  const admission: ReviewPlannerProductAcceptanceAdmission = {
    claim(component, rawCapability): boolean {
      if (
        !configured ||
        claimInProgress ||
        remainingRequests <= 0 ||
        component !== configuredComponent ||
        typeof rawCapability !== 'string' ||
        rawCapability.length === 0
      ) {
        return false;
      }

      claimInProgress = true;
      try {
        const suppliedDigest = createHash('sha256')
          .update(rawCapability, 'utf8')
          .digest();
        if (!compareDigests(expectedDigest, suppliedDigest)) {
          return false;
        }
        remainingRequests -= 1;
        return true;
      } finally {
        claimInProgress = false;
      }
    },
  };

  return Object.freeze(admission);
}
