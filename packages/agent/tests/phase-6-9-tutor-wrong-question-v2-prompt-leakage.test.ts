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
  computeTutorWrongQuestionDatasetSha256,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1,
  PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1,
  PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2,
} from '../src/evals/phase-6-9-tutor-wrong-question-paired-contract.ts';
import { runTutorModelCandidate } from '../src/model-candidates/tutor-model-candidate.ts';
import { formatTutorModelIntentPolicyForPrompt } from '../src/model-candidates/tutor-model-contract.ts';
import { runWrongQuestionOrganizerModelCandidate } from '../src/model-candidates/wrong-question-organizer-model-candidate.ts';
import { formatWrongQuestionOrganizerAssociationPolicyForPrompt } from '../src/model-candidates/wrong-question-organizer-model-contract.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  PHASE_6_9_7_V2_ORGANIZER_SUBJECT_FIXTURES,
  PHASE_6_9_7_V2_TUTOR_ROBUSTNESS_FIXTURES,
} from './fixtures/phase-6-9-tutor-wrong-question-v2-robustness.ts';

type PromptLeak = Readonly<{
  category: 'case_id' | 'dataset_identity' | 'oracle_key' | 'oracle_value' | 'fixture_oracle';
  token: string;
}>;

const FROZEN_DATASET_SHA256 = '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e';

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v2-prompt-leakage-fixture',
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

function unique(values: readonly string[]) {
  return [...new Set(values.filter((value) => value.length >= 2))];
}

function findPromptLeaks(prompt: string): readonly PromptLeak[] {
  const leaks: PromptLeak[] = [];
  const addMatches = (category: PromptLeak['category'], tokens: readonly string[]) => {
    for (const token of unique(tokens)) {
      if (prompt.includes(token)) leaks.push({ category, token });
    }
  };

  addMatches(
    'case_id',
    PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((testCase) => testCase.id),
  );
  addMatches('dataset_identity', [
    PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
    PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  ]);
  addMatches('oracle_key', [
    'pairedRunIndex',
    'expectedRuntimeInvocations',
    'canonicalTopicLabel',
    'acceptedTopicLabels',
    'tutorExpected',
    'organizerDecisions',
  ]);
  addMatches(
    'oracle_value',
    PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.flatMap((testCase) => {
      const values = [JSON.stringify(testCase.expected)];
      if (testCase.subset === 'runtime' && testCase.agent === 'wrong_question_organizer') {
        values.push(
          ...testCase.expected.decisions.flatMap((decision) => [
            decision.canonicalTopicLabel,
            ...decision.acceptedTopicLabels,
          ]),
        );
      }
      return values;
    }),
  );
  addMatches('fixture_oracle', [
    ...PHASE_6_9_7_V2_TUTOR_ROBUSTNESS_FIXTURES.map((fixture) => fixture.id),
    ...PHASE_6_9_7_V2_ORGANIZER_SUBJECT_FIXTURES.flatMap((fixture) => [
      fixture.id,
      fixture.topicLabel,
    ]),
  ]);
  return leaks;
}

async function captureTutorRequest() {
  const fixture = PHASE_6_9_7_V2_TUTOR_ROBUSTNESS_FIXTURES[0];
  if (fixture === undefined) throw new Error('missing Tutor robustness fixture');
  const latestUserText = fixture.variants[0];
  const activeStudyContext = fixture.contextVariants[0];
  const { requests, runtime } = trackedRuntime(fixture.decision);
  const deterministic = buildTutorStrategy({ latestUserText, activeStudyContext });
  const result = await runTutorModelCandidate({
    runId: 'phase-6-9-7-v2-prompt-leakage-tutor',
    finalRoute: 'tutor',
    latestUserText,
    activeStudyContext,
    deterministic,
    safety: {
      latestUserText: 'safe_for_model',
      activeStudyContext: 'safe_for_model',
    },
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 1_200,
      maxOutputTokens: 300,
    }),
  });
  expect(result.observation.disposition).toBe('candidate_applied');
  expect(requests).toHaveLength(1);
  const request = requests[0];
  if (request === undefined) throw new Error('missing Tutor request');
  return request;
}

async function captureOrganizerRequest() {
  const fixture = PHASE_6_9_7_V2_ORGANIZER_SUBJECT_FIXTURES[0];
  if (fixture === undefined) throw new Error('missing Organizer robustness fixture');
  const questionId = 'robustness-question-prompt-scan';
  const projectionQuestion = {
    questionId,
    subject: null,
    subjectHint: 'unknown' as const,
    category: null,
    knowledgePoints: [],
    errorType: null,
    questionText: fixture.questionText,
    analysis: '这是独立 held-out 的语义分类输入。',
    answer: null,
    userNote: null,
    safety: 'safe_for_model' as const,
  };
  const { requests, runtime } = trackedRuntime({
    decisions: [
      {
        questionIndex: 0,
        subject: fixture.subject,
        deck: { action: 'create_topic', topicLabel: fixture.topicLabel },
        confidence: 'medium',
        evidenceCodes: ['semantic_topic'],
      },
    ],
  });
  const result = await runWrongQuestionOrganizerModelCandidate({
    runId: 'phase-6-9-7-v2-prompt-leakage-organizer',
    items: [
      {
        deterministicInput: {
          wrongQuestion: {
            id: questionId,
            subject: null,
            category: null,
            knowledgePoints: [],
            errorType: null,
            questionText: fixture.questionText,
            analysis: projectionQuestion.analysis,
            answer: null,
            userNote: null,
          },
          existingDecks: [],
        },
        hasExistingItem: false,
      },
    ],
    force: false,
    ownerEligible: true,
    snapshotCurrent: true,
    projectionSource: { questions: [projectionQuestion], existingDecks: [] },
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 3_500,
      maxOutputTokens: 800,
    }),
  });
  expect(result.observation.disposition).toBe('candidate_applied');
  expect(requests).toHaveLength(1);
  const request = requests[0];
  if (request === undefined) throw new Error('missing Organizer request');
  return { request, questionId };
}

describe('Phase 6.9.7 V2 prompt leakage and frozen authority', () => {
  test('detects deliberate oracle contamination but finds none in actual V2 candidate prompts', async () => {
    const frozenOrganizerCase = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
      (testCase) => testCase.subset === 'runtime' && testCase.agent === 'wrong_question_organizer',
    );
    if (
      frozenOrganizerCase === undefined ||
      frozenOrganizerCase.subset !== 'runtime' ||
      frozenOrganizerCase.agent !== 'wrong_question_organizer'
    ) {
      throw new Error('missing frozen Organizer runtime case');
    }
    const frozenLabel = frozenOrganizerCase.expected.decisions[0]?.canonicalTopicLabel;
    if (frozenLabel === undefined) throw new Error('missing frozen Organizer label');

    const contaminated = [frozenOrganizerCase.id, frozenLabel, 'acceptedTopicLabels'].join('\n');
    expect(findPromptLeaks(contaminated)).toEqual(
      expect.arrayContaining([
        { category: 'case_id', token: frozenOrganizerCase.id },
        { category: 'oracle_value', token: frozenLabel },
        { category: 'oracle_key', token: 'acceptedTopicLabels' },
      ]),
    );

    const tutorRequest = await captureTutorRequest();
    const { request: organizerRequest, questionId } = await captureOrganizerRequest();
    const actualPromptBytes = [
      tutorRequest.systemPrompt,
      tutorRequest.userPrompt,
      organizerRequest.systemPrompt,
      organizerRequest.userPrompt,
    ].join('\n');
    expect(findPromptLeaks(actualPromptBytes)).toEqual([]);
    expect(actualPromptBytes).not.toContain(questionId);
    expect(actualPromptBytes).not.toContain('nameLocked');
  });

  test('keeps formatter bytes stable without exporting frozen case or fixture oracles', () => {
    const tutorPrompt = formatTutorModelIntentPolicyForPrompt();
    const organizerPrompt = formatWrongQuestionOrganizerAssociationPolicyForPrompt();
    expect(tutorPrompt).toBe(formatTutorModelIntentPolicyForPrompt());
    expect(organizerPrompt).toBe(formatWrongQuestionOrganizerAssociationPolicyForPrompt());
    expect(findPromptLeaks(`${tutorPrompt}\n${organizerPrompt}`)).toEqual([]);
  });

  test('keeps the 72-case authority byte-identical and outside the robustness suite', () => {
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES).toHaveLength(72);
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256).toBe(FROZEN_DATASET_SHA256);
    expect(computeTutorWrongQuestionDatasetSha256(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES)).toBe(
      FROZEN_DATASET_SHA256,
    );
    const frozenIds = new Set(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((testCase) => testCase.id));
    expect(
      PHASE_6_9_7_V2_TUTOR_ROBUSTNESS_FIXTURES.every((fixture) => !frozenIds.has(fixture.id)),
    ).toBe(true);
    expect(
      PHASE_6_9_7_V2_ORGANIZER_SUBJECT_FIXTURES.every((fixture) => !frozenIds.has(fixture.id)),
    ).toBe(true);
  });

  test('keeps the legacy public runner identity on V1 after adding an isolated V2 entry', () => {
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION).toBe(
      PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V1,
    );
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION).not.toBe(
      PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V2,
    );
    expect(PHASE_6_9_7_TUTOR_PROMPT_VERSION).toBe(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V1);
    expect(PHASE_6_9_7_TUTOR_PROMPT_VERSION).not.toBe(PHASE_6_9_7_TUTOR_PROMPT_VERSION_V2);
    expect(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION).toBe(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V1);
    expect(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION).not.toBe(PHASE_6_9_7_ORGANIZER_PROMPT_VERSION_V2);
  });
});
