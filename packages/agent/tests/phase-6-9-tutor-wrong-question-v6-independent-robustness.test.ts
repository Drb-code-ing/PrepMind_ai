import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  phase697V2OrganizerCases,
  phase697V2TutorCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256 } from '../src/evals/phase-6-9-tutor-wrong-question-v2-baseline.ts';
import { buildTutorStrategy } from '../src/nodes/tutor.ts';
import {
  mergeTutorV6ModelDecision,
  runTutorV6ModelCandidate,
  type TutorV6ModelCandidateInput,
} from '../src/model-candidates/tutor-v6-model-candidate.ts';
import { projectTutorV6ModelInput } from '../src/model-candidates/tutor-v6-model-projection.ts';
import {
  runWrongQuestionOrganizerV6ModelCandidate,
  type WrongQuestionOrganizerV6ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import type { WrongQuestionOrganizerV6ModelDecision } from '../src/model-candidates/wrong-question-organizer-v6-model-contract.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_VERSION,
  PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES,
  PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES,
  PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES,
} from './fixtures/phase-6-9-tutor-wrong-question-v6-independent-robustness-v1.ts';

type OrganizerFixture = (typeof PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES)[number];

describe('Phase 6.9.7 V6 independent robustness', () => {
  test('freezes independent fixture bytes and keeps them outside the V2 dataset authority', () => {
    expect(PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-v6-independent-robustness-v1',
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256).toBe(
      '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b',
    );
    expect(PHASE_6_9_7_V5_DETERMINISTIC_BASELINE_SHA256).toBe(
      '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca',
    );
    expect(
      `sha256:${createHash('sha256')
        .update(
          JSON.stringify({
            tutor: PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES,
            tutorBoundaries: PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES,
            organizer: PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES,
          }),
          'utf8',
        )
        .digest('hex')}`,
    ).toBe(PHASE_6_9_7_V6_INDEPENDENT_ROBUSTNESS_SHA256);
    expect(isDeeplyFrozen(PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES)).toBe(true);

    const v2Ids = new Set(
      [...phase697V2TutorCases, ...phase697V2OrganizerCases].map((entry) => entry.id),
    );
    const heldOutIds = [
      ...PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES.map((entry) => entry.id),
      ...PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES.map((entry) => entry.id),
      ...PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES.map((entry) => entry.id),
    ];
    expect(heldOutIds.every((id) => !v2Ids.has(id))).toBe(true);
  });

  test('preserves all five Tutor intents across bilingual, mixed, negated, quoted, and context variants', async () => {
    for (const fixture of PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES) {
      const semanticResults: Array<
        Readonly<{ intent: string; depth: string; contextUse: boolean }>
      > = [];
      for (const latestUserText of fixture.utterances) {
        for (const activeStudyContext of fixture.contexts) {
          const projected = tutorProjection(latestUserText, activeStudyContext);
          const choice = projected.prompt.eligibleIntents.find(
            (entry) => entry.intent === fixture.expectedIntent,
          );
          expect(choice, `${fixture.id}:${latestUserText}`).toBeDefined();
          if (!choice) throw new Error(`TUTOR_V6_HELDOUT_INTENT_MISSING:${fixture.id}`);
          const preferred = projected.preferredDepthAuthority.choices.find(
            (entry) => entry.intent === fixture.expectedIntent,
          );
          if (!preferred) throw new Error(`TUTOR_V6_HELDOUT_DEPTH_MISSING:${fixture.id}`);
          const tracked = trackedRuntime({ intentIndex: choice.intentIndex });
          const result = await runTutorV6ModelCandidate(
            tutorCandidateInput(latestUserText, activeStudyContext, tracked.runtime),
          );
          expect(tracked.requests, `${fixture.id}:${latestUserText}`).toHaveLength(1);
          expect(result.observation.disposition, fixture.id).toBe('candidate_applied');
          expect(result.result.intent, fixture.id).toBe(fixture.expectedIntent);
          expect(result.result.depth, fixture.id).toBe(preferred.preferredDepth);
          expect(result.result.shouldUseActiveStudyContext, fixture.id).toBe(
            activeStudyContext !== null,
          );
          semanticResults.push({
            intent: result.result.intent,
            depth: result.result.depth,
            contextUse: result.result.shouldUseActiveStudyContext,
          });
        }
      }
      expect(new Set(semanticResults.map((entry) => entry.intent))).toEqual(
        new Set([fixture.expectedIntent]),
      );
    }
  });

  test('keeps unknown and quoted-only Tutor signals provider-zero-call', async () => {
    for (const fixture of PHASE_6_9_7_V6_TUTOR_BOUNDARY_FIXTURES) {
      const result = await runTutorV6ModelCandidate(
        tutorCandidateInput(fixture.latestUserText, fixture.activeStudyContext, neverRuntime()),
      );
      expect(result.observation.attempted, fixture.id).toBe(false);
      expect(result.observation.disposition, fixture.id).toBe('not_eligible');
      expect(result.observation.reasonCodes, fixture.id).toContain(fixture.expectedReason);
    }
  });

  test('binds text mutations and authority drift without changing local preferred strategy authority', () => {
    const fixture = PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES[2];
    if (!fixture) throw new Error('TUTOR_V6_MUTATION_FIXTURE_MISSING');
    const first = tutorProjection(fixture.utterances[0], fixture.contexts[1]);
    const second = tutorProjection(fixture.utterances[1], fixture.contexts[1]);
    expect(first.signalAuthority.authoritySha256).not.toBe(second.signalAuthority.authoritySha256);
    expect(first.preferredDepthAuthority.authoritySha256).toBe(
      second.preferredDepthAuthority.authoritySha256,
    );

    const choice = first.prompt.eligibleIntents.find(
      (entry) => entry.intent === fixture.expectedIntent,
    );
    if (!choice) throw new Error('TUTOR_V6_MUTATION_CHOICE_MISSING');
    const drifted = structuredClone(first.preferredDepthAuthority);
    drifted.authoritySha256 = '0'.repeat(64);
    expect(
      mergeTutorV6ModelDecision({
        deterministic: buildTutorStrategy({
          latestUserText: fixture.utterances[0],
          activeStudyContext: fixture.contexts[1] ?? undefined,
        }),
        signalAuthority: first.signalAuthority,
        preferredDepthAuthority: drifted,
        decision: { intentIndex: choice.intentIndex },
      }),
    ).toBeNull();
  });

  test('keeps six-subject Organizer overlap, confidence, locked names, and output stable on reorder', async () => {
    const fixture = PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (!fixture) throw new Error('ORGANIZER_V6_HELDOUT_FIXTURE_MISSING');
    const source = fixture.source as WrongQuestionOrganizerV5ShortlistSource;
    const reordered: WrongQuestionOrganizerV5ShortlistSource = {
      ...source,
      questions: [...source.questions].reverse(),
      decks: [...source.decks].reverse(),
    };
    const first = await executeOrganizerFixture(fixture, source);
    const second = await executeOrganizerFixture(fixture, reordered);
    expect(first.authority.shortlistFingerprint).toBe(second.authority.shortlistFingerprint);
    expect(canonicalSuggestions(first.result.result.suggestions)).toEqual(
      canonicalSuggestions(second.result.result.suggestions),
    );
    for (const expected of fixture.expectations) {
      const suggestion = first.result.result.suggestions.find(
        (entry) => entry.questionId === expected.questionId,
      );
      expect(suggestion, expected.questionId).toBeDefined();
      expect(suggestion!.organization.subjectKey, expected.questionId).toBe(expected.subject);
      expect(suggestion!.organization.matchedDeckId, expected.questionId).toBe(expected.deckId);
      expect(suggestion!.selection.source, expected.questionId).toBe('model_ordinal');
      if (suggestion!.selection.source !== 'model_ordinal') {
        throw new Error(`ORGANIZER_V6_HELDOUT_SELECTION_MISSING:${expected.questionId}`);
      }
      expect(suggestion!.selection.confidence, expected.questionId).toBe(expected.confidence);
      const sourceDeck = source.decks.find((entry) => entry.id === expected.deckId);
      expect(suggestion!.organization.deckName, expected.questionId).toBe(sourceDeck?.name);
    }
  });

  test('fails closed on Organizer owner drift and snapshot ABA with zero retry', async () => {
    const fixture = PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (!fixture) throw new Error('ORGANIZER_V6_ABA_FIXTURE_MISSING');
    const source = fixture.source as WrongQuestionOrganizerV5ShortlistSource;
    const authority = organizerAuthority(source);
    const decision = organizerDecision(fixture, authority);

    const preRuntime = trackedRuntime(decision);
    const pre = await runWrongQuestionOrganizerV6ModelCandidate(
      organizerCandidateInput(source, preRuntime.runtime, () => ({
        ...source,
        ownerDomain: `hmac-sha256:${'3'.repeat(64)}`,
      })),
    );
    expect(preRuntime.requests).toHaveLength(0);
    expect(pre.observation.reasonCodes).toContain('stale_shortlist');

    let fence = 0;
    const postRuntime = trackedRuntime(decision);
    const post = await runWrongQuestionOrganizerV6ModelCandidate(
      organizerCandidateInput(source, postRuntime.runtime, () => {
        fence += 1;
        return fence === 1
          ? source
          : {
              ...source,
              ownerSnapshotFingerprint: `sha256:${'4'.repeat(64)}`,
            };
      }),
    );
    expect(fence).toBe(2);
    expect(postRuntime.requests).toHaveLength(1);
    expect(post.observation.disposition).toBe('fallback_invalid_input');
    expect(post.observation.reasonCodes).toContain('stale_shortlist');
  });

  test('recursively detects no V2 oracle or source-ID leak in actual prompts and catches contamination', async () => {
    const tutorFixture = PHASE_6_9_7_V6_TUTOR_RELATION_FIXTURES[0];
    const organizerFixture = PHASE_6_9_7_V6_ORGANIZER_SNAPSHOT_FIXTURES[0];
    if (!tutorFixture || !organizerFixture) throw new Error('V6_PROMPT_FIXTURE_MISSING');
    const tutorProjected = tutorProjection(tutorFixture.utterances[0], tutorFixture.contexts[1]);
    const tutorChoice = tutorProjected.prompt.eligibleIntents.find(
      (entry) => entry.intent === tutorFixture.expectedIntent,
    );
    if (!tutorChoice) throw new Error('V6_PROMPT_TUTOR_CHOICE_MISSING');
    const tutorRuntime = trackedRuntime({ intentIndex: tutorChoice.intentIndex });
    await runTutorV6ModelCandidate(
      tutorCandidateInput(
        tutorFixture.utterances[0],
        tutorFixture.contexts[1],
        tutorRuntime.runtime,
      ),
    );
    const organizerExecution = await executeOrganizerFixture(
      organizerFixture,
      organizerFixture.source as WrongQuestionOrganizerV5ShortlistSource,
    );
    const tutorRequest = tutorRuntime.requests[0];
    const organizerRequest = organizerExecution.requests[0];
    if (!tutorRequest || !organizerRequest) throw new Error('V6_PROMPT_REQUEST_MISSING');

    const promptTree = {
      tutor: {
        system: tutorRequest.systemPrompt,
        user: JSON.parse(tutorRequest.userPrompt),
      },
      organizer: {
        system: organizerRequest.systemPrompt,
        user: JSON.parse(organizerRequest.userPrompt),
      },
    };
    const forbidden = [
      PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
      'pairedRunIndex',
      'expectedRuntimeInvocations',
      'canonicalTopicLabel',
      'acceptedTopicLabels',
      'expectedIntent',
      'expectations',
      'tutor-model-candidate-v1',
      'tutor-model-candidate-v2',
      'tutor-model-candidate-v3',
      'tutor-model-candidate-v4',
      'tutor-model-candidate-v5',
      'wrong-question-organizer-model-candidate-v1',
      'wrong-question-organizer-model-candidate-v2',
      'wrong-question-organizer-model-candidate-v3',
      'wrong-question-organizer-model-candidate-v4',
      'wrong-question-organizer-model-candidate-v5',
      ...phase697V2TutorCases.map((entry) => entry.id),
      ...phase697V2OrganizerCases.map((entry) => entry.id),
      ...organizerFixture.source.questions.map((entry) => entry.id),
      ...organizerFixture.source.decks.map((entry) => entry.id),
    ];
    expect(findForbiddenStrings(promptTree, forbidden)).toEqual([]);

    const contaminated = {
      promptTree,
      nested: [{ oracle: { acceptedTopicLabels: [phase697V2OrganizerCases[0]!.id] } }],
    };
    expect(findForbiddenStrings(contaminated, forbidden)).toEqual(
      expect.arrayContaining(['acceptedTopicLabels', phase697V2OrganizerCases[0]!.id]),
    );
  });
});

function tutorProjection(latestUserText: string, activeStudyContext: string | null) {
  const projected = projectTutorV6ModelInput({
    latestUserText,
    ...(activeStudyContext === null ? {} : { activeStudyContext }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(activeStudyContext === null ? {} : { activeStudyContext: 'safe_for_model' as const }),
    },
  });
  if (!projected.ok) throw new Error(`TUTOR_V6_HELDOUT_PROJECTION_FAILED:${projected.reasonCode}`);
  return projected.value;
}

function tutorCandidateInput(
  latestUserText: string,
  activeStudyContext: string | null,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
): TutorV6ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-v6-r2-independent-tutor-no-network',
    finalRoute: 'tutor',
    latestUserText,
    ...(activeStudyContext === null ? {} : { activeStudyContext }),
    deterministic: buildTutorStrategy({
      latestUserText,
      ...(activeStudyContext === null ? {} : { activeStudyContext }),
    }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(activeStudyContext === null ? {} : { activeStudyContext: 'safe_for_model' as const }),
    },
    runtime,
    budget: createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 }),
  };
}

function organizerAuthority(source: WrongQuestionOrganizerV5ShortlistSource) {
  const authority = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!authority.ok)
    throw new Error(`ORGANIZER_V6_HELDOUT_SHORTLIST_FAILED:${authority.reasonCode}`);
  return authority.value;
}

function organizerDecision(
  fixture: OrganizerFixture,
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV6ModelDecision {
  const expectationByQuestion = new Map(
    fixture.expectations.map((entry) => [entry.questionId, entry]),
  );
  return {
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: authority.questions.map((question) => {
      const expected = expectationByQuestion.get(question.questionId);
      if (!expected)
        throw new Error(`ORGANIZER_V6_HELDOUT_EXPECTATION_MISSING:${question.questionId}`);
      const deck = authority.decks.find((entry) => entry.foldedDeckIds.includes(expected.deckId));
      if (!deck) throw new Error(`ORGANIZER_V6_HELDOUT_DECK_MISSING:${expected.deckId}`);
      const subjectIndex = question.subjectCandidates.indexOf(expected.subject);
      if (question.structuredSubject === null && subjectIndex < 0) {
        throw new Error(`ORGANIZER_V6_HELDOUT_SUBJECT_MISSING:${question.questionId}`);
      }
      return {
        questionIndex: question.questionIndex,
        subjectDecision:
          question.structuredSubject === null
            ? ({ action: 'select_subject', subjectIndex } as const)
            : ({ action: 'keep_local' } as const),
        deckDecision: { action: 'reuse_existing', deckIndex: deck.deckIndex } as const,
      };
    }),
  };
}

function organizerCandidateInput(
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  revalidateSource: () => unknown | Promise<unknown> = () => source,
): WrongQuestionOrganizerV6ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-v6-r2-independent-organizer-no-network',
    shortlistSource: source,
    runtime,
    budget: createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 }),
    revalidateSource,
  };
}

async function executeOrganizerFixture(
  fixture: OrganizerFixture,
  source: WrongQuestionOrganizerV5ShortlistSource,
) {
  const authority = organizerAuthority(source);
  const tracked = trackedRuntime(organizerDecision(fixture, authority));
  const result = await runWrongQuestionOrganizerV6ModelCandidate(
    organizerCandidateInput(source, tracked.runtime),
  );
  expect(tracked.requests).toHaveLength(1);
  expect(result.observation.disposition).toBe('candidate_applied');
  return { authority, result, requests: tracked.requests };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v6-r2-independent-no-network',
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
      throw new Error('V6_HELDOUT_ZERO_CALL_GUARD_VIOLATED');
    },
  };
}

function canonicalSuggestions(
  suggestions: readonly Readonly<{
    questionId: string;
    organization: Readonly<{
      subjectKey: string;
      deckName: string;
      matchedDeckId?: string;
      confidence: number;
    }>;
  }>[],
) {
  return Object.fromEntries(
    suggestions.map((entry) => [
      entry.questionId,
      {
        subject: entry.organization.subjectKey,
        deckName: entry.organization.deckName,
        deckId: entry.organization.matchedDeckId,
        confidence: entry.organization.confidence,
      },
    ]),
  );
}

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return (
    Object.isFrozen(value) && Object.values(value).every((child) => isDeeplyFrozen(child, seen))
  );
}

function findForbiddenStrings(value: unknown, forbidden: readonly string[]) {
  const strings: string[] = [];
  collectStrings(value, strings, new Set<object>());
  return [
    ...new Set(
      forbidden.filter((token) => token.length > 1 && strings.some((text) => text.includes(token))),
    ),
  ];
}

function collectStrings(value: unknown, target: string[], seen: Set<object>): void {
  if (typeof value === 'string') {
    target.push(value);
    return;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, target, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    target.push(key);
    collectStrings(child, target, seen);
  }
}
