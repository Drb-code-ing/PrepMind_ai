import { readFile } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentBudget,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
} from '@repo/ai';

import { phase697V2OrganizerCases } from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import { runWrongQuestionOrganizerV8ModelCandidate } from '../src/model-candidates/wrong-question-organizer-v8-model-candidate.ts';
import {
  diagnoseWrongQuestionOrganizerV8Schema,
  WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA,
} from '../src/model-candidates/wrong-question-organizer-v8-schema-diagnostic.ts';
import {
  PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD,
  PHASE_6_9_7_V8_R2_FROZEN_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
  PHASE_6_9_7_V8_R2_PROVIDER_SHAPE_CASES,
  PHASE_6_9_7_V8_R2_ROBUSTNESS_SHA256,
  PHASE_6_9_7_V8_R2_ROBUSTNESS_VERSION,
} from './fixtures/phase-6-9-tutor-wrong-question-v8-r2-provider-shapes-v1.ts';

const STATIC_REASON_BY_CASE = Object.freeze({
  'wrapper-data': 'top_level_keys',
  'wrapper-output': 'top_level_keys',
  'top-level-array': 'top_level_shape',
  'top-level-null': 'top_level_shape',
  'double-encoded-json': 'top_level_shape',
  'missing-fingerprint': 'top_level_keys',
  'fingerprint-number': 'fingerprint_type',
  'fingerprint-uppercase': 'fingerprint_format',
  'decisions-null': 'decisions_type',
  'decisions-empty': 'decisions_count',
  'decisions-over-limit': 'decisions_count',
  'decision-null': 'decision_shape',
  'decision-null-middle': 'decision_shape',
  'decision-null-last': 'decision_shape',
  'decision-extra-key-alpha': 'decision_keys',
  'decision-extra-key-beta': 'decision_keys',
  'decision-extra-key-middle': 'decision_keys',
  'decision-extra-key-last': 'decision_keys',
  'legacy-v6-nested-shape': 'decision_keys',
  'snake-case-decision': 'decision_keys',
  'question-index-string': 'question_index',
  'question-index-string-middle': 'question_index',
  'question-index-string-last': 'question_index',
  'question-index-float': 'question_index',
  'question-index-float-middle': 'question_index',
  'question-index-float-last': 'question_index',
  'question-index-negative': 'question_index',
  'question-index-negative-middle': 'question_index',
  'question-index-negative-last': 'question_index',
  'question-index-over-limit': 'question_index',
  'question-index-over-limit-middle': 'question_index',
  'question-index-over-limit-last': 'question_index',
  'subject-index-string': 'subject_index',
  'subject-index-string-middle': 'subject_index',
  'subject-index-string-last': 'subject_index',
  'subject-index-float': 'subject_index',
  'subject-index-float-middle': 'subject_index',
  'subject-index-float-last': 'subject_index',
  'subject-index-negative': 'subject_index',
  'subject-index-negative-middle': 'subject_index',
  'subject-index-negative-last': 'subject_index',
  'subject-index-over-limit': 'subject_index',
  'subject-index-over-limit-middle': 'subject_index',
  'subject-index-over-limit-last': 'subject_index',
  'deck-action-unknown': 'deck_action',
  'deck-action-unknown-middle': 'deck_action',
  'deck-action-unknown-last': 'deck_action',
  'target-index-string': 'target_index',
  'target-index-string-middle': 'target_index',
  'target-index-string-last': 'target_index',
  'target-index-float': 'target_index',
  'target-index-float-middle': 'target_index',
  'target-index-float-last': 'target_index',
  'target-index-negative': 'target_index',
  'target-index-negative-middle': 'target_index',
  'target-index-negative-last': 'target_index',
  'target-index-over-limit': 'target_index',
  'target-index-over-limit-middle': 'target_index',
  'target-index-over-limit-last': 'target_index',
} as const);

const DYNAMIC_REASON_BY_CASE = Object.freeze({
  'dynamic-fingerprint-mutation': 'shortlist_fingerprint_mismatch',
  'dynamic-question-count-missing': 'question_count_mismatch',
  'dynamic-question-index-duplicate': 'duplicate_question_index',
  'dynamic-question-index-out-of-range': 'question_index_out_of_range',
  'dynamic-structured-subject-override': 'subject_authority_violation',
  'dynamic-taxonomy-subject-null': 'subject_authority_violation',
  'dynamic-deck-action-ineligible': 'deck_action_not_eligible',
  'dynamic-cross-subject-deck': 'cross_subject_deck',
  'dynamic-topic-index-out-of-range': 'topic_index_out_of_range',
  'dynamic-deck-index-out-of-range': 'deck_index_out_of_range',
} as const);

const RAW_PARSE_FAILURE_IDS = new Set([
  'markdown-fence',
  'prose-prefix',
  'bom-prefix',
  'trailing-comma',
  'single-quoted-json',
]);

describe('Phase 6.9.7 V8 R2 Provider-like shape robustness', () => {
  test('freezes a held-out fixture with no V2 identity, oracle, or production response generator', async () => {
    expect(PHASE_6_9_7_V8_R2_ROBUSTNESS_VERSION).toBe(
      'phase-6.9.7-tutor-organizer-v8-r2-provider-shapes-v1',
    );
    expect(PHASE_6_9_7_V8_R2_ROBUSTNESS_SHA256).toBe(PHASE_6_9_7_V8_R2_FROZEN_ROBUSTNESS_SHA256);
    expect(isDeeplyFrozen(PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD)).toBe(true);
    expect(isDeeplyFrozen(PHASE_6_9_7_V8_R2_PROVIDER_SHAPE_CASES)).toBe(true);

    const v2Ids = new Set(phase697V2OrganizerCases.map((entry) => entry.id));
    expect(PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.questions.every((entry) => !v2Ids.has(entry.id))).toBe(
      true,
    );
    const fixtureSource = await readFile(
      new URL(
        './fixtures/phase-6-9-tutor-wrong-question-v8-r2-provider-shapes-v1.ts',
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
  });

  test('accepts canonical and decision-permuted JSON through the synthetic direct adapter', async () => {
    const canonical = await executeCase('canonical');
    const unicodeEscaped = await executeCase('unicode-escaped-canonical');
    const reordered = await executeCase('decision-order-reversed');

    for (const execution of [canonical, unicodeEscaped, reordered]) {
      expect(execution.fetchCalls).toBe(1);
      expect(execution.result.observation.disposition).toBe('candidate_applied');
      expect(execution.result.boundedSchemaDiagnostic).toBeNull();
      expect(execution.stages).toHaveLength(8);
      expect(execution.requestBytes).toContain('wrong-question-organizer-model-candidate-v8');
      for (const privateId of [
        ...PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.questions.map((entry) => entry.id),
        ...PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.decks.map((entry) => entry.id),
      ]) {
        expect(execution.requestBytes).not.toContain(privateId);
      }
    }
    expect(canonicalizeSuggestions(canonical.result.result.suggestions)).toEqual(
      canonicalizeSuggestions(reordered.result.result.suggestions),
    );
    expect(canonicalizeSuggestions(canonical.result.result.suggestions)).toEqual(
      canonicalizeSuggestions(unicodeEscaped.result.result.suggestions),
    );
    expect(canonical.result.result.suggestions.map((entry) => entry.questionId).sort()).toEqual(
      PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE.questions.map((entry) => entry.id).sort(),
    );
  });

  test('strictly rejects parsed Provider shape drift at first, middle, or last decision with one bounded reason', async () => {
    for (const [caseId, expectedReason] of Object.entries(STATIC_REASON_BY_CASE)) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).toBe('fallback_schema_invalid');
      expect(execution.result.boundedSchemaDiagnostic?.reason, caseId).toBe(expectedReason);
      expect(
        WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse(
          execution.result.boundedSchemaDiagnostic,
        ).success,
        caseId,
      ).toBe(true);
      expect(execution.result.boundedSchemaDiagnostic?.rawDataRetained, caseId).toBe(false);
    }
  });

  test('keeps static shape and dynamic owner authority as separate failure layers', async () => {
    for (const [caseId, expectedReason] of Object.entries(DYNAMIC_REASON_BY_CASE)) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).toBe('fallback_schema_invalid');
      expect(execution.result.observation.reasonCodes, caseId).toContain(expectedReason);
      expect(execution.result.boundedSchemaDiagnostic?.reason, caseId).toBe('dynamic_authority');
      expect(
        execution.result.result.suggestions.every(
          (entry) => entry.selection.source === 'deterministic',
        ),
      ).toBe(true);
    }
  });

  test('fails raw non-JSON model content before schema without inventing a field diagnosis', async () => {
    for (const caseId of RAW_PARSE_FAILURE_IDS) {
      const execution = await executeCase(caseId);
      expect(execution.fetchCalls, caseId).toBe(1);
      expect(execution.result.observation.disposition, caseId).not.toBe('candidate_applied');
      expect(execution.result.boundedSchemaDiagnostic, caseId).toBeNull();
      expect(execution.stages, caseId).not.toContain('content_parsed');
      const serialized = JSON.stringify(execution.result);
      expect(serialized, caseId).not.toContain(contentFor(caseId));
      expect(serialized, caseId).not.toContain(SYNTHETIC_CREDENTIAL);
    }
  });

  test('hashes only bounded shape categories and fails cyclic, wide, and hostile values closed', async () => {
    const alpha = await executeCase('decision-extra-key-alpha');
    const beta = await executeCase('decision-extra-key-beta');
    expect(alpha.result.boundedSchemaDiagnostic?.shapeFingerprint).toBe(
      beta.result.boundedSchemaDiagnostic?.shapeFingerprint,
    );
    const serialized = JSON.stringify([alpha.result, beta.result]);
    for (const forbidden of [
      'opaqueAlpha',
      'opaqueBeta',
      'opaqueMiddle',
      'opaqueLast',
      'private-shape-value-a',
      'private-shape-value-b',
      'private-shape-value-middle',
      'private-shape-value-last',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    const cyclic: Record<string, unknown> = {
      ...PHASE_6_9_7_V8_R2_CANONICAL_PROVIDER_PAYLOAD,
    };
    cyclic.self = cyclic;
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('v8-r2-proxy-secret');
        },
      },
    );
    const wide = Object.fromEntries(
      Array.from({ length: 4_097 }, (_, index) => [`private-${index}`, index]),
    );
    for (const value of [cyclic, hostile, wide]) {
      const diagnostic = diagnoseWrongQuestionOrganizerV8Schema(value);
      expect(diagnostic?.reason).toBe('unknown');
      expect(diagnostic?.rawDataRetained).toBe(false);
      expect(JSON.stringify(diagnostic)).not.toMatch(/proxy-secret|private-4096/);
    }
  });
});

const SYNTHETIC_CREDENTIAL = 'v8-r2-local-synthetic-credential';

async function executeCase(caseId: string) {
  const content = contentFor(caseId);
  const stages: string[] = [];
  let fetchCalls = 0;
  let requestBytes = '';
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
        return new Response(
          JSON.stringify({
            choices: [{ message: { content } }],
            usage: {
              prompt_tokens: 96,
              completion_tokens: 24,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    },
  );
  expect(adapter.provenance).toBe('synthetic_test');
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 1_000,
    executor: adapter.executor,
  });
  const result = await runWrongQuestionOrganizerV8ModelCandidate({
    runId: `phase-6-9-7-v8-r2:${caseId}`,
    shortlistSource: PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
    runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: 3_500,
      maxOutputTokens: 800,
    }),
    revalidateSource: () => PHASE_6_9_7_V8_R2_HELD_OUT_SOURCE,
  });
  return { result, stages, fetchCalls, requestBytes };
}

function contentFor(caseId: string) {
  const entry = PHASE_6_9_7_V8_R2_PROVIDER_SHAPE_CASES.find((item) => item.id === caseId);
  if (!entry) throw new Error(`V8_R2_PROVIDER_SHAPE_CASE_MISSING:${caseId}`);
  return entry.content;
}

function canonicalizeSuggestions(
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

function isDeeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeeplyFrozen);
}
