import type { ReviewStatsResponse } from '@repo/types';

type ReviewTrendItem = {
  date: string;
  count: number;
};

type PieDataItem = {
  name: string;
  value: number;
};

type ReviewTrendOption = {
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
    formatter: string;
  };
  xAxis: {
    type: 'category';
    boundaryGap: boolean;
    data: string[];
    axisTick: { show: boolean };
    axisLine: { lineStyle: { color: string } };
    axisLabel: { color: string };
  };
  yAxis: {
    type: 'value';
    minInterval: number;
    splitLine: { lineStyle: { color: string; type: 'dashed' } };
    axisLabel: { color: string };
  };
  series: [
    {
      name: string;
      type: 'line';
      smooth: boolean;
      symbol: 'circle';
      symbolSize: number;
      lineStyle: { width: number; color: string };
      itemStyle: { color: string };
      areaStyle: {
        color: {
          type: 'linear';
          x: number;
          y: number;
          x2: number;
          y2: number;
          colorStops: Array<{ offset: number; color: string }>;
        };
      };
      data: number[];
    },
  ];
};

type PieDistributionOption = {
  color: string[];
  tooltip: {
    trigger: 'item';
    formatter: string;
  };
  legend: {
    bottom: number;
    left: 'center';
    icon: 'circle';
    itemWidth: number;
    itemHeight: number;
    textStyle: { color: string };
  };
  series: [
    {
      name: string;
      type: 'pie';
      radius: [string, string];
      center: [string, string];
      avoidLabelOverlap: boolean;
      itemStyle: {
        borderColor: string;
        borderWidth: number;
      };
      label: {
        color: string;
        formatter: string;
      };
      emphasis: {
        scaleSize: number;
        label: { show: boolean; fontWeight: number };
      };
      data: PieDataItem[];
    },
  ];
};

export function buildReviewTrendOption(items: ReviewTrendItem[]): ReviewTrendOption {
  return {
    color: ['#22c7b8'],
    grid: {
      top: 16,
      right: 16,
      bottom: 24,
      left: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{a}<br />{b}：{c}',
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: items.map((item) => item.date.slice(5)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#d7f5f1' } },
      axisLabel: { color: '#5f7f88' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#d9f3f5', type: 'dashed' } },
      axisLabel: { color: '#5f7f88' },
    },
    series: [
      {
        name: '复习次数',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#22c7b8' },
        itemStyle: { color: '#0ea5e9' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34, 199, 184, 0.22)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
            ],
          },
        },
        data: items.map((item) => item.count),
      },
    ],
  };
}

export function buildRatingDistributionOption(
  ratingCounts: ReviewStatsResponse['ratingCounts'],
): PieDistributionOption {
  return buildPieDistributionOption('评分分布', [
    { name: '重来', value: ratingCounts.again },
    { name: '吃力', value: ratingCounts.hard },
    { name: '掌握', value: ratingCounts.good },
    { name: '轻松', value: ratingCounts.easy },
  ]);
}

export function buildStateDistributionOption(
  stateCounts: ReviewStatsResponse['stateCounts'],
): PieDistributionOption {
  return buildPieDistributionOption('卡片状态', [
    { name: '新卡', value: stateCounts.NEW },
    { name: '学习中', value: stateCounts.LEARNING },
    { name: '复习中', value: stateCounts.REVIEW },
    { name: '重学中', value: stateCounts.RELEARNING },
  ]);
}

function buildPieDistributionOption(name: string, data: PieDataItem[]): PieDistributionOption {
  return {
    color: ['#38bdf8', '#2dd4bf', '#a7f3d0', '#fde68a'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}：{c} ({d}%)',
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#52666f' },
    },
    series: [
      {
        name,
        type: 'pie',
        radius: ['50%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: '#ffffff',
          borderWidth: 3,
        },
        label: {
          color: '#52666f',
          formatter: '{b}',
        },
        emphasis: {
          scaleSize: 4,
          label: { show: true, fontWeight: 600 },
        },
        data,
      },
    ],
  };
}
