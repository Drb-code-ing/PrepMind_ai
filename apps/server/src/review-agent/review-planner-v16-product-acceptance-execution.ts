import { createHash } from 'node:crypto';

import type { ReviewPlannerV8ProductAcceptanceRunnerLedgerPort } from './review-planner-v8-product-acceptance-runner';
import { reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema } from './review-planner-v8-product-acceptance-recovery';
import {
  parseReviewPlannerV16ProductAcceptanceDefaultOff,
  type ReviewPlannerV16ProductAcceptanceLedger,
  type ReviewPlannerV16ProductAcceptanceManifest,
} from './review-planner-v16-product-acceptance-ledger';
import { REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

const SHA256 = /^[a-f0-9]{64}$/;
const V8_DEFAULT_OFF_RESTORE_MODEL = 'deepseek-v4-pro' as const;
const V8_DEFAULT_OFF_RESTORE_BASE_URL = 'https://api.deepseek.com' as const;
const SLOTS = [
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
] as const;

export type ReviewPlannerV16ProductAcceptanceSafeEvent = Readonly<{
  kind: 'slot' | 'default_off' | 'owner_isolation' | 'cleanup' | 'success';
  schemaVersion: string;
  slot?: (typeof SLOTS)[number];
  component?: 'review' | 'planner';
  traceSha256?: string;
  attemptSha256?: string;
}>;

export function createReviewPlannerV16ProductAcceptanceRunnerLedgerAdapter(input: {
  environment: 'branch' | 'main';
  ledger: Pick<
    ReviewPlannerV16ProductAcceptanceLedger,
    | 'attemptSha256'
    | 'claimSlot'
    | 'recordSlotResult'
    | 'recordDefaultOff'
    | 'recordOwnerIsolation'
    | 'recordCleanup'
    | 'finalizeSuccess'
  >;
  manifest: ReviewPlannerV16ProductAcceptanceManifest;
}): ReviewPlannerV8ProductAcceptanceRunnerLedgerPort {
  if (
    input.manifest.environment !== input.environment ||
    input.manifest.attemptSha256 !== input.ledger.attemptSha256() ||
    !SHA256.test(input.manifest.attemptSha256)
  ) {
    throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
  }
  const slots = new Set<(typeof SLOTS)[number]>();
  const screenshots = new Map<'review' | 'planner', string>();
  const defaultOff = new Set<'review' | 'planner'>();
  const durations = new Map<(typeof SLOTS)[number], number>();
  let cleanup = false;
  let finalized = false;

  return Object.freeze({
    environment: () => input.environment,
    claimSlot(slot) {
      if (!(SLOTS as readonly string[]).includes(slot) || slots.has(slot)) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      slots.add(slot);
      input.ledger.claimSlot(slot);
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
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      const component = slot.startsWith('review') ? 'review' : 'planner';
      if (slot.endsWith('browser') && !screenshots.has(component)) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      const durationMs = record.durationMs;
      if (
        typeof durationMs !== 'number' ||
        !Number.isInteger(durationMs) ||
        durationMs <= 0 ||
        durationMs > 60_000
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      input.ledger.recordSlotResult({
        schemaVersion:
          REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
        slot: slot as (typeof SLOTS)[number],
        traceSha256: trace,
      });
      durations.set(slot as (typeof SLOTS)[number], durationMs);
    },
    recordDefaultOff(value) {
      let v8Receipt;
      try {
        const parsed =
          reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.safeParse(
            value,
          );
        if (!parsed.success) throw new Error();
        v8Receipt = parsed.data;
      } catch {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      let record;
      try {
        record = parseReviewPlannerV16ProductAcceptanceDefaultOff({
          ...v8Receipt,
          schemaVersion:
            REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
          model: V8_DEFAULT_OFF_RESTORE_MODEL,
          baseUrl: V8_DEFAULT_OFF_RESTORE_BASE_URL,
        });
      } catch {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      const component = record.component;
      if (defaultOff.has(component)) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      defaultOff.add(component);
      input.ledger.recordDefaultOff(record);
    },
    recordScreenshot(component, contents) {
      if (
        (component !== 'review' && component !== 'planner') ||
        !(contents instanceof Uint8Array) ||
        contents.byteLength === 0 ||
        screenshots.has(component)
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
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
        traceIdSha256?: unknown;
      };
      if (
        record.crossAccountInvisible !== true ||
        record.businessWrites !== 0
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      const traces = record.traceIdSha256;
      if (
        !Array.isArray(traces) ||
        traces.length !== 4 ||
        traces.some((trace) => typeof trace !== 'string' || !SHA256.test(trace))
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      input.ledger.recordOwnerIsolation({
        schemaVersion:
          REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
        crossAccountInvisible: true,
        businessWrites: 0,
        traceSha256: traces,
      });
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
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      cleanup = true;
      input.ledger.recordCleanup({
        schemaVersion:
          REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      });
    },
    async finalizeSuccess() {
      if (
        finalized ||
        !cleanup ||
        slots.size !== SLOTS.length ||
        defaultOff.size !== 2 ||
        screenshots.size !== 2
      ) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      if (durations.size !== SLOTS.length) {
        throw new Error('V16_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
      }
      await input.ledger.finalizeSuccess({
        schemaVersion:
          REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
        environment: input.environment,
        attemptSha256: input.manifest.attemptSha256,
        requests: 4,
        durationMs: [...durations.values()].reduce(
          (total, durationMs) => total + durationMs,
          0,
        ),
      });
      finalized = true;
      return Promise.resolve();
    },
  });
}
