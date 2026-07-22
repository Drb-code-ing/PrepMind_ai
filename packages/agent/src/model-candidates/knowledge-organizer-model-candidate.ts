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
  knowledgeOrganizerResultSchema,
  type KnowledgeOrganizerCollection,
  type KnowledgeOrganizerResult,
  type KnowledgeOrganizerTag,
} from '@repo/types/api/knowledge-agent';

import {
  KNOWLEDGE_ORGANIZER_MODEL_SCHEMA,
  validateKnowledgeOrganizerModelDecision,
  type KnowledgeOrganizerModelDecision,
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
  prepareCandidateText,
  safeCandidateBudgetSnapshot,
  type ModelCandidateDisposition,
  type ModelCandidateObservation,
} from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import type { KnowledgeAgentDocumentInput } from '../nodes/knowledge-dedup.ts';
import {
  organizeKnowledgeDocuments,
  type KnowledgeOrganizerInput,
} from '../nodes/knowledge-organizer.ts';

const MAX_INPUT_TOKENS = 3000;
const MAX_OUTPUT_TOKENS = 700;
const MAX_FINAL_LABELS = 3;

const SYSTEM_PROMPT = [
  'Organize only the supplied ordinal documents.',
  'Return bounded subject, resourceType, topicLabels, and collection membership.',
  'Subject boundaries: math covers mathematics, calculus, matrices, probability, limits, derivatives, and integrals; english covers language learning, long sentences, reading strategy, writing structure, and vocabulary; politics covers political theory, political history, practice-and-knowledge theory, and current affairs.',
  'computer is limited to computer science and software topics such as data structures, operating systems, computer networks, databases, algorithms, and programming.',
  'Use major for named non-computing professional exam disciplines such as digital circuits, engineering mechanics, finance, accounting, law, medicine, and engineering; use other for general or interdisciplinary topics such as project management, art history, education theory, and astronomy when no professional-exam signal exists.',
  'Return exactly one precise source-grounded topic label per document; preserve a complete topic phrase, remove unsafe punctuation instead of splitting the phrase, and use the same topic label for documents in one topic collection.',
  'Never use generic labels such as 核心概念, 复习重点, 补充, 课程, or 资料 as topicLabels; resourceType already represents ���义, 笔记, 真题, 错题, 练习, and 参考资料.',
  'Return only strict JSON with documentIndex and memberIndexes.',
  'Never invent documents, identifiers, write actions, deletion, replacement, persistence, or permissions.',
].join(' ');
const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"tags":[{"documentIndex":0,"subject":"math|english|politics|computer|major|other","resourceType":"lecture|notes|past_exam|mistakes|practice|reference|other","topicLabels":["safe label"]}],"collections":[{"memberIndexes":[0,1],"name":"safe name","theme":"subject|exam|topic|project"}]}. No extra fields.';

const SUBJECT_LABELS = Object.freeze({
  math: '数学',
  english: '英语',
  politics: '政治',
  computer: '计算机',
  major: '专业课',
  other: '其它',
} satisfies Record<KnowledgeOrganizerModelDecision['tags'][number]['subject'], string>);
const RESOURCE_TYPE_LABELS = Object.freeze({
  lecture: '讲义',
  notes: '笔记',
  past_exam: '真题',
  mistakes: '错题',
  practice: '练习',
  reference: '参考资料',
  other: '其它资料',
} satisfies Record<KnowledgeOrganizerModelDecision['tags'][number]['resourceType'], string>);
const THEME_LABELS = Object.freeze({
  subject: '学科',
  exam: '考试',
  topic: '专题',
  project: '项目',
} satisfies Record<KnowledgeOrganizerModelDecision['collections'][number]['theme'], string>);

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
    documents: z.array(DOCUMENT_SCHEMA).max(20),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.documents.map((document) => document.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate document id' });
    }
  });

const SAFE_INVALID_RESULT = Object.freeze({
  summary: '当前资料信号不足，暂时无法生成资料整理建议。',
  collections: [],
  tags: [],
  signals: ['insufficientSignal'],
} satisfies KnowledgeOrganizerResult);
const SAFE_INVALID_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: 1,
  usedInputTokens: 0,
  maxOutputTokens: 1,
  usedOutputTokens: 0,
});

export type KnowledgeOrganizerModelCandidateReasonCode =
  | KnowledgeProjectionReasonCode
  | ModelAgentErrorCode
  | 'no_documents'
  | 'semantic_organization';

export type KnowledgeOrganizerModelCandidateInput = {
  runId: string;
  deterministicInput: KnowledgeOrganizerInput;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export type KnowledgeOrganizerModelCandidateEnvelope = {
  value: KnowledgeOrganizerResult;
  observation: ModelCandidateObservation<KnowledgeOrganizerModelCandidateReasonCode>;
};

type ValidInput = {
  ok: true;
  runId: string;
  deterministicInput: KnowledgeOrganizerInput;
  projectionSource: unknown;
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  budget: ModelAgentRunBudget;
  signal?: AbortSignal;
};

export async function runKnowledgeOrganizerModelCandidate(
  input: KnowledgeOrganizerModelCandidateInput,
): Promise<KnowledgeOrganizerModelCandidateEnvelope> {
  const valid = validateInput(input);
  if (!valid.ok) {
    return localEnvelope(
      valid.value ?? SAFE_INVALID_RESULT,
      'fallback_invalid_input',
      valid.budget,
      ['invalid_input'],
    );
  }

  const local = organizeKnowledgeDocuments(valid.deterministicInput);
  if (valid.deterministicInput.documents.length === 0) {
    return localEnvelope(local, 'not_eligible', valid.budget, ['no_documents']);
  }

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
  if (
    !projectionMapIsValid({
      projection: projected.value,
      documentIdsByOrdinal: projected.documentIdsByOrdinal,
      documents: valid.deterministicInput.documents,
    })
  ) {
    return localEnvelope(local, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }

  const abort = readAbortState(valid.signal);
  if (!abort.ok) {
    return localEnvelope(local, 'fallback_invalid_input', valid.budget, ['invalid_input']);
  }
  if (abort.aborted) {
    return localEnvelope(local, 'fallback_aborted', valid.budget, ['ABORTED']);
  }

  const userPrompt = JSON.stringify(projected.value);
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

  const decision = validateKnowledgeOrganizerModelDecision(
    runtimeResult.data,
    projected.value.documents.length,
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

  const merged = mergeKnowledgeOrganizerDecision({
    documents: valid.deterministicInput.documents,
    projection: projected.value,
    documentIdsByOrdinal: projected.documentIdsByOrdinal,
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
    ['semantic_organization'],
  );
}

export function mergeKnowledgeOrganizerDecision(input: {
  documents: readonly KnowledgeAgentDocumentInput[];
  projection: KnowledgeModelProjection;
  documentIdsByOrdinal: readonly string[];
  decision: KnowledgeOrganizerModelDecision;
}): KnowledgeOrganizerResult | null {
  const validation = validateKnowledgeOrganizerModelDecision(
    input.decision,
    input.projection.documents.length,
  );
  if (!validation.ok || !projectionMapIsValid(input)) return null;
  const locallyConstrained = applyKnowledgeOrganizerLocalSubjectAuthority(
    validation.value,
    input.projection,
  );
  const constrainedValidation = validateKnowledgeOrganizerModelDecision(
    locallyConstrained,
    input.projection.documents.length,
  );
  if (!constrainedValidation.ok || !generatedTextIsSafe(constrainedValidation.value)) {
    return null;
  }

  const tags: KnowledgeOrganizerTag[] = constrainedValidation.value.tags.map((tag) => ({
    documentId: input.documentIdsByOrdinal[tag.documentIndex],
    labels: [
      SUBJECT_LABELS[tag.subject],
      RESOURCE_TYPE_LABELS[tag.resourceType],
      ...tag.topicLabels,
    ]
      .filter((label, index, values) => values.indexOf(label) === index)
      .slice(0, MAX_FINAL_LABELS),
    reason: '语义模型在受限候选中识别出资料主题与类型。',
    confidence: 0.82,
  }));

  const collections: KnowledgeOrganizerCollection[] = constrainedValidation.value.collections.map(
    (collection) => ({
      name: collection.name,
      description: buildCollectionDescription(collection.theme),
      documentIds: collection.memberIndexes.map(
        (index) => input.documentIdsByOrdinal[index],
      ),
      reason: `语义模型建议将 ${collection.memberIndexes.length} 份资料按${THEME_LABELS[collection.theme]}关系聚合，仍由用户确认。`,
      confidence: 0.8,
      signals: [`modelTheme:${collection.theme}`],
    }),
  );

  return {
    summary:
      tags.length + collections.length > 0
        ? `生成 ${tags.length} 条标签建议和 ${collections.length} 个资料集合建议。`
        : '语义候选未发现需要展示的整理关系，保留为空建议。',
    tags,
    collections,
    signals:
      tags.length + collections.length > 0
        ? ['semanticOrganization']
        : ['semanticOrganization', 'insufficientSignal'],
  };
}

export function applyKnowledgeOrganizerLocalSubjectAuthority(
  decision: KnowledgeOrganizerModelDecision,
  projection: KnowledgeModelProjection,
): KnowledgeOrganizerModelDecision {
  return {
    ...decision,
    tags: decision.tags.map((tag) => {
      const document = projection.documents[tag.documentIndex];
      const subject = document ? inferAuthoritativeSubject(document) : null;
      return subject === null || subject === tag.subject ? tag : { ...tag, subject };
    }),
  };
}

function inferAuthoritativeSubject(
  document: KnowledgeModelProjection['documents'][number],
): KnowledgeOrganizerModelDecision['tags'][number]['subject'] | null {
  const text = [document.normalizedName, ...document.summaries]
    .join(' ')
    .normalize('NFKC')
    .toLowerCase();

  if (/数学|高数|微积分|线性代数|矩阵|概率|极限|导数|积分/u.test(text)) return 'math';
  if (/英语|英文|english|长难句|阅读策略|写作结构|词汇复习/u.test(text)) return 'english';
  if (/政治|马原|毛概|思修|实践认识|历史脉络|理论框架|时事专题/u.test(text)) {
    return 'politics';
  }
  if (/计算机|数据结构|操作系统|计算机网络|数据库|软件工程|编程|算法/u.test(text)) {
    return 'computer';
  }
  if (
    /数字电路|工程力学|财务管理|会计|法学|法律|机械工程|电气工程|电子工程|土木工程|医学|药学/u.test(
      text,
    )
  ) {
    return 'major';
  }
  if (/项目管理|艺术史|教育理论|天文学/u.test(text)) return 'other';
  return null;
}

function buildCollectionDescription(
  theme: KnowledgeOrganizerModelDecision['collections'][number]['theme'],
): string {
  switch (theme) {
    case 'subject':
      return '按学科方向聚合的只读资料集合建议。';
    case 'exam':
      return '按考试范围聚合的只读资料集合建议。';
    case 'topic':
      return '按知识专题聚合的只读资料集合建议。';
    case 'project':
      return '按学习项目聚合的只读资料集合建议。';
  }
}

function generatedTextIsSafe(decision: KnowledgeOrganizerModelDecision): boolean {
  return [
    ...decision.tags.flatMap((tag) => tag.topicLabels),
    ...decision.collections.map((collection) => collection.name),
  ].every(isSafeGeneratedLabel);
}

function isSafeGeneratedLabel(value: string): boolean {
  if (
    containsForbiddenControlCharacter(value) ||
    /(?:https?:\/\/|www\.|\[[^\]]*\]\(|<[^>]*>|`|(?:调用|使用).{0,12}(?:工具|接口)|(?:删除|替换|重命名|合并|写入|持久化).{0,12}(?:资料|文档|文件|记录|数据))/iu.test(
      value,
    )
  ) {
    return false;
  }
  return prepareCandidateText({
    value,
    maxRawBytes: 256,
    maxChars: Math.max(1, Array.from(value).length),
  }).ok;
}

function projectionMapIsValid(input: {
  projection: KnowledgeModelProjection;
  documentIdsByOrdinal: readonly string[];
  documents: readonly KnowledgeAgentDocumentInput[];
}): boolean {
  if (
    input.projection.version !== KNOWLEDGE_MODEL_PROJECTION_VERSION ||
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
    )
  );
}

function validateInput(input: unknown):
  | ValidInput
  | { ok: false; value?: KnowledgeOrganizerResult; budget: ModelAgentRunBudget } {
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
    const local = knowledgeOrganizerResultSchema.safeParse(
      organizeKnowledgeDocuments(parsedInput.data),
    );
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
    const request: ModelAgentRequest<KnowledgeOrganizerModelDecision> = {
      runId: input.input.runId,
      task: 'knowledge_organizer',
      schema: KNOWLEDGE_ORGANIZER_MODEL_SCHEMA,
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
    dataSchema: KNOWLEDGE_ORGANIZER_MODEL_SCHEMA,
    task: 'knowledge_organizer',
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    callerBudget: input.input.budget,
    previewBudget: input.reservationBudget,
  });
}

function localEnvelope(
  value: KnowledgeOrganizerResult,
  disposition: ModelCandidateDisposition,
  budget: unknown,
  reasons: readonly KnowledgeOrganizerModelCandidateReasonCode[],
): KnowledgeOrganizerModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: false,
      disposition,
      budget: safeCandidateBudgetSnapshot(budget),
      usage: ZERO_CANDIDATE_USAGE,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<KnowledgeOrganizerModelCandidateReasonCode>,
  };
}

function attemptedEnvelope(
  value: KnowledgeOrganizerResult,
  disposition: ModelCandidateDisposition,
  budget: ModelAgentRunBudget,
  usage: { inputTokens: number; outputTokens: number },
  trace: NonNullable<
    Exclude<
      ModelCandidateObservation<KnowledgeOrganizerModelCandidateReasonCode>,
      { attempted: false }
    >['trace']
  >,
  reasons: readonly KnowledgeOrganizerModelCandidateReasonCode[],
): KnowledgeOrganizerModelCandidateEnvelope {
  return {
    value,
    observation: {
      attempted: true,
      disposition,
      budget,
      usage,
      trace,
      reasonCodes: canonicalCandidateReasonCodes(disposition, reasons),
    } as ModelCandidateObservation<KnowledgeOrganizerModelCandidateReasonCode>,
  };
}

function unavailableEnvelope(
  value: KnowledgeOrganizerResult,
  budget: ModelAgentRunBudget,
): KnowledgeOrganizerModelCandidateEnvelope {
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

function containsForbiddenControlCharacter(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/u.test(value);
}

function toModelAgentErrorCode(code: string): ModelAgentErrorCode {
  return code === 'INVALID_MODEL_AGENT_BUDGET'
    ? 'INVALID_REQUEST'
    : (code as ModelAgentErrorCode);
}
