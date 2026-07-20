import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// prettier-ignore
// @ts-expect-error Bun resolves this native-test-only module at test runtime.
import { afterEach as bunAfterEach, beforeEach as bunBeforeEach, describe as bunDescribe, expect as bunExpect, it as bunIt } from 'bun:test';

import {
  finalizeReviewPlannerV16ProductAcceptanceRecovery,
  readReviewPlannerV16ProductAcceptanceLedger,
  reserveReviewPlannerV16ProductAcceptanceLedger,
} from './review-planner-v16-product-acceptance-ledger';
import {
  acquireReviewPlannerV16ProductAcceptanceOwner,
  inspectReviewPlannerV16ProductAcceptanceRecoveryCheckpoint,
  openReviewPlannerV16ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV16ProductAcceptanceRecoveryJournal,
} from './review-planner-v16-product-acceptance-recovery';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

const afterEach = bunAfterEach as unknown as jest.Lifecycle;
const beforeEach = bunBeforeEach as unknown as jest.Lifecycle;
const describe = bunDescribe as unknown as jest.Describe;
const expect = bunExpect as unknown as jest.Expect;
const it = bunIt as unknown as jest.It;
const describeWindows = process.platform === 'win32' ? describe : describe.skip;

describeWindows('Review/Planner V16 durable product acceptance ledger', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-v16-ledger-'));
    await mkdir(join(root, 'docs', 'acceptance', 'evidence'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('creates one V16-only reservation whose public, binding, and private execution hashes agree', async () => {
    const state = await prepareEarliestV16State(root);

    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'incomplete' });
    await expect(
      readdir(join(root, ...v11PublicSegments('branch'))),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readdir(join(root, ...v11RecoverySegments('branch'))),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(state.attemptSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('permits only one V16 reservation even after the first owner releases its private lock', async () => {
    const state = await prepareEarliestV16State(root);
    const next = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(next.status).toBe('acquired');
    if (next.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        reserveReviewPlannerV16ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
          owner: next.owner,
        }),
      ).rejects.toThrow('V16_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    } finally {
      next.owner.close();
    }
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('rolls back a verified unstarted reservation so a fresh V16 reservation can be created', async () => {
    const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquired.status).toBe('acquired');
    if (acquired.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    const attemptSha256 = ledger.attemptSha256();
    try {
      await ledger.writeExecutionManifest(
        executionManifest('branch', attemptSha256),
      );
      ledger.writeManifest({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256,
      });

      await ledger.rollbackUnstartedReservation();
    } finally {
      ledger.close();
      acquired.owner.close();
    }

    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'empty' });

    const fresh = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(fresh.status).toBe('acquired');
    if (fresh.status !== 'acquired') throw new Error('owner unavailable');
    try {
      const next = await reserveReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
        owner: fresh.owner,
      });
      next.close();
    } finally {
      fresh.owner.close();
    }
  });

  it('admits the strict earliest V16 state with no checkpoint for recovery', async () => {
    const state = await prepareEarliestV16State(root);
    const owner = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(owner.status).toBe('acquired');
    if (owner.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        inspectReviewPlannerV16ProductAcceptanceRecoveryCheckpoint({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toBeNull();
      const journal =
        await openReviewPlannerV16ProductAcceptanceRecoveryJournal({
          repoRoot: root,
          environment: 'branch',
          owner: owner.owner,
        });
      try {
        expect(journal.attemptSha256()).toBe(state.attemptSha256);
        expect(journal.latestCheckpoint()).toBeNull();
      } finally {
        journal.close();
      }
    } finally {
      owner.owner.close();
    }
  });

  it('fails closed for a bare reservation and a malformed checkpoint', async () => {
    const publicRoot = join(root, ...v16PublicSegments('branch'));
    await mkdir(publicRoot, { recursive: true });
    await writeFile(
      join(publicRoot, '.acceptance-reserved'),
      `${'a'.repeat(64)}\n`,
    );
    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });

    await rm(publicRoot, { recursive: true, force: true });
    const state = await prepareEarliestV16State(root);
    await writeFile(
      join(
        root,
        ...v16RecoverySegments('branch'),
        'checkpoint-001-review_api_activate.json',
      ),
      '{"invalid":true}\n',
    );
    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });

    expect(state.attemptSha256).toHaveLength(64);
  });

  it('fails closed for a V11 manifest injected into a V16 reservation', async () => {
    const state = await prepareEarliestV16State(root);
    const publicRoot = join(root, ...v16PublicSegments('branch'));
    await writeFile(
      join(publicRoot, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256: state.attemptSha256,
      }) + '\n',
    );
    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('seals exactly four V16 slots and leaves V11/V12/V13/V14/V15 root bytes untouched', async () => {
    const v11Root = join(root, ...v11PublicSegments('branch'));
    await mkdir(v11Root, { recursive: true });
    await writeFile(join(v11Root, 'v11-immutable.txt'), 'immutable-v11\n');
    const before = createHash('sha256')
      .update(await readFile(join(v11Root, 'v11-immutable.txt')))
      .digest('hex');
    const v11RecoveryRoot = join(root, ...v11RecoverySegments('branch'));
    await mkdir(v11RecoveryRoot, { recursive: true });
    await writeFile(
      join(v11RecoveryRoot, 'v11-recovery-immutable.txt'),
      'v11-recovery\n',
    );
    const recoveryBefore = createHash('sha256')
      .update(
        await readFile(join(v11RecoveryRoot, 'v11-recovery-immutable.txt')),
      )
      .digest('hex');
    const v11ExecutionRoot = join(root, ...v11ExecutionSegments('branch'));
    await mkdir(v11ExecutionRoot, { recursive: true });
    await writeFile(
      join(v11ExecutionRoot, 'v11-execution-immutable.txt'),
      'v11-execution\n',
    );
    const v11ExecutionBefore = createHash('sha256')
      .update(
        await readFile(join(v11ExecutionRoot, 'v11-execution-immutable.txt')),
      )
      .digest('hex');
    const v12Root = join(root, ...v12PublicSegments('branch'));
    await mkdir(v12Root, { recursive: true });
    await writeFile(join(v12Root, 'v12-immutable.txt'), 'immutable-v12\n');
    const v12Before = createHash('sha256')
      .update(await readFile(join(v12Root, 'v12-immutable.txt')))
      .digest('hex');
    const v12RecoveryRoot = join(root, ...v12RecoverySegments('branch'));
    await mkdir(v12RecoveryRoot, { recursive: true });
    await writeFile(
      join(v12RecoveryRoot, 'v12-recovery-immutable.txt'),
      'v12-recovery\n',
    );
    const v12RecoveryBefore = createHash('sha256')
      .update(
        await readFile(join(v12RecoveryRoot, 'v12-recovery-immutable.txt')),
      )
      .digest('hex');
    const v12ExecutionRoot = join(root, ...v12ExecutionSegments('branch'));
    await mkdir(v12ExecutionRoot, { recursive: true });
    await writeFile(
      join(v12ExecutionRoot, 'v12-execution-immutable.txt'),
      'v12-execution\n',
    );
    const v12ExecutionBefore = createHash('sha256')
      .update(
        await readFile(join(v12ExecutionRoot, 'v12-execution-immutable.txt')),
      )
      .digest('hex');
    const v13Root = join(root, ...v13PublicSegments('branch'));
    await mkdir(v13Root, { recursive: true });
    await writeFile(join(v13Root, 'v13-immutable.txt'), 'immutable-v13\n');
    const v13Before = createHash('sha256')
      .update(await readFile(join(v13Root, 'v13-immutable.txt')))
      .digest('hex');
    const v13RecoveryRoot = join(root, ...v13RecoverySegments('branch'));
    await mkdir(v13RecoveryRoot, { recursive: true });
    await writeFile(
      join(v13RecoveryRoot, 'v13-recovery-immutable.txt'),
      'v13-recovery\n',
    );
    const v13RecoveryBefore = createHash('sha256')
      .update(
        await readFile(join(v13RecoveryRoot, 'v13-recovery-immutable.txt')),
      )
      .digest('hex');
    const v13ExecutionRoot = join(root, ...v13ExecutionSegments('branch'));
    await mkdir(v13ExecutionRoot, { recursive: true });
    await writeFile(
      join(v13ExecutionRoot, 'v13-execution-immutable.txt'),
      'v13-execution\n',
    );
    const v13ExecutionBefore = createHash('sha256')
      .update(
        await readFile(join(v13ExecutionRoot, 'v13-execution-immutable.txt')),
      )
      .digest('hex');
    const v14Root = join(root, ...v14PublicSegments('branch'));
    await mkdir(v14Root, { recursive: true });
    await writeFile(join(v14Root, 'v14-immutable.txt'), 'immutable-v14\n');
    const v14Before = createHash('sha256')
      .update(await readFile(join(v14Root, 'v14-immutable.txt')))
      .digest('hex');
    const v14RecoveryRoot = join(root, ...v14RecoverySegments('branch'));
    await mkdir(v14RecoveryRoot, { recursive: true });
    await writeFile(
      join(v14RecoveryRoot, 'v14-recovery-immutable.txt'),
      'v14-recovery\n',
    );
    const v14RecoveryBefore = createHash('sha256')
      .update(
        await readFile(join(v14RecoveryRoot, 'v14-recovery-immutable.txt')),
      )
      .digest('hex');
    const v14ExecutionRoot = join(root, ...v14ExecutionSegments('branch'));
    await mkdir(v14ExecutionRoot, { recursive: true });
    await writeFile(
      join(v14ExecutionRoot, 'v14-execution-immutable.txt'),
      'v14-execution\n',
    );
    const v14ExecutionBefore = createHash('sha256')
      .update(
        await readFile(join(v14ExecutionRoot, 'v14-execution-immutable.txt')),
      )
      .digest('hex');
    const v15Root = join(root, ...v15PublicSegments('branch'));
    await mkdir(v15Root, { recursive: true });
    await writeFile(join(v15Root, 'v15-immutable.txt'), 'immutable-v15\n');
    const v15Before = createHash('sha256')
      .update(await readFile(join(v15Root, 'v15-immutable.txt')))
      .digest('hex');
    const v15RecoveryRoot = join(root, ...v15RecoverySegments('branch'));
    await mkdir(v15RecoveryRoot, { recursive: true });
    await writeFile(
      join(v15RecoveryRoot, 'v15-recovery-immutable.txt'),
      'v15-recovery\n',
    );
    const v15RecoveryBefore = createHash('sha256')
      .update(
        await readFile(join(v15RecoveryRoot, 'v15-recovery-immutable.txt')),
      )
      .digest('hex');
    const v15ExecutionRoot = join(root, ...v15ExecutionSegments('branch'));
    await mkdir(v15ExecutionRoot, { recursive: true });
    await writeFile(
      join(v15ExecutionRoot, 'v15-execution-immutable.txt'),
      'v15-execution\n',
    );
    const v15ExecutionBefore = createHash('sha256')
      .update(
        await readFile(join(v15ExecutionRoot, 'v15-execution-immutable.txt')),
      )
      .digest('hex');

    const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquired.status).toBe('acquired');
    if (acquired.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    const attemptSha256 = ledger.attemptSha256();
    try {
      await ledger.writeExecutionManifest(
        executionManifest('branch', attemptSha256),
      );
      ledger.writeManifest({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256,
      });
      for (const [slot, traceSha256] of [
        ['review-api', 'a'.repeat(64)],
        ['review-browser', 'b'.repeat(64)],
        ['planner-api', 'c'.repeat(64)],
        ['planner-browser', 'd'.repeat(64)],
      ] as const) {
        ledger.claimSlot(slot);
        ledger.recordSlotResult({
          schemaVersion: 'phase-6.9.5-v16-product-acceptance-slot-result-v1',
          slot,
          traceSha256,
        });
      }
      for (const component of ['review', 'planner'] as const) {
        ledger.recordDefaultOff(defaultOffReceipt(component));
      }
      ledger.recordOwnerIsolation({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-owner-isolation-v1',
        crossAccountInvisible: true,
        businessWrites: 0,
        traceSha256: [
          'a'.repeat(64),
          'b'.repeat(64),
          'c'.repeat(64),
          'd'.repeat(64),
        ],
      });
      ledger.recordCleanup({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-cleanup-v1',
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      });
      await ledger.finalizeSuccess({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-aggregate-v1',
        environment: 'branch',
        attemptSha256,
        requests: 4,
        durationMs: 4_000,
      });
    } finally {
      ledger.close();
      acquired.owner.close();
    }

    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'complete' });
    const after = createHash('sha256')
      .update(await readFile(join(v11Root, 'v11-immutable.txt')))
      .digest('hex');
    expect(after).toBe(before);
    const recoveryAfter = createHash('sha256')
      .update(
        await readFile(join(v11RecoveryRoot, 'v11-recovery-immutable.txt')),
      )
      .digest('hex');
    expect(recoveryAfter).toBe(recoveryBefore);
    const v11ExecutionAfter = createHash('sha256')
      .update(
        await readFile(join(v11ExecutionRoot, 'v11-execution-immutable.txt')),
      )
      .digest('hex');
    expect(v11ExecutionAfter).toBe(v11ExecutionBefore);
    const v12After = createHash('sha256')
      .update(await readFile(join(v12Root, 'v12-immutable.txt')))
      .digest('hex');
    expect(v12After).toBe(v12Before);
    const v12RecoveryAfter = createHash('sha256')
      .update(
        await readFile(join(v12RecoveryRoot, 'v12-recovery-immutable.txt')),
      )
      .digest('hex');
    expect(v12RecoveryAfter).toBe(v12RecoveryBefore);
    const v12ExecutionAfter = createHash('sha256')
      .update(
        await readFile(join(v12ExecutionRoot, 'v12-execution-immutable.txt')),
      )
      .digest('hex');
    expect(v12ExecutionAfter).toBe(v12ExecutionBefore);
    const v13After = createHash('sha256')
      .update(await readFile(join(v13Root, 'v13-immutable.txt')))
      .digest('hex');
    expect(v13After).toBe(v13Before);
    const v13RecoveryAfter = createHash('sha256')
      .update(
        await readFile(join(v13RecoveryRoot, 'v13-recovery-immutable.txt')),
      )
      .digest('hex');
    expect(v13RecoveryAfter).toBe(v13RecoveryBefore);
    const v13ExecutionAfter = createHash('sha256')
      .update(
        await readFile(join(v13ExecutionRoot, 'v13-execution-immutable.txt')),
      )
      .digest('hex');
    expect(v13ExecutionAfter).toBe(v13ExecutionBefore);
    const v14After = createHash('sha256')
      .update(await readFile(join(v14Root, 'v14-immutable.txt')))
      .digest('hex');
    expect(v14After).toBe(v14Before);
    const v14RecoveryAfter = createHash('sha256')
      .update(
        await readFile(join(v14RecoveryRoot, 'v14-recovery-immutable.txt')),
      )
      .digest('hex');
    expect(v14RecoveryAfter).toBe(v14RecoveryBefore);
    const v14ExecutionAfter = createHash('sha256')
      .update(
        await readFile(join(v14ExecutionRoot, 'v14-execution-immutable.txt')),
      )
      .digest('hex');
    expect(v14ExecutionAfter).toBe(v14ExecutionBefore);
    const v15After = createHash('sha256')
      .update(await readFile(join(v15Root, 'v15-immutable.txt')))
      .digest('hex');
    expect(v15After).toBe(v15Before);
    const v15RecoveryAfter = createHash('sha256')
      .update(
        await readFile(join(v15RecoveryRoot, 'v15-recovery-immutable.txt')),
      )
      .digest('hex');
    expect(v15RecoveryAfter).toBe(v15RecoveryBefore);
    const v15ExecutionAfter = createHash('sha256')
      .update(
        await readFile(join(v15ExecutionRoot, 'v15-execution-immutable.txt')),
      )
      .digest('hex');
    expect(v15ExecutionAfter).toBe(v15ExecutionBefore);
  });

  it('rejects a success terminal after a failure terminal has been written', async () => {
    const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquired.status).toBe('acquired');
    if (acquired.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    const attemptSha256 = ledger.attemptSha256();
    try {
      await ledger.writeExecutionManifest(
        executionManifest('branch', attemptSha256),
      );
      ledger.writeManifest({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256,
      });
      ledger.recordFailure({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-failure-v1',
        environment: 'branch',
        attemptSha256,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_setup',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      });
      for (const [slot, traceSha256] of [
        ['review-api', 'a'.repeat(64)],
        ['review-browser', 'b'.repeat(64)],
        ['planner-api', 'c'.repeat(64)],
        ['planner-browser', 'd'.repeat(64)],
      ] as const) {
        ledger.claimSlot(slot);
        ledger.recordSlotResult({
          schemaVersion: 'phase-6.9.5-v16-product-acceptance-slot-result-v1',
          slot,
          traceSha256,
        });
      }
      for (const component of ['review', 'planner'] as const) {
        ledger.recordDefaultOff(defaultOffReceipt(component));
      }
      ledger.recordOwnerIsolation({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-owner-isolation-v1',
        crossAccountInvisible: true,
        businessWrites: 0,
        traceSha256: [
          'a'.repeat(64),
          'b'.repeat(64),
          'c'.repeat(64),
          'd'.repeat(64),
        ],
      });
      ledger.recordCleanup({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-cleanup-v1',
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      });

      expect(() =>
        ledger.finalizeSuccess({
          schemaVersion: 'phase-6.9.5-v16-product-acceptance-aggregate-v1',
          environment: 'branch',
          attemptSha256,
          requests: 4,
          durationMs: 4_000,
        }),
      ).toThrow('V16_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    } finally {
      ledger.close();
      acquired.owner.close();
    }
  });

  it('rejects a failure terminal whose attempt hash differs from the reservation', async () => {
    const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquired.status).toBe('acquired');
    if (acquired.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    const attemptSha256 = ledger.attemptSha256();
    const differentAttemptSha256 = `${attemptSha256.slice(0, -1)}${
      attemptSha256.endsWith('0') ? '1' : '0'
    }`;
    try {
      await ledger.writeExecutionManifest(
        executionManifest('branch', attemptSha256),
      );
      ledger.writeManifest({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256,
      });

      expect(() =>
        ledger.recordFailure({
          schemaVersion: 'phase-6.9.5-v16-product-acceptance-failure-v1',
          environment: 'branch',
          attemptSha256: differentAttemptSha256,
          component: 'review',
          slot: 'api',
          checkpoint: 'review_api_setup',
          terminal: 'operation_failed',
          providerCallState: 'not_started',
        }),
      ).toThrow('V16_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    } finally {
      ledger.close();
      acquired.owner.close();
    }
  });

  it('seals recovery exactly once and rejects a second recovery owner', async () => {
    const state = await prepareFailedV16State(root);
    const recovery = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(recovery.status).toBe('acquired');
    if (recovery.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await finalizeReviewPlannerV16ProductAcceptanceRecovery({
        repoRoot: root,
        environment: 'branch',
        owner: recovery.owner,
      });
    } finally {
      recovery.owner.close();
    }

    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'recovered' });
    const second = await acquireReviewPlannerV16ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(second.status).toBe('acquired');
    if (second.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        finalizeReviewPlannerV16ProductAcceptanceRecovery({
          repoRoot: root,
          environment: 'branch',
          owner: second.owner,
        }),
      ).rejects.toThrow('V16_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    } finally {
      second.owner.close();
    }
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('fails closed when a failure terminal disagrees with its attempt-bound latest checkpoint', async () => {
    await prepareFailedV16State(root);
    await writeFile(
      join(root, ...v16PublicSegments('branch'), 'failure.json'),
      JSON.stringify({
        schemaVersion: 'phase-6.9.5-v16-product-acceptance-failure-v1',
        environment: 'branch',
        attemptSha256: 'f'.repeat(64),
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_setup',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }) + '\n',
    );

    await expect(
      readReviewPlannerV16ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });
});

async function prepareEarliestV16State(root: string) {
  const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
    repoRoot: root,
    environment: 'branch',
    role: 'product',
  });
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner: acquired.owner,
  });
  const attemptSha256 = ledger.attemptSha256();
  try {
    await ledger.writeExecutionManifest(
      executionManifest('branch', attemptSha256),
    );
    ledger.writeManifest({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
      environment: 'branch',
      attemptSha256,
    });
  } finally {
    ledger.close();
    acquired.owner.close();
  }
  return { attemptSha256 };
}

async function prepareFailedV16State(root: string) {
  const acquired = await acquireReviewPlannerV16ProductAcceptanceOwner({
    repoRoot: root,
    environment: 'branch',
    role: 'product',
  });
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  const ledger = await reserveReviewPlannerV16ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner: acquired.owner,
  });
  const attemptSha256 = ledger.attemptSha256();
  let journal:
    | Awaited<
        ReturnType<
          typeof prepareReviewPlannerV16ProductAcceptanceRecoveryJournal
        >
      >
    | undefined;
  try {
    await ledger.writeExecutionManifest(
      executionManifest('branch', attemptSha256),
    );
    ledger.writeManifest({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-manifest-v1',
      environment: 'branch',
      attemptSha256,
    });
    journal = await prepareReviewPlannerV16ProductAcceptanceRecoveryJournal({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    journal.appendCheckpoint({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-checkpoint-v1',
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_setup',
      providerCallState: 'not_started',
    });
    ledger.recordFailure({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-failure-v1',
      environment: 'branch',
      attemptSha256,
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_setup',
      terminal: 'operation_failed',
      providerCallState: 'not_started',
    });
  } finally {
    journal?.close();
    ledger.close();
    acquired.owner.close();
  }
  return { attemptSha256 };
}

function v11PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v11RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function v11ExecutionSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
    environment,
  );
}

function v16PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v15PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v15RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function v15ExecutionSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V15_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
    environment,
  );
}

function v12PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v12RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function v12ExecutionSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
    environment,
  );
}

function v13PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v13RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function v13ExecutionSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
    environment,
  );
}

function v14PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
    environment,
  );
}

function v14RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function v14ExecutionSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V14_PRODUCT_ACCEPTANCE_PROFILE.executionManifestSegments(
    environment,
  );
}

function v16RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function executionManifest(
  environment: 'branch' | 'main',
  attemptSha256: string,
) {
  return {
    schemaVersion: 'phase-6.9.5-v16-product-acceptance-execution-manifest-v1',
    environment,
    attemptSha256,
    databaseUrlSha256: 'e'.repeat(64),
    resources: {
      accountId: {
        review: `v16-synthetic-account-review-${'a'.repeat(32)}`,
        planner: `v16-synthetic-account-planner-${'b'.repeat(32)}`,
      },
      fixtureId: {
        review: `v16-synthetic-fixture-review-${'c'.repeat(32)}`,
        planner: `v16-synthetic-fixture-planner-${'d'.repeat(32)}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          REVIEW_PLANNER_V16_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            environment,
          ),
      },
    },
  };
}

function defaultOffReceipt(component: 'review' | 'planner') {
  const previousIdSha256 =
    component === 'review' ? 'a'.repeat(64) : 'c'.repeat(64);
  const newIdSha256 = component === 'review' ? 'b'.repeat(64) : 'd'.repeat(64);
  return {
    schemaVersion: 'phase-6.9.5-v16-product-acceptance-default-off-v1',
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com',
    component,
    container: { previousIdSha256, newIdSha256 },
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
    binding: { port: 3001, healthContainerIdSha256: newIdSha256 },
    deterministicProbe: {
      passed: true,
      provenance: 'local_deterministic',
    },
    providerInvocations: 0,
  };
}
