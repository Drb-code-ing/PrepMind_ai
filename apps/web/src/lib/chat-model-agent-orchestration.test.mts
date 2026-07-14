import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import test from 'node:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRuntime,
} from '@repo/ai';

import type { ChatModelAgentRuntimeBundle } from './chat-model-agent-runtime.ts';

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

const { orchestrateChatModelAgents } = await import(
  './chat-model-agent-orchestration.ts'
);

const ELIGIBLE_ROUTER_TEXT =
  '\u7ed3\u5408\u6211\u7684\u7b14\u8bb0\u8bb2\u4e00\u4e0b\u8fd9\u9053\u9898\u3002';
const CANARY = 'CANARY_RAW_ROUTER_FAILURE_prompt_key_url';

test('orchestration helper is explicitly server-only', async () => {
  const source = await readFile(
    new URL('./chat-model-agent-orchestration.ts', import.meta.url),
    'utf8',
  );
  assert.equal(source.split(/\r?\n/u)[0], "import 'server-only';");
});

test('continues the exact Router budget and signal into the verifier model context', async () => {
  const controller = new AbortController();
  const initialBudget = createModelAgentBudget({
    maxCalls: 2,
    maxInputTokens: 2_400,
    maxOutputTokens: 800,
  });
  let createBudgetCalls = 0;
  let routerInvokes = 0;
  let seenRouterSignal: AbortSignal | undefined;
  const realRuntime = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'chat-orchestration-test',
    liveCallsEnabled: false,
    timeoutMs: 100,
    mockResponder: () => ({
      route: 'tutor',
      confidence: 0.93,
      reasonCode: 'ambiguous_intent_resolved',
    }),
  });
  const routerRuntime: ModelAgentRuntime = {
    invokeStructured(request) {
      routerInvokes += 1;
      seenRouterSignal = request.signal;
      return realRuntime.invokeStructured(request);
    },
  };
  const verifierRuntime = throwingRuntime('verifier must not run during orchestration');
  const bundle = makeBundle({
    routerEnabled: true,
    verifierEnabled: true,
    routerRuntime,
    verifierRuntime,
    createBudget() {
      createBudgetCalls += 1;
      return initialBudget;
    },
  });

  const result = await orchestrateChatModelAgents({
    bundle,
    messages: [{ role: 'user', content: ELIGIBLE_ROUTER_TEXT }],
    activeContext: null,
    runId: 'run_orchestration_shared',
    userId: 'user_shared',
    signal: controller.signal,
  });

  assert.equal(createBudgetCalls, 1);
  assert.equal(routerInvokes, 1);
  assert.equal(seenRouterSignal, controller.signal);
  assert.equal(result.verifierModel.signal, controller.signal);
  assert.equal(result.verifierModel.runId, 'run_orchestration_shared');
  assert.equal(result.verifierModel.enabled, true);
  assert.equal(result.verifierModel.runtime, verifierRuntime);
  assert.equal(result.verifierModel.budget, result.agentExecution.budget);
  assert.notEqual(result.agentExecution.budget, initialBudget);
  assert.deepEqual(result.verifierModel.budget, result.agentExecution.budget);
  assert.equal(result.verifierModel.budget.usedCalls, 1);
  assert.equal(result.agentExecution.routerObservation.disposition, 'candidate_applied');
});

test('disabled gates never touch hostile runtimes and preserve one continuous budget', async () => {
  let createBudgetCalls = 0;
  let routerRuntimeReads = 0;
  let verifierRuntimeReads = 0;
  const routerRuntime = hostileRuntime(() => {
    routerRuntimeReads += 1;
  });
  const verifierRuntime = hostileRuntime(() => {
    verifierRuntimeReads += 1;
  });
  const initialBudget = createModelAgentBudget({
    maxCalls: 2,
    maxInputTokens: 2_400,
    maxOutputTokens: 800,
  });
  const bundle = makeBundle({
    routerEnabled: false,
    verifierEnabled: false,
    routerRuntime,
    verifierRuntime,
    createBudget() {
      createBudgetCalls += 1;
      return initialBudget;
    },
  });

  const result = await orchestrateChatModelAgents({
    bundle,
    messages: [{ role: 'user', content: ELIGIBLE_ROUTER_TEXT }],
    activeContext: null,
    runId: 'run_orchestration_disabled',
    userId: 'user_disabled',
    signal: new AbortController().signal,
  });

  assert.equal(createBudgetCalls, 1);
  assert.equal(routerRuntimeReads, 0);
  assert.equal(verifierRuntimeReads, 0);
  assert.equal(result.agentExecution.decision.route, 'rag_answer');
  assert.equal(result.agentExecution.routerObservation.attempted, false);
  assert.equal(result.verifierModel.enabled, false);
  assert.equal(result.verifierModel.runtime, verifierRuntime);
  assert.equal(result.verifierModel.budget, result.agentExecution.budget);
  assert.deepEqual(result.verifierModel.budget, initialBudget);
  assert.equal(result.verifierModel.budget.usedCalls, 0);
});

test('returns a safe verifier context when the eligible Router runtime fails', async () => {
  let routerInvokes = 0;
  const bundle = makeBundle({
    routerEnabled: true,
    verifierEnabled: true,
    routerRuntime: {
      async invokeStructured() {
        routerInvokes += 1;
        throw new Error(CANARY);
      },
    },
    verifierRuntime: throwingRuntime('verifier is deferred'),
    createBudget: () =>
      createModelAgentBudget({
        maxCalls: 2,
        maxInputTokens: 2_400,
        maxOutputTokens: 800,
      }),
  });

  const result = await orchestrateChatModelAgents({
    bundle,
    messages: [{ role: 'user', content: ELIGIBLE_ROUTER_TEXT }],
    activeContext: null,
    runId: 'run_orchestration_fallback',
    userId: 'user_fallback',
    signal: new AbortController().signal,
  });

  assert.equal(routerInvokes, 1);
  assert.equal(result.agentExecution.decision.route, 'rag_answer');
  assert.notEqual(
    result.agentExecution.routerObservation.disposition,
    'candidate_applied',
  );
  assert.equal(result.verifierModel.budget, result.agentExecution.budget);
  assert.equal(JSON.stringify(result).includes(CANARY), false);
});

function makeBundle(
  overrides: Pick<
    ChatModelAgentRuntimeBundle,
    | 'routerEnabled'
    | 'verifierEnabled'
    | 'routerRuntime'
    | 'verifierRuntime'
    | 'createBudget'
  >,
): ChatModelAgentRuntimeBundle {
  return {
    ...overrides,
    config: {
      mode: 'mock',
      liveCallsEnabled: false,
      routerEnabled: overrides.routerEnabled,
      verifierEnabled: overrides.verifierEnabled,
      routerTimeoutMs: 5_000,
      verifierTimeoutMs: 4_000,
      provider: 'mock',
      model: 'mock-agent-candidate',
      credentialSource: 'none',
      configured: true,
    },
  };
}

function throwingRuntime(message: string): ModelAgentRuntime {
  return {
    async invokeStructured() {
      throw new Error(message);
    },
  };
}

function hostileRuntime(onRead: () => void): ModelAgentRuntime {
  return Object.create(null, {
    invokeStructured: {
      get() {
        onRead();
        throw new Error(CANARY);
      },
    },
  }) as ModelAgentRuntime;
}
