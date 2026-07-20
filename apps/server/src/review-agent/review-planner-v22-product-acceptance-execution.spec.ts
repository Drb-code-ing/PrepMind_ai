import { createReviewPlannerV22ProductAcceptanceDiagnosticsPort } from './review-planner-v22-product-acceptance-diagnostics';
import { createReviewPlannerV22ProductAcceptanceRunnerLedgerAdapter } from './review-planner-v22-product-acceptance-execution';
import { runReviewPlannerV22ProductAcceptanceComposition } from './review-planner-v22-product-acceptance-composition';
import { REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

describe('Review Planner V22 execution bridge', () => {
  const attemptSha256 = 'a'.repeat(64);

  it('emits only fixed V22 checkpoints and a nonsecret failure projection', () => {
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
    const diagnostics = createReviewPlannerV22ProductAcceptanceDiagnosticsPort({
      environment: 'branch',
      journal: journal as never,
      recordFailure: (value) => failures.push(value),
    });

    diagnostics.checkpoint('review_api_activate');
    diagnostics.publishFailure();

    expect(checkpoints).toEqual([
      {
        schemaVersion:
          REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        providerCallState: 'not_started',
      },
    ]);
    expect(failures).toEqual([
      {
        schemaVersion:
          REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
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

  it('durably commits exactly four V22 runner slots without V11 records', async () => {
    const ledger = {
      attemptSha256: () => attemptSha256,
      claimSlot: jest.fn(),
      recordSlotResult: jest.fn(),
      recordDefaultOff: jest.fn(),
      recordOwnerIsolation: jest.fn(),
      recordCleanup: jest.fn(),
      finalizeSuccess: jest.fn(() => Promise.resolve()),
    };
    const adapter = createReviewPlannerV22ProductAcceptanceRunnerLedgerAdapter({
      environment: 'branch',
      ledger,
      manifest: {
        schemaVersion:
          'phase-6.9.5-v22-product-acceptance-manifest-v1' as const,
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
    adapter.recordDefaultOff(v8DefaultOffReceipt('review'));
    adapter.recordDefaultOff(v8DefaultOffReceipt('planner'));
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
    expect(ledger.recordDefaultOff).toHaveBeenNthCalledWith(1, {
      ...defaultOffReceipt('review'),
      model: 'deepseek-v4-pro',
    });
    expect(ledger.recordDefaultOff).toHaveBeenNthCalledWith(2, {
      ...defaultOffReceipt('planner'),
      model: 'deepseek-v4-pro',
    });
    expect(ledger.recordOwnerIsolation).toHaveBeenCalledTimes(1);
    expect(ledger.recordCleanup).toHaveBeenCalledTimes(1);
    expect(ledger.finalizeSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion:
          REVIEW_PLANNER_V22_PRODUCT_ACCEPTANCE_PROFILE.schemas.acceptance,
        requests: 4,
      }),
    );
    expect(JSON.stringify(ledger)).not.toContain('v11');
  });

  it('rejects a component-only default-off record instead of synthesizing evidence', () => {
    const ledger = {
      attemptSha256: () => attemptSha256,
      claimSlot: jest.fn(),
      recordSlotResult: jest.fn(),
      recordDefaultOff: jest.fn(),
      recordOwnerIsolation: jest.fn(),
      recordCleanup: jest.fn(),
      finalizeSuccess: jest.fn(() => Promise.resolve()),
    };
    const adapter = createReviewPlannerV22ProductAcceptanceRunnerLedgerAdapter({
      environment: 'branch',
      ledger,
      manifest: {
        schemaVersion:
          'phase-6.9.5-v22-product-acceptance-manifest-v1' as const,
        environment: 'branch' as const,
        attemptSha256,
      },
    });

    expect(() => adapter.recordDefaultOff({ component: 'review' })).toThrow(
      'V22_PRODUCT_ACCEPTANCE_EXECUTION_INVALID',
    );
    expect(ledger.recordDefaultOff).not.toHaveBeenCalled();
  });

  it('projects a strict V8 runner receipt into the V22 durable default-off record', () => {
    const ledger = {
      attemptSha256: () => attemptSha256,
      claimSlot: jest.fn(),
      recordSlotResult: jest.fn(),
      recordDefaultOff: jest.fn(),
      recordOwnerIsolation: jest.fn(),
      recordCleanup: jest.fn(),
      finalizeSuccess: jest.fn(() => Promise.resolve()),
    };
    const adapter = createReviewPlannerV22ProductAcceptanceRunnerLedgerAdapter({
      environment: 'branch',
      ledger,
      manifest: {
        schemaVersion:
          'phase-6.9.5-v22-product-acceptance-manifest-v1' as const,
        environment: 'branch' as const,
        attemptSha256,
      },
    });
    const v8Receipt = v8DefaultOffReceipt('review');

    adapter.recordDefaultOff(v8Receipt);

    expect(ledger.recordDefaultOff).toHaveBeenCalledWith({
      ...v8Receipt,
      schemaVersion: 'phase-6.9.5-v22-product-acceptance-default-off-v1',
      model: 'deepseek-v4-pro',
      baseUrl: 'https://api.deepseek.com',
    });
  });

  it('rejects an extra raw model instead of allowing it to influence the V8 projection', () => {
    const ledger = {
      attemptSha256: () => attemptSha256,
      claimSlot: jest.fn(),
      recordSlotResult: jest.fn(),
      recordDefaultOff: jest.fn(),
      recordOwnerIsolation: jest.fn(),
      recordCleanup: jest.fn(),
      finalizeSuccess: jest.fn(() => Promise.resolve()),
    };
    const adapter = createReviewPlannerV22ProductAcceptanceRunnerLedgerAdapter({
      environment: 'branch',
      ledger,
      manifest: {
        schemaVersion:
          'phase-6.9.5-v22-product-acceptance-manifest-v1' as const,
        environment: 'branch' as const,
        attemptSha256,
      },
    });

    expect(() =>
      adapter.recordDefaultOff({
        ...v8DefaultOffReceipt('review'),
        model: 'deepseek-v4-flash',
      }),
    ).toThrow('V22_PRODUCT_ACCEPTANCE_EXECUTION_INVALID');
    expect(ledger.recordDefaultOff).not.toHaveBeenCalled();
  });

  it('stops at V22 preflight before owner, ledger, runner, or external work', async () => {
    const ports = {
      preflight: jest.fn(() => Promise.resolve({ status: 'blocked' as const })),
      acquireOwner: jest.fn(),
      reserveLedger: jest.fn(),
      prepareJournal: jest.fn(),
      runRunner: jest.fn(),
      recordFailure: jest.fn(),
    };

    await expect(
      runReviewPlannerV22ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: 'E:\\v22-composition',
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

function defaultOffReceipt(component: 'review' | 'planner') {
  return {
    schemaVersion: 'phase-6.9.5-v22-product-acceptance-default-off-v1',
    baseUrl: 'https://api.deepseek.com',
    component,
    container: {
      previousIdSha256:
        component === 'review' ? 'a'.repeat(64) : 'c'.repeat(64),
      newIdSha256: component === 'review' ? 'b'.repeat(64) : 'd'.repeat(64),
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
      healthContainerIdSha256:
        component === 'review' ? 'b'.repeat(64) : 'd'.repeat(64),
    },
    deterministicProbe: {
      passed: true,
      provenance: 'local_deterministic',
    },
    providerInvocations: 0,
    model: 'deepseek-v4-pro',
  } as const;
}

function v8DefaultOffReceipt(component: 'review' | 'planner') {
  const receipt = { ...defaultOffReceipt(component) };
  Reflect.deleteProperty(receipt, 'model');
  Reflect.deleteProperty(receipt, 'baseUrl');
  return {
    ...receipt,
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2',
  } as const;
}
