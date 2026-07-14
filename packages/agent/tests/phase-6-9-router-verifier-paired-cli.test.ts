import { describe, expect, test } from 'bun:test';
import * as realFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import {
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  hashModelAgentRunId,
  type ModelAgentRequest,
} from '@repo/ai';

import {
  buildPhase6943InvalidRun,
  calculatePhase6943DatasetDigest,
  validatePhase6943Dataset,
  type Phase6943Output,
} from '../src/evals/phase-6-9-router-verifier-paired-contract.ts';
import {
  createPhase6943MockRuntime,
  phase6943MockCandidateForCase,
} from '../src/evals/phase-6-9-router-verifier-mock-fixtures.ts';
import {
  phase6941RouterCases,
  phase6941VerifierCases,
} from '../src/evals/phase-6-9-router-verifier-cases.ts';
import {
  runPhase6943PairedEval,
  type Phase6943Clocks,
  type Phase6943LiveDependencies,
} from '../src/evals/run-phase-6-9-router-verifier-paired.ts';
import {
  buildPhase6943LiveEvidencePath,
  createPhase6943LiveDependencies,
  executePhase6943Cli,
  PHASE_6943_LIVE_SCHEMA_PROFILES,
  parsePhase6943Cli,
  reservePhase6943Evidence,
  validatePhase6943LiveStructuredSchemas,
  withPhase6943UsageProvenance,
  type Phase6943CompositionDependencies,
} from '../scripts/phase-6-9-4-3-paired-cli.ts';
import {
  parseEvidenceValidatorArgs,
  validatePhase6943Evidence,
} from '../scripts/validate-phase-6-9-4-3-evidence.ts';
import { KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/knowledge-verifier-model-candidate.ts';
import { ROUTER_MODEL_CANDIDATE_SCHEMA } from '../src/model-candidates/router-model-candidate.ts';

const LIVE_ENV = {
  AI_PROVIDER_MODE: 'live',
  AI_ENABLE_LIVE_CALLS: 'true',
  AI_MODEL: 'deepseek-v4-flash',
  AI_BASE_URL: 'https://api.deepseek.com/beta',
  DEEPSEEK_API_KEY: 'test-only-key',
} as const;
const LIVE_ARGS = [
  '--live',
  '--input-price-usd-per-million', '0.1',
  '--output-price-usd-per-million', '0.2',
  '--max-cost-usd', '0.1',
] as const;

describe('Phase 6.9.4.3 CLI', () => {
  test('keeps Mock flag-free and independent of provider env', () => {
    expect(parsePhase6943Cli({ command: 'mock', argv: [], env: LIVE_ENV })).toEqual({
      ok: true,
      config: { command: 'mock', persist: false },
    });
    expect(parsePhase6943Cli({ command: 'mock-evidence', argv: [], env: {} })).toEqual({
      ok: true,
      config: { command: 'mock', persist: true },
    });
    expect(parsePhase6943Cli({ command: 'mock', argv: ['--live'], env: {} }).ok).toBe(false);
  });

  test('accepts only the exact controlled-Live grammar', () => {
    const parsed = parsePhase6943Cli({ command: 'live', argv: LIVE_ARGS, env: LIVE_ENV });
    expect(parsed.ok).toBe(true);
    const invalidArgv: readonly (readonly string[])[] = [
      [],
      ['--unknown'],
      ['--live', '--live', ...LIVE_ARGS.slice(1)],
      ['--live', '--input-price-usd-per-million'],
      ['--live', '--input-price-usd-per-million=0.1', ...LIVE_ARGS.slice(3)],
      ['position', ...LIVE_ARGS],
      LIVE_ARGS.map((value) => value === '0.1' ? '1e-1' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? '+0.1' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? '00.1' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? '0,1' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? ' 0.1' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? '0' : value),
      LIVE_ARGS.map((value) => value === '0.1' ? '1000000.1' : value),
    ];
    for (const argv of invalidArgv) {
      const result = parsePhase6943Cli({ command: 'live', argv, env: LIVE_ENV });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.exitCode).toBe(3);
    }
  });

  test('prices the full 11,200 output-token cap before any provider call', () => {
    const result = parsePhase6943Cli({
      command: 'live',
      argv: [
        '--live',
        '--input-price-usd-per-million', '0.1',
        '--output-price-usd-per-million', '10',
        '--max-cost-usd', '0.1',
      ],
      env: LIVE_ENV,
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: 3,
      output: {
        kind: 'invalid_run',
        runKind: 'live',
        errorCode: 'live_config_invalid',
      },
    });
  });

  test('rejects every malformed Live env or URL without exposing values', () => {
    const mutations: ((env: Record<string, string | undefined>) => void)[] = [
      (env) => { delete env.AI_PROVIDER_MODE; },
      (env) => { env.AI_PROVIDER_MODE = 'mock'; },
      (env) => { env.AI_ENABLE_LIVE_CALLS = 'false'; },
      (env) => { env.AI_MODEL = 'other'; },
      (env) => { env.DEEPSEEK_API_KEY = ''; },
      (env) => { env.DEEPSEEK_API_KEY = 'x\ny'; },
      (env) => { env.DEEPSEEK_API_KEY = 'x'.repeat(513); },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/v1'; },
      (env) => { env.AI_BASE_URL = 'http://api.deepseek.com/beta'; },
      (env) => { env.AI_BASE_URL = 'https://example.com/beta'; },
      (env) => { env.AI_BASE_URL = 'https://u:p@api.deepseek.com/beta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com:443/beta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/beta?x=1'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/beta#x'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/beta/'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/beta/extra'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/b%65ta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/%62eta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseｅk.com/beta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com.proxy.test/beta'; },
      (env) => { env.AI_BASE_URL = ' https://api.deepseek.com/beta'; },
      (env) => { env.AI_BASE_URL = 'https://api.deepseek.com/beta '; },
    ];
    for (const mutate of mutations) {
      const env: Record<string, string | undefined> = { ...LIVE_ENV };
      mutate(env);
      const result = parsePhase6943Cli({ command: 'live', argv: LIVE_ARGS, env });
      expect(result.ok).toBe(false);
      const serialized = JSON.stringify(result);
      for (const value of [env.DEEPSEEK_API_KEY, env.AI_BASE_URL])
        if (value && value.length > 8) expect(serialized).not.toContain(value);
    }
  });

  test('contains hostile Live env access as a zero-attempt config failure', () => {
    const env = Object.defineProperty({}, 'DEEPSEEK_API_KEY', {
      get() {
        throw new Error('RAW_ENV_CANARY');
      },
    }) as Readonly<Record<string, string | undefined>>;
    const result = parsePhase6943Cli({ command: 'live', argv: LIVE_ARGS, env });
    expect(result).toMatchObject({
      ok: false,
      exitCode: 3,
      output: { kind: 'invalid_run', runKind: 'live', errorCode: 'live_config_invalid' },
    });
    expect(JSON.stringify(result)).not.toContain('RAW_ENV_CANARY');
  });

  test('validates provider usage before returning and counts a thrown attempt once', async () => {
    let attempts = 0;
    const valid = withPhase6943UsageProvenance({
      onProviderAttempt: () => { attempts += 1; },
      executor: async () => ({ object: { ok: true }, usage: { inputTokens: 10, outputTokens: 2 } }),
    });
    expect(await valid(executorRequest())).toEqual({
      object: { ok: true },
      usage: { inputTokens: 10, outputTokens: 2 },
    });
    expect(attempts).toBe(1);

    const invalidUsage = [
      undefined,
      {},
      { inputTokens: 0, outputTokens: 1 },
      { inputTokens: -1, outputTokens: 1 },
      { inputTokens: 1.5, outputTokens: 1 },
      { inputTokens: Number.NaN, outputTokens: 1 },
      { inputTokens: 1, outputTokens: Number.POSITIVE_INFINITY },
    ];
    for (const usage of invalidUsage) {
      const wrapped = withPhase6943UsageProvenance({
        onProviderAttempt: () => { attempts += 1; },
        executor: async () => ({ object: {}, usage }),
      });
      await expect(wrapped(executorRequest())).rejects.toThrow('PHASE_6943_USAGE_UNVERIFIABLE');
    }
    const throwing = withPhase6943UsageProvenance({
      onProviderAttempt: () => { attempts += 1; },
      executor: async () => { throw new Error('RAW_PROVIDER_CANARY'); },
    });
    await expect(throwing(executorRequest())).rejects.toThrow('RAW_PROVIDER_CANARY');
    expect(attempts).toBe(9);
  });

  test('keeps OpenAI-compatible DeepSeek calls in JSON mode with schema, cap and signal', async () => {
    const signal = new AbortController().signal;
    let captured: Record<string, unknown> | null = null;
    const executor = createOpenAICompatibleStructuredExecutor(
      { provider: 'deepseek', apiKey: 'test-only-key', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
      {
        createProvider: () => (model) => ({ model }),
        generateStructured: async (input) => {
          captured = input as unknown as Record<string, unknown>;
          return { object: { value: 'ok' }, usage: { promptTokens: 12, completionTokens: 3 } };
        },
      },
    );
    const schema = z.object({ value: z.literal('ok') }).strict();
    await executor({ schema, systemPrompt: 'system', userPrompt: 'user', maxOutputTokens: 7, signal });
    expect(captured).toMatchObject({ mode: 'json', schema, maxTokens: 7, abortSignal: signal });
  });

  test('composes live dependencies with frozen strict-tool profiles and fixed timeout', async () => {
    let capturedConfig: Record<string, unknown> | null = null;
    let capturedRequest: Record<string, unknown> | null = null;
    const dependencies = createPhase6943LiveDependencies(
      {
        command: 'live', persist: true, apiKey: 'test-only-key',
        inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2,
        cliMaxCostUsd: 0.1, effectiveMaxCostUsd: 0.1,
      },
      () => undefined,
      '2026-07-13T00:00:00.000Z',
      (config) => {
        capturedConfig = config;
        return async (request) => {
          capturedRequest = request as unknown as Record<string, unknown>;
          return { object: { route: 'chat', confidence: 0.9, reasonCode: 'ambiguous_intent_resolved' }, usage: { inputTokens: 3, outputTokens: 1 } };
        };
      },
    );
    const runtime = dependencies.createRuntime({ caseId: 'synthetic', agent: 'router' });
    const result = await runtime.invokeStructured({
      runId: 'synthetic', task: 'router_fallback',
      schema: ROUTER_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: 'safe', userPrompt: 'safe', estimatedInputTokens: 1, maxOutputTokens: 1,
      budget: { maxCalls: 1, usedCalls: 0, maxInputTokens: 1, usedInputTokens: 0, maxOutputTokens: 1, usedOutputTokens: 0 },
    });
    expect(capturedConfig).toMatchObject({
      provider: 'deepseek',
      baseURL: 'https://api.deepseek.com/beta',
      model: 'deepseek-v4-flash',
      structuredOutputMode: 'deepseek_strict_tool',
      schemaProfiles: PHASE_6943_LIVE_SCHEMA_PROFILES,
    });
    expect(Object.isFrozen(PHASE_6943_LIVE_SCHEMA_PROFILES)).toBe(true);
    expect(PHASE_6943_LIVE_SCHEMA_PROFILES.every(Object.isFrozen)).toBe(true);
    expect(PHASE_6943_LIVE_SCHEMA_PROFILES).toEqual([
      { name: 'router_candidate_v1', schema: ROUTER_MODEL_CANDIDATE_SCHEMA },
      {
        name: 'knowledge_verifier_candidate_v1',
        schema: KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA,
      },
    ]);
    expect(validatePhase6943LiveStructuredSchemas()).toBe(true);
    expect(capturedRequest).toMatchObject({ maxOutputTokens: 1 });
    expect(result.trace.mode).toBe('live');
    expect(dependencies.readProviderAttempts()).toBe(1);
  });

  test('wires both canonical profiles through the real shared SDK executor without network', async () => {
    const originalFetch = globalThis.fetch;
    const requestBodies: Array<Record<string, unknown>> = [];
    const candidates = [
      {
        route: 'chat',
        confidence: 0.9,
        reasonCode: 'ambiguous_intent_resolved',
      },
      { status: 'trusted', evidenceCodes: ['consistent_support'] },
    ] as const;
    let responseIndex = 0;
    globalThis.fetch = (async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const candidate = candidates[responseIndex];
      responseIndex += 1;
      return new Response(JSON.stringify({
        id: `chatcmpl-phase6943-${responseIndex}`,
        object: 'chat.completion',
        created: 1,
        model: 'deepseek-v4-flash',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: `call_${responseIndex}`,
              type: 'function',
              function: {
                name: 'model_agent_result',
                arguments: JSON.stringify(candidate),
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    try {
      const dependencies = createPhase6943LiveDependencies(
        {
          command: 'live', persist: true, apiKey: 'test-only-key',
          inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2,
          cliMaxCostUsd: 0.1, effectiveMaxCostUsd: 0.1,
        },
        () => undefined,
        '2026-07-13T00:00:00.000Z',
      );
      const runtime = dependencies.createRuntime({ caseId: 'synthetic', agent: 'router' });
      const requests = [
        { task: 'router_fallback' as const, schema: ROUTER_MODEL_CANDIDATE_SCHEMA },
        {
          task: 'knowledge_verification' as const,
          schema: KNOWLEDGE_VERIFIER_MODEL_CANDIDATE_SCHEMA,
        },
      ];
      for (let index = 0; index < requests.length; index += 1) {
        const request = requests[index]!;
        const result = await runtime.invokeStructured({
          runId: `synthetic-${index}`,
          task: request.task,
          schema: request.schema,
          systemPrompt: 'safe',
          userPrompt: 'safe',
          estimatedInputTokens: 1,
          maxOutputTokens: 400,
          budget: {
            maxCalls: 1, usedCalls: 0,
            maxInputTokens: 1, usedInputTokens: 0,
            maxOutputTokens: 400, usedOutputTokens: 0,
          },
        });
        expect(result.ok).toBe(true);
      }

      expect(requestBodies).toHaveLength(2);
      for (const body of requestBodies) {
        expect(body.response_format).toBeUndefined();
        expect(body.tool_choice).toEqual({
          type: 'function',
          function: { name: 'model_agent_result' },
        });
        const tool = (body.tools as Array<{
          function: {
            name: string;
            strict: boolean;
            parameters: Record<string, unknown>;
          };
        }>)[0];
        expect(tool?.function.name).toBe('model_agent_result');
        expect(tool?.function.strict).toBe(true);
        expect(JSON.stringify(tool?.function.parameters)).not.toContain('"$schema"');
        expect(JSON.stringify(tool?.function.parameters)).not.toContain('"const"');
        expect(hasTupleItems(tool?.function.parameters)).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('fails Live schema preflight before identity, evidence, provider construction, or runner', async () => {
    for (const behavior of ['false', 'undefined', 'null', 'throw'] as const) {
      const memory = createMemoryFs();
      let randomCalls = 0;
      let providerFactories = 0;
      let runnerCalls = 0;
      const dependencies: Phase6943CompositionDependencies = {
        validateLiveStructuredSchemas() {
          memory.events.push('validate');
          if (behavior === 'throw') throw new Error('RAW_SCHEMA_CANARY');
          if (behavior === 'undefined') return undefined as never;
          if (behavior === 'null') return null as never;
          return false;
        },
        runPairedEval: async () => {
          runnerCalls += 1;
          return buildPhase6943InvalidRun('live', 'unexpected_runner_error');
        },
        createMockRuntime: createPhase6943MockRuntime,
        createLiveDependencies: (_config, onAttempt) => {
          providerFactories += 1;
          return fakeAttemptingLive(onAttempt, memory.events);
        },
        calculateDatasetDigest: calculatePhase6943DatasetDigest,
        validateDataset: validatePhase6943Dataset,
      };
      const result = await executePhase6943Cli({
        command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
        randomUUID: () => {
          randomCalls += 1;
          return '00000000-0000-4000-8000-000000000006';
        },
        epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'),
        clocks: fakeClocks(), fs: memory.fs, dependencies,
      });

      expect(result).toMatchObject({
        exitCode: 3,
        evidencePath: null,
        output: {
          kind: 'invalid_run',
          runKind: 'live',
          errorCode: 'live_config_invalid',
        },
      });
      expect(memory.events).toEqual(['validate']);
      expect(randomCalls).toBe(0);
      expect(providerFactories).toBe(0);
      expect(runnerCalls).toBe(0);
      expect(memory.keys()).toEqual([]);
      expect(JSON.stringify(result)).not.toContain('RAW_SCHEMA_CANARY');
    }
  });

  test('fails closed when the injected validator property exists but is malformed or hostile', async () => {
    const scenarios = [
      {
        name: 'explicit undefined',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return Object.defineProperty(dependencies, 'validateLiveStructuredSchemas', {
            configurable: true,
            enumerable: true,
            value: undefined,
          });
        },
      },
      {
        name: 'number',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return Object.defineProperty(dependencies, 'validateLiveStructuredSchemas', {
            configurable: true,
            enumerable: true,
            value: 1,
          });
        },
      },
      {
        name: 'object',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return Object.defineProperty(dependencies, 'validateLiveStructuredSchemas', {
            configurable: true,
            enumerable: true,
            value: Object.freeze({}),
          });
        },
      },
      {
        name: 'hostile own getter',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return Object.defineProperty(dependencies, 'validateLiveStructuredSchemas', {
            configurable: true,
            enumerable: true,
            get() {
              throw new Error('RAW_VALIDATOR_GETTER_CANARY');
            },
          });
        },
      },
      {
        name: 'hostile has trap',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return new Proxy(dependencies, {
            has() {
              throw new Error('RAW_VALIDATOR_HAS_CANARY');
            },
          });
        },
      },
      {
        name: 'hostile value trap',
        wrap(dependencies: Phase6943CompositionDependencies) {
          return new Proxy(dependencies, {
            has(_target, property) {
              return property === 'validateLiveStructuredSchemas';
            },
            get(target, property, receiver) {
              if (property === 'validateLiveStructuredSchemas') {
                throw new Error('RAW_VALIDATOR_VALUE_CANARY');
              }
              return Reflect.get(target, property, receiver);
            },
          });
        },
      },
    ] as const;

    for (const scenario of scenarios) {
      const memory = createMemoryFs();
      let randomCalls = 0;
      let providerFactories = 0;
      let runnerCalls = 0;
      const baseDependencies: Phase6943CompositionDependencies = {
        runPairedEval: async () => {
          runnerCalls += 1;
          return buildPhase6943InvalidRun('live', 'unexpected_runner_error');
        },
        createMockRuntime: createPhase6943MockRuntime,
        createLiveDependencies: (_config, onAttempt) => {
          providerFactories += 1;
          return fakeAttemptingLive(onAttempt, memory.events);
        },
        calculateDatasetDigest: calculatePhase6943DatasetDigest,
        validateDataset: validatePhase6943Dataset,
      };
      const result = await executePhase6943Cli({
        command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
        randomUUID: () => {
          randomCalls += 1;
          return '00000000-0000-4000-8000-000000000008';
        },
        epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'),
        clocks: fakeClocks(), fs: memory.fs,
        dependencies: scenario.wrap(baseDependencies),
      });

      expect(result, scenario.name).toMatchObject({
        exitCode: 3,
        evidencePath: null,
        output: {
          kind: 'invalid_run',
          runKind: 'live',
          errorCode: 'live_config_invalid',
        },
      });
      expect(randomCalls, scenario.name).toBe(0);
      expect(providerFactories, scenario.name).toBe(0);
      expect(runnerCalls, scenario.name).toBe(0);
      expect(memory.keys(), scenario.name).toEqual([]);
      expect(JSON.stringify(result), scenario.name).not.toContain('RAW_VALIDATOR_');
    }
  });

  test('runs successful Live schema preflight before identity and all side effects', async () => {
    const memory = createMemoryFs();
    const dependencies: Phase6943CompositionDependencies = {
      validateLiveStructuredSchemas: () => {
        memory.events.push('validate');
        return true;
      },
      runPairedEval: async () => {
        memory.events.push('runner');
        return buildPhase6943InvalidRun('live', 'dataset_mismatch');
      },
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) => {
        memory.events.push('provider_factory');
        return fakeAttemptingLive(onAttempt, memory.events);
      },
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };
    await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => {
        memory.events.push('uuid');
        return '00000000-0000-4000-8000-000000000007';
      },
      epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'),
      clocks: fakeClocks(), fs: memory.fs, dependencies,
    });
    expect(memory.events.slice(0, 5)).toEqual([
      'validate', 'uuid', 'open:reserve', 'provider_factory', 'runner',
    ]);
  });

  test('covers all 28 fixture IDs and rejects all 72 zero-call IDs', () => {
    const cases = [...phase6941RouterCases, ...phase6941VerifierCases];
    const eligible = cases.filter((testCase) => testCase.candidateEligible);
    const ineligible = cases.filter((testCase) => !testCase.candidateEligible);
    expect(eligible).toHaveLength(28);
    expect(ineligible).toHaveLength(72);
    for (const testCase of eligible) expect(() => phase6943MockCandidateForCase(testCase.id)).not.toThrow();
    for (const testCase of ineligible) expect(() => phase6943MockCandidateForCase(testCase.id)).toThrow('PHASE_6943_UNKNOWN_MOCK_CASE');
    const serialized = JSON.stringify(eligible.map((testCase) => phase6943MockCandidateForCase(testCase.id)));
    for (const canary of ['query', 'chunk', 'prompt', 'test-only-key']) expect(serialized.toLowerCase()).not.toContain(canary);
  });

  test('preserves the exact Task 2 candidate values', () => {
    const routerRoutes = {
      router_ambiguous_notes_tutor_01: 'tutor',
      router_ambiguous_rag_explain_02: 'rag_answer',
      router_ambiguous_plan_review_03: 'review_analysis',
      router_ambiguous_review_plan_04: 'review_analysis',
      router_ambiguous_short_continue_05: 'tutor',
      router_ambiguous_short_why_06: 'tutor',
      router_ambiguous_pronoun_07: 'tutor',
      router_ambiguous_no_context_08: 'chat',
      router_ambiguous_material_general_09: 'rag_answer',
      router_ambiguous_today_review_10: 'review_analysis',
      router_ambiguous_question_deck_11: 'tutor',
      router_ambiguous_plan_question_12: 'chat',
      router_ambiguous_rewrite_rag_13: 'rag_answer',
      router_ambiguous_rewrite_tutor_14: 'tutor',
      router_ambiguous_mixed_review_15: 'review_analysis',
      router_ambiguous_mixed_chat_16: 'chat',
    } as const;
    for (const [caseId, route] of Object.entries(routerRoutes)) {
      expect(phase6943MockCandidateForCase(caseId)).toEqual({
        route,
        confidence: 0.9,
        reasonCode: 'ambiguous_intent_resolved',
      });
    }
    expect(phase6943MockCandidateForCase('verifier_conflict_derivative_sign_01')).toEqual({
      status: 'conflict',
      evidenceCodes: ['condition_conflict'],
    });
  });
});

describe('Phase 6.9.4.3 evidence writer', () => {
  test('cleans only its owned reserve when the reserve handle close fails', async () => {
    const memory = createMemoryFs('reserve-close');
    memory.seed('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json', 'OLD');
    await expect(reservePhase6943Evidence(reservationInput(memory))).rejects.toThrow(
      'PHASE_6943_EVIDENCE_RESERVATION_FAILED',
    );
    expect(memory.read('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json')).toBe('OLD');
    expect(memory.keys().some((key) => key.endsWith('.reserve'))).toBe(false);
    expect(JSON.stringify(memory.events)).not.toContain('RAW_RESERVE_CLOSE_CANARY');
  });

  test('contains pre-reservation clock and run ID failures without leaking raw errors', async () => {
    const memory = createMemoryFs();
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: async () => { throw new Error('RUNNER_MUST_NOT_START'); },
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) =>
        fakeAttemptingLive(onAttempt, memory.events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };
    const result = await executePhase6943Cli({
      command: 'mock', argv: [], env: {}, root: 'E:/repo',
      randomUUID: () => { throw new Error('RAW_UUID_CANARY'); },
      epochMs: () => { throw new Error('RAW_CLOCK_CANARY'); },
      clocks: fakeClocks(), fs: memory.fs, dependencies,
    });
    expect(result).toMatchObject({
      exitCode: 3,
      evidencePath: null,
      output: { kind: 'invalid_run', runKind: 'mock', errorCode: 'unexpected_runner_error' },
    });
    expect(JSON.stringify(result)).not.toMatch(/RAW_(?:UUID|CLOCK)_CANARY/);
  });

  test('commits once with fsync/link and removes only its temp/reserve files', async () => {
    const memory = createMemoryFs();
    const reservation = await reservePhase6943Evidence(reservationInput(memory));
    const output = await makeMockOutput();
    expect(await reservation.commit(output)).toEqual({ ok: true });
    expect(memory.events).toEqual(expect.arrayContaining(['open:reserve', 'open:temp', 'write', 'sync', 'link']));
    expect(memory.keys().some((key) => key.endsWith('/mock.json'))).toBe(true);
    expect(memory.keys().some((key) => key.endsWith('.reserve') || key.includes('.tmp-'))).toBe(false);
  });

  test('uses real fs atomic link semantics without overwrite or sidecar residue', async () => {
    const tempRoot = resolve(tmpdir());
    const root = await realFs.mkdtemp(join(tempRoot, 'prepmind-phase6943-'));
    const assertOwnedTemp = () => {
      const child = relative(tempRoot, resolve(root));
      expect(child).not.toBe('');
      expect(child).not.toBe('..');
      expect(child.startsWith(`..${sep}`)).toBe(false);
      expect(isAbsolute(child)).toBe(false);
    };
    assertOwnedTemp();
    try {
      const reservation = await reservePhase6943Evidence({
        ...reservationInput(createMemoryFs()),
        root,
        fs: realFs,
      });
      const output = await makeMockOutput();
      expect(await reservation.commit(output)).toEqual({ ok: true });
      const target = resolve(root, reservation.relativePath);
      const original = await realFs.readFile(target, 'utf8');
      expect(JSON.parse(original)).toEqual(output);

      await expect(
        reservePhase6943Evidence({
          ...reservationInput(createMemoryFs()),
          root,
          fs: realFs,
        }),
      ).rejects.toThrow('PHASE_6943_EVIDENCE_TARGET_EXISTS');
      expect(await realFs.readFile(target, 'utf8')).toBe(original);
      expect(await realFs.readdir(dirname(target))).toEqual(['mock.json']);
    } finally {
      assertOwnedTemp();
      await realFs.rm(root, { recursive: true, force: true });
    }
  });

  test('rejects reserve and target collisions without overwrite', async () => {
    const reserveCollision = createMemoryFs();
    await reservePhase6943Evidence(reservationInput(reserveCollision));
    await expect(reservePhase6943Evidence(reservationInput(reserveCollision))).rejects.toThrow('EEXIST');

    const existingTarget = createMemoryFs();
    existingTarget.seed('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json', 'OLD');
    await expect(reservePhase6943Evidence(reservationInput(existingTarget))).rejects.toThrow('PHASE_6943_EVIDENCE_TARGET_EXISTS');
    expect(existingTarget.read('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json')).toBe('OLD');
    expect(existingTarget.keys().some((key) => key.endsWith('.reserve'))).toBe(false);

    const targetCollision = createMemoryFs();
    const reservation = await reservePhase6943Evidence(reservationInput(targetCollision));
    targetCollision.seed('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json', 'OLD');
    expect(await reservation.commit(await makeMockOutput())).toEqual({ ok: false, errorCode: 'evidence_write_failed' });
    expect(targetCollision.read('E:/repo/docs/acceptance/evidence/phase-6-9-4-3/mock.json')).toBe('OLD');
  });

  test.each(['write', 'sync', 'link'] as const)('cleans its sidecars after %s failure', async (fault) => {
    const memory = createMemoryFs(fault);
    const reservation = await reservePhase6943Evidence(reservationInput(memory));
    expect(await reservation.commit(await makeMockOutput())).toEqual({ ok: false, errorCode: 'evidence_write_failed' });
    expect(memory.keys().some((key) => key.endsWith('.reserve') || key.includes('.tmp-'))).toBe(false);
  });

  test('reserves before the first provider boundary and persists attempted invalid evidence', async () => {
    const memory = createMemoryFs();
    const events = memory.events;
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: async (input) => {
        const runtime = input.live!.createRuntime({ caseId: 'synthetic', agent: 'router' });
        await runtime.invokeStructured({
          runId: 'synthetic', task: 'router_fallback', schema: z.object({ ok: z.boolean() }),
          systemPrompt: 'safe', userPrompt: 'safe', estimatedInputTokens: 1, maxOutputTokens: 1,
          budget: { maxCalls: 1, usedCalls: 0, maxInputTokens: 1, usedInputTokens: 0, maxOutputTokens: 1, usedOutputTokens: 0 },
        });
        return buildPhase6943InvalidRun('live', 'unexpected_runner_error');
      },
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) => fakeAttemptingLive(onAttempt, events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };
    const result = await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => '00000000-0000-4000-8000-000000000001',
      epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'), clocks: fakeClocks(),
      fs: memory.fs, dependencies,
    });
    expect(events.indexOf('open:reserve')).toBeLessThan(events.indexOf('provider'));
    expect(result.output.kind).toBe('invalid_run');
    expect(result.evidencePath).toMatch(/^docs\/acceptance\/evidence\/phase-6-9-4-3\/live-/);
  });

  test('binds the reserved Live path to the report startedAt when clocks differ', async () => {
    const memory = createMemoryFs();
    const reservedAt = Date.parse('2026-07-13T00:00:00.000Z');
    let runnerEpoch = reservedAt + 18;
    let monotonic = 0;
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: runPhase6943PairedEval,
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) =>
        fakeAttemptingLive(onAttempt, memory.events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };

    const result = await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => '00000000-0000-4000-8000-000000000004',
      epochMs: () => reservedAt,
      clocks: {
        epochMs: () => runnerEpoch++,
        monotonicMs: () => monotonic++,
      },
      fs: memory.fs, dependencies,
    });

    if (result.output.kind !== 'report') throw new Error('expected report');
    const canonical = buildPhase6943LiveEvidencePath(
      result.output.startedAt,
      result.output.runIdHash,
    );
    expect(result.evidencePath).toBe(canonical);
    expect(
      validatePhase6943Evidence({
        profile: 'live',
        file: canonical,
        raw: memory.read(`E:/repo/${result.evidencePath}`),
      }),
    ).toEqual({ ok: true, profile: 'live', runStatus: 'incomplete' });
  });

  test('keeps a hostile runner start clock before the provider boundary', async () => {
    const memory = createMemoryFs();
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: runPhase6943PairedEval,
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) =>
        fakeAttemptingLive(onAttempt, memory.events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };

    const result = await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => '00000000-0000-4000-8000-000000000005',
      epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'),
      clocks: {
        epochMs: () => { throw new Error('RAW_RUNNER_CLOCK_CANARY'); },
        monotonicMs: () => 0,
      },
      fs: memory.fs, dependencies,
    });

    expect(result).toMatchObject({
      exitCode: 3,
      evidencePath: null,
      output: {
        kind: 'invalid_run',
        runKind: 'live',
        errorCode: 'report_contract_invalid',
      },
    });
    expect(memory.events).not.toContain('provider');
    expect(
      memory.keys().some((key) =>
        key.endsWith('.json') || key.endsWith('.reserve') || key.includes('.tmp-')),
    ).toBe(false);
    expect(JSON.stringify(result)).not.toContain('RAW_RUNNER_CLOCK_CANARY');
  });

  test('releases a zero-attempt Live invalid reservation without evidence', async () => {
    const memory = createMemoryFs();
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: async () => buildPhase6943InvalidRun('live', 'dataset_mismatch'),
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) => fakeAttemptingLive(onAttempt, memory.events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };
    const result = await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => '00000000-0000-4000-8000-000000000002',
      epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'), clocks: fakeClocks(),
      fs: memory.fs, dependencies,
    });
    expect(result.evidencePath).toBeNull();
    expect(memory.keys().some((key) => key.endsWith('.json') || key.endsWith('.reserve') || key.includes('.tmp-'))).toBe(false);
    expect(memory.events).not.toContain('provider');
  });

  test('rejects an existing Live target before constructing or calling the provider', async () => {
    const memory = createMemoryFs();
    const runId = '00000000-0000-4000-8000-000000000003';
    const prefix = hashModelAgentRunId(runId).slice('sha256:'.length, 'sha256:'.length + 12);
    memory.seed(`E:/repo/docs/acceptance/evidence/phase-6-9-4-3/live-20260713T000000000Z-${prefix}.json`, 'OLD');
    let runnerCalls = 0;
    const dependencies: Phase6943CompositionDependencies = {
      runPairedEval: async () => { runnerCalls += 1; return buildPhase6943InvalidRun('live', 'unexpected_runner_error'); },
      createMockRuntime: createPhase6943MockRuntime,
      createLiveDependencies: (_config, onAttempt) => fakeAttemptingLive(onAttempt, memory.events),
      calculateDatasetDigest: calculatePhase6943DatasetDigest,
      validateDataset: validatePhase6943Dataset,
    };
    const result = await executePhase6943Cli({
      command: 'live', argv: LIVE_ARGS, env: LIVE_ENV, root: 'E:/repo',
      randomUUID: () => runId,
      epochMs: () => Date.parse('2026-07-13T00:00:00.000Z'), clocks: fakeClocks(),
      fs: memory.fs, dependencies,
    });
    expect(result.exitCode).toBe(3);
    expect(result.evidencePath).toBeNull();
    expect(runnerCalls).toBe(0);
    expect(memory.events).not.toContain('provider');
  });
});

describe('Phase 6.9.4.3 evidence validator', () => {
  test('preserves the validator conclusion for immutable Attempts A through D', async () => {
    const files = [
      ['live-20260713T122743752Z-46b0f4785861.json', { ok: false, errorCode: 'profile_mismatch' }],
      ['live-20260713T124435253Z-4d37573c86dc.json', { ok: true, profile: 'live', runStatus: 'incomplete' }],
      ['live-20260714T022627206Z-08bddedf3f64.json', { ok: true, profile: 'live', runStatus: 'incomplete' }],
      ['live-20260714T032310330Z-991994cb5bb5.json', { ok: true, profile: 'live', runStatus: 'incomplete' }],
    ] as const;
    for (const [name, expected] of files) {
      const file = `docs/acceptance/evidence/phase-6-9-4-3/${name}`;
      const raw = await realFs.readFile(resolve(import.meta.dir, '../../..', file), 'utf8');
      expect(validatePhase6943Evidence({ profile: 'live', file, raw })).toEqual(expected);
    }
  });

  test('accepts only exact profile/file arguments and safe repository paths', () => {
    expect(parseEvidenceValidatorArgs(['--profile', 'mock', '--file', 'docs/acceptance/evidence/phase-6-9-4-3/mock.json']).ok).toBe(true);
    expect(parseEvidenceValidatorArgs(['--profile', 'live', '--file', 'docs/acceptance/evidence/phase-6-9-4-3/live-20260713T000000000Z-aaaaaaaaaaaa.json']).ok).toBe(true);
    for (const argv of [
      [],
      ['--file', 'x', '--profile', 'mock'],
      ['--profile', 'other', '--file', 'x'],
      ['--profile', 'mock', '--file', 'E:/repo/mock.json'],
      ['--profile', 'mock', '--file', '../mock.json'],
      ['--profile', 'mock', '--file', 'docs\\acceptance\\evidence\\phase-6-9-4-3\\mock.json'],
    ]) expect(parseEvidenceValidatorArgs(argv).ok).toBe(false);
  });

  test('accepts complete Mock, complete/incomplete Live and attempted invalid Live only', async () => {
    const mock = await makeMockOutput();
    const complete = await makeLiveOutput();
    const incomplete = await makeLiveOutput('router_ambiguous_short_continue_05');
    const invalid = buildPhase6943InvalidRun('live', 'unexpected_runner_error');
    expect(validatePhase6943Evidence({ profile: 'mock', file: mockPath(), raw: JSON.stringify(mock) })).toEqual({ ok: true, profile: 'mock', runStatus: 'complete' });
    expect(validatePhase6943Evidence({ profile: 'live', file: liveReportPath(complete), raw: JSON.stringify(complete) })).toEqual({ ok: true, profile: 'live', runStatus: 'complete' });
    expect(validatePhase6943Evidence({ profile: 'live', file: liveReportPath(incomplete), raw: JSON.stringify(incomplete) })).toEqual({ ok: true, profile: 'live', runStatus: 'incomplete' });
    expect(validatePhase6943Evidence({ profile: 'live', file: livePath(), raw: JSON.stringify(invalid) })).toEqual({ ok: true, profile: 'live', runStatus: 'invalid' });
    expect(validatePhase6943Evidence({ profile: 'live', file: livePath(), raw: JSON.stringify(buildPhase6943InvalidRun('live', 'live_config_invalid')) }).ok).toBe(false);

    if (incomplete.kind !== 'report' || incomplete.runKind !== 'live') {
      throw new Error('expected incomplete live report');
    }
    const providerFailure = incomplete.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeErrorCode === 'PROVIDER_ERROR',
    );
    expect(providerFailure).toMatchObject({
      providerAttempted: true,
      strictSuccess: false,
      runtimeErrorCode: 'PROVIDER_ERROR',
      providerFailureCategory: 'unknown',
    });
    expect(JSON.stringify(incomplete)).not.toContain('SYNTHETIC_FAILURE');

    const historical = structuredClone(incomplete);
    const historicalFailure = historical.lanes.live.entries.find(
      (entry) => entry.entryStatus === 'observed' && entry.lane === 'live' &&
        entry.runtimeErrorCode === 'PROVIDER_ERROR',
    );
    if (!historicalFailure || historicalFailure.entryStatus !== 'observed' ||
        historicalFailure.lane !== 'live') {
      throw new Error('expected historical provider failure');
    }
    delete (historicalFailure as typeof historicalFailure & {
      providerFailureCategory?: string;
    }).providerFailureCategory;
    expect(validatePhase6943Evidence({
      profile: 'live',
      file: liveReportPath(historical),
      raw: JSON.stringify(historical),
    })).toEqual({ ok: true, profile: 'live', runStatus: 'incomplete' });
  });

  test('binds Live report evidence filenames to startedAt and runIdHash', async () => {
    const complete = await makeLiveOutput();
    if (complete.kind !== 'report' || complete.runKind !== 'live') {
      throw new Error('expected live report');
    }
    const canonical = buildPhase6943LiveEvidencePath(
      complete.startedAt,
      complete.runIdHash,
    );
    expect(
      validatePhase6943Evidence({
        profile: 'live',
        file: canonical,
        raw: JSON.stringify(complete),
      }),
    ).toEqual({ ok: true, profile: 'live', runStatus: 'complete' });
    const copied = canonical.replace(/live-\d{8}/, 'live-20260714');
    expect(copied).not.toBe(canonical);
    expect(
      validatePhase6943Evidence({
        profile: 'live',
        file: copied,
        raw: JSON.stringify(complete),
      }),
    ).toEqual({ ok: false, errorCode: 'profile_mismatch' });
  });

  test('rejects cross-profile, contract tampering and leakage canaries', async () => {
    const mock = await makeMockOutput();
    expect(validatePhase6943Evidence({ profile: 'live', file: livePath(), raw: JSON.stringify(mock) }).ok).toBe(false);
    const tampered = structuredClone(mock) as unknown as Record<string, unknown>;
    tampered.datasetDigest = `sha256:${'f'.repeat(64)}`;
    expect(validatePhase6943Evidence({ profile: 'mock', file: mockPath(), raw: JSON.stringify(tampered) }).ok).toBe(false);
    expect(validatePhase6943Evidence({ profile: 'mock', file: mockPath(), raw: `${JSON.stringify(mock)}RAW_ERROR_CANARY` }).ok).toBe(false);
  });
});

function executorRequest() {
  return {
    schema: z.object({ ok: z.boolean() }), systemPrompt: 'safe', userPrompt: 'safe',
    maxOutputTokens: 2, signal: new AbortController().signal,
  };
}

function fakeClocks(): Phase6943Clocks {
  let epoch = Date.parse('2026-07-13T00:00:00.000Z');
  let monotonic = 0;
  return { epochMs: () => epoch++, monotonicMs: () => monotonic++ };
}

async function makeMockOutput(): Promise<Phase6943Output> {
  return runPhase6943PairedEval({
    runId: 'mock-evidence-test', runKind: 'mock', clocks: fakeClocks(),
    validateDataset: validatePhase6943Dataset,
    calculateDatasetDigest: calculatePhase6943DatasetDigest,
    createMockRuntime: ({ caseId }) => createPhase6943MockRuntime({ caseId }),
  });
}

async function makeLiveOutput(failCaseId?: string): Promise<Phase6943Output> {
  let attempts = 0;
  const live: Phase6943LiveDependencies = {
    pricing: { currency: 'USD', unitTokens: 1_000_000, inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2, inputPriceBasis: 'non_cached_highest_applicable', capturedAt: '2026-07-13T00:00:00.000Z', cliMaxCostUsd: 0.1, effectiveMaxCostUsd: 0.1 },
    budgetState: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    readProviderAttempts: () => attempts,
    createRuntime: ({ caseId }) => createModelAgentRuntime({
      mode: 'live', provider: 'deepseek', model: 'deepseek-v4-flash', liveCallsEnabled: true, timeoutMs: 10_000,
      executor: async () => {
        attempts += 1;
        if (caseId === failCaseId) throw new Error('SYNTHETIC_FAILURE');
        return { object: phase6943MockCandidateForCase(caseId), usage: { inputTokens: 100, outputTokens: 10 } };
      },
    }),
  };
  return runPhase6943PairedEval({
    runId: 'live-evidence-test', runKind: 'live', clocks: fakeClocks(), live,
    validateDataset: validatePhase6943Dataset,
    calculateDatasetDigest: calculatePhase6943DatasetDigest,
    createMockRuntime: ({ caseId }) => createPhase6943MockRuntime({ caseId }),
  });
}

function fakeAttemptingLive(onAttempt: () => void, events: string[]): Phase6943LiveDependencies {
  let attempts = 0;
  return {
    pricing: { currency: 'USD', unitTokens: 1_000_000, inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.2, inputPriceBasis: 'non_cached_highest_applicable', capturedAt: '2026-07-13T00:00:00.000Z', cliMaxCostUsd: 0.1, effectiveMaxCostUsd: 0.1 },
    budgetState: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    readProviderAttempts: () => attempts,
    createRuntime: () => ({
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        attempts += 1; onAttempt(); events.push('provider');
        return {
          ok: false as const,
          error: { code: 'PROVIDER_ERROR' as const, message: 'Synthetic failure.', retryable: false },
          budget: request.budget,
          usage: { inputTokens: 0, outputTokens: 0 },
          trace: { runIdHash: `sha256:${'0'.repeat(64)}`, task: request.task, mode: 'live' as const, provider: 'deepseek' as const, model: 'deepseek-v4-flash', status: 'failed' as const, inputTokens: 0, outputTokens: 0, maxOutputTokens: request.maxOutputTokens, durationMs: 1, degraded: true, errorCode: 'PROVIDER_ERROR' as const },
        };
      },
    }),
  };
}

type MemoryFault = 'reserve-close' | 'write' | 'sync' | 'link';
function createMemoryFs(fault?: MemoryFault) {
  const files = new Map<string, string>();
  const events: string[] = [];
  const normalize = (path: string) => path.replace(/\//g, '\\');
  const fs = {
    async mkdir() {},
    async stat(path: string) {
      if (files.has(normalize(path))) return { isFile: () => true };
      const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      throw error;
    },
    async open(path: string, flags: string) {
      path = normalize(path);
      if (flags !== 'wx') throw new Error('UNEXPECTED_FLAGS');
      if (files.has(path)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
      files.set(path, '');
      events.push(path.endsWith('.reserve') ? 'open:reserve' : 'open:temp');
      return {
        async writeFile(value: string) {
          events.push('write');
          if (fault === 'write') throw new Error('WRITE_FAILURE');
          files.set(path, value);
        },
        async sync() {
          events.push('sync');
          if (fault === 'sync') throw new Error('SYNC_FAILURE');
        },
        async close() {
          if (fault === 'reserve-close' && path.endsWith('.reserve')) {
            throw new Error('RAW_RESERVE_CLOSE_CANARY');
          }
        },
      };
    },
    async link(source: string, target: string) {
      source = normalize(source); target = normalize(target);
      events.push('link');
      if (fault === 'link') throw new Error('LINK_FAILURE');
      if (files.has(target)) throw Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
      files.set(target, files.get(source) ?? '');
    },
    async unlink(path: string) { files.delete(normalize(path)); },
  };
  return {
    fs: fs as never,
    events,
    keys: () => [...files.keys()].map((key) => key.replace(/\\/g, '/')),
    seed: (path: string, value: string) => files.set(normalize(path), value),
    read: (path: string) => files.get(normalize(path)),
  };
}

function reservationInput(memory: ReturnType<typeof createMemoryFs>) {
  return {
    root: 'E:/repo', runKind: 'mock' as const, startedAt: '2026-07-13T00:00:00.000Z',
    runIdHash: `sha256:${'a'.repeat(64)}` as const, fs: memory.fs,
  };
}

function mockPath() { return 'docs/acceptance/evidence/phase-6-9-4-3/mock.json'; }
function livePath() { return 'docs/acceptance/evidence/phase-6-9-4-3/live-20260713T000000000Z-aaaaaaaaaaaa.json'; }
function liveReportPath(output: Phase6943Output) {
  if (output.kind !== 'report' || output.runKind !== 'live') {
    throw new Error('expected live report');
  }
  return buildPhase6943LiveEvidencePath(output.startedAt, output.runIdHash);
}

function hasTupleItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasTupleItems);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.items) || Object.values(record).some(hasTupleItems);
}
