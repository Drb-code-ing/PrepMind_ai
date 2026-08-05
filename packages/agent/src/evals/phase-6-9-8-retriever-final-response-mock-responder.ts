import { createHash } from 'node:crypto';

import {
  createModelAgentRuntime,
  type FinalResponseStreamExecutor,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  RETRIEVER_QUERY_REWRITE_MODEL,
  RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
} from '../model-candidates/retriever-query-rewrite-model-candidate.ts';

export const PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.8-retriever-final-response-reviewed-mock-v1' as const;
export const PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256 =
  'd9fa0ddcecf910ce120fb711a8cde045e4f324ab201ab1e922167843ce7edc51' as const;

const FACTORY_SOURCE_BOUNDARY = Object.freeze({
  version: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_VERSION,
  rewriteResponderInput: 'actual_runtime_user_prompt',
  finalResponseResponderInput: 'actual_stream_user_prompt',
  outputAuthority: 'mock_quality_not_evidence',
  qualityAuthority: 'none',
  providerCalls: 0,
  credentialReads: 0,
  forbiddenDependencies: [
    'evaluation_manifest',
    'expected_output',
    'oracle',
    'case_id_answer_table',
    'credential',
    'network',
    'provider',
  ],
});

export const PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256 =
  sha256Canonical(FACTORY_SOURCE_BOUNDARY);

export type Phase698Task8RewritePromptAudit = Readonly<{
  task: 'retriever_query_rewrite';
  userPromptSha256: string;
  systemPromptSha256: string;
  projectionKeys: readonly string[];
  protectedTermCount: number;
}>;

export type Phase698Task8FinalResponsePromptAudit = Readonly<{
  userPromptSha256: string;
  systemPromptSha256: string;
  projectionKeys: readonly string[];
  evidenceStatus: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'none';
  evidenceCount: number;
}>;

type RewritePrompt = Readonly<{
  originalQuery: string;
  recentTurns: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
  activeContext?: Readonly<{ trust: 'untrusted'; question?: string; goal?: string }>;
  protectedTerms: readonly string[];
}>;

type FinalResponsePrompt = Readonly<{
  evidenceStatus: 'trusted' | 'suspicious' | 'conflict' | 'insufficient' | 'none';
  input: Readonly<{
    latestUserMessage: string;
    recentConversation: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
    routerDecision: Readonly<{ route: string; requiresRag: boolean }>;
    tutorGuidance?: Readonly<{ strategy: string; instruction: string }>;
    evidence: readonly Readonly<{
      citationId: string;
      sourceLabel: string;
      excerpt: string;
      trustLabel: 'trusted' | 'caution';
    }>[];
  }>;
}>;

/**
 * The responder module deliberately has no manifest/evaluation-oracle import.
 * It derives a candidate only from the exact user prompt supplied by the
 * production candidate seam, then delegates schema/budget/trace generation to
 * the first-party mock runtime.
 */
export function createPhase698Task8PromptOnlyRewriteRuntime(
  onAudit?: (audit: Phase698Task8RewritePromptAudit) => void,
): ModelAgentRuntime {
  return {
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (request.task !== 'retriever_query_rewrite') {
        throw new Error('PHASE_6_9_8_TASK8_REWRITE_TASK_INVALID');
      }
      const prompt = parseRewritePrompt(request.userPrompt);
      const rewrittenQuery = buildRewriteFromPrompt(prompt);
      onAudit?.(
        Object.freeze({
          task: 'retriever_query_rewrite' as const,
          userPromptSha256: sha256(request.userPrompt),
          systemPromptSha256: sha256(request.systemPrompt),
          projectionKeys: Object.freeze(Object.keys(prompt).sort()),
          protectedTermCount: prompt.protectedTerms.length,
        }),
      );
      const delegate = createModelAgentRuntime({
        mode: 'mock',
        provider: 'mock',
        model: RETRIEVER_QUERY_REWRITE_MODEL,
        liveCallsEnabled: false,
        timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
        mockResponder: () => ({ rewrittenQuery }),
      });
      return delegate.invokeStructured(request);
    },
  };
}

/**
 * This executor sees only the production FinalResponse prompt. Citations and
 * terminal authority remain local to FinalResponseAgent; the responder emits
 * text and synthetic usage only.
 */
export function createPhase698Task8PromptOnlyFinalResponseExecutor(
  onAudit?: (audit: Phase698Task8FinalResponsePromptAudit) => void,
): FinalResponseStreamExecutor {
  return async function* (input) {
    const prompt = parseFinalResponsePrompt(input.userPrompt);
    const text = buildFinalResponseFromPrompt(prompt);
    onAudit?.(
      Object.freeze({
        userPromptSha256: sha256(input.userPrompt),
        systemPromptSha256: sha256(input.systemPrompt),
        projectionKeys: Object.freeze(Object.keys(prompt.input).sort()),
        evidenceStatus: prompt.evidenceStatus,
        evidenceCount: prompt.input.evidence.length,
      }),
    );
    yield Object.freeze({ type: 'text_delta' as const, text });
    yield Object.freeze({
      type: 'finish' as const,
      finishReason: 'stop' as const,
      usage: Object.freeze({
        inputTokens: Math.max(
          1,
          Math.ceil((input.systemPrompt.length + input.userPrompt.length) / 4),
        ),
        outputTokens: Math.max(1, Math.ceil(text.length / 4)),
      }),
    });
  };
}

export function validatePhase698Task8ReviewedMockFactory(): Readonly<{
  ok: boolean;
  factorySha256: string;
}> {
  return Object.freeze({
    ok:
      PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256 ===
      PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
    factorySha256: PHASE_6_9_8_TASK8_REVIEWED_MOCK_FACTORY_SHA256,
  });
}

function parseRewritePrompt(input: string): RewritePrompt {
  const value = parseJsonRecord(input, 'PHASE_6_9_8_TASK8_REWRITE_PROMPT_INVALID');
  assertExactKeys(value, ['activeContext', 'originalQuery', 'protectedTerms', 'recentTurns'], true);
  if (typeof value.originalQuery !== 'string' || !value.originalQuery.trim()) {
    throw new Error('PHASE_6_9_8_TASK8_REWRITE_PROMPT_INVALID');
  }
  const recentTurns = parseTurns(value.recentTurns, 500);
  const protectedTerms = parseStringArray(value.protectedTerms, 80);
  const activeContext = parseActiveContext(value.activeContext);
  return Object.freeze({
    originalQuery: value.originalQuery,
    recentTurns,
    ...(activeContext === undefined ? {} : { activeContext }),
    protectedTerms,
  });
}

function buildRewriteFromPrompt(prompt: RewritePrompt): string {
  const contextParts = [
    ...prompt.recentTurns.map((turn) => turn.content),
    ...(prompt.activeContext?.question ? [prompt.activeContext.question] : []),
    ...(prompt.activeContext?.goal ? [prompt.activeContext.goal] : []),
  ];
  if (contextParts.length === 0) {
    throw new Error('PHASE_6_9_8_TASK8_REWRITE_CONTEXT_MISSING');
  }
  const rewritten = `${contextParts.join(' ')} 问题：${prompt.originalQuery}`
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!rewritten || rewritten.length > 2_000) {
    throw new Error('PHASE_6_9_8_TASK8_REWRITE_OUTPUT_INVALID');
  }
  return rewritten;
}

function parseFinalResponsePrompt(input: string): FinalResponsePrompt {
  const root = parseJsonRecord(input, 'PHASE_6_9_8_TASK8_FINAL_PROMPT_INVALID');
  assertExactKeys(root, ['evidenceStatus', 'input', 'schemaVersion']);
  if (root.schemaVersion !== 'final-response-model-input-v1') {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_PROMPT_INVALID');
  }
  if (
    !['trusted', 'suspicious', 'conflict', 'insufficient', 'none'].includes(
      String(root.evidenceStatus),
    )
  ) {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_PROMPT_INVALID');
  }
  if (!isPlainRecord(root.input)) {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_PROMPT_INVALID');
  }
  const modelInput = root.input;
  assertExactKeys(
    modelInput,
    ['evidence', 'latestUserMessage', 'recentConversation', 'routerDecision', 'tutorGuidance'],
    true,
  );
  if (typeof modelInput.latestUserMessage !== 'string' || !modelInput.latestUserMessage.trim()) {
    throw new Error('PHASE_6_9_8_TASK8_FINAL_PROMPT_INVALID');
  }
  const recentConversation = parseTurns(modelInput.recentConversation, 2_000);
  const routerDecision = parseRouterDecision(modelInput.routerDecision);
  const tutorGuidance = parseTutorGuidance(modelInput.tutorGuidance);
  const evidence = parseEvidence(modelInput.evidence);
  return Object.freeze({
    evidenceStatus: root.evidenceStatus as FinalResponsePrompt['evidenceStatus'],
    input: Object.freeze({
      latestUserMessage: modelInput.latestUserMessage,
      recentConversation,
      routerDecision,
      ...(tutorGuidance === undefined ? {} : { tutorGuidance }),
      evidence,
    }),
  });
}

function buildFinalResponseFromPrompt(prompt: FinalResponsePrompt): string {
  const excerpts = prompt.input.evidence.map((entry) => entry.excerpt);
  let prefix: string;
  if (prompt.evidenceStatus === 'trusted') {
    prefix = '根据已核验资料，';
  } else if (prompt.evidenceStatus === 'suspicious') {
    prefix = '资料可信度有限，请谨慎参考：';
  } else if (prompt.evidenceStatus === 'conflict') {
    prefix = '资料存在冲突，需要先核对题目条件：';
  } else if (prompt.evidenceStatus === 'insufficient') {
    prefix = '当前资料不足以支持确定结论；';
  } else {
    prefix = '本次未使用检索资料；';
  }
  const body =
    excerpts.length > 0
      ? excerpts.join(' ')
      : `针对“${prompt.input.latestUserMessage}”，请依据已知条件逐步分析。`;
  const toolBoundary = /保存|删除|创建.*计划|save|delete|create.*plan/iu.test(
    prompt.input.latestUserMessage,
  )
    ? ' 本次未执行任何保存、删除或计划操作。'
    : '';
  const citationBoundary = /资料\s*99|source\s*99/iu.test(prompt.input.latestUserMessage)
    ? ' 引用编号只能由本地证据清单生成，不能引用不存在的资料。'
    : '';
  return `${prefix}${body}${toolBoundary}${citationBoundary}`;
}

function parseJsonRecord(input: string, code: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(input);
    if (!isPlainRecord(parsed)) throw new Error(code);
    return parsed;
  } catch {
    throw new Error(code);
  }
}

function parseTurns(input: unknown, maxLength: number) {
  if (!Array.isArray(input) || input.length > 8) {
    throw new Error('PHASE_6_9_8_TASK8_PROMPT_TURNS_INVALID');
  }
  return Object.freeze(
    input.map((turn) => {
      if (!isPlainRecord(turn)) throw new Error('PHASE_6_9_8_TASK8_PROMPT_TURNS_INVALID');
      assertExactKeys(turn, ['content', 'role']);
      if (
        (turn.role !== 'user' && turn.role !== 'assistant') ||
        typeof turn.content !== 'string' ||
        !turn.content ||
        turn.content.length > maxLength
      ) {
        throw new Error('PHASE_6_9_8_TASK8_PROMPT_TURNS_INVALID');
      }
      return Object.freeze({ role: turn.role, content: turn.content });
    }),
  );
}

function parseStringArray(input: unknown, maxLength: number): readonly string[] {
  if (!Array.isArray(input) || input.length > 64) {
    throw new Error('PHASE_6_9_8_TASK8_PROMPT_ARRAY_INVALID');
  }
  const output: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string' || !value || value.length > maxLength) {
      throw new Error('PHASE_6_9_8_TASK8_PROMPT_ARRAY_INVALID');
    }
    output.push(value);
  }
  return Object.freeze(output);
}

function parseActiveContext(input: unknown): RewritePrompt['activeContext'] | undefined {
  if (input === undefined) return undefined;
  if (!isPlainRecord(input)) throw new Error('PHASE_6_9_8_TASK8_ACTIVE_CONTEXT_INVALID');
  assertExactKeys(input, ['goal', 'question', 'trust'], true);
  if (input.trust !== 'untrusted') throw new Error('PHASE_6_9_8_TASK8_ACTIVE_CONTEXT_INVALID');
  const question = input.question;
  const goal = input.goal;
  if (
    (question !== undefined &&
      (typeof question !== 'string' || !question || question.length > 300)) ||
    (goal !== undefined && (typeof goal !== 'string' || !goal || goal.length > 300)) ||
    (question === undefined && goal === undefined)
  ) {
    throw new Error('PHASE_6_9_8_TASK8_ACTIVE_CONTEXT_INVALID');
  }
  return Object.freeze({
    trust: 'untrusted' as const,
    ...(typeof question === 'string' ? { question } : {}),
    ...(typeof goal === 'string' ? { goal } : {}),
  });
}

function parseRouterDecision(input: unknown): FinalResponsePrompt['input']['routerDecision'] {
  if (!isPlainRecord(input)) throw new Error('PHASE_6_9_8_TASK8_ROUTER_PROMPT_INVALID');
  assertExactKeys(input, ['requiresRag', 'route']);
  if (typeof input.route !== 'string' || typeof input.requiresRag !== 'boolean') {
    throw new Error('PHASE_6_9_8_TASK8_ROUTER_PROMPT_INVALID');
  }
  return Object.freeze({ route: input.route, requiresRag: input.requiresRag });
}

function parseTutorGuidance(input: unknown): FinalResponsePrompt['input']['tutorGuidance'] {
  if (input === undefined) return undefined;
  if (!isPlainRecord(input)) throw new Error('PHASE_6_9_8_TASK8_TUTOR_PROMPT_INVALID');
  assertExactKeys(input, ['instruction', 'strategy']);
  if (typeof input.strategy !== 'string' || typeof input.instruction !== 'string') {
    throw new Error('PHASE_6_9_8_TASK8_TUTOR_PROMPT_INVALID');
  }
  return Object.freeze({ strategy: input.strategy, instruction: input.instruction });
}

function parseEvidence(input: unknown): FinalResponsePrompt['input']['evidence'] {
  if (!Array.isArray(input) || input.length > 4) {
    throw new Error('PHASE_6_9_8_TASK8_EVIDENCE_PROMPT_INVALID');
  }
  return Object.freeze(
    input.map((entry) => {
      if (!isPlainRecord(entry)) throw new Error('PHASE_6_9_8_TASK8_EVIDENCE_PROMPT_INVALID');
      assertExactKeys(entry, ['citationId', 'excerpt', 'sourceLabel', 'trustLabel']);
      if (
        typeof entry.citationId !== 'string' ||
        typeof entry.sourceLabel !== 'string' ||
        typeof entry.excerpt !== 'string' ||
        !entry.excerpt ||
        entry.excerpt.length > 700 ||
        (entry.trustLabel !== 'trusted' && entry.trustLabel !== 'caution')
      ) {
        throw new Error('PHASE_6_9_8_TASK8_EVIDENCE_PROMPT_INVALID');
      }
      return Object.freeze({
        citationId: entry.citationId,
        sourceLabel: entry.sourceLabel,
        excerpt: entry.excerpt,
        trustLabel: entry.trustLabel,
      });
    }),
  );
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  optionalAllowed = false,
) {
  const keys = Object.keys(value).sort();
  if (keys.some((key) => !allowed.includes(key))) {
    throw new Error('PHASE_6_9_8_TASK8_PROMPT_KEYS_INVALID');
  }
  if (
    !optionalAllowed &&
    (keys.length !== allowed.length || allowed.some((key) => !keys.includes(key)))
  ) {
    throw new Error('PHASE_6_9_8_TASK8_PROMPT_KEYS_INVALID');
  }
  if (optionalAllowed) {
    const required = allowed.filter(
      (key) => !['activeContext', 'goal', 'question', 'tutorGuidance'].includes(key),
    );
    if (required.some((key) => !keys.includes(key))) {
      throw new Error('PHASE_6_9_8_TASK8_PROMPT_KEYS_INVALID');
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function sha256Canonical(value: unknown): string {
  return sha256(JSON.stringify(canonicalValue(value)));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalValue((value as Record<string, unknown>)[key])]),
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
