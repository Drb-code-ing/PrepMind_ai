export type EChartRenderer = 'canvas' | 'svg';

export type EChartInitOptions = {
  renderer: EChartRenderer;
  devicePixelRatio: number;
};

export function buildEChartInitOptions(devicePixelRatio: number): EChartInitOptions {
  return {
    renderer: 'svg',
    devicePixelRatio:
      Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1,
  };
}
