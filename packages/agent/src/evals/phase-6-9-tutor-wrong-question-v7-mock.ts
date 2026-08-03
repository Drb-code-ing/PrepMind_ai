import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability,
} from '@repo/ai';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import { runPhase697V6ZeroCallCase } from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
  runPhase697V6OrganizerRuntimeCase,
  runPhase697V6TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v6-live.ts';
import type { Phase697V7Harness } from './run-phase-6-9-tutor-wrong-question-v7-paired.ts';
import { TUTOR_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-v6-model-projection.ts';
import { formatTutorV6ModelPolicyForPrompt } from '../model-candidates/tutor-v6-model-contract.ts';
import { WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-v6-model-projection.ts';
import { formatWrongQuestionOrganizerV6ModelPolicyForPrompt } from '../model-candidates/wrong-question-organizer-v6-model-contract.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';

const SYNTHETIC_CREDENTIAL = 'v7-r3-zero-network-synthetic-key';
const DIRECT_COMPLETIONS_URL = 'https://api.deepseek.com/v1/chat/completions';
const TUTOR_MAX_INPUT_TOKENS = 1_200;
const ORGANIZER_MAX_INPUT_TOKENS = 3_500;

const TUTOR_SYSTEM_PROMPT = [
  'Classify only the bounded Tutor intent supplied as JSON.',
  formatTutorV6ModelPolicyForPrompt(),
].join('\n');
const ORGANIZER_SYSTEM_PROMPT = [
  'Select only bounded WrongQuestionOrganizer ordinals from the supplied JSON.',
  formatWrongQuestionOrganizerV6ModelPolicyForPrompt(),
].join('\n');

const DIRECT_REQUEST_SCHEMA = z
  .object({
    model: z.literal('deepseek-v4-pro'),
    thinking: z.object({ type: z.literal('disabled') }).strict(),
    response_format: z.object({ type: z.literal('json_object') }).strict(),
    max_tokens: z.number().int().positive(),
    stream: z.literal(false),
    messages: z.tuple([
      z.object({ role: z.literal('system'), content: z.string() }).strict(),
      z.object({ role: z.literal('user'), content: z.string() }).strict(),
    ]),
  })
  .strict();

const TUTOR_PROMPT_SCHEMA = z
  .object({
    version: z.literal(TUTOR_V6_MODEL_PROJECTION_VERSION),
    latestText: z.string(),
    activeContext: z
      .object({
        available: z.boolean(),
        excerpt: z.string().optional(),
      })
      .strict(),
    authorityBinding: z
      .object({
        localSignalAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
        localStrategyAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    eligibleIntents: z
      .array(
        z
          .object({
            intentIndex: z.number().int().min(0).max(4),
            intent: z.enum(TUTOR_BOUNDED_INTENTS),
          })
          .strict(),
      )
      .min(1)
      .max(5),
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

export const PHASE_6_9_7_V7_SYNTHETIC_FAULTS = [
  'fetch_sync_throw',
  'fetch_reject',
  'http_auth',
  'http_rate_limit',
  'http_client',
  'http_server',
  'abnormal_status',
  'empty_response',
  'malformed_response_json',
  'reasoning_content',
  'positive_reasoning_tokens',
  'missing_completion',
  'malformed_completion_json',
  'schema_mismatch',
  'usage_missing',
  'usage_zero',
  'usage_negative',
  'usage_fractional',
  'usage_overflow',
  'wait_for_abort',
  'ignore_abort',
] as const;

export type Phase697V7SyntheticFault = (typeof PHASE_6_9_7_V7_SYNTHETIC_FAULTS)[number];

export type Phase697V7MockRequestAudit = Readonly<{
  agent: 'tutor' | 'wrong_question_organizer';
  caseId: string;
  url: typeof DIRECT_COMPLETIONS_URL;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}>;

export type Phase697TutorOrganizerV7MockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697V7SyntheticFault | undefined>>;
  onRequest?: (request: Phase697V7MockRequestAudit) => void;
}>;

/**
 * Reviewed V7 Mock factory. Every runtime case crosses the production V6
 * candidate/projection/schema/merger and the first-party V7 direct adapter.
 * The in-process delegate derives ordinals only from the actual bounded prompt;
 * it never reads a case oracle or opens a network connection.
 */
export function createPhase697TutorOrganizerV7MockHarness(
  input: Phase697TutorOrganizerV7MockHarnessInput,
): Readonly<Phase697V7Harness> {
  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'mock',
    provider: 'mock',
    model: 'mock',
    structuredOutputMode: 'mock_json_v7',
    executorProvenance: 'mock_synthetic',
    runZeroCall: async (entry) => runPhase697V6ZeroCallCase(entry),
    runTutor: (entry, signal, capability) => runTutorMock(entry, signal, capability, input),
    runOrganizer: (entry, signal, capability) => runOrganizerMock(entry, signal, capability, input),
  });
}

async function runTutorMock(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  capability: Phase697V7WireCapability,
  input: Phase697TutorOrganizerV7MockHarnessInput,
) {
  const executor = createSyntheticExecutor({
    agent: 'tutor',
    caseId: entry.id,
    capability,
    fault: input.faults?.[entry.id],
    onRequest: input.onRequest,
  });
  return runPhase697V6TutorRuntimeCase(
    entry,
    signal,
    input.runId,
    executor,
    PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
  );
}

async function runOrganizerMock(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  capability: Phase697V7WireCapability,
  input: Phase697TutorOrganizerV7MockHarnessInput,
) {
  const executor = createSyntheticExecutor({
    agent: 'wrong_question_organizer',
    caseId: entry.id,
    capability,
    fault: input.faults?.[entry.id],
    onRequest: input.onRequest,
  });
  return runPhase697V6OrganizerRuntimeCase(
    entry,
    signal,
    input.runId,
    executor,
    PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  );
}

function createSyntheticExecutor(input: {
  agent: Phase697V7MockRequestAudit['agent'];
  caseId: string;
  capability: Phase697V7WireCapability;
  fault: Phase697V7SyntheticFault | undefined;
  onRequest: Phase697TutorOrganizerV7MockHarnessInput['onRequest'];
}) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: SYNTHETIC_CREDENTIAL,
      baseURL: PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
      model: 'deepseek-v4-pro',
    },
    input.capability,
    {
      fetch: createSyntheticFetch(input),
    },
  );
  if (adapter.provenance !== 'synthetic_test') {
    throw new Error('PHASE_6_9_7_V7_MOCK_ADAPTER_PROVENANCE_INVALID');
  }
  return adapter.executor;
}

function createSyntheticFetch(input: {
  agent: Phase697V7MockRequestAudit['agent'];
  caseId: string;
  fault: Phase697V7SyntheticFault | undefined;
  onRequest: Phase697TutorOrganizerV7MockHarnessInput['onRequest'];
}): typeof fetch {
  return (url, init) => {
    if (input.fault === 'fetch_sync_throw') {
      throw new Error('V7_R3_SYNTHETIC_FETCH_SYNC_THROW');
    }
    const request = parseDirectRequest(input.agent, url, init);
    input.onRequest?.(
      Object.freeze({
        agent: input.agent,
        caseId: input.caseId,
        url: DIRECT_COMPLETIONS_URL,
        systemPrompt: request.messages[0].content,
        userPrompt: request.messages[1].content,
        maxOutputTokens: request.max_tokens,
      }),
    );
    if (input.fault === 'fetch_reject') {
      return Promise.reject(new Error('V7_R3_SYNTHETIC_FETCH_REJECT'));
    }
    if (input.fault === 'wait_for_abort') return rejectWhenAborted(init?.signal);
    if (input.fault === 'ignore_abort') return new Promise<Response>(() => undefined);

    const output =
      input.agent === 'tutor'
        ? buildTutorDecision(request.messages[1].content)
        : buildOrganizerDecision(request.messages[1].content);
    return Promise.resolve(buildSyntheticResponse(request, output, input.fault));
  };
}

function parseDirectRequest(
  agent: Phase697V7MockRequestAudit['agent'],
  url: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
) {
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
    throw new Error('PHASE_6_9_7_V7_MOCK_REQUEST_SHAPE_INVALID');
  }
  const headers = new Headers(init.headers);
  if (
    headers.get('authorization') !== `Bearer ${SYNTHETIC_CREDENTIAL}` ||
    headers.get('content-type') !== 'application/json'
  ) {
    throw new Error('PHASE_6_9_7_V7_MOCK_REQUEST_HEADERS_INVALID');
  }
  const request = DIRECT_REQUEST_SCHEMA.parse(JSON.parse(init.body));
  const expectedSystemPrompt = agent === 'tutor' ? TUTOR_SYSTEM_PROMPT : ORGANIZER_SYSTEM_PROMPT;
  const expectedMaxOutputTokens = agent === 'tutor' ? 300 : 800;
  if (
    request.messages[0].content !== expectedSystemPrompt ||
    request.max_tokens !== expectedMaxOutputTokens
  ) {
    throw new Error('PHASE_6_9_7_V7_MOCK_CANDIDATE_REQUEST_INVALID');
  }
  return request;
}

function buildTutorDecision(userPrompt: string) {
  const projection = TUTOR_PROMPT_SCHEMA.parse(JSON.parse(userPrompt));
  const selected = projection.eligibleIntents[0];
  if (!selected) throw new Error('PHASE_6_9_7_V7_MOCK_TUTOR_ORDINAL_UNAVAILABLE');
  return Object.freeze({ intentIndex: selected.intentIndex });
}

function buildOrganizerDecision(userPrompt: string) {
  const projection = ORGANIZER_PROMPT_SCHEMA.parse(JSON.parse(userPrompt));
  const decisions = projection.questions.map((question) => {
    const resolvedSubject =
      question.subjectAuthority.mode === 'keep_local'
        ? question.subjectAuthority.subject
        : question.subjectAuthority.candidates[0]?.subject;
    if (!resolvedSubject) {
      throw new Error('PHASE_6_9_7_V7_MOCK_ORGANIZER_SUBJECT_UNAVAILABLE');
    }
    const subjectDecision =
      question.subjectAuthority.mode === 'keep_local'
        ? { action: 'keep_local' as const }
        : {
            action: 'select_subject' as const,
            subjectIndex: question.subjectAuthority.candidates[0].subjectIndex,
          };
    const selectedTopic = selectTopicCandidate(question.topicCandidates, question.fields);
    const selectedDeck = selectReusableDeck({
      decks: projection.decks,
      resolvedSubject,
      fields: question.fields,
      selectedTopicLabel: selectedTopic?.label,
    });
    const canReuse = question.eligibleDeckActions.includes('reuse_existing');
    const canCreate = question.eligibleDeckActions.includes('create_topic');
    const deckDecision =
      canReuse && selectedDeck && (!canCreate || selectedDeck.semanticScore > 0)
        ? ({ action: 'reuse_existing' as const, deckIndex: selectedDeck.deckIndex } as const)
        : canCreate && selectedTopic
          ? ({ action: 'create_topic' as const, topicIndex: selectedTopic.topicIndex } as const)
          : canReuse && selectedDeck
            ? ({ action: 'reuse_existing' as const, deckIndex: selectedDeck.deckIndex } as const)
            : null;
    if (!deckDecision) {
      throw new Error('PHASE_6_9_7_V7_MOCK_ORGANIZER_DECK_ORDINAL_UNAVAILABLE');
    }
    return Object.freeze({
      questionIndex: question.questionIndex,
      subjectDecision,
      deckDecision,
    });
  });
  return Object.freeze({
    shortlistFingerprint: projection.shortlistFingerprint,
    decisions,
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
    // The V6 shortlist intentionally keeps structured error/category labels as
    // context, while the model-owned topic ordinal must prefer the semantic
    // question topic when one is available.
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
    | (z.infer<typeof ORGANIZER_PROMPT_SCHEMA>['decks'][number] & {
        semanticScore: number;
      })
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
    if (!selected || semanticScore > selected.semanticScore) {
      selected = { ...deck, semanticScore };
    }
  }
  return selected;
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

function buildSyntheticResponse(
  request: z.infer<typeof DIRECT_REQUEST_SCHEMA>,
  output: unknown,
  fault: Phase697V7SyntheticFault | undefined,
) {
  const usage = syntheticUsage(request, output);
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
        : JSON.stringify(fault === 'schema_mismatch' ? { unexpected: true } : output);
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
  if (fault === 'usage_zero') {
    (payload.usage as Record<string, unknown>).prompt_tokens = 0;
  }
  if (fault === 'usage_negative') {
    (payload.usage as Record<string, unknown>).prompt_tokens = -1;
  }
  if (fault === 'usage_fractional') {
    (payload.usage as Record<string, unknown>).prompt_tokens = 1.5;
  }
  if (fault === 'usage_overflow') {
    (payload.usage as Record<string, unknown>).prompt_tokens = Number.MAX_SAFE_INTEGER + 1;
  }
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function syntheticUsage(request: z.infer<typeof DIRECT_REQUEST_SCHEMA>, output: unknown) {
  const maxInputTokens =
    request.max_tokens === 300 ? TUTOR_MAX_INPUT_TOKENS : ORGANIZER_MAX_INPUT_TOKENS;
  return Object.freeze({
    inputTokens: Math.min(
      maxInputTokens,
      Math.max(
        1,
        Math.ceil(request.messages.map((message) => message.content).join('\n').length / 4),
      ),
    ),
    outputTokens: Math.min(
      request.max_tokens,
      Math.max(1, Math.ceil(JSON.stringify(output).length / 4)),
    ),
  });
}

function rejectWhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('V7_R3_SYNTHETIC_ABORT_SIGNAL_MISSING'));
      return;
    }
    const rejectAborted = () => reject(new Error('V7_R3_SYNTHETIC_ABORTED'));
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
