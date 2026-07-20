import {
  createReviewPlannerV20ProductAcceptanceExecutionManifest,
  parseReviewPlannerV20ProductAcceptanceAggregate,
  parseReviewPlannerV20ProductAcceptanceCleanup,
  parseReviewPlannerV20ProductAcceptanceDefaultOff,
  parseReviewPlannerV20ProductAcceptanceExecutionManifest,
  parseReviewPlannerV20ProductAcceptanceFailure,
  parseReviewPlannerV20ProductAcceptanceManifest,
  parseReviewPlannerV20ProductAcceptanceOwnerIsolation,
  parseReviewPlannerV20ProductAcceptanceSlotResult,
  parseReviewPlannerV20ProductAcceptanceSuccess,
} from './review-planner-v20-product-acceptance-ledger';
import * as reviewPlannerV20Ledger from './review-planner-v20-product-acceptance-ledger';
import { parseReviewPlannerV20ProductAcceptanceCheckpoint } from './review-planner-v20-product-acceptance-recovery';
import { REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE } from './review-planner-product-acceptance-profile';

describe('Review Planner V20 product-acceptance ledger contracts', () => {
  const attemptSha256 = 'a'.repeat(64);

  it('rejects V11 record identities from every V20 durable contract', () => {
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceManifest({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.manifest,
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceExecutionManifest({
        schemaVersion:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas
            .executionManifest,
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceCheckpoint({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        providerCallState: 'not_started',
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_RECOVERY_RECORD_INVALID');
  });

  it('accepts only the complete V20 four-slot durable success vocabulary', () => {
    const slot = parseReviewPlannerV20ProductAcceptanceSlotResult({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-slot-result-v1',
      slot: 'review-api',
      traceSha256: 'b'.repeat(64),
    });
    const defaultOff = parseReviewPlannerV20ProductAcceptanceDefaultOff({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-default-off-v1',
      model: 'deepseek-v4-pro',
      baseUrl: 'https://api.deepseek.com',
      component: 'review',
      container: {
        previousIdSha256: 'a'.repeat(64),
        newIdSha256: 'b'.repeat(64),
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
        healthContainerIdSha256: 'b'.repeat(64),
      },
      deterministicProbe: {
        passed: true,
        provenance: 'local_deterministic',
      },
      providerInvocations: 0,
    });
    const isolation = parseReviewPlannerV20ProductAcceptanceOwnerIsolation({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-owner-isolation-v1',
      crossAccountInvisible: true,
      businessWrites: 0,
      traceSha256: [
        'b'.repeat(64),
        'c'.repeat(64),
        'd'.repeat(64),
        'e'.repeat(64),
      ],
    });
    const cleanup = parseReviewPlannerV20ProductAcceptanceCleanup({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-cleanup-v1',
      syntheticAccounts: 0,
      fixtures: 0,
      traces: 0,
      browserProfiles: 0,
      capabilities: 0,
    });
    const aggregate = parseReviewPlannerV20ProductAcceptanceAggregate({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-aggregate-v1',
      environment: 'branch',
      attemptSha256,
      requests: 4,
      durationMs: 4_000,
    });
    const success = parseReviewPlannerV20ProductAcceptanceSuccess({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-success-v1',
      environment: 'branch',
      attemptSha256,
    });

    expect(slot.slot).toBe('review-api');
    expect(defaultOff.inspected.liveCallsEnabled).toBe(false);
    expect(isolation.traceSha256).toHaveLength(4);
    expect(cleanup.browserProfiles).toBe(0);
    expect(aggregate.requests).toBe(4);
    expect(success.attemptSha256).toBe(attemptSha256);
  });

  it.each(['https://api.deepseek.com', 'https://api.deepseek.com/v1'] as const)(
    'accepts the V20 durable default-off receipt with approved base URL %s',
    (baseUrl) => {
      const receipt = {
        schemaVersion: 'phase-6.9.5-v20-product-acceptance-default-off-v1',
        model: 'deepseek-v4-pro',
        baseUrl,
        component: 'review',
        container: {
          previousIdSha256: 'a'.repeat(64),
          newIdSha256: 'b'.repeat(64),
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
          healthContainerIdSha256: 'b'.repeat(64),
        },
        deterministicProbe: {
          passed: true,
          provenance: 'local_deterministic',
        },
        providerInvocations: 0,
      };

      expect(
        parseReviewPlannerV20ProductAcceptanceDefaultOff(receipt),
      ).toMatchObject({ baseUrl });
    },
  );

  it.each([
    ['missing', undefined],
    ['unapproved', 'https://api.deepseek.com/v1/'],
  ])('rejects a %s V20 durable default-off receipt base URL', (_, baseUrl) => {
    const receipt = {
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-default-off-v1',
      model: 'deepseek-v4-pro',
      component: 'review',
      container: {
        previousIdSha256: 'a'.repeat(64),
        newIdSha256: 'b'.repeat(64),
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
        healthContainerIdSha256: 'b'.repeat(64),
      },
      deterministicProbe: {
        passed: true,
        provenance: 'local_deterministic',
      },
      providerInvocations: 0,
      ...(baseUrl === undefined ? {} : { baseUrl }),
    };

    expect(() =>
      parseReviewPlannerV20ProductAcceptanceDefaultOff(receipt),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  });

  it('allows only Flash or Pro in the V20 default-off environment without relaxing its controls', () => {
    const assertDefaultOff = (
      reviewPlannerV20Ledger as typeof reviewPlannerV20Ledger & {
        assertReviewPlannerV20DefaultOffEnvironment?: (
          entries: readonly string[],
        ) => void;
      }
    ).assertReviewPlannerV20DefaultOffEnvironment;

    expect(assertDefaultOff).toEqual(expect.any(Function));
    if (!assertDefaultOff) return;

    const entries = (model: string) => [
      'AI_PROVIDER_MODE=mock',
      'AI_ENABLE_LIVE_CALLS=false',
      `AI_MODEL=${model}`,
      'AI_BASE_URL=https://api.deepseek.com',
      'DEEPSEEK_API_KEY=',
      'OPENAI_API_KEY=',
      'REVIEW_AGENT_MODEL_ENABLED=false',
      'PLANNER_AGENT_MODEL_ENABLED=false',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED=false',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT=',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256=',
      'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS=0',
      'REVIEW_AGENT_MODEL_TIMEOUT_MS=4500',
      'PLANNER_AGENT_MODEL_TIMEOUT_MS=4500',
    ];

    expect(() => assertDefaultOff(entries('deepseek-v4-flash'))).not.toThrow();
    expect(() => assertDefaultOff(entries('deepseek-v4-pro'))).not.toThrow();
    expect(() => assertDefaultOff(entries('unapproved-model'))).toThrow();
    expect(() =>
      assertDefaultOff([
        ...entries('deepseek-v4-flash'),
        'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS=0',
      ]),
    ).toThrow();
  });

  it.each(['https://api.deepseek.com', 'https://api.deepseek.com/v1'])(
    'permits the exact official DeepSeek URL %s in otherwise closed Compose state',
    (baseUrl) => {
      const assertDefaultOff = (
        reviewPlannerV20Ledger as typeof reviewPlannerV20Ledger & {
          assertReviewPlannerV20DefaultOffEnvironment?: (
            entries: readonly string[],
          ) => void;
        }
      ).assertReviewPlannerV20DefaultOffEnvironment;
      if (!assertDefaultOff) throw new Error('V20 validator unavailable');
      const entries = [
        'AI_PROVIDER_MODE=mock',
        'AI_ENABLE_LIVE_CALLS=false',
        'AI_MODEL=deepseek-v4-flash',
        `AI_BASE_URL=${baseUrl}`,
        'DEEPSEEK_API_KEY=',
        'OPENAI_API_KEY=',
        'REVIEW_AGENT_MODEL_ENABLED=false',
        'PLANNER_AGENT_MODEL_ENABLED=false',
        'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED=false',
        'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_COMPONENT=',
        'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_CAPABILITY_SHA256=',
        'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_MAX_REQUESTS=0',
        'REVIEW_AGENT_MODEL_TIMEOUT_MS=4500',
        'PLANNER_AGENT_MODEL_TIMEOUT_MS=4500',
      ];

      expect(() => assertDefaultOff(entries)).not.toThrow();
      expect(() =>
        assertDefaultOff([
          ...entries.filter((entry) => !entry.startsWith('AI_BASE_URL=')),
          'AI_BASE_URL=https://api.deepseek.com/v1/',
        ]),
      ).toThrow();
    },
  );

  it.each([
    ['absent', undefined],
    ['unapproved', 'deepseek-v4-ultra'],
  ])(
    'rejects a %s model from a V20 durable default-off receipt',
    (_, model) => {
      const receipt = {
        schemaVersion: 'phase-6.9.5-v20-product-acceptance-default-off-v1',
        baseUrl: 'https://api.deepseek.com',
        component: 'review',
        container: {
          previousIdSha256: 'a'.repeat(64),
          newIdSha256: 'b'.repeat(64),
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
          healthContainerIdSha256: 'b'.repeat(64),
        },
        deterministicProbe: {
          passed: true,
          provenance: 'local_deterministic',
        },
        providerInvocations: 0,
        ...(model === undefined ? {} : { model }),
      };

      expect(() =>
        parseReviewPlannerV20ProductAcceptanceDefaultOff(receipt),
      ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    },
  );

  it('fails closed when a V20 durable record carries secret-like content', () => {
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceSlotResult({
        schemaVersion: 'phase-6.9.5-v20-product-acceptance-slot-result-v1',
        slot: 'review-api',
        traceSha256: 'b'.repeat(64),
        prompt: 'private',
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  });

  it('requires private, non-secret resource selectors so a failed run can be cleaned exactly', () => {
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceExecutionManifest({
        schemaVersion:
          'phase-6.9.5-v20-product-acceptance-execution-manifest-v1',
        environment: 'branch',
        attemptSha256,
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');

    expect(
      parseReviewPlannerV20ProductAcceptanceExecutionManifest({
        schemaVersion:
          'phase-6.9.5-v20-product-acceptance-execution-manifest-v1',
        environment: 'branch',
        attemptSha256,
        databaseUrlSha256: 'e'.repeat(64),
        resources: {
          accountId: {
            review: `v20-synthetic-account-review-${'a'.repeat(32)}`,
            planner: `v20-synthetic-account-planner-${'b'.repeat(32)}`,
          },
          fixtureId: {
            review: `v20-synthetic-fixture-review-${'c'.repeat(32)}`,
            planner: `v20-synthetic-fixture-planner-${'d'.repeat(32)}`,
          },
          browser: {
            executablePath:
              'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            profilePath:
              '.tmp/phase-6-9-5-v20-product-acceptance/branch/profile-v20',
          },
        },
      }),
    ).toMatchObject({
      resources: {
        accountId: {
          review: `v20-synthetic-account-review-${'a'.repeat(32)}`,
        },
      },
    });
  });

  it('requires an attempt-bound hash of the selected database URL without persisting the URL', () => {
    const record = {
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-execution-manifest-v1',
      environment: 'branch',
      attemptSha256,
      resources: {
        accountId: {
          review: `v20-synthetic-account-review-${'a'.repeat(32)}`,
          planner: `v20-synthetic-account-planner-${'b'.repeat(32)}`,
        },
        fixtureId: {
          review: `v20-synthetic-fixture-review-${'c'.repeat(32)}`,
          planner: `v20-synthetic-fixture-planner-${'d'.repeat(32)}`,
        },
        browser: {
          executablePath:
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          profilePath:
            '.tmp/phase-6-9-5-v20-product-acceptance/branch/profile-v20',
        },
      },
    };

    expect(() =>
      parseReviewPlannerV20ProductAcceptanceExecutionManifest(record),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
    expect(
      parseReviewPlannerV20ProductAcceptanceExecutionManifest({
        ...record,
        databaseUrlSha256: 'f'.repeat(64),
      }),
    ).toMatchObject({ databaseUrlSha256: 'f'.repeat(64) });
  });

  it('generates distinct V20-only selectors that bind cleanup to the reserved attempt', () => {
    const execution = createReviewPlannerV20ProductAcceptanceExecutionManifest({
      environment: 'branch',
      attemptSha256,
      databaseUrlSha256: 'f'.repeat(64),
    });

    expect(execution).toMatchObject({
      schemaVersion: 'phase-6.9.5-v20-product-acceptance-execution-manifest-v1',
      environment: 'branch',
      attemptSha256,
      databaseUrlSha256: 'f'.repeat(64),
      resources: {
        browser: {
          profilePath:
            '.tmp/phase-6-9-5-v20-product-acceptance/branch/profile-v20',
        },
      },
    });
    expect(execution.resources.accountId.review).toMatch(
      /^v20-synthetic-account-review-[a-f0-9]{32}$/,
    );
    expect(execution.resources.accountId.review).not.toBe(
      execution.resources.accountId.planner,
    );
  });

  it('accepts only the fixed V20 failure terminal vocabulary', () => {
    expect(
      parseReviewPlannerV20ProductAcceptanceFailure({
        schemaVersion: 'phase-6.9.5-v20-product-acceptance-failure-v1',
        environment: 'branch',
        attemptSha256,
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }),
    ).toMatchObject({ terminal: 'operation_failed' });
  });

  it('requires the reserved attempt hash in every recovery-authorizing failure', () => {
    expect(() =>
      parseReviewPlannerV20ProductAcceptanceFailure({
        schemaVersion: 'phase-6.9.5-v20-product-acceptance-failure-v1',
        environment: 'branch',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_setup',
        terminal: 'operation_failed',
        providerCallState: 'not_started',
      }),
    ).toThrow('V20_PRODUCT_ACCEPTANCE_LEDGER_RECORD_INVALID');
  });
});
