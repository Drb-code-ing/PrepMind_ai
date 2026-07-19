/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- typed Jest fixtures intentionally use matcher values and async port signatures */
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
  buildReviewPlannerV8ActivationEnvironment,
  buildReviewPlannerV8DefaultOffEnvironment,
  buildReviewPlannerV8ServerRecreateCommand,
  captureReviewPlannerV8RepositorySnapshot,
  captureReviewPlannerV8RepositorySnapshotFromAuthority,
  createReviewPlannerV11ProductAcceptanceDiagnosticsPort,
  createDefaultReviewPlannerV11ProductAcceptanceComposition,
  createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition,
  runReviewPlannerV11ProductAcceptanceComposition,
  runReviewPlannerV11ProductAcceptanceRecoveryComposition,
  createReviewPlannerV9PairedEvidenceAuthority,
  assertReviewPlannerV8EvidenceIndexIsOrdinary,
  createDefaultReviewPlannerV8ProductAcceptanceComposition,
  createDefaultReviewPlannerV8ProductAcceptanceRecoveryComposition,
  executeReviewPlannerV8ProductAcceptanceProductCli,
  executeReviewPlannerV8ProductAcceptanceRecoveryCli,
  mergeReviewPlannerV8AcceptanceHeaders,
  parseReviewPlannerV8GitPorcelainSnapshot,
  parseReviewPlannerV8ServerInspection,
  parseReviewPlannerV8ProductAcceptanceArguments,
  runReviewPlannerV8ProductAcceptanceProductCli,
  runReviewPlannerV8ProductAcceptanceRecoveryCli,
  serializeReviewPlannerV8ProductAcceptanceCliSummary,
  sha256ReviewPlannerV8CompositionValue,
  selectReviewPlannerV8ExactBrowserProcesses,
  terminateReviewPlannerV8ExactBrowser,
  waitForReviewPlannerV8ServerReadiness,
  type ReviewPlannerV8ProductAcceptanceCompositionPorts,
  type ReviewPlannerV8ProductAcceptanceRecoveryCompositionPorts,
  type ReviewPlannerV11ProductAcceptanceCompositionPorts,
  type ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts,
} from './review-planner-v8-product-acceptance-composition';
import { chromium } from 'playwright-core';
import * as legacyV8Evidence from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import { REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE } from './review-planner-controlled-live-eval-v10-semantic-quality.evidence';
import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE,
} from './review-planner-product-acceptance-profile';

const SHA = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const CONTAINER_ID = 'c'.repeat(64);
const CHROME_EXE = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const V9_DIAGNOSTIC_SCHEMA_VERSION =
  'phase-6.9.5-review-planner-v10-semantic-quality-v1';
const BROWSER_PROFILE =
  'E:\\PrepMind_ai智能备考助手\\.tmp\\phase-6-9-5-v8-product-acceptance\\branch\\profile-v8';
const COMMITTED_V8_CANDIDATE = `${JSON.stringify({
  schemaVersion:
    REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE.evidenceSchemaVersion,
  state: 'success_candidate',
  status: 'complete',
  gate: 'closed',
  providerAttemptCount: 23,
  usageKnown: true,
  aggregateInputTokens: 42_996,
  aggregateOutputTokens: 9_712,
  observedCostCny: 0.18726,
  priceProfileId:
    REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  caseEntries: 48,
  zeroCallCases: 26,
  runtimeInvocations: 22,
  strictSuccesses: 48,
  qualityPasses: 48,
  criticalFailures: 0,
  successCommitmentSha256: 'd'.repeat(64),
  stageManifestSha256: 'e'.repeat(64),
})}\n`;
const REPO_ROOT = 'E:\\PrepMind_ai智能备考助手';

describe('V8 product acceptance executable composition', () => {
  it('accepts only committed V9 success and never reads legacy V8 evidence', async () => {
    const legacyReader = jest.spyOn(
      legacyV8Evidence,
      'readReviewPlannerControlledLiveV8Evidence',
    );
    const readEvidence = jest
      .fn()
      .mockResolvedValueOnce(v9Evidence('complete'))
      .mockResolvedValueOnce(v9Evidence('diagnostic'));
    const authority = createReviewPlannerV9PairedEvidenceAuthority({
      readEvidence,
    });

    await expect(authority.readCommittedSuccess(REPO_ROOT)).resolves.toEqual({
      providerAttemptCount: 23,
      pairedAdmissionCount: 22,
      evidenceSha256: SHA,
    });
    await expect(authority.readCommittedSuccess(REPO_ROOT)).resolves.toBeNull();
    expect(authority.profile).toBe('v10');
    expect(legacyReader).not.toHaveBeenCalled();
    legacyReader.mockRestore();
  });

  it.each([
    ['pending', { ...v9Evidence('diagnostic'), status: 'pending' }],
    [
      'evidence_io',
      { status: 'invalid_attempted', diagnosticCode: 'evidence_io' },
    ],
    [
      'unknown profile',
      { ...v9Evidence('complete'), schemaVersion: 'unknown-v9' },
    ],
    ['bad hash', { ...v9Evidence('complete'), evidenceSha256: 'A'.repeat(64) }],
    [
      'hostile getter',
      Object.defineProperty({}, 'status', {
        get() {
          throw new Error('PRIVATE_V9_EVIDENCE');
        },
      }),
    ],
  ] as const)('rejects %s V9 evidence safely', async (_name, evidence) => {
    const authority = createReviewPlannerV9PairedEvidenceAuthority({
      readEvidence: jest.fn(async () => evidence as Record<string, unknown>),
    });

    await expect(authority.readCommittedSuccess(REPO_ROOT)).resolves.toBeNull();
  });

  it('captures the stable Git snapshot with the V9 authority hash', async () => {
    const status = `# branch.oid ${COMMIT}\n# branch.head codex/phase-6-9-5\n`;
    const authority = createReviewPlannerV9PairedEvidenceAuthority({
      readEvidence: jest.fn(async () => v9Evidence('complete')),
    });
    const readGitStatus = jest.fn(async () => status);
    const listEvidencePaths = jest.fn(async () => V9_EVIDENCE_PATHS);
    const readEvidenceIndex = jest.fn(async () =>
      ordinaryEvidenceIndex(V9_EVIDENCE_PATHS),
    );

    await expect(
      captureReviewPlannerV8RepositorySnapshotFromAuthority({
        readGitStatus,
        listEvidencePaths,
        readEvidenceIndex,
        authority,
        repoRoot: REPO_ROOT,
      }),
    ).resolves.toEqual({
      commitSha: COMMIT,
      branchName: 'codex/phase-6-9-5',
      clean: true,
      pairedEvidenceSha256: SHA,
    });
    expect(listEvidencePaths).toHaveBeenCalledTimes(2);
    expect(readEvidenceIndex).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['lowercase assume-unchanged', 'h'],
    ['skip-worktree', 'S'],
  ] as const)(
    'rejects a %s V9 evidence index marker',
    async (_name, marker) => {
      const lines = ordinaryEvidenceIndex(V9_EVIDENCE_PATHS).split('\n');
      lines[0] = `${marker} ${V9_EVIDENCE_PATHS[0]}`;

      await expect(
        captureAuthoritySnapshot({ indexes: [`${lines.join('\n')}\n`] }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
    },
  );

  it('rejects a missing tracked V9 evidence leaf', async () => {
    await expect(
      captureAuthoritySnapshot({
        indexes: [ordinaryEvidenceIndex(V9_EVIDENCE_PATHS.slice(1))],
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
  });

  it('rejects an extra untracked V9 evidence leaf', async () => {
    await expect(
      captureAuthoritySnapshot({
        paths: [[...V9_EVIDENCE_PATHS, `${V9_EVIDENCE_DIRECTORY}/extra`]],
        indexes: [ordinaryEvidenceIndex(V9_EVIDENCE_PATHS)],
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
  });

  it('rejects V9 evidence leaf drift across the authority read', async () => {
    const drifted = [...V9_EVIDENCE_PATHS, `${V9_EVIDENCE_DIRECTORY}/extra`];

    await expect(
      captureAuthoritySnapshot({
        paths: [V9_EVIDENCE_PATHS, drifted],
        indexes: [
          ordinaryEvidenceIndex(V9_EVIDENCE_PATHS),
          ordinaryEvidenceIndex(drifted),
        ],
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_REPOSITORY_DRIFTED');
  });

  it('selects only the Chrome process with the exact normalized user-data-dir argument', () => {
    const exact = {
      processId: 101,
      executablePath: CHROME_EXE,
      commandLine: `"${CHROME_EXE}" --user-data-dir="${BROWSER_PROFILE}" --remote-debugging-port=0`,
    };
    const prefixCollision = {
      ...exact,
      processId: 102,
      commandLine: `"${CHROME_EXE}" --user-data-dir="${BROWSER_PROFILE}-copy"`,
    };
    const substringCollision = {
      ...exact,
      processId: 103,
      commandLine: `"${CHROME_EXE}" --note="${BROWSER_PROFILE}"`,
    };

    expect(
      selectReviewPlannerV8ExactBrowserProcesses(
        [exact, prefixCollision, substringCollision],
        CHROME_EXE,
        BROWSER_PROFILE,
      ).map((process) => process.processId),
    ).toEqual([101]);
  });

  it('terminates only exact browser identities and removes the profile after zero-process verification', async () => {
    const exact = {
      processId: 201,
      executablePath: CHROME_EXE,
      commandLine: `"${CHROME_EXE}" --user-data-dir=${BROWSER_PROFILE}`,
    };
    const similar = {
      ...exact,
      processId: 202,
      commandLine: `"${CHROME_EXE}" --user-data-dir=${BROWSER_PROFILE}-copy`,
    };
    const listProcesses = jest
      .fn()
      .mockResolvedValueOnce([exact, similar])
      .mockResolvedValueOnce([similar]);
    const terminateProcess = jest.fn(async () => undefined);
    const removeProfile = jest.fn(async () => undefined);

    await expect(
      terminateReviewPlannerV8ExactBrowser({
        executablePath: CHROME_EXE,
        profilePath: BROWSER_PROFILE,
        listProcesses,
        terminateProcess,
        removeProfile,
        profileExists: () => false,
        timeoutMs: 100,
        pollIntervalMs: 1,
      }),
    ).resolves.toEqual({ terminatedProcessIds: [201], remaining: 0 });
    expect(terminateProcess).toHaveBeenCalledTimes(1);
    expect(terminateProcess.mock.calls[0][0]).toEqual(exact);
    expect(removeProfile).toHaveBeenCalledTimes(1);
  });

  it('does not remove a browser profile while an exact process still remains', async () => {
    const exact = {
      processId: 301,
      executablePath: CHROME_EXE,
      commandLine: `"${CHROME_EXE}" --user-data-dir=${BROWSER_PROFILE}`,
    };
    const removeProfile = jest.fn(async () => undefined);

    await expect(
      terminateReviewPlannerV8ExactBrowser({
        executablePath: CHROME_EXE,
        profilePath: BROWSER_PROFILE,
        listProcesses: async () => [exact],
        terminateProcess: async () => undefined,
        removeProfile,
        profileExists: () => true,
        timeoutMs: 20,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
    expect(removeProfile).not.toHaveBeenCalled();
  });

  it('terminates an exact Chrome child discovered after the initial snapshot', async () => {
    const late = {
      processId: 351,
      executablePath: CHROME_EXE,
      commandLine: `"${CHROME_EXE}" --user-data-dir=${BROWSER_PROFILE} --type=renderer`,
    };
    let terminated = false;
    let listCount = 0;
    const terminateProcess = jest.fn(async () => {
      terminated = true;
    });

    await expect(
      terminateReviewPlannerV8ExactBrowser({
        executablePath: CHROME_EXE,
        profilePath: BROWSER_PROFILE,
        listProcesses: async () => {
          listCount += 1;
          if (listCount === 1) return [];
          return terminated ? [] : [late];
        },
        terminateProcess,
        removeProfile: async () => undefined,
        profileExists: () => false,
        timeoutMs: 100,
        pollIntervalMs: 1,
      }),
    ).resolves.toEqual({ terminatedProcessIds: [351], remaining: 0 });
    expect(terminateProcess).toHaveBeenCalledTimes(1);
    expect(terminateProcess.mock.calls[0][0]).toEqual(late);
  });

  it.each(['initial list', 'terminate', 'residual list'] as const)(
    'bounds a hanging browser %s operation by the same drain deadline',
    async (stage) => {
      const exact = {
        processId: 401,
        executablePath: CHROME_EXE,
        commandLine: `"${CHROME_EXE}" --user-data-dir=${BROWSER_PROFILE}`,
      };
      const hangUntilAbort = (signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        });
      const listProcesses =
        stage === 'initial list'
          ? hangUntilAbort
          : stage === 'residual list'
            ? jest
                .fn()
                .mockResolvedValueOnce([exact])
                .mockImplementationOnce(hangUntilAbort)
            : async () => [exact];
      const terminateProcess =
        stage === 'terminate'
          ? (_process: typeof exact, signal: AbortSignal) =>
              hangUntilAbort(signal)
          : async () => undefined;
      const removeProfile = jest.fn(async () => undefined);
      const startedAt = Date.now();

      await expect(
        terminateReviewPlannerV8ExactBrowser({
          executablePath: CHROME_EXE,
          profilePath: BROWSER_PROFILE,
          listProcesses,
          terminateProcess,
          removeProfile,
          profileExists: () => false,
          timeoutMs: 25,
          pollIntervalMs: 1,
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
      expect(Date.now() - startedAt).toBeLessThan(500);
      expect(removeProfile).not.toHaveBeenCalled();
    },
  );

  it('waits for a timed-out profile removal to settle before rejecting', async () => {
    let removalSettled = false;
    const profileExists = jest.fn(() => false);
    const startedAt = Date.now();

    await expect(
      terminateReviewPlannerV8ExactBrowser({
        executablePath: CHROME_EXE,
        profilePath: BROWSER_PROFILE,
        listProcesses: async () => [],
        terminateProcess: async () => undefined,
        removeProfile: async () => {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 35));
          removalSettled = true;
        },
        profileExists,
        timeoutMs: 20,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_BROWSER_DRAIN_TIMEOUT');
    expect(removalSettled).toBe(true);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(30);
    expect(profileExists).not.toHaveBeenCalled();
  });

  it('strictly attests the expected healthy Compose server identity and published port', () => {
    const inspection = JSON.stringify({
      id: CONTAINER_ID,
      environment: ['AI_PROVIDER_MODE=mock'],
      status: 'running',
      health: 'healthy',
      labels: {
        'com.docker.compose.project': 'docker',
        'com.docker.compose.service': 'server',
      },
      ports: {
        '3001/tcp': [
          { HostIp: '0.0.0.0', HostPort: '3001' },
          { HostIp: '::', HostPort: '3001' },
        ],
      },
    });

    expect(
      parseReviewPlannerV8ServerInspection(inspection, CONTAINER_ID),
    ).toMatchObject({
      id: CONTAINER_ID,
      status: 'running',
      health: 'healthy',
      composeProject: 'docker',
      composeService: 'server',
      publishedPort: 3001,
    });
    expect(() =>
      parseReviewPlannerV8ServerInspection(inspection, 'd'.repeat(64)),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
    expect(() =>
      parseReviewPlannerV8ServerInspection(
        JSON.stringify({
          ...JSON.parse(inspection),
          ports: {
            '3001/tcp': [{ HostIp: '0.0.0.0', HostPort: '3999' }],
          },
        }),
        CONTAINER_ID,
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
  });

  it('fails before health fetch when Compose points at a stale container id', async () => {
    const fetchHealth = jest.fn(async () => true);

    await expect(
      waitForReviewPlannerV8ServerReadiness({
        expectedContainerId: CONTAINER_ID,
        readCurrentContainerId: async () => 'd'.repeat(64),
        inspectContainer: async () => healthyInspection(),
        fetchHealth,
        totalTimeoutMs: 50,
        attemptTimeoutMs: 10,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
    expect(fetchHealth).not.toHaveBeenCalled();
  });

  it('bounds a hanging health fetch and rechecks container identity after success', async () => {
    const startedAt = Date.now();
    await expect(
      waitForReviewPlannerV8ServerReadiness({
        expectedContainerId: CONTAINER_ID,
        readCurrentContainerId: async () => CONTAINER_ID,
        inspectContainer: async () => healthyInspection(),
        fetchHealth: (signal) =>
          new Promise<boolean>((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
        totalTimeoutMs: 35,
        attemptTimeoutMs: 10,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_HEALTH_TIMEOUT');
    expect(Date.now() - startedAt).toBeLessThan(500);

    const readCurrentContainerId = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce(CONTAINER_ID)
      .mockResolvedValueOnce('d'.repeat(64));
    await expect(
      waitForReviewPlannerV8ServerReadiness({
        expectedContainerId: CONTAINER_ID,
        readCurrentContainerId,
        inspectContainer: async () => healthyInspection(),
        fetchHealth: async () => true,
        totalTimeoutMs: 50,
        attemptTimeoutMs: 10,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_CONTAINER_IDENTITY_INVALID');
  });

  it.each(['container id', 'container inspect'] as const)(
    'bounds a hanging %s read by the same total readiness deadline',
    async (stage) => {
      const hangUntilAbort = (signal: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        });
      const startedAt = Date.now();

      await expect(
        waitForReviewPlannerV8ServerReadiness({
          expectedContainerId: CONTAINER_ID,
          readCurrentContainerId:
            stage === 'container id'
              ? hangUntilAbort
              : async () => CONTAINER_ID,
          inspectContainer:
            stage === 'container inspect'
              ? hangUntilAbort
              : async () => healthyInspection(),
          fetchHealth: async () => true,
          totalTimeoutMs: 35,
          attemptTimeoutMs: 10,
          pollIntervalMs: 1,
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_HEALTH_TIMEOUT');
      expect(Date.now() - startedAt).toBeLessThan(500);
    },
  );

  it('strictly parses one clean Git porcelain-v2 branch snapshot and detects worktree drift', () => {
    expect(
      parseReviewPlannerV8GitPorcelainSnapshot(
        `# branch.oid ${COMMIT}\n# branch.head codex/phase-6-9-5\n`,
      ),
    ).toEqual({
      commitSha: COMMIT,
      branchName: 'codex/phase-6-9-5',
      clean: true,
    });
    expect(
      parseReviewPlannerV8GitPorcelainSnapshot(
        `# branch.oid ${COMMIT}\n# branch.head codex/phase-6-9-5\n1 .M N... 100644 100644 100644 ${COMMIT} ${COMMIT} tracked.ts\n`,
      ).clean,
    ).toBe(false);
    expect(() =>
      parseReviewPlannerV8GitPorcelainSnapshot(
        `# branch.oid ${COMMIT}\n# branch.oid ${COMMIT}\n# branch.head main\n`,
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_GIT_SNAPSHOT_INVALID');
  });

  it('rejects a torn repository snapshot and hashes evidence from the captured commit tree', async () => {
    const first = `# branch.oid ${COMMIT}\n# branch.head codex/phase-6-9-5\n`;
    const driftedCommit = 'c'.repeat(40);
    const second = `# branch.oid ${driftedCommit}\n# branch.head codex/phase-6-9-5\n`;
    const readGitStatus = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const readCommittedEvidence = jest.fn(async () => COMMITTED_V8_CANDIDATE);

    await expect(
      captureReviewPlannerV8RepositorySnapshot({
        readGitStatus,
        readEvidenceReference: async () => ({
          relativePath: 'docs/acceptance/evidence/v8/report.json',
        }),
        readCommittedEvidence,
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_REPOSITORY_DRIFTED');
    expect(readCommittedEvidence).toHaveBeenCalledWith(
      COMMIT,
      'docs/acceptance/evidence/v8/report.json',
    );

    await expect(
      captureReviewPlannerV8RepositorySnapshot({
        readGitStatus: jest.fn(async () => first),
        readEvidenceReference: async () => ({
          relativePath: 'docs/acceptance/evidence/v8/report.json',
        }),
        readCommittedEvidence: async () => COMMITTED_V8_CANDIDATE,
      }),
    ).resolves.toMatchObject({
      commitSha: COMMIT,
      branchName: 'codex/phase-6-9-5',
      clean: true,
      pairedEvidenceSha256: sha256ReviewPlannerV8CompositionValue(
        COMMITTED_V8_CANDIDATE,
      ),
    });
  });

  it('rejects assume-unchanged or skip-worktree evidence index entries', () => {
    const expected = ['docs/acceptance/evidence/v8/report.json'];
    expect(() =>
      assertReviewPlannerV8EvidenceIndexIsOrdinary(
        'h docs/acceptance/evidence/v8/report.json\n',
        expected,
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
    expect(() =>
      assertReviewPlannerV8EvidenceIndexIsOrdinary(
        'S docs/acceptance/evidence/v8/report.json\n',
        expected,
      ),
    ).toThrow('V8_PRODUCT_ACCEPTANCE_EVIDENCE_INDEX_INVALID');
    expect(() =>
      assertReviewPlannerV8EvidenceIndexIsOrdinary(
        'H docs/acceptance/evidence/v8/report.json\n',
        expected,
      ),
    ).not.toThrow();
  });

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
      AI_BASE_URL: 'https://api.deepseek.com/v1',
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

  it('builds an activation environment accepted by the production V4 Pro executor config parser', () => {
    const activationEnvironment = buildReviewPlannerV8ActivationEnvironment(
      'review',
      'a'.repeat(64),
      'provider-secret',
    );

    expect(
      resolveReviewPlannerLiveExecutorConfig({
        ...activationEnvironment,
        AI_BASE_URL: 'https://api.deepseek.com',
      }),
    ).toBeNull();
    expect(
      resolveReviewPlannerLiveExecutorConfig(activationEnvironment),
    ).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
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
      'preflight:revalidate',
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

  it('fails before ledger reservation or synthetic side effects when Git or paired evidence drifts after preflight', async () => {
    const fixture = createPorts({ revalidationStatus: 'drifted' });

    await expect(runProduct(fixture.ports)).rejects.toThrow(
      'V8_PRODUCT_ACCEPTANCE_OPERATION_FAILED',
    );
    expect(fixture.order).toEqual([
      'preflight',
      'owner:product',
      'preflight:revalidate',
      'owner:close',
    ]);
    expect(fixture.ports.reserveLedger).not.toHaveBeenCalled();
    expect(fixture.ports.registerAccount).not.toHaveBeenCalled();
    expect(fixture.ports.createFixtures).not.toHaveBeenCalled();
    expect(fixture.ports.createRunnerDependencies).not.toHaveBeenCalled();
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

describe('V11 execution-bridge composition', () => {
  it('uses the default V11 boundary before ownership and never falls through to a V8 path', async () => {
    const runtime = {
      dockerExec: jest.fn(() => {
        throw new Error('unexpected docker execution');
      }),
      apiProvider: jest.fn(() => {
        throw new Error('unexpected api/provider execution');
      }),
      chromium: jest.fn(() => {
        throw new Error('unexpected chromium execution');
      }),
      fetch: jest.fn(() => {
        throw new Error('unexpected fetch execution');
      }),
    };
    const preflight = jest.fn(async () => ({
      status: 'ready' as const,
      environment: 'branch' as const,
      repoRoot: 'E:\\v11-default-boundary',
      commitSha: COMMIT,
      chromeExecutablePath: CHROME_EXE,
    }));
    const acquireOwner = jest.fn(async () => ({
      status: 'owner_active' as const,
    }));
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceComposition(
        'E:\\v11-default-boundary',
        {
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: jest.fn(async () => undefined) } as never,
          boundary: { preflight, acquireOwner, runtime },
        } as never,
      );

    try {
      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: 'E:\\v11-default-boundary',
          ports: composition.ports,
        }),
      ).resolves.toEqual({ status: 'blocked', stage: 'owner' });
      expect(preflight).toHaveBeenCalledTimes(1);
      expect(acquireOwner).toHaveBeenCalledTimes(1);
      expect(runtime.dockerExec).not.toHaveBeenCalled();
      expect(runtime.apiProvider).not.toHaveBeenCalled();
      expect(runtime.chromium).not.toHaveBeenCalled();
      expect(runtime.fetch).not.toHaveBeenCalled();
    } finally {
      await composition.dispose();
    }
  });

  it('routes actual V11 preflight compose and health checks through injected adapters before owner blocks', async () => {
    const evidenceDirectory =
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
    const evidencePaths = (await readdir(resolve(REPO_ROOT, evidenceDirectory)))
      .sort()
      .map((name) => `${evidenceDirectory}/${name}`);
    const counts = {
      git: 0,
      docker: 0,
      health: 0,
      apiProvider: 0,
      chromium: 0,
      fetchObserver: 0,
    };
    const readOnlyExec = jest.fn(
      async (input: { file: string; args: readonly string[] }) => {
        if (input.file === 'git') {
          counts.git += 1;
          if (input.args[0] === 'status') {
            return `# branch.oid ${COMMIT}\n# branch.head codex/v11-preflight-fake\n`;
          }
          if (input.args[0] === 'ls-files') {
            return ordinaryEvidenceIndex(evidencePaths);
          }
        }
        if (input.file === 'docker') {
          counts.docker += 1;
          if (input.args[0] === 'compose') return `${CONTAINER_ID}\n`;
          if (input.args[0] === 'inspect') {
            return JSON.stringify({
              id: CONTAINER_ID,
              environment: Object.entries(
                buildReviewPlannerV8DefaultOffEnvironment(),
              ).map(([key, value]) => `${key}=${value}`),
              status: 'running',
              health: 'healthy',
              labels: {
                'com.docker.compose.project': 'docker',
                'com.docker.compose.service': 'server',
              },
              ports: {
                '3001/tcp': [{ HostIp: '127.0.0.1', HostPort: '3001' }],
              },
            });
          }
        }
        throw new Error('unexpected read-only process');
      },
    );
    const fetchHealth = jest.fn(async () => {
      counts.health += 1;
      return new Response(null, { status: 200 });
    });
    const acquireOwner = jest.fn(async () => ({
      status: 'owner_active' as const,
    }));
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceComposition(REPO_ROOT, {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: { $disconnect: jest.fn(async () => undefined) } as never,
        pairedEvidenceAuthority: {
          profile: 'v10',
          readCommittedSuccess: jest.fn(async () => ({
            providerAttemptCount: 23 as const,
            pairedAdmissionCount: 22 as const,
            evidenceSha256: SHA,
          })),
        },
        boundary: {
          acquireOwner,
          runtime: {
            readOnlyExec,
            fetchHealth,
            fetch: () => {
              counts.fetchObserver += 1;
            },
            apiProvider: () => {
              counts.apiProvider += 1;
              throw new Error('unexpected api/provider execution');
            },
            chromium: () => {
              counts.chromium += 1;
              throw new Error('unexpected chromium execution');
            },
          },
        },
      } as never);

    try {
      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: REPO_ROOT,
          ports: composition.ports,
        }),
      ).resolves.toEqual({ status: 'blocked', stage: 'owner' });
      expect(acquireOwner).toHaveBeenCalledTimes(1);
      expect(counts.git).toBeGreaterThan(0);
      expect(counts.docker).toBeGreaterThan(0);
      expect(counts.health).toBeGreaterThan(0);
      expect(counts.fetchObserver).toBeGreaterThan(0);
      expect(counts.apiProvider).toBe(0);
      expect(counts.chromium).toBe(0);
    } finally {
      await composition.dispose();
    }
  });

  it.each([
    [
      'admits the safe mock Flash Chat model',
      { AI_MODEL: 'deepseek-v4-flash' },
      'owner',
    ],
    ['rejects a live provider mode', { AI_PROVIDER_MODE: 'live' }, 'preflight'],
    [
      'rejects enabled live calls',
      { AI_ENABLE_LIVE_CALLS: 'true' },
      'preflight',
    ],
    [
      'rejects enabled Review model gate',
      { REVIEW_AGENT_MODEL_ENABLED: 'true' },
      'preflight',
    ],
    [
      'rejects enabled Planner model gate',
      { PLANNER_AGENT_MODEL_ENABLED: 'true' },
      'preflight',
    ],
    [
      'rejects enabled product acceptance capability',
      { REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED: 'true' },
      'preflight',
    ],
  ] as const)(
    'V11 canonical preflight %s',
    async (_label, override, expectedStage) => {
      const evidenceDirectory =
        REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
      const evidencePaths = (
        await readdir(resolve(REPO_ROOT, evidenceDirectory))
      )
        .sort()
        .map((name) => `${evidenceDirectory}/${name}`);
      const environment = {
        ...buildReviewPlannerV8DefaultOffEnvironment(),
        ...override,
      };
      const acquireOwner = jest.fn(async () => ({
        status: 'owner_active' as const,
      }));
      const composition =
        createDefaultReviewPlannerV11ProductAcceptanceComposition(REPO_ROOT, {
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: jest.fn(async () => undefined) } as never,
          pairedEvidenceAuthority: {
            profile: 'v10',
            readCommittedSuccess: jest.fn(async () => ({
              providerAttemptCount: 23 as const,
              pairedAdmissionCount: 22 as const,
              evidenceSha256: SHA,
            })),
          },
          boundary: {
            acquireOwner,
            runtime: {
              readOnlyExec: async (input: {
                file: string;
                args: readonly string[];
              }) => {
                if (input.file === 'git' && input.args[0] === 'status') {
                  return `# branch.oid ${COMMIT}\n# branch.head codex/v11-preflight-fake\n`;
                }
                if (input.file === 'git' && input.args[0] === 'ls-files') {
                  return ordinaryEvidenceIndex(evidencePaths);
                }
                if (input.file === 'docker' && input.args[0] === 'compose') {
                  return `${CONTAINER_ID}\n`;
                }
                if (input.file === 'docker' && input.args[0] === 'inspect') {
                  return JSON.stringify({
                    id: CONTAINER_ID,
                    environment: Object.entries(environment).map(
                      ([key, value]) => `${key}=${value}`,
                    ),
                    status: 'running',
                    health: 'healthy',
                    labels: {
                      'com.docker.compose.project': 'docker',
                      'com.docker.compose.service': 'server',
                    },
                    ports: {
                      '3001/tcp': [{ HostIp: '127.0.0.1', HostPort: '3001' }],
                    },
                  });
                }
                throw new Error('unexpected read-only process');
              },
              fetchHealth: async () => new Response(null, { status: 200 }),
            },
          },
        } as never);

      try {
        await expect(
          runReviewPlannerV11ProductAcceptanceComposition({
            environment: 'branch',
            repoRoot: REPO_ROOT,
            ports: composition.ports,
          }),
        ).resolves.toEqual({ status: 'blocked', stage: expectedStage });
        expect(acquireOwner).toHaveBeenCalledTimes(
          expectedStage === 'owner' ? 1 : 0,
        );
      } finally {
        await composition.dispose();
      }
    },
  );

  it('revalidates canonical V11 repo and default-off facts through adapters after owner acquisition', async () => {
    const evidenceDirectory =
      REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE.evidenceDirectory;
    const evidencePaths = (await readdir(resolve(REPO_ROOT, evidenceDirectory)))
      .sort()
      .map((name) => `${evidenceDirectory}/${name}`);
    const driftCommit = 'd'.repeat(40);
    const order: string[] = [];
    let gitStatusReads = 0;
    const runtimeCounts = {
      dockerExec: 0,
      apiProvider: 0,
      chromium: 0,
    };
    const readOnlyExec = jest.fn(
      async (input: { file: string; args: readonly string[] }) => {
        const phase = gitStatusReads >= 3 ? 'revalidate' : 'preflight';
        if (input.file === 'git' && input.args[0] === 'status') {
          gitStatusReads += 1;
          const statusPhase = gitStatusReads >= 3 ? 'revalidate' : 'preflight';
          order.push(`${statusPhase}:git-status`);
          const commit = gitStatusReads >= 3 ? driftCommit : COMMIT;
          return `# branch.oid ${commit}\n# branch.head codex/v11-preflight-fake\n`;
        }
        if (input.file === 'git' && input.args[0] === 'ls-files') {
          order.push(`${phase}:git-index`);
          return ordinaryEvidenceIndex(evidencePaths);
        }
        if (input.file === 'docker' && input.args[0] === 'compose') {
          order.push(`${phase}:docker-compose`);
          return `${CONTAINER_ID}\n`;
        }
        if (input.file === 'docker' && input.args[0] === 'inspect') {
          order.push(`${phase}:docker-inspect`);
          return JSON.stringify({
            id: CONTAINER_ID,
            environment: Object.entries(
              buildReviewPlannerV8DefaultOffEnvironment(),
            ).map(([key, value]) => `${key}=${value}`),
            status: 'running',
            health: 'healthy',
            labels: {
              'com.docker.compose.project': 'docker',
              'com.docker.compose.service': 'server',
            },
            ports: {
              '3001/tcp': [{ HostIp: '127.0.0.1', HostPort: '3001' }],
            },
          });
        }
        throw new Error('unexpected read-only process');
      },
    );
    const owner = Object.freeze({
      assertHeld: jest.fn(),
      close: jest.fn(() => order.push('owner:close')),
    });
    const acquireOwner = jest.fn(async () => {
      order.push('owner');
      return { status: 'acquired' as const, owner };
    });
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceComposition(REPO_ROOT, {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: { $disconnect: jest.fn(async () => undefined) } as never,
        pairedEvidenceAuthority: {
          profile: 'v10',
          readCommittedSuccess: jest.fn(async () => ({
            providerAttemptCount: 23 as const,
            pairedAdmissionCount: 22 as const,
            evidenceSha256: SHA,
          })),
        },
        boundary: {
          acquireOwner,
          runtime: {
            readOnlyExec,
            fetchHealth: async () => {
              const phase = gitStatusReads >= 3 ? 'revalidate' : 'preflight';
              order.push(`${phase}:health`);
              return new Response(null, { status: 200 });
            },
            fetch: () => {
              const phase = gitStatusReads >= 3 ? 'revalidate' : 'preflight';
              order.push(`${phase}:fetch`);
            },
            dockerExec: () => {
              runtimeCounts.dockerExec += 1;
              throw new Error('unexpected docker execution');
            },
            apiProvider: () => {
              runtimeCounts.apiProvider += 1;
              throw new Error('unexpected api/provider execution');
            },
            chromium: () => {
              runtimeCounts.chromium += 1;
              throw new Error('unexpected chromium execution');
            },
          },
        },
      } as never);
    const reserveLedger = jest
      .spyOn(composition.ports, 'reserveLedger')
      .mockRejectedValue(new Error('unexpected reserve'));
    const writeExecutionManifest = jest.spyOn(
      composition.ports,
      'writeExecutionManifest',
    );
    const createFixtures = jest.spyOn(composition.ports, 'createFixtures');
    const prepareRecoveryJournal = jest.spyOn(
      composition.ports,
      'prepareRecoveryJournal',
    );
    const createRunner = jest.spyOn(composition.ports, 'createRunner');

    try {
      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: REPO_ROOT,
          ports: composition.ports,
        }),
      ).resolves.toEqual({ status: 'blocked', stage: 'revalidate' });
      expect(order).toEqual([
        'preflight:git-status',
        'preflight:git-index',
        'preflight:git-index',
        'preflight:git-status',
        'preflight:docker-compose',
        'preflight:docker-compose',
        'preflight:docker-inspect',
        'preflight:fetch',
        'preflight:health',
        'preflight:docker-compose',
        'preflight:docker-inspect',
        'owner',
        'revalidate:git-status',
        'revalidate:git-index',
        'revalidate:git-index',
        'revalidate:git-status',
        'revalidate:docker-compose',
        'revalidate:docker-compose',
        'revalidate:docker-inspect',
        'revalidate:fetch',
        'revalidate:health',
        'revalidate:docker-compose',
        'revalidate:docker-inspect',
        'owner:close',
      ]);
      expect(acquireOwner).toHaveBeenCalledTimes(1);
      expect(owner.assertHeld).toHaveBeenCalledTimes(1);
      expect(reserveLedger).not.toHaveBeenCalled();
      expect(writeExecutionManifest).not.toHaveBeenCalled();
      expect(createFixtures).not.toHaveBeenCalled();
      expect(prepareRecoveryJournal).not.toHaveBeenCalled();
      expect(createRunner).not.toHaveBeenCalled();
      expect(runtimeCounts).toEqual({
        dockerExec: 0,
        apiProvider: 0,
        chromium: 0,
      });
    } finally {
      await composition.dispose();
    }
  });

  it('keeps all four default V11 runtime guards at zero when preflight blocks', async () => {
    const runtime = {
      dockerExec: jest.fn(() => {
        throw new Error('unexpected docker execution');
      }),
      apiProvider: jest.fn(() => {
        throw new Error('unexpected api/provider execution');
      }),
      chromium: jest.fn(() => {
        throw new Error('unexpected chromium execution');
      }),
      fetch: jest.fn(() => {
        throw new Error('unexpected fetch execution');
      }),
    };
    const acquireOwner = jest.fn(async () => ({
      status: 'owner_active' as const,
    }));
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceComposition(
        'E:\\v11-default-preflight-block',
        {
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: jest.fn(async () => undefined) } as never,
          boundary: {
            preflight: async () => ({ status: 'blocked' }),
            acquireOwner,
            runtime,
          },
        } as never,
      );

    try {
      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: 'E:\\v11-default-preflight-block',
          ports: composition.ports,
        }),
      ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });
      expect(acquireOwner).not.toHaveBeenCalled();
      expect(runtime.dockerExec).not.toHaveBeenCalled();
      expect(runtime.apiProvider).not.toHaveBeenCalled();
      expect(runtime.chromium).not.toHaveBeenCalled();
      expect(runtime.fetch).not.toHaveBeenCalled();
    } finally {
      await composition.dispose();
    }
  });

  it('binds one opaque selector set through manifest, fixtures, journal, and runner without external runtime calls', async () => {
    const fixture = createV11CompositionPorts();

    await expect(
      runReviewPlannerV11ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).resolves.toMatchObject({ status: 'passed', environment: 'branch' });

    expect(fixture.order).toEqual([
      'preflight',
      'owner',
      'revalidate',
      'reserve',
      'manifest',
      'fixtures',
      'journal',
      'runner',
    ]);
    expect(fixture.ports.createFixtures).toHaveBeenCalledWith(
      expect.objectContaining({
        executionManifest: fixture.executionManifest,
      }),
    );
    expect(fixture.ports.prepareRecoveryJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        executionManifest: fixture.executionManifest,
      }),
    );
    expect(fixture.ports.createRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        executionManifest: fixture.executionManifest,
      }),
    );
  });

  it('blocks V11 revalidation drift after owner acquisition before durable or runtime work', async () => {
    const fixture = createV11CompositionPorts({
      revalidationStatus: 'drifted',
    });

    await expect(
      runReviewPlannerV11ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).resolves.toEqual({ status: 'blocked', stage: 'revalidate' });

    expect(fixture.order).toEqual(['preflight', 'owner', 'revalidate']);
    expect(fixture.owner.assertHeld).toHaveBeenCalledTimes(1);
    expect(fixture.ports.reserveLedger).not.toHaveBeenCalled();
    expect(fixture.ports.writeExecutionManifest).not.toHaveBeenCalled();
    expect(fixture.ports.createFixtures).not.toHaveBeenCalled();
    expect(fixture.ports.prepareRecoveryJournal).not.toHaveBeenCalled();
    expect(fixture.ports.createRunner).not.toHaveBeenCalled();
  });

  it.each(['preflight', 'owner'] as const)(
    'does not construct V11 resources or invoke external runtime when %s blocks',
    async (blockedAt) => {
      const fixture = createV11CompositionPorts({ blockedAt });

      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: REPO_ROOT,
          ports: fixture.ports,
        }),
      ).resolves.toMatchObject({ status: 'blocked', stage: blockedAt });

      expect(fixture.ports.reserveLedger).not.toHaveBeenCalled();
      expect(fixture.ports.writeExecutionManifest).not.toHaveBeenCalled();
      expect(fixture.ports.createFixtures).not.toHaveBeenCalled();
      expect(fixture.ports.prepareRecoveryJournal).not.toHaveBeenCalled();
      expect(fixture.ports.createRunner).not.toHaveBeenCalled();
    },
  );

  it('fails recovery closed before default-off or cleanup when its manifest selector is stale', async () => {
    const fixture = createV11RecoveryCompositionPorts({ staleManifest: true });

    await expect(
      runReviewPlannerV11ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).resolves.toMatchObject({ status: 'blocked', stage: 'preflight' });

    expect(fixture.ports.acquireOwner).not.toHaveBeenCalled();
    expect(fixture.ports.restoreDefaultOff).not.toHaveBeenCalled();
    expect(fixture.ports.cleanupExact).not.toHaveBeenCalled();
  });

  it('recovers only through the matching V11 manifest selector and publishes the strict failure terminal first', async () => {
    const fixture = createV11RecoveryCompositionPorts();

    await expect(
      runReviewPlannerV11ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).resolves.toMatchObject({ status: 'recovered', environment: 'branch' });

    expect(fixture.order).toEqual([
      'preflight',
      'owner',
      'journal',
      'failure',
      'default-off',
      'cleanup',
    ]);
    expect(fixture.ports.restoreDefaultOff).toHaveBeenCalledWith(
      fixture.executionManifest,
    );
    expect(fixture.ports.cleanupExact).toHaveBeenCalledWith(
      fixture.executionManifest,
    );
  });

  it.each(['fixtures', 'runner'] as const)(
    'projects one strict V11 failure and exact manifest cleanup when %s fails after resources begin',
    async (stage) => {
      const fixture = createV11CompositionPorts();
      if (stage === 'fixtures') {
        fixture.ports.createFixtures.mockRejectedValueOnce(
          new Error('fixture failure'),
        );
      } else {
        fixture.ports.createRunner.mockResolvedValueOnce(
          Object.freeze({
            run: async () => {
              throw new Error('runner failure');
            },
          }),
        );
      }

      await expect(
        runReviewPlannerV11ProductAcceptanceComposition({
          environment: 'branch',
          repoRoot: REPO_ROOT,
          ports: fixture.ports,
        }),
      ).resolves.toEqual({ status: 'recovered', environment: 'branch' });

      expect(fixture.recoverFailure).toHaveBeenCalledTimes(1);
      expect(fixture.recoverFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          executionManifest: fixture.executionManifest,
        }),
      );
      expect(fixture.order).toContain('failure:strict');
      expect(fixture.order).toContain('failure:default-off');
      expect(fixture.order).toContain('failure:cleanup');
    },
  );

  it('requires manual recovery only when automatic V11 recovery cannot complete', async () => {
    const fixture = createV11CompositionPorts();
    fixture.ports.createFixtures.mockRejectedValueOnce(
      new Error('fixture failure'),
    );
    fixture.recoverFailure.mockRejectedValueOnce(new Error('recovery failure'));

    await expect(
      runReviewPlannerV11ProductAcceptanceComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).rejects.toThrow('V11_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');

    expect(fixture.recoverFailure).toHaveBeenCalledTimes(1);
  });

  it('rejects recovery selector substitution against a second authoritative manifest read before runtime cleanup', async () => {
    const fixture = createV11RecoveryCompositionPorts();
    const altered = {
      ...fixture.executionManifest,
      resources: {
        ...fixture.executionManifest.resources,
        accountId: {
          ...fixture.executionManifest.resources.accountId,
          review: 'v11-synthetic-account-review-substituted',
        },
      },
    };
    fixture.readAuthoritativeExecutionManifest.mockResolvedValueOnce({
      attemptSha256: altered.attemptSha256,
      executionManifest: altered,
    });

    await expect(
      runReviewPlannerV11ProductAcceptanceRecoveryComposition({
        environment: 'branch',
        repoRoot: REPO_ROOT,
        ports: fixture.ports,
      }),
    ).resolves.toMatchObject({ status: 'blocked', stage: 'preflight' });

    expect(fixture.readAuthoritativeExecutionManifest).toHaveBeenCalledTimes(1);
    expect(fixture.ports.acquireOwner).not.toHaveBeenCalled();
    expect(fixture.ports.restoreDefaultOff).not.toHaveBeenCalled();
    expect(fixture.ports.cleanupExact).not.toHaveBeenCalled();
  });

  it('makes the default V11 recovery composition re-read and reject a substituted selector before it acquires runtime ownership', async () => {
    const original = createV11RecoveryCompositionPorts().executionManifest;
    const substituted = {
      ...original,
      resources: {
        ...original.resources,
        fixtureId: {
          ...original.resources.fixtureId,
          planner: 'v11-synthetic-fixture-planner-substituted',
        },
      },
    };
    const acquireOwner = jest.fn();
    const readExecutionManifest = jest
      .fn()
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(substituted);
    const composition =
      createDefaultReviewPlannerV11ProductAcceptanceRecoveryComposition(
        'E:\\v11-recovery-boundary',
        {
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: jest.fn(async () => undefined) } as never,
          boundary: {
            readLedger: jest.fn(async () => ({ status: 'operation_failed' })),
            readAttemptBinding: jest.fn(async () => ({
              attemptSha256: original.attemptSha256,
            })),
            readExecutionManifest,
            acquireOwner,
          },
        } as never,
      );

    try {
      await expect(
        runReviewPlannerV11ProductAcceptanceRecoveryComposition({
          environment: 'branch',
          repoRoot: 'E:\\v11-recovery-boundary',
          ports: composition.ports,
        }),
      ).resolves.toEqual({ status: 'blocked', stage: 'preflight' });
      expect(readExecutionManifest).toHaveBeenCalledTimes(2);
      expect(acquireOwner).not.toHaveBeenCalled();
    } finally {
      await composition.dispose();
    }
  });
});

function browserTraceDetailEnvelope() {
  return {
    run: {
      modelProvider: 'deepseek',
      modelName: 'deepseek-v4-pro',
      pricingKnown: false,
      costEstimate: 0,
      totalDurationMs: 1000,
      inputTokenEstimate: 100,
      outputTokenEstimate: 20,
    },
    steps: [
      {
        node: 'deterministic_review',
        outputSummary: 'disposition=not_eligible',
      },
      {
        node: 'review_candidate',
        outputSummary: 'disposition=candidate_applied',
      },
      {
        node: 'deterministic_planner',
        outputSummary: 'disposition=not_eligible',
      },
      {
        node: 'planner_candidate',
        outputSummary: 'disposition=not_eligible',
      },
    ],
  };
}

function v9Evidence(mode: 'complete' | 'diagnostic') {
  return {
    schemaVersion: V9_DIAGNOSTIC_SCHEMA_VERSION,
    state: 'finalized',
    status: mode === 'complete' ? 'complete' : 'invalid_attempted',
    gate: 'closed',
    terminalReason: mode === 'complete' ? 'passed' : 'p95_exceeded',
    attempts: {
      providerCount: 23,
      pairedAdmissionCount: 22,
    },
    ...(mode === 'complete' ? { evidenceSha256: SHA } : {}),
  };
}

const V9_EVIDENCE_DIRECTORY =
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.evidenceDirectory;
const V9_EVIDENCE_PATHS = Object.freeze(
  [
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.onceLockLeaf,
    REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE.successCommitLeaf,
    ...REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
    'review-planner-live-20260719T000000000Z-success.json',
  ]
    .map((leaf) => `${V9_EVIDENCE_DIRECTORY}/${leaf}`)
    .sort(),
);

function ordinaryEvidenceIndex(paths: readonly string[]) {
  return `${paths.map((path) => `H ${path}`).join('\n')}\n`;
}

function captureAuthoritySnapshot(input: {
  paths?: readonly (readonly string[])[];
  indexes?: readonly string[];
}) {
  const status = `# branch.oid ${COMMIT}\n# branch.head codex/phase-6-9-5\n`;
  const paths = input.paths ?? [V9_EVIDENCE_PATHS, V9_EVIDENCE_PATHS];
  const indexes = input.indexes ?? [ordinaryEvidenceIndex(paths[0])];
  const listEvidencePaths = jest.fn();
  for (const value of paths) listEvidencePaths.mockResolvedValueOnce(value);
  const readEvidenceIndex = jest.fn();
  for (const value of indexes) readEvidenceIndex.mockResolvedValueOnce(value);
  if (indexes.length === 1) readEvidenceIndex.mockResolvedValue(indexes[0]);
  return captureReviewPlannerV8RepositorySnapshotFromAuthority({
    readGitStatus: jest.fn(async () => status),
    listEvidencePaths,
    readEvidenceIndex,
    authority: createReviewPlannerV9PairedEvidenceAuthority({
      readEvidence: jest.fn(async () => v9Evidence('complete')),
    }),
    repoRoot: REPO_ROOT,
  });
}

function healthyInspection() {
  return {
    id: CONTAINER_ID,
    environment: ['AI_PROVIDER_MODE=mock'],
    status: 'running' as const,
    health: 'healthy' as const,
    composeProject: 'docker' as const,
    composeService: 'server' as const,
    publishedPort: 3001 as const,
  };
}

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

describe('V8 default composition resource lifecycle', () => {
  it.each([
    ['V8', REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE],
    ['V10', REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE],
  ] as const)(
    'keeps the adapter-owned browser baseline available to the real trace reader for legacy %s runs',
    async (_label, profile) => {
      const disconnect = jest.fn(async () => undefined);
      const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
        REPO_ROOT,
        {
          profile,
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: disconnect } as never,
        },
      );
      const resources = product.ports.generateResources({
        environment: 'branch',
        utcStamp: '20260719T060000Z',
      } as never);
      let traceListCalls = 0;
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url === 'http://127.0.0.1:3001/auth/register') {
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  user: { id: 'review-account-id' },
                  accessToken: 'review-account-token',
                },
              }),
            );
          }
          if (url.startsWith('http://127.0.0.1:3001/agent-traces?')) {
            traceListCalls += 1;
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  runs:
                    traceListCalls === 1
                      ? []
                      : [{ id: 'review-browser-trace' }],
                },
              }),
            );
          }
          if (
            url === 'http://127.0.0.1:3001/agent-traces/review-browser-trace'
          ) {
            return new Response(
              JSON.stringify({
                success: true,
                data: browserTraceDetailEnvelope(),
              }),
            );
          }
          throw new Error(`unexpected fetch: ${url}`);
        });
      const launch = jest
        .spyOn(chromium, 'launchPersistentContext')
        .mockRejectedValueOnce(new Error('controlled browser launch failure'));

      try {
        await product.ports.registerAccount({
          component: 'review',
          email: resources.syntheticEmails.review,
          password: resources.passwords.review,
        });
        const dependencies = product.ports.createRunnerDependencies({
          preflight: { chromeExecutablePath: CHROME_EXE },
        } as never);

        await expect(
          dependencies.runBrowser({
            component: 'review',
            webOrigin: 'http://127.0.0.1:3000',
            onRoute: jest.fn(),
          }),
        ).rejects.toThrow('controlled browser launch failure');
        await expect(
          dependencies.readPersistedTraces({
            component: 'review',
            slot: 'browser',
          }),
        ).resolves.toMatchObject([
          { traceId: 'review-browser-trace', component: 'review' },
        ]);
        expect(traceListCalls).toBe(2);
      } finally {
        launch.mockRestore();
        fetchMock.mockRestore();
        await product.dispose();
      }

      expect(disconnect).toHaveBeenCalledTimes(1);
    },
  );

  it('does not duplicate the V11 runner-owned browser trace baseline before launch', async () => {
    const disconnect = jest.fn(async () => undefined);
    const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
      REPO_ROOT,
      {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: { $disconnect: disconnect } as never,
      },
    );
    const resources = product.ports.generateResources({
      environment: 'branch',
      utcStamp: '20260719T060000Z',
    } as never);
    let traceListCalls = 0;
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url === 'http://127.0.0.1:3001/auth/register') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                user: { id: 'review-account-id' },
                accessToken: 'review-account-token',
              },
            }),
          );
        }
        if (url.startsWith('http://127.0.0.1:3001/agent-traces?')) {
          traceListCalls += 1;
          return new Response(
            JSON.stringify({ success: true, data: { runs: [] } }),
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      });
    const launch = jest
      .spyOn(chromium, 'launchPersistentContext')
      .mockRejectedValueOnce(new Error('controlled browser launch failure'));

    try {
      await product.ports.registerAccount({
        component: 'review',
        email: resources.syntheticEmails.review,
        password: resources.passwords.review,
      });
      const dependencies = product.ports.createRunnerDependencies({
        preflight: { chromeExecutablePath: CHROME_EXE },
      } as never);
      const v11Dependencies = dependencies as unknown as {
        captureTraceBaseline(input: {
          component: 'review' | 'planner';
          slot: 'api' | 'browser';
        }): Promise<void>;
      };

      await v11Dependencies.captureTraceBaseline({
        component: 'review',
        slot: 'browser',
      });
      await expect(
        dependencies.runBrowser({
          component: 'review',
          webOrigin: 'http://127.0.0.1:3000',
          onRoute: jest.fn(),
        }),
      ).rejects.toThrow('controlled browser launch failure');
      expect(traceListCalls).toBe(1);
    } finally {
      launch.mockRestore();
      fetchMock.mockRestore();
      await product.dispose();
    }

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['V8', REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_PROFILE],
    ['V10', REVIEW_PLANNER_V10_PRODUCT_ACCEPTANCE_PROFILE],
  ] as const)(
    'keeps the adapter-owned API baseline available to the real trace reader for legacy %s runs',
    async (_label, profile) => {
      const disconnect = jest.fn(async () => undefined);
      const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
        REPO_ROOT,
        {
          profile,
          env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
          prisma: { $disconnect: disconnect } as never,
        },
      );
      const resources = product.ports.generateResources({
        environment: 'branch',
        utcStamp: '20260719T060000Z',
      } as never);
      let traceListCalls = 0;
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          if (url === 'http://127.0.0.1:3001/auth/register') {
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  user: { id: 'review-account-id' },
                  accessToken: 'review-account-token',
                },
              }),
            );
          }
          if (url.startsWith('http://127.0.0.1:3001/agent-traces?')) {
            traceListCalls += 1;
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  runs:
                    traceListCalls === 1 ? [] : [{ id: 'review-api-trace' }],
                },
              }),
            );
          }
          if (
            url ===
            'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-480'
          ) {
            return new Response(
              JSON.stringify({
                success: true,
                data: {
                  modelObservations: {
                    review: {
                      attempted: true,
                      degraded: false,
                      disposition: 'candidate_applied',
                      provenance: 'live_candidate',
                      durationMs: 123,
                      usage: { inputTokens: 100, outputTokens: 20 },
                    },
                    planner: {
                      attempted: false,
                      degraded: true,
                      disposition: 'not_eligible',
                      provenance: 'local_deterministic',
                      durationMs: 0,
                      usage: { inputTokens: 0, outputTokens: 0 },
                    },
                  },
                },
              }),
            );
          }
          if (url === 'http://127.0.0.1:3001/agent-traces/review-api-trace') {
            return new Response(
              JSON.stringify({
                success: true,
                data: browserTraceDetailEnvelope(),
              }),
            );
          }
          throw new Error(`unexpected fetch: ${url}`);
        });

      try {
        await product.ports.registerAccount({
          component: 'review',
          email: resources.syntheticEmails.review,
          password: resources.passwords.review,
        });
        const dependencies = product.ports.createRunnerDependencies(
          {} as never,
        );

        await expect(
          dependencies.dispatchApi({
            component: 'review',
            acceptanceCapability: resources.capabilities.review,
          }),
        ).resolves.toMatchObject({ target: { attempted: true } });
        await expect(
          dependencies.readPersistedTraces({
            component: 'review',
            slot: 'api',
          }),
        ).resolves.toMatchObject([
          { traceId: 'review-api-trace', component: 'review' },
        ]);
        expect(traceListCalls).toBe(2);
      } finally {
        fetchMock.mockRestore();
        await product.dispose();
      }

      expect(disconnect).toHaveBeenCalledTimes(1);
    },
  );

  it('does not duplicate the V11 runner-owned API trace baseline before dispatch', async () => {
    const disconnect = jest.fn(async () => undefined);
    const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
      REPO_ROOT,
      {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: { $disconnect: disconnect } as never,
      },
    );
    const resources = product.ports.generateResources({
      environment: 'branch',
      utcStamp: '20260719T060000Z',
    } as never);
    let traceListCalls = 0;
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url === 'http://127.0.0.1:3001/auth/register') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                user: { id: 'review-account-id' },
                accessToken: 'review-account-token',
              },
            }),
          );
        }
        if (url.startsWith('http://127.0.0.1:3001/agent-traces?')) {
          traceListCalls += 1;
          return new Response(
            JSON.stringify({ success: true, data: { runs: [] } }),
          );
        }
        if (
          url ===
          'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-480'
        ) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                modelObservations: {
                  review: {
                    attempted: true,
                    degraded: false,
                    disposition: 'candidate_applied',
                    provenance: 'live_candidate',
                    durationMs: 123,
                    usage: { inputTokens: 100, outputTokens: 20 },
                  },
                  planner: {
                    attempted: false,
                    degraded: true,
                    disposition: 'not_eligible',
                    provenance: 'local_deterministic',
                    durationMs: 0,
                    usage: { inputTokens: 0, outputTokens: 0 },
                  },
                },
              },
            }),
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

    try {
      await product.ports.registerAccount({
        component: 'review',
        email: resources.syntheticEmails.review,
        password: resources.passwords.review,
      });
      const dependencies = product.ports.createRunnerDependencies({} as never);
      const v11Dependencies = dependencies as unknown as {
        captureTraceBaseline(input: {
          component: 'review' | 'planner';
          slot: 'api' | 'browser';
        }): Promise<void>;
      };

      await v11Dependencies.captureTraceBaseline({
        component: 'review',
        slot: 'api',
      });
      await expect(
        dependencies.dispatchApi({
          component: 'review',
          acceptanceCapability: resources.capabilities.review,
        }),
      ).resolves.toMatchObject({ target: { attempted: true } });
      expect(traceListCalls).toBe(1);
    } finally {
      fetchMock.mockRestore();
      await product.dispose();
    }

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('builds a V11 diagnostics port from the opaque Task3 journal and ledger authority', () => {
    const authority = Object.freeze({ assertAuthorized: jest.fn() });
    const journal = {
      appendCheckpoint: jest.fn((value: unknown) => value),
      latestCheckpoint: jest.fn(() => ({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_dispatch',
        providerCallState: 'indeterminate',
      })),
      issueFailureAuthority: jest.fn(() => authority),
    };
    const ledger = { recordFailure: jest.fn() };
    const diagnostics = createReviewPlannerV11ProductAcceptanceDiagnosticsPort({
      environment: 'branch',
      journal: journal as never,
      ledger: ledger as never,
    });
    diagnostics.checkpoint('review_api_activate');
    diagnostics.checkpoint('review_api_dispatch');
    diagnostics.publishFailure();

    expect(journal.appendCheckpoint.mock.calls.map(([value]) => value)).toEqual(
      [
        {
          schemaVersion:
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
          component: 'review',
          slot: 'api',
          checkpoint: 'review_api_activate',
          providerCallState: 'not_started',
        },
        {
          schemaVersion:
            REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.checkpoint,
          component: 'review',
          slot: 'api',
          checkpoint: 'review_api_dispatch',
          providerCallState: 'indeterminate',
        },
      ],
    );
    expect(journal.issueFailureAuthority).toHaveBeenCalledTimes(1);
    expect(ledger.recordFailure).toHaveBeenCalledWith(authority, {
      schemaVersion:
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
      environment: 'branch',
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_dispatch',
      terminal: 'operation_failed',
      providerCallState: 'indeterminate',
    });
  });

  it('does not seal V11 failure publication before the opaque ledger write succeeds', () => {
    const authority = Object.freeze({ assertAuthorized: jest.fn() });
    const journal = {
      appendCheckpoint: jest.fn((value: unknown) => value),
      latestCheckpoint: jest.fn(() => ({
        schemaVersion: 'phase-6.9.5-v11-product-acceptance-checkpoint-v1',
        component: 'review',
        slot: 'api',
        checkpoint: 'review_api_activate',
        providerCallState: 'not_started',
      })),
      issueFailureAuthority: jest.fn(() => authority),
    };
    const ledger = {
      recordFailure: jest.fn().mockImplementationOnce(() => {
        throw new Error('first durable write failed');
      }),
    };
    const diagnostics = createReviewPlannerV11ProductAcceptanceDiagnosticsPort({
      environment: 'branch',
      journal: journal as never,
      ledger: ledger as never,
    });
    diagnostics.checkpoint('review_api_activate');

    expect(() => diagnostics.publishFailure()).toThrow(
      'first durable write failed',
    );
    expect(() => diagnostics.publishFailure()).not.toThrow();
    expect(journal.latestCheckpoint).toHaveBeenCalledTimes(1);
    expect(journal.issueFailureAuthority).toHaveBeenCalledTimes(1);
    expect(ledger.recordFailure).toHaveBeenCalledTimes(2);
    const [firstAuthority, firstFailure] = ledger.recordFailure.mock.calls[0];
    const [secondAuthority, secondFailure] = ledger.recordFailure.mock.calls[1];
    expect(secondAuthority).toBe(firstAuthority);
    expect(secondFailure).toBe(firstFailure);
    expect(firstFailure).toEqual({
      schemaVersion:
        REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.schemas.failure,
      environment: 'branch',
      component: 'review',
      slot: 'api',
      checkpoint: 'review_api_activate',
      terminal: 'operation_failed',
      providerCallState: 'not_started',
    });
  });

  it('does not issue a V11 failure authority when the first safe journal read fails', () => {
    const journal = {
      appendCheckpoint: jest.fn((value: unknown) => value),
      latestCheckpoint: jest.fn(() => {
        throw new Error('journal read failed');
      }),
      issueFailureAuthority: jest.fn(),
    };
    const ledger = { recordFailure: jest.fn() };
    const diagnostics = createReviewPlannerV11ProductAcceptanceDiagnosticsPort({
      environment: 'branch',
      journal: journal as never,
      ledger: ledger as never,
    });
    diagnostics.checkpoint('review_api_activate');

    expect(() => diagnostics.publishFailure()).toThrow('journal read failed');
    expect(journal.latestCheckpoint).toHaveBeenCalledTimes(1);
    expect(journal.issueFailureAuthority).not.toHaveBeenCalled();
    expect(ledger.recordFailure).not.toHaveBeenCalled();
  });

  it('parses an inactive deterministic observation with zero duration from the live suggestion envelope', async () => {
    const disconnect = jest.fn(async () => undefined);
    const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
      REPO_ROOT,
      {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: { $disconnect: disconnect } as never,
      },
    );
    const resources = product.ports.generateResources({
      environment: 'branch',
      utcStamp: '20260719T060000Z',
    } as never);
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url === 'http://127.0.0.1:3001/auth/register') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                user: { id: 'review-account-id' },
                accessToken: 'review-account-token',
              },
            }),
          );
        }
        if (url.startsWith('http://127.0.0.1:3001/agent-traces?')) {
          return new Response(
            JSON.stringify({ success: true, data: { runs: [] } }),
          );
        }
        if (url.startsWith('http://127.0.0.1:3001/review-agent/suggestions?')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                modelObservations: {
                  review: {
                    attempted: true,
                    degraded: false,
                    disposition: 'candidate_applied',
                    provenance: 'live_candidate',
                    durationMs: 123,
                    usage: { inputTokens: 100, outputTokens: 20 },
                  },
                  planner: {
                    attempted: false,
                    degraded: true,
                    disposition: 'not_eligible',
                    provenance: 'local_deterministic',
                    durationMs: 0,
                    usage: { inputTokens: 0, outputTokens: 0 },
                  },
                },
              },
            }),
          );
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

    try {
      await product.ports.registerAccount({
        component: 'review',
        email: resources.syntheticEmails.review,
        password: resources.passwords.review,
      });
      const dependencies = product.ports.createRunnerDependencies({} as never);
      const v11Dependencies = dependencies as unknown as {
        captureTraceBaseline(input: {
          component: 'review' | 'planner';
          slot: 'api' | 'browser';
        }): Promise<void>;
      };

      await expect(
        v11Dependencies.captureTraceBaseline({
          component: 'review',
          slot: 'api',
        }),
      ).resolves.toBeUndefined();

      await expect(
        dependencies.dispatchApi({
          component: 'review',
          acceptanceCapability: resources.capabilities.review,
        }),
      ).resolves.toEqual({
        target: {
          attempted: true,
          degraded: false,
          disposition: 'candidate_applied',
          provenance: 'live_candidate',
          durationMs: 123,
          usage: { inputTokens: 100, outputTokens: 20 },
        },
        inactive: {
          attempted: false,
          degraded: true,
          disposition: 'not_eligible',
          provenance: 'local_deterministic',
          durationMs: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
        },
      });
      expect(
        fetchMock.mock.calls.map(([input]) =>
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        ),
      ).toEqual([
        'http://127.0.0.1:3001/auth/register',
        'http://127.0.0.1:3001/agent-traces?limit=50&route=review_analysis&mode=live',
        'http://127.0.0.1:3001/review-agent/suggestions?days=7&timezoneOffsetMinutes=-480',
      ]);
    } finally {
      fetchMock.mockRestore();
      await product.dispose();
    }

    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('blocks default preflight before ledger, Prisma, fixtures, or Docker work', async () => {
    const prismaAccess = jest.fn();
    const disconnect = jest.fn(async () => undefined);
    const prisma = new Proxy(
      { $disconnect: disconnect },
      {
        get(target, property) {
          if (property === '$disconnect') return target.$disconnect;
          prismaAccess(property);
          return undefined;
        },
      },
    );
    const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
      REPO_ROOT,
      {
        env: { DATABASE_URL: 'postgresql://acceptance.invalid/database' },
        prisma: prisma as never,
        pairedEvidenceAuthority: createReviewPlannerV9PairedEvidenceAuthority({
          readEvidence: jest.fn(async () => v9Evidence('diagnostic')),
        }),
      },
    );
    const reserveLedger = jest.spyOn(product.ports, 'reserveLedger');
    const createFixtures = jest.spyOn(product.ports, 'createFixtures');
    const createRunnerDependencies = jest.spyOn(
      product.ports,
      'createRunnerDependencies',
    );
    const runAcceptance = jest.spyOn(product.ports, 'runAcceptance');

    await expect(
      runReviewPlannerV8ProductAcceptanceProductCli({
        argv: [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
          '--environment=branch',
        ],
        repoRoot: REPO_ROOT,
        ports: product.ports,
      }),
    ).resolves.toMatchObject({ stage: 'preflight', status: 'blocked' });

    expect(reserveLedger).not.toHaveBeenCalled();
    expect(prismaAccess).not.toHaveBeenCalled();
    expect(createFixtures).not.toHaveBeenCalled();
    expect(createRunnerDependencies).not.toHaveBeenCalled();
    expect(runAcceptance).not.toHaveBeenCalled();
    await product.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects product and recovery Prisma clients exactly once', async () => {
    const productDisconnect = jest.fn(async () => undefined);
    const recoveryDisconnect = jest.fn(async () => undefined);
    const env = {
      DATABASE_URL: 'postgresql://acceptance.invalid/database',
    };

    const product = createDefaultReviewPlannerV8ProductAcceptanceComposition(
      REPO_ROOT,
      {
        env,
        prisma: { $disconnect: productDisconnect } as never,
      },
    );
    const recovery =
      createDefaultReviewPlannerV8ProductAcceptanceRecoveryComposition(
        REPO_ROOT,
        {
          env,
          prisma: { $disconnect: recoveryDisconnect } as never,
        },
      );

    await product.dispose();
    await product.dispose();
    await recovery.dispose();
    await recovery.dispose();

    expect(productDisconnect).toHaveBeenCalledTimes(1);
    expect(recoveryDisconnect).toHaveBeenCalledTimes(1);
  });

  it('disposes product resources when fixtures fail before runner construction', async () => {
    const fixture = createPorts();
    const dispose = jest.fn(async () => undefined);
    fixture.ports.createFixtures.mockRejectedValueOnce(
      new Error('fixture transaction failed'),
    );

    await expect(
      executeReviewPlannerV8ProductAcceptanceProductCli({
        argv: [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
          '--environment=branch',
        ],
        repoRoot: REPO_ROOT,
        composition: { ports: fixture.ports, dispose },
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_OPERATION_FAILED');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes recovery resources when the default-off probe fails', async () => {
    const fixture = createRecoveryPorts();
    const dispose = jest.fn(async () => undefined);
    fixture.ports.restoreDefaultOff.mockRejectedValueOnce(
      new Error('probe failed'),
    );

    await expect(
      executeReviewPlannerV8ProductAcceptanceRecoveryCli({
        argv: [
          REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
          '--environment=branch',
        ],
        repoRoot: REPO_ROOT,
        composition: { ports: fixture.ports, dispose },
      }),
    ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_RECOVERY_REQUIRED');
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'product',
      executeReviewPlannerV8ProductAcceptanceProductCli,
      createPorts().ports,
    ],
    [
      'recovery',
      executeReviewPlannerV8ProductAcceptanceRecoveryCli,
      createRecoveryPorts().ports,
    ],
  ] as const)(
    'disposes an already-created %s composition when arguments are invalid',
    async (_kind, execute, ports) => {
      const dispose = jest.fn(async () => undefined);

      await expect(
        execute({
          argv: ['--invalid'],
          repoRoot: REPO_ROOT,
          composition: { ports: ports as never, dispose },
        }),
      ).rejects.toThrow('V8_PRODUCT_ACCEPTANCE_CONFIRMATION_REQUIRED');
      expect(dispose).toHaveBeenCalledTimes(1);
    },
  );
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

function createPorts(
  options: {
    preflightStatus?: 'ready' | 'blocked';
    revalidationStatus?: 'stable' | 'drifted';
  } = {},
) {
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
        branchName: 'codex/phase-6-9-5',
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
    revalidatePreflight: jest.fn(async () => {
      order.push('preflight:revalidate');
      return options.revalidationStatus !== 'drifted';
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

function createV11CompositionPorts(
  options: {
    blockedAt?: 'preflight' | 'owner';
    revalidationStatus?: 'stable' | 'drifted';
  } = {},
) {
  const order: string[] = [];
  const recoverFailure = jest.fn(async () => {
    order.push('failure:strict');
    order.push('failure:default-off');
    order.push('failure:cleanup');
  });
  const executionManifest = Object.freeze({
    schemaVersion:
      'phase-6.9.5-v11-product-acceptance-execution-manifest-v1' as const,
    environment: 'branch' as const,
    attemptSha256: 'a'.repeat(64),
    resources: {
      accountId: {
        review: 'v11-synthetic-account-review-a',
        planner: 'v11-synthetic-account-planner-a',
      },
      fixtureId: {
        review: 'v11-synthetic-fixture-review-a',
        planner: 'v11-synthetic-fixture-planner-a',
      },
      browser: {
        executablePath: CHROME_EXE,
        profilePath:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            'branch',
          ),
      },
    },
  });
  const owner = Object.freeze({
    assertHeld: jest.fn(),
    close: jest.fn(),
  });
  const ports = {
    preflight: jest.fn(async () => {
      order.push('preflight');
      return options.blockedAt === 'preflight'
        ? { status: 'blocked' as const }
        : {
            status: 'ready' as const,
            environment: 'branch' as const,
            repoRoot: REPO_ROOT,
            commitSha: COMMIT,
            branchName: 'codex/phase-6-9-5-v11',
            pairedEvidenceSha256: SHA,
            chromeExecutablePath: CHROME_EXE,
          };
    }),
    acquireOwner: jest.fn(async () => {
      order.push('owner');
      return options.blockedAt === 'owner'
        ? { status: 'owner_active' as const }
        : { status: 'acquired' as const, owner };
    }),
    revalidatePreflight: jest.fn(async () => {
      order.push('revalidate');
      return options.revalidationStatus !== 'drifted';
    }),
    reserveLedger: jest.fn(async () => {
      order.push('reserve');
      return {
        ledger: Object.freeze({ close: jest.fn() }),
        attemptSha256: 'a'.repeat(64),
      };
    }),
    writeExecutionManifest: jest.fn(async () => {
      order.push('manifest');
      return executionManifest;
    }),
    createFixtures: jest.fn(async () => {
      order.push('fixtures');
      return Object.freeze({});
    }),
    prepareRecoveryJournal: jest.fn(async () => {
      order.push('journal');
      return Object.freeze({ close: jest.fn() });
    }),
    createRunner: jest.fn(async () => {
      order.push('runner');
      return Object.freeze({
        async run() {
          return undefined;
        },
      });
    }),
    recoverFailure,
  } satisfies ReviewPlannerV11ProductAcceptanceCompositionPorts;
  return {
    order,
    ports,
    owner,
    executionManifest,
    recoverFailure,
  };
}

function createV11RecoveryCompositionPorts(
  options: { staleManifest?: boolean } = {},
) {
  const order: string[] = [];
  const readAuthoritativeExecutionManifest = jest.fn(async () => ({
    attemptSha256: executionManifest.attemptSha256,
    executionManifest,
  }));
  const executionManifest = Object.freeze({
    schemaVersion:
      'phase-6.9.5-v11-product-acceptance-execution-manifest-v1' as const,
    environment: 'branch' as const,
    attemptSha256: 'a'.repeat(64),
    resources: {
      accountId: {
        review: 'v11-synthetic-account-review-a',
        planner: 'v11-synthetic-account-planner-a',
      },
      fixtureId: {
        review: 'v11-synthetic-fixture-review-a',
        planner: 'v11-synthetic-fixture-planner-a',
      },
      browser: {
        executablePath: CHROME_EXE,
        profilePath:
          REVIEW_PLANNER_V11_PRODUCT_ACCEPTANCE_PROFILE.browserProfilePath(
            'branch',
          ),
      },
    },
  });
  const owner = Object.freeze({
    assertHeld: jest.fn(),
    close: jest.fn(),
  });
  const ports = {
    preflight: jest.fn(async () => {
      order.push('preflight');
      return {
        status: 'ready' as const,
        environment: 'branch' as const,
        repoRoot: REPO_ROOT,
        attemptSha256: options.staleManifest ? 'b'.repeat(64) : 'a'.repeat(64),
        executionManifest,
      };
    }),
    readAuthoritativeExecutionManifest,
    acquireOwner: jest.fn(async () => {
      order.push('owner');
      return { status: 'acquired' as const, owner };
    }),
    openRecoveryJournal: jest.fn(async () => {
      order.push('journal');
      return Object.freeze({ close: jest.fn() });
    }),
    publishFailure: jest.fn(async () => {
      order.push('failure');
    }),
    restoreDefaultOff: jest.fn(async () => {
      order.push('default-off');
      return undefined;
    }),
    cleanupExact: jest.fn(async () => {
      order.push('cleanup');
      return undefined;
    }),
  } satisfies ReviewPlannerV11ProductAcceptanceRecoveryCompositionPorts;
  return {
    order,
    ports,
    executionManifest,
    readAuthoritativeExecutionManifest,
  };
}
