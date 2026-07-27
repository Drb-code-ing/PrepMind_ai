import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import * as OrganizerV6Public from '@repo/agent/wrong-question-organizer-v6';

import {
  phase697V2OrganizerCases,
  type Phase697V2OrganizerRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  mergeWrongQuestionOrganizerV6ModelDecision,
  runWrongQuestionOrganizerV6ModelCandidate,
  type WrongQuestionOrganizerV6ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256,
  WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION,
  validateWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6ValidatedDecision,
} from '../src/model-candidates/wrong-question-organizer-v6-model-contract.ts';
import { projectWrongQuestionOrganizerV6ModelInput } from '../src/model-candidates/wrong-question-organizer-v6-model-projection.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';

describe('Phase 6.9.7 WrongQuestionOrganizer V6 ordinal-only candidate', () => {
  test('freezes an independent V6 prompt, strict schema, and public subpath', () => {
    expect(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_VERSION).toBe(
      'wrong-question-organizer-model-candidate-v6',
    );
    expect(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V6_FROZEN_MODEL_PROMPT_SHA256,
    );
    expect(OrganizerV6Public.runWrongQuestionOrganizerV6ModelCandidate).toBe(
      runWrongQuestionOrganizerV6ModelCandidate,
    );
    expect(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROMPT_SHA256).not.toBe(
      '915084a80f1cf4f96fca08987d4dc228f0e73e1dc299bd1368033d37f6ac69ab',
    );
  });

  test('applies all 32 frozen V2 model-owned decisions and rebuilds confidence locally', async () => {
    const runtimeCases = phase697V2OrganizerCases.filter(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    );
    let decisionCount = 0;
    for (const runtimeCase of runtimeCases) {
      const source = sourceFromV2(runtimeCase);
      const authority = authorityFor(source);
      const decision = decisionFromV2(runtimeCase, authority);
      const tracked = trackedRuntime(decision);
      const result = await runWrongQuestionOrganizerV6ModelCandidate(
        candidateInput(source, tracked.runtime),
      );
      expect(tracked.requests, runtimeCase.id).toHaveLength(1);
      expect(result.observation.disposition, runtimeCase.id).toBe('candidate_applied');
      expect(result.result.binding?.shortlistFingerprint, runtimeCase.id).toBe(
        authority.shortlistFingerprint,
      );
      for (const expected of runtimeCase.expected.decisions) {
        decisionCount += 1;
        const sourceQuestion = runtimeCase.input.questions[expected.questionIndex]!;
        const suggestion = result.result.suggestions.find(
          (entry) => entry.questionId === sourceQuestion.id,
        );
        expect(suggestion, `${runtimeCase.id}:${sourceQuestion.id}`).toBeDefined();
        expect(suggestion!.organization.subjectKey).toBe(expected.subject);
        expect(suggestion!.selection.source).toBe('model_ordinal');
        if (suggestion!.selection.source !== 'model_ordinal') {
          throw new Error('ORGANIZER_V6_MODEL_SELECTION_MISSING');
        }
        expect(
          suggestion!.selection.confidence,
          `${runtimeCase.id}:${sourceQuestion.id}:confidence`,
        ).toBe(expected.confidence);
        if (expected.deckAction === 'reuse_existing') {
          const deck = runtimeCase.input.existingDecks[expected.deckIndex];
          expect(deck).toBeDefined();
          expect(suggestion!.organization.deckName).toBe(deck!.name);
          expect(suggestion!.selection.deckDecision.action).toBe('reuse_existing');
        } else {
          const authorityDecision = runtimeCase.authority.decisions.find(
            (entry) => entry.questionIndex === expected.questionIndex,
          );
          const topic = authorityDecision?.topicCandidates[expected.topicCandidateIndex];
          expect(topic).toBeDefined();
          expect(suggestion!.organization.deckName).toBe(topic!.label);
          expect(suggestion!.selection.deckDecision.action).toBe('create_topic');
        }
      }
      expect(tracked.requests[0]!.maxOutputTokens).toBe(800);
      expect(tracked.requests[0]!.estimatedInputTokens).toBeLessThanOrEqual(3_500);
    }
    expect(runtimeCases).toHaveLength(24);
    expect(decisionCount).toBe(32);
  });

  test('binds the prompt to ordinals without exposing source IDs or model confidence', async () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const source = sourceFromV2(runtimeCase);
    const authority = authorityFor(source);
    const projection = projectWrongQuestionOrganizerV6ModelInput(authority);
    expect(projection.ok).toBe(true);
    if (!projection.ok) throw new Error(projection.reasonCode);
    const projectionBytes = JSON.stringify(projection.value);
    for (const question of authority.questions) {
      expect(projectionBytes).not.toContain(question.questionId);
    }
    for (const deck of authority.decks) expect(projectionBytes).not.toContain(deck.deckId);
    expect(projectionBytes).not.toContain('confidence');

    const tracked = trackedRuntime(decisionFromV2(runtimeCase, authority));
    const result = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, tracked.runtime),
    );
    expect(result.observation.disposition).toBe('candidate_applied');
    const request = tracked.requests[0]!;
    const bytes = `${request.systemPrompt}\n${request.userPrompt}`;
    for (const token of [
      'wrong-question-organizer-model-candidate-v1',
      'wrong-question-organizer-model-candidate-v2',
      'wrong-question-organizer-model-candidate-v3',
      'wrong-question-organizer-model-candidate-v4',
      'wrong-question-organizer-model-candidate-v5',
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      'acceptedTopicLabels',
      'canonicalTopicLabel',
      ...phase697V2OrganizerCases.map((entry) => entry.id),
      ...source.questions.map((question) => question.id),
      ...source.decks.map((deck) => deck.id),
    ]) {
      expect(bytes).not.toContain(token);
    }
    expect(request.schema.safeParse(decisionFromV2(runtimeCase, authority)).success).toBe(true);
    expect(
      request.schema.safeParse({
        ...decisionFromV2(runtimeCase, authority),
        confidence: 'high',
      }).success,
    ).toBe(false);
  });

  test('uses pre/post actual shortlist fences and discards stale or ABA snapshots without retry', async () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const source = sourceFromV2(runtimeCase);
    const authority = authorityFor(source);
    const decision = decisionFromV2(runtimeCase, authority);

    let preCalls = 0;
    const preRuntime = trackedRuntime(decision);
    const preStale = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, preRuntime.runtime, {
        revalidateSource: () => {
          preCalls += 1;
          return mutateSnapshot(source, '2026-07-27T12:00:01.000Z');
        },
      }),
    );
    expect(preCalls).toBe(1);
    expect(preRuntime.requests).toHaveLength(0);
    expect(preStale.observation.reasonCodes).toContain('stale_shortlist');

    let fence = 0;
    const postRuntime = trackedRuntime(decision);
    const postStale = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, postRuntime.runtime, {
        revalidateSource: () => {
          fence += 1;
          return fence === 1 ? source : mutateSnapshot(source, '2026-07-27T12:00:02.000Z');
        },
      }),
    );
    expect(fence).toBe(2);
    expect(postRuntime.requests).toHaveLength(1);
    expect(postStale.observation.disposition).toBe('fallback_invalid_input');
    expect(postStale.observation.reasonCodes).toContain('stale_shortlist');

    const abaRuntime = trackedRuntime(decision);
    let abaFence = 0;
    const aba = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, abaRuntime.runtime, {
        revalidateSource: () => {
          abaFence += 1;
          return abaFence === 1
            ? source
            : {
                ...source,
                ownerSnapshotFingerprint: `sha256:${'d'.repeat(64)}`,
                questions: source.questions.map((question) => ({
                  ...question,
                  updatedAt: '2026-07-27T12:00:03.000Z',
                })),
              };
        },
      }),
    );
    expect(abaRuntime.requests).toHaveLength(1);
    expect(aba.observation.reasonCodes).toContain('stale_shortlist');
  });

  test('keeps unsafe, empty, aborted, stale, and exhausted requests provider-zero-call', async () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const source = sourceFromV2(runtimeCase);
    const cases: readonly Readonly<{
      input: WrongQuestionOrganizerV6ModelCandidateInput;
      disposition: string;
      reason: string;
    }>[] = [
      {
        input: candidateInput({ ...source, safety: 'unsafe' }, neverRuntime()),
        disposition: 'fallback_invalid_input',
        reason: 'unsafe_metadata',
      },
      {
        input: candidateInput(
          {
            ...source,
            questions: [{ id: 'q-empty-v6', questionText: 'hello?' }],
            decks: [],
          },
          neverRuntime(),
        ),
        disposition: 'not_eligible',
        reason: 'candidate_shortlist_empty',
      },
      {
        input: candidateInput(source, neverRuntime(), { signal: AbortSignal.abort() }),
        disposition: 'fallback_aborted',
        reason: 'ABORTED',
      },
      {
        input: candidateInput(source, neverRuntime(), {
          revalidateSource: () => mutateSnapshot(source, '2026-07-27T13:00:00.000Z'),
        }),
        disposition: 'fallback_invalid_input',
        reason: 'stale_shortlist',
      },
      {
        input: candidateInput(source, neverRuntime(), { budget: exhaustedBudget() }),
        disposition: 'fallback_budget_exceeded',
        reason: 'CALL_BUDGET_EXCEEDED',
      },
    ];
    for (const item of cases) {
      const result = await runWrongQuestionOrganizerV6ModelCandidate(item.input);
      expect(result.observation.attempted).toBe(false);
      expect(result.observation.disposition).toBe(item.disposition);
      expect(result.observation.reasonCodes).toContain(item.reason);
    }
  });

  test('fails closed after one call for schema drift, cross-subject ordinal, throw, and post-abort', async () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const source = sourceFromV2(runtimeCase);
    const authority = authorityFor(source);
    const validDecision = decisionFromV2(runtimeCase, authority);

    const invalid = trackedRuntime({ ...validDecision, confidence: 'high' });
    const invalidResult = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, invalid.runtime),
    );
    expect(invalid.requests).toHaveLength(1);
    expect(invalidResult.observation.disposition).toBe('fallback_schema_invalid');

    const first = validDecision.decisions[0]!;
    const crossSubject = {
      ...validDecision,
      decisions: [
        {
          ...first,
          deckDecision: { action: 'reuse_existing', deckIndex: 19 },
        },
        ...validDecision.decisions.slice(1),
      ],
    };
    expect(
      validateWrongQuestionOrganizerV6ModelDecision({ decision: crossSubject, authority }).ok,
    ).toBe(false);

    let throwCalls = 0;
    const thrown = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, {
        async invokeStructured() {
          throwCalls += 1;
          throw new Error('synthetic no-network failure');
        },
      }),
    );
    expect(throwCalls).toBe(1);
    expect(thrown.observation.disposition).toBe('fallback_runtime_error');

    const controller = new AbortController();
    const inner = trackedRuntime(validDecision);
    const aborted = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(
        source,
        {
          async invokeStructured<T>(request: ModelAgentRequest<T>) {
            const response = await inner.runtime.invokeStructured(request);
            controller.abort('after-call');
            return response;
          },
        },
        { signal: controller.signal },
      ),
    );
    expect(inner.requests).toHaveLength(1);
    expect(aborted.observation.disposition).toBe('fallback_aborted');
  });

  test('keeps locked names and confidence local, and rejects create-topic collisions', () => {
    const source = lockedSource();
    const authority = authorityFor(source);
    const question = authority.questions[0]!;
    const lockedDeck = authority.decks.find((deck) => deck.nameLocked)!;
    const reuseDecision: WrongQuestionOrganizerV6ModelDecision = {
      shortlistFingerprint: authority.shortlistFingerprint,
      decisions: [
        {
          questionIndex: question.questionIndex,
          subjectDecision: { action: 'keep_local' },
          deckDecision: { action: 'reuse_existing', deckIndex: lockedDeck.deckIndex },
        },
      ],
    };
    const reused = mergeWrongQuestionOrganizerV6ModelDecision({
      authority,
      decision: reuseDecision,
      snapshotStable: true,
    });
    expect(reused.ok).toBe(true);
    if (!reused.ok) throw new Error(reused.reasonCode);
    expect(reused.value.suggestions[0]!.organization.deckName).toBe('函数极限');
    expect(reused.value.suggestions[0]!.selection.source).toBe('model_ordinal');

    const topic = question.topicCandidates.find(
      (entry) => entry.normalizedLabel === lockedDeck.normalizedName,
    );
    expect(topic).toBeDefined();
    if (topic === undefined) throw new Error('ORGANIZER_V6_LOCKED_COLLISION_TOPIC_MISSING');
    const collision = mergeWrongQuestionOrganizerV6ModelDecision({
      authority,
      snapshotStable: true,
      decision: {
        shortlistFingerprint: authority.shortlistFingerprint,
        decisions: [
          {
            questionIndex: question.questionIndex,
            subjectDecision: { action: 'keep_local' },
            deckDecision: { action: 'create_topic', topicIndex: topic.topicIndex },
          },
        ],
      },
    });
    expect(collision).toEqual({ ok: false, reasonCode: 'locked_name_violation' });
  });

  test('revalidates validated-shaped public merger input instead of trusting caller claims', () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const authority = authorityFor(sourceFromV2(runtimeCase));
    const forged = {
      shortlistFingerprint: authority.shortlistFingerprint,
      decisions: [],
    } as unknown as WrongQuestionOrganizerV6ValidatedDecision;
    expect(
      mergeWrongQuestionOrganizerV6ModelDecision({
        authority,
        decision: forged,
        snapshotStable: true,
      }),
    ).toEqual({ ok: false, reasonCode: 'authority_merge_invalid' });
  });

  test('rejects hostile source and runtime accessors without invoking them', async () => {
    const runtimeCase = phase697V2OrganizerCases.find(
      (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
    )!;
    const source = sourceFromV2(runtimeCase);
    let reads = 0;
    const topLevel = candidateInput(source, neverRuntime());
    Object.defineProperty(topLevel, 'shortlistSource', {
      get() {
        reads += 1;
        throw new Error('hostile shortlist getter');
      },
    });
    const topLevelResult = await runWrongQuestionOrganizerV6ModelCandidate(topLevel);
    expect(reads).toBe(0);
    expect(topLevelResult.observation.attempted).toBe(false);
    expect(topLevelResult.observation.disposition).toBe('fallback_invalid_input');

    const runtime = {} as Pick<ModelAgentRuntime, 'invokeStructured'>;
    Object.defineProperty(runtime, 'invokeStructured', {
      get() {
        reads += 1;
        throw new Error('hostile invoke getter');
      },
    });
    const runtimeResult = await runWrongQuestionOrganizerV6ModelCandidate(
      candidateInput(source, runtime),
    );
    expect(reads).toBe(0);
    expect(runtimeResult.observation.attempted).toBe(false);
    expect(runtimeResult.observation.disposition).toBe('fallback_invalid_input');
  });
});

function candidateBudget() {
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

function candidateInput(
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<Pick<WrongQuestionOrganizerV6ModelCandidateInput, 'budget' | 'signal'>> &
    Readonly<{ revalidateSource?: () => unknown | Promise<unknown> }> = {},
): WrongQuestionOrganizerV6ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-organizer-v6-r2-no-network',
    shortlistSource: source,
    runtime,
    budget: overrides.budget ?? candidateBudget(),
    revalidateSource: overrides.revalidateSource ?? (() => source),
    ...(overrides.signal === undefined ? {} : { signal: overrides.signal }),
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-organizer-v6-r2-no-network',
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

function neverRuntime(): Pick<ModelAgentRuntime, 'invokeStructured'> {
  return {
    async invokeStructured() {
      throw new Error('zero-call guard violated');
    },
  };
}

function sourceFromV2(
  caseItem: Phase697V2OrganizerRuntimeCase,
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
      updatedAt: '2026-07-27T08:00:00.000Z',
    })),
    decks: caseItem.input.existingDecks.map((deck) => ({
      id: deck.id,
      subject: deck.subjectKey,
      name: deck.name,
      nameLocked: deck.nameLocked,
      keywords: deck.keywords,
      updatedAt: '2026-07-27T08:00:00.000Z',
    })),
  };
}

function decisionFromV2(
  caseItem: Phase697V2OrganizerRuntimeCase,
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV6ModelDecision {
  return {
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: caseItem.expected.decisions.map((expected) => {
      const sourceQuestion = caseItem.input.questions[expected.questionIndex]!;
      const question = authority.questions.find((entry) => entry.questionId === sourceQuestion.id)!;
      const subjectIndex = question.subjectCandidates.indexOf(expected.subject);
      const authorityDecision = caseItem.authority.decisions.find(
        (entry) => entry.questionIndex === expected.questionIndex,
      )!;
      const deckDecision =
        expected.deckAction === 'reuse_existing'
          ? (() => {
              const sourceDeck = caseItem.input.existingDecks[expected.deckIndex];
              if (!sourceDeck) throw new Error('ORGANIZER_V6_SOURCE_DECK_MISSING');
              const deck = authority.decks.find((entry) =>
                entry.foldedDeckIds.includes(sourceDeck.id),
              );
              if (!deck) throw new Error('ORGANIZER_V6_AUTHORITY_DECK_MISSING');
              return { action: 'reuse_existing' as const, deckIndex: deck.deckIndex };
            })()
          : (() => {
              const sourceTopic = authorityDecision.topicCandidates[expected.topicCandidateIndex];
              if (!sourceTopic) throw new Error('ORGANIZER_V6_SOURCE_TOPIC_MISSING');
              const topic = question.topicCandidates.find(
                (entry) => entry.subject === expected.subject && entry.label === sourceTopic.label,
              );
              if (!topic) {
                throw new Error(
                  `ORGANIZER_V6_AUTHORITY_TOPIC_MISSING:${caseItem.id}:${sourceQuestion.id}:${sourceTopic.label}:${sourceTopic.source}`,
                );
              }
              return { action: 'create_topic' as const, topicIndex: topic.topicIndex };
            })();
      return {
        questionIndex: question.questionIndex,
        subjectDecision:
          question.structuredSubject === null
            ? ({ action: 'select_subject', subjectIndex } as const)
            : ({ action: 'keep_local' } as const),
        deckDecision,
      };
    }),
  };
}

function mutateSnapshot(source: WrongQuestionOrganizerV5ShortlistSource, updatedAt: string) {
  return {
    ...source,
    questions: source.questions.map((question) => ({ ...question, updatedAt })),
  };
}

function lockedSource(): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: `hmac-sha256:${'a'.repeat(64)}`,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${'b'.repeat(64)}`,
    safety: 'safe_for_model',
    questions: [
      {
        id: 'q-v6-locked-limit',
        subject: '数学',
        knowledgePoints: ['函数极限'],
        questionText: '用等价无穷小计算函数极限。',
        status: 'UNRESOLVED',
        updatedAt: '2026-07-27T08:00:00.000Z',
      },
    ],
    decks: [
      {
        id: 'deck-v6-locked-limit',
        subject: '数学',
        name: '函数极限',
        nameLocked: true,
        keywords: ['极限', '无穷小'],
        updatedAt: '2026-07-27T08:00:00.000Z',
      },
    ],
  };
}
