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
  finalizeReviewPlannerV13ProductAcceptanceRecovery,
  readReviewPlannerV13ProductAcceptanceLedger,
  reserveReviewPlannerV13ProductAcceptanceLedger,
} from './review-planner-v13-product-acceptance-ledger';
import {
  acquireReviewPlannerV13ProductAcceptanceOwner,
  inspectReviewPlannerV13ProductAcceptanceRecoveryCheckpoint,
  openReviewPlannerV13ProductAcceptanceRecoveryJournal,
  prepareReviewPlannerV13ProductAcceptanceRecoveryJournal,
} from './review-planner-v13-product-acceptance-recovery';
import {
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

const afterEach = bunAfterEach as unknown as jest.Lifecycle;
const beforeEach = bunBeforeEach as unknown as jest.Lifecycle;
const describe = bunDescribe as unknown as jest.Describe;
const expect = bunExpect as unknown as jest.Expect;
const it = bunIt as unknown as jest.It;
const describeWindows = process.platform === 'win32' ? describe : describe.skip;

describeWindows('Review/Planner V13 durable product acceptance ledger', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-v13-ledger-'));
    await mkdir(join(root, 'docs', 'acceptance', 'evidence'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('creates one V13-only reservation whose public, binding, and private execution hashes agree', async () => {
    const state = await prepareEarliestV13State(root);

    await expect(
      readReviewPlannerV13ProductAcceptanceLedger({
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

  it('permits only one V13 reservation even after the first owner releases its private lock', async () => {
    const state = await prepareEarliestV13State(root);
    const next = await acquireReviewPlannerV13ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(next.status).toBe('acquired');
    if (next.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        reserveReviewPlannerV13ProductAcceptanceLedger({
          repoRoot: root,
          environment: 'branch',
          owner: next.owner,
        }),
      ).rejects.toThrow('V13_PRODUCT_ACCEPTANCE_ALREADY_RESERVED');
    } finally {
      next.owner.close();
    }
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('admits the strict earliest V13 state with no checkpoint for recovery', async () => {
    const state = await prepareEarliestV13State(root);
    const owner = await acquireReviewPlannerV13ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(owner.status).toBe('acquired');
    if (owner.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        inspectReviewPlannerV13ProductAcceptanceRecoveryCheckpoint({
          repoRoot: root,
          environment: 'branch',
        }),
      ).resolves.toBeNull();
      const journal =
        await openReviewPlannerV13ProductAcceptanceRecoveryJournal({
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
    const publicRoot = join(root, ...v13PublicSegments('branch'));
    await mkdir(publicRoot, { recursive: true });
    await writeFile(
      join(publicRoot, '.acceptance-reserved'),
      `${'a'.repeat(64)}\n`,
    );
    await expect(
      readReviewPlannerV13ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });

    await rm(publicRoot, { recursive: true, force: true });
    const state = await prepareEarliestV13State(root);
    await writeFile(
      join(
        root,
        ...v13RecoverySegments('branch'),
        'checkpoint-001-review_api_activate.json',
      ),
      '{"invalid":true}\n',
    );
    await expect(
      readReviewPlannerV13ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });

    expect(state.attemptSha256).toHaveLength(64);
  });

  it('fails closed for a V11 manifest injected into a V13 reservation', async () => {
    const state = await prepareEarliestV13State(root);
    const publicRoot = join(root, ...v13PublicSegments('branch'));
    await writeFile(
      join(publicRoot, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-manifest-v1',
        environment: 'branch',
        attemptSha256: state.attemptSha256,
      }) + '\n',
    );
    await expect(
      readReviewPlannerV13ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('seals exactly four V13 slots and leaves V11/V12 root bytes untouched', async () => {
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

    const acquired = await acquireReviewPlannerV13ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'product',
    });
    expect(acquired.status).toBe('acquired');
    if (acquired.status !== 'acquired') throw new Error('owner unavailable');
    const ledger = await reserveReviewPlannerV13ProductAcceptanceLedger({
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
        schemaVersion: 'phase-6.9.5-v13-product-acceptance-manifest-v1',
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
          schemaVersion: 'phase-6.9.5-v13-product-acceptance-slot-result-v1',
          slot,
          traceSha256,
        });
      }
      for (const component of ['review', 'planner'] as const) {
        ledger.recordDefaultOff({
          schemaVersion: 'phase-6.9.5-v13-product-acceptance-default-off-v1',
          component,
          providerInvocations: 0,
          gates: {
            liveCallsEnabled: false,
            reviewAgentModelEnabled: false,
            plannerAgentModelEnabled: false,
          },
        });
      }
      ledger.recordOwnerIsolation({
        schemaVersion: 'phase-6.9.5-v13-product-acceptance-owner-isolation-v1',
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
        schemaVersion: 'phase-6.9.5-v13-product-acceptance-cleanup-v1',
        syntheticAccounts: 0,
        fixtures: 0,
        traces: 0,
        browserProfiles: 0,
        capabilities: 0,
      });
      await ledger.finalizeSuccess({
        schemaVersion: 'phase-6.9.5-v13-product-acceptance-aggregate-v1',
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
      readReviewPlannerV13ProductAcceptanceLedger({
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
  });

  it('seals recovery exactly once and rejects a second recovery owner', async () => {
    const state = await prepareFailedV13State(root);
    const recovery = await acquireReviewPlannerV13ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(recovery.status).toBe('acquired');
    if (recovery.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await finalizeReviewPlannerV13ProductAcceptanceRecovery({
        repoRoot: root,
        environment: 'branch',
        owner: recovery.owner,
      });
    } finally {
      recovery.owner.close();
    }

    await expect(
      readReviewPlannerV13ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'recovered' });
    const second = await acquireReviewPlannerV13ProductAcceptanceOwner({
      repoRoot: root,
      environment: 'branch',
      role: 'recovery',
    });
    expect(second.status).toBe('acquired');
    if (second.status !== 'acquired') throw new Error('owner unavailable');
    try {
      await expect(
        finalizeReviewPlannerV13ProductAcceptanceRecovery({
          repoRoot: root,
          environment: 'branch',
          owner: second.owner,
        }),
      ).rejects.toThrow('V13_PRODUCT_ACCEPTANCE_RECOVERY_NOT_AUTHORIZED');
    } finally {
      second.owner.close();
    }
    expect(state.attemptSha256).toHaveLength(64);
  });

  it('fails closed when a failure terminal disagrees with its attempt-bound latest checkpoint', async () => {
    await prepareFailedV13State(root);
    await writeFile(
      join(root, ...v13PublicSegments('branch'), 'failure.json'),
      JSON.stringify({
        schemaVersion: 'phase-6.9.5-v13-product-acceptance-failure-v1',
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
      readReviewPlannerV13ProductAcceptanceLedger({
        repoRoot: root,
        environment: 'branch',
      }),
    ).resolves.toEqual({ status: 'evidence_io' });
  });
});

async function prepareEarliestV13State(root: string) {
  const acquired = await acquireReviewPlannerV13ProductAcceptanceOwner({
    repoRoot: root,
    environment: 'branch',
    role: 'product',
  });
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  const ledger = await reserveReviewPlannerV13ProductAcceptanceLedger({
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
      schemaVersion: 'phase-6.9.5-v13-product-acceptance-manifest-v1',
      environment: 'branch',
      attemptSha256,
    });
  } finally {
    ledger.close();
    acquired.owner.close();
  }
  return { attemptSha256 };
}

async function prepareFailedV13State(root: string) {
  const acquired = await acquireReviewPlannerV13ProductAcceptanceOwner({
    repoRoot: root,
    environment: 'branch',
    role: 'product',
  });
  if (acquired.status !== 'acquired') throw new Error('owner unavailable');
  const ledger = await reserveReviewPlannerV13ProductAcceptanceLedger({
    repoRoot: root,
    environment: 'branch',
    owner: acquired.owner,
  });
  const attemptSha256 = ledger.attemptSha256();
  let journal:
    | Awaited<
        ReturnType<
          typeof prepareReviewPlannerV13ProductAcceptanceRecoveryJournal
        >
      >
    | undefined;
  try {
    await ledger.writeExecutionManifest(
      executionManifest('branch', attemptSha256),
    );
    ledger.writeManifest({
      schemaVersion: 'phase-6.9.5-v13-product-acceptance-manifest-v1',
      environment: 'branch',
      attemptSha256,
    });
    journal = await prepareReviewPlannerV13ProductAcceptanceRecoveryJournal({
      repoRoot: root,
      environment: 'branch',
      owner: acquired.owner,
    });
    journal.appendCheckpoint({
      schemaVersion: 'phase-6.9.5-v13-product-acceptance-checkpoint-v1',
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_setup',
      providerCallState: 'not_started',
    });
    ledger.recordFailure({
      schemaVersion: 'phase-6.9.5-v13-product-acceptance-failure-v1',
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

function v13PublicSegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.publicLedgerSegments(
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

function v13RecoverySegments(environment: 'branch' | 'main') {
  return REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.recoverySegments(
    environment,
  );
}

function executionManifest(
  environment: 'branch' | 'main',
  attemptSha256: string,
) {
  return {
    schemaVersion: 'phase-6.9.5-v13-product-acceptance-execution-manifest-v1',
    environment,
    attemptSha256,
    databaseUrlSha256: 'e'.repeat(64),
    resources: {
      accountId: {
        review: `v13-synthetic-account-review-${'a'.repeat(32)}`,
        planner: `v13-synthetic-account-planner-${'b'.repeat(32)}`,
      },
      fixtureId: {
        review: `v13-synthetic-fixture-review-${'c'.repeat(32)}`,
        planner: `v13-synthetic-fixture-planner-${'d'.repeat(32)}`,
      },
      browser: {
        executablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        profilePath:
          REVIEW_PLANNER_V13_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            environment,
          ),
      },
    },
  };
}
