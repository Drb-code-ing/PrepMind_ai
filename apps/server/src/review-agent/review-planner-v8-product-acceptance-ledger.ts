import { createHash, randomBytes } from 'node:crypto';

import { z } from 'zod';

import {
  calculateReviewPlannerV8ProductAcceptanceCost,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION,
  reviewPlannerV8ProductAcceptanceEvidenceSchema,
  serializeReviewPlannerV8ProductAcceptanceEvidence,
} from './review-planner-v8-product-acceptance-evidence';
import {
  assertReviewPlannerV8ProductAcceptanceRecoveryClear,
  assertReviewPlannerV8ProductAcceptanceOwner,
  assertReviewPlannerV11ProductAcceptanceFailureAuthority,
  assertReviewPlannerV11ProductAcceptanceOwner,
  bindReviewPlannerV11ProductAcceptanceAttempt,
  claimReviewPlannerV8ProductAcceptancePresealMode,
  inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint,
  readReviewPlannerV11ProductAcceptanceAttemptBinding,
  registerReviewPlannerV11ProductAcceptanceOwnerAttempt,
  readReviewPlannerV8ProductAcceptanceLocalMode,
  reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
  verifyReviewPlannerV8ProductAcceptanceRecoveryTerminal,
  type ReviewPlannerV8ProductAcceptanceEnvironment,
  type ReviewPlannerV8ProductAcceptanceOwner,
  type ReviewPlannerV11ProductAcceptanceFailureAuthority,
  type ReviewPlannerV11ProductAcceptanceOwner,
} from './review-planner-v8-product-acceptance-recovery';
import {
  type DurableFaultInjector,
  openWindowsNoReparseExistingFrozenDirectory,
  openWindowsNoReparseFrozenDirectory,
  openWindowsNoReparseDirectoryForTests,
  type WindowsExclusiveLifetimeFile,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';
import {
  normalizeReviewPlannerProductAcceptanceSchemaRecord,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceProfile,
  type ReviewPlannerProductAcceptanceSchemaKey,
  withReviewPlannerProductAcceptanceSchemaIdentity,
} from './review-planner-product-acceptance-profile';
import {
  parseReviewPlannerV11ProductAcceptanceFailure,
  serializeReviewPlannerV11ProductAcceptanceFailure,
  type ReviewPlannerV11ProductAcceptanceFailureRecord,
} from './review-planner-v11-product-acceptance-diagnostics';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
const SLOT_RESERVATION = Object.freeze({
  inputTokens: 1_950,
  outputTokens: 440,
});
const SLOTS = Object.freeze([
  'review-api',
  'review-browser',
  'planner-api',
  'planner-browser',
] as const);
type Slot = (typeof SLOTS)[number];
const SLOT_LEAVES: Readonly<Record<Slot, string>> = Object.freeze({
  'review-api': '.slot-01-review-api',
  'review-browser': '.slot-02-review-browser',
  'planner-api': '.slot-03-planner-api',
  'planner-browser': '.slot-04-planner-browser',
});
const SEALED_MARKER_LEAVES = Object.freeze([
  '.acceptance-reserved',
  ...SLOTS.map((slot) => SLOT_LEAVES[slot]),
] as const);

const PUBLIC_LEAVES = Object.freeze([
  '.acceptance-reserved',
  'manifest.json',
  ...SLOTS.flatMap((slot) => [
    SLOT_LEAVES[slot],
    `${SLOT_LEAVES[slot]}.result.json`,
  ]),
  '.review-default-off.json',
  '.planner-default-off.json',
  '.owner-isolation-verified.json',
  '.cleanup-verified.json',
  '.recovery-only.json',
  'acceptance.json',
  '.acceptance-success',
  'plan.png',
  'today.png',
] as const);

const V11_PUBLIC_LEAVES = Object.freeze([
  '.acceptance-reserved',
  '.failure.json',
] as const);

const RECOVERY_STAGE_LEAVES = Object.freeze([
  'restore.claimed',
  'restore.verified.json',
  'cleanup.claimed',
  'cleanup.verified.json',
] as const);

const reservationSchema = z
  .object({
    slotInputTokens: z.literal(1_950),
    slotOutputTokens: z.literal(440),
    environmentInputTokens: z.literal(7_800),
    environmentOutputTokens: z.literal(1_760),
    combinedInputTokens: z.literal(15_600),
    combinedOutputTokens: z.literal(3_520),
    environmentWorstCaseCostCny: z.literal('0.03396000'),
    combinedWorstCaseCostCny: z.literal('0.06792000'),
    hardCapCny: z.literal('0.10000000'),
  })
  .strict();

const pricingSchema = z
  .object({
    priceProfileId: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.priceProfileId,
    ),
    inputRateCnyPerMillion: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.inputRateCnyPerMillion,
    ),
    outputRateCnyPerMillion: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.outputRateCnyPerMillion,
    ),
    snapshotDate: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.snapshotDate,
    ),
    source: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.source,
    ),
    rounding: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.rounding,
    ),
    hardCapCny: z.literal(
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PRICE_PROFILE.hardCapCny,
    ),
  })
  .strict();

const manifestSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-manifest-v1'),
    environment: z.enum(['branch', 'main']),
    commitSha: z.string().regex(COMMIT_SHA),
    pairedEvidenceSha256: z.string().regex(SHA256),
    provider: z.literal('deepseek'),
    model: z.literal('deepseek-v4-pro'),
    pricing: pricingSchema,
    accountIdSha256: z
      .object({
        review: z.string().regex(SHA256),
        planner: z.string().regex(SHA256),
      })
      .strict(),
    fixtureIdSha256: z
      .object({
        review: z.string().regex(SHA256),
        planner: z.string().regex(SHA256),
      })
      .strict(),
    reservation: reservationSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.accountIdSha256.review === value.accountIdSha256.planner) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accountIdSha256'],
        message: 'ACCOUNTS_NOT_ISOLATED',
      });
    }
    if (value.fixtureIdSha256.review === value.fixtureIdSha256.planner) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixtureIdSha256'],
        message: 'FIXTURES_NOT_ISOLATED',
      });
    }
  });

const usageSchema = z
  .object({
    inputTokens: z.number().int().positive().max(SLOT_RESERVATION.inputTokens),
    outputTokens: z
      .number()
      .int()
      .positive()
      .max(SLOT_RESERVATION.outputTokens),
  })
  .strict();

function traceStepSchema(
  name:
    | 'deterministic_review'
    | 'review_candidate'
    | 'deterministic_planner'
    | 'planner_candidate',
  attempted: boolean,
) {
  return z
    .object({
      name: z.literal(name),
      attempted: z.literal(attempted),
      disposition: attempted
        ? z.literal('candidate_applied')
        : z.literal('not_eligible'),
      provenance: attempted
        ? z.literal('live_candidate')
        : z.literal('local_deterministic'),
    })
    .strict();
}

function traceStepsSchema(component: 'review' | 'planner') {
  return z.tuple([
    traceStepSchema('deterministic_review', false),
    traceStepSchema('review_candidate', component === 'review'),
    traceStepSchema('deterministic_planner', false),
    traceStepSchema('planner_candidate', component === 'planner'),
  ]);
}

const slotResultBase = {
  schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-slot-result-v1'),
  provider: z.literal('deepseek'),
  model: z.literal('deepseek-v4-pro'),
  usage: usageSchema,
  durationMs: z.number().int().positive().max(60_000),
  pricingKnown: z.literal(false),
  costEstimateUsd: z.literal(0),
  disposition: z.literal('candidate_applied'),
  provenance: z.literal('live_candidate'),
  traceIdSha256: z.string().regex(SHA256),
};

const slotResultSchema = z.discriminatedUnion('slot', [
  z
    .object({
      ...slotResultBase,
      slot: z.literal('review-api'),
      steps: traceStepsSchema('review'),
    })
    .strict(),
  z
    .object({
      ...slotResultBase,
      slot: z.literal('review-browser'),
      steps: traceStepsSchema('review'),
      screenshotSha256: z.string().regex(SHA256),
    })
    .strict(),
  z
    .object({
      ...slotResultBase,
      slot: z.literal('planner-api'),
      steps: traceStepsSchema('planner'),
    })
    .strict(),
  z
    .object({
      ...slotResultBase,
      slot: z.literal('planner-browser'),
      steps: traceStepsSchema('planner'),
      screenshotSha256: z.string().regex(SHA256),
    })
    .strict(),
]);

const ownerIsolationSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-owner-isolation-v1',
    ),
    reviewFactsBeforeSha256: z.string().regex(SHA256),
    reviewFactsAfterSha256: z.string().regex(SHA256),
    plannerFactsBeforeSha256: z.string().regex(SHA256),
    plannerFactsAfterSha256: z.string().regex(SHA256),
    traceIdSha256: z.array(z.string().regex(SHA256)).length(4),
    crossAccountInvisible: z.literal(true),
    businessWrites: z.literal(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.reviewFactsBeforeSha256 !== value.reviewFactsAfterSha256 ||
      value.plannerFactsBeforeSha256 !== value.plannerFactsAfterSha256 ||
      new Set(value.traceIdSha256).size !== 4
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OWNER_ISOLATION_INVALID',
      });
    }
  });

const cleanupSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-cleanup-v1'),
    syntheticAccounts: z.literal(0),
    fixtures: z.literal(0),
    traces: z.literal(0),
    browserProfiles: z.literal(0),
    capabilities: z.literal(0),
  })
  .strict();

const successSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-success-v1'),
    environment: z.enum(['branch', 'main']),
    pairedEvidenceSha256: z.string().regex(SHA256),
    markerSha256: z.array(z.string().regex(SHA256)).length(5),
    manifestSha256: z.string().regex(SHA256),
    resultSha256: z.array(z.string().regex(SHA256)).length(4),
    defaultOffSha256: z.array(z.string().regex(SHA256)).length(2),
    ownerIsolationSha256: z.string().regex(SHA256),
    cleanupSha256: z.string().regex(SHA256),
    acceptanceSha256: z.string().regex(SHA256),
    screenshotSha256: z.array(z.string().regex(SHA256)).length(2),
    completion: z.discriminatedUnion('mode', [
      z.object({ mode: z.literal('product') }).strict(),
      z
        .object({
          mode: z.literal('preseal'),
          modeSha256: z.string().regex(SHA256),
        })
        .strict(),
    ]),
  })
  .strict();

const recoveryTerminalSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-recovery-terminal-v1',
    ),
    environment: z.enum(['branch', 'main']),
    status: z.literal('failed'),
    reason: z.literal('hard_crash_recovered'),
    providerInvocations: z.literal(0),
    recoveryManifestSha256: z.string().regex(SHA256),
    restoreReceiptSha256: z.string().regex(SHA256),
    cleanupReceiptSha256: z.string().regex(SHA256),
  })
  .strict();

type ManifestRecord = z.infer<typeof manifestSchema>;
type SlotResultRecord = z.infer<typeof slotResultSchema>;
type OwnerIsolationRecord = z.infer<typeof ownerIsolationSchema>;
type CleanupRecord = z.infer<typeof cleanupSchema>;
type DefaultOffRecord = z.infer<
  typeof reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema
>;

function buildOfficialAcceptanceEvidence(input: {
  manifest: ManifestRecord;
  results: readonly SlotResultRecord[];
  defaultOff: readonly DefaultOffRecord[];
  ownerProof: OwnerIsolationRecord;
  cleanup: CleanupRecord;
  screenshots: Readonly<{ plan: string; today: string }>;
}) {
  const expectedTraceIds = input.results.map((result) => result.traceIdSha256);
  if (
    input.results.length !== 4 ||
    !arraysEqual(input.ownerProof.traceIdSha256, expectedTraceIds) ||
    input.defaultOff.length !== 2 ||
    input.defaultOff[0]?.component !== 'review' ||
    input.defaultOff[1]?.component !== 'planner' ||
    input.cleanup.syntheticAccounts !== 0 ||
    input.cleanup.fixtures !== 0 ||
    input.cleanup.traces !== 0 ||
    input.cleanup.browserProfiles !== 0 ||
    input.cleanup.capabilities !== 0
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  const reviewResults = input.results.slice(0, 2);
  const plannerResults = input.results.slice(2, 4);
  const component = (
    name: 'review' | 'planner',
    results: readonly SlotResultRecord[],
  ) => ({
    component: name,
    observation: { attempted: true, degraded: false },
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
    durationMs: results.reduce((total, result) => total + result.durationMs, 0),
    usage: {
      inputTokens: results.reduce(
        (total, result) => total + result.usage.inputTokens,
        0,
      ),
      outputTokens: results.reduce(
        (total, result) => total + result.usage.outputTokens,
        0,
      ),
    },
    requestCount: 2,
  });
  const review = component('review', reviewResults);
  const planner = component('planner', plannerResults);
  const inputTokens = review.usage.inputTokens + planner.usage.inputTokens;
  const outputTokens = review.usage.outputTokens + planner.usage.outputTokens;
  const cost = calculateReviewPlannerV8ProductAcceptanceCost(
    inputTokens,
    outputTokens,
  );
  const targetCandidateAttempts = input.results.reduce(
    (total, result) =>
      total + result.steps.filter((step) => step.attempted).length,
    0,
  );
  return reviewPlannerV8ProductAcceptanceEvidenceSchema.parse({
    schemaVersion: 'phase-6.9.5-review-planner-v8-product-acceptance-v1',
    environment: input.manifest.environment,
    commitSha: input.manifest.commitSha,
    provider: input.manifest.provider,
    model: input.manifest.model,
    components: { review, planner },
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
      targetCandidateAttempts,
    },
    accountIdSha256: input.manifest.accountIdSha256,
    ownerIsolation: input.ownerProof.crossAccountInvisible,
    factsUnchanged:
      input.ownerProof.reviewFactsBeforeSha256 ===
        input.ownerProof.reviewFactsAfterSha256 &&
      input.ownerProof.plannerFactsBeforeSha256 ===
        input.ownerProof.plannerFactsAfterSha256,
    gateRestored: true,
    cleanup: true,
    totals: {
      requests: 4,
      inputTokens,
      outputTokens,
      costCny: cost.costCny,
    },
    pricing: input.manifest.pricing,
    pairedEvidenceSha256: input.manifest.pairedEvidenceSha256,
    planScreenshotSha256: input.screenshots.plan,
    todayScreenshotSha256: input.screenshots.today,
  });
}

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  profile: ReviewPlannerProductAcceptanceProfile;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  recoveryDirectory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  closed: boolean;
};

export type ReviewPlannerV8ProductAcceptanceLedger = Readonly<{
  environment(): ReviewPlannerV8ProductAcceptanceEnvironment;
  writeManifest(value: unknown): void;
  claimSlot(slot: Slot): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordScreenshot(component: 'review' | 'planner', contents: Uint8Array): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV8ProductAcceptanceLedger,
  LedgerState
>();

type V11LedgerState = {
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  attemptSha256: string;
  directory: WindowsNoReparseChildDirectory;
  reservationGuard: WindowsExclusiveLifetimeFile;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
  cleanupInjectedHandles: (() => void) | null;
  closed: boolean;
};

export type ReviewPlannerV11ProductAcceptanceLedger = Readonly<{
  recordFailure(
    authority: ReviewPlannerV11ProductAcceptanceFailureAuthority,
    value: unknown,
  ): void;
  close(): void;
}>;

const v11LedgerState = new WeakMap<
  ReviewPlannerV11ProductAcceptanceLedger,
  V11LedgerState
>();

type ReserveLedgerInput = {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  pairedEvidenceSha256?: string;
  profile?: ReviewPlannerProductAcceptanceProfile;
};

export async function reserveReviewPlannerV8ProductAcceptanceLedger(
  input: ReserveLedgerInput,
): Promise<ReviewPlannerV8ProductAcceptanceLedger> {
  return reserveLedger(input, null, false);
}

export async function reserveReviewPlannerV8ProductAcceptanceLedgerForTests(
  input: ReserveLedgerInput &
    Readonly<{
      injector: DurableFaultInjector;
      failRecoveryOpenForTests?: boolean;
    }>,
): Promise<ReviewPlannerV8ProductAcceptanceLedger> {
  const facade = await openWindowsNoReparseDirectoryForTests(
    input.repoRoot,
    [
      ...(
        input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE
      ).publicLedgerSegments(input.environment),
    ],
    input.injector,
    true,
  );
  try {
    return await reserveLedger(
      input,
      facade,
      input.failRecoveryOpenForTests === true,
    );
  } catch (error) {
    facade.cleanupInjectedHandles();
    facade.directory.close();
    throw error;
  }
}

export async function reserveReviewPlannerV11ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
}): Promise<ReviewPlannerV11ProductAcceptanceLedger> {
  return reserveV11Ledger(input, null);
}

export async function reserveReviewPlannerV11ProductAcceptanceLedgerForTests(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
  injector: DurableFaultInjector;
}): Promise<ReviewPlannerV11ProductAcceptanceLedger> {
  const facade = await openWindowsNoReparseDirectoryForTests(
    input.repoRoot,
    [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ],
    input.injector,
    true,
  );
  try {
    return await reserveV11Ledger(input, facade);
  } catch (error) {
    facade.cleanupInjectedHandles();
    facade.directory.close();
    throw error;
  }
}

async function reserveV11Ledger(
  input: {
    repoRoot: string;
    environment: ReviewPlannerV8ProductAcceptanceEnvironment;
    owner: ReviewPlannerV11ProductAcceptanceOwner;
  },
  testFacade: Readonly<{
    directory: WindowsNoReparseChildDirectory;
    cleanupInjectedHandles(): void;
  }> | null,
): Promise<ReviewPlannerV11ProductAcceptanceLedger> {
  if (!isV11Environment(input.environment)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  let directory: WindowsNoReparseChildDirectory | null =
    testFacade?.directory ?? null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    directory ??= await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        input.environment,
      ),
    ]);
    directory.assertLocalFixedNtfsVolume();
    if (directory.listLeafNames().length > 0) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    const attemptId = randomBytes(32).toString('hex');
    const attemptSha256 = createHash('sha256').update(attemptId).digest('hex');
    publishV11(directory, '.acceptance-reserved', `${attemptSha256}\n`);
    const binding = await bindReviewPlannerV11ProductAcceptanceAttempt({
      repoRoot: input.repoRoot,
      environment: input.environment,
      owner: input.owner,
      attemptId,
    });
    if (binding.attemptSha256 !== attemptSha256) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    reservationGuard = directory.tryAcquireExclusiveLifetimeFile(
      '.acceptance-reserved',
    );
    if (reservationGuard === null) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    registerReviewPlannerV11ProductAcceptanceOwnerAttempt(
      input.owner,
      input.environment,
      attemptSha256,
    );
    const ledger = createV11Ledger({
      environment: input.environment,
      attemptSha256,
      directory,
      reservationGuard,
      owner: input.owner,
      cleanupInjectedHandles: testFacade?.cleanupInjectedHandles ?? null,
      closed: false,
    });
    directory = null;
    reservationGuard = null;
    return ledger;
  } catch (error) {
    reservationGuard?.close();
    if (testFacade === null) directory?.close();
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function openReviewPlannerV11ProductAcceptanceRecoveryLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV11ProductAcceptanceOwner;
}): Promise<ReviewPlannerV11ProductAcceptanceLedger> {
  if (!isV11Environment(input.environment)) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV11ProductAcceptanceOwner(input.owner, input.environment, [
    'recovery',
  ]);
  let directory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    const binding = await readReviewPlannerV11ProductAcceptanceAttemptBinding({
      repoRoot: input.repoRoot,
      environment: input.environment,
    });
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (
      leaves.some(
        (leaf) => !(V11_PUBLIC_LEAVES as readonly string[]).includes(leaf),
      ) ||
      !leaves.includes('.acceptance-reserved')
    ) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    reservationGuard = directory.tryAcquireExclusiveLifetimeFile(
      '.acceptance-reserved',
    );
    if (reservationGuard === null) {
      throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    }
    const ledger = createV11Ledger({
      environment: input.environment,
      attemptSha256: binding.attemptSha256,
      directory,
      reservationGuard,
      owner: input.owner,
      cleanupInjectedHandles: null,
      closed: false,
    });
    directory = null;
    reservationGuard = null;
    return ledger;
  } catch (error) {
    reservationGuard?.close();
    directory?.close();
    if (
      error instanceof Error &&
      /^V11_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  }
}

async function reserveLedger(
  input: ReserveLedgerInput,
  testFacade: Readonly<{
    directory: WindowsNoReparseChildDirectory;
    cleanupInjectedHandles(): void;
  }> | null,
  failRecoveryOpenForTests: boolean,
): Promise<ReviewPlannerV8ProductAcceptanceLedger> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  if (input.environment !== 'branch' && input.environment !== 'main') {
    throw new Error('V8_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV8ProductAcceptanceOwner(
    input.owner,
    input.environment,
    ['product'],
    profile,
  );
  if (input.environment === 'main') {
    if (!input.pairedEvidenceSha256?.match(SHA256)) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_MAIN_LINEAGE_INVALID');
    }
    const branch = await readReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: input.repoRoot,
      environment: 'branch',
      profile,
    });
    if (branch.status !== 'complete') {
      throw new Error('V8_PRODUCT_ACCEPTANCE_BRANCH_INCOMPLETE');
    }
    if (branch.pairedEvidenceSha256 !== input.pairedEvidenceSha256) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_MAIN_LINEAGE_INVALID');
    }
    if (
      branch.inputTokens + 7_800 >
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.inputTokens ||
      branch.outputTokens + 1_760 >
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION.outputTokens ||
      !calculateReviewPlannerV8ProductAcceptanceCost(
        branch.inputTokens + 7_800,
        branch.outputTokens + 1_760,
      ).withinHardCap
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_COMBINED_BUDGET_EXCEEDED');
    }
  }
  let directory: WindowsNoReparseChildDirectory | null =
    testFacade?.directory ?? null;
  let recoveryDirectory: WindowsNoReparseChildDirectory | null = null;
  let reservationGuard: WindowsExclusiveLifetimeFile | null = null;
  try {
    directory ??= await openWindowsNoReparseFrozenDirectory(input.repoRoot, [
      ...profile.publicLedgerSegments(input.environment),
    ]);
    if (failRecoveryOpenForTests) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    recoveryDirectory = await openWindowsNoReparseFrozenDirectory(
      input.repoRoot,
      [...profile.recoverySegments(input.environment)],
    );
    directory.assertLocalFixedNtfsVolume();
    recoveryDirectory.assertLocalFixedNtfsVolume();
    const existing = directory.listLeafNames();
    if (existing.length > 0) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    publish(directory, '.acceptance-reserved', '');
    reservationGuard = directory.tryAcquireExclusiveLifetimeFile(
      '.acceptance-reserved',
    );
    if (reservationGuard === null) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    const ledger = createLedger({
      repoRoot: input.repoRoot,
      environment: input.environment,
      profile,
      owner: input.owner,
      directory,
      recoveryDirectory,
      reservationGuard,
      closed: false,
    });
    return ledger;
  } catch (error) {
    reservationGuard?.close();
    recoveryDirectory?.close();
    if (testFacade === null) directory?.close();
    if (
      error instanceof Error &&
      /^V8_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

export async function readReviewPlannerV8ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<
  | Readonly<{
      status: 'empty' | 'incomplete' | 'recovery_only' | 'evidence_io';
    }>
  | Readonly<{
      status: 'complete';
      pairedEvidenceSha256: string;
      inputTokens: number;
      outputTokens: number;
      costCny: string;
    }>
> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [...profile.publicLedgerSegments(input.environment)],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      leaves.some(
        (leaf) => !(PUBLIC_LEAVES as readonly string[]).includes(leaf),
      )
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    const success = leaves.includes('.acceptance-success');
    const recovery = leaves.includes('.recovery-only.json');
    if (success && recovery)
      return Object.freeze({ status: 'evidence_io' as const });
    if (recovery) {
      if (
        !leaves.includes('.acceptance-reserved') ||
        leaves.includes('acceptance.json')
      ) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      const terminal = readProfileStrict(
        directory,
        '.recovery-only.json',
        recoveryTerminalSchema,
        profile,
        'recoveryTerminal',
      );
      if (terminal.environment !== input.environment) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      await verifyReviewPlannerV8ProductAcceptanceRecoveryTerminal({
        repoRoot: input.repoRoot,
        environment: input.environment,
        terminal,
        profile,
      });
      return Object.freeze({ status: 'recovery_only' as const });
    }
    if (!success) return Object.freeze({ status: 'incomplete' as const });
    const localMode = await readReviewPlannerV8ProductAcceptanceLocalMode({
      repoRoot: input.repoRoot,
      environment: input.environment,
      profile,
    });
    const aggregate = verifyCompleteLedger(
      directory,
      input.environment,
      localMode,
      profile,
    );
    return Object.freeze({ status: 'complete' as const, ...aggregate });
  } catch {
    return Object.freeze({ status: 'evidence_io' as const });
  } finally {
    directory?.close();
  }
}

export async function readReviewPlannerV11ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
}): Promise<
  | Readonly<{ status: 'empty' | 'incomplete' | 'evidence_io' }>
  | Readonly<
      {
        status: 'operation_failed';
      } & Omit<ReviewPlannerV11ProductAcceptanceFailureRecord, 'schemaVersion'>
    >
> {
  if (!isV11Environment(input.environment)) {
    return Object.freeze({ status: 'evidence_io' as const });
  }
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseExistingFrozenDirectory(
      input.repoRoot,
      [
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
          input.environment,
        ),
      ],
    );
    directory.assertLocalFixedNtfsVolume();
    const leaves = directory.listLeafNames();
    if (leaves.length === 0) return Object.freeze({ status: 'empty' as const });
    if (
      leaves.some(
        (leaf) => !(V11_PUBLIC_LEAVES as readonly string[]).includes(leaf),
      ) ||
      !leaves.includes('.acceptance-reserved')
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    await readReviewPlannerV11ProductAcceptanceAttemptBinding({
      repoRoot: input.repoRoot,
      environment: input.environment,
    });
    const checkpoint =
      await inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
        repoRoot: input.repoRoot,
        environment: input.environment,
      });
    if (!leaves.includes('.failure.json')) {
      return Object.freeze({ status: 'incomplete' as const });
    }
    const failure = parseReviewPlannerV11ProductAcceptanceFailure(
      JSON.parse(directory.readRegularFile('.failure.json').toString()),
    );
    if (failure.environment !== input.environment) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    if (
      checkpoint === null ||
      failure.component !== checkpoint.component ||
      failure.slot !== checkpoint.slot ||
      failure.checkpoint !== checkpoint.checkpoint ||
      failure.providerCallState !== checkpoint.providerCallState
    ) {
      return Object.freeze({ status: 'evidence_io' as const });
    }
    return Object.freeze({
      status: 'operation_failed' as const,
      environment: failure.environment,
      component: failure.component,
      slot: failure.slot,
      checkpoint: failure.checkpoint,
      terminal: failure.terminal,
      providerCallState: failure.providerCallState,
    });
  } catch {
    return Object.freeze({ status: 'evidence_io' as const });
  } finally {
    directory?.close();
  }
}

export async function finalizeReviewPlannerV8ProductAcceptancePresealedSuccess(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  profile?: ReviewPlannerProductAcceptanceProfile;
}): Promise<void> {
  const profile = input.profile ?? REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE;
  assertReviewPlannerV8ProductAcceptanceOwner(
    input.owner,
    input.environment,
    ['recovery'],
    profile,
  );
  await assertReviewPlannerV8ProductAcceptanceRecoveryClear(
    input.repoRoot,
    input.environment,
    profile,
  );
  const directory = await openWindowsNoReparseExistingFrozenDirectory(
    input.repoRoot,
    [...profile.publicLedgerSegments(input.environment)],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    assertKnownPublicLeaves(directory);
    const leaves = directory.listLeafNames();
    if (
      leaves.includes('.acceptance-success') ||
      leaves.includes('.recovery-only.json') ||
      !leaves.includes('acceptance.json')
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_INVALID');
    }
    const manifest = assertManifest(directory, input.environment, profile);
    const results = requireAllResults(directory, profile);
    assertAdmissionClaimsAndScreenshots(directory, results);
    const defaultOff = (['review', 'planner'] as const).map((component) =>
      readDefaultOffReceipt(directory, component, profile),
    );
    const ownerProof = readProfileStrict(
      directory,
      '.owner-isolation-verified.json',
      ownerIsolationSchema,
      profile,
      'ownerIsolation',
    );
    const cleanup = readProfileStrict(
      directory,
      '.cleanup-verified.json',
      cleanupSchema,
      profile,
      'cleanup',
    );
    const acceptance = readProfileStrict(
      directory,
      'acceptance.json',
      reviewPlannerV8ProductAcceptanceEvidenceSchema,
      profile,
      'evidence',
    );
    const screenshots = {
      plan: screenshotFor(results, 'review-browser'),
      today: screenshotFor(results, 'planner-browser'),
    };
    let expectedAcceptance;
    try {
      expectedAcceptance = buildOfficialAcceptanceEvidence({
        manifest,
        results,
        defaultOff,
        ownerProof,
        cleanup,
        screenshots,
      });
    } catch {
      throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_INVALID');
    }
    const expectedTraceIds = results.map((result) => result.traceIdSha256);
    if (
      JSON.stringify(acceptance) !== JSON.stringify(expectedAcceptance) ||
      !arraysEqual(ownerProof.traceIdSha256, expectedTraceIds) ||
      acceptance.planScreenshotSha256 !== screenshots.plan ||
      acceptance.todayScreenshotSha256 !== screenshots.today
    ) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_INVALID');
    }
    const acceptanceSha256 = hashLeaf(directory, 'acceptance.json');
    const presealMode = await claimReviewPlannerV8ProductAcceptancePresealMode({
      repoRoot: input.repoRoot,
      environment: input.environment,
      owner: input.owner,
      pairedEvidenceSha256: manifest.pairedEvidenceSha256,
      acceptanceSha256,
      profile,
    });
    const success = successSchema.parse({
      schemaVersion: 'phase-6.9.5-v8-product-acceptance-success-v1',
      environment: input.environment,
      pairedEvidenceSha256: manifest.pairedEvidenceSha256,
      markerSha256: SEALED_MARKER_LEAVES.map((leaf) =>
        hashMarker(directory, leaf),
      ),
      manifestSha256: hashLeaf(directory, 'manifest.json'),
      resultSha256: SLOTS.map((slot) =>
        hashLeaf(directory, `${SLOT_LEAVES[slot]}.result.json`),
      ),
      defaultOffSha256: defaultOff.map((receipt) =>
        sha256(serializeProfileRecord(profile, 'defaultOff', receipt)),
      ),
      ownerIsolationSha256: hashLeaf(
        directory,
        '.owner-isolation-verified.json',
      ),
      cleanupSha256: hashLeaf(directory, '.cleanup-verified.json'),
      acceptanceSha256,
      screenshotSha256: [screenshots.plan, screenshots.today],
      completion: {
        mode: 'preseal',
        modeSha256: presealMode.modeSha256,
      },
    });
    publish(
      directory,
      '.acceptance-success',
      serializeProfileRecord(profile, 'success', success),
    );
    verifyCompleteLedger(
      directory,
      input.environment,
      {
        mode: {
          mode: 'preseal',
          pairedEvidenceSha256: manifest.pairedEvidenceSha256,
          acceptanceSha256,
        },
        modeSha256: presealMode.modeSha256,
        stagesPresent: false,
      },
      profile,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      /^V8_PRODUCT_ACCEPTANCE_[A-Z_]+$/.test(error.message)
    ) {
      throw error;
    }
    throw new Error('V8_PRODUCT_ACCEPTANCE_PRESEAL_INVALID');
  } finally {
    directory.close();
  }
}

function createV11Ledger(
  state: V11LedgerState,
): ReviewPlannerV11ProductAcceptanceLedger {
  const ledger: ReviewPlannerV11ProductAcceptanceLedger = Object.freeze({
    recordFailure(authority, value) {
      const current = requireActiveV11LedgerState(ledger);
      const leaves = current.directory.listLeafNames();
      if (
        leaves.some(
          (leaf) => !(V11_PUBLIC_LEAVES as readonly string[]).includes(leaf),
        ) ||
        !leaves.includes('.acceptance-reserved')
      ) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      }
      let failure: ReviewPlannerV11ProductAcceptanceFailureRecord;
      try {
        assertReviewPlannerV11ProductAcceptanceFailureAuthority(
          authority,
          current.environment,
          current.attemptSha256,
          value,
        );
        failure = parseReviewPlannerV11ProductAcceptanceFailure(value);
      } catch {
        throw new Error('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
      }
      if (failure.environment !== current.environment) {
        throw new Error('V11_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      }
      if (leaves.includes('.failure.json')) {
        try {
          const existing = parseReviewPlannerV11ProductAcceptanceFailure(
            JSON.parse(
              current.directory.readRegularFile('.failure.json').toString(),
            ),
          );
          if (JSON.stringify(existing) === JSON.stringify(failure)) return;
        } catch {
          // The fail-closed terminal conflict below is authoritative.
        }
        throw new Error('V11_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      }
      publishV11(
        current.directory,
        '.failure.json',
        serializeReviewPlannerV11ProductAcceptanceFailure(failure),
      );
    },
    close() {
      const current = v11LedgerState.get(ledger);
      if (!current || current.closed) return;
      current.closed = true;
      try {
        current.reservationGuard.close();
      } finally {
        try {
          current.cleanupInjectedHandles?.();
        } finally {
          current.directory.close();
        }
      }
    },
  });
  v11LedgerState.set(ledger, state);
  return ledger;
}

function requireActiveV11LedgerState(
  ledger: ReviewPlannerV11ProductAcceptanceLedger,
) {
  const state = v11LedgerState.get(ledger);
  if (!state || state.closed) {
    throw new Error('V11_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  }
  state.reservationGuard.assertHeld();
  assertReviewPlannerV11ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
    'recovery',
  ]);
  return state;
}

function publishV11(
  directory: WindowsNoReparseChildDirectory,
  leaf: (typeof V11_PUBLIC_LEAVES)[number],
  contents: string,
) {
  const result = directory.commitExclusiveDurableFileViaRename(leaf, contents);
  if (!result.committed || result.cleanupStatus !== 'closed') {
    throw new Error('V11_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function isV11Environment(
  value: unknown,
): value is ReviewPlannerV8ProductAcceptanceEnvironment {
  return value === 'branch' || value === 'main';
}

function createLedger(
  state: LedgerState,
): ReviewPlannerV8ProductAcceptanceLedger {
  const ledger: ReviewPlannerV8ProductAcceptanceLedger = Object.freeze({
    environment() {
      return requireState(ledger).environment;
    },
    writeManifest(value) {
      const current = requireActiveState(ledger);
      assertRecoveryManifest(current);
      const parsed = safeParseProfileRecord(
        manifestSchema,
        current.profile,
        'manifest',
        value,
      );
      if (
        parsed === null ||
        !parsed.success ||
        parsed.data.environment !== current.environment
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      }
      publish(
        current.directory,
        'manifest.json',
        serializeProfileRecord(current.profile, 'manifest', parsed.data),
      );
    },
    claimSlot(slot) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      assertManifest(current.directory, current.environment, current.profile);
      const index = SLOTS.indexOf(slot);
      if (index < 0)
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_ORDER_INVALID');
      const leaves = current.directory.listLeafNames();
      for (let preceding = 0; preceding < index; preceding += 1) {
        const precedingLeaf = SLOT_LEAVES[SLOTS[preceding]];
        if (!leaves.includes(`${precedingLeaf}.result.json`)) {
          throw new Error(
            leaves.includes(precedingLeaf)
              ? 'V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING'
              : 'V8_PRODUCT_ACCEPTANCE_SLOT_ORDER_INVALID',
          );
        }
      }
      const leaf = SLOT_LEAVES[slot];
      if (leaves.includes(leaf)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_ALREADY_CLAIMED');
      }
      if (
        index === 1 &&
        !leaves.includes(`${SLOT_LEAVES['review-api']}.result.json`)
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING');
      }
      if (
        index === 2 &&
        !leaves.includes(`${SLOT_LEAVES['review-browser']}.result.json`)
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING');
      }
      if (
        index === 3 &&
        !leaves.includes(`${SLOT_LEAVES['planner-api']}.result.json`)
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING');
      }
      publish(current.directory, leaf, '');
    },
    recordSlotResult(value) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      const parsed = safeParseProfileRecord(
        slotResultSchema,
        current.profile,
        'slotResult',
        value,
      );
      if (parsed === null || !parsed.success)
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      const leaf = SLOT_LEAVES[parsed.data.slot];
      const leaves = current.directory.listLeafNames();
      if (!leaves.includes(leaf)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_NOT_CLAIMED');
      }
      const component = parsed.data.slot.startsWith('review')
        ? 'review'
        : 'planner';
      if (
        parsed.data.slot.endsWith('browser') &&
        !leaves.includes(`.${component}-default-off.json`)
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_DEFAULT_OFF_MISSING');
      }
      if (parsed.data.slot.endsWith('browser')) {
        const screenshotLeaf =
          component === 'review' ? 'plan.png' : 'today.png';
        if (
          !('screenshotSha256' in parsed.data) ||
          readScreenshotSha256(current.directory, screenshotLeaf) !==
            parsed.data.screenshotSha256
        ) {
          throw new Error('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
        }
      }
      const existingTraces = readResults(
        current.directory,
        current.profile,
      ).map((result) => result.traceIdSha256);
      if (existingTraces.includes(parsed.data.traceIdSha256)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
      }
      const totals = readResults(current.directory, current.profile).reduce(
        (sum, result) => ({
          inputTokens: sum.inputTokens + result.usage.inputTokens,
          outputTokens: sum.outputTokens + result.usage.outputTokens,
        }),
        {
          inputTokens: parsed.data.usage.inputTokens,
          outputTokens: parsed.data.usage.outputTokens,
        },
      );
      if (
        totals.inputTokens >
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT.inputTokens ||
        totals.outputTokens >
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT.outputTokens
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_BUDGET_EXCEEDED');
      }
      publish(
        current.directory,
        `${leaf}.result.json`,
        serializeProfileRecord(current.profile, 'slotResult', parsed.data),
      );
    },
    recordDefaultOff(value) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      const parsed = safeParseProfileRecord(
        reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
        current.profile,
        'defaultOff',
        value,
      );
      if (
        parsed === null ||
        !parsed.success ||
        parsed.data.component === 'recovery'
      )
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      const browserLeaf =
        SLOT_LEAVES[`${parsed.data.component}-browser` as Slot];
      const leaves = current.directory.listLeafNames();
      if (!leaves.includes(browserLeaf)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_ORDER_INVALID');
      }
      publish(
        current.directory,
        `.${parsed.data.component}-default-off.json`,
        serializeProfileRecord(current.profile, 'defaultOff', parsed.data),
      );
    },
    recordScreenshot(component, contents) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      if (component !== 'review' && component !== 'planner') {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
      }
      const bytes = Buffer.from(contents);
      if (!isReasonablePng(bytes)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
      }
      const slot = `${component}-browser` as const;
      const slotLeaf = SLOT_LEAVES[slot];
      const leaves = current.directory.listLeafNames();
      if (
        !leaves.includes(slotLeaf) ||
        leaves.includes(`${slotLeaf}.result.json`)
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_ORDER_INVALID');
      }
      publish(
        current.directory,
        component === 'review' ? 'plan.png' : 'today.png',
        bytes,
      );
    },
    recordOwnerIsolation(value) {
      const current = requireActiveState(ledger);
      const parsed = safeParseProfileRecord(
        ownerIsolationSchema,
        current.profile,
        'ownerIsolation',
        value,
      );
      if (parsed === null || !parsed.success)
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      const results = requireAllResults(current.directory, current.profile);
      const expected = results.map((result) => result.traceIdSha256);
      if (!arraysEqual(parsed.data.traceIdSha256, expected)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_ISOLATION_INVALID');
      }
      publish(
        current.directory,
        '.owner-isolation-verified.json',
        serializeProfileRecord(current.profile, 'ownerIsolation', parsed.data),
      );
    },
    recordCleanup(value) {
      const current = requireActiveState(ledger);
      if (
        !current.directory
          .listLeafNames()
          .includes('.owner-isolation-verified.json')
      ) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_ISOLATION_MISSING');
      }
      const parsed = safeParseProfileRecord(
        cleanupSchema,
        current.profile,
        'cleanup',
        value,
      );
      if (parsed === null || !parsed.success)
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      publish(
        current.directory,
        '.cleanup-verified.json',
        serializeProfileRecord(current.profile, 'cleanup', parsed.data),
      );
    },
    finalizeSuccess() {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      const leaves = current.directory.listLeafNames();
      if (leaves.includes('.recovery-only.json')) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_TERMINAL');
      }
      const manifest = assertManifest(
        current.directory,
        current.environment,
        current.profile,
      );
      const results = requireAllResults(current.directory, current.profile);
      assertAdmissionClaimsAndScreenshots(
        current.directory,
        results,
        current.reservationGuard,
      );
      const defaultOff = (['review', 'planner'] as const).map((component) =>
        readDefaultOffReceipt(current.directory, component, current.profile),
      );
      const ownerProof = readProfileStrict(
        current.directory,
        '.owner-isolation-verified.json',
        ownerIsolationSchema,
        current.profile,
        'ownerIsolation',
      );
      const cleanup = readProfileStrict(
        current.directory,
        '.cleanup-verified.json',
        cleanupSchema,
        current.profile,
        'cleanup',
      );
      const inputTokens = results.reduce(
        (total, result) => total + result.usage.inputTokens,
        0,
      );
      const outputTokens = results.reduce(
        (total, result) => total + result.usage.outputTokens,
        0,
      );
      const cost = calculateReviewPlannerV8ProductAcceptanceCost(
        inputTokens,
        outputTokens,
      );
      if (!cost.withinHardCap) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_BUDGET_EXCEEDED');
      }
      const screenshots = {
        plan: screenshotFor(results, 'review-browser'),
        today: screenshotFor(results, 'planner-browser'),
      };
      const acceptance = buildOfficialAcceptanceEvidence({
        manifest,
        results,
        defaultOff,
        ownerProof,
        cleanup,
        screenshots,
      });
      publish(
        current.directory,
        'acceptance.json',
        serializeProfileRecord(
          current.profile,
          'evidence',
          JSON.parse(
            serializeReviewPlannerV8ProductAcceptanceEvidence(acceptance),
          ) as Record<string, unknown>,
        ),
      );
      const success = successSchema.parse({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-success-v1',
        environment: current.environment,
        pairedEvidenceSha256: manifest.pairedEvidenceSha256,
        markerSha256: SEALED_MARKER_LEAVES.map((leaf) =>
          hashMarker(current.directory, leaf, current.reservationGuard),
        ),
        manifestSha256: hashLeaf(current.directory, 'manifest.json'),
        resultSha256: SLOTS.map((slot) =>
          hashLeaf(current.directory, `${SLOT_LEAVES[slot]}.result.json`),
        ),
        defaultOffSha256: defaultOff.map((receipt) =>
          sha256(
            serializeProfileRecord(current.profile, 'defaultOff', receipt),
          ),
        ),
        ownerIsolationSha256: hashLeaf(
          current.directory,
          '.owner-isolation-verified.json',
        ),
        cleanupSha256: hashLeaf(current.directory, '.cleanup-verified.json'),
        acceptanceSha256: hashLeaf(current.directory, 'acceptance.json'),
        screenshotSha256: [screenshots.plan, screenshots.today],
        completion: { mode: 'product' },
      });
      publish(
        current.directory,
        '.acceptance-success',
        serializeProfileRecord(current.profile, 'success', success),
      );
    },
    close() {
      const current = ledgerState.get(ledger);
      if (!current || current.closed) return;
      current.closed = true;
      try {
        current.reservationGuard.close();
      } finally {
        try {
          current.directory.close();
        } finally {
          current.recoveryDirectory.close();
        }
      }
    },
  });
  ledgerState.set(ledger, state);
  return ledger;
}

function verifyCompleteLedger(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  localMode: Readonly<{
    mode:
      | Readonly<{
          mode: 'recovery';
        }>
      | Readonly<{
          mode: 'preseal';
          pairedEvidenceSha256: string;
          acceptanceSha256: string;
        }>
      | null;
    modeSha256: string | null;
    stagesPresent: boolean;
  }>,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const manifest = assertManifest(directory, environment, profile);
  const results = requireAllResults(directory, profile);
  assertAdmissionClaimsAndScreenshots(directory, results);
  const defaultOff = (['review', 'planner'] as const).map((component) =>
    readDefaultOffReceipt(directory, component, profile),
  );
  const ownerProof = readProfileStrict(
    directory,
    '.owner-isolation-verified.json',
    ownerIsolationSchema,
    profile,
    'ownerIsolation',
  );
  const cleanup = readProfileStrict(
    directory,
    '.cleanup-verified.json',
    cleanupSchema,
    profile,
    'cleanup',
  );
  const screenshots = {
    plan: screenshotFor(results, 'review-browser'),
    today: screenshotFor(results, 'planner-browser'),
  };
  const acceptance = readProfileStrict(
    directory,
    'acceptance.json',
    reviewPlannerV8ProductAcceptanceEvidenceSchema,
    profile,
    'evidence',
  );
  const expectedAcceptance = buildOfficialAcceptanceEvidence({
    manifest,
    results,
    defaultOff,
    ownerProof,
    cleanup,
    screenshots,
  });
  const success = readProfileStrict(
    directory,
    '.acceptance-success',
    successSchema,
    profile,
    'success',
  );
  if (
    success.environment !== environment ||
    acceptance.environment !== environment ||
    JSON.stringify(acceptance) !== JSON.stringify(expectedAcceptance) ||
    localMode.stagesPresent ||
    (success.completion.mode === 'product'
      ? localMode.mode !== null || localMode.modeSha256 !== null
      : localMode.mode?.mode !== 'preseal' ||
        localMode.modeSha256 !== success.completion.modeSha256 ||
        localMode.mode.pairedEvidenceSha256 !== success.pairedEvidenceSha256 ||
        localMode.mode.acceptanceSha256 !== success.acceptanceSha256) ||
    success.pairedEvidenceSha256 !== manifest.pairedEvidenceSha256 ||
    acceptance.pairedEvidenceSha256 !== manifest.pairedEvidenceSha256 ||
    !arraysEqual(
      success.markerSha256,
      SEALED_MARKER_LEAVES.map((leaf) => hashLeaf(directory, leaf)),
    ) ||
    success.manifestSha256 !== hashLeaf(directory, 'manifest.json') ||
    !arraysEqual(
      success.resultSha256,
      SLOTS.map((slot) =>
        hashLeaf(directory, `${SLOT_LEAVES[slot]}.result.json`),
      ),
    ) ||
    !arraysEqual(success.defaultOffSha256, [
      hashLeaf(directory, '.review-default-off.json'),
      hashLeaf(directory, '.planner-default-off.json'),
    ]) ||
    success.ownerIsolationSha256 !==
      hashLeaf(directory, '.owner-isolation-verified.json') ||
    success.cleanupSha256 !== hashLeaf(directory, '.cleanup-verified.json') ||
    success.acceptanceSha256 !== hashLeaf(directory, 'acceptance.json') ||
    !arraysEqual(success.screenshotSha256, [
      screenshots.plan,
      screenshots.today,
    ]) ||
    !arraysEqual(success.screenshotSha256, [
      acceptance.planScreenshotSha256,
      acceptance.todayScreenshotSha256,
    ]) ||
    !arraysEqual(
      ownerProof.traceIdSha256,
      results.map((result) => result.traceIdSha256),
    )
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  return {
    pairedEvidenceSha256: manifest.pairedEvidenceSha256,
    inputTokens: acceptance.totals.inputTokens,
    outputTokens: acceptance.totals.outputTokens,
    costCny: acceptance.totals.costCny,
  };
}

function requireState(ledger: ReviewPlannerV8ProductAcceptanceLedger) {
  const state = ledgerState.get(ledger);
  if (!state || state.closed)
    throw new Error('V8_PRODUCT_ACCEPTANCE_LEDGER_CLOSED');
  return state;
}

function requireActiveState(ledger: ReviewPlannerV8ProductAcceptanceLedger) {
  const state = requireState(ledger);
  assertReviewPlannerV8ProductAcceptanceOwner(
    state.owner,
    state.environment,
    ['product'],
    state.profile,
  );
  return state;
}

function assertRecoveryManifest(state: LedgerState) {
  if (
    !state.recoveryDirectory.listLeafNames().includes('recovery-manifest.json')
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_MISSING');
  }
  assertNoRecoveryStage(state);
}

function assertNoRecoveryStage(state: LedgerState) {
  const leaves = state.recoveryDirectory.listLeafNames();
  if (
    leaves.some(
      (leaf) =>
        leaf !== 'owner.lock' &&
        leaf !== 'recovery-manifest.json' &&
        leaf !== 'account-review.json' &&
        leaf !== 'account-planner.json' &&
        !(RECOVERY_STAGE_LEAVES as readonly string[]).includes(leaf),
    ) ||
    leaves.some((leaf) =>
      (RECOVERY_STAGE_LEAVES as readonly string[]).includes(leaf),
    )
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_ACTIVE');
  }
  if (state.directory.listLeafNames().includes('.recovery-only.json')) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECOVERY_TERMINAL');
  }
}

function assertKnownPublicLeaves(directory: WindowsNoReparseChildDirectory) {
  if (
    directory
      .listLeafNames()
      .some((leaf) => !(PUBLIC_LEAVES as readonly string[]).includes(leaf))
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function assertManifest(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const parsed = readProfileStrict(
    directory,
    'manifest.json',
    manifestSchema,
    profile,
    'manifest',
  );
  if (parsed.environment !== environment) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  return parsed;
}

function readResults(
  directory: WindowsNoReparseChildDirectory,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const leaves = directory.listLeafNames();
  return SLOTS.flatMap((slot) => {
    const leaf = `${SLOT_LEAVES[slot]}.result.json`;
    if (!leaves.includes(leaf)) return [];
    const result = readProfileStrict(
      directory,
      leaf,
      slotResultSchema,
      profile,
      'slotResult',
    );
    if (result.slot !== slot) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    }
    return [result];
  });
}

function requireAllResults(
  directory: WindowsNoReparseChildDirectory,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const results = readResults(directory, profile);
  if (
    results.length !== 4 ||
    new Set(results.map((value) => value.traceIdSha256)).size !== 4
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING');
  }
  return results;
}

function assertAdmissionClaimsAndScreenshots(
  directory: WindowsNoReparseChildDirectory,
  results: readonly z.infer<typeof slotResultSchema>[],
  reservationGuard?: WindowsExclusiveLifetimeFile,
) {
  const leaves = directory.listLeafNames();
  if (
    SEALED_MARKER_LEAVES.some(
      (leaf) =>
        !leaves.includes(leaf) ||
        (leaf === '.acceptance-reserved' && reservationGuard !== undefined
          ? reservationGuard.readContents()
          : directory.readRegularFile(leaf)
        ).byteLength !== 0,
    ) ||
    readScreenshotSha256(directory, 'plan.png') !==
      screenshotFor(results, 'review-browser') ||
    readScreenshotSha256(directory, 'today.png') !==
      screenshotFor(results, 'planner-browser')
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function hashMarker(
  directory: WindowsNoReparseChildDirectory,
  leaf: (typeof SEALED_MARKER_LEAVES)[number],
  reservationGuard?: WindowsExclusiveLifetimeFile,
) {
  return sha256(
    leaf === '.acceptance-reserved' && reservationGuard !== undefined
      ? reservationGuard.readContents()
      : directory.readRegularFile(leaf),
  );
}

function screenshotFor(
  results: readonly z.infer<typeof slotResultSchema>[],
  slot: 'review-browser' | 'planner-browser',
) {
  const result = results.find((candidate) => candidate.slot === slot);
  if (!result || !('screenshotSha256' in result)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_MISSING');
  }
  return result.screenshotSha256;
}

function readScreenshotSha256(
  directory: WindowsNoReparseChildDirectory,
  leaf: 'plan.png' | 'today.png',
) {
  const bytes = directory.readRegularFile(leaf, MAX_SCREENSHOT_BYTES);
  if (!isReasonablePng(bytes)) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
  }
  return sha256(bytes);
}

function isReasonablePng(bytes: Buffer) {
  if (
    bytes.byteLength < 45 ||
    bytes.byteLength > MAX_SCREENSHOT_BYTES ||
    !bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
  ) {
    return false;
  }
  let offset = PNG_SIGNATURE.byteLength;
  let chunkIndex = 0;
  let seenIdat = false;
  let idatEnded = false;
  while (offset + 12 <= bytes.byteLength) {
    const dataLength = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + dataLength;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.byteLength) {
      return false;
    }
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    const data = bytes.subarray(offset + 8, offset + 8 + dataLength);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + dataLength);
    if (
      crc32(Buffer.concat([bytes.subarray(offset + 4, offset + 8), data])) !==
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
      return seenIdat && dataLength === 0 && chunkEnd === bytes.byteLength;
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

function parseProfileRecord<T>(
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: unknown,
): T {
  const normalized = normalizeReviewPlannerProductAcceptanceSchemaRecord(
    profile,
    key,
    value,
  );
  if (normalized === null)
    throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
  return schema.parse(normalized);
}

function safeParseProfileRecord<T>(
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: unknown,
) {
  const normalized = normalizeReviewPlannerProductAcceptanceSchemaRecord(
    profile,
    key,
    value,
  );
  return normalized === null ? null : schema.safeParse(normalized);
}

function readProfileStrict<T>(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  schema: z.ZodType<T>,
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
) {
  const bytes = directory.readRegularFile(leaf, MAX_SCREENSHOT_BYTES);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString());
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  try {
    return parseProfileRecord(schema, profile, key, value);
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function serializeProfileRecord(
  profile: ReviewPlannerProductAcceptanceProfile,
  key: ReviewPlannerProductAcceptanceSchemaKey,
  value: Record<string, unknown>,
) {
  return serialize(
    withReviewPlannerProductAcceptanceSchemaIdentity(profile, key, value),
  );
}

function readDefaultOffReceipt(
  directory: WindowsNoReparseChildDirectory,
  component: 'review' | 'planner',
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const receipt = readProfileStrict(
    directory,
    `.${component}-default-off.json`,
    reviewPlannerV8ProductAcceptanceDefaultOffReceiptSchema,
    profile,
    'defaultOff',
  );
  if (receipt.component !== component) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  return receipt;
}

function publish(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  contents: string | Uint8Array,
) {
  const result = directory.commitExclusiveDurableFileViaRename(leaf, contents);
  if (!result.committed || result.cleanupStatus !== 'closed') {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function serialize(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function hashLeaf(directory: WindowsNoReparseChildDirectory, leaf: string) {
  return sha256(directory.readRegularFile(leaf));
}

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
