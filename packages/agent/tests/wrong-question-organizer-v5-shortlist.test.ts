import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import * as OrganizerV5Public from '@repo/agent/wrong-question-organizer-v5';

import { phase697V2OrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  mergeWrongQuestionOrganizerV5ModelDecision,
  runWrongQuestionOrganizerV5ModelCandidate,
  type WrongQuestionOrganizerV5ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v5-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_SHA256,
  validateWrongQuestionOrganizerV5ModelDecision,
  type WrongQuestionOrganizerV5ModelDecision,
} from '../src/model-candidates/wrong-question-organizer-v5-model-contract.ts';
import { projectWrongQuestionOrganizerV5ModelInput } from '../src/model-candidates/wrong-question-organizer-v5-model-projection.ts';
import {
  WRONG_QUESTION_ORGANIZER_V5_FROZEN_SHORTLIST_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
  deriveWrongQuestionOrganizerV5Shortlist,
  validateWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistSource,
  type WrongQuestionOrganizerV5Subject,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  PHASE_6_9_7_ORGANIZER_V5_FROZEN_SHORTLIST_FIXTURE_SHA256,
  PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES,
  PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA256,
  PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_VERSION,
  computeOrganizerV5ShortlistFixtureSha256,
  type OrganizerV5ShortlistFixture,
} from './fixtures/phase-6-9-wrong-question-organizer-v5-shortlist-v1.ts';

function candidateBudget(): ModelAgentRunBudget {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 });
}

function exhaustedBudget(): ModelAgentRunBudget {
  return Object.freeze({
    maxCalls: 1,
    usedCalls: 1,
    maxInputTokens: 3_500,
    usedInputTokens: 1,
    maxOutputTokens: 800,
    usedOutputTokens: 1,
  });
}

function authorityFor(source: WrongQuestionOrganizerV5ShortlistSource) {
  const result = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function decisionFor(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  expected?: OrganizerV5ShortlistFixture['expected'],
): WrongQuestionOrganizerV5ModelDecision {
  const expectedByQuestion = new Map(expected?.map((entry) => [entry.questionId, entry]));
  return {
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: authority.questions.map((question) => {
      const oracle = expectedByQuestion.get(question.questionId);
      const subject =
        oracle?.subject ?? question.structuredSubject ?? question.subjectCandidates[0]!;
      const subjectIndex = question.subjectCandidates.indexOf(subject);
      const deck = oracle?.deckName
        ? authority.decks.find(
            (candidate) => candidate.subject === subject && candidate.name === oracle.deckName,
          )
        : undefined;
      const topic = oracle?.topicLabel
        ? question.topicCandidates.find(
            (candidate) => candidate.subject === subject && candidate.label === oracle.topicLabel,
          )
        : question.topicCandidates.find((candidate) => candidate.subject === subject);
      if (!deck && !topic) throw new Error(`no local ordinal for ${question.questionId}`);
      return {
        questionIndex: question.questionIndex,
        subjectDecision:
          question.structuredSubject === null
            ? ({ action: 'select_subject', subjectIndex } as const)
            : ({ action: 'keep_local' } as const),
        deckDecision: deck
          ? ({ action: 'reuse_existing', deckIndex: deck.deckIndex } as const)
          : ({ action: 'create_topic', topicIndex: topic!.topicIndex } as const),
        confidence: deck ? ('high' as const) : ('medium' as const),
      };
    }),
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-organizer-v5-r3-no-network',
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
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<Pick<WrongQuestionOrganizerV5ModelCandidateInput, 'budget' | 'signal'>> &
    Readonly<{ revalidateSource?: () => unknown }> = {},
): WrongQuestionOrganizerV5ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-organizer-v5-r3-no-network',
    shortlistSource: source,
    runtime,
    budget: overrides.budget ?? candidateBudget(),
    revalidateSource: overrides.revalidateSource ?? (() => source),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

describe('Phase 6.9.7 V5 R3 WrongQuestionOrganizer ordinal shortlist', () => {
  test('freezes independent held-out fixtures, rules, prompt, and public export identities', () => {
    expect(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_VERSION).toBe(
      'phase-6.9.7-organizer-v5-shortlist-held-out-v1',
    );
    expect(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES).toHaveLength(24);
    expect(
      computeOrganizerV5ShortlistFixtureSha256(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES),
    ).toBe(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA256);
    expect(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURE_SHA256).toBe(
      PHASE_6_9_7_ORGANIZER_V5_FROZEN_SHORTLIST_FIXTURE_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_RULES_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V5_FROZEN_SHORTLIST_RULES_SHA256,
    );
    expect(WRONG_QUESTION_ORGANIZER_V5_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V5_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(OrganizerV5Public.WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION).toBe(
      WRONG_QUESTION_ORGANIZER_V5_SHORTLIST_VERSION,
    );
    expect(OrganizerV5Public.runWrongQuestionOrganizerV5ModelCandidate).toBe(
      runWrongQuestionOrganizerV5ModelCandidate,
    );
    expect(countBy('language')).toEqual({ en: 8, mixed: 8, zh: 8 });
    expect(countBy('category')).toEqual({ batch: 4, dedupe: 2, locked: 2, taxonomy: 10, topic: 6 });
    expect(Object.isFrozen(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES)).toBe(true);
  });

  test('derives all 24 held-out authorities and keeps reorder variants byte-equivalent', () => {
    const fingerprints = new Map<string, string>();
    for (const fixture of PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES) {
      const authority = authorityFor(fixture.source);
      expect(validateWrongQuestionOrganizerV5Shortlist(authority).ok, fixture.id).toBe(true);
      expect(Object.isFrozen(authority), fixture.id).toBe(true);
      expect(authority.questions).toHaveLength(fixture.expected.length);
      for (const expected of fixture.expected) {
        const question = authority.questions.find(
          (entry) => entry.questionId === expected.questionId,
        );
        expect(question, fixture.id).toBeDefined();
        expect(
          question!.structuredSubject === expected.subject ||
            question!.subjectCandidates.includes(expected.subject),
          fixture.id,
        ).toBe(true);
        if (expected.topicLabel) {
          expect(
            question!.topicCandidates.some((entry) => entry.label === expected.topicLabel),
            fixture.id,
          ).toBe(true);
        }
        if (expected.deckName) {
          expect(
            authority.decks.some(
              (entry) => entry.subject === expected.subject && entry.name === expected.deckName,
            ),
            fixture.id,
          ).toBe(true);
        }
      }
      const baseId = fixture.id.replace(/-(?:canonical|reordered)$/, '');
      const prior = fingerprints.get(baseId);
      if (prior === undefined) fingerprints.set(baseId, authority.shortlistFingerprint);
      else expect(authority.shortlistFingerprint, fixture.id).toBe(prior);
    }
  });

  test('covers all 32 frozen V2 Organizer decision units without exporting their expected ordinals', () => {
    let decisions = 0;
    for (const caseItem of phase697V2OrganizerCases.filter((entry) => entry.subset === 'runtime')) {
      const source = sourceFromV2(caseItem);
      const authority = authorityFor(source);
      for (const expected of caseItem.expected.decisions) {
        decisions += 1;
        const sourceQuestion = caseItem.input.questions[expected.questionIndex]!;
        const question = authority.questions.find(
          (entry) => entry.questionId === sourceQuestion.id,
        )!;
        expect(
          question.structuredSubject === expected.subject ||
            question.subjectCandidates.includes(expected.subject),
          caseItem.id,
        ).toBe(true);
        if (expected.deckAction === 'reuse_existing') {
          expect(
            authority.decks.some(
              (entry) =>
                entry.subject === expected.subject &&
                expected.acceptedTopicLabels.includes(entry.name),
            ),
            caseItem.id,
          ).toBe(true);
        } else {
          expect(
            question.topicCandidates.some((entry) =>
              expected.acceptedTopicLabels.includes(entry.label),
            ),
            caseItem.id,
          ).toBe(true);
        }
      }
      const projection = projectWrongQuestionOrganizerV5ModelInput(authority);
      expect(projection.ok, caseItem.id).toBe(true);
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain(caseItem.id);
      expect(serialized).not.toContain('expected');
      expect(serialized).not.toContain('acceptedTopicLabels');
      expect(serialized).not.toContain('topicCandidateIndex');
    }
    expect(decisions).toBe(32);
  });

  test('rejects forged authority semantics even after an attacker recomputes the shortlist hash', () => {
    const authority = authorityFor(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES[0]!.source);
    const forged = structuredClone(authority);
    forged.questions[0]!.topicCandidates[0]!.label = '导数应用';
    forged.questions[0]!.topicCandidates[0]!.normalizedLabel = '导数应用';
    forged.shortlistFingerprint = fingerprintAuthority(forged);
    expect(validateWrongQuestionOrganizerV5Shortlist(forged)).toEqual({
      ok: false,
      reasonCode: 'shortlist_authority_invalid',
    });
  });

  test('projects only bounded ordinals and excludes every owner, entity, oracle, and historical identity', () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.category === 'locked',
    )!;
    const authority = authorityFor(fixture.source);
    const projection = projectWrongQuestionOrganizerV5ModelInput(authority);
    expect(projection.ok).toBe(true);
    if (!projection.ok) return;
    const serialized = JSON.stringify(projection.value);
    expect(Object.isFrozen(projection.value)).toBe(true);
    expect(serialized).not.toContain(authority.source.ownerDomain);
    expect(serialized).not.toContain(authority.source.ownerSnapshotFingerprint);
    for (const question of authority.questions)
      expect(serialized).not.toContain(question.questionId);
    for (const deck of authority.decks) {
      expect(serialized).not.toContain(deck.deckId);
      for (const folded of deck.foldedDeckIds) expect(serialized).not.toContain(folded);
    }
    for (const marker of [
      'expected',
      'oracle',
      'acceptedTopicLabels',
      'candidate-v4',
      'runner-v4',
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  test('strictly validates fingerprint, subject, deck, topic, and question associations', () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.category === 'locked' && entry.variant === 'canonical',
    )!;
    const authority = authorityFor(fixture.source);
    const valid = decisionFor(authority, fixture.expected);
    expect(validateWrongQuestionOrganizerV5ModelDecision({ decision: valid, authority }).ok).toBe(
      true,
    );

    expectInvalid(authority, { ...valid, extra: true }, 'schema_invalid');
    expectInvalid(
      authority,
      { ...valid, shortlistFingerprint: `sha256:${'0'.repeat(64)}` },
      'shortlist_fingerprint_mismatch',
    );
    expectInvalid(
      authority,
      {
        ...valid,
        decisions: [
          {
            ...valid.decisions[0]!,
            subjectDecision: { action: 'select_subject', subjectIndex: 0 },
          },
        ],
      },
      'subject_authority_violation',
    );
    expectInvalid(
      authority,
      {
        ...valid,
        decisions: [
          { ...valid.decisions[0]!, deckDecision: { action: 'reuse_existing', deckIndex: 19 } },
        ],
      },
      'deck_index_out_of_range',
    );

    const batchFixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.id === 'organizer-v5-held-out-same-subject-batch-canonical',
    )!;
    const batchAuthority = authorityFor(batchFixture.source);
    const batchValid = decisionFor(batchAuthority, batchFixture.expected);
    expectInvalid(
      batchAuthority,
      {
        ...batchValid,
        decisions: [batchValid.decisions[0], batchValid.decisions[0]],
      },
      'duplicate_question_index',
    );
    expectInvalid(
      batchAuthority,
      {
        ...batchValid,
        decisions: [batchValid.decisions[0], { ...batchValid.decisions[1], questionIndex: 11 }],
      },
      'question_index_out_of_range',
    );

    const topicFixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.id === 'organizer-v5-held-out-math-limit-canonical',
    )!;
    const topicAuthority = authorityFor(topicFixture.source);
    const topicValid = decisionFor(topicAuthority, topicFixture.expected);
    expectInvalid(
      topicAuthority,
      {
        ...topicValid,
        decisions: [
          {
            ...topicValid.decisions[0],
            deckDecision: { action: 'create_topic', topicIndex: 7 },
          },
        ],
      },
      'topic_index_out_of_range',
    );
    expectInvalid(
      topicAuthority,
      {
        ...topicValid,
        decisions: [{ ...topicValid.decisions[0], deckDecision: { action: 'rename_deck' } }],
      },
      'schema_invalid',
    );
    expectInvalid(
      topicAuthority,
      {
        ...topicValid,
        decisions: [
          { ...topicValid.decisions[0], subjectDecision: { action: 'keep_local', extra: true } },
        ],
      },
      'schema_invalid',
    );

    const taxonomyAuthority = authorityFor({
      ownerDomain: `hmac-sha256:${'7'.repeat(64)}`,
      ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
      ownerSnapshotFingerprint: `sha256:${'8'.repeat(64)}`,
      safety: 'safe_for_model',
      questions: [
        {
          id: 'q-cross-taxonomy',
          questionText: 'translation grammar database index',
          updatedAt: '2026-07-26T08:00:00.000Z',
        },
      ],
      decks: [],
    });
    const taxonomyQuestion = taxonomyAuthority.questions[0]!;
    const computerIndex = taxonomyQuestion.subjectCandidates.indexOf('computer');
    expect(computerIndex).toBeGreaterThanOrEqual(0);
    expectInvalid(
      taxonomyAuthority,
      {
        shortlistFingerprint: taxonomyAuthority.shortlistFingerprint,
        decisions: [
          {
            questionIndex: 0,
            subjectDecision: { action: 'select_subject', subjectIndex: 5 },
            deckDecision: { action: 'create_topic', topicIndex: 0 },
            confidence: 'medium',
          },
        ],
      },
      'subject_index_out_of_range',
    );
    expectInvalid(
      taxonomyAuthority,
      {
        shortlistFingerprint: taxonomyAuthority.shortlistFingerprint,
        decisions: [
          {
            questionIndex: 0,
            subjectDecision: { action: 'select_subject', subjectIndex: computerIndex },
            deckDecision: { action: 'create_topic', topicIndex: 0 },
            confidence: 'medium',
          },
        ],
      },
      'cross_subject_topic',
    );

    const crossDeckAuthority = authorityFor({
      ...fixture.source,
      decks: [
        ...fixture.source.decks,
        {
          id: 'deck-cross-math',
          subject: 'math',
          name: '函数极限',
          keywords: ['极限'],
          updatedAt: '2026-07-26T08:00:00.000Z',
        },
      ],
    });
    const crossDeckIndex = crossDeckAuthority.decks.find(
      (deck) => deck.subject === 'math',
    )!.deckIndex;
    expectInvalid(
      crossDeckAuthority,
      {
        shortlistFingerprint: crossDeckAuthority.shortlistFingerprint,
        decisions: [
          {
            questionIndex: 0,
            subjectDecision: { action: 'keep_local' },
            deckDecision: { action: 'reuse_existing', deckIndex: crossDeckIndex },
            confidence: 'medium',
          },
        ],
      },
      'cross_subject_deck',
    );
  });

  test('merges ordinals locally, preserves locked names and IDs, and never mutates inputs', () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.category === 'locked' && entry.variant === 'canonical',
    )!;
    const authority = authorityFor(fixture.source);
    const decision = decisionFor(authority, fixture.expected);
    const authorityBytes = JSON.stringify(authority);
    const decisionBytes = JSON.stringify(decision);
    const merged = mergeWrongQuestionOrganizerV5ModelDecision({ authority, decision });
    expect(merged).not.toBeNull();
    expect(merged!.binding?.shortlistFingerprint).toBe(authority.shortlistFingerprint);
    expect(merged!.suggestions[0]!.organization.deckName).toBe('信号与系统');
    expect(merged!.suggestions[0]!.organization.matchedDeckId).toBe('deck-locked-signal');
    expect(merged!.suggestions[0]!.selection).toEqual({
      source: 'model_ordinal',
      resolvedSubject: 'major',
      confidence: 'high',
      deckDecision: {
        action: 'reuse_existing',
        deckIndex: 0,
        deckId: 'deck-locked-signal',
      },
    });
    expect(JSON.stringify(authority)).toBe(authorityBytes);
    expect(JSON.stringify(decision)).toBe(decisionBytes);
    expect(Object.isFrozen(merged)).toBe(true);
  });

  test('applies one no-network runtime choice with pre/post fingerprint revalidation', async () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES[0]!;
    const authority = authorityFor(fixture.source);
    const tracked = trackedRuntime(decisionFor(authority, fixture.expected));
    let revalidations = 0;
    const budget = candidateBudget();
    const input = candidateInput(fixture.source, tracked.runtime, {
      budget,
      revalidateSource: () => {
        revalidations += 1;
        return fixture.source;
      },
    });
    const sourceBytes = JSON.stringify(input.shortlistSource);
    const budgetBytes = JSON.stringify(input.budget);
    const result = await runWrongQuestionOrganizerV5ModelCandidate(input);
    expect(tracked.requests).toHaveLength(1);
    expect(revalidations).toBe(2);
    expect(result.observation.attempted).toBe(true);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.result.suggestions[0]!.organization.deckName).toBe('函数极限');
    expect(tracked.requests[0]!.task).toBe('wrong_question_organization');
    expect(tracked.requests[0]!.maxOutputTokens).toBe(800);
    expect(tracked.requests[0]!.estimatedInputTokens).toBeLessThanOrEqual(3_500);
    expect(tracked.requests[0]!.budget).toEqual(budget);
    expect(tracked.requests[0]!.budget).not.toBe(budget);
    expect(result.observation.budget.usedCalls).toBe(1);
    expect(JSON.stringify(input.shortlistSource)).toBe(sourceBytes);
    expect(JSON.stringify(input.budget)).toBe(budgetBytes);
    expect(input.runtime).toBe(tracked.runtime);
  });

  test('resolves a cross-subject batch through one runtime call without ordinal crossover', async () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.id === 'organizer-v5-held-out-cross-subject-batch-canonical',
    )!;
    const authority = authorityFor(fixture.source);
    const tracked = trackedRuntime(decisionFor(authority, fixture.expected));
    const result = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, tracked.runtime),
    );

    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(
      result.result.suggestions.map((suggestion) => ({
        questionId: suggestion.questionId,
        subject: suggestion.organization.subjectKey,
        deckName: suggestion.organization.deckName,
      })),
    ).toEqual([
      { questionId: 'q-cross-database', subject: 'computer', deckName: '数据库索引' },
      { questionId: 'q-cross-mechanics', subject: 'major', deckName: '工程力学' },
      { questionId: 'q-cross-translation', subject: 'english', deckName: '翻译语序' },
    ]);
  });

  test('keeps unsafe, empty, aborted, stale, and exhausted requests provider-zero-call', async () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES[0]!;
    const authority = authorityFor(fixture.source);
    const output = decisionFor(authority, fixture.expected);
    const cases: readonly Readonly<{
      input: WrongQuestionOrganizerV5ModelCandidateInput;
      disposition: string;
      reason: string;
    }>[] = [
      {
        input: candidateInput(
          { ...fixture.source, safety: 'unsafe' },
          trackedRuntime(output).runtime,
        ),
        disposition: 'fallback_invalid_input',
        reason: 'unsafe_metadata',
      },
      {
        input: candidateInput(
          {
            ...fixture.source,
            questions: [{ id: 'q-empty', questionText: 'hello?', updatedAt: '2026-07-26' }],
            decks: [],
          },
          trackedRuntime(output).runtime,
        ),
        disposition: 'not_eligible',
        reason: 'candidate_shortlist_empty',
      },
      {
        input: candidateInput(fixture.source, trackedRuntime(output).runtime, {
          signal: AbortSignal.abort(),
        }),
        disposition: 'fallback_aborted',
        reason: 'ABORTED',
      },
      {
        input: candidateInput(fixture.source, trackedRuntime(output).runtime, {
          revalidateSource: () => ({
            ...fixture.source,
            ownerSnapshotFingerprint: `sha256:${'c'.repeat(64)}`,
          }),
        }),
        disposition: 'fallback_invalid_input',
        reason: 'stale_shortlist',
      },
      {
        input: candidateInput(fixture.source, trackedRuntime(output).runtime, {
          budget: exhaustedBudget(),
        }),
        disposition: 'fallback_budget_exceeded',
        reason: 'CALL_BUDGET_EXCEEDED',
      },
    ];
    for (const [index, item] of cases.entries()) {
      let calls = 0;
      const original = item.input.runtime;
      const input = {
        ...item.input,
        runtime: {
          async invokeStructured<T>(request: ModelAgentRequest<T>) {
            calls += 1;
            return original.invokeStructured(request);
          },
        },
      };
      const result = await runWrongQuestionOrganizerV5ModelCandidate(input);
      expect(calls, String(index)).toBe(0);
      expect(result.observation.attempted, String(index)).toBe(false);
      expect(result.observation.disposition, String(index)).toBe(item.disposition);
      expect(result.observation.reasonCodes, String(index)).toContain(item.reason);
    }
  });

  test('fails closed after one runtime call for schema, throw, post-abort, and post-call stale', async () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES[0]!;
    const authority = authorityFor(fixture.source);
    const validDecision = decisionFor(authority, fixture.expected);

    const invalid = trackedRuntime({ ...validDecision, extra: true });
    const invalidResult = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, invalid.runtime),
    );
    expect(invalid.requests).toHaveLength(1);
    expect(invalidResult.observation.disposition).toBe('fallback_schema_invalid');

    let throws = 0;
    const throwResult = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, {
        async invokeStructured() {
          throws += 1;
          throw new Error('raw provider canary');
        },
      }),
    );
    expect(throws).toBe(1);
    expect(throwResult.observation.disposition).toBe('fallback_runtime_error');

    const controller = new AbortController();
    const aborting = trackedRuntime(validDecision);
    const abortResult = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(
        fixture.source,
        {
          async invokeStructured<T>(request: ModelAgentRequest<T>) {
            const result = await aborting.runtime.invokeStructured(request);
            controller.abort();
            return result;
          },
        },
        { signal: controller.signal },
      ),
    );
    expect(aborting.requests).toHaveLength(1);
    expect(abortResult.observation.disposition).toBe('fallback_aborted');

    const stale = trackedRuntime(validDecision);
    let fence = 0;
    const staleResult = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, stale.runtime, {
        revalidateSource: () => {
          fence += 1;
          return fence === 1
            ? fixture.source
            : {
                ...fixture.source,
                questions: [
                  {
                    ...fixture.source.questions[0]!,
                    id: 'q-a-page-shift',
                    knowledgePoints: ['导数应用'],
                  },
                  ...fixture.source.questions,
                ],
              };
        },
      }),
    );
    expect(stale.requests).toHaveLength(1);
    expect(staleResult.observation.attempted).toBe(true);
    expect(staleResult.observation.disposition).toBe('fallback_invalid_input');
    expect(staleResult.observation.reasonCodes).toContain('stale_shortlist');
  });

  test('binds owner, snapshot, dedupe, pagination material, and ABA timestamps into one fingerprint', () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
      (entry) => entry.category === 'dedupe' && entry.variant === 'canonical',
    )!;
    const original = authorityFor(fixture.source);
    const reordered = authorityFor(
      PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.find(
        (entry) => entry.id === fixture.id.replace('canonical', 'reordered'),
      )!.source,
    );
    expect(reordered.shortlistFingerprint).toBe(original.shortlistFingerprint);
    expect(original.decks[0]!.deckId).toBe('deck-limit-a');
    expect(original.decks[0]!.foldedDeckIds).toEqual(['deck-limit-a', 'deck-limit-b']);

    const variants = [
      { ...fixture.source, ownerDomain: `hmac-sha256:${'d'.repeat(64)}` },
      { ...fixture.source, ownerSnapshotFingerprint: `sha256:${'e'.repeat(64)}` },
      { ...fixture.source, decks: fixture.source.decks.slice(0, 1) },
      {
        ...fixture.source,
        questions: fixture.source.questions.map((question) => ({
          ...question,
          updatedAt: '2026-07-26T10:00:00.000Z',
        })),
      },
      {
        ...fixture.source,
        questions: fixture.source.questions.map((question) => ({
          ...question,
          questionText: `${question.questionText ?? ''} ABA-content-change`,
        })),
      },
      {
        ...fixture.source,
        questions: [
          {
            ...fixture.source.questions[0]!,
            id: 'q-a-pagination-boundary',
          },
          ...fixture.source.questions,
        ],
      },
    ];
    for (const source of variants) {
      expect(authorityFor(source).shortlistFingerprint).not.toBe(original.shortlistFingerprint);
    }
  });

  test('is byte-equivalent across repeated no-network runs and leaks no source IDs into prompts', async () => {
    const fixture = PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES[0]!;
    const authority = authorityFor(fixture.source);
    const output = decisionFor(authority, fixture.expected);
    const firstRuntime = trackedRuntime(output);
    const secondRuntime = trackedRuntime(output);
    const first = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, firstRuntime.runtime),
    );
    const second = await runWrongQuestionOrganizerV5ModelCandidate(
      candidateInput(fixture.source, secondRuntime.runtime),
    );
    expect(first.result).toEqual(second.result);
    expect(first.observation.disposition).toBe(second.observation.disposition);
    for (const request of [...firstRuntime.requests, ...secondRuntime.requests]) {
      for (const question of authority.questions) {
        expect(request.userPrompt).not.toContain(question.questionId);
      }
      for (const deck of authority.decks) expect(request.userPrompt).not.toContain(deck.deckId);
      expect(request.systemPrompt).not.toContain('phase-6.9');
      expect(request.systemPrompt).not.toContain('expected');
    }
  });
});

function sourceFromV2(
  caseItem: Extract<(typeof phase697V2OrganizerCases)[number], { subset: 'runtime' }>,
): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: `hmac-sha256:${'f'.repeat(64)}`,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${createHash('sha256').update(caseItem.id).digest('hex')}`,
    safety: 'safe_for_model',
    questions: caseItem.input.questions.map((question) => ({
      id: question.id,
      subject: question.subject,
      category: question.category,
      knowledgePoints: question.knowledgePoints,
      errorType: question.errorType,
      questionText: question.questionText,
      analysis: question.analysis,
      status: 'UNRESOLVED',
      updatedAt: '2026-07-26T08:00:00.000Z',
    })),
    decks: caseItem.input.existingDecks.map((deck) => ({
      id: deck.id,
      subject: deck.subjectKey,
      name: deck.name,
      nameLocked: deck.nameLocked,
      keywords: deck.keywords,
      updatedAt: '2026-07-26T08:00:00.000Z',
    })),
  };
}

function expectInvalid(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  decision: unknown,
  reasonCode: string,
) {
  expect(validateWrongQuestionOrganizerV5ModelDecision({ decision, authority })).toEqual({
    ok: false,
    reasonCode,
  });
}

function countBy(key: 'language' | 'category') {
  return Object.fromEntries(
    [...new Set(PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.map((entry) => entry[key]))]
      .sort()
      .map((value) => [
        value,
        PHASE_6_9_7_ORGANIZER_V5_SHORTLIST_FIXTURES.filter((entry) => entry[key] === value).length,
      ]),
  );
}

function fingerprintAuthority(authority: WrongQuestionOrganizerV5ShortlistAuthority) {
  const { shortlistFingerprint: _fingerprint, ...withoutFingerprint } = authority;
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(withoutFingerprint)))
    .digest('hex')}`;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
