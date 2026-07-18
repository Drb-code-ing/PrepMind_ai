import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  calculateReviewPlannerV8ProductAcceptanceCost,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PER_ENVIRONMENT_LIMIT,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RESERVATION,
} from './review-planner-v8-product-acceptance-evidence';
import {
  assertReviewPlannerV8ProductAcceptanceOwner,
  type ReviewPlannerV8ProductAcceptanceEnvironment,
  type ReviewPlannerV8ProductAcceptanceOwner,
} from './review-planner-v8-product-acceptance-recovery';
import {
  openWindowsNoReparseDirectory,
  type WindowsNoReparseChildDirectory,
} from './windows-reparse-safe-relative-io';

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
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

const manifestSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-manifest-v1'),
    environment: z.enum(['branch', 'main']),
    commitSha: z.string().regex(COMMIT_SHA),
    pairedEvidenceSha256: z.string().regex(SHA256),
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

const slotResultBase = {
  schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-slot-result-v1'),
  provider: z.literal('deepseek'),
  model: z.literal('deepseek-v4-pro'),
  usage: usageSchema,
  durationMs: z.number().int().positive().max(60_000),
  disposition: z.literal('candidate_applied'),
  provenance: z.literal('live_candidate'),
  traceIdSha256: z.string().regex(SHA256),
};

const slotResultSchema = z.discriminatedUnion('slot', [
  z.object({ ...slotResultBase, slot: z.literal('review-api') }).strict(),
  z
    .object({
      ...slotResultBase,
      slot: z.literal('review-browser'),
      screenshotSha256: z.string().regex(SHA256),
    })
    .strict(),
  z.object({ ...slotResultBase, slot: z.literal('planner-api') }).strict(),
  z
    .object({
      ...slotResultBase,
      slot: z.literal('planner-browser'),
      screenshotSha256: z.string().regex(SHA256),
    })
    .strict(),
]);

const defaultOffSchema = z
  .object({
    schemaVersion: z.literal(
      'phase-6.9.5-v8-product-acceptance-default-off-v1',
    ),
    component: z.enum(['review', 'planner']),
    reviewAgentModelEnabled: z.literal(false),
    plannerAgentModelEnabled: z.literal(false),
    acceptanceEnabled: z.literal(false),
    capabilityPresent: z.literal(false),
    providerMode: z.literal('mock'),
    liveCallsEnabled: z.literal(false),
    deterministicProbePassed: z.literal(true),
    containerIdSha256: z.string().regex(SHA256),
  })
  .strict();

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

const acceptanceSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-aggregate-v1'),
    environment: z.enum(['branch', 'main']),
    pairedEvidenceSha256: z.string().regex(SHA256),
    requestCount: z.literal(4),
    inputTokens: z.number().int().positive().max(7_800),
    outputTokens: z.number().int().positive().max(1_760),
    costCny: z.string().regex(/^\d+\.\d{8}$/),
    traceIdSha256: z.array(z.string().regex(SHA256)).length(4),
    screenshots: z
      .object({
        plan: z.string().regex(SHA256),
        today: z.string().regex(SHA256),
      })
      .strict(),
  })
  .strict();

const successSchema = z
  .object({
    schemaVersion: z.literal('phase-6.9.5-v8-product-acceptance-success-v1'),
    environment: z.enum(['branch', 'main']),
    pairedEvidenceSha256: z.string().regex(SHA256),
    manifestSha256: z.string().regex(SHA256),
    resultSha256: z.array(z.string().regex(SHA256)).length(4),
    defaultOffSha256: z.array(z.string().regex(SHA256)).length(2),
    ownerIsolationSha256: z.string().regex(SHA256),
    cleanupSha256: z.string().regex(SHA256),
    acceptanceSha256: z.string().regex(SHA256),
    screenshotSha256: z.array(z.string().regex(SHA256)).length(2),
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

type LedgerState = {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  directory: WindowsNoReparseChildDirectory;
  recoveryDirectory: WindowsNoReparseChildDirectory;
  closed: boolean;
};

export type ReviewPlannerV8ProductAcceptanceLedger = Readonly<{
  environment(): ReviewPlannerV8ProductAcceptanceEnvironment;
  writeManifest(value: unknown): void;
  claimSlot(slot: Slot): void;
  recordSlotResult(value: unknown): void;
  recordDefaultOff(value: unknown): void;
  recordOwnerIsolation(value: unknown): void;
  recordCleanup(value: unknown): void;
  finalizeSuccess(): void;
  close(): void;
}>;

const ledgerState = new WeakMap<
  ReviewPlannerV8ProductAcceptanceLedger,
  LedgerState
>();

export async function reserveReviewPlannerV8ProductAcceptanceLedger(input: {
  repoRoot: string;
  environment: ReviewPlannerV8ProductAcceptanceEnvironment;
  owner: ReviewPlannerV8ProductAcceptanceOwner;
  pairedEvidenceSha256?: string;
}): Promise<ReviewPlannerV8ProductAcceptanceLedger> {
  if (input.environment !== 'branch' && input.environment !== 'main') {
    throw new Error('V8_PRODUCT_ACCEPTANCE_ENVIRONMENT_INVALID');
  }
  assertReviewPlannerV8ProductAcceptanceOwner(input.owner, input.environment, [
    'product',
  ]);
  if (input.environment === 'main') {
    if (!input.pairedEvidenceSha256?.match(SHA256)) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_MAIN_LINEAGE_INVALID');
    }
    const branch = await readReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: input.repoRoot,
      environment: 'branch',
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
  const directory = await openWindowsNoReparseDirectory(input.repoRoot, [
    'docs',
    'acceptance',
    'evidence',
    'phase-6-9-5-v8-product-acceptance',
    input.environment,
  ]);
  const recoveryDirectory = await openWindowsNoReparseDirectory(
    input.repoRoot,
    ['.tmp', 'phase-6-9-5-v8-product-acceptance', input.environment],
  );
  try {
    directory.assertLocalFixedNtfsVolume();
    recoveryDirectory.assertLocalFixedNtfsVolume();
    const existing = directory.listLeafNames();
    if (existing.length > 0) {
      throw new Error('V8_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    }
    publish(directory, '.acceptance-reserved', '');
    const ledger = createLedger({
      repoRoot: input.repoRoot,
      environment: input.environment,
      owner: input.owner,
      directory,
      recoveryDirectory,
      closed: false,
    });
    return ledger;
  } catch (error) {
    directory.close();
    recoveryDirectory.close();
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
  let directory: WindowsNoReparseChildDirectory | null = null;
  try {
    directory = await openWindowsNoReparseDirectory(input.repoRoot, [
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      input.environment,
    ]);
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
      if (leaves.includes('acceptance.json')) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      const terminal = readStrict(
        directory,
        '.recovery-only.json',
        recoveryTerminalSchema,
      );
      if (terminal.environment !== input.environment) {
        return Object.freeze({ status: 'evidence_io' as const });
      }
      return Object.freeze({ status: 'recovery_only' as const });
    }
    if (!success) return Object.freeze({ status: 'incomplete' as const });
    const aggregate = verifyCompleteLedger(directory, input.environment);
    return Object.freeze({ status: 'complete' as const, ...aggregate });
  } catch {
    return Object.freeze({ status: 'evidence_io' as const });
  } finally {
    directory?.close();
  }
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
      const parsed = manifestSchema.safeParse(value);
      if (!parsed.success || parsed.data.environment !== current.environment) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      }
      publish(current.directory, 'manifest.json', serialize(parsed.data));
    },
    claimSlot(slot) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      assertManifest(current.directory, current.environment);
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
      const parsed = slotResultSchema.safeParse(value);
      if (!parsed.success)
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
      const existingTraces = readResults(current.directory).map(
        (result) => result.traceIdSha256,
      );
      if (existingTraces.includes(parsed.data.traceIdSha256)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
      }
      const totals = readResults(current.directory).reduce(
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
      publish(current.directory, `${leaf}.result.json`, serialize(parsed.data));
    },
    recordDefaultOff(value) {
      const current = requireActiveState(ledger);
      assertKnownPublicLeaves(current.directory);
      assertNoRecoveryStage(current);
      const parsed = defaultOffSchema.safeParse(value);
      if (!parsed.success)
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
        serialize(parsed.data),
      );
    },
    recordOwnerIsolation(value) {
      const current = requireActiveState(ledger);
      const parsed = ownerIsolationSchema.safeParse(value);
      if (!parsed.success)
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      const results = requireAllResults(current.directory);
      const expected = results.map((result) => result.traceIdSha256);
      if (!arraysEqual(parsed.data.traceIdSha256, expected)) {
        throw new Error('V8_PRODUCT_ACCEPTANCE_OWNER_ISOLATION_INVALID');
      }
      publish(
        current.directory,
        '.owner-isolation-verified.json',
        serialize(parsed.data),
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
      const parsed = cleanupSchema.safeParse(value);
      if (!parsed.success)
        throw new Error('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
      publish(
        current.directory,
        '.cleanup-verified.json',
        serialize(parsed.data),
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
      const manifest = assertManifest(current.directory, current.environment);
      const results = requireAllResults(current.directory);
      const defaultOff = ['review', 'planner'].map((component) =>
        readStrict(
          current.directory,
          `.${component}-default-off.json`,
          defaultOffSchema,
        ),
      );
      readStrict(
        current.directory,
        '.owner-isolation-verified.json',
        ownerIsolationSchema,
      );
      readStrict(current.directory, '.cleanup-verified.json', cleanupSchema);
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
      const acceptance = acceptanceSchema.parse({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-aggregate-v1',
        environment: current.environment,
        pairedEvidenceSha256: manifest.pairedEvidenceSha256,
        requestCount: 4,
        inputTokens,
        outputTokens,
        costCny: cost.costCny,
        traceIdSha256: results.map((result) => result.traceIdSha256),
        screenshots,
      });
      publish(current.directory, 'acceptance.json', serialize(acceptance));
      const success = successSchema.parse({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-success-v1',
        environment: current.environment,
        pairedEvidenceSha256: manifest.pairedEvidenceSha256,
        manifestSha256: hashLeaf(current.directory, 'manifest.json'),
        resultSha256: SLOTS.map((slot) =>
          hashLeaf(current.directory, `${SLOT_LEAVES[slot]}.result.json`),
        ),
        defaultOffSha256: defaultOff.map((receipt) =>
          sha256(serialize(receipt)),
        ),
        ownerIsolationSha256: hashLeaf(
          current.directory,
          '.owner-isolation-verified.json',
        ),
        cleanupSha256: hashLeaf(current.directory, '.cleanup-verified.json'),
        acceptanceSha256: hashLeaf(current.directory, 'acceptance.json'),
        screenshotSha256: [screenshots.plan, screenshots.today],
      });
      publish(current.directory, '.acceptance-success', serialize(success));
    },
    close() {
      const current = ledgerState.get(ledger);
      if (!current || current.closed) return;
      current.closed = true;
      try {
        current.directory.close();
      } finally {
        current.recoveryDirectory.close();
      }
    },
  });
  ledgerState.set(ledger, state);
  return ledger;
}

function verifyCompleteLedger(
  directory: WindowsNoReparseChildDirectory,
  environment: ReviewPlannerV8ProductAcceptanceEnvironment,
) {
  const manifest = assertManifest(directory, environment);
  const results = requireAllResults(directory);
  const acceptance = readStrict(directory, 'acceptance.json', acceptanceSchema);
  const success = readStrict(directory, '.acceptance-success', successSchema);
  if (
    success.environment !== environment ||
    acceptance.environment !== environment ||
    success.pairedEvidenceSha256 !== manifest.pairedEvidenceSha256 ||
    acceptance.pairedEvidenceSha256 !== manifest.pairedEvidenceSha256 ||
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
      screenshotFor(results, 'review-browser'),
      screenshotFor(results, 'planner-browser'),
    ]) ||
    !arraysEqual(
      acceptance.traceIdSha256,
      results.map((result) => result.traceIdSha256),
    ) ||
    !arraysEqual(success.screenshotSha256, [
      acceptance.screenshots.plan,
      acceptance.screenshots.today,
    ])
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  for (const component of ['review', 'planner'] as const) {
    readStrict(directory, `.${component}-default-off.json`, defaultOffSchema);
  }
  readStrict(directory, '.owner-isolation-verified.json', ownerIsolationSchema);
  readStrict(directory, '.cleanup-verified.json', cleanupSchema);
  const inputTokens = results.reduce(
    (total, result) => total + result.usage.inputTokens,
    0,
  );
  const outputTokens = results.reduce(
    (total, result) => total + result.usage.outputTokens,
    0,
  );
  if (
    acceptance.inputTokens !== inputTokens ||
    acceptance.outputTokens !== outputTokens ||
    acceptance.costCny !==
      calculateReviewPlannerV8ProductAcceptanceCost(inputTokens, outputTokens)
        .costCny
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  return {
    pairedEvidenceSha256: manifest.pairedEvidenceSha256,
    inputTokens,
    outputTokens,
    costCny: acceptance.costCny,
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
  assertReviewPlannerV8ProductAcceptanceOwner(state.owner, state.environment, [
    'product',
  ]);
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
) {
  const parsed = readStrict(directory, 'manifest.json', manifestSchema);
  if (parsed.environment !== environment) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
  return parsed;
}

function readResults(directory: WindowsNoReparseChildDirectory) {
  const leaves = directory.listLeafNames();
  return SLOTS.flatMap((slot) => {
    const leaf = `${SLOT_LEAVES[slot]}.result.json`;
    return leaves.includes(leaf)
      ? [readStrict(directory, leaf, slotResultSchema)]
      : [];
  });
}

function requireAllResults(directory: WindowsNoReparseChildDirectory) {
  const results = readResults(directory);
  if (
    results.length !== 4 ||
    new Set(results.map((value) => value.traceIdSha256)).size !== 4
  ) {
    throw new Error('V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING');
  }
  return results;
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

function readStrict<T>(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  schema: z.ZodType<T>,
): T {
  try {
    return schema.parse(
      JSON.parse(directory.readRegularFile(leaf).toString('utf8')),
    );
  } catch {
    throw new Error('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
  }
}

function publish(
  directory: WindowsNoReparseChildDirectory,
  leaf: string,
  contents: string,
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
