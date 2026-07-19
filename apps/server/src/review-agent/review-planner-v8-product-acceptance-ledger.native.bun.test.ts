import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  finalizeReviewPlannerV8ProductAcceptancePresealedSuccess,
  readReviewPlannerV8ProductAcceptanceLedger,
  readReviewPlannerV11ProductAcceptanceLedger,
  openReviewPlannerV11ProductAcceptanceRecoveryLedger,
  reserveReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedgerForTests,
  reserveReviewPlannerV11ProductAcceptanceLedger,
  reserveReviewPlannerV11ProductAcceptanceLedgerForTests,
} from './review-planner-v8-product-acceptance-ledger';
import { createReviewPlannerV11ProductAcceptanceDiagnosticsPort } from './review-planner-v8-product-acceptance-composition';
import { reviewPlannerV8ProductAcceptanceEvidenceSchema } from './review-planner-v8-product-acceptance-evidence';
import type { DurableFaultStage } from './windows-reparse-safe-relative-io';
import {
  acquireReviewPlannerV8ProductAcceptanceOwner,
  acquireReviewPlannerV11ProductAcceptanceOwner,
  openReviewPlannerV8ProductAcceptanceRecoveryJournal,
  openReviewPlannerV11ProductAcceptanceRecoveryJournal,
  inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint,
  prepareReviewPlannerV8ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV11ProductAcceptanceRecoveryJournal,
  readReviewPlannerV11ProductAcceptanceRecoveryCheckpoint,
} from './review-planner-v8-product-acceptance-recovery';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
  type ReviewPlannerProductAcceptanceProfile,
} from './review-planner-product-acceptance-profile';

const describeWindows = process.platform === 'win32' ? describe : describe.skip;
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);
const COMMIT_A = 'a'.repeat(40);
const PLAN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const TODAY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const PLAN_PNG_SHA = createHash('sha256').update(PLAN_PNG).digest('hex');
const TODAY_PNG_SHA = createHash('sha256').update(TODAY_PNG).digest('hex');
const RECOVERY_RESTORE_RECEIPT = {
  ...restoreReceiptForRecovery(),
} as const;

function v11Failure(
  overrides: Partial<{
    schemaVersion: string;
    environment: 'branch' | 'main';
    component: 'review' | 'planner';
    slot: 'api' | 'browser';
    checkpoint: string;
    terminal: 'operation_failed';
    providerCallState: 'not_started' | 'indeterminate';
  }> = {},
) {
  return {
    schemaVersion: 'phase-6.9.5-v11-product-acceptance-failure-v1' as const,
    environment: 'branch' as const,
    component: 'review' as const,
    slot: 'api' as const,
    checkpoint: 'review_api_facts_before' as const,
    terminal: 'operation_failed' as const,
    providerCallState: 'not_started' as const,
    ...overrides,
  };
}

function v11Checkpoint(
  checkpoint: string,
  providerCallState: 'not_started' | 'indeterminate',
  component: 'review' | 'planner' = 'review',
  slot: 'api' | 'browser' = 'api',
) {
  return {
    schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1' as const,
    component,
    slot,
    checkpoint,
    providerCallState,
  };
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

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = Buffer.from(type, 'ascii');
  const payload = Buffer.from(data);
  const chunk = Buffer.alloc(12 + payload.byteLength);
  chunk.writeUInt32BE(payload.byteLength, 0);
  typeBytes.copy(chunk, 4);
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBytes, payload])),
    8 + payload.byteLength,
  );
  return chunk;
}

function withChunkAfterIhdr(png: Buffer, chunk: Buffer) {
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

function withoutChunk(png: Buffer, removedType: string) {
  const parts = [png.subarray(0, 8)];
  let offset = 8;
  while (offset < png.byteLength) {
    const length = png.readUInt32BE(offset);
    const end = offset + 12 + length;
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (type !== removedType) parts.push(png.subarray(offset, end));
    offset = end;
  }
  return Buffer.concat(parts);
}

function withIhdrBitDepthAndColorType(
  png: Buffer,
  bitDepth: number,
  colorType: number,
) {
  const ihdrData = Buffer.from(png.subarray(16, 29));
  ihdrData[8] = bitDepth;
  ihdrData[9] = colorType;
  return Buffer.concat([
    png.subarray(0, 8),
    pngChunk('IHDR', ihdrData),
    png.subarray(33),
  ]);
}

function largeValidPng() {
  return withChunkAfterIhdr(
    PLAN_PNG,
    pngChunk('tEXt', Buffer.alloc(1_100_000, 65)),
  );
}

function manifest(environment: 'branch' | 'main' = 'branch') {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-manifest-v1',
    environment,
    commitSha: COMMIT_A,
    pairedEvidenceSha256: SHA_A,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    pricing: {
      priceProfileId:
        'deepseek-v4-pro-cny-noncached-2026-07-18-v8-product-acceptance',
      inputRateCnyPerMillion: 3,
      outputRateCnyPerMillion: 6,
      snapshotDate: '2026-07-18',
      source: 'user-provided-deepseek-official-price-screenshot',
      rounding: 'ROUND_HALF_UP_8DP',
      hardCapCny: '0.10000000',
    },
    accountIdSha256: { review: SHA_B, planner: SHA_C },
    fixtureIdSha256: { review: SHA_C, planner: SHA_D },
    reservation: {
      slotInputTokens: 1_950,
      slotOutputTokens: 440,
      environmentInputTokens: 7_800,
      environmentOutputTokens: 1_760,
      combinedInputTokens: 15_600,
      combinedOutputTokens: 3_520,
      environmentWorstCaseCostCny: '0.03396000',
      combinedWorstCaseCostCny: '0.06792000',
      hardCapCny: '0.10000000',
    },
  } as const;
}

function recoveryManifest(environment: 'branch' | 'main' = 'branch') {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-v1',
    environment,
    publicLedgerPath: `docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/${environment}`,
    syntheticEmails: {
      review: 'phase695-v8-review@example.invalid',
      planner: 'phase695-v8-planner@example.invalid',
      probe: 'phase695-v8-probe@example.invalid',
    },
    fixtureIds: ['fixture-review', 'fixture-planner'],
    browserExecutablePath:
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    browserProfilePath: `.tmp/phase-6-9-5-v8-product-acceptance/${environment}/profile-v8`,
  } as const;
}

function slotResult(
  slot: 'review-api' | 'review-browser' | 'planner-api' | 'planner-browser',
  traceIdSha256: string,
  inputTokens = 100,
  outputTokens = 50,
  screenshotSha256?: string,
) {
  const browser = slot.endsWith('browser');
  const component = slot.startsWith('review') ? 'review' : 'planner';
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-slot-result-v1',
    slot,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    usage: { inputTokens, outputTokens },
    durationMs: 1_000,
    pricingKnown: false,
    costEstimateUsd: 0,
    steps: [
      traceStep('deterministic_review', false),
      traceStep('review_candidate', component === 'review'),
      traceStep('deterministic_planner', false),
      traceStep('planner_candidate', component === 'planner'),
    ],
    disposition: 'candidate_applied',
    provenance: 'live_candidate',
    traceIdSha256,
    ...(browser
      ? {
          screenshotSha256:
            screenshotSha256 ??
            (slot === 'review-browser' ? PLAN_PNG_SHA : TODAY_PNG_SHA),
        }
      : {}),
  } as const;
}

function traceStep(
  name:
    | 'deterministic_review'
    | 'review_candidate'
    | 'deterministic_planner'
    | 'planner_candidate',
  attempted: boolean,
) {
  return attempted
    ? {
        name,
        attempted: true,
        disposition: 'candidate_applied',
        provenance: 'live_candidate',
      }
    : {
        name,
        attempted: false,
        disposition: 'not_eligible',
        provenance: 'local_deterministic',
      };
}

function restoreReceipt(component: 'review' | 'planner') {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2',
    component,
    container: {
      previousIdSha256: SHA_A,
      newIdSha256: SHA_B,
    },
    inspected: {
      aiProviderMode: 'mock',
      liveCallsEnabled: false,
      reviewAgentModelEnabled: false,
      plannerAgentModelEnabled: false,
      acceptanceEnabled: false,
      acceptanceComponent: '',
      capabilitySha256: '',
      maxRequests: 0,
      deepseekCredentialPresent: false,
      openaiCredentialPresent: false,
    },
    binding: {
      port: 3001,
      healthContainerIdSha256: SHA_B,
    },
    deterministicProbe: {
      passed: true,
      provenance: 'local_deterministic',
    },
    providerInvocations: 0,
  } as const;
}

function restoreReceiptForRecovery() {
  return {
    ...restoreReceipt('review'),
    component: 'recovery',
  } as const;
}

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v8-ledger-'));
  await mkdir(join(root, 'docs', 'acceptance', 'evidence'), {
    recursive: true,
  });
  return root;
}

async function prepareV11Journal(root: string) {
  const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
    repoRoot: root,
    environment: 'branch',
    role: 'product',
  });
  if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
  const ledger = await reserveReviewPlannerV11ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner: acquisition.owner,
  });
  const journal = await prepareReviewPlannerV11ProductAcceptanceRecoveryJournal(
    {
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    },
  );
  return { owner: acquisition.owner, ledger, journal };
}

function runV11DispatchHardExitChild(root: string) {
  const ledgerUrl = pathToFileURL(
    resolve(
      'apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts',
    ),
  ).href;
  const recoveryUrl = pathToFileURL(
    resolve(
      'apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts',
    ),
  ).href;
  const script = [
    'const ledgerModule=await import(process.env.TEST_LEDGER_URL);',
    'const recoveryModule=await import(process.env.TEST_RECOVERY_URL);',
    "const acquired=await recoveryModule.acquireReviewPlannerV11ProductAcceptanceOwner({repoRoot:process.env.TEST_ROOT,environment:'branch',role:'product'});",
    "if(acquired.status!=='acquired')process.exit(90);",
    "await ledgerModule.reserveReviewPlannerV11ProductAcceptanceLedger({repoRoot:process.env.TEST_ROOT,environment:'branch',owner:acquired.owner});",
    "const journal=await recoveryModule.prepareReviewPlannerV11ProductAcceptanceRecoveryJournal({repoRoot:process.env.TEST_ROOT,environment:'branch',owner:acquired.owner});",
    "journal.appendCheckpoint({schemaVersion:'phase-6.9.5-v11-product-acceptance-checkpoint-v1',component:'review',slot:'api',checkpoint:'review_api_activate',providerCallState:'not_started'});",
    "journal.appendCheckpoint({schemaVersion:'phase-6.9.5-v11-product-acceptance-checkpoint-v1',component:'review',slot:'api',checkpoint:'review_api_facts_before',providerCallState:'not_started'});",
    "journal.appendCheckpoint({schemaVersion:'phase-6.9.5-v11-product-acceptance-checkpoint-v1',component:'review',slot:'api',checkpoint:'review_api_trace_baseline',providerCallState:'not_started'});",
    "journal.appendCheckpoint({schemaVersion:'phase-6.9.5-v11-product-acceptance-checkpoint-v1',component:'review',slot:'api',checkpoint:'review_api_dispatch',providerCallState:'indeterminate'});",
    'process.exit(77);',
  ].join('');
  return spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEST_LEDGER_URL: ledgerUrl,
      TEST_RECOVERY_URL: recoveryUrl,
      TEST_ROOT: root,
    },
    encoding: 'utf8',
  });
}

function runLedgerHardExitChild(
  root: string,
  phase:
    | 'activation'
    | 'fixture'
    | 'api_claim'
    | 'browser_claim'
    | 'restore'
    | 'cleanup',
) {
  const ledgerUrl = pathToFileURL(
    resolve(
      'apps/server/src/review-agent/review-planner-v8-product-acceptance-ledger.ts',
    ),
  ).href;
  const recoveryUrl = pathToFileURL(
    resolve(
      'apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts',
    ),
  ).href;
  const script = `
const ledgerModule = await import(process.env.TEST_LEDGER_URL);
const recoveryModule = await import(process.env.TEST_RECOVERY_URL);
const ownerResult = await recoveryModule.acquireReviewPlannerV8ProductAcceptanceOwner({repoRoot:process.env.TEST_ROOT,environment:'branch',role:'product'});
if(ownerResult.status!=='acquired')process.exit(90);
const ledger = await ledgerModule.reserveReviewPlannerV8ProductAcceptanceLedger({repoRoot:process.env.TEST_ROOT,environment:'branch',owner:ownerResult.owner});
const stop=(name,code)=>{if(process.env.TEST_PHASE===name)process.exit(code)};
const journal=await recoveryModule.prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({repoRoot:process.env.TEST_ROOT,environment:'branch',owner:ownerResult.owner,manifest:JSON.parse(process.env.TEST_RECOVERY_MANIFEST)});
stop('activation',71);
stop('fixture',72);
journal.close();
ledger.writeManifest(JSON.parse(process.env.TEST_MANIFEST));
ledger.claimSlot('review-api');
stop('api_claim',73);
ledger.recordSlotResult(JSON.parse(process.env.TEST_REVIEW_API));
ledger.claimSlot('review-browser');
stop('browser_claim',74);
ledger.recordDefaultOff(JSON.parse(process.env.TEST_REVIEW_RESTORE));
stop('restore',75);
ledger.recordScreenshot('review',Buffer.from(process.env.TEST_PLAN_PNG,'base64'));
ledger.recordSlotResult(JSON.parse(process.env.TEST_REVIEW_BROWSER));
ledger.claimSlot('planner-api');
ledger.recordSlotResult(JSON.parse(process.env.TEST_PLANNER_API));
ledger.claimSlot('planner-browser');
ledger.recordDefaultOff(JSON.parse(process.env.TEST_PLANNER_RESTORE));
ledger.recordScreenshot('planner',Buffer.from(process.env.TEST_TODAY_PNG,'base64'));
ledger.recordSlotResult(JSON.parse(process.env.TEST_PLANNER_BROWSER));
ledger.recordOwnerIsolation(JSON.parse(process.env.TEST_OWNER_PROOF));
ledger.recordCleanup(JSON.parse(process.env.TEST_CLEANUP));
stop('cleanup',76);
process.exit(91);
`;
  return spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEST_LEDGER_URL: ledgerUrl,
      TEST_RECOVERY_URL: recoveryUrl,
      TEST_ROOT: root,
      TEST_PHASE: phase,
      TEST_MANIFEST: JSON.stringify(manifest()),
      TEST_RECOVERY_MANIFEST: JSON.stringify(recoveryManifest()),
      TEST_REVIEW_API: JSON.stringify(slotResult('review-api', SHA_A)),
      TEST_REVIEW_BROWSER: JSON.stringify(slotResult('review-browser', SHA_B)),
      TEST_PLANNER_API: JSON.stringify(slotResult('planner-api', SHA_C)),
      TEST_PLANNER_BROWSER: JSON.stringify(
        slotResult('planner-browser', SHA_D),
      ),
      TEST_REVIEW_RESTORE: JSON.stringify(restoreReceipt('review')),
      TEST_PLANNER_RESTORE: JSON.stringify(restoreReceipt('planner')),
      TEST_PLAN_PNG: PLAN_PNG.toString('base64'),
      TEST_TODAY_PNG: TODAY_PNG.toString('base64'),
      TEST_OWNER_PROOF: JSON.stringify({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-owner-isolation-v1',
        reviewFactsBeforeSha256: SHA_A,
        reviewFactsAfterSha256: SHA_A,
        plannerFactsBeforeSha256: SHA_B,
        plannerFactsAfterSha256: SHA_B,
        traceIdSha256: [SHA_A, SHA_B, SHA_C, SHA_D],
        crossAccountInvisible: true,
        businessWrites: 0,
      }),
      TEST_CLEANUP: JSON.stringify({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-cleanup-v1',
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      }),
    },
    encoding: 'utf8',
  });
}

function runRecoveryReplayChild(root: string) {
  const recoveryUrl = pathToFileURL(
    resolve(
      'apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts',
    ),
  ).href;
  const script = `
const recoveryModule=await import(process.env.TEST_RECOVERY_URL);
const counters={providerInvocations:0,acceptanceDispatches:0,browserContinues:0};
const acquired=await recoveryModule.acquireReviewPlannerV8ProductAcceptanceOwner({repoRoot:process.env.TEST_ROOT,environment:'branch',role:'recovery'});
if(acquired.status!=='acquired')process.exit(81);
const journal=await recoveryModule.openReviewPlannerV8ProductAcceptanceRecoveryJournal({repoRoot:process.env.TEST_ROOT,environment:'branch',owner:acquired.owner});
const authority=await journal.authorizeRecoveryOnly();
authority.assertAuthorized();
journal.appendStage('restore.claimed','');
journal.appendStage('restore.verified.json',process.env.TEST_RESTORE_RECEIPT);
journal.appendStage('cleanup.claimed','');
journal.appendStage('cleanup.verified.json',process.env.TEST_CLEANUP_RECEIPT);
await journal.finalizeRecoveryOnly();
journal.close();
acquired.owner.close();
process.stdout.write(JSON.stringify(counters));
`;
  return spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TEST_RECOVERY_URL: recoveryUrl,
      TEST_ROOT: root,
      TEST_RESTORE_RECEIPT: JSON.stringify(RECOVERY_RESTORE_RECEIPT),
      TEST_CLEANUP_RECEIPT: JSON.stringify({
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1',
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProcesses: 0,
        browserProfiles: 0,
        probeAccounts: 0,
      }),
    },
    encoding: 'utf8',
  });
}

async function acquire(
  root: string,
  environment: 'branch' | 'main' = 'branch',
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const acquired = await acquireReviewPlannerV8ProductAcceptanceOwner({
    repoRoot: root,
    environment,
    role: 'product',
    profile,
  });
  expect(acquired.status).toBe('acquired');
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  return acquired.owner;
}

async function prepareReserved(
  root: string,
  keepJournal = false,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const owner = await acquire(root, 'branch', profile);
  const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner,
    profile,
  });
  const journal = await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
    repoRoot: root,
    environment: 'branch',
    owner,
    profile,
    manifest: {
      ...recoveryManifest(),
      schemaVersion: profile.schemas.recoveryManifest,
      publicLedgerPath: profile.publicLedgerPath('branch'),
      browserProfilePath: profile.browserProfilePath('branch'),
    },
  });
  ledger.writeManifest({
    ...manifest(),
    schemaVersion: profile.schemas.manifest,
  });
  if (!keepJournal) journal.close();
  return { owner, ledger, journal };
}

async function finishBranch(
  root: string,
  inputTokens = 100,
  outputTokens = 50,
  planPng = PLAN_PNG,
  todayPng = TODAY_PNG,
  profile: ReviewPlannerProductAcceptanceProfile = REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
) {
  const { owner, ledger } = await prepareReserved(root, false, profile);
  ledger.claimSlot('review-api');
  ledger.recordSlotResult({
    ...slotResult('review-api', SHA_A, inputTokens, outputTokens),
    schemaVersion: profile.schemas.slotResult,
  });
  ledger.claimSlot('review-browser');
  ledger.recordDefaultOff({
    ...restoreReceipt('review'),
    schemaVersion: profile.schemas.defaultOff,
  });
  ledger.recordScreenshot('review', planPng);
  ledger.recordSlotResult({
    ...slotResult(
      'review-browser',
      SHA_B,
      inputTokens,
      outputTokens,
      createHash('sha256').update(planPng).digest('hex'),
    ),
    schemaVersion: profile.schemas.slotResult,
  });
  ledger.claimSlot('planner-api');
  ledger.recordSlotResult({
    ...slotResult('planner-api', SHA_C, inputTokens, outputTokens),
    schemaVersion: profile.schemas.slotResult,
  });
  ledger.claimSlot('planner-browser');
  ledger.recordDefaultOff({
    ...restoreReceipt('planner'),
    schemaVersion: profile.schemas.defaultOff,
  });
  ledger.recordScreenshot('planner', todayPng);
  ledger.recordSlotResult({
    ...slotResult(
      'planner-browser',
      SHA_D,
      inputTokens,
      outputTokens,
      createHash('sha256').update(todayPng).digest('hex'),
    ),
    schemaVersion: profile.schemas.slotResult,
  });
  ledger.recordOwnerIsolation({
    schemaVersion: profile.schemas.ownerIsolation,
    reviewFactsBeforeSha256: SHA_A,
    reviewFactsAfterSha256: SHA_A,
    plannerFactsBeforeSha256: SHA_B,
    plannerFactsAfterSha256: SHA_B,
    traceIdSha256: [SHA_A, SHA_B, SHA_C, SHA_D],
    crossAccountInvisible: true,
    businessWrites: 0,
  });
  ledger.recordCleanup({
    schemaVersion: profile.schemas.cleanup,
    syntheticAccounts: 0,
    fixtures: 0,
    traces: 0,
    browserProfiles: 0,
    capabilities: 0,
  });
  ledger.finalizeSuccess();
  ledger.close();
  owner.close();
}

describeWindows('Review/Planner V8 durable product acceptance ledger', () => {
  let root = '';

  beforeEach(async () => {
    root = await createRoot();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes the finalized acceptance leaf with the official strict evidence schema', async () => {
    await finishBranch(root);
    const acceptance = JSON.parse(
      await readFile(
        join(
          root,
          'docs',
          'acceptance',
          'evidence',
          'phase-6-9-5-v8-product-acceptance',
          'branch',
          'acceptance.json',
        ),
        'utf8',
      ),
    ) as unknown;

    const parsed =
      reviewPlannerV8ProductAcceptanceEvidenceSchema.parse(acceptance);
    expect(parsed.schemaVersion).toBe(
      'phase-6.9.5-review-planner-v8-product-acceptance-v1',
    );
  });

  it('seals a complete V10 ledger with V10 evidence and success identities', async () => {
    const profile = REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE;
    await finishBranch(root, 100, 50, PLAN_PNG, TODAY_PNG, profile);
    const publicPath = join(root, ...profile.publicLedgerSegments('branch'));
    await expect(
      readFile(join(publicPath, 'acceptance.json'), 'utf8'),
    ).resolves.toContain(`"schemaVersion":"${profile.schemas.evidence}"`);
    await expect(
      readFile(join(publicPath, '.acceptance-success'), 'utf8'),
    ).resolves.toContain(`"schemaVersion":"${profile.schemas.success}"`);
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        profile,
      }),
    ).resolves.toMatchObject({ status: 'complete' });
  });

  it('durably rejects duplicate and concurrent reservation', async () => {
    const owner = await acquire(root);
    const first = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner,
    });
    await expect(
      reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    expect(first.environment()).toBe('branch');
    first.close();
    owner.close();
  });

  it('keeps the fixed public ledger directory non-replaceable while reserved', async () => {
    const owner = await acquire(root);
    const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner,
    });
    const publicPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await expect(
      rename(publicPath, `${publicPath}-detached`),
    ).rejects.toMatchObject({ code: 'EBUSY' });
    await expect(rm(publicPath, { recursive: true })).rejects.toMatchObject({
      code: 'EBUSY',
    });
    await expect(
      reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    ledger.close();
    owner.close();
  });

  it.each([
    'prepare_create',
    'prepare_write',
    'prepare_flush',
    'prepare_close',
    'prepare_reopen',
    'rename',
    'post_commit_cleanup',
  ] as const)(
    'fails closed when reservation publication faults at %s',
    async (stage) => {
      const owner = await acquire(root);
      await expect(
        reserveReviewPlannerV8ProductAcceptanceLedgerForTests({
          repoRoot: root,
          environment: 'branch',
          owner,
          injector: (observed: DurableFaultStage) => observed === stage,
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
      owner.close();
    },
  );

  it('enforces recovery preparation, slot order, restore order, and permanent marker fail-closed', async () => {
    const { owner, ledger } = await prepareReserved(root);
    expect(() => ledger.claimSlot('review-browser')).toThrow(
      'V8_PRODUCT_ACCEPTANCE_SLOT_ORDER_INVALID',
    );
    ledger.claimSlot('review-api');
    expect(() => ledger.claimSlot('review-browser')).toThrow(
      'V8_PRODUCT_ACCEPTANCE_SLOT_RESULT_MISSING',
    );
    ledger.close();
    owner.close();

    const freshOwner = await acquire(root);
    const fresh = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: freshOwner,
    }).catch((error: unknown) => error);
    expect(fresh).toEqual(new Error('V8_PRODUCT_ACCEPTANCE_ALREADY_RESERVED'));
    freshOwner.close();
  });

  it.each([
    ['activation', 71],
    ['fixture', 72],
    ['api_claim', 73],
    ['browser_claim', 74],
    ['restore', 75],
    ['cleanup', 76],
  ] as const)(
    'preserves fail-closed primitive state after a hard exit at %s',
    async (phase, exitCode) => {
      const child = runLedgerHardExitChild(root, phase);
      expect({ status: child.status, stderr: child.stderr }).toEqual({
        status: exitCode,
        stderr: '',
      });
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'incomplete' });
      const replay = runRecoveryReplayChild(root);
      const counters: unknown = JSON.parse(replay.stdout);
      expect({
        status: replay.status,
        stderr: replay.stderr,
        counters,
      }).toEqual({
        status: 0,
        stderr: '',
        counters: {
          providerInvocations: 0,
          acceptanceDispatches: 0,
          browserContinues: 0,
        },
      });
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'recovery_only' });
    },
  );

  it('rejects duplicate trace ids, schema extras, and per-slot budget overflow', async () => {
    const { owner, ledger } = await prepareReserved(root);
    ledger.claimSlot('review-api');
    ledger.recordSlotResult(slotResult('review-api', SHA_A));
    ledger.claimSlot('review-browser');
    const missingInspectFact = structuredClone(restoreReceipt('review')) as {
      inspected: { maxRequests?: number };
    };
    delete missingInspectFact.inspected.maxRequests;
    expect(() => ledger.recordDefaultOff(missingInspectFact)).toThrow(
      'V8_PRODUCT_ACCEPTANCE_RECORD_INVALID',
    );
    expect(() =>
      ledger.recordDefaultOff({
        ...restoreReceipt('review'),
        container: {
          previousIdSha256: SHA_A,
          newIdSha256: SHA_A,
        },
        binding: {
          port: 3001,
          healthContainerIdSha256: SHA_A,
        },
      }),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
    ledger.recordDefaultOff(restoreReceipt('review'));
    expect(() =>
      ledger.recordScreenshot(
        'review',
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          Buffer.from('not-a-real-png'),
        ]),
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID');
    ledger.recordScreenshot('review', PLAN_PNG);
    expect(() =>
      ledger.recordSlotResult(slotResult('review-browser', SHA_A)),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_TRACE_DUPLICATE');
    expect(() =>
      ledger.recordSlotResult(slotResult('review-browser', SHA_B, 1_951, 440)),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
    expect(() =>
      ledger.recordSlotResult({
        ...slotResult('review-browser', SHA_B),
        providerKey: 'must-not-be-persisted',
      }),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_RECORD_INVALID');
    ledger.close();
    owner.close();
  });

  it('releases the public directory when recovery directory open fails', async () => {
    const owner = await acquire(root);
    await expect(
      reserveReviewPlannerV8ProductAcceptanceLedgerForTests({
        repoRoot: root,
        environment: 'branch',
        owner,
        injector: () => false,
        failRecoveryOpenForTests: true,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    const publicPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await expect(
      rename(publicPath, `${publicPath}-detached`),
    ).resolves.toBeUndefined();
    owner.close();
  });

  it('requires complete sealed branch and aggregate budget before main reserve', async () => {
    const mainOwner = await acquire(root, 'main');
    await expect(
      reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'main',
        owner: mainOwner,
        pairedEvidenceSha256: SHA_A,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_BRANCH_INCOMPLETE');
    mainOwner.close();

    await finishBranch(root);
    const nextMainOwner = await acquire(root, 'main');
    const main = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'main',
      owner: nextMainOwner,
      pairedEvidenceSha256: SHA_A,
    });
    expect(main.environment()).toBe('main');
    main.close();
    nextMainOwner.close();
  });

  it('admits main at the exact branch plus main aggregate reservation boundary', async () => {
    await finishBranch(root, 1_950, 440);
    const mainOwner = await acquire(root, 'main');
    const main = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'main',
      owner: mainOwner,
      pairedEvidenceSha256: SHA_A,
    });
    expect(main.environment()).toBe('main');
    main.close();
    mainOwner.close();
  });

  it('fails closed for an unknown leaf and malicious dual terminal fixture', async () => {
    await finishBranch(root);
    const ledgerPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await writeFile(join(ledgerPath, 'unknown.json'), '{}');
    await writeFile(join(ledgerPath, '.recovery-only.json'), '{}');
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('fails closed when a sealed claim marker becomes non-empty', async () => {
    await finishBranch(root);
    const ledgerPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await writeFile(join(ledgerPath, '.slot-03-planner-api'), 'tampered');
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('publishes and verifies a structurally valid PNG larger than the JSON read cap', async () => {
    const largePng = largeValidPng();
    expect(largePng.byteLength).toBeGreaterThan(1_048_576);
    await finishBranch(root, 100, 50, largePng);
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toMatchObject({ status: 'complete' });
  });

  it.each([
    [
      'bad CRC',
      (() => {
        const png = Buffer.from(PLAN_PNG);
        png[png.byteLength - 1] ^= 1;
        return png;
      })(),
    ],
    ['missing IDAT', withoutChunk(PLAN_PNG, 'IDAT')],
    ['duplicate IHDR', withChunkAfterIhdr(PLAN_PNG, PLAN_PNG.subarray(8, 33))],
    [
      'invalid bit-depth/color-type',
      withIhdrBitDepthAndColorType(PLAN_PNG, 1, 6),
    ],
    ['trailing bytes', Buffer.concat([PLAN_PNG, Buffer.from('trailing')])],
  ])('rejects a screenshot with %s', async (_name, invalidPng) => {
    const { owner, ledger } = await prepareReserved(root);
    ledger.claimSlot('review-api');
    ledger.recordSlotResult(slotResult('review-api', SHA_A));
    ledger.claimSlot('review-browser');
    ledger.recordDefaultOff(restoreReceipt('review'));
    expect(() => ledger.recordScreenshot('review', invalidPng)).toThrow(
      'V8_PRODUCT_ACCEPTANCE_SCREENSHOT_INVALID',
    );
    ledger.close();
    owner.close();
  });

  it('detects a valid-schema default-off receipt changed after success sealing', async () => {
    await finishBranch(root);
    const ledgerPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await writeFile(
      join(ledgerPath, '.review-default-off.json'),
      `${JSON.stringify({
        ...restoreReceipt('review'),
        container: {
          ...restoreReceipt('review').container,
          newIdSha256: SHA_C,
        },
        binding: {
          ...restoreReceipt('review').binding,
          healthContainerIdSha256: SHA_C,
        },
      })}\n`,
    );
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('rejects result contents moved under a different fixed slot filename', async () => {
    await finishBranch(root);
    const ledgerPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    const reviewLeaf = join(ledgerPath, '.slot-01-review-api.result.json');
    const plannerLeaf = join(ledgerPath, '.slot-03-planner-api.result.json');
    const reviewBytes = await readFile(reviewLeaf);
    const plannerBytes = await readFile(plannerLeaf);
    await writeFile(reviewLeaf, plannerBytes);
    await writeFile(plannerLeaf, reviewBytes);
    const acceptancePath = join(ledgerPath, 'acceptance.json');
    const acceptance = JSON.parse(await readFile(acceptancePath, 'utf8')) as {
      traceIdSha256: string[];
    };
    acceptance.traceIdSha256 = [SHA_C, SHA_B, SHA_A, SHA_D];
    const acceptanceBytes = `${JSON.stringify(acceptance)}\n`;
    await writeFile(acceptancePath, acceptanceBytes);
    const successPath = join(ledgerPath, '.acceptance-success');
    const success = JSON.parse(await readFile(successPath, 'utf8')) as {
      resultSha256: string[];
      acceptanceSha256: string;
    };
    success.resultSha256 = [
      createHash('sha256').update(plannerBytes).digest('hex'),
      success.resultSha256[1],
      createHash('sha256').update(reviewBytes).digest('hex'),
      success.resultSha256[3],
    ];
    success.acceptanceSha256 = createHash('sha256')
      .update(acceptanceBytes)
      .digest('hex');
    await writeFile(successPath, `${JSON.stringify(success)}\n`);
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it.each([
    ['missing admission marker', '.acceptance-reserved', 'delete'],
    ['missing exact slot marker', '.slot-02-review-browser', 'delete'],
    ['missing screenshot', 'plan.png', 'delete'],
    ['tampered screenshot', 'today.png', 'tamper'],
  ] as const)(
    'fails closed for %s after sealing',
    async (_name, leaf, action) => {
      await finishBranch(root);
      const ledgerPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      if (action === 'delete') await unlink(join(ledgerPath, leaf));
      else await writeFile(join(ledgerPath, leaf), Buffer.from('not-a-png'));
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'evidence_io' });
    },
  );

  it('rejects a pre-bound public junction without writing outside the repo', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'prepmind-v8-outside-'));
    const publicPath = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-v8-product-acceptance',
      'branch',
    );
    await mkdir(join(publicPath, '..'), { recursive: true });
    await symlink(outside, publicPath, 'junction');
    const owner = await acquire(root);
    await expect(
      reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    expect(await readdir(outside)).toEqual([]);
    owner.close();
    await rm(outside, { recursive: true, force: true });
  });

  it('publishes no secret-bearing fields in the recovery manifest', async () => {
    const owner = await acquire(root);
    const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner,
    });
    await expect(
      prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
        repoRoot: root,
        environment: 'branch',
        owner,
        manifest: { ...recoveryManifest(), password: 'secret' },
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_RECOVERY_MANIFEST_INVALID');
    ledger.close();
    owner.close();
  });
});

describeWindows(
  'Review/Planner V8 product/recovery owner lifetime lock',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await createRoot();
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('returns owner_active to recovery while product owner is alive', async () => {
      const owner = await acquire(root);
      const recovery = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(recovery).toEqual({ status: 'owner_active' });
      owner.assertHeld();
      owner.close();
    });

    it('blocks product ownership after recovery ownership is acquired', async () => {
      const recovery = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(recovery.status).toBe('acquired');
      if (recovery.status !== 'acquired') throw new Error('owner unavailable');
      await expect(
        acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'product',
        }),
      ).resolves.toEqual({ status: 'owner_active' });
      recovery.owner.close();
    });

    it('holds one shared runtime lease across V8 and V10 ownership profiles', async () => {
      const v8 = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'product',
      });
      let v10WhileV8:
        | Awaited<
            ReturnType<typeof acquireReviewPlannerV8ProductAcceptanceOwner>
          >
        | undefined;
      let v10:
        | Awaited<
            ReturnType<typeof acquireReviewPlannerV8ProductAcceptanceOwner>
          >
        | undefined;
      let v8WhileV10:
        | Awaited<
            ReturnType<typeof acquireReviewPlannerV8ProductAcceptanceOwner>
          >
        | undefined;
      try {
        expect(v8.status).toBe('acquired');
        v10WhileV8 = await acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'recovery',
          profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        });
        expect(v10WhileV8).toEqual({ status: 'owner_active' });
        if (v8.status === 'acquired') v8.owner.close();

        v10 = await acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'recovery',
          profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        });
        expect(v10.status).toBe('acquired');
        v8WhileV10 = await acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'product',
        });
        expect(v8WhileV10).toEqual({ status: 'owner_active' });
      } finally {
        if (v8.status === 'acquired') v8.owner.close();
        if (v10WhileV8?.status === 'acquired') v10WhileV8.owner.close();
        if (v10?.status === 'acquired') v10.owner.close();
        if (v8WhileV10?.status === 'acquired') v8WhileV10.owner.close();
      }
    });

    it('holds one shared runtime lease across branch and main environments', async () => {
      const branch = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'product',
      });
      let main:
        | Awaited<
            ReturnType<typeof acquireReviewPlannerV8ProductAcceptanceOwner>
          >
        | undefined;
      try {
        expect(branch.status).toBe('acquired');
        main = await acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'main',
          role: 'recovery',
          profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        });
        expect(main).toEqual({ status: 'owner_active' });
      } finally {
        if (branch.status === 'acquired') branch.owner.close();
        if (main?.status === 'acquired') main.owner.close();
      }
    });

    it('rejects recovery authorization for a non-canonical public slot leaf', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await writeFile(join(publicPath, '.slot-01-planner-browser'), '');
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      await expect(journal.authorizeRecoveryOnly()).rejects.toThrow(
        'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
      );
      journal.close();
      acquisition.owner.close();
    });

    it('returns one cached authority for repeated and concurrent authorization', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();
      const acquired = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquired.status).toBe('acquired');
      if (acquired.status !== 'acquired') throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        { repoRoot: root, environment: 'branch', owner: acquired.owner },
      );
      const authorities = await Promise.all([
        journal.authorizeRecoveryOnly(),
        journal.authorizeRecoveryOnly(),
        journal.authorizeRecoveryOnly(),
      ]);
      expect(authorities[0]).toBe(authorities[1]);
      expect(authorities[1]).toBe(authorities[2]);
      expect(await journal.authorizeRecoveryOnly()).toBe(authorities[0]);
      journal.close();
      acquired.owner.close();
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await expect(
        rename(publicPath, `${publicPath}-detached`),
      ).resolves.toBeUndefined();
    });

    it('projects the strict recovery manifest, append-only account bindings, and durable stage status after reopen', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      expect(prepared.snapshot()).toEqual({
        manifest: recoveryManifest(),
        bindings: {},
        mode: null,
        stages: {
          restoreClaimed: false,
          restoreVerified: false,
          cleanupClaimed: false,
          cleanupVerified: false,
        },
      });
      prepared.bindAccount({
        component: 'review',
        email: recoveryManifest().syntheticEmails.review,
        accountId: 'review-user-id',
      });
      expect(() =>
        prepared.bindAccount({
          component: 'review',
          email: recoveryManifest().syntheticEmails.review,
          accountId: 'different-user-id',
        }),
      ).toThrow('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_EXISTS');
      prepared.close();
      ledger.close();
      productOwner.close();

      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const reopened =
        await openReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        });
      const authority = await reopened.authorizeRecoveryOnly();
      authority.assertAuthorized();
      reopened.appendStage('restore.claimed', '');
      expect(reopened.snapshot()).toEqual({
        manifest: recoveryManifest(),
        bindings: {
          review: {
            component: 'review',
            email: recoveryManifest().syntheticEmails.review,
            accountId: 'review-user-id',
          },
        },
        mode: {
          schemaVersion: 'phase-6.9.5-v8-product-acceptance-mode-v1',
          environment: 'branch',
          mode: 'recovery',
        },
        stages: {
          restoreClaimed: true,
          restoreVerified: false,
          cleanupClaimed: false,
          cleanupVerified: false,
        },
      });
      reopened.close();
      acquisition.owner.close();
    });

    it('fresh-seals a fully verified acceptance aggregate without claiming or invoking another slot', async () => {
      await finishBranch(root);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      const resultLeaves = (await readdir(publicPath)).filter((leaf) =>
        leaf.endsWith('.result.json'),
      );
      const resultHashes = await Promise.all(
        resultLeaves.map(async (leaf) =>
          createHash('sha256')
            .update(await readFile(join(publicPath, leaf)))
            .digest('hex'),
        ),
      );
      await unlink(join(publicPath, '.acceptance-success'));
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');

      await finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });

      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toMatchObject({ status: 'complete' });
      expect(
        await Promise.all(
          resultLeaves.map(async (leaf) =>
            createHash('sha256')
              .update(await readFile(join(publicPath, leaf)))
              .digest('hex'),
          ),
        ),
      ).toEqual(resultHashes);
      acquisition.owner.close();
    });

    it('does not publish a preseal success when a schema-valid owner proof no longer matches fixed result order', async () => {
      await finishBranch(root);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await unlink(join(publicPath, '.acceptance-success'));
      const proofPath = join(publicPath, '.owner-isolation-verified.json');
      const proof = JSON.parse(await readFile(proofPath, 'utf8')) as {
        traceIdSha256: string[];
      };
      proof.traceIdSha256 = [SHA_B, SHA_A, SHA_C, SHA_D];
      await writeFile(proofPath, `${JSON.stringify(proof)}\n`);
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');

      await expect(
        finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_PRESEAL_INVALID');
      expect((await readdir(publicPath)).includes('.acceptance-success')).toBe(
        false,
      );
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      await expect(journal.authorizeRecoveryOnly()).resolves.toBeDefined();
      journal.close();
      acquisition.owner.close();
    });

    it('serializes recovery authorization before preseal completion for the same recovery owner', async () => {
      await finishBranch(root);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await unlink(join(publicPath, '.acceptance-success'));
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      await journal.authorizeRecoveryOnly();

      await expect(
        finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_PRESEAL_MODE_CONFLICT');
      expect((await readdir(publicPath)).includes('.acceptance-success')).toBe(
        false,
      );
      journal.close();
      acquisition.owner.close();
    });

    it('allows only one winner when recovery authorization races preseal completion', async () => {
      await finishBranch(root);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await unlink(join(publicPath, '.acceptance-success'));
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      const outcomes = await Promise.allSettled([
        journal.authorizeRecoveryOnly(),
        finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === 'rejected'),
      ).toHaveLength(1);
      journal.close();
      acquisition.owner.close();
    });

    it('rejects recovery stages after a preseal terminal and safely resumes a missing preseal success seal', async () => {
      await finishBranch(root);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await unlink(join(publicPath, '.acceptance-success'));
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      await finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });
      await expect(journal.authorizeRecoveryOnly()).rejects.toThrow(
        'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
      );
      expect(() => journal.appendStage('restore.claimed', '')).toThrow(
        'V8_PRODUCT_ACCEPTANCE_RECOVERY_AUTHORIZATION_INVALID',
      );
      await unlink(join(publicPath, '.acceptance-success'));
      await expect(
        finalizeReviewPlannerV8ProductAcceptancePresealedSuccess({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ).resolves.toBeUndefined();
      journal.close();
      acquisition.owner.close();
    });

    it('fails complete ledger reads closed when a local recovery mode coexists with public success', async () => {
      await finishBranch(root);
      await writeFile(
        join(
          root,
          '.tmp',
          'phase-6-9-5-v8-product-acceptance',
          'branch',
          'mode.json',
        ),
        `${JSON.stringify({
          schemaVersion: 'phase-6.9.5-v8-product-acceptance-mode-v1',
          environment: 'branch',
          mode: 'recovery',
        })}\n`,
      );
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'evidence_io' });
    });

    it.each([
      ['non-empty claim', { leaf: 'restore.claimed', contents: 'x' }],
      [
        'verified gap',
        {
          leaf: 'restore.verified.json',
          contents: JSON.stringify(restoreReceiptForRecovery()),
        },
      ],
    ])('rejects a recovery snapshot with %s', async (_name, mutation) => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();
      await writeFile(
        join(
          root,
          '.tmp',
          'phase-6-9-5-v8-product-acceptance',
          'branch',
          mutation.leaf,
        ),
        mutation.contents,
      );
      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const reopened =
        await openReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        });
      expect(() => reopened.snapshot()).toThrow(
        'V8_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO',
      );
      reopened.close();
      acquisition.owner.close();
    });

    it('rejects a late account binding after recovery has entered its append-only state machine', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      await writeFile(
        join(
          root,
          '.tmp',
          'phase-6-9-5-v8-product-acceptance',
          'branch',
          'restore.claimed',
        ),
        '',
      );
      expect(() =>
        prepared.bindAccount({
          component: 'review',
          email: recoveryManifest().syntheticEmails.review,
          accountId: 'review-user-id',
        }),
      ).toThrow('V8_PRODUCT_ACCEPTANCE_RECOVERY_BINDING_INVALID');
      prepared.close();
      ledger.close();
      productOwner.close();
    });

    it('does not mount an authorization handle after journal close wins the await race', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();
      const acquired = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquired.status).toBe('acquired');
      if (acquired.status !== 'acquired') throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        { repoRoot: root, environment: 'branch', owner: acquired.owner },
      );
      const pending = journal.authorizeRecoveryOnly();
      journal.close();
      await expect(pending).rejects.toThrow(
        'V8_PRODUCT_ACCEPTANCE_RECOVERY_JOURNAL_CLOSED',
      );
      acquired.owner.close();
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await expect(
        rename(publicPath, `${publicPath}-detached`),
      ).resolves.toBeUndefined();
    });

    it('releases the lifetime lock after a hard-exited child process', async () => {
      const moduleUrl = pathToFileURL(
        resolve(
          'apps/server/src/review-agent/review-planner-v8-product-acceptance-recovery.ts',
        ),
      ).href;
      const child = spawn(
        process.execPath,
        [
          '-e',
          `const m=await import(process.env.TEST_MODULE_URL);const r=await m.acquireReviewPlannerV8ProductAcceptanceOwner({repoRoot:process.env.TEST_ROOT,environment:'branch',role:'product'});if(r.status!=='acquired')process.exit(72);process.stdout.write('locked\\n');setTimeout(()=>process.exit(73),30000);`,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, TEST_MODULE_URL: moduleUrl, TEST_ROOT: root },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      await new Promise<void>((resolveReady, reject) => {
        child.stdout?.once('data', () => resolveReady());
        child.once('error', reject);
      });
      expect(
        await acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'main',
          role: 'recovery',
          profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        }),
      ).toEqual({ status: 'owner_active' });
      child.kill();
      await new Promise<void>((resolveExit) =>
        child.once('exit', () => resolveExit()),
      );
      const recovered = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'main',
        role: 'recovery',
        profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
      });
      expect(recovered.status).toBe('acquired');
      if (recovered.status === 'acquired') recovered.owner.close();
    });

    it('lets only a fresh recovery owner publish a strict recovery-only terminal', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();

      const acquisition = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      expect(acquisition.status).toBe('acquired');
      if (acquisition.status !== 'acquired')
        throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        },
      );
      const authority = await journal.authorizeRecoveryOnly();
      authority.assertAuthorized();
      journal.appendStage('restore.claimed', '');
      expect(() =>
        journal.appendStage(
          'restore.verified.json',
          JSON.stringify({
            ...restoreReceipt('review'),
            password: 'forbidden',
          }),
        ),
      ).toThrow('V8_PRODUCT_ACCEPTANCE_RECOVERY_STAGE_INVALID');
      journal.appendStage(
        'restore.verified.json',
        JSON.stringify({
          ...restoreReceipt('review'),
          component: 'recovery',
        }),
      );
      journal.appendStage('cleanup.claimed', '');
      journal.appendStage(
        'cleanup.verified.json',
        JSON.stringify({
          schemaVersion:
            'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1',
          syntheticAccounts: 0,
          fixtures: 0,
          traces: 0,
          browserProcesses: 0,
          browserProfiles: 0,
          probeAccounts: 0,
        }),
      );
      await journal.finalizeRecoveryOnly();
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'recovery_only' });
      journal.close();
      acquisition.owner.close();
    });

    it('allows a new V10 reservation after V8 has finalized recovery_only', async () => {
      const productOwner = await acquire(root);
      const v8Ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      v8Ledger.close();
      productOwner.close();

      const recovery = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
      });
      if (recovery.status !== 'acquired') throw new Error('owner unavailable');
      const journal = await openReviewPlannerV8ProductAcceptanceRecoveryJournal(
        {
          repoRoot: root,
          environment: 'branch',
          owner: recovery.owner,
        },
      );
      const authority = await journal.authorizeRecoveryOnly();
      authority.assertAuthorized();
      journal.appendStage('restore.claimed', '');
      journal.appendStage(
        'restore.verified.json',
        JSON.stringify({ ...restoreReceipt('review'), component: 'recovery' }),
      );
      journal.appendStage('cleanup.claimed', '');
      journal.appendStage(
        'cleanup.verified.json',
        JSON.stringify({
          schemaVersion:
            'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1',
          syntheticAccounts: 0,
          fixtures: 0,
          traces: 0,
          browserProcesses: 0,
          browserProfiles: 0,
          probeAccounts: 0,
        }),
      );
      await journal.finalizeRecoveryOnly();
      journal.close();
      recovery.owner.close();

      const v10Owner = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'product',
        profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
      });
      expect(v10Owner.status).toBe('acquired');
      if (v10Owner.status !== 'acquired') throw new Error('owner unavailable');
      const v10Ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: v10Owner.owner,
        profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
      });
      const v10Profile = REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE;
      const v10Prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: v10Owner.owner,
          profile: v10Profile,
          manifest: {
            ...recoveryManifest(),
            schemaVersion: v10Profile.schemas.recoveryManifest,
            publicLedgerPath: v10Profile.publicLedgerPath('branch'),
            browserProfilePath: v10Profile.browserProfilePath('branch'),
          },
        });
      v10Ledger.writeManifest({
        ...manifest(),
        schemaVersion: v10Profile.schemas.manifest,
      });
      const v10ManifestPath = join(
        root,
        ...v10Profile.publicLedgerSegments('branch'),
        'manifest.json',
      );
      await expect(readFile(v10ManifestPath, 'utf8')).resolves.toContain(
        `"schemaVersion":"${v10Profile.schemas.manifest}"`,
      );
      const v10RecoveryPath = join(
        root,
        ...v10Profile.recoverySegments('branch'),
      );
      await expect(
        readFile(join(v10RecoveryPath, 'recovery-manifest.json'), 'utf8'),
      ).resolves.toContain(
        `"schemaVersion":"${v10Profile.schemas.recoveryManifest}"`,
      );
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
          profile: v10Profile,
        }),
      ).resolves.toEqual({ status: 'incomplete' });
      v10Prepared.close();
      v10Ledger.close();
      v10Owner.owner.close();

      const v10Recovery = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
        profile: v10Profile,
      });
      expect(v10Recovery.status).toBe('acquired');
      if (v10Recovery.status !== 'acquired')
        throw new Error('owner unavailable');
      const v10Journal =
        await openReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: v10Recovery.owner,
          profile: v10Profile,
        });
      const v10Authority = await v10Journal.authorizeRecoveryOnly();
      v10Authority.assertAuthorized();
      v10Journal.appendStage('restore.claimed', '');
      v10Journal.appendStage(
        'restore.verified.json',
        JSON.stringify({
          ...restoreReceipt('review'),
          schemaVersion: v10Profile.schemas.defaultOff,
          component: 'recovery',
        }),
      );
      v10Journal.appendStage('cleanup.claimed', '');
      v10Journal.appendStage(
        'cleanup.verified.json',
        JSON.stringify({
          schemaVersion: v10Profile.schemas.recoveryCleanup,
          syntheticAccounts: 0,
          fixtures: 0,
          traces: 0,
          browserProcesses: 0,
          browserProfiles: 0,
          probeAccounts: 0,
        }),
      );
      await v10Journal.finalizeRecoveryOnly();
      await expect(
        readFile(join(v10RecoveryPath, 'mode.json'), 'utf8'),
      ).resolves.toContain(
        `"schemaVersion":"${v10Profile.schemas.recoveryMode}"`,
      );
      const v10TerminalPath = join(
        v10ManifestPath,
        '..',
        '.recovery-only.json',
      );
      await expect(readFile(v10TerminalPath, 'utf8')).resolves.toContain(
        `"schemaVersion":"${v10Profile.schemas.recoveryTerminal}"`,
      );
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
          profile: v10Profile,
        }),
      ).resolves.toEqual({ status: 'recovery_only' });
      const v10Terminal = JSON.parse(
        await readFile(v10TerminalPath, 'utf8'),
      ) as Record<string, unknown>;
      await writeFile(
        v10TerminalPath,
        `${JSON.stringify({
          ...v10Terminal,
          schemaVersion:
            REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas
              .recoveryTerminal,
        })}\n`,
      );
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
          profile: v10Profile,
        }),
      ).resolves.toEqual({ status: 'evidence_io' });
      v10Journal.close();
      v10Recovery.owner.close();
    });

    it('rejects a public recovery terminal when its local journal is missing', async () => {
      const productOwner = await acquire(root);
      const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: productOwner,
      });
      const prepared =
        await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: productOwner,
          manifest: recoveryManifest(),
        });
      prepared.close();
      ledger.close();
      productOwner.close();
      const localPath = join(
        root,
        '.tmp',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await rename(localPath, `${localPath}-missing`);
      const publicPath = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-v8-product-acceptance',
        'branch',
      );
      await writeFile(
        join(publicPath, '.recovery-only.json'),
        `${JSON.stringify({
          schemaVersion:
            'phase-6.9.5-v8-product-acceptance-recovery-terminal-v1',
          environment: 'branch',
          status: 'failed',
          reason: 'hard_crash_recovered',
          providerInvocations: 0,
          recoveryManifestSha256: SHA_A,
          restoreReceiptSha256: SHA_B,
          cleanupReceiptSha256: SHA_C,
        })}\n`,
      );
      await expect(
        readReviewPlannerV8ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toEqual({ status: 'evidence_io' });
    });
  },
);

describeWindows('Review/Planner V11 safe failure ledger', () => {
  let root = '';

  beforeEach(async () => {
    root = await createRoot();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('rejects an unbound V11 public failure write', async () => {
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquisition.status).toBe('acquired');
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV11ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });

    try {
      expect(() =>
        ledger.recordFailure(
          Object.freeze({ assertAuthorized() {} }) as never,
          v11Failure(),
        ),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
    } finally {
      ledger.close();
      acquisition.owner.close();
    }
  });

  it('writes and reads the exact strict V11 public failure projection', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    const expected = v11Failure();
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      const authority = journal.issueFailureAuthority();
      authority.assertAuthorized();
      expect(journal.latestCheckpoint()).toMatchObject({
        checkpoint: expected.checkpoint,
        providerCallState: expected.providerCallState,
      });
      ledger.recordFailure(authority, expected);
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }

    const failurePath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
      '.failure.json',
    );
    await expect(readFile(failurePath, 'utf8')).resolves.toBe(
      `${JSON.stringify(expected)}\n`,
    );
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({
      status: 'operation_failed',
      environment: expected.environment,
      component: expected.component,
      slot: expected.slot,
      checkpoint: expected.checkpoint,
      terminal: expected.terminal,
      providerCallState: expected.providerCallState,
    });
  });

  it('projects a Task4 diagnostics checkpoint through the real opaque Task3 authority and strict reader', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      const diagnostics =
        createReviewPlannerV11ProductAcceptanceDiagnosticsPort({
          environment: 'branch',
          journal,
          ledger,
        });
      diagnostics.checkpoint('review_api_activate');
      diagnostics.publishFailure();
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }

    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({
      status: 'operation_failed',
      environment: 'branch',
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_activate',
      terminal: 'operation_failed',
      providerCallState: 'not_started',
    });
  });

  it('rejects V8/V10 identity injection plus early indeterminate and late not_started checkpoints', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      expect(() =>
        journal.appendCheckpoint(
          v11Checkpoint('review_api_trace_baseline', 'indeterminate'),
        ),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_INVALID');
      journal.appendCheckpoint(
        v11Checkpoint('review_api_trace_baseline', 'not_started'),
      );
      expect(() =>
        journal.appendCheckpoint(
          v11Checkpoint('review_api_dispatch', 'not_started'),
        ),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_INVALID');
      const authority = journal.issueFailureAuthority();
      expect(() =>
        ledger.recordFailure(authority, {
          ...v11Failure(),
          checkpoint: 'review_api_trace_baseline',
          schemaVersion:
            REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
        }),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
      ledger.recordFailure(
        authority,
        v11Failure({ checkpoint: 'review_api_trace_baseline' }),
      );
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }

    const publicPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
    );
    await writeFile(join(publicPath, 'unknown.json'), '{}\n');
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    await unlink(join(publicPath, 'unknown.json'));
    await writeFile(
      join(publicPath, '.failure.json'),
      `${JSON.stringify({
        ...v11Failure(),
        schemaVersion:
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.schemas.success,
      })}\n`,
    );
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('seals a V11 journal when issuing the failure authority', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      const authority = journal.issueFailureAuthority();
      expect(() =>
        journal.appendCheckpoint(
          v11Checkpoint('review_api_trace_baseline', 'not_started'),
        ),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_SEALED');
      ledger.recordFailure(authority, v11Failure());
      expect(() =>
        journal.appendCheckpoint(
          v11Checkpoint('review_api_trace_baseline', 'not_started'),
        ),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_CHECKPOINT_SEALED');
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }
  });

  it('requires a first V11 checkpoint before issuing and sealing failure authority', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      expect(() => journal.issueFailureAuthority()).toThrow(
        'V11_PRODUCT_ACCEPTANCE_CHECKPOINT_REQUIRED',
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      expect(() => journal.issueFailureAuthority()).not.toThrow();
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }
  });

  it('rejects creating a V11 private journal before its public reservation exists', async () => {
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const staleAttemptId = 'd'.repeat(64);
    await writeFile(
      join(
        root,
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
          'branch',
        ),
        'attempt-binding.json',
      ),
      `${JSON.stringify({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-attempt-v1',
        attemptId: staleAttemptId,
        attemptSha256: createHash('sha256')
          .update(staleAttemptId)
          .digest('hex'),
      })}\n`,
    );
    let pending:
      | Promise<
          Awaited<
            ReturnType<
              typeof prepareReviewPlannerV11ProductAcceptanceRecoveryJournal
            >
          >
        >
      | undefined;
    try {
      pending = prepareReviewPlannerV11ProductAcceptanceRecoveryJournal({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });
      await expect(pending).rejects.toThrow(
        'V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO',
      );
    } finally {
      const journal = await pending?.catch(() => null);
      journal?.close();
      acquisition.owner.close();
    }
  });

  it('fails direct V11 checkpoint readers closed for stale private history before reservation', async () => {
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const staleAttemptId = 'c'.repeat(64);
    const recoveryPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        'branch',
      ),
    );
    await writeFile(
      join(recoveryPath, 'attempt-binding.json'),
      `${JSON.stringify({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-attempt-v1',
        attemptId: staleAttemptId,
        attemptSha256: createHash('sha256')
          .update(staleAttemptId)
          .digest('hex'),
      })}\n`,
    );
    await writeFile(
      join(recoveryPath, 'checkpoint-001-review_api_activate.json'),
      `${JSON.stringify(
        v11Checkpoint('review_api_activate', 'not_started'),
      )}\n`,
    );
    try {
      await expect(
        inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
          repoRoot: root,
          environment: 'branch',
        }),
      ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
      await expect(
        readReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
          repoRoot: root,
          environment: 'branch',
        }),
      ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    } finally {
      acquisition.owner.close();
    }
  });

  it('rejects a public/private V11 attempt mismatch before recovery can project', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    journal.close();
    ledger.close();
    owner.close();

    const mismatchedAttemptId = 'e'.repeat(64);
    const recoveryPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        'branch',
      ),
    );
    await writeFile(
      join(recoveryPath, 'attempt-binding.json'),
      `${JSON.stringify({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-attempt-v1',
        attemptId: mismatchedAttemptId,
        attemptSha256: createHash('sha256')
          .update(mismatchedAttemptId)
          .digest('hex'),
      })}\n`,
    );
    await expect(
      inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
        repoRoot: root,
        environment: 'branch',
      }),
    ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    await expect(
      readReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
        repoRoot: root,
        environment: 'branch',
      }),
    ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');

    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        openReviewPlannerV11ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
      await expect(
        openReviewPlannerV11ProductAcceptanceRecoveryLedger({
          repoRoot: root,
          environment: 'branch',
          owner: acquisition.owner,
        }),
      ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    } finally {
      acquisition.owner.close();
    }
  });

  it('fails direct V11 checkpoint readers closed when the private attempt binding is missing', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    journal.appendCheckpoint(
      v11Checkpoint('review_api_activate', 'not_started'),
    );
    journal.close();
    ledger.close();
    owner.close();
    await unlink(
      join(
        root,
        ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
          'branch',
        ),
        'attempt-binding.json',
      ),
    );

    await expect(
      inspectReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
        repoRoot: root,
        environment: 'branch',
      }),
    ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
    await expect(
      readReviewPlannerV11ProductAcceptanceRecoveryCheckpoint({
        repoRoot: root,
        environment: 'branch',
      }),
    ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO');
  });

  it('rejects a V11 authority from a different opaque attempt', async () => {
    const otherRoot = await createRoot();
    const first = await prepareV11Journal(root);
    const second = await prepareV11Journal(otherRoot);
    try {
      for (const prepared of [first, second]) {
        prepared.journal.appendCheckpoint(
          v11Checkpoint('review_api_activate', 'not_started'),
        );
        prepared.journal.appendCheckpoint(
          v11Checkpoint('review_api_facts_before', 'not_started'),
        );
      }
      const firstAuthority = first.journal.issueFailureAuthority();
      expect(() =>
        second.ledger.recordFailure(firstAuthority, v11Failure()),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_FAILURE_AUTHORITY_INVALID');
    } finally {
      first.ledger.close();
      first.journal.close();
      first.owner.close();
      second.ledger.close();
      second.journal.close();
      second.owner.close();
      await rm(otherRoot, { recursive: true, force: true });
    }
  });

  it('keeps checkpoint prefixes slot-local while projecting the latest strict checkpoint', async () => {
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint(
          'planner_browser_trace_baseline',
          'not_started',
          'planner',
          'browser',
        ),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_trace_baseline', 'not_started'),
      );
      const dispatch = journal.appendCheckpoint(
        v11Checkpoint('review_api_dispatch', 'indeterminate'),
      );
      expect(journal.latestCheckpoint()).toEqual(dispatch);
      ledger.recordFailure(
        journal.issueFailureAuthority(),
        v11Failure({
          checkpoint: 'review_api_dispatch',
          providerCallState: 'indeterminate',
        }),
      );
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toMatchObject({
      status: 'operation_failed',
      checkpoint: 'review_api_dispatch',
      providerCallState: 'indeterminate',
    });
  });

  it('allows one V11 reservation and shares the global runtime owner lease with V8/V10', async () => {
    const v11 = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(v11.status).toBe('acquired');
    if (v11.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        acquireReviewPlannerV11ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'main',
          role: 'recovery',
        }),
      ).resolves.toEqual({ status: 'owner_active' });
      await expect(
        acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'product',
        }),
      ).resolves.toEqual({ status: 'owner_active' });
      await expect(
        acquireReviewPlannerV8ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'main',
          role: 'recovery',
          profile: REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
        }),
      ).resolves.toEqual({ status: 'owner_active' });
      const first = await reserveReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: v11.owner,
      });
      try {
        await expect(
          reserveReviewPlannerV11ProductAcceptanceLedger({
            repoRoot: root,
            environment: 'branch',
            owner: v11.owner,
          }),
        ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
      } finally {
        first.close();
      }
    } finally {
      v11.owner.close();
    }
  });

  it('rejects a V11 private recovery junction without writing outside the repo', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'prepmind-v11-outside-'));
    const recoveryPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        'branch',
      ),
    );
    await mkdir(join(recoveryPath, '..'), { recursive: true });
    await symlink(outside, recoveryPath, 'junction');
    try {
      await expect(
        acquireReviewPlannerV11ProductAcceptanceOwner({
          repoRoot: root,
          environment: 'branch',
          role: 'product',
        }),
      ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_OWNER_IO');
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('recovers a hard-exited dispatch checkpoint without a second terminal', async () => {
    const child = runV11DispatchHardExitChild(root);
    expect({ status: child.status, stderr: child.stderr }).toEqual({
      status: 77,
      stderr: '',
    });
    const reservationPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
      '.acceptance-reserved',
    );
    await expect(readFile(reservationPath, 'utf8')).resolves.toMatch(
      /^[a-f0-9]{64}\n$/,
    );
    const privateAttempt = JSON.parse(
      await readFile(
        join(
          root,
          ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
            'branch',
          ),
          'attempt-binding.json',
        ),
        'utf8',
      ),
    ) as Record<string, unknown>;
    expect(Object.keys(privateAttempt).sort()).toEqual([
      'attemptId',
      'attemptSha256',
      'schemaVersion',
    ]);
    expect(privateAttempt.attemptId).toMatch(/^[a-f0-9]{64}$/);
    expect(privateAttempt.attemptSha256).toBe(
      (await readFile(reservationPath, 'utf8')).trim(),
    );
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(acquisition.status).toBe('acquired');
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const journal = await openReviewPlannerV11ProductAcceptanceRecoveryJournal({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    const ledger = await openReviewPlannerV11ProductAcceptanceRecoveryLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    const failurePath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
      '.failure.json',
    );
    try {
      expect(journal.latestCheckpoint()).toMatchObject({
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_dispatch',
        providerCallState: 'indeterminate',
      });
      journal.projectRecoveryOnly(ledger);
      const firstTerminal = await readFile(failurePath, 'utf8');
      journal.projectRecoveryOnly(ledger);
      await expect(readFile(failurePath, 'utf8')).resolves.toBe(firstTerminal);
      // Task4 owns injected external-call spies and runtime cleanup validation.
    } finally {
      ledger.close();
      journal.close();
      acquisition.owner.close();
    }
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toMatchObject({
      status: 'operation_failed',
      checkpoint: 'review_api_dispatch',
      providerCallState: 'indeterminate',
    });
  });

  it('fails closed for malformed private checkpoints during recovery', async () => {
    const child = runV11DispatchHardExitChild(root);
    expect(child.status).toBe(77);
    const recoveryPath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
        'branch',
      ),
    );
    await writeFile(
      join(recoveryPath, 'checkpoint-004-review_api_dispatch.json'),
      '{not-json}\n',
    );
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const journal = await openReviewPlannerV11ProductAcceptanceRecoveryJournal({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    const ledger = await openReviewPlannerV11ProductAcceptanceRecoveryLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    try {
      expect(() => journal.projectRecoveryOnly(ledger)).toThrow(
        'V11_PRODUCT_ACCEPTANCE_RECOVERY_EVIDENCE_IO',
      );
    } finally {
      ledger.close();
      journal.close();
      acquisition.owner.close();
    }
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('leaves no V11 public failure leaf when durable failure publication faults after a checkpoint', async () => {
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    let renameCalls = 0;
    const ledger = await reserveReviewPlannerV11ProductAcceptanceLedgerForTests(
      {
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
        injector: (stage: DurableFaultStage) =>
          stage === 'rename' && ++renameCalls === 2,
      },
    );
    const journal =
      await prepareReviewPlannerV11ProductAcceptanceRecoveryJournal({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      expect(() =>
        ledger.recordFailure(journal.issueFailureAuthority(), v11Failure()),
      ).toThrow('V11_PRODUCT_ACCEPTANCE_EVIDENCE_IO');
    } finally {
      ledger.close();
      journal.close();
      acquisition.owner.close();
    }
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    await expect(
      readdir(
        join(
          root,
          ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
            'branch',
          ),
        ),
      ),
    ).resolves.toEqual(['.acceptance-reserved', '.failure.json.prepare']);
  });

  it('refuses a conflicting V11 public terminal without replacing it', async () => {
    const child = runV11DispatchHardExitChild(root);
    expect(child.status).toBe(77);
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const journal = await openReviewPlannerV11ProductAcceptanceRecoveryJournal({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    const firstLedger =
      await openReviewPlannerV11ProductAcceptanceRecoveryLedger({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });
    const failurePath = join(
      root,
      ...REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
      '.failure.json',
    );
    try {
      journal.projectRecoveryOnly(firstLedger);
    } finally {
      firstLedger.close();
    }
    const conflict = v11Failure({
      checkpoint: 'review_api_trace_baseline',
      providerCallState: 'not_started',
    });
    await writeFile(failurePath, `${JSON.stringify(conflict)}\n`);
    const conflictingLedger =
      await openReviewPlannerV11ProductAcceptanceRecoveryLedger({
        repoRoot: root,
        environment: 'branch',
        owner: acquisition.owner,
      });
    try {
      expect(() => journal.projectRecoveryOnly(conflictingLedger)).toThrow(
        'V11_PRODUCT_ACCEPTANCE_RECORD_INVALID',
      );
      await expect(readFile(failurePath, 'utf8')).resolves.toBe(
        `${JSON.stringify(conflict)}\n`,
      );
    } finally {
      conflictingLedger.close();
      journal.close();
      acquisition.owner.close();
    }
    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

  it('does not alter V8 or V10 ledger behavior', async () => {
    await finishBranch(root);
    const { owner, ledger, journal } = await prepareV11Journal(root);
    try {
      journal.appendCheckpoint(
        v11Checkpoint('review_api_activate', 'not_started'),
      );
      journal.appendCheckpoint(
        v11Checkpoint('review_api_facts_before', 'not_started'),
      );
      ledger.recordFailure(journal.issueFailureAuthority(), v11Failure());
    } finally {
      ledger.close();
      journal.close();
      owner.close();
    }

    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toMatchObject({ status: 'complete' });
    expect(
      REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    ).not.toBe(
      REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerPath('branch'),
    );
  });

  it('fails closed for a partial V11 reservation without a public failure projection', async () => {
    const acquisition = await acquireReviewPlannerV11ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    if (acquisition.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV11ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquisition.owner,
    });
    ledger.close();
    acquisition.owner.close();

    await expect(
      readReviewPlannerV11ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'incomplete' });
  });

  it('keeps V8/V10 evidence bytes readable and fails closed for a V11 failure leaf', async () => {
    await finishBranch(root);
    const v8Path = join(
      root,
      ...REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
        'branch',
      ),
    );
    const v8Acceptance = await readFile(
      join(v8Path, 'acceptance.json'),
      'utf8',
    );
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toMatchObject({ status: 'complete' });

    const v10 = REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE;
    await finishBranch(root, 100, 50, PLAN_PNG, TODAY_PNG, v10);
    const v10Path = join(root, ...v10.publicLedgerSegments('branch'));
    const v10Acceptance = await readFile(
      join(v10Path, 'acceptance.json'),
      'utf8',
    );
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        profile: v10,
      }),
    ).resolves.toMatchObject({ status: 'complete' });

    await writeFile(join(v8Path, '.failure.json'), '{}\n');
    await writeFile(join(v10Path, '.failure.json'), '{}\n');
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        profile: v10,
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    await expect(
      readFile(join(v8Path, 'acceptance.json'), 'utf8'),
    ).resolves.toBe(v8Acceptance);
    await expect(
      readFile(join(v10Path, 'acceptance.json'), 'utf8'),
    ).resolves.toBe(v10Acceptance);
  });
});
