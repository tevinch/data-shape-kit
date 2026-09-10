"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { sampleLine } from "./sample-line.js";

export interface LinePoint {
  readonly x: number;
  readonly y: number | null;
}

export interface SampledLineChartProps<T extends LinePoint> {
  readonly data: readonly T[];
  readonly maxPoints: number;
  readonly width: number;
  readonly height: number;
  readonly title?: string;
  readonly xLabel?: string;
  readonly yLabel?: string;
}

const readX = <T extends LinePoint>(row: T): number => row.x;
const readY = <T extends LinePoint>(row: T): number | null => row.y;

export function SampledLineChart<T extends LinePoint>({
  data,
  maxPoints,
  width,
  height,
  title,
  xLabel,
  yLabel,
}: SampledLineChartProps<T>) {
  const sampled = useMemo(
    () => sampleLine(data, { x: readX, y: readY, maxPoints }),
    [data, maxPoints],
  );

  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  for (const row of data) {
    if (row.x < minimumX) minimumX = row.x;
    if (row.x > maximumX) maximumX = row.x;
    if (row.y !== null) {
      if (row.y < minimumY) minimumY = row.y;
      if (row.y > maximumY) maximumY = row.y;
    }
  }
  const xDomain: [number, number] = data.length === 0 ? [0, 1] : [minimumX, maximumX];
  const yDomain: [number, number] = minimumY === Infinity ? [0, 1] : [minimumY, maximumY];

  return (
    <section aria-label={title ?? "Sampled line chart"}>
      {title === undefined ? null : <h2>{title}</h2>}
      <p>
        {sampled.sourceCount.toLocaleString("en-US")} source points ·{" "}
        {sampled.data.length.toLocaleString("en-US")} displayed points
      </p>
      <LineChart width={width} height={height} data={sampled.data as T[]}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey={readX}
          domain={xDomain}
          label={xLabel === undefined ? undefined : { value: xLabel, position: "insideBottom", offset: -5 }}
        />
        <YAxis
          type="number"
          domain={yDomain}
          label={yLabel === undefined ? undefined : { value: yLabel, angle: -90, position: "insideLeft" }}
        />
        <Tooltip />
        <Line
          type="linear"
          dataKey={readY}
          connectNulls={false}
          dot={false}
          isAnimationActive={false}
          stroke="#2563eb"
          strokeWidth={2}
        />
      </LineChart>
    </section>
  );
}
