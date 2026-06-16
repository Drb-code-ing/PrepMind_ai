'use client';

import { useEffect, useRef, useState } from 'react';

type BaseEChartProps = {
  option: object;
  className?: string;
  ariaLabel: string;
};

type EChartsInstance = {
  setOption: (option: object, options?: { notMerge?: boolean }) => void;
  resize: () => void;
  dispose: () => void;
};

type EChartsModule = {
  init: (container: HTMLElement) => EChartsInstance;
};

export function BaseEChart({ option, className, ariaLabel }: BaseEChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const latestOptionRef = useRef(option);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function mountChart() {
      if (!containerRef.current) {
        return;
      }

      try {
        const echarts = (await import('echarts')) as EChartsModule;

        if (!isMounted || !containerRef.current) {
          return;
        }

        const chart = echarts.init(containerRef.current);
        chartRef.current = chart;
        chart.setOption(latestOptionRef.current, { notMerge: true });

        resizeObserver = new ResizeObserver(() => {
          chart.resize();
        });
        resizeObserver.observe(containerRef.current);
      } catch {
        if (isMounted) {
          setHasLoadError(true);
        }
      }
    }

    void mountChart();

    return () => {
      isMounted = false;
      resizeObserver?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    latestOptionRef.current = option;
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  if (hasLoadError) {
    return (
      <div className={className} role="status" aria-live="polite">
        图表加载失败，数据仍可在下方查看
      </div>
    );
  }

  return <div ref={containerRef} className={className} role="img" aria-label={ariaLabel} />;
}
