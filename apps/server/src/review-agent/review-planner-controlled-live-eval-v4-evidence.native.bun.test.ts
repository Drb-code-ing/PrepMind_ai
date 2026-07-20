import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { ReviewPlannerDiagnosticCode } from '@repo/agent';

import { executeReviewPlannerControlledLiveV4Cli } from './review-planner-controlled-live-eval-v4-cli';
import { reserveReviewPlannerControlledLiveV4Evidence } from './review-planner-controlled-live-eval-v4-evidence';
import { createReviewPlannerControlledLiveV4Evaluator } from './review-planner-controlled-live-eval-v4.factory';

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
      const repositoryRoot = resolve(process.cwd());
      const historicalManifest =
        await readHistoricalEvidenceManifest(repositoryRoot);
      expect(historicalManifest.map((entry) => entry.relativePath)).toEqual(
        expect.arrayContaining([
          'docs/acceptance/evidence/phase-6-9-5-controlled-live/.review-planner-controlled-live.once',
          'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2/.review-planner-controlled-live-v2.once',
          'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3/.review-planner-controlled-live-v3.once',
        ]),
      );
      await Promise.all(
        historicalManifest.map(async (entry) => {
          const path = join(root, entry.relativePath);
          await mkdir(parentPath(path), { recursive: true });
          await writeFile(path, entry.contents);
        }),
      );
      const before = await readHistoricalEvidenceManifest(root);

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

      await expect(readHistoricalEvidenceManifest(root)).resolves.toEqual(
        before,
      );
    });

    it('writes the trusted direct fake-fetch schema stage without raw provider content', async () => {
      const rawCanary = 'RAW_V4_NATIVE_EVIDENCE_SCHEMA_CANARY';
      await withFakeJsonFetch(
        {
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
        },
        async (fetchCalls) => {
          const createEvaluator = (candidateEnv: Record<string, unknown>) =>
            createReviewPlannerControlledLiveV4Evaluator(candidateEnv, {
              isPricingKnown: () => true,
            });

          const result = await executeReviewPlannerControlledLiveV4Cli({
            argv: ['--confirm-controlled-live-v4'],
            env: controlledLiveEnv(),
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
          expect(fetchCalls.value).toBe(1);

          const evidence = await readV4Evidence(root);
          expect(evidence).toContain(
            '"structuredOutputStage":"provider_type_validation"',
          );
          expect(evidence).not.toContain(rawCanary);
          expect(evidence).not.toContain('v4-native-private-key');
        },
      );
    });

    it('writes provider_object_missing for a direct fake-fetch response without choices', async () => {
      const rawCanary = 'RAW_V4_NATIVE_EVIDENCE_MISSING_CHOICES_CANARY';
      await expectProviderObjectMissingEvidence({
        root,
        rawCanary,
        payload: {
          raw: rawCanary,
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        },
      });
    });

    it('writes provider_object_missing for a direct fake-fetch response without message content', async () => {
      const rawCanary = 'RAW_V4_NATIVE_EVIDENCE_MISSING_CONTENT_CANARY';
      await expectProviderObjectMissingEvidence({
        root,
        rawCanary,
        payload: {
          choices: [
            {
              message: {
                reasoning_content: rawCanary,
              },
            },
          ],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        },
      });
    });
  },
);

async function expectProviderObjectMissingEvidence(
  input: Readonly<{
    root: string;
    rawCanary: string;
    payload: unknown;
  }>,
) {
  await withFakeJsonFetch(input.payload, async (fetchCalls) => {
    const createEvaluator = (candidateEnv: Record<string, unknown>) =>
      createReviewPlannerControlledLiveV4Evaluator(candidateEnv, {
        isPricingKnown: () => true,
      });

    const result = await executeReviewPlannerControlledLiveV4Cli({
      argv: ['--confirm-controlled-live-v4'],
      env: controlledLiveEnv(),
      root: input.root,
      createEvaluator,
    });

    expect(result).toEqual({
      status: 'invalid_attempted',
      gate: 'closed',
      providerAttemptCount: 1,
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.StructuredOutput,
      structuredOutputStage: 'provider_object_missing',
    });
    expect(fetchCalls.value).toBe(1);
    const evidence = await readV4Evidence(input.root);
    expect(evidence).toContain(
      '"structuredOutputStage":"provider_object_missing"',
    );
    expect(evidence).not.toContain(input.rawCanary);
    expect(evidence).not.toContain('v4-native-private-key');
  });
}

async function withFakeJsonFetch<T>(
  payload: unknown,
  run: (fetchCalls: { value: number }) => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const fetchCalls = { value: 0 };
  const fakeFetch: typeof globalThis.fetch = () => {
    fetchCalls.value += 1;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    } as Response);
  };
  globalThis.fetch = fakeFetch;
  try {
    return await run(fetchCalls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function controlledLiveEnv(): Record<string, string> {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED: 'true',
    REVIEW_AGENT_MODEL_ENABLED: 'false',
    PLANNER_AGENT_MODEL_ENABLED: 'false',
    AI_MODEL: 'deepseek-v4-flash',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    DEEPSEEK_API_KEY: 'v4-native-private-key',
  };
}

async function readV4Evidence(root: string) {
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
  return readFile(join(evidenceDirectory, evidenceLeaf), 'utf8');
}

const HISTORICAL_EVIDENCE_DIRECTORIES = [
  'docs/acceptance/evidence/phase-6-9-5-controlled-live',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v2',
  'docs/acceptance/evidence/phase-6-9-5-controlled-live-v3',
] as const;

type HistoricalEvidenceManifestEntry = Readonly<{
  relativePath: string;
  contents: Buffer;
}>;

async function readHistoricalEvidenceManifest(
  manifestRoot: string,
): Promise<readonly HistoricalEvidenceManifestEntry[]> {
  const entries = await Promise.all(
    HISTORICAL_EVIDENCE_DIRECTORIES.map((directory) =>
      readEvidenceTree(manifestRoot, directory),
    ),
  );
  return entries
    .flat()
    .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function readEvidenceTree(
  manifestRoot: string,
  directory: string,
): Promise<readonly HistoricalEvidenceManifestEntry[]> {
  const absoluteDirectory = join(manifestRoot, directory);
  const output: HistoricalEvidenceManifestEntry[] = [];
  for (const entry of (
    await readdir(absoluteDirectory, { withFileTypes: true })
  ).sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      output.push(
        ...(await readEvidenceTree(
          manifestRoot,
          relative(manifestRoot, absolutePath),
        )),
      );
      continue;
    }
    if (!entry.isFile()) {
      throw new Error('expected regular historical evidence file');
    }
    output.push({
      relativePath: relative(manifestRoot, absolutePath).replaceAll('\\', '/'),
      contents: await readFile(absolutePath),
    });
  }
  return output;
}

function parentPath(path: string) {
  const separator = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return path.slice(0, separator);
}
