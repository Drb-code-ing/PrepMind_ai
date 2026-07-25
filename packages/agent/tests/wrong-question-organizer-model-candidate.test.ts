import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  reserveModelAgentBudget,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  mergeWrongQuestionOrganizerModelDecision,
  runWrongQuestionOrganizerModelCandidate,
  runWrongQuestionOrganizerModelCandidateV2,
  type WrongQuestionOrganizerModelCandidateInput,
  type WrongQuestionOrganizerModelCandidateItem,
} from '../src/model-candidates/wrong-question-organizer-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
  formatWrongQuestionOrganizerAssociationPolicyForPrompt,
} from '../src/model-candidates/wrong-question-organizer-model-contract.ts';
import {
  phase69WrongQuestionOrganizerCases,
  type OrganizerSubject,
  type Phase69OrganizerRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';

function candidateBudget() {
  return createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: 3_500,
    maxOutputTokens: 800,
  });
}

function trackedRuntime(output: unknown | (() => unknown)) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'wrong-question-organizer-candidate-test',
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => (typeof output === 'function' ? output() : output),
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      requests.push(request as ModelAgentRequest<unknown>);
      return inner.invokeStructured(request);
    },
  };
  return { requests, runtime };
}

function baseQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'question-1',
    subject: null,
    category: null,
    knowledgePoints: [],
    errorType: null,
    questionText: '利用等价无穷小判断这个极限。',
    analysis: '需要识别极限变形。',
    answer: null,
    userNote: null,
    ...overrides,
  };
}

function baseDeck(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deck-1',
    name: '函数极限',
    nameLocked: true,
    keywords: ['洛必达', '等价无穷小'],
    ...overrides,
  };
}

function candidateItem(
  overrides: Partial<WrongQuestionOrganizerModelCandidateItem> = {},
): WrongQuestionOrganizerModelCandidateItem {
  const deck = baseDeck();
  return {
    deterministicInput: {
      wrongQuestion: baseQuestion(),
      existingDecks: [deck],
    },
    hasExistingItem: false,
    ...overrides,
  } as WrongQuestionOrganizerModelCandidateItem;
}

function projectionSource(overrides: Record<string, unknown> = {}) {
  return {
    questions: [
      {
        questionId: 'question-1',
        subject: null,
        subjectHint: 'unknown',
        category: null,
        knowledgePoints: [],
        errorType: null,
        questionText: '利用等价无穷小判断这个极限。',
        analysis: '需要识别极限变形。',
        answer: null,
        userNote: null,
        safety: 'safe_for_model',
      },
    ],
    existingDecks: [
      {
        deckId: 'deck-1',
        subject: 'math',
        name: '函数极限',
        nameLocked: true,
        keywords: ['洛必达', '等价无穷小'],
        safety: 'safe_for_model',
      },
    ],
    ...overrides,
  };
}

function candidateInput(
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Partial<WrongQuestionOrganizerModelCandidateInput> = {},
): WrongQuestionOrganizerModelCandidateInput {
  return {
    runId: 'wrong-question-organizer-candidate-run',
    items: [candidateItem()],
    force: false,
    ownerEligible: true,
    snapshotCurrent: true,
    projectionSource: projectionSource(),
    runtime,
    budget: candidateBudget(),
    ...overrides,
  };
}

describe('Phase 6.9.7 governed WrongQuestionOrganizer model candidate', () => {
  test('uses one bounded batch call and rebuilds real IDs and locked names locally', async () => {
    const secondQuestion = baseQuestion({
      id: 'question-2',
      subject: '英语',
      questionText: '根据上下文判断作者态度。',
      analysis: '需要结合语气词。',
    });
    const lockedDeck = baseDeck({
      id: 'deck-english',
      name: '阅读推断（用户锁定）',
      keywords: ['作者态度'],
    });
    const output = {
      decisions: [
        {
          questionIndex: 0,
          subject: 'math',
          deck: { action: 'create_topic', topicLabel: '函数极限' },
          confidence: 'medium',
          evidenceCodes: ['semantic_topic'],
        },
        {
          questionIndex: 1,
          subject: 'keep_local',
          deck: { action: 'reuse_existing', deckIndex: 0 },
          confidence: 'high',
          evidenceCodes: ['structured_subject', 'existing_deck_overlap'],
        },
      ],
    } as const;
    const { requests, runtime } = trackedRuntime(output);
    const input = candidateInput(runtime, {
      items: [
        candidateItem({
          deterministicInput: {
            wrongQuestion: baseQuestion(),
            existingDecks: [lockedDeck],
          },
        }),
        candidateItem({
          deterministicInput: {
            wrongQuestion: secondQuestion,
            existingDecks: [lockedDeck],
          },
        }),
      ],
      projectionSource: {
        questions: [
          projectionSource().questions[0],
          {
            questionId: 'question-2',
            subject: '英语',
            subjectHint: 'english',
            category: null,
            knowledgePoints: [],
            errorType: null,
            questionText: '根据上下文判断作者态度。',
            analysis: '需要结合语气词。',
            answer: null,
            userNote: null,
            safety: 'safe_for_model',
          },
        ],
        existingDecks: [
          {
            deckId: 'deck-english',
            subject: 'english',
            name: '阅读推断（用户锁定）',
            nameLocked: true,
            keywords: ['作者态度'],
            safety: 'safe_for_model',
          },
        ],
      },
    });

    const result = await runWrongQuestionOrganizerModelCandidate(input);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      task: 'wrong_question_organization',
      maxOutputTokens: 800,
    });
    expect(requests[0]?.systemPrompt).toContain(WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION);
    expect(requests[0]?.systemPrompt).toContain(
      formatWrongQuestionOrganizerAssociationPolicyForPrompt(),
    );
    expect(requests[0]?.systemPrompt).not.toMatch(
      /question-1|question-2|deck-english|expectedSubject|canonicalTopicLabel|acceptedTopicLabels/i,
    );
    expect(JSON.stringify(requests[0]?.userPrompt)).not.toMatch(
      /question-1|question-2|deck-english|nameLocked|writeCommand/i,
    );
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.result).toHaveLength(2);
    expect(result.result[0]).toMatchObject({
      subjectKey: '数学',
      subjectDisplayName: '数学',
      deckName: '函数极限',
    });
    expect(result.result[1]).toMatchObject({
      subjectKey: '英语',
      matchedDeckId: 'deck-english',
      deckName: '阅读推断（用户锁定）',
    });
    expect(JSON.stringify(result.result)).not.toMatch(/writeCommand|delete|upsert/i);
  });

  test('keeps Task 4 local eligibility and safety boundaries provider-zero-call', async () => {
    const scenarios: readonly {
      name: string;
      mutate: (
        input: WrongQuestionOrganizerModelCandidateInput,
      ) => WrongQuestionOrganizerModelCandidateInput;
      expectedDisposition: string;
    }[] = [
      {
        name: 'existing item',
        mutate: (input) => ({
          ...input,
          items: [{ ...input.items[0]!, hasExistingItem: true }],
        }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'exact structured deck match',
        mutate: (input) => ({
          ...input,
          items: [
            candidateItem({
              deterministicInput: {
                wrongQuestion: baseQuestion({
                  subject: '数学',
                  knowledgePoints: ['函数极限'],
                }),
                existingDecks: [baseDeck()],
              },
            }),
          ],
          projectionSource: projectionSource({
            questions: [
              {
                ...projectionSource().questions[0],
                subject: '数学',
                subjectHint: 'math',
                knowledgePoints: ['函数极限'],
              },
            ],
          }),
        }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'high-confidence knowledge point',
        mutate: (input) => ({
          ...input,
          items: [
            candidateItem({
              deterministicInput: {
                wrongQuestion: baseQuestion({
                  subject: '数学',
                  knowledgePoints: ['导数应用'],
                }),
                existingDecks: [],
              },
            }),
          ],
          projectionSource: projectionSource({
            questions: [
              {
                ...projectionSource().questions[0],
                subject: '数学',
                subjectHint: 'math',
                knowledgePoints: ['导数应用'],
              },
            ],
            existingDecks: [],
          }),
        }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'high-confidence category and error type',
        mutate: (input) => ({
          ...input,
          items: [
            candidateItem({
              deterministicInput: {
                wrongQuestion: baseQuestion({
                  subject: '数学',
                  category: '导数',
                  errorType: '符号错误',
                }),
                existingDecks: [],
              },
            }),
          ],
          projectionSource: projectionSource({
            questions: [
              {
                ...projectionSource().questions[0],
                subject: '数学',
                subjectHint: 'math',
                category: '导数',
                errorType: '符号错误',
              },
            ],
            existingDecks: [],
          }),
        }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'owner ineligible',
        mutate: (input) => ({ ...input, ownerEligible: false }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'stale snapshot',
        mutate: (input) => ({ ...input, snapshotCurrent: false }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'pre-aborted request',
        mutate: (input) => {
          const controller = new AbortController();
          controller.abort();
          return { ...input, signal: controller.signal };
        },
        expectedDisposition: 'fallback_aborted',
      },
      {
        name: 'insufficient budget',
        mutate: (input) => ({
          ...input,
          budget: createModelAgentBudget({
            maxCalls: 1,
            maxInputTokens: 1,
            maxOutputTokens: 800,
          }),
        }),
        expectedDisposition: 'fallback_budget_exceeded',
      },
      {
        name: 'missing semantic body',
        mutate: (input) => ({
          ...input,
          projectionSource: projectionSource({
            questions: [
              {
                ...projectionSource().questions[0],
                questionText: null,
                analysis: null,
              },
            ],
          }),
        }),
        expectedDisposition: 'not_eligible',
      },
      {
        name: 'credential material',
        mutate: (input) => ({
          ...input,
          projectionSource: projectionSource({
            questions: [
              {
                ...projectionSource().questions[0],
                userNote: 'api_key=sk-1234567890abcdef1234567890abcdef',
              },
            ],
          }),
        }),
        expectedDisposition: 'safety_blocked',
      },
    ];

    for (const scenario of scenarios) {
      const { requests, runtime } = trackedRuntime({
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'create_topic', topicLabel: '函数极限' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
          },
        ],
      });
      const input = scenario.mutate(candidateInput(runtime));
      const result = await runWrongQuestionOrganizerModelCandidate(input);
      expect(requests, scenario.name).toHaveLength(0);
      expect(result.observation.disposition, scenario.name).toBe(scenario.expectedDisposition);
    }
  });

  test('rejects hostile projection accessors without reading them', async () => {
    let getterCalls = 0;
    const source = projectionSource();
    const question = { ...source.questions[0] } as Record<string, unknown>;
    Object.defineProperty(question, 'questionText', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'must not read';
      },
    });
    const { requests, runtime } = trackedRuntime({ decisions: [] });
    const result = await runWrongQuestionOrganizerModelCandidate(
      candidateInput(runtime, {
        projectionSource: { ...source, questions: [question] },
      }),
    );

    expect(requests).toHaveLength(0);
    expect(getterCalls).toBe(0);
    expect(result.observation.disposition).toBe('fallback_invalid_input');
  });

  test.each([
    [
      'partial batch',
      {
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'create_topic', topicLabel: '函数极限' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
          },
        ],
      },
    ],
    [
      'duplicate question decision',
      {
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'create_topic', topicLabel: '函数极限' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
          },
          {
            questionIndex: 0,
            subject: 'english',
            deck: { action: 'create_topic', topicLabel: '阅读推断' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
          },
        ],
      },
    ],
    [
      'cross-subject deck',
      {
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'reuse_existing', deckIndex: 0 },
            confidence: 'high',
            evidenceCodes: ['existing_deck_overlap'],
          },
          {
            questionIndex: 1,
            subject: 'keep_local',
            deck: { action: 'reuse_existing', deckIndex: 0 },
            confidence: 'high',
            evidenceCodes: ['structured_subject', 'existing_deck_overlap'],
          },
        ],
      },
    ],
    [
      'unsafe topic and write command',
      {
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'create_topic', topicLabel: 'https://evil.test' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
            writeCommand: 'upsert',
          },
          {
            questionIndex: 1,
            subject: 'keep_local',
            deck: { action: 'reuse_existing', deckIndex: 0 },
            confidence: 'high',
            evidenceCodes: ['structured_subject', 'existing_deck_overlap'],
          },
        ],
      },
    ],
  ] as const)('falls back the whole batch for %s', async (_name, output) => {
    const secondQuestion = baseQuestion({
      id: 'question-2',
      subject: '英语',
      questionText: '判断作者态度。',
    });
    const englishDeck = baseDeck({ id: 'deck-english', name: '阅读推断' });
    const { requests, runtime } = trackedRuntime(output);
    const input = candidateInput(runtime, {
      items: [
        candidateItem({
          deterministicInput: { wrongQuestion: baseQuestion(), existingDecks: [] },
        }),
        candidateItem({
          deterministicInput: {
            wrongQuestion: secondQuestion,
            existingDecks: [englishDeck],
          },
        }),
      ],
      projectionSource: {
        questions: [
          projectionSource().questions[0],
          {
            ...projectionSource().questions[0],
            questionId: 'question-2',
            subject: '英语',
            subjectHint: 'english',
            questionText: '判断作者态度。',
          },
        ],
        existingDecks: [
          {
            ...projectionSource().existingDecks[0],
            deckId: 'deck-english',
            subject: 'english',
            name: '阅读推断',
          },
        ],
      },
    });
    const local = input.items.map((item) => item.deterministicInput);

    const result = await runWrongQuestionOrganizerModelCandidate(input);

    expect(requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('fallback_schema_invalid');
    expect(result.result.map((entry) => entry.subjectKey)).toEqual(
      local.map((entry) => entry.wrongQuestion.subject?.trim() || '其他'),
    );
  });

  test('drops a successful candidate when the request aborts during runtime', async () => {
    const controller = new AbortController();
    const { requests, runtime } = trackedRuntime(() => {
      controller.abort();
      return {
        decisions: [
          {
            questionIndex: 0,
            subject: 'math',
            deck: { action: 'create_topic', topicLabel: '函数极限' },
            confidence: 'medium',
            evidenceCodes: ['semantic_topic'],
          },
        ],
      };
    });

    const result = await runWrongQuestionOrganizerModelCandidate(
      candidateInput(runtime, { signal: controller.signal }),
    );

    expect(requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('fallback_aborted');
    expect(result.result[0]?.subjectKey).toBe('其他');
  });

  test('falls back for timeout, unverifiable usage, and a thrown runtime without retrying', async () => {
    const timeoutRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const reservation = reserveModelAgentBudget(request.budget, {
          inputTokens: request.estimatedInputTokens,
          outputTokens: request.maxOutputTokens,
        });
        if (!reservation.ok) throw new Error(reservation.code);
        return {
          ok: false,
          error: { code: 'TIMEOUT', message: 'unsafe raw timeout', retryable: true },
          budget: reservation.budget,
          usage: { inputTokens: 0, outputTokens: 0 },
          trace: {
            runIdHash: `sha256:${'0'.repeat(64)}`,
            task: 'wrong_question_organization',
            mode: 'mock',
            provider: 'mock',
            model: 'organizer-timeout-test',
            status: 'failed',
            inputTokens: 0,
            outputTokens: 0,
            maxOutputTokens: 800,
            durationMs: 1,
            degraded: true,
            errorCode: 'TIMEOUT',
          },
        };
      },
    };
    const malformedUsageRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured<T>(request: ModelAgentRequest<T>) {
        const reservation = reserveModelAgentBudget(request.budget, {
          inputTokens: request.estimatedInputTokens,
          outputTokens: request.maxOutputTokens,
        });
        if (!reservation.ok) throw new Error(reservation.code);
        return {
          ok: true,
          data: {
            decisions: [
              {
                questionIndex: 0,
                subject: 'math',
                deck: { action: 'create_topic', topicLabel: '函数极限' },
                confidence: 'medium',
                evidenceCodes: ['semantic_topic'],
              },
            ],
          } as T,
          budget: reservation.budget,
          usage: { inputTokens: 1, outputTokens: 801 },
          trace: {
            runIdHash: `sha256:${'1'.repeat(64)}`,
            task: 'wrong_question_organization',
            mode: 'mock',
            provider: 'mock',
            model: 'organizer-usage-test',
            status: 'succeeded',
            inputTokens: 1,
            outputTokens: 801,
            maxOutputTokens: 800,
            durationMs: 1,
            degraded: false,
          },
        };
      },
    };
    const thrownRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        throw new Error('unsafe raw provider error');
      },
    };

    const results = await Promise.all(
      [timeoutRuntime, malformedUsageRuntime, thrownRuntime].map((runtime) =>
        runWrongQuestionOrganizerModelCandidate(candidateInput(runtime)),
      ),
    );

    expect(results.map((result) => result.observation.disposition)).toEqual([
      'fallback_timeout',
      'fallback_runtime_error',
      'fallback_runtime_error',
    ]);
    expect(results.every((result) => result.result[0]?.subjectKey === '其他')).toBe(true);
    expect(results[1]?.observation).toMatchObject({
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
    });
    expect(results[2]?.observation).toMatchObject({
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
    });
  });

  test('keeps the frozen 24 Organizer runtime fixtures on the explicit V2 candidate', async () => {
    const runtimeCases = phase69WrongQuestionOrganizerCases.filter(
      (fixture): fixture is Phase69OrganizerRuntimeCase => fixture.subset === 'runtime',
    );
    expect(runtimeCases).toHaveLength(24);

    for (const fixture of runtimeCases) {
      const output = {
        decisions: fixture.expected.decisions.map((expected, index) => ({
          questionIndex: index,
          subject: fixture.input.questions[index]?.subject?.trim()
            ? ('keep_local' as const)
            : expected.subject,
          deck:
            expected.deckAction === 'reuse_existing'
              ? ({ action: 'reuse_existing', deckIndex: expected.deckIndex } as const)
              : ({
                  action: 'create_topic',
                  topicLabel: expected.canonicalTopicLabel,
                } as const),
          confidence: expected.confidence,
          evidenceCodes: expected.requiredEvidenceCodes,
        })),
      };
      const { requests, runtime } = trackedRuntime(output);
      const result = await runWrongQuestionOrganizerModelCandidateV2(
        candidateInput(runtime, organizerFixtureInput(fixture)),
      );

      expect(requests, fixture.id).toHaveLength(1);
      expect(result.observation.disposition, fixture.id).toBe('candidate_applied');
      fixture.expected.decisions.forEach((expected, index) => {
        const actual = result.result[index];
        expect(inferSubject(actual?.subjectKey ?? ''), fixture.id).toBe(expected.subject);
        if (expected.deckAction === 'reuse_existing') {
          expect(actual?.matchedDeckId, fixture.id).toBe(
            fixture.input.existingDecks[expected.deckIndex ?? -1]?.id,
          );
        } else {
          expect(expected.acceptedTopicLabels.map(normalizeLabel), fixture.id).toContain(
            normalizeLabel(actual?.deckName ?? ''),
          );
        }
      });
    }
  });

  test('pure merger rejects ordinal maps that do not belong to the local inputs', () => {
    const decision = {
      decisions: [
        {
          questionIndex: 0,
          subject: 'math',
          deck: { action: 'reuse_existing', deckIndex: 0 },
          confidence: 'high',
          evidenceCodes: ['existing_deck_overlap'],
        },
      ],
    } as const;
    expect(
      mergeWrongQuestionOrganizerModelDecision({
        items: [candidateItem()],
        projection: {
          version: 'wrong-question-organizer-model-projection-v1',
          questions: [{ ordinal: 'q0', subjectHint: 'unknown', knowledgePoints: [] }],
          decks: [
            {
              ordinal: 'd0',
              subject: 'math',
              name: '函数极限',
              keywords: [],
            },
          ],
        },
        questionIdsByOrdinal: ['foreign-question'],
        deckIdsByOrdinal: ['foreign-deck'],
        questionAuthoritiesByOrdinal: [{ questionId: 'foreign-question', subject: null }],
        deckAuthoritiesByOrdinal: [
          {
            deckId: 'foreign-deck',
            subject: 'math',
            name: '函数极限',
            nameLocked: true,
            keywords: [],
          },
        ],
        decision,
      }),
    ).toBeNull();
  });
});

function organizerFixtureInput(
  fixture: Phase69OrganizerRuntimeCase,
): Partial<WrongQuestionOrganizerModelCandidateInput> {
  return {
    runId: fixture.id,
    items: fixture.input.questions.map((question) => ({
      deterministicInput: {
        wrongQuestion: {
          id: question.id,
          subject: question.subject ?? null,
          category: question.category ?? null,
          knowledgePoints: question.knowledgePoints ?? [],
          errorType: question.errorType ?? null,
          questionText: question.questionText ?? null,
          analysis: question.analysis ?? null,
          answer: question.answer ?? null,
          userNote: question.userNote ?? null,
        },
        existingDecks: fixture.input.existingDecks.map((deck) => ({
          id: deck.id,
          name: deck.name,
          nameLocked: deck.nameLocked ?? false,
          keywords: deck.keywords ?? [],
        })),
      },
      hasExistingItem: question.hasExistingItem,
    })),
    force: fixture.input.force,
    ownerEligible: fixture.input.questions.every(
      (question) => question.ownerRef === fixture.input.requestOwnerRef,
    ),
    snapshotCurrent: true,
    projectionSource: {
      questions: fixture.input.questions.map((question) => ({
        questionId: question.id,
        subject: question.subject ?? null,
        subjectHint: question.subject?.trim()
          ? inferSubject(question.subject)
          : ('unknown' as const),
        category: question.category ?? null,
        knowledgePoints: question.knowledgePoints ?? [],
        errorType: question.errorType ?? null,
        questionText: question.questionText ?? null,
        analysis: question.analysis ?? null,
        answer: question.answer ?? null,
        userNote: question.userNote ?? null,
        safety: 'safe_for_model' as const,
      })),
      existingDecks: fixture.input.existingDecks.map((deck) => ({
        deckId: deck.id,
        subject: deck.subjectKey,
        name: deck.name,
        nameLocked: deck.nameLocked ?? false,
        keywords: deck.keywords ?? [],
        safety: 'safe_for_model' as const,
      })),
    },
  };
}

function inferSubject(value: string): OrganizerSubject {
  const normalized = normalizeLabel(value).replace(/\s+/gu, '');
  if (normalized === 'math' || normalized.includes('数学')) return 'math';
  if (normalized === 'english' || normalized.includes('英语')) return 'english';
  if (normalized === 'politics' || normalized.includes('政治')) return 'politics';
  if (normalized === 'computer' || normalized.includes('计算机')) return 'computer';
  if (normalized === 'major' || normalized.includes('专业课')) return 'major';
  return 'other';
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, '');
}
