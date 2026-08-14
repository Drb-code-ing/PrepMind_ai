import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_8_TASK9C_QWEN_BASE_URL } from '../src/evals/phase-6-9-8-retriever-final-response-task9-cli-core.ts';
import {
  createPhase698Task9LiveHarness,
  projectPhase698Task9RewriteFailureForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';
import { PHASE_6_9_8_TASK8_MANIFEST } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';

describe('Phase 6.9.8 Task 9B fixed Live harness configuration', () => {
  test('constructs fixed first-party composition and keeps guard execution zero-provider', async () => {
    const harness = createPhase698Task9LiveHarness(validInput());

    expect(harness.transportAuthority).toBe('external_provider');
    const guard = await harness.runGuard(
      PHASE_6_9_8_TASK8_MANIFEST.guardCases[0]!,
      new AbortController().signal,
    );
    expect(guard).toMatchObject({
      zeroCallVerified: true,
      permissionFailure: false,
      crossOwnerFailure: false,
      credentialFailure: false,
      injectionFailure: false,
    });
  });

  test('rejects extra fields, invalid endpoints, and non-canonical credentials before executor use', () => {
    expect(() =>
      createPhase698Task9LiveHarness({ ...validInput(), injectedFetch: () => undefined } as never),
    ).toThrow('PHASE_6_9_8_TASK9_LIVE_CONFIGURATION_INVALID');
    expect(() =>
      createPhase698Task9LiveHarness({
        ...validInput(),
        credentials: { ...validInput().credentials, qwenBaseURL: 'https://example.com' },
      }),
    ).toThrow();
    expect(() =>
      createPhase698Task9LiveHarness({
        ...validInput(),
        credentials: { ...validInput().credentials, qwenApiKey: ' contains space ' },
      }),
    ).toThrow('PHASE_6_9_8_TASK9_LIVE_CONFIGURATION_INVALID');
  });

  test('does not invoke hostile input getters while rejecting the configuration', () => {
    let getterCalls = 0;
    const hostile = {};
    Object.defineProperty(hostile, 'runId', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'hostile';
      },
    });
    Object.defineProperty(hostile, 'credentials', {
      enumerable: true,
      value: validInput().credentials,
    });

    expect(() => createPhase698Task9LiveHarness(hostile as never)).toThrow(
      'PHASE_6_9_8_TASK9_LIVE_CONFIGURATION_INVALID',
    );
    expect(getterCalls).toBe(0);
  });

  test('maps bounded DeepSeek adapter failures without retaining Provider content', () => {
    const cases = [
      ['provider_json_parse', 'provider_json_parse', 'schema_invalid'],
      ['provider_type_validation', 'provider_type_validation', 'schema_invalid'],
      ['provider_object_missing', 'provider_object_missing', 'schema_invalid'],
      ['response_audit', null, 'response_invalid'],
      ['usage_validation', null, 'usage_invalid'],
    ] as const;

    for (const [category, stage, reason] of cases) {
      const failure = projectPhase698Task9RewriteFailureForTest({
        invocations: 1,
        candidateApplied: false,
        provenance: 'deepseek_network',
        attempted: true,
        trace: {
          status: 'failed',
          provider: 'deepseek',
          model: 'deepseek-v4-pro',
        },
        snapshot: {
          version: 'phase-6.9.7-v7-wire-diagnostics-v1',
          state: 'failed',
          stages: [
            'executor_entered',
            'request_validated',
            'provider_dispatch_started',
            'provider_response_received',
          ],
          lastCompletedStage: 'provider_response_received',
          failureCategory: category,
          usageDisposition: category === 'usage_validation' ? 'invalid' : 'not_observed',
          counters: {
            executorInvocations: 1,
            providerDispatches: 1,
            providerResponses: 1,
            verifiedUsages: 0,
          },
        },
      });

      expect(failure).toMatchObject({
        reason,
        diagnostic: {
          adapterFailureCategory: category,
          structuredOutputStage: stage,
          providerWire: { dispatches: 1, responses: 1, verifiedUsage: 0 },
        },
      });
      expect(JSON.stringify(failure)).not.toContain('content');
    }
  });
});

function validInput() {
  return Object.freeze({
    runId: 'task9_live_config_test',
    credentials: Object.freeze({
      rewriteDeepseekApiKey: 'synthetic-rewrite-key',
      finalResponseDeepseekApiKey: 'synthetic-final-key',
      qwenApiKey: 'synthetic-qwen-key',
      qwenBaseURL: PHASE_6_9_8_TASK9C_QWEN_BASE_URL,
    }),
  });
}
