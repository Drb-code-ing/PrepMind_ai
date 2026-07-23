import { randomUUID } from 'node:crypto';
import { link, mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOpenAICompatibleStructuredExecutor, type StructuredModelExecutor } from '@repo/ai';

import {
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION,
  type Phase697TutorOrganizerReport,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import {
  createPhase697TutorOrganizerLiveHarness,
  createPhase697TutorOrganizerMockHarness,
  runPhase697TutorOrganizerPairedEval,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-paired.ts';
import {
  hasSensitivePhase697Evidence,
  validatePhase697TutorOrganizerEvidenceValue,
} from './validate-phase-6-9-7-tutor-wrong-question-evidence.ts';

export const PHASE_6_9_7_LIVE_CONFIRMATION =
  'I_ACCEPT_PHASE_6_9_7_TUTOR_ORGANIZER_CONTROLLED_LIVE_ONCE' as const;
const LIVE_MARKER_PATH = '.tmp/phase-6-9-7-tutor-organizer-controlled-live.marker' as const;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
const TUTOR_TIMEOUT_MS = 3_000 as const;
const ORGANIZER_TIMEOUT_MS = 5_000 as const;

const OTHER_AGENT_GATES = [
  'ROUTER_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_VERIFIER_AGENT_MODEL_ENABLED',
  'REVIEW_AGENT_MODEL_ENABLED',
  'PLANNER_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED',
] as const;

export type Phase697TutorOrganizerCliParseResult =
  | Readonly<{
      ok: true;
      mode: 'mock' | 'live';
      runScope: 'branch' | 'main';
    }>
  | Readonly<{
      ok: false;
      code: 'cli_invalid' | 'live_authorization_required';
    }>;

export type Phase697TutorOrganizerCliResult =
  | Readonly<{
      ok: true;
      runId: string;
      versions: Readonly<{
        runner: string;
        dataset: string;
        datasetSha256: string;
        tutorPrompt: string;
        organizerPrompt: string;
        tutorSchema: string;
        organizerSchema: string;
        executorProvenance: 'mock_synthetic' | 'deepseek_network' | 'synthetic_test';
      }>;
      counts: Phase697TutorOrganizerReport['counts'];
      metrics: Phase697TutorOrganizerReport['metrics'];
      latency: Readonly<{
        tutorP95Ms: number;
        organizerP95Ms: number;
        pairedCandidateP95Ms: number;
        tutorOrchestrationP95Ms: number;
      }>;
      usage: Phase697TutorOrganizerReport['usage'];
      gate: Phase697TutorOrganizerReport['gate'];
      evidencePath: string;
    }>
  | Readonly<{ ok: false; code: string }>;

export type Phase697TutorOrganizerCliInput = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  runId?: string;
}>;

type SyntheticTestExecutors = Readonly<{
  tutorExecutor: StructuredModelExecutor;
  organizerExecutor: StructuredModelExecutor;
}>;

export function parsePhase697TutorOrganizerCli(input: {
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): Phase697TutorOrganizerCliParseResult {
  const mode = input.argv[0];
  if (mode === 'mock') {
    if (input.argv.length > 2) return { ok: false, code: 'cli_invalid' };
    const runScope = parseScope(input.argv[1]);
    return runScope ? { ok: true, mode, runScope } : { ok: false, code: 'cli_invalid' };
  }
  if (mode === 'live') {
    if (input.argv.length < 2 || input.argv.length > 3) {
      return { ok: false, code: 'live_authorization_required' };
    }
    if (
      input.argv[1] !== PHASE_6_9_7_LIVE_CONFIRMATION ||
      safeReadEnv(input.env, 'PHASE_6_9_7_CONTROLLED_LIVE_APPROVED') !== 'true'
    ) {
      return { ok: false, code: 'live_authorization_required' };
    }
    const runScope = parseScope(input.argv[2]);
    return runScope ? { ok: true, mode, runScope } : { ok: false, code: 'cli_invalid' };
  }
  return { ok: false, code: 'cli_invalid' };
}

export async function executePhase697TutorOrganizerCli(
  input: Phase697TutorOrganizerCliInput,
): Promise<Phase697TutorOrganizerCliResult> {
  return executePhase697TutorOrganizerCliInternal(input);
}

export async function executePhase697TutorOrganizerCliWithSyntheticExecutorsForTest(
  input: Phase697TutorOrganizerCliInput & SyntheticTestExecutors,
): Promise<Phase697TutorOrganizerCliResult> {
  return executePhase697TutorOrganizerCliInternal(input, {
    tutorExecutor: input.tutorExecutor,
    organizerExecutor: input.organizerExecutor,
  });
}

async function executePhase697TutorOrganizerCliInternal(
  input: Phase697TutorOrganizerCliInput,
  syntheticTestExecutors?: SyntheticTestExecutors,
): Promise<Phase697TutorOrganizerCliResult> {
  const parsed = parsePhase697TutorOrganizerCli(input);
  if (!parsed.ok) return parsed;
  const root = input.repositoryRoot ?? fileURLToPath(new URL('../../../', import.meta.url));

  let harness;
  if (parsed.mode === 'mock') {
    harness = createPhase697TutorOrganizerMockHarness({
      runScope: parsed.runScope,
      ...(input.runId ? { runId: input.runId } : {}),
    });
  } else {
    const live = resolveLiveConfiguration(input.env);
    if (!live.ok) return live;
    const runId = input.runId ?? randomUUID();
    const markerResult = await reserveLiveMarker({
      root,
      runId,
      runScope: parsed.runScope,
    });
    if (!markerResult.ok) return markerResult;

    const tutorExecutor =
      syntheticTestExecutors?.tutorExecutor ??
      createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: live.tutorApiKey,
        baseURL: DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      });
    const organizerExecutor =
      syntheticTestExecutors?.organizerExecutor ??
      createOpenAICompatibleStructuredExecutor({
        provider: 'deepseek',
        apiKey: live.organizerApiKey,
        baseURL: DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
        structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      });
    harness = createPhase697TutorOrganizerLiveHarness({
      tutorExecutor,
      organizerExecutor,
      runScope: parsed.runScope,
      runId,
      tutorTimeoutMs: TUTOR_TIMEOUT_MS,
      organizerTimeoutMs: ORGANIZER_TIMEOUT_MS,
      executorProvenance: syntheticTestExecutors ? 'synthetic_test' : 'deepseek_network',
    });
  }

  let report: Phase697TutorOrganizerReport;
  try {
    report = await runPhase697TutorOrganizerPairedEval(harness);
  } catch {
    return { ok: false, code: 'execution_failed' };
  }
  if (
    hasSensitivePhase697Evidence(report) ||
    !validatePhase697TutorOrganizerEvidenceValue(report).ok
  ) {
    return { ok: false, code: 'evidence_contract_invalid' };
  }

  const evidencePath = `.tmp/phase-6-9-7-tutor-organizer-${report.runScope}-${report.mode}-${report.runId}.json`;
  const published = await publishImmutableEvidence({
    root,
    evidencePath,
    report,
  });
  if (!published.ok) return published;

  return {
    ok: true,
    runId: report.runId,
    versions: {
      runner: report.runnerVersion,
      dataset: report.datasetVersion,
      datasetSha256: report.datasetSha256,
      tutorPrompt: report.identities.tutorPromptVersion,
      organizerPrompt: report.identities.organizerPromptVersion,
      tutorSchema: report.identities.tutorSchemaVersion,
      organizerSchema: report.identities.organizerSchemaVersion,
      executorProvenance: report.identities.executorProvenance,
    },
    counts: report.counts,
    metrics: report.metrics,
    latency: {
      tutorP95Ms: report.latency.tutorP95Ms,
      organizerP95Ms: report.latency.organizerP95Ms,
      pairedCandidateP95Ms: report.latency.pairedCandidateP95Ms,
      tutorOrchestrationP95Ms: report.latency.tutorOrchestrationP95Ms,
    },
    usage: report.usage,
    gate: report.gate,
    evidencePath,
  };
}

function parseScope(value: string | undefined): 'branch' | 'main' | null {
  if (value === undefined) return 'branch';
  return value === '--main' ? 'main' : null;
}

function resolveLiveConfiguration(env: Readonly<Record<string, string | undefined>>):
  | Readonly<{
      ok: true;
      tutorApiKey: string;
      organizerApiKey: string;
    }>
  | Readonly<{ ok: false; code: 'live_configuration_invalid' }> {
  try {
    const tutorApiKey = validCredential(safeReadEnv(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY'));
    const organizerApiKey = validCredential(
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY'),
    );
    const otherGateEnabled = OTHER_AGENT_GATES.some((key) => safeReadEnv(env, key) === 'true');
    if (
      safeReadEnv(env, 'AI_PROVIDER_MODE') !== 'live' ||
      safeReadEnv(env, 'AI_ENABLE_LIVE_CALLS') !== 'true' ||
      safeReadEnv(env, 'TUTOR_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'AI_BASE_URL') !== DEEPSEEK_BASE_URL ||
      !validFixedTimeout(safeReadEnv(env, 'TUTOR_AGENT_MODEL_TIMEOUT_MS'), TUTOR_TIMEOUT_MS) ||
      !validFixedTimeout(
        safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS'),
        ORGANIZER_TIMEOUT_MS,
      ) ||
      tutorApiKey === null ||
      organizerApiKey === null ||
      otherGateEnabled
    ) {
      return { ok: false, code: 'live_configuration_invalid' };
    }
    return { ok: true, tutorApiKey, organizerApiKey };
  } catch {
    return { ok: false, code: 'live_configuration_invalid' };
  }
}

function validCredential(value: string | undefined): string | null {
  if (value === undefined || value.length < 1 || value.length > 512) return null;
  if (value !== value.trim() || /[\r\n]/.test(value)) return null;
  return value;
}

function validFixedTimeout(value: string | undefined, expected: number) {
  return value === undefined || value === '' || value === String(expected);
}

function safeReadEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
    throw new Error('PHASE_6_9_7_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

async function reserveLiveMarker(input: {
  root: string;
  runId: string;
  runScope: 'branch' | 'main';
}): Promise<
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: 'live_already_attempted' | 'evidence_io_failed';
    }>
> {
  const markerPath = resolve(input.root, LIVE_MARKER_PATH);
  try {
    await mkdir(dirname(markerPath), { recursive: true });
  } catch {
    return { ok: false, code: 'evidence_io_failed' };
  }
  try {
    await writeFile(
      markerPath,
      `${JSON.stringify({
        runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION,
        runId: input.runId,
        runScope: input.runScope,
        state: 'attempt_reserved',
      })}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    return { ok: true };
  } catch {
    return { ok: false, code: 'live_already_attempted' };
  }
}

async function publishImmutableEvidence(input: {
  root: string;
  evidencePath: string;
  report: Phase697TutorOrganizerReport;
}): Promise<
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: 'evidence_target_exists' | 'evidence_io_failed';
    }>
> {
  const absolutePath = resolve(input.root, input.evidencePath);
  const temporaryPath = `${absolutePath}.tmp-${process.pid}-${input.report.runId}`;
  try {
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(input.report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch {
    return { ok: false, code: 'evidence_io_failed' };
  }
  try {
    await link(temporaryPath, absolutePath);
  } catch {
    await unlink(temporaryPath).catch(() => undefined);
    return { ok: false, code: 'evidence_target_exists' };
  }
  try {
    await unlink(temporaryPath);
  } catch {
    return { ok: false, code: 'evidence_io_failed' };
  }
  return { ok: true };
}

if (import.meta.main) {
  try {
    const result = await executePhase697TutorOrganizerCli({
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
