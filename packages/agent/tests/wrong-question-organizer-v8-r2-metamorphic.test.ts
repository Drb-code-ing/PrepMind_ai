import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import { runWrongQuestionOrganizerV8ModelCandidate } from '../src/model-candidates/wrong-question-organizer-v8-model-candidate.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD,
  PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
} from './fixtures/phase-6-9-tutor-wrong-question-v8-r2-provider-shapes-v1.ts';

describe('Phase 6.9.7 V8 R2 held-out metamorphic authority', () => {
  test('binds the bilingual held-out source to manually frozen local ordinals', () => {
    const authority = authorityFor(PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE);
    expect(authority.shortlistFingerprint).toBe(
      PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD.shortlistFingerprint,
    );
    expect(authority.questions.map((entry) => entry.questionId)).toEqual([
      'v8-r2-heldout-question-calculus-bilingual',
      'v8-r2-heldout-question-database-unicode',
      'v8-r2-heldout-question-taxonomy-mixed',
    ]);
    expect(authority.questions.map((entry) => entry.structuredSubject)).toEqual([
      'math',
      'computer',
      null,
    ]);
    expect(authority.questions[2]?.subjectCandidates).toEqual(['english', 'computer']);
    expect(authority.questions[1]?.topicCandidates.map((entry) => entry.label)).toEqual([
      'leftmost-prefix',
      '联合索引',
      '数据库索引',
      'ordering',
    ]);
    expect(authority.decks.map((entry) => [entry.deckIndex, entry.subject])).toEqual([
      [0, 'math'],
      [1, 'english'],
      [2, 'computer'],
    ]);
  });

  test('is invariant to source, keyword, and knowledge-point reorder', async () => {
    const original = PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE;
    const reordered: WrongQuestionOrganizerV5ShortlistSource = {
      ...original,
      questions: [...original.questions].reverse().map((question) => ({
        ...question,
        knowledgePoints:
          question.knowledgePoints === undefined
            ? undefined
            : [...question.knowledgePoints].reverse(),
      })),
      decks: [...original.decks].reverse().map((deck) => ({
        ...deck,
        keywords: deck.keywords === undefined ? undefined : [...deck.keywords].reverse(),
      })),
    };
    expect(authorityFor(reordered).shortlistFingerprint).toBe(
      authorityFor(original).shortlistFingerprint,
    );

    const firstRuntime = trackedRuntime(PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD);
    const secondRuntime = trackedRuntime(PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD);
    const first = await runCandidate(original, firstRuntime.runtime, () => original);
    const second = await runCandidate(reordered, secondRuntime.runtime, () => reordered);

    expect(firstRuntime.requests).toHaveLength(1);
    expect(secondRuntime.requests).toHaveLength(1);
    expect(first.observation.disposition).toBe('candidate_applied');
    expect(second.observation.disposition).toBe('candidate_applied');
    expect(canonicalize(first.result.suggestions)).toEqual(canonicalize(second.result.suggestions));
  });

  test('keeps owner and shortlist changes behind pre/post stale fences with zero retry', async () => {
    const source = PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE;
    const stale: WrongQuestionOrganizerV5ShortlistSource = {
      ...source,
      ownerSnapshotFingerprint: `sha256:${'9'.repeat(64)}`,
    };
    let zeroCallCount = 0;
    const neverRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        zeroCallCount += 1;
        throw new Error('V8_R2_PRE_FENCE_ZERO_CALL_VIOLATION');
      },
    };
    const pre = await runCandidate(source, neverRuntime, () => stale);
    expect(pre.observation.disposition).toBe('fallback_invalid_input');
    expect(pre.observation.reasonCodes).toContain('stale_shortlist');
    expect(zeroCallCount).toBe(0);

    let fence = 0;
    const postRuntime = trackedRuntime(PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD);
    const post = await runCandidate(source, postRuntime.runtime, () => {
      fence += 1;
      return fence === 1 ? source : stale;
    });
    expect(postRuntime.requests).toHaveLength(1);
    expect(fence).toBe(2);
    expect(post.observation.disposition).toBe('fallback_invalid_input');
    expect(post.observation.reasonCodes).toContain('stale_shortlist');
    expect(
      post.result.suggestions.every((entry) => entry.selection.source === 'deterministic'),
    ).toBe(true);
  });

  test('never repairs a static-pass dynamic failure or merges its V6 transport sentinel', async () => {
    const invalid = {
      ...PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD,
      decisions: PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD.decisions.map((decision, index) =>
        index === 1 ? { ...decision, targetIndex: 19 } : decision,
      ),
    };
    const tracked = trackedRuntime(invalid);
    const result = await runCandidate(
      PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
      tracked.runtime,
      () => PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
    );

    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.disposition).toBe('fallback_schema_invalid');
    expect(result.observation.reasonCodes).toContain('topic_index_out_of_range');
    expect(result.boundedSchemaDiagnostic?.reason).toBe('dynamic_authority');
    expect(
      result.result.suggestions.every((entry) => entry.selection.source === 'deterministic'),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(`sha256:${'0'.repeat(64)}`);
  });

  test('rebuilds locked names, confidence, and real IDs locally without prompt leakage', async () => {
    const tracked = trackedRuntime(PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD);
    const result = await runCandidate(
      PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
      tracked.runtime,
      () => PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
    );
    const request = tracked.requests[0];
    if (!request) throw new Error('V8_R2_PROMPT_REQUEST_MISSING');
    expect(request.systemPrompt).toContain('confidence');
    expect(request.systemPrompt).toContain('write command');
    expect(request.userPrompt).not.toMatch(/confidence|matchedDeckId|writeCommand|ownerDomain/);
    for (const privateId of [
      ...PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.questions.map((entry) => entry.id),
      ...PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.decks.map((entry) => entry.id),
    ]) {
      expect(request.userPrompt).not.toContain(privateId);
    }

    const byId = new Map(result.result.suggestions.map((entry) => [entry.questionId, entry]));
    const math = byId.get('v8-r2-heldout-question-calculus-bilingual');
    const computer = byId.get('v8-r2-heldout-question-database-unicode');
    const english = byId.get('v8-r2-heldout-question-taxonomy-mixed');
    expect(math?.organization.deckName).toBe('用户锁定的极限专题');
    expect(math?.organization.matchedDeckId).toBe('v8-r2-heldout-deck-math-private');
    expect(computer?.organization.deckName).toBe('leftmost-prefix');
    expect(computer?.organization.matchedDeckId).toBeUndefined();
    expect(english?.organization.deckName).toBe('作者态度与阅读推断');
    expect(english?.organization.matchedDeckId).toBe('v8-r2-heldout-deck-english-private');
    expect(
      result.result.suggestions.every(
        (entry) =>
          entry.selection.source === 'model_ordinal' && entry.selection.confidence !== undefined,
      ),
    ).toBe(true);
  });
});

function authorityFor(source: WrongQuestionOrganizerV5ShortlistSource) {
  const result = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-v8-r2-zero-network',
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

function runCandidate(
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  revalidateSource: () => unknown,
) {
  return runWrongQuestionOrganizerV8ModelCandidate({
    runId: 'phase-6-9-7-v8-r2-metamorphic',
    shortlistSource: source,
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 3_500,
      maxOutputTokens: 800,
    }),
    revalidateSource,
  });
}

function canonicalize(
  suggestions: Awaited<
    ReturnType<typeof runWrongQuestionOrganizerV8ModelCandidate>
  >['result']['suggestions'],
) {
  return suggestions
    .map((entry) => ({
      questionId: entry.questionId,
      subject: entry.organization.subjectKey,
      deckName: entry.organization.deckName,
      matchedDeckId: entry.organization.matchedDeckId,
      selection: entry.selection,
    }))
    .sort((left, right) => left.questionId.localeCompare(right.questionId));
}
