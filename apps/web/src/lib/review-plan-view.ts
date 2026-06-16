import type {
  ReviewTaskPlanDayResponse,
  ReviewTaskPlanIntensity,
  ReviewTaskPlanResponse,
} from '@repo/types/api/review-task';

type PlanBarDatum = {
  value: number;
  itemStyle: {
    color: string;
    borderRadius: number[];
  };
};

type PlanBarTooltipParam = {
  dataIndex?: number;
};

type PlanBarOption = {
  color: string[];
  grid: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    containLabel: boolean;
  };
  tooltip: {
    trigger: 'axis';
    axisPointer: {
      type: 'shadow';
      shadowStyle: {
        color: string;
      };
    };
    borderColor: string;
    backgroundColor: string;
    textStyle: {
      color: string;
      fontSize: number;
    };
    formatter: (params: PlanBarTooltipParam | PlanBarTooltipParam[]) => string;
  };
  xAxis: {
    type: 'category';
    data: string[];
    axisTick: {
      show: boolean;
    };
    axisLine: {
      lineStyle: {
        color: string;
      };
    };
    axisLabel: {
      color: string;
      fontSize: number;
    };
  };
  yAxis: {
    type: 'value';
    minInterval: number;
    splitLine: {
      lineStyle: {
        color: string;
        type: 'dashed';
      };
    };
    axisLabel: {
      color: string;
      fontSize: number;
    };
  };
  series: [
    {
      type: 'bar';
      name: string;
      barMaxWidth: number;
      data: PlanBarDatum[];
    },
  ];
};

const intensityLabels: Record<ReviewTaskPlanIntensity, string> = {
  light: '轻松',
  normal: '正常',
  heavy: '偏重',
};

const intensityClassNames: Record<ReviewTaskPlanIntensity, string> = {
  light: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
  normal: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
  heavy: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
};

const intensityBarColors: Record<ReviewTaskPlanIntensity, string> = {
  light: '#5eead4',
  normal: '#60a5fa',
  heavy: '#fbbf24',
};

export function getPlanIntensityLabel(intensity: ReviewTaskPlanIntensity): string {
  return intensityLabels[intensity];
}

export function getPlanIntensityClassName(intensity: ReviewTaskPlanIntensity): string {
  return intensityClassNames[intensity];
}

export function shouldShowPlanEmptyState(plan: ReviewTaskPlanResponse): boolean {
  const summaryHasPressure =
    plan.summary.overdueCount > 0 ||
    plan.summary.todayDueCount > 0 ||
    plan.summary.upcomingDueCount > 0;

  if (summaryHasPressure) {
    return false;
  }

  return plan.days.every((day) => day.dueCount === 0 && day.overdueCount === 0);
}

export function buildPlanBarOption(days: ReviewTaskPlanDayResponse[]): PlanBarOption {
  const labels = days.map((day) => day.label);
  const data = days.map((day) => ({
    value: day.dueCount + day.overdueCount,
    itemStyle: {
      color: intensityBarColors[day.intensity],
      borderRadius: [8, 8, 3, 3],
    },
  }));

  return {
    color: [intensityBarColors.light, intensityBarColors.normal, intensityBarColors.heavy],
    grid: {
      top: 16,
      right: 10,
      bottom: 24,
      left: 28,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(125, 211, 252, 0.12)',
        },
      },
      borderColor: '#bae6fd',
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      textStyle: {
        color: '#334155',
        fontSize: 12,
      },
      formatter: (params) => {
        const firstParam = Array.isArray(params) ? params[0] : params;
        const day = firstParam?.dataIndex === undefined ? undefined : days[firstParam.dataIndex];

        if (!day) {
          return '';
        }

        return [
          `${day.label} · ${getPlanIntensityLabel(day.intensity)}`,
          `应复习 ${day.dueCount}`,
          `逾期 ${day.overdueCount}`,
          `待完成 ${day.pendingCount}`,
          `已完成 ${day.completedCount}`,
          `已跳过 ${day.skippedCount}`,
          `预计 ${day.estimatedMinutes} 分钟`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: {
        show: false,
      },
      axisLine: {
        lineStyle: {
          color: '#dbeafe',
        },
      },
      axisLabel: {
        color: '#64748b',
        fontSize: 12,
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: {
        lineStyle: {
          color: '#e0f2fe',
          type: 'dashed',
        },
      },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 12,
      },
    },
    series: [
      {
        type: 'bar',
        name: '复习压力',
        barMaxWidth: 28,
        data,
      },
    ],
  };
}
