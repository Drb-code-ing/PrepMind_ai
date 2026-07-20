import { createReviewPlannerV12ProductAcceptanceDiagnosticsPort } from './review-planner-v12-product-acceptance-diagnostics';
import { createReviewPlannerV12ProductAcceptanceRunnerLedgerAdapter } from './review-planner-v12-product-acceptance-execution';
import { runReviewPlannerV12ProductAcceptanceComposition } from './review-planner-v12-product-acceptance-composition';
import { REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

describe('Review Planner V12 execution bridge', () => {
  const attemptSha256 = 'a'.repeat(64);

  it('emits only fixed V12 checkpoints and a nonsecret failure projection', () => {
    const checkpoints: unknown[] = [];
    const failures: unknown[] = [];
    const journal = {
      attemptSha256: () => attemptSha256,
      appendCheckpoint: jest.fn((value) => {
        checkpoints.push(value);
        return undefined as never;
      }),
      latestCheckpoint: jest.fn(() => checkpoints.at(-1) ?? null),
    };
    const diagnostics = createReviewPlannerV12ProductAcceptanceDiagnosticsPort({
      environment: 'branch',
      journal: journal as never,
      recordFailure: (value) => failures.push(value),
    });

    diagnostics.checkpoint('review_api_activate');
    diagnostics.publishFailure();

    expect(checkpoints).toEqual([
      {
        schemaVersion:
          REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        providerCallState: 'not_started',
      },
    ]);
    expect(failures).toEqual([
      {
        schemaVersion:
          REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
        environment: 'branch',
        attemptSha256,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      },
    ]);
    expect(JSON.stringify({ checkpoints, failures })).not.toMatch(
      /prompt|raw|error|credential|token|secret/i,
    );
  });

  it('durably commits exactly four V12 runner slots without V11 records', async () => {
    const ledger = {
      attemptSha256: () => attemptSha256,
      claimSlot: jest.fn(),
      recordSlotResult: jest.fn(),
      recordDefaultOff: jest.fn(),
      recordOwnerIsolation: jest.fn(),
      recordCleanup: jest.fn(),
      finalizeSuccess: jest.fn(() => Promise.resolve()),
    };
    const adapter = createReviewPlannerV12ProductAcceptanceRunnerLedgerAdapter({
      environment: 'branch',
      ledger,
      manifest: {
        schemaVersion:
          'phase-6.9.5-v12-product-acceptance-manifest-v1' as const,
        environment: 'branch' as const,
        attemptSha256,
      },
      record: jest.fn(),
    });

    for (const slot of [
      'review-api',
      'review-browser',
      'planner-api',
      'planner-browser',
    ] as const) {
      adapter.claimSlot(slot);
      if (slot.endsWith('browser')) {
        adapter.recordScreenshot(
          slot.startsWith('review') ? 'review' : 'planner',
          new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]),
        );
      }
      adapter.recordSlotResult({
        slot,
        traceIdSha256: slot.endsWith('api')
          ? (slot.startsWith('review') ? 'a' : 'b').repeat(64)
          : (slot.startsWith('review') ? 'c' : 'd').repeat(64),
        durationMs: 1,
        ...(slot.endsWith('browser')
          ? { screenshotSha256: 'f'.repeat(64) }
          : {}),
      });
    }
    adapter.recordDefaultOff({ component: 'review' });
    adapter.recordDefaultOff({ component: 'planner' });
    adapter.recordOwnerIsolation({
      reviewFactsBeforeSha256: '1'.repeat(64),
      reviewFactsAfterSha256: '1'.repeat(64),
      plannerFactsBeforeSha256: '2'.repeat(64),
      plannerFactsAfterSha256: '2'.repeat(64),
      traceIdSha256: ['1', '2', '3', '4'].map((value) => value.repeat(64)),
      crossAccountInvisible: true,
      businessWrites: 0,
    });
    adapter.recordCleanup({
      syntheticAccounts: 0,
      fixtures: 0,
      traces: 0,
      browserProfiles: 0,
      capabilities: 0,
    });
    await adapter.finalizeSuccess();

    expect(ledger.claimSlot).toHaveBeenCalledTimes(4);
    expect(ledger.recordSlotResult).toHaveBeenCalledTimes(4);
    expect(ledger.recordDefaultOff).toHaveBeenCalledTimes(2);
    expect(ledger.recordOwnerIsolation).toHaveBeenCalledTimes(1);
    expect(ledger.recordCleanup).toHaveBeenCalledTimes(1);
    expect(ledger.finalizeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion:
          REVIEW_PLANNER_V12_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
        requests: 4,
      }),
    );
    expect(JSON.stringify(ledger)).not.toContain('v11');
  });

  it('stops at V12 preflight before owner, ledger, runner, or external work', async () => {
    const ports = {
      preflight: jest.fn(() => Promise.resolve({ status: 'blocked' as const })),
      acquireOwner: jest.fn(),
      reserveLedger: jest.fn(),
      prepareJournal: jest.fn(),
      runRunner: jest.fn(),
      recordFailure: jest.fn(),
    };

    await expect(
      runReviewPlannerV12ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v12-composition',
        ports: ports as never,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });

    expect(ports.acquireOwner).not.toHaveBeenCalled();
    expect(ports.reserveLedger).not.toHaveBeenCalled();
    expect(ports.prepareJournal).not.toHaveBeenCalled();
    expect(ports.runRunner).not.toHaveBeenCalled();
    expect(ports.recordFailure).not.toHaveBeenCalled();
  });
});
