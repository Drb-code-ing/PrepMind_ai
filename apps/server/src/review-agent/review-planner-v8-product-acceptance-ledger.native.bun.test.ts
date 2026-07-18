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
  readReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedgerForTests,
} from './review-planner-v8-product-acceptance-ledger';
import type { DurableFaultStage } from './windows-reparse-safe-relative-io';
import {
  acquireReviewPlannerV8ProductAcceptanceOwner,
  openReviewPlannerV8ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV8ProductAcceptanceRecoveryJournal,
} from './review-planner-v8-product-acceptance-recovery';

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
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-slot-result-v1',
    slot,
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    usage: { inputTokens, outputTokens },
    durationMs: 1_000,
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
) {
  const acquired = await acquireReviewPlannerV8ProductAcceptanceOwner({
    repoRoot: root,
    environment,
    role: 'product',
  });
  expect(acquired.status).toBe('acquired');
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  return acquired.owner;
}

async function prepareReserved(root: string, keepJournal = false) {
  const owner = await acquire(root);
  const ledger = await reserveReviewPlannerV8ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner,
  });
  const journal = await prepareReviewPlannerV8ProductAcceptanceRecoveryJournal({
    repoRoot: root,
    environment: 'branch',
    owner,
    manifest: recoveryManifest(),
  });
  ledger.writeManifest(manifest());
  if (!keepJournal) journal.close();
  return { owner, ledger, journal };
}

async function finishBranch(
  root: string,
  inputTokens = 100,
  outputTokens = 50,
  planPng = PLAN_PNG,
  todayPng = TODAY_PNG,
) {
  const { owner, ledger } = await prepareReserved(root);
  ledger.claimSlot('review-api');
  ledger.recordSlotResult(
    slotResult('review-api', SHA_A, inputTokens, outputTokens),
  );
  ledger.claimSlot('review-browser');
  ledger.recordDefaultOff(restoreReceipt('review'));
  ledger.recordScreenshot('review', planPng);
  ledger.recordSlotResult(
    slotResult(
      'review-browser',
      SHA_B,
      inputTokens,
      outputTokens,
      createHash('sha256').update(planPng).digest('hex'),
    ),
  );
  ledger.claimSlot('planner-api');
  ledger.recordSlotResult(
    slotResult('planner-api', SHA_C, inputTokens, outputTokens),
  );
  ledger.claimSlot('planner-browser');
  ledger.recordDefaultOff(restoreReceipt('planner'));
  ledger.recordScreenshot('planner', todayPng);
  ledger.recordSlotResult(
    slotResult(
      'planner-browser',
      SHA_D,
      inputTokens,
      outputTokens,
      createHash('sha256').update(todayPng).digest('hex'),
    ),
  );
  ledger.recordOwnerIsolation({
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-owner-isolation-v1',
    reviewFactsBeforeSha256: SHA_A,
    reviewFactsAfterSha256: SHA_A,
    plannerFactsBeforeSha256: SHA_B,
    plannerFactsAfterSha256: SHA_B,
    traceIdSha256: [SHA_A, SHA_B, SHA_C, SHA_D],
    crossAccountInvisible: true,
    businessWrites: 0,
  });
  ledger.recordCleanup({
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-cleanup-v1',
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
          environment: 'branch',
          role: 'recovery',
        }),
      ).toEqual({ status: 'owner_active' });
      child.kill();
      await new Promise<void>((resolveExit) =>
        child.once('exit', () => resolveExit()),
      );
      const recovered = await acquireReviewPlannerV8ProductAcceptanceOwner({
        repoRoot: root,
        environment: 'branch',
        role: 'recovery',
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
