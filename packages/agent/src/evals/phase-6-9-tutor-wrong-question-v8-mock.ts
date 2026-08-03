import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability as Phase697V8WireCapability,
} from '@repo/ai';

import type { Phase697V2OrganizerRuntimeCase } from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
} from './phase-6-9-tutor-wrong-question-v6-live.ts';
import {
  PHASE_6_9_7_V7_SYNTHETIC_FAULTS,
  createPhase697TutorOrganizerV7MockHarness,
  type Phase697V7MockRequestAudit,
  type Phase697V7SyntheticFault,
} from './phase-6-9-tutor-wrong-question-v7-mock.ts';
import { runPhase697V8OrganizerRuntimeCase } from './phase-6-9-tutor-wrong-question-v8-live.ts';
import type { Phase697V8Harness } from './run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT,
  type WrongQuestionOrganizerV8ModelDecision,
} from '../model-candidates/wrong-question-organizer-v8-model-contract.ts';
import { WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-v6-model-projection.ts';

const SYNTHETIC_CREDENTIAL = 'v8-r4-zero-network-synthetic-key';
const DIRECT_COMPLETIONS_URL = 'https://api.deepseek.com/v1/chat/completions';
const ORGANIZER_MAX_INPUT_TOKENS = 3_500;

const DIRECT_REQUEST_SCHEMA = z
  .object({
    model: z.literal('deepseek-v4-pro'),
    thinking: z.object({ type: z.literal('disabled') }).strict(),
    response_format: z.object({ type: z.literal('json_object') }).strict(),
    max_tokens: z.literal(800),
    stream: z.literal(false),
    messages: z.tuple([
      z.object({ role: z.literal('system'), content: z.string() }).strict(),
      z.object({ role: z.literal('user'), content: z.string() }).strict(),
    ]),
  })
  .strict();

const ORGANIZER_PROMPT_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION),
    shortlistFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    questions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(11),
            subjectAuthority: z.discriminatedUnion('mode', [
              z.object({ mode: z.literal('keep_local'), subject: z.string() }).strict(),
              z
                .object({
                  mode: z.literal('select_subject'),
                  candidates: z
                    .array(
                      z
                        .object({
                          subjectIndex: z.number().int().min(0).max(5),
                          subject: z.string(),
                        })
                        .strict(),
                    )
                    .min(1)
                    .max(6),
                })
                .strict(),
            ]),
            eligibleDeckActions: z
              .array(z.enum(['reuse_existing', 'create_topic']))
              .min(1)
              .max(2),
            topicCandidates: z
              .array(
                z
                  .object({
                    topicIndex: z.number().int().min(0).max(7),
                    label: z.string().min(1),
                    subject: z.string(),
                    source: z.string(),
                  })
                  .strict(),
              )
              .max(8),
            fields: z.record(z.unknown()),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    decks: z
      .array(
        z
          .object({
            deckIndex: z.number().int().min(0).max(19),
            subject: z.string(),
            name: z.string().min(1),
            nameLocked: z.boolean(),
            keywords: z.array(z.string()),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export const PHASE_6_9_7_V8_PROVIDER_LIKE_FAULTS = [
  'v6_nested_shape',
  'fixed_shape_extra_field',
  'fixed_shape_numeric_string',
  'fixed_shape_missing_subject',
  'fixed_shape_null_target',
  'dynamic_fingerprint',
  'dynamic_duplicate_question',
  'dynamic_subject_authority',
  'dynamic_target_authority',
] as const;

export type Phase697V8ProviderLikeFault = (typeof PHASE_6_9_7_V8_PROVIDER_LIKE_FAULTS)[number];
export type Phase697V8SyntheticFault = Phase697V7SyntheticFault | Phase697V8ProviderLikeFault;

export type Phase697TutorOrganizerV8MockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697V8SyntheticFault | undefined>>;
  onRequest?: (request: Phase697V7MockRequestAudit) => void;
}>;

/**
 * Reviewed V8 zero-network Mock. Tutor deliberately reuses the unchanged V7/V6
 * production candidate chain. Organizer crosses the production V8 fixed-shape
 * adapter and first-party direct adapter; only the fetch delegate is synthetic.
 * The responder derives ordinals from the actual bounded prompt and never reads
 * dataset expected values, case oracles, production identifiers, or write commands.
 */
export function createPhase697TutorOrganizerV8MockHarness(
  input: Phase697TutorOrganizerV8MockHarnessInput,
): Readonly<Phase697V8Harness> {
  const v7Harness = createPhase697TutorOrganizerV7MockHarness({
    runId: input.runId,
    runScope: input.runScope,
    faults: retainV7Faults(input.faults),
    onRequest: input.onRequest,
  });
  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'mock',
    provider: 'mock',
    model: 'mock',
    structuredOutputMode: 'mock_json_v8',
    executorProvenance: 'mock_synthetic',
    runZeroCall: v7Harness.runZeroCall,
    runTutor: v7Harness.runTutor,
    runOrganizer: (entry, signal, capability) => runOrganizerMock(entry, signal, capability, input),
  });
}

async function runOrganizerMock(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  capability: Phase697V8WireCapability,
  input: Phase697TutorOrganizerV8MockHarnessInput,
) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: SYNTHETIC_CREDENTIAL,
      baseURL: PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
      model: 'deepseek-v4-pro',
    },
    capability,
    {
      fetch: createSyntheticFetch({
        caseId: entry.id,
        fault: input.faults?.[entry.id],
        onRequest: input.onRequest,
      }),
    },
  );
  if (adapter.provenance !== 'synthetic_test') {
    throw new Error('PHASE_6_9_7_V8_MOCK_ADAPTER_PROVENANCE_INVALID');
  }
  return runPhase697V8OrganizerRuntimeCase(
    entry,
    signal,
    input.runId,
    adapter.executor,
    PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  );
}

function createSyntheticFetch(input: {
  caseId: string;
  fault: Phase697V8SyntheticFault | undefined;
  onRequest: Phase697TutorOrganizerV8MockHarnessInput['onRequest'];
}): typeof fetch {
  return (url, init) => {
    if (input.fault === 'fetch_sync_throw') {
      throw new Error('V8_R4_SYNTHETIC_FETCH_SYNC_THROW');
    }
    const request = parseDirectRequest(url, init);
    input.onRequest?.(
      Object.freeze({
        agent: 'wrong_question_organizer',
        caseId: input.caseId,
        url: DIRECT_COMPLETIONS_URL,
        systemPrompt: request.messages[0].content,
        userPrompt: request.messages[1].content,
        maxOutputTokens: request.max_tokens,
      }),
    );
    if (input.fault === 'fetch_reject') {
      return Promise.reject(new Error('V8_R4_SYNTHETIC_FETCH_REJECT'));
    }
    if (input.fault === 'wait_for_abort') return rejectWhenAborted(init?.signal);
    if (input.fault === 'ignore_abort') return new Promise<Response>(() => undefined);

    const projection = ORGANIZER_PROMPT_SCHEMA.parse(JSON.parse(request.messages[1].content));
    const output = buildOrganizerDecision(projection);
    return Promise.resolve(buildSyntheticResponse(request, output, input.fault));
  };
}

function parseDirectRequest(url: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) {
  const normalizedUrl =
    typeof url === 'string'
      ? url
      : url instanceof URL
        ? url.href
        : url instanceof Request
          ? url.url
          : null;
  if (
    normalizedUrl !== DIRECT_COMPLETIONS_URL ||
    init?.method !== 'POST' ||
    typeof init.body !== 'string'
  ) {
    throw new Error('PHASE_6_9_7_V8_MOCK_REQUEST_SHAPE_INVALID');
  }
  const headers = new Headers(init.headers);
  if (
    headers.get('authorization') !== `Bearer ${SYNTHETIC_CREDENTIAL}` ||
    headers.get('content-type') !== 'application/json'
  ) {
    throw new Error('PHASE_6_9_7_V8_MOCK_REQUEST_HEADERS_INVALID');
  }
  const request = DIRECT_REQUEST_SCHEMA.parse(JSON.parse(init.body));
  if (request.messages[0].content !== WRONG_QUESTION_ORGANIZER_V8_SYSTEM_PROMPT) {
    throw new Error('PHASE_6_9_7_V8_MOCK_CANDIDATE_REQUEST_INVALID');
  }
  return request;
}

function buildOrganizerDecision(
  projection: z.infer<typeof ORGANIZER_PROMPT_SCHEMA>,
): WrongQuestionOrganizerV8ModelDecision {
  return Object.freeze({
    shortlistFingerprint: projection.shortlistFingerprint,
    decisions: projection.questions.map((question) => {
      const resolvedSubject =
        question.subjectAuthority.mode === 'keep_local'
          ? question.subjectAuthority.subject
          : question.subjectAuthority.candidates[0]?.subject;
      if (!resolvedSubject) {
        throw new Error('PHASE_6_9_7_V8_MOCK_ORGANIZER_SUBJECT_UNAVAILABLE');
      }
      const selectedTopic = selectTopicCandidate(question.topicCandidates, question.fields);
      const selectedDeck = selectReusableDeck({
        decks: projection.decks,
        resolvedSubject,
        fields: question.fields,
        selectedTopicLabel: selectedTopic?.label,
      });
      const canReuse = question.eligibleDeckActions.includes('reuse_existing');
      const canCreate = question.eligibleDeckActions.includes('create_topic');
      const target =
        canReuse && selectedDeck && (!canCreate || selectedDeck.semanticScore > 0)
          ? ({
              deckAction: 'reuse_existing' as const,
              targetIndex: selectedDeck.deckIndex,
            } as const)
          : canCreate && selectedTopic
            ? ({
                deckAction: 'create_topic' as const,
                targetIndex: selectedTopic.topicIndex,
              } as const)
            : canReuse && selectedDeck
              ? ({
                  deckAction: 'reuse_existing' as const,
                  targetIndex: selectedDeck.deckIndex,
                } as const)
              : null;
      if (!target) {
        throw new Error('PHASE_6_9_7_V8_MOCK_ORGANIZER_TARGET_UNAVAILABLE');
      }
      return Object.freeze({
        questionIndex: question.questionIndex,
        subjectIndex:
          question.subjectAuthority.mode === 'keep_local'
            ? null
            : question.subjectAuthority.candidates[0].subjectIndex,
        ...target,
      });
    }),
  });
}

function selectTopicCandidate(
  candidates: z.infer<typeof ORGANIZER_PROMPT_SCHEMA>['questions'][number]['topicCandidates'],
  fields: Record<string, unknown>,
) {
  const semanticText = normalizeSemanticText(collectStrings(fields).join(' '));
  let selected: (typeof candidates)[number] | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    const label = normalizeSemanticText(candidate.label);
    const directScore = label.length > 0 && semanticText.includes(label) ? 100 : 0;
    const sourceScore = candidate.source === 'question_semantic' ? 200 : 0;
    const score = directScore + sourceScore;
    if (score >= bestScore) {
      bestScore = score;
      selected = candidate;
    }
  }
  return selected;
}

function selectReusableDeck(input: {
  decks: z.infer<typeof ORGANIZER_PROMPT_SCHEMA>['decks'];
  resolvedSubject: string;
  fields: Record<string, unknown>;
  selectedTopicLabel: string | undefined;
}) {
  const semanticText = normalizeSemanticText(collectStrings(input.fields).join(' '));
  const selectedTopic = normalizeSemanticText(input.selectedTopicLabel ?? '');
  let selected:
    | (z.infer<typeof ORGANIZER_PROMPT_SCHEMA>['decks'][number] & { semanticScore: number })
    | undefined;
  for (const deck of input.decks) {
    if (deck.subject !== input.resolvedSubject) continue;
    const deckName = normalizeSemanticText(deck.name);
    const topicMatch = selectedTopic.length > 0 && selectedTopic === deckName ? 100 : 0;
    const nameMatch = deckName.length > 0 && semanticText.includes(deckName) ? 50 : 0;
    const keywordMatch = deck.keywords.some((keyword) => {
      const normalized = normalizeSemanticText(keyword);
      return normalized.length > 0 && semanticText.includes(normalized);
    })
      ? 25
      : 0;
    const semanticScore = topicMatch + nameMatch + keywordMatch;
    if (!selected || semanticScore > selected.semanticScore) selected = { ...deck, semanticScore };
  }
  return selected;
}

function buildSyntheticResponse(
  request: z.infer<typeof DIRECT_REQUEST_SCHEMA>,
  output: WrongQuestionOrganizerV8ModelDecision,
  fault: Phase697V8SyntheticFault | undefined,
) {
  const faultedOutput = applyProviderLikeFault(output, fault);
  const usage = syntheticUsage(request, faultedOutput);
  if (fault === 'http_auth') return new Response('synthetic auth', { status: 401 });
  if (fault === 'http_rate_limit') return new Response('synthetic rate limit', { status: 429 });
  if (fault === 'http_client') return new Response('synthetic client', { status: 422 });
  if (fault === 'http_server') return new Response('synthetic server', { status: 503 });
  if (fault === 'abnormal_status') return responseWithStatus(302);
  if (fault === 'empty_response') return new Response('', { status: 200 });
  if (fault === 'malformed_response_json') return new Response('{invalid', { status: 200 });

  const content =
    fault === 'missing_completion'
      ? undefined
      : fault === 'malformed_completion_json'
        ? '{invalid'
        : JSON.stringify(faultedOutput);
  const payload: Record<string, unknown> = {
    choices: [{ message: { ...(content === undefined ? {} : { content }) } }],
    usage: {
      prompt_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      completion_tokens_details: {
        reasoning_tokens: fault === 'positive_reasoning_tokens' ? 1 : 0,
      },
    },
  };
  if (fault === 'reasoning_content') {
    payload.choices = [{ message: { content, reasoning_content: 'synthetic reasoning' } }];
  }
  if (fault === 'usage_missing') delete payload.usage;
  if (fault === 'usage_zero') (payload.usage as Record<string, unknown>).prompt_tokens = 0;
  if (fault === 'usage_negative') (payload.usage as Record<string, unknown>).prompt_tokens = -1;
  if (fault === 'usage_fractional') (payload.usage as Record<string, unknown>).prompt_tokens = 1.5;
  if (fault === 'usage_overflow') {
    (payload.usage as Record<string, unknown>).prompt_tokens = Number.MAX_SAFE_INTEGER + 1;
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function applyProviderLikeFault(
  output: WrongQuestionOrganizerV8ModelDecision,
  fault: Phase697V8SyntheticFault | undefined,
): unknown {
  if (fault === 'schema_mismatch') return { unexpected: true };
  const clone = structuredClone(output) as Record<string, unknown> & {
    decisions: Record<string, unknown>[];
  };
  const first = clone.decisions[0];
  if (!first) return clone;
  switch (fault) {
    case 'v6_nested_shape':
      return {
        shortlistFingerprint: clone.shortlistFingerprint,
        decisions: clone.decisions.map((entry) => ({
          questionIndex: entry.questionIndex,
          subjectDecision:
            entry.subjectIndex === null
              ? { action: 'keep_local' }
              : { action: 'select_subject', subjectIndex: entry.subjectIndex },
          deckDecision:
            entry.deckAction === 'reuse_existing'
              ? { action: 'reuse_existing', deckIndex: entry.targetIndex }
              : { action: 'create_topic', topicIndex: entry.targetIndex },
        })),
      };
    case 'fixed_shape_extra_field':
      first.explanation = 'forbidden';
      return clone;
    case 'fixed_shape_numeric_string':
      first.targetIndex = String(first.targetIndex);
      return clone;
    case 'fixed_shape_missing_subject':
      delete first.subjectIndex;
      return clone;
    case 'fixed_shape_null_target':
      first.targetIndex = null;
      return clone;
    case 'dynamic_fingerprint': {
      const fingerprint = String(clone.shortlistFingerprint);
      clone.shortlistFingerprint = `${fingerprint.slice(0, -1)}${fingerprint.endsWith('0') ? '1' : '0'}`;
      return clone;
    }
    case 'dynamic_duplicate_question':
      if (clone.decisions[1]) clone.decisions[1].questionIndex = first.questionIndex;
      return clone;
    case 'dynamic_subject_authority':
      first.subjectIndex = first.subjectIndex === null ? 0 : null;
      return clone;
    case 'dynamic_target_authority':
      first.targetIndex = 19;
      return clone;
    default:
      return clone;
  }
}

function syntheticUsage(request: z.infer<typeof DIRECT_REQUEST_SCHEMA>, output: unknown) {
  return Object.freeze({
    inputTokens: Math.min(
      ORGANIZER_MAX_INPUT_TOKENS,
      Math.max(
        1,
        Math.ceil(request.messages.map((message) => message.content).join('\n').length / 4),
      ),
    ),
    outputTokens: Math.min(800, Math.max(1, Math.ceil(JSON.stringify(output).length / 4))),
  });
}

function retainV7Faults(
  faults: Phase697TutorOrganizerV8MockHarnessInput['faults'],
): Readonly<Record<string, Phase697V7SyntheticFault | undefined>> | undefined {
  if (!faults) return undefined;
  const allowed = new Set<string>(PHASE_6_9_7_V7_SYNTHETIC_FAULTS);
  return Object.fromEntries(
    Object.entries(faults).filter(
      (entry): entry is [string, Phase697V7SyntheticFault] =>
        entry[1] !== undefined && allowed.has(entry[1]),
    ),
  );
}

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(collectStrings);
}

function normalizeSemanticText(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]+/gu, '');
}

function rejectWhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('V8_R4_SYNTHETIC_ABORT_SIGNAL_MISSING'));
      return;
    }
    const rejectAborted = () => reject(new Error('V8_R4_SYNTHETIC_ABORTED'));
    if (signal.aborted) {
      rejectAborted();
      return;
    }
    signal.addEventListener('abort', rejectAborted, { once: true });
  });
}

function responseWithStatus(status: number): Response {
  const target = new Response('{}', { status: 200 });
  return new Proxy(target, {
    get(inner, property) {
      if (property === 'status') return status;
      const value: unknown = Reflect.get(inner, property, inner);
      return value;
    },
  });
}
