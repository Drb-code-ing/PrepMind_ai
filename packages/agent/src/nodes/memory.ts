import type {
  MemoryEvidence,
  UserMemoryType,
} from '@repo/types/api/memory-agent';

export type MemoryAgentInput = {
  now: string;
  profilePreference?: {
    examGoal?: string;
    explanationStyle?: string;
    dailyIntensity?: string;
  };
  recentChatSignals: Array<{
    conversationId: string;
    messageId: string;
    text: string;
    createdAt: string;
  }>;
  weakPointSignals: Array<{
    label: string;
    subject?: string;
    wrongCount: number;
    recentAgainCount: number;
  }>;
  reviewSignals: {
    consecutiveActiveDays: number;
    totalReviewsInWindow: number;
    preferredReviewTime?: string;
  };
  existingMemories: Array<{
    type: UserMemoryType;
    content: string;
  }>;
};

export type MemoryCandidateDraft = {
  type: UserMemoryType;
  title: string;
  content: string;
  reason: string;
  evidence: MemoryEvidence[];
  confidence: number;
};

export type MemoryAgentResult = {
  candidates: MemoryCandidateDraft[];
  signals: string[];
};

const MAX_CANDIDATES = 5;

export function analyzeMemory(input: MemoryAgentInput): MemoryAgentResult {
  const candidates: MemoryCandidateDraft[] = [];
  const signals = new Set<string>();

  addProfileGoal(input, candidates, signals);
  addExplicitPreference(input, candidates, signals);
  addWeakPoint(input, candidates, signals);
  addStudyHabit(input, candidates, signals);

  const uniqueCandidates = candidates
    .filter((candidate) => !hasExistingMemory(input, candidate))
    .slice(0, MAX_CANDIDATES);

  if (uniqueCandidates.length === 0) {
    signals.add('insufficientSignals');
  }

  return {
    candidates: uniqueCandidates,
    signals: [...signals],
  };
}

function addProfileGoal(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const goal = input.profilePreference?.examGoal?.trim();
  if (!goal) return;

  candidates.push({
    type: 'LEARNING_GOAL',
    title: '学习目标',
    content: `用户当前的备考目标是：${goal}。`,
    reason: '用户在个人档案中填写了稳定备考目标。',
    evidence: [{ sourceType: 'preference', summary: `备考目标：${goal}` }],
    confidence: 0.9,
  });
  signals.add('profileGoal');
}

function addExplicitPreference(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const message = input.recentChatSignals.find((item) =>
    /以后|下次|总是|先.*提示|不要直接|苏格拉底|详细/.test(item.text),
  );
  if (!message) return;

  candidates.push({
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先提示或思路，再给完整答案。',
    reason: '用户在聊天中明确表达了讲解方式偏好。',
    evidence: [
      {
        sourceType: 'chat',
        sourceId: message.messageId,
        summary: message.text.slice(0, 80),
      },
    ],
    confidence: 0.86,
  });
  signals.add('explicitPreference');
}

function addWeakPoint(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  const weakPoint = [...input.weakPointSignals].sort(
    (left, right) =>
      right.recentAgainCount - left.recentAgainCount ||
      right.wrongCount - left.wrongCount ||
      left.label.localeCompare(right.label, 'zh-Hans-CN'),
  )[0];

  if (!weakPoint || (weakPoint.wrongCount < 3 && weakPoint.recentAgainCount < 2)) {
    return;
  }

  const subjectPrefix = weakPoint.subject ? `${weakPoint.subject} ` : '';
  candidates.push({
    type: 'WEAK_POINT',
    title: `${weakPoint.label}薄弱点`,
    content: `用户在${subjectPrefix}${weakPoint.label}相关题目中反复出错，适合后续优先复盘。`,
    reason: `该知识点累计错题 ${weakPoint.wrongCount} 道，近期 Again ${weakPoint.recentAgainCount} 次。`,
    evidence: [
      {
        sourceType: 'wrong-question',
        summary: `${weakPoint.label} 重复出错`,
      },
    ],
    confidence: weakPoint.recentAgainCount >= 2 ? 0.84 : 0.76,
  });
  signals.add('repeatedWeakPoint');
}

function addStudyHabit(
  input: MemoryAgentInput,
  candidates: MemoryCandidateDraft[],
  signals: Set<string>,
) {
  if (input.reviewSignals.consecutiveActiveDays < 7) return;

  const time = input.reviewSignals.preferredReviewTime;
  candidates.push({
    type: 'STUDY_HABIT',
    title: '稳定复习习惯',
    content: time
      ? `用户已连续学习一周，常用复习时间接近 ${time}。`
      : '用户已连续学习一周，适合保持稳定的短周期复习节奏。',
    reason: '连续活跃天数达到长期习惯候选阈值。',
    evidence: [
      {
        sourceType: 'review',
        summary: `连续活跃 ${input.reviewSignals.consecutiveActiveDays} 天`,
      },
    ],
    confidence: 0.72,
  });
  signals.add('studyHabit');
}

function hasExistingMemory(input: MemoryAgentInput, candidate: MemoryCandidateDraft) {
  const normalizedContent = normalizeText(candidate.content);
  return input.existingMemories.some((memory) => {
    if (memory.type !== candidate.type) return false;

    const existingContent = normalizeText(memory.content);
    return (
      existingContent.includes(normalizedContent) ||
      normalizedContent.includes(existingContent)
    );
  });
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

export const memoryNode = analyzeMemory;
