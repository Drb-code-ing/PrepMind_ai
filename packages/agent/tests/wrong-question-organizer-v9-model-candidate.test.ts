import { describe, expect, test } from 'bun:test';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import { deriveWrongQuestionOrganizerV5Shortlist } from '../src/model-candidates/wrong-question-organizer-v5-shortlist.ts';
import {
  runWrongQuestionOrganizerV9ModelCandidate,
  type WrongQuestionOrganizerV9ModelCandidateInput,
} from '../src/model-candidates/wrong-question-organizer-v9-model-candidate.ts';
import { WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA } from '../src/model-candidates/wrong-question-organizer-v9-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  buildWrongQuestionOrganizerV9PromptParts,
} from '../src/model-candidates/wrong-question-organizer-v9-model-projection.ts';
import { deriveWrongQuestionOrganizerV9OptionAuthority } from '../src/model-candidates/wrong-question-organizer-v9-option-authority.ts';
import {
  createV9R1OverBudgetSource,
  createV9R1Source,
  createV9R1ZeroOptionSource,
} from './fixtures/phase-6-9-wrong-question-organizer-v9-r1.ts';

describe('Phase 6.9.7 WrongQuestionOrganizer V9 candidate', () => {
  test('uses the exact V9 request and applies the locally resolved option through V6 merger', async () => {
    const source = createV9R1Source();
    const shortlist = deriveWrongQuestionOrganizerV5Shortlist(source);
    if (!shortlist.ok) throw new Error(shortlist.reasonCode);
    const optionAuthority = deriveWrongQuestionOrganizerV9OptionAuthority(shortlist.value);
    if (!optionAuthority.ok) throw new Error(optionAuthority.reasonCode);
    const output = {
      decisions: optionAuthority.value.questions.map((question) => ({
        questionIndex: question.questionIndex,
        optionIndex: Math.min(1, question.options.length - 1),
      })),
    };
    const tracked = trackedRuntime(output);
    const result = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(source, tracked.runtime),
    );

    expect(tracked.requests).toHaveLength(1);
    const request = tracked.requests[0]!;
    expect(request.schema).not.toBe(WRONG_QUESTION_ORGANIZER_V9_MODEL_DECISION_SCHEMA);
    expect(request.schema.safeParse(output).success).toBe(true);
    expect(request.systemPrompt).toContain('optionIndex');
    expect(request.systemPrompt).not.toContain('shortlistFingerprint');
    const prompt = buildWrongQuestionOrganizerV9PromptParts(optionAuthority.value.projection);
    if (!prompt.ok) throw new Error(prompt.reasonCode);
    expect(request.userPrompt).toBe(prompt.value.userPrompt);
    expect(request.estimatedInputTokens).toBe(prompt.value.estimatedInputTokens);
    expect(result.observation.attempted).toBe(true);
    expect(result.observation.disposition).toBe('candidate_applied');
    expect(result.result.binding?.candidateVersion).toBe(
      WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
    );
    expect(
      result.result.suggestions.every((entry) => entry.selection.source === 'model_ordinal'),
    ).toBe(true);
    expect(result.boundedSchemaDiagnostic).toBeNull();
  });

  test('keeps zero-option and mandatory-budget failures provider-zero-call with local suggestions', async () => {
    let calls = 0;
    const neverRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        calls += 1;
        throw new Error('V9 zero-call boundary violated');
      },
    };
    const empty = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(createV9R1ZeroOptionSource(), neverRuntime),
    );
    expect(empty.observation.attempted).toBe(false);
    expect(empty.observation.disposition).toBe('not_eligible');
    expect(empty.observation.reasonCodes).toContain('candidate_option_authority_empty');
    expect(empty.result.binding).not.toBeNull();
    expect(empty.result.suggestions).toHaveLength(1);
    expect(empty.result.suggestions[0]!.selection.source).toBe('deterministic');

    const overBudget = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(createV9R1OverBudgetSource(), neverRuntime),
    );
    expect(overBudget.observation.attempted).toBe(false);
    expect(overBudget.observation.disposition).toBe('fallback_budget_exceeded');
    expect(overBudget.observation.reasonCodes).toContain(
      'candidate_option_authority_budget_exceeded',
    );
    expect(overBudget.result.binding).not.toBeNull();
    expect(overBudget.result.suggestions).toHaveLength(12);
    expect(calls).toBe(0);
  });

  test('fails abort, stale source, and invalid runtime closed before provider dispatch', async () => {
    const source = createV9R1Source();
    let calls = 0;
    const neverRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
      async invokeStructured() {
        calls += 1;
        throw new Error('V9 guard must remain zero-call');
      },
    };
    const aborted = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(source, neverRuntime, { signal: AbortSignal.abort() }),
    );
    expect(aborted.observation.disposition).toBe('fallback_aborted');

    const stale = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(source, neverRuntime, {
        revalidateSource: () => ({
          ...source,
          ownerSnapshotFingerprint: `sha256:${'f'.repeat(64)}`,
        }),
      }),
    );
    expect(stale.observation.reasonCodes).toContain('stale_shortlist');

    class PrototypeRuntime {
      calls = 0;

      async invokeStructured() {
        this.calls += 1;
        throw new Error('prototype runtime must not be invoked');
      }
    }
    const prototypeRuntime = new PrototypeRuntime();
    const invalid = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(source, prototypeRuntime),
    );
    expect(invalid.observation.attempted).toBe(false);
    expect(invalid.observation.disposition).toBe('fallback_invalid_input');
    expect(prototypeRuntime.calls).toBe(0);
    expect(calls).toBe(0);
  });

  test('rejects an unknown option after one call with a bounded no-raw diagnostic', async () => {
    const source = createV9R1Source();
    const tracked = trackedRuntime({ decisions: [{ questionIndex: 0, optionIndex: 23 }] });
    const result = await runWrongQuestionOrganizerV9ModelCandidate(
      candidateInput(source, tracked.runtime),
    );
    expect(tracked.requests).toHaveLength(1);
    expect(result.observation.attempted).toBe(true);
    expect(result.observation.disposition).toBe('fallback_schema_invalid');
    expect(result.observation.reasonCodes).toContain('option_index_out_of_range');
    expect(result.boundedSchemaDiagnostic?.reason).toBe('selection_authority');
    expect(result.boundedSchemaDiagnostic?.rawDataRetained).toBe(false);
    expect(Object.values(result.boundedSchemaDiagnostic ?? {}).some((value) => value === 23)).toBe(
      false,
    );
  });
});

function candidateBudget() {
  return createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 });
}

function candidateInput(
  shortlistSource: ReturnType<typeof createV9R1Source>,
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  overrides: Readonly<{
    signal?: AbortSignal;
    revalidateSource?: () => unknown;
  }> = {},
): WrongQuestionOrganizerV9ModelCandidateInput {
  return {
    runId: 'phase-6-9-7-organizer-v9-r1-zero-provider',
    shortlistSource,
    runtime,
    budget: candidateBudget(),
    revalidateSource: overrides.revalidateSource ?? (() => shortlistSource),
    ...(overrides.signal ? { signal: overrides.signal } : {}),
  };
}

function trackedRuntime(output: unknown) {
  const requests: ModelAgentRequest<unknown>[] = [];
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'phase-6-9-7-organizer-v9-r1-zero-provider',
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
