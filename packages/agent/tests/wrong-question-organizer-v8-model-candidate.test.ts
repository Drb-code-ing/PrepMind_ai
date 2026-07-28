import { createHash } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  phase697V2OrganizerCases,
  type Phase697V2OrganizerRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  runWrongQuestionOrganizerV8ModelCandidate,
  type WrongQuestionOrganizerV8ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v8-model-candidate.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA,
  WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION,
  validateWrongQuestionOrganizerV8ModelDecision,
  type WrongQuestionOrganizerV8ModelDecision,
} from '../src/model-candidates/wrong-question-organizer-v8-model-contract.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';

describe('Phase 6.9.7 WrongQuestionOrganizer V8 candidate adapter', () => {
  test('uses the V8 schema and prompt while preserving V6 budget, trace, stale fences, and merger', async () => {
    const runtimeCase = firstRuntimeCase();
    const source = sourceFromV2(runtimeCase);
    const authority = authorityFor(source);
    const decision = validDecision(authority);
    const tracked = trackedRuntime(decision);
    const result = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, tracked.runtime),
    );

    expect(tracked.requests).toHaveLength(1);
    const request = tracked.requests[0]!;
    expect(request.schema).not.toBe(WRONG_QUESTION_ORGANIZER_V8_MODEL_DECISION_SCHEMA);
    expect(request.schema.safeParse(decision).success).toBe(true);
    expect(
      request.schema.safeParse({
        ...decision,
        decisions: decision.decisions.map((entry) => ({
          questionIndex: entry.questionIndex,
          subjectDecision: { action: 'keep_local' },
          deckDecision: { action: 'reuse_existing', deckIndex: entry.targetIndex },
        })),
      }).success,
    ).toBe(false);
    expect(request.systemPrompt).toContain('subjectIndex:null');
    expect(request.systemPrompt).toContain('targetIndex');
    expect(request.systemPrompt).not.toContain(runtimeCase.id);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.observation.attempted).toBe(true);
    expect(result.result.binding?.candidateVersion).toBe(
      WRONG_QUESTION_ORGANIZER_V8_MODEL_PROMPT_VERSION,
    );
    expect(
      result.result.suggestions.every((entry) => entry.selection.source === 'model_ordinal'),
    ).toBe(true);
    expect(result.boundedSchemaDiagnostic).toBeNull();
    if (!result.observation.attempted || !('trace' in result.observation)) {
      throw new Error('ORGANIZER_V8_TRACE_MISSING');
    }
    expect(result.observation.trace?.task).toBe('wrong_question_organization');
    expect(result.observation.trace?.model).toBe('phase-6-9-7-organizer-v8-r1-no-network');
    expect(result.observation.budget.usedCalls).toBe(1);
  });

  test('records bounded static and dynamic diagnostics without retaining model values', async () => {
    const source = sourceFromV2(firstRuntimeCase());
    const authority = authorityFor(source);
    const valid = validDecision(authority);
    const nestedV6Shape = {
      shortlistFingerprint: valid.shortlistFingerprint,
      decisions: valid.decisions.map((entry) => ({
        questionIndex: entry.questionIndex,
        subjectDecision:
          entry.subjectIndex === null
            ? { action: 'keep_local', note: 'sk-static-secret' }
            : { action: 'select_subject', subjectIndex: entry.subjectIndex },
        deckDecision:
          entry.deckAction === 'reuse_existing'
            ? { action: 'reuse_existing', deckIndex: entry.targetIndex }
            : { action: 'create_topic', topicIndex: entry.targetIndex },
      })),
    };
    const staticResult = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, trackedRuntime(nestedV6Shape).runtime),
    );
    expect(staticResult.observation.disposition).toBe('fallback_schema_invalid');
    expect(staticResult.boundedSchemaDiagnostic?.reason).toBe('decision_keys');
    expect(JSON.stringify(staticResult.boundedSchemaDiagnostic)).not.toMatch(/sk-static|leaked/);

    const dynamicResult = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(
        source,
        trackedRuntime({
          ...valid,
          shortlistFingerprint: `sha256:${'0'.repeat(64)}`,
        }).runtime,
      ),
    );
    expect(dynamicResult.observation.disposition).toBe('fallback_schema_invalid');
    expect(dynamicResult.observation.reasonCodes).toContain('shortlist_fingerprint_mismatch');
    expect(dynamicResult.boundedSchemaDiagnostic?.reason).toBe('dynamic_authority');
    expect(dynamicResult.boundedSchemaDiagnostic?.rawDataRetained).toBe(false);

    const conditionalDecision: WrongQuestionOrganizerV8ModelDecision = {
      ...valid,
      decisions: valid.decisions.map((entry, index) =>
        index === 0 ? { ...entry, deckAction: 'create_topic' as const, targetIndex: 19 } : entry,
      ),
    };
    const conditionalValidation = validateWrongQuestionOrganizerV8ModelDecision({
      decision: conditionalDecision,
      authority,
    });
    if (conditionalValidation.ok) {
      throw new Error('ORGANIZER_V8_CONDITIONAL_BOUND_EXPECTED_FAILURE');
    }
    const conditionalBoundResult = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, trackedRuntime(conditionalDecision).runtime),
    );
    expect(conditionalBoundResult.observation.disposition).toBe('fallback_schema_invalid');
    expect(conditionalBoundResult.observation.reasonCodes).toContain(
      conditionalValidation.reasonCode,
    );
    expect(conditionalBoundResult.boundedSchemaDiagnostic?.reason).toBe('dynamic_authority');
  });

  test('keeps invalid runtime, pre-abort, and stale source provider-zero-call', async () => {
    const source = sourceFromV2(firstRuntimeCase());
    let calls = 0;
    const neverRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        calls += 1;
        throw new Error('zero-call guard violated');
      },
    };
    const aborted = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, neverRuntime, { signal: AbortSignal.abort() }),
    );
    expect(aborted.observation.disposition).toBe('fallback_aborted');
    expect(calls).toBe(0);

    const stale = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, neverRuntime, {
        revalidateSource: () => ({
          ...source,
          ownerSnapshotFingerprint: `sha256:${'e'.repeat(64)}`,
        }),
      }),
    );
    expect(stale.observation.reasonCodes).toContain('stale_shortlist');
    expect(calls).toBe(0);

    const hostileRuntime = {} as Pick<ModelAgentRuntime, 'invokeStructured'>;
    Object.defineProperty(hostileRuntime, 'invokeStructured', {
      get() {
        calls += 1;
        throw new Error('hostile runtime getter');
      },
    });
    const hostile = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, hostileRuntime),
    );
    expect(hostile.observation.attempted).toBe(false);
    expect(hostile.observation.disposition).toBe('fallback_invalid_input');
    expect(calls).toBe(0);
  });

  test('never delegates a rejected V8 runtime to the legacy V6 schema', async () => {
    const source = sourceFromV2(firstRuntimeCase());
    class PrototypeRuntime {
      calls = 0;

      async invokeStructured() {
        this.calls += 1;
        throw new Error('legacy V6 schema must remain zero-call');
      }
    }
    const runtime = new PrototypeRuntime();
    const rejected = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, runtime),
    );

    expect(rejected.observation.attempted).toBe(false);
    expect(rejected.observation.disposition).toBe('fallback_invalid_input');
    expect(rejected.result.suggestions.length).toBeGreaterThan(0);
    expect(runtime.calls).toBe(0);
  });

  test('fails malformed runtime envelopes and post-runtime abort closed after one call', async () => {
    const source = sourceFromV2(firstRuntimeCase());
    let malformedCalls = 0;
    const malformed = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(source, {
        async invokeStructured() {
          malformedCalls += 1;
          return { ok: true, data: { leaked: 'Bearer secret' } } as never;
        },
      }),
    );
    expect(malformedCalls).toBe(1);
    expect(malformed.observation.disposition).toBe('fallback_runtime_error');
    expect(malformed.boundedSchemaDiagnostic?.reason).toBe('unknown');
    expect(JSON.stringify(malformed.boundedSchemaDiagnostic)).not.toContain('Bearer secret');

    const controller = new AbortController();
    const authority = authorityFor(source);
    const tracked = trackedRuntime(validDecision(authority));
    const postAbort = await runWrongQuestionOrganizerV8ModelCandidate(
      candidateInput(
        source,
        {
          async invokeStructured<T>(request: ModelAgentRequest<T>) {
            const response = await tracked.runtime.invokeStructured(request);
            controller.abort('after-runtime');
            return response;
          },
        },
        { signal: controller.signal },
      ),
    );
    expect(tracked.requests).toHaveLength(1);
    expect(postAbort.observation.disposition).toBe('fallback_aborted');
  });
});

function firstRuntimeCase() {
  const runtimeCase = phase697V2OrganizerCases.find(
    (entry): entry is Phase697V2OrganizerRuntimeCase => entry.subset === 'runtime',
  );
  if (!runtimeCase) throw new Error('ORGANIZER_V8_RUNTIME_CASE_MISSING');
  return runtimeCase;
}

function candidateBudget() {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 });
}

function candidateInput(
  source: WrongQuestionOrganizerV5ShortlistSource,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Readonly<{
    signal?: AbortSignal;
    revalidateSource?: () => unknown;
  }> = {},
): WrongQuestionOrganizerV8ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-organizer-v8-r1-no-network',
    shortlistSource: source,
    runtime,
    budget: candidateBudget(),
    revalidateSource: overrides.revalidateSource ?? (() => source),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-organizer-v8-r1-no-network',
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

function authorityFor(source: WrongQuestionOrganizerV5ShortlistSource) {
  const result = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function validDecision(
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
): WrongQuestionOrganizerV8ModelDecision {
  return {
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: authority.questions.map((question) => {
      const resolvedSubject = question.structuredSubject ?? question.subjectCandidates[0];
      if (!resolvedSubject) throw new Error('ORGANIZER_V8_SUBJECT_MISSING');
      const deck = authority.decks.find((entry) => entry.subject === resolvedSubject);
      const topic = question.topicCandidates.find((entry) => entry.subject === resolvedSubject);
      const reuseEligible =
        question.eligibleDeckActions.includes('reuse_existing') && deck !== undefined;
      if (!reuseEligible && !topic) throw new Error('ORGANIZER_V8_TARGET_MISSING');
      return {
        questionIndex: question.questionIndex,
        subjectIndex:
          question.structuredSubject === null
            ? question.subjectCandidates.indexOf(resolvedSubject)
            : null,
        deckAction: reuseEligible ? ('reuse_existing' as const) : ('create_topic' as const),
        targetIndex: reuseEligible ? deck!.deckIndex : topic!.topicIndex,
      };
    }),
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
      updatedAt: '2026-07-28T08:00:00.000Z',
    })),
    decks: caseItem.input.existingDecks.map((deck) => ({
      id: deck.id,
      subject: deck.subjectKey,
      name: deck.name,
      nameLocked: deck.nameLocked,
      keywords: deck.keywords,
      updatedAt: '2026-07-28T08:00:00.000Z',
    })),
  };
}
