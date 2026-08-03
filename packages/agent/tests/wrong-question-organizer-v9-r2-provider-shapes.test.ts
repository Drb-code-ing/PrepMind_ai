import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
} from '@repo/ai';

import { phase697V2OrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { runWrongQuestionOrganizerV9ModelCandidate } from '../src/model-candidates/wrong-question-organizer-v9-model-candidate.ts';
import { WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA } from '../src/model-candidates/wrong-question-organizer-v9-schema-diagnostic.ts';
import {
  PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD,
  PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
  PHASE_6_9_7_V9_R2_PROVIDER_SHAPE_CASES,
  PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION,
} from './fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts';

const STATIC_REASON_BY_CASE = Object.freeze({
  'wrapper-data': 'top_level_keys',
  'wrapper-output': 'top_level_keys',
  'top-level-array': 'top_level_shape',
  'top-level-null': 'top_level_shape',
  'double-encoded-json': 'top_level_shape',
  'top-level-extra-key': 'top_level_keys',
  'decisions-null': 'decisions_type',
  'decisions-string': 'decisions_type',
  'decisions-empty': 'decisions_count',
  'decisions-over-limit': 'decisions_count',
  'decision-null-first': 'decision_shape',
  'decision-null-middle': 'decision_shape',
  'decision-null-last': 'decision_shape',
  'decision-extra-key': 'decision_keys',
  'snake-case-decision': 'decision_keys',
  'decision-missing-question-index': 'decision_keys',
  'decision-missing-option-index': 'decision_keys',
  'question-index-string': 'question_index',
  'question-index-fraction': 'question_index',
  'question-index-negative': 'question_index',
  'question-index-null': 'question_index',
  'option-index-string': 'option_index',
  'option-index-fraction': 'option_index',
  'option-index-negative': 'option_index',
  'option-index-null': 'option_index',
} as const);

const DYNAMIC_CASES = Object.freeze({
  'selection-missing-question': {
    reasonCode: 'question_count_mismatch',
    diagnostic: 'selection_coverage',
  },
  'selection-extra-question': {
    reasonCode: 'question_count_mismatch',
    diagnostic: 'selection_coverage',
  },
  'selection-duplicate-question': {
    reasonCode: 'duplicate_question_index',
    diagnostic: 'selection_coverage',
  },
  'selection-question-out-of-range': {
    reasonCode: 'question_index_out_of_range',
    diagnostic: 'selection_authority',
  },
  'selection-option-out-of-range': {
    reasonCode: 'option_index_out_of_range',
    diagnostic: 'selection_authority',
  },
} as const);

const RAW_PARSE_FAILURE_IDS = new Set(['markdown-fence', 'prose-prefix', 'bom-prefix']);
const SYNTHETIC_CREDENTIAL = 'v9-r2-local-synthetic-credential';

describe('Phase 6.9.7 V9 R2 Provider-like selection robustness', () => {
  test('freezes an independent held-out fixture without V2 IDs or answer-generation imports', async () => {
    expect(PHASE_6_9_7_V9_R2_ROBUSTNESS_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-v9-r2-provider-shapes-v1',
    );
    expect(PHASE_6_9_7_V9_R2_ROBUSTNESS_SHA256).toBe(PHASE_6_9_7_V9_R2_FROZEN_ROBUSTNESS_SHA256);
    expect(isDeeplyFrozen(PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V9_R2_PROVIDER_SHAPE_CASES)).toBe(true);

    const v2Ids = new Set(phase697V2OrganizerCases.map((entry) => entry.id));
    expect(PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.questions.every((entry) => !v2Ids.has(entry.id))).toBe(
      true,
    );
    const fixtureSource = await readFile(
      new URL(
        './fixtures/phase-6-9-tutor-wrong-question-v9-r2-provider-shapes-v1.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(fixtureSource).not.toMatch(
      /phase697V2|expected|oracle|validateWrongQuestion|runWrongQuestion|mergeWrongQuestion|model-candidate/,
    );
    expect(fixtureSource.match(/^import .*$/gmu)).toEqual([
      "import { createHash } from 'node:crypto';",
    ]);
    expect(promptDrivenContent.toString()).not.toMatch(
      /expected|oracle|validateWrongQuestion|deriveWrongQuestion|buildWrongQuestion/,
    );
  });

  test('drives a synthetic direct adapter only from the actual bounded prompt', async () => {
    const execution = await executePromptDriven();

    expect(execution.adapterProvenance).toBe('synthetic_test');
    expect(execution.fetchCalls).toBe(1);
    expect(execution.result.observation.disposition).toBe('candidate_applied');
    expect(execution.result.boundedSchemaDiagnostic).toBeNull();
    expect(execution.stages).toHaveLength(8);
    expect(execution.requestBytes).toContain('wrong-question-organizer-model-candidate-v9');
    expect(execution.responseContent).toBe(
      JSON.stringify(PHASE_6_9_7_V9_R2_CANONICAL_PROVIDER_PAYLOAD),
    );
    for (const privateValue of [
      PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.ownerDomain,
      PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.ownerSnapshotFingerprint,
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.questions.map((entry) => entry.id),
      ...PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE.decks.map((entry) => entry.id),
      SYNTHETIC_CREDENTIAL,
      'nameLocked',
    ]) {
      expect(execution.requestBytes).not.toContain(privateValue);
    }
  });

  test('accepts canonical whitespace and decision reorder without changing local results', async () => {
    const canonical = await executeCase('canonical');
    const whitespace = await executeCase('whitespace-json');
    const reordered = await executeCase('decision-order-reversed');

    for (const execution of [canonical, whitespace, reordered]) {
      expect(execution.fetchCalls).toBe(1);
      expect(execution.result.observation.disposition).toBe('candidate_applied');
      expect(execution.result.boundedSchemaDiagnostic).toBeNull();
      expect(execution.stages).toHaveLength(8);
    }
    expect(canonicalizeSuggestions(canonical.result.result.suggestions)).toEqual(
      canonicalizeSuggestions(whitespace.result.result.suggestions),
    );
    expect(canonicalizeSuggestions(canonical.result.result.suggestions)).toEqual(
      canonicalizeSuggestions(reordered.result.result.suggestions),
    );
  });

  test('rejects every parsed wrapper, type drift, missing field, and invalid integer shape', async () => {
    for (const [caseId, expectedReason] of Object.entries(STATIC_REASON_BY_CASE)) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).toBe('fallback_schema_invalid');
      expect(execution.result.boundedSchemaDiagnostic?.reason, caseId).toBe(expectedReason);
      expect(
        WRONG_QUESTION_ORGANIZER_V9_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse(
          execution.result.boundedSchemaDiagnostic,
        ).success,
        caseId,
      ).toBe(true);
      expect(execution.result.boundedSchemaDiagnostic?.rawDataRetained, caseId).toBe(false);
      expect(JSON.stringify(execution.result), caseId).not.toContain('private-shape-value');
    }
  });

  test('keeps selection coverage and local option authority as bounded dynamic failures', async () => {
    for (const [caseId, expected] of Object.entries(DYNAMIC_CASES)) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).toBe('fallback_schema_invalid');
      expect(execution.result.observation.reasonCodes, caseId).toContain(expected.reasonCode);
      expect(execution.result.boundedSchemaDiagnostic?.reason, caseId).toBe(expected.diagnostic);
      expect(
        execution.result.result.suggestions.every(
          (entry) => entry.selection.source === 'deterministic',
        ),
        caseId,
      ).toBe(true);
    }
  });

  test('fails prose and fenced non-JSON before schema without retaining raw content', async () => {
    for (const caseId of RAW_PARSE_FAILURE_IDS) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).not.toBe('candidate_applied');
      expect(execution.result.boundedSchemaDiagnostic, caseId).toBeNull();
      expect(execution.stages, caseId).not.toContain('content_parsed');
      expect(JSON.stringify(execution.result), caseId).not.toContain(contentFor(caseId));
      expect(JSON.stringify(execution.result), caseId).not.toContain(SYNTHETIC_CREDENTIAL);
    }
  });
});

async function executePromptDriven() {
  return executeSynthetic((body) => promptDrivenContent(body));
}

async function executeCase(caseId: string) {
  const content = contentFor(caseId);
  return executeSynthetic(() => content);
}

async function executeSynthetic(contentFactory: (requestBody: string) => string) {
  const stages: string[] = [];
  let fetchCalls = 0;
  let requestBytes = '';
  let responseContent = '';
  const diagnostics = createPhase697V7WireDiagnostics({
    appendStage(stage) {
      stages.push(stage);
    },
  });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: SYNTHETIC_CREDENTIAL,
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    diagnostics.capability,
    {
      fetch: async (_url, init) => {
        fetchCalls += 1;
        requestBytes = String(init?.body);
        responseContent = contentFactory(requestBytes);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: responseContent } }],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 30,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    },
  );
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 1_000,
    executor: adapter.executor,
  });
  const result = await runWrongQuestionOrganizerV9ModelCandidate({
    runId: 'phase-6-9-7-v9-r2-provider-like',
    shortlistSource: PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 3_500,
      maxOutputTokens: 800,
    }),
    revalidateSource: () => PHASE_6_9_7_V9_R2_HELD_OUT_SOURCE,
  });
  return {
    result,
    stages,
    fetchCalls,
    requestBytes,
    responseContent,
    adapterProvenance: adapter.provenance,
  };
}

function promptDrivenContent(requestBody: string) {
  const envelope = JSON.parse(requestBody) as {
    messages?: readonly Readonly<{ role?: unknown; content?: unknown }>[];
  };
  const userMessage = envelope.messages?.find((entry) => entry.role === 'user');
  if (typeof userMessage?.content !== 'string') {
    throw new Error('V9_R2_BOUNDED_USER_PROMPT_MISSING');
  }
  const projection = JSON.parse(userMessage.content) as {
    questions?: readonly Readonly<{
      questionIndex?: unknown;
      options?: readonly Readonly<{ optionIndex?: unknown }>[];
    }>[];
  };
  if (!Array.isArray(projection.questions)) {
    throw new Error('V9_R2_BOUNDED_QUESTIONS_MISSING');
  }
  return JSON.stringify({
    decisions: projection.questions.map((question) => {
      const first = question.options?.[0];
      if (typeof question.questionIndex !== 'number' || typeof first?.optionIndex !== 'number') {
        throw new Error('V9_R2_BOUNDED_OPTION_MISSING');
      }
      return {
        questionIndex: question.questionIndex,
        optionIndex: first.optionIndex,
      };
    }),
  });
}

function contentFor(caseId: string) {
  const entry = PHASE_6_9_7_V9_R2_PROVIDER_SHAPE_CASES.find((item) => item.id === caseId);
  if (!entry) throw new Error('V9_R2_PROVIDER_SHAPE_CASE_MISSING:' + caseId);
  return entry.content;
}

function canonicalizeSuggestions(
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

function isDeeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeeplyFrozen);
}
