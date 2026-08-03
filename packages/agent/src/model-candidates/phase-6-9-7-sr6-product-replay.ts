import { z } from 'zod';

import {
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentResult,
  type ModelAgentRuntime,
  type ModelAgentTask,
  type ModelAgentTrace,
} from '@repo/ai';

import { WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA } from './wrong-question-organizer-v9-model-projection.ts';

export const PHASE_6_9_7_SR6_PRODUCT_REPLAY_VERSION = 'phase-6.9.7-sr6-product-replay-v1' as const;
export const PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256 =
  '87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be' as const;
export const PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL =
  'phase-6.9.7-sr6-sealed-replay-87dd826bf80fa2da4884ee8574beb6f8e252584c5edc8d1cc087e7d2b66f18be' as const;

export const PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENTS = ['tutor', 'organizer', 'both'] as const;
export const PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIORS = ['success', 'forced_failure'] as const;

const ZERO_PROVIDER_MODEL_GATE_KEYS = Object.freeze([
  'AI_ENABLE_LIVE_CALLS',
  'ROUTER_MODEL_ENABLED',
  'KNOWLEDGE_VERIFIER_MODEL_ENABLED',
  'TUTOR_AGENT_MODEL_ENABLED',
  'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED',
  'REVIEW_AGENT_MODEL_ENABLED',
  'PLANNER_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED',
  'REVIEW_PLANNER_PRODUCT_ACCEPTANCE_ENABLED',
] as const);

const ZERO_PROVIDER_CREDENTIAL_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY',
  'TUTOR_AGENT_DEEPSEEK_API_KEY',
  'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY',
  'KNOWLEDGE_AGENT_DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'Qwen_API_KEY',
  'QWEN_API_KEY',
  'DASHSCOPE_API_KEY',
] as const);

export type Phase697Sr6ProductReplayTarget = 'tutor' | 'organizer';
export type Phase697Sr6ProductReplayComponent =
  (typeof PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENTS)[number];
export type Phase697Sr6ProductReplayBehavior =
  (typeof PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIORS)[number];

export type Phase697Sr6ProductReplayConfig =
  | Readonly<{ enabled: false }>
  | Readonly<{
      enabled: true;
      component: Phase697Sr6ProductReplayComponent;
      behavior: Phase697Sr6ProductReplayBehavior;
      maxRequests: 1;
      totalMaxRequests: 1 | 2;
      authoritySha256: typeof PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256;
    }>;

const TUTOR_PROMPT_SCHEMA = z
  .object({
    version: z.literal('tutor-model-projection-v6'),
    latestText: z.string().max(4_096),
    activeContext: z
      .object({
        available: z.boolean(),
        excerpt: z.string().max(4_096).optional(),
      })
      .strict(),
    authorityBinding: z
      .object({
        localSignalAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
        localStrategyAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    eligibleIntents: z
      .array(
        z
          .object({
            intentIndex: z.number().int().safe().min(0).max(4),
            intent: z.enum([
              'explain_solution',
              'socratic_hint',
              'step_check',
              'concept_bridge',
              'general_follow_up',
            ]),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

export function resolvePhase697Sr6ProductReplayConfig(
  env: Record<string, unknown>,
  target: Phase697Sr6ProductReplayTarget,
): Phase697Sr6ProductReplayConfig {
  try {
    if (!readBoolean(env, 'PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENABLED')) {
      return Object.freeze({ enabled: false });
    }
    const component = readString(env, 'PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENT');
    const behavior = readString(env, 'PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIOR');
    const authoritySha256 = readString(env, 'PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256');
    const maxRequests = readInteger(env, 'PHASE_6_9_7_SR6_PRODUCT_REPLAY_MAX_REQUESTS');
    const selectedComponent = PHASE_6_9_7_SR6_PRODUCT_REPLAY_COMPONENTS.find(
      (candidate) => candidate === component,
    );
    const selectedBehavior = PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIORS.find(
      (candidate) => candidate === behavior,
    );
    const targetSelected = component === target || component === 'both';
    const exactRequestCap =
      component === 'both'
        ? maxRequests === 2
        : (component === 'tutor' || component === 'organizer') && maxRequests === 1;
    const zeroProviderBoundary = hasExactZeroProviderBoundary(env);

    if (
      !targetSelected ||
      selectedComponent === undefined ||
      selectedBehavior === undefined ||
      authoritySha256 !== PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256 ||
      !exactRequestCap ||
      !zeroProviderBoundary
    ) {
      return Object.freeze({ enabled: false });
    }

    return Object.freeze({
      enabled: true,
      component: selectedComponent,
      behavior: selectedBehavior,
      maxRequests: 1,
      totalMaxRequests: selectedComponent === 'both' ? 2 : 1,
      authoritySha256: PHASE_6_9_7_SR6_PRODUCT_REPLAY_AUTHORITY_SHA256,
    });
  } catch {
    return Object.freeze({ enabled: false });
  }
}

export function createPhase697Sr6ProductReplayRuntime(
  input: Readonly<{
    component: Phase697Sr6ProductReplayTarget;
    behavior: Phase697Sr6ProductReplayBehavior;
    maxRequests: 1;
  }>,
): ModelAgentRuntime {
  validateRuntimeInput(input);
  let requests = 0;

  return Object.freeze({
    async invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>> {
      if (requests >= input.maxRequests) {
        throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_REQUEST_LIMIT');
      }
      requests += 1;
      assertExpectedTask(input.component, request.task, request.maxOutputTokens);

      const output =
        input.behavior === 'success'
          ? buildReplayOutput(input.component, request.userPrompt)
          : undefined;
      const runtime = createModelAgentRuntime({
        mode: 'mock',
        provider: 'mock',
        model: PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL,
        liveCallsEnabled: false,
        timeoutMs: 1_000,
        mockResponder:
          input.behavior === 'success'
            ? () => output
            : () => {
                throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_FORCED_FAILURE');
              },
      });
      const result = await runtime.invokeStructured(request);
      if (!result.ok) return result;

      const outputTokens = boundedReplayOutputTokens(output, request.maxOutputTokens);
      const usage = Object.freeze({
        inputTokens: result.usage.inputTokens,
        outputTokens,
      });
      const replayTrace = Object.freeze({
        ...result.trace,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });
      return Object.freeze({
        ...result,
        budget: Object.freeze({ ...result.budget }),
        usage,
        trace: replayTrace,
      });
    },
  });
}

export function isPhase697Sr6ProductReplayTrace(
  value: unknown,
  task?: Extract<ModelAgentTask, 'tutor_strategy' | 'wrong_question_organization'>,
): value is ModelAgentTrace {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const trace = value as Record<string, unknown>;
    const traceTask = readOwnData(trace, 'task');
    const expectedMaxOutputTokens =
      traceTask === 'tutor_strategy'
        ? 300
        : traceTask === 'wrong_question_organization'
          ? 800
          : null;
    return (
      expectedMaxOutputTokens !== null &&
      readOwnData(trace, 'mode') === 'mock' &&
      readOwnData(trace, 'provider') === 'mock' &&
      readOwnData(trace, 'model') === PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL &&
      readOwnData(trace, 'status') === 'succeeded' &&
      readOwnData(trace, 'degraded') === false &&
      readOwnData(trace, 'maxOutputTokens') === expectedMaxOutputTokens &&
      isPositiveSafeInteger(readOwnData(trace, 'inputTokens')) &&
      isPositiveSafeInteger(readOwnData(trace, 'outputTokens')) &&
      isNonNegativeSafeInteger(readOwnData(trace, 'durationMs')) &&
      isRunIdHash(readOwnData(trace, 'runIdHash')) &&
      readOwnData(trace, 'errorCode') === undefined &&
      readOwnData(trace, 'providerFailureCategory') === undefined &&
      readOwnData(trace, 'structuredOutputStage') === undefined &&
      (task === undefined || traceTask === task)
    );
  } catch {
    return false;
  }
}

function buildReplayOutput(component: Phase697Sr6ProductReplayTarget, userPrompt: string): unknown {
  if (userPrompt.length > 65_536) {
    throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_PROMPT_INVALID');
  }
  const parsed: unknown = JSON.parse(userPrompt);
  if (component === 'tutor') {
    const prompt = TUTOR_PROMPT_SCHEMA.parse(parsed);
    return Object.freeze({ intentIndex: prompt.eligibleIntents[0].intentIndex });
  }

  const projection = WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA.parse(parsed);
  return Object.freeze({
    decisions: Object.freeze(
      projection.questions.map((question) =>
        Object.freeze({
          questionIndex: question.questionIndex,
          optionIndex: question.options[0].optionIndex,
        }),
      ),
    ),
  });
}

function validateRuntimeInput(
  input: Readonly<{
    component: Phase697Sr6ProductReplayTarget;
    behavior: Phase697Sr6ProductReplayBehavior;
    maxRequests: 1;
  }>,
) {
  if (
    (input.component !== 'tutor' && input.component !== 'organizer') ||
    !PHASE_6_9_7_SR6_PRODUCT_REPLAY_BEHAVIORS.includes(input.behavior) ||
    input.maxRequests !== 1
  ) {
    throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_CONFIG_INVALID');
  }
}

function assertExpectedTask(
  component: Phase697Sr6ProductReplayTarget,
  task: ModelAgentTask,
  maxOutputTokens: number,
) {
  const valid =
    component === 'tutor'
      ? task === 'tutor_strategy' && maxOutputTokens === 300
      : task === 'wrong_question_organization' && maxOutputTokens === 800;
  if (!valid) throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_REQUEST_INVALID');
}

function boundedReplayOutputTokens(output: unknown, maxOutputTokens: number) {
  const estimate = Math.max(1, Math.ceil(JSON.stringify(output).length / 4));
  return Math.min(estimate, maxOutputTokens);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isRunIdHash(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function readBoolean(env: Record<string, unknown>, key: string) {
  const value = readOwnData(env, key);
  return value === true || value === 'true';
}

function hasExactZeroProviderBoundary(env: Record<string, unknown>) {
  return (
    readString(env, 'AI_PROVIDER_MODE') === 'mock' &&
    ZERO_PROVIDER_MODEL_GATE_KEYS.every((key) => isDisabledOrAbsent(env, key)) &&
    ZERO_PROVIDER_CREDENTIAL_KEYS.every((key) => isEmptyOrAbsent(env, key)) &&
    isExactOrAbsent(env, 'RAG_EMBEDDING_PROVIDER', 'fake') &&
    isExactOrAbsent(env, 'SERVER_ROLE', 'api')
  );
}

function isDisabledOrAbsent(env: Record<string, unknown>, key: string) {
  const value = readOwnData(env, key);
  return value === undefined || value === false || value === 'false';
}

function isEmptyOrAbsent(env: Record<string, unknown>, key: string) {
  const value = readOwnData(env, key);
  return value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

function isExactOrAbsent(env: Record<string, unknown>, key: string, expected: string) {
  const value = readOwnData(env, key);
  return value === undefined || value === expected;
}

function readString(env: Record<string, unknown>, key: string) {
  const value = readOwnData(env, key);
  return typeof value === 'string' ? value.trim() : '';
}

function readInteger(env: Record<string, unknown>, key: string) {
  const value = readOwnData(env, key);
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isSafeInteger(numeric) ? numeric : 0;
}

function readOwnData(env: Record<string, unknown>, key: string): unknown {
  if (typeof env !== 'object' || env === null) {
    throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENV_INVALID');
  }
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (descriptor === undefined) return undefined;
  if (!('value' in descriptor)) {
    throw new Error('PHASE_6_9_7_SR6_PRODUCT_REPLAY_ENV_INVALID');
  }
  return descriptor.value;
}
