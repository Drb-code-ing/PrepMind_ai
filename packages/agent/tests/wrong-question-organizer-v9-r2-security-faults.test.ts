import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import { estimateCandidateInputTokens } from '../src/model-candidates/model-candidate-policy.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  runWrongQuestionOrganizerV9ModelCandidate,
  type WrongQuestionOrganizerV9ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v9-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA,
  type WrongQuestionOrganizerV9ModelDecision,
} from '../src/model-candidates/wrong-question-organizer-v9-model-contract.ts';
import {
  buildWrongQuestionOrganizerV9PromptParts,
  WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
} from '../src/model-candidates/wrong-question-organizer-v9-model-projection.ts';
import { deriveWrongQuestionOrganizerV9OptionAuthority } from '../src/model-candidates/wrong-question-organizer-v9-option-authority.ts';
import { createWrongQuestionOrganizerV9RuntimeAdapter } from '../src/model-candidates/wrong-question-organizer-v9-runtime-adapter.ts';
import {
  createWrongQuestionOrganizerV9SchemaDiagnosticCollector,
  diagnoseWrongQuestionOrganizerV9Schema,
} from '../src/model-candidates/wrong-question-organizer-v9-schema-diagnostic.ts';
import {
  PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD,
  PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
} from './fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts';

describe('Phase 6.9.7 V9 R2 estimator and adapter identity', () => {
  test('keeps ASCII, CJK, emoji, combining, and 3499/3500/3501 estimates exact', () => {
    const textCases = [
      ['A', 65],
      ['汉', 65],
      ['😀', 66],
      ['e\u0301', 65],
      ['\ud800', 65],
    ] as const;
    for (const [value, expected] of textCases) {
      expect(estimateCandidateInputTokens([value]), value).toBe(expected);
      expect(estimateCandidateInputTokens([value]), value).toBe(
        64 + Math.ceil(Buffer.byteLength(value, 'utf8') / 3),
      );
    }

    for (const boundary of [3_499, 3_500, 3_501]) {
      const value = 'a'.repeat((boundary - 64) * 3);
      expect(estimateCandidateInputTokens([value]), String(boundary)).toBe(boundary);
    }
    expect(estimateCandidateInputTokens(['a'.repeat((3_500 - 64) * 3)])).toBe(
      WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
    );
    expect(estimateCandidateInputTokens(['a'.repeat((3_501 - 64) * 3)])).toBeGreaterThan(
      WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS,
    );
  });

  test('requires candidate and runtime adapter to share exact prompt, schema, and estimate', async () => {
    const authority = optionAuthority();
    const prompt = buildWrongQuestionOrganizerV9PromptParts(authority.projection);
    if (!prompt.ok) throw new Error(prompt.reasonCode);
    const diagnosticCollector = createWrongQuestionOrganizerV9SchemaDiagnosticCollector();
    let calls = 0;
    const inner = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'phase-6-9-7-v9-r2-adapter-identity',
      liveCallsEnabled: false,
      timeoutMs: 500,
      mockResponder: () => PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD,
    });
    const tracked: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        calls += 1;
        return inner.invokeStructured(request);
      },
    };
    const adapter = createWrongQuestionOrganizerV9RuntimeAdapter({
      runtime: tracked,
      projection: authority.projection,
      diagnosticCollector,
    });
    if (adapter === null) throw new Error('V9_R2_RUNTIME_ADAPTER_MISSING');
    expect(authority.estimatedInputTokens).toBe(prompt.value.estimatedInputTokens);
    expect(adapter.estimatedInputTokens).toBe(prompt.value.estimatedInputTokens);

    const request: ModelAgentRequest<WrongQuestionOrganizerV9ModelDecision> = {
      runId: 'phase-6-9-7-v9-r2-adapter-identity',
      task: 'wrong_question_organization',
      schema: diagnosticCollector.schema,
      systemPrompt: prompt.value.parts[0],
      userPrompt: prompt.value.userPrompt,
      estimatedInputTokens: prompt.value.estimatedInputTokens,
      maxOutputTokens: 800,
      budget: candidateBudget(),
    };
    const drifted = [
      { ...request, estimatedInputTokens: request.estimatedInputTokens + 1 },
      { ...request, systemPrompt: request.systemPrompt + ' ' },
      { ...request, userPrompt: request.userPrompt + ' ' },
      { ...request, maxOutputTokens: 799 },
      { ...request, schema: WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA },
    ];
    for (const value of drifted) {
      await expect(
        adapter.runtime.invokeStructured(
          value as ModelAgentRequest<WrongQuestionOrganizerV9ModelDecision>,
        ),
      ).rejects.toThrow('WRONG_QUESTION_ORGANIZER_V9_RUNTIME_ADAPTER_FAILED');
    }
    expect(calls).toBe(0);

    const exact = await adapter.runtime.invokeStructured(request);
    expect(exact.ok).toBe(true);
    expect(calls).toBe(1);
  });

  test('rejects non-JSON and unsafe numeric indexes at the local schema boundary', () => {
    const numericCases = [
      ['questionIndex', Number.NaN, 'question_index'],
      ['questionIndex', Number.POSITIVE_INFINITY, 'question_index'],
      ['questionIndex', Number.NEGATIVE_INFINITY, 'question_index'],
      ['questionIndex', Number.MAX_SAFE_INTEGER + 1, 'question_index'],
      ['optionIndex', Number.NaN, 'option_index'],
      ['optionIndex', Number.POSITIVE_INFINITY, 'option_index'],
      ['optionIndex', Number.NEGATIVE_INFINITY, 'option_index'],
      ['optionIndex', Number.MAX_SAFE_INTEGER + 1, 'option_index'],
    ] as const;

    for (const [field, value, reason] of numericCases) {
      const decision = {
        decisions: [
          {
            questionIndex: 0,
            optionIndex: 0,
            [field]: value,
          },
        ],
      };
      const collector = createWrongQuestionOrganizerV9SchemaDiagnosticCollector();

      expect(
        WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA.safeParse(decision).success,
        `${field}:${String(value)}`,
      ).toBe(false);
      expect(collector.schema.safeParse(decision).success, `${field}:${String(value)}`).toBe(false);
      expect(collector.read()?.reason, `${field}:${String(value)}`).toBe(reason);
      expect(collector.read()?.rawDataRetained, `${field}:${String(value)}`).toBe(false);
    }
  });
});

describe('Phase 6.9.7 V9 R2 prompt safety and hostile values', () => {
  test('scans credential tails, Cf/control, and recursive unknown keys before projection', () => {
    const credentialTail = deriveWrongQuestionOrganizerV5Shortlist({
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
      decks: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.decks.map((deck, index) =>
        index === 0
          ? {
              ...deck,
              name: '看似安全'.repeat(40) + ' sk-' + 'x'.repeat(32),
            }
          : deck,
      ),
    });
    expect(credentialTail).toEqual({ ok: false, reasonCode: 'credential_material' });

    for (const suffix of ['\u2060隐藏', '\u0007隐藏']) {
      const unsafe = deriveWrongQuestionOrganizerV5Shortlist({
        ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
        questions: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.questions.map((question, index) =>
          index === 0 ? { ...question, questionText: question.questionText + suffix } : question,
        ),
      });
      expect(unsafe, JSON.stringify(suffix)).toEqual({
        ok: false,
        reasonCode: 'control_character',
      });
    }

    const recursiveSensitiveKey = deriveWrongQuestionOrganizerV5Shortlist({
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
      questions: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.questions.map((question, index) =>
        index === 0
          ? {
              ...question,
              metadata: { nested: { authorization: 'Bearer private-value' } },
            }
          : question,
      ),
    });
    expect(recursiveSensitiveKey).toEqual({ ok: false, reasonCode: 'invalid_input' });
  });

  test('keeps owner, real IDs, fingerprints, status, timestamps, and authority keys out of prompt', () => {
    const authority = optionAuthority();
    const prompt = buildWrongQuestionOrganizerV9PromptParts(authority.projection);
    if (!prompt.ok) throw new Error(prompt.reasonCode);
    for (const privateValue of [
      PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.ownerDomain,
      PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.ownerSnapshotFingerprint,
      authority.sourceShortlistFingerprint,
      authority.optionSetFingerprint,
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.questions.map((entry) => entry.id),
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.decks.map((entry) => entry.id),
      'nameLocked',
      'ownerDomain',
      'updatedAt',
      'UNRESOLVED',
    ]) {
      expect(prompt.value.userPrompt).not.toContain(privateValue);
    }

    const firstQuestion = authority.projection.questions[0];
    if (!firstQuestion) throw new Error('V9_R2_PROMPT_QUESTION_MISSING');
    const recursiveExtra = {
      ...authority.projection,
      questions: authority.projection.questions.map((question, index) =>
        index === 0
          ? {
              ...question,
              fields: {
                ...firstQuestion.fields,
                authorization: 'Bearer should-never-be-ignored',
              },
            }
          : question,
      ),
    };
    expect(buildWrongQuestionOrganizerV9PromptParts(recursiveExtra)).toEqual({
      ok: false,
      reasonCode: 'candidate_option_authority_invalid',
    });
  });

  test('fails getter, Proxy, symbol, cycle, deep, wide, and node-overflow projections closed', () => {
    const projection = optionAuthority().projection;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, 'version', {
      enumerable: true,
      get() {
        throw new Error('v9-r2-accessor-private');
      },
    });
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('v9-r2-proxy-private');
        },
      },
    );
    const symbolValue = {
      ...projection,
      [Symbol('v9-r2-symbol-private')]: 'hidden',
    };
    const cyclic = { ...projection } as Record<string, unknown>;
    cyclic.self = cyclic;
    let nested: Record<string, unknown> = { leaf: true };
    for (let depth = 0; depth < 10; depth += 1) nested = { nested };
    const deep = { ...projection, extra: nested };
    const wide = {
      ...projection,
      ...Object.fromEntries(
        Array.from({ length: 513 }, (_, index) => ['private-wide-' + index, index]),
      ),
    };
    const nodeOverflow = {
      ...projection,
      extra: Array.from({ length: 256 }, (_, row) =>
        Object.fromEntries(
          Array.from({ length: 20 }, (_, column) => ['private-node-' + row + '-' + column, column]),
        ),
      ),
    };
    for (const value of [accessor, hostileProxy, symbolValue, cyclic, deep, wide, nodeOverflow]) {
      expect(buildWrongQuestionOrganizerV9PromptParts(value)).toEqual({
        ok: false,
        reasonCode: 'candidate_option_authority_invalid',
      });
    }

    for (const value of [accessor, hostileProxy, cyclic, wide]) {
      const diagnostic = diagnoseWrongQuestionOrganizerV9Schema(value);
      expect(diagnostic?.rawDataRetained).toBe(false);
      expect(JSON.stringify(diagnostic)).not.toMatch(/accessor-private|proxy-private|private-wide/);
    }
  });

  test('rejects hostile shortlist roots without invoking accessors or escaping raw values', () => {
    let getterCalls = 0;
    const accessor = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(accessor, 'ownerDomain', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('v9-r2-source-accessor-private');
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('v9-r2-source-proxy-private');
        },
      },
    );
    const cyclic: Record<string, unknown> = {
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
    };
    cyclic.self = cyclic;
    const symbolRoot = {
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
      [Symbol('v9-r2-source-symbol-private')]: true,
    };
    for (const value of [accessor, proxy, cyclic, symbolRoot]) {
      expect(deriveWrongQuestionOrganizerV5Shortlist(value)).toEqual({
        ok: false,
        reasonCode: 'invalid_input',
      });
    }
    expect(getterCalls).toBe(0);
  });
});

describe('Phase 6.9.7 V9 R2 abort and stale fault matrix', () => {
  test('keeps pre-abort and pre-stale fences provider zero-call', async () => {
    let calls = 0;
    const neverRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        calls += 1;
        throw new Error('V9_R2_PRE_FENCE_ZERO_CALL_VIOLATION');
      },
    };
    const controller = new AbortController();
    controller.abort();
    const aborted = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(neverRuntime, { signal: controller.signal }),
    );
    expect(aborted.observation.disposition).toBe('fallback_aborted');

    const staleSource = {
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
      ownerSnapshotFingerprint: 'sha256:' + '0'.repeat(64),
    };
    const stale = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(neverRuntime, { revalidateSource: () => staleSource }),
    );
    expect(stale.observation.disposition).toBe('fallback_invalid_input');
    expect(stale.observation.reasonCodes).toContain('stale_shortlist');
    expect(calls).toBe(0);
  });

  test('propagates in-flight and post-runtime abort with one dispatch and no retry', async () => {
    const inFlightController = new AbortController();
    let inFlightCalls = 0;
    const inFlightRuntime = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'phase-6-9-7-v9-r2-in-flight-abort',
      liveCallsEnabled: false,
      timeoutMs: 500,
      mockResponder: async () => {
        inFlightCalls += 1;
        await Promise.resolve();
        inFlightController.abort();
        return PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD;
      },
    });
    const inFlight = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(inFlightRuntime, { signal: inFlightController.signal }),
    );
    expect(inFlight.observation.attempted).toBe(true);
    expect(inFlight.observation.disposition).toBe('fallback_aborted');
    expect(inFlightCalls).toBe(1);

    const postController = new AbortController();
    let postCalls = 0;
    const inner = createModelAgentRuntime({
      mode: 'mock',
      provider: 'mock',
      model: 'phase-6-9-7-v9-r2-post-runtime-abort',
      liveCallsEnabled: false,
      timeoutMs: 500,
      mockResponder: () => PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD,
    });
    const postRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        postCalls += 1;
        const result = await inner.invokeStructured(request);
        postController.abort();
        return result;
      },
    };
    const post = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(postRuntime, { signal: postController.signal }),
    );
    expect(post.observation.attempted).toBe(true);
    expect(post.observation.disposition).toBe('fallback_aborted');
    expect(postCalls).toBe(1);
  });

  test('detects post-runtime option/locked-name drift after one dispatch with local fallback', async () => {
    const tracked = trackedRuntime(PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD);
    const renamed = {
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
      decks: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.decks.map((deck, index) =>
        index === 0
          ? {
              ...deck,
              name: '并发重命名后的阅读专题',
              nameLocked: !deck.nameLocked,
            }
          : deck,
      ),
    };
    let fences = 0;
    const result = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(tracked.runtime, {
        revalidateSource: () => {
          fences += 1;
          return fences === 1 ? PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE : renamed;
        },
      }),
    );
    expect(tracked.requests).toHaveLength(1);
    expect(fences).toBe(2);
    expect(result.observation.disposition).toBe('fallback_invalid_input');
    expect(result.observation.reasonCodes).toContain('stale_shortlist');
    expect(
      result.result.suggestions.every((entry) => entry.selection.source === 'deterministic'),
    ).toBe(true);
  });
});

function optionAuthority() {
  const shortlist = deriveWrongQuestionOrganizerV5Shortlist(PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE);
  if (!shortlist.ok) throw new Error(shortlist.reasonCode);
  const authority = deriveWrongQuestionOrganizerV9OptionAuthority(shortlist.value);
  if (!authority.ok) throw new Error(authority.reasonCode);
  return authority.value;
}

function candidateBudget() {
  return createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 3_500,
    maxOutputTokens: 800,
  });
}

function candidateInput(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Readonly<{
    signal?: AbortSignal;
    revalidateSource?: () => unknown;
  }> = {},
): WrongQuestionOrganizerV9ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-v9-r2-fault-matrix',
    shortlistSource: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE as WrongQuestionOrganizerV5ShortlistSource,
    runtime,
    budget: candidateBudget(),
    revalidateSource: overrides.revalidateSource ?? (() => PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v9-r2-zero-provider',
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => output,
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return { requests, runtime };
}
