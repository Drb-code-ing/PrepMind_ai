import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
  type ModelAgentRequest,
  type ModelAgentRuntime,
  type Phase697V7WireCapability,
} from '@repo/ai';

import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import type { TutorSchemaRecoveryModelCandidateInput } from '../src/model-candidates/tutor-schema-recovery-model-candidate.ts';
import { PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION } from './fixtures/phase-6-9-tutor-schema-recovery-sr2-robustness-v1.ts';

const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: 'sr2-synthetic-key-never-network',
  baseURL: 'https://api.deepseek.com/v1' as const,
  model: 'deepseek-v4-pro' as const,
});
const MAX_REQUEST_BYTES = 32_768;

export type Sr2SyntheticFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export function createSr2TrackedRuntime(input: {
  fetch: Sr2SyntheticFetch;
  capability?: Phase697V7WireCapability;
  timeoutMs?: number;
}) {
  let fetchCalls = 0;
  const requestBodies: string[] = [];
  const runtimeRequests: ModelAgentRequest<unknown>[] = [];
  const stages: string[] = [];
  const diagnostics = input.capability
    ? null
    : createPhase697V7WireDiagnostics({
        appendStage(stage) {
          stages.push(stage);
        },
      });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    CONFIG,
    input.capability ?? diagnostics!.capability,
    {
      fetch: (async (url, init) => {
        fetchCalls += 1;
        requestBodies.push(String(init?.body ?? ''));
        return input.fetch(url, init);
      }) as typeof fetch,
    },
  );
  const inner = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: input.timeoutMs ?? 500,
    executor: adapter.executor,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = Object.freeze({
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      runtimeRequests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  });
  return Object.freeze({
    runtime,
    runtimeRequests,
    provenance: adapter.provenance,
    fetchCalls: () => fetchCalls,
    requestBodies: () => [...requestBodies],
    stages: () => [...stages],
    wireSnapshot: () => diagnostics?.readSnapshot() ?? null,
  });
}

export function createSr2CandidateInput(
  latestUserText: string,
  activeStudyContext: string,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<
    Pick<TutorSchemaRecoveryModelCandidateInput, 'finalRoute' | 'budget' | 'signal'>
  > = {},
): TutorSchemaRecoveryModelCandidateInput {
  return {
    runId: 'phase-6-9-7-schema-recovery-sr2-zero-provider',
    finalRoute: overrides.finalRoute ?? 'tutor',
    latestUserText,
    activeStudyContext,
    deterministic: buildTutorStrategy({ latestUserText, activeStudyContext }),
    safety: {
      latestUserText: 'safe_for_model',
      activeStudyContext: 'safe_for_model',
    },
    runtime,
    budget:
      overrides.budget ??
      createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 }),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

export function createSr2ProviderResponse(
  content: string,
  options: Readonly<{
    status?: number;
    includeUsage?: boolean;
    reasoningContent?: string;
    inputTokens?: number;
    outputTokens?: number;
  }> = {},
) {
  const message = {
    content,
    ...(options.reasoningContent === undefined
      ? {}
      : { reasoning_content: options.reasoningContent }),
  };
  return new Response(
    JSON.stringify({
      choices: [{ message }],
      ...(options.includeUsage === false
        ? {}
        : {
            usage: {
              prompt_tokens: options.inputTokens ?? 64,
              completion_tokens: options.outputTokens ?? 16,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
    }),
    {
      status: options.status ?? 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

export function createSr2PromptDerivedProviderResponse(init?: RequestInit) {
  const derived = deriveSr2PromptResponse(String(init?.body ?? ''));
  return {
    ...derived,
    response: createSr2ProviderResponse(derived.content),
  };
}

export function deriveSr2PromptResponse(requestBody: string) {
  if (Buffer.byteLength(requestBody, 'utf8') > MAX_REQUEST_BYTES) {
    throw new Error('SR2_SYNTHETIC_REQUEST_OUT_OF_BOUNDS');
  }
  const parsed = JSON.parse(requestBody) as unknown;
  if (!isPlainRecord(parsed)) throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  const messages = parsed.messages;
  if (!Array.isArray(messages) || messages.length !== 2) {
    throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  }
  const system = readMessage(messages[0], 'system');
  const user = readMessage(messages[1], 'user');
  if (
    !isPlainRecord(parsed.response_format) ||
    parsed.response_format.type !== 'json_object' ||
    parsed.stream !== false ||
    !Number.isSafeInteger(parsed.max_tokens) ||
    typeof parsed.model !== 'string'
  ) {
    throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  }
  const prompt = JSON.parse(user) as unknown;
  if (!isPlainRecord(prompt) || !Array.isArray(prompt.eligibleIntents)) {
    throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  }
  const eligibleIntentIndexes = prompt.eligibleIntents.map((entry) => {
    if (
      !isPlainRecord(entry) ||
      !Number.isSafeInteger(entry.intentIndex) ||
      (entry.intentIndex as number) < 0 ||
      (entry.intentIndex as number) > 4
    ) {
      throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
    }
    return entry.intentIndex as number;
  });
  if (
    eligibleIntentIndexes.length === 0 ||
    eligibleIntentIndexes.length > 5 ||
    new Set(eligibleIntentIndexes).size !== eligibleIntentIndexes.length
  ) {
    throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  }
  const fingerprintSource = {
    responderVersion: PHASE_6_9_7_TUTOR_SCHEMA_RECOVERY_SR2_RESPONDER_VERSION,
    system,
    user,
  };
  const digest = createHash('sha256')
    .update(JSON.stringify(fingerprintSource), 'utf8')
    .digest('hex');
  const intentIndex =
    eligibleIntentIndexes[
      Number(BigInt(`0x${digest.slice(0, 8)}`) % BigInt(eligibleIntentIndexes.length))
    ]!;
  return Object.freeze({
    content: JSON.stringify({ intentIndex }),
    intentIndex,
    promptFingerprint: `sha256:${digest}`,
  });
}

function readMessage(value: unknown, role: 'system' | 'user') {
  if (!isPlainRecord(value) || value.role !== role || typeof value.content !== 'string') {
    throw new Error('SR2_SYNTHETIC_REQUEST_INVALID');
  }
  return value.content;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
