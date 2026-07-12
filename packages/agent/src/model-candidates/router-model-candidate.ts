import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
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
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';

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

const SAFE_INVALID_RESULT: RouterResult = Object.freeze({
  name: 'chat',
  confidence: 1,
  reason: 'router_candidate_invalid_input',
  requiresRag: false,
  requiresHumanApproval: false,
});

const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
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
      validation.deterministic ?? { ...SAFE_INVALID_RESULT },
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

  const abortState = readRouterAbortSignalState(validation.input.signal);
  if (!abortState.ok) {
    return localEnvelope(
      { ...SAFE_INVALID_RESULT },
      'fallback_invalid_input',
      SAFE_INVALID_BUDGET,
      [],
    );
  }

  if (abortState.aborted) {
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
      budget: safeCandidateBudgetSnapshot(validation.input.budget),
      ...(abortState.signal ? { signal: abortState.signal } : {}),
    });
  } catch {
    return runtimeContractRejectionWithUnavailableTelemetry(
      validation.input.deterministic,
      reservation.budget,
    );
  }

  const runtimeResult = sanitizeModelCandidateRuntimeResult({
    value: rawRuntimeResult,
    dataSchema: ROUTER_MODEL_CANDIDATE_SCHEMA,
    task: 'router_fallback',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: validation.input.budget,
    previewBudget: reservation.budget,
  });
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

type RouterInputValidation =
  | { ok: true; input: RouterModelCandidateInput }
  | {
      ok: false;
      deterministic?: RouterResult;
      budget: ModelAgentRunBudget;
    };

function readRouterAbortSignalState(
  signal: AbortSignal | undefined,
):
  | { ok: true; aborted: boolean; signal?: AbortSignal }
  | { ok: false } {
  if (signal === undefined) return { ok: true, aborted: false };
  try {
    const aborted: unknown = signal.aborted;
    if (typeof aborted !== 'boolean') return { ok: false };
    return { ok: true, aborted, signal };
  } catch {
    return { ok: false };
  }
}

function validateInput(input: unknown): RouterInputValidation {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, budget: SAFE_INVALID_BUDGET };
  }

  try {
    const candidateInput = input as Record<string, unknown>;
    const runId = candidateInput.runId;
    const text = candidateInput.text;
    const activeStudyContext = candidateInput.activeStudyContext;
    const deterministic = candidateInput.deterministic;
    const candidateEligible = candidateInput.candidateEligible;
    const budget = candidateInput.budget;
    const signal = candidateInput.signal;
    const runtime = candidateInput.runtime;
    const deterministicResult = routerResultSchema.safeParse(deterministic);
    const safeBudget = readValidatedRouterBudget(budget);
    if (
      typeof runId !== 'string' ||
      !runId.trim() ||
      typeof text !== 'string' ||
      !text.trim() ||
      utf8Bytes(text) > MAX_RAW_BYTES ||
      (activeStudyContext !== undefined &&
        (typeof activeStudyContext !== 'string' ||
          utf8Bytes(activeStudyContext) > MAX_RAW_BYTES)) ||
      !deterministicResult.success ||
      typeof candidateEligible !== 'boolean' ||
      safeBudget === null ||
      (signal !== undefined && !(signal instanceof AbortSignal)) ||
      typeof runtime !== 'object' ||
      runtime === null ||
      typeof (runtime as Record<string, unknown>).invokeStructured !== 'function'
    ) {
      return {
        ok: false,
        ...(deterministicResult.success
          ? { deterministic: deterministicResult.data }
          : {}),
        budget: safeBudget ?? SAFE_INVALID_BUDGET,
      };
    }
    return {
      ok: true,
      input: {
        runId,
        text,
        ...(activeStudyContext !== undefined
          ? { activeStudyContext }
          : {}),
        deterministic: deterministicResult.data,
        candidateEligible,
        budget: safeBudget,
        ...(signal !== undefined
          ? { signal }
          : {}),
        runtime: runtime as Pick<ModelAgentRuntime, 'invokeStructured'>,
      },
    };
  } catch {
    return { ok: false, budget: SAFE_INVALID_BUDGET };
  }
}

function readValidatedRouterBudget(value: unknown): ModelAgentRunBudget | null {
  if (!isModelAgentRunBudget(value)) return null;
  const snapshot: ModelAgentRunBudget = {
    maxCalls: value.maxCalls,
    usedCalls: value.usedCalls,
    maxInputTokens: value.maxInputTokens,
    usedInputTokens: value.usedInputTokens,
    maxOutputTokens: value.maxOutputTokens,
    usedOutputTokens: value.usedOutputTokens,
  };
  return isModelAgentRunBudget(snapshot) ? snapshot : null;
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
