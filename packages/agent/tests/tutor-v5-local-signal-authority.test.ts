import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import * as TutorV5Public from '@repo/agent/tutor-v5';

import { phase697V2TutorCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  mergeTutorV5ModelDecision,
  runTutorV5ModelCandidate,
  type TutorV5ModelCandidateInput,
} from '../src/model-candidates/tutor-v5-model-candidate.ts';
import {
  TUTOR_V5_FROZEN_MODEL_PROMPT_CONTENT_SHA256,
  TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256,
  validateTutorV5ModelDecision,
  type TutorV5ModelDecision,
} from '../src/model-candidates/tutor-v5-model-contract.ts';
import { projectTutorV5ModelInput } from '../src/model-candidates/tutor-v5-model-projection.ts';
import {
  TUTOR_V5_FROZEN_LOCAL_SIGNAL_RULES_SHA256,
  TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
  TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
  deriveTutorV5LocalSignalAuthority,
  validateTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
} from '../src/model-candidates/tutor-v5-local-signal-authority.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  PHASE_6_9_7_TUTOR_V5_FROZEN_LOCAL_SIGNAL_FIXTURE_SHA256,
  PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES,
  PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA256,
  PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_VERSION,
  computeFixtureSha256,
  type TutorV5LocalSignalFixture,
} from './fixtures/phase-6-9-tutor-v5-local-signal-authority-v1.ts';

function candidateBudget(): ModelAgentRunBudget {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 });
}

function exhaustedBudget(): ModelAgentRunBudget {
  return Object.freeze({
    maxCalls: 1,
    usedCalls: 1,
    maxInputTokens: 1_200,
    usedInputTokens: 1,
    maxOutputTokens: 300,
    usedOutputTokens: 1,
  });
}

function authorityFor(fixture: TutorV5LocalSignalFixture) {
  const result = deriveTutorV5LocalSignalAuthority({
    latestUserText: fixture.latestUserText,
    ...(fixture.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: fixture.activeStudyContext }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(fixture.activeStudyContext === undefined ? {} : { activeStudyContext: 'safe_for_model' }),
    },
  });
  if (!result.ok) throw new Error(`${fixture.id}: ${result.reasonCode}`);
  return result.value;
}

function decisionFor(authority: TutorV5LocalSignalAuthority): TutorV5ModelDecision {
  const choice = authority.eligibleChoices[0];
  if (choice === undefined) throw new Error('fixture is not model eligible');
  return {
    intent: choice.intent,
    depth: choice.depths.includes('standard') ? 'standard' : choice.depths[0]!,
    confidence: authority.confidence,
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-tutor-v5-r2-no-network',
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

function candidateInput(
  fixture: TutorV5LocalSignalFixture,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<
    Pick<TutorV5ModelCandidateInput, 'finalRoute' | 'safety' | 'budget' | 'signal'>
  > = {},
): TutorV5ModelCandidateInput {
  const deterministic = buildTutorStrategy({
    latestUserText: fixture.latestUserText,
    ...(fixture.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: fixture.activeStudyContext }),
  });
  return {
    runId: `phase-6-9-7-v5-r2-${fixture.id}`,
    finalRoute: overrides.finalRoute ?? 'tutor',
    latestUserText: fixture.latestUserText,
    ...(fixture.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: fixture.activeStudyContext }),
    deterministic,
    safety:
      overrides.safety ??
      ({
        latestUserText: 'safe_for_model',
        ...(fixture.activeStudyContext === undefined
          ? {}
          : { activeStudyContext: 'safe_for_model' }),
      } as const),
    runtime,
    budget: overrides.budget ?? candidateBudget(),
    ...(overrides.signal === undefined ? {} : { signal: overrides.signal }),
  };
}

describe('Phase 6.9.7 V5 R2 Tutor local signal authority', () => {
  test('freezes independent held-out fixtures, rules, prompt, and public export identities', () => {
    expect(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_VERSION).toBe(
      'phase-6.9.7-tutor-v5-local-signal-held-out-v1',
    );
    expect(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES).toHaveLength(32);
    expect(computeFixtureSha256(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES)).toBe(
      PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA256,
    );
    expect(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURE_SHA256).toBe(
      PHASE_6_9_7_TUTOR_V5_FROZEN_LOCAL_SIGNAL_FIXTURE_SHA256,
    );
    expect(TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256).toBe(TUTOR_V5_FROZEN_LOCAL_SIGNAL_RULES_SHA256);
    expect(TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256).toBe(TUTOR_V5_FROZEN_MODEL_PROMPT_CONTENT_SHA256);
    expect(TUTOR_V5_LOCAL_INTENT_PRECEDENCE).toEqual([
      'step_check',
      'explain_solution',
      'concept_bridge',
      'socratic_hint',
      'general_follow_up',
    ]);
    expect(Object.isFrozen(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES)).toBe(true);
    expect(countBy(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES, 'category')).toEqual({
      conflict: 4,
      context: 5,
      negative: 5,
      positive: 15,
      quoted_distractor: 3,
    });
    expect(countBy(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES, 'language')).toEqual({
      en: 12,
      mixed: 7,
      zh: 13,
    });
    for (const fixture of PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES) {
      expect(Object.isFrozen(fixture), fixture.id).toBe(true);
      expect(Object.isFrozen(fixture.expected), fixture.id).toBe(true);
      expect(Object.isFrozen(fixture.expected.detectedIntents), fixture.id).toBe(true);
    }
    const v2Ids = new Set(phase697V2TutorCases.map((entry) => entry.id));
    expect(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.every((entry) => !v2Ids.has(entry.id))).toBe(
      true,
    );
    expect(TutorV5Public.TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION).toBe(
      TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION,
    );
    expect(TutorV5Public.runTutorV5ModelCandidate).toBe(runTutorV5ModelCandidate);
  });

  test('matches all 32 held-out multilingual, negative, quoted, context, and precedence oracles', () => {
    for (const fixture of PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES) {
      const authority = authorityFor(fixture);
      expect(authority.reasonCode, fixture.id).toBe(fixture.expected.reasonCode);
      expect(authority.primaryIntent, fixture.id).toBe(fixture.expected.primaryIntent);
      expect(
        authority.detectedSignals.map((entry) => entry.intent),
        fixture.id,
      ).toEqual(fixture.expected.detectedIntents);
      expect(
        authority.eligibleChoices.map((entry) => entry.intent),
        fixture.id,
      ).toEqual(fixture.expected.eligibleIntents);
      expect(authority.negatedSignalIds, fixture.id).toEqual(
        fixture.expected.negatedSignalIds ?? [],
      );
      expect(authority.version).toBe(TUTOR_V5_LOCAL_SIGNAL_AUTHORITY_VERSION);
      expect(authority.rulesSha256).toBe(TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256);
      expect(authority.provenance).toEqual({
        detector: 'local_deterministic',
        intentInput: 'latest_text_only',
        contextEffect: 'availability_only',
      });
      expect(Object.isFrozen(authority), fixture.id).toBe(true);
      expect(Object.isFrozen(authority.eligibleChoices), fixture.id).toBe(true);
      expect(Object.isFrozen(authority.detectedSignals), fixture.id).toBe(true);
    }
  });

  test('matches the frozen V2 Tutor runtime intent for all 24 cases without reading expected labels', () => {
    const runtimeCases = phase697V2TutorCases.filter((entry) => entry.subset === 'runtime');
    expect(runtimeCases).toHaveLength(24);
    for (const runtimeCase of runtimeCases) {
      const result = deriveTutorV5LocalSignalAuthority({
        latestUserText: runtimeCase.input.latestUserText,
        activeStudyContext: runtimeCase.input.activeStudyContext,
        safety: {
          latestUserText: 'safe_for_model',
          activeStudyContext: 'safe_for_model',
        },
      });
      if (!result.ok) throw new Error(`${runtimeCase.id}: ${result.reasonCode}`);
      expect(
        result.value.primaryIntent ?? result.value.eligibleChoices[0]?.intent,
        runtimeCase.id,
      ).toBe(runtimeCase.expected.intent);
    }
  });

  test('keeps every context fixture bounded across reorder, delete, noise, and one-variable mutations', () => {
    const contextFixtures = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.filter(
      (fixture) => fixture.category === 'context',
    );
    expect(contextFixtures).toHaveLength(5);
    for (const fixture of contextFixtures) {
      const base = fixture.activeStudyContext ?? 'Synthetic premise A. Synthetic conclusion B.';
      const contexts = [
        undefined,
        '',
        base,
        `${base
          .split(/[。.!]/u)
          .filter(Boolean)
          .reverse()
          .join('。')}。`,
        `Unrelated safe note. ${base}`,
        base.replace(/函数|derivative|premise/iu, 'single-variable-mutation'),
      ] as const;
      const authorities = contexts.map((activeStudyContext) =>
        deriveAuthority(fixture.latestUserText, activeStudyContext),
      );
      const latestCarriesContextReference =
        fixture.id !== 'tutor-v5-held-out-context-cannot-create-intent';
      for (const [index, authority] of authorities.entries()) {
        const active = Boolean(contexts[index]);
        expect(authority.detectedSignals, `${fixture.id}:${index}`).toEqual([]);
        expect(authority.primaryIntent, `${fixture.id}:${index}`).toBeNull();
        expect(authority.input.activeContextAvailable, `${fixture.id}:${index}`).toBe(active);
        expect(authority.reasonCode, `${fixture.id}:${index}`).toBe(
          active && latestCarriesContextReference ? 'contextual_follow_up' : 'no_model_signal',
        );
        expect(
          authority.eligibleChoices.map((choice) => choice.intent),
          `${fixture.id}:${index}`,
        ).toEqual(active && latestCarriesContextReference ? ['general_follow_up'] : []);
      }
      expect(new Set(authorities.slice(2).map((entry) => entry.authoritySha256)).size).toBe(1);
    }

    const conceptContexts = [
      undefined,
      '',
      'Synthetic premise A. Synthetic conclusion B.',
      'Synthetic conclusion B. Unrelated note. Synthetic premise A.',
    ] as const;
    for (const context of conceptContexts) {
      const authority = deriveAuthority('The relationship is unclear.', context);
      expect(authority.primaryIntent).toBe('concept_bridge');
      expect(authority.detectedSignals.map((signal) => signal.intent)).toEqual(['concept_bridge']);
      expect(authority.eligibleChoices.map((choice) => choice.intent)).toEqual(['concept_bridge']);
    }
  });

  test('rejects forged authority semantics even when an attacker recomputes its content hash', () => {
    const base = authorityFor(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!);
    const invalid = [
      { ...base, extra: 'forbidden' },
      rehashAuthority({
        ...base,
        detectedSignals: [
          {
            intent: 'step_check',
            evidenceCode: 'concept_gap',
            signalIds: ['step_zh_submission'],
          },
        ],
      }),
      rehashAuthority({
        ...base,
        primaryIntent: 'step_check',
        eligibleChoices: [{ intent: 'general_follow_up', depths: ['brief', 'standard'] }],
      }),
      rehashAuthority({
        ...base,
        confidence: 'medium',
      }),
      rehashAuthority({
        ...base,
        negatedSignalIds: ['unknown_signal_id'],
      }),
    ];
    for (const authority of invalid) {
      expect(validateTutorV5LocalSignalAuthority(authority)).toEqual({
        ok: false,
        reasonCode: 'authority_contract_invalid',
      });
    }
  });

  test('strictly validates model-only intent, depth, and confidence choices', () => {
    const single = authorityFor(PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!);
    const conflict = authorityFor(
      PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.find(
        (entry) => entry.id === 'tutor-v5-held-out-conflict-step-explain',
      )!,
    );
    expect(
      validateTutorV5ModelDecision({ authority: single, decision: decisionFor(single) }).ok,
    ).toBe(true);
    const invalid = [
      { intent: 'step_check', depth: 'standard', confidence: 'high', evidenceCodes: [] },
      { intent: 'step_check', depth: 'standard', confidence: 'high', extra: true },
      { intent: 'answer_direct', depth: 'standard', confidence: 'high' },
      { intent: 'step_check', depth: 'deep', confidence: 'high' },
      { intent: 'general_follow_up', depth: 'standard', confidence: 'high' },
    ];
    for (const decision of invalid) {
      expect(validateTutorV5ModelDecision({ authority: single, decision }).ok).toBe(false);
    }
    expect(
      validateTutorV5ModelDecision({
        authority: conflict,
        decision: { intent: 'step_check', depth: 'standard', confidence: 'high' },
      }),
    ).toEqual({ ok: false, reasonCode: 'confidence_not_supported' });
    expect(
      validateTutorV5ModelDecision({
        authority: conflict,
        decision: { intent: 'explain_solution', depth: 'standard', confidence: 'medium' },
      }),
    ).toEqual({ ok: false, reasonCode: 'primary_intent_downgrade' });
  });

  test('runs exactly once for every eligible held-out case and applies only locally authorized output', async () => {
    const eligible = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.filter(
      (fixture) => fixture.expected.eligibleIntents.length > 0,
    );
    for (const fixture of eligible) {
      const authority = authorityFor(fixture);
      const decision = decisionFor(authority);
      const { requests, runtime } = trackedRuntime(decision);
      const result = await runTutorV5ModelCandidate(candidateInput(fixture, runtime));
      expect(requests, fixture.id).toHaveLength(1);
      expect(result.observation.disposition, fixture.id).toBe('candidate_applied');
      expect(result.result.intent, fixture.id).toBe(decision.intent);
      expect(result.result.depth, fixture.id).toBe(decision.depth);
      expect(result.result.intent, fixture.id).not.toBe('answer_direct');
      if (result.result.intent === 'socratic_hint') {
        expect(result.result.shouldGiveFinalAnswer, fixture.id).toBe(false);
        expect(result.result.answerStructure, fixture.id).not.toContain('final_answer');
      }
    }
  });

  test('keeps route, abort, safety, explicit instructions, no-signal, and budget guards at zero calls', async () => {
    const eligible = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!;
    const direct = fixtureById('tutor-v5-held-out-answer-local');
    const explicit = fixtureById('tutor-v5-held-out-explicit-hint-local');
    const noSignal = fixtureById('tutor-v5-held-out-follow-up-without-context');
    const abortedController = new AbortController();
    abortedController.abort('test-abort');
    const scenarios = [
      {
        fixture: eligible,
        overrides: { finalRoute: 'chat' as const },
        disposition: 'not_eligible',
      },
      {
        fixture: eligible,
        overrides: { signal: abortedController.signal },
        disposition: 'fallback_aborted',
      },
      {
        fixture: eligible,
        overrides: { safety: { latestUserText: 'unknown' as const } },
        disposition: 'safety_blocked',
      },
      {
        fixture: eligible,
        overrides: { budget: exhaustedBudget() },
        disposition: 'fallback_budget_exceeded',
      },
      { fixture: direct, overrides: {}, disposition: 'not_eligible' },
      { fixture: explicit, overrides: {}, disposition: 'not_eligible' },
      { fixture: noSignal, overrides: {}, disposition: 'not_eligible' },
    ] as const;
    for (const scenario of scenarios) {
      const tracked = trackedRuntime({
        intent: 'step_check',
        depth: 'standard',
        confidence: 'high',
      });
      const result = await runTutorV5ModelCandidate(
        candidateInput(scenario.fixture, tracked.runtime, scenario.overrides),
      );
      expect(tracked.requests, scenario.fixture.id).toHaveLength(0);
      expect(result.observation.disposition, scenario.fixture.id).toBe(scenario.disposition);
      expect(result.observation.attempted, scenario.fixture.id).toBe(false);
    }
  });

  test('fails closed after one runtime call for schema, usage, throw, and post-call abort failures', async () => {
    const fixture = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!;
    const invalidSchema = trackedRuntime({
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['submitted_step'],
    });
    const schemaResult = await runTutorV5ModelCandidate(
      candidateInput(fixture, invalidSchema.runtime),
    );
    expect(invalidSchema.requests).toHaveLength(1);
    expect(schemaResult.observation.disposition).toBe('fallback_schema_invalid');

    let usageCalls = 0;
    const usageUnavailableRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>() {
        usageCalls += 1;
        return {
          ok: true,
          data: { intent: 'step_check', depth: 'standard', confidence: 'high' },
          budget: exhaustedBudget(),
          usage: null,
          trace: null,
        } as Awaited<ReturnType<ModelAgentRuntime['invokeStructured']>>;
      },
    };
    const usageResult = await runTutorV5ModelCandidate(
      candidateInput(fixture, usageUnavailableRuntime),
    );
    expect(usageCalls).toBe(1);
    expect(usageResult.observation.disposition).toBe('fallback_runtime_error');
    expect(usageResult.observation.attempted).toBe(true);
    expect('usageUnavailable' in usageResult.observation).toBe(true);

    let throwCalls = 0;
    const throwingRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        throwCalls += 1;
        throw new Error('synthetic no-network failure');
      },
    };
    const thrown = await runTutorV5ModelCandidate(candidateInput(fixture, throwingRuntime));
    expect(throwCalls).toBe(1);
    expect(thrown.observation.disposition).toBe('fallback_runtime_error');

    const controller = new AbortController();
    let abortCalls = 0;
    const abortingInner = trackedRuntime({
      intent: 'step_check',
      depth: 'standard',
      confidence: 'high',
    });
    const abortingRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        abortCalls += 1;
        const result = await abortingInner.runtime.invokeStructured(request);
        controller.abort('after-call');
        return result;
      },
    };
    const aborted = await runTutorV5ModelCandidate(
      candidateInput(fixture, abortingRuntime, { signal: controller.signal }),
    );
    expect(abortCalls).toBe(1);
    expect(aborted.observation.disposition).toBe('fallback_aborted');
  });

  test('is deterministic across repeated no-network runs with a fixed runtime observation', async () => {
    const fixture = fixtureById('tutor-v5-held-out-conflict-step-explain');
    const decision = decisionFor(authorityFor(fixture));
    const firstRuntime = fixedRuntime(decision);
    const secondRuntime = fixedRuntime(decision);
    const first = await runTutorV5ModelCandidate(candidateInput(fixture, firstRuntime.runtime));
    const second = await runTutorV5ModelCandidate(candidateInput(fixture, secondRuntime.runtime));
    expect(firstRuntime.calls()).toBe(1);
    expect(secondRuntime.calls()).toBe(1);
    expect(second).toEqual(first);
  });

  test('keeps projection and actual prompts free of V2 oracle fields, case ids, and V1-V4 identities', async () => {
    const fixture = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!;
    const authority = authorityFor(fixture);
    const projection = projectTutorV5ModelInput({
      latestUserText: fixture.latestUserText,
      deterministicIntent: buildTutorStrategy({ latestUserText: fixture.latestUserText }).intent,
      deterministicDepth: buildTutorStrategy({ latestUserText: fixture.latestUserText }).depth,
      safety: { latestUserText: 'safe_for_model' },
    });
    if (!projection.ok) throw new Error(projection.reasonCode);
    expect(Object.keys(projection.value)).toEqual([
      'version',
      'latestText',
      'activeContext',
      'localAuthority',
    ]);
    const tracked = trackedRuntime(decisionFor(authority));
    await runTutorV5ModelCandidate(candidateInput(fixture, tracked.runtime));
    const request = tracked.requests[0];
    if (request === undefined) throw new Error('expected captured Tutor V5 request');
    const bytes = `${request.systemPrompt}\n${request.userPrompt}`;
    const forbidden = [
      'phase-6.9-tutor-wrong-question-v2',
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      'expected',
      'oracle',
      'acceptedTopicLabels',
      'tutor-model-candidate-v1',
      'tutor-model-candidate-v2',
      'tutor-model-candidate-v3',
      'tutor-model-candidate-v4',
      ...phase697V2TutorCases.map((entry) => entry.id),
      ...PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.map((entry) => entry.id),
    ];
    expect(forbidden.filter((token) => bytes.includes(token))).toEqual([]);
    expect(request.task).toBe('tutor_strategy');
    expect(request.maxOutputTokens).toBe(300);
  });

  test('merger rejects authority/context drift and never mutates input objects', () => {
    const fixture = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES[0]!;
    const authority = authorityFor(fixture);
    const deterministic = buildTutorStrategy({ latestUserText: fixture.latestUserText });
    const bytes = JSON.stringify({ authority, deterministic });
    expect(
      mergeTutorV5ModelDecision({
        authority,
        deterministic,
        decision: decisionFor(authority),
      }),
    ).not.toBeNull();
    expect(JSON.stringify({ authority, deterministic })).toBe(bytes);
    const drifted = rehashAuthority({
      ...authority,
      input: { ...authority.input, activeContextAvailable: true },
    });
    expect(
      mergeTutorV5ModelDecision({
        authority: drifted as TutorV5LocalSignalAuthority,
        deterministic,
        decision: decisionFor(authority),
      }),
    ).toBeNull();
  });
});

function fixtureById(id: TutorV5LocalSignalFixture['id']) {
  const fixture = PHASE_6_9_7_TUTOR_V5_LOCAL_SIGNAL_FIXTURES.find((entry) => entry.id === id);
  if (fixture === undefined) throw new Error(`missing fixture ${id}`);
  return fixture;
}

function deriveAuthority(latestUserText: string, activeStudyContext: string | undefined) {
  const result = deriveTutorV5LocalSignalAuthority({
    latestUserText,
    ...(activeStudyContext === undefined ? {} : { activeStudyContext }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(activeStudyContext === undefined ? {} : { activeStudyContext: 'safe_for_model' }),
    },
  });
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function fixedRuntime(output: TutorV5ModelDecision) {
  let invocationCount = 0;
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      invocationCount += 1;
      const budget = {
        maxCalls: request.budget.maxCalls,
        usedCalls: request.budget.usedCalls + 1,
        maxInputTokens: request.budget.maxInputTokens,
        usedInputTokens: request.budget.usedInputTokens + request.estimatedInputTokens,
        maxOutputTokens: request.budget.maxOutputTokens,
        usedOutputTokens: request.budget.usedOutputTokens + request.maxOutputTokens,
      };
      return {
        ok: true,
        data: output as T,
        budget,
        usage: { inputTokens: request.estimatedInputTokens, outputTokens: 0 },
        trace: {
          runIdHash: `sha256:${createHash('sha256').update(request.runId).digest('hex')}`,
          task: request.task,
          mode: 'mock',
          provider: 'mock',
          model: 'phase-6-9-7-tutor-v5-r2-fixed',
          status: 'succeeded',
          inputTokens: request.estimatedInputTokens,
          outputTokens: 0,
          maxOutputTokens: request.maxOutputTokens,
          durationMs: 7,
          degraded: false,
        },
      } as Awaited<ReturnType<ModelAgentRuntime['invokeStructured']>>;
    },
  };
  return { runtime, calls: () => invocationCount };
}

function countBy<T extends Readonly<Record<K, PropertyKey>>, K extends keyof T>(
  values: readonly T[],
  key: K,
) {
  const counts: Record<PropertyKey, number> = {};
  for (const value of values) counts[value[key]] = (counts[value[key]] ?? 0) + 1;
  return counts;
}

function rehashAuthority(input: Record<string, unknown>) {
  const { authoritySha256: _ignored, ...withoutHash } = input;
  return {
    ...withoutHash,
    authoritySha256: createHash('sha256')
      .update(JSON.stringify(sortObjectKeys(withoutHash)), 'utf8')
      .digest('hex'),
  };
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
