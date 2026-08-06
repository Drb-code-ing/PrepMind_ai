import { agentRouteSchema } from '@repo/types';
import { z } from 'zod';

import {
  clonePlainEvidenceData,
  deepFreezeModelValue,
  scanCompleteModelField,
} from '../model-candidates/model-projection-safety.ts';
import {
  isFormalVerifiedEvidenceBundleBoundToContextV1,
  isFormalVerifiedEvidenceBundleV1,
} from './verified-evidence-authority.ts';

export const AGENT_NODE_NAMES = [
  'RouterAgent',
  'TutorAgent',
  'RetrieverAgent',
  'KnowledgeVerifierAgent',
  'FinalResponseAgent',
  'WrongQuestionOrganizerAgent',
  'ReviewAgent',
  'PlannerAgent',
  'MemoryAgent',
  'KnowledgeDedupAgent',
  'KnowledgeOrganizerAgent',
] as const;

export const AGENT_REASON_CODES = [
  'not_required',
  'anonymous_forbidden',
  'invalid_input',
  'unsafe_input',
  'deadline_exceeded',
  'aborted',
  'model_disabled',
  'provider_unavailable',
  'provider_timeout',
  'schema_invalid',
  'retrieval_failed',
  'no_hits',
  'verifier_unavailable',
  'evidence_insufficient',
  'evidence_conflict',
  'partial_response',
  'trace_unavailable',
] as const;

export const RETRIEVER_REASON_CODES = [
  'anonymous_forbidden',
  'invalid_input',
  'unsafe_input',
  'schema_invalid',
  'rewrite_not_eligible',
  'rewrite_gate_off',
  'rewrite_applied',
  'rewrite_rejected',
  'rewrite_failed_fallback_original',
  'rewrite_failed_no_rag',
  'retrieval_completed',
  'retrieval_failed',
  'no_hits',
  'not_required',
  'aborted',
  'deadline_exceeded',
] as const;

export const EVIDENCE_REASON_CODES = [
  'evidence_verified',
  'evidence_suspicious',
  'evidence_conflict',
  'evidence_insufficient',
  'evidence_skipped',
  'verifier_unavailable',
  'unsafe_evidence_removed',
  'context_budget_omitted',
] as const;

export const EVIDENCE_SAFETY_CODES = [
  'verified_safe',
  'verifier_caution',
  'prompt_injection',
  'credential_material',
  'high_risk',
  'control_character',
  'unknown_safety',
] as const;

export const VERIFIED_EVIDENCE_SAFETY_CODES = ['verified_safe', 'verifier_caution'] as const;

export const FINAL_RESPONSE_MODEL_REFS = [
  'mock-local-v1',
  'deepseek-v4-pro-nonthinking-v1',
] as const;

export const FINAL_RESPONSE_FAILURE_MESSAGES = {
  beforeFirstToken: '回答暂时不可用，可稍后重试。',
  afterFirstToken: '生成中断，内容可能不完整。',
} as const;

export type AgentNodeName = (typeof AGENT_NODE_NAMES)[number];
export type AgentReasonCode = (typeof AGENT_REASON_CODES)[number];
export type RetrieverReasonCode = (typeof RETRIEVER_REASON_CODES)[number];
export type EvidenceReasonCode = (typeof EVIDENCE_REASON_CODES)[number];
export type FinalResponseModelRef = (typeof FINAL_RESPONSE_MODEL_REFS)[number];

export type RealtimeChatContractFailureCode =
  | 'schema_invalid'
  | 'principal_binding_invalid'
  | 'duplicate_message_id'
  | 'duplicate_model_call_attribution'
  | 'bundle_not_locally_projected'
  | 'request_not_validated'
  | 'stream_sequence_invalid'
  | 'stream_terminal_invalid'
  | 'stream_citation_forbidden'
  | 'stream_failure_invariant_invalid';

export type RealtimeChatContractResult<T> =
  { ok: true; value: T } | { ok: false; reasonCode: RealtimeChatContractFailureCode };

const IDENTIFIER_SCHEMA = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const OWNER_ID_SCHEMA = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const CITATION_ID_SCHEMA = z
  .string()
  .min(6)
  .max(69)
  .regex(/^cite_[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const HASH_REFERENCE_SCHEMA = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const SOURCE_LABEL_SCHEMA = z
  .string()
  .max(32)
  .regex(/^资料 [1-9][0-9]{0,2}$/u);
const DEADLINE_SCHEMA = z.string().datetime();
const SAFE_INTEGER_SCHEMA = z.number().int().safe();
const SCORE_SCHEMA = z.number().finite().min(0).max(1);

function boundedTextSchema(min: number, max: number) {
  return z
    .string()
    .min(min)
    .max(max)
    .refine(isWellFormedText, 'text contains invalid Unicode or control characters');
}

function uniqueArray<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

function addDuplicateIssue(
  values: readonly unknown[],
  context: z.RefinementCtx,
  message: string,
): void {
  if (!uniqueArray(values)) context.addIssue({ code: 'custom', message });
}

export const AGENT_PRINCIPAL_V1_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anonymous') }).strict(),
  z
    .object({
      kind: z.literal('authenticated'),
      ownerId: OWNER_ID_SCHEMA,
      authority: z.literal('server_jwt'),
    })
    .strict(),
]);

export const AGENT_EXECUTION_CONTEXT_SERIALIZABLE_V1_SCHEMA = z
  .object({
    runId: IDENTIFIER_SCHEMA,
    requestId: IDENTIFIER_SCHEMA,
    principal: AGENT_PRINCIPAL_V1_SCHEMA,
    deadlineAt: DEADLINE_SCHEMA,
  })
  .strict();

export type AgentPrincipalV1 = z.infer<typeof AGENT_PRINCIPAL_V1_SCHEMA>;
export type AgentExecutionContextSerializableV1 = z.infer<
  typeof AGENT_EXECUTION_CONTEXT_SERIALIZABLE_V1_SCHEMA
>;
export type AgentExecutionContextV1 = Readonly<
  AgentExecutionContextSerializableV1 & { readonly signal: AbortSignal }
>;

export type AgentAuthReceiptV1 = Readonly<{
  kind: 'agent-auth-receipt-v1';
  ownerId: string;
  authority: 'server_jwt';
}>;

type AgentAuthBindingSourcesV1 = Readonly<{
  authResponse: object;
  request: object;
  bearerToken: object;
}>;

const AUTH_RECEIPT_INPUT_SCHEMA = z
  .object({
    ownerId: OWNER_ID_SCHEMA,
    authority: z.literal('server_jwt'),
  })
  .strict();

const authReceiptBindings = new WeakMap<AgentAuthReceiptV1, AgentAuthBindingSourcesV1>();
const agentExecutionContexts = new WeakSet<object>();

export function createAgentAuthReceiptV1(
  input: unknown,
  bindingsInput: unknown,
): RealtimeChatContractResult<AgentAuthReceiptV1> {
  const parsed = parsePlain(AUTH_RECEIPT_INPUT_SCHEMA, input);
  const bindings = snapshotAuthBindings(bindingsInput);
  if (!parsed.ok || bindings === null) return schemaFailure();

  const receipt = Object.freeze({
    kind: 'agent-auth-receipt-v1' as const,
    ownerId: parsed.value.ownerId,
    authority: parsed.value.authority,
  });
  authReceiptBindings.set(receipt, bindings);
  return { ok: true, value: receipt };
}

type AgentExecutionControlV1 = Readonly<{
  signal: AbortSignal;
  authReceipt?: AgentAuthReceiptV1;
  authResponse?: object;
  request?: object;
  bearerToken?: object;
}>;

export function createAgentExecutionContextV1(
  input: unknown,
  controlInput: unknown,
): RealtimeChatContractResult<AgentExecutionContextV1> {
  const parsed = parsePlain(AGENT_EXECUTION_CONTEXT_SERIALIZABLE_V1_SCHEMA, input);
  const control = snapshotExecutionControl(controlInput);
  if (!parsed.ok || control === null || !isNativeAbortSignal(control.signal)) {
    return schemaFailure();
  }

  if (parsed.value.principal.kind === 'authenticated') {
    if (
      control.authReceipt === undefined ||
      control.authResponse === undefined ||
      control.request === undefined ||
      control.bearerToken === undefined
    ) {
      return { ok: false, reasonCode: 'principal_binding_invalid' };
    }
    const binding = authReceiptBindings.get(control.authReceipt);
    if (
      binding === undefined ||
      control.authReceipt.ownerId !== parsed.value.principal.ownerId ||
      control.authReceipt.authority !== parsed.value.principal.authority ||
      binding.authResponse !== control.authResponse ||
      binding.request !== control.request ||
      binding.bearerToken !== control.bearerToken
    ) {
      return { ok: false, reasonCode: 'principal_binding_invalid' };
    }
  } else if (
    control.authReceipt !== undefined ||
    control.authResponse !== undefined ||
    control.request !== undefined ||
    control.bearerToken !== undefined
  ) {
    return { ok: false, reasonCode: 'principal_binding_invalid' };
  }

  const principal = deepFreezeModelValue(parsed.value.principal);
  const context = {
    runId: parsed.value.runId,
    requestId: parsed.value.requestId,
    principal,
    deadlineAt: parsed.value.deadlineAt,
  } as AgentExecutionContextV1;
  Object.defineProperty(context, 'signal', {
    value: control.signal,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  const frozenContext = Object.freeze(context);
  agentExecutionContexts.add(frozenContext);
  return { ok: true, value: frozenContext };
}

export function isAgentExecutionContextV1(input: unknown): input is AgentExecutionContextV1 {
  return isObjectReference(input) && agentExecutionContexts.has(input);
}

export const AGENT_USAGE_REF_V1_SCHEMA = z
  .object({
    modelCallId: IDENTIFIER_SCHEMA,
    attribution: z.enum(['direct', 'shared', 'cache']),
    attempted: z.boolean(),
    cached: z.boolean(),
  })
  .strict()
  .superRefine((usage, context) => {
    const valid =
      (usage.attribution === 'direct' && usage.attempted && !usage.cached) ||
      (usage.attribution === 'shared' && !usage.attempted && !usage.cached) ||
      (usage.attribution === 'cache' && !usage.attempted && usage.cached);
    if (!valid) context.addIssue({ code: 'custom', message: 'invalid usage attribution' });
  });

export type AgentUsageRefV1 = z.infer<typeof AGENT_USAGE_REF_V1_SCHEMA>;

export const AGENT_MESSAGE_ENVELOPE_V1_SCHEMA = z
  .object({
    schemaVersion: z.literal('agent-message-v1'),
    runId: IDENTIFIER_SCHEMA,
    messageId: IDENTIFIER_SCHEMA,
    parentMessageId: IDENTIFIER_SCHEMA.optional(),
    producer: z.enum(AGENT_NODE_NAMES),
    consumer: z.enum(AGENT_NODE_NAMES),
    status: z.enum(['completed', 'degraded', 'skipped', 'failed']),
    reasonCodes: z
      .array(z.enum(AGENT_REASON_CODES))
      .max(8)
      .superRefine((codes, context) => addDuplicateIssue(codes, context, 'duplicate reason code')),
    degraded: z.boolean(),
    usageRef: AGENT_USAGE_REF_V1_SCHEMA.optional(),
    payload: z.unknown().optional(),
  })
  .strict()
  .superRefine((envelope, context) => {
    const hasPayload = envelope.payload !== undefined;
    if (envelope.parentMessageId === envelope.messageId) {
      context.addIssue({ code: 'custom', message: 'message cannot parent itself' });
    }
    if (envelope.status === 'completed' && (!hasPayload || envelope.degraded)) {
      context.addIssue({ code: 'custom', message: 'invalid completed envelope' });
    }
    if (
      envelope.status === 'degraded' &&
      (!envelope.degraded || envelope.reasonCodes.length === 0)
    ) {
      context.addIssue({ code: 'custom', message: 'invalid degraded envelope' });
    }
    if (envelope.status === 'skipped') {
      if (hasPayload || envelope.degraded || envelope.usageRef !== undefined) {
        context.addIssue({ code: 'custom', message: 'invalid skipped envelope' });
      }
    }
    if (envelope.status === 'failed' && (!envelope.degraded || envelope.reasonCodes.length === 0)) {
      context.addIssue({ code: 'custom', message: 'invalid failed envelope' });
    }
  });

export type AgentMessageEnvelopeV1<T = unknown> = Omit<
  z.infer<typeof AGENT_MESSAGE_ENVELOPE_V1_SCHEMA>,
  'payload'
> & { readonly payload?: T };

export function parseAgentMessageEnvelopeV1<T = unknown>(
  input: unknown,
): RealtimeChatContractResult<AgentMessageEnvelopeV1<T>> {
  return parsePlain(AGENT_MESSAGE_ENVELOPE_V1_SCHEMA, input) as RealtimeChatContractResult<
    AgentMessageEnvelopeV1<T>
  >;
}

export function parseAgentMessageEnvelopesV1<T = unknown>(
  input: unknown,
): RealtimeChatContractResult<readonly AgentMessageEnvelopeV1<T>[]> {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok || !Array.isArray(cloned.value) || cloned.value.length > 64) {
    return schemaFailure();
  }

  const envelopes: AgentMessageEnvelopeV1<T>[] = [];
  const messageIds = new Set<string>();
  const directUsageIds = new Set<string>();
  let runId: string | undefined;
  for (const candidate of cloned.value) {
    const parsed = AGENT_MESSAGE_ENVELOPE_V1_SCHEMA.safeParse(candidate);
    if (!parsed.success) return schemaFailure();
    const envelope = parsed.data as AgentMessageEnvelopeV1<T>;
    if (messageIds.has(envelope.messageId)) {
      return { ok: false, reasonCode: 'duplicate_message_id' };
    }
    if (runId !== undefined && envelope.runId !== runId) return schemaFailure();
    runId = envelope.runId;
    messageIds.add(envelope.messageId);
    if (envelope.usageRef?.attribution === 'direct') {
      if (directUsageIds.has(envelope.usageRef.modelCallId)) {
        return { ok: false, reasonCode: 'duplicate_model_call_attribution' };
      }
      directUsageIds.add(envelope.usageRef.modelCallId);
    }
    envelopes.push(deepFreezeModelValue(envelope));
  }
  return { ok: true, value: Object.freeze(envelopes) };
}

const RECENT_RETRIEVER_TURN_SCHEMA = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: boundedTextSchema(1, 500),
  })
  .strict();

const ACTIVE_RETRIEVER_CONTEXT_SCHEMA = z
  .object({
    trust: z.literal('untrusted'),
    question: boundedTextSchema(1, 300).optional(),
    goal: boundedTextSchema(1, 300).optional(),
  })
  .strict()
  .refine((context) => context.question !== undefined || context.goal !== undefined, {
    message: 'active context must include question or goal',
  });

const RETRIEVER_POLICY_SCHEMA = z
  .object({
    topK: SAFE_INTEGER_SCHEMA.min(1).max(8),
    minScore: SCORE_SCHEMA,
    sourceTypes: z
      .array(z.enum(['knowledge_document']))
      .min(1)
      .max(1)
      .superRefine((values, context) =>
        addDuplicateIssue(values, context, 'duplicate source type'),
      ),
    documentStatuses: z
      .array(z.enum(['DONE']))
      .min(1)
      .max(1)
      .superRefine((values, context) =>
        addDuplicateIssue(values, context, 'duplicate document status'),
      ),
  })
  .strict();

export const RETRIEVER_REQUEST_V1_SCHEMA = z
  .object({
    schemaVersion: z.literal('retriever-request-v1'),
    runId: IDENTIFIER_SCHEMA,
    requestId: IDENTIFIER_SCHEMA,
    deadlineAt: DEADLINE_SCHEMA,
    originalQuery: boundedTextSchema(1, 2_000).transform((query) => query.trim()),
    recentTurns: z.array(RECENT_RETRIEVER_TURN_SCHEMA).max(4),
    activeContext: ACTIVE_RETRIEVER_CONTEXT_SCHEMA.optional(),
    requiresRag: z.boolean(),
    policy: RETRIEVER_POLICY_SCHEMA,
  })
  .strict()
  .refine((request) => request.originalQuery.length > 0, { message: 'query is blank' });

export type RetrieverRequestV1 = z.infer<typeof RETRIEVER_REQUEST_V1_SCHEMA>;

export function parseRetrieverRequestV1(
  input: unknown,
): RealtimeChatContractResult<RetrieverRequestV1> {
  return parsePlain(RETRIEVER_REQUEST_V1_SCHEMA, input);
}

const EVIDENCE_CANDIDATE_SCHEMA = z
  .object({
    citationId: CITATION_ID_SCHEMA,
    sourceRef: IDENTIFIER_SCHEMA,
    documentId: IDENTIFIER_SCHEMA,
    chunkId: IDENTIFIER_SCHEMA,
    excerpt: boundedTextSchema(1, 700),
    score: SCORE_SCHEMA,
    vectorScore: SCORE_SCHEMA,
    keywordScore: SCORE_SCHEMA,
    safety: z
      .object({
        ownerScope: z.literal('matched'),
        status: z.enum(['safe', 'caution', 'blocked', 'unknown']),
        codes: z
          .array(z.enum(EVIDENCE_SAFETY_CODES))
          .max(6)
          .superRefine((codes, context) =>
            addDuplicateIssue(codes, context, 'duplicate safety code'),
          ),
      })
      .strict(),
    truncated: z.boolean(),
  })
  .strict();

const RETRIEVER_REWRITE_SCHEMA = z
  .object({
    attempted: z.boolean(),
    disposition: z.enum([
      'not_eligible',
      'gate_off',
      'candidate_applied',
      'candidate_rejected',
      'failed_fallback_original',
      'failed_no_rag',
    ]),
    reasonCode: z.enum(RETRIEVER_REASON_CODES),
  })
  .strict()
  .superRefine((rewrite, context) => {
    const mustBeAttempted = new Set([
      'candidate_applied',
      'candidate_rejected',
      'failed_fallback_original',
      'failed_no_rag',
    ]).has(rewrite.disposition);
    if (rewrite.attempted !== mustBeAttempted) {
      context.addIssue({ code: 'custom', message: 'rewrite attempted invariant failed' });
    }
  });

export const RETRIEVER_RESULT_V1_SCHEMA = z
  .object({
    schemaVersion: z.literal('retriever-result-v1'),
    runId: IDENTIFIER_SCHEMA,
    requestId: IDENTIFIER_SCHEMA,
    status: z.enum(['completed', 'degraded', 'skipped', 'failed']),
    reasonCodes: z
      .array(z.enum(RETRIEVER_REASON_CODES))
      .max(8)
      .superRefine((codes, context) => addDuplicateIssue(codes, context, 'duplicate reason code')),
    originalQueryHash: HASH_REFERENCE_SCHEMA,
    executedQueryHash: HASH_REFERENCE_SCHEMA,
    rewrite: RETRIEVER_REWRITE_SCHEMA,
    retrieval: z
      .object({
        mode: z.literal('hybrid'),
        topK: SAFE_INTEGER_SCHEMA.min(1).max(8),
        minScore: SCORE_SCHEMA,
        latencyMs: SAFE_INTEGER_SCHEMA.min(0).max(120_000),
      })
      .strict(),
    evidenceCandidates: z.array(EVIDENCE_CANDIDATE_SCHEMA).max(8),
    usageRef: AGENT_USAGE_REF_V1_SCHEMA.optional(),
  })
  .strict()
  .superRefine((result, context) => {
    if (
      (result.status === 'degraded' || result.status === 'failed' || result.status === 'skipped') &&
      result.reasonCodes.length === 0
    ) {
      context.addIssue({ code: 'custom', message: 'non-completed result requires a reason' });
    }
    if (result.status === 'skipped' && result.evidenceCandidates.length > 0) {
      context.addIssue({ code: 'custom', message: 'skipped result cannot contain evidence' });
    }
    if (result.evidenceCandidates.length > result.retrieval.topK) {
      context.addIssue({ code: 'custom', message: 'candidate count exceeds topK' });
    }
    addDuplicateIssue(
      result.evidenceCandidates.map((candidate) => candidate.citationId),
      context,
      'duplicate citation id',
    );
    addDuplicateIssue(
      result.evidenceCandidates.map(
        (candidate) => `${candidate.documentId}\u0000${candidate.chunkId}`,
      ),
      context,
      'duplicate evidence identity',
    );
  });

export type EvidenceCandidateV1 = z.infer<typeof EVIDENCE_CANDIDATE_SCHEMA>;
export type RetrieverResultV1 = z.infer<typeof RETRIEVER_RESULT_V1_SCHEMA>;

export function parseRetrieverResultV1(
  input: unknown,
): RealtimeChatContractResult<RetrieverResultV1> {
  return parsePlain(RETRIEVER_RESULT_V1_SCHEMA, input);
}

const VERIFIED_EVIDENCE_ENTRY_V1_SCHEMA = z
  .object({
    citationId: CITATION_ID_SCHEMA,
    sourceRef: IDENTIFIER_SCHEMA,
    documentId: IDENTIFIER_SCHEMA,
    chunkId: IDENTIFIER_SCHEMA,
    sourceLabel: SOURCE_LABEL_SCHEMA,
    excerpt: boundedTextSchema(1, 700),
    trustLabel: z.enum(['trusted', 'caution']),
    safetyCodes: z
      .array(z.enum(VERIFIED_EVIDENCE_SAFETY_CODES))
      .min(1)
      .max(2)
      .superRefine((codes, context) =>
        addDuplicateIssue(codes, context, 'duplicate verified safety code'),
      ),
    truncated: z.boolean(),
  })
  .strict();

export const VERIFIED_EVIDENCE_BUNDLE_V1_SCHEMA = z
  .object({
    schemaVersion: z.literal('verified-evidence-bundle-v1'),
    bundleId: IDENTIFIER_SCHEMA,
    runId: IDENTIFIER_SCHEMA,
    status: z.enum(['trusted', 'suspicious', 'conflict', 'insufficient', 'skipped']),
    reasonCodes: z
      .array(z.enum(EVIDENCE_REASON_CODES))
      .min(1)
      .max(8)
      .superRefine((codes, context) => addDuplicateIssue(codes, context, 'duplicate reason code')),
    entries: z.array(VERIFIED_EVIDENCE_ENTRY_V1_SCHEMA).max(4),
    userNotice: boundedTextSchema(1, 240).optional(),
  })
  .strict()
  .superRefine((bundle, context) => {
    addDuplicateIssue(
      bundle.entries.map((entry) => entry.citationId),
      context,
      'duplicate citation id',
    );
    addDuplicateIssue(
      bundle.entries.map((entry) => `${entry.documentId}\u0000${entry.chunkId}`),
      context,
      'duplicate evidence identity',
    );
    bundle.entries.forEach((entry, index) => {
      if (entry.sourceLabel !== `资料 ${index + 1}`) {
        context.addIssue({ code: 'custom', message: 'source label is not the local ordinal' });
      }
      if (
        !scanCompleteModelField(entry.excerpt, {
          maxUtf16CodeUnits: 700,
          rejectToolOrWriteInstruction: true,
        }).ok
      ) {
        context.addIssue({ code: 'custom', message: 'verified excerpt is unsafe' });
      }
    });
    if (bundle.status === 'trusted') {
      if (
        bundle.entries.length === 0 ||
        bundle.entries.some((entry) => entry.trustLabel !== 'trusted')
      ) {
        context.addIssue({ code: 'custom', message: 'trusted bundle invariant failed' });
      }
    }
    if (
      (bundle.status === 'insufficient' || bundle.status === 'skipped') &&
      bundle.entries.length > 0
    ) {
      context.addIssue({ code: 'custom', message: 'empty bundle status contains entries' });
    }
  });

export type VerifiedEvidenceEntryV1 = z.infer<typeof VERIFIED_EVIDENCE_ENTRY_V1_SCHEMA>;
export type VerifiedEvidenceBundleV1 = z.infer<typeof VERIFIED_EVIDENCE_BUNDLE_V1_SCHEMA>;

export function createVerifiedEvidenceBundleV1(
  input: unknown,
): RealtimeChatContractResult<VerifiedEvidenceBundleV1> {
  return parsePlain(VERIFIED_EVIDENCE_BUNDLE_V1_SCHEMA, input);
}

const FINAL_RESPONSE_CONVERSATION_TURN_SCHEMA = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: boundedTextSchema(1, 2_000),
  })
  .strict();

const FINAL_RESPONSE_ROUTER_DECISION_SCHEMA = z
  .object({
    route: agentRouteSchema,
    requiresRag: z.boolean(),
  })
  .strict();

const FINAL_RESPONSE_TUTOR_GUIDANCE_SCHEMA = z
  .object({
    strategy: z.enum([
      'explain_solution',
      'socratic_hint',
      'step_check',
      'concept_bridge',
      'general_follow_up',
    ]),
    instruction: boundedTextSchema(1, 800),
  })
  .strict();

export const FINAL_RESPONSE_REQUEST_V1_SCHEMA = z
  .object({
    schemaVersion: z.literal('final-response-request-v1'),
    runId: IDENTIFIER_SCHEMA,
    requestId: IDENTIFIER_SCHEMA,
    latestUserMessage: boundedTextSchema(1, 4_000),
    recentConversation: z.array(FINAL_RESPONSE_CONVERSATION_TURN_SCHEMA).max(8),
    routerDecision: FINAL_RESPONSE_ROUTER_DECISION_SCHEMA,
    tutorGuidance: FINAL_RESPONSE_TUTOR_GUIDANCE_SCHEMA.optional(),
    evidenceBundle: VERIFIED_EVIDENCE_BUNDLE_V1_SCHEMA.optional(),
    toolResults: z.array(z.unknown()).max(0),
    contextBudget: z
      .object({
        maxInputTokens: SAFE_INTEGER_SCHEMA.min(256).max(32_000),
        ragIncluded: z.boolean(),
      })
      .strict(),
    allowedCitationIds: z
      .array(CITATION_ID_SCHEMA)
      .max(4)
      .superRefine((ids, context) => addDuplicateIssue(ids, context, 'duplicate citation id')),
    deadlineAt: DEADLINE_SCHEMA,
  })
  .strict()
  .superRefine((request, context) => {
    const bundleCitationIds = new Set(
      request.evidenceBundle?.entries.map((entry) => entry.citationId) ?? [],
    );
    if (
      request.allowedCitationIds.some((citationId) => !bundleCitationIds.has(citationId)) ||
      (request.evidenceBundle !== undefined && request.evidenceBundle.runId !== request.runId)
    ) {
      context.addIssue({ code: 'custom', message: 'citation or run is outside the bundle' });
    }
    if (
      !request.contextBudget.ragIncluded &&
      (request.evidenceBundle !== undefined || request.allowedCitationIds.length > 0)
    ) {
      context.addIssue({ code: 'custom', message: 'omitted RAG retained evidence or citations' });
    }
    if (request.evidenceBundle === undefined && request.allowedCitationIds.length > 0) {
      context.addIssue({ code: 'custom', message: 'citations require evidence' });
    }
  });

export type FinalResponseRequestV1 = z.infer<typeof FINAL_RESPONSE_REQUEST_V1_SCHEMA>;

const validatedFinalResponseRequests = new WeakMap<
  FinalResponseRequestV1,
  AgentExecutionContextV1
>();

export function parseFinalResponseRequestV1(
  input: unknown,
  context: unknown,
): RealtimeChatContractResult<FinalResponseRequestV1> {
  if (!isAgentExecutionContextV1(context)) {
    return { ok: false, reasonCode: 'principal_binding_invalid' };
  }
  const evidenceBundle = getOwnDataProperty(input, 'evidenceBundle');
  if (evidenceBundle.kind === 'invalid') return schemaFailure();
  if (evidenceBundle.kind === 'value') {
    if (!isFormalVerifiedEvidenceBundleV1(evidenceBundle.value)) {
      return { ok: false, reasonCode: 'bundle_not_locally_projected' };
    }
    if (!isFormalVerifiedEvidenceBundleBoundToContextV1(evidenceBundle.value, context)) {
      return { ok: false, reasonCode: 'principal_binding_invalid' };
    }
  }

  const parsed = parsePlain(FINAL_RESPONSE_REQUEST_V1_SCHEMA, input);
  if (!parsed.ok) return parsed;
  if (
    parsed.value.runId !== context.runId ||
    parsed.value.requestId !== context.requestId ||
    parsed.value.deadlineAt !== context.deadlineAt
  ) {
    return { ok: false, reasonCode: 'principal_binding_invalid' };
  }
  validatedFinalResponseRequests.set(parsed.value, context);
  return parsed;
}

export type FinalResponseModelInputV1 = Readonly<{
  latestUserMessage: string;
  recentConversation: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
  routerDecision: Readonly<{ route: z.infer<typeof agentRouteSchema>; requiresRag: boolean }>;
  tutorGuidance?: Readonly<{
    strategy:
      'explain_solution' | 'socratic_hint' | 'step_check' | 'concept_bridge' | 'general_follow_up';
    instruction: string;
  }>;
  evidence: readonly Readonly<{
    citationId: string;
    sourceLabel: string;
    excerpt: string;
    trustLabel: 'trusted' | 'caution';
  }>[];
}>;

export function projectFinalResponseModelInputV1(
  request: FinalResponseRequestV1,
  context: unknown,
): RealtimeChatContractResult<FinalResponseModelInputV1> {
  const boundContext = validatedFinalResponseRequests.get(request);
  if (boundContext === undefined) {
    return { ok: false, reasonCode: 'request_not_validated' };
  }
  if (boundContext !== context) {
    return { ok: false, reasonCode: 'principal_binding_invalid' };
  }
  if (!isFinalResponseModelProjectionSafe(request)) {
    return { ok: false, reasonCode: 'schema_invalid' };
  }
  const projection: FinalResponseModelInputV1 = {
    latestUserMessage: request.latestUserMessage,
    recentConversation: request.recentConversation.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    routerDecision: {
      route: request.routerDecision.route,
      requiresRag: request.routerDecision.requiresRag,
    },
    ...(request.tutorGuidance === undefined
      ? {}
      : {
          tutorGuidance: {
            strategy: request.tutorGuidance.strategy,
            instruction: request.tutorGuidance.instruction,
          },
        }),
    evidence:
      request.evidenceBundle?.entries
        .filter((entry) => request.allowedCitationIds.includes(entry.citationId))
        .map((entry) => ({
          citationId: entry.citationId,
          sourceLabel: entry.sourceLabel,
          excerpt: entry.excerpt,
          trustLabel: entry.trustLabel,
        })) ?? [],
  };
  return { ok: true, value: deepFreezeModelValue(projection) };
}

const FINAL_RESPONSE_STREAM_COMMON_SHAPE = {
  schemaVersion: z.literal('final-response-stream-event-v1'),
  runId: IDENTIFIER_SCHEMA,
  responseId: IDENTIFIER_SCHEMA,
  sequence: SAFE_INTEGER_SCHEMA.min(0).max(1_000_000),
};

const RESPONSE_STARTED_EVENT_SCHEMA = z
  .object({
    ...FINAL_RESPONSE_STREAM_COMMON_SHAPE,
    event: z.literal('response_started'),
    mode: z.enum(['mock', 'live']),
    modelRef: z.enum(FINAL_RESPONSE_MODEL_REFS),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      (event.mode === 'live' && event.modelRef !== 'deepseek-v4-pro-nonthinking-v1') ||
      (event.mode === 'mock' && event.modelRef !== 'mock-local-v1')
    ) {
      context.addIssue({ code: 'custom', message: 'mode/modelRef mismatch' });
    }
  });

const TEXT_DELTA_EVENT_SCHEMA = z
  .object({
    ...FINAL_RESPONSE_STREAM_COMMON_SHAPE,
    event: z.literal('text_delta'),
    text: boundedTextSchema(1, 4_000),
  })
  .strict();

const CITATIONS_EVENT_SCHEMA = z
  .object({
    ...FINAL_RESPONSE_STREAM_COMMON_SHAPE,
    event: z.literal('citations'),
    citations: z
      .array(
        z
          .object({
            citationId: CITATION_ID_SCHEMA,
            sourceLabel: SOURCE_LABEL_SCHEMA,
          })
          .strict(),
      )
      .min(1)
      .max(4)
      .superRefine((citations, context) =>
        addDuplicateIssue(
          citations.map((citation) => citation.citationId),
          context,
          'duplicate citation id',
        ),
      ),
  })
  .strict();

const RESPONSE_COMPLETED_EVENT_SCHEMA = z
  .object({
    ...FINAL_RESPONSE_STREAM_COMMON_SHAPE,
    event: z.literal('response_completed'),
    finishReason: z.enum(['stop', 'length', 'content_filter']),
    usageRef: AGENT_USAGE_REF_V1_SCHEMA,
    traceTerminal: z.enum(['completed', 'completed_trace_unavailable']),
  })
  .strict()
  .refine(
    (event) =>
      event.usageRef.attribution === 'direct' && event.usageRef.attempted && !event.usageRef.cached,
    { message: 'completed response requires direct verified usage reference' },
  );

const RESPONSE_FAILED_EVENT_SCHEMA = z
  .object({
    ...FINAL_RESPONSE_STREAM_COMMON_SHAPE,
    event: z.literal('response_failed'),
    phase: z.enum(['before_first_token', 'after_first_token', 'aborted']),
    errorCode: z.enum([
      'provider_unavailable',
      'provider_timeout',
      'schema_invalid',
      'budget_exceeded',
      'aborted',
      'trace_unavailable',
    ]),
    retryable: z.boolean(),
    userMessage: z.enum([
      FINAL_RESPONSE_FAILURE_MESSAGES.beforeFirstToken,
      FINAL_RESPONSE_FAILURE_MESSAGES.afterFirstToken,
    ]),
    traceTerminal: z.enum(['failed', 'aborted', 'failed_trace_unavailable']),
  })
  .strict()
  .superRefine((event, context) => {
    if (
      event.phase === 'before_first_token' &&
      event.userMessage !== FINAL_RESPONSE_FAILURE_MESSAGES.beforeFirstToken
    ) {
      context.addIssue({ code: 'custom', message: 'invalid pre-token failure message' });
    }
    if (
      event.phase === 'after_first_token' &&
      event.userMessage !== FINAL_RESPONSE_FAILURE_MESSAGES.afterFirstToken
    ) {
      context.addIssue({ code: 'custom', message: 'invalid partial failure message' });
    }
    if (
      event.phase === 'aborted' &&
      (event.errorCode !== 'aborted' || event.traceTerminal !== 'aborted' || event.retryable)
    ) {
      context.addIssue({ code: 'custom', message: 'invalid aborted terminal' });
    }
    if (event.retryable) {
      context.addIssue({ code: 'custom', message: 'background retry is forbidden' });
    }
    if (
      event.phase !== 'aborted' &&
      (event.errorCode === 'aborted' || event.traceTerminal === 'aborted')
    ) {
      context.addIssue({ code: 'custom', message: 'non-abort failure used aborted authority' });
    }
  });

export const FINAL_RESPONSE_STREAM_EVENT_V1_SCHEMA = z.union([
  RESPONSE_STARTED_EVENT_SCHEMA,
  TEXT_DELTA_EVENT_SCHEMA,
  CITATIONS_EVENT_SCHEMA,
  RESPONSE_COMPLETED_EVENT_SCHEMA,
  RESPONSE_FAILED_EVENT_SCHEMA,
]);

export type FinalResponseStreamEventV1 = z.infer<typeof FINAL_RESPONSE_STREAM_EVENT_V1_SCHEMA>;

export function parseFinalResponseStreamEventV1(
  input: unknown,
): RealtimeChatContractResult<FinalResponseStreamEventV1> {
  return parsePlain(FINAL_RESPONSE_STREAM_EVENT_V1_SCHEMA, input);
}

export function validateFinalResponseStreamV1(
  input: unknown,
  optionsInput: unknown,
): RealtimeChatContractResult<readonly FinalResponseStreamEventV1[]> {
  const optionsSchema = z
    .object({
      allowedCitations: z
        .array(
          z
            .object({
              citationId: CITATION_ID_SCHEMA,
              sourceLabel: SOURCE_LABEL_SCHEMA,
            })
            .strict(),
        )
        .max(4)
        .superRefine((citations, context) => {
          addDuplicateIssue(
            citations.map((citation) => citation.citationId),
            context,
            'duplicate citation id',
          );
          addDuplicateIssue(
            citations.map((citation) => citation.sourceLabel),
            context,
            'duplicate source label',
          );
        }),
    })
    .strict();
  const options = parsePlain(optionsSchema, optionsInput);
  const cloned = clonePlainEvidenceData(input);
  if (
    !options.ok ||
    !cloned.ok ||
    !Array.isArray(cloned.value) ||
    cloned.value.length < 2 ||
    cloned.value.length > 256
  ) {
    return schemaFailure();
  }

  const events: FinalResponseStreamEventV1[] = [];
  for (const candidate of cloned.value) {
    const parsed = FINAL_RESPONSE_STREAM_EVENT_V1_SCHEMA.safeParse(candidate);
    if (!parsed.success) return schemaFailure();
    events.push(parsed.data);
  }

  const first = events[0];
  if (first.event !== 'response_started' || first.sequence !== 0) {
    return { ok: false, reasonCode: 'stream_sequence_invalid' };
  }
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (
      event.sequence !== index ||
      event.runId !== first.runId ||
      event.responseId !== first.responseId
    ) {
      return { ok: false, reasonCode: 'stream_sequence_invalid' };
    }
  }

  const terminalIndexes = events.flatMap((event, index) =>
    event.event === 'response_completed' || event.event === 'response_failed' ? [index] : [],
  );
  if (terminalIndexes.length !== 1 || terminalIndexes[0] !== events.length - 1) {
    return { ok: false, reasonCode: 'stream_terminal_invalid' };
  }

  const allowedCitations = new Map(
    options.value.allowedCitations.map((citation) => [citation.citationId, citation.sourceLabel]),
  );
  const emittedCitationIds = new Set<string>();
  let textDeltaCount = 0;
  let citationEventCount = 0;
  for (const event of events) {
    if (event.event === 'text_delta') textDeltaCount += 1;
    if (event.event !== 'citations') continue;
    citationEventCount += 1;
    for (const citation of event.citations) {
      if (
        allowedCitations.get(citation.citationId) !== citation.sourceLabel ||
        emittedCitationIds.has(citation.citationId)
      ) {
        return { ok: false, reasonCode: 'stream_citation_forbidden' };
      }
      emittedCitationIds.add(citation.citationId);
    }
  }
  if (citationEventCount > 1) {
    return { ok: false, reasonCode: 'stream_citation_forbidden' };
  }

  const terminal = events[events.length - 1];
  if (terminal.event === 'response_failed') {
    if (citationEventCount > 0) {
      return { ok: false, reasonCode: 'stream_failure_invariant_invalid' };
    }
    if (
      (terminal.phase === 'before_first_token' && textDeltaCount > 0) ||
      (terminal.phase === 'after_first_token' && textDeltaCount === 0) ||
      (terminal.phase === 'aborted' &&
        terminal.userMessage !==
          (textDeltaCount === 0
            ? FINAL_RESPONSE_FAILURE_MESSAGES.beforeFirstToken
            : FINAL_RESPONSE_FAILURE_MESSAGES.afterFirstToken))
    ) {
      return { ok: false, reasonCode: 'stream_failure_invariant_invalid' };
    }
  }

  return {
    ok: true,
    value: Object.freeze(events.map((event) => deepFreezeModelValue(event))),
  };
}

function parsePlain<Output>(
  schema: z.ZodType<Output>,
  input: unknown,
): RealtimeChatContractResult<Output> {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return schemaFailure();
  const parsed = schema.safeParse(cloned.value);
  if (!parsed.success) return schemaFailure();
  return { ok: true, value: deepFreezeModelValue(parsed.data) };
}

function schemaFailure(): { ok: false; reasonCode: 'schema_invalid' } {
  return { ok: false, reasonCode: 'schema_invalid' };
}

function isFinalResponseModelProjectionSafe(request: FinalResponseRequestV1): boolean {
  if (
    !scanCompleteModelField(request.latestUserMessage, {
      maxUtf16CodeUnits: 4_000,
    }).ok
  ) {
    return false;
  }
  for (const turn of request.recentConversation) {
    if (
      !scanCompleteModelField(turn.content, {
        maxUtf16CodeUnits: 2_000,
      }).ok
    ) {
      return false;
    }
  }
  if (
    request.tutorGuidance !== undefined &&
    !scanCompleteModelField(request.tutorGuidance.instruction, {
      maxUtf16CodeUnits: 800,
      rejectToolOrWriteInstruction: true,
    }).ok
  ) {
    return false;
  }
  return (
    request.evidenceBundle?.entries.every(
      (entry) =>
        scanCompleteModelField(entry.excerpt, {
          maxUtf16CodeUnits: 700,
          rejectToolOrWriteInstruction: true,
        }).ok,
    ) ?? true
  );
}

function isWellFormedText(value: string): boolean {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/u.test(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function snapshotAuthBindings(input: unknown): AgentAuthBindingSourcesV1 | null {
  const snapshot = snapshotControlObject(input, ['authResponse', 'request', 'bearerToken']);
  if (snapshot === null) return null;
  const authResponse = snapshot.authResponse;
  const request = snapshot.request;
  const bearerToken = snapshot.bearerToken;
  if (
    !isObjectReference(authResponse) ||
    !isObjectReference(request) ||
    !isObjectReference(bearerToken)
  ) {
    return null;
  }
  return Object.freeze({ authResponse, request, bearerToken });
}

function snapshotExecutionControl(input: unknown): AgentExecutionControlV1 | null {
  const snapshot = snapshotControlObject(input, [
    'signal',
    'authReceipt',
    'authResponse',
    'request',
    'bearerToken',
  ]);
  if (snapshot === null || !('signal' in snapshot)) return null;
  return snapshot as AgentExecutionControlV1;
}

function snapshotControlObject(
  input: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  if (input === null || typeof input !== 'object') return null;
  try {
    const prototype = Reflect.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== 'string' || !allowedKeys.includes(key))) return null;
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !('value' in descriptor)) return null;
      snapshot[key as string] = descriptor.value;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function isObjectReference(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  try {
    return typeof AbortSignal !== 'undefined' && value instanceof AbortSignal;
  } catch {
    return false;
  }
}

type OwnDataPropertyResult =
  { kind: 'absent' } | { kind: 'value'; value: unknown } | { kind: 'invalid' };

function getOwnDataProperty(input: unknown, key: string): OwnDataPropertyResult {
  if (input === null || typeof input !== 'object') return { kind: 'invalid' };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined) return { kind: 'absent' };
    if (!('value' in descriptor)) return { kind: 'invalid' };
    return { kind: 'value', value: descriptor.value };
  } catch {
    return { kind: 'invalid' };
  }
}
