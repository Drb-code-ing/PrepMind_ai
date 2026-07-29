import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability as Phase697V9WireCapability,
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
import { runPhase697V9OrganizerRuntimeCase } from './phase-6-9-tutor-wrong-question-v9-runtime.ts';
import type { Phase697V9Harness } from './run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import type { WrongQuestionOrganizerV9ModelDecision } from '../model-candidates/wrong-question-organizer-v9-model-contract.ts';
import {
  WRONG_QUESTION_ORGANIZER_V9_ACTION_LABELS,
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
  WRONG_QUESTION_ORGANIZER_V9_SOURCE_LABELS,
  WRONG_QUESTION_ORGANIZER_V9_SYSTEM_PROMPT,
} from '../model-candidates/wrong-question-organizer-v9-model-projection.ts';
import { WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS } from '../policies/wrong-question-organizer-policy.ts';

export const PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.7-v9-reviewed-mock-factory-v1' as const;

const REVIEWED_MOCK_FACTORY_SOURCE = Object.freeze({
  version: PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION,
  tutor: 'unchanged_v7_v6_production_candidate',
  organizer: 'v9_option_selection_v6_merger',
  adapter: 'first_party_deepseek_v4_pro_direct',
  replacement: 'fetch_delegate_only',
  responderInput: 'actual_bounded_system_and_user_prompt',
  output: '{decisions:[{questionIndex,optionIndex}]}',
  forbidden: [
    'dataset_expected',
    'case_oracle',
    'production_validator_answer_generation',
    'credential_read',
    'network_delegate',
    'write_command',
  ],
});

export const PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_SHA256 =
  `sha256:${sha256Canonical(REVIEWED_MOCK_FACTORY_SOURCE)}` as const;
export const PHASE_6_9_7_V9_FROZEN_REVIEWED_MOCK_FACTORY_SHA256 =
  'sha256:e0918cbfa23ee4463c569f49db69b026d97f47597ab7cf9621579bf10465bf08' as const;

const SYNTHETIC_CREDENTIAL = 'synthetic-v9-r4-key';
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

const PROJECTED_FIELDS_SCHEMA = z
  .object({
    category: z.string().optional(),
    knowledgePoints: z.array(z.string()).max(12).optional(),
    errorType: z.string().optional(),
    questionExcerpt: z.string().optional(),
    analysisExcerpt: z.string().optional(),
  })
  .strict();

const ORGANIZER_PROMPT_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION),
    questions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().safe().min(0).max(11),
            fields: PROJECTED_FIELDS_SCHEMA,
            options: z
              .array(
                z
                  .object({
                    optionIndex: z.number().int().safe().min(0).max(23),
                    subjectLabel: z.enum(WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS),
                    actionLabel: z.enum(WRONG_QUESTION_ORGANIZER_V9_ACTION_LABELS),
                    sourceLabel: z.enum(WRONG_QUESTION_ORGANIZER_V9_SOURCE_LABELS),
                    targetLabel: z.string().min(1).optional(),
                  })
                  .strict(),
              )
              .min(1)
              .max(24),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export const PHASE_6_9_7_V9_PROVIDER_LIKE_FAULTS = [
  'selection_wrapper',
  'selection_extra_field',
  'selection_numeric_string',
  'selection_missing_option',
  'selection_duplicate_question',
  'selection_question_out_of_range',
  'selection_option_out_of_range',
] as const;

export type Phase697V9ProviderLikeFault = (typeof PHASE_6_9_7_V9_PROVIDER_LIKE_FAULTS)[number];
export type Phase697V9SyntheticFault = Phase697V7SyntheticFault | Phase697V9ProviderLikeFault;
export type Phase697V9MockRequestAudit = Phase697V7MockRequestAudit;

export type Phase697TutorOrganizerV9MockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697V9SyntheticFault | undefined>>;
  onRequest?: (request: Phase697V9MockRequestAudit) => void;
}>;

/**
 * Reviewed V9 zero-network Mock. Tutor reuses the unchanged V7/V6 production
 * candidate chain. Organizer crosses the production V9 option-selection
 * candidate, V6 authority merger, and first-party direct adapter; only fetch is
 * synthetic. The responder derives option ordinals solely from the actual
 * bounded prompt and never reads dataset expected values or production IDs.
 */
export function createPhase697TutorOrganizerV9MockHarness(
  input: Phase697TutorOrganizerV9MockHarnessInput,
): Readonly<Phase697V9Harness> {
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
    structuredOutputMode: 'mock_json_v9',
    executorProvenance: 'mock_synthetic',
    runZeroCall: v7Harness.runZeroCall,
    runTutor: v7Harness.runTutor,
    runOrganizer: (entry, signal, capability) => runOrganizerMock(entry, signal, capability, input),
  });
}

async function runOrganizerMock(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  capability: Phase697V9WireCapability,
  input: Phase697TutorOrganizerV9MockHarnessInput,
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
    throw new Error('PHASE_6_9_7_V9_MOCK_ADAPTER_PROVENANCE_INVALID');
  }
  return runPhase697V9OrganizerRuntimeCase(
    entry,
    signal,
    input.runId,
    adapter.executor,
    PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  );
}

function createSyntheticFetch(input: {
  caseId: string;
  fault: Phase697V9SyntheticFault | undefined;
  onRequest: Phase697TutorOrganizerV9MockHarnessInput['onRequest'];
}): typeof fetch {
  return (url, init) => {
    if (input.fault === 'fetch_sync_throw') {
      throw new Error('V9_R4_SYNTHETIC_FETCH_SYNC_THROW');
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
      return Promise.reject(new Error('V9_R4_SYNTHETIC_FETCH_REJECT'));
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
    throw new Error('PHASE_6_9_7_V9_MOCK_REQUEST_SHAPE_INVALID');
  }
  const headers = new Headers(init.headers);
  if (
    headers.get('authorization') !== `Bearer ${SYNTHETIC_CREDENTIAL}` ||
    headers.get('content-type') !== 'application/json'
  ) {
    throw new Error('PHASE_6_9_7_V9_MOCK_REQUEST_HEADERS_INVALID');
  }
  const request = DIRECT_REQUEST_SCHEMA.parse(JSON.parse(init.body));
  if (request.messages[0].content !== WRONG_QUESTION_ORGANIZER_V9_SYSTEM_PROMPT) {
    throw new Error('PHASE_6_9_7_V9_MOCK_CANDIDATE_REQUEST_INVALID');
  }
  return request;
}

function buildOrganizerDecision(
  projection: z.infer<typeof ORGANIZER_PROMPT_SCHEMA>,
): WrongQuestionOrganizerV9ModelDecision {
  return Object.freeze({
    decisions: projection.questions.map((question) => {
      const semanticText = normalizeSemanticText(collectStrings(question.fields).join(' '));
      const selected = question.options.reduce(
        (best, option) => {
          const score = scoreOption(option, semanticText);
          return best === null || score >= best.score ? { option, score } : best;
        },
        null as { option: (typeof question.options)[number]; score: number } | null,
      );
      if (selected === null) throw new Error('PHASE_6_9_7_V9_MOCK_OPTION_UNAVAILABLE');
      return Object.freeze({
        questionIndex: question.questionIndex,
        optionIndex: selected.option.optionIndex,
      });
    }),
  });
}

function scoreOption(
  option: z.infer<typeof ORGANIZER_PROMPT_SCHEMA>['questions'][number]['options'][number],
  semanticText: string,
) {
  const target = normalizeSemanticText(option.targetLabel ?? '');
  const exact = target.length > 0 && semanticText.includes(target) ? 100 : 0;
  const overlap = target.length > 0 ? ngramOverlap(target, semanticText) * 25 : 0;
  const source =
    option.sourceLabel === 'question_semantic'
      ? 500
      : option.sourceLabel === 'knowledge_point'
        ? 400
        : option.sourceLabel === 'category'
          ? 300
          : option.sourceLabel === 'error_type'
            ? 200
            : 100;
  return exact + overlap + source;
}

function buildSyntheticResponse(
  request: z.infer<typeof DIRECT_REQUEST_SCHEMA>,
  output: WrongQuestionOrganizerV9ModelDecision,
  fault: Phase697V9SyntheticFault | undefined,
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
  output: WrongQuestionOrganizerV9ModelDecision,
  fault: Phase697V9SyntheticFault | undefined,
): unknown {
  if (fault === 'schema_mismatch') return { unexpected: true };
  const clone = structuredClone(output) as Record<string, unknown> & {
    decisions: Record<string, unknown>[];
  };
  const first = clone.decisions[0];
  if (!first) return clone;
  switch (fault) {
    case 'selection_wrapper':
      return { data: clone };
    case 'selection_extra_field':
      first.explanation = 'forbidden';
      return clone;
    case 'selection_numeric_string':
      first.optionIndex = String(first.optionIndex);
      return clone;
    case 'selection_missing_option':
      delete first.optionIndex;
      return clone;
    case 'selection_duplicate_question':
      if (clone.decisions[1]) clone.decisions[1].questionIndex = first.questionIndex;
      return clone;
    case 'selection_question_out_of_range':
      first.questionIndex = 12;
      return clone;
    case 'selection_option_out_of_range':
      first.optionIndex = 24;
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
  faults: Phase697TutorOrganizerV9MockHarnessInput['faults'],
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
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s\p{P}\p{S}]+/gu, '');
}

function ngramOverlap(target: string, haystack: string) {
  if (target.length === 0 || haystack.length === 0) return 0;
  const width = target.length <= 3 ? 1 : 2;
  const grams = new Set<string>();
  for (let index = 0; index <= target.length - width; index += 1) {
    grams.add(target.slice(index, index + width));
  }
  let matches = 0;
  for (const gram of grams) if (haystack.includes(gram)) matches += 1;
  return matches;
}

function rejectWhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('V9_R4_SYNTHETIC_ABORT_SIGNAL_MISSING'));
      return;
    }
    const rejectAborted = () => reject(new Error('V9_R4_SYNTHETIC_ABORTED'));
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

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
