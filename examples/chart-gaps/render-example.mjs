import { writeFile } from 'node:fs/promises';

import * as echarts from 'echarts';
import { splitCategoryGaps, splitTimeGaps } from './dist/gap-lines.js';

const WIDTH = 900;
const HEIGHT = 620;
const SOLID_COLOR = '#2457d6';
const BRIDGE_COLOR = '#d97706';

function gapSeries(name, data, axisIndex) {
  return [
    {
      name,
      type: 'line',
      xAxisIndex: axisIndex,
      yAxisIndex: axisIndex,
      data: data.solid,
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 9,
      itemStyle: { color: SOLID_COLOR },
      lineStyle: { color: SOLID_COLOR, width: 3 },
    },
    {
      name,
      type: 'line',
      xAxisIndex: axisIndex,
      yAxisIndex: axisIndex,
      data: data.bridges,
      connectNulls: false,
      symbol: 'none',
      silent: true,
      tooltip: { show: false },
      lineStyle: { color: BRIDGE_COLOR, type: 'dashed', width: 2 },
    },
  ];
}

const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const categoryData = splitCategoryGaps(
  categories,
  [['B', 2], ['D', 7], ['E', 8], ['G', 4]],
);

const hour = 60 * 60 * 1000;
const start = Date.UTC(2025, 0, 1);
const timeData = splitTimeGaps(
  [[start, 2], [start + hour, 3], [start + 3 * hour, 7], [start + 4 * hour, 8]],
  hour,
);

const chart = echarts.init(null, null, {
  renderer: 'svg',
  ssr: true,
  width: WIDTH,
  height: HEIGHT,
});

try {
  chart.setOption({
    animation: false,
    backgroundColor: '#ffffff',
    title: [
      {
        text: 'Category readings',
        subtext: 'Solid blue: observed sequence   Dashed orange: gap bridge',
        left: 'center',
        top: 12,
      },
      {
        text: 'Time readings',
        left: 'center',
        top: 320,
      },
    ],
    grid: [
      { left: 70, right: 35, top: 90, height: 180 },
      { left: 70, right: 35, top: 390, height: 180 },
    ],
    xAxis: [
      {
        type: 'category',
        data: categories,
        gridIndex: 0,
        name: 'Category',
        nameLocation: 'middle',
        nameGap: 28,
      },
      {
        type: 'time',
        min: start,
        max: start + 4 * hour,
        gridIndex: 1,
        name: 'UTC time',
        nameLocation: 'middle',
        nameGap: 28,
        axisLabel: {
          formatter(value) {
            return `${String(new Date(value).getUTCHours()).padStart(2, '0')}:00`;
          },
        },
      },
    ],
    yAxis: [
      { type: 'value', min: 0, max: 10, gridIndex: 0, name: 'Value' },
      { type: 'value', min: 0, max: 10, gridIndex: 1, name: 'Value' },
    ],
    series: [
      ...gapSeries('Category readings', categoryData, 0),
      ...gapSeries('Time readings', timeData, 1),
    ],
  });

  await writeFile(new URL('preview.svg', import.meta.url), `${chart.renderToSVGString()}\n`, 'utf8');
} finally {
  chart.dispose();
}
