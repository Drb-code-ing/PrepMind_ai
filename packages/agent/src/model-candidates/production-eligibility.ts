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

type ScalarClaimAnalysis = {
  overflow: boolean;
  valuesBySignature: ReadonlyMap<string, ReadonlySet<string>>;
};

type ClaimAnalysis = {
  text: string;
  topicTerms: ReadonlySet<string>;
  normalizedSentences: readonly string[];
  scalarClaims: ScalarClaimAnalysis;
  polarityClaims: readonly PolarityClaim[];
  exclusiveDefinition: ExclusiveDefinition | null;
  positiveDefinition: PositiveDefinition | null;
};

type PolarityClaim = { negative: boolean; signature: string };
type PositiveDefinition = { subject: string; claim: string };

const MAX_ROUTER_TEXT_BYTES = 16_384;
const MAX_ROUTER_CONTEXT_BYTES = 12_288;
const MAX_QUERY_BYTES = 16_384;
const MAX_CHUNK_COUNT = 20;
const MAX_CHUNK_BYTES = 16_384;
const MAX_AGGREGATE_CHUNK_BYTES = 65_536;
const MAX_EXCERPT_CODE_POINTS = 4_000;
const MAX_CONTEXTUAL_MESSAGE_CODE_POINTS = 24;
const MAX_TOPIC_TERMS = 512;
const MAX_SCALAR_CLAIMS_PER_EXCERPT = 16;

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

const EXPLICIT_CHOICE = /还是/u;
const STANDALONE_CONTEXTUAL_REFERENCE = /^(?:继续|为什么)[。？！?.!]*$/u;
const CONTEXTUAL_FOLLOW_UP =
  /第[零〇一二两三四五六七八九十百千\d]+步|这一步|那一步|这个|那个|这里|那里|它|前面|刚才|继续|为什么|再讲|[呢]。?$/u;
const UNCERTAIN_OR_STALE =
  /可能有误|待核对|尚不确定|不确定|过期|旧版本|来源不清晰|无法确认|有效性[^。？！]{0,12}(?:未知|不明)/u;
const VERIFICATION_QUERY = /可靠|核对|验证|是否有效|能否支持|无法确认/u;
const OPPOSING_RELATIONS: readonly [RegExp, RegExp][] = [
  [/大于|高于|多于|超过|递增|增加|正值/u, /小于|低于|少于|不足|递减|减少|负值/u],
];
const SCALAR_VALUE_PATTERN =
  /\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]+(?:分之[零〇一二两三四五六七八九十百千万亿]+)?/gu;
const CLAIM_SENTENCE_BOUNDARY = /[,，。；;!?！？]+/u;
const CLAIM_DISCOURSE_MARKERS =
  /(?:另一[份段]?|这一|这个|相同|同一|给定|该|所以|因此|根据|材料(?:记载|显示|说明)?|(?:监测|复核)?记录显示|重新计算|本次)/gu;
const NEGATION_PATTERN =
  /不再|并非|不是|不能|没有|未|无|不|(?:^|\s)(?:not|no|never)(?=\s|$)/giu;
const ASCII_STOP_WORDS = new Set([
  'the',
  'this',
  'that',
  'what',
  'which',
  'how',
  'does',
  'with',
  'from',
  'into',
  'about',
]);
const CJK_STOP_BIGRAMS = new Set([
  '这个',
  '那个',
  '这份',
  '如何',
  '什么',
  '是否',
  '能否',
  '当前',
  '该条',
]);

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

    if (intentCount >= 2 || (intentCount >= 1 && EXPLICIT_CHOICE.test(text))) {
      return AMBIGUOUS_MULTI_INTENT;
    }
    if (
      STANDALONE_CONTEXTUAL_REFERENCE.test(text) ||
      (snapshot.activeStudyContext !== undefined &&
        codePointLength(text) <= MAX_CONTEXTUAL_MESSAGE_CODE_POINTS &&
        CONTEXTUAL_FOLLOW_UP.test(text))
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
    const useful = excerpts.filter(
      (chunk) => chunk.score >= 0.65 && chunk.text.length >= 12,
    );
    const query = normalizeCandidateScanText(snapshot.query);
    const relevant = useful.filter(
      (chunk) =>
        isTopicRelevant(query, chunk.text) ||
        (VERIFICATION_QUERY.test(query) && UNCERTAIN_OR_STALE.test(chunk.text)),
    );
    if (relevant.some((chunk) => UNCERTAIN_OR_STALE.test(chunk.text))) {
      return STALE_OR_UNCERTAIN;
    }
    const queryTerms = extractTopicTerms(query);
    const claimAnalyses = relevant.map((chunk) => analyzeClaims(chunk.text));
    if (hasSemanticConflict(queryTerms, claimAnalyses)) {
      return SEMANTIC_CONFLICT;
    }

    if (relevant.length === 0) return NOT_SEMANTIC_NEEDED;
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

function hasSemanticConflict(
  queryTerms: ReadonlySet<string>,
  analyses: readonly ClaimAnalysis[],
): boolean {
  if (analyses.length < 2) return false;

  for (let leftIndex = 0; leftIndex < analyses.length - 1; leftIndex += 1) {
    const left = analyses[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < analyses.length; rightIndex += 1) {
      const right = analyses[rightIndex];
      if (!right) continue;
      if (
        shareClaimContext(queryTerms, left.topicTerms, right.topicTerms) &&
        (OPPOSING_RELATIONS.some(
          ([first, second]) =>
            (first.test(left.text) && second.test(right.text)) ||
            (second.test(left.text) && first.test(right.text)),
        ) ||
          hasExclusiveDefinitionConflict(left, right) ||
          hasOppositePolarity(left, right) ||
          haveDifferentScalarClaims(left.scalarClaims, right.scalarClaims) ||
          haveDifferentCategoryClaims(left, right))
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasExclusiveDefinitionConflict(
  left: ClaimAnalysis,
  right: ClaimAnalysis,
): boolean {
  const leftExclusive = left.exclusiveDefinition;
  const rightExclusive = right.exclusiveDefinition;
  if (leftExclusive && rightExclusive) {
    return exclusionsCrossConflict(leftExclusive, rightExclusive);
  }
  return (
    exclusiveDefinitionOpposes(leftExclusive, right.positiveDefinition) ||
    exclusiveDefinitionOpposes(rightExclusive, left.positiveDefinition)
  );
}

type ExclusiveDefinition = {
  subject: string;
  excluded: string;
  asserted: string;
};

function extractExclusiveDefinition(value: string): ExclusiveDefinition | null {
  const match = value.match(
    /^([\p{Script=Han}a-z0-9_-]{2,32}?)不是([^，。；;]{2,120})[，,]?而是([^。；;]{2,120})/u,
  );
  const subject = match?.[1];
  const excluded = match?.[2];
  const asserted = match?.[3];
  return subject === undefined || excluded === undefined || asserted === undefined
    ? null
    : { subject, excluded, asserted };
}

function exclusionsCrossConflict(
  left: ExclusiveDefinition,
  right: ExclusiveDefinition,
): boolean {
  if (!isTopicRelevant(left.subject, right.subject)) return false;
  const assertedOverlap = termOverlapRatio(left.asserted, right.asserted);
  const crossOverlap = Math.max(
    termOverlapRatio(left.asserted, right.excluded),
    termOverlapRatio(right.asserted, left.excluded),
  );
  return crossOverlap >= 0.3 && crossOverlap > assertedOverlap + 0.1;
}

function extractPositiveDefinition(value: string): PositiveDefinition | null {
  const match = value.match(
    /^([\p{Script=Han}a-z0-9_-]{2,32}?)(?:是指|是)([^。；;]{2,160})/u,
  );
  const subject = match?.[1];
  const claim = match?.[2];
  if (subject === undefined || claim === undefined || subject.endsWith('不')) {
    return null;
  }
  return { subject, claim };
}

function exclusiveDefinitionOpposes(
  exclusive: ExclusiveDefinition | null,
  positive: PositiveDefinition | null,
): boolean {
  if (
    !exclusive ||
    !positive ||
    !isTopicRelevant(exclusive.subject, positive.subject)
  ) {
    return false;
  }

  const excludedOverlap = termOverlapRatio(exclusive.excluded, positive.claim);
  const assertedOverlap = termOverlapRatio(exclusive.asserted, positive.claim);
  return excludedOverlap >= 0.3 && excludedOverlap > assertedOverlap + 0.1;
}

function isTopicRelevant(query: string, evidence: string): boolean {
  const queryTerms = extractTopicTerms(query);
  if (queryTerms.size === 0) return false;
  const evidenceTerms = extractTopicTerms(evidence);
  for (const term of queryTerms) {
    if (evidenceTerms.has(term)) return true;
  }
  return false;
}

function shareClaimContext(
  queryTerms: ReadonlySet<string>,
  leftTerms: ReadonlySet<string>,
  rightTerms: ReadonlySet<string>,
): boolean {
  for (const term of queryTerms) {
    if (leftTerms.has(term) && rightTerms.has(term)) return true;
  }
  return false;
}

function extractTopicTerms(value: string): Set<string> {
  const terms = new Set<string>();
  for (const match of value.matchAll(/[\p{Script=Han}]+/gu)) {
    const characters = Array.from(match[0]);
    for (let index = 0; index < characters.length - 1; index += 1) {
      const term = `${characters[index]}${characters[index + 1]}`;
      if (!CJK_STOP_BIGRAMS.has(term)) terms.add(term);
      if (terms.size >= MAX_TOPIC_TERMS) return terms;
    }
  }
  for (const match of value.matchAll(/[a-z][a-z0-9_-]{2,}/gu)) {
    const term = match[0];
    if (!ASCII_STOP_WORDS.has(term)) terms.add(term);
    if (terms.size >= MAX_TOPIC_TERMS) return terms;
  }
  return terms;
}

function analyzeClaims(text: string): ClaimAnalysis {
  const sentences = splitClaimSentences(text);
  const normalizedSentences = sentences.map((sentence) =>
    normalizeClaimSignature(sentence),
  );
  return {
    text,
    topicTerms: extractTopicTerms(text),
    normalizedSentences,
    scalarClaims: analyzeScalarClaims(sentences),
    polarityClaims: analyzePolarity(sentences),
    exclusiveDefinition: extractExclusiveDefinition(text),
    positiveDefinition: extractPositiveDefinition(text),
  };
}

function haveDifferentScalarClaims(
  left: ScalarClaimAnalysis,
  right: ScalarClaimAnalysis,
): boolean {
  if (left.overflow || right.overflow) return false;
  const smaller =
    left.valuesBySignature.size <= right.valuesBySignature.size
      ? left.valuesBySignature
      : right.valuesBySignature;
  const larger = smaller === left.valuesBySignature
    ? right.valuesBySignature
    : left.valuesBySignature;

  for (const [signature, smallerValues] of smaller) {
    const largerValues = larger.get(signature);
    if (!largerValues) continue;
    let smallerHasUnique = false;
    for (const value of smallerValues) {
      if (!largerValues.has(value)) {
        smallerHasUnique = true;
        break;
      }
    }
    if (!smallerHasUnique) continue;
    for (const value of largerValues) {
      if (!smallerValues.has(value)) return true;
    }
  }
  return false;
}

function analyzeScalarClaims(sentences: readonly string[]): ScalarClaimAnalysis {
  const valuesBySignature = new Map<string, Set<string>>();
  let claimCount = 0;
  for (const rawSentence of sentences) {
    const sentence = rawSentence.replace(CLAIM_DISCOURSE_MARKERS, '');
    for (const match of sentence.matchAll(SCALAR_VALUE_PATTERN)) {
      claimCount += 1;
      if (claimCount > MAX_SCALAR_CLAIMS_PER_EXCERPT) {
        return { overflow: true, valuesBySignature: new Map() };
      }
      const scalar = match[0];
      const start = match.index;
      if (start === undefined) continue;
      const before = maskScalarValues(sentence.slice(0, start));
      const after = maskScalarValues(sentence.slice(start + scalar.length));
      const signature = claimWindow(
        normalizeClaimSignature(`${before}<value>${after}`),
      );
      if (extractTopicTerms(signature).size < 2) continue;
      const canonicalValue = canonicalizeScalarValue(scalar);
      const values = valuesBySignature.get(signature) ?? new Set<string>();
      values.add(canonicalValue);
      valuesBySignature.set(signature, values);
    }
  }
  return { overflow: false, valuesBySignature };
}

function haveDifferentCategoryClaims(
  left: ClaimAnalysis,
  right: ClaimAnalysis,
): boolean {
  for (const leftClaim of left.normalizedSentences) {
    for (const rightClaim of right.normalizedSentences) {
      if (
        (containsScalarValue(leftClaim) && containsScalarValue(rightClaim)) ||
        containsNegation(leftClaim) ||
        containsNegation(rightClaim)
      ) {
        continue;
      }
      const commonPrefix = sharedPrefix(leftClaim, rightClaim);
      const leftValue = leftClaim.slice(commonPrefix.length);
      const rightValue = rightClaim.slice(commonPrefix.length);
      if (
        codePointLength(commonPrefix) >= 6 &&
        extractTopicTerms(commonPrefix).size >= 3 &&
        codePointLength(leftValue) >= 1 &&
        codePointLength(rightValue) >= 1 &&
        codePointLength(leftValue) <= 12 &&
        codePointLength(rightValue) <= 12 &&
        leftValue !== rightValue
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasOppositePolarity(left: ClaimAnalysis, right: ClaimAnalysis): boolean {
  for (const leftClaim of left.polarityClaims) {
    for (const rightClaim of right.polarityClaims) {
      if (
        leftClaim.negative !== rightClaim.negative &&
        signatureSimilarity(leftClaim.signature, rightClaim.signature) >= 0.65
      ) {
        return true;
      }
    }
  }
  return false;
}

function analyzePolarity(
  sentences: readonly string[],
): PolarityClaim[] {
  return sentences.flatMap((sentence) => {
    if (/不是[^。；;]{0,120}而是/u.test(sentence)) return [];
    const negative = containsNegation(sentence);
    NEGATION_PATTERN.lastIndex = 0;
    const signature = normalizeClaimSignature(
      sentence.replace(NEGATION_PATTERN, '').trim(),
    );
    return signature.length >= 4 ? [{ negative, signature }] : [];
  });
}

function containsNegation(value: string): boolean {
  NEGATION_PATTERN.lastIndex = 0;
  const result = NEGATION_PATTERN.test(value);
  NEGATION_PATTERN.lastIndex = 0;
  return result;
}

function containsScalarValue(value: string): boolean {
  SCALAR_VALUE_PATTERN.lastIndex = 0;
  const result = SCALAR_VALUE_PATTERN.test(value);
  SCALAR_VALUE_PATTERN.lastIndex = 0;
  return result;
}

function splitClaimSentences(value: string): string[] {
  return value
    .split(CLAIM_SENTENCE_BOUNDARY)
    .map((sentence) => sentence.trim())
    .filter((sentence) => codePointLength(sentence) >= 4)
    .slice(0, 12);
}

function normalizeClaimSignature(value: string): string {
  return value
    .replace(CLAIM_DISCOURSE_MARKERS, '')
    .replace(/(?:计算)?(?:应)?(?:是|为)|写成|等于/gu, '=')
    .replace(/[\s，。；;,.]/gu, '')
    .slice(0, 160);
}

function maskScalarValues(value: string): string {
  return value.replace(SCALAR_VALUE_PATTERN, '<number>');
}

function canonicalizeScalarValue(value: string): string {
  if (/^\d+(?:\.\d+)?$/u.test(value)) {
    const [integer = '0', fraction] = value.split('.');
    const canonicalInteger = integer.replace(/^0+(?=\d)/u, '');
    if (fraction === undefined) return canonicalInteger;
    const canonicalFraction = fraction.replace(/0+$/u, '');
    return canonicalFraction.length === 0
      ? canonicalInteger
      : `${canonicalInteger}.${canonicalFraction}`;
  }

  const fractionParts = value.split('分之');
  if (fractionParts.length === 2) {
    const denominator = parseChineseInteger(fractionParts[0] ?? '');
    const numerator = parseChineseInteger(fractionParts[1] ?? '');
    if (denominator !== null && numerator !== null && denominator !== 0) {
      return `${numerator}/${denominator}`;
    }
  }

  const integer = parseChineseInteger(value);
  return integer === null ? value : String(integer);
}

function parseChineseInteger(value: string): number | null {
  const digits: Record<string, number> = {
    '零': 0,
    '〇': 0,
    '一': 1,
    '二': 2,
    '两': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9,
  };
  const units: Record<string, number> = {
    '十': 10,
    '百': 100,
    '千': 1_000,
    '万': 10_000,
    '亿': 100_000_000,
  };
  if (value.length === 0) return null;
  if (!/[十百千万亿]/u.test(value)) {
    let digitsOnly = '';
    for (const character of value) {
      const digit = digits[character];
      if (digit === undefined) return null;
      digitsOnly += String(digit);
    }
    const parsed = Number(digitsOnly);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  let total = 0;
  let section = 0;
  let number = 0;
  for (const character of value) {
    const digit = digits[character];
    if (digit !== undefined) {
      number = digit;
      continue;
    }
    const unit = units[character];
    if (unit === undefined) return null;
    if (unit < 10_000) {
      section += (number === 0 ? 1 : number) * unit;
    } else {
      section += number;
      total += (section === 0 ? 1 : section) * unit;
      section = 0;
    }
    number = 0;
  }
  const parsed = total + section + number;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function claimWindow(value: string): string {
  const characters = Array.from(value);
  const marker = '<value>';
  const index = value.indexOf(marker);
  if (index < 0) return characters.slice(0, 48).join('');
  const beforeLength = Array.from(value.slice(0, index)).length;
  return characters
    .slice(Math.max(0, beforeLength - 20), beforeLength + marker.length + 20)
    .join('');
}

function signatureSimilarity(left: string, right: string): number {
  const leftTerms = extractTopicTerms(left);
  const rightTerms = extractTopicTerms(right);
  if (leftTerms.size === 0 || rightTerms.size === 0) return 0;
  let overlap = 0;
  for (const term of leftTerms) {
    if (rightTerms.has(term)) overlap += 1;
  }
  return overlap / Math.min(leftTerms.size, rightTerms.size);
}

function termOverlapRatio(left: string, right: string): number {
  return signatureSimilarity(
    normalizeClaimSignature(left),
    normalizeClaimSignature(right),
  );
}

function sharedPrefix(left: string, right: string): string {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const maxLength = Math.min(leftCharacters.length, rightCharacters.length);
  let length = 0;
  while (
    length < maxLength &&
    leftCharacters[length] === rightCharacters[length]
  ) {
    length += 1;
  }
  return leftCharacters.slice(0, length).join('');
}

function truncateCodePoints(value: string): string {
  return Array.from(value).slice(0, MAX_EXCERPT_CODE_POINTS).join('');
}

function codePointLength(value: string): number {
  return Array.from(value).length;
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
