import { z } from 'zod';

import {
  isModelAgentRunBudget,
  reserveModelAgentBudget,
  type ModelAgentErrorCode,
  type ModelAgentRequest,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
} from '@repo/ai';
import {
  knowledgeDedupResultSchema,
  type KnowledgeDedupItem,
  type KnowledgeDedupResult,
} from '@repo/types/api/knowledge-agent';

import {
  KNOWLEDGE_DEDUP_MODEL_SCHEMA,
  validateKnowledgeDedupModelDecision,
  type KnowledgeDedupModelDecision,
} from './knowledge-agent-model-contract.ts';
import {
  KNOWLEDGE_MODEL_PROJECTION_VERSION,
  projectKnowledgeSnapshotForCandidate,
  type KnowledgeModelProjection,
  type KnowledgeProjectionReasonCode,
} from './knowledge-model-projection.ts';
import {
  ZERO_CANDIDATE_USAGE,
  canonicalCandidateReasonCodes,
  estimateCandidateInputTokens,
  mapModelAgentErrorDisposition,
  safeCandidateBudgetSnapshot,
  type ModelCandidateDisposition,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import {
  MAX_KNOWLEDGE_DEDUP_SUGGESTIONS,
  analyzeKnowledgeDedup,
  hasKnowledgeRevisionSignal,
  type KnowledgeAgentDocumentInput,
  type KnowledgeDedupInput,
} from '../nodes/knowledge-dedup.ts';

const MAX_INPUT_TOKENS = 3000;
const MAX_OUTPUT_TOKENS = 500;

const SYSTEM_PROMPT = [
  'Classify only the supplied ordinal document pairs.',
  'Use one of semantic_duplicate, possible_revision, complementary, or unrelated.',
  'Prefer possible_revision over semantic_duplicate when filenames or older/newer relativeTime show draft, revision, version, or update evidence.',
  'semantic_duplicate requires semantic_overlap; its evidenceCodes may contain only semantic_overlap and same_scope.',
  'possible_revision requires semantic_overlap; its evidenceCodes may contain only semantic_overlap, version_signal, newer_timestamp, and insufficient_version_evidence.',
  'complementary requires different_purpose or complementary_coverage; its evidenceCodes may also contain semantic_overlap.',
  'unrelated requires different_purpose or insufficient_version_evidence and may use only those codes.',
  'Return only strict JSON with pairIndex, relation, confidence, and allowed evidenceCodes.',
  'Never invent documents, exact hashes, identifiers, write actions, deletion, replacement, or permissions.',
].join(' ');
const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"decisions":[{"pairIndex":0,"relation":"semantic_duplicate|possible_revision|complementary|unrelated","confidence":"medium|high","evidenceCodes":["allowed_code"]}]}. No extra fields.';

const DOCUMENT_SCHEMA = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(65_536),
    type: z.enum(['PDF', 'DOCX', 'MD', 'TXT']),
    size: z.number().int().nonnegative(),
    status: z.enum(['PENDING', 'PROCESSING', 'DONE', 'FAILED']),
    sourceType: z.enum(['UPLOAD', 'NOTE', 'WRONG_QUESTION', 'OCR', 'CHAT']),
    contentHash: z.string().max(512).nullable(),
    chunkCount: z.number().int().nonnegative(),
    processedAt: z.string().nullable(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    chunkSummaries: z.array(z.string().max(65_536)).max(12),
  })
  .strict();
const DETERMINISTIC_INPUT_SCHEMA = z
  .object({
    now: z.string().min(1),
    targetDocumentId: z.string().min(1).max(256).optional(),
    documents: z.array(DOCUMENT_SCHEMA).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.documents.map((document) => document.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate document id' });
    }
    if (
      value.targetDocumentId !== undefined &&
      !ids.includes(value.targetDocumentId)
    ) {
      context.addIssue({ code: 'custom', message: 'target document missing' });
    }
  });

const SAFE_INVALID_RESULT = Object.freeze({
  summary: '当前资料信号不足，暂时无法生成资料关系建议。',
  items: [
    {
      kind: 'insufficient_signal',
      severity: 'info',
      documentIds: ['none'],
      title: '资料关系信号不足',
      reason: '输入无法通过本地安全校验。',
      recommendation: 'review_manually',
      confidence: 0.35,
      signals: ['insufficientSignal'],
    },
  ],
  signals: ['insufficientSignal'],
} satisfies KnowledgeDedupResult);
const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

export type KnowledgeDedupModelCandidateReasonCode =
  | KnowledgeProjectionReasonCode
  | ModelAgentErrorCode
  | 'exact_hash_only'
  | 'no_semantic_pair'
  | 'semantic_duplicate'
  | 'possible_revision'
  | 'complementary'
  | 'unrelated';

export type KnowledgeDedupModelCandidateInput = {
  runId: string;
  deterministicInput: KnowledgeDedupInput;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type KnowledgeDedupModelCandidateEnvelope = {
  value: KnowledgeDedupResult;
  observation: ModelCandidateObservation<KnowledgeDedupModelCandidateReasonCode>;
};

type ValidInput = {
  ok: true;
  runId: string;
  deterministicInput: KnowledgeDedupInput;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export async function runKnowledgeDedupModelCandidate(
  input: KnowledgeDedupModelCandidateInput,
): Promise<KnowledgeDedupModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(
      valid.value ?? SAFE_INVALID_RESULT,
      'fallback_invalid_input',
      valid.budget,
      ['invalid_input'],
    );
  }

  const local = analyzeKnowledgeDedup(valid.deterministicInput);
  const projected = projectKnowledgeSnapshotForCandidate(valid.projectionSource);
  if (!projected.ok) {
    const disposition = isSafetyProjectionReason(projected.reasonCode)
      ? 'safety_blocked'
      : projected.reasonCode === 'no_safe_projection' ||
          projected.reasonCode === 'target_projection_blocked'
        ? 'not_eligible'
        : 'fallback_invalid_input';
    return localEnvelope(local, disposition, valid.budget, [projected.reasonCode]);
  }

  const prepared = prepareSemanticProjection(
    projected.value,
    projected.documentIdsByOrdinal,
    valid.deterministicInput.documents,
  );
  if (!prepared.ok) {
    return localEnvelope(local, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }
  if (prepared.projection.pairs.length === 0) {
    const exactHashOnly = local.items.some((item) => item.kind === 'exact_duplicate');
    return localEnvelope(
      local,
      'not_eligible',
      valid.budget,
      [exactHashOnly ? 'exact_hash_only' : 'no_semantic_pair'],
    );
  }

  const abort = readAbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(local, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }
  if (abort.aborted) {
    return localEnvelope(local, 'fallback_aborted', valid.budget, ['ABORTED']);
  }

  const userPrompt = JSON.stringify(prepared.projection);
  const estimatedInputTokens = estimateCandidateInputTokens([
    SYSTEM_PROMPT,
    userPrompt,
    SCHEMA_DESCRIPTOR,
  ]);
  if (estimatedInputTokens > MAX_INPUT_TOKENS) {
    return localEnvelope(local, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }

  const reservation = reserveModelAgentBudget(valid.budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: MAX_OUTPUT_TOKENS,
  });
  if (!reservation.ok) {
    const errorCode = toModelAgentErrorCode(reservation.code);
    return localEnvelope(
      local,
      mapModelAgentErrorDisposition(errorCode),
      valid.budget,
      [errorCode],
    );
  }

  const runtimeResult = await invokeRuntime({
    input: valid,
    userPrompt,
    estimatedInputTokens,
    reservationBudget: reservation.budget,
  });
  if (runtimeResult === null) {
    return unavailableEnvelope(local, reservation.budget);
  }
  if (!runtimeResult.ok) {
    return attemptedEnvelope(
      local,
      mapModelAgentErrorDisposition(runtimeResult.error.code),
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      [runtimeResult.error.code],
    );
  }

  const decision = validateKnowledgeDedupModelDecision(
    runtimeResult.data,
    prepared.projection.pairs.length,
  );
  if (!decision.ok) {
    return attemptedEnvelope(
      local,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['SCHEMA_INVALID'],
    );
  }

  const merged = mergeKnowledgeDedupDecision({
    local,
    documents: valid.deterministicInput.documents,
    projection: prepared.projection,
    documentIdsByOrdinal: prepared.documentIdsByOrdinal,
    decision: decision.value,
  });
  if (merged === null) {
    return attemptedEnvelope(
      local,
      'fallback_schema_invalid',
      runtimeResult.budget,
      runtimeResult.usage,
      runtimeResult.trace,
      ['SCHEMA_INVALID'],
    );
  }

  return attemptedEnvelope(
    merged,
    'candidate_applied',
    runtimeResult.budget,
    runtimeResult.usage,
    runtimeResult.trace,
    decision.value.decisions.map((item) => item.relation),
  );
}

export function mergeKnowledgeDedupDecision(input: {
  local: KnowledgeDedupResult;
  documents: readonly KnowledgeAgentDocumentInput[];
  projection: KnowledgeModelProjection;
  documentIdsByOrdinal: readonly string[];
  decision: KnowledgeDedupModelDecision;
}): KnowledgeDedupResult | null {
  const validation = validateKnowledgeDedupModelDecision(
    input.decision,
    input.projection.pairs.length,
  );
  if (!validation.ok || !projectionMapIsValid(input)) return null;

  const documentById = new Map(input.documents.map((document) => [document.id, document]));
  const exactItems = input.local.items.filter((item) => item.kind === 'exact_duplicate');
  const semanticItems: KnowledgeDedupItem[] = [];

  for (const modelDecision of validation.value.decisions) {
    const pair = input.projection.pairs[modelDecision.pairIndex];
    if (!pair) return null;
    const leftId = input.documentIdsByOrdinal[ordinalIndex(pair.left)];
    const rightId = input.documentIdsByOrdinal[ordinalIndex(pair.right)];
    const left = leftId ? documentById.get(leftId) : undefined;
    const right = rightId ? documentById.get(rightId) : undefined;
    if (!left || !right || left.id === right.id) return null;

    const item = buildSemanticItem(
      applyKnowledgeDedupLocalRelationAuthority(modelDecision, left, right),
      left,
      right,
    );
    if (item !== null) semanticItems.push(item);
  }

  const items = dedupeItems([...exactItems, ...semanticItems]).slice(
    0,
    MAX_KNOWLEDGE_DEDUP_SUGGESTIONS,
  );
  if (items.length === 0) {
    const insufficient = input.local.items.find(
      (item) => item.kind === 'insufficient_signal',
    );
    return {
      summary: '语义候选未发现需要展示的资料关系，保留本地只读结论。',
      items: insufficient ? [insufficient] : [...SAFE_INVALID_RESULT.items],
      signals: ['modelSemanticDedup', 'insufficientSignal'],
    };
  }
  return {
    summary: `发现 ${items.length} 条经本地约束重建的资料关系建议。`,
    items,
    signals: [
      ...new Set([
        ...input.local.signals.filter((signal) => signal === 'exactDuplicate'),
        'modelSemanticDedup',
      ]),
    ],
  };
}

export function applyKnowledgeDedupLocalRelationAuthority(
  decision: KnowledgeDedupModelDecision['decisions'][number],
  left: KnowledgeAgentDocumentInput,
  right: KnowledgeAgentDocumentInput,
): KnowledgeDedupModelDecision['decisions'][number] {
  if (
    decision.relation !== 'semantic_duplicate' ||
    !hasKnowledgeRevisionSignal(left, right)
  ) {
    return decision;
  }

  const leftTimestamp = Date.parse(left.updatedAt);
  const rightTimestamp = Date.parse(right.updatedAt);
  const localEvidenceCode: 'newer_timestamp' | 'version_signal' =
    Number.isFinite(leftTimestamp) &&
    Number.isFinite(rightTimestamp) &&
    leftTimestamp !== rightTimestamp
      ? 'newer_timestamp'
      : 'version_signal';

  return {
    ...decision,
    relation: 'possible_revision',
    evidenceCodes: ['semantic_overlap', localEvidenceCode],
  };
}

function buildSemanticItem(
  decision: KnowledgeDedupModelDecision['decisions'][number],
  left: KnowledgeAgentDocumentInput,
  right: KnowledgeAgentDocumentInput,
): KnowledgeDedupItem | null {
  const confidence = decision.confidence === 'high' ? 0.84 : 0.7;
  switch (decision.relation) {
    case 'unrelated':
      return null;
    case 'semantic_duplicate':
      return {
        kind: 'semantic_duplicate',
        severity: 'warning',
        documentIds: [left.id, right.id],
        title: '疑似语义重复资料',
        reason: '受限语义候选认为内容高度重合，仍需人工确认，不会自动删除或替换。',
        recommendation: 'review_manually',
        confidence,
        signals: ['modelSemanticDuplicate', ...decision.evidenceCodes],
      };
    case 'possible_revision': {
      const hasLocalSignal = hasKnowledgeRevisionSignal(left, right);
      return {
        kind: 'possible_revision',
        severity: 'warning',
        documentIds: [left.id, right.id],
        title: hasLocalSignal ? '疑似同一资料的不同版本' : '疑似相似资料',
        reason: hasLocalSignal
          ? '语义关系与本地版本或时间信号同时存在，仍需人工确认。'
          : '语义相似但缺少本地版本或时间证据，已降级为人工复核提示。',
        recommendation: 'review_manually',
        confidence: hasLocalSignal ? confidence : Math.min(confidence, 0.68),
        signals: [
          'modelPossibleRevision',
          ...decision.evidenceCodes,
          ...(hasLocalSignal ? ['localVersionSignal'] : ['insufficient_version_evidence']),
        ],
      };
    }
    case 'complementary':
      return {
        kind: 'complementary',
        severity: 'info',
        documentIds: [left.id, right.id],
        title: '语义互补资料',
        reason: '受限语义候选识别出不同用途或互补覆盖，建议同时保留。',
        recommendation: 'keep_both',
        confidence,
        signals: ['modelComplementary', ...decision.evidenceCodes],
      };
  }
}

function prepareSemanticProjection(
  projection: KnowledgeModelProjection,
  documentIdsByOrdinal: readonly string[],
  documents: readonly KnowledgeAgentDocumentInput[],
):
  | {
      ok: true;
      projection: KnowledgeModelProjection;
      documentIdsByOrdinal: readonly string[];
    }
  | { ok: false } {
  if (
    projection.version !== KNOWLEDGE_MODEL_PROJECTION_VERSION ||
    projection.documents.length !== documentIdsByOrdinal.length ||
    new Set(documentIdsByOrdinal).size !== documentIdsByOrdinal.length
  ) {
    return { ok: false };
  }
  const documentById = new Map(documents.map((document) => [document.id, document]));
  if (documentIdsByOrdinal.some((id) => !documentById.has(id))) return { ok: false };

  const pairs = projection.pairs
    .filter((pair) => {
      const left = documentById.get(documentIdsByOrdinal[ordinalIndex(pair.left)] ?? '');
      const right = documentById.get(documentIdsByOrdinal[ordinalIndex(pair.right)] ?? '');
      return !(
        left?.contentHash &&
        right?.contentHash &&
        left.contentHash === right.contentHash
      );
    })
    .map((pair, pairIndex) => ({ ...pair, pairIndex }));
  return {
    ok: true,
    projection: {
      ...projection,
      pairs,
    },
    documentIdsByOrdinal: [...documentIdsByOrdinal],
  };
}

function projectionMapIsValid(input: {
  projection: KnowledgeModelProjection;
  documentIdsByOrdinal: readonly string[];
  documents: readonly KnowledgeAgentDocumentInput[];
}): boolean {
  if (
    input.projection.documents.length !== input.documentIdsByOrdinal.length ||
    new Set(input.documentIdsByOrdinal).size !== input.documentIdsByOrdinal.length
  ) {
    return false;
  }
  const documentIds = new Set(input.documents.map((document) => document.id));
  return (
    input.documentIdsByOrdinal.every((id) => documentIds.has(id)) &&
    input.projection.documents.every(
      (document, index) => document.ordinal === `d${index}`,
    ) &&
    input.projection.pairs.every(
      (pair, index) =>
        pair.pairIndex === index &&
        ordinalIndex(pair.left) < input.documentIdsByOrdinal.length &&
        ordinalIndex(pair.right) < input.documentIdsByOrdinal.length,
    )
  );
}

function ordinalIndex(value: `d${number}`): number {
  const index = Number(value.slice(1));
  return Number.isSafeInteger(index) && index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function dedupeItems(items: readonly KnowledgeDedupItem[]): KnowledgeDedupItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${[...item.documentIds].sort().join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateInput(input: unknown):
  | ValidInput
  | { ok: false; value?: KnowledgeDedupResult; budget: ModelAgentRunBudget } {
  try {
    if (typeof input !== 'object' || input === null) {
      return { ok: false, budget: SAFE_INVALID_BUDGET };
    }
    const candidate = input as Record<string, unknown>;
    const parsedInput = DETERMINISTIC_INPUT_SCHEMA.safeParse(candidate.deterministicInput);
    const budget = cloneBudget(candidate.budget);
    const runId = candidate.runId;
    const runtime = candidate.runtime;
    const signal = candidate.signal;
    if (
      !parsedInput.success ||
      budget === null ||
      typeof runId !== 'string' ||
      !runId.trim() ||
      typeof runtime !== 'object' ||
      runtime === null ||
      typeof (runtime as Record<string, unknown>).invokeStructured !== 'function' ||
      (signal !== undefined && !(signal instanceof AbortSignal))
    ) {
      return { ok: false, budget: budget ?? SAFE_INVALID_BUDGET };
    }
    const local = knowledgeDedupResultSchema.safeParse(analyzeKnowledgeDedup(parsedInput.data));
    if (!local.success) return { ok: false, budget };
    return {
      ok: true,
      runId,
      deterministicInput: parsedInput.data,
      projectionSource: candidate.projectionSource,
      runtime: runtime as Pick<ModelAgentRuntime, 'invokeStructured'>,
      budget,
      ...(signal !== undefined ? { signal } : {}),
    };
  } catch {
    return { ok: false, budget: SAFE_INVALID_BUDGET };
  }
}

function cloneBudget(value: unknown): ModelAgentRunBudget | null {
  try {
    if (!isModelAgentRunBudget(value)) return null;
    const snapshot = {
      maxCalls: value.maxCalls,
      usedCalls: value.usedCalls,
      maxInputTokens: value.maxInputTokens,
      usedInputTokens: value.usedInputTokens,
      maxOutputTokens: value.maxOutputTokens,
      usedOutputTokens: value.usedOutputTokens,
    };
    return isModelAgentRunBudget(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

function readAbortState(signal: AbortSignal | undefined):
  | { ok: true; aborted: boolean }
  | { ok: false } {
  if (signal === undefined) return { ok: true, aborted: false };
  try {
    return typeof signal.aborted === 'boolean'
      ? { ok: true, aborted: signal.aborted }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function invokeRuntime(input: {
  input: ValidInput;
  userPrompt: string;
  estimatedInputTokens: number;
  reservationBudget: ModelAgentRunBudget;
}) {
  let result: unknown;
  try {
    const request: ModelAgentRequest<KnowledgeDedupModelDecision> = {
      runId: input.input.runId,
      task: 'knowledge_dedup',
      schema: KNOWLEDGE_DEDUP_MODEL_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: input.userPrompt,
      estimatedInputTokens: input.estimatedInputTokens,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      budget: safeCandidateBudgetSnapshot(input.input.budget),
      ...(input.input.signal ? { signal: input.input.signal } : {}),
    };
    result = await input.input.runtime.invokeStructured(request);
  } catch {
    return null;
  }
  return sanitizeModelCandidateRuntimeResult({
    value: result,
    dataSchema: KNOWLEDGE_DEDUP_MODEL_SCHEMA,
    task: 'knowledge_dedup',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: input.input.budget,
    previewBudget: input.reservationBudget,
  });
}

function localEnvelope(
  value: KnowledgeDedupResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly KnowledgeDedupModelCandidateReasonCode[],
): KnowledgeDedupModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<KnowledgeDedupModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  value: KnowledgeDedupResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<KnowledgeDedupModelCandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly KnowledgeDedupModelCandidateReasonCode[],
): KnowledgeDedupModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<KnowledgeDedupModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  value: KnowledgeDedupResult,
  budget: ModelAgentRunBudget,
): KnowledgeDedupModelCandidateEnvelope {
  return {
    value,
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

function isSafetyProjectionReason(reason: KnowledgeProjectionReasonCode): boolean {
  return (
    reason === 'credential_material' ||
    reason === 'instruction_override' ||
    reason === 'system_prompt_exfiltration' ||
    reason === 'control_character' ||
    reason === 'unsafe_metadata'
  );
}

function toModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET'
    ? 'INVALID_REQUEST'
    : (code as ModelAgentErrorCode);
}
