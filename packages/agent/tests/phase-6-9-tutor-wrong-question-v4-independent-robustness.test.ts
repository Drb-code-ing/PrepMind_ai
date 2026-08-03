import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4,
  PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import {
  runTutorModelCandidate,
  type TutorModelCandidateInput,
} from '../src/model-candidates/tutor-model-candidate.ts';
import { validateTutorModelDecision } from '../src/model-candidates/tutor-model-contract.ts';
import {
  mergeWrongQuestionOrganizerModelDecision,
  runWrongQuestionOrganizerModelCandidate,
  type WrongQuestionOrganizerModelCandidateItem,
} from '../src/model-candidates/wrong-question-organizer-model-candidate.ts';
import {
  validateWrongQuestionOrganizerModelDecisionV4,
  type WrongQuestionOrganizerModelDecision,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';
import { projectWrongQuestionOrganizerSnapshotForCandidate } from '../src/model-candidates/wrong-question-organizer-model-projection.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_VERSION,
  PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES,
  PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES,
} from './fixtures/phase-6-9-tutor-wrong-question-v4-independent-robustness-v1.ts';

type ProjectionSource = (typeof PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES)[number];

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v4-independent-robustness',
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

function tutorBudget() {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 });
}

function organizerBudget() {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 });
}

function tutorInput(input: {
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  latestUserText: string;
  activeStudyContext: string;
  signal?: AbortSignal;
}): TutorModelCandidateInput {
  return {
    runId: 'phase-6-9-7-v4-independent-tutor',
    finalRoute: 'tutor',
    latestUserText: input.latestUserText,
    activeStudyContext: input.activeStudyContext,
    deterministic: buildTutorStrategy({
      latestUserText: input.latestUserText,
      activeStudyContext: input.activeStudyContext,
    }),
    safety: {
      latestUserText: 'safe_for_model',
      activeStudyContext: 'safe_for_model',
    },
    runtime: input.runtime,
    budget: tutorBudget(),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  };
}

function itemsFor(source: ProjectionSource): readonly WrongQuestionOrganizerModelCandidateItem[] {
  const existingDecks = source.decks.map((entry) => ({
    id: entry.deckId,
    name: entry.name,
    nameLocked: entry.nameLocked,
    keywords: [...entry.keywords],
  }));
  return source.questions.map((entry) => ({
    deterministicInput: {
      wrongQuestion: {
        id: entry.questionId,
        subject: entry.subject,
        category: entry.category,
        knowledgePoints: [...entry.knowledgePoints],
        errorType: entry.errorType,
        questionText: entry.questionText,
        analysis: entry.analysis,
        answer: entry.answer,
        userNote: entry.userNote,
      },
      existingDecks,
    },
    hasExistingItem: false,
  }));
}

function projectionFor(source: ProjectionSource) {
  const projection = projectWrongQuestionOrganizerSnapshotForCandidate({
    questions: source.questions,
    existingDecks: source.decks,
  });
  if (!projection.ok) throw new Error(`projection failed: ${projection.reasonCode}`);
  return projection;
}

function decisionContext(projection: ReturnType<typeof projectionFor>['value']) {
  return {
    questions: projection.questions.map((entry) => ({ subjectHint: entry.subjectHint })),
    decks: projection.decks.map((entry) => ({ subject: entry.subject })),
  } as const;
}

function organizerDecisionFor(source: ProjectionSource): WrongQuestionOrganizerModelDecision {
  const deckIndexBySubject = new Map(source.decks.map((entry, index) => [entry.subject, index]));
  return {
    decisions: source.questions.map((question, questionIndex) => {
      const resolvedSubject =
        question.subjectHint === 'unknown' ? inferredSubject(question.questionId) : 'math';
      const deckIndex = deckIndexBySubject.get(resolvedSubject);
      if (deckIndex === undefined) throw new Error(`missing deck for ${resolvedSubject}`);
      return {
        questionIndex,
        subject: question.subjectHint === 'unknown' ? resolvedSubject : 'keep_local',
        deck: { action: 'reuse_existing' as const, deckIndex },
        confidence: 'high' as const,
        evidenceCodes:
          question.subjectHint === 'unknown'
            ? (['existing_deck_overlap', 'error_pattern'] as const)
            : (['structured_subject', 'existing_deck_overlap', 'error_pattern'] as const),
      };
    }),
  };
}

function modelEligibleSource(source: ProjectionSource): ProjectionSource {
  return {
    ...source,
    questions: source.questions.map((question) => ({
      ...question,
      subject: null,
      subjectHint: 'unknown',
      category: null,
      knowledgePoints: [],
      errorType: null,
    })),
    decks: [],
  } as unknown as ProjectionSource;
}

function createTopicDecisionFor(source: ProjectionSource): WrongQuestionOrganizerModelDecision {
  const topicByQuestion = new Map([
    ['independent-known-math', '泰勒余项'],
    ['independent-unknown-computer', '缺页中断协同'],
    ['independent-unknown-major', '稳态导热边界'],
    ['independent-unknown-other', '单点透视构图'],
  ]);
  return {
    decisions: source.questions.map((question, questionIndex) => ({
      questionIndex,
      subject: question.questionId.endsWith('math') ? 'math' : inferredSubject(question.questionId),
      deck: {
        action: 'create_topic',
        topicLabel: topicByQuestion.get(question.questionId) ?? '专题归类',
      },
      confidence: 'medium',
      evidenceCodes: ['semantic_topic'],
    })),
  };
}

function inferredSubject(questionId: string): 'computer' | 'major' | 'other' {
  if (questionId.endsWith('computer')) return 'computer';
  if (questionId.endsWith('major')) return 'major';
  return 'other';
}

function organizerInput(
  source: ProjectionSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  signal?: AbortSignal,
) {
  return {
    runId: 'phase-6-9-7-v4-independent-organizer',
    items: itemsFor(source),
    force: true,
    ownerEligible: true,
    snapshotCurrent: true,
    projectionSource: { questions: source.questions, existingDecks: source.decks },
    runtime,
    budget: organizerBudget(),
    ...(signal === undefined ? {} : { signal }),
  } as const;
}

describe('Phase 6.9.7 V4 independent robustness', () => {
  test('keeps independent relation fixtures versioned, deeply frozen, and outside the 72-case authority', () => {
    expect(PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-v4-independent-robustness-v1',
    );
    expect(
      `sha256:${createHash('sha256')
        .update(
          JSON.stringify({
            tutor: PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES,
            organizer: PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES,
          }),
          'utf8',
        )
        .digest('hex')}`,
    ).toBe(PHASE_6_9_7_V4_INDEPENDENT_ROBUSTNESS_SHA256);
    expect(Object.isFrozen(PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES)).toBe(true);
    expect(Object.isFrozen(PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES)).toBe(true);
    const frozenIds = new Set(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => entry.id));
    expect(
      [
        ...PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES,
        ...PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES,
      ].every((entry) => !frozenIds.has(entry.id)),
    ).toBe(true);
  });

  test('preserves Tutor semantics across Chinese, English, mixed rewrites, negation, noise, and context reorder', async () => {
    const decisions = [
      {
        intent: 'socratic_hint',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['implicit_hint_request'],
      },
      {
        intent: 'step_check',
        depth: 'standard',
        confidence: 'high',
        evidenceCodes: ['submitted_step'],
      },
      {
        intent: 'explain_solution',
        depth: 'deep',
        confidence: 'high',
        evidenceCodes: ['full_explanation_request'],
      },
    ] as const;

    for (const [fixtureIndex, fixture] of PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES.entries()) {
      const decision = decisions[fixtureIndex];
      if (decision === undefined) throw new Error('missing Tutor relation decision');
      expect(validateTutorModelDecision(decision).ok).toBe(true);
      const canonical: unknown[] = [];
      for (const latestUserText of fixture.utterances) {
        for (const activeStudyContext of fixture.contexts) {
          const { requests, runtime } = trackedRuntime(decision);
          const result = await runTutorModelCandidate(
            tutorInput({ runtime, latestUserText, activeStudyContext }),
          );
          expect(requests.length, `${fixture.id}:${latestUserText}`).toBeLessThanOrEqual(1);
          expect(result.observation.disposition, `${fixture.id}:${latestUserText}`).toBeOneOf([
            'candidate_applied',
            'not_eligible',
          ]);
          canonical.push({
            intent: result.result.intent,
            depth: result.result.depth,
            contextUse: result.result.shouldUseActiveStudyContext,
            guiding: result.result.shouldAskGuidingQuestion,
            finalAnswer: result.result.shouldGiveFinalAnswer,
            structure: result.result.answerStructure,
          });
        }
      }
      expect(
        canonical.every((entry) => JSON.stringify(entry) === JSON.stringify(canonical[0])),
      ).toBe(true);
      expect(canonical[0]).toMatchObject({ intent: decision.intent, depth: decision.depth });
    }
  });

  test('keeps Organizer authority stable across question/deck reorder and locked names', () => {
    const base = PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (base === undefined) throw new Error('missing Organizer snapshot');
    const reordered = {
      ...base,
      questions: [...base.questions].reverse(),
      decks: [base.decks[2]!, base.decks[0]!, base.decks[3]!, base.decks[1]!],
    } as unknown as ProjectionSource;
    const merge = (source: ProjectionSource) => {
      const projection = projectionFor(source);
      const decision = organizerDecisionFor(source);
      expect(
        validateWrongQuestionOrganizerModelDecisionV4(decision, decisionContext(projection.value))
          .ok,
      ).toBe(true);
      const result = mergeWrongQuestionOrganizerModelDecision({
        items: itemsFor(source),
        projection: projection.value,
        questionIdsByOrdinal: projection.questionIdsByOrdinal,
        deckIdsByOrdinal: projection.deckIdsByOrdinal,
        questionAuthoritiesByOrdinal: projection.questionAuthoritiesByOrdinal,
        deckAuthoritiesByOrdinal: projection.deckAuthoritiesByOrdinal,
        decision,
      });
      if (result === null) throw new Error('expected Organizer merge');
      return Object.fromEntries(
        source.questions.map((question, index) => [
          question.questionId,
          {
            deckId: result[index]?.matchedDeckId,
            deckName: result[index]?.deckName,
            subjectKey: result[index]?.subjectKey,
          },
        ]),
      );
    };
    const first = merge(base);
    const second = merge(reordered);
    expect(second).toEqual(first);
    expect(first['independent-known-math']).toEqual({
      deckId: 'independent-deck-math',
      deckName: '用户锁定的极限专题',
      subjectKey: '数学',
    });
  });

  test('fails closed on subject/deck/ordinal/topic/evidence/confidence/schema drift', () => {
    const source = PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (source === undefined) throw new Error('missing Organizer snapshot');
    const projection = projectionFor(source);
    const decision = organizerDecisionFor(source);
    const invalid = [
      {
        ...decision,
        decisions: decision.decisions.map((entry, index) =>
          index === 0 ? { ...entry, subject: 'math' as const } : entry,
        ),
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry, index) =>
          index === 1
            ? { ...entry, deck: { action: 'reuse_existing' as const, deckIndex: 0 } }
            : entry,
        ),
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry) => ({ ...entry, questionIndex: 0 })),
      },
      {
        decisions: [
          {
            questionIndex: 0,
            subject: 'keep_local',
            deck: { action: 'create_topic', topicLabel: '未分类' },
            confidence: 'high',
            evidenceCodes: ['structured_subject'],
          },
        ],
      },
      {
        ...decision,
        decisions: decision.decisions.map((entry, index) =>
          index === 0 ? { ...entry, evidenceCodes: ['structured_subject'] as const } : entry,
        ),
      },
      {
        decisions: [
          {
            questionIndex: 1,
            subject: 'computer',
            deck: { action: 'create_topic', topicLabel: '缺页中断协同' },
            confidence: 'high',
            evidenceCodes: ['insufficient_signal'],
          },
        ],
      },
      { ...decision, extra: 'forbidden' },
    ] as const;
    for (const candidate of invalid) {
      expect(
        validateWrongQuestionOrganizerModelDecisionV4(candidate, decisionContext(projection.value))
          .ok,
      ).toBe(false);
    }

    const driftedAuthorities = projection.questionAuthoritiesByOrdinal.map((entry, index) =>
      index === 0 ? { ...entry, subjectHint: 'unknown' as const, subject: null } : entry,
    );
    expect(
      mergeWrongQuestionOrganizerModelDecision({
        items: itemsFor(source),
        projection: projection.value,
        questionIdsByOrdinal: projection.questionIdsByOrdinal,
        deckIdsByOrdinal: projection.deckIdsByOrdinal,
        questionAuthoritiesByOrdinal: driftedAuthorities,
        deckAuthoritiesByOrdinal: projection.deckAuthoritiesByOrdinal,
        decision,
      }),
    ).toBeNull();
  });

  test('uses one call with no retry, preserves input bytes, and fails closed on abort or budget exhaustion', async () => {
    const fixture = PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (fixture === undefined) throw new Error('missing Organizer snapshot');
    const source = modelEligibleSource(fixture);
    const inputBytes = JSON.stringify(source);
    const { requests, runtime } = trackedRuntime(createTopicDecisionFor(source));
    const applied = await runWrongQuestionOrganizerModelCandidate(organizerInput(source, runtime));
    expect(requests).toHaveLength(1);
    expect(applied.observation.disposition).toBe('candidate_applied');
    expect(JSON.stringify(source)).toBe(inputBytes);
    expect(JSON.stringify(applied)).not.toMatch(/write|mutation|command|database/i);

    const abortedController = new AbortController();
    abortedController.abort('parent_aborted');
    const abortedRuntime = trackedRuntime(createTopicDecisionFor(source));
    const aborted = await runWrongQuestionOrganizerModelCandidate(
      organizerInput(source, abortedRuntime.runtime, abortedController.signal),
    );
    expect(abortedRuntime.requests).toHaveLength(0);
    expect(aborted.observation.disposition).toBe('fallback_aborted');

    let invalidCalls = 0;
    const invalidRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>() {
        invalidCalls += 1;
        return {
          ok: false,
          code: 'SCHEMA_INVALID',
          budget: Object.freeze({
            maxCalls: 1,
            usedCalls: 1,
            maxInputTokens: 3_500,
            usedInputTokens: 100,
            maxOutputTokens: 800,
            usedOutputTokens: 10,
          }),
          usage: null,
          trace: null,
        } as Awaited<ReturnType<ModelAgentRuntime['invokeStructured']>>;
      },
    };
    const failed = await runWrongQuestionOrganizerModelCandidate(
      organizerInput(source, invalidRuntime),
    );
    expect(invalidCalls).toBe(1);
    expect(failed.observation.disposition).toBe('fallback_runtime_error');
  });

  test('finds no frozen case, expected, accepted-label, or oracle leak in actual V4 prompts', async () => {
    const tutorFixture = PHASE_6_9_7_V4_TUTOR_RELATION_FIXTURES[0];
    const fixture = PHASE_6_9_7_V4_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (tutorFixture === undefined || fixture === undefined) throw new Error('missing fixtures');
    const source = modelEligibleSource(fixture);
    const tutorRuntime = trackedRuntime({
      intent: 'socratic_hint',
      depth: 'standard',
      confidence: 'high',
      evidenceCodes: ['implicit_hint_request'],
    });
    await runTutorModelCandidate(
      tutorInput({
        runtime: tutorRuntime.runtime,
        latestUserText: tutorFixture.utterances[0],
        activeStudyContext: tutorFixture.contexts[0],
      }),
    );
    const organizerRuntime = trackedRuntime(createTopicDecisionFor(source));
    await runWrongQuestionOrganizerModelCandidate(organizerInput(source, organizerRuntime.runtime));
    const tutorRequest = tutorRuntime.requests[0];
    const organizerRequest = organizerRuntime.requests[0];
    if (tutorRequest === undefined || organizerRequest === undefined) {
      throw new Error('expected captured V4 requests');
    }
    expect(sha256Text(tutorRequest.systemPrompt)).toBe(PHASE_6_9_7_TUTOR_PROMPT_CONTENT_SHA256_V4);
    expect(sha256Text(organizerRequest.systemPrompt)).toBe(
      PHASE_6_9_7_ORGANIZER_PROMPT_CONTENT_SHA256_V4,
    );
    const promptBytes = [
      tutorRequest.systemPrompt,
      tutorRequest.userPrompt,
      organizerRequest.systemPrompt,
      organizerRequest.userPrompt,
    ].join('\n');
    const forbidden = new Set<string>([
      PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
      PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      'canonicalTopicLabel',
      'acceptedTopicLabels',
      'tutorExpected',
      'organizerDecisions',
      ...PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((entry) => entry.id),
      ...PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.flatMap((entry) =>
        entry.subset === 'runtime' && entry.agent === 'wrong_question_organizer'
          ? entry.expected.decisions.flatMap((decision) => [
              decision.canonicalTopicLabel,
              ...decision.acceptedTopicLabels,
            ])
          : [],
      ),
    ]);
    expect(
      [...forbidden].filter((token) => token.length > 1 && promptBytes.includes(token)),
    ).toEqual([]);
    const contaminated = `${promptBytes}\n${PHASE_6_9_TUTOR_WRONG_QUESTION_CASES[0]?.id}\nacceptedTopicLabels`;
    expect([...forbidden].some((token) => token.length > 1 && contaminated.includes(token))).toBe(
      true,
    );
  });
});

function sha256Text(value: string): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
