import type {
  ReviewAgentAction,
  ReviewAgentInput,
  ReviewAgentPriority,
  ReviewAgentResult,
  ReviewAgentWeakPoint,
  ReviewAgentWeakPointInput,
} from '@repo/types/api/review-agent';

const MAX_WEAK_POINTS = 5;

export function analyzeReview(input: ReviewAgentInput): ReviewAgentResult {
  const sortedWeakPointInputs = input.weakKnowledgePoints
    .slice()
    .sort(compareWeakKnowledgePoints);
  const weakPoints = sortedWeakPointInputs
    .slice(0, MAX_WEAK_POINTS)
    .map(toWeakPoint);
  const allWeakPoints = sortedWeakPointInputs.map(toWeakPoint);
  const signals = collectSignals(input, allWeakPoints);
  const priority = determinePriority(input, allWeakPoints);

  if (priority === 'low' && weakPoints.length === 0) {
    return {
      priority,
      summary: '复习压力较低，当前没有明显逾期、低稳定性或近期 Again 信号。',
      weakPoints,
      actions: [
        {
          title: '整理错题本',
          description: '当前没有明显复习压力，可以补充错题备注或检查专题归档。',
          targetHref: '/error-book',
        },
      ],
      signals: ['lowPressure'],
    };
  }

  return {
    priority,
    summary: buildSummary(input, weakPoints, priority),
    weakPoints,
    actions: buildActions(priority, weakPoints),
    signals,
  };
}

export const reviewNode = analyzeReview;

function compareWeakKnowledgePoints(
  left: ReviewAgentWeakPointInput,
  right: ReviewAgentWeakPointInput,
) {
  return (
    right.recentAgainCount - left.recentAgainCount ||
    right.wrongCount - left.wrongCount ||
    right.averageDifficulty - left.averageDifficulty ||
    left.label.localeCompare(right.label, 'zh-Hans-CN')
  );
}

function toWeakPoint(point: ReviewAgentWeakPointInput): ReviewAgentWeakPoint {
  const priority = determineWeakPointPriority(point);

  return {
    label: point.label,
    reason: buildWeakPointReason(point),
    priority,
    confidence: calculateWeakPointConfidence(point, priority),
  };
}

function determineWeakPointPriority(point: ReviewAgentWeakPointInput): ReviewAgentPriority {
  if (
    point.recentAgainCount >= 3 ||
    point.wrongCount >= 5 ||
    point.averageDifficulty >= 4.5 ||
    point.averageStability > 0 && point.averageStability < 2
  ) {
    return 'high';
  }

  if (
    point.recentAgainCount > 0 ||
    point.wrongCount >= 3 ||
    point.averageDifficulty >= 3.5 ||
    point.averageStability > 0 && point.averageStability < 4
  ) {
    return 'medium';
  }

  return 'low';
}

function calculateWeakPointConfidence(
  point: ReviewAgentWeakPointInput,
  priority: ReviewAgentPriority,
) {
  let confidence = priority === 'high' ? 0.78 : priority === 'medium' ? 0.66 : 0.52;

  if (point.recentAgainCount >= 3) confidence += 0.08;
  if (point.wrongCount >= 5) confidence += 0.06;
  if (point.averageDifficulty >= 4.5) confidence += 0.04;
  if (point.averageStability > 0 && point.averageStability < 2) confidence += 0.04;

  return Math.min(0.95, Number(confidence.toFixed(2)));
}

function buildWeakPointReason(point: ReviewAgentWeakPointInput) {
  const reasons: string[] = [];

  if (point.recentAgainCount > 0) {
    reasons.push(`近期 Again ${point.recentAgainCount} 次`);
  }
  if (point.wrongCount > 0) {
    reasons.push(`累计错题 ${point.wrongCount} 道`);
  }
  if (point.averageDifficulty >= 3.5) {
    reasons.push(`平均难度 ${formatMetric(point.averageDifficulty)}`);
  }
  if (point.averageStability > 0 && point.averageStability < 4) {
    reasons.push(`稳定性偏低 ${formatMetric(point.averageStability)}`);
  }

  return reasons.length > 0 ? reasons.join('，') : '暂无明显风险，仅作为低优先级观察点。';
}

function collectSignals(input: ReviewAgentInput, weakPoints: readonly ReviewAgentWeakPoint[]) {
  const signals: string[] = [];

  if (input.cardSummary.overdueCount > 0) signals.push('overdue');
  if (input.cardSummary.dueCount > 0) signals.push('due');
  if (input.cardSummary.highDifficultyCount > 0) signals.push('highDifficulty');
  if (input.cardSummary.lowStabilityCount > 0) signals.push('lowStability');
  if (input.recentReviewSummary.againCount > 0) signals.push('recentAgain');
  if (weakPoints.some((point) => point.priority === 'high')) signals.push('highWeakPoint');
  if (weakPoints.some((point) => point.priority === 'medium')) signals.push('mediumWeakPoint');
  if (signals.length === 0) signals.push('lowPressure');

  return signals;
}

function determinePriority(
  input: ReviewAgentInput,
  weakPoints: readonly ReviewAgentWeakPoint[],
): ReviewAgentPriority {
  if (
    input.cardSummary.overdueCount >= 5 ||
    input.cardSummary.lowStabilityCount >= 5 ||
    input.recentReviewSummary.againCount >= 3 ||
    weakPoints.some((point) => point.priority === 'high')
  ) {
    return 'high';
  }

  if (
    input.cardSummary.overdueCount > 0 ||
    input.cardSummary.dueCount > 0 ||
    input.cardSummary.highDifficultyCount > 0 ||
    weakPoints.some((point) => point.priority === 'medium')
  ) {
    return 'medium';
  }

  return 'low';
}

function buildSummary(
  input: ReviewAgentInput,
  weakPoints: readonly ReviewAgentWeakPoint[],
  priority: ReviewAgentPriority,
) {
  const focusLabel = weakPoints[0]?.label;

  if (priority === 'high') {
    return focusLabel
      ? `复习压力偏高，优先处理「${focusLabel}」等高风险知识点，并先清理今日逾期任务。`
      : '复习压力偏高，逾期、低稳定性或 Again 信号已经达到需要优先处理的阈值。';
  }

  if (priority === 'medium') {
    return focusLabel
      ? `复习压力中等，建议围绕「${focusLabel}」安排一轮针对性巩固。`
      : `复习压力中等，今日有 ${input.cardSummary.dueCount} 张到期卡片需要按计划完成。`;
  }

  return '复习压力较低，可以保持当前节奏并继续维护错题组织。';
}

function buildActions(
  priority: ReviewAgentPriority,
  weakPoints: readonly ReviewAgentWeakPoint[],
): ReviewAgentAction[] {
  if (priority === 'low') {
    return [
      {
        title: '整理错题本',
        description: '当前没有明显复习压力，可以补充错题备注或检查专题归档。',
        targetHref: '/error-book',
      },
    ];
  }

  const focusLabel = weakPoints[0]?.label;

  return [
    {
      title: priority === 'high' ? '先完成今日复习' : '查看今日任务',
      description: focusLabel
        ? `优先处理「${focusLabel}」相关卡片，再补充错题复盘。`
        : '优先处理今日到期和逾期卡片，避免复习压力继续累积。',
      targetHref: '/today',
    },
  ];
}

function formatMetric(value: number) {
  return Number(value.toFixed(1)).toString();
}
