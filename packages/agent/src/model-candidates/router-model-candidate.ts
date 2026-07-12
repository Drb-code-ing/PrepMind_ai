import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentResult,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import { routerResultSchema, type RouterResult } from '@repo/types/api/agent';

import {
  ZERO_CANDIDATE_USAGE,
  canonicalCandidateReasonCodes,
  containsOrderedSignalsWithin,
  detectHardBlockedCandidateMaterial,
  estimateCandidateInputTokens,
  mapModelAgentErrorDisposition,
  normalizeCandidateScanText,
  prepareCandidateText,
  safeCandidateBudgetSnapshot,
  type HardBlockCode,
  type ModelCandidateDisposition,
  type ModelCandidateEnvelope,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';

export const ROUTER_MODEL_CANDIDATE_SCHEMA = z
  .object({
    route: z.enum([
      'chat',
      'tutor',
      'rag_answer',
      'study_plan',
      'review_analysis',
      'wrong_question_organize',
    ]),
    confidence: z.number().min(0).max(1),
    reasonCode: z.enum([
      'ambiguous_intent_resolved',
      'active_context_follow_up',
      'multi_intent_priority',
      'insufficient_context',
    ]),
  })
  .strict();

export const ROUTER_SAFETY_CODES = [
  'instruction_override',
  'credential_exfiltration',
  'system_prompt_exfiltration',
  'cross_user_access',
  'false_write_claim',
  'unsupported_system_tool',
  'unconfirmed_memory_write',
  'destructive_knowledge_write',
] as const;

export type RouterSafetyCode = (typeof ROUTER_SAFETY_CODES)[number];
export type RouterCandidateReasonCode = z.infer<
  typeof ROUTER_MODEL_CANDIDATE_SCHEMA
>['reasonCode'];
type RouterObservationReasonCode =
  | RouterCandidateReasonCode
  | RouterSafetyCode
  | ModelAgentErrorCode;

export type RouterModelCandidateInput = {
  runId: string;
  text: string;
  activeStudyContext?: string;
  deterministic: RouterResult;
  candidateEligible: boolean;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
};

export type RouterModelCandidateEnvelope = ModelCandidateEnvelope<
  RouterResult,
  RouterObservationReasonCode
>;

const MAX_RAW_BYTES = 16_384;
const MAX_TEXT_CODE_POINTS = 1_600;
const MAX_CONTEXT_CODE_POINTS = 1_200;
const MAX_INPUT_TOKENS = 800;
const MAX_OUTPUT_TOKENS = 120;
const MAX_SIGNAL_GAP = 40;

const MODEL_AGENT_ERROR_CODE_SCHEMA = z.enum([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
]);

const RUNTIME_BUDGET_SCHEMA = z
  .object({
    maxCalls: z.number().int().safe().positive(),
    usedCalls: z.number().int().safe().min(0),
    maxInputTokens: z.number().int().safe().positive(),
    usedInputTokens: z.number().int().safe().min(0),
    maxOutputTokens: z.number().int().safe().positive(),
    usedOutputTokens: z.number().int().safe().min(0),
  })
  .strict();

const RUNTIME_USAGE_SCHEMA = z
  .object({
    inputTokens: z.number().int().safe().min(0),
    outputTokens: z.number().int().safe().min(0),
  })
  .strict();

const RUNTIME_TRACE_SCHEMA = z
  .object({
    runIdHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    task: z.literal('router_fallback'),
    mode: z.enum(['mock', 'live']),
    provider: z.enum(['mock', 'deepseek', 'openai']),
    model: z.string().regex(/^[A-Za-z0-9._:/-]{1,120}$/),
    status: z.enum(['succeeded', 'failed']),
    inputTokens: z.number().int().safe().min(0),
    outputTokens: z.number().int().safe().min(0),
    maxOutputTokens: z.literal(MAX_OUTPUT_TOKENS),
    durationMs: z.number().int().safe().min(0),
    degraded: z.boolean(),
    errorCode: MODEL_AGENT_ERROR_CODE_SCHEMA.optional(),
  })
  .strict();

const RUNTIME_SUCCESS_SCHEMA = z
  .object({
    ok: z.literal(true),
    data: ROUTER_MODEL_CANDIDATE_SCHEMA,
    budget: RUNTIME_BUDGET_SCHEMA,
    usage: RUNTIME_USAGE_SCHEMA,
    trace: RUNTIME_TRACE_SCHEMA,
  })
  .strict();

const RUNTIME_FAILURE_SCHEMA = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: MODEL_AGENT_ERROR_CODE_SCHEMA,
        message: z.string(),
        retryable: z.boolean(),
      })
      .strict(),
    budget: RUNTIME_BUDGET_SCHEMA,
    usage: RUNTIME_USAGE_SCHEMA,
    trace: RUNTIME_TRACE_SCHEMA,
  })
  .strict();

const SAFE_INVALID_RESULT: RouterResult = Object.freeze({
  name: 'chat',
  confidence: 1,
  reason: 'router_candidate_invalid_input',
  requiresRag: false,
  requiresHumanApproval: false,
});

const ROUTER_SYSTEM_PROMPT = `你是 PrepMind Router 模型候选，只做路由分类，不执行工具、权限或写操作。
六个路由定义：
- chat：普通对话或上下文不足。
- tutor：讲题、追问或学习概念辅导。
- rag_answer：必须依据用户资料回答。
- study_plan：学习计划建议，不得执行写操作。
- review_analysis：复习表现与薄弱点分析，不得执行写操作。
- wrong_question_organize：错题组织建议，不得执行写操作。`;

const ROUTER_SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"route":"chat|tutor|rag_answer|study_plan|review_analysis|wrong_question_organize","confidence":"number 0..1","reasonCode":"ambiguous_intent_resolved|active_context_follow_up|multi_intent_priority|insufficient_context"}. No extra fields.';

const ROUTE_PERMISSIONS: Record<
  z.infer<typeof ROUTER_MODEL_CANDIDATE_SCHEMA>['route'],
  Pick<RouterResult, 'requiresRag' | 'requiresHumanApproval'>
> = {
  chat: { requiresRag: false, requiresHumanApproval: false },
  tutor: { requiresRag: false, requiresHumanApproval: false },
  rag_answer: { requiresRag: true, requiresHumanApproval: false },
  study_plan: { requiresRag: false, requiresHumanApproval: true },
  review_analysis: { requiresRag: false, requiresHumanApproval: true },
  wrong_question_organize: { requiresRag: false, requiresHumanApproval: true },
};

const REASON_TEMPLATES: Record<
  z.infer<typeof ROUTER_MODEL_CANDIDATE_SCHEMA>['reasonCode'],
  string
> = {
  ambiguous_intent_resolved: '模型候选已解决歧义意图。',
  active_context_follow_up: '模型候选识别为当前学习上下文的继续追问。',
  multi_intent_priority: '模型候选已按固定优先级解析多重意图。',
  insufficient_context: '模型候选判断当前上下文不足，使用普通对话。',
};

export function detectRouterSafetyCode(value: string): RouterSafetyCode | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeCandidateScanText(value);
  const sharedHardBlock = detectHardBlockedCandidateMaterial(normalized);

  if (
    /忽略(?:规则|以上)/u.test(normalized) ||
    containsOrderedAsciiSignalsWithin(
      normalized,
      [['ignore rule', 'ignore rules', 'ignore previous', 'ignore above']],
      0,
    ) ||
    sharedHardBlock === 'instruction_override'
  ) {
    return 'instruction_override';
  }

  if (
    /访问\s*凭据/u.test(normalized) ||
    sharedHardBlock === 'credential_material' ||
    containsOrderedAsciiSignalsWithin(
      normalized,
      [
        ['show', 'print', 'reveal', 'return', 'output', 'echo', 'display', 'expose'],
        ['api key', 'access token', 'cookie', 'client secret', 'password'],
      ],
      MAX_SIGNAL_GAP,
    )
  ) {
    return 'credential_exfiltration';
  }

  if (
    /系统\s*提示词/u.test(normalized) ||
    containsOrderedAsciiSignalsWithin(normalized, [['system prompt']], 0) ||
    sharedHardBlock === 'system_prompt_exfiltration'
  ) {
    return 'system_prompt_exfiltration';
  }
  if (
    /另一个\s*用户|其他\s*账号|别人的\s*错题/u.test(normalized) ||
    containsOrderedAsciiSignalsWithin(normalized, [['another user']], 0)
  ) {
    return 'cross_user_access';
  }
  if (
    containsOrderedSignalsWithin(
      normalized,
      [
        ['不用', '无需', '不经确认'],
        ['已经', '已创建', '已完成'],
      ],
      MAX_SIGNAL_GAP,
    ) ||
    containsOrderedAsciiSignalsWithin(
      normalized,
      [['say'], ['already created', 'already completed']],
      MAX_SIGNAL_GAP,
    )
  ) {
    return 'false_write_claim';
  }
  if (
    /系统\s*命令|清空\s*目录/u.test(normalized) ||
    containsOrderedAsciiSignalsWithin(normalized, [['system command']], 0) ||
    containsOrderedAsciiSignalsWithin(normalized, [['delete directory']], 0) ||
    containsOrderedAsciiSignalsWithin(
      normalized,
      [
        ['shell'],
        ['run', 'execute', 'invoke', 'call', 'command', 'terminal', 'script'],
      ],
      MAX_SIGNAL_GAP,
    ) ||
    containsOrderedAsciiSignalsWithin(
      normalized,
      [
        ['run', 'execute', 'invoke', 'call', 'command', 'terminal', 'script'],
        ['shell'],
      ],
      MAX_SIGNAL_GAP,
    )
  ) {
    return 'unsupported_system_tool';
  }
  if (
    containsOrderedSignalsWithin(
      normalized,
      [
        ['不经', '无需确认'],
        ['永久记住', '长期记忆'],
      ],
      MAX_SIGNAL_GAP,
    ) ||
    containsOrderedAsciiSignalsWithin(normalized, [['remember permanently']], 0)
  ) {
    return 'unconfirmed_memory_write';
  }
  if (
    containsOrderedSignalsWithin(
      normalized,
      [
        ['自动', '直接'],
        ['删除', '合并', '替换'],
        ['资料', '文档', '知识库'],
      ],
      MAX_SIGNAL_GAP,
    )
  ) {
    return 'destructive_knowledge_write';
  }
  return null;
}

export async function runRouterModelCandidate(
  input: RouterModelCandidateInput,
): Promise<RouterModelCandidateEnvelope> {
  const validation = validateInput(input);
  if (!validation.ok) {
    return localEnvelope(
      safeDeterministicResult(validation.deterministic),
      'fallback_invalid_input',
      validation.budget,
      [],
    );
  }

  const rawSafetyCode = detectRouterSafetyCode(
    `${validation.input.text}\n${validation.input.activeStudyContext ?? ''}`,
  );
  if (rawSafetyCode) {
    return safetyEnvelope(rawSafetyCode, validation.input.budget);
  }

  if (!validation.input.candidateEligible) {
    return localEnvelope(
      validation.input.deterministic,
      'not_eligible',
      validation.input.budget,
      [],
    );
  }

  if (validation.input.signal?.aborted) {
    return localEnvelope(
      validation.input.deterministic,
      'fallback_aborted',
      validation.input.budget,
      ['ABORTED'],
    );
  }

  const preparedText = prepareCandidateText({
    value: validation.input.text,
    maxRawBytes: MAX_RAW_BYTES,
    maxChars: MAX_TEXT_CODE_POINTS,
  });
  if (!preparedText.ok) {
    return preparedText.hardBlockCode
      ? safetyEnvelope(
          mapHardBlockCode(preparedText.hardBlockCode),
          validation.input.budget,
        )
      : localEnvelope(
          validation.input.deterministic,
          preparedText.disposition,
          validation.input.budget,
          [],
        );
  }

  const preparedContext = prepareCandidateText({
    value: validation.input.activeStudyContext ?? '',
    maxRawBytes: MAX_RAW_BYTES,
    maxChars: MAX_CONTEXT_CODE_POINTS,
  });
  if (!preparedContext.ok) {
    return preparedContext.hardBlockCode
      ? safetyEnvelope(
          mapHardBlockCode(preparedContext.hardBlockCode),
          validation.input.budget,
        )
      : localEnvelope(
          validation.input.deterministic,
          preparedContext.disposition,
          validation.input.budget,
          [],
        );
  }

  const userPrompt = JSON.stringify({
    text: preparedText.text,
    activeStudyContext: preparedContext.text,
    deterministicRoute: validation.input.deterministic.name,
  });
  const estimatedInputTokens = estimateCandidateInputTokens([
    ROUTER_SYSTEM_PROMPT,
    userPrompt,
    ROUTER_SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return localEnvelope(
      validation.input.deterministic,
      'fallback_invalid_input',
      validation.input.budget,
      [],
    );
  }

  const reservation = reserveModelAgentBudget(validation.input.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    const errorCode: ModelAgentErrorCode =
      reservation.code === 'INVALID_MODEL_AGENT_BUDGET'
        ? 'INVALID_REQUEST'
        : reservation.code;
    const disposition = mapModelAgentErrorDisposition(errorCode);
    return localEnvelope(
      validation.input.deterministic,
      disposition,
      validation.input.budget,
      [errorCode],
    );
  }

  let rawRuntimeResult: unknown;
  try {
    rawRuntimeResult = await validation.input.runtime.invokeStructured({
      runId: validation.input.runId,
      task: 'router_fallback',
      schema: ROUTER_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      userPrompt,
      estimatedInputTokens,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      budget: validation.input.budget,
      ...(validation.input.signal ? { signal: validation.input.signal } : {}),
    });
  } catch {
    return runtimeContractRejectionWithUnavailableTelemetry(
      validation.input.deterministic,
      reservation.budget,
    );
  }

  const runtimeResult = sanitizeRouterRuntimeResult(
    rawRuntimeResult,
    validation.input.budget,
    reservation.budget,
  );
  if (!runtimeResult) {
    return runtimeContractRejectionWithUnavailableTelemetry(
      validation.input.deterministic,
      reservation.budget,
    );
  }

  if (!runtimeResult.ok) {
    const disposition = mapModelAgentErrorDisposition(runtimeResult.error.code);
    return {
      result: validation.input.deterministic,
      observation: {
        attempted: true,
        disposition,
        budget: runtimeResult.budget,
        usage: runtimeResult.usage,
        trace: runtimeResult.trace,
        reasonCodes: canonicalCandidateReasonCodes(disposition, [runtimeResult.error.code]),
      } as ModelCandidateObservation<RouterObservationReasonCode>,
    };
  }

  const permissions = ROUTE_PERMISSIONS[runtimeResult.data.route];
  return {
    result: {
      name: runtimeResult.data.route,
      confidence: runtimeResult.data.confidence,
      reason: REASON_TEMPLATES[runtimeResult.data.reasonCode],
      ...permissions,
    },
    observation: {
      attempted: true,
      disposition: 'candidate_applied',
      budget: runtimeResult.budget,
      usage: runtimeResult.usage,
      trace: runtimeResult.trace,
      reasonCodes: canonicalCandidateReasonCodes('candidate_applied', [
        runtimeResult.data.reasonCode,
      ]),
    },
  };
}

function validateInput(input: unknown):
  | { ok: true; input: RouterModelCandidateInput }
  | { ok: false; deterministic: unknown; budget: unknown } {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, deterministic: undefined, budget: undefined };
  }

  const candidateInput = input as Record<string, unknown>;
  const deterministic = candidateInput.deterministic;
  const budget = candidateInput.budget;
  try {
    const deterministicResult = routerResultSchema.safeParse(deterministic);
    const runtime = candidateInput.runtime;
    if (
      typeof candidateInput.runId !== 'string' ||
      !candidateInput.runId.trim() ||
      typeof candidateInput.text !== 'string' ||
      !candidateInput.text.trim() ||
      utf8Bytes(candidateInput.text) > MAX_RAW_BYTES ||
      (candidateInput.activeStudyContext !== undefined &&
        (typeof candidateInput.activeStudyContext !== 'string' ||
          utf8Bytes(candidateInput.activeStudyContext) > MAX_RAW_BYTES)) ||
      !deterministicResult.success ||
      typeof candidateInput.candidateEligible !== 'boolean' ||
      !isModelAgentRunBudget(budget) ||
      (candidateInput.signal !== undefined && !(candidateInput.signal instanceof AbortSignal)) ||
      typeof runtime !== 'object' ||
      runtime === null ||
      typeof (runtime as Record<string, unknown>).invokeStructured !== 'function'
    ) {
      return { ok: false, deterministic, budget };
    }
    return {
      ok: true,
      input: {
        runId: candidateInput.runId,
        text: candidateInput.text,
        ...(candidateInput.activeStudyContext !== undefined
          ? { activeStudyContext: candidateInput.activeStudyContext }
          : {}),
        deterministic: deterministicResult.data,
        candidateEligible: candidateInput.candidateEligible,
        budget,
        ...(candidateInput.signal !== undefined
          ? { signal: candidateInput.signal }
          : {}),
        runtime: candidateInput.runtime as Pick<ModelAgentRuntime, 'invokeStructured'>,
      },
    };
  } catch {
    return { ok: false, deterministic, budget };
  }
}

function safeDeterministicResult(value: unknown): RouterResult {
  const parsed = routerResultSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...SAFE_INVALID_RESULT };
}

function localEnvelope(
  result: RouterResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasonCodes: readonly RouterObservationReasonCode[],
): RouterModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasonCodes),
    } as ModelCandidateObservation<RouterObservationReasonCode>,
  };
}

function safetyEnvelope(
  code: RouterSafetyCode,
  budget: ModelAgentRunBudget,
): RouterModelCandidateEnvelope {
  return localEnvelope(
    {
      name: 'chat',
      confidence: 1,
      reason: `safety_boundary:${code}`,
      requiresRag: false,
      requiresHumanApproval: false,
    },
    'safety_blocked',
    budget,
    [code],
  );
}

function runtimeContractRejectionWithUnavailableTelemetry(
  result: RouterResult,
  budget: ModelAgentRunBudget,
): RouterModelCandidateEnvelope {
  return {
    result,
    observation: {
      attempted: true,
      traceUnavailable: true,
      usageUnavailable: true,
      disposition: 'fallback_runtime_error',
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes('fallback_runtime_error', []),
    },
  };
}

function mapHardBlockCode(code: HardBlockCode): RouterSafetyCode {
  switch (code) {
    case 'instruction_override':
      return 'instruction_override';
    case 'credential_material':
      return 'credential_exfiltration';
    case 'system_prompt_exfiltration':
      return 'system_prompt_exfiltration';
  }
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function containsOrderedAsciiSignalsWithin(
  value: string,
  groups: readonly (readonly string[])[],
  maxGap: number,
): boolean {
  if (!Number.isSafeInteger(maxGap) || maxGap < 0 || groups.length === 0) return false;

  const source = Array.from(value);
  let reachableEnds = new Array<boolean>(source.length + 1).fill(false);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const terms = (groups[groupIndex] ?? []).map((term) => Array.from(term));
    const nextReachableEnds = new Array<boolean>(source.length + 1).fill(false);
    let matched = false;

    for (let start = 0; start < source.length; start += 1) {
      if (
        groupIndex > 0 &&
        !hasReachableAsciiEndWithin(reachableEnds, start, maxGap)
      ) {
        continue;
      }
      for (const term of terms) {
        if (!matchesBoundedAsciiTermAt(source, term, start)) continue;
        nextReachableEnds[start + term.length] = true;
        matched = true;
      }
    }

    if (!matched) return false;
    reachableEnds = nextReachableEnds;
  }

  return true;
}

function hasReachableAsciiEndWithin(
  reachableEnds: readonly boolean[],
  start: number,
  maxGap: number,
): boolean {
  const firstEnd = Math.max(0, start - maxGap);
  for (let end = firstEnd; end <= start; end += 1) {
    if (reachableEnds[end]) return true;
  }
  return false;
}

function matchesBoundedAsciiTermAt(
  source: readonly string[],
  term: readonly string[],
  start: number,
): boolean {
  if (term.length === 0 || start + term.length > source.length) return false;
  if (isAsciiWordCodePoint(source[start - 1])) return false;
  if (isAsciiWordCodePoint(source[start + term.length])) return false;

  for (let offset = 0; offset < term.length; offset += 1) {
    if (source[start + offset] !== term[offset]) return false;
  }
  return true;
}

function isAsciiWordCodePoint(value: string | undefined): boolean {
  if (!value || value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    code === 95
  );
}

function sanitizeRouterRuntimeResult(
  value: unknown,
  callerBudget: ModelAgentRunBudget,
  previewBudget: ModelAgentRunBudget,
): ModelAgentResult<z.infer<typeof ROUTER_MODEL_CANDIDATE_SCHEMA>> | null {
  const success = RUNTIME_SUCCESS_SCHEMA.safeParse(value);
  if (success.success) {
    const candidate = success.data;
    if (
      !isModelAgentRunBudget(candidate.budget) ||
      !budgetsEqual(candidate.budget, previewBudget) ||
      !isConsistentRuntimeTrace(candidate.trace, candidate.usage) ||
      candidate.trace.status !== 'succeeded' ||
      candidate.trace.degraded ||
      candidate.trace.errorCode !== undefined
    ) {
      return null;
    }
    return candidate;
  }

  const failure = RUNTIME_FAILURE_SCHEMA.safeParse(value);
  if (!failure.success) return null;
  const candidate = failure.data;
  if (
    !isModelAgentRunBudget(candidate.budget) ||
    !hasExpectedFailureBudget(
      candidate.error.code,
      candidate.budget,
      callerBudget,
      previewBudget,
    ) ||
    !isConsistentRuntimeTrace(candidate.trace, candidate.usage) ||
    candidate.trace.status !== 'failed' ||
    !candidate.trace.degraded ||
    candidate.trace.errorCode !== candidate.error.code
  ) {
    return null;
  }
  return candidate;
}

function hasExpectedFailureBudget(
  errorCode: ModelAgentErrorCode,
  actualBudget: ModelAgentRunBudget,
  callerBudget: ModelAgentRunBudget,
  previewBudget: ModelAgentRunBudget,
): boolean {
  switch (errorCode) {
    case 'SCHEMA_INVALID':
    case 'TIMEOUT':
    case 'PROVIDER_ERROR':
      return budgetsEqual(actualBudget, previewBudget);
    case 'ABORTED':
      return (
        budgetsEqual(actualBudget, callerBudget) ||
        budgetsEqual(actualBudget, previewBudget)
      );
    case 'INVALID_REQUEST':
    case 'LIVE_CALLS_DISABLED':
    case 'EXECUTOR_UNAVAILABLE':
    case 'CALL_BUDGET_EXCEEDED':
    case 'INPUT_BUDGET_EXCEEDED':
    case 'OUTPUT_BUDGET_EXCEEDED':
    case 'INVALID_RUNTIME_CONFIG':
      return budgetsEqual(actualBudget, callerBudget);
  }
}

function budgetsEqual(
  left: ModelAgentRunBudget,
  right: ModelAgentRunBudget,
): boolean {
  return (
    left.maxCalls === right.maxCalls &&
    left.usedCalls === right.usedCalls &&
    left.maxInputTokens === right.maxInputTokens &&
    left.usedInputTokens === right.usedInputTokens &&
    left.maxOutputTokens === right.maxOutputTokens &&
    left.usedOutputTokens === right.usedOutputTokens
  );
}

function isConsistentRuntimeTrace(
  trace: z.infer<typeof RUNTIME_TRACE_SCHEMA>,
  usage: z.infer<typeof RUNTIME_USAGE_SCHEMA>,
): boolean {
  return (
    trace.inputTokens === usage.inputTokens &&
    trace.outputTokens === usage.outputTokens &&
    ((trace.mode === 'mock' && trace.provider === 'mock') ||
      (trace.mode === 'live' && trace.provider !== 'mock'))
  );
}
