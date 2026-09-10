import type { LinePoint } from "./SampledLineChart.js";

export interface SamplePoint extends LinePoint {
  readonly label: string;
}

export const sampleData: readonly SamplePoint[] = Object.freeze(
  Array.from({ length: 8_000 }, (_, x): SamplePoint => {
    const inGap = (x >= 2_600 && x <= 2_674) || (x >= 5_300 && x <= 5_379);
    let y: number | null = inGap
      ? null
      : Number((22 * Math.sin(x / 47) + 8 * Math.cos(x / 19)).toFixed(4));
    if (x === 1_200) y = 180;
    if (x === 4_100) y = -170;
    if (x === 6_700) y = 200;
    return { x, y, label: `Sample ${x}` };
  }),
);
