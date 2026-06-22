import type {
  PlannerAgentBlock,
  PlannerAgentInput,
  PlannerAgentResult,
} from '@repo/types/api/review-agent';

type AddBlockOptions = {
  title: string;
  preferredMinutes: number;
  reason: string;
  targetHref: string;
};

export function planStudy(input: PlannerAgentInput): PlannerAgentResult {
  const { review, plan, preference } = input;
  const {
    overdueCount,
    todayDueCount,
    upcomingDueCount,
    peakDay,
    capacityStatus,
  } = plan.summary;
  const dailyMinutes = preference.dailyMinutes;
  const isCapacityOver = capacityStatus === 'over';
  const hasDuePressure = overdueCount > 0 || todayDueCount > 0;
  const isFutureCapacityPressure =
    isCapacityOver && !hasDuePressure && upcomingDueCount > 0;
  const isHighPressure = review.priority === 'high' || isCapacityOver;
  const isLightPlan =
    review.priority === 'low' &&
    !hasDuePressure &&
    upcomingDueCount === 0 &&
    capacityStatus === 'under';
  const signals = collectSignals(input, { isCapacityOver, isHighPressure, isLightPlan });
  const blocks = buildSuggestedBlocks(input, {
    isHighPressure,
    isFutureCapacityPressure,
    isLightPlan,
  });

  return {
    headline: buildHeadline({
      overdueCount,
      todayDueCount,
      upcomingDueCount,
      peakDay,
      isHighPressure,
      isFutureCapacityPressure,
      isLightPlan,
    }),
    todayFocus: buildTodayFocus({
      overdueCount,
      todayDueCount,
      firstBlock: blocks[0],
      isFutureCapacityPressure,
      isLightPlan,
    }),
    weekStrategy: buildWeekStrategy({
      upcomingDueCount,
      peakDay,
      capacityStatus,
      dailyMinutes,
    }),
    capacityNotice: buildCapacityNotice(input, isCapacityOver),
    suggestedBlocks: blocks,
    signals,
  };
}

export const plannerNode = planStudy;

function buildSuggestedBlocks(
  input: PlannerAgentInput,
  options: {
    isHighPressure: boolean;
    isFutureCapacityPressure: boolean;
    isLightPlan: boolean;
  },
) {
  const { review, plan, preference } = input;
  const { overdueCount, todayDueCount, upcomingDueCount, peakDay } = plan.summary;
  const blocks: PlannerAgentBlock[] = [];
  let remainingMinutes = preference.dailyMinutes;

  const addBlock = (block: AddBlockOptions) => {
    if (remainingMinutes <= 0) return;

    const minutes = Math.max(1, Math.min(block.preferredMinutes, remainingMinutes));
    blocks.push({
      title: block.title,
      minutes,
      reason: block.reason,
      targetHref: block.targetHref,
    });
    remainingMinutes -= minutes;
  };

  if (options.isLightPlan) {
    addBlock({
      title: '整理错题专题',
      preferredMinutes: Math.min(15, preference.dailyMinutes),
      reason: '当前没有到期压力，适合补齐错题备注、专题归档和薄弱点标签。',
      targetHref: '/error-book',
    });
    addBlock({
      title: '轻量预习本周计划',
      preferredMinutes: Math.min(10, preference.dailyMinutes),
      reason: '保持节奏即可，不需要额外加压。',
      targetHref: '/plan',
    });
    return blocks;
  }

  if (options.isHighPressure) {
    addBlock({
      title:
        overdueCount > 0
          ? '先清理逾期复习'
          : todayDueCount > 0
            ? '先完成今日复习'
            : '先查看后续复习压力',
      preferredMinutes: Math.ceil(preference.dailyMinutes * 0.6),
      reason:
        overdueCount > 0
          ? `已有 ${overdueCount} 张逾期卡片，先止住复习积压。`
          : todayDueCount > 0
            ? `今日有 ${todayDueCount} 张到期卡片，先处理最紧急任务。`
            : buildFuturePressureReason(upcomingDueCount, peakDay),
      targetHref: '/today',
    });
  } else if (todayDueCount > 0) {
    addBlock({
      title: '完成今日到期卡片',
      preferredMinutes: Math.ceil(preference.dailyMinutes * 0.5),
      reason: `今日有 ${todayDueCount} 张到期卡片，按计划完成即可。`,
      targetHref: '/today',
    });
  }

  const weakPoint = review.weakPoints[0];
  if (weakPoint) {
    addBlock({
      title: `复盘${weakPoint.label}`,
      preferredMinutes: Math.ceil(preference.dailyMinutes * 0.25),
      reason: weakPoint.reason,
      targetHref: '/error-book',
    });
  } else if (upcomingDueCount > 0) {
    addBlock({
      title: '预览后续复习压力',
      preferredMinutes: Math.ceil(preference.dailyMinutes * 0.2),
      reason: `未来窗口内还有 ${upcomingDueCount} 张待复习卡片，提前确认高峰日。`,
      targetHref: '/plan',
    });
  }

  if (remainingMinutes > 0 && blocks.length === 0) {
    addBlock({
      title: '维护错题本',
      preferredMinutes: remainingMinutes,
      reason: '当前没有明确高压复习任务，优先保持错题组织质量。',
      targetHref: '/error-book',
    });
  }

  return blocks;
}

function buildHeadline(options: {
  overdueCount: number;
  todayDueCount: number;
  upcomingDueCount: number;
  peakDay: PlannerAgentInput['plan']['summary']['peakDay'];
  isHighPressure: boolean;
  isFutureCapacityPressure: boolean;
  isLightPlan: boolean;
}) {
  if (options.overdueCount > 0) {
    return `先处理 ${options.overdueCount} 张逾期卡片，再安排今日复习。`;
  }

  if (options.isFutureCapacityPressure) {
    const peakText = options.peakDay
      ? `，高峰日在 ${options.peakDay.date}`
      : '';
    return `未来窗口有 ${options.upcomingDueCount} 张待复习卡片${peakText}，先预防后续容量超载。`;
  }

  if (options.isHighPressure) {
    return `今日复习压力偏高，优先完成 ${options.todayDueCount} 张到期卡片。`;
  }

  if (options.isLightPlan) {
    return '今天没有到期压力，适合整理错题和保持轻量节奏。';
  }

  return `按当前节奏完成今日复习，并关注未来 ${options.upcomingDueCount} 张待复习卡片。`;
}

function buildTodayFocus(options: {
  overdueCount: number;
  todayDueCount: number;
  firstBlock: PlannerAgentBlock | undefined;
  isFutureCapacityPressure: boolean;
  isLightPlan: boolean;
}) {
  if (options.isLightPlan) {
    return '把时间放在错题归档、备注补全和专题检查上。';
  }

  if (options.overdueCount > 0) {
    return `先从逾期卡片开始，至少完成「${options.firstBlock?.title ?? '今日复习'}」。`;
  }

  if (options.todayDueCount > 0) {
    return `先完成今日 ${options.todayDueCount} 张到期卡片，避免进入逾期。`;
  }

  if (options.isFutureCapacityPressure) {
    return `今天先检查「${options.firstBlock?.title ?? '后续复习压力'}」，为未来高峰预留容量。`;
  }

  return options.firstBlock?.reason ?? '保持现有复习节奏。';
}

function buildWeekStrategy(options: {
  upcomingDueCount: number;
  peakDay: PlannerAgentInput['plan']['summary']['peakDay'];
  capacityStatus: PlannerAgentInput['plan']['summary']['capacityStatus'];
  dailyMinutes: number;
}) {
  const peakText = options.peakDay
    ? `高峰日在 ${options.peakDay.date}，预计 ${options.peakDay.count} 张。`
    : '本周没有明显复习高峰。';

  if (options.capacityStatus === 'over') {
    return `${peakText} 每日预算先锁定在 ${options.dailyMinutes} 分钟内，必要时拆分到后续日期。`;
  }

  if (options.upcomingDueCount > 0) {
    return `${peakText} 未来还有 ${options.upcomingDueCount} 张待复习卡片，按计划窗口滚动检查。`;
  }

  return `${peakText} 本周以维护错题结构和低压复盘为主。`;
}

function buildCapacityNotice(input: PlannerAgentInput, isCapacityOver: boolean) {
  if (!isCapacityOver) return undefined;

  const { estimatedTotalMinutes } = input.plan.summary;
  const { dailyMinutes } = input.preference;

  return `计划压力已超过每日 ${dailyMinutes} 分钟容量，建议先完成最紧急卡片，剩余任务分批处理。预计窗口总耗时约 ${estimatedTotalMinutes} 分钟。`;
}

function buildFuturePressureReason(
  upcomingDueCount: number,
  peakDay: PlannerAgentInput['plan']['summary']['peakDay'],
) {
  const peakText = peakDay ? `，高峰日在 ${peakDay.date}，预计 ${peakDay.count} 张` : '';

  return `未来窗口内还有 ${upcomingDueCount} 张待复习卡片${peakText}，先确认今天是否需要提前分担。`;
}

function collectSignals(
  input: PlannerAgentInput,
  options: {
    isCapacityOver: boolean;
    isHighPressure: boolean;
    isLightPlan: boolean;
  },
) {
  const signals: string[] = [];
  const { overdueCount, todayDueCount, upcomingDueCount, capacityStatus, intensity } =
    input.plan.summary;

  if (options.isCapacityOver) signals.push('capacityOver');
  if (capacityStatus === 'near') signals.push('capacityNear');
  if (overdueCount > 0) signals.push('overdue');
  if (todayDueCount > 0) signals.push('todayDue');
  if (upcomingDueCount > 0) signals.push('upcomingDue');
  if (intensity === 'heavy') signals.push('heavyWeek');
  if (options.isHighPressure) signals.push('highPriority');
  if (options.isLightPlan) signals.push('lightPlan');

  return signals.length > 0 ? signals : ['normalPlan'];
}
