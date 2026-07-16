import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import {
  executeReviewPlannerControlledLiveCli,
  serializeReviewPlannerControlledLiveSummary,
} from './review-planner-controlled-live-eval-cli';
import { reserveReviewPlannerControlledLiveEvidence } from './review-planner-controlled-live-eval-evidence';

const env = Object.freeze({
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
  REVIEW_AGENT_MODEL_ENABLED: 'false',
  PLANNER_AGENT_MODEL_ENABLED: 'false',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/v1',
  DEEPSEEK_API_KEY: 'cli-private-canary',
});

describe('review planner controlled Live CLI', () => {
  let root = '';

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-cli-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    { argv: [] },
    { argv: ['--confirm-controlled-live', '--extra'] },
    { argv: ['--live'] },
  ])('requires the exact confirmation grammar %#', async ({ argv }) => {
    const result = await executeReviewPlannerControlledLiveCli({
      argv,
      env,
      root,
    });

    expect(result).toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    });
  });

  it.each([
    { AI_PROVIDER_MODE: 'mock' },
    { REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'false' },
    { REVIEW_AGENT_MODEL_ENABLED: 'true' },
    { PLANNER_AGENT_MODEL_ENABLED: 'true' },
    { AI_MODEL: 'unknown-price-model' },
  ])('keeps the diagnostic gate closed for unsafe env %#', async (override) => {
    const result = await executeReviewPlannerControlledLiveCli({
      argv: ['--confirm-controlled-live'],
      env: { ...env, ...override },
      root,
    });

    expect(result).toMatchObject({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
    });
  });

  it('writes only sanitized attempted evidence and never retries a failed diagnostic', async () => {
    const executor = jest.fn(() =>
      Promise.reject(
        new Error('RAW_PROVIDER_DIAGNOSTIC_CANARY api_key=cli-private-canary'),
      ),
    );
    const result = await executeReviewPlannerControlledLiveCli({
      argv: ['--confirm-controlled-live'],
      env,
      root,
      dependencies: { createExecutor: () => executor },
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
      randomUUID: () => 'cli-run-1',
    });

    expect(result).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
    expect(executor).toHaveBeenCalledTimes(1);
    const output = serializeReviewPlannerControlledLiveSummary(result);
    expect(output).not.toMatch(/RAW_PROVIDER|api_key|cli-private-canary/i);

    const evidenceDirectory = join(
      root,
      'docs',
      'acceptance',
      'evidence',
      'phase-6-9-5-controlled-live',
    );
    const [file] = (await readdir(evidenceDirectory)).filter((entry) =>
      entry.endsWith('.json'),
    );
    const evidence = await readFile(join(evidenceDirectory, file), 'utf8');
    expect(evidence).not.toMatch(/RAW_PROVIDER|api_key|cli-private-canary/i);
  });

  it('fails closed when the evidence target already exists before a provider attempt', async () => {
    const executor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    );
    const input = {
      argv: ['--confirm-controlled-live'] as const,
      env,
      root,
      dependencies: { createExecutor: () => executor },
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
      randomUUID: () => 'cli-run-collision',
    };
    await executeReviewPlannerControlledLiveCli(input);
    executor.mockClear();

    const result = await executeReviewPlannerControlledLiveCli(input);

    expect(result).toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('rejects a second exact confirmation with a distinct UUID before its provider boundary', async () => {
    const executor = jest.fn(() =>
      Promise.reject(new Error('RAW_PROVIDER_DIAGNOSTIC_CANARY')),
    );
    const input = {
      argv: ['--confirm-controlled-live'] as const,
      env,
      root,
      dependencies: { createExecutor: () => executor },
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    };

    await expect(
      executeReviewPlannerControlledLiveCli({
        ...input,
        randomUUID: () => 'first-confirmation-run',
      }),
    ).resolves.toMatchObject({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
    });
    expect(executor).toHaveBeenCalledTimes(1);
    executor.mockClear();

    await expect(
      executeReviewPlannerControlledLiveCli({
        ...input,
        randomUUID: () => 'second-confirmation-run',
      }),
    ).resolves.toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('keeps the one-time qualification consumed after finalization I/O failure', async () => {
    const executor = jest.fn(() =>
      Promise.reject(new Error('RAW_PROVIDER_DIAGNOSTIC_CANARY')),
    );
    let renameCount = 0;
    const failFinalizationFs = {
      mkdir,
      open,
      readdir,
      unlink,
      async rename(from: string, to: string) {
        renameCount += 1;
        if (renameCount === 2)
          throw new Error('simulated finalization failure');
        await rename(from, to);
      },
    };
    const input = {
      argv: ['--confirm-controlled-live'] as const,
      env,
      root,
      dependencies: { createExecutor: () => executor },
      now: () => Date.parse('2026-07-16T00:00:00.000Z'),
    };

    await expect(
      executeReviewPlannerControlledLiveCli({
        ...input,
        randomUUID: () => 'io-failure-first-run',
        reserveEvidence: (reservation) =>
          reserveReviewPlannerControlledLiveEvidence({
            ...reservation,
            fs: failFinalizationFs,
          }),
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(executor).toHaveBeenCalledTimes(1);
    executor.mockClear();

    await expect(
      executeReviewPlannerControlledLiveCli({
        ...input,
        randomUUID: () => 'io-failure-second-run',
      }),
    ).resolves.toEqual({
      status: 'diagnostic_blocked',
      gate: 'closed',
      providerAttemptCount: 0,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
    });
    expect(executor).not.toHaveBeenCalled();
  });

  it('blocks a post-binding junction swap before the provider boundary', async () => {
    const outside = await mkdtemp(
      join(tmpdir(), 'prepmind-phase-695-cli-swap-'),
    );
    const outsideEvidence = join(
      outside,
      'acceptance',
      'evidence',
      'phase-6-9-5-controlled-live',
    );
    await mkdir(outsideEvidence, { recursive: true });
    let restoredAfterExternalOpen = false;
    const executor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    );
    try {
      await expect(
        executeReviewPlannerControlledLiveCli({
          argv: ['--confirm-controlled-live'],
          env,
          root,
          dependencies: { createExecutor: () => executor },
          now: () => Date.parse('2026-07-16T00:00:00.000Z'),
          randomUUID: () => 'cli-before-open-swap',
          reserveEvidence: (reservation) =>
            reserveReviewPlannerControlledLiveEvidence({
              ...reservation,
              fs: {
                mkdir,
                readdir,
                rename,
                unlink,
                async open(path, flags) {
                  if (restoredAfterExternalOpen) return open(path, flags);
                  restoredAfterExternalOpen = true;
                  await rename(join(root, 'docs'), join(root, 'docs-detached'));
                  await symlink(outside, join(root, 'docs'), 'junction');
                  const handle = await open(path, flags);
                  await rename(path, join(root, 'opened-external-file'));
                  await rm(join(root, 'docs'), {
                    recursive: true,
                    force: true,
                  });
                  await rename(join(root, 'docs-detached'), join(root, 'docs'));
                  return handle;
                },
              },
            }),
        }),
      ).resolves.toEqual({
        status: 'diagnostic_blocked',
        gate: 'closed',
        providerAttemptCount: 0,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.EvidenceIo,
      });
      expect(restoredAfterExternalOpen).toBe(true);
      expect(executor).not.toHaveBeenCalled();
      await expect(readdir(outsideEvidence)).resolves.toEqual([]);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('records a paired runner exception as transport rather than evidence I/O', async () => {
    const executor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    );

    await expect(
      executeReviewPlannerControlledLiveCli({
        argv: ['--confirm-controlled-live'],
        env,
        root,
        dependencies: {
          createExecutor: () => executor,
          runPairedEvaluation: () =>
            Promise.reject(new Error('RAW_PAIRED_RUNNER_FAILURE')),
        },
        now: () => Date.parse('2026-07-16T00:00:00.000Z'),
        randomUUID: () => 'paired-throws-run',
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    });
  });

  it('records a null paired report as invalid response rather than evidence I/O', async () => {
    const executor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    );

    await expect(
      executeReviewPlannerControlledLiveCli({
        argv: ['--confirm-controlled-live'],
        env,
        root,
        dependencies: {
          createExecutor: () => executor,
          runPairedEvaluation: () => Promise.resolve(null as never),
        },
        now: () => Date.parse('2026-07-16T00:00:00.000Z'),
        randomUUID: () => 'paired-null-run',
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
  });

  it('records a malformed paired report as invalid response and finalizes safely', async () => {
    const executor = jest.fn(() =>
      Promise.resolve({
        object: { focusIndexes: [0], diagnosis: 'review_pressure' },
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    );

    await expect(
      executeReviewPlannerControlledLiveCli({
        argv: ['--confirm-controlled-live'],
        env,
        root,
        dependencies: {
          createExecutor: () => executor,
          runPairedEvaluation: () => Promise.resolve({} as never),
        },
        now: () => Date.parse('2026-07-16T00:00:00.000Z'),
        randomUUID: () => 'paired-malformed-run',
      }),
    ).resolves.toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
    });
  });
});
