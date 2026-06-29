import type { AgentRoute } from '@repo/types/api/agent';

export type CriticRubricRoute = AgentRoute;

export type CriticRubricVerifierStatus =
  | 'trusted'
  | 'suspicious'
  | 'conflict'
  | 'insufficient'
  | 'skipped';

export type CriticRubricInput = {
  route: CriticRubricRoute;
  userPrompt: string;
  assistantText: string;
  verifierStatus?: CriticRubricVerifierStatus;
  tutorIntent?: string;
  ragHitCount?: number;
};

export type CriticRubricResult = {
  passed: boolean;
  failures: string[];
};

const RAG_CITATION_PATTERN =
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:参考资料|References|Sources)\s*[:：]?\s*\n+\s*(?:[-*]|\d+\.)\s+\S/i;
const VERIFIER_NOTICE_PATTERN = /核对|谨慎|资料核对提示|verify|caution/i;
const FINAL_ANSWER_ONLY_PATTERN =
  /^(?:提示|hint)?\s*[:：-]?\s*(?:最终答案|答案|final answer)\s*(?:[:：]|是|is\b)/i;
const WRITE_CLAIM_PATTERN =
  /已经\s*(创建|写入|保存|安排|生成|添加|记录)|已\s*(创建|写入|保存|安排|生成|添加|记录)|\b(created|saved|scheduled|generated|wrote|recorded|added)\b/gi;
const WRITE_NEGATION_PATTERN =
  /(没有|未|并未|不会|不能|无法)\s*(创建|写入|保存|安排|生成|添加|记录)|\b(no|not|never|without)\b[^.。!?]{0,40}\b(created|saved|scheduled|generated|wrote|recorded|added)\b|\b(created|saved|scheduled|generated|wrote|recorded|added)\b[^.。!?]{0,30}\b(not|never)\b/i;

const ADVISORY_ROUTES = new Set<CriticRubricRoute>([
  'study_plan',
  'review_analysis',
  'wrong_question_organize',
  'memory_reflection',
  'knowledge_dedup',
]);

export function evaluateCriticRubric(input: CriticRubricInput): CriticRubricResult {
  const failures: string[] = [];
  const assistantText = input.assistantText.trim();

  if (input.route === 'rag_answer' && (input.ragHitCount ?? 0) > 0) {
    if (!RAG_CITATION_PATTERN.test(assistantText)) {
      failures.push('rag_answer_missing_citations');
    }
  }

  if (
    input.verifierStatus === 'suspicious' ||
    input.verifierStatus === 'conflict' ||
    input.verifierStatus === 'insufficient'
  ) {
    if (!VERIFIER_NOTICE_PATTERN.test(assistantText)) {
      failures.push('verifier_notice_missing');
    }
  }

  if (input.route === 'tutor' && input.tutorIntent === 'socratic_hint') {
    if (FINAL_ANSWER_ONLY_PATTERN.test(assistantText)) {
      failures.push('socratic_hint_gave_final_answer');
    }
  }

  if (ADVISORY_ROUTES.has(input.route) && hasAdvisoryWriteClaim(assistantText)) {
    failures.push('advisory_route_claimed_write');
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

function hasAdvisoryWriteClaim(text: string) {
  for (const match of text.matchAll(WRITE_CLAIM_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const localContext = text.slice(
      Math.max(0, matchIndex - 20),
      Math.min(text.length, matchIndex + match[0].length + 40),
    );

    if (!WRITE_NEGATION_PATTERN.test(localContext)) {
      return true;
    }
  }

  return false;
}
