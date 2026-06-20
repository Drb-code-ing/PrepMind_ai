import type { AgentState, RouterResult } from '@repo/types/api/agent';

type RouteRule = {
  route: RouterResult['name'];
  keywords: string[];
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
};

const routeRules: RouteRule[] = [
  {
    route: 'rag_answer',
    keywords: ['上传', '资料', '笔记', '知识库', '根据我', '参考资料'],
    confidence: 0.86,
    reason: '用户问题明确依赖个人资料或知识库。',
    requiresRag: true,
    requiresHumanApproval: false,
  },
  {
    route: 'study_plan',
    keywords: ['计划', '安排', '下周', '今天学什么', '学习重点'],
    confidence: 0.82,
    reason: '用户请求学习计划或任务安排。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'review_analysis',
    keywords: ['复习', '错因', '薄弱', '掌握情况', '为什么总错'],
    confidence: 0.8,
    reason: '用户请求复习表现或错因分析。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'wrong_question_organize',
    keywords: ['整理错题', '错题分类', '专题', '学科卡片'],
    confidence: 0.8,
    reason: '用户请求错题整理。',
    requiresRag: false,
    requiresHumanApproval: true,
  },
  {
    route: 'tutor',
    keywords: ['这道题', '为什么', '怎么做', '讲一下', '解析', '答案'],
    confidence: 0.78,
    reason: '用户请求讲题或追问题目。',
    requiresRag: false,
    requiresHumanApproval: false,
  },
];

export function routeAgentRequest(state: AgentState): RouterResult {
  const text = normalizeText(state.input.text);
  const matchedRule = routeRules.find((rule) =>
    rule.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
  );

  if (matchedRule) {
    return {
      name: matchedRule.route,
      confidence: matchedRule.confidence,
      reason: matchedRule.reason,
      requiresRag: matchedRule.requiresRag,
      requiresHumanApproval: matchedRule.requiresHumanApproval,
    };
  }

  if (state.chatContext?.activeStudyContext) {
    return {
      name: 'tutor',
      confidence: 0.72,
      reason: '当前会话存在 activeStudyContext，默认承接题目追问。',
      requiresRag: false,
      requiresHumanApproval: false,
    };
  }

  return {
    name: 'chat',
    confidence: 0.65,
    reason: '未命中专门工作流，使用普通 Chat。',
    requiresRag: false,
    requiresHumanApproval: false,
  };
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}
