import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_8_TASK9C_QWEN_BASE_URL } from '../src/evals/phase-6-9-8-retriever-final-response-task9-cli-core.ts';
import { createPhase698Task9LiveHarness } from '../src/evals/phase-6-9-8-retriever-final-response-task9-live.ts';
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
