import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  readReviewPlannerV8ProductAcceptanceLedger,
  reserveReviewPlannerV8ProductAcceptanceLedger,
} from './review-planner-v8-product-acceptance-ledger';
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

function manifest(environment: 'branch' | 'main' = 'branch') {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-manifest-v1',
    environment,
    commitSha: COMMIT_A,
    pairedEvidenceSha256: SHA_A,
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
    ...(browser ? { screenshotSha256: SHA_D } : {}),
  } as const;
}

function restoreReceipt(component: 'review' | 'planner') {
  return {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v1',
    component,
    reviewAgentModelEnabled: false,
    plannerAgentModelEnabled: false,
    acceptanceEnabled: false,
    capabilityPresent: false,
    providerMode: 'mock',
    liveCallsEnabled: false,
    deterministicProbePassed: true,
    containerIdSha256: SHA_A,
  } as const;
}

async function createRoot() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-v8-ledger-'));
  await mkdir(join(root, 'docs', 'acceptance', 'evidence'), {
    recursive: true,
  });
  return root;
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

async function finishBranch(root: string) {
  const { owner, ledger } = await prepareReserved(root);
  ledger.claimSlot('review-api');
  ledger.recordSlotResult(slotResult('review-api', SHA_A));
  ledger.claimSlot('review-browser');
  ledger.recordDefaultOff(restoreReceipt('review'));
  ledger.recordSlotResult(slotResult('review-browser', SHA_B));
  ledger.claimSlot('planner-api');
  ledger.recordSlotResult(slotResult('planner-api', SHA_C));
  ledger.claimSlot('planner-browser');
  ledger.recordDefaultOff(restoreReceipt('planner'));
  ledger.recordSlotResult(slotResult('planner-browser', SHA_D));
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

  it('rejects duplicate trace ids, schema extras, and per-slot budget overflow', async () => {
    const { owner, ledger } = await prepareReserved(root);
    ledger.claimSlot('review-api');
    ledger.recordSlotResult(slotResult('review-api', SHA_A));
    ledger.claimSlot('review-browser');
    ledger.recordDefaultOff(restoreReceipt('review'));
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
        containerIdSha256: SHA_B,
      })}\n`,
    );
    await expect(
      readReviewPlannerV8ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });

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
    ).rejects.toThrow('WINDOWS_REPARSE_POINT_BLOCKED');
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
          schemaVersion:
            'phase-6.9.5-v8-product-acceptance-recovery-restore-v1',
          reviewAgentModelEnabled: false,
          plannerAgentModelEnabled: false,
          acceptanceEnabled: false,
          capabilityPresent: false,
          providerMode: 'mock',
          liveCallsEnabled: false,
          deterministicProbePassed: true,
          containerIdSha256: SHA_A,
          providerInvocations: 0,
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
  },
);
