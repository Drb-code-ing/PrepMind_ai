import { link, mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenAICompatibleStructuredExecutor } from '@repo/ai';
import type { StructuredModelExecutor } from '@repo/ai';

import {
  createKnowledgeAgentLiveHarness,
  createKnowledgeAgentMockHarness,
  runKnowledgeAgentPairedEval,
} from '../src/evals/run-phase-6-9-knowledge-agent-paired.ts';
import type { KnowledgeAgentPairedReport } from '../src/evals/phase-6-9-knowledge-agent-paired-contract.ts';

const SENSITIVE_EVIDENCE_KEY =
  /prompt|filename|summary|chunk|embedding|provider.*(?:body|header|response)|credential|api.?key|raw.*error/i;

export type Phase696KnowledgeCliResult =
  | Readonly<{
      ok: true;
      mode: 'deterministic' | 'mock' | 'live' | 'validate';
      runScope: 'branch' | 'main';
    }>
  | Readonly<{
      ok: false;
      code:
        | 'cli_invalid'
        | 'live_authorization_required'
        | 'live_configuration_invalid';
    }>;

export function containsSensitiveEvidenceKey(key: string): boolean {
  if (key === 'promptVersion') return false;
  return SENSITIVE_EVIDENCE_KEY.test(key);
}

export function parsePhase696KnowledgeAgentCli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase696KnowledgeCliResult {
  if (input.argv.length < 1 || input.argv.length > 2) {
    return { ok: false, code: 'cli_invalid' };
  }
  const mode = input.argv[0];
  if (
    mode !== 'baseline' &&
    mode !== 'mock' &&
    mode !== 'live' &&
    mode !== 'validate'
  ) {
    return { ok: false, code: 'cli_invalid' };
  }
  const scopeArgument = input.argv[1];
  const runScope = scopeArgument === undefined
    ? 'branch'
    : scopeArgument === '--main'
      ? 'main'
      : null;
  if (runScope === null) return { ok: false, code: 'cli_invalid' };
  if (
    mode === 'live' &&
    input.env.PHASE_6_9_6_CONTROLLED_LIVE_APPROVED !== 'true'
  ) {
    return { ok: false, code: 'live_authorization_required' };
  }
  return {
    ok: true,
    mode: mode === 'baseline' ? 'deterministic' : mode,
    runScope,
  };
}

export async function executePhase696KnowledgeAgentCli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  liveExecutor?: StructuredModelExecutor;
}): Promise<
  | Readonly<{
      ok: true;
      runId: string;
      versions: Readonly<{
        dataset: string;
        prompt: string;
        projection: string;
        shortlist: string;
      }>;
      counts: KnowledgeAgentPairedReport['counts'];
      metrics: KnowledgeAgentPairedReport['metrics'];
      latency: KnowledgeAgentPairedReport['latency'];
      usage: KnowledgeAgentPairedReport['usage'];
      gate: KnowledgeAgentPairedReport['gate'];
      evidencePath: string;
    }>
  | Readonly<{ ok: false; code: string }>
> {
  const parsed = parsePhase696KnowledgeAgentCli(input);
  if (!parsed.ok) return parsed;
  if (parsed.mode !== 'mock' && parsed.mode !== 'live') {
    return { ok: false, code: 'mode_requires_dedicated_runner' };
  }
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));
  let harness;
  if (parsed.mode === 'mock') {
    harness = {
      ...createKnowledgeAgentMockHarness(),
      runScope: parsed.runScope,
    } as const;
  } else {
    const live = resolveLiveConfiguration(input.env);
    if (!live.ok) return live;
    const executor =
      input.liveExecutor ??
      createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: live.apiKey,
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      });
    harness = createKnowledgeAgentLiveHarness({
      executor,
      runScope: parsed.runScope,
      timeoutMs: live.timeoutMs,
    });
    const markerPath = resolve(root, '.tmp/phase-6-9-6-controlled-live.marker');
    await mkdir(dirname(markerPath), { recursive: true });
    try {
      await writeFile(markerPath, `${harness.runId}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
    } catch {
      return { ok: false, code: 'live_already_attempted' };
    }
  }
  const report = await runKnowledgeAgentPairedEval(harness);
  if (hasSensitiveEvidence(report)) {
    return { ok: false, code: 'sensitive_evidence' };
  }
  const evidencePath =
    parsed.mode === 'mock'
      ? `.tmp/phase-6-9-6-knowledge-agent-${parsed.runScope}-mock.json`
      : `.tmp/phase-6-9-6-knowledge-agent-${parsed.runScope}-live-${report.runId}.json`;
  const absolutePath = resolve(root, evidencePath);
  const temporaryPath = `${absolutePath}.tmp-${process.pid}`;
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  if (parsed.mode === 'live') {
    try {
      await link(temporaryPath, absolutePath);
    } catch {
      await unlink(temporaryPath).catch(() => undefined);
      return { ok: false, code: 'evidence_target_exists' };
    }
    await unlink(temporaryPath);
  } else {
    await rename(temporaryPath, absolutePath);
  }
  return {
    ok: true,
    runId: report.runId,
    versions: {
      dataset: report.datasetVersion,
      prompt: report.promptVersion,
      projection: report.projectionVersion,
      shortlist: report.shortlistVersion,
    },
    counts: report.counts,
    metrics: report.metrics,
    latency: report.latency,
    usage: report.usage,
    gate: report.gate,
    evidencePath,
  };
}

function resolveLiveConfiguration(
  env: Readonly<Record<string, string | undefined>>,
):
  | Readonly<{ ok: true; apiKey: string; timeoutMs: number }>
  | Readonly<{ ok: false; code: 'live_configuration_invalid' }> {
  const rawApiKey = env.DEEPSEEK_API_KEY ?? '';
  const apiKey = rawApiKey.trim();
  const dedupTimeout = parseTimeout(env.KNOWLEDGE_DEDUP_AGENT_MODEL_TIMEOUT_MS);
  const organizerTimeout = parseTimeout(env.KNOWLEDGE_ORGANIZER_AGENT_MODEL_TIMEOUT_MS);
  if (
    env.AI_PROVIDER_MODE !== 'live' ||
    env.AI_ENABLE_LIVE_CALLS !== 'true' ||
    env.KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED !== 'true' ||
    env.KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED !== 'true' ||
    env.AI_BASE_URL !== 'https://api.deepseek.com/v1' ||
    apiKey.length < 1 ||
    apiKey.length > 512 ||
    /[\r\n]/.test(rawApiKey) ||
    dedupTimeout === null ||
    organizerTimeout === null
  ) {
    return { ok: false, code: 'live_configuration_invalid' };
  }
  return { ok: true, apiKey, timeoutMs: Math.max(dedupTimeout, organizerTimeout) };
}

function parseTimeout(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return 4500;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1000 && parsed <= 15_000
    ? parsed
    : null;
}

export function hasSensitiveEvidence(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSensitiveEvidence);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value).some(
    ([key, child]) => containsSensitiveEvidenceKey(key) || hasSensitiveEvidence(child),
  );
}

if (import.meta.main) {
  try {
    const result = await executePhase696KnowledgeAgentCli({
      argv: process.argv.slice(2),
      env: process.env,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  } catch {
    process.stdout.write(`${JSON.stringify({ ok: false, code: 'execution_failed' })}\n`);
    process.exitCode = 1;
  }
}
