/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- typed Jest fixtures intentionally use matcher values and async port signatures */
import {
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
  buildReviewPlannerV8ActivationEnvironment,
  buildReviewPlannerV8DefaultOffEnvironment,
  buildReviewPlannerV8ServerRecreateCommand,
  mergeReviewPlannerV8AcceptanceHeaders,
  parseReviewPlannerV8ProductAcceptanceArguments,
  runReviewPlannerV8ProductAcceptanceProductCli,
  runReviewPlannerV8ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV8ProductAcceptanceCliSummary,
  type ReviewPlannerV8ProductAcceptanceCompositionPorts,
  type ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v8-product-acceptance-composition';

const SHA = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const REPO_ROOT = 'E:\\PrepMind_ai智能备考助手';

describe('V8 product acceptance executable composition', () => {
  it('builds the exact single-server recreate command and mutually exclusive activation/default-off environments', () => {
    expect(buildReviewPlannerV8ServerRecreateCommand()).toEqual({
      file: 'docker',
      args: [
        'compose',
        '--env-file',
        '.env',
        '-f',
        'docker/docker-compose.dev.yml',
        '--profile',
        'worker',
        'up',
        '-d',
        '--no-deps',
        '--force-recreate',
        'server',
      ],
    });
    expect(
      buildReviewPlannerV8ActivationEnvironment(
        'review',
        'a'.repeat(64),
        'provider-secret',
      ),
    ).toMatchObject({
      AI_PROVIDER_MODE: 'live',
      AI_ENABLE_LIVE_CALLS: 'true',
      AI_MODEL: 'deepseek-v4-pro',
      AI_BASE_URL: 'https://api.deepseek.com',
      REVIEW_AGENT_MODEL_ENABLED: 'true',
      PLANNER_AGENT_MODEL_ENABLED: 'false',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: 'review',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: 'a'.repeat(64),
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '2',
    });
    expect(buildReviewPlannerV8DefaultOffEnvironment()).toMatchObject({
      AI_PROVIDER_MODE: 'mock',
      AI_ENABLE_LIVE_CALLS: 'false',
      REVIEW_AGENT_MODEL_ENABLED: 'false',
      PLANNER_AGENT_MODEL_ENABLED: 'false',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'false',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT: '',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256: '',
      REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS: '0',
      DEEPSEEK_API_KEY: '',
      OPENAI_API_KEY: '',
    });
  });

  it('merges the raw browser capability into original request headers without dropping them', () => {
    expect(
      mergeReviewPlannerV8AcceptanceHeaders(
        { authorization: 'Bearer in-memory', accept: 'application/json' },
        'raw-capability',
      ),
    ).toEqual({
      authorization: 'Bearer in-memory',
      accept: 'application/json',
      'x-prepmind-review-planner-acceptance': 'raw-capability',
    });
  });

  it('accepts only the exact product or recovery confirmation and environment pair', () => {
    expect(
      parseReviewPlannerV8ProductAcceptanceArguments(
        [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
          '--environment=branch',
        ],
        'product',
      ),
    ).toEqual({ environment: 'branch' });
    expect(
      parseReviewPlannerV8ProductAcceptanceArguments(
        [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
          '--environment=main',
        ],
        'recovery',
      ),
    ).toEqual({ environment: 'main' });

    for (const argv of [
      [],
      [REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION],
      [
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
        '--environment=branch',
      ],
      [
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
        '--environment=branch',
        '--extra',
      ],
      [
        '--environment=branch',
        REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
      ],
      [REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION, '--environment=dev'],
    ]) {
      expect(() =>
        parseReviewPlannerV8ProductAcceptanceArguments(argv, 'product'),
      ).toThrow('V8_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
    }
  });

  it('has zero mutation ports when argv is invalid or product/recovery confirmations are interchanged', async () => {
    const fixture = createPorts();

    await expect(
      runReviewPlannerV8ProductAcceptanceProductCli({
        argv: [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
          '--environment=branch',
        ],
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');

    expect(fixture.order).toEqual([]);
  });

  it('finishes the complete read-only preflight before acquiring owner or reserving the ledger', async () => {
    const fixture = createPorts({ preflightStatus: 'blocked' });

    await expect(runProduct(fixture.ports)).resolves.toEqual({
      stage: 'preflight',
      status: 'blocked',
      code: 'paired_evidence_incomplete',
    });

    expect(fixture.order).toEqual(['preflight']);
  });

  it('publishes the recovery manifest before registration and fixtures, then publishes the ledger manifest before runner dispatch', async () => {
    const fixture = createPorts();

    const result = await runProduct(fixture.ports);

    expect(result).toEqual({
      stage: 'complete',
      status: 'passed',
      environment: 'branch',
      requestCount: 4,
      inputTokens: 400,
      outputTokens: 80,
      costCny: '0.00168000',
    });
    expect(fixture.order).toEqual([
      'preflight',
      'owner:product',
      'ledger:reserve',
      'resources',
      'recovery:prepare',
      'register:review',
      'bind:review',
      'register:planner',
      'bind:planner',
      'fixtures:create',
      'ledger:manifest',
      'dependencies:create',
      'runner',
      'journal:close',
      'ledger:close',
      'owner:close',
    ]);
  });

  it('uses only pre-generated exact emails and fixture ids in register, binding, fixture, and manifests', async () => {
    const fixture = createPorts();

    await runProduct(fixture.ports);

    expect(fixture.ports.prepareRecoveryJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        manifest: expect.objectContaining({
          syntheticEmails: {
            review:
              'phase695-v8-accept-20260718t010203z-review@example.invalid',
            planner:
              'phase695-v8-accept-20260718t010203z-planner@example.invalid',
            probe: 'phase695-v8-accept-20260718t010203z-probe@example.invalid',
          },
          fixtureIds: ['fixture-review', 'fixture-planner'],
          browserExecutablePath:
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          browserProfilePath:
            '.tmp/phase-6-9-5-v8-product-acceptance/branch/profile-v8',
        }),
      }),
    );
    expect(fixture.ports.createFixtures).toHaveBeenCalledWith(
      expect.objectContaining({
        fixtureIds: ['fixture-review', 'fixture-planner'],
        accounts: {
          review: { id: 'review-user', token: 'review-token' },
          planner: { id: 'planner-user', token: 'planner-token' },
        },
      }),
    );
  });

  it('closes handles without serializing raw failures or any secret material', async () => {
    const fixture = createPorts();
    fixture.ports.createFixtures.mockRejectedValueOnce(
      new Error(
        'sk-provider password JWT capability-secret https://raw.example',
      ),
    );

    await expect(runProduct(fixture.ports)).rejects.toThrow(
      'V8_PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
    expect(fixture.order.slice(-3)).toEqual([
      'journal:close',
      'ledger:close',
      'owner:close',
    ]);
    const line = serializeReviewPlannerV8ProductAcceptanceCliSummary({
      stage: 'fixtures',
      status: 'failed',
      code: 'operation_failed',
    });
    expect(line).toBe(
      '{"stage":"fixtures","status":"failed","code":"operation_failed"}',
    );
    expect(line).not.toMatch(
      /password|token|jwt|capability|https?:|provider|trace|@/i,
    );
  });
});

describe('V8 recovery-only executable composition', () => {
  it('does not acquire owner or open the journal when recovery preflight is blocked', async () => {
    const fixture = createRecoveryPorts({ preflightStatus: 'blocked' });

    await expect(runRecovery(fixture.ports)).resolves.toEqual({
      stage: 'preflight',
      status: 'blocked',
      code: 'recovery_not_authorized',
    });
    expect(fixture.order).toEqual(['preflight']);
  });

  it('returns owner_active without opening or mutating the recovery journal', async () => {
    const fixture = createRecoveryPorts({ ownerActive: true });

    await expect(runRecovery(fixture.ports)).resolves.toEqual({
      stage: 'owner',
      status: 'blocked',
      code: 'owner_active',
    });
    expect(fixture.order).toEqual(['preflight', 'owner:recovery']);
  });

  it('fresh-seals a fully verified preseal without opening recovery cleanup or dispatching a request', async () => {
    const fixture = createRecoveryPorts({ presealed: true });

    await expect(runRecovery(fixture.ports)).resolves.toEqual({
      stage: 'preseal',
      status: 'sealed',
      environment: 'branch',
      providerInvocations: 0,
      acceptanceRequests: 0,
      browserContinues: 0,
    });
    expect(fixture.order).toEqual([
      'preflight',
      'owner:recovery',
      'preseal:finalize',
      'owner:close',
    ]);
  });

  it('authorizes before cleanup effects and appends strict recovery stages in order', async () => {
    const fixture = createRecoveryPorts();

    await expect(runRecovery(fixture.ports)).resolves.toEqual({
      stage: 'recovery',
      status: 'recovered',
      environment: 'branch',
      providerInvocations: 0,
      acceptanceRequests: 0,
      browserContinues: 0,
    });
    expect(fixture.order).toEqual([
      'preflight',
      'owner:recovery',
      'journal:open',
      'journal:authorize',
      'browser:terminate-exact',
      'journal:restore.claimed',
      'restore:default-off',
      'journal:restore.verified.json',
      'journal:cleanup.claimed',
      'cleanup:exact',
      'journal:cleanup.verified.json',
      'journal:finalize',
      'journal:close',
      'owner:close',
    ]);
  });

  it('resumes idempotently after a crash without re-appending an existing claimed stage', async () => {
    const fixture = createRecoveryPorts({ restoreClaimed: true });

    await expect(runRecovery(fixture.ports)).resolves.toMatchObject({
      status: 'recovered',
      providerInvocations: 0,
    });
    expect(fixture.order).not.toContain('journal:restore.claimed');
    expect(fixture.order).toContain('restore:default-off');
    expect(fixture.order).toContain('journal:restore.verified.json');
  });
});

function runProduct(ports: ReviewPlannerV8ProductAcceptanceCompositionPorts) {
  return runReviewPlannerV8ProductAcceptanceProductCli({
    argv: [
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
      '--environment=branch',
    ],
    repoRoot: REPO_ROOT,
    ports,
  });
}

function runRecovery(
  ports: ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts,
) {
  return runReviewPlannerV8ProductAcceptanceRecoveryCli({
    argv: [
      REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
      '--environment=branch',
    ],
    repoRoot: REPO_ROOT,
    ports,
  });
}

function createPorts(options: { preflightStatus?: 'ready' | 'blocked' } = {}) {
  const order: string[] = [];
  const owner = {
    assertHeld: jest.fn(),
    close: jest.fn(() => order.push('owner:close')),
  };
  const ledger = {
    environment: jest.fn(() => 'branch' as const),
    writeManifest: jest.fn(() => order.push('ledger:manifest')),
    close: jest.fn(() => order.push('ledger:close')),
  };
  const journal = {
    snapshot: jest.fn(() => ({
      manifest: {
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-v1' as const,
        environment: 'branch' as const,
        publicLedgerPath:
          'docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch',
        syntheticEmails: {
          review: 'review@example.invalid',
          planner: 'planner@example.invalid',
          probe: 'probe@example.invalid',
        },
        fixtureIds: [],
        browserExecutablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        browserProfilePath:
          '.tmp/phase-6-9-5-v8-product-acceptance/branch/profile-v8',
      },
      bindings: {},
      mode: null,
      stages: {
        restoreClaimed: false,
        restoreVerified: false,
        cleanupClaimed: false,
        cleanupVerified: false,
      },
    })),
    bindAccount: jest.fn(),
    close: jest.fn(() => order.push('journal:close')),
  };
  const ports = {
    preflight: jest.fn(async () => {
      order.push('preflight');
      if (options.preflightStatus === 'blocked') {
        return {
          status: 'blocked' as const,
          code: 'paired_evidence_incomplete' as const,
        };
      }
      return {
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: REPO_ROOT,
        commitSha: COMMIT,
        pairedEvidenceSha256: SHA,
        chromeExecutablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        utcStamp: '20260718t010203z',
      };
    }),
    acquireOwner: jest.fn(async () => {
      order.push('owner:product');
      return { status: 'acquired' as const, owner };
    }),
    reserveLedger: jest.fn(async () => {
      order.push('ledger:reserve');
      return ledger;
    }),
    generateResources: jest.fn(() => {
      order.push('resources');
      return {
        syntheticEmails: {
          review: 'phase695-v8-accept-20260718t010203z-review@example.invalid',
          planner:
            'phase695-v8-accept-20260718t010203z-planner@example.invalid',
          probe: 'phase695-v8-accept-20260718t010203z-probe@example.invalid',
        },
        fixtureIds: ['fixture-review', 'fixture-planner'],
        browserProfilePath:
          '.tmp/phase-6-9-5-v8-product-acceptance/branch/profile-v8',
        passwords: { review: 'review-password', planner: 'planner-password' },
        capabilities: {
          review: 'review-capability',
          planner: 'planner-capability',
        },
      };
    }),
    prepareRecoveryJournal: jest.fn(async () => {
      order.push('recovery:prepare');
      return journal;
    }),
    registerAccount: jest.fn(async ({ component }) => {
      order.push(`register:${component}`);
      return {
        id: component === 'review' ? 'review-user' : 'planner-user',
        token: component === 'review' ? 'review-token' : 'planner-token',
      };
    }),
    bindAccount: jest.fn(async ({ component }) => {
      order.push(`bind:${component}`);
    }),
    createFixtures: jest.fn(async () => {
      order.push('fixtures:create');
      return {
        accountIdSha256: { review: 'c'.repeat(64), planner: 'd'.repeat(64) },
        fixtureIdSha256: { review: 'e'.repeat(64), planner: 'f'.repeat(64) },
      };
    }),
    createRunnerDependencies: jest.fn(() => {
      order.push('dependencies:create');
      return {} as never;
    }),
    runAcceptance: jest.fn(async () => {
      order.push('runner');
      return {
        environment: 'branch' as const,
        provider: 'deepseek',
        model: 'deepseek-v4-pro',
        traceIdSha256: ['1', '2', '3', '4'].map((value) => value.repeat(64)),
        screenshotSha256: { review: '5'.repeat(64), planner: '6'.repeat(64) },
        usage: { inputTokens: 400, outputTokens: 80 },
        durationMs: 1000,
        traceSummaries: [],
      };
    }),
  } satisfies ReviewPlannerV8ProductAcceptanceCompositionPorts;
  return { order, ports, owner, ledger, journal };
}

function createRecoveryPorts(
  options: {
    preflightStatus?: 'ready' | 'blocked';
    ownerActive?: boolean;
    restoreClaimed?: boolean;
    presealed?: boolean;
  } = {},
) {
  const order: string[] = [];
  const owner = {
    assertHeld: jest.fn(),
    close: jest.fn(() => order.push('owner:close')),
  };
  const authority = { assertAuthorized: jest.fn() };
  const journal = {
    snapshot: jest.fn(() => ({
      manifest: {
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-recovery-v1' as const,
        environment: 'branch' as const,
        publicLedgerPath:
          'docs/acceptance/evidence/phase-6-9-5-v8-product-acceptance/branch',
        syntheticEmails: {
          review: 'review@example.invalid',
          planner: 'planner@example.invalid',
          probe: 'probe@example.invalid',
        },
        fixtureIds: [],
        browserExecutablePath:
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        browserProfilePath:
          '.tmp/phase-6-9-5-v8-product-acceptance/branch/profile-v8',
      },
      bindings: {},
      mode: {
        schemaVersion: 'phase-6.9.5-v8-product-acceptance-mode-v1' as const,
        environment: 'branch' as const,
        mode: 'recovery' as const,
      },
      stages: {
        restoreClaimed: options.restoreClaimed === true,
        restoreVerified: false,
        cleanupClaimed: false,
        cleanupVerified: false,
      },
    })),
    bindAccount: jest.fn(),
    authorizeRecoveryOnly: jest.fn(async () => {
      order.push('journal:authorize');
      return authority;
    }),
    appendStage: jest.fn((leaf: string) => order.push(`journal:${leaf}`)),
    finalizeRecoveryOnly: jest.fn(async () => {
      order.push('journal:finalize');
    }),
    close: jest.fn(() => order.push('journal:close')),
  };
  const restoreReceipt = {
    schemaVersion: 'phase-6.9.5-v8-product-acceptance-default-off-v2' as const,
    component: 'recovery' as const,
    container: {
      previousIdSha256: '1'.repeat(64),
      newIdSha256: '2'.repeat(64),
    },
    inspected: {
      aiProviderMode: 'mock' as const,
      liveCallsEnabled: false as const,
      reviewAgentModelEnabled: false as const,
      plannerAgentModelEnabled: false as const,
      acceptanceEnabled: false as const,
      acceptanceComponent: '' as const,
      capabilitySha256: '' as const,
      maxRequests: 0 as const,
      deepseekCredentialPresent: false as const,
      openaiCredentialPresent: false as const,
    },
    binding: { port: 3001 as const, healthContainerIdSha256: '2'.repeat(64) },
    deterministicProbe: {
      passed: true as const,
      provenance: 'local_deterministic' as const,
    },
    providerInvocations: 0 as const,
  };
  const cleanupReceipt = {
    schemaVersion:
      'phase-6.9.5-v8-product-acceptance-recovery-cleanup-v1' as const,
    syntheticAccounts: 0 as const,
    fixtures: 0 as const,
    traces: 0 as const,
    browserProcesses: 0 as const,
    browserProfiles: 0 as const,
    probeAccounts: 0 as const,
  };
  const ports = {
    preflightRecovery: jest.fn(async () => {
      order.push('preflight');
      if (options.preflightStatus === 'blocked') {
        return {
          status: 'blocked' as const,
          code: 'recovery_not_authorized' as const,
        };
      }
      return {
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: REPO_ROOT,
        presealed: options.presealed === true,
        manifest: {
          browserExecutablePath:
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          browserProfilePath:
            '.tmp/phase-6-9-5-v8-product-acceptance/branch/profile-v8',
        },
      };
    }),
    acquireOwner: jest.fn(async () => {
      order.push('owner:recovery');
      return options.ownerActive
        ? ({ status: 'owner_active' as const } as const)
        : ({ status: 'acquired' as const, owner } as const);
    }),
    openRecoveryJournal: jest.fn(async () => {
      order.push('journal:open');
      return journal;
    }),
    finalizePresealedSuccess: jest.fn(async () => {
      order.push('preseal:finalize');
    }),
    terminateExactBrowser: jest.fn(async () => {
      order.push('browser:terminate-exact');
    }),
    restoreDefaultOff: jest.fn(async () => {
      order.push('restore:default-off');
      return restoreReceipt;
    }),
    cleanupExact: jest.fn(async () => {
      order.push('cleanup:exact');
      return cleanupReceipt;
    }),
  } satisfies ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts;
  return { order, ports, owner, journal };
}
