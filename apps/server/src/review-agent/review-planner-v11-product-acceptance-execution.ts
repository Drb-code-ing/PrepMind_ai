import { createHash } from 'node:crypto';

import { z } from 'zod';

import { calculateReviewPlannerV8ProductAcceptanceCost } from './review-planner-v8-product-acceptance-evidence';
import type { ReviewPlannerV11ProductAcceptanceLedger } from './review-planner-v8-product-acceptance-ledger';
import {
  assertReviewPlannerV11ProductAcceptanceOwner,
  readReviewPlannerV11ProductAcceptanceAttemptBinding,
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
  type ReviewPlannerV11ProductAcceptanceOwner,
} from './review-planner-v8-product-acceptance-recovery';
import type { ReviewPlannerV8ProductAcceptanceRunnerLedgerPort } from './review-planner-v8-product-acceptance-runner';
import {
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const V11_SYNTHETIC_ACCOUNT_ID =
  /^v11-synthetic-account-[a-z0-9][a-z0-9_-]{0,96}$/i;
const V11_SYNTHETIC_FIXTURE_ID =
  /^v11-synthetic-fixture-[a-z0-9][a-z0-9_-]{0,96}$/i;
const CREDENTIAL_LIKE_SELECTOR =
  /(?:^|[-_])(?:sk|bearer|api[-_]?key|token|password)(?:[-_]|$)/i;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:\\[^\0]{1,500}$/;
const COST_CNY = /^(?:0|[1-9]\d*)\.\d{8}$/;
const PRIVATE_EXECUTION_MANIFEST_LEAF = 'execution-manifest.json';
const PRIVATE_ATTEMPT_BINDING_LEAF = 'attempt-binding.json';
const PRIVATE_OWNER_LOCK_LEAF = 'owner.lock';
const PRIVATE_CHECKPOINT_LEAF = /^checkpoint-\d{3}-[a-z_]+\.json$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS = [
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
] as const;

export type ReviewPlannerV11ProductAcceptanceExecutionSlot =
  (typeof REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS)[number];

type V11RunnerComponent = 'review' | 'planner';

const v11RunnerSafeHashSchema = z.string().regex(SHA256);

const v8RunnerTraceStepSchema = z
  .object({
    name: z.enum([
      'deterministic_review',
      'review_candidate',
      'deterministic_planner',
      'planner_candidate',
    ]),
    attempted: z.boolean(),
    disposition: z.enum(['candidate_applied', 'not_eligible']),
    provenance: z.enum(['live_candidate', 'local_deterministic']),
  })
  .strict();

const v8RunnerSlotRecordSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
    ),
    slot: z.enum([
      'review-api',
      'review-browser',
      'planner-api',
      'planner-browser',
    ]),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    usage: z
      .object({
        inputTokens: z.number().int().positive().max(1_950),
        outputTokens: z.number().int().positive().max(440),
      })
      .strict(),
    durationMs: z.number().int().positive().max(60_000),
    pricingKnown: z.literal(false),
    costEstimateUsd: z.literal(0),
    steps: z.array(v8RunnerTraceStepSchema).length(4),
    disposition: z.literal('candidate_applied'),
    provenance: z.literal('live_candidate'),
    traceIdSha256: v11RunnerSafeHashSchema,
    screenshotSha256: v11RunnerSafeHashSchema.optional(),
  })
  .strict();

const v8RunnerOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    reviewFactsBeforeSha256: v11RunnerSafeHashSchema,
    reviewFactsAfterSha256: v11RunnerSafeHashSchema,
    plannerFactsBeforeSha256: v11RunnerSafeHashSchema,
    plannerFactsAfterSha256: v11RunnerSafeHashSchema,
    traceIdSha256: z.array(v11RunnerSafeHashSchema).length(4),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
  })
  .strict();

const v8RunnerCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

/**
 * Adapts the deterministic V8 runner mechanics to the V11-only durable ledger.
 * It never writes V8/V10 records or screenshot bytes: only the V11 records and
 * screenshot hashes accepted by the V11 ledger cross this boundary.
 */
export function createReviewPlannerV11ProductAcceptanceRunnerLedgerAdapter(
  input: Readonly<{
    environment: 'branch' | 'main';
    attemptSha256: string;
    ledger: ReviewPlannerV11ProductAcceptanceLedger;
    manifest: unknown;
  }>,
): ReviewPlannerV8ProductAcceptanceRunnerLedgerPort {
  const snapshot = snapshotV11RunnerAdapterInput(input);
  const screenshots = new Map<V11RunnerComponent, string>();
  const results = new Map<
    ReviewPlannerV11ProductAcceptanceExecutionSlot,
    z.infer<typeof v8RunnerSlotRecordSchema>
  >();
  const defaultOff = new Map<
    V11RunnerComponent,
    ReviewPlannerV11ProductAcceptanceDefaultOffRecord
  >();
  let cleanupRecorded = false;
  let finalized = false;
  let defaultOffFlushed = false;

  const flushDefaultOff = () => {
    if (defaultOffFlushed) return;
    for (const component of ['review', 'planner'] as const) {
      const receipt = defaultOff.get(component);
      if (receipt === undefined) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
      }
      snapshot.recordDefaultOff(receipt);
    }
    defaultOffFlushed = true;
  };

  return Object.freeze({
    environment: () => snapshot.environment,
    claimSlot(slot) {
      assertV11RunnerSlot(slot);
      snapshot.claimSlot(slot);
    },
    recordSlotResult(value) {
      const record = parseV8RunnerSlotRecord(value);
      const component = componentForV11RunnerSlot(record.slot);
      const browser = record.slot.endsWith('-browser');
      const screenshotSha256 = browser ? screenshots.get(component) : undefined;
      if (
        (browser &&
          (screenshotSha256 === undefined ||
            record.screenshotSha256 !== screenshotSha256)) ||
        (!browser && record.screenshotSha256 !== undefined) ||
        results.has(record.slot)
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
      }
      const v11Record = {
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
        slot: record.slot,
        provider: record.provider,
        model: record.model,
        observation: 'candidate_applied' as const,
        provenance: 'live_candidate' as const,
        durationMs: record.durationMs,
        traceSha256: record.traceIdSha256,
        ...(browser ? { screenshotSha256 } : {}),
      };
      snapshot.recordSlotResult(v11Record);
      results.set(record.slot, record);
    },
    recordDefaultOff(value) {
      const record = parseV8RunnerDefaultOff(value);
      const component = record.component;
      if (component === 'recovery' || defaultOff.has(component)) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
      }
      defaultOff.set(component, {
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
        component,
        containerSha256: record.container.newIdSha256,
        gates: {
          liveCallsEnabled: false,
          reviewAgentModelEnabled: false,
          plannerAgentModelEnabled: false,
        },
        providerInvocations: 0,
      });
    },
    recordScreenshot(component, contents) {
      if (
        (component !== 'review' && component !== 'planner') ||
        !(contents instanceof Uint8Array) ||
        !isReasonableV11RunnerPng(contents) ||
        screenshots.has(component)
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_SCREENSHOT_INVALID');
      }
      screenshots.set(component, sha256(contents));
    },
    recordOwnerIsolation(value) {
      const record = parseV8RunnerOwnerIsolation(value);
      flushDefaultOff();
      snapshot.recordOwnerIsolation({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
        accountSha256: snapshot.accountSha256,
        factsSha256: {
          reviewBefore: record.reviewFactsBeforeSha256,
          reviewAfter: record.reviewFactsAfterSha256,
          plannerBefore: record.plannerFactsBeforeSha256,
          plannerAfter: record.plannerFactsAfterSha256,
        },
        traceSha256: [...record.traceIdSha256],
        crossAccountInvisible: true,
        businessWrites: 0,
      });
    },
    recordCleanup(value) {
      const record = parseV8RunnerCleanup(value);
      snapshot.recordCleanup({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
        syntheticAccounts: record.syntheticAccounts,
        fixtures: record.fixtures,
        traces: record.traces,
        browserProfiles: record.browserProfiles,
        capabilities: record.capabilities,
      });
      cleanupRecorded = true;
    },
    async finalizeSuccess() {
      if (finalized || !cleanupRecorded) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_FINALIZE_INVALID');
      }
      const slotRecords =
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS.map((slot) =>
          results.get(slot),
        );
      if (
        slotRecords.some((record) => record === undefined) ||
        defaultOff.size !== 2 ||
        screenshots.size !== 2
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_FINALIZE_INVALID');
      }
      const completeRecords = slotRecords as z.infer<
        typeof v8RunnerSlotRecordSchema
      >[];
      const inputTokens = completeRecords.reduce(
        (total, record) => total + record.usage.inputTokens,
        0,
      );
      const outputTokens = completeRecords.reduce(
        (total, record) => total + record.usage.outputTokens,
        0,
      );
      const cost = calculateReviewPlannerV8ProductAcceptanceCost(
        inputTokens,
        outputTokens,
      );
      if (!cost.withinHardCap) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_BUDGET_INVALID');
      }
      const plan = screenshots.get('review');
      const today = screenshots.get('planner');
      if (plan === undefined || today === undefined) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_FINALIZE_INVALID');
      }
      snapshot.recordAcceptance({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
        environment: snapshot.environment,
        attemptSha256: snapshot.attemptSha256,
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        observation: 'candidate_applied',
        aggregate: {
          requests: 4,
          durationMs: completeRecords.reduce(
            (total, record) => total + record.durationMs,
            0,
          ),
          usage: { input: inputTokens, output: outputTokens },
          costCny: cost.costCny,
        },
        screenshotSha256: { plan, today },
        cleanup: true,
      });
      await snapshot.finalizeSuccess();
      finalized = true;
    },
  });
}

function snapshotV11RunnerAdapterInput(input: unknown) {
  try {
    if (!input || typeof input !== 'object') throw new Error();
    const source = input as Record<string, unknown>;
    const environment = source.environment;
    const attemptSha256 = source.attemptSha256;
    const ledger = source.ledger as ReviewPlannerV11ProductAcceptanceLedger;
    if (
      (environment !== 'branch' && environment !== 'main') ||
      typeof attemptSha256 !== 'string' ||
      !SHA256.test(attemptSha256) ||
      !ledger ||
      typeof ledger !== 'object'
    ) {
      throw new Error();
    }
    const claimSlot = ledger.claimSlot;
    const recordSlotResult = ledger.recordSlotResult;
    const recordDefaultOff = ledger.recordDefaultOff;
    const recordOwnerIsolation = ledger.recordOwnerIsolation;
    const recordCleanup = ledger.recordCleanup;
    const recordAcceptance = ledger.recordAcceptance;
    const finalizeSuccess = ledger.finalizeSuccess;
    if (
      typeof claimSlot !== 'function' ||
      typeof recordSlotResult !== 'function' ||
      typeof recordDefaultOff !== 'function' ||
      typeof recordOwnerIsolation !== 'function' ||
      typeof recordCleanup !== 'function' ||
      typeof recordAcceptance !== 'function' ||
      typeof finalizeSuccess !== 'function'
    ) {
      throw new Error();
    }
    const manifest = source.manifest;
    const parsedManifest =
      parseReviewPlannerV11ProductAcceptanceManifest(manifest);
    if (
      parsedManifest.environment !== environment ||
      parsedManifest.attemptSha256 !== attemptSha256
    ) {
      throw new Error();
    }
    return Object.freeze({
      environment,
      attemptSha256,
      accountSha256: Object.freeze({ ...parsedManifest.accountSha256 }),
      claimSlot: (slot: ReviewPlannerV11ProductAcceptanceExecutionSlot) =>
        claimSlot.call(ledger, slot),
      recordSlotResult: (value: unknown) =>
        recordSlotResult.call(ledger, value),
      recordDefaultOff: (value: unknown) =>
        recordDefaultOff.call(ledger, value),
      recordOwnerIsolation: (value: unknown) =>
        recordOwnerIsolation.call(ledger, value),
      recordCleanup: (value: unknown) => recordCleanup.call(ledger, value),
      recordAcceptance: (value: unknown) =>
        recordAcceptance.call(ledger, value),
      finalizeSuccess: () => Promise.resolve(finalizeSuccess.call(ledger)),
    });
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_INPUT_INVALID');
  }
}

function assertV11RunnerSlot(
  slot: string,
): asserts slot is ReviewPlannerV11ProductAcceptanceExecutionSlot {
  if (
    !(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS as readonly string[]
    ).includes(slot)
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
  }
}

function parseV8RunnerSlotRecord(value: unknown) {
  const parsed = v8RunnerSlotRecordSchema.safeParse(value);
  if (
    !parsed.success ||
    !hasCanonicalV8RunnerTraceSteps(parsed.data.slot, parsed.data.steps)
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
  }
  return parsed.data;
}

function parseV8RunnerDefaultOff(value: unknown) {
  const parsed =
    reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
  }
  return parsed.data;
}

function parseV8RunnerOwnerIsolation(value: unknown) {
  const parsed = v8RunnerOwnerIsolationSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
  }
  return parsed.data;
}

function parseV8RunnerCleanup(value: unknown) {
  const parsed = v8RunnerCleanupSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_RUNNER_RECORD_INVALID');
  }
  return parsed.data;
}

function componentForV11RunnerSlot(
  slot: ReviewPlannerV11ProductAcceptanceExecutionSlot,
): V11RunnerComponent {
  return slot.startsWith('review-') ? 'review' : 'planner';
}

function hasCanonicalV8RunnerTraceSteps(
  slot: ReviewPlannerV11ProductAcceptanceExecutionSlot,
  steps: readonly z.infer<typeof v8RunnerTraceStepSchema>[],
) {
  const component = componentForV11RunnerSlot(slot);
  const expected = [
    ['deterministic_review', false],
    ['review_candidate', component === 'review'],
    ['deterministic_planner', false],
    ['planner_candidate', component === 'planner'],
  ] as const;
  return steps.every(
    (step, index) =>
      step.name === expected[index]?.[0] &&
      step.attempted === expected[index]?.[1] &&
      step.disposition ===
        (step.attempted ? 'candidate_applied' : 'not_eligible') &&
      step.provenance ===
        (step.attempted ? 'live_candidate' : 'local_deterministic'),
  );
}

function isReasonableV11RunnerPng(bytes: Uint8Array) {
  if (
    bytes.byteLength < 45 ||
    bytes.byteLength > MAX_SCREENSHOT_BYTES ||
    !Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .subarray(0, PNG_SIGNATURE.byteLength)
      .equals(PNG_SIGNATURE)
  ) {
    return false;
  }
  const png = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.byteLength;
  let chunkIndex = 0;
  let seenIdat = false;
  let idatEnded = false;
  while (offset + 12 <= png.byteLength) {
    const dataLength = png.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > png.byteLength) {
      return false;
    }
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    const data = png.subarray(offset + 8, offset + 8 + dataLength);
    const expectedCrc = png.readUInt32BE(offset + 8 + dataLength);
    if (
      crc32(Buffer.concat([png.subarray(offset + 4, offset + 8), data])) !==
      expectedCrc
    ) {
      return false;
    }
    if (chunkIndex === 0) {
      if (type !== 'IHDR' || dataLength !== 13) return false;
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const compression = data[10];
      const filter = data[11];
      const interlace = data[12];
      if (
        width < 1 ||
        height < 1 ||
        width > 20_000 ||
        height > 20_000 ||
        !isValidPngBitDepth(bitDepth, colorType) ||
        compression !== 0 ||
        filter !== 0 ||
        (interlace !== 0 && interlace !== 1)
      ) {
        return false;
      }
    } else if (type === 'IHDR') {
      return false;
    }
    if (type === 'IDAT') {
      if (idatEnded || dataLength === 0) return false;
      seenIdat = true;
    } else if (seenIdat && type !== 'IEND') {
      idatEnded = true;
    }
    if (type === 'IEND') {
      return seenIdat && dataLength === 0 && chunkEnd === png.byteLength;
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  return false;
}

function isValidPngBitDepth(
  bitDepth: number | undefined,
  colorType: number | undefined,
) {
  if (bitDepth === undefined || colorType === undefined) return false;
  const allowed: Readonly<Record<number, readonly number[]>> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  return allowed[colorType]?.includes(bitDepth) === true;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOT_LEAVES =
  Object.freeze({
    'review-api': '.slot-01-review-api',
    'review-browser': '.slot-02-review-browser',
    'planner-api': '.slot-03-planner-api',
    'planner-browser': '.slot-04-planner-browser',
  } as const satisfies Readonly<
    Record<ReviewPlannerV11ProductAcceptanceExecutionSlot, string>
  >);

const V11_SUCCESS_PUBLIC_LEAVES = Object.freeze([
  '.acceptance-reserved',
  '.failure.json',
  'manifest.json',
  ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOTS.flatMap((slot) => {
    const claim =
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_EXECUTION_SLOT_LEAVES[slot];
    return [claim, `${claim}.result.json`];
  }),
  '.review-default-off.json',
  '.planner-default-off.json',
  '.owner-isolation-verified.json',
  '.cleanup-verified.json',
  'acceptance.json',
  '.acceptance-success',
] as const);

export const REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PUBLIC_LEAVES =
  V11_SUCCESS_PUBLIC_LEAVES;

const safeHashSchema = z.string().regex(SHA256);
const existingAttemptBindingSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v11-product-acceptance-attempt-v1'),
    attemptId: z.string().regex(SHA256),
    attemptSha256: safeHashSchema,
  })
  .strict()
  .refine(
    (value) => sha256(value.attemptId) === value.attemptSha256,
    'V11_ATTEMPT_HASH_INVALID',
  );
const componentHashesSchema = z
  .object({ review: safeHashSchema, planner: safeHashSchema })
  .strict()
  .refine((value) => value.review !== value.planner, {
    message: 'V11_COMPONENT_HASHES_NOT_ISOLATED',
  });

export const reviewPlannerV11ProductAcceptanceManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    commitSha: z.string().regex(COMMIT_SHA),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    accountSha256: componentHashesSchema,
    fixtureSha256: componentHashesSchema,
  })
  .strict();

const slotResultBase = {
  schemaVersion: z.literal(
    REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.slotResult,
  ),
  provider: z.literal('deepseek'),
  model: z.literal('deepseek-v4-pro'),
  observation: z.literal('candidate_applied'),
  provenance: z.literal('live_candidate'),
  durationMs: z.number().int().positive().max(60_000),
  traceSha256: safeHashSchema,
};

export const reviewPlannerV11ProductAcceptanceSlotResultSchema =
  z.discriminatedUnion('slot', [
    z.object({ ...slotResultBase, slot: z.literal('review-api') }).strict(),
    z
      .object({
        ...slotResultBase,
        slot: z.literal('review-browser'),
        screenshotSha256: safeHashSchema,
      })
      .strict(),
    z.object({ ...slotResultBase, slot: z.literal('planner-api') }).strict(),
    z
      .object({
        ...slotResultBase,
        slot: z.literal('planner-browser'),
        screenshotSha256: safeHashSchema,
      })
      .strict(),
  ]);

export const reviewPlannerV11ProductAcceptanceDefaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.defaultOff,
    ),
    component: z.enum(['review', 'planner']),
    containerSha256: safeHashSchema,
    gates: z
      .object({
        liveCallsEnabled: z.literal(false),
        reviewAgentModelEnabled: z.literal(false),
        plannerAgentModelEnabled: z.literal(false),
      })
      .strict(),
    providerInvocations: z.literal(0),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceOwnerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.ownerIsolation,
    ),
    accountSha256: componentHashesSchema,
    factsSha256: z
      .object({
        reviewBefore: safeHashSchema,
        reviewAfter: safeHashSchema,
        plannerBefore: safeHashSchema,
        plannerAfter: safeHashSchema,
      })
      .strict(),
    traceSha256: z.array(safeHashSchema).length(4),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.factsSha256.reviewBefore !== value.factsSha256.reviewAfter ||
      value.factsSha256.plannerBefore !== value.factsSha256.plannerAfter ||
      new Set(value.traceSha256).size !== 4
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V11_OWNER_ISOLATION_INVALID',
      });
    }
  });

export const reviewPlannerV11ProductAcceptanceCleanupSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.cleanup,
    ),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceAggregateSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    observation: z.literal('candidate_applied'),
    aggregate: z
      .object({
        requests: z.literal(4),
        durationMs: z.number().int().positive().max(240_000),
        usage: z
          .object({
            input: z.number().int().positive().max(100_000),
            output: z.number().int().positive().max(100_000),
          })
          .strict(),
        costCny: z.string().regex(COST_CNY),
      })
      .strict(),
    screenshotSha256: z
      .object({ plan: safeHashSchema, today: safeHashSchema })
      .strict(),
    cleanup: z.literal(true),
  })
  .strict();

export const reviewPlannerV11ProductAcceptanceSuccessSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    manifestSha256: safeHashSchema,
    resultSha256: z.array(safeHashSchema).length(4),
    defaultOffSha256: z.array(safeHashSchema).length(2),
    ownerIsolationSha256: safeHashSchema,
    cleanupSha256: safeHashSchema,
    acceptanceSha256: safeHashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.resultSha256).size !== 4 ||
      new Set(value.defaultOffSha256).size !== 2
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V11_SUCCESS_HASHES_NOT_UNIQUE',
      });
    }
  });

export const reviewPlannerV11ProductAcceptanceExecutionManifestSchema = z
  .object({
    schemaVersion: z.literal(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.executionManifest,
    ),
    environment: z.enum(['branch', 'main']),
    attemptSha256: safeHashSchema,
    resources: z
      .object({
        accountId: z
          .object({
            review: syntheticSelectorSchema(V11_SYNTHETIC_ACCOUNT_ID),
            planner: syntheticSelectorSchema(V11_SYNTHETIC_ACCOUNT_ID),
          })
          .strict()
          .refine((value) => value.review !== value.planner, {
            message: 'V11_EXECUTION_ACCOUNTS_NOT_ISOLATED',
          }),
        fixtureId: z
          .object({
            review: syntheticSelectorSchema(V11_SYNTHETIC_FIXTURE_ID),
            planner: syntheticSelectorSchema(V11_SYNTHETIC_FIXTURE_ID),
          })
          .strict()
          .refine((value) => value.review !== value.planner, {
            message: 'V11_EXECUTION_FIXTURES_NOT_ISOLATED',
          }),
        browser: z
          .object({
            executablePath: z.string().regex(WINDOWS_ABSOLUTE_PATH),
            profilePath: z.string().min(1).max(500),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

function syntheticSelectorSchema(pattern: RegExp) {
  return z
    .string()
    .regex(pattern)
    .refine((value) => !CREDENTIAL_LIKE_SELECTOR.test(value), {
      message: 'V11_EXECUTION_SELECTOR_CREDENTIAL_INVALID',
    });
}

export type ReviewPlannerV11ProductAcceptanceManifestRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceManifestSchema
>;
export type ReviewPlannerV11ProductAcceptanceSlotResultRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceSlotResultSchema
>;
export type ReviewPlannerV11ProductAcceptanceDefaultOffRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceDefaultOffSchema
>;
export type ReviewPlannerV11ProductAcceptanceOwnerIsolationRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceOwnerIsolationSchema
>;
export type ReviewPlannerV11ProductAcceptanceCleanupRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceCleanupSchema
>;
export type ReviewPlannerV11ProductAcceptanceAggregateRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceAggregateSchema
>;
export type ReviewPlannerV11ProductAcceptanceSuccessRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceSuccessSchema
>;
export type ReviewPlannerV11ProductAcceptanceExecutionManifestRecord = z.infer<
  typeof reviewPlannerV11ProductAcceptanceExecutionManifestSchema
>;

export function parseReviewPlannerV11ProductAcceptanceManifest(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceManifestRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceManifestSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceSlotResult(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceSlotResultRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceSlotResultSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceDefaultOff(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceDefaultOffRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceDefaultOffSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceOwnerIsolation(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceOwnerIsolationRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceOwnerIsolationSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceCleanup(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceCleanupRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceCleanupSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceAggregate(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceAggregateRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceAggregateSchema,
    value,
    true,
  );
}

export function parseReviewPlannerV11ProductAcceptanceSuccess(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceSuccessRecord {
  return parsePublicRecord(
    reviewPlannerV11ProductAcceptanceSuccessSchema,
    value,
  );
}

export function parseReviewPlannerV11ProductAcceptanceExecutionManifest(
  value: unknown,
): ReviewPlannerV11ProductAcceptanceExecutionManifestRecord {
  if (containsForbiddenExecutionKey(value, false)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  const parsed =
    reviewPlannerV11ProductAcceptanceExecutionManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  return Object.freeze({ ...parsed.data });
}

export async function writeReviewPlannerV11ProductAcceptanceExecutionManifest(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    value: unknown;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
    input.value,
  );
  return writeReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
    {
      ...input,
      value: manifest,
      attemptSha256: binding.attemptSha256,
    },
  );
}

export async function writeReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    owner: ReviewPlannerV11ProductAcceptanceOwner;
    attemptSha256: string;
    value: unknown;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
    repoRoot: input.repoRoot,
    environment: input.environment,
  });
  if (binding.attemptSha256 !== input.attemptSha256) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
    input.value,
  );
  if (
    manifest.environment !== input.environment ||
    manifest.attemptSha256 !== input.attemptSha256 ||
    manifest.resources.browser.profilePath !==
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
        input.environment,
      )
  ) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length > 0) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_INVALID');
    }
    const result = directory.commitExclusiveDurableFileViaRename(
      PRIVATE_EXECUTION_MANIFEST_LEAF,
      serialize(manifest),
    );
    if (!result.committed || result.cleanupStatus !== 'closed') {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
    }
    return Object.freeze({ ...manifest });
  } catch (error) {
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    directory?.close();
  }
}

export async function readReviewPlannerV11ProductAcceptanceExecutionManifest(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  const attemptSha256 = await readBoundV11AttemptHashForExecution(input);
  return readReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
    { ...input, attemptSha256 },
  );
}

export async function readReviewPlannerV11ProductAcceptanceExecutionManifestForReservedAttempt(
  input: Readonly<{
    repoRoot: string;
    environment: 'branch' | 'main';
    attemptSha256: string;
  }>,
): Promise<ReviewPlannerV11ProductAcceptanceExecutionManifestRecord> {
  if (!SHA256.test(input.attemptSha256)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length !== 1 || leaves[0] !== PRIVATE_EXECUTION_MANIFEST_LEAF) {
      throw new Error();
    }
    const manifest = parseReviewPlannerV11ProductAcceptanceExecutionManifest(
      JSON.parse(
        directory.readRegularFile(PRIVATE_EXECUTION_MANIFEST_LEAF).toString(),
      ),
    );
    if (
      manifest.environment !== input.environment ||
      manifest.attemptSha256 !== input.attemptSha256 ||
      manifest.resources.browser.profilePath !==
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
          input.environment,
        )
    ) {
      throw new Error();
    }
    return Object.freeze({ ...manifest });
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    directory?.close();
  }
}

export function executionManifestMatchesPublicManifest(
  execution: ReviewPlannerV11ProductAcceptanceExecutionManifestRecord,
  manifest: ReviewPlannerV11ProductAcceptanceManifestRecord,
) {
  return (
    execution.environment === manifest.environment &&
    execution.attemptSha256 === manifest.attemptSha256 &&
    sha256(execution.resources.accountId.review) ===
      manifest.accountSha256.review &&
    sha256(execution.resources.accountId.planner) ===
      manifest.accountSha256.planner &&
    sha256(execution.resources.fixtureId.review) ===
      manifest.fixtureSha256.review &&
    sha256(execution.resources.fixtureId.planner) ===
      manifest.fixtureSha256.planner
  );
}

function parsePublicRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  allowAggregateUsage = false,
): T {
  if (containsForbiddenExecutionKey(value, allowAggregateUsage)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_RECORD_INVALID');
  }
  return Object.freeze({ ...(parsed.data as Record<string, unknown>) }) as T;
}

function containsForbiddenExecutionKey(
  value: unknown,
  allowAggregateUsage: boolean,
) {
  const seen = new Set<object>();
  const visit = (candidate: unknown, path: readonly string[]): boolean => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);
    try {
      for (const key of Object.keys(candidate)) {
        const nextPath = [...path, key];
        const aggregateUsage =
          allowAggregateUsage &&
          path.length === 1 &&
          path[0] === 'aggregate' &&
          key === 'usage';
        if (
          !aggregateUsage &&
          /raw.?error|prompt|response|url|header|token|credential|cookie|user.?fact|email|password|access.?token|capability|provider.?key|api.?key|trace.?id/i.test(
            key,
          )
        ) {
          return true;
        }
        if (visit((candidate as Record<string, unknown>)[key], nextPath)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  };
  return visit(value, []);
}

async function readBoundV11AttemptHashForExecution(input: {
  repoRoot: string;
  environment: 'branch' | 'main';
}) {
  let publicDirectory: WindowsNoReparseChildDirectory | null = null;
  let privateDirectory: WindowsNoReparseChildDirectory | null = null;
  try {
    publicDirectory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    publicDirectory.assertLocalFixedNtfsVolume();
    const leaves = publicDirectory.listLeafNames();
    if (
      !leaves.includes('.acceptance-reserved') ||
      leaves.some(
        (leaf) =>
          !(
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PUBLIC_LEAVES as readonly string[]
          ).includes(leaf),
      )
    ) {
      throw new Error();
    }
    const attemptSha256 = publicDirectory
      .readRegularFile('.acceptance-reserved')
      .toString();
    if (
      !SHA256.test(attemptSha256.trim()) ||
      attemptSha256 !== `${attemptSha256.trim()}\n`
    ) {
      throw new Error();
    }
    privateDirectory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
          input.environment,
        ),
      ],
    );
    privateDirectory.assertLocalFixedNtfsVolume();
    const privateLeaves = privateDirectory.listLeafNames();
    if (
      !privateLeaves.includes(PRIVATE_OWNER_LOCK_LEAF) ||
      !privateLeaves.includes(PRIVATE_ATTEMPT_BINDING_LEAF) ||
      privateLeaves.some(
        (leaf) =>
          leaf !== PRIVATE_OWNER_LOCK_LEAF &&
          leaf !== PRIVATE_ATTEMPT_BINDING_LEAF &&
          !PRIVATE_CHECKPOINT_LEAF.test(leaf),
      )
    ) {
      throw new Error();
    }
    const binding = existingAttemptBindingSchema.parse(
      JSON.parse(
        privateDirectory
          .readRegularFile(PRIVATE_ATTEMPT_BINDING_LEAF)
          .toString(),
      ),
    );
    if (binding.attemptSha256 !== attemptSha256.trim()) throw new Error();
    return binding.attemptSha256;
  } catch {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EXECUTION_MANIFEST_IO');
  } finally {
    privateDirectory?.close();
    publicDirectory?.close();
  }
}

function serialize(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}
