import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';
import * as TutorSchemaRecoveryPublic from '@repo/agent/tutor-schema-recovery';

import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION,
  runTutorSchemaRecoveryModelCandidate,
  type TutorSchemaRecoveryModelCandidateInput,
} from '../src/model-candidates/tutor-schema-recovery-model-candidate.ts';
import { projectTutorV6ModelInput } from '../src/model-candidates/tutor-v6-model-projection.ts';

const CONFIG = Object.freeze({
  provider: 'deepseek' as const,
  apiKey: 'sr1-synthetic-key-never-network',
  baseURL: 'https://api.deepseek.com/v1',
  model: 'deepseek-v4-pro',
});

describe('Phase 6.9.7 Tutor Schema Recovery SR1 candidate seam', () => {
  test('exposes an independent candidate and preserves local intent/depth authority', async () => {
    expect(TUTOR_SCHEMA_RECOVERY_CANDIDATE_VERSION).toBe(
      'phase-6.9.7-tutor-schema-recovery-candidate-v1',
    );
    expect(TutorSchemaRecoveryPublic.runTutorSchemaRecoveryModelCandidate).toBe(
      runTutorSchemaRecoveryModelCandidate,
    );
    const latestUserText = '我写到 x=2 这一步了，想确认推导是否正确。';
    const projected = projectTutorV6ModelInput({
      latestUserText,
      safety: { latestUserText: 'safe_for_model' },
    });
    if (!projected.ok) throw new Error(projected.reasonCode);
    const selected = projected.value.preferredDepthAuthority.choices[0]!;
    const tracked = syntheticDirectRuntime(`{"intentIndex":0}`);

    const result = await runTutorSchemaRecoveryModelCandidate(
      candidateInput(latestUserText, tracked.runtime),
    );

    expect(tracked.fetchCalls()).toBe(1);
    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.schemaDiagnostic).toBeNull();
    expect(result.result.intent).toBe(selected.intent);
    expect(result.result.depth).toBe(selected.preferredDepth);
    expect(result.result.shouldGiveFinalAnswer).toBe(selected.shouldGiveFinalAnswer);
    expect(result.result.answerStructure).toEqual(selected.answerStructure);
    expect(JSON.stringify(result.result)).not.toContain('intentIndex');
    expect(tracked.stages()).toEqual([
      'executor_entered',
      'request_validated',
      'provider_dispatch_started',
      'provider_response_received',
      'response_audit_passed',
      'content_parsed',
      'schema_validated',
      'usage_validated',
    ]);
  });

  test('discards bounded extensions, records a no-raw diagnostic, and still uses local merger', async () => {
    const rawSentinel = 'provider-explanation-must-not-escape';
    const tracked = syntheticDirectRuntime(
      `{"intentIndex":0,"explanation":"${rawSentinel}","depth":"deep"}`,
    );
    const result = await runTutorSchemaRecoveryModelCandidate(
      candidateInput('我写了一步但不确定哪里错了，帮我检查一下。', tracked.runtime),
    );

    expect(tracked.fetchCalls()).toBe(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.schemaDiagnostic).toMatchObject({
      stage: 'applied',
      reasonCode: 'extension_fields_discarded',
      projectionDisposition: 'extensions_discarded',
      extraFieldCountBucket: '2_4',
      rawDataRetained: false,
    });
    expect(JSON.stringify(result)).not.toContain(rawSentinel);
    expect(JSON.stringify(result)).not.toContain('explanation');
    expect(result.result.depth).not.toBe('deep');
  });

  test('fails malformed, duplicate, alias, type, and range outputs after one dispatch with no retry', async () => {
    const cases = [
      ['not-json', 'malformed_json', 'provider_json_parse'],
      ['{"intentIndex":0,"intentIndex":1}', 'duplicate_key', 'provider_json_parse'],
      ['{"intent_index":0}', 'selection_ambiguous', 'provider_type_validation'],
      ['{"intentIndex":"0"}', 'intent_index_type', 'provider_type_validation'],
      ['{"intentIndex":9}', 'intent_index_out_of_range', 'provider_type_validation'],
    ] as const;
    for (const [content, reasonCode, structuredOutputStage] of cases) {
      const tracked = syntheticDirectRuntime(content);
      const result = await runTutorSchemaRecoveryModelCandidate(
        candidateInput('我写了一步但不确定哪里错了，帮我检查一下。', tracked.runtime),
      );
      expect(tracked.fetchCalls(), content).toBe(1);
      expect(tracked.requests, content).toHaveLength(1);
      expect(result.observation.disposition, content).toBe('fallback_runtime_error');
      expect(result.observation.trace?.structuredOutputStage, content).toBe(structuredOutputStage);
      expect(result.schemaDiagnostic?.reasonCode, content).toBe(reasonCode);
      expect(result.schemaDiagnostic?.rawDataRetained, content).toBe(false);
    }
  });

  test('keeps route, explicit local instruction, abort, and budget guards at zero dispatch', async () => {
    const cases: readonly TutorSchemaRecoveryModelCandidateInput[] = [
      candidateInput('我有点卡住了，给我一点方向。', neverRuntime(), { finalRoute: 'chat' }),
      candidateInput('直接给我答案。', neverRuntime()),
      candidateInput('我有点卡住了，给我一点方向。', neverRuntime(), {
        signal: AbortSignal.abort(),
      }),
      candidateInput('我有点卡住了，给我一点方向。', neverRuntime(), {
        budget: Object.freeze({
          maxCalls: 1,
          usedCalls: 1,
          maxInputTokens: 1_200,
          usedInputTokens: 1,
          maxOutputTokens: 300,
          usedOutputTokens: 1,
        }),
      }),
    ];
    for (const input of cases) {
      const result = await runTutorSchemaRecoveryModelCandidate(input);
      expect(result.observation.attempted).toBe(false);
      expect(result.schemaDiagnostic).toBeNull();
    }
  });

  test('keeps usage failure and external abort fail-closed after one call', async () => {
    const missingUsage = syntheticDirectRuntime('{"intentIndex":0}', { includeUsage: false });
    const usageResult = await runTutorSchemaRecoveryModelCandidate(
      candidateInput('我写了一步但不确定哪里错了，帮我检查一下。', missingUsage.runtime),
    );
    expect(missingUsage.fetchCalls()).toBe(1);
    expect(usageResult.observation.disposition).toBe('fallback_runtime_error');
    expect(usageResult.schemaDiagnostic).toBeNull();

    const controller = new AbortController();
    const aborted = syntheticDirectRuntime('{"intentIndex":0}', {
      afterResponse: () => controller.abort('sr1-post-response'),
    });
    const abortResult = await runTutorSchemaRecoveryModelCandidate(
      candidateInput('我写了一步但不确定哪里错了，帮我检查一下。', aborted.runtime, {
        signal: controller.signal,
      }),
    );
    expect(aborted.fetchCalls()).toBe(1);
    expect(abortResult.observation.disposition).toBe('fallback_aborted');
  });

  test('does not expose oracle fields or permit a second runtime dispatch', async () => {
    let calls = 0;
    const inner = syntheticDirectRuntime('{"intentIndex":0}');
    const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        calls += 1;
        if (calls > 1) throw new Error('second dispatch forbidden');
        return inner.runtime.invokeStructured(request);
      },
    };
    const result = await runTutorSchemaRecoveryModelCandidate(
      candidateInput('我写了一步但不确定哪里错了，帮我检查一下。', runtime),
    );
    expect(calls).toBe(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    const requestBytes = inner.requestBytes();
    for (const forbidden of [
      'expected',
      'oracle',
      'pairedRunIndex',
      'tutor-v2-runtime-11',
      'schema-recovery-result',
    ]) {
      expect(requestBytes).not.toContain(forbidden);
    }
  });
});

function candidateInput(
  latestUserText: string,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<
    Pick<TutorSchemaRecoveryModelCandidateInput, 'finalRoute' | 'budget' | 'signal'>
  > = {},
): TutorSchemaRecoveryModelCandidateInput {
  return {
    runId: 'phase-6-9-7-schema-recovery-sr1-zero-provider',
    finalRoute: overrides.finalRoute ?? 'tutor',
    latestUserText,
    deterministic: buildTutorStrategy({ latestUserText }),
    safety: { latestUserText: 'safe_for_model' },
    runtime,
    budget:
      overrides.budget ??
      createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 }),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

function syntheticDirectRuntime(
  content: string,
  options: Readonly<{
    includeUsage?: boolean;
    afterResponse?: () => void;
  }> = {},
) {
  let fetchCalls = 0;
  let requestBytes = '';
  const stages: string[] = [];
  const requests: ModelAgentRequest<unknown>[] = [];
  const diagnostics = createPhase697V7WireDiagnostics({
    appendStage(stage) {
      stages.push(stage);
    },
  });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(CONFIG, diagnostics.capability, {
    fetch: async (_url, init) => {
      fetchCalls += 1;
      requestBytes = String(init?.body ?? '');
      const response = new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
          ...(options.includeUsage === false
            ? {}
            : {
                usage: {
                  prompt_tokens: 64,
                  completion_tokens: 16,
                  completion_tokens_details: { reasoning_tokens: 0 },
                },
              }),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
      options.afterResponse?.();
      return response;
    },
  });
  const inner = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 500,
    executor: adapter.executor,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return {
    runtime,
    requests,
    fetchCalls: () => fetchCalls,
    requestBytes: () => requestBytes,
    stages: () => [...stages],
  };
}

function neverRuntime(): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured() {
      throw new Error('zero-dispatch guard violated');
    },
  };
}
