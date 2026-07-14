import type { RouterResult } from '@repo/types/api/agent';

import type {
  KnowledgeVerifierChunk,
  KnowledgeVerifierResult,
} from '../nodes/knowledge-verifier.ts';
import {
  detectHardBlockedCandidateMaterial,
  normalizeCandidateScanText,
} from './model-candidate-policy.ts';
import { detectRouterSafetyCode } from './router-model-candidate.ts';

export type ModelEligibilityDecision = {
  eligible: boolean;
  reason:
    | 'ambiguous_multi_intent'
    | 'contextual_reference'
    | 'semantic_conflict'
    | 'stale_or_uncertain'
    | 'high_confidence_local'
    | 'not_semantic_needed'
    | 'safety_blocked'
    | 'invalid_input';
};

type RouterEligibilitySnapshot = {
  text: string;
  activeStudyContext?: string;
  deterministic: RouterResult;
};

type VerifierChunkSnapshot = Pick<
  KnowledgeVerifierChunk,
  'chunkId' | 'content' | 'score'
> & {
  riskLevel?: 'low' | 'medium' | 'high';
  safeForPrompt?: boolean;
};

type VerifierEligibilitySnapshot = {
  query: string;
  chunks: VerifierChunkSnapshot[];
  deterministic: KnowledgeVerifierResult;
};

const MAX_ROUTER_TEXT_BYTES = 16_384;
const MAX_ROUTER_CONTEXT_BYTES = 12_288;
const MAX_QUERY_BYTES = 16_384;
const MAX_CHUNK_COUNT = 20;
const MAX_CHUNK_BYTES = 16_384;
const MAX_AGGREGATE_CHUNK_BYTES = 65_536;
const MAX_EXCERPT_CODE_POINTS = 4_000;

const INVALID_INPUT = Object.freeze({
  eligible: false,
  reason: 'invalid_input',
}) satisfies ModelEligibilityDecision;
const SAFETY_BLOCKED = Object.freeze({
  eligible: false,
  reason: 'safety_blocked',
}) satisfies ModelEligibilityDecision;
const AMBIGUOUS_MULTI_INTENT = Object.freeze({
  eligible: true,
  reason: 'ambiguous_multi_intent',
}) satisfies ModelEligibilityDecision;
const CONTEXTUAL_REFERENCE = Object.freeze({
  eligible: true,
  reason: 'contextual_reference',
}) satisfies ModelEligibilityDecision;
const SEMANTIC_CONFLICT = Object.freeze({
  eligible: true,
  reason: 'semantic_conflict',
}) satisfies ModelEligibilityDecision;
const STALE_OR_UNCERTAIN = Object.freeze({
  eligible: true,
  reason: 'stale_or_uncertain',
}) satisfies ModelEligibilityDecision;
const HIGH_CONFIDENCE_LOCAL = Object.freeze({
  eligible: false,
  reason: 'high_confidence_local',
}) satisfies ModelEligibilityDecision;
const NOT_SEMANTIC_NEEDED = Object.freeze({
  eligible: false,
  reason: 'not_semantic_needed',
}) satisfies ModelEligibilityDecision;

const ROUTER_NAMES = new Set<RouterResult['name']>([
  'chat',
  'tutor',
  'rag_answer',
  'study_plan',
  'review_analysis',
  'wrong_question_organize',
]);
const VERIFIER_STATUSES = new Set<KnowledgeVerifierResult['status']>([
  'skipped',
  'trusted',
  'insufficient',
  'conflict',
  'suspicious',
]);

const ROUTER_INTENT_PATTERNS = Object.freeze({
  knowledge: /上传|资料|笔记|知识库|参考资料|讲义|保存的内容|我的内容|对照/u,
  tutor: /这道[^。？！]{0,30}题|讲(?:一下|完)|为什么(?:这里|是)|告诉我为什么|怎么做|怎么算|第二步|什么意思|核对[^。？！]{0,20}结论/u,
  review: /薄弱|错因|总错|又错|掌握情况|复习表现|哪些知识点[^。？！]{0,12}复习/u,
  plan: /计划|安排|学习任务|应该学什么|学习重点|复习节奏|先复习什么|继续学/u,
  organize: /整理[^。？！]{0,12}错题|错题[^。？！]{0,12}分类|放进[^。？！]{0,12}专题|创建[^。？！]{0,12}专题|学科卡片|对应专题/u,
});

const EXPLICIT_MIXED_STRUCTURE = /还是|后再|完后|然后|(?:根据|结合)[^。？！]{1,40}(?:计划|安排)/u;
const STANDALONE_CONTEXTUAL_REFERENCE = /^(?:继续|为什么)[。？！?.!]*$/u;
const CONTEXTUAL_FOLLOW_UP = /那一步|我卡在第二步|这一步再讲|再讲慢一点/u;
const UNCERTAIN_OR_STALE =
  /可能有误|待核对|尚不确定|不确定|过期|旧版本|来源不清晰|无法确认|有效性[^。？！]{0,12}(?:未知|不明)/u;
const CONFLICTING_CUE_PAIRS: readonly [RegExp, RegExp][] = [
  [/递增/u, /递减/u],
  [/大于零/u, /小于零/u],
  [/牛顿/u, /焦耳/u],
  [/一般过去时/u, /现在完成时/u],
  [/适用于|仍然适用/u, /删除|不再适用/u],
];
const NUMBER_TOKEN = /\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]+(?:分之一)?/gu;

export function decideRouterModelEligibility(input: unknown): ModelEligibilityDecision {
  try {
    const snapshot = snapshotRouterInput(input);
    if (!snapshot) return INVALID_INPUT;

    if (
      detectRouterSafetyCode(snapshot.text) !== null ||
      detectHardBlockedCandidateMaterial(snapshot.text) !== null ||
      (snapshot.activeStudyContext !== undefined &&
        (detectRouterSafetyCode(snapshot.activeStudyContext) !== null ||
          detectHardBlockedCandidateMaterial(snapshot.activeStudyContext) !== null))
    ) {
      return SAFETY_BLOCKED;
    }

    const text = normalizeCandidateScanText(snapshot.text);
    const intentCount = Object.values(ROUTER_INTENT_PATTERNS).filter((pattern) =>
      pattern.test(text),
    ).length;

    if (intentCount >= 2 || EXPLICIT_MIXED_STRUCTURE.test(text)) {
      return AMBIGUOUS_MULTI_INTENT;
    }
    if (
      STANDALONE_CONTEXTUAL_REFERENCE.test(text) ||
      (snapshot.activeStudyContext !== undefined && CONTEXTUAL_FOLLOW_UP.test(text))
    ) {
      return CONTEXTUAL_REFERENCE;
    }

    return snapshot.deterministic.name === 'chat'
      ? NOT_SEMANTIC_NEEDED
      : HIGH_CONFIDENCE_LOCAL;
  } catch {
    return INVALID_INPUT;
  }
}

export function decideKnowledgeVerifierModelEligibility(
  input: unknown,
): ModelEligibilityDecision {
  try {
    const snapshot = snapshotVerifierInput(input);
    if (!snapshot) return INVALID_INPUT;

    if (
      hasBlockedMaterial(snapshot.query) ||
      snapshot.chunks.some(
        (chunk) =>
          chunk.riskLevel === 'high' ||
          chunk.safeForPrompt === false ||
          hasBlockedMaterial(chunk.content),
      )
    ) {
      return SAFETY_BLOCKED;
    }

    const excerpts = snapshot.chunks.map((chunk) => ({
      score: chunk.score,
      text: truncateCodePoints(normalizeCandidateScanText(chunk.content)),
    }));
    const combined = excerpts.map((chunk) => chunk.text).join('\n');
    if (UNCERTAIN_OR_STALE.test(combined)) return STALE_OR_UNCERTAIN;

    const useful = excerpts.filter(
      (chunk) => chunk.score >= 0.65 && chunk.text.length >= 12,
    );
    if (hasSemanticConflict(useful.map((chunk) => chunk.text))) {
      return SEMANTIC_CONFLICT;
    }

    if (snapshot.deterministic.status === 'trusted') return HIGH_CONFIDENCE_LOCAL;
    return NOT_SEMANTIC_NEEDED;
  } catch {
    return INVALID_INPUT;
  }
}

export const isRouterModelEligible = (input: unknown) =>
  decideRouterModelEligibility(input).eligible;

export const isKnowledgeVerifierModelEligible = (input: unknown) =>
  decideKnowledgeVerifierModelEligibility(input).eligible;

function snapshotRouterInput(input: unknown): RouterEligibilitySnapshot | null {
  if (!isRecord(input)) return null;
  const text = input.text;
  const activeStudyContext = input.activeStudyContext;
  const rawDeterministic = input.deterministic;
  if (
    !isBoundedString(text, MAX_ROUTER_TEXT_BYTES, false) ||
    (activeStudyContext !== undefined &&
      !isBoundedString(activeStudyContext, MAX_ROUTER_CONTEXT_BYTES, false))
  ) {
    return null;
  }
  const deterministic = snapshotRouterResult(rawDeterministic);
  if (!deterministic) return null;
  return {
    text,
    ...(activeStudyContext === undefined ? {} : { activeStudyContext }),
    deterministic,
  };
}

function snapshotRouterResult(value: unknown): RouterResult | null {
  if (!isRecord(value)) return null;
  const name = value.name;
  const confidence = value.confidence;
  const reason = value.reason;
  const requiresRag = value.requiresRag;
  const requiresHumanApproval = value.requiresHumanApproval;
  if (
    typeof name !== 'string' ||
    !ROUTER_NAMES.has(name as RouterResult['name']) ||
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1 ||
    !isBoundedString(reason, 4_096, false) ||
    typeof requiresRag !== 'boolean' ||
    typeof requiresHumanApproval !== 'boolean'
  ) {
    return null;
  }
  return {
    name: name as RouterResult['name'],
    confidence,
    reason,
    requiresRag,
    requiresHumanApproval,
  };
}

function snapshotVerifierInput(input: unknown): VerifierEligibilitySnapshot | null {
  if (!isRecord(input)) return null;
  const query = input.query;
  const rawChunks = input.chunks;
  const rawDeterministic = input.deterministic;
  if (
    !isBoundedString(query, MAX_QUERY_BYTES, false) ||
    !Array.isArray(rawChunks) ||
    rawChunks.length > MAX_CHUNK_COUNT
  ) {
    return null;
  }

  let aggregateBytes = 0;
  const chunks: VerifierChunkSnapshot[] = [];
  const ids = new Set<string>();
  for (const rawChunk of rawChunks) {
    const chunk = snapshotVerifierChunk(rawChunk);
    if (!chunk || ids.has(chunk.chunkId)) return null;
    ids.add(chunk.chunkId);
    aggregateBytes += utf8Bytes(chunk.content);
    if (aggregateBytes > MAX_AGGREGATE_CHUNK_BYTES) return null;
    chunks.push(chunk);
  }
  chunks.sort(
    (left, right) =>
      right.score - left.score || compareCodeUnits(left.chunkId, right.chunkId),
  );

  const deterministic = snapshotVerifierResult(rawDeterministic);
  if (!deterministic) return null;
  return { query, chunks, deterministic };
}

function snapshotVerifierChunk(value: unknown): VerifierChunkSnapshot | null {
  if (!isRecord(value)) return null;
  const chunkId = value.chunkId;
  const content = value.content;
  const score = value.score;
  const metadata = value.metadata;
  if (
    !isBoundedString(chunkId, 1_024, false) ||
    !isBoundedString(content, MAX_CHUNK_BYTES, true) ||
    typeof score !== 'number' ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 1
  ) {
    return null;
  }

  let riskLevel: VerifierChunkSnapshot['riskLevel'];
  let safeForPrompt: boolean | undefined;
  if (metadata !== undefined) {
    if (!isRecord(metadata)) return null;
    const safety = metadata.safety;
    if (safety !== undefined) {
      if (!isRecord(safety)) return null;
      const rawRiskLevel = safety.riskLevel;
      const rawSafeForPrompt = safety.safeForPrompt;
      if (
        rawRiskLevel !== undefined &&
        rawRiskLevel !== 'low' &&
        rawRiskLevel !== 'medium' &&
        rawRiskLevel !== 'high'
      ) {
        return null;
      }
      if (
        rawSafeForPrompt !== undefined &&
        typeof rawSafeForPrompt !== 'boolean'
      ) {
        return null;
      }
      riskLevel = rawRiskLevel;
      safeForPrompt = rawSafeForPrompt;
    }
  }
  return {
    chunkId,
    content,
    score,
    ...(riskLevel === undefined ? {} : { riskLevel }),
    ...(safeForPrompt === undefined ? {} : { safeForPrompt }),
  };
}

function snapshotVerifierResult(value: unknown): KnowledgeVerifierResult | null {
  if (!isRecord(value)) return null;
  const status = value.status;
  const reason = value.reason;
  const userNotice = value.userNotice;
  const promptAddition = value.promptAddition;
  const debug = value.debug;
  if (
    typeof status !== 'string' ||
    !VERIFIER_STATUSES.has(status as KnowledgeVerifierResult['status']) ||
    !isBoundedString(reason, 8_192, false) ||
    (userNotice !== undefined && !isBoundedString(userNotice, 8_192, true)) ||
    !isBoundedString(promptAddition, 16_384, true) ||
    !isRecord(debug)
  ) {
    return null;
  }
  const checkedChunkCount = debug.checkedChunkCount;
  const lowScoreChunkCount = debug.lowScoreChunkCount;
  const conflictSignals = snapshotStringArray(debug.conflictSignals);
  const suspiciousSignals = snapshotStringArray(debug.suspiciousSignals);
  if (
    typeof checkedChunkCount !== 'number' ||
    !Number.isSafeInteger(checkedChunkCount) ||
    checkedChunkCount < 0 ||
    checkedChunkCount > MAX_CHUNK_COUNT ||
    typeof lowScoreChunkCount !== 'number' ||
    !Number.isSafeInteger(lowScoreChunkCount) ||
    lowScoreChunkCount < 0 ||
    lowScoreChunkCount > MAX_CHUNK_COUNT ||
    !conflictSignals ||
    !suspiciousSignals
  ) {
    return null;
  }
  return {
    status: status as KnowledgeVerifierResult['status'],
    reason,
    ...(userNotice === undefined ? {} : { userNotice }),
    promptAddition,
    debug: {
      checkedChunkCount,
      lowScoreChunkCount,
      conflictSignals,
      suspiciousSignals,
    },
  };
}

function snapshotStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_CHUNK_COUNT) return null;
  const result: string[] = [];
  for (const item of value) {
    if (!isBoundedString(item, 1_024, true)) return null;
    result.push(item);
  }
  return result;
}

function hasBlockedMaterial(value: string): boolean {
  return (
    detectHardBlockedCandidateMaterial(value) !== null ||
    detectRouterSafetyCode(value) !== null
  );
}

function hasSemanticConflict(excerpts: readonly string[]): boolean {
  if (excerpts.length < 2) return false;

  for (let leftIndex = 0; leftIndex < excerpts.length - 1; leftIndex += 1) {
    const left = excerpts[leftIndex] ?? '';
    for (let rightIndex = leftIndex + 1; rightIndex < excerpts.length; rightIndex += 1) {
      const right = excerpts[rightIndex] ?? '';
      if (
        CONFLICTING_CUE_PAIRS.some(
          ([first, second]) =>
            (first.test(left) && second.test(right)) ||
            (second.test(left) && first.test(right)),
        ) ||
        haveDifferentNumberClaims(left, right)
      ) {
        return true;
      }
    }
  }
  return false;
}

function haveDifferentNumberClaims(left: string, right: string): boolean {
  const leftNumbers = new Set(left.match(NUMBER_TOKEN) ?? []);
  const rightNumbers = new Set(right.match(NUMBER_TOKEN) ?? []);
  if (leftNumbers.size === 0 || rightNumbers.size === 0) return false;
  return (
    [...leftNumbers].some((value) => !rightNumbers.has(value)) &&
    [...rightNumbers].some((value) => !leftNumbers.has(value))
  );
}

function truncateCodePoints(value: string): string {
  return Array.from(value).slice(0, MAX_EXCERPT_CODE_POINTS).join('');
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  maxBytes: number,
  allowEmpty: boolean,
): value is string {
  return (
    typeof value === 'string' &&
    (allowEmpty || value.trim().length > 0) &&
    utf8Bytes(value) <= maxBytes
  );
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
