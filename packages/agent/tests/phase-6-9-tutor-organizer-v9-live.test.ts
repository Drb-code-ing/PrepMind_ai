import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createPhase697V7WireDiagnostics,
  type FirstPartyDeepSeekV4ProDirectConfig,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  createPhase697TutorOrganizerV9LiveHarness,
  resolvePhase697V9LiveConfiguration,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-live.ts';

function validLiveEnv(overrides?: Readonly<Record<string, string | undefined>>) {
  return {
    AI_PROVIDER_MODE: 'live',
    AI_ENABLE_LIVE_CALLS: 'true',
    AI_BASE_URL: 'https://api.deepseek.com/v1',
    TUTOR_AGENT_MODEL_ENABLED: 'true',
    TUTOR_AGENT_MODEL_TIMEOUT_MS: '3500',
    TUTOR_AGENT_DEEPSEEK_API_KEY: 'test-v9-tutor-component-key',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'true',
    WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5000',
    WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY: 'test-v9-organizer-component-key',
    ...overrides,
  };
}

function firstTutorRuntimeCase() {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (candidate): candidate is Phase697V2TutorRuntimeCase =>
      candidate.agent === 'tutor' && candidate.subset === 'runtime',
  );
  if (!entry) throw new Error('V9 Tutor runtime fixture unavailable');
  return entry;
}

function firstOrganizerRuntimeCase() {
  const entry = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (candidate): candidate is Phase697V2OrganizerRuntimeCase =>
      candidate.agent === 'wrong_question_organizer' && candidate.subset === 'runtime',
  );
  if (!entry) throw new Error('V9 Organizer runtime fixture unavailable');
  return entry;
}

describe('Phase 6.9.7 V9 R5 first-party Live configuration', () => {
  test('requires both component credentials and never borrows the generic key', () => {
    expect(resolvePhase697V9LiveConfiguration(validLiveEnv())).toEqual({
      ok: true,
      value: {
        tutorApiKey: 'test-v9-tutor-component-key',
        organizerApiKey: 'test-v9-organizer-component-key',
      },
    });
    for (const missing of [
      'TUTOR_AGENT_DEEPSEEK_API_KEY',
      'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY',
    ] as const) {
      expect(
        resolvePhase697V9LiveConfiguration(
          validLiveEnv({
            [missing]: undefined,
            DEEPSEEK_API_KEY: 'generic-key-must-not-be-borrowed',
          }),
        ),
      ).toEqual({ ok: false, code: 'live_configuration_invalid' });
    }
  });

  test('fails closed for wrong gates, endpoint, timeouts, other Agent gates and hostile accessors', () => {
    for (const override of [
      { AI_PROVIDER_MODE: 'mock' },
      { AI_ENABLE_LIVE_CALLS: 'false' },
      { AI_BASE_URL: 'https://example.invalid/v1' },
      { TUTOR_AGENT_MODEL_ENABLED: 'false' },
      { TUTOR_AGENT_MODEL_TIMEOUT_MS: '3499' },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED: 'false' },
      { WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS: '5001' },
      { ROUTER_MODEL_ENABLED: 'true' },
    ]) {
      expect(resolvePhase697V9LiveConfiguration(validLiveEnv(override))).toEqual({
        ok: false,
        code: 'live_configuration_invalid',
      });
    }

    const hostile = Object.create(null) as Record<string, string | undefined>;
    let reads = 0;
    Object.defineProperty(hostile, 'TUTOR_AGENT_DEEPSEEK_API_KEY', {
      enumerable: true,
      get() {
        reads += 1;
        return 'must-not-be-read';
      },
    });
    expect(resolvePhase697V9LiveConfiguration(hostile)).toEqual({
      ok: false,
      code: 'live_configuration_invalid',
    });
    expect(reads).toBe(0);
  });
});

describe('Phase 6.9.7 V9 R5 first-party Live harness', () => {
  test('cannot label an injected adapter first-party and keeps each component credential isolated', async () => {
    const configurations: FirstPartyDeepSeekV4ProDirectConfig[] = [];
    const requests: Array<
      Readonly<{ url: string; headers: Headers; body: Record<string, unknown> }>
    > = [];
    const harness = createPhase697TutorOrganizerV9LiveHarness({
      configuration: {
        tutorApiKey: 'test-v9-tutor-component-key',
        organizerApiKey: 'test-v9-organizer-component-key',
      },
      runId: '00000000-0000-4000-8000-000000000951',
      runScope: 'branch',
      adapterFactory(config, capability) {
        configurations.push(config);
        return createFirstPartyDeepSeekV4ProDirectAdapter(config, capability, {
          fetch: async (url, init) => {
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            requests.push({ url: String(url), headers: new Headers(init?.headers), body });
            const messages = body.messages as Array<{ role: string; content: string }>;
            const projection = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;
            const output = Array.isArray(projection.eligibleIntents)
              ? {
                  intentIndex: Number(
                    (projection.eligibleIntents[0] as { intentIndex?: unknown } | undefined)
                      ?.intentIndex,
                  ),
                }
              : {
                  decisions: (projection.questions as Array<Record<string, unknown>>).map(
                    (question) => ({
                      questionIndex: Number(question.questionIndex),
                      optionIndex: Number(
                        ((question.options as Array<Record<string, unknown>>)[0] ?? {}).optionIndex,
                      ),
                    }),
                  ),
                };
            return new Response(
              JSON.stringify({
                choices: [{ message: { content: JSON.stringify(output) } }],
                usage: {
                  prompt_tokens: 240,
                  completion_tokens: 24,
                  completion_tokens_details: { reasoning_tokens: 0 },
                },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            );
          },
        });
      },
    });
    expect(harness.executorProvenance).toBe('synthetic_test');

    const tutorWire = createPhase697V7WireDiagnostics({ appendStage() {} });
    const organizerWire = createPhase697V7WireDiagnostics({ appendStage() {} });
    const tutor = await harness.runTutor(
      firstTutorRuntimeCase(),
      new AbortController().signal,
      tutorWire.capability,
    );
    const organizer = await harness.runOrganizer(
      firstOrganizerRuntimeCase(),
      new AbortController().signal,
      organizerWire.capability,
    );

    expect(tutor.strictRuntimeSuccess).toBe(true);
    expect(organizer.strictRuntimeSuccess).toBe(true);
    expect(configurations.map((entry) => entry.apiKey)).toEqual([
      'test-v9-tutor-component-key',
      'test-v9-organizer-component-key',
    ]);
    expect(requests).toHaveLength(2);
    expect(
      requests.every((entry) => entry.url === 'https://api.deepseek.com/v1/chat/completions'),
    ).toBe(true);
    expect(requests.map((entry) => entry.headers.get('authorization'))).toEqual([
      'Bearer test-v9-tutor-component-key',
      'Bearer test-v9-organizer-component-key',
    ]);
    expect(requests.map((entry) => entry.headers.get('content-type'))).toEqual([
      'application/json',
      'application/json',
    ]);
    expect(requests.map((entry) => entry.body.max_tokens)).toEqual([300, 800]);
    for (const request of requests) {
      expect(request.body).toMatchObject({
        model: 'deepseek-v4-pro',
        thinking: { type: 'disabled' },
        response_format: { type: 'json_object' },
        stream: false,
      });
      expect(Object.keys(request.body).sort()).toEqual([
        'max_tokens',
        'messages',
        'model',
        'response_format',
        'stream',
        'thinking',
      ]);
      const messages = request.body.messages as Array<Record<string, unknown>>;
      expect(messages).toHaveLength(2);
      expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
      expect(
        messages.every((message) => Object.keys(message).sort().join(',') === 'content,role'),
      ).toBe(true);
      expect(
        messages.every(
          (message) => typeof message.content === 'string' && message.content.length > 0,
        ),
      ).toBe(true);
      expect(request.body).not.toHaveProperty('tools');
      expect(request.body).not.toHaveProperty('tool_choice');
      const requestBytes = JSON.stringify(request.body);
      expect(requestBytes).not.toContain('test-v9-tutor-component-key');
      expect(requestBytes).not.toContain('test-v9-organizer-component-key');
    }
    expect(tutorWire.readSnapshot()).toMatchObject({ state: 'succeeded' });
    expect(organizerWire.readSnapshot()).toMatchObject({ state: 'succeeded' });
    expect(tutorWire.readSnapshot().stages).toHaveLength(8);
    expect(organizerWire.readSnapshot().stages).toHaveLength(8);
  });

  test('dispatches transport, schema and usage failures once without retry or invented usage', async () => {
    const scenarios = [
      {
        name: 'transport',
        response: null,
        wireCategory: 'transport',
        providerResponses: 0,
      },
      {
        name: 'schema',
        response: () => providerResponse({ unexpected: true }, 240, 24),
        wireCategory: 'provider_type_validation',
        providerResponses: 1,
      },
      {
        name: 'usage',
        response: (init: RequestInit) => providerResponse(providerOutput(init), 0, 24),
        wireCategory: 'usage_validation',
        providerResponses: 1,
      },
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      let dispatches = 0;
      const harness = createPhase697TutorOrganizerV9LiveHarness({
        configuration: {
          tutorApiKey: 'test-v9-tutor-component-key',
          organizerApiKey: 'test-v9-organizer-component-key',
        },
        runId: `00000000-0000-4000-8000-00000000096${index}`,
        runScope: 'branch',
        adapterFactory(config, capability) {
          return createFirstPartyDeepSeekV4ProDirectAdapter(config, capability, {
            fetch: async (_url, init) => {
              dispatches += 1;
              if (scenario.response === null) throw new Error('synthetic transport failure');
              return scenario.response(init ?? {});
            },
          });
        },
      });
      const wire = createPhase697V7WireDiagnostics({ appendStage() {} });
      const result = await harness.runTutor(
        firstTutorRuntimeCase(),
        new AbortController().signal,
        wire.capability,
      );

      expect(dispatches, scenario.name).toBe(1);
      expect(result.strictRuntimeSuccess, scenario.name).toBe(false);
      expect(result.runtimeInvocations, scenario.name).toBe(1);
      expect(result.usage, scenario.name).toBeNull();
      expect(result.usageDisposition, scenario.name).toBe('unknown_after_attempt');
      expect(wire.readSnapshot(), scenario.name).toMatchObject({
        state: 'failed',
        failureCategory: scenario.wireCategory,
        counters: {
          executorInvocations: 1,
          providerDispatches: 1,
          providerResponses: scenario.providerResponses,
          verifiedUsages: 0,
        },
      });
    }
  });

  test('labels only the non-injected default adapter as first-party without dispatching it', () => {
    const harness = createPhase697TutorOrganizerV9LiveHarness({
      configuration: {
        tutorApiKey: 'test-v9-tutor-component-key',
        organizerApiKey: 'test-v9-organizer-component-key',
      },
      runId: '00000000-0000-4000-8000-000000000952',
      runScope: 'branch',
    });
    expect(harness).toMatchObject({
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_direct_json',
      executorProvenance: 'first_party_deepseek_v4_pro_direct',
    });
  });
});

function providerOutput(init: RequestInit) {
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  const messages = body.messages as Array<{ role: string; content: string }>;
  const projection = JSON.parse(messages[1]?.content ?? '{}') as Record<string, unknown>;
  return {
    intentIndex: Number(
      (projection.eligibleIntents as Array<{ intentIndex?: unknown }> | undefined)?.[0]
        ?.intentIndex,
    ),
  };
}

function providerResponse(object: unknown, inputTokens: number, outputTokens: number) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(object) } }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        completion_tokens_details: { reasoning_tokens: 0 },
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
