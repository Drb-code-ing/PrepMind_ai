import {
  createDefaultReviewPlannerV16ProductAcceptanceComposition,
  runReviewPlannerV16ProductAcceptanceComposition,
} from './review-planner-v16-product-acceptance-composition';

describe('Review Planner V16 default product composition', () => {
  it('keeps the unconfigured host boundary default-off before any runtime capability', async () => {
    const composition =
      createDefaultReviewPlannerV16ProductAcceptanceComposition();

    await expect(
      composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v16-default-off',
      }),
    ).resolves.toEqual({ status: 'blocked' });
  });

  it('accepts an injected V16-only ready preflight without touching a V11 boundary', async () => {
    const preflight = jest.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v16-ready',
        commitSha: 'a'.repeat(40),
        pairedEvidenceSha256: 'b'.repeat(64),
        databaseUrlSha256: 'c'.repeat(64),
        accountIdSha256: {
          review: 'c'.repeat(64),
          planner: 'd'.repeat(64),
        },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
        dependencies: {},
      }),
    );
    const create =
      createDefaultReviewPlannerV16ProductAcceptanceComposition as unknown as (
        root: string,
        options: { boundary: { preflight: typeof preflight } },
      ) => ReturnType<
        typeof createDefaultReviewPlannerV16ProductAcceptanceComposition
      >;
    const composition = create('E:\\v16-ready', {
      boundary: { preflight },
    });

    await expect(
      composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v16-ready',
      }),
    ).resolves.toMatchObject({ status: 'ready', environment: 'branch' });
    expect(preflight).toHaveBeenCalledTimes(1);
  });

  it('obtains the default preflight from a V16 host factory instead of a test-only boundary', async () => {
    const preflight = jest.fn(() =>
      Promise.resolve({
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: 'E:\\v16-host',
        commitSha: 'a'.repeat(40),
        pairedEvidenceSha256: 'b'.repeat(64),
        databaseUrlSha256: 'c'.repeat(64),
        accountIdSha256: {
          review: 'c'.repeat(64),
          planner: 'd'.repeat(64),
        },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
        dependencies: {},
      }),
    );
    const hostFactory = jest.fn(() => ({ preflight }));
    const create =
      createDefaultReviewPlannerV16ProductAcceptanceComposition as unknown as (
        root: string,
        options: { hostFactory: typeof hostFactory },
      ) => ReturnType<
        typeof createDefaultReviewPlannerV16ProductAcceptanceComposition
      >;
    const composition = create('E:\\v16-host', { hostFactory });

    await expect(
      composition.ports.preflight({
        environment: 'branch',
        repoRoot: 'E:\\v16-host',
      }),
    ).resolves.toMatchObject({ status: 'ready', environment: 'branch' });
    expect(hostFactory).toHaveBeenCalledWith('E:\\v16-host');
    expect(preflight).toHaveBeenCalledTimes(1);
  });

  it('prepares the runtime only after the V16 reservation and journal exist', async () => {
    const order: string[] = [];
    const owner = {
      assertHeld: jest.fn(),
      close: jest.fn(),
    };
    const ledger = {
      attemptSha256: () => 'a'.repeat(64),
      writeExecutionManifest: jest.fn(() =>
        Promise.resolve(order.push('manifest:private')),
      ),
      writeManifest: jest.fn(() => order.push('manifest:public')),
      close: jest.fn(),
    };
    const journal = {
      appendCheckpoint: jest.fn(),
      latestCheckpoint: jest.fn(() => null),
      close: jest.fn(),
    };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-runtime',
      commitSha: 'b'.repeat(40),
      pairedEvidenceSha256: 'c'.repeat(64),
      databaseUrlSha256: 'f'.repeat(64),
      accountIdSha256: { review: 'd'.repeat(64), planner: 'e'.repeat(64) },
      capabilities: {
        review: 'review-capability',
        planner: 'planner-capability',
      },
      dependencies: {},
    };
    const prepareExecution = jest.fn(() => {
      order.push('runtime:prepare');
      return Promise.resolve({
        accountIdSha256: preflight.accountIdSha256,
        capabilities: preflight.capabilities,
        dependencies: preflight.dependencies,
      });
    });
    const runRunner = jest.fn(() => Promise.resolve(order.push('runner')));
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() => Promise.resolve(preflight)),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(() => Promise.resolve(ledger)),
      prepareJournal: jest.fn(() => Promise.resolve(journal)),
      prepareExecution,
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner,
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-runtime',
        ports: ports as never,
      }),
    ).resolves.toEqual({ status: 'passed', environment: 'branch' });

    expect(order).toEqual([
      'manifest:private',
      'manifest:public',
      'runtime:prepare',
      'runner',
    ]);
  });

  it('revalidates the ready identity after owner acquisition and before reserving V16', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-revalidate',
      commitSha: 'a'.repeat(40),
      pairedEvidenceSha256: 'b'.repeat(64),
      databaseUrlSha256: 'c'.repeat(64),
    };
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() =>
        Promise.resolve({ status: 'blocked' as const }),
      ),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(),
      prepareJournal: jest.fn(),
      prepareExecution: jest.fn(),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(),
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-revalidate',
        ports: ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'owner' });

    expect(ports.revalidate).toHaveBeenCalledWith(preflight);
    expect(ports.reserveLedger).not.toHaveBeenCalled();
    expect(ports.prepareExecution).not.toHaveBeenCalled();
    expect(ports.runRunner).not.toHaveBeenCalled();
  });

  it('projects a reservation failure as default-off rather than an operation failure', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-reserve-failure',
      commitSha: 'a'.repeat(40),
      pairedEvidenceSha256: 'b'.repeat(64),
      databaseUrlSha256: 'c'.repeat(64),
    };
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() => Promise.resolve(preflight)),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(() =>
        Promise.reject(new Error('evidence directory unavailable')),
      ),
      prepareJournal: jest.fn(),
      prepareExecution: jest.fn(),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(),
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-reserve-failure',
        ports: ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });

    expect(ports.prepareExecution).not.toHaveBeenCalled();
    expect(ports.runRunner).not.toHaveBeenCalled();
  });

  it('rolls back the verified unstarted reservation when journal setup fails after reservation', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const rollbackUnstartedReservation = jest.fn(() => Promise.resolve());
    const ledger = {
      attemptSha256: () => 'a'.repeat(64),
      writeExecutionManifest: jest.fn(() => Promise.resolve()),
      writeManifest: jest.fn(),
      rollbackUnstartedReservation,
      close: jest.fn(),
    };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-journal-failure',
      commitSha: 'b'.repeat(40),
      pairedEvidenceSha256: 'c'.repeat(64),
      databaseUrlSha256: 'f'.repeat(64),
    };
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() => Promise.resolve(preflight)),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(() => Promise.resolve(ledger)),
      prepareJournal: jest.fn(() =>
        Promise.reject(new Error('journal directory unavailable')),
      ),
      prepareExecution: jest.fn(),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(),
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-journal-failure',
        ports: ports as never,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });

    expect(ledger.writeExecutionManifest).toHaveBeenCalledTimes(1);
    expect(ledger.writeManifest).toHaveBeenCalledTimes(1);
    expect(rollbackUnstartedReservation).toHaveBeenCalledTimes(1);
    expect(ports.prepareExecution).not.toHaveBeenCalled();
    expect(ports.runRunner).not.toHaveBeenCalled();
  });

  it('fails closed when the unstarted reservation cannot be rolled back', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const rollbackUnstartedReservation = jest.fn(() =>
      Promise.reject(new Error('rollback verification unavailable')),
    );
    const ledger = {
      attemptSha256: () => 'a'.repeat(64),
      writeExecutionManifest: jest.fn(() => Promise.resolve()),
      writeManifest: jest.fn(),
      rollbackUnstartedReservation,
      close: jest.fn(),
    };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-rollback-failure',
      commitSha: 'b'.repeat(40),
      pairedEvidenceSha256: 'c'.repeat(64),
      databaseUrlSha256: 'f'.repeat(64),
    };
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() => Promise.resolve(preflight)),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(() => Promise.resolve(ledger)),
      prepareJournal: jest.fn(() =>
        Promise.reject(new Error('journal directory unavailable')),
      ),
      prepareExecution: jest.fn(),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(),
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-rollback-failure',
        ports: ports as never,
      }),
    ).resolves.toEqual({ status: 'failed', stage: 'runner' });

    expect(rollbackUnstartedReservation).toHaveBeenCalledTimes(1);
    expect(ports.prepareExecution).not.toHaveBeenCalled();
    expect(ports.runRunner).not.toHaveBeenCalled();
  });

  it('seals an exact, pre-provider failure before a post-reservation runtime setup error', async () => {
    const owner = { assertHeld: jest.fn(), close: jest.fn() };
    const ledger = {
      attemptSha256: () => 'a'.repeat(64),
      writeExecutionManifest: jest.fn(() => Promise.resolve()),
      writeManifest: jest.fn(),
      recordFailure: jest.fn(),
      close: jest.fn(),
    };
    const checkpoint = {
      component: 'review' as const,
      slot: 'api' as const,
      checkpoint: 'review_api_setup' as const,
      providerCallState: 'not_started' as const,
    };
    const journal = {
      appendCheckpoint: jest.fn(() => checkpoint),
      attemptSha256: jest.fn(() => 'a'.repeat(64)),
      latestCheckpoint: jest.fn(() => checkpoint),
      close: jest.fn(),
    };
    const preflight = {
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v16-setup-failure',
      commitSha: 'b'.repeat(40),
      pairedEvidenceSha256: 'c'.repeat(64),
      databaseUrlSha256: 'f'.repeat(64),
      accountIdSha256: { review: 'd'.repeat(64), planner: 'e'.repeat(64) },
      capabilities: {
        review: 'review-capability',
        planner: 'planner-capability',
      },
      dependencies: {},
    };
    const ports = {
      preflight: jest.fn(() => Promise.resolve(preflight)),
      revalidate: jest.fn(() => Promise.resolve(preflight)),
      acquireOwner: jest.fn(() =>
        Promise.resolve({ status: 'acquired' as const, owner }),
      ),
      reserveLedger: jest.fn(() => Promise.resolve(ledger)),
      prepareJournal: jest.fn(() => Promise.resolve(journal)),
      prepareExecution: jest.fn(() =>
        Promise.reject(new Error('fixture unavailable')),
      ),
      recordFailure: jest.fn(),
      record: jest.fn(),
      runRunner: jest.fn(),
      dispose: jest.fn(() => Promise.resolve()),
    };

    await expect(
      runReviewPlannerV16ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v16-setup-failure',
        ports: ports as never,
      }),
    ).resolves.toEqual({ status: 'failed', stage: 'runner' });

    expect(journal.appendCheckpoint).toHaveBeenCalledWith({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-checkpoint-v1',
      ...checkpoint,
    });
    expect(ledger.recordFailure).toHaveBeenCalledWith({
      schemaVersion: 'phase-6.9.5-v16-product-acceptance-failure-v1',
      environment: 'branch',
      attemptSha256: 'a'.repeat(64),
      ...checkpoint,
      terminal: 'operation_failed',
    });
    expect(ports.runRunner).not.toHaveBeenCalled();
  });
});
