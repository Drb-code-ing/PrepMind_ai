import { dirname, resolve, sep } from 'node:path';

import {
  compileDeepSeekStrictToolSchemaProfiles,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  hashModelAgentRunId,
  type StructuredModelExecutor,
} from '@repo/ai';

import {
  buildPhase6943InvalidRun,
  calculatePhase6943DatasetDigest,
  parsePhase6943Output,
  validatePhase6943Dataset,
  type Phase6943InvalidRun,
  type Phase6943Output,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';
import { createPhase6943MockRuntime } from '../src/evals/phase-6-9-router-verifier-mock-fixtures.ts';
import {
  runPhase6943PairedEval,
  type Phase6943Clocks,
  type Phase6943LiveDependencies,
} from '../src/evals/run-phase-6-9-router-verifier-paired.ts';
import { KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/knowledge-verifier-model-candidate.ts';
import { ROUTER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/router-model-candidate.ts';

export const LIVE_CASE_TIMEOUT_MS = 10_000;
export const DEEPSEEK_MODEL = 'deepseek-v4-flash';
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/beta';
export const PHASE_6943_LIVE_SCHEMA_PROFILES = Object.freeze([
  Object.freeze({
    name: 'router_candidate_v1',
    schema: ROUTER_MODEL_CANDIDATE_SCHEMA,
  }),
  Object.freeze({
    name: 'knowledge_verifier_candidate_v1',
    schema: KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA,
  }),
] as const);
const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,9})?$/;
const MAX_ENGINEERING_COST_USD = 0.1;
const PROVIDER_INPUT_TOKEN_CAP = 96_000;
const PROVIDER_OUTPUT_TOKEN_CAP = 11_200;

export function parseBoundedDecimal(value: string): number | null {
  if (!DECIMAL_PATTERN.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null;
}

export function phase6943ExitCode(output: Phase6943Output): 0 | 1 | 2 | 3 {
  if (output.kind === 'invalid_run') return 3;
  if (output.runStatus === 'incomplete') return 2;
  return output.decisions.every((decision) => decision.enabled) ? 0 : 1;
}

export type Phase6943CliConfig =
  | { command: 'mock'; persist: false }
  | { command: 'mock'; persist: true }
  | {
      command: 'live';
      persist: true;
      apiKey: string;
      inputUsdPerMillion: number;
      outputUsdPerMillion: number;
      cliMaxCostUsd: number;
      effectiveMaxCostUsd: number;
    };

export type ParsePhase6943CliResult =
  | { ok: true; config: Phase6943CliConfig }
  | { ok: false; output: Phase6943InvalidRun; exitCode: 3 };

const VALUE_FLAGS = new Set([
  '--input-price-usd-per-million',
  '--output-price-usd-per-million',
  '--max-cost-usd',
]);

export function withPhase6943UsageProvenance(input: {
  executor: StructuredModelExecutor;
  onProviderAttempt(): void;
}): StructuredModelExecutor {
  return async (request) => {
    input.onProviderAttempt();
    const result = await input.executor(request);
    if (
      !Number.isSafeInteger(result.usage?.inputTokens) ||
      !Number.isSafeInteger(result.usage?.outputTokens) ||
      (result.usage?.inputTokens ?? 0) <= 0 ||
      (result.usage?.outputTokens ?? 0) <= 0
    ) {
      throw new Error('PHASE_6943_USAGE_UNVERIFIABLE');
    }
    return result;
  };
}

export function parsePhase6943Cli(input: {
  command: 'mock' | 'mock-evidence' | 'live';
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): ParsePhase6943CliResult {
  try {
    return parsePhase6943CliUnchecked(input);
  } catch {
    return input.command === 'live'
      ? cliFailure('live', 'live_config_invalid')
      : cliFailure('mock', 'report_contract_invalid');
  }
}

function parsePhase6943CliUnchecked(input: {
  command: 'mock' | 'mock-evidence' | 'live';
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
}): ParsePhase6943CliResult {
  if (input.command !== 'live') {
    return input.argv.length === 0
      ? {
          ok: true,
          config: { command: 'mock', persist: input.command === 'mock-evidence' },
        }
      : cliFailure('mock', 'report_contract_invalid');
  }

  const values = new Map<string, string>();
  let sawLive = false;
  for (let index = 0; index < input.argv.length; index += 1) {
    const token = input.argv[index];
    if (token === '--live') {
      if (sawLive) return cliFailure('live', 'live_config_invalid');
      sawLive = true;
      continue;
    }
    if (typeof token !== 'string' || !VALUE_FLAGS.has(token) || token.includes('=')) {
      return cliFailure('live', 'live_config_invalid');
    }
    if (values.has(token)) return cliFailure('live', 'live_config_invalid');
    const value = input.argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return cliFailure('live', 'live_config_invalid');
    }
    values.set(token, value);
    index += 1;
  }

  const inputPrice = parseBoundedDecimal(
    values.get('--input-price-usd-per-million') ?? '',
  );
  const outputPrice = parseBoundedDecimal(
    values.get('--output-price-usd-per-million') ?? '',
  );
  const maxCost = parseBoundedDecimal(values.get('--max-cost-usd') ?? '');
  const rawApiKey = input.env.DEEPSEEK_API_KEY ?? '';
  const apiKey = rawApiKey.trim();
  if (
    !sawLive ||
    inputPrice === null ||
    outputPrice === null ||
    maxCost === null ||
    input.env.AI_PROVIDER_MODE?.trim() !== 'live' ||
    input.env.AI_ENABLE_LIVE_CALLS?.trim() !== 'true' ||
    input.env.AI_MODEL?.trim() !== DEEPSEEK_MODEL ||
    normalizeDeepSeekUrl(input.env.AI_BASE_URL) !== DEEPSEEK_BASE_URL ||
    apiKey.length < 1 ||
    apiKey.length > 512 ||
    /[\r\n]/.test(rawApiKey)
  ) {
    return cliFailure('live', 'live_config_invalid');
  }

  const effectiveMaxCostUsd = Math.min(maxCost, MAX_ENGINEERING_COST_USD);
  const worstCaseCostUsd =
    (PROVIDER_INPUT_TOKEN_CAP / 1_000_000) * inputPrice +
    (PROVIDER_OUTPUT_TOKEN_CAP / 1_000_000) * outputPrice;
  if (!Number.isFinite(worstCaseCostUsd) || worstCaseCostUsd > effectiveMaxCostUsd) {
    return cliFailure('live', 'live_config_invalid');
  }

  return {
    ok: true,
    config: {
      command: 'live',
      persist: true,
      apiKey,
      inputUsdPerMillion: inputPrice,
      outputUsdPerMillion: outputPrice,
      cliMaxCostUsd: maxCost,
      effectiveMaxCostUsd,
    },
  };
}

function normalizeDeepSeekUrl(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (value !== DEEPSEEK_BASE_URL) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'api.deepseek.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.pathname === '/beta' ? `${url.origin}${url.pathname}` : null;
  } catch {
    return null;
  }
}

export function validatePhase6943LiveStructuredSchemas(): boolean {
  try {
    const registry = compileDeepSeekStrictToolSchemaProfiles(
      PHASE_6943_LIVE_SCHEMA_PROFILES,
    );
    return (
      registry.resolve(ROUTER_MODEL_CANDIDATE_SCHEMA)?.name ===
        'router_candidate_v1' &&
      registry.resolve(KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA)?.name ===
        'knowledge_verifier_candidate_v1'
    );
  } catch {
    return false;
  }
}

function cliFailure(
  runKind: 'mock' | 'live',
  errorCode: 'report_contract_invalid' | 'live_config_invalid',
): ParsePhase6943CliResult {
  return {
    ok: false,
    output: buildPhase6943InvalidRun(runKind, errorCode),
    exitCode: 3,
  };
}

const PHASE_6943_FORBIDDEN_CANARIES = [
  'QUERY_CANARY',
  'CHUNK_CANARY',
  'PROMPT_CANARY',
  'PROVIDER_OUTPUT_CANARY',
  'RAW_ERROR_CANARY',
  'RAW_PROVIDER_CANARY',
  'API_KEY_CANARY',
  'BASE_URL_CANARY',
  'COOKIE_CANARY',
  'TOKEN_CANARY',
  'PRIVATE_KEY_CANARY',
] as const;

export function containsForbiddenCanary(serialized: string): boolean {
  return (
    PHASE_6943_FORBIDDEN_CANARIES.some((value) => serialized.includes(value)) ||
    /authorization\s*:\s*bearer|-----begin [a-z ]*private key-----|(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]/i.test(
      serialized,
    ) ||
    /(?:^|[^a-z0-9_-])sk-[a-z0-9_-]{16,}(?![a-z0-9_-])/i.test(serialized)
  );
}

function parsePhase6943RunIdHash(value: string): `sha256:${string}` | null {
  return /^sha256:[a-f0-9]{64}$/.test(value)
    ? (value as `sha256:${string}`)
    : null;
}

export type Phase6943EvidenceFs = Pick<
  typeof import('node:fs/promises'),
  'open' | 'link' | 'unlink' | 'mkdir' | 'stat'
>;

export async function reservePhase6943Evidence(input: {
  root: string;
  runKind: 'mock' | 'live';
  startedAt: string;
  runIdHash: `sha256:${string}`;
  fs: Phase6943EvidenceFs;
}): Promise<{
  relativePath: string;
  commit(output: Phase6943Output): Promise<
    { ok: true } | { ok: false; errorCode: 'unsafe_evidence' | 'evidence_write_failed' }
  >;
  release(): Promise<void>;
}> {
  const relativePath =
    input.runKind === 'mock'
      ? 'docs/acceptance/evidence/phase-6-9-4-3/mock.json'
      : buildPhase6943LiveEvidencePath(input.startedAt, input.runIdHash);
  const target = resolveInsideRoot(input.root, relativePath);
  const reserve = `${target}.reserve`;
  const temp = `${target}.tmp-${process.pid}`;
  await input.fs.mkdir(dirname(target), { recursive: true });
  let reserveOwned = false;
  let reserveReady = false;
  const targetExists = new Error('PHASE_6943_EVIDENCE_TARGET_EXISTS');
  try {
    const reserveHandle = await input.fs.open(reserve, 'wx');
    reserveOwned = true;
    try {
      await reserveHandle.close();
    } catch {
      throw new Error('PHASE_6943_EVIDENCE_RESERVATION_FAILED');
    }

    try {
      await input.fs.stat(target);
      throw targetExists;
    } catch (error) {
      if (error === targetExists) throw error;
      if (errorCode(error) !== 'ENOENT') {
        throw new Error('PHASE_6943_EVIDENCE_RESERVATION_FAILED');
      }
    }
    reserveReady = true;
  } catch (error) {
    if (!reserveOwned) throw error;
    if (error === targetExists) {
      throw new Error('PHASE_6943_EVIDENCE_TARGET_EXISTS');
    }
    if (
      error instanceof Error &&
      error.message === 'PHASE_6943_EVIDENCE_RESERVATION_FAILED'
    ) {
      throw error;
    }
    throw new Error('PHASE_6943_EVIDENCE_RESERVATION_FAILED');
  } finally {
    if (reserveOwned && !reserveReady) {
      await input.fs.unlink(reserve).catch(() => undefined);
      reserveOwned = false;
    }
  }

  let tempOwned = false;
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    if (tempOwned) {
      await input.fs.unlink(temp).catch(() => undefined);
      tempOwned = false;
    }
    if (reserveOwned) {
      await input.fs.unlink(reserve).catch(() => undefined);
      reserveOwned = false;
    }
  };

  return {
    relativePath,
    release,
    async commit(output) {
      const serialized = JSON.stringify(output);
      const parsed = parsePhase6943Output(output);
      if (!parsed.ok || containsForbiddenCanary(serialized)) {
        await release();
        return { ok: false, errorCode: 'unsafe_evidence' };
      }

      let tempHandle: Awaited<ReturnType<Phase6943EvidenceFs['open']>> | null = null;
      try {
        tempHandle = await input.fs.open(temp, 'wx');
        tempOwned = true;
        await tempHandle.writeFile(`${JSON.stringify(parsed.output, null, 2)}\n`, 'utf8');
        await tempHandle.sync();
        await tempHandle.close();
        tempHandle = null;
        await input.fs.link(temp, target);
        await release();
        return { ok: true };
      } catch {
        if (tempHandle) await tempHandle.close().catch(() => undefined);
        await release();
        return { ok: false, errorCode: 'evidence_write_failed' };
      }
    },
  };
}

function errorCode(error: unknown): string | null {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null;
}

export function buildPhase6943LiveEvidencePath(
  startedAt: string,
  runIdHash: string,
): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(runIdHash)) {
    throw new Error('PHASE_6943_EVIDENCE_IDENTITY_INVALID');
  }
  let iso: string;
  try {
    iso = new Date(startedAt).toISOString();
  } catch {
    throw new Error('PHASE_6943_EVIDENCE_IDENTITY_INVALID');
  }
  const utc = iso.replace(/[-:]/g, '').replace('.', '');
  const hash = runIdHash.slice('sha256:'.length, 'sha256:'.length + 12);
  return `docs/acceptance/evidence/phase-6-9-4-3/live-${utc}-${hash}.json`;
}

export function resolveInsideRoot(root: string, relative: string): string {
  const normalizedRoot = resolve(root);
  const target = resolve(normalizedRoot, relative);
  if (!target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error('OUTSIDE_REPOSITORY');
  }
  return target;
}

export function createPhase6943LiveDependencies(
  config: Extract<Phase6943CliConfig, { command: 'live' }>,
  onProviderAttempt: () => void,
  capturedAt: string,
  createExecutor: typeof createOpenAICompatibleStructuredExecutor =
    createOpenAICompatibleStructuredExecutor,
): Phase6943LiveDependencies {
  let providerAttempts = 0;
  const executor = withPhase6943UsageProvenance({
    executor: createExecutor({
      provider: 'deepseek',
      apiKey: config.apiKey,
      baseURL: DEEPSEEK_BASE_URL,
      model: DEEPSEEK_MODEL,
      structuredOutputMode: 'deepseek_strict_tool',
      schemaProfiles: PHASE_6943_LIVE_SCHEMA_PROFILES,
    }),
    onProviderAttempt: () => {
      providerAttempts += 1;
      onProviderAttempt();
    },
  });

  return {
    createRuntime: () =>
      createModelAgentRuntime({
        mode: 'live',
        provider: 'deepseek',
        model: DEEPSEEK_MODEL,
        liveCallsEnabled: true,
        timeoutMs: LIVE_CASE_TIMEOUT_MS,
        executor,
      }),
    readProviderAttempts: () => providerAttempts,
    pricing: {
      currency: 'USD',
      unitTokens: 1_000_000,
      inputUsdPerMillion: config.inputUsdPerMillion,
      outputUsdPerMillion: config.outputUsdPerMillion,
      inputPriceBasis: 'non_cached_highest_applicable',
      capturedAt,
      cliMaxCostUsd: config.cliMaxCostUsd,
      effectiveMaxCostUsd: config.effectiveMaxCostUsd,
    },
    budgetState: {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    },
  };
}

export type Phase6943CompositionDependencies = {
  validateLiveStructuredSchemas?(): boolean;
  runPairedEval: typeof runPhase6943PairedEval;
  createMockRuntime: typeof createPhase6943MockRuntime;
  createLiveDependencies(
    config: Extract<Phase6943CliConfig, { command: 'live' }>,
    onProviderAttempt: () => void,
    capturedAt: string,
  ): Phase6943LiveDependencies;
  calculateDatasetDigest: typeof calculatePhase6943DatasetDigest;
  validateDataset: typeof validatePhase6943Dataset;
};

export type CompositionInput = {
  command: 'mock' | 'mock-evidence' | 'live';
  argv: readonly string[];
  env: Readonly<Record<string, string | undefined>>;
  root: string;
  randomUUID(): string;
  epochMs(): number;
  clocks: Phase6943Clocks;
  fs: Phase6943EvidenceFs;
  dependencies: Phase6943CompositionDependencies;
};

export type ExecutePhase6943CliResult = {
  output: Phase6943Output;
  exitCode: 0 | 1 | 2 | 3;
  evidencePath: string | null;
};

export async function executePhase6943Cli(
  input: CompositionInput,
): Promise<ExecutePhase6943CliResult> {
  const parsed = parsePhase6943Cli({
    command: input.command,
    argv: input.argv,
    env: input.env,
  });
  if (!parsed.ok) {
    return { output: parsed.output, exitCode: 3, evidencePath: null };
  }

  if (parsed.config.command === 'live') {
    try {
      const validatorProperty = 'validateLiveStructuredSchemas';
      const hasInjectedValidator = Reflect.has(
        input.dependencies,
        validatorProperty,
      );
      const validator: unknown = hasInjectedValidator
        ? Reflect.get(input.dependencies, validatorProperty)
        : validatePhase6943LiveStructuredSchemas;
      const validation: unknown =
        typeof validator === 'function'
          ? Reflect.apply(validator, input.dependencies, [])
          : false;
      if (validation !== true) {
        return {
          output: buildPhase6943InvalidRun('live', 'live_config_invalid'),
          exitCode: 3,
          evidencePath: null,
        };
      }
    } catch {
      return {
        output: buildPhase6943InvalidRun('live', 'live_config_invalid'),
        exitCode: 3,
        evidencePath: null,
      };
    }
  }

  let providerAttempts = 0;
  let reservation: Awaited<ReturnType<typeof reservePhase6943Evidence>> | null = null;
  try {
    const runId = input.randomUUID();
    const startedAtMs = input.epochMs();
    const startedAt = new Date(startedAtMs).toISOString();
    let reportStartPending = true;
    const reportClocks: Phase6943Clocks = {
      epochMs: () => {
        if (reportStartPending) {
          reportStartPending = false;
          const runnerStartedAtMs = input.clocks.epochMs();
          if (
            !Number.isSafeInteger(runnerStartedAtMs) ||
            runnerStartedAtMs < 0 ||
            runnerStartedAtMs > 8_640_000_000_000_000
          ) {
            throw new Error('PHASE_6943_REPORT_CLOCK_INVALID');
          }
          return startedAtMs;
        }
        return input.clocks.epochMs();
      },
      monotonicMs: () => input.clocks.monotonicMs(),
    };
    const runIdHash = parsePhase6943RunIdHash(hashModelAgentRunId(runId));
    if (runIdHash === null) {
      const output = buildPhase6943InvalidRun(
        parsed.config.command,
        'unexpected_runner_error',
      );
      return { output, exitCode: 3, evidencePath: null };
    }

    if (parsed.config.persist) {
      reservation = await reservePhase6943Evidence({
        root: input.root,
        runKind: parsed.config.command,
        startedAt,
        runIdHash,
        fs: input.fs,
      });
    }

    const live =
      parsed.config.command === 'live'
        ? input.dependencies.createLiveDependencies(
            parsed.config,
            () => {
              providerAttempts += 1;
            },
            startedAt,
          )
        : undefined;
    const output = await input.dependencies.runPairedEval({
      runId,
      runKind: parsed.config.command,
      clocks: reportClocks,
      calculateDatasetDigest: input.dependencies.calculateDatasetDigest,
      validateDataset: input.dependencies.validateDataset,
      createMockRuntime: input.dependencies.createMockRuntime,
      ...(live ? { live } : {}),
    });

    if (reservation) {
      const cannotPersistLive =
        parsed.config.command === 'live' &&
        (providerAttempts === 0 ||
          (output.kind === 'invalid_run' && output.errorCode === 'live_config_invalid'));
      if (cannotPersistLive) {
        await reservation.release();
        reservation = null;
      } else {
        const committed = await reservation.commit(output);
        if (!committed.ok) {
          return {
            output: buildPhase6943InvalidRun(
              parsed.config.command,
              'unexpected_runner_error',
            ),
            exitCode: 3,
            evidencePath: null,
          };
        }
      }
    }

    return {
      output,
      exitCode: phase6943ExitCode(output),
      evidencePath: reservation?.relativePath ?? null,
    };
  } catch {
    const output = buildPhase6943InvalidRun(
      parsed.config.command,
      'unexpected_runner_error',
    );
    if (reservation && providerAttempts > 0) {
      const committed = await reservation.commit(output);
      return {
        output,
        exitCode: 3,
        evidencePath: committed.ok ? reservation.relativePath : null,
      };
    }
    await reservation?.release();
    return { output, exitCode: 3, evidencePath: null };
  }
}
