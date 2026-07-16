import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { executeReviewPlannerControlledLiveV4Cli } from './review-planner-controlled-live-eval-v4-cli';
import { reserveReviewPlannerControlledLiveV4Evidence } from './review-planner-controlled-live-eval-v4-evidence';
import { createReviewPlannerControlledLiveV4Evaluator } from './review-planner-controlled-live-eval-v4.factory';
import {
  createReviewPlannerControlledLiveV4JsonExecutor,
  type ReviewPlannerControlledLiveV4Fetch,
} from './review-planner-controlled-live-eval-v4-json';

const describeNativeWindows =
  process.platform === 'win32' && Boolean(process.versions.bun)
    ? describe
    : describe.skip;

describeNativeWindows(
  'review planner controlled Live v4 native evidence',
  () => {
    let root = '';

    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), 'prepmind-phase-695-v4-native-'));
    });

    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it('reserves and finalizes only a v4 handle-relative evidence record', async () => {
      const reservation = await reserveReviewPlannerControlledLiveV4Evidence({
        root,
        startedAt: '2026-07-17T00:00:00.000Z',
        runId: 'v4-native-isolated-run',
      });
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(
        reservation.finalize({
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
          structuredOutputStage: 'provider_type_validation',
        }),
      ).resolves.toBe(true);

      await expect(
        readFile(join(root, reservation.relativePath), 'utf8'),
      ).resolves.toContain(
        '"structuredOutputStage":"provider_type_validation"',
      );
      await expect(
        readdir(
          join(
            root,
            'docs',
            'acceptance',
            'evidence',
            'phase-6-9-5-controlled-live-v4',
          ),
        ),
      ).resolves.toHaveLength(2);
    });

    it('preserves all v1-v3 evidence and once markers byte-for-byte across the v4 lifecycle', async () => {
      const historicalFiles = [
        'docs/acceptance/evidence/phase-6-9-5-controlled-live/v1.json',
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/v2.json',
        'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/v3.json',
        '.review-planner-controlled-live.once',
        '.review-planner-controlled-live-v2.once',
        '.review-planner-controlled-live-v3.once',
      ] as const;
      await Promise.all(
        historicalFiles.map(async (relativePath) => {
          const path = join(root, relativePath);
          await mkdir(parentPath(path), { recursive: true });
          await writeFile(path, `historical:${relativePath}\n`, 'utf8');
        }),
      );
      const before = await Promise.all(
        historicalFiles.map((relativePath) =>
          readFile(join(root, relativePath)),
        ),
      );

      const reservation = await reserveReviewPlannerControlledLiveV4Evidence({
        root,
        startedAt: '2026-07-17T00:00:00.000Z',
        runId: 'v4-native-historical-isolation',
      });
      await expect(reservation.markAttempted()).resolves.toBe(true);
      await expect(
        reservation.finalize({
          status: 'invalid_attempted',
          gate: 'closed',
          providerAttemptCount: 1,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
          structuredOutputStage: 'provider_object_missing',
        }),
      ).resolves.toBe(true);

      await expect(
        Promise.all(
          historicalFiles.map((relativePath) =>
            readFile(join(root, relativePath)),
          ),
        ),
      ).resolves.toEqual(before);
    });

    it('writes the trusted direct fake-fetch schema stage without raw provider content', async () => {
      const rawCanary = 'RAW_V4_NATIVE_EVIDENCE_SCHEMA_CANARY';
      let fetchCalls = 0;
      const fetch: ReviewPlannerControlledLiveV4Fetch = () => {
        fetchCalls += 1;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      focusIndexes: [0],
                      diagnosis: 'review_pressure',
                      raw: rawCanary,
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 12, completion_tokens: 4 },
            }),
        });
      };
      const createEvaluator = (candidateEnv: Record<string, unknown>) =>
        createReviewPlannerControlledLiveV4Evaluator(candidateEnv, {
          createExecutor: (config) =>
            createReviewPlannerControlledLiveV4JsonExecutor(config, {
              fetch,
            }),
          isPricingKnown: () => true,
        });

      const result = await executeReviewPlannerControlledLiveV4Cli({
        argv: ['--confirm-controlled-live-v4'],
        env: {
          AI_PROVIDER_MODE: 'live',
          AI_ENABLE_LIVE_CALLS: 'true',
          REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
          REVIEW_AGENT_MODEL_ENABLED: 'false',
          PLANNER_AGENT_MODEL_ENABLED: 'false',
          AI_MODEL: 'deepseek-v4-flash',
          AI_BASE_URL: 'https://api.deepseek.com/v1',
          DEEPSEEK_API_KEY: 'v4-native-private-key',
        },
        root,
        createEvaluator,
      });

      expect(result).toEqual({
        status: 'invalid_attempted',
        gate: 'closed',
        providerAttemptCount: 1,
        usageKnown: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
        structuredOutputStage: 'provider_type_validation',
      });
      expect(fetchCalls).toBe(1);

      const evidenceDirectory = join(
        root,
        'docs',
        'acceptance',
        'evidence',
        'phase-6-9-5-controlled-live-v4',
      );
      const evidenceLeaf = (await readdir(evidenceDirectory)).find((entry) =>
        entry.endsWith('.json'),
      );
      expect(evidenceLeaf).toBeDefined();
      if (!evidenceLeaf) throw new Error('expected v4 evidence leaf');
      const evidence = await readFile(
        join(evidenceDirectory, evidenceLeaf),
        'utf8',
      );
      expect(evidence).toContain(
        '"structuredOutputStage":"provider_type_validation"',
      );
      expect(evidence).not.toContain(rawCanary);
      expect(evidence).not.toContain('v4-native-private-key');
    });
  },
);

function parentPath(path: string) {
  const separator = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return path.slice(0, separator);
}
