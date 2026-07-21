import { z } from 'zod';

import { prepareCandidateText } from './model-candidate-policy.ts';

export const KNOWLEDGE_MODEL_PROJECTION_VERSION = 'knowledge-model-projection-v1';

const MAX_FIELD_RAW_BYTES = 65_536;
const MAX_FILENAME_CHARS = 160;
const MAX_SUMMARY_CHARS = 400;
const MAX_SOURCE_SUMMARIES = 12;
const MAX_PROJECTED_SUMMARIES = 2;

const SAFETY_STATE_SCHEMA = z.enum(['safe_for_model', 'unsafe', 'unknown']);
const SOURCE_SUMMARY_SCHEMA = z
  .object({
    text: z.string().min(1).max(MAX_FIELD_RAW_BYTES),
    safety: SAFETY_STATE_SCHEMA,
  })
  .strict();
const SOURCE_DOCUMENT_SCHEMA = z
  .object({
    documentId: z.string().min(1).max(256),
    name: z.string().min(1).max(MAX_FIELD_RAW_BYTES),
    type: z.enum(['PDF', 'DOCX', 'MD', 'TXT']),
    relativeTime: z.enum(['older', 'same_time', 'newer']),
    safety: SAFETY_STATE_SCHEMA,
    summaries: z.array(SOURCE_SUMMARY_SCHEMA).max(MAX_SOURCE_SUMMARIES),
  })
  .strict();
const SOURCE_PAIR_SCHEMA = z
  .object({
    leftDocumentId: z.string().min(1).max(256),
    rightDocumentId: z.string().min(1).max(256),
    evidenceBand: z.enum(['medium', 'high']),
  })
  .strict();
const KNOWLEDGE_MODEL_PROJECTION_SOURCE_SCHEMA = z
  .object({
    targetDocumentId: z.string().min(1).max(256).optional(),
    documents: z.array(SOURCE_DOCUMENT_SCHEMA).max(20),
    pairs: z.array(SOURCE_PAIR_SCHEMA).max(12),
  })
  .strict();

type KnowledgeModelProjectionSource = z.infer<
  typeof KNOWLEDGE_MODEL_PROJECTION_SOURCE_SCHEMA
>;

export type KnowledgeModelProjection = Readonly<{
  version: typeof KNOWLEDGE_MODEL_PROJECTION_VERSION;
  documents: readonly Readonly<{
    ordinal: `d${number}`;
    normalizedName: string;
    type: 'PDF' | 'DOCX' | 'MD' | 'TXT';
    relativeTime: 'older' | 'same_time' | 'newer';
    summaries: readonly string[];
  }>[];
  pairs: readonly Readonly<{
    pairIndex: number;
    left: `d${number}`;
    right: `d${number}`;
    evidenceBand: 'medium' | 'high';
  }>[];
}>;

export type KnowledgeProjectionReasonCode =
  | 'invalid_input'
  | 'credential_material'
  | 'instruction_override'
  | 'system_prompt_exfiltration'
  | 'control_character'
  | 'unsafe_metadata'
  | 'target_projection_blocked'
  | 'no_safe_projection';

export type KnowledgeProjectionResult =
  | {
      ok: true;
      value: KnowledgeModelProjection;
    }
  | { ok: false; reasonCode: KnowledgeProjectionReasonCode };

type InternalKnowledgeProjectionResult =
  | {
      ok: true;
      value: KnowledgeModelProjection;
      documentIdsByOrdinal: readonly string[];
    }
  | { ok: false; reasonCode: KnowledgeProjectionReasonCode };

type PreparedSourceDocument = Readonly<{
  documentId: string;
  normalizedName: string;
  type: KnowledgeModelProjectionSource['documents'][number]['type'];
  relativeTime: KnowledgeModelProjectionSource['documents'][number]['relativeTime'];
  summaries: readonly string[];
}>;

export function projectKnowledgeSnapshot(input: unknown): KnowledgeProjectionResult {
  const projected = projectKnowledgeSnapshotForCandidate(input);
  return projected.ok
    ? { ok: true, value: projected.value }
    : { ok: false, reasonCode: projected.reasonCode };
}

/** @internal Only model candidates may retain the local ordinal-to-ID map. */
export function projectKnowledgeSnapshotForCandidate(
  input: unknown,
): InternalKnowledgeProjectionResult {
  try {
    const cloned = clonePlainData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };

    const parsed = KNOWLEDGE_MODEL_PROJECTION_SOURCE_SCHEMA.safeParse(cloned.value);
    if (!parsed.success || !sourceAssociationsAreValid(parsed.data)) {
      return { ok: false, reasonCode: 'invalid_input' };
    }

    const preparedDocuments: PreparedSourceDocument[] = [];
    let firstExclusionReason: KnowledgeProjectionReasonCode | undefined;

    for (const document of parsed.data.documents) {
      const prepared = prepareCompleteDocument(document);
      if (!prepared.ok) {
        if (document.documentId === parsed.data.targetDocumentId) {
          return { ok: false, reasonCode: 'target_projection_blocked' };
        }
        firstExclusionReason ??= prepared.reasonCode;
        continue;
      }
      preparedDocuments.push(prepared.value);
    }

    if (preparedDocuments.length === 0) {
      return { ok: false, reasonCode: firstExclusionReason ?? 'no_safe_projection' };
    }
    if (
      parsed.data.targetDocumentId !== undefined &&
      !preparedDocuments.some(
        (document) => document.documentId === parsed.data.targetDocumentId,
      )
    ) {
      return { ok: false, reasonCode: 'target_projection_blocked' };
    }

    return {
      ok: true,
      value: buildFrozenProjection(parsed.data, preparedDocuments),
      documentIdsByOrdinal: deepFreeze(
        preparedDocuments.map((document) => document.documentId),
      ),
    };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}

function prepareCompleteDocument(
  document: KnowledgeModelProjectionSource['documents'][number],
):
  | { ok: true; value: PreparedSourceDocument }
  | { ok: false; reasonCode: KnowledgeProjectionReasonCode } {
  let firstFailure: KnowledgeProjectionReasonCode | undefined;
  const preparedName = scanCompleteField(document.name);
  if (!preparedName.ok) firstFailure = preparedName.reasonCode;

  const preparedSummaries: string[] = [];
  for (const summary of document.summaries) {
    const preparedSummary = scanCompleteField(summary.text);
    if (!preparedSummary.ok) {
      firstFailure ??= preparedSummary.reasonCode;
    } else {
      preparedSummaries.push(preparedSummary.value);
    }
  }

  if (
    document.safety !== 'safe_for_model' ||
    document.summaries.some((summary) => summary.safety !== 'safe_for_model')
  ) {
    firstFailure ??= 'unsafe_metadata';
  }
  if (firstFailure !== undefined || !preparedName.ok) {
    return { ok: false, reasonCode: firstFailure ?? 'invalid_input' };
  }

  return {
    ok: true,
    value: {
      documentId: document.documentId,
      normalizedName: truncateCodePoints(preparedName.value, MAX_FILENAME_CHARS),
      type: document.type,
      relativeTime: document.relativeTime,
      summaries: preparedSummaries
        .slice(0, MAX_PROJECTED_SUMMARIES)
        .map((summary) => truncateCodePoints(summary, MAX_SUMMARY_CHARS)),
    },
  };
}

function scanCompleteField(
  value: string,
):
  | { ok: true; value: string }
  | { ok: false; reasonCode: KnowledgeProjectionReasonCode } {
  if (!hasWellFormedUtf16(value)) {
    return { ok: false, reasonCode: 'invalid_input' };
  }
  if (containsForbiddenControlCharacter(value)) {
    return { ok: false, reasonCode: 'control_character' };
  }
  if (containsToolOrWriteInstruction(value)) {
    return { ok: false, reasonCode: 'instruction_override' };
  }

  const guarded = prepareCandidateText({
    value,
    maxRawBytes: MAX_FIELD_RAW_BYTES,
    maxChars: Math.max(1, Array.from(value).length),
  });
  if (!guarded.ok) {
    return {
      ok: false,
      reasonCode:
        guarded.disposition === 'fallback_invalid_input'
          ? 'invalid_input'
          : (guarded.hardBlockCode ?? 'instruction_override'),
    };
  }
  return { ok: true, value: guarded.text };
}

function sourceAssociationsAreValid(input: KnowledgeModelProjectionSource): boolean {
  const documentIds = new Set<string>();
  for (const document of input.documents) {
    if (documentIds.has(document.documentId)) return false;
    documentIds.add(document.documentId);
  }
  if (input.targetDocumentId !== undefined && !documentIds.has(input.targetDocumentId)) {
    return false;
  }

  const pairKeys = new Set<string>();
  for (const pair of input.pairs) {
    if (
      pair.leftDocumentId === pair.rightDocumentId ||
      !documentIds.has(pair.leftDocumentId) ||
      !documentIds.has(pair.rightDocumentId)
    ) {
      return false;
    }
    const key = [pair.leftDocumentId, pair.rightDocumentId].sort().join('\u0000');
    if (pairKeys.has(key)) return false;
    pairKeys.add(key);
  }
  return true;
}

function buildFrozenProjection(
  source: KnowledgeModelProjectionSource,
  documents: readonly PreparedSourceDocument[],
): KnowledgeModelProjection {
  const ordinalByDocumentId = new Map<string, `d${number}`>();
  const projectedDocuments = documents.map((document, index) => {
    const ordinal = `d${index}` as const;
    ordinalByDocumentId.set(document.documentId, ordinal);
    return {
      ordinal,
      normalizedName: document.normalizedName,
      type: document.type,
      relativeTime: document.relativeTime,
      summaries: [...document.summaries],
    };
  });
  const projectedPairs = source.pairs.flatMap((pair) => {
    const left = ordinalByDocumentId.get(pair.leftDocumentId);
    const right = ordinalByDocumentId.get(pair.rightDocumentId);
    if (left === undefined || right === undefined) return [];
    return [{ left, right, evidenceBand: pair.evidenceBand }];
  });

  return deepFreeze({
    version: KNOWLEDGE_MODEL_PROJECTION_VERSION,
    documents: projectedDocuments,
    pairs: projectedPairs.map((pair, pairIndex) => ({ pairIndex, ...pair })),
  });
}

function clonePlainData(
  input: unknown,
  depth = 0,
): { ok: true; value: unknown } | { ok: false } {
  if (depth > 8) return { ok: false };
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return { ok: true, value: input };
  }
  if (typeof input !== 'object') return { ok: false };

  const keys = Reflect.ownKeys(input);
  if (Array.isArray(input)) {
    const allowed = new Set(['length', ...Array.from({ length: input.length }, (_, i) => String(i))]);
    if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) return { ok: false };
    const output: unknown[] = [];
    for (let index = 0; index < input.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
      if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
      const cloned = clonePlainData(descriptor.value, depth + 1);
      if (!cloned.ok) return cloned;
      output.push(cloned.value);
    }
    return { ok: true, value: output };
  }

  const prototype = Reflect.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return { ok: false };
  const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    if (typeof key !== 'string') return { ok: false };
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined || !('value' in descriptor)) return { ok: false };
    const cloned = clonePlainData(descriptor.value, depth + 1);
    if (!cloned.ok) return cloned;
    Object.defineProperty(output, key, {
      value: cloned.value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return { ok: true, value: output };
}

function containsForbiddenControlCharacter(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|\p{Cf}/u.test(value);
}

function hasWellFormedUtf16(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

function containsToolOrWriteInstruction(value: string): boolean {
  return /(?:\b(?:use|call|invoke|execute)\s+(?:the\s+)?(?:tool|api)\b|\b(?:delete|replace|rename|merge|persist|write)\s+(?:this|these|all|the\s+)?(?:documents?|files?|records?|data)\b|(?:调用|使用).{0,12}(?:工具|接口)|(?:删除|替换|重命名|合并|写入|持久化).{0,12}(?:资料|文档|文件|记录|数据))/iu.test(
    value,
  );
}

function truncateCodePoints(value: string, maxChars: number): string {
  return Array.from(value).slice(0, maxChars).join('');
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
