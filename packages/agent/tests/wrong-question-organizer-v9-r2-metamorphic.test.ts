import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import { runWrongQuestionOrganizerV9ModelCandidate } from '../src/model-candidates/wrong-question-organizer-v9-model-candidate.ts';
import {
  deriveWrongQuestionOrganizerV9OptionAuthority,
  type WrongQuestionOrganizerV9OptionAuthority,
} from '../src/model-candidates/wrong-question-organizer-v9-option-authority.ts';
import {
  PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD,
  PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
} from './fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts';

describe('Phase 6.9.7 V9 R2 metamorphic local option authority', () => {
  test('is invariant to question, option-source, keyword, and knowledge-point reorder', async () => {
    const original = PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE;
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
    const first = optionAuthorityFor(original);
    const second = optionAuthorityFor(reordered);

    expect(first.shortlistAuthority.shortlistFingerprint).toBe(
      second.shortlistAuthority.shortlistFingerprint,
    );
    expect(first.optionSetFingerprint).toBe(second.optionSetFingerprint);
    expect(first.projection).toEqual(second.projection);
    expect(first.questions).toEqual(second.questions);

    const firstRuntime = trackedRuntime(PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD);
    const secondRuntime = trackedRuntime({
      decisions: [...PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD.decisions].reverse(),
    });
    const firstResult = await runCandidate(original, firstRuntime.runtime, () => original);
    const secondResult = await runCandidate(reordered, secondRuntime.runtime, () => reordered);
    expect(firstRuntime.requests).toHaveLength(1);
    expect(secondRuntime.requests).toHaveLength(1);
    expect(firstResult.observation.disposition).toBe('candidate_applied');
    expect(secondResult.observation.disposition).toBe('candidate_applied');
    expect(canonicalize(firstResult.result.suggestions)).toEqual(
      canonicalize(secondResult.result.suggestions),
    );
  });

  test('folds NFKC duplicate decks and keeps locked-name collisions outside create options', () => {
    const authority = optionAuthorityFor(PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE);
    const databaseDeck = authority.shortlistAuthority.decks.find(
      (deck) => deck.normalizedName === '数据库 事务',
    );
    expect(databaseDeck).toBeDefined();
    expect(databaseDeck?.foldedDeckIds).toEqual([
      'v9-r2-heldout-deck-computer-a-private',
      'v9-r2-heldout-deck-computer-b-private',
    ]);
    expect(databaseDeck?.nameLocked).toBe(true);

    const databaseQuestion = authority.shortlistAuthority.questions.find(
      (question) => question.questionId === 'v9-r2-heldout-question-database-unicode',
    );
    if (!databaseQuestion || !databaseDeck) {
      throw new Error('V9_R2_DATABASE_AUTHORITY_MISSING');
    }
    const questionOptions = authority.questions[databaseQuestion.questionIndex]?.options ?? [];
    expect(
      questionOptions.filter(
        (option) =>
          option.deckDecision.action === 'reuse_existing' &&
          option.deckDecision.deckIndex === databaseDeck.deckIndex,
      ),
    ).toHaveLength(1);
    expect(
      questionOptions.some(
        (option) =>
          option.deckDecision.action === 'create_topic' &&
          option.projection.targetLabel?.normalize('NFKC').trim().toLowerCase() ===
            databaseDeck.normalizedName,
      ),
    ).toBe(false);
  });

  test('enforces 24/question, 144/request, token fit, and mandatory action buckets', () => {
    const single = optionAuthorityFor(createCapSource(1));
    expect(single.questions).toHaveLength(1);
    expect(single.questions[0]?.options).toHaveLength(24);
    expect(
      new Set(single.questions[0]?.options.map((option) => option.deckDecision.action)),
    ).toEqual(new Set(['reuse_existing', 'create_topic']));

    const batch = optionAuthorityFor(createCapSource(12));
    const totalOptions = batch.questions.reduce(
      (sum, question) => sum + question.options.length,
      0,
    );
    expect(batch.questions).toHaveLength(12);
    expect(batch.questions.every((question) => question.options.length <= 24)).toBe(true);
    expect(totalOptions).toBeLessThanOrEqual(144);
    expect(batch.estimatedInputTokens).toBeLessThanOrEqual(3_500);
    expect(
      batch.questions.every(
        (question) =>
          new Set(question.options.map((option) => option.deckDecision.action)).size === 2,
      ),
    ).toBe(true);

    const overBudget = deriveWrongQuestionOrganizerV9OptionAuthority(
      shortlistFor(createMandatoryOverBudgetSource()),
    );
    expect(overBudget).toEqual({
      ok: false,
      reasonCode: 'candidate_option_authority_budget_exceeded',
    });
  });

  test('keeps a valid shortlist with no legal option distinct from invalid input', () => {
    const noOptionSource: WrongQuestionOrganizerV5ShortlistSource = {
      ownerDomain: 'hmac-sha256:' + '5'.repeat(64),
      ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
      ownerSnapshotFingerprint: 'sha256:' + '6'.repeat(64),
      safety: 'safe_for_model',
      questions: [
        {
          id: 'v9-r2-no-option-question',
          subject: '其他',
          questionText: '一条没有专题信号的普通记录。',
          status: 'UNRESOLVED',
          updatedAt: '2026-07-29T11:00:00.000Z',
        },
      ],
      decks: [],
    };
    expect(deriveWrongQuestionOrganizerV9OptionAuthority(shortlistFor(noOptionSource))).toEqual({
      ok: false,
      reasonCode: 'candidate_option_authority_empty',
    });
  });
});

function shortlistFor(source: WrongQuestionOrganizerV5ShortlistSource) {
  const result = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function optionAuthorityFor(
  source: WrongQuestionOrganizerV5ShortlistSource,
): WrongQuestionOrganizerV9OptionAuthority {
  const authority = deriveWrongQuestionOrganizerV9OptionAuthority(shortlistFor(source));
  if (!authority.ok) throw new Error(authority.reasonCode);
  return authority.value;
}

function createCapSource(questionCount: 1 | 12): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: 'hmac-sha256:' + 'c'.repeat(64),
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: 'sha256:' + 'd'.repeat(64),
    safety: 'safe_for_model',
    questions: Array.from({ length: questionCount }, (_, index) => ({
      id: 'v9-r2-cap-question-' + String(index).padStart(2, '0'),
      subject: 'computer',
      category: '事务并发',
      knowledgePoints: ['隔离级别', '锁升级', '死锁检测', '日志恢复', '索引选择', '缓存一致性'],
      errorType: '并发边界',
      questionText: '判断并发事务的可见性边界 ' + index,
      analysis: '保留所有必选 action bucket。',
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T11:10:00.000Z',
    })),
    decks: Array.from({ length: 20 }, (_, index) => ({
      id: 'v9-r2-cap-deck-' + String(index).padStart(2, '0'),
      subject: 'computer',
      name: '本地并发专题 ' + String(index).padStart(2, '0'),
      nameLocked: index % 2 === 0,
      keywords: ['并发', '事务'],
      updatedAt: '2026-07-29T11:11:00.000Z',
    })),
  };
}

function createMandatoryOverBudgetSource(): WrongQuestionOrganizerV5ShortlistSource {
  return {
    ownerDomain: 'hmac-sha256:' + 'e'.repeat(64),
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: 'sha256:' + 'f'.repeat(64),
    safety: 'safe_for_model',
    questions: Array.from({ length: 12 }, (_, index) => ({
      id: 'v9-r2-mandatory-budget-question-' + String(index).padStart(2, '0'),
      subject: 'computer',
      category: '数据库事务边界',
      knowledgePoints: ['并发控制'],
      errorType: '隔离级别',
      questionText: '题'.repeat(320),
      analysis: '析'.repeat(320),
      status: 'UNRESOLVED',
      updatedAt: '2026-07-29T11:20:00.000Z',
    })),
    decks: [
      {
        id: 'v9-r2-mandatory-budget-deck',
        subject: 'computer',
        name: '本地事务专题',
        nameLocked: true,
        keywords: ['事务'],
        updatedAt: '2026-07-29T11:21:00.000Z',
      },
    ],
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

function runCandidate(
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  revalidateSource: () => unknown,
) {
  return runWrongQuestionOrganizerV9ModelCandidate({
    runId: 'phase-6-9-7-v9-r2-metamorphic',
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
    ReturnType<typeof runWrongQuestionOrganizerV9ModelCandidate>
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
