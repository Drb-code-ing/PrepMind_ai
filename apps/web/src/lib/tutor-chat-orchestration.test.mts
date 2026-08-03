import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import type { ChatModelAgentRuntimeBundle } from './chat-model-agent-runtime.ts';
import type { TutorModelRuntimeBundle } from './tutor-model-runtime.ts';

register(
  `data:text/javascript,${encodeURIComponent(`
    export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'server-only') {
        return { url: 'data:text/javascript,export default undefined', shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `)}`,
  import.meta.url,
);

const { buildChatAgentExecution } = await import('./chat-agent-runtime.ts');
const { orchestrateChatModelAgents } = await import('./chat-model-agent-orchestration.ts');
const { createTutorModelBudget } = await import('./tutor-model-config.ts');

const MODEL_ELIGIBLE_TUTOR_TEXT = '我写了一步但不确定哪里错了，帮我检查一下。';
const ACTIVE_CONTEXT = {
  type: 'ocr-question' as const,
  questionText: '合成代数题：已知 3x+2=11，继续判断移项步骤。',
};

test('applies one governed Tutor candidate after the final Tutor route', async () => {
  let tutorInvokes = 0;
  let seenSignal: AbortSignal | undefined;
  const controller = new AbortController();
  const tutorRuntime = trackedTutorRuntime(
    () => {
      tutorInvokes += 1;
    },
    (request) => {
      seenSignal = request.signal;
    },
  );
  const routerBudget = routerVerifierBudget();
  const tutorBudget = createTutorModelBudget();

  const execution = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_candidate_applied',
    userId: 'user_tutor_candidate_applied',
    signal: controller.signal,
    model: {
      enabled: false,
      runtime: hostileRuntime(),
      budget: routerBudget,
    },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: tutorRuntime,
      budget: tutorBudget,
    },
  });

  assert.equal(execution.decision.route, 'tutor');
  assert.equal(tutorInvokes, 1);
  assert.equal(seenSignal, controller.signal);
  assert.equal(execution.tutorObservation.attempted, true);
  assert.equal(execution.tutorObservation.disposition, 'candidate_applied');
  assert.equal(execution.decision.tutorStrategy?.intent, 'step_check');
  assert.equal(execution.decision.tutorStrategy?.depth, 'standard');
  assert.equal(execution.decision.debugHeaders['x-prepmind-tutor-intent'], 'step_check');
  assert.equal(execution.tutorBudget.maxCalls, 1);
  assert.equal(execution.tutorBudget.usedCalls, 1);
  assert.equal(execution.budget.maxCalls, 2);
  assert.equal(execution.budget.usedCalls, 0);
  assert.deepEqual(execution.budget, routerBudget);
});

test('non-Tutor final routes and explicit Tutor instructions are provider-zero-call', async () => {
  let tutorInvokes = 0;
  const runtime: ModelAgentRuntime = {
    async invokeStructured() {
      tutorInvokes += 1;
      throw new Error('must_not_invoke_tutor');
    },
  };

  const nonTutor = await buildChatAgentExecution({
    messages: [{ role: 'user', content: '结合我的笔记讲一下这道题。' }],
    activeContext: null,
    runId: 'run_tutor_non_route',
    userId: 'user_tutor_non_route',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime,
      budget: createTutorModelBudget(),
    },
  });
  assert.equal(nonTutor.decision.route, 'rag_answer');
  assert.equal(nonTutor.tutorObservation.attempted, false);
  assert.equal(nonTutor.tutorObservation.disposition, 'not_eligible');

  const explicit = await buildChatAgentExecution({
    messages: [{ role: 'user', content: '帮我检查这一步对吗？' }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_explicit',
    userId: 'user_tutor_explicit',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime,
      budget: createTutorModelBudget(),
    },
  });
  assert.equal(explicit.decision.route, 'tutor');
  assert.equal(explicit.decision.tutorStrategy?.intent, 'step_check');
  assert.equal(explicit.tutorObservation.attempted, false);
  assert.equal(explicit.tutorObservation.disposition, 'not_eligible');
  assert.equal(tutorInvokes, 0);
});

test('Tutor runtime failure preserves the canonical Tutor route and local strategy', async () => {
  const execution = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_runtime_fallback',
    userId: 'user_tutor_runtime_fallback',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: {
        async invokeStructured() {
          throw new Error('raw_tutor_runtime_failure_prompt_key_url');
        },
      },
      budget: createTutorModelBudget(),
    },
  });

  assert.equal(execution.decision.route, 'tutor');
  assert.equal(execution.decision.tutorStrategy?.intent, 'step_check');
  assert.equal(execution.tutorObservation.disposition, 'fallback_runtime_error');
  assert.equal(JSON.stringify(execution).includes('raw_tutor_runtime_failure'), false);
});

test('Tutor Web composition discards bounded response extensions through Schema Recovery', async () => {
  const rawSentinel = 'sr6_raw_extension_must_not_escape';
  const execution = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_schema_recovery_extension',
    userId: 'user_tutor_schema_recovery_extension',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: syntheticTutorContentRuntime(
        JSON.stringify({ intentIndex: 0, explanation: rawSentinel }),
      ),
      budget: createTutorModelBudget(),
    },
  });

  assert.equal(execution.tutorObservation.disposition, 'candidate_applied');
  assert.equal(execution.decision.tutorStrategy?.intent, 'step_check');
  assert.equal(JSON.stringify(execution).includes(rawSentinel), false);
  assert.equal(JSON.stringify(execution).includes('explanation'), false);
});

test('Tutor Web composition fails closed on an invalid Schema Recovery ordinal', async () => {
  const execution = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_schema_recovery_invalid',
    userId: 'user_tutor_schema_recovery_invalid',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: syntheticTutorContentRuntime('{"intentIndex":"0"}'),
      budget: createTutorModelBudget(),
    },
  });

  assert.equal(execution.tutorObservation.attempted, true);
  assert.equal(execution.tutorObservation.disposition, 'fallback_runtime_error');
  assert.equal(execution.decision.degraded, true);
  assert.equal(execution.decision.tutorStrategy?.intent, 'step_check');
});

test('aborted requests stay zero-call and unverifiable usage cannot influence Tutor strategy', async () => {
  let abortedInvokes = 0;
  const controller = new AbortController();
  controller.abort();
  const aborted = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_aborted',
    userId: 'user_tutor_aborted',
    signal: controller.signal,
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: trackedTutorRuntime(() => {
        abortedInvokes += 1;
      }),
      budget: createTutorModelBudget(),
    },
  });
  assert.equal(abortedInvokes, 0);
  assert.equal(aborted.tutorObservation.disposition, 'fallback_aborted');
  assert.equal(aborted.decision.route, 'tutor');

  const zeroOutputRuntime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 3_000,
    executor: async () => ({
      object: {
        intentIndex: 0,
      },
      usage: { inputTokens: 200, outputTokens: 0 },
    }),
  });
  const unpriced = await buildChatAgentExecution({
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_unpriced_usage',
    userId: 'user_tutor_unpriced_usage',
    model: { enabled: false, runtime: hostileRuntime(), budget: routerVerifierBudget() },
    tutorModel: {
      enabled: true,
      authority: 'production_live',
      runtime: zeroOutputRuntime,
      budget: createTutorModelBudget(),
    },
  });
  assert.equal(unpriced.decision.route, 'tutor');
  assert.equal(unpriced.decision.tutorStrategy?.intent, 'step_check');
  assert.equal(unpriced.tutorObservation.disposition, 'fallback_runtime_error');
  assert.equal(unpriced.decision.degraded, true);
});

test('orchestration keeps Tutor budget separate from the Router to Verifier budget', async () => {
  let routerBudgetCalls = 0;
  let tutorBudgetCalls = 0;
  let tutorBundleCalls = 0;
  const routerBundle = makeRouterBundle(() => {
    routerBudgetCalls += 1;
    return routerVerifierBudget();
  });
  const tutorBundle = makeTutorBundle(() => {
    tutorBudgetCalls += 1;
    return createTutorModelBudget();
  });

  const result = await orchestrateChatModelAgents({
    bundle: routerBundle,
    createTutorBundle: () => {
      tutorBundleCalls += 1;
      return tutorBundle;
    },
    messages: [{ role: 'user', content: MODEL_ELIGIBLE_TUTOR_TEXT }],
    activeContext: ACTIVE_CONTEXT,
    runId: 'run_tutor_orchestration_budget',
    userId: 'user_tutor_orchestration_budget',
    signal: new AbortController().signal,
  });

  assert.equal(routerBudgetCalls, 1);
  assert.equal(tutorBundleCalls, 1);
  assert.equal(tutorBudgetCalls, 1);
  assert.equal(result.agentExecution.tutorObservation.disposition, 'candidate_applied');
  assert.equal(result.agentExecution.tutorBudget.usedCalls, 1);
  assert.equal(result.agentExecution.budget.usedCalls, 0);
  assert.equal(result.verifierModel.budget, result.agentExecution.budget);
  assert.notEqual(result.verifierModel.budget, result.agentExecution.tutorBudget);
});

test('orchestration never creates a Tutor bundle for a non-Tutor final route', async () => {
  let tutorBundleCalls = 0;
  const result = await orchestrateChatModelAgents({
    bundle: makeRouterBundle(routerVerifierBudget),
    createTutorBundle: () => {
      tutorBundleCalls += 1;
      return makeTutorBundle(createTutorModelBudget);
    },
    messages: [{ role: 'user', content: '结合我的笔记讲一下这道题。' }],
    activeContext: null,
    runId: 'run_non_tutor_factory_zero_call',
    userId: 'user_non_tutor_factory_zero_call',
    signal: new AbortController().signal,
  });

  assert.equal(result.agentExecution.decision.route, 'rag_answer');
  assert.equal(tutorBundleCalls, 0);
  assert.equal(result.agentExecution.tutorObservation.attempted, false);
  assert.equal(result.agentExecution.tutorObservation.disposition, 'not_eligible');
});

function trackedTutorRuntime(
  onInvoke: () => void,
  inspect: (request: ModelAgentRequest<unknown>) => void = () => undefined,
): ModelAgentRuntime {
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 3_000,
    executor: async () => ({
      object: {
        intentIndex: 0,
      },
      usage: { inputTokens: 240, outputTokens: 24 },
    }),
  });
  return {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      onInvoke();
      inspect(request as ModelAgentRequest<unknown>);
      return runtime.invokeStructured(request);
    },
  };
}

function routerVerifierBudget() {
  return createModelAgentBudget({
    maxCalls: 2,
    maxInputTokens: 2_400,
    maxOutputTokens: 800,
  });
}

function hostileRuntime(): ModelAgentRuntime {
  return Object.create(null, {
    invokeStructured: {
      get() {
        throw new Error('disabled_runtime_must_not_be_read');
      },
    },
  }) as ModelAgentRuntime;
}

function makeRouterBundle(
  createBudget: () => ReturnType<typeof routerVerifierBudget>,
): ChatModelAgentRuntimeBundle {
  const runtime = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'disabled-router-verifier',
    liveCallsEnabled: false,
    timeoutMs: 100,
  });
  return {
    routerRuntime: runtime,
    verifierRuntime: runtime,
    routerEnabled: false,
    verifierEnabled: false,
    createBudget,
    config: {
      mode: 'mock',
      liveCallsEnabled: false,
      routerEnabled: false,
      verifierEnabled: false,
      routerTimeoutMs: 5_000,
      verifierTimeoutMs: 4_000,
      provider: 'mock',
      model: 'mock-agent-candidate',
      credentialSource: 'none',
      configured: true,
      disabledReason: 'agent_gates_disabled',
    },
  };
}

function makeTutorBundle(
  createBudget: () => ReturnType<typeof createTutorModelBudget>,
): TutorModelRuntimeBundle {
  return {
    enabled: true,
    runtime: trackedTutorRuntime(() => undefined),
    createBudget,
    config: {
      enabled: true,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      promptVersion: 'tutor-model-candidate-v6',
      runtimeAuthority: 'production_live',
      timeoutMs: 3_000,
      pricingKnown: true,
      configured: true,
    },
  };
}

function syntheticTutorContentRuntime(content: string): ModelAgentRuntime {
  const diagnostics = createPhase697V7WireDiagnostics({
    appendStage() {
      return undefined;
    },
  });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'sr6-synthetic-key-never-network',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    diagnostics.capability,
    {
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content } }],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 12,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    },
  );
  return createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 500,
    executor: adapter.executor,
  });
}
