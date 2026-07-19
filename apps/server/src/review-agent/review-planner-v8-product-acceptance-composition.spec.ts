/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await -- typed Jest fixtures intentionally use matcher values and async port signatures */
import {
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_CONFIRMATION,
  REVIEW_PLANNER_V8_PRODUCT_ACCEPTANCE_RECOVERY_CONFIRMATION,
  buildReviewPlannerV8ActivationEnvironment,
  buildReviewPlannerV8DefaultOffEnvironment,
  buildReviewPlannerV8ServerRecreateCommand,
  captureReviewPlannerV8RepositorySnapshot,
  captureReviewPlannerV8RepositorySnapshotFromAuthority,
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
} from './review-planner-v8-product-acceptance-composition';
import * as legacyV8Evidence from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_GATE_DIAGNOSTICS_PROFILE,
  REVIEW_PLANNER_CONTROLLED_LIVE_V9_STAGES,
} from './review-planner-controlled-live-eval-v9-gate-diagnostics.evidence';
import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';
import {
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';

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
