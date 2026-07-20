import { createHash } from 'node:crypto';

import type { ReviewPlannerV8ProductAcceptanceRunnerLedgerPort } from './review-planner-v8-product-acceptance-runner';
import type {
  ReviewPlannerV12ProductAcceptanceLedger,
  ReviewPlannerV12ProductAcceptanceManifest,
} from './review-planner-v12-product-acceptance-ledger';
import { REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

const SHA256 = /^[a-f0-9]{64}$/;
const SLOTS = [
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
] as const;

export type ReviewPlannerV12ProductAcceptanceSafeEvent = Readonly<{
  kind: 'slot' | 'default_off' | 'owner_isolation' | 'cleanup' | 'success';
  schemaVersion: string;
  slot?: (typeof SLOTS)[number];
  component?: 'review' | 'planner';
  traceSha256?: string;
  attemptSha256?: string;
}>;

export function createReviewPlannerV12ProductAcceptanceRunnerLedgerAdapter(input: {
  environment: 'branch' | 'main';
  ledger: Pick<ReviewPlannerV12ProductAcceptanceLedger, 'attemptSha256'>;
  manifest: ReviewPlannerV12ProductAcceptanceManifest;
  record(event: ReviewPlannerV12ProductAcceptanceSafeEvent): void;
}): ReviewPlannerV8ProductAcceptanceRunnerLedgerPort {
  if (
    input.manifest.environment !== input.environment ||
    input.manifest.attemptSha256 !== input.ledger.attemptSha256() ||
    !SHA256.test(input.manifest.attemptSha256)
  ) {
    throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
  }
  const slots = new Set<(typeof SLOTS)[number]>();
  const screenshots = new Map<'review' | 'planner', string>();
  const defaultOff = new Set<'review' | 'planner'>();
  let cleanup = false;
  let finalized = false;

  return Object.freeze({
    environment: () => input.environment,
    claimSlot(slot) {
      if (!(SLOTS as readonly string[]).includes(slot) || slots.has(slot)) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      slots.add(slot);
    },
    recordSlotResult(value) {
      const record = value as Record<string, unknown>;
      const slot = record.slot;
      const trace = record.traceIdSha256;
      if (
        typeof slot !== 'string' ||
        !(SLOTS as readonly string[]).includes(slot) ||
        !slots.has(slot as (typeof SLOTS)[number]) ||
        typeof trace !== 'string' ||
        !SHA256.test(trace)
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      const component = slot.startsWith('review') ? 'review' : 'planner';
      if (slot.endsWith('browser') && !screenshots.has(component)) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      input.record(
        Object.freeze({
          kind: 'slot' as const,
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
          slot: slot as (typeof SLOTS)[number],
          traceSha256: trace,
        }),
      );
    },
    recordDefaultOff(value) {
      const component = (value as { component?: unknown }).component;
      if (
        (component !== 'review' && component !== 'planner') ||
        defaultOff.has(component)
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      defaultOff.add(component);
      input.record(
        Object.freeze({
          kind: 'default_off' as const,
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
          component,
        }),
      );
    },
    recordScreenshot(component, contents) {
      if (
        (component !== 'review' && component !== 'planner') ||
        !(contents instanceof Uint8Array) ||
        contents.byteLength === 0 ||
        screenshots.has(component)
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      screenshots.set(
        component,
        createHash('sha256').update(contents).digest('hex'),
      );
    },
    recordOwnerIsolation(value) {
      const record = value as {
        crossAccountInvisible?: unknown;
        businessWrites?: unknown;
      };
      if (
        record.crossAccountInvisible !== true ||
        record.businessWrites !== 0
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      input.record(
        Object.freeze({
          kind: 'owner_isolation' as const,
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas
              .ownerIsolation,
        }),
      );
    },
    recordCleanup(value) {
      const record = value as Record<string, unknown>;
      if (
        record.syntheticAccounts !== 0 ||
        record.fixtures !== 0 ||
        record.traces !== 0 ||
        record.browserProfiles !== 0 ||
        record.capabilities !== 0
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      cleanup = true;
      input.record(
        Object.freeze({
          kind: 'cleanup' as const,
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
        }),
      );
    },
    finalizeSuccess() {
      if (
        finalized ||
        !cleanup ||
        slots.size !== SLOTS.length ||
        defaultOff.size !== 2 ||
        screenshots.size !== 2
      ) {
        throw new Error('V12_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      input.record(
        Object.freeze({
          kind: 'success' as const,
          schemaVersion:
            REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
          attemptSha256: input.manifest.attemptSha256,
        }),
      );
      finalized = true;
      return Promise.resolve();
    },
  });
}
