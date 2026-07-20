import { resolve } from 'node:path';

const mockRunDefaultHostPreflight = jest.fn();

jest.mock('./review-planner-v8-product-acceptance-composition', () => {
  const actual = jest.requireActual<
    typeof import('./review-planner-v8-product-acceptance-composition')
  >('./review-planner-v8-product-acceptance-composition');
  return {
    ...actual,
    createDefaultReviewPlannerV8ProductAcceptanceComposition: (
      _repoRoot: string,
      options: {
        preflightFactory(input: {
          environment: 'branch' | 'main';
          repoRoot: string;
        }): Promise<unknown>;
      },
    ) => ({
      ports: {
        preflight: (input: {
          environment: 'branch' | 'main';
          repoRoot: string;
        }) => options.preflightFactory(input),
      },
      dispose: () => Promise.resolve(),
    }),
    cleanupDefaultReviewPlannerProductAcceptanceBrowser: jest.fn(),
    restoreDefaultReviewPlannerProductAcceptanceServer: jest.fn(),
    runDefaultReviewPlannerProductAcceptanceHostPreflight:
      mockRunDefaultHostPreflight,
  };
});

import * as subject from './review-planner-v19-product-acceptance-host';

const root = resolve(__dirname, '../../../..');
const appsServerRoot = resolve(root, 'apps/server');

const validEvidence = Object.freeze({
  schemaVersion: 'phase-6.9.5-review-planner-v10-semantic-quality-v1',
  state: 'finalized',
  status: 'complete',
  gate: 'closed',
  terminalReason: 'passed',
  attempts: Object.freeze({ providerCount: 23, pairedAdmissionCount: 22 }),
  evidenceSha256: 'a'.repeat(64),
});

const defaultOffEntries = Object.freeze([
  'AI_PROVIDER_MODE=mock',
  'AI_ENABLE_LIVE_CALLS=false',
  'AI_MODEL=deepseek-v4-flash',
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
]);

type BridgeFactory = (
  repoRoot: string,
  options?: Readonly<{
    executeBunHelper?: (
      input: Readonly<{
        file: 'bun';
        args: readonly [string, string];
        cwd: string;
        timeoutMs: number;
        maxBuffer: number;
      }>,
    ) => Promise<Readonly<{ stdout: string }>>;
  }>,
) => Readonly<{
  profile: 'v10';
  readCommittedSuccess(repoRoot: string): Promise<Readonly<{
    providerAttemptCount: 23;
    pairedAdmissionCount: 22;
    evidenceSha256: string;
  }> | null>;
}>;

type BunAuthorityOptions = NonNullable<Parameters<BridgeFactory>[1]>;
type ExecuteBunHelper = NonNullable<BunAuthorityOptions['executeBunHelper']>;
type ExecuteBunHelperInput = Parameters<ExecuteBunHelper>[0];

function bridgeFactory(): BridgeFactory {
  const candidate = (
    subject as typeof subject & {
      createReviewPlannerV19BunPairedEvidenceAuthority?: unknown;
    }
  ).createReviewPlannerV19BunPairedEvidenceAuthority;
  if (typeof candidate !== 'function') {
    throw new Error('V19_BUN_AUTHORITY_BRIDGE_MISSING');
  }
  return candidate;
}

describe('Review Planner V19 Bun paired-evidence authority bridge', () => {
  beforeEach(() => {
    mockRunDefaultHostPreflight.mockReset();
    mockRunDefaultHostPreflight.mockImplementation(
      async (
        input: { environment: 'branch' | 'main'; repoRoot: string },
        options: {
          pairedEvidenceAuthority?: ReturnType<BridgeFactory>;
          assertDefaultOffEnvironment?(entries: readonly string[]): void;
        },
      ) => {
        const evidence =
          await options.pairedEvidenceAuthority?.readCommittedSuccess(
            input.repoRoot,
          );
        if (!evidence) {
          return Object.freeze({
            status: 'blocked' as const,
            code: 'preflight_failed' as const,
          });
        }
        options.assertDefaultOffEnvironment?.(defaultOffEntries);
        return Object.freeze({
          status: 'ready' as const,
          environment: input.environment,
          repoRoot: input.repoRoot,
          commitSha: 'b'.repeat(40),
          branchName: 'codex/v19-bun-authority-bridge',
          pairedEvidenceSha256: evidence.evidenceSha256,
          chromeExecutablePath:
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          utcStamp: '20260720T000000000Z',
        });
      },
    );
  });

  it('returns ready from the Node V19 host preflight when started in apps/server', async () => {
    const previousCwd = process.cwd();
    process.chdir(appsServerRoot);
    try {
      const host =
        subject.createDefaultReviewPlannerV19ProductAcceptanceHost(root);
      const preflight = await host.preflight({
        environment: 'branch',
        repoRoot: root,
      });
      expect(preflight.status).toBe('ready');
      if (preflight.status !== 'ready') {
        throw new Error('V19_BUN_AUTHORITY_PRELIGHT_BLOCKED');
      }
      expect(preflight.repoRoot).toBe(root);
      expect(preflight.pairedEvidenceSha256).toMatch(/^[a-f0-9]{64}$/);
      await host.dispose();
    } finally {
      process.chdir(previousCwd);
    }
  });

  it.each([
    ['malformed helper JSON', () => Promise.resolve({ stdout: '{not-json' })],
    [
      'unsafe helper record',
      () =>
        Promise.resolve({
          stdout: JSON.stringify({ ...validEvidence, prompt: 'x' }),
        }),
    ],
    ['helper process error', () => Promise.reject(new Error('raw error'))],
  ])('fails closed for %s', async (_label, executeBunHelper) => {
    const authority = bridgeFactory()(root, { executeBunHelper });

    await expect(authority.readCommittedSuccess(root)).resolves.toBeNull();
  });

  it('accepts only the strict safe record emitted by the fixed helper', async () => {
    const invocations: ExecuteBunHelperInput[] = [];
    const executeBunHelper: ExecuteBunHelper = (input) => {
      invocations.push(input);
      return Promise.resolve({ stdout: JSON.stringify(validEvidence) });
    };
    const authority = bridgeFactory()(root, { executeBunHelper });

    await expect(authority.readCommittedSuccess(root)).resolves.toEqual({
      providerAttemptCount: 23,
      pairedAdmissionCount: 22,
      evidenceSha256: validEvidence.evidenceSha256,
    });
    expect(invocations).toEqual([
      {
        file: 'bun',
        args: [
          resolve(
            root,
            'apps/server/scripts/review-planner-v19-v10-paired-evidence-authority.ts',
          ),
          root,
        ],
        cwd: root,
        timeoutMs: 5_000,
        maxBuffer: 8 * 1024,
      },
    ]);
  });
});
